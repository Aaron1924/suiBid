"use client"

import { Loader2, CheckCircle2, XCircle, ExternalLink } from "lucide-react"
import { cn } from "@/lib/utils"

export type TransactionState = "idle" | "pending" | "success" | "error"

interface TransactionStatusProps {
  state: TransactionState
  txDigest?: string
  errorMessage?: string
  className?: string
}

export function TransactionStatus({ state, txDigest, errorMessage, className }: TransactionStatusProps) {
  if (state === "idle") return null

  return (
    <div
      className={cn(
        "flex items-center gap-2 p-3 rounded-lg text-sm",
        state === "pending" && "bg-primary/10 text-primary",
        state === "success" && "bg-success/10 text-success",
        state === "error" && "bg-destructive/10 text-destructive",
        className,
      )}
    >
      {state === "pending" && (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Transaction pending...</span>
        </>
      )}
      {state === "success" && (
        <>
          <CheckCircle2 className="h-4 w-4" />
          <span>Transaction successful!</span>
          {txDigest && (
            <a
              href={`https://suiscan.xyz/testnet/tx/${txDigest}`}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto flex items-center gap-1 hover:underline"
            >
              View <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </>
      )}
      {state === "error" && (
        <>
          <XCircle className="h-4 w-4" />
          <span>{errorMessage || "Transaction failed"}</span>
        </>
      )}
    </div>
  )
}
