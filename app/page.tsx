"use client"

import { useCurrentAccount, useSuiClientQuery } from "@mysten/dapp-kit"
import { ItemCard } from "@/components/item-card"
import { ItemGridSkeleton } from "@/components/loading-skeleton"
import { EmptyState } from "@/components/empty-state"
import { parseObjectToItem, type MarketplaceItem } from "@/lib/sui-utils"
import { Store, Wallet } from "lucide-react"
import { ConnectButton } from "@mysten/dapp-kit"

export default function MarketplacePage() {
  const account = useCurrentAccount()

  // In a real implementation, this would query a marketplace contract
  // For now, we'll fetch recent objects on the network as a demo
  const { data, isLoading, error } = useSuiClientQuery(
    "queryTransactionBlocks",
    {
      filter: { FromAddress: account?.address ?? "" },
      options: { showEffects: true, showInput: true },
      limit: 20,
    },
    { enabled: !!account },
  )

  // Demo: Get owned objects to show in marketplace
  const { data: ownedObjects, isLoading: loadingObjects } = useSuiClientQuery(
    "getOwnedObjects",
    {
      owner: account?.address ?? "",
      options: { showContent: true, showDisplay: true, showType: true },
      limit: 20,
    },
    { enabled: !!account },
  )

  const items: MarketplaceItem[] =
    ownedObjects?.data?.map((obj) => parseObjectToItem(obj)).filter((item): item is MarketplaceItem => item !== null) ??
    []

  if (!account) {
    return (
      <div className="container mx-auto px-4 py-16">
        <div className="flex flex-col items-center justify-center text-center">
          <div className="rounded-full bg-secondary p-4 mb-4">
            <Wallet className="h-8 w-8 text-muted-foreground" />
          </div>
          <h1 className="text-2xl font-semibold mb-2">Connect Your Wallet</h1>
          <p className="text-muted-foreground mb-6 max-w-md">
            Connect your Sui wallet to browse the marketplace and start trading on-chain items.
          </p>
          <ConnectButton className="!bg-primary !text-primary-foreground !rounded-md !px-6 !py-3 !text-sm !font-medium hover:!bg-primary/90" />
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Marketplace</h1>
        <p className="text-muted-foreground">Browse and bid on on-chain items from the Sui network</p>
      </div>

      {loadingObjects ? (
        <ItemGridSkeleton count={8} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={Store}
          title="No items available"
          description="There are currently no items listed on the marketplace. Check back later or list your own items."
          actionLabel="View My Items"
          actionHref="/my-items"
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {items.map((item) => (
            <ItemCard key={item.objectId} item={item} showOwner bidCount={Math.floor(Math.random() * 5)} />
          ))}
        </div>
      )}
    </div>
  )
}
