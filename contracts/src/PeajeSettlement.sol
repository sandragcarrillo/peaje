// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Ownable, Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Nonces} from "@openzeppelin/contracts/utils/Nonces.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {SignatureChecker} from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
import {IERC3009} from "./interfaces/IERC3009.sol";

/// @title PeajeSettlement
/// @notice Settles EIP-3009 stablecoin payments from AI agents to merchants and splits the
///         platform fee on-chain. Merchants and the fee recipient withdraw their balances.
/// @dev `settle` is relayer-only: an EIP-3009 authorization binds the payer, amount and nonce,
///      but not the merchant, so an open `settle` would let anyone redirect a signed payment.
///      Withdrawals can be relayed with an EIP-712 signature so merchants never need gas.
contract PeajeSettlement is Ownable2Step, Pausable, ReentrancyGuard, EIP712, Nonces {
    using SafeERC20 for IERC20;

    uint16 public constant MAX_FEE_BPS = 1_000;
    uint16 private constant BPS_DENOMINATOR = 10_000;
    bytes32 public constant WITHDRAW_TYPEHASH =
        keccak256("Withdraw(address token,address account,uint256 amount,address to,uint256 nonce,uint256 deadline)");

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

    uint16 public feeBps;
    address public feeRecipient;

    mapping(address token => bool) public isAcceptedToken;
    mapping(address account => bool) public isRelayer;
    mapping(address token => mapping(address account => uint256)) public claimable;
    mapping(address token => uint256) public totalOwed;

    event PaymentSettled(
        bytes32 indexed nonce,
        address indexed token,
        address indexed merchant,
        address payer,
        uint256 amount,
        uint256 fee
    );
    event Withdrawn(address indexed token, address indexed account, address indexed to, uint256 amount);
    event FeeUpdated(uint16 feeBps, address indexed feeRecipient);
    event RelayerUpdated(address indexed relayer, bool allowed);
    event TokenUpdated(address indexed token, bool accepted);
    event SurplusRecovered(address indexed token, address indexed to, uint256 amount);

    error NotRelayer(address caller);
    error TokenNotAccepted(address token);
    error ZeroAddress();
    error ZeroAmount();
    error FeeTooHigh(uint16 feeBps);
    error UnexpectedAmountReceived(uint256 expected, uint256 received);
    error InsufficientBalance(uint256 available, uint256 requested);
    error NoSurplus();
    error RenounceDisabled();
    error SignatureExpired(uint256 deadline);
    error InvalidSignature();

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

    /// @notice Pulls a signed EIP-3009 payment into the contract and credits the merchant, net of fee.
    /// @return net Amount credited to the merchant.
    function settle(address token, address merchant, Authorization calldata auth)
        external
        onlyRelayer
        whenNotPaused
        nonReentrant
        returns (uint256 net)
    {
        if (!isAcceptedToken[token]) revert TokenNotAccepted(token);
        if (merchant == address(0)) revert ZeroAddress();
        if (auth.value == 0) revert ZeroAmount();

        uint256 fee = (auth.value * feeBps) / BPS_DENOMINATOR;
        net = auth.value - fee;

        claimable[token][merchant] += net;
        if (fee != 0) claimable[token][feeRecipient] += fee;
        totalOwed[token] += auth.value;
        emit PaymentSettled(auth.nonce, token, merchant, auth.from, auth.value, fee);

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

    function setAcceptedToken(address token, bool accepted) external onlyOwner {
        if (token == address(0)) revert ZeroAddress();
        isAcceptedToken[token] = accepted;
        emit TokenUpdated(token, accepted);
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
