import { SuiClient } from "@mysten/sui/client";
import { Transaction } from "@mysten/sui/transactions";
import { SUIBID_PACKAGE_ID, NFT_MODULE } from "./constants";

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
 * Creates a transaction to mint a new BidNFT.
 * Based on smart contract: suibid::nft::mint_and_transfer
 *
 * @param name - The name of the NFT.
 * @param description - The description of the NFT.
 * @param imageUrl - The URL for the NFT's image.
 * @returns Transaction object ready to be signed.
 */
export function createMintNFTTransaction(
    name: string,
    description: string,
    imageUrl: string,
): Transaction {
    const tx = new Transaction();

    tx.moveCall({
        target: `${SUIBID_PACKAGE_ID}::${NFT_MODULE}::mint_and_transfer`,
        arguments: [
            tx.pure.vector("u8", Array.from(new TextEncoder().encode(name))),
            tx.pure.vector("u8", Array.from(new TextEncoder().encode(description))),
            tx.pure.vector("u8", Array.from(new TextEncoder().encode(imageUrl))),
        ],
    });

    return tx;
}

/**
 * Mints a new BidNFT (key + store) and transfers it to the connected wallet.
 * The NFT is an address-owned object that can be used in auctions.
 *
 * Smart contract function: suibid::nft::mint_and_transfer
 * NFT abilities: key + store (can be transferred and stored in other objects)
 *
 * @param signAndExecute - The signAndExecuteTransaction function from dapp-kit useSignAndExecuteTransaction hook.
 * @param name - The name of the NFT.
 * @param description - The description of the NFT.
 * @param imageUrl - The URL for the NFT's image.
 * @returns Promise with the transaction result containing digest.
 *
 * @example
 * ```tsx
 * const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();
 *
 * const result = await mintNFT(
 *   signAndExecute,
 *   "My NFT",
 *   "A cool NFT",
 *   "https://example.com/image.png"
 * );
 * console.log("Transaction digest:", result.digest);
 * ```
 */
export async function mintNFT(
    signAndExecute: (params: { transaction: Transaction }) => Promise<{ digest: string }>,
    name: string,
    description: string,
    imageUrl: string,
): Promise<{ digest: string }> {
    const tx = createMintNFTTransaction(name, description, imageUrl);
    return signAndExecute({ transaction: tx });
}

/**
 * Gets the full type string for BidNFT.
 * Use this when calling auction functions that require Item type argument.
 *
 * @returns The full type path: {PACKAGE_ID}::nft::BidNFT
 */
export function getBidNFTType(): string {
    return `${SUIBID_PACKAGE_ID}::${NFT_MODULE}::BidNFT`;
}

/**
 * Fetches and parses the details of a BidNFT object from the chain.
 * @param suiClient - The SuiClient for interacting with the RPC endpoint.
 * @param nftId - The ID of the NFT object to fetch.
 * @returns A structured BidNFT object or null if not found.
 */
export async function getNFTDetails(
    suiClient: SuiClient,
    nftId: string
): Promise<BidNFT | null> {
    try {
        const response = await suiClient.getObject({
            id: nftId,
            options: { showContent: true },
        });

        if (
            response.data?.content?.dataType !== "moveObject" ||
            !response.data.content.type?.includes("BidNFT")
        ) {
            return null;
        }

        const fields = response.data.content.fields as any;

        // Handle image_url which is a Url type in Move (stored as string or object with .url)
        const imageUrl =
            typeof fields.image_url === "string"
                ? fields.image_url
                : fields.image_url?.url || null;

        return {
            id: fields.id?.id || response.data.objectId,
            name: fields.name || "Unnamed NFT",
            description: fields.description || "",
            image_url: imageUrl || "",
            creator: fields.creator || "",
        };
    } catch (error) {
        console.error("[getNFTDetails] Error:", error);
        return null;
    }
}

/**
 * Fetches all BidNFTs owned by a specific address.
 * @param suiClient - The SuiClient for interacting with the RPC endpoint.
 * @param ownerAddress - The address to fetch NFTs for.
 * @returns Array of BidNFT objects.
 */
export async function getOwnedNFTs(
    suiClient: SuiClient,
    ownerAddress: string
): Promise<BidNFT[]> {
    try {
        const nftType = `${SUIBID_PACKAGE_ID}::${NFT_MODULE}::BidNFT`;

        const response = await suiClient.getOwnedObjects({
            owner: ownerAddress,
            filter: { StructType: nftType },
            options: { showContent: true },
        });

        const nfts: BidNFT[] = [];

        for (const item of response.data) {
            if (item.data?.content?.dataType === "moveObject") {
                const fields = item.data.content.fields as any;
                const imageUrl =
                    typeof fields.image_url === "string"
                        ? fields.image_url
                        : fields.image_url?.url || null;

                nfts.push({
                    id: fields.id?.id || item.data.objectId,
                    name: fields.name || "Unnamed NFT",
                    description: fields.description || "",
                    image_url: imageUrl || "",
                    creator: fields.creator || "",
                });
            }
        }

        return nfts;
    } catch (error) {
        console.error("[getOwnedNFTs] Error:", error);
        return [];
    }
}
