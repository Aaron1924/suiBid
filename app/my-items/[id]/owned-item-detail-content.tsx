"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import { useCurrentAccount, useSuiClientQuery } from "@mysten/dapp-kit"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { formatAddress } from "@/lib/sui-utils"
import { ArrowLeft, ExternalLink, Package, User, Gavel } from "lucide-react"
import Link from "next/link"
import { ConnectWallet } from "@/components/connect-wallet"
import { CreateAuctionDialog } from "@/components/create-auction-dialog"
import type { MarketplaceItem } from "@/lib/sui-utils"

export function OwnedItemDetailContent() {
  const { id } = useParams<{ id: string }>()
  const account = useCurrentAccount()
  const [auctionDialogOpen, setAuctionDialogOpen] = useState(false)

  // Fetch the object data
  const {
    data: objectData,
    isLoading,
    isError,
  } = useSuiClientQuery("getObject", {
    id,
    options: { showContent: true, showOwner: true, showType: true },
  })

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse space-y-8">
          <div className="h-8 w-32 bg-secondary rounded" />
          <div className="grid lg:grid-cols-2 gap-8">
            <div className="aspect-square bg-secondary rounded-lg" />
            <div className="space-y-4">
              <div className="h-8 w-3/4 bg-secondary rounded" />
              <div className="h-4 w-full bg-secondary rounded" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (isError || !objectData?.data) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <Package className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
        <h1 className="text-2xl font-semibold mb-2">Item Not Found</h1>
        <p className="text-muted-foreground mb-6">
          The item you&apos;re looking for doesn&apos;t exist or has been removed.
        </p>
        <Button asChild>
          <Link href="/my-items">Back to My Items</Link>
        </Button>
      </div>
    )
  }

  // Parse the object data
  const content = objectData.data.content as any
  const fields = content?.fields || {}
  const objectType = objectData.data.type || ""

  // Extract common NFT fields
  const name = fields.name || "Unnamed Item"
  const description = fields.description || "No description"
  const imageUrl = fields.image_url?.url || fields.image_url || fields.url || null
  const creator = fields.creator || null

  // Get owner address
  const ownerData = objectData.data.owner as any
  const ownerAddress =
    typeof ownerData === "string" ? ownerData : ownerData?.AddressOwner || ownerData?.ObjectOwner || "Unknown"

  const isOwner = account?.address === ownerAddress

  // Create MarketplaceItem for auction dialog
  const marketplaceItem: MarketplaceItem = {
    objectId: id,
    name,
    description,
    imageUrl,
    owner: ownerAddress,
    type: objectType,
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Link
        href="/my-items"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to My Items
      </Link>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Item Image */}
        <div className="aspect-square bg-card border border-border rounded-lg overflow-hidden flex items-center justify-center">
          {imageUrl ? (
            <img src={imageUrl || "/placeholder.svg"} alt={name} className="w-full h-full object-cover" />
          ) : (
            <Package className="h-24 w-24 text-muted-foreground" />
          )}
        </div>

        {/* Item Details */}
        <div className="space-y-6">
          <div>
            <div className="flex items-start justify-between gap-4 mb-2">
              <h1 className="text-3xl font-bold">{name}</h1>
              <div className="flex gap-2">
                <Badge variant="outline" className="gap-1">
                  <Package className="h-3 w-3" /> Owned Item
                </Badge>
                {isOwner && <Badge className="bg-green-500 hover:bg-green-500">You own this</Badge>}
              </div>
            </div>
            <p className="text-muted-foreground">{description}</p>
          </div>

          <Separator />

          {/* Object Info */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Owner:</span>
              <a
                href={`https://suiscan.xyz/testnet/account/${ownerAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-primary hover:underline inline-flex items-center gap-1"
              >
                {formatAddress(ownerAddress, 8)} <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            {creator && (
              <div className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Creator:</span>
                <a
                  href={`https://suiscan.xyz/testnet/account/${creator}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-primary hover:underline inline-flex items-center gap-1"
                >
                  {formatAddress(creator, 8)} <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}
            <div className="flex items-center gap-2 text-sm">
              <Package className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Object ID:</span>
              <a
                href={`https://suiscan.xyz/testnet/object/${id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-primary hover:underline inline-flex items-center gap-1"
              >
                {formatAddress(id, 8)} <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Package className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Type:</span>
              <span className="font-mono text-xs truncate max-w-[300px]">{objectType}</span>
            </div>
          </div>

          <Separator />

          {/* Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!account ? (
                <div className="text-center py-4">
                  <p className="text-sm text-muted-foreground mb-4">Connect your wallet to perform actions</p>
                  <ConnectWallet />
                </div>
              ) : isOwner ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    You own this item. You can create an auction to sell it.
                  </p>
                  <Button onClick={() => setAuctionDialogOpen(true)} className="w-full gap-2">
                    <Gavel className="h-4 w-4" />
                    Create Auction
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">You don&apos;t own this item.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Auction Dialog */}
      <CreateAuctionDialog item={marketplaceItem} open={auctionDialogOpen} onOpenChange={setAuctionDialogOpen} />
    </div>
  )
}
