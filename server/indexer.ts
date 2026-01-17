import redisClient, { connectRedis } from './redis';
import { SuiClient, SuiEvent } from '@mysten/sui/client';

// Cấu hình
const SUI_NODE_URL = 'https://fullnode.testnet.sui.io:443';
const PACKAGE_ID = process.env.PACKAGE_ID || '0x1b054c703bf2bf04ea78e35dc5d4b6b086aafb236c7017a222f62d5535753ccb';
const MODULE_NAME = 'auction'; // Đã sửa thành 'auction'

const client = new SuiClient({ url: SUI_NODE_URL });

// Hàm xử lý Event: BidPlaced
async function handleBidEvent(event: SuiEvent) {
    const parsedJson = event.parsedJson as any;
    // Cập nhật tên trường khớp với Move: bid_amount thay vì amount
    const { auction_id, bidder, bid_amount, total_position } = parsedJson;

    console.log(`[Indexer] New Bid detected: Auction ${auction_id}, Bidder ${bidder}, Amount ${bid_amount}, Total Pos ${total_position}`);

    // 1. Cập nhật Redis (Cache trạng thái mới nhất)
    // Lưu giá cao nhất hiện tại (chính là total_position của người này vì họ đang dẫn đầu)
    await redisClient.set(`auction:${auction_id}:price`, total_position.toString());
    // Lưu người thắng tạm thời
    await redisClient.set(`auction:${auction_id}:winner`, bidder);
    
    // 2. Lưu Stacking Position của User
    await redisClient.hSet(`auction:${auction_id}:positions`, bidder, total_position.toString());

    // 3. Publish sự kiện để Socket Server biết
    const updateData = {
        type: 'BID_UPDATE',
        auctionId: auction_id,
        newPrice: total_position, // Giá hiển thị là Total Position
        bidAmount: bid_amount,    // Số tiền vừa bid thêm
        winner: bidder,
        timestamp: Date.now()
    };

    await redisClient.publish('auction_updates', JSON.stringify(updateData));
}

// Hàm xử lý Event: AuctionEnded
async function handleAuctionEndedEvent(event: SuiEvent) {
    const parsedJson = event.parsedJson as any;
    // Cập nhật tên trường khớp với Move: final_bid thay vì price
    const { auction_id, winner, final_bid } = parsedJson;

    console.log(`[Indexer] Auction Ended: ${auction_id}, Winner ${JSON.stringify(winner)}, Final Bid ${final_bid}`);

    // Publish sự kiện kết thúc
    await redisClient.publish('auction_updates', JSON.stringify({
        type: 'AUCTION_ENDED',
        auctionId: auction_id,
        winner,
        finalPrice: final_bid
    }));
}

// Worker Loop (Polling Event)
let cursor: any = null;

export async function startIndexer() {
    await connectRedis();
    console.log('--- Starting Sui Indexer ---');

    setInterval(async () => {
        try {
            // Query các event từ Package của chúng ta
            const events = await client.queryEvents({
                query: { MoveModule: { package: PACKAGE_ID, module: MODULE_NAME } },
                cursor: cursor,
                limit: 50,
                order: 'Ascending'
            });

            if (events.data.length > 0) {
                for (const event of events.data) {
                    // Phân loại Event dựa trên Type chuỗi đầy đủ (VD: 0x...::auction::BidPlaced)
                    if (event.type.endsWith(`::${MODULE_NAME}::BidPlaced`)) {
                        await handleBidEvent(event);
                    } else if (event.type.endsWith(`::${MODULE_NAME}::AuctionEnded`)) {
                        await handleAuctionEndedEvent(event);
                    }
                }
                // Cập nhật con trỏ để lần sau query tiếp từ đây
                cursor = events.nextCursor;
            }
        } catch (e) {
            console.error('Indexer polling error:', e);
        }
    }, 2000); // Poll mỗi 2 giây
}