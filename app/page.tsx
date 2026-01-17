"use client"

import { useEffect, useState } from "react"
import { useSuiClientQuery } from "@mysten/dapp-kit"
import { MarketplaceItemCard, type DisplayableListing } from "@/components/marketplace-item-card"
import { Store, RefreshCw } from "lucide-react"
import { parseAuctionObject } from "@/lib/sui-utils"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"

function useAuctionIds() {
  const [auctionIds, setAuctionIds] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchAuctions = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/auctions")
      const data = await res.json()
      setAuctionIds(data.auctions || [])
    } catch (err) {
      setError("Failed to fetch auctions")
      console.error("[v0] Failed to fetch auctions:", err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchAuctions()
  }, [])

  return { auctionIds, isLoading, error, refetch: fetchAuctions }
}

// A component to handle fetching and displaying a single auction
function AuctionItem({ id }: { id: string }) {
  const { data, isLoading, isError } = useSuiClientQuery("getObject", {
    id,
    options: { showContent: true },
  })

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    )
  }

  if (isError || !data?.data) {
    return (
      <div className="border-2 border-destructive/50 rounded-lg p-4 text-center text-destructive">
        <p className="font-semibold">Error</p>
        <p className="text-xs">Failed to load auction: {id.slice(0, 10)}...</p>
      </div>
    )
  }

  const parsedAuction = parseAuctionObject(data.data)

  if (!parsedAuction) {
    return (
      <div className="border-2 border-destructive/50 rounded-lg p-4 text-center text-destructive">
        <p className="font-semibold">Parsing Error</p>
        <p className="text-xs">Could not parse auction: {id.slice(0, 10)}...</p>
      </div>
    )
  }

  // Parse embedded NFT from auction.item (could be direct fields or wrapped in Option)
  let itemFields = parsedAuction.item?.fields;
  if (parsedAuction.item?.fields?.vec) {
    itemFields = parsedAuction.item.fields.vec[0]?.fields;
  }

  const nftName = itemFields?.name || `Auction ${parsedAuction.id.slice(0, 8)}...`;
  const nftDescription = itemFields?.description || "No description";
  const nftImageUrl = typeof itemFields?.image_url === 'string'
    ? itemFields.image_url
    : itemFields?.image_url?.url || null;

  const listingForCard: DisplayableListing = {
    id: parsedAuction.id,
    name: nftName,
    description: nftDescription,
    imageUrl: nftImageUrl,
    seller: parsedAuction.seller,
    currentBid: parsedAuction.highestBid.toString(),
    bidCount: 0,
  }

  return <MarketplaceItemCard listing={listingForCard} />
}

export default function MarketplacePage() {
  const { auctionIds, isLoading, refetch } = useAuctionIds()

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Store className="h-6 w-6 text-primary" />
            <h1 className="text-3xl font-bold">Marketplace</h1>
            <span className="text-xs text-muted-foreground bg-secondary px-2 py-1 rounded">Live Auctions</span>
          </div>
          <Button variant="outline" size="sm" onClick={refetch} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
        <p className="text-muted-foreground">Browse and bid on live on-chain auctions.</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-64 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ))}
        </div>
      ) : auctionIds.length > 0 ? (
        <>
          <div className="mb-4 text-sm text-muted-foreground">
            {auctionIds.length} {auctionIds.length === 1 ? "listing" : "listings"} available
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {auctionIds.map((id) => (
              <AuctionItem key={id} id={id} />
            ))}
          </div>
        </>
      ) : (
        <div className="text-center py-16 border-2 border-dashed rounded-lg">
          <h2 className="text-xl font-semibold">No Live Auctions</h2>
          <p className="text-muted-foreground mt-2">Create an auction from the "My Items" page to see it here.</p>
        </div>
      )}
    </div>
  )
}
