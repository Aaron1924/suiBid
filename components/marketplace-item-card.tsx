"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatAddress, formatSui } from "@/lib/sui-utils"
import { Package, Gavel, Clock } from "lucide-react"

// This component now accepts a simplified, universal listing type
// derived from either mock data or a parsed on-chain Auction object.
export interface DisplayableListing {
  id: string;
  name: string;
  description: string;
  imageUrl: string | null;
  seller: string;
  currentBid: string; // MIST
  bidCount: number;
  endTime?: number; // Timestamp in ms
}

interface MarketplaceItemCardProps {
  listing: DisplayableListing
}

function formatTimeRemaining(endTime: number): string {
  const now = Date.now()
  const diff = endTime - now

  if (diff <= 0) return "Ended"

  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((diff % (1000 * 60)) / 1000)

  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${minutes}m`
  if (minutes > 0) return `${minutes}m ${seconds}s`
  return `${seconds}s`
}

export function MarketplaceItemCard({ listing }: MarketplaceItemCardProps) {
  const [timeRemaining, setTimeRemaining] = useState<string>("")
  const isEnded = listing.endTime ? Date.now() >= listing.endTime : false

  useEffect(() => {
    if (!listing.endTime) return

    const updateTime = () => {
      setTimeRemaining(formatTimeRemaining(listing.endTime!))
    }
    updateTime()

    const interval = setInterval(updateTime, 1000)
    return () => clearInterval(interval)
  }, [listing.endTime])

  return (
    <Link href={`/item/${listing.id}`}>
      <Card className="group overflow-hidden bg-card border-border hover:border-primary/50 transition-all duration-200 cursor-pointer relative">
        {/* Auction Status Badge */}
        {listing.endTime && (
          <div className={`absolute top-2 right-2 z-10 flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
            isEnded
              ? "bg-secondary text-muted-foreground"
              : "bg-primary/90 text-primary-foreground"
          }`}>
            <Clock className="h-3 w-3" />
            {isEnded ? "Ended" : timeRemaining}
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
              {formatSui(listing.currentBid)} SUI
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
