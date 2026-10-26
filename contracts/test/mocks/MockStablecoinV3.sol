// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/// @dev EIP-3009 stablecoin with the behaviours of the real tokens PeajeSettlementV3 accepts:
///      configurable EIP-712 domain and decimals (USDC: "USD Coin"/"2" on Arbitrum, "USDC"/"2"
///      on Arc; USDG: "Global Dollar"/"1"), an issuer blacklist that blocks transfers from and to
///      an address (USDC `isBlacklisted`, USDG `isFrozen`) and a token-wide pause.
contract MockStablecoin is ERC20, EIP712 {
    bytes32 public constant TRANSFER_WITH_AUTHORIZATION_TYPEHASH = keccak256(
        "TransferWithAuthorization(address from,address to,uint256 value,uint256 validAfter,uint256 validBefore,bytes32 nonce)"
    );

    uint8 private immutable DECIMALS;
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
        return DECIMALS;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
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
    ) external virtual {
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

    function _update(address from, address to, uint256 value) internal virtual override {
        if (paused) revert TokenPaused();
        if (isBlacklisted[from]) revert Blacklisted(from);
        if (isBlacklisted[to]) revert Blacklisted(to);
        super._update(from, to, value);
    }
}

/// @dev Burns 1% of every transfer: the contract must reject it (it receives less than signed).
contract MockFeeOnTransferStablecoin is MockStablecoin {
    constructor() MockStablecoin("Lossy", "1", 6) {}

    function _update(address from, address to, uint256 value) internal override {
        if (from != address(0) && to != address(0)) {
            uint256 burned = value / 100;
            super._update(from, address(0), burned);
            super._update(from, to, value - burned);
        } else {
            super._update(from, to, value);
        }
    }
}

/// @dev Delivers exactly what is signed, but every outgoing transfer from `sticky` leaves one
///      unit behind (it is minted back). Models a rebasing or misbehaving token: the contract
///      must notice it did not end the call with the balance it started with.
contract MockStickyStablecoin is MockStablecoin {
    address public sticky;

    constructor() MockStablecoin("Sticky", "1", 6) {}

    function setSticky(address sticky_) external {
        sticky = sticky_;
    }

    function _update(address from, address to, uint256 value) internal override {
        super._update(from, to, value);
        if (from == sticky && from != address(0) && to != address(0)) super._update(address(0), from, 1);
    }
}

/// @dev Calls back into `target` with `data` once, either while pulling the authorization
///      (`onPull`) or while the settlement pays out (`onPayout`), and records the outcome.
contract MockReentrantStablecoin is MockStablecoin {
    address public target;
    bytes public data;
    address public payer;
    bool public armedOnPull;
    bool public armedOnPayout;

    bool public reentered;
    bool public reentrySucceeded;
    bytes public reentryReturn;

    constructor() MockStablecoin("Evil", "1", 6) {}

    function arm(address target_, bytes calldata data_, address payer_, bool onPull, bool onPayout) external {
        target = target_;
        data = data_;
        payer = payer_;
        armedOnPull = onPull;
        armedOnPayout = onPayout;
    }

    function _update(address from, address to, uint256 value) internal override {
        super._update(from, to, value);
        bool pull = armedOnPull && from == payer && to == target;
        bool payout = armedOnPayout && from == target;
        if ((pull || payout) && !reentered) {
            reentered = true;
            (reentrySucceeded, reentryReturn) = target.call(data);
        }
    }
}
