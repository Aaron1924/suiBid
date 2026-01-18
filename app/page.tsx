"use client"

import { useEffect, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { useSuiClient } from "@mysten/dapp-kit"
import { MarketplaceItemCard, type DisplayableListing } from "@/components/marketplace-item-card"
import { TradeItemCard, type DisplayableTrade } from "@/components/trade-item-card"
import { Store, RefreshCw, Gavel, ArrowLeftRight, Plus, Trophy, Medal } from "lucide-react"
import { formatAddress } from "@/lib/sui-utils"
import { parseAuctionObject } from "@/lib/sui-utils"
import { parseTradeObject } from "@/lib/trade-sdk"
import { SUIBID_PACKAGE_ID, AUCTION_MODULE } from "@/lib/constants"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import Link from "next/link"

// Extended listing type with bid count
interface AuctionWithBidCount extends DisplayableListing {
  bidCount: number
}

function useAuctions() {
  const suiClient = useSuiClient()
  const [auctions, setAuctions] = useState<AuctionWithBidCount[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchAuctions = async () => {
    setIsLoading(true)
    setError(null)
    try {
      // 1. Fetch auction IDs from API
      const res = await fetch("/api/auctions")
      const data = await res.json()
      const auctionIds: string[] = data.auctions || []

      if (auctionIds.length === 0) {
        setAuctions([])
        setIsLoading(false)
        return
      }

      // 2. Fetch all BidPlaced events once for bid counting
      let allBidEvents: any[] = []
      if (SUIBID_PACKAGE_ID) {
        try {
          const eventsResponse = await suiClient.queryEvents({
            query: {
              MoveEventType: `${SUIBID_PACKAGE_ID}::${AUCTION_MODULE}::BidPlaced`,
            },
            limit: 500,
          })
          allBidEvents = eventsResponse.data
        } catch (err) {
          console.error("[useAuctions] Error fetching bid events:", err)
        }
      }

      // 3. Fetch all auction objects in parallel
      const auctionPromises = auctionIds.map(async (id) => {
        try {
          const auctionData = await suiClient.getObject({
            id,
            options: { showContent: true },
          })

          if (!auctionData?.data) return null

          const parsedAuction = parseAuctionObject(auctionData.data)
          if (!parsedAuction) return null

          // Parse embedded NFT
          let itemFields = parsedAuction.item?.fields
          if (parsedAuction.item?.fields?.vec) {
            itemFields = parsedAuction.item.fields.vec[0]?.fields
          }

          const nftName = itemFields?.name || `Auction ${parsedAuction.id.slice(0, 8)}...`
          const nftDescription = itemFields?.description || "No description"
          const nftImageUrl = typeof itemFields?.image_url === 'string'
            ? itemFields.image_url
            : itemFields?.image_url?.url || null

          // Count bids for this auction
          const bidCount = allBidEvents.filter(
            (event: any) => event.parsedJson?.auction_id === id
          ).length

          // Show minBid when no one has bid yet, otherwise show highestBid
          const displayBid = parsedAuction.highestBid > 0
            ? parsedAuction.highestBid
            : parsedAuction.minBid

          return {
            id: parsedAuction.id,
            name: nftName,
            description: nftDescription,
            imageUrl: nftImageUrl,
            seller: parsedAuction.seller,
            currentBid: displayBid.toString(),
            bidCount,
            endTime: parsedAuction.endTime,
          } as AuctionWithBidCount
        } catch (err) {
          console.error(`[useAuctions] Error fetching auction ${id}:`, err)
          return null
        }
      })

      const results = await Promise.all(auctionPromises)
      const validAuctions = results.filter((a): a is AuctionWithBidCount => a !== null)

      // 4. Sort alphabetically by name (case-insensitive)
      validAuctions.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()))

      setAuctions(validAuctions)
    } catch (err) {
      setError("Failed to fetch auctions")
      console.error("[Marketplace] Failed to fetch auctions:", err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchAuctions()
  }, [])

  return { auctions, isLoading, error, refetch: fetchAuctions }
}

function useTrades() {
  const suiClient = useSuiClient()
  const [trades, setTrades] = useState<DisplayableTrade[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchTrades = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/trades")
      const data = await res.json()
      const tradeIds: string[] = data.trades || []

      if (tradeIds.length === 0) {
        setTrades([])
        setIsLoading(false)
        return
      }

      // Fetch all trade objects in parallel
      const tradePromises = tradeIds.map(async (id) => {
        try {
          const tradeObject = await suiClient.getObject({
            id,
            options: { showContent: true },
          })

          const parsedTrade = parseTradeObject(tradeObject.data)
          if (!parsedTrade || !parsedTrade.active) return null

          // Try to fetch first item's metadata from dynamic fields
          let itemName = "Trade Offer"
          let itemDescription = "NFT trade offer"
          let itemImageUrl: string | null = null
          let itemCount = 0

          try {
            const dynamicFields = await suiClient.getDynamicFields({
              parentId: id,
            })

            const sellerItemFields = dynamicFields.data.filter(
              (field) => field.name.value && typeof field.name.value === "object" &&
                (field.name.value as any).seller_item_index !== undefined
            )
            itemCount = sellerItemFields.length

            if (sellerItemFields.length > 0) {
              const firstField = sellerItemFields[0]
              const fieldObject = await suiClient.getObject({
                id: firstField.objectId,
                options: { showContent: true },
              })

              if (fieldObject.data?.content && "fields" in fieldObject.data.content) {
                const fieldContent = fieldObject.data.content.fields as any
                if (fieldContent.value) {
                  const nftFields = fieldContent.value.fields || fieldContent.value
                  itemName = nftFields.name || "Trade Item"
                  itemDescription = nftFields.description || "NFT trade offer"
                  itemImageUrl = nftFields.image_url || nftFields.url || null
                }
              }
            }
          } catch (err) {
            console.error("[useTrades] Error fetching trade items:", err)
          }

          return {
            id: parsedTrade.id,
            title: parsedTrade.title,
            seller: parsedTrade.seller,
            endTime: parsedTrade.end_time,
            offerCount: parsedTrade.offer_count,
            active: parsedTrade.active,
            itemName,
            itemDescription,
            itemImageUrl,
            itemCount,
          } as DisplayableTrade
        } catch (err) {
          console.error(`[useTrades] Error fetching trade ${id}:`, err)
          return null
        }
      })

      const results = await Promise.all(tradePromises)
      const validTrades = results.filter((t): t is DisplayableTrade => t !== null)

      // Sort alphabetically by title (case-insensitive)
      validTrades.sort((a, b) => a.title.toLowerCase().localeCompare(b.title.toLowerCase()))

      setTrades(validTrades)
    } catch (err) {
      setError("Failed to fetch trades")
      console.error("[Marketplace] Failed to fetch trades:", err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchTrades()
  }, [])

  return { trades, isLoading, error, refetch: fetchTrades }
}

interface LeaderboardEntry {
  address: string
  points: number
}

function useLeaderboard() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchLeaderboard = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/leaderboard")
      const data = await res.json()
      setLeaderboard(data.leaderboard || [])
    } catch (err) {
      setError("Failed to fetch leaderboard")
      console.error("[Marketplace] Failed to fetch leaderboard:", err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchLeaderboard()
  }, [])

  return { leaderboard, isLoading, error, refetch: fetchLeaderboard }
}

export default function MarketplacePage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { auctions, isLoading: auctionsLoading, refetch: refetchAuctions } = useAuctions()
  const { trades, isLoading: tradesLoading, refetch: refetchTrades } = useTrades()
  const { leaderboard, isLoading: leaderboardLoading, refetch: refetchLeaderboard } = useLeaderboard()

  // Read initial tab from URL or default to "auction"
  const tabFromUrl = searchParams.get("tab")
  const validTabs = ["auction", "trade", "leaderboard"]
  const initialTab = tabFromUrl && validTabs.includes(tabFromUrl) ? tabFromUrl : "auction"
  const [activeTab, setActiveTab] = useState(initialTab)

  // Update tab when URL changes
  useEffect(() => {
    const newTab = searchParams.get("tab")
    if (newTab && validTabs.includes(newTab) && newTab !== activeTab) {
      setActiveTab(newTab)
    }
  }, [searchParams])

  // Update URL when tab changes
  const handleTabChange = (tab: string) => {
    setActiveTab(tab)
    router.push(tab === "auction" ? "/" : `/?tab=${tab}`, { scroll: false })
  }

  const handleRefresh = () => {
    if (activeTab === "auction") {
      refetchAuctions()
    } else if (activeTab === "trade") {
      refetchTrades()
    } else {
      refetchLeaderboard()
    }
  }

  const isLoading = activeTab === "auction" ? auctionsLoading : activeTab === "trade" ? tradesLoading : leaderboardLoading

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Store className="h-6 w-6 text-primary" />
            <h1 className="text-3xl font-bold">Marketplace</h1>
          </div>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
        <p className="text-muted-foreground">Browse live auctions and NFT trades.</p>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <div className="flex items-center justify-between mb-6">
          <TabsList className="grid w-auto grid-cols-3">
            <TabsTrigger value="auction" className="flex items-center gap-2 px-4">
              <Gavel className="h-4 w-4" />
              Auctions
              {auctions.length > 0 && (
                <span className="ml-1 text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded-full">
                  {auctions.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="trade" className="flex items-center gap-2 px-4">
              <ArrowLeftRight className="h-4 w-4" />
              Trades
              {trades.length > 0 && (
                <span className="ml-1 text-xs bg-purple-500/20 text-purple-500 px-1.5 py-0.5 rounded-full">
                  {trades.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="leaderboard" className="flex items-center gap-2 px-4">
              <Trophy className="h-4 w-4" />
              Leaderboard
            </TabsTrigger>
          </TabsList>

          {activeTab === "trade" && (
            <Button asChild size="sm">
              <Link href="/trade/create">
                <Plus className="h-4 w-4 mr-2" />
                Create Trade
              </Link>
            </Button>
          )}
        </div>

        <TabsContent value="auction" className="mt-0">
          {auctionsLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-64 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              ))}
            </div>
          ) : auctions.length > 0 ? (
            <>
              <div className="mb-4 text-sm text-muted-foreground">
                {auctions.length} {auctions.length === 1 ? "auction" : "auctions"} available (sorted A-Z)
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {auctions.map((auction) => (
                  <MarketplaceItemCard key={auction.id} listing={auction} />
                ))}
              </div>
            </>
          ) : (
            <div className="text-center py-16 border-2 border-dashed rounded-lg">
              <Gavel className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h2 className="text-xl font-semibold">No Live Auctions</h2>
              <p className="text-muted-foreground mt-2">Create an auction from the "My Items" page to see it here.</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="trade" className="mt-0">
          {tradesLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-64 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              ))}
            </div>
          ) : trades.length > 0 ? (
            <>
              <div className="mb-4 text-sm text-muted-foreground">
                {trades.length} {trades.length === 1 ? "trade" : "trades"} available (sorted A-Z)
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {trades.map((trade) => (
                  <TradeItemCard key={trade.id} trade={trade} />
                ))}
              </div>
            </>
          ) : (
            <div className="text-center py-16 border-2 border-dashed rounded-lg">
              <ArrowLeftRight className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h2 className="text-xl font-semibold">No Active Trades</h2>
              <p className="text-muted-foreground mt-2 mb-4">Create a trade to swap NFTs with other users.</p>
              <Button asChild>
                <Link href="/trade/create">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Trade
                </Link>
              </Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="leaderboard" className="mt-0">
          {leaderboardLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : leaderboard.length > 0 ? (
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground mb-4">
                Top {leaderboard.length} users ranked by points (Auction win: +10 pts, Trade: +5 pts)
              </div>
              <div className="border rounded-lg overflow-hidden">
                {/* Header */}
                <div className="grid grid-cols-12 gap-4 p-3 bg-secondary/50 text-xs font-medium text-muted-foreground">
                  <div className="col-span-2 text-center">#</div>
                  <div className="col-span-7">Address</div>
                  <div className="col-span-3 text-right">Points</div>
                </div>
                {/* Rows */}
                {leaderboard.map((entry, index) => (
                  <div
                    key={entry.address}
                    className={`grid grid-cols-12 gap-4 p-3 items-center border-t ${
                      index < 3 ? "bg-yellow-500/5" : ""
                    }`}
                  >
                    <div className="col-span-2 text-center">
                      {index === 0 ? (
                        <Medal className="h-5 w-5 text-yellow-500 mx-auto" />
                      ) : index === 1 ? (
                        <Medal className="h-5 w-5 text-gray-400 mx-auto" />
                      ) : index === 2 ? (
                        <Medal className="h-5 w-5 text-amber-600 mx-auto" />
                      ) : (
                        <span className="text-muted-foreground">{index + 1}</span>
                      )}
                    </div>
                    <div className="col-span-7">
                      <a
                        href={`https://suiscan.xyz/testnet/account/${entry.address}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-sm text-primary hover:underline"
                      >
                        {formatAddress(entry.address, 8)}
                      </a>
                    </div>
                    <div className="col-span-3 text-right">
                      <span className={`font-semibold ${index < 3 ? "text-yellow-600" : ""}`}>
                        {entry.points} pts
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-16 border-2 border-dashed rounded-lg">
              <Trophy className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h2 className="text-xl font-semibold">No Rankings Yet</h2>
              <p className="text-muted-foreground mt-2">Win auctions or complete trades to earn points!</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
