import { createAuctionTx, placeBidTx, settleAuctionTx } from "../lib/auction-sdk";

const MIST_PER_SUI = 1_000_000_000;

async function simulateAuctionScenario() {
  console.log("=== BẮT ĐẦU MÔ PHỎNG KỊCH BẢN ĐẤU GIÁ (SHARED OBJECT MODE) ===");

  // Định nghĩa loại Item (Giả sử là NFT Hero)
  const ITEM_TYPE = "0xPackage::hero::Hero";
  const itemId = "0xNFT_ITEM_ID";
  const auctionId = "0xAUCTION_OBJECT_ID";

  // 1. Khởi tạo đấu giá
  // Item được chuyển vào Contract giữ
  console.log("\n[Bước 1] Seller tạo Auction...");
  const createTx = createAuctionTx(ITEM_TYPE, itemId, 1 * MIST_PER_SUI, 24 * 3600 * 1000);
  console.log("-> Transaction: Move NFT into Auction Object.");

  // 2. User A bid
  console.log("\n[Bước 2] User A bid 10 SUI...");
  const txA1 = placeBidTx(ITEM_TYPE, auctionId, 10 * MIST_PER_SUI);
  
  // 3. User B bid
  console.log("\n[Bước 3] User B bid 12 SUI...");
  const txB = placeBidTx(ITEM_TYPE, auctionId, 12 * MIST_PER_SUI);

  // 4. User A top-up
  console.log("\n[Bước 4] User A bid thêm 5 SUI (Total 15)...");
  const txA2 = placeBidTx(ITEM_TYPE, auctionId, 5 * MIST_PER_SUI);

  // 5. Kết thúc
  // NFT chuyển trực tiếp từ Auction Object -> Winner
  console.log("\n[Bước 5] Kết thúc & Thanh toán...");
  const settleTx = settleAuctionTx(ITEM_TYPE, auctionId);
  
  console.log("-> Transaction Settle:");
  console.log("   - NFT (Type: Hero) unwrapped from Auction -> Winner A.");
  console.log("   - Seller nhận 15 SUI.");
  
  console.log("\n=== KẾT THÚC MÔ PHỎNG ===");
}

simulateAuctionScenario();