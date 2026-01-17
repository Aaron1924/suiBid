"use client"

import { MarketplaceItemCard } from "@/components/marketplace-item-card"
import { mockMarketplaceListings } from "@/lib/mock-marketplace-items"
import { Store } from "lucide-react"

export default function MarketplacePage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <Store className="h-6 w-6 text-primary" />
          <h1 className="text-3xl font-bold">Marketplace</h1>
          <span className="text-xs text-muted-foreground bg-secondary px-2 py-1 rounded">Public Listings</span>
        </div>
        <p className="text-muted-foreground">
          Browse and bid on public listings. These items are available for anyone to purchase.
        </p>
      </div>

      <div className="mb-4 text-sm text-muted-foreground">
        {mockMarketplaceListings.length} {mockMarketplaceListings.length === 1 ? "listing" : "listings"} available
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {mockMarketplaceListings.map((listing) => (
          <MarketplaceItemCard key={listing.id} listing={listing} />
        ))}
      </div>
    </div>
  )
}
