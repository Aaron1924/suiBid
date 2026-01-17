import { SuiClient } from "@mysten/sui/client";
import { TransactionBlock } from "@mysten/sui/transactions";
import { WalletContextState } from "@mysten/dapp-kit";

// ──────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────

// TODO: Replace with your actual deployed package ID and module name.
// You can find this in the `smart-contract/Published.toml` file after deployment.
const PACKAGE_ID = "0x...YOUR_PACKAGE_ID";
const AUCTION_MODULE = "auction";

// ──────────────────────────────────────────────
// TypeScript Interfaces
// ──────────────────────────────────────────────

// Represents the on-chain 'Auction' struct.
export interface Auction {
    id: string;
    item: string; // This will be the ID of the NFT or other item.
    seller: string;
    min_bid: number;
    highest_bid: number;
    highest_bidder: string | null;
    end_time: number;
    active: boolean;
}

// ──────────────────────────────────────────────
// Core SDK Functions
// ──────────────────────────────────────────────

/**
<<<<<<< HEAD
 * Creates a new auction for a given item.
 * @param wallet - The connected wallet instance.
 * @param item_id - The object ID of the item to be auctioned.
 * @param itemType - The Move type of the item being auctioned (e.g., '0x...::nft::BidNFT').
 * @param min_bid - The minimum starting bid in MIST.
 * @param duration_ms - The duration of the auction in milliseconds.
=======
 * Tạo Transaction Block để kết thúc đấu giá (Settlement).
 * NFT sẽ được chuyển từ Auction Object -> Winner.
 *
 * @param itemType Loại của NFT
 * @param auctionId ID phiên đấu giá
>>>>>>> e9c5719ef813abd880f9d85bb017304ed820c44d
 */
export async function createAuction(
    wallet: WalletContextState,
    item_id: string,
    itemType: string,
    min_bid: number,
    duration_ms: number,
) {
    if (!wallet.account) {
        throw new Error("Wallet not connected");
    }

    const txb = new TransactionBlock();

    txb.moveCall({
        target: `${PACKAGE_ID}::${AUCTION_MODULE}::create_auction`,
        arguments: [
            txb.object(item_id),
            txb.pure(min_bid, 'u64'),
            txb.pure(duration_ms, 'u64'),
            txb.object('0x6') // sui::clock::CLOCK
        ],
        typeArguments: [itemType],
    });

    return wallet.signAndExecuteTransactionBlock({
        transactionBlock: txb,
    });
}

/**
 * Places a bid on an active auction.
 * @param wallet - The connected wallet instance.
 * @param suiClient - The SuiClient instance for fetching coins.
 * @param auction_id - The object ID of the auction.
 * @param bid_amount - The amount to bid in MIST.
 */
export async function placeBid(
    wallet: WalletContextState,
    suiClient: SuiClient,
    auction_id: string,
    bid_amount: number,
) {
    if (!wallet.account) {
        throw new Error("Wallet not connected");
    }

    const txb = new TransactionBlock();

    // Get a coin for the bid
    const { data: coins } = await suiClient.getCoins({
        owner: wallet.account.address,
        coinType: '0x2::sui::SUI',
    });

    const [bid_coin] = txb.splitCoins(txb.object(coins[0].coinObjectId), [txb.pure(bid_amount)]);

    txb.moveCall({
        target: `${PACKAGE_ID}::${AUCTION_MODULE}::place_bid`,
        arguments: [
            txb.object(auction_id),
            bid_coin,
            txb.object('0x6') // sui::clock::CLOCK
        ],
        typeArguments: [ITEM_TYPE],
    });

    return wallet.signAndExecuteTransactionBlock({
        transactionBlock: txb,
    });
}

/**
 * Ends an auction after its end_time has passed.
 * @param wallet - The connected wallet instance.
 * @param auction_id - The object ID of the auction to end.
 */
export async function endAuction(
    wallet: WalletContextState,
    auction_id: string
) {
    if (!wallet.account) {
        throw new Error("Wallet not connected");
    }

    const txb = new TransactionBlock();

    txb.moveCall({
        target: `${PACKAGE_ID}::${AUCTION_MODULE}::end_auction`,
        arguments: [
            txb.object(auction_id),
            txb.object('0x6') // sui::clock::CLOCK
        ],
        typeArguments: [ITEM_TYPE],
    });

    return wallet.signAndExecuteTransactionBlock({
        transactionBlock: txb,
    });
}

/**
 * Claims the item (if winner) or the funds (if seller).
 * @param wallet - The connected wallet instance.
 * @param auction_id - The object ID of the ended auction.
 */
export async function claim(
    wallet: WalletContextState,
    auction_id: string
) {
    if (!wallet.account) {
        throw new Error("Wallet not connected");
    }

    const txb = new TransactionBlock();

    txb.moveCall({
        target: `${PACKAGE_ID}::${AUCTION_MODULE}::claim`,
        arguments: [
            txb.object(auction_id)
        ],
        typeArguments: [ITEM_TYPE],
    });

    return wallet.signAndExecuteTransactionBlock({
        transactionBlock: txb,
    });
}

/**
 * Withdraws a bid for non-winning bidders after the auction has ended.
 * @param wallet - The connected wallet instance.
 * @param auction_id - The object ID of the ended auction.
 */
export async function withdraw(
    wallet: WalletContextState,
    auction_id: string
) {
    if (!wallet.account) {
        throw new Error("Wallet not connected");
    }

    const txb = new TransactionBlock();

    txb.moveCall({
        target: `${PACKAGE_ID}::${AUCTION_MODULE}::withdraw`,
        arguments: [
            txb.object(auction_id)
        ],
        typeArguments: [ITEM_TYPE],
    });

    return wallet.signAndExecuteTransactionBlock({
        transactionBlock: txb,
    });
}


/**
 * Fetches and parses the details of an auction object from the chain.
 * @param suiClient - The SuiClient for interacting with the RPC endpoint.
 * @param auction_id - The ID of the auction object to fetch.
 * @returns A structured Auction object or null if not found.
 */
export async function getAuctionDetails(
    suiClient: SuiClient,
    auction_id: string
): Promise<Auction | null> {
    const response = await suiClient.getObject({
        id: auction_id,
        options: { showContent: true },
    });

    if (response.data?.content?.dataType !== 'moveObject') {
        return null;
    }

    const fields = response.data.content.fields as any;

    return {
        id: fields.id.id,
        item: fields.item.fields.id.id, // Assuming the item is an object with an ID
        seller: fields.seller,
        min_bid: parseInt(fields.min_bid, 10),
        highest_bid: parseInt(fields.highest_bid, 10),
        highest_bidder: fields.highest_bidder.fields.vec[0] || null, // Option<address> is a vector
        end_time: parseInt(fields.end_time, 10),
        active: fields.active,
    };
}