// components/mint-nft-dialog.tsx

"use client";

import { useState } from "react";
import { useWallet } from "@mysten/dapp-kit";
import { PlusIcon } from "@radix-ui/react-icons";
import { toast } from "sonner"; // Assuming you have sonner for toasts

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { mintAndTransferNFT } from "@/lib/nft-sdk";
import { TransactionStatus, type TransactionState } from "./transaction-status"; // Adjust path as needed

export function MintNFTDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [txState, setTxState] = useState<TransactionState>("idle");
  const [txDigest, setTxDigest] = useState<string>();
  const [errorMessage, setErrorMessage] = useState<string>();

  const wallet = useWallet();

  const handleMintNFT = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!wallet.connected) {
      toast.error("Please connect your wallet first.");
      return;
    }

    setTxState("pending");
    setErrorMessage(undefined);

    try {
      const mintResult = await mintAndTransferNFT(
        wallet,
        name,
        description,
        imageUrl,
      );
      console.log("NFT Mint Result:", mintResult);

      setTxState("success");
      setTxDigest(mintResult.digest);
      toast.success("NFT minted and transferred successfully!", {
        action: {
          label: "View on Explorer",
          onClick: () => window.open(`https://suiscan.xyz/testnet/tx/${mintResult.digest}`, "_blank"),
        },
      });
      // Optionally reset form and close dialog after a delay
      setTimeout(() => {
        setIsOpen(false);
        setName("");
        setDescription("");
        setImageUrl("");
        setTxState("idle");
      }, 2000);

    } catch (error: any) {
      setTxState("error");
      setErrorMessage(error.message);
      toast.error(`Failed to mint NFT: ${error.message}`);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="h-8 gap-1">
          <PlusIcon className="h-3.5 w-3.5" />
          <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
            Mint NFT
          </span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Mint New NFT</DialogTitle>
          <DialogDescription>
            Create a new unique NFT to use in auctions or keep in your wallet.
          </DialogDescription>
        </DialogHeader>

        {txState !== "idle" ? (
            <div className="py-8">
                <TransactionStatus state={txState} txDigest={txDigest} errorMessage={errorMessage} />
            </div>
        ) : (
          <form onSubmit={handleMintNFT} className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="nft-name" className="text-right">
                Name
              </Label>
              <Input
                id="nft-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="col-span-3"
                required
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="nft-description" className="text-right">
                Description
              </Label>
              <Input
                id="nft-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="col-span-3"
                required
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="nft-imageUrl" className="text-right">
                Image URL
              </Label>
              <Input
                id="nft-imageUrl"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                className="col-span-3"
                type="url"
                required
              />
            </div>
            <DialogFooter>
              <Button type="submit">Mint NFT</Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}