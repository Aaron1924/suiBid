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

// New, specific types for a parsed Auction object from our smart contract
export interface ParsedNFT {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  creator: string;
}

export interface ParsedAuction {
  id: string;
  item: ParsedNFT;
  seller: string;
  minBid: string;
  highestBid: string;
  highestBidder: string | null;
  endTime: number;
  isActive: boolean;
}

/**
 * Parses the complex, nested Sui object for an Auction into a clean,
 * UI-friendly format.
 * @param object The raw Sui object for a suibid::auction::Auction<suibid::nft::BidNFT>
 */
export function parseAuctionObject(object: any): ParsedAuction | null {
  try {
    const content = object.data?.content;
    if (!content || !content.fields) return null;

    const auctionFields = content.fields;
    // The actual NFT is nested inside the 'item' field of the auction
    const itemFields = auctionFields.item?.fields;

    if (!itemFields) return null;

    const parsedItem: ParsedNFT = {
      id: itemFields.id.id,
      name: itemFields.name,
      description: itemFields.description,
      imageUrl: itemFields.image_url,
      creator: itemFields.creator,
    };

    return {
      id: auctionFields.id.id,
      item: parsedItem,
      seller: auctionFields.seller,
      minBid: auctionFields.min_bid,
      highestBid: auctionFields.highest_bid,
      // The `highest_bidder` is an Option<address>, which translates to an object with a `vec`
      // The vec is empty for None, and has one element for Some.
      highestBidder: auctionFields.highest_bidder.fields.value?.fields.vec[0] || null,
      endTime: parseInt(auctionFields.end_time, 10),
      isActive: auctionFields.active,
    };
  } catch (error) {
    console.error("Failed to parse auction object:", error);
    return null;
  }
}
