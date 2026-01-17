"use client"

import { useState } from "react"
import { useSignAndExecuteTransaction } from "@mysten/dapp-kit"
import { Transaction } from "@mysten/sui/transactions"
import { toast } from "sonner"
import { SUIBID_PACKAGE_ID, AUCTION_ITEM_TYPE, SUI_CLOCK_OBJECT_ID } from "@/lib/constants"
import { suiToMist, type MarketplaceItem } from "@/lib/sui-utils"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { TransactionStatus, type TransactionState } from "./transaction-status"

interface CreateAuctionDialogProps {
  item: MarketplaceItem
  open: boolean
  onOpenChange: (open: boolean) => void
}

const DURATION_OPTIONS = [
  { label: "1 Hour", value: 3600000 },
  { label: "8 Hours", value: 28800000 },
  { label: "1 Day", value: 86400000 },
  { label: "3 Days", value: 259200000 },
]

export function CreateAuctionDialog({ item, open, onOpenChange }: CreateAuctionDialogProps) {
  const { mutate: signAndExecute } = useSignAndExecuteTransaction()
  const [txState, setTxState] = useState<TransactionState>("idle")
  const [txDigest, setTxDigest] = useState<string>()
  const [errorMessage, setErrorMessage] = useState<string>()

  const [minBid, setMinBid] = useState("")
  const [duration, setDuration] = useState(DURATION_OPTIONS[2].value) // Default to 1 day

  const handleCreateAuction = () => {
    const minBidAmount = Number.parseFloat(minBid)
    if (isNaN(minBidAmount) || minBidAmount <= 0) {
      toast.error("Please enter a valid minimum bid.")
      return
    }

    setTxState("pending")
    setErrorMessage(undefined)

    const tx = new Transaction()
    try {
      const minBidInMist = suiToMist(minBidAmount)
      tx.moveCall({
        target: `${SUIBID_PACKAGE_ID}::auction::create_auction`,
        arguments: [
          tx.object(item.objectId),
          tx.pure(minBidInMist.toString()),
          tx.pure(duration.toString()),
          tx.object(SUI_CLOCK_OBJECT_ID),
        ],
        typeArguments: [item.type], // Use the actual type of the item
      })

      signAndExecute(
        { transaction: tx },
        {
          onSuccess: (result) => {
            setTxState("success")
            setTxDigest(result.digest)
            toast.success("Auction created successfully!", {
              action: {
                label: "View on Explorer",
                onClick: () => window.open(`https://suiscan.xyz/testnet/tx/${result.digest}`, "_blank"),
              },
            })
            setTimeout(() => onOpenChange(false), 2000)
          },
          onError: (error) => {
            setTxState("error")
            setErrorMessage(error.message)
            toast.error(`Failed to create auction: ${error.message}`)
          },
        }
      )
    } catch (error: any) {
      setTxState("error")
      setErrorMessage(error.message)
      toast.error(`Failed to build transaction: ${error.message}`)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Auction for "{item.name}"</DialogTitle>
          <DialogDescription>
            Set your terms and list this item on the marketplace. This action will transfer your item into the auction contract.
          </DialogDescription>
        </DialogHeader>

        {txState !== "idle" ? (
            <div className="py-8">
                <TransactionStatus state={txState} txDigest={txDigest} errorMessage={errorMessage} />
            </div>
        ) : (
          <div className="py-4 space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-md bg-secondary flex-shrink-0">
                {item.imageUrl && <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover rounded-md" />}
              </div>
              <div>
                <h3 className="font-semibold">{item.name}</h3>
                <p className="text-xs text-muted-foreground line-clamp-2">{item.description}</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="min-bid">Minimum Bid (SUI)</Label>
              <Input
                id="min-bid"
                type="number"
                placeholder="e.g., 10"
                value={minBid}
                onChange={(e) => setMinBid(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Auction Duration</Label>
              <div className="grid grid-cols-2 gap-2">
                {DURATION_OPTIONS.map((opt) => (
                  <Button
                    key={opt.value}
                    variant={duration === opt.value ? "secondary" : "outline"}
                    onClick={() => setDuration(opt.value)}
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          {txState === "idle" && (
            <>
              <DialogClose asChild>
                <Button variant="outline">Cancel</Button>
              </DialogClose>
              <Button onClick={handleCreateAuction} disabled={!minBid}>
                Start Auction
              </Button>
            </>
          )}
           {txState === "success" && (
            <DialogClose asChild>
                <Button>Done</Button>
            </DialogClose>
           )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
