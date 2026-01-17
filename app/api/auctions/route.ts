import { NextResponse } from "next/server"
import { redis, AUCTIONS_KEY } from "@/lib/redis"

// GET - Fetch all auction IDs
export async function GET() {
  try {
    const auctionIds = await redis.smembers(AUCTIONS_KEY)
    return NextResponse.json({ auctions: auctionIds || [] })
  } catch (error) {
    console.error("Failed to fetch auctions:", error)
    return NextResponse.json({ auctions: [] }, { status: 500 })
  }
}

// POST - Add a new auction ID
export async function POST(request: Request) {
  try {
    const { auctionId } = await request.json()

    if (!auctionId || typeof auctionId !== "string") {
      return NextResponse.json({ error: "Invalid auction ID" }, { status: 400 })
    }

    await redis.sadd(AUCTIONS_KEY, auctionId)
    return NextResponse.json({ success: true, auctionId })
  } catch (error) {
    console.error("Failed to add auction:", error)
    return NextResponse.json({ error: "Failed to add auction" }, { status: 500 })
  }
}

// DELETE - Remove an auction ID (when auction ends)
export async function DELETE(request: Request) {
  try {
    const { auctionId } = await request.json()

    if (!auctionId || typeof auctionId !== "string") {
      return NextResponse.json({ error: "Invalid auction ID" }, { status: 400 })
    }

    await redis.srem(AUCTIONS_KEY, auctionId)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Failed to remove auction:", error)
    return NextResponse.json({ error: "Failed to remove auction" }, { status: 500 })
  }
}
