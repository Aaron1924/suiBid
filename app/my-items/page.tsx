"use client"

import { useCurrentAccount, useSuiClientQuery } from "@mysten/dapp-kit"
import { ItemCard } from "@/components/item-card"
import { ItemGridSkeleton } from "@/components/loading-skeleton"
import { EmptyState } from "@/components/empty-state"
import { parseObjectToItem, type MarketplaceItem } from "@/lib/sui-utils"
import { Boxes, Wallet } from "lucide-react"
import { ConnectWallet } from "@/components/connect-wallet"

const NON_AUCTIONABLE_TYPES = [
  "0x2::coin::Coin", // Coins don't have 'store'
  "0x2::coin::CoinMetadata",
  "0x2::package::UpgradeCap",
  "0x2::dynamic_field::Field",
]

function isAuctionable(type: string): boolean {
  return !NON_AUCTIONABLE_TYPES.some((nonAuctionable) => type.includes(nonAuctionable))
}

export default function MyItemsPage() {
  const account = useCurrentAccount()

  const { data, isLoading, error } = useSuiClientQuery(
    "getOwnedObjects",
    {
      owner: account?.address ?? "",
      options: { showContent: true, showDisplay: true, showType: true },
      limit: 50,
    },
    { enabled: !!account },
  )

  const allItems: MarketplaceItem[] =
    data?.data?.map((obj) => parseObjectToItem(obj)).filter((item): item is MarketplaceItem => item !== null) ?? []

  const auctionableItems = allItems.filter((item) => isAuctionable(item.type))
  const nonAuctionableCount = allItems.length - auctionableItems.length

  if (!account) {
    return (
      <div className="container mx-auto px-4 py-16">
        <div className="flex flex-col items-center justify-center text-center">
          <div className="rounded-full bg-secondary p-4 mb-4">
            <Wallet className="h-8 w-8 text-muted-foreground" />
          </div>
          <h1 className="text-2xl font-semibold mb-2">Connect Your Wallet</h1>
          <p className="text-muted-foreground mb-6 max-w-md">Connect your Sui wallet to view your on-chain items.</p>
          <ConnectWallet />
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <Boxes className="h-6 w-6 text-primary" />
          <h1 className="text-3xl font-bold">My Items</h1>
          <span className="text-xs text-muted-foreground bg-secondary px-2 py-1 rounded">Your On-Chain Objects</span>
        </div>
        <p className="text-muted-foreground">
          View and manage objects you own on the Sui network. Create auctions to sell your items.
        </p>
      </div>

      {isLoading ? (
        <ItemGridSkeleton count={8} />
      ) : auctionableItems.length === 0 ? (
        <EmptyState
          icon={Boxes}
          title="No auctionable items found"
          description={
            nonAuctionableCount > 0
              ? `You have ${nonAuctionableCount} objects (like Coins) that cannot be auctioned. Mint or acquire NFTs to create auctions.`
              : "You don't own any items yet. Visit the marketplace to discover items or receive items from other users."
          }
          actionLabel="Browse Marketplace"
          actionHref="/"
        />
      ) : (
        <>
          <div className="mb-4 text-sm text-muted-foreground">
            {auctionableItems.length} auctionable {auctionableItems.length === 1 ? "item" : "items"} found
            {nonAuctionableCount > 0 && ` (${nonAuctionableCount} non-auctionable objects hidden)`}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {auctionableItems.map((item) => (
              <ItemCard key={item.objectId} item={item} showCreateAuction={true} linkPrefix="/my-items" />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
