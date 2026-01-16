"use client"

import { ConnectButton, useCurrentAccount, useDisconnectWallet, useSuiClientQuery } from "@mysten/dapp-kit"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { formatAddress, formatSui } from "@/lib/sui-utils"
import { Wallet, LogOut, Copy, ExternalLink } from "lucide-react"
import { toast } from "sonner"

export function ConnectWallet() {
  const account = useCurrentAccount()
  const { mutate: disconnect } = useDisconnectWallet()

  const { data: balance } = useSuiClientQuery("getBalance", { owner: account?.address ?? "" }, { enabled: !!account })

  if (!account) {
    return (
      <ConnectButton
        connectText="Connect Wallet"
        className="!bg-primary !text-primary-foreground !rounded-md !px-4 !py-2 !text-sm !font-medium hover:!bg-primary/90 !transition-colors"
      />
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
