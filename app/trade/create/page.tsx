"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useCurrentAccount, useSuiClient, useSignAndExecuteTransaction } from "@mysten/dapp-kit"
import { useQueryClient } from "@tanstack/react-query"
import { Transaction } from "@mysten/sui/transactions"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ArrowLeftRight, ArrowLeft, Package, Clock, AlertCircle } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { SUIBID_PACKAGE_ID, NFT_MODULE, SUI_CLOCK_OBJECT_ID } from "@/lib/constants"
import { TRADE_MODULE } from "@/lib/trade-sdk"
import { ConnectWallet } from "@/components/connect-wallet"

interface NFTItem {
  id: string
  name: string
  description: string
  image_url: string | null
  type: string
}

export default function CreateTradePage() {
  const router = useRouter()
  const account = useCurrentAccount()
  const suiClient = useSuiClient()
  const queryClient = useQueryClient()
  const { mutateAsync: signAndExecuteAsync } = useSignAndExecuteTransaction()

  const [userNFTs, setUserNFTs] = useState<NFTItem[]>([])
  const [selectedNFTs, setSelectedNFTs] = useState<string[]>([])
  const [duration, setDuration] = useState("24") // hours
  const [customDuration, setCustomDuration] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Fetch user's NFTs
  useEffect(() => {
    const fetchUserNFTs = async () => {
      if (!account?.address || !SUIBID_PACKAGE_ID) {
        setIsLoading(false)
        return
      }

      try {
        const objects = await suiClient.getOwnedObjects({
          owner: account.address,
          filter: {
            StructType: `${SUIBID_PACKAGE_ID}::${NFT_MODULE}::BidNFT`,
          },
          options: { showContent: true, showType: true },
        })

        const nfts: NFTItem[] = []
        for (const obj of objects.data) {
          if (obj.data?.content && "fields" in obj.data.content) {
            const fields = obj.data.content.fields as any
            nfts.push({
              id: obj.data.objectId,
              name: fields.name || "Unknown NFT",
              description: fields.description || "",
              image_url: fields.image_url || fields.url || null,
              type: obj.data.content.type,
            })
          }
        }
        setUserNFTs(nfts)
      } catch (error) {
        console.error("[CreateTrade] Error fetching user NFTs:", error)
        toast.error("Failed to fetch your NFTs")
      } finally {
        setIsLoading(false)
      }
    }

    fetchUserNFTs()
  }, [account?.address, suiClient])

  const toggleNFTSelection = (nftId: string) => {
    setSelectedNFTs((prev) =>
      prev.includes(nftId) ? prev.filter((id) => id !== nftId) : [...prev, nftId]
    )
  }

  const getDurationMs = (): number => {
    if (duration === "5min") return 5 * 60 * 1000 // 5 minutes for demo
    const hours = duration === "custom" ? parseInt(customDuration) || 24 : parseInt(duration)
    return hours * 60 * 60 * 1000
  }

  const handleCreateTrade = async () => {
    if (!account || selectedNFTs.length === 0) return

    setIsSubmitting(true)
    try {
      const endTimeMs = Date.now() + getDurationMs()

      // Build transaction: create_trade + add_seller_item for each NFT + share_object
      const tx = new Transaction()

      // Create trade (deployed contract doesn't have title parameter)
      const [trade] = tx.moveCall({
        target: `${SUIBID_PACKAGE_ID}::${TRADE_MODULE}::create_trade`,
        arguments: [
          tx.pure.u64(endTimeMs),
          tx.object(SUI_CLOCK_OBJECT_ID),
        ],
      })

      // Add each selected NFT to the trade
      for (const nftId of selectedNFTs) {
        const nft = userNFTs.find((n) => n.id === nftId)
        if (nft) {
          tx.moveCall({
            target: `${SUIBID_PACKAGE_ID}::${TRADE_MODULE}::add_seller_item`,
            arguments: [trade, tx.object(nftId)],
            typeArguments: [nft.type],
          })
        }
      }

      // Share the trade object so others can interact with it
      tx.moveCall({
        target: "0x2::transfer::public_share_object",
        arguments: [trade],
        typeArguments: [`${SUIBID_PACKAGE_ID}::${TRADE_MODULE}::Trade`],
      })

      const result = await signAndExecuteAsync({ transaction: tx })

      if (result?.digest) {
        await suiClient.waitForTransaction({ digest: result.digest })

        // Get the created trade ID from transaction effects
        const txDetails = await suiClient.getTransactionBlock({
          digest: result.digest,
          options: { showEffects: true, showObjectChanges: true },
        })

        // Find the created Trade object
        const createdTrade = txDetails.objectChanges?.find(
          (change) =>
            change.type === "created" &&
            change.objectType?.includes(`${TRADE_MODULE}::Trade`)
        )

        queryClient.invalidateQueries({ queryKey: ["getBalance"] })

        // Register trade in Redis for marketplace listing
        if (createdTrade && "objectId" in createdTrade) {
          try {
            await fetch("/api/trades", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ tradeId: createdTrade.objectId }),
            })
          } catch (err) {
            console.error("[CreateTrade] Failed to register trade:", err)
          }
        }

        toast.success("Trade created successfully!", {
          action: {
            label: "View Trade",
            onClick: () => {
              if (createdTrade && "objectId" in createdTrade) {
                router.push(`/trade/${createdTrade.objectId}`)
              }
            },
          },
        })

        // Redirect to the trade page
        if (createdTrade && "objectId" in createdTrade) {
          router.push(`/trade/${createdTrade.objectId}`)
        } else {
          router.push("/?tab=trade")
        }
      }
    } catch (error: any) {
      console.error("[CreateTrade] Error:", error)
      toast.error(`Failed to create trade: ${error.message}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!account) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Link href="/?tab=trade" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="h-4 w-4" />
          Back to Trades
        </Link>

        <Card className="max-w-lg mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowLeftRight className="h-5 w-5 text-primary" />
              Create Trade
            </CardTitle>
            <CardDescription>Connect your wallet to create a trade</CardDescription>
          </CardHeader>
          <CardContent className="text-center py-8">
            <ConnectWallet />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Link href="/?tab=trade" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft className="h-4 w-4" />
        Back to Trades
      </Link>

      <div className="max-w-3xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowLeftRight className="h-5 w-5 text-primary" />
              Create Trade
            </CardTitle>
            <CardDescription>
              Select the NFTs you want to trade and set a duration for collecting offers.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Duration Selection */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Trade Duration
              </Label>
              <div className="flex gap-2">
                <Select value={duration} onValueChange={setDuration}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Select duration" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5min">5 min (Demo)</SelectItem>
                    <SelectItem value="1">1 hour</SelectItem>
                    <SelectItem value="6">6 hours</SelectItem>
                    <SelectItem value="12">12 hours</SelectItem>
                    <SelectItem value="24">24 hours</SelectItem>
                    <SelectItem value="48">2 days</SelectItem>
                    <SelectItem value="72">3 days</SelectItem>
                    <SelectItem value="168">1 week</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
                {duration === "custom" && (
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min="1"
                      placeholder="Hours"
                      value={customDuration}
                      onChange={(e) => setCustomDuration(e.target.value)}
                      className="w-24"
                    />
                    <span className="text-sm text-muted-foreground">hours</span>
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                After this duration, you can accept one of the offers received.
              </p>
            </div>

            {/* NFT Selection */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Package className="h-4 w-4" />
                Select NFTs to Trade ({selectedNFTs.length} selected)
              </Label>

              {isLoading ? (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  {[1, 2, 3, 4].map((i) => (
                    <Skeleton key={i} className="aspect-square" />
                  ))}
                </div>
              ) : userNFTs.length === 0 ? (
                <div className="border-2 border-dashed rounded-lg p-8 text-center">
                  <Package className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                  <p className="font-medium">No NFTs Found</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    You don't have any NFTs to trade. Mint some NFTs first!
                  </p>
                  <Button asChild className="mt-4">
                    <Link href="/my-items">Go to My Items</Link>
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  {userNFTs.map((nft) => (
                    <div
                      key={nft.id}
                      className={`border rounded-lg p-2 cursor-pointer transition-all ${
                        selectedNFTs.includes(nft.id)
                          ? "border-primary ring-2 ring-primary/20 bg-primary/5"
                          : "hover:border-muted-foreground"
                      }`}
                      onClick={() => toggleNFTSelection(nft.id)}
                    >
                      <div className="flex items-start gap-1 mb-2">
                        <Checkbox
                          checked={selectedNFTs.includes(nft.id)}
                          onCheckedChange={() => toggleNFTSelection(nft.id)}
                          className="mt-0.5"
                        />
                      </div>
                      {nft.image_url ? (
                        <img
                          src={nft.image_url}
                          alt={nft.name}
                          className="w-full aspect-square object-cover rounded mb-2"
                        />
                      ) : (
                        <div className="w-full aspect-square bg-secondary rounded flex items-center justify-center mb-2">
                          <Package className="h-8 w-8 text-muted-foreground" />
                        </div>
                      )}
                      <p className="font-medium text-sm truncate">{nft.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{nft.description}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Info Box */}
            <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
              <AlertCircle className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-blue-700 dark:text-blue-300">How Trading Works</p>
                <ul className="mt-1 space-y-1 text-blue-600 dark:text-blue-400">
                  <li>1. Select the NFTs you want to trade</li>
                  <li>2. Other users can place offers with their NFTs</li>
                  <li>3. After the duration ends, you can accept one offer</li>
                  <li>4. NFTs are exchanged automatically on-chain</li>
                </ul>
              </div>
            </div>

            {/* Submit Button */}
            <Button
              className="w-full"
              size="lg"
              onClick={handleCreateTrade}
              disabled={selectedNFTs.length === 0 || isSubmitting}
            >
              {isSubmitting ? (
                "Creating Trade..."
              ) : (
                <>
                  <ArrowLeftRight className="h-4 w-4 mr-2" />
                  Create Trade with {selectedNFTs.length} NFT{selectedNFTs.length !== 1 ? "s" : ""}
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
