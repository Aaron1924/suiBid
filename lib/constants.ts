// Contract addresses - replace with your actual contract addresses
export const MARKETPLACE_PACKAGE_ID = "0x0" // Replace with actual package ID
export const MARKETPLACE_MODULE = "marketplace"

// SuiBid Package ID - same as in auction-sdk.ts
export const SUIBID_PACKAGE_ID =
  process.env.PACKAGE_ID || "0x1b054c703bf2bf04ea78e35dc5d4b6b086aafb236c7017a222f62d5535753ccb"

// Sui Clock Object ID (standard Sui system object at 0x6)
export const SUI_CLOCK_OBJECT_ID = "0x6"

// Auction item type - replace with your actual NFT type
export const AUCTION_ITEM_TYPE = "0x1b054c703bf2bf04ea78e35dc5d4b6b086aafb236c7017a222f62d5535753ccb::nft::SuiBidNFT"

// Demo auction ID for marketplace display - replace with actual auction object ID
export const DEMO_AUCTION_ID = "" // Leave empty or replace with a real auction ID

// Object type filters for fetching user items
export const SUPPORTED_ITEM_TYPES = [
  // Add your supported item types here
  // e.g., "0x2::nft::NFT"
]

// Pagination
export const ITEMS_PER_PAGE = 12
