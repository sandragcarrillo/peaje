// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {PeajeSettlementV3} from "../../src/PeajeSettlementV3.sol";
import {MockStablecoin} from "../mocks/MockStablecoinV3.sol";

/// @dev Shared setup for the v3 suites. Addresses come from Foundry's `makeAddr` and the one
///      signing key is a deterministic test constant, as in the v2 suites.
abstract contract BaseV3 is Test {
    PeajeSettlementV3 internal settlement;
    MockStablecoin internal usdc;

    address internal owner = makeAddr("owner (Safe)");
    address internal relayer = makeAddr("relayer");
    address internal guardian = makeAddr("guardian");
    address internal treasury = makeAddr("feeRecipient");
    address internal merchant = makeAddr("merchant");
    address internal otherMerchant = makeAddr("otherMerchant");
    address internal stranger = makeAddr("stranger");

    uint256 internal constant AGENT_KEY = 0xA11CE;
    address internal agent = vm.addr(AGENT_KEY);

    uint256 internal constant MAX_NETWORK_FEE = 20_000; // $0.02 at 6 decimals, the Arbitrum and Robinhood default

    function setUp() public virtual {
        usdc = new MockStablecoin("USD Coin", "2", 6);
        settlement = _deploy(address(usdc), MAX_NETWORK_FEE);
        usdc.mint(agent, 1_000e6);
        vm.warp(1_000_000);
    }

    function _deploy(address token, uint256 cap) internal returns (PeajeSettlementV3) {
        address[] memory relayers = new address[](1);
        relayers[0] = relayer;
        address[] memory tokens = new address[](1);
        tokens[0] = token;
        uint256[] memory caps = new uint256[](1);
        caps[0] = cap;
        return new PeajeSettlementV3(owner, guardian, treasury, relayers, tokens, caps);
    }

    function _authorizeTo(MockStablecoin token, uint256 key, address to, uint256 value, bytes32 nonce)
        internal
        view
        returns (PeajeSettlementV3.Authorization memory auth)
    {
        auth.from = vm.addr(key);
        auth.value = value;
        auth.validAfter = 0;
        auth.validBefore = block.timestamp + 300;
        auth.nonce = nonce;
        bytes32 structHash = keccak256(
            abi.encode(
                token.TRANSFER_WITH_AUTHORIZATION_TYPEHASH(),
                auth.from,
                to,
                value,
                auth.validAfter,
                auth.validBefore,
                nonce
            )
        );
        (auth.v, auth.r, auth.s) =
            vm.sign(key, keccak256(abi.encodePacked("\x19\x01", token.DOMAIN_SEPARATOR(), structHash)));
    }

    function _authorize(MockStablecoin token, uint256 value, bytes32 nonce)
        internal
        view
        returns (PeajeSettlementV3.Authorization memory)
    {
        return _authorizeTo(token, AGENT_KEY, address(settlement), value, nonce);
    }

    function _settle(MockStablecoin token, address to, uint256 value, uint256 networkFee, bytes32 nonce)
        internal
        returns (uint256)
    {
        PeajeSettlementV3.Authorization memory auth = _authorize(token, value, nonce);
        vm.prank(relayer);
        return settlement.settle(address(token), to, auth, networkFee);
    }

    /// Submits the authorization straight to the token, as a front-runner would.
    function _frontRun(MockStablecoin token, PeajeSettlementV3.Authorization memory auth) internal {
        vm.prank(stranger);
        token.transferWithAuthorization(
            auth.from,
            address(settlement),
            auth.value,
            auth.validAfter,
            auth.validBefore,
            auth.nonce,
            auth.v,
            auth.r,
            auth.s
        );
    }
}
