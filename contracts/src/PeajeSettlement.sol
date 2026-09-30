// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Ownable, Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Nonces} from "@openzeppelin/contracts/utils/Nonces.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import {SignatureChecker} from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
import {IERC3009} from "./interfaces/IERC3009.sol";

/// @title PeajeSettlement
/// @notice Settles stablecoin payments from AI agents to merchants and splits the platform
///         fee on-chain. Payments arrive as EIP-3009 authorizations (`settle`) or, for tokens
///         that only implement EIP-2612 such as Tempo's TIP-20 pathUSD, as a permit
///         (`settleWithPermit`). Merchants and the fee recipient withdraw their balances.
/// @dev `settle` is relayer-only: an EIP-3009 authorization binds the payer, amount and nonce,
///      but not the merchant, so an open `settle` would let anyone redirect a signed payment.
///      Withdrawals can be relayed with an EIP-712 signature so merchants never need gas.
///
///      A payment is `price + networkFee`. The agent pays both; the merchant is credited the
///      price net of the percentage fee; the fee recipient is credited the percentage fee plus
///      the network fee, which is what the relayer spends in gas to settle. The network fee is
///      chosen by the relayer per payment and capped per token by the owner, so a relayer can
///      never take more than the cap on top of the percentage.
contract PeajeSettlement is Ownable2Step, Pausable, ReentrancyGuard, EIP712, Nonces {
    using SafeERC20 for IERC20;

    uint16 public constant MAX_FEE_BPS = 1_000;
    uint16 private constant BPS_DENOMINATOR = 10_000;
    bytes32 public constant WITHDRAW_TYPEHASH =
        keccak256("Withdraw(address token,address account,uint256 amount,address to,uint256 nonce,uint256 deadline)");
    bytes32 private constant PERMIT_TYPEHASH =
        keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)");

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

    /// @notice EIP-2612 permit signed by the payer with `spender` = this contract. `nonce` is the
    ///         token's permit nonce the signature was made with.
    struct PermitPayment {
        address owner;
        uint256 value;
        uint256 nonce;
        uint256 deadline;
        uint8 v;
        bytes32 r;
        bytes32 s;
    }

    uint16 public feeBps;
    address public feeRecipient;

    mapping(address token => bool) public isAcceptedToken;
    mapping(address token => uint256) public maxNetworkFee;
    mapping(address account => bool) public isRelayer;
    mapping(address token => mapping(address account => uint256)) public claimable;
    mapping(address token => uint256) public totalOwed;
    /// @notice Permits already settled, keyed by `permitPaymentId(token, owner, nonce)`.
    mapping(bytes32 paymentId => bool) public permitSettled;

    event PaymentSettled(
        bytes32 indexed nonce,
        address indexed token,
        address indexed merchant,
        address payer,
        uint256 amount,
        uint256 fee,
        uint256 networkFee
    );
    event Withdrawn(address indexed token, address indexed account, address indexed to, uint256 amount);
    event FeeUpdated(uint16 feeBps, address indexed feeRecipient);
    event RelayerUpdated(address indexed relayer, bool allowed);
    event TokenUpdated(address indexed token, bool accepted, uint256 maxNetworkFee);
    event SurplusRecovered(address indexed token, address indexed to, uint256 amount);

    error NotRelayer(address caller);
    error TokenNotAccepted(address token);
    error ZeroAddress();
    error ZeroAmount();
    error FeeTooHigh(uint16 feeBps);
    error NetworkFeeTooHigh(uint256 networkFee, uint256 max);
    error UnexpectedAmountReceived(uint256 expected, uint256 received);
    error InsufficientBalance(uint256 available, uint256 requested);
    error NoSurplus();
    error RenounceDisabled();
    error SignatureExpired(uint256 deadline);
    error InvalidSignature();
    error PermitAlreadySettled(bytes32 paymentId);
    error PermitNotUsable(address owner, uint256 nonce);

    modifier onlyRelayer() {
        _checkRelayer();
        _;
    }

    constructor(address initialOwner, address feeRecipient_, uint16 feeBps_)
        Ownable(initialOwner)
        EIP712("PeajeSettlement", "1")
    {
        _setFee(feeBps_, feeRecipient_);
    }

    /// @notice Pulls a signed EIP-3009 payment into the contract and credits the merchant.
    /// @param networkFee Part of `auth.value` that covers the relayer's gas. Must not exceed
    ///        `maxNetworkFee[token]`. The rest of the value is the price the merchant set.
    /// @return net Amount credited to the merchant: the price minus the percentage fee.
    function settle(address token, address merchant, Authorization calldata auth, uint256 networkFee)
        external
        onlyRelayer
        whenNotPaused
        nonReentrant
        returns (uint256 net)
    {
        net = _credit(token, merchant, auth.from, auth.value, networkFee, auth.nonce);
        _pull(token, auth);
    }

    /// @notice Settles a payment authorized with an EIP-2612 permit (spender = this contract).
    ///         Same split, caps and event as `settle`; the event's `nonce` is the payment id.
    /// @dev Relayer-only for the same reason as `settle`: a permit binds owner, value, nonce and
    ///      deadline, not the merchant. Each (token, owner, permit nonce) settles at most once,
    ///      so a spent permit can never be replayed, not even towards another merchant. If
    ///      someone submits the permit to the token first (it is public calldata), settlement
    ///      still goes through as long as the signature is valid for this contract, its nonce
    ///      is spent and the allowance covers the value.
    /// @return net Amount credited to the merchant: the price minus the percentage fee.
    function settleWithPermit(address token, address merchant, PermitPayment calldata permit, uint256 networkFee)
        external
        onlyRelayer
        whenNotPaused
        nonReentrant
        returns (uint256 net)
    {
        // slither-disable-next-line timestamp
        if (block.timestamp > permit.deadline) revert SignatureExpired(permit.deadline);

        bytes32 paymentId = permitPaymentId(token, permit.owner, permit.nonce);
        if (permitSettled[paymentId]) revert PermitAlreadySettled(paymentId);
        permitSettled[paymentId] = true;

        net = _credit(token, merchant, permit.owner, permit.value, networkFee, paymentId);
        _pullWithPermit(token, permit);
    }

    /// @notice Id under which a permit payment is recorded and emitted.
    function permitPaymentId(address token, address owner, uint256 nonce) public pure returns (bytes32) {
        return keccak256(abi.encode(token, owner, nonce));
    }

    /// @dev Validates the payment, splits it and credits both sides. Effects only.
    function _credit(
        address token,
        address merchant,
        address payer,
        uint256 value,
        uint256 networkFee,
        bytes32 paymentId
    ) private returns (uint256 net) {
        if (!isAcceptedToken[token]) revert TokenNotAccepted(token);
        if (merchant == address(0)) revert ZeroAddress();
        if (networkFee > maxNetworkFee[token]) revert NetworkFeeTooHigh(networkFee, maxNetworkFee[token]);
        if (value <= networkFee) revert ZeroAmount();

        uint256 fee = ((value - networkFee) * feeBps) / BPS_DENOMINATOR;
        net = value - networkFee - fee;

        claimable[token][merchant] += net;
        if (fee + networkFee != 0) claimable[token][feeRecipient] += fee + networkFee;
        totalOwed[token] += value;
        emit PaymentSettled(paymentId, token, merchant, payer, value, fee, networkFee);
    }

    /// @dev Pulls the authorized amount and reverts unless the token delivered exactly that much.
    function _pull(address token, Authorization calldata auth) private {
        uint256 balanceBefore = IERC20(token).balanceOf(address(this));
        IERC3009(token).transferWithAuthorization(
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
        // slither-disable-next-line reentrancy-balance
        if (received != auth.value) revert UnexpectedAmountReceived(auth.value, received);
    }

    /// @dev Applies the permit and pulls exactly `permit.value` from the payer.
    function _pullWithPermit(address token, PermitPayment calldata permit) private {
        try IERC20Permit(token).permit(
            permit.owner, address(this), permit.value, permit.deadline, permit.v, permit.r, permit.s
        ) {} catch {
            _checkSpentPermit(token, permit);
        }

        uint256 balanceBefore = IERC20(token).balanceOf(address(this));
        // `owner` signed a permit for exactly this spender and value: the token checked it above,
        // or `_checkSpentPermit` did. The caller is a relayer and each permit settles once.
        // slither-disable-next-line arbitrary-send-erc20-permit
        IERC20(token).safeTransferFrom(permit.owner, address(this), permit.value);
        uint256 received = IERC20(token).balanceOf(address(this)) - balanceBefore;
        // slither-disable-next-line reentrancy-balance
        if (received != permit.value) revert UnexpectedAmountReceived(permit.value, received);
    }

    /// @dev The permit call failed. Accept it only if it failed because the permit was already
    ///      applied: the owner signed it for this contract, its nonce is spent and the
    ///      allowance still covers the value. Anything else (bad signature, unspent nonce,
    ///      allowance used up) reverts.
    function _checkSpentPermit(address token, PermitPayment calldata permit) private view {
        bytes32 structHash = keccak256(
            abi.encode(PERMIT_TYPEHASH, permit.owner, address(this), permit.value, permit.nonce, permit.deadline)
        );
        bytes32 digest = MessageHashUtils.toTypedDataHash(IERC20Permit(token).DOMAIN_SEPARATOR(), structHash);
        // slither-disable-next-line unused-return
        (address signer, ECDSA.RecoverError err,) = ECDSA.tryRecover(digest, permit.v, permit.r, permit.s);
        if (
            err != ECDSA.RecoverError.NoError || signer != permit.owner
                || IERC20Permit(token).nonces(permit.owner) <= permit.nonce
                || IERC20(token).allowance(permit.owner, address(this)) < permit.value
        ) revert PermitNotUsable(permit.owner, permit.nonce);
    }

    /// @notice Withdraws the caller's balance. Available while paused and for delisted tokens.
    function withdraw(address token, uint256 amount, address to) external nonReentrant {
        _withdraw(token, msg.sender, amount, to);
    }

    /// @notice Withdraws `account`'s balance on its behalf. The signature commits to every
    ///         parameter and a per-account nonce, so the submitter cannot alter or replay it.
    function withdrawWithSignature(
        address token,
        address account,
        uint256 amount,
        address to,
        uint256 deadline,
        bytes calldata signature
    ) external nonReentrant {
        // slither-disable-next-line timestamp
        if (block.timestamp > deadline) revert SignatureExpired(deadline);

        bytes32 digest = _hashTypedDataV4(
            keccak256(abi.encode(WITHDRAW_TYPEHASH, token, account, amount, to, _useNonce(account), deadline))
        );
        if (!SignatureChecker.isValidSignatureNow(account, digest, signature)) revert InvalidSignature();

        _withdraw(token, account, amount, to);
    }

    // slither-disable-next-line naming-convention
    function DOMAIN_SEPARATOR() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    /// @notice Sends tokens held above what is owed to accounts, such as a payment whose
    ///         authorization was submitted to the token directly instead of through `settle`.
    function recoverSurplus(address token, address to) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();

        uint256 surplus = IERC20(token).balanceOf(address(this)) - totalOwed[token];
        // slither-disable-next-line incorrect-equality
        if (surplus == 0) revert NoSurplus();

        IERC20(token).safeTransfer(to, surplus);
        emit SurplusRecovered(token, to, surplus);
    }

    function setFee(uint16 feeBps_, address feeRecipient_) external onlyOwner {
        _setFee(feeBps_, feeRecipient_);
    }

    function setRelayer(address relayer, bool allowed) external onlyOwner {
        if (relayer == address(0)) revert ZeroAddress();
        isRelayer[relayer] = allowed;
        emit RelayerUpdated(relayer, allowed);
    }

    /// @notice Lists or delists a token and sets the most a relayer may charge as network fee
    ///         on a single payment in that token (in the token's own units).
    function setAcceptedToken(address token, bool accepted, uint256 maxNetworkFee_) external onlyOwner {
        if (token == address(0)) revert ZeroAddress();
        isAcceptedToken[token] = accepted;
        maxNetworkFee[token] = maxNetworkFee_;
        emit TokenUpdated(token, accepted, maxNetworkFee_);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    /// @dev Without an owner, relayers and tokens could never be rotated again.
    function renounceOwnership() public view override onlyOwner {
        revert RenounceDisabled();
    }

    function _withdraw(address token, address account, uint256 amount, address to) private {
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();

        uint256 available = claimable[token][account];
        if (amount > available) revert InsufficientBalance(available, amount);

        unchecked {
            claimable[token][account] = available - amount;
        }
        totalOwed[token] -= amount;

        IERC20(token).safeTransfer(to, amount);
        emit Withdrawn(token, account, to, amount);
    }

    function _checkRelayer() private view {
        if (!isRelayer[msg.sender]) revert NotRelayer(msg.sender);
    }

    function _setFee(uint16 feeBps_, address feeRecipient_) private {
        if (feeBps_ > MAX_FEE_BPS) revert FeeTooHigh(feeBps_);
        if (feeRecipient_ == address(0)) revert ZeroAddress();
        feeBps = feeBps_;
        feeRecipient = feeRecipient_;
        emit FeeUpdated(feeBps_, feeRecipient_);
    }
}
