"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams } from "next/navigation"
import { useCurrentAccount, useSuiClient, useSuiClientQuery, useSignAndExecuteTransaction } from "@mysten/dapp-kit"
import { useQueryClient } from "@tanstack/react-query"
import { Transaction } from "@mysten/sui/transactions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TransactionStatus, type TransactionState } from "@/components/transaction-status"
import { formatAddress, formatSui, suiToMist } from "@/lib/sui-utils"
import { SUIBID_PACKAGE_ID, SUI_CLOCK_OBJECT_ID, AUCTION_MODULE, NFT_MODULE } from "@/lib/constants"
import { ArrowLeft, ExternalLink, Package, User, Gavel, Timer, History, Info, ChevronUp, ChevronDown } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { ConnectWallet } from "@/components/connect-wallet"
import { Skeleton } from "@/components/ui/skeleton"
import {
  placeBid,
  endAuction as sdkEndAuction,
  claim as sdkClaim,
  withdraw as sdkWithdraw,
  Auction as SdkAuction,
} from "@/lib/auction-sdk";
import { BidNFT } from "@/lib/nft-sdk";

const calculateTimeRemaining = (endTimeMs: number) => {
  const now = Date.now();
  const difference = endTimeMs - now;
  if (difference <= 0) return "Ended";

  const days = Math.floor(difference / (1000 * 60 * 60 * 24));
  const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((difference % (1000 * 60)) / 1000);

  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  return `${minutes}m ${seconds}s`;
};

export function ItemDetailContent() {
  const { id } = useParams<{ id: string }>()
  const account = useCurrentAccount()
  const suiClient = useSuiClient();
  const queryClient = useQueryClient();
  const { mutateAsync: signAndExecuteAsync } = useSignAndExecuteTransaction()

  const refreshWalletBalance = () => {
    if (account?.address) {
      // Invalidate all balance-related queries using predicate match
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey;
          return Array.isArray(key) && (
            key.some(k => typeof k === "string" && k.toLowerCase().includes("balance"))
          );
        }
      });
      // Also refetch to ensure immediate update
      queryClient.refetchQueries({
        predicate: (query) => {
          const key = query.queryKey;
          return Array.isArray(key) && (
            key.some(k => typeof k === "string" && k.toLowerCase().includes("balance"))
          );
        }
      });
    }
  };

  const [bidAmount, setBidAmount] = useState("")
  const [txState, setTxState] = useState<TransactionState>("idle")
  const [txDigest, setTxDigest] = useState<string>()
  const [errorMessage, setErrorMessage] = useState<string>()
  const [timeRemaining, setTimeRemaining] = useState<string>("");
  const [userPosition, setUserPosition] = useState<number>(0);
  const [bidError, setBidError] = useState<string>("");
  const [shakeInput, setShakeInput] = useState(false);
  const [bidHistory, setBidHistory] = useState<Array<{
    bidder: string;
    bidAmount: number;
    totalPosition: number;
    timestamp?: number;
    txDigest?: string;
  }>>([]);

  const {
    data: auctionObjectData,
    isLoading: isLoadingAuction,
    isError: isErrorAuction,
    refetch: refetchAuction,
  } = useSuiClientQuery("getObject", {
    id,
    options: { showContent: true, showOwner: true, showType: true },
  });

  const parsedAuction: SdkAuction | null = auctionObjectData?.data
    ? (() => {
      const fieldsAuction = (auctionObjectData.data.content as any)?.fields;
      if (!fieldsAuction) return null;

      // Parse Option<address> - Sui can return it in different formats
      const parseOptionAddress = (opt: any): string | null => {
        if (!opt) return null;
        // Format 1: { fields: { vec: ["0x..."] } }
        if (opt?.fields?.vec?.[0]) return opt.fields.vec[0];
        // Format 2: { vec: ["0x..."] }
        if (opt?.vec?.[0]) return opt.vec[0];
        // Format 3: Direct string (some serializations)
        if (typeof opt === 'string') return opt;
        return null;
      };

      const highestBidder = parseOptionAddress(fieldsAuction.highest_bidder);
      console.log("[Debug] highest_bidder raw:", fieldsAuction.highest_bidder);
      console.log("[Debug] highest_bidder parsed:", highestBidder);

      return {
        id: auctionObjectData.data.objectId,
        item: fieldsAuction.item,
        seller: fieldsAuction.seller,
        min_bid: parseInt(fieldsAuction.min_bid || "0", 10),
        highest_bid: parseInt(fieldsAuction.highest_bid || "0", 10),
        highest_bidder: highestBidder,
        end_time: parseInt(fieldsAuction.end_time || "0", 10),
        active: fieldsAuction.active ?? true,
      };
    })()
    : null;

  const parsedNFT: BidNFT | null = parsedAuction?.item
    ? (() => {
      let itemFields = parsedAuction.item?.fields;
      if (parsedAuction.item?.fields?.vec) {
        itemFields = parsedAuction.item.fields.vec[0]?.fields;
      }
      if (!itemFields) return null;
      const imageUrl = typeof itemFields.image_url === 'string'
        ? itemFields.image_url
        : itemFields.image_url?.url || itemFields.url || null;
      return {
        id: itemFields.id?.id || "",
        name: itemFields.name || "Unnamed NFT",
        description: itemFields.description || "No description",
        image_url: imageUrl,
        creator: itemFields.creator || "",
      };
    })()
    : null;

  const getItemTypeFromAuction = (): string => {
    if (parsedAuction?.item?.type) return parsedAuction.item.type;
    const auctionType = (auctionObjectData?.data?.content as any)?.type;
    if (auctionType) {
      const match = auctionType.match(/<(.+)>/);
      if (match && match[1]) return match[1];
    }
    return `${SUIBID_PACKAGE_ID}::${NFT_MODULE}::BidNFT`;
  };
  const auctionItemType = getItemTypeFromAuction();

  const { data: userPositionData, refetch: refetchUserPosition } = useSuiClientQuery(
    "devInspectTransactionBlock",
    {
      sender: account?.address || "0x0",
      transactionBlock: (() => {
        const tx = new Transaction();
        tx.moveCall({
          target: `${SUIBID_PACKAGE_ID}::${AUCTION_MODULE}::get_position`,
          arguments: [tx.object(id), tx.pure.address(account?.address || "0x0")],
          typeArguments: [auctionItemType],
        });
        return tx;
      })(),
    },
    {
      enabled: !!account?.address && !!parsedAuction?.id,
      select: (result) => {
        const returnValues = (result.results?.[0].returnValues?.[0] as any);
        if (returnValues) {
          const value = returnValues[0];
          const u64 = new DataView(new Uint8Array(value).buffer).getBigUint64(0, true);
          return Number(u64);
        }
        return 0;
      },
    }
  );

  useEffect(() => {
    if (userPositionData !== undefined) setUserPosition(userPositionData);
  }, [userPositionData]);

  const fetchBidHistory = async () => {
    if (!id || !SUIBID_PACKAGE_ID) return;
    try {
      const events = await suiClient.queryEvents({
        query: { MoveEventType: `${SUIBID_PACKAGE_ID}::${AUCTION_MODULE}::BidPlaced` },
        limit: 50,
        order: "descending",
      });
      const bids = events.data
        .filter((event: any) => event.parsedJson?.auction_id === id)
        .map((event: any) => ({
          bidder: event.parsedJson.bidder,
          bidAmount: Number(event.parsedJson.bid_amount),
          totalPosition: Number(event.parsedJson.total_position),
          timestamp: Number(event.timestampMs),
          txDigest: event.id?.txDigest,
        }));
      setBidHistory(bids);
    } catch (error) {
      console.error("[BidHistory] Failed to fetch:", error);
    }
  };

  useEffect(() => { fetchBidHistory(); }, [id]);

  useEffect(() => {
    if (parsedAuction?.active && parsedAuction.end_time > Date.now()) {
      const timer = setInterval(() => setTimeRemaining(calculateTimeRemaining(parsedAuction.end_time)), 1000);
      return () => clearInterval(timer);
    } else if (parsedAuction) {
      setTimeRemaining("Ended");
    }
  }, [parsedAuction]);

  const isAuctionActive = parsedAuction?.active && Date.now() < parsedAuction.end_time;
  const isAuctionEnded = parsedAuction && (!parsedAuction.active || Date.now() >= parsedAuction.end_time);

  // Normalize addresses for comparison (Sui addresses may have different formats)
  const normalizeAddress = (addr: string | null | undefined): string => {
    if (!addr) return "";
    // Remove 0x prefix, leading zeros, and convert to lowercase for comparison
    // This handles cases like "0x00000...abc" vs "0xabc"
    return addr.toLowerCase().replace(/^0x0*/, "");
  };

  const isSeller = normalizeAddress(account?.address) === normalizeAddress(parsedAuction?.seller);
  const isHighestBidder = account?.address && parsedAuction?.highest_bidder &&
    normalizeAddress(account.address) === normalizeAddress(parsedAuction.highest_bidder);
  const hasBidPosition = userPosition > 0;
  const isWinner = isHighestBidder && isAuctionEnded;

  // Debug logging for winner detection
  console.log("[Debug] Winner check:", {
    accountAddress: account?.address,
    highestBidder: parsedAuction?.highest_bidder,
    normalizedAccount: normalizeAddress(account?.address),
    normalizedHighestBidder: normalizeAddress(parsedAuction?.highest_bidder),
    isHighestBidder,
    isAuctionEnded,
    isWinner,
    auctionActive: parsedAuction?.active,
  });

  // Calculate minimum required bid
  const calculateRequiredBid = (): { minBidSui: number; minAmountNeeded: number } => {
    if (!parsedAuction) return { minBidSui: 0, minAmountNeeded: 0 };

    // Always require bid > current highest_bid (which equals min_bid initially)
    // This matches user expectation: if "Current Bid" shows X, you need > X
    const requiredMin = parsedAuction.highest_bid + 1;

    // User's new position = current position + new bid amount
    // Need: userPosition + bidAmount >= requiredMin
    // So: bidAmount >= requiredMin - userPosition
    const minAmountNeeded = Math.max(0, requiredMin - userPosition);
    const minBidSui = minAmountNeeded / 1_000_000_000; // Convert MIST to SUI

    return { minBidSui, minAmountNeeded };
  };

  const { minBidSui, minAmountNeeded } = calculateRequiredBid();

  // Validate bid amount
  const validateBid = (amount: string, shouldShake: boolean = false): boolean => {
    if (!amount || !parsedAuction) {
      setBidError("");
      return false;
    }

    const amountNum = Number.parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setBidError("Enter a valid amount");
      if (shouldShake) triggerShake();
      return false;
    }

    // Convert to MIST as number for validation (suiToMist returns bigint)
    const amountMist = Math.floor(amountNum * 1_000_000_000);
    const newPosition = userPosition + amountMist;
    // Always require > highest_bid (which equals min_bid initially)
    const requiredMin = parsedAuction.highest_bid + 1;

    if (newPosition < requiredMin) {
      setBidError(`Must bid > ${(parsedAuction.highest_bid / 1_000_000_000).toFixed(2)} SUI`);
      if (shouldShake) triggerShake();
      return false;
    }

    setBidError("");
    return true;
  };

  const handleBidAmountChange = (value: string) => {
    setBidAmount(value);
    // Validate but don't shake on every keystroke - only show red border
    validateBid(value, false);
  };

  const triggerShake = useCallback(() => {
    setShakeInput(true);
    setTimeout(() => setShakeInput(false), 500);
  }, []);

  // Shake when user stops typing with invalid amount (debounced)
  useEffect(() => {
    if (bidError && bidAmount) {
      const timer = setTimeout(() => {
        triggerShake();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [bidError, bidAmount, triggerShake]);

  const handlePlaceBid = async () => {
    if (!account || !bidAmount || !parsedAuction) return;
    const amount = Number.parseFloat(bidAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Please enter a valid bid amount.");
      triggerShake();
      return;
    }

    // Validate bid amount before submitting (with shake on error)
    if (!validateBid(bidAmount, true)) {
      toast.error(bidError || "Bid amount too low");
      return;
    }
    setTxState("pending");
    setErrorMessage(undefined);
    try {
      const result = await placeBid(
        { ...account, signAndExecuteTransaction: signAndExecuteAsync } as any,
        suiClient, parsedAuction.id, auctionItemType, suiToMist(amount),
      );
      setTxDigest(result?.digest);
      if (result?.digest) await suiClient.waitForTransaction({ digest: result.digest });
      setTxState("success");
      setBidAmount("");
      toast.success("Bid placed successfully!");
      refetchAuction(); refetchUserPosition(); fetchBidHistory(); refreshWalletBalance();
    } catch (error: any) {
      setTxState("error");
      setErrorMessage(error.message);
      toast.error(`Failed: ${error.message}`);
    }
  };

  const handleEndAuction = async () => {
    if (!account || !parsedAuction || !isSeller) return;
    setTxState("pending");
    try {
      const result = await sdkEndAuction({ ...account, signAndExecuteTransaction: signAndExecuteAsync } as any, parsedAuction.id, auctionItemType);
      if (result?.digest) await suiClient.waitForTransaction({ digest: result.digest });
      setTxState("success");
      toast.success("Auction ended!");
      refetchAuction(); refreshWalletBalance();
    } catch (error: any) {
      setTxState("error");
      toast.error(`Failed: ${error.message}`);
    }
  };

  const handleClaim = async () => {
    if (!account || !parsedAuction || isAuctionActive) return;
    setTxState("pending");
    try {
      const result = await sdkClaim({ ...account, signAndExecuteTransaction: signAndExecuteAsync } as any, parsedAuction.id, auctionItemType);
      if (result?.digest) await suiClient.waitForTransaction({ digest: result.digest });
      setTxState("success");

      // Award points to winner (not seller)
      if (isWinner && account.address) {
        try {
          await fetch("/api/leaderboard", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              address: account.address,
              points: 10, // 10 points per auction win
              itemValue: parsedAuction.highest_bid,
            }),
          });
          toast.success("Claimed NFT! +10 points earned!");
        } catch (err) {
          console.error("[Claim] Failed to award points:", err);
          toast.success("Claimed successfully!");
        }
      } else {
        toast.success("Funds claimed successfully!");
      }

      refetchAuction(); refreshWalletBalance();
    } catch (error: any) {
      setTxState("error");
      toast.error(`Failed: ${error.message}`);
    }
  };

  const handleWithdraw = async () => {
    if (!account || !parsedAuction || isAuctionActive || !hasBidPosition || isWinner) return;
    setTxState("pending");
    try {
      const result = await sdkWithdraw({ ...account, signAndExecuteTransaction: signAndExecuteAsync } as any, parsedAuction.id, auctionItemType);
      if (result?.digest) await suiClient.waitForTransaction({ digest: result.digest });
      setTxState("success");
      toast.success("Withdrawn successfully!");
      refetchAuction(); refetchUserPosition(); refreshWalletBalance();
    } catch (error: any) {
      setTxState("error");
      toast.error(`Failed: ${error.message}`);
    }
  };

  if (isLoadingAuction) return <ItemDetailSkeleton />;
  if (isErrorAuction || !parsedAuction || !parsedNFT) {
    return (
      <div className="h-[calc(100vh-64px)] flex items-center justify-center">
        <div className="text-center">
          <Package className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h1 className="text-2xl font-semibold mb-2">Auction Not Found</h1>
          <Button asChild><Link href="/">Back to Marketplace</Link></Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-card/50">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <div className="flex items-center gap-2">
          {isSeller && <Badge variant="secondary">Seller</Badge>}
          {isHighestBidder && <Badge className="bg-green-500">Leading</Badge>}
          {isWinner && <Badge className="bg-yellow-500">Winner</Badge>}
        </div>
      </div>

      {/* Main Content - 3 Column Layout */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 p-4 min-h-0">
        {/* Left: NFT Image + Title */}
        <div className="lg:col-span-5 flex flex-col gap-3 min-h-0">
          {/* Title & Description with Image */}
          <div className="flex gap-4">
            <div className="w-32 h-32 shrink-0 bg-card border rounded-lg overflow-hidden flex items-center justify-center">
              {parsedNFT.image_url ? (
                <img src={parsedNFT.image_url} alt={parsedNFT.name} className="w-full h-full object-cover" />
              ) : (
                <Package className="h-12 w-12 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold truncate">{parsedNFT.name}</h1>
              <p className="text-sm text-muted-foreground line-clamp-3 mt-1">{parsedNFT.description}</p>
            </div>
          </div>

          {/* Price & Timer Row */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-secondary/50 rounded-lg p-3">
              <div className="text-xs text-muted-foreground">Current Bid</div>
              <div className="text-lg font-bold text-primary flex items-center gap-1">
                <Gavel className="h-4 w-4" />
                {formatSui(parsedAuction.highest_bid.toString())} SUI
              </div>
              {parsedAuction.highest_bidder && (
                <div className="text-xs text-muted-foreground truncate">
                  by {formatAddress(parsedAuction.highest_bidder, 4)}
                </div>
              )}
            </div>
            <div className={`rounded-lg p-3 ${isAuctionActive ? 'bg-blue-500/10' : 'bg-secondary/50'}`}>
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <Timer className="h-3 w-3" />
                {isAuctionActive ? "Ends In" : "Status"}
              </div>
              <div className={`text-lg font-bold ${isAuctionActive ? 'text-blue-500' : 'text-muted-foreground'}`}>
                {timeRemaining}
              </div>
            </div>
          </div>

          {/* Your Position */}
          {account && hasBidPosition && (
            <div className="bg-primary/10 rounded-lg p-3 flex items-center justify-between">
              <div>
                <div className="text-xs text-muted-foreground">Your Position</div>
                <div className="font-semibold text-primary">{formatSui(userPosition.toString())} SUI</div>
              </div>
              {isHighestBidder && <Badge className="bg-green-500">Leading</Badge>}
            </div>
          )}

          {/* Bid Input */}
          {isAuctionActive && (
            <div className="bg-card border rounded-lg p-3 space-y-2">
              {!account ? (
                <div className="text-center py-2">
                  <p className="text-sm text-muted-foreground mb-2">Connect wallet to bid</p>
                  <ConnectWallet />
                </div>
              ) : (
                <>
                  <div className="flex flex-col gap-1">
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        step="0.01"
                        placeholder={minBidSui > 0 ? `Min: ${minBidSui.toFixed(2)} SUI` : "Amount in SUI"}
                        value={bidAmount}
                        onChange={(e) => handleBidAmountChange(e.target.value)}
                        disabled={txState === "pending"}
                        className={`flex-1 transition-all ${shakeInput ? "animate-shake" : ""}`}
                        style={bidError ? {
                          borderColor: "#ef4444",
                          boxShadow: "0 0 0 2px rgba(239, 68, 68, 0.3)",
                        } : undefined}
                      />
                      <Button
                        onClick={handlePlaceBid}
                        disabled={!bidAmount || txState === "pending" || !!bidError}
                      >
                        {txState === "pending" ? "..." : "Bid"}
                      </Button>
                    </div>
                    {bidError && (
                      <p className="text-xs text-red-500 animate-fadeIn font-medium">{bidError}</p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    {[1, 5, 10].map((amt) => (
                      <Button
                        key={`plus-${amt}`}
                        variant="outline"
                        size="sm"
                        className="flex-1 text-xs"
                        onClick={() => {
                          const newValue = (Number(bidAmount || 0) + amt).toString();
                          handleBidAmountChange(newValue);
                        }}
                        disabled={txState === "pending"}
                      >
                        <ChevronUp className="h-3 w-3 mr-1" />+{amt}
                      </Button>
                    ))}
                  </div>
                  <div className="flex gap-1">
                    {[1, 5, 10].map((amt) => (
                      <Button
                        key={`minus-${amt}`}
                        variant="outline"
                        size="sm"
                        className="flex-1 text-xs"
                        onClick={() => {
                          const newValue = Math.max(0, Number(bidAmount || 0) - amt).toString();
                          handleBidAmountChange(newValue);
                        }}
                        disabled={txState === "pending"}
                      >
                        <ChevronDown className="h-3 w-3 mr-1" />-{amt}
                      </Button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Action Buttons */}
          {account && !isAuctionActive && (
            <div className="flex flex-col gap-2">
              {isSeller && parsedAuction.active && Date.now() >= parsedAuction.end_time && (
                <Button onClick={handleEndAuction} disabled={txState === "pending"}>
                  End Auction
                </Button>
              )}
              {/* Winner claims NFT (seller gets paid automatically) */}
              {isWinner && !parsedAuction.active && (
                <Button onClick={handleClaim} disabled={txState === "pending"}>
                  Claim NFT
                </Button>
              )}
              {/* Seller can only reclaim item if there were NO bids */}
              {isSeller && !parsedAuction.active && !parsedAuction.highest_bidder && (
                <Button onClick={handleClaim} disabled={txState === "pending"}>
                  Reclaim Item
                </Button>
              )}
              {/* Show info to seller when waiting for winner to claim */}
              {isSeller && !parsedAuction.active && parsedAuction.highest_bidder && (
                <div className="text-sm text-muted-foreground bg-secondary/50 rounded-lg p-3 text-center">
                  Waiting for winner to claim. You'll receive {formatSui(parsedAuction.highest_bid.toString())} SUI automatically.
                </div>
              )}
              {hasBidPosition && !isWinner && !isSeller && !parsedAuction.active && (
                <Button variant="outline" onClick={handleWithdraw} disabled={txState === "pending"}>
                  Withdraw {formatSui(userPosition.toString())} SUI
                </Button>
              )}
            </div>
          )}

          {/* Transaction Status */}
          {txState !== "idle" && (
            <TransactionStatus state={txState} txDigest={txDigest} errorMessage={errorMessage} />
          )}
        </div>

        {/* Right: Tabs for History/Details */}
        <div className="lg:col-span-7 flex flex-col min-h-0">
          <Tabs defaultValue="history" className="flex flex-col flex-1 min-h-0">
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="history" className="text-xs gap-1">
                <History className="h-3 w-3" /> Bids ({bidHistory.length})
              </TabsTrigger>
              <TabsTrigger value="details" className="text-xs gap-1">
                <Info className="h-3 w-3" /> Details
              </TabsTrigger>
            </TabsList>

            <TabsContent value="history" className="flex-1 overflow-hidden mt-2">
              <div className="h-full overflow-y-auto space-y-2 pr-1">
                {bidHistory.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8 text-sm">
                    No bids yet. Be the first!
                  </div>
                ) : (
                  bidHistory.map((bid, i) => (
                    <div key={`${bid.txDigest}-${i}`} className="flex items-center justify-between p-2 bg-secondary/30 rounded-lg text-sm">
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-1">
                          <User className="h-3 w-3 text-muted-foreground shrink-0" />
                          <span className="font-mono text-xs truncate">{formatAddress(bid.bidder, 4)}</span>
                          {bid.bidder === account?.address && <Badge variant="outline" className="text-[10px] px-1">You</Badge>}
                          {bid.bidder === parsedAuction.highest_bidder && <Badge className="text-[10px] px-1 bg-green-500">Top</Badge>}
                        </div>
                        {bid.timestamp && (
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(bid.timestamp).toLocaleTimeString()}
                          </span>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-semibold text-primary text-xs">+{formatSui(bid.bidAmount.toString())}</div>
                        <div className="text-[10px] text-muted-foreground">{formatSui(bid.totalPosition.toString())} total</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </TabsContent>

            <TabsContent value="details" className="flex-1 overflow-hidden mt-2">
              <div className="h-full overflow-y-auto space-y-3 pr-1">
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Seller</span>
                    <a
                      href={`https://suiscan.xyz/testnet/account/${parsedAuction.seller}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-primary hover:underline flex items-center gap-1"
                    >
                      {formatAddress(parsedAuction.seller, 6)}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Auction ID</span>
                    <a
                      href={`https://suiscan.xyz/testnet/object/${parsedAuction.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-primary hover:underline flex items-center gap-1"
                    >
                      {formatAddress(parsedAuction.id, 6)}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">NFT ID</span>
                    <a
                      href={`https://suiscan.xyz/testnet/object/${parsedNFT.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-primary hover:underline flex items-center gap-1"
                    >
                      {formatAddress(parsedNFT.id, 6)}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Min Bid</span>
                    <span className="font-mono">{formatSui(parsedAuction.min_bid.toString())} SUI</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Status</span>
                    <Badge variant={parsedAuction.active ? "default" : "secondary"}>
                      {parsedAuction.active ? "Active" : "Ended"}
                    </Badge>
                  </div>
                </div>

                {parsedNFT.creator && (
                  <div className="pt-2 border-t">
                    <div className="text-xs text-muted-foreground mb-1">Creator</div>
                    <span className="font-mono text-sm">{formatAddress(parsedNFT.creator, 8)}</span>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

function ItemDetailSkeleton() {
  return (
    <div className="h-[calc(100vh-64px)] flex flex-col">
      <div className="px-4 py-2 border-b">
        <Skeleton className="h-6 w-20" />
      </div>
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 p-4">
        <div className="lg:col-span-5 space-y-3">
          <div className="flex gap-4">
            <Skeleton className="w-32 h-32 shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </div>
          <Skeleton className="h-32" />
        </div>
        <div className="lg:col-span-7">
          <Skeleton className="h-10 w-full mb-2" />
          <Skeleton className="h-full min-h-[200px]" />
        </div>
      </div>
    </div>
  );
}
