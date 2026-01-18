import { Redis } from "@upstash/redis"

export const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
})

// Key for storing auction IDs
export const AUCTIONS_KEY = "suibid:auctions"

// Key for storing trade IDs
export const TRADES_KEY = "suibid:trades"

// Key for leaderboard (sorted set: address -> points)
export const LEADERBOARD_KEY = "suibid:leaderboard"

// Key prefix for user stats (hash: items_count, total_value)
export const USER_STATS_PREFIX = "suibid:user:"

// Leaderboard helper functions
export interface LeaderboardEntry {
  address: string
  points: number
  itemsCount: number
  totalValue: number
}

export async function awardPoints(address: string, points: number): Promise<number> {
  const newScore = await redis.zincrby(LEADERBOARD_KEY, points, address)
  return newScore
}

export async function updateUserStats(
  address: string,
  itemsCount: number,
  totalValue: number
): Promise<void> {
  await redis.hset(`${USER_STATS_PREFIX}${address}`, {
    items_count: itemsCount,
    total_value: totalValue,
  })
}

export async function incrementUserItems(
  address: string,
  valueToAdd: number
): Promise<void> {
  await redis.hincrby(`${USER_STATS_PREFIX}${address}`, "items_count", 1)
  await redis.hincrby(`${USER_STATS_PREFIX}${address}`, "total_value", valueToAdd)
}

export async function getTopLeaderboard(limit: number = 20): Promise<LeaderboardEntry[]> {
  // Get top users with scores from sorted set (descending order)
  const topUsers = await redis.zrange(LEADERBOARD_KEY, 0, limit - 1, {
    rev: true,
    withScores: true,
  })

  const entries: LeaderboardEntry[] = []

  // topUsers is an array like [address1, score1, address2, score2, ...]
  for (let i = 0; i < topUsers.length; i += 2) {
    const address = topUsers[i] as string
    const points = topUsers[i + 1] as number

    // Get user stats
    const stats = await redis.hgetall(`${USER_STATS_PREFIX}${address}`)

    entries.push({
      address,
      points: Math.floor(points),
      itemsCount: Number(stats?.items_count || 0),
      totalValue: Number(stats?.total_value || 0),
    })
  }

  return entries
}

export async function getUserStats(address: string): Promise<LeaderboardEntry | null> {
  const score = await redis.zscore(LEADERBOARD_KEY, address)
  if (score === null) return null

  const stats = await redis.hgetall(`${USER_STATS_PREFIX}${address}`)

  return {
    address,
    points: Math.floor(score),
    itemsCount: Number(stats?.items_count || 0),
    totalValue: Number(stats?.total_value || 0),
  }
}
