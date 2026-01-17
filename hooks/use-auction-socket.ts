import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { toast } from 'sonner';

// Địa chỉ Server Backend của bạn
const SOCKET_URL = 'http://localhost:3001';

interface AuctionUpdatePayload {
  type: 'BID_UPDATE' | 'AUCTION_SETTLED';
  auctionId: string;
  newPrice?: string | number;
  winner?: string;
  finalPrice?: string | number;
}

export function useAuctionSocket(auctionId: string, initialPrice: string | number) {
  const [price, setPrice] = useState<string | number>(initialPrice);
  const [winner, setWinner] = useState<string | null>(null);
  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    // Chỉ kết nối nếu có auctionId
    if (!auctionId) return;

    const socket: Socket = io(SOCKET_URL);

    socket.on('connect', () => {
      console.log('Connected to Auction Socket');
      setIsLive(true);
      // Join vào room của auction này
      socket.emit('join_auction', auctionId);
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from Auction Socket');
      setIsLive(false);
    });

    // Lắng nghe sự kiện update từ Server
    socket.on('AUCTION_UPDATE', (data: AuctionUpdatePayload) => {
      if (data.auctionId !== auctionId) return;

      if (data.type === 'BID_UPDATE') {
        setPrice(data.newPrice!);
        setWinner(data.winner!);
        toast.info(`New highest bid: ${data.newPrice} SUI`);
      } else if (data.type === 'AUCTION_SETTLED') {
        setPrice(data.finalPrice!);
        setWinner(data.winner!);
        toast.success(`Auction ended! Winner: ${data.winner?.slice(0, 6)}...`);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [auctionId]);

  return { price, winner, isLive };
}
