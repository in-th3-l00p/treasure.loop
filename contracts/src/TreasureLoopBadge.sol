// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/**
 * @title TreasureLoopBadge
 * @notice ERC-721 finisher badge for a single TreasureLoop event.
 *
 * Mint flow
 * ─────────
 *   1. The off-chain server verifies that `player` has scanned every
 *      checkpoint in the event.
 *   2. The server (configured as `signer` here) issues an EIP-712 signed
 *      `MintPermit` for `player` with a unique `nonce`.
 *   3. `player` calls `mint(permit, signature)` on this contract from
 *      their own wallet — paying gas — and receives token #N.
 *
 * Properties
 * ──────────
 *   • One badge per address. The contract reverts on double-mint.
 *   • Permits are single-use. The nonce is consumed on success.
 *   • The owner can rotate the trusted signer (server key compromise
 *     recovery) and can pause new mints at the end of the event.
 *   • baseURI points at the metadata service; tokenURI uses tokenId.
 *   • SOULBOUND: the badge is non-transferable. Once minted to a player
 *     it can never move to another wallet. This is a deliberate
 *     anti-farming measure — the badge gates physical prizes, so a
 *     transferable badge could be sold or reused to farm prizes. Only
 *     minting (from the zero address) is permitted; every owner-to-owner
 *     transfer reverts with {BadgeIsSoulbound}. No burn path is exposed.
 *     `balanceOf`, `ownerOf`, and `tokenURI` continue to work normally
 *     so the prize desk can verify eligibility.
 */
contract TreasureLoopBadge is ERC721, Ownable, EIP712 {
    error AlreadyMinted();
    error InvalidSignature();
    error NonceAlreadyUsed();
    error MintingDisabled();
    error PlayerMismatch();
    /// @notice Thrown on any attempt to transfer a badge between owners.
    error BadgeIsSoulbound();

    event SignerRotated(address indexed previous, address indexed next);
    event MintingPaused(bool paused);
    event BadgeMinted(
        address indexed player,
        uint256 indexed tokenId,
        bytes32 indexed nonce
    );

    bytes32 private constant MINT_PERMIT_TYPEHASH =
        keccak256(
            "MintPermit(address player,uint256 chainId,bytes32 nonce,uint256 deadline)"
        );

    address public signer;
    string private _baseTokenURI;
    bool public mintingPaused;
    uint256 public totalMinted;

    mapping(address => bool) public hasMinted;
    mapping(bytes32 => bool) public usedNonces;

    constructor(
        address initialOwner,
        address initialSigner,
        string memory baseURI_
    ) ERC721("TreasureLoop Finisher", "LOOP") Ownable(initialOwner) EIP712("TreasureLoop", "1") {
        signer = initialSigner;
        _baseTokenURI = baseURI_;
    }

    function _baseURI() internal view override returns (string memory) {
        return _baseTokenURI;
    }

    /**
     * @notice Soulbound enforcement: the badge cannot be transferred between
     *         owners. Overrides the OZ v5 ERC-721 `_update` hook, through
     *         which all mints, burns, and transfers flow.
     * @dev `from` (the current owner returned by the base `_update`) is the
     *      zero address only for a mint. Any call where the token already has
     *      an owner is an owner-to-owner transfer and reverts. No burn path is
     *      exposed by this contract, so we do not special-case `to == 0`.
     */
    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal override returns (address) {
        address from = super._update(to, tokenId, auth);
        if (from != address(0)) revert BadgeIsSoulbound();
        return from;
    }

    function setBaseURI(string calldata uri) external onlyOwner {
        _baseTokenURI = uri;
    }

    function setSigner(address next) external onlyOwner {
        emit SignerRotated(signer, next);
        signer = next;
    }

    function setMintingPaused(bool paused) external onlyOwner {
        mintingPaused = paused;
        emit MintingPaused(paused);
    }

    /**
     * @notice Mint the caller's badge using a server-issued permit.
     * @dev The caller must be `permit.player`; the server signed for
     *      that specific address so a third party can't relay the
     *      permit on another player's behalf.
     */
    function mint(
        MintPermit calldata permit,
        bytes calldata signature
    ) external returns (uint256 tokenId) {
        if (mintingPaused) revert MintingDisabled();
        if (msg.sender != permit.player) revert PlayerMismatch();
        if (block.timestamp > permit.deadline) revert InvalidSignature();
        if (permit.chainId != block.chainid) revert InvalidSignature();
        if (hasMinted[permit.player]) revert AlreadyMinted();
        if (usedNonces[permit.nonce]) revert NonceAlreadyUsed();

        bytes32 structHash = keccak256(
            abi.encode(
                MINT_PERMIT_TYPEHASH,
                permit.player,
                permit.chainId,
                permit.nonce,
                permit.deadline
            )
        );
        bytes32 digest = _hashTypedDataV4(structHash);
        address recovered = ECDSA.recover(digest, signature);
        if (recovered != signer) revert InvalidSignature();

        usedNonces[permit.nonce] = true;
        hasMinted[permit.player] = true;
        unchecked {
            tokenId = ++totalMinted;
        }
        _safeMint(permit.player, tokenId);
        emit BadgeMinted(permit.player, tokenId, permit.nonce);
    }

    struct MintPermit {
        address player;
        uint256 chainId;
        bytes32 nonce;
        uint256 deadline;
    }
}
