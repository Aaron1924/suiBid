"use client"

import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatSui, mistToSui } from "@/lib/sui-utils"
import { AlertCircle, ArrowDown, HelpCircle, Trophy, TrendingUp } from "lucide-react"

// Re-defining Bid interface for clarity within the component
export interface Bid {
  id: string
  bidder: string
  amount: string // MIST
  timestamp: number
}

interface BidPositionIndicatorProps {
  userAddress?: string
  bids: Bid[]
}

/**
 * A component that analyzes a list of bids to show the connected user's
 * position relative to the highest bid.
 */
export function BidPositionIndicator({ userAddress, bids }: BidPositionIndicatorProps) {
  const status = useMemo(() => {
    if (bids.length === 0) {
      return {
        state: "NO_BIDS" as const,
        message: "Place a bid to enter the auction.",
        highestBidAmount: "0",
      }
    }

    // 1. Identify the highest bid
    const sortedBids = [...bids].sort((a, b) => {
      const amountDiff = BigInt(b.amount) - BigInt(a.amount)
      if (amountDiff !== 0n) {
        return Number(amountDiff) // Highest amount first
      }
      return a.timestamp - b.timestamp // Earliest timestamp first
    })
    const highestBid = sortedBids[0]

    // 2. Handle unconnected user
    if (!userAddress) {
      return {
        state: "NOT_CONNECTED" as const,
        message: "Connect your wallet to see your bid status.",
        highestBidAmount: highestBid.amount,
      }
    }

    // 3. Identify the user's highest bid
    const userBids = sortedBids.filter((bid) => bid.bidder === userAddress)

    if (userBids.length === 0) {
      return {
        state: "NO_BID" as const,
        message: "You have not placed a bid yet.",
        highestBidAmount: highestBid.amount,
      }
    }

    const userHighestBid = userBids[0]
    const isLeading = userHighestBid.id === highestBid.id

    // 4. Derive position state
    if (isLeading) {
      return {
        state: "LEADING" as const,
        message: "You are currently the highest bidder!",
        highestBidAmount: highestBid.amount,
        userBidAmount: userHighestBid.amount,
      }
    } else {
      const delta = BigInt(highestBid.amount) - BigInt(userHighestBid.amount)
      const deltaInSui = mistToSui(delta)
      return {
        state: "BEHIND" as const,
        message: `Your bid is ${deltaInSui.toLocaleString()} SUI below the highest bid.`,
        highestBidAmount: highestBid.amount,
        userBidAmount: userHighestBid.amount,
      }
    }
  }, [bids, userAddress])

  const StatusIcon = () => {
    switch (status.state) {
      case "LEADING":
        return <Trophy className="h-5 w-5 text-yellow-500" />
      case "BEHIND":
        return <TrendingUp className="h-5 w-5 text-orange-500" />
      case "NO_BID":
      case "NOT_CONNECTED":
        return <HelpCircle className="h-5 w-5 text-muted-foreground" />
      default:
        return <AlertCircle className="h-5 w-5 text-muted-foreground" />
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <StatusIcon />
          <span>Bid Position</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{status.message}</p>
        
        <div className="space-y-2 text-sm">
          <div className="flex justify-between items-center bg-secondary/50 p-3 rounded-md">
            <span className="font-medium">Highest Bid</span>
            <span className="font-semibold text-primary">{formatSui(status.highestBidAmount)} SUI</span>
          </div>

          {("userBidAmount" in status) && status.userBidAmount && (
            <div className={`flex justify-between items-center p-3 rounded-md
              ${status.state === 'LEADING' ? 'bg-green-500/10 border border-green-500/50' : ''}
              ${status.state === 'BEHIND' ? 'bg-orange-500/10 border border-orange-500/50' : ''}
            `}>
              <span className="font-medium">Your Bid</span>
              <span className={`font-semibold ${status.state === 'LEADING' ? 'text-green-500' : 'text-orange-500'}`}>
                {formatSui(status.userBidAmount)} SUI
              </span>
            </div>
          )}
        </div>
        
        <div className="flex items-start gap-2 text-xs text-muted-foreground pt-2">
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <span>
            Position is derived from currently loaded on-chain data and may change.
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
