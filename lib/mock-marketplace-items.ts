// This data is NOT tied to wallet ownership - it simulates public marketplace listings

export interface MockMarketplaceListing {
  id: string
  name: string
  description: string
  imageUrl: string | null
  seller: string
  currentBid: string // in MIST (1 SUI = 1_000_000_000 MIST)
  bidCount: number
  listedAt: number
}

export const mockMarketplaceListings: MockMarketplaceListing[] = [
  {
    id: "0x1a2b3c4d5e6f7890abcdef1234567890abcdef12",
    name: "Cosmic Voyager #142",
    description: "A rare digital collectible from the Cosmic Voyager series. Features unique space-themed artwork.",
    imageUrl: "/cosmic-space-nft-art.jpg",
    seller: "0x9876543210fedcba9876543210fedcba98765432",
    currentBid: "2500000000", // 2.5 SUI
    bidCount: 3,
    listedAt: Date.now() - 86400000 * 2, // 2 days ago
  },
  {
    id: "0x2b3c4d5e6f7890abcdef1234567890abcdef1234",
    name: "Neon Dragon",
    description: "Legendary creature from the Neon Beasts collection. Animated with vibrant colors.",
    imageUrl: "/neon-dragon-digital-art.jpg",
    seller: "0xabcdef1234567890abcdef1234567890abcdef12",
    currentBid: "5000000000", // 5 SUI
    bidCount: 7,
    listedAt: Date.now() - 86400000, // 1 day ago
  },
  {
    id: "0x3c4d5e6f7890abcdef1234567890abcdef123456",
    name: "Sui Punk #0088",
    description: "One of 10,000 unique Sui Punks. This one features rare golden shades.",
    imageUrl: "/pixel-punk-avatar-gold.jpg",
    seller: "0xfedcba0987654321fedcba0987654321fedcba09",
    currentBid: "1200000000", // 1.2 SUI
    bidCount: 2,
    listedAt: Date.now() - 3600000 * 6, // 6 hours ago
  },
  {
    id: "0x4d5e6f7890abcdef1234567890abcdef12345678",
    name: "Abstract Genesis",
    description: "First edition abstract art piece. Generative algorithm creates unique patterns.",
    imageUrl: "/abstract-generative-art-colorful.jpg",
    seller: "0x1234567890abcdef1234567890abcdef12345678",
    currentBid: "800000000", // 0.8 SUI
    bidCount: 1,
    listedAt: Date.now() - 3600000 * 12, // 12 hours ago
  },
  {
    id: "0x5e6f7890abcdef1234567890abcdef1234567890",
    name: "Crystal Shard #7",
    description: "Rare crystal artifact with embedded metadata. Part of the Elements collection.",
    imageUrl: "/crystal-shard-glowing-blue.jpg",
    seller: "0x0987654321fedcba0987654321fedcba09876543",
    currentBid: "3200000000", // 3.2 SUI
    bidCount: 5,
    listedAt: Date.now() - 86400000 * 3, // 3 days ago
  },
  {
    id: "0x6f7890abcdef1234567890abcdef123456789012",
    name: "Mecha Warrior X",
    description: "Battle-ready mecha from the Sui Wars universe. Comes with special attack animations.",
    imageUrl: "/mecha-robot-warrior-futuristic.jpg",
    seller: "0xdeadbeef1234567890abcdef1234567890abcdef",
    currentBid: "4500000000", // 4.5 SUI
    bidCount: 4,
    listedAt: Date.now() - 86400000 * 5, // 5 days ago
  },
  {
    id: "0x7890abcdef1234567890abcdef12345678901234",
    name: "Ethereal Phoenix",
    description: "Mythical bird rising from digital flames. Limited to 100 editions.",
    imageUrl: "/phoenix-fire-bird-mythical.jpg",
    seller: "0xcafebabe1234567890abcdef1234567890abcdef",
    currentBid: "7800000000", // 7.8 SUI
    bidCount: 9,
    listedAt: Date.now() - 86400000, // 1 day ago
  },
  {
    id: "0x890abcdef1234567890abcdef1234567890123456",
    name: "Quantum Cat",
    description: "Schrodinger's favorite pet. Is it alive or dead? Check the metadata to find out.",
    imageUrl: "/quantum-cat-glitch-art.jpg",
    seller: "0xbaadf00d1234567890abcdef1234567890abcdef",
    currentBid: "1500000000", // 1.5 SUI
    bidCount: 2,
    listedAt: Date.now() - 3600000 * 4, // 4 hours ago
  },
]

// Helper to get a mock listing by ID
export function getMockListingById(id: string): MockMarketplaceListing | undefined {
  return mockMarketplaceListings.find((listing) => listing.id === id)
}

// Mock bids for a listing
export interface MockBid {
  id: string
  listingId: string
  bidder: string
  amount: string
  timestamp: number
}

export function getMockBidsForListing(listingId: string): MockBid[] {
  // Generate deterministic mock bids based on listing
  const listing = getMockListingById(listingId)
  if (!listing) return []

  const bids: MockBid[] = []
  const bidderAddresses = [
    "0x1111111111111111111111111111111111111111",
    "0x2222222222222222222222222222222222222222",
    "0x3333333333333333333333333333333333333333",
    "0x4444444444444444444444444444444444444444",
    "0x5555555555555555555555555555555555555555",
  ]

  for (let i = 0; i < listing.bidCount; i++) {
    const baseAmount = BigInt(listing.currentBid) - BigInt((listing.bidCount - i) * 200000000)
    bids.push({
      id: `${listingId}-bid-${i}`,
      listingId,
      bidder: bidderAddresses[i % bidderAddresses.length],
      amount: baseAmount.toString(),
      timestamp: listing.listedAt + (i + 1) * 3600000, // 1 hour apart
    })
  }

  return bids.sort((a, b) => b.timestamp - a.timestamp)
}
