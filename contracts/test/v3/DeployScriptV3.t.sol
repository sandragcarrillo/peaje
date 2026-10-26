// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {PeajeSettlementV3} from "../../src/PeajeSettlementV3.sol";
import {DeployPeajeSettlementV3} from "../../script/DeployPeajeSettlementV3.s.sol";
import {MockStablecoin} from "../mocks/MockStablecoinV3.sol";

/// @dev Runs the deploy script locally (no RPC): fakes each network's chain id, etches a mock
///      stablecoin at the real token addresses and a stand-in contract at the Safe address.
///      Everything is in one test because env vars are process-wide.
contract DeployScriptV3Test is Test {
    DeployPeajeSettlementV3 internal script;
    address internal safe = makeAddr("safe");
    address internal feeRecipient = makeAddr("coldFeeRecipient");
    address internal relayer = makeAddr("hotRelayer");
    address internal guardian = makeAddr("pauseGuardian");

    function setUp() public {
        script = new DeployPeajeSettlementV3();
        vm.etch(safe, hex"00");
    }

    function _env(string memory network, address owner, address relayer_) internal {
        vm.setEnv("NETWORK", network);
        vm.setEnv("OWNER", vm.toString(owner));
        vm.setEnv("GUARDIAN", vm.toString(guardian));
        vm.setEnv("FEE_RECIPIENT", vm.toString(feeRecipient));
        vm.setEnv("RELAYERS", vm.toString(relayer_));
    }

    function _deployOn(string memory network) internal returns (PeajeSettlementV3 s) {
        DeployPeajeSettlementV3.Network memory n = script.network(network);
        vm.chainId(n.chainId);
        MockStablecoin mock = new MockStablecoin("USD Coin", "2", 6);
        for (uint256 i; i < n.tokens.length; ++i) {
            vm.etch(n.tokens[i], address(mock).code);
        }
        _env(network, safe, relayer);
        s = script.run();

        assertEq(s.owner(), safe);
        assertEq(s.guardian(), guardian);
        assertEq(s.feeRecipient(), feeRecipient);
        assertTrue(s.isRelayer(relayer));
        for (uint256 i; i < n.tokens.length; ++i) {
            assertTrue(s.isAcceptedToken(n.tokens[i]));
            assertEq(s.maxNetworkFee(n.tokens[i]), n.maxNetworkFees[i]);
        }
    }

    function test_Script_AllSixNetworksAndGuards() public {
        string[6] memory networks = [
            "arbitrum-sepolia", "robinhood-testnet", "arc-testnet", "arbitrum-one", "robinhood-mainnet", "arc-mainnet"
        ];
        uint256[6] memory chainIds = [uint256(421614), 46630, 5042002, 42161, 4663, 5042];
        for (uint256 i; i < networks.length; ++i) {
            assertEq(script.network(networks[i]).chainId, chainIds[i]);
            _deployOn(networks[i]);
        }

        // Arc caps are $0.01, Arbitrum and Robinhood $0.02, the same on their testnets.
        assertEq(script.network("arc-mainnet").maxNetworkFees[0], 10_000);
        assertEq(script.network("arc-testnet").maxNetworkFees[0], 10_000);
        assertEq(script.network("arbitrum-one").maxNetworkFees[0], 20_000);
        assertEq(script.network("arbitrum-one").maxNetworkFees[1], 20_000);
        assertEq(script.network("arbitrum-sepolia").maxNetworkFees[1], 20_000);
        assertEq(script.network("robinhood-mainnet").maxNetworkFees[0], 20_000);
        assertEq(script.network("robinhood-testnet").maxNetworkFees[0], 20_000);

        // RPC on the wrong chain for NETWORK.
        vm.chainId(42161);
        _env("arc-mainnet", safe, relayer);
        vm.expectRevert(bytes("RPC chain id does not match NETWORK"));
        script.run();

        // Mainnet owner must be a contract (the Safe), even with ALLOW_EOA_OWNER.
        vm.setEnv("ALLOW_EOA_OWNER", "true");
        _env("arbitrum-one", makeAddr("eoa"), relayer);
        vm.expectRevert(bytes("OWNER has no code: deploy the Safe on this network first"));
        script.run();

        // On a testnet ALLOW_EOA_OWNER lets an EOA own it.
        vm.chainId(421614);
        _env("arbitrum-sepolia", makeAddr("eoa"), relayer);
        assertEq(script.run().owner(), makeAddr("eoa"));
        vm.setEnv("ALLOW_EOA_OWNER", "false");

        // Roles must be separate.
        _env("arbitrum-sepolia", safe, safe);
        vm.expectRevert(bytes("a relayer cannot be the OWNER"));
        script.run();
        _env("arbitrum-sepolia", safe, feeRecipient);
        vm.expectRevert(bytes("a relayer cannot be the FEE_RECIPIENT"));
        script.run();
        _env("arbitrum-sepolia", safe, guardian);
        vm.expectRevert(bytes("a relayer cannot be the GUARDIAN"));
        script.run();
        _env("arbitrum-sepolia", safe, relayer);
        vm.setEnv("GUARDIAN", vm.toString(safe));
        vm.expectRevert(bytes("GUARDIAN and OWNER must differ"));
        script.run();
        vm.setEnv("GUARDIAN", vm.toString(feeRecipient));
        vm.expectRevert(bytes("GUARDIAN and FEE_RECIPIENT must differ"));
        script.run();
        vm.setEnv("GUARDIAN", vm.toString(address(0)));
        vm.expectRevert(bytes("GUARDIAN is required"));
        script.run();

        // Unknown network name.
        _env("arbitrum-goerli", safe, relayer);
        vm.expectRevert(bytes("unknown NETWORK"));
        script.run();
    }
}
