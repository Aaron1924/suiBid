module suibid::nft {
    use std::string::{Self, String};
    use sui::url::{Self, Url};
    use sui::event;

    // ──────────────────────────────────────────────
    // NFT struct - có key + store để auction được
    // ──────────────────────────────────────────────
    public struct BidNFT has key, store {
        id: UID,
        name: String,
        description: String,
        image_url: Url,
        creator: address,
    }

    // ──────────────────────────────────────────────
    // Events
    // ──────────────────────────────────────────────
    public struct NFTMinted has copy, drop {
        nft_id: ID,
        name: String,
        creator: address,
    }

    // ──────────────────────────────────────────────
    // Mint NFT
    // ──────────────────────────────────────────────
    public fun mint(
        name: vector<u8>,
        description: vector<u8>,
        image_url: vector<u8>,
        ctx: &mut TxContext,
    ): BidNFT {
        let sender = tx_context::sender(ctx);
        let uid = object::new(ctx);
        let nft_id = object::uid_to_inner(&uid);

        let nft = BidNFT {
            id: uid,
            name: string::utf8(name),
            description: string::utf8(description),
            image_url: url::new_unsafe_from_bytes(image_url),
            creator: sender,
        };

        event::emit(NFTMinted {
            nft_id,
            name: nft.name,
            creator: sender,
        });

        nft
    }

    // ──────────────────────────────────────────────
    // Entry function - Mint và transfer về creator
    // ──────────────────────────────────────────────
    public entry fun mint_and_transfer(
        name: vector<u8>,
        description: vector<u8>,
        image_url: vector<u8>,
        ctx: &mut TxContext,
    ) {
        let nft = mint(name, description, image_url, ctx);
        let sender = tx_context::sender(ctx);
        transfer::public_transfer(nft, sender);
    }

    // ──────────────────────────────────────────────
    // View functions
    // ──────────────────────────────────────────────
    public fun name(nft: &BidNFT): String {
        nft.name
    }

    public fun description(nft: &BidNFT): String {
        nft.description
    }

    public fun image_url(nft: &BidNFT): Url {
        nft.image_url
    }

    public fun creator(nft: &BidNFT): address {
        nft.creator
    }

    // ──────────────────────────────────────────────
    // Burn NFT
    // ──────────────────────────────────────────────
    public fun burn(nft: BidNFT) {
        let BidNFT {
            id,
            name: _,
            description: _,
            image_url: _,
            creator: _,
        } = nft;
        object::delete(id);
    }
}
