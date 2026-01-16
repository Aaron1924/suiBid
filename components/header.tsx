"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { ConnectWallet } from "./connect-wallet"
import { Hexagon } from "lucide-react"

const navigation = [
  { name: "Marketplace", href: "/" },
  { name: "My Items", href: "/my-items" },
]

export function Header() {
  const pathname = usePathname()

  return (
    <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2">
              <Hexagon className="h-8 w-8 text-primary" />
              <span className="font-semibold text-lg">SuiMarket</span>
            </Link>
            <nav className="hidden md:flex items-center gap-6">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "text-sm font-medium transition-colors hover:text-foreground",
                    pathname === item.href ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {item.name}
                </Link>
              ))}
            </nav>
          </div>
          <ConnectWallet />
        </div>
      </div>
    </header>
  )
}
