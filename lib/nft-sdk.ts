
import { SuiClient } from "@mysten/sui/client";
import { TransactionBlock } from "@mysten/sui/transactions";
import { WalletContextState } from "@mysten/dapp-kit";

// ──────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────

// TODO: Replace with your actual deployed package ID.
// This should be the same as the package ID for your auction module if deployed together.
const PACKAGE_ID = "0x...YOUR_PACKAGE_ID";
const NFT_MODULE = "nft";

// ──────────────────────────────────────────────
// TypeScript Interfaces
// ──────────────────────────────────────────────

// Represents the on-chain 'BidNFT' struct.
export interface BidNFT {
    id: string;
    name: string;
    description: string;
    image_url: string;
    creator: string;
}

// ──────────────────────────────────────────────
// Core SDK Functions
// ──────────────────────────────────────────────

/**
 * Mints a new BidNFT and transfers it to the creator.
 * @param wallet - The connected wallet instance.
 * @param name - The name of the NFT.
 * @param description - The description of the NFT.
 * @param image_url - The URL for the NFT's image.
 */
export async function mintAndTransferNFT(
    wallet: WalletContextState,
    name: string,
    description: string,
    image_url: string,
) {
    if (!wallet.account) {
        throw new Error("Wallet not connected");
    }

    const txb = new TransactionBlock();

    txb.moveCall({
        target: `${PACKAGE_ID}::${NFT_MODULE}::mint_and_transfer`,
        arguments: [
            txb.pure(Array.from(new TextEncoder().encode(name)), 'vector<u8>'),
            txb.pure(Array.from(new TextEncoder().encode(description)), 'vector<u8>'),
            txb.pure(Array.from(new TextEncoder().encode(image_url)), 'vector<u8>'),
        ],
    });

    return wallet.signAndExecuteTransactionBlock({
        transactionBlock: txb,
    });
}

/**
 * Fetches and parses the details of a BidNFT object from the chain.
 * @param suiClient - The SuiClient for interacting with the RPC endpoint.
 * @param nft_id - The ID of the NFT object to fetch.
 * @returns A structured BidNFT object or null if not found.
 */
export async function getNFTDetails(
    suiClient: SuiClient,
    nft_id: string
): Promise<BidNFT | null> {
    const response = await suiClient.getObject({
        id: nft_id,
        options: { showContent: true },
    });

    if (response.data?.content?.dataType !== 'moveObject' || response.data.content.type?.indexOf('BidNFT') === -1) {
        return null;
    }

    const fields = response.data.content.fields as any;

    return {
        id: fields.id.id,
        name: fields.name,
        description: fields.description,
        image_url: fields.image_url.url,
        creator: fields.creator,
    };
}
