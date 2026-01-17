import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import redisClient, { connectRedis } from './redis';
import { startIndexer } from './indexer';

const app = express();
app.use(cors());
app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "*", // Cấu hình domain frontend của bạn ở đây
        methods: ["GET", "POST"]
    }
});

// API endpoint để lấy dữ liệu nhanh từ Redis (thay vì chọc vào Chain)
app.get('/api/auction/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const price = await redisClient.get(`auction:${id}:price`);
        const winner = await redisClient.get(`auction:${id}:winner`);
        res.json({ price, winner });
    } catch (e) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Socket logic
io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    // Client join vào room của auction cụ thể
    socket.on('join_auction', (auctionId) => {
        socket.join(auctionId);
        console.log(`Socket ${socket.id} joined auction ${auctionId}`);
    });
});

// Khởi động hệ thống
async function bootstrap() {
    await connectRedis();

    // 1. Subscribe Redis để nhận tín hiệu từ Indexer
    const subscriber = redisClient.duplicate();
    await subscriber.connect();

    await subscriber.subscribe('auction_updates', (message) => {
        const data = JSON.parse(message);
        console.log('[Socket Server] Broadcasting update:', data);

        // Bắn tin xuống tất cả client đang xem auction này
        io.to(data.auctionId).emit('AUCTION_UPDATE', data);
    });

    // 2. Chạy Indexer (Worker)
    // Lưu ý: Trong thực tế nên chạy process riêng, nhưng ở đây chạy chung để demo
    startIndexer();

    const PORT = process.env.PORT || 3001;
    httpServer.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}

bootstrap();
