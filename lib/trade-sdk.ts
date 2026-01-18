import { Transaction } from "@mysten/sui/transactions"
import type { SuiClient } from "@mysten/sui/client"
import { SUIBID_PACKAGE_ID, SUI_CLOCK_OBJECT_ID, REWARDS_REGISTRY_ID } from "./constants"

export const TRADE_MODULE = "trade"

// ──────────────────────────────────────────────
// TypeScript Interfaces
// ──────────────────────────────────────────────

export interface Trade {
  id: string
  seller: string
  end_time: number
  active: boolean
  offer_count: number
}

export interface Offer {
  id: string
  buyer: string
  offer_index: number
}

export interface TradeItem {
  id: string
  name: string
  description: string
  image_url: string | null
  type: string
}

interface WalletContextState {
  address: string
  signAndExecuteTransaction: (params: { transaction: Transaction }) => Promise<{ digest: string }>
}

// ──────────────────────────────────────────────
// Transaction Builders
// ──────────────────────────────────────────────

/**
 * Creates a Transaction for creating a new trade.
 */
export function createTradeTx(endTimeMs: number | bigint): Transaction {
  const tx = new Transaction()

  tx.moveCall({
    target: `${SUIBID_PACKAGE_ID}::${TRADE_MODULE}::create_trade`,
    arguments: [
      tx.pure.u64(endTimeMs),
      tx.object(SUI_CLOCK_OBJECT_ID),
    ],
  })

  return tx
}

/**
 * Creates a Transaction for adding seller's item to trade.
 */
export function addSellerItemTx(
  tradeId: string,
  itemId: string,
  itemType: string,
): Transaction {
  const tx = new Transaction()

  tx.moveCall({
    target: `${SUIBID_PACKAGE_ID}::${TRADE_MODULE}::add_seller_item`,
    arguments: [
      tx.object(tradeId),
      tx.object(itemId),
    ],
    typeArguments: [itemType],
  })

  return tx
}

/**
 * Creates a Transaction for placing an offer on a trade.
 */
export function placeOfferTx(tradeId: string): Transaction {
  const tx = new Transaction()

  tx.moveCall({
    target: `${SUIBID_PACKAGE_ID}::${TRADE_MODULE}::place_offer`,
    arguments: [
      tx.object(tradeId),
      tx.object(SUI_CLOCK_OBJECT_ID),
    ],
  })

  return tx
}

/**
 * Creates a Transaction for adding buyer's item to their offer.
 */
export function addBuyerItemTx(
  tradeId: string,
  offerIndex: number | bigint,
  itemId: string,
  itemType: string,
): Transaction {
  const tx = new Transaction()

  tx.moveCall({
    target: `${SUIBID_PACKAGE_ID}::${TRADE_MODULE}::add_buyer_item`,
    arguments: [
      tx.object(tradeId),
      tx.pure.u64(offerIndex),
      tx.object(itemId),
    ],
    typeArguments: [itemType],
  })

  return tx
}

/**
 * Creates a Transaction for accepting an offer.
 * Requires specifying both seller's item type and buyer's item type.
 */
export function acceptOfferTx(
  tradeId: string,
  offerIndex: number | bigint,
  sellerItemType: string,
  buyerItemType: string,
): Transaction {
  const tx = new Transaction()

  if (!REWARDS_REGISTRY_ID) {
    throw new Error("REWARDS_REGISTRY_ID is not configured. Please set NEXT_PUBLIC_REWARDS_REGISTRY_ID in your .env file.")
  }

  tx.moveCall({
    target: `${SUIBID_PACKAGE_ID}::${TRADE_MODULE}::accept_offer`,
    arguments: [
      tx.object(tradeId),
      tx.pure.u64(offerIndex),
      tx.object(SUI_CLOCK_OBJECT_ID),
      tx.object(REWARDS_REGISTRY_ID),
    ],
    typeArguments: [sellerItemType, buyerItemType],
  })

  return tx
}

/**
 * Creates a Transaction for canceling a trade.
 */
export function cancelTradeTx(
  tradeId: string,
  sellerItemType: string,
  buyerItemType: string,
): Transaction {
  const tx = new Transaction()

  tx.moveCall({
    target: `${SUIBID_PACKAGE_ID}::${TRADE_MODULE}::cancel_trade`,
    arguments: [tx.object(tradeId)],
    typeArguments: [sellerItemType, buyerItemType],
  })

  return tx
}

/**
 * Creates a Transaction for withdrawing an offer.
 */
export function withdrawOfferTx(
  tradeId: string,
  offerIndex: number | bigint,
  itemType: string,
): Transaction {
  const tx = new Transaction()

  tx.moveCall({
    target: `${SUIBID_PACKAGE_ID}::${TRADE_MODULE}::withdraw_offer`,
    arguments: [
      tx.object(tradeId),
      tx.pure.u64(offerIndex),
    ],
    typeArguments: [itemType],
  })

  return tx
}

// ──────────────────────────────────────────────
// Combined Transactions (Create + Add Items)
// ──────────────────────────────────────────────

/**
 * Creates a trade and adds multiple items in a single transaction.
 */
export function createTradeWithItemsTx(
  endTimeMs: number | bigint,
  items: { id: string; type: string }[],
): Transaction {
  const tx = new Transaction()

  // Create trade and get the Trade object
  const [trade] = tx.moveCall({
    target: `${SUIBID_PACKAGE_ID}::${TRADE_MODULE}::create_trade`,
    arguments: [
      tx.pure.u64(endTimeMs),
      tx.object(SUI_CLOCK_OBJECT_ID),
    ],
  })

  // Add each item to the trade
  for (const item of items) {
    tx.moveCall({
      target: `${SUIBID_PACKAGE_ID}::${TRADE_MODULE}::add_seller_item`,
      arguments: [trade, tx.object(item.id)],
      typeArguments: [item.type],
    })
  }

  // Share the trade object
  tx.moveCall({
    target: "0x2::transfer::public_share_object",
    arguments: [trade],
    typeArguments: [`${SUIBID_PACKAGE_ID}::${TRADE_MODULE}::Trade`],
  })

  return tx
}

/**
 * Places an offer and adds multiple items in a single transaction.
 */
export function placeOfferWithItemsTx(
  tradeId: string,
  currentOfferCount: number,
  items: { id: string; type: string }[],
): Transaction {
  const tx = new Transaction()

  // Place offer
  tx.moveCall({
    target: `${SUIBID_PACKAGE_ID}::${TRADE_MODULE}::place_offer`,
    arguments: [
      tx.object(tradeId),
      tx.object(SUI_CLOCK_OBJECT_ID),
    ],
  })

  // Add each item to the offer
  // The offer_index will be currentOfferCount (since it's 0-indexed and incremented after)
  for (const item of items) {
    tx.moveCall({
      target: `${SUIBID_PACKAGE_ID}::${TRADE_MODULE}::add_buyer_item`,
      arguments: [
        tx.object(tradeId),
        tx.pure.u64(currentOfferCount),
        tx.object(item.id),
      ],
      typeArguments: [item.type],
    })
  }

  return tx
}

// ──────────────────────────────────────────────
// Execution Functions
// ──────────────────────────────────────────────

export async function createTrade(
  wallet: WalletContextState,
  endTimeMs: number | bigint,
): Promise<{ digest: string }> {
  const tx = createTradeTx(endTimeMs)
  return wallet.signAndExecuteTransaction({ transaction: tx })
}

export async function addSellerItem(
  wallet: WalletContextState,
  tradeId: string,
  itemId: string,
  itemType: string,
): Promise<{ digest: string }> {
  const tx = addSellerItemTx(tradeId, itemId, itemType)
  return wallet.signAndExecuteTransaction({ transaction: tx })
}

export async function placeOffer(
  wallet: WalletContextState,
  tradeId: string,
): Promise<{ digest: string }> {
  const tx = placeOfferTx(tradeId)
  return wallet.signAndExecuteTransaction({ transaction: tx })
}

export async function addBuyerItem(
  wallet: WalletContextState,
  tradeId: string,
  offerIndex: number,
  itemId: string,
  itemType: string,
): Promise<{ digest: string }> {
  const tx = addBuyerItemTx(tradeId, offerIndex, itemId, itemType)
  return wallet.signAndExecuteTransaction({ transaction: tx })
}

export async function acceptOffer(
  wallet: WalletContextState,
  tradeId: string,
  offerIndex: number,
  sellerItemType: string,
  buyerItemType: string,
): Promise<{ digest: string }> {
  const tx = acceptOfferTx(tradeId, offerIndex, sellerItemType, buyerItemType)
  return wallet.signAndExecuteTransaction({ transaction: tx })
}

export async function cancelTrade(
  wallet: WalletContextState,
  tradeId: string,
  sellerItemType: string,
  buyerItemType: string,
): Promise<{ digest: string }> {
  const tx = cancelTradeTx(tradeId, sellerItemType, buyerItemType)
  return wallet.signAndExecuteTransaction({ transaction: tx })
}

export async function withdrawOffer(
  wallet: WalletContextState,
  tradeId: string,
  offerIndex: number,
  itemType: string,
): Promise<{ digest: string }> {
  const tx = withdrawOfferTx(tradeId, offerIndex, itemType)
  return wallet.signAndExecuteTransaction({ transaction: tx })
}

// ──────────────────────────────────────────────
// Query Functions
// ──────────────────────────────────────────────

/**
 * Fetches all active trades from the blockchain by querying TradeCreated events.
 */
export async function fetchActiveTrades(
  suiClient: SuiClient,
  packageId: string = SUIBID_PACKAGE_ID || "",
): Promise<Trade[]> {
  if (!packageId) return []

  try {
    // Query TradeCreated events
    const events = await suiClient.queryEvents({
      query: {
        MoveEventType: `${packageId}::${TRADE_MODULE}::TradeCreated`,
      },
      limit: 50,
      order: "descending",
    })

    // Get trade IDs from events
    const tradeIds = events.data.map((event: any) => event.parsedJson?.trade_id).filter(Boolean)

    // Fetch trade objects
    const trades: Trade[] = []
    for (const tradeId of tradeIds) {
      try {
        const tradeObject = await suiClient.getObject({
          id: tradeId,
          options: { showContent: true },
        })

        if (tradeObject.data?.content && "fields" in tradeObject.data.content) {
          const fields = tradeObject.data.content.fields as any
          if (fields.active) {
            trades.push({
              id: tradeId,
              seller: fields.seller,
              end_time: parseInt(fields.end_time, 10),
              active: fields.active,
              offer_count: parseInt(fields.offer_count, 10),
            })
          }
        }
      } catch {
        // Trade might have been deleted/completed
        continue
      }
    }

    return trades
  } catch (error) {
    console.error("[fetchActiveTrades] Error:", error)
    return []
  }
}

/**
 * Parses a Trade object from SuiClient response.
 */
export function parseTradeObject(data: any): Trade | null {
  try {
    const content = data?.content || data?.data?.content
    if (!content || !("fields" in content)) return null

    const fields = content.fields as any
    return {
      id: data?.objectId || data?.data?.objectId || fields.id?.id || "",
      seller: fields.seller,
      end_time: parseInt(fields.end_time, 10),
      active: fields.active,
      offer_count: parseInt(fields.offer_count, 10),
    }
  } catch {
    return null
  }
}
