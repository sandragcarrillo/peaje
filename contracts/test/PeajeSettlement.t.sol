// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {PeajeSettlement} from "../src/PeajeSettlement.sol";
import {MockEIP3009, MockFeeOnTransferEIP3009} from "./mocks/MockEIP3009.sol";

contract PeajeSettlementTest is Test {
    PeajeSettlement internal settlement;
    MockEIP3009 internal usdc;

    address internal owner = makeAddr("owner");
    address internal relayer = makeAddr("relayer");
    address internal treasury = makeAddr("treasury");
    uint256 internal merchantKey = 0xB0B;
    address internal merchant = vm.addr(merchantKey);
    address internal stranger = makeAddr("stranger");

    uint256 internal agentKey = 0xA11CE;
    address internal agent;

    uint16 internal constant FEE_BPS = 200;

    function setUp() public {
        agent = vm.addr(agentKey);
        usdc = new MockEIP3009();
        settlement = new PeajeSettlement(owner, treasury, FEE_BPS);

        vm.startPrank(owner);
        settlement.setRelayer(relayer, true);
        settlement.setAcceptedToken(address(usdc), true);
        vm.stopPrank();

        usdc.mint(agent, 1_000e6);
        vm.warp(1_000_000);
    }

    function _authorize(MockEIP3009 token, uint256 value, bytes32 nonce)
        internal
        view
        returns (PeajeSettlement.Authorization memory auth)
    {
        auth.from = agent;
        auth.value = value;
        auth.validAfter = 0;
        auth.validBefore = block.timestamp + 300;
        auth.nonce = nonce;

        bytes32 structHash = keccak256(
            abi.encode(
                token.TRANSFER_WITH_AUTHORIZATION_TYPEHASH(),
                agent,
                address(settlement),
                value,
                auth.validAfter,
                auth.validBefore,
                nonce
            )
        );
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", token.DOMAIN_SEPARATOR(), structHash));
        (auth.v, auth.r, auth.s) = vm.sign(agentKey, digest);
    }

    function _settle(uint256 value, bytes32 nonce) internal returns (uint256) {
        PeajeSettlement.Authorization memory auth = _authorize(usdc, value, nonce);
        vm.prank(relayer);
        return settlement.settle(address(usdc), merchant, auth);
    }

    function _signWithdraw(uint256 key, address account, uint256 amount, address to, uint256 deadline)
        internal
        view
        returns (bytes memory)
    {
        bytes32 structHash = keccak256(
            abi.encode(
                settlement.WITHDRAW_TYPEHASH(),
                address(usdc),
                account,
                amount,
                to,
                settlement.nonces(account),
                deadline
            )
        );
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", settlement.DOMAIN_SEPARATOR(), structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, digest);
        return abi.encodePacked(r, s, v);
    }

    // ---- settle ----

    function test_Settle_SplitsFeeAndCreditsMerchant() public {
        uint256 net = _settle(20_000, keccak256("pay-1"));

        assertEq(net, 19_600);
        assertEq(settlement.claimable(address(usdc), merchant), 19_600);
        assertEq(settlement.claimable(address(usdc), treasury), 400);
        assertEq(settlement.totalOwed(address(usdc)), 20_000);
        assertEq(usdc.balanceOf(address(settlement)), 20_000);
    }

    function test_Settle_EmitsPaymentSettled() public {
        PeajeSettlement.Authorization memory auth = _authorize(usdc, 20_000, keccak256("pay-1"));

        vm.expectEmit(address(settlement));
        emit PeajeSettlement.PaymentSettled(keccak256("pay-1"), address(usdc), merchant, agent, 20_000, 400);

        vm.prank(relayer);
        settlement.settle(address(usdc), merchant, auth);
    }

    function test_Settle_ZeroFeeCreditsFullAmount() public {
        vm.prank(owner);
        settlement.setFee(0, treasury);

        _settle(20_000, keccak256("pay-1"));

        assertEq(settlement.claimable(address(usdc), merchant), 20_000);
        assertEq(settlement.claimable(address(usdc), treasury), 0);
    }

    function test_Settle_RevertsForNonRelayer() public {
        PeajeSettlement.Authorization memory auth = _authorize(usdc, 20_000, keccak256("pay-1"));

        vm.expectRevert(abi.encodeWithSelector(PeajeSettlement.NotRelayer.selector, stranger));
        vm.prank(stranger);
        settlement.settle(address(usdc), merchant, auth);
    }

    function test_Settle_RevertsForUnacceptedToken() public {
        MockEIP3009 other = new MockEIP3009();
        other.mint(agent, 1e6);
        PeajeSettlement.Authorization memory auth = _authorize(other, 1e6, keccak256("pay-1"));

        vm.expectRevert(abi.encodeWithSelector(PeajeSettlement.TokenNotAccepted.selector, address(other)));
        vm.prank(relayer);
        settlement.settle(address(other), merchant, auth);
    }

    function test_Settle_RevertsForZeroMerchant() public {
        PeajeSettlement.Authorization memory auth = _authorize(usdc, 20_000, keccak256("pay-1"));

        vm.expectRevert(PeajeSettlement.ZeroAddress.selector);
        vm.prank(relayer);
        settlement.settle(address(usdc), address(0), auth);
    }

    function test_Settle_RevertsForZeroValue() public {
        PeajeSettlement.Authorization memory auth = _authorize(usdc, 0, keccak256("pay-1"));

        vm.expectRevert(PeajeSettlement.ZeroAmount.selector);
        vm.prank(relayer);
        settlement.settle(address(usdc), merchant, auth);
    }

    function test_Settle_RevertsOnReplayedAuthorization() public {
        PeajeSettlement.Authorization memory auth = _authorize(usdc, 20_000, keccak256("pay-1"));
        vm.startPrank(relayer);
        settlement.settle(address(usdc), merchant, auth);

        vm.expectRevert(MockEIP3009.AuthorizationUsed.selector);
        settlement.settle(address(usdc), merchant, auth);
        vm.stopPrank();
    }

    function test_Settle_RevertsOnExpiredAuthorization() public {
        PeajeSettlement.Authorization memory auth = _authorize(usdc, 20_000, keccak256("pay-1"));
        vm.warp(auth.validBefore);

        vm.expectRevert(MockEIP3009.AuthorizationExpired.selector);
        vm.prank(relayer);
        settlement.settle(address(usdc), merchant, auth);
    }

    function test_Settle_RevertsWhenSignatureIsForAnotherAmount() public {
        PeajeSettlement.Authorization memory auth = _authorize(usdc, 20_000, keccak256("pay-1"));
        auth.value = 30_000;

        vm.expectRevert(MockEIP3009.InvalidSignature.selector);
        vm.prank(relayer);
        settlement.settle(address(usdc), merchant, auth);
    }

    function test_Settle_RevertsWhenTokenDeliversLessThanSigned() public {
        MockFeeOnTransferEIP3009 lossy = new MockFeeOnTransferEIP3009();
        lossy.mint(agent, 1e6);
        vm.prank(owner);
        settlement.setAcceptedToken(address(lossy), true);
        PeajeSettlement.Authorization memory auth = _authorize(lossy, 1e6, keccak256("pay-1"));

        vm.expectRevert(abi.encodeWithSelector(PeajeSettlement.UnexpectedAmountReceived.selector, 1e6, 990_000));
        vm.prank(relayer);
        settlement.settle(address(lossy), merchant, auth);
    }

    function test_Settle_RevertsWhenPaused() public {
        vm.prank(owner);
        settlement.pause();
        PeajeSettlement.Authorization memory auth = _authorize(usdc, 20_000, keccak256("pay-1"));

        vm.expectRevert(Pausable.EnforcedPause.selector);
        vm.prank(relayer);
        settlement.settle(address(usdc), merchant, auth);
    }

    function test_Settle_RevertsAfterRelayerIsRevoked() public {
        vm.prank(owner);
        settlement.setRelayer(relayer, false);
        PeajeSettlement.Authorization memory auth = _authorize(usdc, 20_000, keccak256("pay-1"));

        vm.expectRevert(abi.encodeWithSelector(PeajeSettlement.NotRelayer.selector, relayer));
        vm.prank(relayer);
        settlement.settle(address(usdc), merchant, auth);
    }

    // ---- withdraw ----

    function test_Withdraw_TransfersAndDebits() public {
        _settle(20_000, keccak256("pay-1"));
        address payout = makeAddr("payout");

        vm.expectEmit(address(settlement));
        emit PeajeSettlement.Withdrawn(address(usdc), merchant, payout, 19_600);

        vm.prank(merchant);
        settlement.withdraw(address(usdc), 19_600, payout);

        assertEq(usdc.balanceOf(payout), 19_600);
        assertEq(settlement.claimable(address(usdc), merchant), 0);
        assertEq(settlement.totalOwed(address(usdc)), 400);
    }

    function test_Withdraw_WorksWhilePaused() public {
        _settle(20_000, keccak256("pay-1"));
        vm.prank(owner);
        settlement.pause();

        vm.prank(merchant);
        settlement.withdraw(address(usdc), 19_600, merchant);

        assertEq(usdc.balanceOf(merchant), 19_600);
    }

    function test_Withdraw_WorksAfterTokenIsDelisted() public {
        _settle(20_000, keccak256("pay-1"));
        vm.prank(owner);
        settlement.setAcceptedToken(address(usdc), false);

        vm.prank(merchant);
        settlement.withdraw(address(usdc), 19_600, merchant);

        assertEq(usdc.balanceOf(merchant), 19_600);
    }

    function test_Withdraw_RevertsAboveBalance() public {
        _settle(20_000, keccak256("pay-1"));

        vm.expectRevert(abi.encodeWithSelector(PeajeSettlement.InsufficientBalance.selector, 19_600, 19_601));
        vm.prank(merchant);
        settlement.withdraw(address(usdc), 19_601, merchant);
    }

    function test_Withdraw_RevertsForZeroRecipientOrAmount() public {
        _settle(20_000, keccak256("pay-1"));
        vm.startPrank(merchant);

        vm.expectRevert(PeajeSettlement.ZeroAddress.selector);
        settlement.withdraw(address(usdc), 1, address(0));

        vm.expectRevert(PeajeSettlement.ZeroAmount.selector);
        settlement.withdraw(address(usdc), 0, merchant);
        vm.stopPrank();
    }

    function test_Withdraw_FeeRecipientCollectsFees() public {
        _settle(20_000, keccak256("pay-1"));

        vm.prank(treasury);
        settlement.withdraw(address(usdc), 400, treasury);

        assertEq(usdc.balanceOf(treasury), 400);
    }

    // ---- withdrawWithSignature ----

    function test_WithdrawWithSignature_RelayedByThirdParty() public {
        _settle(20_000, keccak256("pay-1"));
        address payout = makeAddr("payout");
        uint256 deadline = block.timestamp + 600;
        bytes memory sig = _signWithdraw(merchantKey, merchant, 19_600, payout, deadline);

        vm.prank(stranger);
        settlement.withdrawWithSignature(address(usdc), merchant, 19_600, payout, deadline, sig);

        assertEq(usdc.balanceOf(payout), 19_600);
        assertEq(settlement.claimable(address(usdc), merchant), 0);
        assertEq(settlement.nonces(merchant), 1);
    }

    function test_WithdrawWithSignature_RevertsOnReplay() public {
        _settle(40_000, keccak256("pay-1"));
        uint256 deadline = block.timestamp + 600;
        bytes memory sig = _signWithdraw(merchantKey, merchant, 10_000, merchant, deadline);
        settlement.withdrawWithSignature(address(usdc), merchant, 10_000, merchant, deadline, sig);

        vm.expectRevert(PeajeSettlement.InvalidSignature.selector);
        settlement.withdrawWithSignature(address(usdc), merchant, 10_000, merchant, deadline, sig);
    }

    function test_WithdrawWithSignature_RevertsWhenExpired() public {
        _settle(20_000, keccak256("pay-1"));
        uint256 deadline = block.timestamp + 600;
        bytes memory sig = _signWithdraw(merchantKey, merchant, 19_600, merchant, deadline);
        vm.warp(deadline + 1);

        vm.expectRevert(abi.encodeWithSelector(PeajeSettlement.SignatureExpired.selector, deadline));
        settlement.withdrawWithSignature(address(usdc), merchant, 19_600, merchant, deadline, sig);
    }

    function test_WithdrawWithSignature_RevertsForWrongSigner() public {
        _settle(20_000, keccak256("pay-1"));
        uint256 deadline = block.timestamp + 600;
        bytes memory sig = _signWithdraw(agentKey, merchant, 19_600, stranger, deadline);

        vm.expectRevert(PeajeSettlement.InvalidSignature.selector);
        settlement.withdrawWithSignature(address(usdc), merchant, 19_600, stranger, deadline, sig);
    }

    function test_WithdrawWithSignature_RevertsWhenRecipientIsAltered() public {
        _settle(20_000, keccak256("pay-1"));
        uint256 deadline = block.timestamp + 600;
        bytes memory sig = _signWithdraw(merchantKey, merchant, 19_600, merchant, deadline);

        vm.expectRevert(PeajeSettlement.InvalidSignature.selector);
        vm.prank(stranger);
        settlement.withdrawWithSignature(address(usdc), merchant, 19_600, stranger, deadline, sig);
    }

    function test_WithdrawWithSignature_WorksWhilePaused() public {
        _settle(20_000, keccak256("pay-1"));
        vm.prank(owner);
        settlement.pause();
        uint256 deadline = block.timestamp + 600;
        bytes memory sig = _signWithdraw(merchantKey, merchant, 19_600, merchant, deadline);

        settlement.withdrawWithSignature(address(usdc), merchant, 19_600, merchant, deadline, sig);

        assertEq(usdc.balanceOf(merchant), 19_600);
    }

    // ---- surplus ----

    function test_RecoverSurplus_ReturnsOnlyUnowedFunds() public {
        _settle(20_000, keccak256("pay-1"));
        PeajeSettlement.Authorization memory direct = _authorize(usdc, 5_000, keccak256("pay-2"));
        usdc.transferWithAuthorization(
            direct.from,
            address(settlement),
            direct.value,
            direct.validAfter,
            direct.validBefore,
            direct.nonce,
            direct.v,
            direct.r,
            direct.s
        );

        vm.prank(relayer);
        vm.expectRevert(MockEIP3009.AuthorizationUsed.selector);
        settlement.settle(address(usdc), merchant, direct);

        vm.prank(owner);
        settlement.recoverSurplus(address(usdc), owner);

        assertEq(usdc.balanceOf(owner), 5_000);
        assertEq(usdc.balanceOf(address(settlement)), settlement.totalOwed(address(usdc)));
    }

    function test_RecoverSurplus_RevertsWithoutSurplus() public {
        _settle(20_000, keccak256("pay-1"));

        vm.expectRevert(PeajeSettlement.NoSurplus.selector);
        vm.prank(owner);
        settlement.recoverSurplus(address(usdc), owner);
    }

    function test_RecoverSurplus_OnlyOwner() public {
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger));
        vm.prank(stranger);
        settlement.recoverSurplus(address(usdc), stranger);
    }

    // ---- admin ----

    function test_SetFee_RevertsAboveCap() public {
        vm.expectRevert(abi.encodeWithSelector(PeajeSettlement.FeeTooHigh.selector, 1_001));
        vm.prank(owner);
        settlement.setFee(1_001, treasury);
    }

    function test_Constructor_RevertsAboveCap() public {
        vm.expectRevert(abi.encodeWithSelector(PeajeSettlement.FeeTooHigh.selector, 1_001));
        new PeajeSettlement(owner, treasury, 1_001);
    }

    function test_AdminFunctions_OnlyOwner() public {
        vm.startPrank(stranger);
        bytes memory unauthorized = abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger);

        vm.expectRevert(unauthorized);
        settlement.setFee(100, stranger);
        vm.expectRevert(unauthorized);
        settlement.setRelayer(stranger, true);
        vm.expectRevert(unauthorized);
        settlement.setAcceptedToken(address(usdc), false);
        vm.expectRevert(unauthorized);
        settlement.pause();
        vm.stopPrank();
    }

    function test_Unpause_ResumesSettlement() public {
        vm.startPrank(owner);
        settlement.pause();
        settlement.unpause();
        vm.stopPrank();

        _settle(20_000, keccak256("pay-1"));

        assertEq(settlement.claimable(address(usdc), merchant), 19_600);
    }

    function test_AdminFunctions_RejectZeroAddress() public {
        vm.startPrank(owner);

        vm.expectRevert(PeajeSettlement.ZeroAddress.selector);
        settlement.setFee(100, address(0));
        vm.expectRevert(PeajeSettlement.ZeroAddress.selector);
        settlement.setRelayer(address(0), true);
        vm.expectRevert(PeajeSettlement.ZeroAddress.selector);
        settlement.setAcceptedToken(address(0), true);
        vm.expectRevert(PeajeSettlement.ZeroAddress.selector);
        settlement.recoverSurplus(address(usdc), address(0));
        vm.stopPrank();
    }

    function test_SetFee_NewRecipientCollectsOnlyNewFees() public {
        _settle(20_000, keccak256("pay-1"));
        address nextTreasury = makeAddr("nextTreasury");
        vm.prank(owner);
        settlement.setFee(FEE_BPS, nextTreasury);

        _settle(20_000, keccak256("pay-2"));

        assertEq(settlement.claimable(address(usdc), treasury), 400);
        assertEq(settlement.claimable(address(usdc), nextTreasury), 400);
    }

    function test_RenounceOwnership_IsDisabled() public {
        vm.expectRevert(PeajeSettlement.RenounceDisabled.selector);
        vm.prank(owner);
        settlement.renounceOwnership();
    }

    function test_Ownership_TransferRequiresAcceptance() public {
        address next = makeAddr("next");
        vm.prank(owner);
        settlement.transferOwnership(next);
        assertEq(settlement.owner(), owner);

        vm.prank(next);
        settlement.acceptOwnership();
        assertEq(settlement.owner(), next);
    }

    // ---- fuzz ----

    function testFuzz_Settle_FeeAndNetAddUp(uint256 value, uint16 feeBps) public {
        value = bound(value, 1, 1_000e6);
        feeBps = uint16(bound(feeBps, 0, settlement.MAX_FEE_BPS()));
        vm.prank(owner);
        settlement.setFee(feeBps, treasury);

        uint256 net = _settle(value, keccak256(abi.encode(value, feeBps)));
        uint256 fee = settlement.claimable(address(usdc), treasury);

        assertEq(net + fee, value);
        assertLe(fee * 10_000, value * feeBps);
        assertEq(settlement.totalOwed(address(usdc)), value);
    }
}
