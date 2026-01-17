"use client"

import Link from "next/link"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatAddress, formatSui } from "@/lib/sui-utils"
import type { MockMarketplaceListing } from "@/lib/mock-marketplace-items"
import { Package, Gavel } from "lucide-react"

interface MarketplaceItemCardProps {
  listing: MockMarketplaceListing
}

export function MarketplaceItemCard({ listing }: MarketplaceItemCardProps) {
  return (
    <Link href={`/item/${listing.id}?source=marketplace`}>
      <Card className="group overflow-hidden bg-card border-border hover:border-primary/50 transition-all duration-200 cursor-pointer">
        <CardContent className="p-0">
          <div className="aspect-square bg-secondary flex items-center justify-center overflow-hidden">
            {listing.imageUrl ? (
              <img
                src={listing.imageUrl || "/placeholder.svg"}
                alt={listing.name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
              />
            ) : (
              <Package className="h-16 w-16 text-muted-foreground" />
            )}
          </div>
          <div className="p-4 space-y-2">
            <h3 className="font-medium text-foreground truncate group-hover:text-primary transition-colors">
              {listing.name}
            </h3>
            <p className="text-xs text-muted-foreground line-clamp-2">{listing.description}</p>
          </div>
        </CardContent>
        <CardFooter className="p-4 pt-0 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <span>Seller:</span>
            <span className="font-mono">{formatAddress(listing.seller)}</span>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <div className="flex items-center gap-1 text-primary font-medium text-sm">
              <Gavel className="h-3 w-3" />
              {formatSui(listing.currentBid)}
            </div>
            <Badge variant="secondary" className="text-xs">
              {listing.bidCount} {listing.bidCount === 1 ? "bid" : "bids"}
            </Badge>
          </div>
        </CardFooter>
      </Card>
    </Link>
  )
}
