import { NextResponse } from "next/server"
import { getTopLeaderboard, awardPoints, incrementUserItems } from "@/lib/redis"

// GET - Fetch top 20 leaderboard entries
export async function GET() {
  try {
    const leaderboard = await getTopLeaderboard(20)
    return NextResponse.json({ leaderboard })
  } catch (error) {
    console.error("Failed to fetch leaderboard:", error)
    return NextResponse.json({ leaderboard: [] }, { status: 500 })
  }
}

// POST - Award points to a user (called when auction is won)
export async function POST(request: Request) {
  try {
    const { address, points, itemValue } = await request.json()

    if (!address || typeof address !== "string") {
      return NextResponse.json({ error: "Invalid address" }, { status: 400 })
    }

    // Award points (default 10 points per successful auction win)
    const pointsToAward = points || 10
    const newScore = await awardPoints(address, pointsToAward)

    // Update user's item count and total value
    if (itemValue && typeof itemValue === "number") {
      await incrementUserItems(address, itemValue)
    }

    return NextResponse.json({
      success: true,
      address,
      newScore: Math.floor(newScore),
      pointsAwarded: pointsToAward
    })
  } catch (error) {
    console.error("Failed to award points:", error)
    return NextResponse.json({ error: "Failed to award points" }, { status: 500 })
  }
}
