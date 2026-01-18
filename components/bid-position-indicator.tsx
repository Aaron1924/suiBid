"use client"

import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatSui, mistToSui } from "@/lib/sui-utils"
import { AlertCircle, HelpCircle, Trophy, TrendingUp } from "lucide-react"

interface BidPositionIndicatorProps {
  userAddress?: string
  userPosition: number // User's total position in MIST
  highestBid?: number // Current highest bid in MIST
  highestBidder?: string | null // Address of highest bidder
}

/**
 * A component that shows the connected user's bid position relative to the highest bid.
 */
export function BidPositionIndicator({
  userAddress,
  userPosition,
  highestBid = 0,
  highestBidder
}: BidPositionIndicatorProps) {
  const status = useMemo(() => {
    // Handle unconnected user
    if (!userAddress) {
      return {
        state: "NOT_CONNECTED" as const,
        message: "Connect your wallet to see your bid status.",
        highestBidAmount: highestBid,
      }
    }

    // User has no position
    if (userPosition === 0) {
      return {
        state: "NO_BID" as const,
        message: "You have not placed a bid yet.",
        highestBidAmount: highestBid,
      }
    }

    // Check if user is leading
    const isLeading = userAddress === highestBidder

    if (isLeading) {
      return {
        state: "LEADING" as const,
        message: "You are currently the highest bidder!",
        highestBidAmount: highestBid,
        userBidAmount: userPosition,
      }
    } else {
      const delta = highestBid - userPosition
      const deltaInSui = mistToSui(delta.toString())
      return {
        state: "BEHIND" as const,
        message: `Your position is ${deltaInSui.toLocaleString()} SUI below the highest bid.`,
        highestBidAmount: highestBid,
        userBidAmount: userPosition,
      }
    }
  }, [userAddress, userPosition, highestBid, highestBidder])

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
          <span>Your Bid Position</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{status.message}</p>

        <div className="space-y-2 text-sm">
          <div className="flex justify-between items-center bg-secondary/50 p-3 rounded-md">
            <span className="font-medium">Highest Bid</span>
            <span className="font-semibold text-primary">{formatSui(status.highestBidAmount.toString())} SUI</span>
          </div>

          {("userBidAmount" in status) && status.userBidAmount > 0 && (
            <div className={`flex justify-between items-center p-3 rounded-md
              ${status.state === 'LEADING' ? 'bg-green-500/10 border border-green-500/50' : ''}
              ${status.state === 'BEHIND' ? 'bg-orange-500/10 border border-orange-500/50' : ''}
            `}>
              <span className="font-medium">Your Position</span>
              <span className={`font-semibold ${status.state === 'LEADING' ? 'text-green-500' : 'text-orange-500'}`}>
                {formatSui(status.userBidAmount.toString())} SUI
              </span>
            </div>
          )}
        </div>

        <div className="flex items-start gap-2 text-xs text-muted-foreground pt-2">
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <span>
            Your position accumulates with each bid you place.
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
