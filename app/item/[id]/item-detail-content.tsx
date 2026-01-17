"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { useCurrentAccount, useSuiClient, useSuiClientQuery, useSignAndExecuteTransaction } from "@mysten/dapp-kit"
import { Transaction } from "@mysten/sui/transactions"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { TransactionStatus, type TransactionState } from "@/components/transaction-status"
import { formatAddress, formatSui, mistToSui, suiToMist } from "@/lib/sui-utils"
import { SUIBID_PACKAGE_ID, AUCTION_ITEM_TYPE, SUI_CLOCK_OBJECT_ID, AUCTION_MODULE, NFT_MODULE } from "@/lib/constants"
import { ArrowLeft, ExternalLink, Package, User, Wallet, Store, Gavel, Timer } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { ConnectWallet } from "@/components/connect-wallet"
import { BidPositionIndicator } from "@/components/bid-position-indicator"
import { Skeleton } from "@/components/ui/skeleton"
import {
  placeBid,
  endAuction as sdkEndAuction,
  claim as sdkClaim,
  withdraw as sdkWithdraw,
  Auction as SdkAuction,
} from "@/lib/auction-sdk";
import { BidNFT } from "@/lib/nft-sdk";

// Helper function to calculate time remaining
const calculateTimeRemaining = (endTimeMs: number) => {
  const now = Date.now();
  const difference = endTimeMs - now;

  const days = Math.floor(difference / (1000 * 60 * 60 * 24));
  const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((difference % (1000 * 60)) / 1000);

  if (difference <= 0) {
    return "Auction Ended";
  }

  return `${days > 0 ? `${days}d ` : ''}${hours > 0 || days > 0 ? `${hours}h ` : ''}${minutes > 0 || hours > 0 || days > 0 ? `${minutes}m ` : ''}${seconds}s`;
};

// Main component for displaying the details of an on-chain auction
export function ItemDetailContent() {
  const { id } = useParams<{ id: string }>()
  const account = useCurrentAccount()
  const suiClient = useSuiClient();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction()

  // State for the bid input and transaction status
  const [bidAmount, setBidAmount] = useState("")
  const [txState, setTxState] = useState<TransactionState>("idle")
  const [txDigest, setTxDigest] = useState<string>()
  const [errorMessage, setErrorMessage] = useState<string>()
  const [timeRemaining, setTimeRemaining] = useState<string>("");
  const [userPosition, setUserPosition] = useState<number>(0);

  // --- Data Fetching ---
  const {
    data: auctionObjectData,
    isLoading: isLoadingAuction,
    isError: isErrorAuction,
    refetch: refetchAuction,
  } = useSuiClientQuery("getObject", {
    id,
    options: { showContent: true, showOwner: true },
  });

  const parsedAuction: SdkAuction | null = auctionObjectData?.data
    ? {
      id: auctionObjectData.data.objectId,
      item: (auctionObjectData.data.content as any).fields.item, // Direct object ID of the NFT
      seller: (auctionObjectData.data.content as any).fields.seller,
      min_bid: parseInt((auctionObjectData.data.content as any).fields.min_bid, 10),
      highest_bid: parseInt((auctionObjectData.data.content as any).fields.highest_bid, 10),
      highest_bidder: (auctionObjectData.data.content as any).fields.highest_bidder.fields.vec[0] || null,
      end_time: parseInt((auctionObjectData.data.content as any).fields.end_time, 10),
      active: (auctionObjectData.data.content as any).fields.active,
    }
    : null;

  const {
    data: nftObjectData,
    isLoading: isLoadingNFT,
    isError: isErrorNFT,
    refetch: refetchNFT,
  } = useSuiClientQuery("getObject", {
    id: parsedAuction?.item || "",
    options: { showContent: true },
    enabled: !!parsedAuction?.item, // Only fetch NFT if auction data is available
  });

  const parsedNFT: BidNFT | null = nftObjectData?.data
    ? {
      id: nftObjectData.data.objectId,
      name: (nftObjectData.data.content as any).fields.name,
      description: (nftObjectData.data.content as any).fields.description,
      image_url: (nftObjectData.data.content as any).fields.image_url.url,
      creator: (nftObjectData.data.content as any).fields.creator,
    }
    : null;


  const auctionItemType = `${SUIBID_PACKAGE_ID}::${NFT_MODULE}::BidNFT`; // Explicitly define the item type

  // Fetch user's current bid position
  const { data: userPositionData, refetch: refetchUserPosition } = useSuiClientQuery(
    "devInspectTransactionBlock",
    {
      sender: account?.address || "0x0", // Use a dummy address if not connected
      transactionBlock: new Transaction().moveCall({
        target: `${SUIBID_PACKAGE_ID}::${AUCTION_MODULE}::get_position`,
        arguments: [
          new Transaction().object(id),
          new Transaction().pure(account?.address || "0x0", 'address'),
        ],
        typeArguments: [auctionItemType],
      }),
    },
    {
      enabled: !!account?.address && !!parsedAuction?.id,
      select: (result) => {
        // Parse the dev inspect result to get the returned u64 position
        const returnValues = (result.results?.[0].returnValues?.[0] as any);
        if (returnValues) {
          const value = returnValues[0]; // u64 as little-endian bytes
          const u64 = new DataView(new Uint8Array(value).buffer).getBigUint64(0, true);
          return Number(u64);
        }
        return 0;
      },
    }
  );

  useEffect(() => {
    if (userPositionData !== undefined) {
      setUserPosition(userPositionData);
    }
  }, [userPositionData]);

  // Update time remaining every second
  useEffect(() => {
    if (parsedAuction && parsedAuction.active) {
      const timer = setInterval(() => {
        setTimeRemaining(calculateTimeRemaining(parsedAuction.end_time));
      }, 1000);
      return () => clearInterval(timer);
    } else if (parsedAuction) {
      setTimeRemaining("Auction Ended");
    }
  }, [parsedAuction]);


  // Determine roles and states
  const isAuctionActive = parsedAuction?.active && Date.now() < parsedAuction.end_time;
  const isAuctionEnded = parsedAuction && (!parsedAuction.active || Date.now() >= parsedAuction.end_time);
  const isSeller = account?.address === parsedAuction?.seller;
  const isHighestBidder = account?.address && parsedAuction?.highest_bidder === account.address;
  const hasBidPosition = userPosition > 0;
  const isWinner = isHighestBidder && isAuctionEnded;


  // --- Transaction Handlers ---
  const handlePlaceBid = async () => {
    if (!account || !bidAmount || !parsedAuction) return;

    const amount = Number.parseFloat(bidAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Please enter a valid bid amount.");
      return;
    }

    setTxState("pending");
    setErrorMessage(undefined);

    try {
      const bidInMist = suiToMist(amount);
      const result = await placeBid(
        { ...account, signAndExecuteTransactionBlock: signAndExecute } as any, // Cast to match WalletContextState
        suiClient,
        parsedAuction.id,
        auctionItemType,
        bidInMist,
      );

      setTxState("success");
      setTxDigest(result.digest);
      setBidAmount("");
      toast.success("Bid placed successfully!", {
        action: {
          label: "View on Explorer",
          onClick: () => window.open(`https://suiscan.xyz/testnet/tx/${result.digest}`, "_blank"),
        },
      });
      refetchAuction(); // Refetch auction data to show new highest bid
      refetchUserPosition(); // Refetch user position
    } catch (error: any) {
      setTxState("error");
      setErrorMessage(error.message);
      toast.error(`Failed to place bid: ${error.message}`);
    }
  };

  const handleAddBid = (amountToAdd: number) => {
    const currentAmount = Number.parseFloat(bidAmount) || 0;
    const newAmount = currentAmount + amountToAdd;
    setBidAmount(newAmount.toFixed(2));
  };

  const handleEndAuction = async () => {
    if (!account || !parsedAuction || !isSeller || !isAuctionActive) return;

    setTxState("pending");
    setErrorMessage(undefined);

    try {
      const result = await sdkEndAuction(
        { ...account, signAndExecuteTransactionBlock: signAndExecute } as any,
        parsedAuction.id,
        auctionItemType,
      );

      setTxState("success");
      setTxDigest(result.digest);
      toast.success("Auction ended successfully!", {
        action: {
          label: "View on Explorer",
          onClick: () => window.open(`https://suiscan.xyz/testnet/tx/${result.digest}`, "_blank"),
        },
      });
      refetchAuction();
    } catch (error: any) {
      setTxState("error");
      setErrorMessage(error.message);
      toast.error(`Failed to end auction: ${error.message}`);
    }
  };

  const handleClaim = async () => {
    if (!account || !parsedAuction || isAuctionActive) return; // Can only claim after auction ends

    setTxState("pending");
    setErrorMessage(undefined);

    try {
      const result = await sdkClaim(
        { ...account, signAndExecuteTransactionBlock: signAndExecute } as any,
        parsedAuction.id,
        auctionItemType,
      );

      setTxState("success");
      setTxDigest(result.digest);
      toast.success("Item claimed / funds received successfully!", {
        action: {
          label: "View on Explorer",
          onClick: () => window.open(`https://suiscan.xyz/testnet/tx/${result.digest}`, "_blank"),
        },
      });
      refetchAuction();
    } catch (error: any) {
      setTxState("error");
      setErrorMessage(error.message);
      toast.error(`Failed to claim: ${error.message}`);
    }
  };

  const handleWithdraw = async () => {
    if (!account || !parsedAuction || isAuctionActive || !hasBidPosition || isWinner) return;

    setTxState("pending");
    setErrorMessage(undefined);

    try {
      const result = await sdkWithdraw(
        { ...account, signAndExecuteTransactionBlock: signAndExecute } as any,
        parsedAuction.id,
        auctionItemType,
      );

      setTxState("success");
      setTxDigest(result.digest);
      toast.success("Bid withdrawn successfully!", {
        action: {
          label: "View on Explorer",
          onClick: () => window.open(`https://suiscan.xyz/testnet/tx/${result.digest}`, "_blank"),
        },
      });
      refetchAuction();
      refetchUserPosition();
    } catch (error: any) {
      setTxState("error");
      setErrorMessage(error.message);
      toast.error(`Failed to withdraw bid: ${error.message}`);
    }
  };

  // --- Render States ---
  if (isLoadingAuction || isLoadingNFT) {
    return <ItemDetailSkeleton />;
  }

  if (isErrorAuction || !parsedAuction || isErrorNFT || !parsedNFT) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <Package className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
        <h1 className="text-2xl font-semibold mb-2">Auction Not Found</h1>
        <p className="text-muted-foreground mb-6">The auction or item you're looking for doesn't exist or has been removed.</p>
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
          {parsedNFT.image_url ? (
            <img src={parsedNFT.image_url} alt={parsedNFT.name} className="w-full h-full object-cover" />
          ) : (
            <Package className="h-24 w-24 text-muted-foreground" />
          )}
        </div>

        {/* Item Details */}
        <div className="space-y-6">
          <div>
            <div className="flex items-start justify-between gap-4 mb-2">
              <h1 className="text-3xl font-bold">{parsedNFT.name}</h1>
              <div className="flex gap-2">
                <Badge variant="outline" className="gap-1">
                  <Store className="h-3 w-3" /> Public Auction
                </Badge>
                {isSeller && <Badge>You are the seller</Badge>}
                {isHighestBidder && <Badge className="bg-green-500 hover:bg-green-500">Highest Bidder</Badge>}
                {isWinner && <Badge className="bg-yellow-500 hover:bg-yellow-500">Winner!</Badge>}
              </div>
            </div>
            <p className="text-muted-foreground">{parsedNFT.description}</p>
          </div>

          {/* Current Bid Block */}
          <div className="p-4 bg-secondary/50 rounded-lg">
            <div className="text-sm text-muted-foreground mb-1">Current Highest Bid</div>
            <div className="text-3xl font-bold text-primary flex items-center gap-2">
              <Gavel className="h-6 w-6" />
              <span>{formatSui(mistToSui(parsedAuction.highest_bid))} SUI</span>
            </div>
            {parsedAuction.highest_bidder && (
                <div className="text-sm text-muted-foreground mt-1">
                    Highest Bidder: <span className="font-mono">{formatAddress(parsedAuction.highest_bidder, 6)}</span>
                </div>
            )}
          </div>

          {/* Auction Status and Time Remaining */}
          <div className="p-4 bg-blue-100 dark:bg-blue-950 rounded-lg flex items-center gap-3">
            <Timer className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            <div>
              <div className="text-sm text-blue-600 dark:text-blue-400">
                {isAuctionActive ? "Auction Ends In" : "Auction Status"}
              </div>
              <div className="text-lg font-semibold text-blue-800 dark:text-blue-200">
                {timeRemaining}
              </div>
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
            <div className="flex items-center gap-2 text-sm">
              <Package className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">NFT ID:</span>
              <a href={`https://suiscan.xyz/testnet/object/${parsedNFT.id}`} target="_blank" rel="noopener noreferrer" className="font-mono text-primary hover:underline inline-flex items-center gap-1">
                {formatAddress(parsedNFT.id, 8)} <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>

          <Separator />

          {/* Transaction Status */}
          <TransactionStatus state={txState} txDigest={txDigest} errorMessage={errorMessage} />

          {/* Bid Position Indicator */}
          {account?.address && hasBidPosition && (
            <BidPositionIndicator userAddress={account.address} userPosition={userPosition} />
          )}

          {/* Place Bid UI */}
          {isAuctionActive && (
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
                        <Input id="bidAmount" type="number" step="0.000000001" min="0" placeholder="e.g. 5" value={bidAmount} onChange={(e) => setBidAmount(e.target.value)} disabled={txState === "pending"} />
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
          )}

          {/* Auction Control Buttons (End, Claim, Withdraw) */}
          <Card>
            <CardHeader><CardTitle className="text-lg">Auction Actions</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {!account ? (
                <div className="text-center py-4">
                  <p className="text-sm text-muted-foreground mb-4">Connect your wallet to perform actions</p>
                  <ConnectWallet />
                </div>
              ) : (
                <div className="flex flex-col space-y-2">
                  {/* End Auction Button */}
                  {isSeller && isAuctionActive && Date.now() >= parsedAuction.end_time && ( // Only show if seller AND time is past end_time
                    <Button onClick={handleEndAuction} disabled={txState === "pending"}>
                      {txState === "pending" ? "Ending Auction..." : "End Auction"}
                    </Button>
                  )}
                   {isSeller && isAuctionActive && Date.now() < parsedAuction.end_time && (
                    <Button variant="secondary" disabled>
                       Auction still active. Wait for end time.
                    </Button>
                  )}


                  {/* Claim Button (Seller or Winner) */}
                  {!isAuctionActive && (isSeller || isWinner) && (
                    <Button onClick={handleClaim} disabled={txState === "pending"}>
                      {txState === "pending" ? "Claiming..." : "Claim Item / Funds"}
                    </Button>
                  )}

                  {/* Withdraw Button (Non-winning bidder) */}
                  {!isAuctionActive && hasBidPosition && !isWinner && (
                    <Button onClick={handleWithdraw} disabled={txState === "pending"} variant="outline">
                      {txState === "pending" ? "Withdrawing..." : `Withdraw ${formatSui(mistToSui(userPosition))} SUI Bid`}
                    </Button>
                  )}

                  {/* No Actions Available */}
                  {!isSeller && !isHighestBidder && !hasBidPosition && !isAuctionActive && (
                    <p className="text-sm text-muted-foreground text-center">No actions available for you.</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
          
          {/* Bid History - currently a placeholder */}
          <Card>
            <CardHeader><CardTitle className="text-lg">Bid History</CardTitle></CardHeader>
            <CardContent>
              <p>Live bid history coming soon.</p>
            </CardContent>
          </Card>
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
