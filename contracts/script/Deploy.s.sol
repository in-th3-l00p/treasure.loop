// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";

import {TreasureLoopBadge} from "../src/TreasureLoopBadge.sol";

/**
 * Deploy script for TreasureLoopBadge.
 *
 * Usage:
 *   forge script script/Deploy.s.sol \
 *     --rpc-url $BASE_SEPOLIA_RPC \
 *     --private-key $DEPLOYER_KEY \
 *     --broadcast --verify
 *
 * Required env:
 *   BADGE_OWNER     — multisig or EOA that controls signer rotation + pause
 *   BADGE_SIGNER    — address derived from the webapp's BADGE_SIGNER_PRIVATE_KEY
 *   BADGE_BASE_URI  — e.g. https://treasure.loop/api/badge-metadata/
 */
contract Deploy is Script {
    function run() external returns (TreasureLoopBadge badge) {
        address owner = vm.envAddress("BADGE_OWNER");
        address signer = vm.envAddress("BADGE_SIGNER");
        string memory baseURI = vm.envString("BADGE_BASE_URI");

        vm.startBroadcast();
        badge = new TreasureLoopBadge(owner, signer, baseURI);
        vm.stopBroadcast();

        console.log("TreasureLoopBadge deployed at:", address(badge));
        console.log("  owner :", owner);
        console.log("  signer:", signer);
        console.log("  baseURI:", baseURI);
    }
}
