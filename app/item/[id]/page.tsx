"use client"

import { use, useState } from "react"
import { useCurrentAccount, useSuiClientQuery, useSignAndExecuteTransaction } from "@mysten/dapp-kit"
import { Transaction } from "@mysten/sui/transactions"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { TransactionStatus, type TransactionState } from "@/components/transaction-status"
import { formatAddress, formatSui, parseObjectToItem, type Bid } from "@/lib/sui-utils"
import { ArrowLeft, ExternalLink, Package, User, Clock, Wallet } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { ConnectButton } from "@mysten/dapp-kit"

// Demo bids for display - in production these would come from on-chain queries
const demoBids: Bid[] = [
  { id: "1", itemId: "", bidder: "0x1234...abcd", amount: "1000000000", timestamp: Date.now() - 3600000 },
  { id: "2", itemId: "", bidder: "0x5678...efgh", amount: "1500000000", timestamp: Date.now() - 1800000 },
]

export default function ItemDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const account = useCurrentAccount()
  const { mutate: signAndExecute } = useSignAndExecuteTransaction()

  const [bidAmount, setBidAmount] = useState("")
  const [txState, setTxState] = useState<TransactionState>("idle")
  const [txDigest, setTxDigest] = useState<string>()
  const [errorMessage, setErrorMessage] = useState<string>()

  const {
    data: objectData,
    isLoading,
    error,
  } = useSuiClientQuery("getObject", {
    id,
    options: { showContent: true, showDisplay: true, showType: true, showOwner: true },
  })

  const item = objectData ? parseObjectToItem(objectData) : null
  const isOwner = account?.address && item?.owner === account.address
  const bids = demoBids // In production, fetch from on-chain

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
      // Example: tx.moveCall({ target: `${MARKETPLACE_PACKAGE_ID}::${MARKETPLACE_MODULE}::place_bid`, ... })

      // For demo, we'll just show the transaction flow
      toast.info("In production, this would submit a bid transaction to your marketplace contract")

      // Simulate transaction
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

  const handleAcceptBid = async (bid: Bid) => {
    if (!account) return

    setTxState("pending")
    setErrorMessage(undefined)

    try {
      const tx = new Transaction()

      // In production, this would call your marketplace contract
      // Example: tx.moveCall({ target: `${MARKETPLACE_PACKAGE_ID}::${MARKETPLACE_MODULE}::accept_bid`, ... })

      toast.info("In production, this would execute the escrow settlement on your marketplace contract")

      // Simulate transaction
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

  if (!account) {
    return (
      <div className="container mx-auto px-4 py-16">
        <div className="flex flex-col items-center justify-center text-center">
          <div className="rounded-full bg-secondary p-4 mb-4">
            <Wallet className="h-8 w-8 text-muted-foreground" />
          </div>
          <h1 className="text-2xl font-semibold mb-2">Connect Your Wallet</h1>
          <p className="text-muted-foreground mb-6 max-w-md">
            Connect your Sui wallet to view item details and place bids.
          </p>
          <ConnectButton className="!bg-primary !text-primary-foreground !rounded-md !px-6 !py-3 !text-sm !font-medium hover:!bg-primary/90" />
        </div>
      </div>
    )
  }

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
              <div className="h-4 w-2/3 bg-secondary rounded" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error || !item) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <Package className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
        <h1 className="text-2xl font-semibold mb-2">Item Not Found</h1>
        <p className="text-muted-foreground mb-6">The item you're looking for doesn't exist or has been removed.</p>
        <Button asChild>
          <Link href="/">Back to Marketplace</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Marketplace
      </Link>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Item Image */}
        <div className="aspect-square bg-card border border-border rounded-lg overflow-hidden flex items-center justify-center">
          {item.imageUrl ? (
            <img src={item.imageUrl || "/placeholder.svg"} alt={item.name} className="w-full h-full object-cover" />
          ) : (
            <Package className="h-24 w-24 text-muted-foreground" />
          )}
        </div>

        {/* Item Details */}
        <div className="space-y-6">
          <div>
            <div className="flex items-start justify-between gap-4 mb-2">
              <h1 className="text-3xl font-bold">{item.name}</h1>
              {isOwner && <Badge>You own this</Badge>}
            </div>
            <p className="text-muted-foreground">{item.description}</p>
          </div>

          <Separator />

          {/* Owner Info */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Owner:</span>
              <a
                href={`https://suiscan.xyz/testnet/account/${item.owner}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-primary hover:underline inline-flex items-center gap-1"
              >
                {formatAddress(item.owner, 8)}
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Package className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Object ID:</span>
              <a
                href={`https://suiscan.xyz/testnet/object/${item.objectId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-primary hover:underline inline-flex items-center gap-1"
              >
                {formatAddress(item.objectId, 8)}
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>

          <Separator />

          {/* Transaction Status */}
          <TransactionStatus state={txState} txDigest={txDigest} errorMessage={errorMessage} />

          {/* Bid Actions */}
          {!isOwner ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Place a Bid</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
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
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Active Bids</CardTitle>
              </CardHeader>
              <CardContent>
                {bids.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No active bids on this item yet.</p>
                ) : (
                  <div className="space-y-3">
                    {bids.map((bid) => (
                      <div key={bid.id} className="flex items-center justify-between p-3 bg-secondary rounded-lg">
                        <div className="space-y-1">
                          <p className="font-mono text-sm">{formatAddress(bid.bidder)}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {new Date(bid.timestamp).toLocaleString()}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-semibold text-primary">{formatSui(bid.amount)} SUI</span>
                          <Button size="sm" onClick={() => handleAcceptBid(bid)} disabled={txState === "pending"}>
                            Accept
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
