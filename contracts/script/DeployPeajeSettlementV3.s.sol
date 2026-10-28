// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {PeajeSettlementV3} from "../src/PeajeSettlementV3.sol";
import {IEIP3009} from "../src/interfaces/IEIP3009.sol";

/// @notice Deploys PeajeSettlementV3 on one network. The owner (a Safe), guardian, relayers
///         and fee recipient are set in the constructor, so the deployer key ends with no role and no
///         follow-up transaction is needed.
///
/// Env:
///   NETWORK            arbitrum-sepolia | robinhood-testnet | arc-testnet |
///                      arbitrum-one | robinhood-mainnet | arc-mainnet
///   OWNER              Safe address on this network (must have code on mainnets)
///   GUARDIAN           pause-only key (EOA or Safe), distinct from every other role
///   FEE_RECIPIENT      cold address that receives the 2% plus network fees
///   RELAYERS           comma-separated hot relayer addresses
///   ACCEPTED_TOKENS    optional, comma-separated; defaults to the network's tokens below
///   MAX_NETWORK_FEES   optional, aligned with ACCEPTED_TOKENS, in token units (6 decimals)
///   ALLOW_EOA_OWNER    optional, "true" to allow an EOA owner on a testnet only
///
/// Dry run (simulation only, nothing is sent):
///   NETWORK=arbitrum-sepolia OWNER=0x... GUARDIAN=0x... FEE_RECIPIENT=0x... RELAYERS=0x... \
///   forge script script/DeployPeajeSettlementV3.s.sol --rpc-url arbitrum_sepolia --sender 0x<deployer>
/// Real deploy adds `--broadcast --account <keystore name>` (or `--ledger`). See docs/contrato-v3.md.
contract DeployPeajeSettlementV3 is Script {
    struct Network {
        uint256 chainId;
        bool mainnet;
        address[] tokens;
        uint256[] maxNetworkFees;
    }

    function run() external returns (PeajeSettlementV3 settlement) {
        string memory name = vm.envString("NETWORK");
        Network memory net = network(name);
        require(block.chainid == net.chainId, "RPC chain id does not match NETWORK");

        address owner = vm.envAddress("OWNER");
        address guardian = vm.envAddress("GUARDIAN");
        address feeRecipient = vm.envAddress("FEE_RECIPIENT");
        address[] memory relayers = vm.envAddress("RELAYERS", ",");

        address[] memory tokens = vm.envOr("ACCEPTED_TOKENS", ",", net.tokens);
        uint256[] memory caps = vm.envOr("MAX_NETWORK_FEES", ",", net.maxNetworkFees);
        require(tokens.length == caps.length, "MAX_NETWORK_FEES must match ACCEPTED_TOKENS");

        _checkRoles(net, owner, guardian, feeRecipient, relayers);
        _checkTokens(tokens, caps);

        vm.startBroadcast();
        settlement = new PeajeSettlementV3(owner, guardian, feeRecipient, relayers, tokens, caps);
        vm.stopBroadcast();

        console.log("network        ", name);
        console.log("PeajeSettlementV3", address(settlement));
        console.log("owner          ", owner);
        console.log("guardian       ", guardian);
        console.log("feeRecipient   ", feeRecipient);
        for (uint256 i; i < relayers.length; ++i) {
            console.log("relayer        ", relayers[i]);
        }
        for (uint256 i; i < tokens.length; ++i) {
            console.log("token / cap    ", tokens[i], caps[i]);
        }
    }

    /// @notice Chain id and default tokens per network. Token addresses read from the issuers'
    ///         docs (Circle, Paxos, Arc) and checked on-chain on 2026-10-25: name, decimals = 6,
    ///         `authorizationState` present. Caps (San, 2026-10-25): $0.02 on Arbitrum and Robinhood, $0.01 on Arc,
    ///         the same on mainnet and testnet.
    function network(string memory name) public pure returns (Network memory n) {
        bytes32 id = keccak256(bytes(name));
        if (id == keccak256("arbitrum-sepolia")) {
            n = _two(
                421614, false, 0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d, 0xFFC95faa3d63Cde504a05B567C600B78C0b41892
            );
        } else if (id == keccak256("robinhood-testnet")) {
            n = _one(46630, false, 0x7E955252E15c84f5768B83c41a71F9eba181802F, 20_000);
        } else if (id == keccak256("arc-testnet")) {
            n = _one(5042002, false, 0x3600000000000000000000000000000000000000, 10_000);
        } else if (id == keccak256("arbitrum-one")) {
            n = _two(
                42161, true, 0xaf88d065e77c8cC2239327C5EDb3A432268e5831, 0x004B506865409877C9fA29bfb1ebA929984B9bbC
            );
        } else if (id == keccak256("robinhood-mainnet")) {
            n = _one(4663, true, 0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168, 20_000);
        } else if (id == keccak256("arc-mainnet")) {
            n = _one(5042, true, 0x3600000000000000000000000000000000000000, 10_000);
        } else {
            revert("unknown NETWORK");
        }
    }

    function _one(uint256 chainId, bool mainnet, address token, uint256 cap) private pure returns (Network memory n) {
        n.chainId = chainId;
        n.mainnet = mainnet;
        n.tokens = new address[](1);
        n.tokens[0] = token;
        n.maxNetworkFees = new uint256[](1);
        n.maxNetworkFees[0] = cap;
    }

    /// Arbitrum: USDC first, then USDG, both capped at $0.02.
    function _two(uint256 chainId, bool mainnet, address usdc, address usdg) private pure returns (Network memory n) {
        n.chainId = chainId;
        n.mainnet = mainnet;
        n.tokens = new address[](2);
        n.tokens[0] = usdc;
        n.tokens[1] = usdg;
        n.maxNetworkFees = new uint256[](2);
        n.maxNetworkFees[0] = 20_000;
        n.maxNetworkFees[1] = 20_000;
    }

    function _checkRoles(
        Network memory net,
        address owner,
        address guardian,
        address feeRecipient,
        address[] memory relayers
    ) internal view {
        require(relayers.length > 0, "RELAYERS is empty");
        require(owner != feeRecipient, "OWNER and FEE_RECIPIENT must differ");
        require(guardian != address(0), "GUARDIAN is required");
        require(guardian != owner, "GUARDIAN and OWNER must differ");
        require(guardian != feeRecipient, "GUARDIAN and FEE_RECIPIENT must differ");
        if (net.mainnet || !vm.envOr("ALLOW_EOA_OWNER", false)) {
            require(owner.code.length > 0, "OWNER has no code: deploy the Safe on this network first");
        }
        // En mainnet el owner es un Safe de al menos 2 de 3 (docs/contrato-v3.md): cualquier otro
        // contrato pasaba el chequeo de código, y el owner se fija en el constructor sin vuelta atrás.
        if (net.mainnet) {
            (bool okUmbral, bytes memory umbral) = owner.staticcall(abi.encodeWithSignature("getThreshold()"));
            (bool okFirmantes, bytes memory firmantes) = owner.staticcall(abi.encodeWithSignature("getOwners()"));
            require(okUmbral && okFirmantes && umbral.length == 32, "OWNER is not a Safe (no getThreshold/getOwners)");
            require(abi.decode(umbral, (uint256)) >= 2, "OWNER Safe threshold must be at least 2");
            require(abi.decode(firmantes, (address[])).length >= 3, "OWNER Safe must have at least 3 signers");
        }
        for (uint256 i; i < relayers.length; ++i) {
            require(relayers[i] != owner, "a relayer cannot be the OWNER");
            require(relayers[i] != feeRecipient, "a relayer cannot be the FEE_RECIPIENT");
            require(relayers[i] != guardian, "a relayer cannot be the GUARDIAN");
            require(relayers[i].code.length == 0, "relayers are EOAs (hot keys)");
        }
    }

    /// Every token must be a contract with EIP-3009 `authorizationState` and 6 decimals; the
    /// caps in MAX_NETWORK_FEES assume 6 decimals ($0.02 = 20000).
    function _checkTokens(address[] memory tokens, uint256[] memory caps) internal view {
        for (uint256 i; i < tokens.length; ++i) {
            require(tokens[i].code.length > 0, "token has no code on this network");
            IEIP3009(tokens[i]).authorizationState(address(1), bytes32(0));
            (bool ok, bytes memory ret) = tokens[i].staticcall(abi.encodeWithSignature("decimals()"));
            require(ok && abi.decode(ret, (uint8)) == 6, "token does not have 6 decimals: review the cap");
            require(caps[i] <= 100_000, "cap above $0.10: double check MAX_NETWORK_FEES");
        }
    }
}
