// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {PeajeSettlement} from "../src/PeajeSettlement.sol";
import {MockEIP3009} from "./mocks/MockEIP3009.sol";

contract SettlementHandler is Test {
    PeajeSettlement internal settlement;
    MockEIP3009 internal usdc;
    address internal relayer;

    uint256 internal constant AGENT_KEY = 0xA11CE;
    address internal agent;

    address[] public accounts;
    uint256 internal nonceCounter;

    constructor(PeajeSettlement settlement_, MockEIP3009 usdc_, address relayer_, address feeRecipient) {
        settlement = settlement_;
        usdc = usdc_;
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

    function settle(uint256 value, uint256 merchantSeed) external {
        value = bound(value, 1, 10_000e6);
        address merchant = accounts[bound(merchantSeed, 1, accounts.length - 1)];
        usdc.mint(agent, value);

        PeajeSettlement.Authorization memory auth = _signed(value, bytes32(++nonceCounter));
        vm.prank(relayer);
        settlement.settle(address(usdc), merchant, auth);
    }

    function withdraw(uint256 accountSeed, uint256 amount) external {
        address account = accounts[bound(accountSeed, 0, accounts.length - 1)];
        uint256 available = settlement.claimable(address(usdc), account);
        if (available == 0) return;

        amount = bound(amount, 1, available);
        vm.prank(account);
        settlement.withdraw(address(usdc), amount, account);
    }

    function donate(uint256 value) external {
        value = bound(value, 1, 1_000e6);
        usdc.mint(address(settlement), value);
    }
}

contract PeajeSettlementInvariantTest is Test {
    PeajeSettlement internal settlement;
    MockEIP3009 internal usdc;
    SettlementHandler internal handler;

    function setUp() public {
        address owner = makeAddr("owner");
        address relayer = makeAddr("relayer");
        address feeRecipient = makeAddr("feeRecipient");

        usdc = new MockEIP3009();
        settlement = new PeajeSettlement(owner, feeRecipient, 200);
        vm.startPrank(owner);
        settlement.setRelayer(relayer, true);
        settlement.setAcceptedToken(address(usdc), true);
        vm.stopPrank();

        handler = new SettlementHandler(settlement, usdc, relayer, feeRecipient);
        targetContract(address(handler));
    }

    function invariant_BalanceCoversWhatIsOwed() public view {
        assertGe(usdc.balanceOf(address(settlement)), settlement.totalOwed(address(usdc)));
    }

    function invariant_OwedEqualsSumOfClaimable() public view {
        uint256 sum;
        for (uint256 i; i < handler.accountCount(); ++i) {
            sum += settlement.claimable(address(usdc), handler.accounts(i));
        }
        assertEq(sum, settlement.totalOwed(address(usdc)));
    }
}
