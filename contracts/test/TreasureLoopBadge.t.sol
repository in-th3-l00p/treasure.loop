// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {TreasureLoopBadge} from "../src/TreasureLoopBadge.sol";

contract TreasureLoopBadgeTest is Test {
    TreasureLoopBadge internal badge;
    address internal owner = makeAddr("owner");
    address internal player = makeAddr("player");
    address internal otherPlayer = makeAddr("otherPlayer");

    uint256 internal signerKey;
    address internal signer;
    uint256 internal attackerKey;
    address internal attacker;

    bytes32 internal constant MINT_PERMIT_TYPEHASH = keccak256(
        "MintPermit(address player,uint256 chainId,bytes32 nonce,uint256 deadline)"
    );

    function setUp() public {
        signerKey = 0xA11CE;
        signer = vm.addr(signerKey);
        attackerKey = 0xBADC0FFEE;
        attacker = vm.addr(attackerKey);

        badge = new TreasureLoopBadge(owner, signer, "https://treasure.loop/badge/");
    }

    // ─────────────────────────── happy path ───────────────────────────

    function test_mint_happyPath_assignsTokenAndMarksMinted() public {
        bytes32 nonce = keccak256("nonce-1");
        uint256 deadline = block.timestamp + 30 minutes;
        TreasureLoopBadge.MintPermit memory permit = TreasureLoopBadge.MintPermit({
            player: player,
            chainId: block.chainid,
            nonce: nonce,
            deadline: deadline
        });
        bytes memory sig = _signPermit(signerKey, permit);

        vm.prank(player);
        uint256 tokenId = badge.mint(permit, sig);

        assertEq(tokenId, 1, "first token id is 1");
        assertEq(badge.ownerOf(tokenId), player, "player owns the token");
        assertTrue(badge.hasMinted(player), "hasMinted flag set");
        assertTrue(badge.usedNonces(nonce), "nonce burned");
        assertEq(badge.totalMinted(), 1, "totalMinted = 1");
    }

    function test_mint_emitsEvents() public {
        bytes32 nonce = keccak256("nonce-event");
        TreasureLoopBadge.MintPermit memory permit = _newPermit(player, nonce);
        bytes memory sig = _signPermit(signerKey, permit);

        vm.expectEmit(true, true, true, true);
        emit TreasureLoopBadge.BadgeMinted(player, 1, nonce);

        vm.prank(player);
        badge.mint(permit, sig);
    }

    function test_mint_secondPlayerGetsTokenTwo() public {
        TreasureLoopBadge.MintPermit memory p1 = _newPermit(player, keccak256("n1"));
        TreasureLoopBadge.MintPermit memory p2 = _newPermit(otherPlayer, keccak256("n2"));

        vm.prank(player);
        badge.mint(p1, _signPermit(signerKey, p1));
        vm.prank(otherPlayer);
        uint256 second = badge.mint(p2, _signPermit(signerKey, p2));

        assertEq(second, 2, "second mint is token 2");
        assertEq(badge.totalMinted(), 2);
    }

    function test_tokenURI_concatenatesBaseAndId() public {
        TreasureLoopBadge.MintPermit memory permit = _newPermit(player, keccak256("uri"));
        vm.prank(player);
        uint256 tokenId = badge.mint(permit, _signPermit(signerKey, permit));
        assertEq(badge.tokenURI(tokenId), "https://treasure.loop/badge/1");
    }

    // ─────────────────────────── sad paths ───────────────────────────

    function test_mint_revertsWhenCallerIsNotPlayer() public {
        TreasureLoopBadge.MintPermit memory permit = _newPermit(player, keccak256("nope"));
        bytes memory sig = _signPermit(signerKey, permit);

        vm.prank(otherPlayer);
        vm.expectRevert(TreasureLoopBadge.PlayerMismatch.selector);
        badge.mint(permit, sig);
    }

    function test_mint_revertsWhenSignatureFromAttacker() public {
        TreasureLoopBadge.MintPermit memory permit = _newPermit(player, keccak256("atk"));
        bytes memory badSig = _signPermit(attackerKey, permit);

        vm.prank(player);
        vm.expectRevert(TreasureLoopBadge.InvalidSignature.selector);
        badge.mint(permit, badSig);
    }

    function test_mint_revertsAfterDeadline() public {
        TreasureLoopBadge.MintPermit memory permit = TreasureLoopBadge.MintPermit({
            player: player,
            chainId: block.chainid,
            nonce: keccak256("expired"),
            deadline: block.timestamp + 60
        });
        bytes memory sig = _signPermit(signerKey, permit);
        vm.warp(block.timestamp + 120);

        vm.prank(player);
        vm.expectRevert(TreasureLoopBadge.InvalidSignature.selector);
        badge.mint(permit, sig);
    }

    function test_mint_revertsOnWrongChainId() public {
        TreasureLoopBadge.MintPermit memory permit = TreasureLoopBadge.MintPermit({
            player: player,
            chainId: 999_999,
            nonce: keccak256("chain"),
            deadline: block.timestamp + 30 minutes
        });
        bytes memory sig = _signPermit(signerKey, permit);

        vm.prank(player);
        vm.expectRevert(TreasureLoopBadge.InvalidSignature.selector);
        badge.mint(permit, sig);
    }

    function test_mint_revertsOnReuseSameNonce() public {
        bytes32 nonce = keccak256("once");
        TreasureLoopBadge.MintPermit memory permit = _newPermit(player, nonce);
        bytes memory sig = _signPermit(signerKey, permit);

        vm.prank(player);
        badge.mint(permit, sig);

        // Same player tries again with same permit → hasMinted check fires first
        vm.prank(player);
        vm.expectRevert(TreasureLoopBadge.AlreadyMinted.selector);
        badge.mint(permit, sig);
    }

    function test_mint_revertsWhenAnotherPlayerReplaysNonce() public {
        bytes32 nonce = keccak256("shared-nonce");
        TreasureLoopBadge.MintPermit memory p1 = _newPermit(player, nonce);
        vm.prank(player);
        badge.mint(p1, _signPermit(signerKey, p1));

        TreasureLoopBadge.MintPermit memory p2 = _newPermit(otherPlayer, nonce);
        vm.prank(otherPlayer);
        vm.expectRevert(TreasureLoopBadge.NonceAlreadyUsed.selector);
        badge.mint(p2, _signPermit(signerKey, p2));
    }

    function test_mint_revertsWhenPaused() public {
        TreasureLoopBadge.MintPermit memory permit = _newPermit(player, keccak256("paused"));
        bytes memory sig = _signPermit(signerKey, permit);

        vm.prank(owner);
        badge.setMintingPaused(true);

        vm.prank(player);
        vm.expectRevert(TreasureLoopBadge.MintingDisabled.selector);
        badge.mint(permit, sig);
    }

    // ─────────────────────────── admin ───────────────────────────

    function test_setSigner_onlyOwner() public {
        address newSigner = makeAddr("newSigner");

        vm.expectRevert();
        badge.setSigner(newSigner);

        vm.prank(owner);
        badge.setSigner(newSigner);
        assertEq(badge.signer(), newSigner);
    }

    function test_setBaseURI_onlyOwner() public {
        TreasureLoopBadge.MintPermit memory permit = _newPermit(player, keccak256("uri2"));
        vm.prank(player);
        badge.mint(permit, _signPermit(signerKey, permit));

        vm.prank(owner);
        badge.setBaseURI("https://other.example/");
        assertEq(badge.tokenURI(1), "https://other.example/1");

        vm.expectRevert();
        badge.setBaseURI("https://attacker/");
    }

    function test_pauseToggleEmitsEvent() public {
        vm.expectEmit(false, false, false, true);
        emit TreasureLoopBadge.MintingPaused(true);
        vm.prank(owner);
        badge.setMintingPaused(true);
    }

    // ─────────────────────────── fuzz ─────────────────────────────

    function testFuzz_mint_anyPlayer_anyNonce(address fuzzedPlayer, bytes32 nonce) public {
        vm.assume(fuzzedPlayer != address(0));
        // skip contract addresses that can't receive ERC-721
        vm.assume(fuzzedPlayer.code.length == 0);
        // Disambiguate from the per-test fixtures
        vm.assume(fuzzedPlayer != player && fuzzedPlayer != otherPlayer);

        TreasureLoopBadge.MintPermit memory permit = _newPermit(fuzzedPlayer, nonce);
        bytes memory sig = _signPermit(signerKey, permit);

        vm.prank(fuzzedPlayer);
        uint256 tokenId = badge.mint(permit, sig);
        assertEq(badge.ownerOf(tokenId), fuzzedPlayer);
        assertTrue(badge.hasMinted(fuzzedPlayer));
        assertTrue(badge.usedNonces(nonce));
    }

    // ─────────────────────────── helpers ───────────────────────────

    function _newPermit(address p, bytes32 nonce)
        internal
        view
        returns (TreasureLoopBadge.MintPermit memory)
    {
        return TreasureLoopBadge.MintPermit({
            player: p,
            chainId: block.chainid,
            nonce: nonce,
            deadline: block.timestamp + 30 minutes
        });
    }

    function _signPermit(uint256 key, TreasureLoopBadge.MintPermit memory permit)
        internal
        view
        returns (bytes memory)
    {
        bytes32 domainSeparator = _domainSeparator();
        bytes32 structHash = keccak256(
            abi.encode(
                MINT_PERMIT_TYPEHASH,
                permit.player,
                permit.chainId,
                permit.nonce,
                permit.deadline
            )
        );
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, digest);
        return abi.encodePacked(r, s, v);
    }

    function _domainSeparator() internal view returns (bytes32) {
        return keccak256(
            abi.encode(
                keccak256(
                    "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
                ),
                keccak256(bytes("TreasureLoop")),
                keccak256(bytes("1")),
                block.chainid,
                address(badge)
            )
        );
    }
}
