"use client"

import Link from "next/link"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatAddress, type MarketplaceItem } from "@/lib/sui-utils"
import { ExternalLink, Package } from "lucide-react"

interface ItemCardProps {
  item: MarketplaceItem
  showOwner?: boolean
  bidCount?: number
}

export function ItemCard({ item, showOwner = false, bidCount }: ItemCardProps) {
  return (
    <Link href={`/item/${item.objectId}`}>
      <Card className="group overflow-hidden bg-card border-border hover:border-primary/50 transition-all duration-200 cursor-pointer">
        <CardContent className="p-0">
          <div className="aspect-square bg-secondary flex items-center justify-center overflow-hidden">
            {item.imageUrl ? (
              <img
                src={item.imageUrl || "/placeholder.svg"}
                alt={item.name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
              />
            ) : (
              <Package className="h-16 w-16 text-muted-foreground" />
            )}
          </div>
          <div className="p-4 space-y-2">
            <h3 className="font-medium text-foreground truncate group-hover:text-primary transition-colors">
              {item.name}
            </h3>
            <p className="text-xs text-muted-foreground line-clamp-2">{item.description}</p>
          </div>
        </CardContent>
        <CardFooter className="p-4 pt-0 flex items-center justify-between">
          {showOwner && <span className="text-xs text-muted-foreground font-mono">{formatAddress(item.owner)}</span>}
          {bidCount !== undefined && (
            <Badge variant="secondary" className="text-xs">
              {bidCount} {bidCount === 1 ? "bid" : "bids"}
            </Badge>
          )}
          <ExternalLink className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity ml-auto" />
        </CardFooter>
      </Card>
    </Link>
  )
}
