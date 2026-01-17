import { Transaction } from "@mysten/sui/transactions";
import { SUI_CLOCK_OBJECT_ID } from "@mysten/sui/utils";

export const MARKETPLACE_PACKAGE_ID = "0x...YOUR_PACKAGE_ID_HERE...";
export const MODULE_NAME = "marketplace";

/**
 * Tạo Transaction Block để mở một cuộc đấu giá mới.
 * Sử dụng cơ chế Shared Object để giữ Item.
 * 
 * @param itemType Loại của NFT (VD: "0xPackage::module::Hero")
 * @param itemId ID của NFT (Object ID) muốn bán
 * @param minBid Giá khởi điểm (MIST)
 * @param duration Thời gian đấu giá (ms)
 */
export function createAuctionTx(itemType: string, itemId: string, minBid: bigint | number, duration: number) {
  const tx = new Transaction();

  tx.moveCall({
    target: `${MARKETPLACE_PACKAGE_ID}::${MODULE_NAME}::create_auction`,
    typeArguments: [itemType], // Truyền loại NFT vào Generic <T>
    arguments: [
      tx.object(itemId), // Truyền Object NFT vào (Move by value)
      tx.pure.u64(minBid),
      tx.pure.u64(duration),
      tx.object(SUI_CLOCK_OBJECT_ID),
    ],
  });

  return tx;
}

/**
 * Tạo Transaction Block để đặt giá (Bid).
 * @param itemType Loại của NFT đang đấu giá
 * @param auctionId ID của phiên đấu giá
 * @param amount Số tiền muốn bid thêm
 * @param coinId (Optional) Coin ID
 */
export function placeBidTx(itemType: string, auctionId: string, amount: bigint | number, coinId?: string) {
  const tx = new Transaction();

  const [coin] = tx.splitCoins(coinId ? tx.object(coinId) : tx.gas, [tx.pure.u64(amount)]);

  tx.moveCall({
    target: `${MARKETPLACE_PACKAGE_ID}::${MODULE_NAME}::bid`,
    typeArguments: [itemType],
    arguments: [
      tx.object(auctionId),
      coin,
      tx.object(SUI_CLOCK_OBJECT_ID),
    ],
  });

  return tx;
}

/**
 * Tạo Transaction Block để kết thúc đấu giá (Settlement).
 * NFT sẽ được chuyển từ Auction Object -> Winner.
 * 
 * @param itemType Loại của NFT
 * @param auctionId ID phiên đấu giá
 */
export function settleAuctionTx(
  itemType: string,
  auctionId: string
) {
  const tx = new Transaction();

  tx.moveCall({
    target: `${MARKETPLACE_PACKAGE_ID}::${MODULE_NAME}::settle_auction`,
    typeArguments: [itemType],
    arguments: [
      tx.object(auctionId),
      tx.object(SUI_CLOCK_OBJECT_ID),
    ],
  });

  return tx;
}

export function withdrawBidTx(itemType: string, auctionId: string) {
    const tx = new Transaction();

    tx.moveCall({
        target: `${MARKETPLACE_PACKAGE_ID}::${MODULE_NAME}::withdraw_bid`,
        typeArguments: [itemType],
        arguments: [
            tx.object(auctionId)
        ]
    });

    return tx;
}