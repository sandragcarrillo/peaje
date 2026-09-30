// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {PeajeSettlement} from "../src/PeajeSettlement.sol";
import {MockEIP3009} from "./mocks/MockEIP3009.sol";
import {MockEIP2612} from "./mocks/MockEIP2612.sol";

contract SettlementHandler is Test {
    PeajeSettlement internal settlement;
    MockEIP3009 internal usdc;
    MockEIP2612 internal pathUsd;
    address internal relayer;

    uint256 internal constant AGENT_KEY = 0xA11CE;
    address internal agent;

    address[] public accounts;
    uint256 internal nonceCounter;

    constructor(
        PeajeSettlement settlement_,
        MockEIP3009 usdc_,
        MockEIP2612 pathUsd_,
        address relayer_,
        address feeRecipient
    ) {
        settlement = settlement_;
        usdc = usdc_;
        pathUsd = pathUsd_;
        relayer = relayer_;
        agent = vm.addr(AGENT_KEY);
        accounts.push(feeRecipient);
        accounts.push(makeAddr("merchantA"));
        accounts.push(makeAddr("merchantB"));
        accounts.push(makeAddr("merchantC"));
    }

    function accountCount() external view returns (uint256) {
        return accounts.length;
    }

    function _signed(uint256 value, bytes32 nonce) internal view returns (PeajeSettlement.Authorization memory auth) {
        auth.from = agent;
        auth.value = value;
        auth.validBefore = block.timestamp + 300;
        auth.nonce = nonce;
        bytes32 structHash = keccak256(
            abi.encode(usdc.TRANSFER_WITH_AUTHORIZATION_TYPEHASH(), agent, address(settlement), value, 0, auth.validBefore, nonce)
        );
        (auth.v, auth.r, auth.s) =
            vm.sign(AGENT_KEY, keccak256(abi.encodePacked("\x19\x01", usdc.DOMAIN_SEPARATOR(), structHash)));
    }

    function settle(uint256 value, uint256 merchantSeed, uint256 networkFee) external {
        networkFee = bound(networkFee, 0, 10_000);
        value = bound(value, networkFee + 1, 10_000e6);
        address merchant = accounts[bound(merchantSeed, 1, accounts.length - 1)];
        usdc.mint(agent, value);

        PeajeSettlement.Authorization memory auth = _signed(value, bytes32(++nonceCounter));
        vm.prank(relayer);
        settlement.settle(address(usdc), merchant, auth, networkFee);
    }

    /// Permit settlement, sometimes with the permit front-run straight to the token, sometimes
    /// replayed afterwards (which must always revert).
    function settlePermit(uint256 value, uint256 merchantSeed, uint256 networkFee, uint8 mode) external {
        networkFee = bound(networkFee, 0, 10_000);
        value = bound(value, networkFee + 1, 10_000e6);
        address merchant = accounts[bound(merchantSeed, 1, accounts.length - 1)];
        pathUsd.mint(agent, value);

        PeajeSettlement.PermitPayment memory p;
        p.owner = agent;
        p.value = value;
        p.nonce = pathUsd.nonces(agent);
        p.deadline = block.timestamp + 300;
        bytes32 structHash = keccak256(
            abi.encode(
                keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"),
                agent,
                address(settlement),
                value,
                p.nonce,
                p.deadline
            )
        );
        (p.v, p.r, p.s) =
            vm.sign(AGENT_KEY, keccak256(abi.encodePacked("\x19\x01", pathUsd.DOMAIN_SEPARATOR(), structHash)));

        if (mode % 3 == 1) pathUsd.permit(agent, address(settlement), value, p.deadline, p.v, p.r, p.s);
        vm.prank(relayer);
        settlement.settleWithPermit(address(pathUsd), merchant, p, networkFee);

        if (mode % 3 == 2) {
            vm.prank(relayer);
            try settlement.settleWithPermit(address(pathUsd), merchant, p, networkFee) {
                revert("permit replayed");
            } catch {}
        }
    }

    function withdraw(uint256 accountSeed, uint256 amount, bool permitToken) external {
        address token = permitToken ? address(pathUsd) : address(usdc);
        address account = accounts[bound(accountSeed, 0, accounts.length - 1)];
        uint256 available = settlement.claimable(token, account);
        if (available == 0) return;

        amount = bound(amount, 1, available);
        vm.prank(account);
        settlement.withdraw(token, amount, account);
    }

    function donate(uint256 value, bool permitToken) external {
        value = bound(value, 1, 1_000e6);
        if (permitToken) pathUsd.mint(address(settlement), value);
        else usdc.mint(address(settlement), value);
    }
}

contract PeajeSettlementInvariantTest is Test {
    PeajeSettlement internal settlement;
    MockEIP3009 internal usdc;
    MockEIP2612 internal pathUsd;
    SettlementHandler internal handler;

    function setUp() public {
        address owner = makeAddr("owner");
        address relayer = makeAddr("relayer");
        address feeRecipient = makeAddr("feeRecipient");

        usdc = new MockEIP3009();
        pathUsd = new MockEIP2612();
        settlement = new PeajeSettlement(owner, feeRecipient, 200);
        vm.startPrank(owner);
        settlement.setRelayer(relayer, true);
        settlement.setAcceptedToken(address(usdc), true, 10_000);
        settlement.setAcceptedToken(address(pathUsd), true, 10_000);
        vm.stopPrank();

        handler = new SettlementHandler(settlement, usdc, pathUsd, relayer, feeRecipient);
        targetContract(address(handler));
    }

    function invariant_BalanceCoversWhatIsOwed() public view {
        assertGe(usdc.balanceOf(address(settlement)), settlement.totalOwed(address(usdc)));
        assertGe(pathUsd.balanceOf(address(settlement)), settlement.totalOwed(address(pathUsd)));
    }

    function invariant_OwedEqualsSumOfClaimable() public view {
        _assertOwedEqualsClaimable(address(usdc));
        _assertOwedEqualsClaimable(address(pathUsd));
    }

    function _assertOwedEqualsClaimable(address token) internal view {
        uint256 sum;
        for (uint256 i; i < handler.accountCount(); ++i) {
            sum += settlement.claimable(token, handler.accounts(i));
        }
        assertEq(sum, settlement.totalOwed(token));
    }
}
