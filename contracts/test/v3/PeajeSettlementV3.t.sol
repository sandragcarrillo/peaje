// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {PeajeSettlementV3} from "../../src/PeajeSettlementV3.sol";
import {
    MockStablecoin,
    MockFeeOnTransferStablecoin as MockFeeOnTransfer,
    MockStickyStablecoin as MockSticky,
    MockReentrantStablecoin as MockReentrant
} from "../mocks/MockStablecoinV3.sol";
import {BaseV3} from "./BaseV3.t.sol";

contract PeajeSettlementV3Test is BaseV3 {
    bytes32 internal constant STRAY_NONCE = "stray";
    bytes32 internal constant X_NONCE = "x";
    bytes32 internal constant PAY1_NONCE = "pay-1";

    // ---- settle: split ----

    function test_Settle_SplitsStraightToWallets() public {
        uint256 net = _settle(usdc, merchant, 20_000, 0, "pay-1");

        assertEq(net, 19_600);
        assertEq(usdc.balanceOf(merchant), 19_600);
        assertEq(usdc.balanceOf(treasury), 400);
        assertEq(usdc.balanceOf(address(settlement)), 0);
        assertEq(usdc.balanceOf(agent), 1_000e6 - 20_000);
    }

    function test_Settle_EmitsPaymentSettledWithEveryField() public {
        PeajeSettlementV3.Authorization memory auth = _authorize(usdc, 28_000, "pay-1");

        vm.expectEmit(address(settlement));
        emit PeajeSettlementV3.PaymentSettled("pay-1", address(usdc), merchant, agent, 28_000, 19_600, 400, 8_000);
        vm.prank(relayer);
        settlement.settle(address(usdc), merchant, auth, 8_000);
    }

    function test_Settle_NetworkFeeGoesToFeeRecipient() public {
        // Price 0.02 plus 0.008 of gas: merchant nets 0.0196, Peaje 0.0004 + 0.008.
        uint256 net = _settle(usdc, merchant, 28_000, 8_000, "pay-1");

        assertEq(net, 19_600);
        assertEq(usdc.balanceOf(merchant), 19_600);
        assertEq(usdc.balanceOf(treasury), 8_400);
        assertEq(usdc.balanceOf(address(settlement)), 0);
    }

    function test_Settle_FeeIsExactlyTwoPercent() public {
        _settle(usdc, merchant, 1e6, 0, "a");
        assertEq(usdc.balanceOf(treasury), 20_000);
        assertEq(usdc.balanceOf(merchant), 980_000);

        _settle(usdc, otherMerchant, 123_456_789, 0, "b");
        assertEq(usdc.balanceOf(otherMerchant), 123_456_789 - 2_469_135); // floor(123456789 * 0.02)
    }

    /// Fee rounds down: below 50 units (0.00005 USDC) the fee is 0 and the merchant gets it all.
    function test_Settle_FeeRoundsDownInFavourOfMerchant() public {
        _settle(usdc, merchant, 49, 0, "a");
        assertEq(usdc.balanceOf(merchant), 49);
        assertEq(usdc.balanceOf(treasury), 0);

        _settle(usdc, merchant, 50, 0, "b");
        assertEq(usdc.balanceOf(merchant), 49 + 49);
        assertEq(usdc.balanceOf(treasury), 1);

        _settle(usdc, merchant, 99, 0, "c");
        assertEq(usdc.balanceOf(merchant), 98 + 98);
        assertEq(usdc.balanceOf(treasury), 2);
    }

    function test_Settle_SmallestPayment() public {
        assertEq(_settle(usdc, merchant, 1, 0, "a"), 1);
        assertEq(usdc.balanceOf(merchant), 1);
        assertEq(usdc.balanceOf(address(settlement)), 0);
    }

    function test_Settle_NetworkFeeAtCap() public {
        _settle(usdc, merchant, 1e6 + MAX_NETWORK_FEE, MAX_NETWORK_FEE, "pay-1");
        assertEq(usdc.balanceOf(merchant), 980_000);
        assertEq(usdc.balanceOf(treasury), 20_000 + MAX_NETWORK_FEE);
    }

    function test_Settle_PayerCanAlsoBeTheMerchant() public {
        _settle(usdc, agent, 1e6, 0, "self");
        assertEq(usdc.balanceOf(agent), 1_000e6 - 20_000);
    }

    function test_Settle_LeavesExistingStrayUntouched() public {
        _frontRun(usdc, _authorize(usdc, 5_000, "stray"));
        _settle(usdc, merchant, 20_000, 0, "pay-1");

        assertEq(usdc.balanceOf(address(settlement)), 5_000);
        assertEq(usdc.balanceOf(merchant), 19_600);
    }

    function test_Quote_MatchesSettle() public {
        (uint256 net, uint256 fee) = settlement.quote(28_000, 8_000);
        assertEq(net, 19_600);
        assertEq(fee, 400);
        assertEq(_settle(usdc, merchant, 28_000, 8_000, "pay-1"), net);
    }

    function test_Quote_RevertsWhenValueOnlyCoversNetworkFee() public {
        vm.expectRevert(PeajeSettlementV3.ZeroAmount.selector);
        settlement.quote(5_000, 5_000);
    }

    // ---- settle: validation ----

    function test_Settle_RevertsForNonRelayer() public {
        PeajeSettlementV3.Authorization memory auth = _authorize(usdc, 20_000, "pay-1");
        vm.expectRevert(abi.encodeWithSelector(PeajeSettlementV3.NotRelayer.selector, stranger));
        vm.prank(stranger);
        settlement.settle(address(usdc), stranger, auth, 0);
    }

    function test_Settle_RevertsForOwnerWhoIsNotRelayer() public {
        PeajeSettlementV3.Authorization memory auth = _authorize(usdc, 20_000, "pay-1");
        vm.expectRevert(abi.encodeWithSelector(PeajeSettlementV3.NotRelayer.selector, owner));
        vm.prank(owner);
        settlement.settle(address(usdc), merchant, auth, 0);
    }

    function test_Settle_RevertsForUnacceptedToken() public {
        MockStablecoin other = new MockStablecoin("USD Coin", "2", 6);
        other.mint(agent, 1e6);
        PeajeSettlementV3.Authorization memory auth = _authorize(other, 1e6, "pay-1");

        vm.expectRevert(abi.encodeWithSelector(PeajeSettlementV3.TokenNotAccepted.selector, address(other)));
        vm.prank(relayer);
        settlement.settle(address(other), merchant, auth, 0);
    }

    function test_Settle_RevertsAfterTokenIsDelisted() public {
        vm.prank(owner);
        settlement.setAcceptedToken(address(usdc), false, 0);
        PeajeSettlementV3.Authorization memory auth = _authorize(usdc, 1e6, "pay-1");

        vm.expectRevert(abi.encodeWithSelector(PeajeSettlementV3.TokenNotAccepted.selector, address(usdc)));
        vm.prank(relayer);
        settlement.settle(address(usdc), merchant, auth, 0);
    }

    function test_Settle_RevertsForZeroMerchant() public {
        PeajeSettlementV3.Authorization memory auth = _authorize(usdc, 20_000, "pay-1");
        vm.expectRevert(abi.encodeWithSelector(PeajeSettlementV3.InvalidMerchant.selector, address(0)));
        vm.prank(relayer);
        settlement.settle(address(usdc), address(0), auth, 0);
    }

    function test_Settle_RevertsWhenMerchantIsFeeRecipient() public {
        PeajeSettlementV3.Authorization memory auth = _authorize(usdc, 20_000, "pay-1");
        vm.expectRevert(abi.encodeWithSelector(PeajeSettlementV3.InvalidMerchant.selector, treasury));
        vm.prank(relayer);
        settlement.settle(address(usdc), treasury, auth, 0);
    }

    function test_Settle_RevertsWhenMerchantIsTheContract() public {
        PeajeSettlementV3.Authorization memory auth = _authorize(usdc, 20_000, "pay-1");
        vm.expectRevert(abi.encodeWithSelector(PeajeSettlementV3.InvalidMerchant.selector, address(settlement)));
        vm.prank(relayer);
        settlement.settle(address(usdc), address(settlement), auth, 0);
    }

    function test_Settle_RevertsForZeroValue() public {
        PeajeSettlementV3.Authorization memory auth = _authorize(usdc, 0, "pay-1");
        vm.expectRevert(PeajeSettlementV3.ZeroAmount.selector);
        vm.prank(relayer);
        settlement.settle(address(usdc), merchant, auth, 0);
    }

    function test_Settle_RevertsWhenValueOnlyCoversNetworkFee() public {
        PeajeSettlementV3.Authorization memory auth = _authorize(usdc, 5_000, "pay-1");
        vm.expectRevert(PeajeSettlementV3.ZeroAmount.selector);
        vm.prank(relayer);
        settlement.settle(address(usdc), merchant, auth, 5_000);
    }

    function test_Settle_RevertsWhenNetworkFeeAboveCap() public {
        PeajeSettlementV3.Authorization memory auth = _authorize(usdc, 1e6, "pay-1");
        vm.expectRevert(
            abi.encodeWithSelector(PeajeSettlementV3.NetworkFeeTooHigh.selector, MAX_NETWORK_FEE + 1, MAX_NETWORK_FEE)
        );
        vm.prank(relayer);
        settlement.settle(address(usdc), merchant, auth, MAX_NETWORK_FEE + 1);
    }

    function test_Settle_RevertsOnReplayedAuthorization() public {
        PeajeSettlementV3.Authorization memory auth = _authorize(usdc, 20_000, "pay-1");
        vm.startPrank(relayer);
        settlement.settle(address(usdc), merchant, auth, 0);

        vm.expectRevert(MockStablecoin.AuthorizationAlreadyUsed.selector);
        settlement.settle(address(usdc), otherMerchant, auth, 0);
        vm.stopPrank();
        assertEq(usdc.balanceOf(otherMerchant), 0);
    }

    function test_Settle_RevertsOnExpiredAuthorization() public {
        PeajeSettlementV3.Authorization memory auth = _authorize(usdc, 20_000, "pay-1");
        vm.warp(auth.validBefore);
        vm.expectRevert(MockStablecoin.AuthorizationExpired.selector);
        vm.prank(relayer);
        settlement.settle(address(usdc), merchant, auth, 0);
    }

    function test_Settle_RevertsBeforeValidAfter() public {
        PeajeSettlementV3.Authorization memory auth = _authorize(usdc, 20_000, "pay-1");
        auth.validAfter = block.timestamp + 10; // signature no longer matches either; token checks time first
        vm.expectRevert(MockStablecoin.AuthorizationNotYetValid.selector);
        vm.prank(relayer);
        settlement.settle(address(usdc), merchant, auth, 0);
    }

    function test_Settle_RevertsWhenSignatureIsForAnotherAmount() public {
        PeajeSettlementV3.Authorization memory auth = _authorize(usdc, 20_000, "pay-1");
        auth.value = 30_000;
        vm.expectRevert(MockStablecoin.InvalidSignature.selector);
        vm.prank(relayer);
        settlement.settle(address(usdc), merchant, auth, 0);
    }

    /// An authorization signed to pay someone else directly cannot be pulled through the contract.
    function test_Settle_RevertsWhenSignedForAnotherRecipient() public {
        PeajeSettlementV3.Authorization memory auth = _authorizeTo(usdc, AGENT_KEY, merchant, 20_000, "pay-1");
        vm.expectRevert(MockStablecoin.InvalidSignature.selector);
        vm.prank(relayer);
        settlement.settle(address(usdc), merchant, auth, 0);
    }

    function test_Settle_RevertsWhenPaused() public {
        vm.prank(owner);
        settlement.pause();
        PeajeSettlementV3.Authorization memory auth = _authorize(usdc, 20_000, "pay-1");

        vm.expectRevert(Pausable.EnforcedPause.selector);
        vm.prank(relayer);
        settlement.settle(address(usdc), merchant, auth, 0);
        assertFalse(usdc.authorizationState(agent, "pay-1"));
    }

    function test_Unpause_ResumesSettlement() public {
        vm.startPrank(owner);
        settlement.pause();
        settlement.unpause();
        vm.stopPrank();

        _settle(usdc, merchant, 20_000, 0, "pay-1");
        assertEq(usdc.balanceOf(merchant), 19_600);
    }

    function test_Settle_RevertsAfterRelayerIsRevoked() public {
        vm.prank(owner);
        settlement.setRelayer(relayer, false);
        PeajeSettlementV3.Authorization memory auth = _authorize(usdc, 20_000, "pay-1");

        vm.expectRevert(abi.encodeWithSelector(PeajeSettlementV3.NotRelayer.selector, relayer));
        vm.prank(relayer);
        settlement.settle(address(usdc), merchant, auth, 0);
    }

    function test_Settle_RotatedRelayerCanSettle() public {
        address next = makeAddr("nextRelayer");
        vm.startPrank(owner);
        settlement.setRelayer(next, true);
        settlement.setRelayer(relayer, false);
        vm.stopPrank();

        PeajeSettlementV3.Authorization memory auth = _authorize(usdc, 20_000, "pay-1");
        vm.prank(next);
        settlement.settle(address(usdc), merchant, auth, 0);
        assertEq(usdc.balanceOf(merchant), 19_600);
    }

    function test_Settle_RevertsWhenTokenDeliversLessThanSigned() public {
        MockFeeOnTransfer lossy = new MockFeeOnTransfer();
        lossy.mint(agent, 1e6);
        vm.prank(owner);
        settlement.setAcceptedToken(address(lossy), true, 0);
        PeajeSettlementV3.Authorization memory auth = _authorize(lossy, 1e6, "pay-1");

        vm.expectRevert(abi.encodeWithSelector(PeajeSettlementV3.UnexpectedAmountReceived.selector, 1e6, 990_000));
        vm.prank(relayer);
        settlement.settle(address(lossy), merchant, auth, 0);
    }

    function test_Settle_RevertsWhenTokenLeavesBalanceBehind() public {
        MockSticky sticky = new MockSticky();
        sticky.setSticky(address(settlement));
        sticky.mint(agent, 1e6);
        vm.prank(owner);
        settlement.setAcceptedToken(address(sticky), true, 0);
        PeajeSettlementV3.Authorization memory auth = _authorize(sticky, 1e6, "pay-1");

        vm.expectRevert(abi.encodeWithSelector(PeajeSettlementV3.BalanceNotRestored.selector, 0, 2));
        vm.prank(relayer);
        settlement.settle(address(sticky), merchant, auth, 0);
    }

    // ---- token behaviour: decimals, blacklists, pause, USDG domain ----

    function test_Settle_EighteenDecimalToken() public {
        MockStablecoin wide = new MockStablecoin("Wide Dollar", "1", 18);
        wide.mint(agent, 1_000e18);
        vm.prank(owner);
        settlement.setAcceptedToken(address(wide), true, 0.05e18);

        uint256 net = _settle(wide, merchant, 1e18 + 0.008e18, 0.008e18, "pay-1");
        assertEq(net, 0.98e18);
        assertEq(wide.balanceOf(treasury), 0.02e18 + 0.008e18);
        assertEq(wide.balanceOf(address(settlement)), 0);
    }

    function test_Settle_UsdgDomain() public {
        MockStablecoin usdg = new MockStablecoin("Global Dollar", "1", 6);
        usdg.mint(agent, 1e6);
        vm.prank(owner);
        settlement.setAcceptedToken(address(usdg), true, MAX_NETWORK_FEE);

        _settle(usdg, merchant, 1e6, 0, "pay-1");
        assertEq(usdg.balanceOf(merchant), 980_000);
        assertEq(usdg.balanceOf(treasury), 20_000);
    }

    /// A blacklisted (USDC) or frozen (USDG) merchant makes the whole settle revert: the payer
    /// keeps the funds and the authorization stays unused.
    function test_Settle_BlacklistedMerchantRevertsWholePayment() public {
        usdc.setBlacklisted(merchant, true);
        PeajeSettlementV3.Authorization memory auth = _authorize(usdc, 1e6, "pay-1");

        vm.expectRevert(abi.encodeWithSelector(MockStablecoin.Blacklisted.selector, merchant));
        vm.prank(relayer);
        settlement.settle(address(usdc), merchant, auth, 0);

        assertFalse(usdc.authorizationState(agent, "pay-1"));
        assertEq(usdc.balanceOf(agent), 1_000e6);
        assertEq(usdc.balanceOf(address(settlement)), 0);
    }

    function test_Settle_BlacklistedFeeRecipientBlocksUntilRotated() public {
        usdc.setBlacklisted(treasury, true);
        PeajeSettlementV3.Authorization memory auth = _authorize(usdc, 1e6, "pay-1");

        vm.expectRevert(abi.encodeWithSelector(MockStablecoin.Blacklisted.selector, treasury));
        vm.prank(relayer);
        settlement.settle(address(usdc), merchant, auth, 0);

        address cold = makeAddr("newColdWallet");
        vm.prank(owner);
        settlement.setFeeRecipient(cold);
        vm.prank(relayer);
        settlement.settle(address(usdc), merchant, auth, 0);
        assertEq(usdc.balanceOf(cold), 20_000);
    }

    function test_Settle_BlacklistedPayerReverts() public {
        usdc.setBlacklisted(agent, true);
        PeajeSettlementV3.Authorization memory auth = _authorize(usdc, 1e6, "pay-1");
        vm.expectRevert(abi.encodeWithSelector(MockStablecoin.Blacklisted.selector, agent));
        vm.prank(relayer);
        settlement.settle(address(usdc), merchant, auth, 0);
    }

    function test_Settle_TokenPausedReverts() public {
        usdc.setPaused(true);
        PeajeSettlementV3.Authorization memory auth = _authorize(usdc, 1e6, "pay-1");
        vm.expectRevert(MockStablecoin.TokenPaused.selector);
        vm.prank(relayer);
        settlement.settle(address(usdc), merchant, auth, 0);
    }

    // ---- reentrancy ----

    function test_Reentrancy_DuringPullIsBlocked() public {
        MockReentrant evil = _evilToken();
        PeajeSettlementV3.Authorization memory first = _authorize(evil, 1e6, "first");
        PeajeSettlementV3.Authorization memory second = _authorize(evil, 1e6, "second");
        evil.arm(
            address(settlement),
            abi.encodeCall(PeajeSettlementV3.settle, (address(evil), stranger, second, 0)),
            agent,
            true,
            false
        );

        vm.prank(relayer);
        settlement.settle(address(evil), merchant, first, 0);

        _assertReentryBlocked(evil);
        assertEq(evil.balanceOf(stranger), 0);
        assertEq(evil.balanceOf(merchant), 980_000);
        assertEq(evil.balanceOf(address(settlement)), 0);
    }

    function test_Reentrancy_DuringPayoutIsBlocked() public {
        MockReentrant evil = _evilToken();
        PeajeSettlementV3.Authorization memory first = _authorize(evil, 1e6, "first");
        PeajeSettlementV3.Authorization memory second = _authorize(evil, 1e6, "second");
        evil.arm(
            address(settlement),
            abi.encodeCall(PeajeSettlementV3.settle, (address(evil), stranger, second, 0)),
            agent,
            false,
            true
        );

        vm.prank(relayer);
        settlement.settle(address(evil), merchant, first, 0);

        _assertReentryBlocked(evil);
        assertEq(evil.balanceOf(stranger), 0);
        assertEq(evil.balanceOf(address(settlement)), 0);
    }

    function test_Reentrancy_IntoSettleStrayIsBlocked() public {
        MockReentrant evil = _evilToken();
        vm.prank(owner);
        settlement.transferOwnership(address(evil));
        vm.prank(address(evil));
        settlement.acceptOwnership();

        PeajeSettlementV3.Authorization memory stray = _authorize(evil, 1e6, "stray");
        _frontRun(evil, stray);
        PeajeSettlementV3.Authorization memory first = _authorize(evil, 1e6, "first");
        evil.arm(
            address(settlement),
            abi.encodeCall(PeajeSettlementV3.settleStray, (address(evil), stranger, agent, 1e6, STRAY_NONCE, 0)),
            agent,
            true,
            false
        );

        vm.prank(relayer);
        settlement.settle(address(evil), merchant, first, 0);

        _assertReentryBlocked(evil);
        assertEq(evil.balanceOf(stranger), 0);
        assertEq(evil.balanceOf(address(settlement)), 1e6);
    }

    function _evilToken() internal returns (MockReentrant evil) {
        evil = new MockReentrant();
        evil.mint(agent, 10e6);
        vm.startPrank(owner);
        settlement.setAcceptedToken(address(evil), true, 0);
        // Worst case: the malicious token is itself an allowed relayer, so only the guard stops it.
        settlement.setRelayer(address(evil), true);
        vm.stopPrank();
    }

    function _assertReentryBlocked(MockReentrant evil) internal view {
        assertTrue(evil.reentered());
        assertFalse(evil.reentrySucceeded());
        assertEq(bytes4(evil.reentryReturn()), bytes4(keccak256("ReentrancyGuardReentrantCall()")));
    }

    // ---- settleStray (front-run authorization) ----

    function test_SettleStray_RoutesFrontRunPaymentWithSameSplit() public {
        PeajeSettlementV3.Authorization memory auth = _authorize(usdc, 28_000, "pay-1");
        _frontRun(usdc, auth);
        assertEq(usdc.balanceOf(address(settlement)), 28_000);

        // The relayer's settle now fails: the authorization is spent.
        vm.expectRevert(MockStablecoin.AuthorizationAlreadyUsed.selector);
        vm.prank(relayer);
        settlement.settle(address(usdc), merchant, auth, 8_000);

        vm.expectEmit(address(settlement));
        emit PeajeSettlementV3.PaymentSettled("pay-1", address(usdc), merchant, agent, 28_000, 19_600, 400, 8_000);
        vm.expectEmit(address(settlement));
        emit PeajeSettlementV3.StraySettled("pay-1", address(usdc), agent);
        vm.prank(owner);
        uint256 net = settlement.settleStray(address(usdc), merchant, agent, 28_000, "pay-1", 8_000);

        assertEq(net, 19_600);
        assertEq(usdc.balanceOf(merchant), 19_600);
        assertEq(usdc.balanceOf(treasury), 8_400);
        assertEq(usdc.balanceOf(address(settlement)), 0);
        assertTrue(settlement.straySettled(address(usdc), agent, "pay-1"));
    }

    function test_SettleStray_RevertsWhenAuthorizationUnused() public {
        usdc.mint(address(settlement), 1e6); // a plain donation, no authorization behind it
        vm.expectRevert(abi.encodeWithSelector(PeajeSettlementV3.AuthorizationNotUsed.selector, agent, X_NONCE));
        vm.prank(owner);
        settlement.settleStray(address(usdc), merchant, agent, 1e6, "x", 0);
        assertEq(usdc.balanceOf(address(settlement)), 1e6);
    }

    function test_SettleStray_RevertsOnReplay() public {
        _frontRun(usdc, _authorize(usdc, 1e6, "pay-1"));
        usdc.mint(address(settlement), 1e6); // extra surplus that a replay would try to take
        vm.startPrank(owner);
        settlement.settleStray(address(usdc), merchant, agent, 1e6, "pay-1", 0);

        vm.expectRevert(abi.encodeWithSelector(PeajeSettlementV3.StrayAlreadySettled.selector, agent, PAY1_NONCE));
        settlement.settleStray(address(usdc), otherMerchant, agent, 1e6, "pay-1", 0);
        vm.stopPrank();
    }

    function test_SettleStray_RevertsWhenSurplusDoesNotCoverValue() public {
        _frontRun(usdc, _authorize(usdc, 1e6, "pay-1"));
        vm.expectRevert(abi.encodeWithSelector(PeajeSettlementV3.InsufficientStray.selector, 1e6, 2e6));
        vm.prank(owner);
        settlement.settleStray(address(usdc), merchant, agent, 2e6, "pay-1", 0);
    }

    function test_SettleStray_OnlyOwner() public {
        _frontRun(usdc, _authorize(usdc, 1e6, "pay-1"));
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, relayer));
        vm.prank(relayer);
        settlement.settleStray(address(usdc), relayer, agent, 1e6, "pay-1", 0);
    }

    function test_SettleStray_RejectsFeeRecipientAndZeroMerchant() public {
        _frontRun(usdc, _authorize(usdc, 1e6, "pay-1"));
        vm.startPrank(owner);
        vm.expectRevert(abi.encodeWithSelector(PeajeSettlementV3.InvalidMerchant.selector, treasury));
        settlement.settleStray(address(usdc), treasury, agent, 1e6, "pay-1", 0);
        vm.expectRevert(abi.encodeWithSelector(PeajeSettlementV3.InvalidMerchant.selector, address(0)));
        settlement.settleStray(address(usdc), address(0), agent, 1e6, "pay-1", 0);
        vm.expectRevert(PeajeSettlementV3.ZeroAmount.selector);
        settlement.settleStray(address(usdc), merchant, agent, 0, "pay-1", 0);
        vm.stopPrank();
    }

    function test_SettleStray_NetworkFeeCapApplies() public {
        _frontRun(usdc, _authorize(usdc, 1e6, "pay-1"));
        vm.expectRevert(
            abi.encodeWithSelector(PeajeSettlementV3.NetworkFeeTooHigh.selector, MAX_NETWORK_FEE + 1, MAX_NETWORK_FEE)
        );
        vm.prank(owner);
        settlement.settleStray(address(usdc), merchant, agent, 1e6, "pay-1", MAX_NETWORK_FEE + 1);
    }

    function test_SettleStray_WorksWhilePaused() public {
        _frontRun(usdc, _authorize(usdc, 1e6, "pay-1"));
        vm.startPrank(owner);
        settlement.pause();
        settlement.settleStray(address(usdc), merchant, agent, 1e6, "pay-1", 0);
        vm.stopPrank();
        assertEq(usdc.balanceOf(merchant), 980_000);
    }

    function test_SettleStray_WorksForDelistedToken() public {
        _frontRun(usdc, _authorize(usdc, 1e6, "pay-1"));
        vm.startPrank(owner);
        settlement.setAcceptedToken(address(usdc), false, 0);
        settlement.settleStray(address(usdc), merchant, agent, 1e6, "pay-1", 0);
        vm.stopPrank();
        assertEq(usdc.balanceOf(merchant), 980_000);
        assertEq(usdc.balanceOf(address(settlement)), 0);
    }

    /// The owner can route a stray only to a merchant, split, never to the fee recipient alone.
    function test_SettleStray_NeverSweepsEverythingToPeaje() public {
        _frontRun(usdc, _authorize(usdc, 1e6, "pay-1"));
        vm.prank(owner);
        settlement.settleStray(address(usdc), merchant, agent, 1e6, "pay-1", MAX_NETWORK_FEE);
        assertEq(usdc.balanceOf(treasury), ((1e6 - MAX_NETWORK_FEE) * 200) / 10_000 + MAX_NETWORK_FEE);
        assertGt(usdc.balanceOf(merchant), 0);
    }

    // ---- constructor and admin ----

    function test_Constructor_SetsRolesTokensAndCaps() public {
        address[] memory relayers = new address[](2);
        relayers[0] = relayer;
        relayers[1] = otherMerchant;
        address[] memory tokens = new address[](2);
        tokens[0] = address(usdc);
        // Un token real: el contrato lee sus decimals() para el techo del tope de costo de red.
        address otro = address(new MockStablecoin("USDG", "1", 6));
        tokens[1] = otro;
        uint256[] memory caps = new uint256[](2);
        caps[0] = 50_000;
        caps[1] = 10_000;

        vm.expectEmit();
        emit PeajeSettlementV3.GuardianUpdated(address(0), guardian);
        vm.expectEmit();
        emit PeajeSettlementV3.FeeRecipientUpdated(address(0), treasury);
        PeajeSettlementV3 fresh = new PeajeSettlementV3(owner, guardian, treasury, relayers, tokens, caps);

        assertEq(fresh.owner(), owner);
        assertEq(fresh.guardian(), guardian);
        assertEq(fresh.feeRecipient(), treasury);
        assertTrue(fresh.isRelayer(relayer));
        assertTrue(fresh.isRelayer(otherMerchant));
        assertFalse(fresh.isRelayer(owner));
        assertTrue(fresh.isAcceptedToken(address(usdc)));
        assertEq(fresh.maxNetworkFee(otro), 10_000);
        assertEq(fresh.FEE_BPS(), 200);
        assertFalse(fresh.paused());
    }

    function test_Constructor_RevertsOnLengthMismatch() public {
        address[] memory relayers = new address[](0);
        address[] memory tokens = new address[](1);
        tokens[0] = address(usdc);
        uint256[] memory caps = new uint256[](0);
        vm.expectRevert(PeajeSettlementV3.LengthMismatch.selector);
        new PeajeSettlementV3(owner, guardian, treasury, relayers, tokens, caps);
    }

    function test_Constructor_RevertsOnZeroAddresses() public {
        address[] memory none = new address[](0);
        uint256[] memory noCaps = new uint256[](0);
        address[] memory zero = new address[](1);
        uint256[] memory oneCap = new uint256[](1);

        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableInvalidOwner.selector, address(0)));
        new PeajeSettlementV3(address(0), guardian, treasury, none, none, noCaps);
        vm.expectRevert(abi.encodeWithSelector(PeajeSettlementV3.InvalidFeeRecipient.selector, address(0)));
        new PeajeSettlementV3(owner, guardian, address(0), none, none, noCaps);
        vm.expectRevert(abi.encodeWithSelector(PeajeSettlementV3.InvalidGuardian.selector, address(0)));
        new PeajeSettlementV3(owner, address(0), treasury, none, none, noCaps);
        vm.expectRevert(PeajeSettlementV3.ZeroAddress.selector);
        new PeajeSettlementV3(owner, guardian, treasury, zero, none, noCaps);
        vm.expectRevert(PeajeSettlementV3.ZeroAddress.selector);
        new PeajeSettlementV3(owner, guardian, treasury, none, zero, oneCap);
    }

    function test_FeeIsImmutable_NoSetterExists() public {
        vm.startPrank(owner);
        (bool ok,) = address(settlement).call(abi.encodeWithSignature("setFee(uint16,address)", uint16(1_000), owner));
        assertFalse(ok);
        (ok,) = address(settlement).call(abi.encodeWithSignature("feeBps()"));
        assertFalse(ok);
        vm.stopPrank();
        assertEq(settlement.FEE_BPS(), 200);
    }

    function test_NoCustodyFunctionsExist() public {
        bytes[4] memory calls = [
            abi.encodeWithSignature("withdraw(address,uint256,address)", address(usdc), 1, owner),
            abi.encodeWithSignature("claimable(address,address)", address(usdc), merchant),
            abi.encodeWithSignature("totalOwed(address)", address(usdc)),
            abi.encodeWithSignature("recoverSurplus(address,address)", address(usdc), owner)
        ];
        vm.startPrank(owner);
        for (uint256 i; i < calls.length; ++i) {
            (bool ok,) = address(settlement).call(calls[i]);
            assertFalse(ok);
        }
        vm.stopPrank();
    }

    function test_SetFeeRecipient_RotatesForNewPaymentsOnly() public {
        _settle(usdc, merchant, 1e6, 0, "pay-1");
        address next = makeAddr("nextColdWallet");

        vm.expectEmit(address(settlement));
        emit PeajeSettlementV3.FeeRecipientUpdated(treasury, next);
        vm.prank(owner);
        settlement.setFeeRecipient(next);

        _settle(usdc, merchant, 1e6, 0, "pay-2");
        assertEq(usdc.balanceOf(treasury), 20_000);
        assertEq(usdc.balanceOf(next), 20_000);
    }

    function test_SetFeeRecipient_RejectsZeroAndSelf() public {
        vm.startPrank(owner);
        vm.expectRevert(abi.encodeWithSelector(PeajeSettlementV3.InvalidFeeRecipient.selector, address(0)));
        settlement.setFeeRecipient(address(0));
        vm.expectRevert(abi.encodeWithSelector(PeajeSettlementV3.InvalidFeeRecipient.selector, address(settlement)));
        settlement.setFeeRecipient(address(settlement));
        vm.stopPrank();
    }

    function test_SetAcceptedToken_UpdatesCap() public {
        vm.expectEmit(address(settlement));
        emit PeajeSettlementV3.TokenUpdated(address(usdc), true, 250);
        vm.prank(owner);
        settlement.setAcceptedToken(address(usdc), true, 250);
        assertEq(settlement.maxNetworkFee(address(usdc)), 250);

        PeajeSettlementV3.Authorization memory auth = _authorize(usdc, 20_000, "pay-1");
        vm.expectRevert(abi.encodeWithSelector(PeajeSettlementV3.NetworkFeeTooHigh.selector, 251, 250));
        vm.prank(relayer);
        settlement.settle(address(usdc), merchant, auth, 251);
    }

    function test_SetRelayer_Emits() public {
        vm.expectEmit(address(settlement));
        emit PeajeSettlementV3.RelayerUpdated(stranger, true);
        vm.prank(owner);
        settlement.setRelayer(stranger, true);
        assertTrue(settlement.isRelayer(stranger));
    }

    function test_AdminFunctions_OnlyOwner() public {
        bytes memory unauthorized = abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, relayer);
        vm.startPrank(relayer);
        vm.expectRevert(unauthorized);
        settlement.setFeeRecipient(relayer);
        vm.expectRevert(unauthorized);
        settlement.setRelayer(stranger, true);
        vm.expectRevert(unauthorized);
        settlement.setAcceptedToken(address(usdc), true, type(uint256).max);
        vm.expectRevert(unauthorized);
        settlement.setGuardian(relayer);
        vm.expectRevert(abi.encodeWithSelector(PeajeSettlementV3.NotPauser.selector, relayer));
        settlement.pause();
        vm.expectRevert(unauthorized);
        settlement.unpause();
        vm.expectRevert(unauthorized);
        settlement.transferOwnership(relayer);
        vm.stopPrank();
    }

    // ---- guardian (pause-only) ----

    function test_Guardian_CanPause() public {
        vm.expectEmit(address(settlement));
        emit Pausable.Paused(guardian);
        vm.prank(guardian);
        settlement.pause();
        assertTrue(settlement.paused());

        PeajeSettlementV3.Authorization memory auth = _authorize(usdc, 20_000, "pay-1");
        vm.expectRevert(Pausable.EnforcedPause.selector);
        vm.prank(relayer);
        settlement.settle(address(usdc), merchant, auth, 0);
    }

    function test_Guardian_CannotUnpause() public {
        vm.startPrank(guardian);
        settlement.pause();
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, guardian));
        settlement.unpause();
        vm.stopPrank();
        assertTrue(settlement.paused());

        vm.prank(owner);
        settlement.unpause();
        assertFalse(settlement.paused());
    }

    function test_Guardian_CannotChangeAnything() public {
        _frontRun(usdc, _authorize(usdc, 1e6, "stray"));
        bytes memory unauthorized = abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, guardian);
        vm.startPrank(guardian);
        vm.expectRevert(unauthorized);
        settlement.setGuardian(stranger);
        vm.expectRevert(unauthorized);
        settlement.setFeeRecipient(guardian);
        vm.expectRevert(unauthorized);
        settlement.setRelayer(guardian, true);
        vm.expectRevert(unauthorized);
        settlement.setAcceptedToken(address(usdc), true, type(uint256).max);
        vm.expectRevert(unauthorized);
        settlement.settleStray(address(usdc), guardian, agent, 1e6, STRAY_NONCE, 0);
        vm.expectRevert(unauthorized);
        settlement.transferOwnership(guardian);
        vm.expectRevert(unauthorized);
        settlement.renounceOwnership();

        PeajeSettlementV3.Authorization memory auth = _authorize(usdc, 20_000, "pay-1");
        vm.expectRevert(abi.encodeWithSelector(PeajeSettlementV3.NotRelayer.selector, guardian));
        settlement.settle(address(usdc), guardian, auth, 0);
        vm.stopPrank();
    }

    function test_Guardian_PausingTwiceReverts() public {
        vm.prank(owner);
        settlement.pause();
        vm.expectRevert(Pausable.EnforcedPause.selector);
        vm.prank(guardian);
        settlement.pause();
    }

    function test_Owner_CanStillPauseAndUnpause() public {
        vm.startPrank(owner);
        settlement.pause();
        assertTrue(settlement.paused());
        settlement.unpause();
        vm.stopPrank();
        assertFalse(settlement.paused());
    }

    function test_SetGuardian_RotatesAndRevokesTheOldKey() public {
        address next = makeAddr("nextGuardian");
        vm.expectEmit(address(settlement));
        emit PeajeSettlementV3.GuardianUpdated(guardian, next);
        vm.prank(owner);
        settlement.setGuardian(next);
        assertEq(settlement.guardian(), next);

        vm.expectRevert(abi.encodeWithSelector(PeajeSettlementV3.NotPauser.selector, guardian));
        vm.prank(guardian);
        settlement.pause();

        vm.prank(next);
        settlement.pause();
        assertTrue(settlement.paused());
    }

    function test_SetGuardian_RejectsZeroAndSelf() public {
        vm.startPrank(owner);
        vm.expectRevert(abi.encodeWithSelector(PeajeSettlementV3.InvalidGuardian.selector, address(0)));
        settlement.setGuardian(address(0));
        vm.expectRevert(abi.encodeWithSelector(PeajeSettlementV3.InvalidGuardian.selector, address(settlement)));
        settlement.setGuardian(address(settlement));
        vm.stopPrank();
        assertEq(settlement.guardian(), guardian);
    }

    function test_Guardian_SurvivesOwnershipTransfer() public {
        address nextSafe = makeAddr("nextSafe");
        vm.prank(owner);
        settlement.transferOwnership(nextSafe);
        vm.prank(nextSafe);
        settlement.acceptOwnership();

        vm.prank(guardian);
        settlement.pause();
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, owner));
        vm.prank(owner);
        settlement.unpause();
        vm.prank(nextSafe);
        settlement.unpause();
        assertFalse(settlement.paused());
    }

    function test_AdminFunctions_RejectZeroAddress() public {
        vm.startPrank(owner);
        vm.expectRevert(PeajeSettlementV3.ZeroAddress.selector);
        settlement.setRelayer(address(0), true);
        vm.expectRevert(PeajeSettlementV3.ZeroAddress.selector);
        settlement.setAcceptedToken(address(0), true, 0);
        vm.stopPrank();
    }

    function test_RenounceOwnership_IsDisabled() public {
        vm.expectRevert(PeajeSettlementV3.RenounceDisabled.selector);
        vm.prank(owner);
        settlement.renounceOwnership();
    }

    function test_RenounceOwnership_OnlyOwner() public {
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger));
        vm.prank(stranger);
        settlement.renounceOwnership();
    }

    function test_Ownership_TransferRequiresAcceptance() public {
        address next = makeAddr("nextSafe");
        vm.prank(owner);
        settlement.transferOwnership(next);
        assertEq(settlement.owner(), owner);

        vm.prank(next);
        settlement.acceptOwnership();
        assertEq(settlement.owner(), next);
    }

    // ---- fuzz ----

    function testFuzz_Settle_Split6Decimals(uint256 value, uint256 networkFee) public {
        networkFee = bound(networkFee, 0, MAX_NETWORK_FEE);
        value = bound(value, networkFee + 1, 1_000e6);
        _assertSplit(usdc, value, networkFee);
    }

    function testFuzz_Settle_Split18Decimals(uint256 value, uint256 networkFee) public {
        MockStablecoin wide = new MockStablecoin("Wide Dollar", "1", 18);
        uint256 cap = 0.05e18;
        vm.prank(owner);
        settlement.setAcceptedToken(address(wide), true, cap);
        networkFee = bound(networkFee, 0, cap);
        value = bound(value, networkFee + 1, 1e9 * 1e18); // up to a billion dollars
        wide.mint(agent, value);
        _assertSplit(wide, value, networkFee);
    }

    function testFuzz_SettleStray_SameSplitAsSettle(uint256 value, uint256 networkFee) public {
        networkFee = bound(networkFee, 0, MAX_NETWORK_FEE);
        value = bound(value, networkFee + 1, 1_000e6);
        _frontRun(usdc, _authorize(usdc, value, "stray"));

        vm.prank(owner);
        uint256 net = settlement.settleStray(address(usdc), merchant, agent, value, "stray", networkFee);
        (uint256 quotedNet, uint256 fee) = settlement.quote(value, networkFee);

        assertEq(net, quotedNet);
        assertEq(usdc.balanceOf(merchant), net);
        assertEq(usdc.balanceOf(treasury), fee + networkFee);
        assertEq(usdc.balanceOf(address(settlement)), 0);
    }

    function _assertSplit(MockStablecoin token, uint256 value, uint256 networkFee) internal {
        uint256 payerBefore = token.balanceOf(agent);
        uint256 net = _settle(token, merchant, value, networkFee, keccak256(abi.encode(value, networkFee)));
        uint256 price = value - networkFee;
        uint256 fee = token.balanceOf(treasury) - networkFee;

        // Exact amounts moved, nothing left behind.
        assertEq(token.balanceOf(merchant), net);
        assertEq(net + fee + networkFee, value);
        assertEq(payerBefore - token.balanceOf(agent), value);
        assertEq(token.balanceOf(address(settlement)), 0);
        // Fee is floor(2% of price): never above 2%, short of it by less than one unit.
        assertEq(fee, (price * 200) / 10_000);
        assertLe(fee * 10_000, price * 200);
        assertGt((fee + 1) * 10_000, price * 200);
        // Merchant gets at least 98% of the price and never more than value - fee - networkFee.
        assertGe(net * 10_000, price * 9_800);
        assertLe(net, value - fee - networkFee);
    }
}
