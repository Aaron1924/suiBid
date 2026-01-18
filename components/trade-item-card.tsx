"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatAddress } from "@/lib/sui-utils"
import { ArrowLeftRight, Clock, Package, Users } from "lucide-react"

export interface DisplayableTrade {
  id: string
  seller: string
  endTime: number
  offerCount: number
  active: boolean
  // Item info for display
  itemName: string
  itemDescription?: string
  itemImageUrl?: string | null
  itemCount?: number
}

interface TradeItemCardProps {
  trade: DisplayableTrade
}

function formatTimeRemaining(endTime: number): string {
  const now = Date.now()
  const diff = endTime - now

  if (diff <= 0) return "Ended"

  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((diff % (1000 * 60)) / 1000)

  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${minutes}m`
  if (minutes > 0) return `${minutes}m ${seconds}s`
  return `${seconds}s`
}

export function TradeItemCard({ trade }: TradeItemCardProps) {
  const [timeRemaining, setTimeRemaining] = useState<string>("")
  const isEnded = Date.now() >= trade.endTime

  useEffect(() => {
    const updateTime = () => {
      setTimeRemaining(formatTimeRemaining(trade.endTime))
    }
    updateTime()

    const interval = setInterval(updateTime, 1000)
    return () => clearInterval(interval)
  }, [trade.endTime])

  return (
    <Link href={`/trade/${trade.id}`}>
      <Card className="group overflow-hidden bg-card border-border hover:border-primary/50 transition-all duration-200 cursor-pointer relative">
        {/* Trade Status Badge */}
        <div className={`absolute top-2 right-2 z-10 flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
          isEnded
            ? "bg-orange-500/90 text-white"
            : "bg-blue-500/90 text-white"
        }`}>
          <Clock className="h-3 w-3" />
          {isEnded ? "Accepting" : timeRemaining}
        </div>

        {/* Trade Type Badge */}
        <div className="absolute top-2 left-2 z-10 flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-purple-500/90 text-white">
          <ArrowLeftRight className="h-3 w-3" />
          Trade
        </div>

        <CardContent className="p-0">
          <div className="aspect-square bg-secondary flex items-center justify-center overflow-hidden">
            {trade.itemImageUrl ? (
              <img
                src={trade.itemImageUrl}
                alt={trade.itemName || "Trade Item"}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
              />
            ) : (
              <div className="flex flex-col items-center gap-2">
                <ArrowLeftRight className="h-12 w-12 text-muted-foreground" />
                {trade.itemCount && trade.itemCount > 1 && (
                  <span className="text-sm text-muted-foreground">{trade.itemCount} items</span>
                )}
              </div>
            )}
          </div>
          <div className="p-4 space-y-2">
            <h3 className="font-medium text-foreground truncate group-hover:text-primary transition-colors">
              {trade.itemName}
            </h3>
            <p className="text-xs text-muted-foreground line-clamp-2">
              {trade.itemCount && trade.itemCount > 1 ? `+${trade.itemCount - 1} more items` : "NFT trade offer"}
            </p>
          </div>
        </CardContent>
        <CardFooter className="p-4 pt-0 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <span>TradeMaster:</span>
            <span className="font-mono">{formatAddress(trade.seller)}</span>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <div className="flex items-center gap-1 text-purple-500 font-medium text-sm">
              <Users className="h-3 w-3" />
              {trade.offerCount} {trade.offerCount === 1 ? "offer" : "offers"}
            </div>
            <Badge variant={isEnded ? "default" : "secondary"} className="text-xs">
              {isEnded ? "Review" : "Open"}
            </Badge>
          </div>
        </CardFooter>
      </Card>
    </Link>
  )
}
