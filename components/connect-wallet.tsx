"use client"

import {
  useCurrentAccount,
  useDisconnectWallet,
  useSuiClientQuery,
  useConnectWallet,
  useWallets,
} from "@mysten/dapp-kit"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { formatAddress, formatSui } from "@/lib/sui-utils"
import { Wallet, LogOut, Copy, ExternalLink, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { useState } from "react"

export function ConnectWallet() {
  const account = useCurrentAccount()
  const { mutate: disconnect } = useDisconnectWallet()
  const { mutate: connect, isPending } = useConnectWallet()
  const wallets = useWallets()
  const [open, setOpen] = useState(false)

  const { data: balance } = useSuiClientQuery("getBalance", { owner: account?.address ?? "" }, { enabled: !!account })

  if (!account) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button className="gap-2">
            <Wallet className="h-4 w-4" />
            Connect Wallet
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Connect a Wallet</DialogTitle>
            <DialogDescription>Select a wallet to connect to this dApp</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 py-4">
            {wallets.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">No wallets detected</p>
                <p className="text-sm text-muted-foreground mb-4">Install a Sui wallet extension to continue</p>
                <div className="flex flex-col gap-2">
                  <Button variant="outline" asChild>
                    <a href="https://suiwallet.com/" target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Get Sui Wallet
                    </a>
                  </Button>
                  <Button variant="outline" asChild>
                    <a href="https://www.slush.app/" target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Get Slush Wallet
                    </a>
                  </Button>
                </div>
              </div>
            ) : (
              wallets.map((wallet) => (
                <Button
                  key={wallet.name}
                  variant="outline"
                  className="justify-start gap-3 h-14 bg-transparent"
                  disabled={isPending}
                  onClick={() => {
                    connect(
                      { wallet },
                      {
                        onSuccess: () => {
                          toast.success(`Connected to ${wallet.name}`)
                          setOpen(false)
                        },
                        onError: (error) => {
                          toast.error(`Failed to connect: ${error.message}`)
                        },
                      },
                    )
                  }}
                >
                  {wallet.icon && (
                    <img src={wallet.icon || "/placeholder.svg"} alt={wallet.name} className="h-6 w-6 rounded" />
                  )}
                  <span className="flex-1 text-left">{wallet.name}</span>
                  {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                </Button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  const copyAddress = () => {
    navigator.clipboard.writeText(account.address)
    toast.success("Address copied to clipboard")
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2 bg-transparent">
          <Wallet className="h-4 w-4" />
          <span className="hidden sm:inline">{formatSui(balance?.totalBalance ?? "0")} SUI</span>
          <span className="font-mono text-xs">{formatAddress(account.address)}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <div className="px-2 py-1.5">
          <p className="text-xs text-muted-foreground">Connected Wallet</p>
          <p className="font-mono text-sm truncate">{account.address}</p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={copyAddress}>
          <Copy className="mr-2 h-4 w-4" />
          Copy Address
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href={`https://suiscan.xyz/testnet/account/${account.address}`} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="mr-2 h-4 w-4" />
            View on Explorer
          </a>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => disconnect()} className="text-destructive">
          <LogOut className="mr-2 h-4 w-4" />
          Disconnect
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
