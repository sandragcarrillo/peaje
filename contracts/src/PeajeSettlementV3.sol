// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Ownable, Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuardTransient} from "@openzeppelin/contracts/utils/ReentrancyGuardTransient.sol";
import {IEIP3009} from "./interfaces/IEIP3009.sol";

/// @title PeajeSettlementV3
/// @notice Stateless split of stablecoin payments from AI agents. In the same transaction that
///         pulls the payer's EIP-3009 authorization, the merchant's share goes straight to the
///         merchant's own wallet and Peaje's share to the fee recipient. The contract holds no
///         balances, owes nothing to anyone and has no withdraw function.
/// @dev A payment is `price + networkFee`, both signed by the payer as one `value`:
///        fee = floor(price * FEE_BPS / 10_000)       (2%, rounded down, in favour of the merchant)
///        net = price - fee                            -> merchant
///        fee + networkFee                             -> feeRecipient
///      `networkFee` reimburses the relayer's gas. The relayer chooses it per payment and the
///      owner caps it per token.
///
///      `settle` is relayer-only: an EIP-3009 authorization binds payer, amount and nonce but not
///      the merchant, so an open `settle` would let anyone route a signed payment to themselves.
///
///      If someone submits an authorization straight to the token (it is public once in the
///      mempool or in the 402 flow), the funds land here unsplit. The owner routes them with
///      `settleStray`, which applies the same split. Nothing can ever be swept to Peaje.
contract PeajeSettlementV3 is Ownable2Step, Pausable, ReentrancyGuardTransient {
    using SafeERC20 for IERC20;

    /// @notice Peaje's percentage, fixed at deploy time: 200 bps = 2%. Changing it is a new deploy.
    uint256 public constant FEE_BPS = 200;
    uint256 private constant BPS_DENOMINATOR = 10_000;

    /// @notice EIP-3009 `TransferWithAuthorization` signed by the payer with `to` = this contract.
    struct Authorization {
        address from;
        uint256 value;
        uint256 validAfter;
        uint256 validBefore;
        bytes32 nonce;
        uint8 v;
        bytes32 r;
        bytes32 s;
    }

    address public feeRecipient;
    /// @notice Can only call `pause()`. A fast key for emergencies, while the Safe gathers signatures.
    address public guardian;

    mapping(address token => bool) public isAcceptedToken;
    /// @notice Most a relayer may charge as network fee on one payment, in the token's units.
    mapping(address token => uint256) public maxNetworkFee;
    mapping(address account => bool) public isRelayer;
    /// @notice Front-run authorizations already routed by `settleStray`.
    mapping(address token => mapping(address payer => mapping(bytes32 nonce => bool))) public straySettled;

    /// @notice One per payment, from `settle` and from `settleStray`. `gross = net + fee + networkFee`.
    event PaymentSettled(
        bytes32 indexed nonce,
        address indexed token,
        address indexed merchant,
        address payer,
        uint256 gross,
        uint256 net,
        uint256 fee,
        uint256 networkFee
    );
    /// @notice Marks that the `PaymentSettled` in the same transaction came from `settleStray`.
    ///         It carries no amounts, so indexers that sum `PaymentSettled` never double count.
    event StraySettled(bytes32 indexed nonce, address indexed token, address indexed payer);
    event FeeRecipientUpdated(address indexed previous, address indexed next);
    event GuardianUpdated(address indexed previous, address indexed next);
    event RelayerUpdated(address indexed relayer, bool allowed);
    event TokenUpdated(address indexed token, bool accepted, uint256 maxNetworkFee);

    error NotRelayer(address caller);
    error TokenNotAccepted(address token);
    error ZeroAddress();
    error ZeroAmount();
    error InvalidMerchant(address merchant);
    error InvalidFeeRecipient(address feeRecipient);
    error InvalidGuardian(address guardian);
    error NotPauser(address caller);
    error NetworkFeeTooHigh(uint256 networkFee, uint256 max);
    error UnexpectedAmountReceived(uint256 expected, uint256 received);
    error BalanceNotRestored(uint256 before, uint256 afterSettle);
    error AuthorizationNotUsed(address payer, bytes32 nonce);
    error StrayAlreadySettled(address payer, bytes32 nonce);
    error InsufficientStray(uint256 available, uint256 requested);
    error LengthMismatch();
    error RenounceDisabled();

    modifier onlyRelayer() {
        _checkRelayer();
        _;
    }

    /// @param initialOwner Meant to be a Safe. It is the owner from block one, so the deployer
    ///        key keeps no privileges and no `acceptOwnership` is needed.
    /// @param guardian_ Pause-only role, separate from the owner (see `pause`).
    /// @param tokens Tokens accepted from the start, aligned with `maxNetworkFees`.
    constructor(
        address initialOwner,
        address guardian_,
        address feeRecipient_,
        address[] memory relayers,
        address[] memory tokens,
        uint256[] memory maxNetworkFees
    ) Ownable(initialOwner) {
        if (tokens.length != maxNetworkFees.length) revert LengthMismatch();
        _setGuardian(guardian_);
        _setFeeRecipient(feeRecipient_);
        for (uint256 i; i < relayers.length; ++i) {
            _setRelayer(relayers[i], true);
        }
        for (uint256 i; i < tokens.length; ++i) {
            _setAcceptedToken(tokens[i], true, maxNetworkFees[i]);
        }
    }

    // ---- settlement ----

    /// @notice Pulls a signed EIP-3009 payment and splits it in the same call: `net` to the
    ///         merchant, `fee + networkFee` to the fee recipient. Same ABI as v2's `settle`.
    /// @param networkFee Part of `auth.value` that covers the relayer's gas, at most
    ///        `maxNetworkFee[token]`. The rest is the price the merchant set.
    /// @return net Amount sent to the merchant: the price minus the 2% fee.
    function settle(address token, address merchant, Authorization calldata auth, uint256 networkFee)
        external
        onlyRelayer
        whenNotPaused
        nonReentrant
        returns (uint256 net)
    {
        if (!isAcceptedToken[token]) revert TokenNotAccepted(token);
        uint256 fee;
        (net, fee) = _split(token, merchant, auth.value, networkFee);

        uint256 balanceBefore = IERC20(token).balanceOf(address(this));
        IEIP3009(token)
            .transferWithAuthorization(
                auth.from,
                address(this),
                auth.value,
                auth.validAfter,
                auth.validBefore,
                auth.nonce,
                auth.v,
                auth.r,
                auth.s
            );
        uint256 received = IERC20(token).balanceOf(address(this)) - balanceBefore;
        // Reading the balance around the pull is the control that detects short deliveries; re-entry
        // is blocked by `nonReentrant` and the token is owner-allowlisted.
        // slither-disable-next-line reentrancy-balance
        if (received != auth.value) revert UnexpectedAmountReceived(auth.value, received);

        _payout(token, merchant, net, fee + networkFee);

        uint256 balanceAfter = IERC20(token).balanceOf(address(this));
        // slither-disable-next-line reentrancy-balance,incorrect-equality
        if (balanceAfter != balanceBefore) revert BalanceNotRestored(balanceBefore, balanceAfter);

        emit PaymentSettled(auth.nonce, token, merchant, auth.from, auth.value, net, fee, networkFee);
    }

    /// @notice Routes a payment whose authorization was submitted straight to the token, so its
    ///         funds sit here unsplit. Applies exactly the split `settle` would have applied.
    /// @dev Owner-only: the authorization does not bind the merchant, and the owner (a Safe)
    ///      takes the merchant from Peaje's records of the 402 that `nonce` paid. The owner must
    ///      check off-chain that `nonce` has no `PaymentSettled` yet: `settle` does not record
    ///      nonces (it would cost a storage write per payment) and the contract only enforces that
    ///      the nonce is spent at the token, was never routed here before, and that the surplus
    ///      covers `value`. Works while paused and for delisted tokens.
    function settleStray(
        address token,
        address merchant,
        address from,
        uint256 value,
        bytes32 nonce,
        uint256 networkFee
    ) external onlyOwner nonReentrant returns (uint256 net) {
        if (!IEIP3009(token).authorizationState(from, nonce)) {
            revert AuthorizationNotUsed(from, nonce);
        }
        if (straySettled[token][from][nonce]) revert StrayAlreadySettled(from, nonce);

        uint256 fee;
        (net, fee) = _split(token, merchant, value, networkFee);

        uint256 available = IERC20(token).balanceOf(address(this));
        if (available < value) revert InsufficientStray(available, value);

        straySettled[token][from][nonce] = true;
        _payout(token, merchant, net, fee + networkFee);

        emit PaymentSettled(nonce, token, merchant, from, value, net, fee, networkFee);
        emit StraySettled(nonce, token, from);
    }

    /// @notice The split `settle` applies to `value`, for quoting and off-chain checks.
    function quote(uint256 value, uint256 networkFee) external pure returns (uint256 net, uint256 fee) {
        if (value <= networkFee) revert ZeroAmount();
        fee = ((value - networkFee) * FEE_BPS) / BPS_DENOMINATOR;
        net = value - networkFee - fee;
    }

    // ---- admin ----

    function setRelayer(address relayer, bool allowed) external onlyOwner {
        _setRelayer(relayer, allowed);
    }

    function setFeeRecipient(address feeRecipient_) external onlyOwner {
        _setFeeRecipient(feeRecipient_);
    }

    /// @notice Rotates the guardian. It cannot be cleared to zero; to retire it, rotate it to a
    ///         key the owner controls.
    function setGuardian(address guardian_) external onlyOwner {
        _setGuardian(guardian_);
    }

    /// @notice Lists or delists a token and sets the most a relayer may charge as network fee
    ///         on a single payment in that token (in the token's own units).
    function setAcceptedToken(address token, bool accepted, uint256 maxNetworkFee_) external onlyOwner {
        _setAcceptedToken(token, accepted, maxNetworkFee_);
    }

    /// @notice Stops new `settle` calls. Nothing is held, so there is nothing else to freeze.
    ///         The owner or the guardian can pause; only the owner can unpause.
    function pause() external {
        if (msg.sender != owner() && msg.sender != guardian) revert NotPauser(msg.sender);
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    /// @dev Without an owner, relayers, tokens and the fee recipient could never be rotated.
    function renounceOwnership() public view override onlyOwner {
        revert RenounceDisabled();
    }

    // ---- internals ----

    /// @dev Validates a payment and computes its split. Fee rounds down: the merchant gets
    ///      `price - floor(price * 2%)`, never less than 98% of the price, and never more than
    ///      `value - fee - networkFee` because that is exactly what is sent.
    function _split(address token, address merchant, uint256 value, uint256 networkFee)
        private
        view
        returns (uint256 net, uint256 fee)
    {
        if (merchant == address(0) || merchant == address(this) || merchant == feeRecipient) {
            revert InvalidMerchant(merchant);
        }
        uint256 cap = maxNetworkFee[token];
        if (networkFee > cap) revert NetworkFeeTooHigh(networkFee, cap);
        if (value <= networkFee) revert ZeroAmount();

        fee = ((value - networkFee) * FEE_BPS) / BPS_DENOMINATOR;
        net = value - networkFee - fee;
    }

    function _payout(address token, address merchant, uint256 net, uint256 toFeeRecipient) private {
        IERC20(token).safeTransfer(merchant, net);
        if (toFeeRecipient != 0) IERC20(token).safeTransfer(feeRecipient, toFeeRecipient);
    }

    function _checkRelayer() private view {
        if (!isRelayer[msg.sender]) revert NotRelayer(msg.sender);
    }

    function _setRelayer(address relayer, bool allowed) private {
        if (relayer == address(0)) revert ZeroAddress();
        isRelayer[relayer] = allowed;
        emit RelayerUpdated(relayer, allowed);
    }

    function _setFeeRecipient(address feeRecipient_) private {
        if (feeRecipient_ == address(0) || feeRecipient_ == address(this)) {
            revert InvalidFeeRecipient(feeRecipient_);
        }
        emit FeeRecipientUpdated(feeRecipient, feeRecipient_);
        feeRecipient = feeRecipient_;
    }

    function _setGuardian(address guardian_) private {
        if (guardian_ == address(0) || guardian_ == address(this)) revert InvalidGuardian(guardian_);
        emit GuardianUpdated(guardian, guardian_);
        guardian = guardian_;
    }

    function _setAcceptedToken(address token, bool accepted, uint256 maxNetworkFee_) private {
        if (token == address(0)) revert ZeroAddress();
        isAcceptedToken[token] = accepted;
        maxNetworkFee[token] = maxNetworkFee_;
        emit TokenUpdated(token, accepted, maxNetworkFee_);
    }
}
