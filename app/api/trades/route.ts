import { NextResponse } from "next/server"
import { redis, TRADES_KEY } from "@/lib/redis"

// GET - Fetch all trade IDs
export async function GET() {
  try {
    const tradeIds = await redis.smembers(TRADES_KEY)
    return NextResponse.json({ trades: tradeIds || [] })
  } catch (error) {
    console.error("Failed to fetch trades:", error)
    return NextResponse.json({ trades: [] }, { status: 500 })
  }
}

// POST - Add a new trade ID
export async function POST(request: Request) {
  try {
    const { tradeId } = await request.json()

    if (!tradeId || typeof tradeId !== "string") {
      return NextResponse.json({ error: "Invalid trade ID" }, { status: 400 })
    }

    await redis.sadd(TRADES_KEY, tradeId)
    return NextResponse.json({ success: true, tradeId })
  } catch (error) {
    console.error("Failed to add trade:", error)
    return NextResponse.json({ error: "Failed to add trade" }, { status: 500 })
  }
}

// DELETE - Remove a trade ID (when trade is completed/cancelled)
export async function DELETE(request: Request) {
  try {
    const { tradeId } = await request.json()

    if (!tradeId || typeof tradeId !== "string") {
      return NextResponse.json({ error: "Invalid trade ID" }, { status: 400 })
    }

    await redis.srem(TRADES_KEY, tradeId)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Failed to remove trade:", error)
    return NextResponse.json({ error: "Failed to remove trade" }, { status: 500 })
  }
}
