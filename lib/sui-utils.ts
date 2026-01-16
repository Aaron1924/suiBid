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
