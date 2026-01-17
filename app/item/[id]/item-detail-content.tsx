"use client"

import { use, useState } from "react"
import { useSearchParams } from "next/navigation"
import { useCurrentAccount, useSuiClientQuery, useSignAndExecuteTransaction } from "@mysten/dapp-kit"
import { Transaction } from "@mysten/sui/transactions"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { TransactionStatus, type TransactionState } from "@/components/transaction-status"
import { formatAddress, formatSui, parseObjectToItem } from "@/lib/sui-utils"
import { getMockListingById, getMockBidsForListing } from "@/lib/mock-marketplace-items"
import { ArrowLeft, ExternalLink, Package, User, Clock, Wallet, Store } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { ConnectButton } from "@mysten/dapp-kit"

export function ItemDetailContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const searchParams = useSearchParams()
  const source = searchParams.get("source") || "marketplace"
  const isFromMarketplace = source === "marketplace"

  const account = useCurrentAccount()
  const { mutate: signAndExecute } = useSignAndExecuteTransaction()

  const [bidAmount, setBidAmount] = useState("")
  const [txState, setTxState] = useState<TransactionState>("idle")
  const [txDigest, setTxDigest] = useState<string>()
  const [errorMessage, setErrorMessage] = useState<string>()

  const mockListing = isFromMarketplace ? getMockListingById(id) : null
  const mockBids = isFromMarketplace && mockListing ? getMockBidsForListing(id) : []

  // Only query chain for owned items (my-items source)
  const {
    data: objectData,
    isLoading,
    error,
  } = useSuiClientQuery(
    "getObject",
    {
      id,
      options: { showContent: true, showDisplay: true, showType: true, showOwner: true },
    },
    { enabled: !isFromMarketplace }, // Only fetch from chain if not from marketplace
  )

  const chainItem = objectData ? parseObjectToItem(objectData) : null

  const isOwner = !isFromMarketplace && account?.address && chainItem?.owner === account.address

  // Build display data based on source
  const displayItem = isFromMarketplace
    ? mockListing
      ? {
          id: mockListing.id,
          name: mockListing.name,
          description: mockListing.description,
          imageUrl: mockListing.imageUrl,
          owner: mockListing.seller,
        }
      : null
    : chainItem
      ? {
          id: chainItem.objectId,
          name: chainItem.name,
          description: chainItem.description,
          imageUrl: chainItem.imageUrl,
          owner: chainItem.owner,
        }
      : null

  const handlePlaceBid = async () => {
    if (!account || !bidAmount) return

    const amount = Number.parseFloat(bidAmount)
    if (isNaN(amount) || amount <= 0) {
      toast.error("Please enter a valid bid amount")
      return
    }

    setTxState("pending")
    setErrorMessage(undefined)

    try {
      const tx = new Transaction()
      // In production, this would call your marketplace contract
      toast.info("In production, this would submit a bid transaction to your marketplace contract")
      await new Promise((resolve) => setTimeout(resolve, 1500))

      setTxState("success")
      setTxDigest("demo_tx_digest")
      setBidAmount("")
      toast.success("Bid placed successfully!")
    } catch (err: any) {
      setTxState("error")
      setErrorMessage(err?.message || "Failed to place bid")
      toast.error("Failed to place bid")
    }
  }

  const handleAcceptBid = async (bidId: string, bidAmount: string) => {
    if (!account) return

    setTxState("pending")
    setErrorMessage(undefined)

    try {
      const tx = new Transaction()
      toast.info("In production, this would execute the escrow settlement on your marketplace contract")
      await new Promise((resolve) => setTimeout(resolve, 1500))

      setTxState("success")
      setTxDigest("demo_tx_digest")
      toast.success("Bid accepted! Escrow settlement complete.")
    } catch (err: any) {
      setTxState("error")
      setErrorMessage(err?.message || "Failed to accept bid")
      toast.error("Failed to accept bid")
    }
  }

  const needsWallet = !isFromMarketplace && !account

  if (needsWallet) {
    return (
      <div className="container mx-auto px-4 py-16">
        <div className="flex flex-col items-center justify-center text-center">
          <div className="rounded-full bg-secondary p-4 mb-4">
            <Wallet className="h-8 w-8 text-muted-foreground" />
          </div>
          <h1 className="text-2xl font-semibold mb-2">Connect Your Wallet</h1>
          <p className="text-muted-foreground mb-6 max-w-md">
            Connect your Sui wallet to view your item details and manage bids.
          </p>
          <ConnectButton className="!bg-primary !text-primary-foreground !rounded-md !px-6 !py-3 !text-sm !font-medium hover:!bg-primary/90" />
        </div>
      </div>
    )
  }

  const showLoading = !isFromMarketplace && isLoading

  if (showLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse space-y-8">
          <div className="h-8 w-32 bg-secondary rounded" />
          <div className="grid lg:grid-cols-2 gap-8">
            <div className="aspect-square bg-secondary rounded-lg" />
            <div className="space-y-4">
              <div className="h-8 w-3/4 bg-secondary rounded" />
              <div className="h-4 w-full bg-secondary rounded" />
              <div className="h-4 w-2/3 bg-secondary rounded" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!displayItem) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <Package className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
        <h1 className="text-2xl font-semibold mb-2">Item Not Found</h1>
        <p className="text-muted-foreground mb-6">The item you're looking for doesn't exist or has been removed.</p>
        <Button asChild>
          <Link href={isFromMarketplace ? "/" : "/my-items"}>
            {isFromMarketplace ? "Back to Marketplace" : "Back to My Items"}
          </Link>
        </Button>
      </div>
    )
  }

  const backHref = isFromMarketplace ? "/" : "/my-items"
  const backLabel = isFromMarketplace ? "Back to Marketplace" : "Back to My Items"

  return (
    <div className="container mx-auto px-4 py-8">
      <Link
        href={backHref}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        {backLabel}
      </Link>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Item Image */}
        <div className="aspect-square bg-card border border-border rounded-lg overflow-hidden flex items-center justify-center">
          {displayItem.imageUrl ? (
            <img
              src={displayItem.imageUrl || "/placeholder.svg"}
              alt={displayItem.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <Package className="h-24 w-24 text-muted-foreground" />
          )}
        </div>

        {/* Item Details */}
        <div className="space-y-6">
          <div>
            <div className="flex items-start justify-between gap-4 mb-2">
              <h1 className="text-3xl font-bold">{displayItem.name}</h1>
              <div className="flex gap-2">
                {isFromMarketplace && (
                  <Badge variant="outline" className="gap-1">
                    <Store className="h-3 w-3" /> Public Listing
                  </Badge>
                )}
                {isOwner && <Badge>You own this</Badge>}
              </div>
            </div>
            <p className="text-muted-foreground">{displayItem.description}</p>
          </div>

          <Separator />

          {/* Owner/Seller Info */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">{isFromMarketplace ? "Seller:" : "Owner:"}</span>
              <a
                href={`https://suiscan.xyz/testnet/account/${displayItem.owner}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-primary hover:underline inline-flex items-center gap-1"
              >
                {formatAddress(displayItem.owner, 8)}
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Package className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">{isFromMarketplace ? "Listing ID:" : "Object ID:"}</span>
              <a
                href={`https://suiscan.xyz/testnet/object/${displayItem.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-primary hover:underline inline-flex items-center gap-1"
              >
                {formatAddress(displayItem.id, 8)}
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            {isFromMarketplace && mockListing && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Current Bid:</span>
                <span className="font-semibold text-primary">{formatSui(mockListing.currentBid)} SUI</span>
              </div>
            )}
          </div>

          <Separator />

          {/* Transaction Status */}
          <TransactionStatus state={txState} txDigest={txDigest} errorMessage={errorMessage} />

          {isFromMarketplace ? (
            // Place Bid UI for marketplace listings
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Place a Bid</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {!account ? (
                  <div className="text-center py-4">
                    <p className="text-sm text-muted-foreground mb-4">Connect your wallet to place a bid</p>
                    <ConnectButton className="!bg-primary !text-primary-foreground !rounded-md !px-6 !py-3 !text-sm !font-medium hover:!bg-primary/90" />
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="bidAmount">Bid Amount (SUI)</Label>
                      <div className="flex gap-2">
                        <Input
                          id="bidAmount"
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          value={bidAmount}
                          onChange={(e) => setBidAmount(e.target.value)}
                          disabled={txState === "pending"}
                        />
                        <Button onClick={handlePlaceBid} disabled={!bidAmount || txState === "pending"}>
                          {txState === "pending" ? "Submitting..." : "Place Bid"}
                        </Button>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      By placing a bid, you agree to lock the specified amount in escrow until the bid is accepted or
                      cancelled.
                    </p>
                  </>
                )}
              </CardContent>
            </Card>
          ) : isOwner ? (
            // Accept Bids UI for owned items
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Active Bids</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  When your item is listed on the marketplace, bids will appear here.
                </p>
                <div className="text-xs text-muted-foreground bg-secondary/50 p-3 rounded">
                  To list this item, you would call your marketplace contract's listing function.
                </div>
              </CardContent>
            </Card>
          ) : (
            // Viewing someone else's owned item (not from marketplace)
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Item Details</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  This item is owned by another user. If they list it on the marketplace, you'll be able to place a bid.
                </p>
              </CardContent>
            </Card>
          )}

          {isFromMarketplace && mockBids.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Bid History</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {mockBids.map((bid) => (
                    <div key={bid.id} className="flex items-center justify-between p-3 bg-secondary rounded-lg">
                      <div className="space-y-1">
                        <p className="font-mono text-sm">{formatAddress(bid.bidder)}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {new Date(bid.timestamp).toLocaleString()}
                        </div>
                      </div>
                      <span className="font-semibold text-primary">{formatSui(bid.amount)} SUI</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
