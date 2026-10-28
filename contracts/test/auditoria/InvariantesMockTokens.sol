// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

interface IInvariantesReceptor {
    function alRecibir(address from, uint256 value) external;
}

/// @dev EIP-3009 stablecoin with switchable quirks, for the audit property suites. Blocklist and
///      token-wide pause are independent of `modo`; `modo` picks one behaviour at a time:
///        NORMAL         plain ERC20 + EIP-3009 (USDC / USDG shape)
///        FOT_TODO       every transfer burns 1% (so does the EIP-3009 pull)
///        FOT_SALIDA     only transfers sent by `origenFee` burn 1% (selective fee: the pull is clean)
///        PEGAJOSO       every transfer sent by `pegajoso` mints 1 unit back to it (positive rebase)
///        RETORNA_FALSE  `transfer` returns false and moves nothing (EIP-3009 pull still works)
///        SIN_RETORNO    `transfer` moves the funds and returns no data (USDT shape)
///        HOOK           a transfer to `receptorHook` calls `alRecibir` on it (ERC-777-like hook)
///      `quema`, `residuo` and `falla` let a test oracle predict exactly what a transfer does.
contract InvariantesMockTokenRaro is ERC20, EIP712 {
    enum Modo {
        NORMAL,
        FOT_TODO,
        FOT_SALIDA,
        PEGAJOSO,
        RETORNA_FALSE,
        SIN_RETORNO,
        HOOK
    }

    bytes32 public constant TRANSFER_WITH_AUTHORIZATION_TYPEHASH = keccak256(
        "TransferWithAuthorization(address from,address to,uint256 value,uint256 validAfter,uint256 validBefore,bytes32 nonce)"
    );
    uint256 public constant FEE_BPS_TOKEN = 100;

    uint8 private immutable DECIMALS;
    Modo public modo;
    bool public decimalsRevierte;
    address public origenFee;
    address public pegajoso;
    address public receptorHook;
    bool public paused;
    mapping(address account => bool) public isBlacklisted;
    mapping(address authorizer => mapping(bytes32 nonce => bool)) public authorizationState;

    error AuthorizationNotYetValid();
    error AuthorizationExpired();
    error AuthorizationUsed();
    error InvalidSignature();
    error Blacklisted(address account);
    error TokenPaused();

    constructor(string memory name_, string memory version_, uint8 decimals_)
        ERC20(name_, name_)
        EIP712(name_, version_)
    {
        DECIMALS = decimals_;
    }

    function decimals() public view override returns (uint8) {
        require(!decimalsRevierte, "decimals roto");
        return DECIMALS;
    }

    function setDecimalsRevierte(bool r) external {
        decimalsRevierte = r;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function setModo(Modo modo_) external {
        modo = modo_;
    }

    function setOrigenFee(address a) external {
        origenFee = a;
    }

    function setPegajoso(address a) external {
        pegajoso = a;
    }

    function setReceptorHook(address a) external {
        receptorHook = a;
    }

    function setBlacklisted(address account, bool blocked) external {
        isBlacklisted[account] = blocked;
    }

    function setPaused(bool paused_) external {
        paused = paused_;
    }

    function DOMAIN_SEPARATOR() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    function transferWithAuthorization(
        address from,
        address to,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external {
        if (block.timestamp <= validAfter) revert AuthorizationNotYetValid();
        if (block.timestamp >= validBefore) revert AuthorizationExpired();
        if (authorizationState[from][nonce]) revert AuthorizationUsed();

        bytes32 digest = _hashTypedDataV4(
            keccak256(abi.encode(TRANSFER_WITH_AUTHORIZATION_TYPEHASH, from, to, value, validAfter, validBefore, nonce))
        );
        if (ECDSA.recover(digest, v, r, s) != from) revert InvalidSignature();

        authorizationState[from][nonce] = true;
        _transfer(from, to, value);
    }

    function transfer(address to, uint256 value) public override returns (bool) {
        if (modo == Modo.RETORNA_FALSE) return false;
        _transfer(msg.sender, to, value);
        if (modo == Modo.SIN_RETORNO) {
            assembly ("memory-safe") {
                return(0, 0)
            }
        }
        return true;
    }

    // ---- oracle views ----

    function falla(address from, address to) public view returns (bool) {
        return paused || isBlacklisted[from] || isBlacklisted[to];
    }

    function quema(address from, address to, uint256 value) public view returns (uint256) {
        if (from == address(0) || to == address(0)) return 0;
        if (modo == Modo.FOT_TODO || (modo == Modo.FOT_SALIDA && from == origenFee)) {
            return (value * FEE_BPS_TOKEN) / 10_000;
        }
        return 0;
    }

    function residuo(address from, address to) public view returns (uint256) {
        return (modo == Modo.PEGAJOSO && from == pegajoso && from != address(0) && to != address(0)) ? 1 : 0;
    }

    function _update(address from, address to, uint256 value) internal override {
        if (paused) revert TokenPaused();
        if (isBlacklisted[from]) revert Blacklisted(from);
        if (isBlacklisted[to]) revert Blacklisted(to);
        uint256 q = quema(from, to, value);
        uint256 r = residuo(from, to);
        if (q != 0) super._update(from, address(0), q);
        super._update(from, to, value - q);
        if (r != 0) super._update(address(0), from, r);
        if (modo == Modo.HOOK && to == receptorHook && from != address(0) && to.code.length != 0) {
            IInvariantesReceptor(to).alRecibir(from, value);
        }
    }
}

/// @dev Allowed relayer that forwards any call to the settlement and bubbles its revert. The
///      hook merchant re-enters through it: the contract rejects relayers as merchants, so the
///      merchant and the relayer have to be different addresses for the guard to be what stops it.
contract InvariantesMockReenviador {
    function reenviar(address target, bytes calldata data) external returns (bytes memory) {
        (bool ok, bytes memory ret) = target.call(data);
        if (!ok) {
            assembly ("memory-safe") {
                revert(add(ret, 32), mload(ret))
            }
        }
        return ret;
    }
}

/// @dev Merchant contract that, when the HOOK token pays it, tries to re-enter the settlement
///      with `reentrada` through `via` (an allowed relayer, so only the guard can stop it) and,
///      if `donar` is set, sends one unit back to the settlement mid-call.
contract InvariantesMockMerchantHook is IInvariantesReceptor {
    address public immutable settlement;
    address public token;
    address public via;
    bytes public reentrada;
    bool public donar;
    bool public intento;
    bool public exito;
    uint256 public donado;

    constructor(address settlement_) {
        settlement = settlement_;
    }

    function armar(address token_, bytes calldata reentrada_, bool donar_, address via_) external {
        token = token_;
        via = via_;
        reentrada = reentrada_;
        donar = donar_;
        intento = false;
        exito = false;
        donado = 0;
    }

    function alRecibir(address, uint256) external {
        if (msg.sender != token || token == address(0)) return;
        if (reentrada.length != 0 && !intento) {
            intento = true;
            (bool ok,) = via == address(0)
                ? settlement.call(reentrada)
                : via.call(abi.encodeCall(InvariantesMockReenviador.reenviar, (settlement, reentrada)));
            if (ok) exito = true;
        }
        if (donar) {
            donar = false;
            donado += 1;
            InvariantesMockTokenRaro(token).transfer(settlement, 1);
        }
    }
}
