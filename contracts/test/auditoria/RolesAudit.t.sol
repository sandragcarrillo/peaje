// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {PeajeSettlementV3} from "../../src/PeajeSettlementV3.sol";
import {DeployPeajeSettlementV3} from "../../script/DeployPeajeSettlementV3.s.sol";
import {MockStablecoin, MockStickyStablecoin as MockSticky} from "../mocks/MockStablecoinV3.sol";
import {BaseV3} from "../v3/BaseV3.t.sol";

/// @dev Internal audit (roles, admin, deploy). Each test proves one finding or one property.
contract RolesAuditTest is BaseV3 {
    address internal pocket = makeAddr("attackerControlledMerchant");

    // ---- F1: relayer moves the merchant's share to the fee recipient via networkFee ----

    /// The 402 quoted price 0.005 + networkFee 0.003 (value 8_000). The honest split is
    /// merchant 4_900 / fee recipient 3_100. The relayer is free to pick any networkFee up to
    /// the $0.02 cap, so for any payment below the cap it can leave the merchant with 1 unit.
    function test_F1_RelayerCanZeroOutMerchantOnPaymentsBelowCap() public {
        PeajeSettlementV3.Authorization memory auth = _authorize(usdc, 8_000, "micro");
        vm.prank(relayer);
        uint256 net = settlement.settle(address(usdc), merchant, auth, 7_999);

        assertEq(net, 1);
        assertEq(usdc.balanceOf(merchant), 1, "merchant expected 4_900");
        assertEq(usdc.balanceOf(treasury), 7_999, "fee recipient expected 3_100");
    }

    /// On a $1 payment quoted with a 0.003 network fee the relayer can still move up to
    /// cap - quoted = 0.017 per payment from the merchant to the fee recipient.
    function test_F1_RelayerDivertsUpToCapOnLargerPayments() public {
        uint256 value = 1e6 + 3_000;
        (uint256 honestNet,) = settlement.quote(value, 3_000);
        PeajeSettlementV3.Authorization memory auth = _authorize(usdc, value, "dollar");
        vm.prank(relayer);
        uint256 net = settlement.settle(address(usdc), merchant, auth, MAX_NETWORK_FEE);

        assertEq(honestNet, 980_000);
        assertEq(net, 963_340);
        assertEq(honestNet - net, 16_660); // merchant loss on one payment
        assertEq(usdc.balanceOf(treasury), (value - MAX_NETWORK_FEE) * 200 / 10_000 + MAX_NETWORK_FEE);
    }

    // ---- F2 (fixed): on-chain ceiling of 0.10 token units on maxNetworkFee ----

    /// Regression: an uncapped maxNetworkFee is rejected, so the effective take rate stays
    /// bounded by FEE_BPS plus at most 0.10 per payment.
    function test_F2_OwnerUncappedNetworkFeeMakesEffectiveFeeAlmost100Percent() public {
        vm.startPrank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(PeajeSettlementV3.NetworkFeeCapTooHigh.selector, type(uint256).max, 100_000)
        );
        settlement.setAcceptedToken(address(usdc), true, type(uint256).max);
        vm.expectRevert(abi.encodeWithSelector(PeajeSettlementV3.NetworkFeeCapTooHigh.selector, 100_001, 100_000));
        settlement.setAcceptedToken(address(usdc), true, 100_001);
        settlement.setAcceptedToken(address(usdc), true, 100_000); // exactly 0.10 is the ceiling
        vm.stopPrank();
        assertEq(settlement.maxNetworkFee(address(usdc)), 100_000);
        assertEq(settlement.FEE_BPS(), 200);
    }

    /// Regression: a cap written in 18-decimal units on a 6-decimal token is rejected, on the
    /// setter and in the constructor; on an 18-decimal token the ceiling scales to 0.1e18.
    function test_F2_DecimalsMistakeOnSetAcceptedTokenIsNotCaught() public {
        vm.expectRevert(abi.encodeWithSelector(PeajeSettlementV3.NetworkFeeCapTooHigh.selector, 0.02e18, 100_000));
        vm.prank(owner);
        settlement.setAcceptedToken(address(usdc), true, 0.02e18);
        assertEq(settlement.maxNetworkFee(address(usdc)), MAX_NETWORK_FEE);

        vm.expectRevert(abi.encodeWithSelector(PeajeSettlementV3.NetworkFeeCapTooHigh.selector, 0.02e18, 100_000));
        _deploy(address(usdc), 0.02e18);

        MockStablecoin wide = new MockStablecoin("Wide Dollar", "1", 18);
        vm.startPrank(owner);
        settlement.setAcceptedToken(address(wide), true, 0.1e18);
        vm.expectRevert(abi.encodeWithSelector(PeajeSettlementV3.NetworkFeeCapTooHigh.selector, 0.1e18 + 1, 0.1e18));
        settlement.setAcceptedToken(address(wide), true, 0.1e18 + 1);
        // Delisting with cap 0 still works.
        settlement.setAcceptedToken(address(usdc), false, 0);
        vm.stopPrank();
        assertFalse(settlement.isAcceptedToken(address(usdc)));
    }

    /// Regression: a zero cap skips the `decimals()` read, so a token whose `decimals()` is broken
    /// can still be delisted; any nonzero cap on it reverts.
    function test_New_DelistingDoesNotDependOnTokenDecimals() public {
        address noDecimals = address(new NotASafe());
        vm.startPrank(owner);
        settlement.setAcceptedToken(noDecimals, false, 0);
        vm.expectRevert();
        settlement.setAcceptedToken(noDecimals, true, 1);
        vm.stopPrank();
        assertFalse(settlement.isAcceptedToken(noDecimals));
    }

    // ---- F3: owner can still act as a relayer; roles can no longer be the merchant ----

    /// Premise unchanged: the owner can grant itself the relayer role and route a pending
    /// authorization to any address that holds no role. Only self-payment is now blocked.
    function test_F3_OwnerGrantsItselfRelayerAndRoutesPendingAuthorization() public {
        // Authorization the gateway received for `merchant`, not yet settled.
        PeajeSettlementV3.Authorization memory auth = _authorize(usdc, 1e6, "pending");

        vm.startPrank(owner);
        settlement.setRelayer(owner, true);
        vm.expectRevert(abi.encodeWithSelector(PeajeSettlementV3.InvalidMerchant.selector, owner));
        settlement.settle(address(usdc), owner, auth, 0);
        settlement.settle(address(usdc), pocket, auth, 0);
        vm.stopPrank();

        assertEq(usdc.balanceOf(pocket), 980_000);
        assertEq(usdc.balanceOf(merchant), 0);
    }

    /// Regression: a relayer (itself or another allowed one) cannot be the merchant, and the
    /// authorization stays unused.
    function test_F3_RelayerCanBeItsOwnMerchant() public {
        address otherRelayer = makeAddr("otherRelayer");
        vm.prank(owner);
        settlement.setRelayer(otherRelayer, true);
        PeajeSettlementV3.Authorization memory auth = _authorize(usdc, 1e6, "self");

        vm.startPrank(relayer);
        vm.expectRevert(abi.encodeWithSelector(PeajeSettlementV3.InvalidMerchant.selector, relayer));
        settlement.settle(address(usdc), relayer, auth, 0);
        vm.expectRevert(abi.encodeWithSelector(PeajeSettlementV3.InvalidMerchant.selector, otherRelayer));
        settlement.settle(address(usdc), otherRelayer, auth, 0);
        vm.stopPrank();

        assertFalse(usdc.authorizationState(agent, "self"));
        assertEq(usdc.balanceOf(relayer), 0);

        // A revoked relayer is a plain address again.
        vm.prank(owner);
        settlement.setRelayer(otherRelayer, false);
        vm.prank(relayer);
        settlement.settle(address(usdc), otherRelayer, auth, 0);
        assertEq(usdc.balanceOf(otherRelayer), 980_000);
    }

    /// Regression: neither the owner nor the guardian can be the merchant, in settle or in
    /// settleStray. The check uses the current holders, so a rotated-out guardian is payable.
    function test_F3_OwnerAndGuardianCannotBeMerchant() public {
        PeajeSettlementV3.Authorization memory auth = _authorize(usdc, 1e6, "role");
        vm.startPrank(relayer);
        vm.expectRevert(abi.encodeWithSelector(PeajeSettlementV3.InvalidMerchant.selector, owner));
        settlement.settle(address(usdc), owner, auth, 0);
        vm.expectRevert(abi.encodeWithSelector(PeajeSettlementV3.InvalidMerchant.selector, guardian));
        settlement.settle(address(usdc), guardian, auth, 0);
        vm.stopPrank();

        _frontRun(usdc, _authorize(usdc, 1e6, "stray"));
        vm.startPrank(owner);
        vm.expectRevert(abi.encodeWithSelector(PeajeSettlementV3.InvalidMerchant.selector, owner));
        settlement.settleStray(address(usdc), owner, agent, 1e6, "stray", 0);
        vm.expectRevert(abi.encodeWithSelector(PeajeSettlementV3.InvalidMerchant.selector, guardian));
        settlement.settleStray(address(usdc), guardian, agent, 1e6, "stray", 0);
        vm.expectRevert(abi.encodeWithSelector(PeajeSettlementV3.InvalidMerchant.selector, relayer));
        settlement.settleStray(address(usdc), relayer, agent, 1e6, "stray", 0);

        settlement.setGuardian(makeAddr("nextGuardian"));
        settlement.settleStray(address(usdc), guardian, agent, 1e6, "stray", 0);
        vm.stopPrank();
        assertEq(usdc.balanceOf(guardian), 980_000);
    }

    /// Regression: settleStray now also checks that exactly `value` left the contract.
    function test_F4_SettleStrayRejectsTokenThatLeavesBalanceBehind() public {
        MockSticky sticky = new MockSticky();
        sticky.setSticky(address(settlement));
        sticky.mint(agent, 1e6);
        _frontRun(sticky, _authorize(sticky, 1e6, "sticky"));

        vm.expectRevert(abi.encodeWithSelector(PeajeSettlementV3.BalanceNotRestored.selector, 0, 2));
        vm.prank(owner);
        settlement.settleStray(address(sticky), merchant, agent, 1e6, "sticky", 0);
    }

    // ---- F4: settleStray is a constrained sweep, donations are not trapped ----

    /// The `authorizationState` check is satisfied by ANY used EIP-3009 nonce of `from` at the
    /// token, including one signed to pay someone else directly, and `value` is not bound to the
    /// authorization. So the owner can route a plain donation (doc: "queda atrapada") to any
    /// address it names as merchant.
    function test_F4_OwnerRoutesPlainDonationCitingUnrelatedNonce() public {
        // The agent pays someone directly, unrelated to Peaje.
        PeajeSettlementV3.Authorization memory direct = _authorizeTo(usdc, AGENT_KEY, otherMerchant, 1_000, "direct");
        vm.prank(agent);
        usdc.transferWithAuthorization(
            agent, otherMerchant, 1_000, direct.validAfter, direct.validBefore, "direct", direct.v, direct.r, direct.s
        );
        // A plain transfer to the contract, no authorization behind it.
        usdc.mint(address(settlement), 5e6);

        vm.prank(owner);
        settlement.settleStray(address(usdc), pocket, agent, 5e6, "direct", MAX_NETWORK_FEE);

        assertEq(usdc.balanceOf(address(settlement)), 0);
        assertEq(usdc.balanceOf(pocket), 4_880_400); // (5e6 - 20_000) * 98%
        assertEq(usdc.balanceOf(treasury), 99_600 + MAX_NETWORK_FEE);
    }

    /// A nonce already settled through `settle` passes too, which emits a second
    /// PaymentSettled for the same nonce and consumes funds that belonged to another stray.
    function test_F4_SettledNonceCanBeCitedAgainAndStealsAnotherStraysFunds() public {
        _settle(usdc, merchant, 1e6, 0, "pay-1");
        PeajeSettlementV3.Authorization memory real = _authorize(usdc, 1e6, "real-stray");
        _frontRun(usdc, real);

        vm.expectEmit(address(settlement));
        emit PeajeSettlementV3.PaymentSettled("pay-1", address(usdc), pocket, agent, 1e6, 980_000, 20_000, 0);
        vm.prank(owner);
        settlement.settleStray(address(usdc), pocket, agent, 1e6, "pay-1", 0);

        // The genuine stray can no longer be routed to its merchant.
        vm.expectRevert(abi.encodeWithSelector(PeajeSettlementV3.InsufficientStray.selector, 0, 1e6));
        vm.prank(owner);
        settlement.settleStray(address(usdc), merchant, agent, 1e6, "real-stray", 0);
    }

    /// `value` is not tied to the cited authorization: a 1_000-unit front-run "covers" 1_001_000.
    function test_F4_StrayValueNotBoundToAuthorization() public {
        _frontRun(usdc, _authorize(usdc, 1_000, "tiny"));
        usdc.mint(address(settlement), 1e6);

        vm.prank(owner);
        uint256 net = settlement.settleStray(address(usdc), pocket, agent, 1_001_000, "tiny", 0);
        assertEq(net, 980_980);
        assertEq(usdc.balanceOf(address(settlement)), 0);
    }

    // ---- pause semantics ----

    function test_Pause_AdminAndStrayStillWorkWhilePaused() public {
        _frontRun(usdc, _authorize(usdc, 1e6, "stray"));
        vm.prank(guardian);
        settlement.pause();

        address nextRelayer = makeAddr("nextRelayer");
        address nextSafe = makeAddr("nextSafe");
        vm.startPrank(owner);
        settlement.setRelayer(relayer, false);
        settlement.setRelayer(nextRelayer, true);
        settlement.setFeeRecipient(makeAddr("nextCold"));
        settlement.setAcceptedToken(address(usdc), true, 10_000);
        settlement.settleStray(address(usdc), merchant, agent, 1e6, "stray", 0);
        settlement.transferOwnership(nextSafe);
        vm.stopPrank();
        vm.prank(nextSafe);
        settlement.acceptOwnership();

        assertTrue(settlement.paused());
        assertEq(usdc.balanceOf(merchant), 980_000);

        PeajeSettlementV3.Authorization memory auth = _authorize(usdc, 1e6, "blocked");
        vm.expectRevert(Pausable.EnforcedPause.selector);
        vm.prank(nextRelayer);
        settlement.settle(address(usdc), merchant, auth, 0);
        assertFalse(usdc.authorizationState(agent, "blocked")); // payer keeps the funds
    }

    /// A leaked guardian key can re-pause after every unpause, but it is a DoS only: the owner
    /// rotates the guardian while paused and unpauses, and nothing else is reachable.
    function test_Pause_LeakedGuardianIsDoSOnlyAndRecoverable() public {
        vm.prank(guardian);
        settlement.pause();
        vm.prank(owner);
        settlement.unpause();
        vm.prank(guardian);
        settlement.pause();

        address freshGuardian = makeAddr("freshGuardian");
        vm.startPrank(owner);
        settlement.setGuardian(freshGuardian);
        settlement.unpause();
        vm.stopPrank();

        vm.expectRevert(abi.encodeWithSelector(PeajeSettlementV3.NotPauser.selector, guardian));
        vm.prank(guardian);
        settlement.pause();
        _settle(usdc, merchant, 1e6, 0, "after");
        assertEq(usdc.balanceOf(merchant), 980_000);
    }

    /// Authorizations that failed during a pause stay valid and can be settled after unpause,
    /// by any allowed relayer, to any merchant.
    function test_Pause_AuthorizationRejectedWhilePausedIsSettleableAfter() public {
        PeajeSettlementV3.Authorization memory auth = _authorize(usdc, 1e6, "retry");
        vm.prank(guardian);
        settlement.pause();
        vm.expectRevert(Pausable.EnforcedPause.selector);
        vm.prank(relayer);
        settlement.settle(address(usdc), merchant, auth, 0);

        vm.prank(owner);
        settlement.unpause();
        vm.prank(relayer);
        settlement.settle(address(usdc), otherMerchant, auth, 0);
        assertEq(usdc.balanceOf(otherMerchant), 980_000);
    }

    // ---- ownership ----

    function test_Ownership_CannotBeRenouncedThroughTransferToZero() public {
        vm.prank(owner);
        settlement.transferOwnership(address(0));
        assertEq(settlement.owner(), owner);
        assertEq(settlement.pendingOwner(), address(0));
        // No key signs as address(0), so a zero pendingOwner can never accept.
    }

    function test_Ownership_PendingOwnerHasNoPowers() public {
        address next = makeAddr("nextSafe");
        vm.prank(owner);
        settlement.transferOwnership(next);

        vm.startPrank(next);
        vm.expectRevert(abi.encodeWithSelector(PeajeSettlementV3.NotPauser.selector, next));
        settlement.pause();
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, next));
        settlement.setFeeRecipient(next);
        vm.stopPrank();
    }

    // ---- F6: on-chain role separation is not enforced (script-only) ----

    function test_F6_ConstructorAndSettersAcceptOverlappingRoles() public {
        address hot = makeAddr("hotKey");
        address[] memory relayers = new address[](1);
        relayers[0] = hot;
        address[] memory tokens = new address[](1);
        tokens[0] = address(usdc);
        uint256[] memory caps = new uint256[](1);
        caps[0] = MAX_NETWORK_FEE;

        // owner == guardian == relayer == fee recipient: all accepted.
        PeajeSettlementV3 s = new PeajeSettlementV3(hot, hot, hot, relayers, tokens, caps);
        assertEq(s.owner(), hot);
        assertEq(s.guardian(), hot);
        assertEq(s.feeRecipient(), hot);
        assertTrue(s.isRelayer(hot));

        // Post-deploy the owner can also collapse roles on the main contract.
        vm.startPrank(owner);
        settlement.setFeeRecipient(relayer);
        settlement.setGuardian(owner);
        settlement.setRelayer(owner, true);
        vm.stopPrank();
        assertEq(settlement.feeRecipient(), relayer);
    }
}

/// Exposes the deploy script's checks without env vars (env is process-wide and the existing
/// DeployScriptV3Test sets it). Only `mainnet = true` is used, so ALLOW_EOA_OWNER is never read.
contract DeployChecksHarness is DeployPeajeSettlementV3 {
    function checkRoles(Network memory n, address o, address g, address f, address[] memory r) external view {
        _checkRoles(n, o, g, f, r);
    }

    function checkTokens(address[] memory t, uint256[] memory c) external view {
        _checkTokens(t, c);
    }
}

contract NotASafe {
    function hello() external pure returns (uint256) {
        return 1;
    }
}

/// Answers getThreshold/getOwners like a Safe, with configurable values. The script only checks
/// these two return values (duck typing), so any contract that returns them passes.
contract FakeSafe {
    uint256 public getThreshold;
    address[] internal signers;

    constructor(uint256 threshold, uint256 count) {
        getThreshold = threshold;
        for (uint256 i; i < count; ++i) {
            signers.push(address(uint160(0x5afe + i)));
        }
    }

    function getOwners() external view returns (address[] memory) {
        return signers;
    }
}

contract RolesDeployScriptAuditTest is BaseV3 {
    DeployChecksHarness internal h;

    function setUp() public override {
        super.setUp();
        h = new DeployChecksHarness();
    }

    function _mainnet() internal pure returns (DeployPeajeSettlementV3.Network memory n) {
        n.chainId = 42161;
        n.mainnet = true;
    }

    function _one(address a) internal pure returns (address[] memory arr) {
        arr = new address[](1);
        arr[0] = a;
    }

    /// F5 (fixed): on mainnet the owner must answer getThreshold() >= 2 and getOwners() >= 3.
    /// Residual: the check is duck-typed, so a non-Safe contract with those two views passes.
    function test_F5_ScriptAcceptsAnyContractAsMainnetOwner() public {
        address notSafe = address(new NotASafe());
        vm.expectRevert(bytes("OWNER is not a Safe (no getThreshold/getOwners)"));
        h.checkRoles(_mainnet(), notSafe, guardian, treasury, _one(relayer));
        vm.expectRevert(bytes("OWNER is not a Safe (no getThreshold/getOwners)"));
        h.checkRoles(_mainnet(), address(usdc), guardian, treasury, _one(relayer));

        address oneOfThree = address(new FakeSafe(1, 3));
        address twoOfTwo = address(new FakeSafe(2, 2));
        address twoOfThree = address(new FakeSafe(2, 3));
        vm.expectRevert(bytes("OWNER Safe threshold must be at least 2"));
        h.checkRoles(_mainnet(), oneOfThree, guardian, treasury, _one(relayer));
        vm.expectRevert(bytes("OWNER Safe must have at least 3 signers"));
        h.checkRoles(_mainnet(), twoOfTwo, guardian, treasury, _one(relayer));
        h.checkRoles(_mainnet(), twoOfThree, guardian, treasury, _one(relayer)); // not a real Safe, passes
    }

    function test_Script_GuardsThatDoHold() public {
        vm.expectRevert(bytes("OWNER has no code: deploy the Safe on this network first"));
        h.checkRoles(_mainnet(), makeAddr("eoa"), guardian, treasury, _one(relayer));

        address safe = address(new FakeSafe(2, 3));
        vm.expectRevert(bytes("OWNER and FEE_RECIPIENT must differ"));
        h.checkRoles(_mainnet(), safe, guardian, safe, _one(relayer));
        vm.expectRevert(bytes("RELAYERS is empty"));
        h.checkRoles(_mainnet(), safe, guardian, treasury, new address[](0));
        vm.expectRevert(bytes("relayers are EOAs (hot keys)"));
        h.checkRoles(_mainnet(), safe, guardian, treasury, _one(address(usdc)));

        MockStablecoin wide = new MockStablecoin("Wide", "1", 18);
        uint256[] memory cap = new uint256[](1);
        cap[0] = 20_000;
        vm.expectRevert(bytes("token does not have 6 decimals: review the cap"));
        h.checkTokens(_one(address(wide)), cap);

        cap[0] = 100_001;
        vm.expectRevert(bytes("cap above $0.10: double check MAX_NETWORK_FEES"));
        h.checkTokens(_one(address(usdc)), cap);

        cap[0] = 20_000;
        vm.expectRevert(bytes("token has no code on this network"));
        h.checkTokens(_one(makeAddr("noCode")), cap);

        address noEip3009 = address(new NotASafe());
        vm.expectRevert(); // no authorizationState
        h.checkTokens(_one(noEip3009), cap);

        cap[0] = 100_000;
        h.checkTokens(_one(address(usdc)), cap); // $0.10 is the highest accepted
    }

    /// Duplicate tokens pass the script; the constructor keeps the last cap.
    function test_Script_DuplicateTokenLastCapWins() public {
        address[] memory tokens = new address[](2);
        tokens[0] = address(usdc);
        tokens[1] = address(usdc);
        uint256[] memory caps = new uint256[](2);
        caps[0] = 10_000;
        caps[1] = 100_000;
        h.checkTokens(tokens, caps);
        PeajeSettlementV3 s = new PeajeSettlementV3(owner, guardian, treasury, _one(relayer), tokens, caps);
        assertEq(s.maxNetworkFee(address(usdc)), 100_000);
    }
}
