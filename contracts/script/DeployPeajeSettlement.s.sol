// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {PeajeSettlement} from "../src/PeajeSettlement.sol";

contract DeployPeajeSettlement is Script {
    function run() external returns (PeajeSettlement settlement) {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address feeRecipient = vm.envAddress("FEE_RECIPIENT");
        address relayer = vm.envAddress("RELAYER");
        uint16 feeBps = uint16(vm.envUint("FEE_BPS"));
        address[] memory tokens = vm.envAddress("ACCEPTED_TOKENS", ",");
        // Tope de costo de red por token, en unidades del token, alineado con ACCEPTED_TOKENS.
        uint256[] memory maxNetworkFees = vm.envUint("MAX_NETWORK_FEES", ",");
        require(maxNetworkFees.length == tokens.length, "MAX_NETWORK_FEES must match ACCEPTED_TOKENS");

        vm.startBroadcast(deployerKey);
        settlement = new PeajeSettlement(vm.addr(deployerKey), feeRecipient, feeBps);
        settlement.setRelayer(relayer, true);
        for (uint256 i; i < tokens.length; ++i) {
            settlement.setAcceptedToken(tokens[i], true, maxNetworkFees[i]);
        }
        vm.stopBroadcast();

        console.log("PeajeSettlement", address(settlement));
    }
}
