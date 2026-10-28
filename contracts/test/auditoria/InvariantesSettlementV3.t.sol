// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {Vm} from "forge-std/Vm.sol";
import {console2} from "forge-std/console2.sol";
import {PeajeSettlementV3} from "../../src/PeajeSettlementV3.sol";
import {
    InvariantesMockTokenRaro,
    InvariantesMockMerchantHook,
    InvariantesMockReenviador
} from "./InvariantesMockTokens.sol";

/// @dev Audit handler for PeajeSettlementV3. Every money call goes through an oracle that mirrors
///      the contract's own preconditions and the token's quirks, then the call is checked against
///      exact expected balance deltas for every address that can ever hold the tokens. A shadow
///      ledger (`modelo`) is updated only with *expected* amounts, so any drift over a sequence
///      shows up in `libroCuadra`. Violations are counted (fail_on_revert is false in the repo);
///      the invariants assert the counters stay at zero.
///
///      Tokens: tk[0] 6 decimals, tk[1] 18 decimals, tk[2] 6 decimals with switchable quirks,
///      tk[3] never listed (settle must reject it; settleStray accepts any token by design).
///
///      "B" counters measure properties the contract does not promise on-chain (or the doc
///      overstates); the test contract asserts them only with AUDITORIA_ESTRICTO=true.
contract InvariantesHandlerV3 is Test {
    PeajeSettlementV3 public s;
    InvariantesMockTokenRaro[4] public tk;
    InvariantesMockMerchantHook public hook;
    InvariantesMockReenviador public reenviador; // allowed relayer the hook re-enters through

    uint256 internal constant FEE_BPS = 200;
    uint256 internal constant BPS = 10_000;

    uint256[4] internal capInicial = [uint256(20_000), 0.02e18, 10_000, 0];
    uint256[4] internal payerKeys = [uint256(0xA11CE), 0xB0B, 0xCA401, 0x2E1A7E2];
    address[4] public payers; // payers[3] is also the main relayer
    address public relayer;
    address public relayer2;
    address public guardian;
    address public guardian2;
    address[2] public owners;
    address public stranger;
    address[3] public merchants;
    address[] public frPool;
    address[] public tracked;
    mapping(address => uint256) internal idx1;
    mapping(address => bool) public esPeaje;
    address[4] public bloqueado;

    // ---- shadow ledger ----
    mapping(uint256 => mapping(address => uint256)) public modelo;
    uint256[4] public supplyModelo;
    uint256[4] public ghostIn; // front-runs + donations credited to the contract
    uint256[4] public ghostOut; // value routed by settleStray
    uint256[4] public ghostResiduo; // units a positive-rebase token left behind in settleStray

    struct Stray {
        uint8 t;
        uint8 payer;
        bytes32 nonce;
        uint256 value;
        bool routed;
    }

    Stray[] public strays;
    mapping(bytes32 => uint256) internal strayPorClave; // index + 1

    struct Usado {
        uint8 t;
        uint8 payer;
        bytes32 nonce;
        uint256 value;
        bool ajeno; // spent on a transfer that never touched the settlement
    }

    Usado[] public usados;
    uint256 internal nonceCounter;

    // ---- A: properties the contract must hold (asserted always) ----
    uint256 public vSeguridad; // a call succeeded that the oracle says must fail
    uint256 public vLiveness; // a valid call failed
    uint256 public vConservacion; // per-call balance deltas, supply or return value off
    uint256 public vSaldoContrato; // settle did not leave the contract balance as it found it
    uint256 public vFeeTope; // fee != floor(2% price) or fee recipient got more than 2% price + nf
    uint256 public vCap; // networkFee above the cap on a success
    uint256 public vMerchantInvalido; // success with merchant 0, the contract or the fee recipient
    uint256 public vStrayExceso; // settleStray moved more than `value` or than the balance
    uint256 public vPausa; // settle succeeded while paused
    uint256 public vAtomicidad; // a failed call changed a balance, the supply or a nonce
    uint256 public vEventos; // PaymentSettled / StraySettled missing or wrong
    uint256 public vAcceso; // someone without the role succeeded
    uint256 public vReentrada; // a re-entrant call succeeded
    string public primeraViolacion;

    // ---- B: stronger properties the contract does not enforce (see test contract) ----
    uint256 public cMerchantCorto; // settle: merchant got less than `net` (selective fee token)
    uint256 public cMerchantCortoStray; // settleStray: merchant got less than `net`
    uint256 public cResiduoStray; // settleStray left units behind (no balance post-check)
    uint256 public cStrayNoReal; // settleStray moved a value that is not the unrouted stray of (from, nonce)
    uint256 public cStrayAPeaje; // settleStray paid the 98% to a Peaje-controlled address

    // ---- coverage ----
    uint256[41] public cov;
    uint256 internal constant C_SETTLE_OK = 0;
    uint256 internal constant C_SETTLE_FAIL = 1;
    uint256 internal constant C_STRAY_OK = 2;
    uint256 internal constant C_STRAY_FAIL = 3;
    uint256 internal constant C_NF_TOPE = 4;
    uint256 internal constant C_VALOR_MIN = 5;
    uint256 internal constant C_M_RELAYER = 6;
    uint256 internal constant C_M_PAYER = 7;
    uint256 internal constant C_M_OWNER = 8;
    uint256 internal constant C_M_GUARDIAN = 9;
    uint256 internal constant C_M_EXFR = 10;
    uint256 internal constant C_M_TOKEN = 11;
    uint256 internal constant C_M_HOOK = 12;
    uint256 internal constant C_M_INVALIDO_INTENTO = 13;
    uint256 internal constant C_PAUSA_INTENTO = 14;
    uint256 internal constant C_NF_SOBRE_TOPE_INTENTO = 15;
    uint256 internal constant C_REPLAY_INTENTO = 16;
    uint256 internal constant C_FOT_SALIDA_OK = 17;
    uint256 internal constant C_PEGAJOSO_RECHAZO = 18;
    uint256 internal constant C_FOT_TODO_RECHAZO = 19;
    uint256 internal constant C_RETFALSE_RECHAZO = 20;
    uint256 internal constant C_SINRET_OK = 21;
    uint256 internal constant C_REENTRADA_INTENTO = 22;
    uint256 internal constant C_HOOK_DONA_RECHAZO = 23;
    uint256 internal constant C_BLOQUEO_RECHAZO = 24;
    uint256 internal constant C_STRAY_AJENO_OK = 25;
    uint256 internal constant C_STRAY_INFLADO_OK = 26;
    uint256 internal constant C_STRAY_PAUSA_OK = 27;
    uint256 internal constant C_STRAY_NO_LISTADO_OK = 28;
    uint256 internal constant C_STRAY_RESIDUO = 29;
    uint256 internal constant C_FRONTRUN = 30;
    uint256 internal constant C_DONACION = 31;
    uint256 internal constant C_CAP_CAMBIO = 32;
    uint256 internal constant C_FR_ROTA = 33;
    uint256 internal constant C_OWNER_ROTA = 34;
    uint256 internal constant C_SETTLE_CON_STRAY = 35;
    uint256 internal constant C_PAYER_ES_FR = 36;
    uint256 internal constant C_STRAY_APEAJE = 37;
    uint256 internal constant C_SETTLE_NO_LISTADO_INTENTO = 38;
    uint256 internal constant C_ACCESO_INTENTO = 39;
    uint256 internal constant C_TECHO_RECHAZO = 40;

    struct Llamada {
        uint8 t;
        uint8 payerIdx;
        uint8 authKind; // 0-9 valid, 10 expired, 11 wrong signer, 12 signed other value, 13 replay, 14 from = contract, 15 no mint
        address caller;
        address payer;
        address merchant;
        address fr;
        uint256 value;
        uint256 nf;
        uint256 cap;
        uint256 netE;
        uint256 feeE;
        bool okContrato;
        bool okToken;
        bool pausado;
        bool hookArmado;
        bool hookDona;
    }

    struct LlamadaStray {
        uint8 t;
        address caller;
        address merchant;
        address from;
        address fr;
        uint256 value;
        uint256 nf;
        uint256 cap;
        uint256 saldo;
        uint256 netE;
        uint256 feeE;
        bytes32 nonce;
        uint256 strayIdx1;
        bool okContrato;
        bool okToken;
        bool pausado;
        bool hookArmado;
        bool hookDona;
    }

    constructor() {
        for (uint256 i; i < 4; ++i) {
            payers[i] = vm.addr(payerKeys[i]);
        }
        relayer = payers[3];
        relayer2 = makeAddr("aud.relayer2");
        guardian = makeAddr("aud.guardian");
        guardian2 = makeAddr("aud.guardian2");
        owners[0] = makeAddr("aud.safeA");
        owners[1] = makeAddr("aud.safeB");
        stranger = makeAddr("aud.stranger");
        merchants[0] = makeAddr("aud.merchantA");
        merchants[1] = makeAddr("aud.merchantB");
        merchants[2] = makeAddr("aud.merchantC");

        tk[0] = new InvariantesMockTokenRaro("USD Coin", "2", 6);
        tk[1] = new InvariantesMockTokenRaro("Wide Dollar", "1", 18);
        tk[2] = new InvariantesMockTokenRaro("Raro", "1", 6);
        tk[3] = new InvariantesMockTokenRaro("No listado", "1", 6);

        address[4] memory fr;
        fr[0] = makeAddr("aud.fr0");
        fr[1] = makeAddr("aud.fr1");
        fr[2] = makeAddr("aud.fr2");
        fr[3] = makeAddr("aud.fr3");

        address[] memory rel = new address[](1);
        rel[0] = relayer;
        address[] memory tokens = new address[](3);
        uint256[] memory caps = new uint256[](3);
        for (uint256 i; i < 3; ++i) {
            tokens[i] = address(tk[i]);
            caps[i] = capInicial[i];
        }
        s = new PeajeSettlementV3(owners[0], guardian, fr[0], rel, tokens, caps);
        hook = new InvariantesMockMerchantHook(address(s));
        reenviador = new InvariantesMockReenviador();
        // Worst case for re-entrancy: the malicious merchant re-enters through an allowed relayer
        // (relayers themselves can no longer be merchants), so only the guard can stop it.
        vm.prank(owners[0]);
        s.setRelayer(address(reenviador), true);
        tk[2].setOrigenFee(address(s));
        tk[2].setPegajoso(address(s));
        tk[2].setReceptorHook(address(hook));

        for (uint256 i; i < 4; ++i) {
            frPool.push(fr[i]);
            esPeaje[fr[i]] = true;
        }
        frPool.push(merchants[0]); // a merchant can become the fee recipient
        frPool.push(payers[2]); // and so can a payer
        esPeaje[owners[0]] = true;
        esPeaje[owners[1]] = true;
        esPeaje[relayer] = true;
        esPeaje[relayer2] = true;
        esPeaje[guardian] = true;
        esPeaje[guardian2] = true;

        for (uint256 i; i < 4; ++i) {
            _trackear(payers[i]);
            _trackear(fr[i]);
            _trackear(address(tk[i]));
        }
        for (uint256 i; i < 3; ++i) {
            _trackear(merchants[i]);
        }
        _trackear(relayer2);
        _trackear(guardian);
        _trackear(guardian2);
        _trackear(owners[0]);
        _trackear(owners[1]);
        _trackear(stranger);
        _trackear(address(hook));
        _trackear(address(reenviador));
        _trackear(address(s));
        _trackear(address(this));
        _trackear(address(0));
    }

    // =====================================================================================
    // settle
    // =====================================================================================

    /// Fully random settle: any token (listed or not), payer, merchant (valid, special or
    /// invalid), caller, networkFee around the cap, value around networkFee, broken auths.
    function settle(
        uint256 sT,
        uint256 sPayer,
        uint256 sMerchant,
        uint256 sCaller,
        uint256 sNf,
        uint256 sValue,
        uint256 sAuth
    ) external {
        Llamada memory c;
        c.t = uint8(sT % 4);
        c.payerIdx = uint8(sPayer % 4);
        c.payer = payers[c.payerIdx];
        c.merchant = _merchant(sMerchant, c.t, c.payer);
        c.caller = _caller(sCaller);
        c.cap = s.maxNetworkFee(address(tk[c.t]));
        uint256 unit = 10 ** tk[c.t].decimals();
        c.nf = _elegirNf(sNf, c.cap, unit);
        c.value = _elegirValor(sValue, c.nf, unit);
        c.authKind = uint8(sAuth % 16);
        c.hookDona = (sAuth >> 8) % 2 == 0;
        _settle(c);
    }

    /// Biased towards a valid payment so liveness and exact-split checks get many successes.
    function settleValido(uint256 sT, uint256 sPayer, uint256 sMerchant, uint256 sNf, uint256 sValue) external {
        Llamada memory c;
        c.t = uint8(sT % 3);
        c.payerIdx = uint8(sPayer % 3);
        c.payer = payers[c.payerIdx];
        c.merchant = merchants[sMerchant % 3];
        c.caller = s.isRelayer(relayer) ? relayer : (s.isRelayer(relayer2) ? relayer2 : address(reenviador));
        c.cap = s.maxNetworkFee(address(tk[c.t]));
        uint256 unit = 10 ** tk[c.t].decimals();
        uint256 lim = c.cap > 1e9 * unit ? 1e9 * unit : c.cap;
        c.nf = sNf % 4 == 0 ? lim : _bound(sNf >> 2, 0, lim);
        c.value = sValue % 5 == 0 ? c.nf + 1 : _bound(sValue >> 3, c.nf + 1, c.nf + 1e6 * unit);
        _settle(c);
    }

    /// Valid in every way except that the merchant is a special address: the relayer, the payer,
    /// the owner, the guardian, a fee recipient (current one is invalid), the token, the hook.
    function settleMerchantEspecial(uint256 sT, uint256 sPayer, uint256 sMerchant, uint256 sNf, uint256 sValue)
        external
    {
        Llamada memory c;
        c.t = uint8(sT % 3);
        c.payerIdx = uint8(sPayer % 4);
        c.payer = payers[c.payerIdx];
        uint256 k = sMerchant % 10;
        if (k == 0) c.merchant = (sMerchant >> 8) % 2 == 0 ? relayer : relayer2; // invalid while a relayer
        else if (k == 1) c.merchant = c.payer;
        else if (k == 2) c.merchant = (sMerchant >> 8) % 2 == 0 ? owners[0] : owners[1]; // one is the owner
        else if (k == 3) c.merchant = (sMerchant >> 8) % 2 == 0 ? guardian : guardian2; // one is the guardian
        else if (k == 4) c.merchant = frPool[(sMerchant >> 8) % frPool.length];
        else if (k == 5) c.merchant = address(tk[c.t]);
        else if (k == 6) c.merchant = relayer2;
        else c.merchant = address(hook);
        if (c.merchant == address(hook)) {
            c.t = 2;
            if ((sValue >> 5) % 2 == 0) tk[2].setModo(InvariantesMockTokenRaro.Modo.HOOK);
        }
        c.caller = s.isRelayer(relayer) ? relayer : address(reenviador);
        if ((sMerchant >> 16) % 3 == 0) c.caller = address(reenviador);
        c.cap = s.maxNetworkFee(address(tk[c.t]));
        uint256 unit = 10 ** tk[c.t].decimals();
        uint256 lim = c.cap > 1e9 * unit ? 1e9 * unit : c.cap;
        c.nf = sNf % 3 == 0 ? lim : _bound(sNf >> 2, 0, lim);
        c.value = sValue % 4 == 0 ? c.nf + 1 : _bound(sValue >> 3, c.nf + 1, c.nf + 1e4 * unit);
        c.hookDona = (sValue >> 2) % 3 == 0;
        _settle(c);
    }

    function _settle(Llamada memory c) internal {
        InvariantesMockTokenRaro tok = tk[c.t];
        if (c.authKind != 13 && c.authKind != 15) _mint(c.t, c.payer, c.value);
        PeajeSettlementV3.Authorization memory a = _autorizacion(c);
        c.fr = s.feeRecipient();
        c.pausado = s.paused();
        c.okContrato = s.isRelayer(c.caller) && !c.pausado && s.isAcceptedToken(address(tok)) && _merchantOk(c.merchant, c.fr)
            && c.nf <= c.cap && c.value > c.nf;
        if (c.value > c.nf) {
            c.feeE = ((c.value - c.nf) * FEE_BPS) / BPS;
            c.netE = c.value - c.nf - c.feeE;
        }
        _armarHook(c.t, c.merchant, c.hookDona, false);
        c.hookArmado = _hookActivo(c.t, c.merchant);
        c.okToken = _okTokenSettle(c, a);

        uint256[] memory antes = _snap(c.t);
        uint256 supplyAntes = tok.totalSupply();
        bool usadoAntes = a.from == address(0) ? false : tok.authorizationState(a.from, a.nonce);
        vm.recordLogs();
        vm.prank(c.caller);
        try s.settle(address(tok), c.merchant, a, c.nf) returns (uint256 net) {
            _settleExito(c, a, net, antes, supplyAntes, vm.getRecordedLogs());
        } catch (bytes memory err) {
            vm.getRecordedLogs();
            ++cov[C_SETTLE_FAIL];
            _fallo(c.t, antes, supplyAntes, a.from, a.nonce, usadoAntes);
            if (c.okContrato && c.okToken) {
                ++vLiveness;
                _anotar("liveness settle", err);
            } else {
                _covRechazo(c);
            }
        }
    }

    function _autorizacion(Llamada memory c) internal returns (PeajeSettlementV3.Authorization memory a) {
        a.from = c.payer;
        a.value = c.value;
        a.validBefore = block.timestamp + 300;
        a.nonce = _nonce();
        uint256 key = payerKeys[c.payerIdx];
        uint256 signedValue = c.value;
        if (c.authKind == 10) {
            a.validBefore = block.timestamp;
        } else if (c.authKind == 11) {
            key = payerKeys[(c.payerIdx + 1) % 4];
        } else if (c.authKind == 12) {
            signedValue = c.value + 1;
        } else if (c.authKind == 13) {
            (bool hay, Usado memory u) = _usadoDe(c.t, c.value);
            if (hay) {
                c.payerIdx = u.payer;
                c.payer = payers[u.payer];
                a.from = c.payer;
                a.nonce = u.nonce;
                key = payerKeys[u.payer];
                ++cov[C_REPLAY_INTENTO];
            } else {
                c.authKind = 15;
            }
        } else if (c.authKind == 14) {
            a.from = address(s);
        }
        (a.v, a.r, a.s) = _firmar(c.t, key, a.from, address(s), signedValue, a.validBefore, a.nonce);
    }

    function _okTokenSettle(Llamada memory c, PeajeSettlementV3.Authorization memory a)
        internal
        view
        returns (bool)
    {
        InvariantesMockTokenRaro tok = tk[c.t];
        if (c.authKind >= 10 && c.authKind != 15) return false;
        if (tok.authorizationState(a.from, a.nonce)) return false;
        if (tok.balanceOf(c.payer) < c.value) return false;
        if (tok.falla(c.payer, address(s))) return false;
        if (tok.quema(c.payer, address(s), c.value) != 0) return false; // short delivery
        if (c.value <= c.nf) return true; // rejected by the contract anyway
        if (tok.falla(address(s), c.merchant)) return false;
        if (tok.modo() == InvariantesMockTokenRaro.Modo.RETORNA_FALSE) return false;
        if (c.feeE + c.nf != 0 && tok.falla(address(s), c.fr)) return false;
        if (tok.residuo(address(s), c.merchant) != 0) return false; // BalanceNotRestored
        if (c.hookArmado && c.hookDona) return false; // merchant sends 1 back: BalanceNotRestored
        return true;
    }

    function _settleExito(
        Llamada memory c,
        PeajeSettlementV3.Authorization memory a,
        uint256 net,
        uint256[] memory antes,
        uint256 supplyAntes,
        Vm.Log[] memory logs
    ) internal {
        ++cov[C_SETTLE_OK];
        if (!(c.okContrato && c.okToken)) {
            ++vSeguridad;
            _anotar("settle paso sin deber", abi.encode(c.t, c.merchant, c.caller, c.value, c.nf, c.authKind));
        }
        if (!s.isRelayer(c.caller)) ++vAcceso;
        if (c.pausado) ++vPausa;
        if (!_merchantOk(c.merchant, c.fr)) ++vMerchantInvalido;
        if (c.nf > c.cap) ++vCap;
        if (net != c.netE) {
            ++vConservacion;
            _anotar("settle net", abi.encode(net, c.netE));
        }
        (int256[] memory exp, uint256 qM, uint256 qF) = _settleDeltas(c, antes, supplyAntes);
        _chequearEventos(c.t, c.merchant, a.from, c.value, net, c.nf, a.nonce, logs, false);
        if (hook.exito()) ++vReentrada;

        _aplicar(c.t, exp);
        supplyModelo[c.t] -= qM + qF;
        usados.push(Usado(c.t, c.payerIdx, a.nonce, c.value, false));
        _covExito(c, antes, qM);
    }

    function _settleDeltas(Llamada memory c, uint256[] memory antes, uint256 supplyAntes)
        internal
        returns (int256[] memory exp, uint256 qM, uint256 qF)
    {
        InvariantesMockTokenRaro tok = tk[c.t];
        uint256 fnf = c.feeE + c.nf;
        exp = new int256[](tracked.length);
        _sumar(exp, c.payer, -int256(c.value));
        qM = tok.quema(address(s), c.merchant, c.netE);
        _sumar(exp, c.merchant, int256(c.netE - qM));
        if (fnf != 0) {
            qF = tok.quema(address(s), c.fr, fnf);
            _sumar(exp, c.fr, int256(fnf - qF));
        }
        // contract: + value - net - (fee + nf) == 0, so no entry for it
        if (!_cuadra(c.t, antes, exp)) {
            ++vConservacion;
            _anotar("settle deltas", abi.encode(c.t, c.payer, c.merchant, c.fr, c.value, c.nf));
        }
        if (tok.totalSupply() + qM + qF != supplyAntes) ++vConservacion;
        if (tok.balanceOf(address(s)) != antes[idx1[address(s)] - 1]) ++vSaldoContrato;
        // Fee recipient credit bound, independent of the event (only when it is not also the payer).
        if (c.fr != c.payer && tok.balanceOf(c.fr) - antes[idx1[c.fr] - 1] > ((c.value - c.nf) * FEE_BPS) / BPS + c.nf)
        {
            ++vFeeTope;
        }
        if (qM != 0) ++cMerchantCorto;
    }

    // =====================================================================================
    // front-runs, donations, unrelated spent nonces (environment, outside the contract)
    // =====================================================================================

    function frontRun(uint256 sT, uint256 sPayer, uint256 sValue) external {
        uint8 t = uint8(sT % 4);
        uint8 p = uint8(sPayer % 4);
        uint256 unit = 10 ** tk[t].decimals();
        uint256 value = sValue % 7 == 0 ? 1 : _bound(sValue >> 3, 1, 1e6 * unit);
        _mint(t, payers[p], value);
        bytes32 nonce = _nonce();
        if (_ejecutarDirecto(t, p, address(s), value, nonce)) {
            strays.push(Stray(t, p, nonce, value, false));
            strayPorClave[_clave(t, payers[p], nonce)] = strays.length;
            ++cov[C_FRONTRUN];
        }
    }

    function gastarNonceAjeno(uint256 sT, uint256 sPayer, uint256 sValue) external {
        uint8 t = uint8(sT % 4);
        uint8 p = uint8(sPayer % 4);
        uint256 unit = 10 ** tk[t].decimals();
        uint256 value = _bound(sValue, 1, 1e3 * unit);
        _mint(t, payers[p], value);
        bytes32 nonce = _nonce();
        if (_ejecutarDirecto(t, p, stranger, value, nonce)) usados.push(Usado(t, p, nonce, value, true));
    }

    function donar(uint256 sT, uint256 sValue) external {
        uint8 t = uint8(sT % 4);
        uint256 unit = 10 ** tk[t].decimals();
        uint256 value = _bound(sValue, 1, 1e6 * unit);
        if (_mint(t, address(s), value)) {
            ghostIn[t] += value;
            ++cov[C_DONACION];
        }
    }

    function _ejecutarDirecto(uint8 t, uint8 p, address to, uint256 value, bytes32 nonce) internal returns (bool) {
        InvariantesMockTokenRaro tok = tk[t];
        uint256 vb = block.timestamp + 300;
        (uint8 v, bytes32 r, bytes32 ss) = _firmar(t, payerKeys[p], payers[p], to, value, vb, nonce);
        uint256 q = tok.quema(payers[p], to, value);
        vm.prank(stranger);
        try tok.transferWithAuthorization(payers[p], to, value, 0, vb, nonce, v, r, ss) {
            modelo[t][payers[p]] -= value;
            modelo[t][to] += value - q;
            supplyModelo[t] -= q;
            if (to == address(s)) ghostIn[t] += value - q;
            return true;
        } catch {
            return false;
        }
    }

    // =====================================================================================
    // settleStray
    // =====================================================================================

    /// The owner routes a recorded front-run with its true payer, nonce and value.
    function settleStrayHonesto(uint256 sIdx, uint256 sMerchant, uint256 sNf) external {
        (bool hay, uint256 i) = _strayPendiente(sIdx);
        if (!hay) return;
        Stray memory st = strays[i];
        LlamadaStray memory c;
        c.t = st.t;
        c.caller = s.owner();
        c.from = payers[st.payer];
        c.value = st.value;
        c.nonce = st.nonce;
        c.merchant = sMerchant % 4 == 0 ? _merchant(sMerchant >> 2, st.t, c.from) : merchants[(sMerchant >> 2) % 3];
        uint256 cap = s.maxNetworkFee(address(tk[st.t]));
        uint256 tope = cap < st.value - 1 ? cap : st.value - 1;
        c.nf = sNf % 4 == 0 ? tope : _bound(sNf >> 2, 0, tope);
        c.hookDona = (sNf >> 1) % 2 == 0;
        _stray(c);
    }

    /// The owner routes a pending tk[2] stray to the malicious hook merchant with the token in
    /// HOOK mode: the hook tries to re-enter `settle` while settleStray holds the guard.
    function settleStrayAlHook(uint256 sValue, uint256 sNf) external {
        uint256 n = strays.length;
        uint256 i = type(uint256).max;
        for (uint256 j; j < n && j < 128; ++j) {
            uint256 k = n - 1 - j;
            if (!strays[k].routed && strays[k].t == 2) {
                i = k;
                break;
            }
        }
        if (i == type(uint256).max) {
            uint256 value = _bound(sValue, 1, 1e6 * 1e6);
            _mint(2, payers[1], value);
            bytes32 nonce = _nonce();
            if (!_ejecutarDirecto(2, 1, address(s), value, nonce)) return;
            strays.push(Stray(2, 1, nonce, value, false));
            strayPorClave[_clave(2, payers[1], nonce)] = strays.length;
            i = strays.length - 1;
        }
        tk[2].setModo(InvariantesMockTokenRaro.Modo.HOOK);
        LlamadaStray memory c;
        _desdeStray(c, i);
        c.caller = s.owner();
        c.merchant = address(hook);
        uint256 cap = s.maxNetworkFee(address(tk[2]));
        uint256 tope = cap < c.value - 1 ? cap : c.value - 1;
        c.nf = _bound(sNf, 0, tope);
        c.hookDona = (sNf >> 1) % 3 == 0;
        _stray(c);
    }

    /// Sloppy or hostile inputs to settleStray: replays, unused or unrelated nonces, inflated,
    /// deflated or uncovered values, wrong payer, callers without the role, any merchant.
    function settleStrayAdversario(uint256 sKind, uint256 sA, uint256 sMerchant, uint256 sNf, uint256 sCaller)
        external
    {
        LlamadaStray memory c;
        uint256 k = sKind % 9;
        c.caller = s.owner();
        bool hay;
        uint256 i;
        if (k == 0) {
            (hay, i) = _strayRuteado(sA);
            if (!hay) return;
            _desdeStray(c, i);
        } else if (k == 1) {
            c.t = uint8(sA % 4);
            c.from = payers[(sA >> 2) % 4];
            c.nonce = _nonce();
            c.value = _bound(sA >> 8, 1, 1e6 * 10 ** tk[c.t].decimals());
        } else if (k == 2) {
            if (usados.length == 0) return;
            Usado memory u = usados[sA % usados.length];
            c.t = u.t;
            c.from = payers[u.payer];
            c.nonce = u.nonce;
            uint256 saldo = tk[u.t].balanceOf(address(s));
            c.value = (sA >> 8) % 2 == 0 ? (u.value < saldo ? u.value : saldo) : _bound(sA >> 16, 1, saldo + 1);
        } else if (k == 4) {
            (hay, i) = _strayPendiente(sA);
            if (!hay) return;
            _desdeStray(c, i);
            c.value = tk[c.t].balanceOf(address(s)) + 1 + ((sA >> 8) % 1000);
        } else {
            (hay, i) = _strayPendiente(sA);
            if (!hay) return;
            _desdeStray(c, i);
            if (k == 3) {
                c.value += 1 + _bound(sA >> 8, 0, tk[c.t].balanceOf(address(s)));
            } else if (k == 5) {
                c.from = payers[(strays[i].payer + 1 + (sA >> 8) % 3) % 4];
            } else if (k == 6) {
                c.caller = _sinRol(sCaller);
            } else if (k == 7) {
                c.value = _bound(sA >> 8, 1, c.value);
            }
        }
        c.merchant = _merchant(sMerchant, c.t, c.from);
        uint256 cap = s.maxNetworkFee(address(tk[c.t]));
        if (k == 8) {
            c.nf = _elegirNf(sNf, cap, 10 ** tk[c.t].decimals());
        } else {
            uint256 tope = c.value == 0 ? 0 : (cap < c.value - 1 ? cap : c.value - 1);
            c.nf = _bound(sNf, 0, tope);
        }
        c.hookDona = (sNf >> 1) % 2 == 0;
        _stray(c);
    }

    function _desdeStray(LlamadaStray memory c, uint256 i) internal view {
        Stray memory st = strays[i];
        c.t = st.t;
        c.from = payers[st.payer];
        c.nonce = st.nonce;
        c.value = st.value;
    }

    function _stray(LlamadaStray memory c) internal {
        InvariantesMockTokenRaro tok = tk[c.t];
        c.fr = s.feeRecipient();
        c.cap = s.maxNetworkFee(address(tok));
        c.saldo = tok.balanceOf(address(s));
        c.pausado = s.paused();
        c.strayIdx1 = strayPorClave[_clave(c.t, c.from, c.nonce)];
        c.okContrato = c.caller == s.owner() && tok.authorizationState(c.from, c.nonce)
            && !s.straySettled(address(tok), c.from, c.nonce) && _merchantOk(c.merchant, c.fr) && c.nf <= c.cap
            && c.value > c.nf && c.saldo >= c.value;
        if (c.value > c.nf) {
            c.feeE = ((c.value - c.nf) * FEE_BPS) / BPS;
            c.netE = c.value - c.nf - c.feeE;
        }
        _armarHook(c.t, c.merchant, c.hookDona, true);
        c.hookArmado = _hookActivo(c.t, c.merchant);
        // settleStray now checks the final balance too: rebase residue or a hook donation reverts.
        c.okToken = !tok.falla(address(s), c.merchant) && tok.modo() != InvariantesMockTokenRaro.Modo.RETORNA_FALSE
            && (c.feeE + c.nf == 0 || !tok.falla(address(s), c.fr)) && tok.residuo(address(s), c.merchant) == 0
            && (c.feeE + c.nf == 0 || tok.residuo(address(s), c.fr) == 0) && !(c.hookArmado && c.hookDona);

        uint256[] memory antes = _snap(c.t);
        uint256 supplyAntes = tok.totalSupply();
        bool marcadoAntes = s.straySettled(address(tok), c.from, c.nonce);
        vm.recordLogs();
        vm.prank(c.caller);
        try s.settleStray(address(tok), c.merchant, c.from, c.value, c.nonce, c.nf) returns (uint256 net) {
            _strayExito(c, net, antes, supplyAntes, vm.getRecordedLogs());
        } catch (bytes memory err) {
            vm.getRecordedLogs();
            ++cov[C_STRAY_FAIL];
            _fallo(c.t, antes, supplyAntes, address(0), bytes32(0), true);
            if (s.straySettled(address(tok), c.from, c.nonce) != marcadoAntes) ++vAtomicidad;
            if (c.okContrato && c.okToken) {
                ++vLiveness;
                _anotar("liveness settleStray", err);
            }
        }
    }

    function _strayExito(
        LlamadaStray memory c,
        uint256 net,
        uint256[] memory antes,
        uint256 supplyAntes,
        Vm.Log[] memory logs
    ) internal {
        ++cov[C_STRAY_OK];
        if (!(c.okContrato && c.okToken)) {
            ++vSeguridad;
            _anotar("settleStray paso sin deber", abi.encode(c.t, c.merchant, c.caller, c.value, c.nf, c.saldo));
        }
        if (c.caller != s.owner()) ++vAcceso;
        if (!_merchantOk(c.merchant, c.fr)) ++vMerchantInvalido;
        if (c.nf > c.cap) ++vCap;
        if (net != c.netE) ++vConservacion;
        if (c.value > c.saldo) ++vStrayExceso;

        Raro memory q;
        int256[] memory exp = _strayDeltas(c, antes, supplyAntes, q);
        _chequearEventos(c.t, c.merchant, c.from, c.value, net, c.nf, c.nonce, logs, true);
        if (hook.exito()) ++vReentrada;
        _strayContadoresB(c, q);
        _aplicar(c.t, exp);
        supplyModelo[c.t] = supplyModelo[c.t] + q.rM + q.rF - q.qM - q.qF;
        ghostOut[c.t] += c.value;
        ghostResiduo[c.t] += q.rM + q.rF;
        ghostIn[c.t] += q.d;
        if (c.strayIdx1 != 0) strays[c.strayIdx1 - 1].routed = true;
    }

    /// What a quirky token did to a settleStray payout: burns, rebase residue, hook donation.
    struct Raro {
        uint256 qM;
        uint256 qF;
        uint256 rM;
        uint256 rF;
        uint256 d;
    }

    function _strayDeltas(LlamadaStray memory c, uint256[] memory antes, uint256 supplyAntes, Raro memory q)
        internal
        returns (int256[] memory exp)
    {
        InvariantesMockTokenRaro tok = tk[c.t];
        uint256 fnf = c.feeE + c.nf;
        exp = new int256[](tracked.length);
        q.qM = tok.quema(address(s), c.merchant, c.netE);
        q.rM = tok.residuo(address(s), c.merchant);
        _sumar(exp, address(s), int256(q.rM) - int256(c.netE));
        _sumar(exp, c.merchant, int256(c.netE - q.qM));
        if (fnf != 0) {
            q.qF = tok.quema(address(s), c.fr, fnf);
            q.rF = tok.residuo(address(s), c.fr);
            _sumar(exp, address(s), int256(q.rF) - int256(fnf));
            _sumar(exp, c.fr, int256(fnf - q.qF));
        }
        q.d = c.hookArmado ? hook.donado() : 0;
        if (q.d != 0) {
            _sumar(exp, c.merchant, -int256(q.d));
            _sumar(exp, address(s), int256(q.d));
        }
        if (!_cuadra(c.t, antes, exp)) {
            ++vConservacion;
            _anotar("settleStray deltas", abi.encode(c.t, c.merchant, c.fr, c.value, c.nf));
        }
        if (tok.totalSupply() + q.qM + q.qF != supplyAntes + q.rM + q.rF) ++vConservacion;
        if (tok.balanceOf(address(s)) + c.value < c.saldo) ++vStrayExceso; // moved more than `value`
        if (!s.straySettled(address(tok), c.from, c.nonce)) ++vConservacion;
    }

    function _strayContadoresB(LlamadaStray memory c, Raro memory q) internal {
        if (q.rM + q.rF != 0) {
            ++cResiduoStray;
            ++cov[C_STRAY_RESIDUO];
        }
        if (q.qM != 0) ++cMerchantCortoStray;
        bool real = c.strayIdx1 != 0 && !strays[c.strayIdx1 - 1].routed && strays[c.strayIdx1 - 1].value == c.value;
        if (!real) {
            ++cStrayNoReal;
            if (c.strayIdx1 == 0) ++cov[C_STRAY_AJENO_OK];
            else if (c.value > strays[c.strayIdx1 - 1].value) ++cov[C_STRAY_INFLADO_OK];
        }
        if (esPeaje[c.merchant]) {
            ++cStrayAPeaje;
            ++cov[C_STRAY_APEAJE];
        }
        if (c.pausado) ++cov[C_STRAY_PAUSA_OK];
        if (!s.isAcceptedToken(address(tk[c.t]))) ++cov[C_STRAY_NO_LISTADO_OK];
    }

    // =====================================================================================
    // admin, roles and token environment
    // =====================================================================================

    function togglePause(uint256 sSel) external {
        bool p = s.paused();
        address malo = _sinRol(sSel);
        vm.prank(malo);
        try s.pause() {
            ++vAcceso;
            _anotar("pause sin rol", abi.encode(malo));
        } catch {}
        if (p) {
            address g = s.guardian();
            vm.prank(g);
            try s.unpause() {
                ++vAcceso;
                _anotar("guardian despauso", "");
            } catch {}
            address o = s.owner();
            vm.prank(o);
            try s.unpause() {}
            catch (bytes memory err) {
                ++vLiveness;
                _anotar("unpause owner", err);
            }
        } else {
            if ((sSel >> 16) % 6 != 0) return; // pause rarely, unpause always: ~15% of the time paused
            address quien = (sSel >> 8) % 2 == 0 ? s.guardian() : s.owner();
            vm.prank(quien);
            try s.pause() {}
            catch (bytes memory err) {
                ++vLiveness;
                _anotar("pause", err);
            }
        }
    }

    function rotateFeeRecipient(uint256 sSel, uint256 sCaller) external {
        uint256 k = sSel % 9;
        address next;
        if (k < 6) next = frPool[k];
        else if (k == 6) next = address(0);
        else if (k == 7) next = address(s);
        else next = frPool[(sSel >> 8) % frPool.length];
        address caller = sCaller % 5 == 0 ? _sinRol(sCaller >> 3) : s.owner();
        bool debe = caller == s.owner() && next != address(0) && next != address(s);
        vm.prank(caller);
        try s.setFeeRecipient(next) {
            if (!debe) ++vAcceso;
            if (s.feeRecipient() != next) ++vSeguridad;
            ++cov[C_FR_ROTA];
        } catch (bytes memory err) {
            if (debe) {
                ++vLiveness;
                _anotar("setFeeRecipient", err);
            }
        }
    }

    function setTokenConfig(uint256 sT, uint256 sAcc, uint256 sCap, uint256 sCaller) external {
        uint8 t = uint8(sT % 3);
        uint256 unit = 10 ** tk[t].decimals();
        uint256 techo = unit / 10; // contract ceiling: 0.10 of a token unit
        uint256 k = sCap % 8;
        uint256 cap = capInicial[t];
        if (k == 0) cap = 0;
        else if (k == 2) cap = 1;
        else if (k == 3) cap = techo;
        else if (k == 4) cap = techo + 1;
        else if (k == 5) cap = type(uint256).max;
        else if (k == 6) cap = capInicial[t] * 1000;
        bool acc = sAcc % 5 != 0;
        address caller = sCaller % 5 == 0 ? _sinRol(sCaller >> 3) : s.owner();
        bool debe = caller == s.owner() && cap <= techo;
        if (caller == s.owner() && cap > techo) ++cov[C_TECHO_RECHAZO];
        vm.prank(caller);
        try s.setAcceptedToken(address(tk[t]), acc, cap) {
            if (!debe) {
                ++vAcceso;
                _anotar("setAcceptedToken paso sin deber", abi.encode(caller, cap, techo));
            }
            if (s.isAcceptedToken(address(tk[t])) != acc || s.maxNetworkFee(address(tk[t])) != cap) ++vSeguridad;
            ++cov[C_CAP_CAMBIO];
        } catch (bytes memory err) {
            if (debe) {
                ++vLiveness;
                _anotar("setAcceptedToken", err);
            }
        }
    }

    function rotateRelayer(uint256 sSel, uint256 sCaller) external {
        uint256 k = sSel % 4;
        address r = k < 2 ? relayer2 : (k == 2 ? relayer : stranger);
        bool allowed = k == 3 ? true : !s.isRelayer(r);
        address caller = (k == 3 || sCaller % 5 == 0) ? _sinRol(sCaller >> 3) : s.owner();
        bool debe = caller == s.owner();
        vm.prank(caller);
        try s.setRelayer(r, allowed) {
            if (!debe) ++vAcceso;
            if (s.isRelayer(r) != allowed) ++vSeguridad;
        } catch (bytes memory err) {
            if (debe) {
                ++vLiveness;
                _anotar("setRelayer", err);
            }
        }
    }

    function rotateGuardian(uint256 sSel, uint256 sCaller) external {
        uint256 k = sSel % 5;
        address next = k == 4 ? ((sSel >> 8) % 2 == 0 ? address(0) : address(s)) : (k % 2 == 0 ? guardian : guardian2);
        address caller = sCaller % 5 == 0 ? _sinRol(sCaller >> 3) : s.owner();
        bool debe = caller == s.owner() && next != address(0) && next != address(s);
        vm.prank(caller);
        try s.setGuardian(next) {
            if (!debe) ++vAcceso;
            if (s.guardian() != next) ++vSeguridad;
        } catch (bytes memory err) {
            if (debe) {
                ++vLiveness;
                _anotar("setGuardian", err);
            }
        }
    }

    function rotateOwner(uint256 sSel) external {
        address actual = s.owner();
        address next = actual == owners[0] ? owners[1] : owners[0];
        address malo = _sinRol(sSel);
        vm.prank(malo);
        try s.transferOwnership(malo) {
            ++vAcceso;
        } catch {}
        vm.prank(actual);
        try s.renounceOwnership() {
            ++vAcceso;
        } catch {}
        vm.prank(actual);
        try s.transferOwnership(next) {}
        catch (bytes memory err) {
            ++vLiveness;
            _anotar("transferOwnership", err);
            return;
        }
        // A pending owner has no power until it accepts, and nobody else can accept.
        vm.prank(next);
        try s.setFeeRecipient(frPool[1]) {
            ++vAcceso;
        } catch {}
        vm.prank(stranger);
        try s.acceptOwnership() {
            ++vAcceso;
        } catch {}
        vm.prank(next);
        try s.acceptOwnership() {}
        catch (bytes memory err) {
            ++vLiveness;
            _anotar("acceptOwnership", err);
        }
        if (s.owner() != next || s.pendingOwner() != address(0)) ++vSeguridad;
        ++cov[C_OWNER_ROTA];
    }

    /// Callers without the role try every privileged function.
    function ataqueAdmin(uint256 sCaller, uint256 sFn) external {
        address malo = _sinRol(sCaller);
        uint256 k = sFn % 7;
        bytes memory data;
        if (k == 0) {
            data = abi.encodeCall(PeajeSettlementV3.setFeeRecipient, (malo));
        } else if (k == 1) {
            data = abi.encodeCall(PeajeSettlementV3.setAcceptedToken, (address(tk[0]), true, type(uint256).max));
        } else if (k == 2) {
            data = abi.encodeCall(PeajeSettlementV3.setRelayer, (malo, true));
        } else if (k == 3) {
            data = abi.encodeCall(PeajeSettlementV3.setGuardian, (malo));
        } else if (k == 4) {
            data = abi.encodeCall(PeajeSettlementV3.unpause, ());
        } else if (k == 5) {
            (bool hay, uint256 i) = _strayPendiente(sFn >> 3);
            if (!hay) return;
            Stray memory st = strays[i];
            data = abi.encodeCall(
                PeajeSettlementV3.settleStray, (address(tk[st.t]), malo, payers[st.payer], st.value, st.nonce, 0)
            );
        } else {
            data = abi.encodeWithSignature("transferOwnership(address)", malo);
        }
        ++cov[C_ACCESO_INTENTO];
        vm.prank(malo);
        (bool ok,) = address(s).call(data);
        if (ok) {
            ++vAcceso;
            _anotar("admin sin rol", abi.encode(malo, k));
        }
    }

    /// At most one blocked address per token: a call unblocks it, or blocks a new one (1 in 2).
    function toggleBlocklist(uint256 sT, uint256 sWho) external {
        uint8 t = uint8(sT % 4);
        if (bloqueado[t] != address(0)) {
            tk[t].setBlacklisted(bloqueado[t], false);
            bloqueado[t] = address(0);
            return;
        }
        if ((sWho >> 8) % 2 != 0) return;
        uint256 k = sWho % 10;
        address who;
        if (k < 4) who = payers[k];
        else if (k < 7) who = merchants[k - 4];
        else if (k == 7) who = s.feeRecipient();
        else if (k == 8) who = address(s);
        else who = address(hook);
        tk[t].setBlacklisted(who, true);
        bloqueado[t] = who;
    }

    /// Issuer pause: unpauses always, pauses 1 in 4.
    function toggleTokenPause(uint256 sT) external {
        uint8 t = uint8(sT % 4);
        if (tk[t].paused()) tk[t].setPaused(false);
        else if ((sT >> 8) % 4 == 0) tk[t].setPaused(true);
    }

    function setModo(uint256 sModo) external {
        tk[2].setModo(InvariantesMockTokenRaro.Modo(sModo % 7));
    }

    function warp(uint256 sSec) external {
        vm.warp(block.timestamp + _bound(sSec, 1, 3 days));
    }

    // =====================================================================================
    // views for the invariants
    // =====================================================================================

    function trackedCount() external view returns (uint256) {
        return tracked.length;
    }

    /// Shadow ledger: every balance equals what the expected splits say, the model supply equals
    /// the real supply, and nobody outside the tracked set holds any token.
    function libroCuadra() external view returns (bool, string memory) {
        for (uint256 t; t < 4; ++t) {
            uint256 suma;
            for (uint256 i; i < tracked.length; ++i) {
                uint256 b = tk[t].balanceOf(tracked[i]);
                if (b != modelo[t][tracked[i]]) {
                    return (
                        false,
                        string.concat(
                            "token ",
                            vm.toString(t),
                            " cuenta ",
                            vm.toString(tracked[i]),
                            " real ",
                            vm.toString(b),
                            " modelo ",
                            vm.toString(modelo[t][tracked[i]])
                        )
                    );
                }
                suma += b;
            }
            if (suma != tk[t].totalSupply() || supplyModelo[t] != suma) {
                return (false, string.concat("supply token ", vm.toString(t)));
            }
        }
        return (true, "");
    }

    /// The contract balance is exactly front-runs + donations - routed strays (+ rebase residue).
    function saldoContratoCuadra() external view returns (bool, string memory) {
        for (uint256 t; t < 4; ++t) {
            uint256 b = tk[t].balanceOf(address(s));
            uint256 entra = ghostIn[t] + ghostResiduo[t];
            if (entra < ghostOut[t] || b != entra - ghostOut[t]) {
                return (
                    false,
                    string.concat(
                        "token ",
                        vm.toString(t),
                        " saldo ",
                        vm.toString(b),
                        " in ",
                        vm.toString(entra),
                        " out ",
                        vm.toString(ghostOut[t])
                    )
                );
            }
        }
        return (true, "");
    }

    /// Every listed token's cap is within the contract ceiling (0.10 of a token unit).
    function capsDentroDelTecho() external view returns (bool) {
        for (uint256 t; t < 4; ++t) {
            if (s.maxNetworkFee(address(tk[t])) > 10 ** tk[t].decimals() / 10) return false;
        }
        return true;
    }

    function coverage() external view returns (uint256[41] memory) {
        return cov;
    }

    // =====================================================================================
    // helpers
    // =====================================================================================

    /// Mirrors `_split`: not 0, not the contract, not the current fee recipient, owner, guardian
    /// or any current relayer.
    function _merchantOk(address merchant, address fr) internal view returns (bool) {
        return merchant != address(0) && merchant != address(s) && merchant != fr && merchant != s.owner()
            && merchant != s.guardian() && !s.isRelayer(merchant);
    }

    function _hookActivo(uint8 t, address merchant) internal view returns (bool) {
        return merchant == address(hook) && t == 2 && tk[2].modo() == InvariantesMockTokenRaro.Modo.HOOK;
    }

    /// Arms the malicious merchant: when paid it tries to settle a fresh authorization to itself
    /// (it is a relayer, so only `nonReentrant` stops it) and maybe sends 1 unit back.
    function _armarHook(uint8 t, address merchant, bool dona, bool enStray) internal {
        if (!_hookActivo(t, merchant)) {
            hook.armar(address(0), "", false, address(0));
            return;
        }
        _mint(2, payers[0], 1_000);
        PeajeSettlementV3.Authorization memory r;
        r.from = payers[0];
        r.value = 1_000;
        r.validBefore = block.timestamp + 300;
        r.nonce = _nonce();
        (r.v, r.r, r.s) = _firmar(2, payerKeys[0], r.from, address(s), r.value, r.validBefore, r.nonce);
        // Re-entry pays a neutral merchant, so a nested hook call cannot mask it. `enStray` only
        // documents which outer call holds the guard.
        enStray;
        bytes memory data = abi.encodeCall(PeajeSettlementV3.settle, (address(tk[2]), merchants[1], r, 0));
        hook.armar(address(tk[2]), data, dona, address(reenviador));
        ++cov[C_REENTRADA_INTENTO];
    }

    struct Esperado {
        uint8 t;
        address merchant;
        address payer;
        uint256 value;
        uint256 net;
        uint256 nf;
        bytes32 nonce;
        bool esStray;
    }

    function _chequearEventos(
        uint8 t,
        address merchant,
        address payer,
        uint256 value,
        uint256 net,
        uint256 nf,
        bytes32 nonce,
        Vm.Log[] memory logs,
        bool esStray
    ) internal {
        Esperado memory e = Esperado(t, merchant, payer, value, net, nf, nonce, esStray);
        uint256 nPay;
        uint256 nStray;
        for (uint256 i; i < logs.length; ++i) {
            if (logs[i].emitter != address(s)) continue;
            if (logs[i].topics[0] == PeajeSettlementV3.PaymentSettled.selector) {
                ++nPay;
                _chequearPago(e, logs[i]);
            } else if (logs[i].topics[0] == PeajeSettlementV3.StraySettled.selector) {
                ++nStray;
                if (
                    logs[i].topics[1] != e.nonce || logs[i].topics[2] != bytes32(uint256(uint160(address(tk[e.t]))))
                        || logs[i].topics[3] != bytes32(uint256(uint160(e.payer)))
                ) ++vEventos;
            } else {
                ++vEventos; // no other event may come out of a money call
            }
        }
        if (nPay != 1 || nStray != (e.esStray ? 1 : 0)) ++vEventos;
    }

    function _chequearPago(Esperado memory e, Vm.Log memory log) internal {
        (address p, uint256 g, uint256 n, uint256 f, uint256 x) =
            abi.decode(log.data, (address, uint256, uint256, uint256, uint256));
        if (
            log.topics[1] != e.nonce || log.topics[2] != bytes32(uint256(uint160(address(tk[e.t]))))
                || log.topics[3] != bytes32(uint256(uint160(e.merchant))) || p != e.payer || g != e.value || n != e.net
                || x != e.nf
        ) ++vEventos;
        if (n + f + x != g) ++vConservacion;
        if (f * BPS > (g - x) * FEE_BPS || (f + 1) * BPS <= (g - x) * FEE_BPS) ++vFeeTope;
    }

    function _fallo(
        uint8 t,
        uint256[] memory antes,
        uint256 supplyAntes,
        address from,
        bytes32 nonce,
        bool usadoAntes
    ) internal {
        for (uint256 i; i < antes.length; ++i) {
            if (tk[t].balanceOf(tracked[i]) != antes[i]) {
                ++vAtomicidad;
                _anotar("fallo movio saldo", abi.encode(t, tracked[i]));
                break;
            }
        }
        if (tk[t].totalSupply() != supplyAntes) ++vAtomicidad;
        if (!usadoAntes && from != address(0) && tk[t].authorizationState(from, nonce)) ++vAtomicidad;
    }

    function _covExito(Llamada memory c, uint256[] memory antes, uint256 qM) internal {
        if (c.nf == c.cap && c.cap != 0) ++cov[C_NF_TOPE];
        if (c.value == c.nf + 1) ++cov[C_VALOR_MIN];
        if (c.merchant == relayer || c.merchant == relayer2) ++cov[C_M_RELAYER]; // revoked relayer
        if (c.merchant == c.payer) ++cov[C_M_PAYER];
        if (c.merchant == owners[0] || c.merchant == owners[1]) ++cov[C_M_OWNER]; // former owner
        if (c.merchant == guardian || c.merchant == guardian2) ++cov[C_M_GUARDIAN]; // retired guardian
        if (esPeaje[c.merchant] && c.merchant != c.fr) {
            for (uint256 i; i < 4; ++i) {
                if (frPool[i] == c.merchant) ++cov[C_M_EXFR];
            }
        }
        if (c.merchant == address(tk[c.t])) ++cov[C_M_TOKEN];
        if (c.merchant == address(hook)) ++cov[C_M_HOOK];
        if (c.t == 2 && tk[2].modo() == InvariantesMockTokenRaro.Modo.FOT_SALIDA && qM != 0) ++cov[C_FOT_SALIDA_OK];
        if (c.t == 2 && tk[2].modo() == InvariantesMockTokenRaro.Modo.SIN_RETORNO) ++cov[C_SINRET_OK];
        if (antes[idx1[address(s)] - 1] != 0) ++cov[C_SETTLE_CON_STRAY];
        if (c.payer == c.fr) ++cov[C_PAYER_ES_FR];
    }

    function _covRechazo(Llamada memory c) internal {
        if (c.pausado) ++cov[C_PAUSA_INTENTO];
        if (!_merchantOk(c.merchant, c.fr)) ++cov[C_M_INVALIDO_INTENTO];
        if (c.nf > c.cap) ++cov[C_NF_SOBRE_TOPE_INTENTO];
        if (!s.isAcceptedToken(address(tk[c.t]))) ++cov[C_SETTLE_NO_LISTADO_INTENTO];
        if (!c.okContrato) return;
        InvariantesMockTokenRaro tok = tk[c.t];
        if (tok.paused() || tok.isBlacklisted(c.payer) || tok.isBlacklisted(address(s)) || tok.isBlacklisted(c.merchant))
        {
            ++cov[C_BLOQUEO_RECHAZO];
            return;
        }
        if (c.t != 2) return;
        InvariantesMockTokenRaro.Modo m = tok.modo();
        if (m == InvariantesMockTokenRaro.Modo.FOT_TODO) ++cov[C_FOT_TODO_RECHAZO];
        else if (m == InvariantesMockTokenRaro.Modo.PEGAJOSO) ++cov[C_PEGAJOSO_RECHAZO];
        else if (m == InvariantesMockTokenRaro.Modo.RETORNA_FALSE) ++cov[C_RETFALSE_RECHAZO];
        else if (m == InvariantesMockTokenRaro.Modo.HOOK && c.hookArmado) ++cov[C_HOOK_DONA_RECHAZO];
    }

    function _merchant(uint256 seed, uint8 t, address payer) internal view returns (address) {
        uint256 k = seed % 16;
        if (k < 3) return merchants[k];
        if (k == 3) return relayer;
        if (k == 4) return payer;
        if (k == 5) return s.owner();
        if (k == 6) return s.guardian();
        if (k == 7) return frPool[(seed >> 8) % frPool.length];
        if (k == 8) return address(tk[t]);
        if (k == 9) return address(hook);
        if (k == 10) return address(0);
        if (k == 11) return address(s);
        if (k == 12) return s.feeRecipient();
        if (k == 13) return relayer2;
        return merchants[(seed >> 8) % 3];
    }

    function _caller(uint256 seed) internal view returns (address) {
        uint256 k = seed % 12;
        if (k < 6) return relayer;
        if (k == 6) return relayer2;
        if (k == 7) return address(reenviador);
        if (k == 8) return stranger;
        if (k == 9) return s.owner();
        if (k == 10) return s.guardian();
        return merchants[0];
    }

    /// Never the current owner or guardian.
    function _sinRol(uint256 seed) internal view returns (address) {
        uint256 k = seed % 6;
        if (k == 0) return stranger;
        if (k == 1) return relayer;
        if (k == 2) return address(hook);
        if (k == 3) return s.guardian() == guardian ? guardian2 : guardian;
        if (k == 4) return s.owner() == owners[0] ? owners[1] : owners[0];
        return s.feeRecipient();
    }

    function _elegirNf(uint256 seed, uint256 cap, uint256 unit) internal pure returns (uint256) {
        uint256 lim = 1e9 * unit;
        uint256 c = cap > lim ? lim : cap;
        uint256 k = seed % 8;
        if (k == 0) return 0;
        if (k == 1 || k == 2) return c;
        if (k == 3) return c + 1;
        if (k == 4 && c != 0) return c - 1;
        return _bound(seed >> 8, 0, c);
    }

    function _elegirValor(uint256 seed, uint256 nf, uint256 unit) internal pure returns (uint256) {
        uint256 k = seed % 10;
        if (k == 0) return nf;
        if (k == 1) return nf + 1;
        if (k == 2) return nf + 49;
        if (k == 3) return nf + 50;
        if (k == 4) return nf + 51;
        if (k == 5) return 0;
        if (k == 6) return nf + 10_000;
        return _bound(seed >> 8, nf + 1, nf + 1e6 * unit);
    }

    function _strayPendiente(uint256 seed) internal view returns (bool, uint256) {
        uint256 n = strays.length;
        if (n == 0) return (false, 0);
        uint256 start = seed % n;
        for (uint256 j; j < n && j < 128; ++j) {
            uint256 i = (start + j) % n;
            if (!strays[i].routed) return (true, i);
        }
        return (false, 0);
    }

    function _strayRuteado(uint256 seed) internal view returns (bool, uint256) {
        uint256 n = strays.length;
        if (n == 0) return (false, 0);
        uint256 start = seed % n;
        for (uint256 j; j < n && j < 128; ++j) {
            uint256 i = (start + j) % n;
            if (strays[i].routed) return (true, i);
        }
        return (false, 0);
    }

    function _usadoDe(uint8 t, uint256 seed) internal view returns (bool, Usado memory u) {
        uint256 n = usados.length;
        if (n == 0) return (false, u);
        uint256 start = seed % n;
        for (uint256 j; j < n && j < 128; ++j) {
            u = usados[(start + j) % n];
            if (u.t == t) return (true, u);
        }
        return (false, u);
    }

    function _clave(uint8 t, address from, bytes32 nonce) internal pure returns (bytes32) {
        return keccak256(abi.encode(t, from, nonce));
    }

    function _nonce() internal returns (bytes32) {
        return keccak256(abi.encode("auditoria", ++nonceCounter));
    }

    function _firmar(uint8 t, uint256 key, address from, address to, uint256 value, uint256 validBefore, bytes32 nonce)
        internal
        view
        returns (uint8 v, bytes32 r, bytes32 ss)
    {
        InvariantesMockTokenRaro tok = tk[t];
        bytes32 sh = keccak256(
            abi.encode(tok.TRANSFER_WITH_AUTHORIZATION_TYPEHASH(), from, to, value, uint256(0), validBefore, nonce)
        );
        (v, r, ss) = vm.sign(key, keccak256(abi.encodePacked("\x19\x01", tok.DOMAIN_SEPARATOR(), sh)));
    }

    function _mint(uint8 t, address to, uint256 amount) internal returns (bool) {
        try tk[t].mint(to, amount) {
            modelo[t][to] += amount;
            supplyModelo[t] += amount;
            return true;
        } catch {
            return false;
        }
    }

    function _trackear(address a) internal {
        if (idx1[a] == 0) {
            tracked.push(a);
            idx1[a] = tracked.length;
        }
    }

    function _snap(uint8 t) internal view returns (uint256[] memory b) {
        b = new uint256[](tracked.length);
        for (uint256 i; i < b.length; ++i) {
            b[i] = tk[t].balanceOf(tracked[i]);
        }
    }

    function _sumar(int256[] memory exp, address a, int256 d) internal view {
        exp[idx1[a] - 1] += d;
    }

    function _cuadra(uint8 t, uint256[] memory antes, int256[] memory exp) internal view returns (bool) {
        for (uint256 i; i < antes.length; ++i) {
            if (int256(tk[t].balanceOf(tracked[i])) - int256(antes[i]) != exp[i]) return false;
        }
        return true;
    }

    function _aplicar(uint8 t, int256[] memory exp) internal {
        for (uint256 i; i < exp.length; ++i) {
            if (exp[i] != 0) modelo[t][tracked[i]] = uint256(int256(modelo[t][tracked[i]]) + exp[i]);
        }
    }

    function _anotar(string memory que, bytes memory err) internal {
        if (bytes(primeraViolacion).length == 0) primeraViolacion = string.concat(que, " | ", vm.toString(err));
    }
}

/// @dev Invariant campaign over InvariantesHandlerV3. A-properties always; B-properties only with
///      AUDITORIA_ESTRICTO=true (they are counterexamples to stronger claims, see the report and
///      the `test_Contraejemplo_*` reproductions in InvariantesPropiedadesV3.t.sol).
contract InvariantesSettlementV3Test is Test {
    InvariantesHandlerV3 internal h;
    PeajeSettlementV3 internal s;
    bool internal estricto;

    function setUp() public {
        h = new InvariantesHandlerV3();
        s = h.s();
        estricto = vm.envOr("AUDITORIA_ESTRICTO", false);
        targetContract(address(h));
        bytes4[] memory sel = new bytes4[](24);
        sel[0] = InvariantesHandlerV3.settle.selector;
        sel[1] = InvariantesHandlerV3.settleValido.selector;
        sel[2] = InvariantesHandlerV3.settleValido.selector;
        sel[3] = InvariantesHandlerV3.frontRun.selector;
        sel[4] = InvariantesHandlerV3.gastarNonceAjeno.selector;
        sel[5] = InvariantesHandlerV3.donar.selector;
        sel[6] = InvariantesHandlerV3.settleStrayHonesto.selector;
        sel[7] = InvariantesHandlerV3.settleStrayAdversario.selector;
        sel[8] = InvariantesHandlerV3.togglePause.selector;
        sel[9] = InvariantesHandlerV3.rotateFeeRecipient.selector;
        sel[10] = InvariantesHandlerV3.setTokenConfig.selector;
        sel[11] = InvariantesHandlerV3.rotateRelayer.selector;
        sel[12] = InvariantesHandlerV3.rotateGuardian.selector;
        sel[13] = InvariantesHandlerV3.rotateOwner.selector;
        sel[14] = InvariantesHandlerV3.ataqueAdmin.selector;
        sel[15] = InvariantesHandlerV3.toggleBlocklist.selector;
        sel[16] = InvariantesHandlerV3.toggleTokenPause.selector;
        sel[17] = InvariantesHandlerV3.setModo.selector;
        sel[18] = InvariantesHandlerV3.warp.selector;
        sel[19] = InvariantesHandlerV3.settle.selector;
        sel[20] = InvariantesHandlerV3.settleStrayHonesto.selector;
        sel[21] = InvariantesHandlerV3.settleMerchantEspecial.selector;
        sel[22] = InvariantesHandlerV3.settleValido.selector;
        sel[23] = InvariantesHandlerV3.settleStrayAlHook.selector;
        targetSelector(FuzzSelector({addr: address(h), selectors: sel}));
    }

    // ---- A: must always hold ----

    function invariant_A01_LibroSombraCuadraEnTodaLaSecuencia() public view {
        (bool ok, string memory d) = h.libroCuadra();
        assertTrue(ok, d);
    }

    function invariant_A02_SaldoDelContratoSoloStraysYDonacionesSinRutear() public view {
        (bool ok, string memory d) = h.saldoContratoCuadra();
        assertTrue(ok, d);
    }

    function invariant_A03_ConservacionExactaPorLlamada() public view {
        assertEq(h.vConservacion(), 0, h.primeraViolacion());
    }

    function invariant_A04_SettleDejaElSaldoDelContratoComoEstaba() public view {
        assertEq(h.vSaldoContrato(), 0, h.primeraViolacion());
    }

    function invariant_A05_FeeRecipientNuncaMasDe2PorCientoMasNetworkFee() public view {
        assertEq(h.vFeeTope(), 0, h.primeraViolacion());
    }

    function invariant_A06_NetworkFeeNuncaSuperaElTope() public view {
        assertEq(h.vCap(), 0, h.primeraViolacion());
    }

    function invariant_A07_MerchantInvalidoNuncaLiquida() public view {
        assertEq(h.vMerchantInvalido(), 0, h.primeraViolacion());
    }

    function invariant_A08_SettleStrayNuncaMueveMasQueValueNiQueElSaldo() public view {
        assertEq(h.vStrayExceso(), 0, h.primeraViolacion());
    }

    function invariant_A09_EnPausaSettleNoMuevePlata() public view {
        assertEq(h.vPausa(), 0, h.primeraViolacion());
    }

    function invariant_A10_UnFalloNoMueveNadaNiGastaElNonce() public view {
        assertEq(h.vAtomicidad(), 0, h.primeraViolacion());
    }

    function invariant_A11_UnaLlamadaValidaNuncaFalla() public view {
        assertEq(h.vLiveness(), 0, h.primeraViolacion());
    }

    function invariant_A12_SoloLosRolesCorrectosPuedenActuar() public view {
        assertEq(h.vAcceso(), 0, h.primeraViolacion());
        assertEq(h.vSeguridad(), 0, h.primeraViolacion());
    }

    function invariant_A13_EventosCuadranConLoMovido() public view {
        assertEq(h.vEventos(), 0, h.primeraViolacion());
    }

    function invariant_A14_ReentradaNuncaPasa() public view {
        assertEq(h.vReentrada(), 0, h.primeraViolacion());
    }

    function invariant_A15_FeeInmutable() public view {
        assertEq(s.FEE_BPS(), 200);
    }

    // ---- B: stronger claims, asserted only with AUDITORIA_ESTRICTO=true ----

    function invariant_B1_MerchantRecibeExactamenteNet() public view {
        if (estricto) assertEq(h.cMerchantCorto() + h.cMerchantCortoStray(), 0, "merchant recibio menos que net");
    }

    /// Was B2 (counterexample on the audited version); settleStray now checks its final balance.
    function invariant_A16_SettleStrayDejaExactamenteSaldoMenosValue() public view {
        assertEq(h.cResiduoStray(), 0, "settleStray dejo saldo en el contrato");
    }

    function invariant_A17_TopeDeNetworkFeeNuncaSuperaElTecho() public view {
        assertTrue(h.capsDentroDelTecho(), "un tope supera 0.10 del token");
    }

    function invariant_B3_SettleStraySoloMueveElStrayRealDelNonce() public view {
        if (estricto) assertEq(h.cStrayNoReal(), 0, "settleStray movio fondos que no son el stray del nonce");
    }

    /// Narrowed by the fix to *former* role holders (old owner, retired guardian, revoked relayer,
    /// former fee recipient): current ones are A07. Still asserted only in strict mode.
    function invariant_B4_SettleStrayNuncaPagaAUnaDireccionDePeaje() public view {
        if (estricto) assertEq(h.cStrayAPeaje(), 0, "settleStray pago el 98% a una direccion de Peaje");
    }
}

/// @dev One long deterministic campaign over the same handler, to print coverage counters and
///      double-check the A-properties outside the invariant engine. Run with -vv to see counts.
contract InvariantesCampanaManualTest is Test {
    InvariantesHandlerV3 internal h;

    function setUp() public {
        h = new InvariantesHandlerV3();
    }

    function test_CampanaManual_CoberturaYPropiedadesA() public {
        uint256 pasos = vm.envOr("AUDITORIA_PASOS", uint256(4000));
        uint256 semilla = vm.envOr("AUDITORIA_SEMILLA", uint256(0x5EED));
        for (uint256 i; i < pasos; ++i) {
            uint256 r = uint256(keccak256(abi.encode(semilla, i)));
            uint256 a = uint256(keccak256(abi.encode(r, 1)));
            uint256 b = uint256(keccak256(abi.encode(r, 2)));
            uint256 c = uint256(keccak256(abi.encode(r, 3)));
            uint256 d = uint256(keccak256(abi.encode(r, 4)));
            uint256 e = uint256(keccak256(abi.encode(r, 5)));
            uint256 k = r % 40;
            if (k < 7) h.settle(a, b, c, d, e, r >> 8, r >> 16);
            else if (k < 13) h.settleValido(a, b, c, d, e);
            else if (k < 16) h.settleMerchantEspecial(a, b, c, d, e);
            else if (k < 19) h.frontRun(a, b, c);
            else if (k < 20) h.gastarNonceAjeno(a, b, c);
            else if (k < 21) h.donar(a, b);
            else if (k < 24) h.settleStrayHonesto(a, b, c);
            else if (k < 26) h.settleStrayAdversario(a, b, c, d, e);
            else if (k < 27) h.settleStrayAlHook(a, b);
            else if (k < 28) h.togglePause(a);
            else if (k < 29) h.rotateFeeRecipient(a, b);
            else if (k < 30) h.setTokenConfig(a, b, c, d);
            else if (k < 31) h.rotateRelayer(a, b);
            else if (k < 32) h.rotateGuardian(a, b);
            else if (k < 33) h.rotateOwner(a);
            else if (k < 34) h.ataqueAdmin(a, b);
            else if (k < 36) h.toggleBlocklist(a, b);
            else if (k < 37) h.toggleTokenPause(a);
            else if (k < 39) h.setModo(a);
            else h.warp(a);
        }

        (bool ok, string memory det) = h.libroCuadra();
        assertTrue(ok, det);
        (ok, det) = h.saldoContratoCuadra();
        assertTrue(ok, det);
        assertEq(h.vConservacion(), 0, h.primeraViolacion());
        assertEq(h.vSaldoContrato(), 0, h.primeraViolacion());
        assertEq(h.vFeeTope(), 0, h.primeraViolacion());
        assertEq(h.vCap(), 0, h.primeraViolacion());
        assertEq(h.vMerchantInvalido(), 0, h.primeraViolacion());
        assertEq(h.vStrayExceso(), 0, h.primeraViolacion());
        assertEq(h.vPausa(), 0, h.primeraViolacion());
        assertEq(h.vAtomicidad(), 0, h.primeraViolacion());
        assertEq(h.vLiveness(), 0, h.primeraViolacion());
        assertEq(h.vAcceso(), 0, h.primeraViolacion());
        assertEq(h.vSeguridad(), 0, h.primeraViolacion());
        assertEq(h.vEventos(), 0, h.primeraViolacion());
        assertEq(h.vReentrada(), 0, h.primeraViolacion());

        uint256[41] memory cv = h.coverage();
        string[41] memory nombres = [
            "settle ok",
            "settle fallido",
            "settleStray ok",
            "settleStray fallido",
            "ok con networkFee == tope",
            "ok con value == networkFee + 1",
            "ok merchant = relayer revocado",
            "ok merchant = payer",
            "ok merchant = ex owner",
            "ok merchant = ex guardian",
            "ok merchant = ex fee recipient",
            "ok merchant = token",
            "ok merchant = hook",
            "intento merchant invalido",
            "intento en pausa",
            "intento networkFee > tope",
            "intento replay",
            "ok token fee selectivo (merchant corto)",
            "rechazo token pegajoso",
            "rechazo fee-on-transfer",
            "rechazo return-false",
            "ok token sin return",
            "intento reentrada",
            "rechazo hook que dona",
            "rechazo blocklist/pausa token",
            "settleStray con nonce ajeno",
            "settleStray con value inflado",
            "settleStray en pausa",
            "settleStray token no listado",
            "settleStray con residuo",
            "front-runs",
            "donaciones",
            "cambios de tope",
            "rotaciones fee recipient",
            "rotaciones owner",
            "settle con stray previo",
            "ok payer = fee recipient",
            "settleStray a direccion de Peaje",
            "intento token no listado",
            "intentos admin sin rol",
            "tope sobre el techo rechazado"
        ];
        for (uint256 i; i < 41; ++i) {
            console2.log(nombres[i], cv[i]);
        }
        console2.log("B1 merchant corto (settle / stray)", h.cMerchantCorto(), h.cMerchantCortoStray());
        assertEq(h.cResiduoStray(), 0, "A16 residuo en settleStray");
        assertTrue(h.capsDentroDelTecho(), "A17 tope sobre el techo");
        console2.log("B3 settleStray sin stray real", h.cStrayNoReal());
        console2.log("B4 settleStray a Peaje", h.cStrayAPeaje());
    }
}
