

import redisClient, { connectRedis } from './redis';

// Cấu hình
const SUI_NODE_URL = 'https://fullnode.testnet.sui.io:443';
const PACKAGE_ID = process.env.PACKAGE_ID || '0x...YOUR_PACKAGE_ID...';
const MODULE_NAME = 'marketplace';

const client = new SuiClient({ url: SUI_NODE_URL });

// Hàm xử lý Event
async function handleBidEvent(event: SuiEvent) {
    const parsedJson = event.parsedJson as any;
    const { auction_id, bidder, amount, is_new_winner } = parsedJson;

    console.log(`[Indexer] New Bid detected: Auction ${auction_id}, Bidder ${bidder}, Amount ${amount}`);

    // 1. Cập nhật Redis (Cache trạng thái mới nhất)
    // Lưu giá cao nhất
    await redisClient.set(`auction:${auction_id}:price`, amount.toString());
    // Lưu người thắng
    await redisClient.set(`auction:${auction_id}:winner`, bidder);
    
    // 2. Lưu Stacking Position của User (quan trọng cho logic Stacking)
    // Để khi User query vào API, ta trả về ngay số tiền họ đang lock mà không cần chọc vào chain
    await redisClient.hSet(`auction:${auction_id}:positions`, bidder, amount.toString());

    // 3. Publish sự kiện để Socket Server biết
    const updateData = {
        type: 'BID_UPDATE',
        auctionId: auction_id,
        newPrice: amount,
        winner: bidder,
        timestamp: Date.now()
    };

    await redisClient.publish('auction_updates', JSON.stringify(updateData));
}

async function handleSettledEvent(event: SuiEvent) {
    const parsedJson = event.parsedJson as any;
    const { auction_id, winner, price } = parsedJson;

    console.log(`[Indexer] Auction Settled: ${auction_id}, Winner ${winner}`);

    // Publish sự kiện kết thúc
    await redisClient.publish('auction_updates', JSON.stringify({
        type: 'AUCTION_SETTLED',
        auctionId: auction_id,
        winner,
        finalPrice: price
    }));
}

// Worker Loop (Polling Event)
// Lưu ý: Trong môi trường Prod, nên lưu cursor vào DB để khi restart không bị mất
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
                    // Phân loại Event
                    if (event.type.includes('::BidPlaced')) {
                        await handleBidEvent(event);
                    } else if (event.type.includes('::AuctionSettled')) {
                        await handleSettledEvent(event);
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
