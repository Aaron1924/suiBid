# Test Cases Documentation - suiBid Rewards & Admin Pool System

## Tổng quan
Document này mô tả các test cases đã được tạo cho hệ thống rewards, tier, leaderboard và admin pool trong suiBid marketplace.

## File Test
- **Location**: `/tests/rewards_tests.move`
- **Module**: `suibid::rewards_tests`

---

## Test Case 1: Points Accumulation and Tier Upgrades
**Function**: `test_points_and_tier_progression()`

### Mục đích
Kiểm tra việc tích lũy điểm và nâng cấp tier tự động khi user hoàn thành các giao dịch.

### Kịch bản
1. User bắt đầu với 0 điểm (Bronze tier)
2. Hoàn thành 1 trade → +2 điểm (vẫn Bronze)
3. Win 1 auction → +2 điểm → tổng 4 điểm (vẫn Bronze)
4. Win thêm 1 auction → +2 điểm → tổng 6 điểm → **NÂNG LÊN SILVER TIER**

### Assertions
- Điểm khởi đầu = 0, tier = 0 (Bronze)
- Sau trade: điểm = 2, trades = 1
- Sau 2 auctions: điểm = 6, tier = 1 (Silver)

---

## Test Case 2: Refund Calculation Based on Tiers
**Function**: `test_refund_by_tier()`

### Mục đích
Kiểm tra tính toán refund dựa trên tier của user khi win auction.

### Kịch bản
1. **Bronze tier** (0 points): 100 SUI → refund 0.5% = 0.5 SUI
2. **Silver tier** (6 points): 100 SUI → refund 1% = 1 SUI
3. **Gold tier** (700 points): 100 SUI → refund 3% = 3 SUI

### Tier Refund Rates
| Tier | Points Range | Refund % |
|------|-------------|----------|
| Bronze | 0-4 | 0.5% |
| Silver | 5-699 | 1% |
| Gold | 700-1199 | 3% |
| Platinum | 1200-1499 | 3.5% |
| Diamond | 1500 | 4% |

### Assertions
- Bronze: refund = 50,000,000 MIST (0.5 SUI)
- Silver: refund = 100,000,000 MIST (1 SUI)
- Gold: refund = 300,000,000 MIST (3 SUI)

---

## Test Case 3: Admin Pool Fee Collection and Withdrawal
**Function**: `test_admin_pool_withdrawal()`

### Mục đích
Kiểm tra hệ thống thu phí 5% platform fee vào AdminPool và khả năng admin rút tiền.

### Kịch bản
1. Seller tạo auction với NFT
2. Buyer đặt bid 100 SUI
3. Auction kết thúc, buyer claim item
4. **Platform tự động thu 5% = 5 SUI vào AdminPool**
5. Admin rút 2 SUI từ pool
6. Admin rút toàn bộ số còn lại (3 SUI)

### Flow Diagram
```
Buyer bid: 100 SUI
    ↓
Auction ends
    ↓
Claim triggers fee collection:
├─ Platform fee (5%): 5 SUI → AdminPool
├─ Tier refund (if applicable): X SUI → Buyer
└─ Remaining: (95 - X) SUI → Seller
```

### Assertions
- AdminPool balance sau claim = 5 SUI
- Sau rút 2 SUI: balance = 3 SUI
- Sau rút all: balance = 0 SUI

---

## Test Case 4: Leaderboard Ranking Scenario
**Function**: `test_leaderboard_ranking()`

### Mục đích
Kiểm tra việc xếp hạng nhiều users dựa trên điểm số để tạo leaderboard.

### Kịch bản
Tạo 5 users với số điểm khác nhau:

| User | Activities | Total Points | Tier |
|------|-----------|--------------|------|
| BUYER1 | 2 trades | 4 | Bronze |
| BUYER2 | 3 auctions | 6 | Silver |
| BUYER3 | 1 trade + 5 auctions | 12 | Silver |
| BUYER4 | 350 auctions | 700 | Gold |
| BUYER5 | 750 auctions | 1500 | Diamond |

### Leaderboard Order
```
1. BUYER5 - 1500 points (Diamond) 💎
2. BUYER4 - 700 points (Gold) 🥇
3. BUYER3 - 12 points (Silver) 🥈
4. BUYER2 - 6 points (Silver) 🥈
5. BUYER1 - 4 points (Bronze) 🥉
```

### Assertions
- Verify p5 > p4 > p3 > p2 > p1
- Verify tiers match point thresholds

---

## Test Case 5: Complete Auction Flow with Tier Refund
**Function**: `test_complete_auction_with_tier_refund()`

### Mục đích
Kiểm tra toàn bộ flow auction với user có tier cao nhận được refund.

### Kịch bản
1. BUYER1 được award 700 points → Gold tier (3% refund)
2. Seller tạo auction
3. BUYER1 (Gold tier) bid 100 SUI
4. Auction ends, BUYER1 claims

### Money Flow
```
BUYER1 bids: 100 SUI
    ↓
Claim distribution:
├─ Platform (5%): 5 SUI → AdminPool
├─ Remaining: 95 SUI
    ├─ Refund to BUYER1 (3% of 95): 2.85 SUI
    └─ To Seller: 92.15 SUI
```

### Assertions
- AdminPool gets exactly 5 SUI
- BUYER1 (Gold) receives 3% refund on (100 - 5) = 2.85 SUI
- Seller receives 92.15 SUI

---

## Test Case 6: Points Cap at Maximum
**Function**: `test_points_cap()`

### Mục đích
Kiểm tra điểm số được giới hạn ở mức tối đa (1500 points).

### Kịch bản
1. Award 800 auctions × 2 points = 1600 points (lý thuyết)
2. Hệ thống phải cap ở 1500 points

### Assertions
- `auctions` counter = 800
- `points` ≤ 1500 (không vượt quá max)

---

## Test Case 7: Seller Auction Points
**Function**: `test_seller_auction_points()`

### Mục đích
Xác minh seller nhận điểm cao hơn buyer khi auction hoàn thành.

### Kịch bản
1. Seller tạo auction
2. Buyer wins auction
3. Buyer claims item

### Point Distribution
- **Seller**: +5 points, auction_count = 1
- **Buyer**: +2 points, auction_count = 1

### Assertions
- seller_points = 5
- seller_auctions = 1
- buyer_points = 2
- buyer_auctions = 1

---

## Admin Functions Test Coverage

### `admin_withdraw()`
- Requires `AdminCap` ownership
- Can withdraw specific amount
- Fails if insufficient balance
- Emits `AdminWithdrawal` event

### `admin_withdraw_all()`
- Withdraws entire pool balance
- Pool balance = 0 after call
- Transfer all SUI to admin wallet

---

## Integration với Backend

### Events for Indexing
Backend có thể listen các events sau để cập nhật leaderboard real-time:

```move
// Từ rewards module
public struct PointsAwarded has copy, drop {
    user: address,
    points: u64,
    reason: vector<u8>,
    new_total: u64,
}

public struct TierChanged has copy, drop {
    user: address,
    old_tier: u8,
    new_tier: u8,
    points: u64,
}

// Từ auction module
public struct PlatformFeeCollected has copy, drop {
    auction_id: ID,
    amount: u64,
}

public struct AdminWithdrawal has copy, drop {
    admin: address,
    amount: u64,
}
```

### Leaderboard Query
Backend cần implement:
1. Listen to `PointsAwarded` events
2. Maintain Redis sorted set: `user_address` → `points`
3. Query top N users: `ZREVRANGE leaderboard 0 99`

---

## Cách chạy tests

```bash
# Build project
sui move build

# Run all rewards tests
sui move test rewards

# Run specific test
sui move test test_points_and_tier
sui move test test_admin_pool_withdrawal
sui move test test_leaderboard_ranking
```

---

## Summary

✅ **7 comprehensive test cases** covering:
- Point accumulation and tier progression
- Tier-based refund calculation
- Admin pool fee collection (5%)
- Admin withdrawal (partial and full)
- Leaderboard ranking with multiple users
- Complete auction flow with refunds
- Points capping at maximum
- Seller vs Buyer point distribution

✅ **Integration ready**:
- Events emitted for backend indexing
- View functions for querying user profiles
- Real-time leaderboard support via events

✅ **Admin Pool Features**:
- 5% platform fee on all auction sales
- AdminCap-protected withdrawal functions
- Transparent fee tracking with events
