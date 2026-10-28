// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {stdError} from "forge-std/StdError.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {PeajeSettlementV3} from "../../src/PeajeSettlementV3.sol";
import {InvariantesMockTokenRaro, InvariantesMockMerchantHook} from "./InvariantesMockTokens.sol";

/// @dev Stateless fuzz properties (run with FOUNDRY_FUZZ_RUNS=10000) plus deterministic
///      reproductions of the counterexamples the invariant campaign finds for the B-properties.
///      `test_Contraejemplo_*` assert the behaviour that exists today, so they pass; each one
///      states the stronger property it breaks.
contract InvariantesPropiedadesV3Test is Test {
    PeajeSettlementV3 internal s;
    InvariantesMockTokenRaro internal usdc; // 6 decimals
    InvariantesMockTokenRaro internal wide; // 18 decimals
    InvariantesMockTokenRaro internal raro; // 6 decimals, quirks
    InvariantesMockTokenRaro internal noListado;

    address internal owner = makeAddr("prop.owner");
    address internal guardian = makeAddr("prop.guardian");
    address internal fr = makeAddr("prop.feeRecipient");
    address internal fr2 = makeAddr("prop.feeRecipient2");
    address internal merchant = makeAddr("prop.merchant");
    address internal carol = makeAddr("prop.carol");
    address internal stranger = makeAddr("prop.stranger");
    address internal otro = makeAddr("prop.otherMerchant");
    address internal guardian2 = makeAddr("prop.guardian2");
    address internal relayer2 = makeAddr("prop.relayer2");
    address internal owner2 = makeAddr("prop.owner2");

    uint256 internal constant AGENT_KEY = 0xA11CE;
    uint256 internal constant BOB_KEY = 0xB0B;
    uint256 internal constant RELAYER_KEY = 0x2E1A7E2;
    address internal agent = vm.addr(AGENT_KEY);
    address internal bob = vm.addr(BOB_KEY);
    address internal relayer = vm.addr(RELAYER_KEY);

    uint256 internal constant CAP6 = 20_000;
    uint256 internal constant CAP18 = 0.02e18;
    uint256 internal nonceCounter;

    function setUp() public {
        usdc = new InvariantesMockTokenRaro("USD Coin", "2", 6);
        wide = new InvariantesMockTokenRaro("Wide Dollar", "1", 18);
        raro = new InvariantesMockTokenRaro("Raro", "1", 6);
        noListado = new InvariantesMockTokenRaro("No listado", "1", 6);
        address[] memory rel = new address[](1);
        rel[0] = relayer;
        address[] memory toks = new address[](3);
        toks[0] = address(usdc);
        toks[1] = address(wide);
        toks[2] = address(raro);
        uint256[] memory caps = new uint256[](3);
        caps[0] = CAP6;
        caps[1] = CAP18;
        caps[2] = CAP6;
        s = new PeajeSettlementV3(owner, guardian, fr, rel, toks, caps);
        raro.setOrigenFee(address(s));
        raro.setPegajoso(address(s));
        vm.prank(owner);
        s.setRelayer(relayer2, true);
        vm.warp(1_000_000);
    }

    // ================================================================================
    // fuzz properties
    // ================================================================================

    /// net + fee + networkFee == value; fee == floor(2% price) == price / 50; fee recipient gets
    /// at most 2% of the price plus networkFee; merchant gets at least 98% and at least 1 unit.
    function testFuzz_P01_RepartoAritmeticoExactoEnTodoElRango(uint256 value, uint256 nf) public view {
        value = bound(value, 1, type(uint256).max / 200);
        nf = bound(nf, 0, value - 1);
        (uint256 net, uint256 fee) = s.quote(value, nf);
        uint256 price = value - nf;
        assertEq(net + fee + nf, value);
        assertEq(fee, (price * 200) / 10_000);
        assertEq(fee, price / 50);
        // 200 / 10_000 == 1 / 50: fee is floor(price / 50), so fee * 50 <= price < (fee + 1) * 50
        assertLe(fee * 50, price);
        assertGt((fee + 1) * 50, price);
        assertGe(net * 50, price * 49);
        assertGe(net, 1);
    }

    /// Boundary: the split only reverts when there is no price (value <= networkFee) or when
    /// price * 200 overflows (price > 2^256 / 200, far above any real token supply).
    function testFuzz_P02_QuoteSoloRevierteSinPrecioOPorOverflow(uint256 value, uint256 nf) public {
        if (value <= nf) {
            vm.expectRevert(PeajeSettlementV3.ZeroAmount.selector);
            s.quote(value, nf);
        } else if (value - nf > type(uint256).max / 200) {
            vm.expectRevert(stdError.arithmeticError);
            s.quote(value, nf);
        } else {
            (uint256 net, uint256 fee) = s.quote(value, nf);
            assertEq(net + fee + nf, value);
        }
    }

    /// One settle with stray balance, a donation, rotated roles and a special but valid merchant
    /// (payer, former fee recipient, revoked relayer, retired guardian, the token): payer debit ==
    /// merchant credit + fee recipient credit, nothing else moves, the contract ends with the
    /// exact balance it started with.
    struct Saldos {
        uint256 s;
        uint256 agent;
        uint256 m;
        uint256 fr;
        uint256 supply;
    }

    function testFuzz_P03_SettleConservaValorYDejaElSaldoPrevio(
        uint256 value,
        uint256 nf,
        uint256 stray,
        uint256 donacion,
        uint8 mk,
        bool dieciocho
    ) public {
        InvariantesMockTokenRaro tok = dieciocho ? wide : usdc;
        uint256 unit = 10 ** tok.decimals();
        nf = bound(nf, 0, s.maxNetworkFee(address(tok)));
        value = bound(value, nf + 1, 1e12 * unit);
        stray = bound(stray, 0, 1e9 * unit);
        donacion = bound(donacion, 0, 1e9 * unit);
        if (stray != 0) _frontRun(tok, BOB_KEY, stray, _nonce());
        if (donacion != 0) tok.mint(address(s), donacion);
        vm.startPrank(owner);
        s.setFeeRecipient(fr2); // `fr` is now a former fee recipient and a valid merchant
        s.setRelayer(relayer2, false); // revoked relayer: valid merchant
        s.setGuardian(guardian2); // retired guardian: valid merchant
        vm.stopPrank();

        address m = _merchantEspecial(mk, tok);
        tok.mint(agent, value);
        Saldos memory antes = Saldos(
            tok.balanceOf(address(s)), tok.balanceOf(agent), tok.balanceOf(m), tok.balanceOf(fr2), tok.totalSupply()
        );
        uint256 net = _settle(tok, AGENT_KEY, m, value, nf, _nonce());
        _chequearP03(tok, m, value, nf, net, antes);
    }

    function _chequearP03(
        InvariantesMockTokenRaro tok,
        address m,
        uint256 value,
        uint256 nf,
        uint256 net,
        Saldos memory antes
    ) internal view {
        uint256 price = value - nf;
        uint256 fee = price / 50;
        assertEq(net, price - fee);
        assertEq(tok.balanceOf(address(s)), antes.s, "contrato no volvio a su saldo previo");
        assertEq(tok.balanceOf(fr2) - antes.fr, fee + nf, "fee recipient");
        assertLe(tok.balanceOf(fr2) - antes.fr, (price * 200) / 10_000 + nf);
        if (m == agent) {
            assertEq(antes.agent - tok.balanceOf(agent), value - net, "payer = merchant");
        } else {
            assertEq(antes.agent - tok.balanceOf(agent), value, "payer");
            assertEq(tok.balanceOf(m) - antes.m, net, "merchant");
        }
        assertEq(tok.totalSupply(), antes.supply);
        // the former fee recipient only gets something when it is the merchant
        assertEq(tok.balanceOf(fr), m == fr ? antes.m + net : 0);
    }

    /// address(0), the contract, the current fee recipient (also right after a rotation), the
    /// owner, the guardian and any current relayer can never be the merchant, in settle or in
    /// settleStray. Nothing moves, the nonce stays unused.
    function testFuzz_P04_MerchantInvalidoNuncaLiquida(uint256 value, uint256 nf, uint8 kind, uint8 rot) public {
        if (rot % 3 == 1) {
            vm.prank(owner);
            s.setFeeRecipient(fr2);
        } else if (rot % 3 == 2) {
            vm.prank(owner);
            s.setFeeRecipient(merchant);
        }
        nf = bound(nf, 0, CAP6);
        value = bound(value, nf + 1, 1e12);
        address[6] memory invalidos = [address(0), address(s), s.feeRecipient(), owner, guardian, relayer];
        address m = kind % 7 == 6 ? relayer2 : invalidos[kind % 7];
        usdc.mint(agent, value);
        bytes32 nonce = _nonce();
        PeajeSettlementV3.Authorization memory a = _auth(usdc, AGENT_KEY, address(s), value, nonce);
        uint256 agentAntes = usdc.balanceOf(agent);

        vm.expectRevert(abi.encodeWithSelector(PeajeSettlementV3.InvalidMerchant.selector, m));
        vm.prank(relayer);
        s.settle(address(usdc), m, a, nf);
        assertEq(usdc.balanceOf(agent), agentAntes);
        assertFalse(usdc.authorizationState(agent, nonce));

        _frontRun(usdc, AGENT_KEY, value, nonce);
        vm.expectRevert(abi.encodeWithSelector(PeajeSettlementV3.InvalidMerchant.selector, m));
        vm.prank(owner);
        s.settleStray(address(usdc), m, agent, value, nonce, nf);
        assertEq(usdc.balanceOf(address(s)), value);
    }

    /// networkFee above the cap never settles (settle and settleStray); exactly at the cap it does.
    function testFuzz_P05_NetworkFeeSobreElTopeNuncaLiquida(uint256 cap, uint256 nf, uint256 value) public {
        cap = bound(cap, 0, 100_000); // contract ceiling for 6 decimals
        vm.prank(owner);
        s.setAcceptedToken(address(usdc), true, cap);
        uint256 alto = bound(nf, cap + 1, cap + 1e12);
        value = bound(value, alto + 1, alto + 1e12);
        usdc.mint(agent, 2 * value);
        bytes32 nonce = _nonce();
        PeajeSettlementV3.Authorization memory a = _auth(usdc, AGENT_KEY, address(s), value, nonce);

        vm.expectRevert(abi.encodeWithSelector(PeajeSettlementV3.NetworkFeeTooHigh.selector, alto, cap));
        vm.prank(relayer);
        s.settle(address(usdc), merchant, a, alto);

        bytes32 n2 = _nonce();
        _frontRun(usdc, AGENT_KEY, value, n2);
        vm.expectRevert(abi.encodeWithSelector(PeajeSettlementV3.NetworkFeeTooHigh.selector, alto, cap));
        vm.prank(owner);
        s.settleStray(address(usdc), merchant, agent, value, n2, alto);

        // At the cap: passes and the fee recipient gets exactly fee + cap.
        uint256 frAntes = usdc.balanceOf(fr);
        vm.prank(relayer);
        uint256 net = s.settle(address(usdc), merchant, a, cap);
        assertEq(usdc.balanceOf(fr) - frAntes, (value - cap) / 50 + cap);
        assertEq(net, value - cap - (value - cap) / 50);
    }

    /// Paused: settle moves nothing and leaves the authorization usable; settleStray still works
    /// (the doc allows it); after unpause the same authorization settles normally.
    function testFuzz_P06_EnPausaSoloSettleStrayMuevePlata(uint256 value, uint256 nf, bool viaGuardian) public {
        nf = bound(nf, 0, CAP6);
        value = bound(value, nf + 1, 1e12);
        vm.prank(viaGuardian ? guardian : owner);
        s.pause();

        usdc.mint(agent, value);
        bytes32 nonce = _nonce();
        PeajeSettlementV3.Authorization memory a = _auth(usdc, AGENT_KEY, address(s), value, nonce);
        uint256 agentAntes = usdc.balanceOf(agent);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        vm.prank(relayer);
        s.settle(address(usdc), merchant, a, nf);
        assertEq(usdc.balanceOf(agent), agentAntes);
        assertEq(usdc.balanceOf(merchant), 0);
        assertEq(usdc.balanceOf(fr), 0);
        assertFalse(usdc.authorizationState(agent, nonce));

        bytes32 n2 = _nonce();
        _frontRun(usdc, BOB_KEY, value, n2);
        vm.prank(owner);
        s.settleStray(address(usdc), merchant, bob, value, n2, nf);
        assertEq(usdc.balanceOf(address(s)), 0);

        vm.prank(owner);
        s.unpause();
        vm.prank(relayer);
        s.settle(address(usdc), merchant, a, nf);
        assertEq(usdc.balanceOf(address(s)), 0);
    }

    /// settleStray moves exactly `value` out of the contract, never more than its balance.
    function testFuzz_P07_SettleStrayMueveExactamenteValueYNuncaMasQueElSaldo(
        uint256 v1,
        uint256 v2,
        uint256 don,
        uint256 value,
        uint256 nf
    ) public {
        v1 = bound(v1, 1, 1e12);
        v2 = bound(v2, 0, 1e12);
        don = bound(don, 0, 1e12);
        bytes32 n1 = _nonce();
        _frontRun(usdc, AGENT_KEY, v1, n1);
        if (v2 != 0) _frontRun(usdc, BOB_KEY, v2, _nonce());
        if (don != 0) usdc.mint(address(s), don);
        uint256 saldo = usdc.balanceOf(address(s));
        value = bound(value, 1, saldo + 1e6);
        nf = bound(nf, 0, value - 1 < CAP6 ? value - 1 : CAP6);

        if (value > saldo) {
            vm.expectRevert(abi.encodeWithSelector(PeajeSettlementV3.InsufficientStray.selector, saldo, value));
            vm.prank(owner);
            s.settleStray(address(usdc), merchant, agent, value, n1, nf);
            return;
        }
        vm.prank(owner);
        uint256 net = s.settleStray(address(usdc), merchant, agent, value, n1, nf);
        assertEq(saldo - usdc.balanceOf(address(s)), value, "movio distinto de value");
        assertEq(usdc.balanceOf(merchant), net);
        assertEq(usdc.balanceOf(fr), (value - nf) / 50 + nf);
        assertTrue(s.straySettled(address(usdc), agent, n1));
    }

    /// Two tokens: settling or routing one never changes the contract's balance of the other.
    function testFuzz_P08_CadaTokenEsIndependiente(uint256 a6, uint256 a18, uint256 v) public {
        a6 = bound(a6, 1, 1e12);
        a18 = bound(a18, 1, 1e30);
        v = bound(v, 1, 1e12);
        bytes32 n6 = _nonce();
        _frontRun(usdc, AGENT_KEY, a6, n6);
        _frontRun(wide, BOB_KEY, a18, _nonce());

        usdc.mint(agent, v);
        _settle(usdc, AGENT_KEY, merchant, v, 0, _nonce());
        assertEq(usdc.balanceOf(address(s)), a6);
        assertEq(wide.balanceOf(address(s)), a18);

        // The usdc stray cannot be routed with wide funds, nor the other way around.
        vm.expectRevert(abi.encodeWithSelector(PeajeSettlementV3.AuthorizationNotUsed.selector, agent, n6));
        vm.prank(owner);
        s.settleStray(address(wide), merchant, agent, a6, n6, 0);
        vm.prank(owner);
        s.settleStray(address(usdc), merchant, agent, a6, n6, 0);
        assertEq(usdc.balanceOf(address(s)), 0);
        assertEq(wide.balanceOf(address(s)), a18);
    }

    /// The token quirks the doc says settle rejects are rejected for every amount that triggers
    /// them, and the call is atomic. USDT-style tokens without a return value work exactly.
    function testFuzz_P09_TokensRarosEnSettle(uint8 modoSeed, uint256 value) public {
        uint8 modo = uint8(bound(modoSeed, 1, 5)); // FOT_TODO, FOT_SALIDA, PEGAJOSO, RETORNA_FALSE, SIN_RETORNO
        value = bound(value, 100, 1e12); // >= 100 so a 1% fee is never zero
        raro.setModo(InvariantesMockTokenRaro.Modo(modo));
        raro.mint(agent, value);
        bytes32 nonce = _nonce();
        PeajeSettlementV3.Authorization memory a = _auth(raro, AGENT_KEY, address(s), value, nonce);
        uint256 net = value - value / 50;
        uint256 fee = value / 50;

        if (modo == uint8(InvariantesMockTokenRaro.Modo.FOT_TODO)) {
            vm.expectRevert(
                abi.encodeWithSelector(PeajeSettlementV3.UnexpectedAmountReceived.selector, value, value - value / 100)
            );
        } else if (modo == uint8(InvariantesMockTokenRaro.Modo.PEGAJOSO)) {
            vm.expectRevert(abi.encodeWithSelector(PeajeSettlementV3.BalanceNotRestored.selector, 0, 2));
        } else if (modo == uint8(InvariantesMockTokenRaro.Modo.RETORNA_FALSE)) {
            vm.expectRevert();
        }
        vm.prank(relayer);
        s.settle(address(raro), merchant, a, 0);

        if (modo == uint8(InvariantesMockTokenRaro.Modo.SIN_RETORNO)) {
            assertEq(raro.balanceOf(merchant), net);
            assertEq(raro.balanceOf(fr), fee);
        } else if (modo == uint8(InvariantesMockTokenRaro.Modo.FOT_SALIDA)) {
            // passes both balance checks; see test_Contraejemplo_B1
            assertEq(raro.balanceOf(merchant), net - net / 100);
        } else {
            assertEq(raro.balanceOf(agent), value);
            assertEq(raro.balanceOf(merchant), 0);
            assertFalse(raro.authorizationState(agent, nonce));
        }
        assertEq(raro.balanceOf(address(s)), 0);
    }

    /// A cap above 0.10 of a token unit is always rejected, in setAcceptedToken (listing or
    /// delisting) and in the constructor; state is unchanged. Exactly at the ceiling it passes.
    function testFuzz_P10_TopeSobreElTechoSiempreRevierte(uint256 cap, bool dieciocho, bool aceptado) public {
        InvariantesMockTokenRaro tok = dieciocho ? wide : usdc;
        uint256 techo = 10 ** tok.decimals() / 10;
        cap = bound(cap, techo + 1, type(uint256).max);
        uint256 antes = s.maxNetworkFee(address(tok));

        vm.expectRevert(abi.encodeWithSelector(PeajeSettlementV3.NetworkFeeCapTooHigh.selector, cap, techo));
        vm.prank(owner);
        s.setAcceptedToken(address(tok), aceptado, cap);
        assertEq(s.maxNetworkFee(address(tok)), antes);
        assertTrue(s.isAcceptedToken(address(tok)));

        address[] memory rel = new address[](1);
        rel[0] = relayer;
        address[] memory toks = new address[](1);
        toks[0] = address(tok);
        uint256[] memory caps = new uint256[](1);
        caps[0] = cap;
        vm.expectRevert(abi.encodeWithSelector(PeajeSettlementV3.NetworkFeeCapTooHigh.selector, cap, techo));
        new PeajeSettlementV3(owner, guardian, fr, rel, toks, caps);

        vm.prank(owner);
        s.setAcceptedToken(address(tok), aceptado, techo);
        assertEq(s.maxNetworkFee(address(tok)), techo);
    }

    // ================================================================================
    // counterexamples (B-properties) and observations
    // ================================================================================

    /// B1 "merchant receives exactly net": broken by a token that charges its fee only on
    /// transfers sent by the settlement. The pull delivers the full value
    /// (`received == auth.value`, PeajeSettlementV3.sol:164) and the contract is debited exactly
    /// net + fee + networkFee (`balanceAfter == balanceBefore`, :170), so settle succeeds and
    /// emits net = 980_000 while the merchant gets 970_200. Same in settleStray (:206, its new final check at :212 also passes), which
    /// has no allowlist check. Doc contrato-v3.md:126 says fee-on-transfer tokens are rejected
    /// "en el mismo pago"; that holds only when the fee also hits the inbound pull.
    function test_Contraejemplo_B1_FeeSoloDeSalida_MerchantRecibeMenosQueNet() public {
        raro.setModo(InvariantesMockTokenRaro.Modo.FOT_SALIDA);
        raro.mint(agent, 2e6);
        uint256 net = _settle(raro, AGENT_KEY, merchant, 1e6, 0, _nonce());
        assertEq(net, 980_000);
        assertEq(raro.balanceOf(merchant), 970_200); // 1% of net burnt on the way out
        assertEq(raro.balanceOf(fr), 19_800);
        assertEq(raro.balanceOf(address(s)), 0);

        bytes32 n = _nonce();
        _frontRun(raro, AGENT_KEY, 1e6, n);
        vm.prank(owner);
        s.settleStray(address(raro), merchant, agent, 1e6, n, 0);
        assertEq(raro.balanceOf(merchant), 2 * 970_200);
    }

    /// Regression for B2. On the audited version settleStray had no final balance check and a
    /// rebasing token left 2 units behind. Now it reverts BalanceNotRestored like settle does;
    /// the stray stays intact and routable once the token behaves.
    function test_Regresion_B2_SettleStrayRechazaUnTokenQueDejaSaldo() public {
        bytes32 n = _nonce();
        _frontRun(raro, AGENT_KEY, 1e6, n);
        raro.setModo(InvariantesMockTokenRaro.Modo.PEGAJOSO);

        raro.mint(bob, 1e6);
        PeajeSettlementV3.Authorization memory a = _auth(raro, BOB_KEY, address(s), 1e6, _nonce());
        vm.expectRevert(abi.encodeWithSelector(PeajeSettlementV3.BalanceNotRestored.selector, 1e6, 1e6 + 2));
        vm.prank(relayer);
        s.settle(address(raro), merchant, a, 0);

        vm.expectRevert(abi.encodeWithSelector(PeajeSettlementV3.BalanceNotRestored.selector, 0, 2));
        vm.prank(owner);
        s.settleStray(address(raro), merchant, agent, 1e6, n, 0);
        assertEq(raro.balanceOf(address(s)), 1e6);
        assertEq(raro.balanceOf(merchant), 0);
        assertFalse(s.straySettled(address(raro), agent, n));

        raro.setModo(InvariantesMockTokenRaro.Modo.NORMAL);
        vm.prank(owner);
        s.settleStray(address(raro), merchant, agent, 1e6, n, 0);
        assertEq(raro.balanceOf(address(s)), 0);
        assertEq(raro.balanceOf(merchant), 980_000);
    }

    /// Same check with a merchant that sends value back into the contract while being paid.
    function test_Regresion_B2b_SettleStrayRechazaEntradaDuranteElPago() public {
        InvariantesMockMerchantHook h = new InvariantesMockMerchantHook(address(s));
        raro.setReceptorHook(address(h));
        bytes32 n = _nonce();
        _frontRun(raro, AGENT_KEY, 1e6, n);
        raro.setModo(InvariantesMockTokenRaro.Modo.HOOK);
        h.armar(address(raro), "", true, address(0));
        vm.expectRevert(abi.encodeWithSelector(PeajeSettlementV3.BalanceNotRestored.selector, 0, 1));
        vm.prank(owner);
        s.settleStray(address(raro), address(h), agent, 1e6, n, 0);
        assertEq(raro.balanceOf(address(s)), 1e6);
    }

    /// B3a "plain donations stay trapped" (contrato-v3.md:109): false. settleStray only checks
    /// that `authorizationState(from, nonce)` is true at the token (:194), not that the
    /// authorization paid this contract or that `value` matches it. Any spent nonce of anyone,
    /// even one used to pay a third party, routes a donation. The event names `bob` as payer of
    /// a payment he never made to Peaje.
    function test_Contraejemplo_B3a_DonacionSeRuteaConUnNonceAjeno() public {
        usdc.mint(address(s), 5e6); // plain transfer, no authorization
        bytes32 n = _nonce();
        usdc.mint(bob, 1);
        PeajeSettlementV3.Authorization memory a = _auth(usdc, BOB_KEY, carol, 1, n);
        vm.prank(stranger);
        usdc.transferWithAuthorization(bob, carol, 1, 0, a.validBefore, n, a.v, a.r, a.s); // unrelated payment

        vm.expectEmit(address(s));
        emit PeajeSettlementV3.PaymentSettled(n, address(usdc), merchant, bob, 5e6, 4_900_000, 100_000, 0);
        vm.prank(owner);
        s.settleStray(address(usdc), merchant, bob, 5e6, n, 0);
        assertEq(usdc.balanceOf(address(s)), 0);
        assertEq(usdc.balanceOf(merchant), 4_900_000);
    }

    /// B3b "settleStray moves at most the stray of the nonce it names": false. An inflated
    /// `value` for a small stray consumes another payer's stray; that one can then never be
    /// routed (InsufficientStray) unless someone donates the difference.
    function test_Contraejemplo_B3b_ValueInfladoConsumeElStrayDeOtroPagador() public {
        bytes32 nA = _nonce();
        bytes32 nB = _nonce();
        _frontRun(usdc, AGENT_KEY, 1e6, nA);
        _frontRun(usdc, BOB_KEY, 9e6, nB);

        vm.prank(owner);
        s.settleStray(address(usdc), merchant, agent, 10e6, nA, 0);
        assertEq(usdc.balanceOf(merchant), 9_800_000);

        vm.expectRevert(abi.encodeWithSelector(PeajeSettlementV3.InsufficientStray.selector, 0, 9e6));
        vm.prank(owner);
        s.settleStray(address(usdc), otro, bob, 9e6, nB, 0);
    }

    /// B3c (documented in contrato-v3.md:107, reproduced for completeness): a nonce already paid
    /// through settle is still routable by settleStray, so one nonce gets two PaymentSettled and
    /// the real stray is left unroutable.
    function test_Contraejemplo_B3c_NonceYaLiquidadoPorSettleSeVuelveARutear() public {
        usdc.mint(agent, 1e6);
        bytes32 n1 = _nonce();
        _settle(usdc, AGENT_KEY, merchant, 1e6, 0, n1);
        bytes32 n2 = _nonce();
        _frontRun(usdc, BOB_KEY, 1e6, n2);

        vm.prank(owner);
        s.settleStray(address(usdc), merchant, agent, 1e6, n1, 0);
        assertEq(usdc.balanceOf(merchant), 2 * 980_000);
        vm.expectRevert(abi.encodeWithSelector(PeajeSettlementV3.InsufficientStray.selector, 0, 1e6));
        vm.prank(owner);
        s.settleStray(address(usdc), otro, bob, 1e6, n2, 0);
    }

    /// Regression for B4. On the audited version the owner could name itself, the guardian or a
    /// relayer as merchant. Now the current owner, guardian, every current relayer and the
    /// current fee recipient are InvalidMerchant in settleStray and in settle.
    function test_Regresion_B4_SettleStrayYSettleRechazanRolesActuales() public {
        bytes32 n = _nonce();
        _frontRun(usdc, AGENT_KEY, 1e6, n);
        address[5] memory roles = [owner, guardian, relayer, relayer2, fr];
        for (uint256 i; i < roles.length; ++i) {
            vm.expectRevert(abi.encodeWithSelector(PeajeSettlementV3.InvalidMerchant.selector, roles[i]));
            vm.prank(owner);
            s.settleStray(address(usdc), roles[i], agent, 1e6, n, 0);

            usdc.mint(agent, 1e6);
            PeajeSettlementV3.Authorization memory a = _auth(usdc, AGENT_KEY, address(s), 1e6, _nonce());
            vm.expectRevert(abi.encodeWithSelector(PeajeSettlementV3.InvalidMerchant.selector, roles[i]));
            vm.prank(relayer);
            s.settle(address(usdc), roles[i], a, 0);
        }
        // A relayer cannot route a payment to itself either.
        usdc.mint(agent, 1e6);
        PeajeSettlementV3.Authorization memory b = _auth(usdc, AGENT_KEY, address(s), 1e6, _nonce());
        vm.expectRevert(abi.encodeWithSelector(PeajeSettlementV3.InvalidMerchant.selector, relayer2));
        vm.prank(relayer2);
        s.settle(address(usdc), relayer2, b, 0);
        assertEq(usdc.balanceOf(address(s)), 1e6);
    }

    /// B4 residual (still true after the fix): the exclusion uses the *current* role holders, so
    /// a pending owner (Ownable2Step), a former fee recipient, a retired guardian or a revoked
    /// relayer can still be named as merchant of a stray. Peaje can always control other
    /// addresses, so this is owner trust, not something the contract can close.
    function test_Contraejemplo_B4b_ExRolesYOwnerPendienteSiguenSiendoMerchantsValidos() public {
        vm.startPrank(owner);
        s.setFeeRecipient(fr2);
        s.setGuardian(guardian2);
        s.setRelayer(relayer2, false);
        s.transferOwnership(owner2); // pending until accepted
        vm.stopPrank();

        address[4] memory exRoles = [owner2, fr, guardian, relayer2];
        for (uint256 i; i < exRoles.length; ++i) {
            bytes32 n = _nonce();
            _frontRun(usdc, AGENT_KEY, 1e6, n);
            vm.prank(owner);
            s.settleStray(address(usdc), exRoles[i], agent, 1e6, n, 0);
            assertEq(usdc.balanceOf(exRoles[i]), 980_000);
        }
    }

    /// Regression for the unbounded cap. The audited version accepted any cap (max uint let a
    /// relayer leave the merchant 1 unit on any payment). Now anything above 0.10 of a token unit
    /// reverts NetworkFeeCapTooHigh. Within the ceiling the documented limit remains: on a
    /// payment at or below the cap the relayer can still push the merchant down to 1 unit.
    function test_Regresion_TopeDeNetworkFeeAcotadoAlTecho() public {
        vm.startPrank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(PeajeSettlementV3.NetworkFeeCapTooHigh.selector, type(uint256).max, 100_000)
        );
        s.setAcceptedToken(address(usdc), true, type(uint256).max);
        vm.expectRevert(abi.encodeWithSelector(PeajeSettlementV3.NetworkFeeCapTooHigh.selector, 100_001, 100_000));
        s.setAcceptedToken(address(usdc), true, 100_001);
        vm.expectRevert(abi.encodeWithSelector(PeajeSettlementV3.NetworkFeeCapTooHigh.selector, 0.1e18 + 1, 0.1e18));
        s.setAcceptedToken(address(wide), true, 0.1e18 + 1);
        s.setAcceptedToken(address(usdc), true, 100_000);
        vm.stopPrank();
        assertEq(s.maxNetworkFee(address(usdc)), 100_000);

        usdc.mint(agent, 1e6);
        uint256 net = _settle(usdc, AGENT_KEY, merchant, 100_001, 100_000, _nonce());
        assertEq(net, 1); // within the ceiling, documented in the new natspec of `_split`
        assertEq(usdc.balanceOf(fr), 100_000);
    }

    /// Regression: a cap of 0 skips the `decimals()` read, so a token whose `decimals()` breaks
    /// can still be delisted; any nonzero cap for it reverts.
    function test_Regresion_DeslistarConTopeCeroNoLeeDecimals() public {
        raro.setDecimalsRevierte(true);
        vm.startPrank(owner);
        vm.expectRevert(bytes("decimals roto"));
        s.setAcceptedToken(address(raro), true, 1);
        s.setAcceptedToken(address(raro), false, 0);
        vm.stopPrank();
        assertFalse(s.isAcceptedToken(address(raro)));
        assertEq(s.maxNetworkFee(address(raro)), 0);
    }

    /// Observation: settleStray has no allowlist check, so it routes any token the owner names,
    /// including one never listed (documented only for delisted tokens).
    function test_Observacion_SettleStrayAceptaUnTokenNuncaListado() public {
        bytes32 n = _nonce();
        _frontRun(noListado, AGENT_KEY, 1e6, n);
        assertFalse(s.isAcceptedToken(address(noListado)));
        vm.prank(owner);
        s.settleStray(address(noListado), merchant, agent, 1e6, n, 0);
        assertEq(noListado.balanceOf(merchant), 980_000);
    }

    // ================================================================================
    // helpers
    // ================================================================================

    function _merchantEspecial(uint8 mk, InvariantesMockTokenRaro tok) internal view returns (address) {
        uint8 k = mk % 7;
        if (k == 0) return merchant;
        if (k == 1) return relayer2; // revoked relayer
        if (k == 2) return agent; // the payer itself
        if (k == 3) return carol;
        if (k == 4) return guardian; // retired guardian
        if (k == 5) return fr; // former fee recipient
        return address(tok);
    }

    function _nonce() internal returns (bytes32) {
        return keccak256(abi.encode("prop", ++nonceCounter));
    }

    function _auth(InvariantesMockTokenRaro tok, uint256 key, address to, uint256 value, bytes32 nonce)
        internal
        view
        returns (PeajeSettlementV3.Authorization memory a)
    {
        a.from = vm.addr(key);
        a.value = value;
        a.validBefore = block.timestamp + 300;
        a.nonce = nonce;
        bytes32 sh = keccak256(
            abi.encode(tok.TRANSFER_WITH_AUTHORIZATION_TYPEHASH(), a.from, to, value, uint256(0), a.validBefore, nonce)
        );
        (a.v, a.r, a.s) = vm.sign(key, keccak256(abi.encodePacked("\x19\x01", tok.DOMAIN_SEPARATOR(), sh)));
    }

    function _settle(InvariantesMockTokenRaro tok, uint256 key, address m, uint256 value, uint256 nf, bytes32 nonce)
        internal
        returns (uint256)
    {
        PeajeSettlementV3.Authorization memory a = _auth(tok, key, address(s), value, nonce);
        vm.prank(relayer);
        return s.settle(address(tok), m, a, nf);
    }

    function _frontRun(InvariantesMockTokenRaro tok, uint256 key, uint256 value, bytes32 nonce) internal {
        address from = vm.addr(key);
        tok.mint(from, value);
        PeajeSettlementV3.Authorization memory a = _auth(tok, key, address(s), value, nonce);
        vm.prank(stranger);
        tok.transferWithAuthorization(from, address(s), value, 0, a.validBefore, nonce, a.v, a.r, a.s);
    }
}
