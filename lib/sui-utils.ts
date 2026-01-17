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
  item: string
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
    const content = object.data?.content
    if (!content || content.dataType !== "moveObject") return null

    const fields = content.fields as any
    if (!fields) return null

    return {
      id: fields.id?.id || object.data?.objectId,
      item: fields.item?.fields?.id?.id || fields.item || "",
      seller: fields.seller || "",
      minBid: Number.parseInt(fields.min_bid || "0", 10),
      highestBid: Number.parseInt(fields.highest_bid || "0", 10),
      highestBidder: fields.highest_bidder?.fields?.vec?.[0] || fields.highest_bidder || null,
      endTime: Number.parseInt(fields.end_time || "0", 10),
      active: fields.active ?? true,
    }
  } catch {
    return null
  }
}
