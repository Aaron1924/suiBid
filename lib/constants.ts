// Contract addresses - replace with your actual contract addresses
// NEXT_PUBLIC_ prefix required for client-side access in Next.js
export const SUIBID_PACKAGE_ID = process.env.NEXT_PUBLIC_PACKAGE_ID

export const MARKETPLACE_MODULE = "marketplace"
export const AUCTION_MODULE = "auction"
export const NFT_MODULE = "nft"

// Sui Clock Object ID (standard Sui system object at 0x6)
export const SUI_CLOCK_OBJECT_ID = "0x6"

// Auction item type - replace with your actual NFT type
export const AUCTION_ITEM_TYPE = `${SUIBID_PACKAGE_ID}::${NFT_MODULE}::SuiBidNFT`

// Demo auction ID for marketplace display - replace with actual auction object ID
export const DEMO_AUCTION_ID = "" // Paste your auction object ID here, e.g. "0xabc123..."
// To get an auction ID:
// 1. Run: sui client call --package <PACKAGE_ID> --module auction --function create_auction --args <params>
// 2. Find the created object ID in the transaction output
// 3. Paste it here

// Object type filters for fetching user items
export const SUPPORTED_ITEM_TYPES = [
  // Add your supported item types here
]

// Pagination
export const ITEMS_PER_PAGE = 12
