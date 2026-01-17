// Contract addresses - replace with your actual contract addresses
export const SUIBID_PACKAGE_ID = "0x...YOUR_PACKAGE_ID" // Replace with actual package ID
export const MARKETPLACE_MODULE = "marketplace" // Assuming this is correct
export const AUCTION_MODULE = "auction" // Name of your auction module
export const NFT_MODULE = "nft" // Name of your NFT module
export const AUCTION_ITEM_TYPE = `${SUIBID_PACKAGE_ID}::${NFT_MODULE}::BidNFT` // Adjust if your item type is different

// Sui Clock Object ID - constant across Sui networks
export const SUI_CLOCK_OBJECT_ID = "0x6"

// SuiBid Package ID - same as in auction-sdk.ts
export const SUIBID_PACKAGE_ID =
  process.env.PACKAGE_ID || "0x1b054c703bf2bf04ea78e35dc5d4b6b086aafb236c7017a222f62d5535753ccb"

// Sui Clock Object ID (standard Sui system object at 0x6)
export const SUI_CLOCK_OBJECT_ID = "0x6"

// Auction item type - replace with your actual NFT type
export const AUCTION_ITEM_TYPE = "0x1b054c703bf2bf04ea78e35dc5d4b6b086aafb236c7017a222f62d5535753ccb::nft::SuiBidNFT"

// Demo auction ID for marketplace display - replace with actual auction object ID
export const DEMO_AUCTION_ID = "0xYOUR_AUCTION_OBJECT_ID_HERE" // Replace with actual auction object ID

// SuiBid Package ID - same as in auction-sdk.ts
export const SUIBID_PACKAGE_ID =
  process.env.PACKAGE_ID || "0x1b054c703bf2bf04ea78e35dc5d4b6b086aafb236c7017a222f62d5535753ccb"

// Sui Clock Object ID (standard Sui system object at 0x6)
export const SUI_CLOCK_OBJECT_ID = "0x6"

// Auction item type - replace with your actual NFT type
export const AUCTION_ITEM_TYPE = "0x1b054c703bf2bf04ea78e35dc5d4b6b086aafb236c7017a222f62d5535753ccb::nft::SuiBidNFT"

// Demo auction ID for marketplace display - replace with actual auction object ID
export const DEMO_AUCTION_ID = "0xYOUR_AUCTION_OBJECT_ID_HERE" // Replace with actual auction object ID

// Object type filters for fetching user items
export const SUPPORTED_ITEM_TYPES = [
  // Add your supported item types here
  // e.g., "0x2::nft::NFT"
]

// Pagination
export const ITEMS_PER_PAGE = 12
