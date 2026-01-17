"use client"

import { useSuiClientQuery } from "@mysten/dapp-kit"
import { MarketplaceItemCard, type DisplayableListing } from "@/components/marketplace-item-card"
import { Store } from "lucide-react"
import { DEMO_AUCTION_ID } from "@/lib/constants"
import { parseAuctionObject } from "@/lib/sui-utils"
import { Skeleton } from "@/components/ui/skeleton"

// A new component to handle fetching and displaying a single auction
function AuctionItem({ id }: { id: string }) {
  const { data, isLoading, isError } = useSuiClientQuery(
    "getObject",
    {
      id,
      options: { showContent: true },
    },
  );

  if (isLoading) {
    // Skeleton for a single card
    return (
      <div className="space-y-2">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    )
  }

  if (isError || !data?.data) {
    // Simple error state for a single card
    return (
      <div className="border-2 border-destructive/50 rounded-lg p-4 text-center text-destructive">
        <p className="font-semibold">Error</p>
        <p className="text-xs">Failed to load auction: {id.slice(0,10)}...</p>
      </div>
    );
  }

  const parsedAuction = parseAuctionObject(data.data);

  if (!parsedAuction) {
    return (
      <div className="border-2 border-destructive/50 rounded-lg p-4 text-center text-destructive">
        <p className="font-semibold">Parsing Error</p>
        <p className="text-xs">Could not parse auction: {id.slice(0,10)}...</p>
      </div>
    );
  }

  // Adapt the ParsedAuction to the shape MarketplaceItemCard expects
  const listingForCard: DisplayableListing = {
      id: parsedAuction.id,
      name: parsedAuction.item.name,
      description: parsedAuction.item.description,
      imageUrl: parsedAuction.item.imageUrl,
      seller: parsedAuction.seller,
      currentBid: parsedAuction.highestBid,
      bidCount: 0, // TODO: Fetch bid count from the `positions` table dynamic field
  };

  return <MarketplaceItemCard listing={listingForCard} />;
}


export default function MarketplacePage() {
  // For now, we only display the single demo auction
  // In a real app, you'd get a list of IDs from a registry or indexer
  const auctionIds = [DEMO_AUCTION_ID].filter(id => id && !id.includes("REPLACE"));

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <Store className="h-6 w-6 text-primary" />
          <h1 className="text-3xl font-bold">Marketplace</h1>
          <span className="text-xs text-muted-foreground bg-secondary px-2 py-1 rounded">Live Auctions</span>
        </div>
        <p className="text-muted-foreground">
          Browse and bid on live on-chain auctions. Note: You must replace the placeholder ID in `lib/constants.ts` to see a live auction.
        </p>
      </div>
      
      {auctionIds.length > 0 ? (
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
          <p className="text-muted-foreground mt-2">
            Please update `lib/constants.ts` with a live Auction Object ID to see it here.
          </p>
        </div>
      )}
    </div>
  )
}
