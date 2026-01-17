"use client"

import Link from "next/link"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatAddress, formatSui } from "@/lib/sui-utils"
import type { MockMarketplaceListing } from "@/lib/mock-marketplace-items"
import { Package, Gavel, Wifi } from "lucide-react"
import { useAuctionSocket } from "@/hooks/use-auction-socket"

interface MarketplaceItemCardProps {
  listing: MockMarketplaceListing
}

export function MarketplaceItemCard({ listing }: MarketplaceItemCardProps) {
  // Kết nối socket để lắng nghe giá Live
  // Lưu ý: listing.id phải là Auction Object ID thực tế
  const { price, isLive } = useAuctionSocket(listing.id, listing.currentBid)

  return (
    <Link href={`/item/${listing.id}`}>
      <Card className="group overflow-hidden bg-card border-border hover:border-primary/50 transition-all duration-200 cursor-pointer relative">
        {/* Live Indicator */}
        {isLive && (
          <div className="absolute top-2 right-2 z-10 flex items-center gap-1 bg-red-500/90 text-white text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse">
            <Wifi className="w-3 h-3" />
            LIVE
          </div>
        )}
        
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
              {/* Hiển thị giá từ Socket (nếu có update) hoặc giá ban đầu */}
              {formatSui(String(price))} SUI
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
