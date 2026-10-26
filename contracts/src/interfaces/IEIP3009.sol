// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @dev The part of EIP-3009 that PeajeSettlementV3 uses. Circle's USDC (Arbitrum, Arc) and
///      Paxos' USDG (Arbitrum, Robinhood Chain) implement both functions with these signatures.
interface IEIP3009 {
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
    ) external;

    function authorizationState(address authorizer, bytes32 nonce) external view returns (bool);
}
