"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import { useCurrentAccount, useSuiClientQuery, useSignAndExecuteTransaction } from "@mysten/dapp-kit"
import { Transaction } from "@mysten/sui/transactions"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { TransactionStatus, type TransactionState } from "@/components/transaction-status"
import { formatAddress, formatSui, parseAuctionObject, suiToMist } from "@/lib/sui-utils"
import { SUIBID_PACKAGE_ID, AUCTION_ITEM_TYPE, SUI_CLOCK_OBJECT_ID } from "@/lib/constants"
import { ArrowLeft, ExternalLink, Package, User, Wallet, Store, Gavel } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { ConnectWallet } from "@/components/connect-wallet"
import { BidPositionIndicator } from "@/components/bid-position-indicator"
import { Skeleton } from "@/components/ui/skeleton"

// Main component for displaying the details of an on-chain auction
export function ItemDetailContent() {
  const { id } = useParams<{ id: string }>()
  const account = useCurrentAccount()
  const { mutate: signAndExecute } = useSignAndExecuteTransaction()

  // State for the bid input and transaction status
  const [bidAmount, setBidAmount] = useState("")
  const [txState, setTxState] = useState<TransactionState>("idle")
  const [txDigest, setTxDigest] = useState<string>()
  const [errorMessage, setErrorMessage] = useState<string>()

  // --- Data Fetching ---
  // Always fetch the auction object from the chain using the ID from the URL
  const {
    data: auctionData,
    isLoading,
    isError,
    refetch,
  } = useSuiClientQuery(
    "getObject",
    {
      id,
      options: { showContent: true, showOwner: true },
    },
  );
  const parsedAuction = auctionData?.data ? parseAuctionObject(auctionData.data) : null

  // TODO: Fetch actual bids from the `positions` dynamic field table
  const bids = [];

  const isOwner = account?.address && parsedAuction?.seller === account.address

  // --- Transaction Handlers ---
  const handlePlaceBid = () => {
    if (!account || !bidAmount || !parsedAuction) return;

    const amount = Number.parseFloat(bidAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Please enter a valid bid amount");
      return;
    }

    setTxState("pending");
    setErrorMessage(undefined);

    const tx = new Transaction();
    try {
      const bidInMist = suiToMist(amount);
      const [coin] = tx.splitCoins(tx.gas, [tx.pure(bidInMist)]);

      tx.moveCall({
        target: `${SUIBID_PACKAGE_ID}::auction::place_bid`,
        arguments: [
          tx.object(parsedAuction.id),
          coin,
          tx.object(SUI_CLOCK_OBJECT_ID),
        ],
        typeArguments: [AUCTION_ITEM_TYPE],
      });

      signAndExecute(
        { transaction: tx },
        {
          onSuccess: (result) => {
            setTxState("success");
            setTxDigest(result.digest);
            setBidAmount("");
            toast.success("Bid placed successfully!", {
              action: {
                label: "View on Explorer",
                onClick: () => window.open(`https://suiscan.xyz/testnet/tx/${result.digest}`, "_blank"),
              },
            });
            refetch(); // Refetch auction data to show new highest bid
          },
          onError: (error) => {
            setTxState("error");
            setErrorMessage(error.message);
            toast.error(`Failed to place bid: ${error.message}`);
          },
        }
      );
    } catch (error: any) {
        setTxState("error");
        setErrorMessage(error.message);
        toast.error(`Failed to build transaction: ${error.message}`);
    }
  };

  const handleAddBid = (amountToAdd: number) => {
    const currentAmount = Number.parseFloat(bidAmount) || 0;
    const newAmount = currentAmount + amountToAdd;
    setBidAmount(newAmount.toFixed(2));
  };


  // --- Render States ---
  if (isLoading) {
    return <ItemDetailSkeleton />;
  }

  if (isError || !parsedAuction) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <Package className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
        <h1 className="text-2xl font-semibold mb-2">Auction Not Found</h1>
        <p className="text-muted-foreground mb-6">The auction you're looking for doesn't exist or has been removed.</p>
        <Button asChild>
          <Link href="/">Back to Marketplace</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Link href="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft className="h-4 w-4" />
        Back to Marketplace
      </Link>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Item Image */}
        <div className="aspect-square bg-card border border-border rounded-lg overflow-hidden flex items-center justify-center">
          {parsedAuction.item.imageUrl ? (
            <img src={parsedAuction.item.imageUrl} alt={parsedAuction.item.name} className="w-full h-full object-cover" />
          ) : (
            <Package className="h-24 w-24 text-muted-foreground" />
          )}
        </div>

        {/* Item Details */}
        <div className="space-y-6">
          <div>
            <div className="flex items-start justify-between gap-4 mb-2">
              <h1 className="text-3xl font-bold">{parsedAuction.item.name}</h1>
              <div className="flex gap-2">
                <Badge variant="outline" className="gap-1">
                  <Store className="h-3 w-3" /> Public Auction
                </Badge>
                {isOwner && <Badge>You are the seller</Badge>}
              </div>
            </div>
            <p className="text-muted-foreground">{parsedAuction.item.description}</p>
          </div>

          {/* Current Bid Block */}
          <div className="p-4 bg-secondary/50 rounded-lg">
            <div className="text-sm text-muted-foreground mb-1">Current Highest Bid</div>
            <div className="text-3xl font-bold text-primary flex items-center gap-2">
              <Gavel className="h-6 w-6" />
              <span>{formatSui(parsedAuction.highestBid)} SUI</span>
            </div>
          </div>

          <Separator />

          {/* Owner/Seller Info */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Seller:</span>
              <a href={`https://suiscan.xyz/testnet/account/${parsedAuction.seller}`} target="_blank" rel="noopener noreferrer" className="font-mono text-primary hover:underline inline-flex items-center gap-1">
                {formatAddress(parsedAuction.seller, 8)} <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Package className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Auction ID:</span>
              <a href={`https://suiscan.xyz/testnet/object/${parsedAuction.id}`} target="_blank" rel="noopener noreferrer" className="font-mono text-primary hover:underline inline-flex items-center gap-1">
                {formatAddress(parsedAuction.id, 8)} <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>

          <Separator />

          {/* Transaction Status */}
          <TransactionStatus state={txState} txDigest={txDigest} errorMessage={errorMessage} />

          {/* Bid Position Indicator */}
          <BidPositionIndicator userAddress={account?.address} bids={bids} />

          {/* Place Bid UI */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Place a Bid</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!account ? (
                <div className="text-center py-4">
                  <p className="text-sm text-muted-foreground mb-4">Connect your wallet to place a bid</p>
                  <ConnectWallet />
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="bidAmount">Bid Amount (SUI)</Label>
                    <div className="flex gap-2">
                      <Input id="bidAmount" type="number" step="1" min="0" placeholder="e.g. 5" value={bidAmount} onChange={(e) => setBidAmount(e.target.value)} disabled={txState === "pending"} />
                      <Button onClick={handlePlaceBid} disabled={!bidAmount || txState === "pending"}>
                        {txState === "pending" ? "Submitting..." : "Place Bid"}
                      </Button>
                    </div>
                    <div className="flex gap-2 pt-2">
                        <Button variant="outline" size="sm" onClick={() => handleAddBid(1)} disabled={txState === "pending"}>+1 SUI</Button>
                        <Button variant="outline" size="sm" onClick={() => handleAddBid(5)} disabled={txState === "pending"}>+5 SUI</Button>
                        <Button variant="outline" size="sm" onClick={() => handleAddBid(10)} disabled={txState === "pending"}>+10 SUI</Button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">Your bid is cumulative. This amount will be added to your current position.</p>
                </>
              )}
            </CardContent>
          </Card>
          
          {/* TODO: Replace with live bid history */}
          {bids.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-lg">Bid History</CardTitle></CardHeader>
              <CardContent>
                <p>Live bid history coming soon.</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

// Skeleton component for loading state
function ItemDetailSkeleton() {
  return (
    <div className="container mx-auto px-4 py-8">
       <div className="h-6 w-40 bg-secondary rounded mb-6 animate-pulse" />
      <div className="grid lg:grid-cols-2 gap-8">
        <Skeleton className="aspect-square w-full" />
        <div className="space-y-6">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    </div>
  )
}
