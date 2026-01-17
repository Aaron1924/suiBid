import { MIST_PER_SUI } from "@mysten/sui/utils"

export function formatAddress(address: string, chars = 4): string {
  if (!address) return ""
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`
}

export function formatSui(balance: string): string {
  const sui = Number(balance) / Number(MIST_PER_SUI)
  return sui.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  })
}

export function mistToSui(mist: string | bigint): number {
  return Number(mist) / Number(MIST_PER_SUI)
}

export function suiToMist(sui: number): bigint {
  return BigInt(Math.floor(sui * Number(MIST_PER_SUI)))
}

// Type definitions for marketplace items
export interface MarketplaceItem {
  objectId: string
  name: string
  description: string
  imageUrl?: string
  type: string
  owner: string
}

export interface Bid {
  id: string
  itemId: string
  bidder: string
  amount: string
  timestamp: number
}

export interface ParsedAuction {
  id: string
  item: any // Embedded item object (not an ID), contains .fields with NFT data
  seller: string
  minBid: number
  highestBid: number
  highestBidder: string | null
  endTime: number
  active: boolean
}

// Parse Sui object to marketplace item
export function parseObjectToItem(object: any): MarketplaceItem | null {
  try {
    const content = object.data?.content
    if (!content) return null

    const fields = content.fields || {}

    return {
      objectId: object.data.objectId,
      name: fields.name || `Object ${formatAddress(object.data.objectId)}`,
      description: fields.description || "No description available",
      imageUrl: fields.image_url || fields.url,
      type: content.type || "Unknown",
      owner: typeof object.data.owner === "string" ? object.data.owner : object.data.owner?.AddressOwner || "Unknown",
    }
  } catch {
    return null
  }
}

export function parseAuctionObject(object: any): ParsedAuction | null {
  try {
    // Handle both direct object and nested data structure
    const content = object?.content || object?.data?.content
    if (!content || content.dataType !== "moveObject") {
      console.log("[parseAuctionObject] No valid content found:", JSON.stringify(object, null, 2))
      return null
    }

    const fields = content.fields as any
    if (!fields) {
      console.log("[parseAuctionObject] No fields found in content")
      return null
    }

    console.log("[parseAuctionObject] Fields:", JSON.stringify(fields, null, 2))

    return {
      id: fields.id?.id || object?.objectId || object?.data?.objectId || "",
      item: fields.item, // Keep full embedded item object for NFT data extraction
      seller: fields.seller || "",
      minBid: Number.parseInt(fields.min_bid || "0", 10),
      highestBid: Number.parseInt(fields.highest_bid || "0", 10),
      highestBidder: fields.highest_bidder?.fields?.vec?.[0] || fields.highest_bidder || null,
      endTime: Number.parseInt(fields.end_time || "0", 10),
      active: fields.active ?? true,
    }
  } catch (e) {
    console.error("[parseAuctionObject] Error:", e)
    return null
  }
}
