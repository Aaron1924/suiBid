"use client"

import { useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { formatAddress, type MarketplaceItem } from "@/lib/sui-utils"
import { ExternalLink, Package, Gavel } from "lucide-react"
import { CreateAuctionDialog } from "./create-auction-dialog"

interface ItemCardProps {
  item: MarketplaceItem
  showCreateAuction?: boolean
  linkPrefix?: string // Add linkPrefix prop to customize the link destination
  onAuctionSuccess?: () => void // Callback when auction is created successfully
}

export function ItemCard({ item, showCreateAuction = false, linkPrefix = "/item", onAuctionSuccess }: ItemCardProps) {
  const [auctionDialogOpen, setAuctionDialogOpen] = useState(false)

  return (
    <>
      <Card className="group overflow-hidden bg-card border-border hover:border-primary/50 transition-all duration-200">
        <Link href={`${linkPrefix}/${item.objectId}`}>
          <CardContent className="p-0 cursor-pointer">
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
        </Link>
        <CardFooter className="p-4 pt-0 flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground font-mono">{formatAddress(item.owner)}</span>
          {showCreateAuction ? (
            <Button
              size="sm"
              variant="secondary"
              className="gap-1.5"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setAuctionDialogOpen(true)
              }}
            >
              <Gavel className="h-3.5 w-3.5" />
              Auction
            </Button>
          ) : (
            <ExternalLink className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          )}
        </CardFooter>
      </Card>

      {showCreateAuction && (
        <CreateAuctionDialog item={item} open={auctionDialogOpen} onOpenChange={setAuctionDialogOpen} onSuccess={onAuctionSuccess} />
      )}
    </>
  )
}
