import { Transaction } from "@mysten/sui/transactions"
import type { SuiClient } from "@mysten/sui/client"
import { SUIBID_PACKAGE_ID, AUCTION_MODULE, SUI_CLOCK_OBJECT_ID, AUCTION_ITEM_TYPE } from "./constants"

// ──────────────────────────────────────────────
// TypeScript Interfaces
// ──────────────────────────────────────────────

export interface Auction {
  id: string
  item: string
  seller: string
  min_bid: number
  highest_bid: number
  highest_bidder: string | null
  end_time: number
  active: boolean
}

interface WalletContextState {
  address: string
  signAndExecuteTransactionBlock: (params: { transactionBlock: Transaction }) => Promise<{ digest: string }>
}

// ──────────────────────────────────────────────
// Transaction Builders (return Transaction objects)
// ──────────────────────────────────────────────

/**
 * Creates a Transaction for creating a new auction.
 */
export function createAuctionTx(
  itemId: string,
  itemType: string = AUCTION_ITEM_TYPE,
  minBid: number | bigint,
  durationMs: number | bigint,
): Transaction {
  const tx = new Transaction()

  tx.moveCall({
    target: `${SUIBID_PACKAGE_ID}::${AUCTION_MODULE}::create_auction`,
    arguments: [tx.object(itemId), tx.pure.u64(minBid), tx.pure.u64(durationMs), tx.object(SUI_CLOCK_OBJECT_ID)],
    typeArguments: [itemType],
  })

  return tx
}

/**
 * Creates a Transaction for placing a bid on an auction.
 */
export function placeBidTx(
  auctionId: string,
  bidAmount: number | bigint,
  itemType: string = AUCTION_ITEM_TYPE,
): Transaction {
  const tx = new Transaction()

  const [bidCoin] = tx.splitCoins(tx.gas, [tx.pure.u64(bidAmount)])

  tx.moveCall({
    target: `${SUIBID_PACKAGE_ID}::${AUCTION_MODULE}::place_bid`,
    arguments: [tx.object(auctionId), bidCoin, tx.object(SUI_CLOCK_OBJECT_ID)],
    typeArguments: [itemType],
  })

  return tx
}

/**
 * Creates a Transaction for settling/ending an auction.
 */
export function settleAuctionTx(auctionId: string, itemType: string = AUCTION_ITEM_TYPE): Transaction {
  const tx = new Transaction()

  tx.moveCall({
    target: `${SUIBID_PACKAGE_ID}::${AUCTION_MODULE}::end_auction`,
    arguments: [tx.object(auctionId), tx.object(SUI_CLOCK_OBJECT_ID)],
    typeArguments: [itemType],
  })

  return tx
}

/**
 * Creates a Transaction for claiming the item or funds.
 */
export function claimTx(auctionId: string, itemType: string = AUCTION_ITEM_TYPE): Transaction {
  const tx = new Transaction()

  tx.moveCall({
    target: `${SUIBID_PACKAGE_ID}::${AUCTION_MODULE}::claim`,
    arguments: [tx.object(auctionId)],
    typeArguments: [itemType],
  })

  return tx
}

/**
 * Creates a Transaction for withdrawing a bid.
 */
export function withdrawTx(auctionId: string, itemType: string = AUCTION_ITEM_TYPE): Transaction {
  const tx = new Transaction()

  tx.moveCall({
    target: `${SUIBID_PACKAGE_ID}::${AUCTION_MODULE}::withdraw`,
    arguments: [tx.object(auctionId)],
    typeArguments: [itemType],
  })

  return tx
}

// ──────────────────────────────────────────────
// ──────────────────────────────────────────────

/**
 * Places a bid on an auction (signs and executes).
 */
export async function placeBid(
  wallet: WalletContextState,
  _suiClient: SuiClient,
  auctionId: string,
  itemType: string,
  bidAmount: number | bigint,
): Promise<{ digest: string }> {
  const tx = placeBidTx(auctionId, bidAmount, itemType)
  return wallet.signAndExecuteTransactionBlock({ transactionBlock: tx })
}

/**
 * Ends an auction (signs and executes).
 */
export async function endAuction(
  wallet: WalletContextState,
  auctionId: string,
  itemType: string,
): Promise<{ digest: string }> {
  const tx = settleAuctionTx(auctionId, itemType)
  return wallet.signAndExecuteTransactionBlock({ transactionBlock: tx })
}

/**
 * Claims the item (winner) or funds (seller) from an ended auction.
 */
export async function claim(
  wallet: WalletContextState,
  auctionId: string,
  itemType: string,
): Promise<{ digest: string }> {
  const tx = claimTx(auctionId, itemType)
  return wallet.signAndExecuteTransactionBlock({ transactionBlock: tx })
}

/**
 * Withdraws a losing bid from an ended auction.
 */
export async function withdraw(
  wallet: WalletContextState,
  auctionId: string,
  itemType: string,
): Promise<{ digest: string }> {
  const tx = withdrawTx(auctionId, itemType)
  return wallet.signAndExecuteTransactionBlock({ transactionBlock: tx })
}
