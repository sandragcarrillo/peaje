// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {PeajeSettlement} from "../src/PeajeSettlement.sol";
import {MockEIP2612, MockFeeOnTransferEIP2612} from "./mocks/MockEIP2612.sol";

/// @dev `settleWithPermit`: the Tempo path, where pathUSD has EIP-2612 permit and no EIP-3009.
contract PeajeSettlementPermitTest is Test {
    PeajeSettlement internal settlement;
    MockEIP2612 internal pathUsd;

    address internal owner = makeAddr("owner");
    address internal relayer = makeAddr("relayer");
    address internal treasury = makeAddr("treasury");
    address internal merchant = makeAddr("merchant");
    address internal otherMerchant = makeAddr("otherMerchant");
    address internal stranger = makeAddr("stranger");

    uint256 internal agentKey = 0xA11CE;
    address internal agent;

    uint16 internal constant FEE_BPS = 200;
    uint256 internal constant MAX_NETWORK_FEE = 10_000;

    bytes32 internal constant PERMIT_TYPEHASH =
        keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)");

    event PaymentSettled(
        bytes32 indexed nonce,
        address indexed token,
        address indexed merchant,
        address payer,
        uint256 amount,
        uint256 fee,
        uint256 networkFee
    );

    function setUp() public {
        agent = vm.addr(agentKey);
        pathUsd = new MockEIP2612();
        settlement = new PeajeSettlement(owner, treasury, FEE_BPS);

        vm.startPrank(owner);
        settlement.setRelayer(relayer, true);
        settlement.setAcceptedToken(address(pathUsd), true, MAX_NETWORK_FEE);
        vm.stopPrank();

        pathUsd.mint(agent, 1_000e6);
        vm.warp(1_000_000);
    }

    function _permit(MockEIP2612 token, uint256 key, uint256 value, uint256 nonce, uint256 deadline)
        internal
        view
        returns (PeajeSettlement.PermitPayment memory p)
    {
        p.owner = vm.addr(key);
        p.value = value;
        p.nonce = nonce;
        p.deadline = deadline;
        bytes32 structHash = keccak256(abi.encode(PERMIT_TYPEHASH, p.owner, address(settlement), value, nonce, deadline));
        (p.v, p.r, p.s) = vm.sign(key, keccak256(abi.encodePacked("\x19\x01", token.DOMAIN_SEPARATOR(), structHash)));
    }

    function _next(uint256 value) internal view returns (PeajeSettlement.PermitPayment memory) {
        return _permit(pathUsd, agentKey, value, pathUsd.nonces(agent), block.timestamp + 300);
    }

    function _settle(PeajeSettlement.PermitPayment memory p, address to, uint256 networkFee) internal returns (uint256) {
        vm.prank(relayer);
        return settlement.settleWithPermit(address(pathUsd), to, p, networkFee);
    }

    // ---- happy path and fee math ----

    function test_SettleWithPermit_SplitsFeeAndPullsFunds() public {
        PeajeSettlement.PermitPayment memory p = _next(1e6);
        bytes32 id = settlement.permitPaymentId(address(pathUsd), agent, 0);

        vm.expectEmit(address(settlement));
        emit PaymentSettled(id, address(pathUsd), merchant, agent, 1e6, 20_000, 0);
        uint256 net = _settle(p, merchant, 0);

        assertEq(net, 980_000);
        assertEq(settlement.claimable(address(pathUsd), merchant), 980_000);
        assertEq(settlement.claimable(address(pathUsd), treasury), 20_000);
        assertEq(settlement.totalOwed(address(pathUsd)), 1e6);
        assertEq(pathUsd.balanceOf(address(settlement)), 1e6);
        assertEq(pathUsd.balanceOf(agent), 999e6);
        assertEq(pathUsd.nonces(agent), 1);
        assertEq(pathUsd.allowance(agent, address(settlement)), 0);
        assertTrue(settlement.permitSettled(id));
    }

    function test_SettleWithPermit_NetworkFeeGoesToFeeRecipient() public {
        // Price 0.10 plus 0.003 of network cost: the merchant nets 0.098, Peaje 0.002 + 0.003.
        uint256 net = _settle(_next(103_000), merchant, 3_000);
        assertEq(net, 98_000);
        assertEq(settlement.claimable(address(pathUsd), treasury), 5_000);
        assertEq(settlement.totalOwed(address(pathUsd)), 103_000);
    }

    function test_SettleWithPermit_SequentialPaymentsUseConsecutiveNonces() public {
        _settle(_next(1e6), merchant, 0);
        _settle(_next(2e6), otherMerchant, 0);
        assertEq(pathUsd.nonces(agent), 2);
        assertEq(settlement.claimable(address(pathUsd), merchant), 980_000);
        assertEq(settlement.claimable(address(pathUsd), otherMerchant), 1_960_000);
        assertEq(settlement.totalOwed(address(pathUsd)), 3e6);
    }

    function test_SettleWithPermit_MerchantWithdraws() public {
        _settle(_next(1e6), merchant, 0);
        vm.prank(merchant);
        settlement.withdraw(address(pathUsd), 980_000, merchant);
        assertEq(pathUsd.balanceOf(merchant), 980_000);
        assertEq(settlement.totalOwed(address(pathUsd)), 20_000);
    }

    function testFuzz_SettleWithPermit_Split(uint256 value, uint256 networkFee) public {
        networkFee = bound(networkFee, 0, MAX_NETWORK_FEE);
        value = bound(value, networkFee + 1, 1_000e6);
        uint256 net = _settle(_next(value), merchant, networkFee);

        uint256 fee = ((value - networkFee) * FEE_BPS) / 10_000;
        assertEq(net, value - networkFee - fee);
        assertEq(settlement.claimable(address(pathUsd), merchant) + settlement.claimable(address(pathUsd), treasury), value);
        assertEq(settlement.totalOwed(address(pathUsd)), value);
        assertEq(pathUsd.balanceOf(address(settlement)), value);
        assertLe(fee, ((value - networkFee) * settlement.MAX_FEE_BPS()) / 10_000);
    }

    // ---- replay and merchant binding ----

    function test_RevertWhen_PermitReplayed() public {
        PeajeSettlement.PermitPayment memory p = _next(1e6);
        _settle(p, merchant, 0);

        bytes32 id = settlement.permitPaymentId(address(pathUsd), agent, 0);
        vm.prank(relayer);
        vm.expectRevert(abi.encodeWithSelector(PeajeSettlement.PermitAlreadySettled.selector, id));
        settlement.settleWithPermit(address(pathUsd), merchant, p, 0);
    }

    function test_RevertWhen_PermitReplayedTowardsAnotherMerchant() public {
        PeajeSettlement.PermitPayment memory p = _next(1e6);
        _settle(p, merchant, 0);

        bytes32 id = settlement.permitPaymentId(address(pathUsd), agent, 0);
        vm.prank(relayer);
        vm.expectRevert(abi.encodeWithSelector(PeajeSettlement.PermitAlreadySettled.selector, id));
        settlement.settleWithPermit(address(pathUsd), otherMerchant, p, 0);
        assertEq(settlement.claimable(address(pathUsd), otherMerchant), 0);
    }

    /// Standing allowance plus a spent nonce must not let an old permit be settled twice.
    function test_RevertWhen_ReplayedWhileStandingAllowanceExists() public {
        PeajeSettlement.PermitPayment memory p = _next(1e6);
        _settle(p, merchant, 0);
        vm.prank(agent);
        pathUsd.approve(address(settlement), 10e6);

        bytes32 id = settlement.permitPaymentId(address(pathUsd), agent, 0);
        vm.prank(relayer);
        vm.expectRevert(abi.encodeWithSelector(PeajeSettlement.PermitAlreadySettled.selector, id));
        settlement.settleWithPermit(address(pathUsd), otherMerchant, p, 0);
    }

    function test_RevertWhen_CallerIsNotRelayer() public {
        PeajeSettlement.PermitPayment memory p = _next(1e6);
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(PeajeSettlement.NotRelayer.selector, stranger));
        settlement.settleWithPermit(address(pathUsd), stranger, p, 0);
    }

    /// The permit is signed for the contract as spender: it cannot be used to pay anyone else.
    function test_RevertWhen_PermitSignedForAnotherSpender() public {
        PeajeSettlement.PermitPayment memory p;
        p.owner = agent;
        p.value = 1e6;
        p.deadline = block.timestamp + 300;
        bytes32 structHash = keccak256(abi.encode(PERMIT_TYPEHASH, agent, stranger, p.value, 0, p.deadline));
        (p.v, p.r, p.s) = vm.sign(agentKey, keccak256(abi.encodePacked("\x19\x01", pathUsd.DOMAIN_SEPARATOR(), structHash)));

        vm.prank(relayer);
        vm.expectRevert(abi.encodeWithSelector(PeajeSettlement.PermitNotUsable.selector, agent, 0));
        settlement.settleWithPermit(address(pathUsd), merchant, p, 0);
    }

    function test_RevertWhen_ValueDiffersFromSigned() public {
        PeajeSettlement.PermitPayment memory p = _next(1e6);
        p.value = 2e6;
        vm.prank(relayer);
        vm.expectRevert(abi.encodeWithSelector(PeajeSettlement.PermitNotUsable.selector, agent, 0));
        settlement.settleWithPermit(address(pathUsd), merchant, p, 0);
    }

    // ---- front-run permit ----

    function test_SettleWithPermit_WhenPermitWasFrontRun() public {
        PeajeSettlement.PermitPayment memory p = _next(1e6);
        vm.prank(stranger);
        pathUsd.permit(agent, address(settlement), p.value, p.deadline, p.v, p.r, p.s);

        uint256 net = _settle(p, merchant, 0);
        assertEq(net, 980_000);
        assertEq(pathUsd.balanceOf(address(settlement)), 1e6);
    }

    function test_RevertWhen_FrontRunAllowanceWasSpent() public {
        PeajeSettlement.PermitPayment memory p = _next(1e6);
        vm.prank(stranger);
        pathUsd.permit(agent, address(settlement), p.value, p.deadline, p.v, p.r, p.s);
        // The owner lowers the allowance after the permit landed.
        vm.prank(agent);
        pathUsd.approve(address(settlement), 1);

        vm.prank(relayer);
        vm.expectRevert(abi.encodeWithSelector(PeajeSettlement.PermitNotUsable.selector, agent, 0));
        settlement.settleWithPermit(address(pathUsd), merchant, p, 0);
    }

    /// A signature over a nonce that is not the current one, with a standing allowance, is
    /// rejected: the nonce is unspent, so the permit was never applied.
    function test_RevertWhen_NonceNotYetSpent() public {
        vm.prank(agent);
        pathUsd.approve(address(settlement), 10e6);
        PeajeSettlement.PermitPayment memory p = _permit(pathUsd, agentKey, 1e6, 5, block.timestamp + 300);

        vm.prank(relayer);
        vm.expectRevert(abi.encodeWithSelector(PeajeSettlement.PermitNotUsable.selector, agent, 5));
        settlement.settleWithPermit(address(pathUsd), merchant, p, 0);
    }

    /// A nonce spent on a permit to someone else plus a standing allowance is not enough:
    /// the signature must be for this contract.
    function test_RevertWhen_ForgedPermitOverSpentNonce() public {
        vm.startPrank(agent);
        pathUsd.approve(address(settlement), 10e6);
        vm.stopPrank();
        uint256 deadline = block.timestamp + 300;
        bytes32 structHash = keccak256(abi.encode(PERMIT_TYPEHASH, agent, stranger, 1, 0, deadline));
        (uint8 v, bytes32 r, bytes32 s) =
            vm.sign(agentKey, keccak256(abi.encodePacked("\x19\x01", pathUsd.DOMAIN_SEPARATOR(), structHash)));
        pathUsd.permit(agent, stranger, 1, deadline, v, r, s);
        assertEq(pathUsd.nonces(agent), 1);

        PeajeSettlement.PermitPayment memory forged = PeajeSettlement.PermitPayment({
            owner: agent, value: 1e6, nonce: 0, deadline: block.timestamp + 300, v: 27, r: bytes32(uint256(1)), s: bytes32(uint256(2))
        });
        vm.prank(relayer);
        vm.expectRevert(abi.encodeWithSelector(PeajeSettlement.PermitNotUsable.selector, agent, 0));
        settlement.settleWithPermit(address(pathUsd), merchant, forged, 0);
    }

    // ---- validation ----

    function test_RevertWhen_DeadlineExpired() public {
        PeajeSettlement.PermitPayment memory p = _permit(pathUsd, agentKey, 1e6, 0, block.timestamp + 10);
        vm.warp(block.timestamp + 11);
        vm.prank(relayer);
        vm.expectRevert(abi.encodeWithSelector(PeajeSettlement.SignatureExpired.selector, p.deadline));
        settlement.settleWithPermit(address(pathUsd), merchant, p, 0);
    }

    function test_SettleWithPermit_AtDeadline() public {
        PeajeSettlement.PermitPayment memory p = _permit(pathUsd, agentKey, 1e6, 0, block.timestamp);
        assertEq(_settle(p, merchant, 0), 980_000);
    }

    function test_RevertWhen_NetworkFeeOverMax() public {
        PeajeSettlement.PermitPayment memory p = _next(1e6);
        vm.prank(relayer);
        vm.expectRevert(
            abi.encodeWithSelector(PeajeSettlement.NetworkFeeTooHigh.selector, MAX_NETWORK_FEE + 1, MAX_NETWORK_FEE)
        );
        settlement.settleWithPermit(address(pathUsd), merchant, p, MAX_NETWORK_FEE + 1);
    }

    function test_RevertWhen_ValueOnlyCoversNetworkFee() public {
        PeajeSettlement.PermitPayment memory p = _next(5_000);
        vm.prank(relayer);
        vm.expectRevert(PeajeSettlement.ZeroAmount.selector);
        settlement.settleWithPermit(address(pathUsd), merchant, p, 5_000);
    }

    function test_RevertWhen_TokenNotAccepted() public {
        MockEIP2612 other = new MockEIP2612();
        other.mint(agent, 1e6);
        PeajeSettlement.PermitPayment memory p = _permit(other, agentKey, 1e6, 0, block.timestamp + 300);
        vm.prank(relayer);
        vm.expectRevert(abi.encodeWithSelector(PeajeSettlement.TokenNotAccepted.selector, address(other)));
        settlement.settleWithPermit(address(other), merchant, p, 0);
    }

    function test_RevertWhen_MerchantIsZero() public {
        PeajeSettlement.PermitPayment memory p = _next(1e6);
        vm.prank(relayer);
        vm.expectRevert(PeajeSettlement.ZeroAddress.selector);
        settlement.settleWithPermit(address(pathUsd), address(0), p, 0);
    }

    function test_RevertWhen_Paused() public {
        vm.prank(owner);
        settlement.pause();
        PeajeSettlement.PermitPayment memory p = _next(1e6);
        vm.prank(relayer);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        settlement.settleWithPermit(address(pathUsd), merchant, p, 0);
    }

    function test_RevertWhen_TokenDeliversLess() public {
        MockFeeOnTransferEIP2612 lossy = new MockFeeOnTransferEIP2612();
        vm.prank(owner);
        settlement.setAcceptedToken(address(lossy), true, MAX_NETWORK_FEE);
        lossy.mint(agent, 1e6);
        PeajeSettlement.PermitPayment memory p = _permit(lossy, agentKey, 1e6, 0, block.timestamp + 300);

        vm.prank(relayer);
        vm.expectRevert(abi.encodeWithSelector(PeajeSettlement.UnexpectedAmountReceived.selector, 1e6, 990_000));
        settlement.settleWithPermit(address(lossy), merchant, p, 0);
    }

    function test_RevertWhen_PayerLacksBalance() public {
        uint256 poorKey = 0xBEEF;
        PeajeSettlement.PermitPayment memory p = _permit(pathUsd, poorKey, 1e6, 0, block.timestamp + 300);
        vm.prank(relayer);
        vm.expectRevert();
        settlement.settleWithPermit(address(pathUsd), merchant, p, 0);
        assertFalse(settlement.permitSettled(settlement.permitPaymentId(address(pathUsd), vm.addr(poorKey), 0)));
    }

    function test_PermitIdsAreScopedByToken() public view {
        assertTrue(
            settlement.permitPaymentId(address(pathUsd), agent, 0) != settlement.permitPaymentId(address(1), agent, 0)
        );
    }
}
