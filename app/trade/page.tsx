"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

// Redirect /trade to marketplace with trade tab for consistent UI
export default function TradePage() {
  const router = useRouter()

  useEffect(() => {
    router.replace("/?tab=trade")
  }, [router])

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="text-center text-muted-foreground">
        Redirecting to Marketplace...
      </div>
    </div>
  )
}
