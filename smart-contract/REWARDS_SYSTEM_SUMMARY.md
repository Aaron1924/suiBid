# suiBid Rewards & Admin Pool System - Implementation Summary

## 🎯 Tổng quan

Hệ thống rewards và admin pool đã được implement thành công với đầy đủ tính năng:
1. ✅ **Rewards Module** - Tích điểm và tier system
2. ✅ **Admin Pool** - Thu phí 5% platform fee từ mỗi auction
3. ✅ **Tier-based Refunds** - Hoàn lại % SUI cho high-tier winners
4. ✅ **Leaderboard Support** - Events để backend index real-time
5. ✅ **Test Suite** - 7 comprehensive test cases

---

## 📦 Module Structure

### 1. Rewards Module (`sources/rewards.move`)

#### Structs
```move
public struct UserProfile has store {
    points: u64,           // Điểm tích lũy (max 1500)
    tier: u8,              // 0=Bronze, 1=Silver, 2=Gold, 3=Platinum, 4=Diamond
    total_trades: u64,     // Tổng số trades đã hoàn thành
    total_auctions: u64,   // Tổng số auctions đã tham gia
}

public struct RewardsRegistry has key {
    id: UID,
    profiles: Table<address, UserProfile>,
}
```

#### Point Distribution
| Activity | Seller Points | Buyer Points |
|----------|--------------|--------------|
| Trade Complete | 2 | 2 |
| Auction Complete | 5 | 2 |

#### Tier System (0-1500 points)
| Tier | Points Range | Refund % |
|------|-------------|----------|
| 🥉 Bronze | 0-4 | 0.5% |
| 🥈 Silver | 5-699 | 1% |
| 🥇 Gold | 700-1199 | 3% |
| 💎 Platinum | 1200-1499 | 3.5% |
| 👑 Diamond | 1500 | 4% |

#### Public Functions
```move
// Award points
public fun award_trade_seller_points(registry: &mut RewardsRegistry, seller: address, ctx: &mut TxContext)
public fun award_trade_buyer_points(registry: &mut RewardsRegistry, buyer: address, ctx: &mut TxContext)
public fun award_auction_seller_points(registry: &mut RewardsRegistry, seller: address, ctx: &mut TxContext)
public fun award_auction_buyer_points(registry: &mut RewardsRegistry, buyer: address, ctx: &mut TxContext)

// Calculate refund
public fun calculate_refund(registry: &RewardsRegistry, user: address, amount: u64): u64

// View functions
public fun get_user_profile(registry: &RewardsRegistry, user: address): (u64, u8, u64, u64)
public fun get_points(registry: &RewardsRegistry, user: address): u64
public fun get_tier(registry: &RewardsRegistry, user: address): u8
```

---

### 2. Admin Pool System (`sources/auction.move`)

#### Structs
```move
public struct AdminPool has key {
    id: UID,
    admin: address,
    balance: Balance<SUI>,
    total_fees_collected: u64,
}

public struct AdminCap has key, store {
    id: UID,
}
```

#### Fee Collection
- **Platform Fee**: 5% của mỗi winning bid
- Tự động được thu khi buyer claim NFT
- Lưu trữ trong AdminPool (shared object)

#### Admin Functions
```move
// Rút một số tiền cụ thể
public entry fun admin_withdraw(
    _admin_cap: &AdminCap,
    admin_pool: &mut AdminPool,
    amount: u64,
    ctx: &mut TxContext
)

// Rút toàn bộ
public entry fun admin_withdraw_all(
    _admin_cap: &AdminCap,
    admin_pool: &mut AdminPool,
    ctx: &mut TxContext
)

// View functions
public fun admin_pool_balance(admin_pool: &AdminPool): u64
public fun total_fees_collected(admin_pool: &AdminPool): u64
```

---

## 💰 Money Flow in Auction

### Scenario: Buyer với Gold Tier (3% refund) wins auction 100 SUI

```
┌─────────────────────────────────────────────┐
│ BUYER bids: 100 SUI                         │
└─────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────┐
│ Auction ends, Buyer claims NFT              │
└─────────────────────────────────────────────┘
                    │
                    ▼
        ┌───────────┴───────────┐
        │   Distribution        │
        └───────────┬───────────┘
                    │
        ┌───────────┼───────────┬──────────────┐
        │           │           │              │
        ▼           ▼           ▼              ▼
   Platform      Tier       Seller         Points
    Fee 5%      Refund 3%   Amount       Award
    5 SUI      2.85 SUI   92.15 SUI
        │           │           │              │
        │           │           │              │
        ▼           ▼           ▼              ▼
  AdminPool    Back to     Seller's     Seller: +5
              Buyer       Wallet       Buyer: +2
```

### Calculation
```
Total bid: 100 SUI
├─ Platform fee (5%): 5 SUI → AdminPool
└─ Remaining: 95 SUI
    ├─ Tier refund (3% of 95): 2.85 SUI → Buyer
    └─ To seller: 92.15 SUI → Seller
```

---

## 🔗 Integration với Trade Module

File `sources/trade.move` đã được update:

### Updated Function Signature
```move
public fun accept_offer<T: key + store, U: key + store>(
    trade: Trade,
    offer_index: u64,
    clock: &Clock,
    rewards_registry: &mut RewardsRegistry,  // ← Added
    ctx: &mut TxContext
)
```

### Point Award Logic
```move
// Award points to seller and buyer
rewards::award_trade_seller_points(rewards_registry, seller, ctx);
rewards::award_trade_buyer_points(rewards_registry, buyer, ctx);
```

**Note**: Trade không có platform fee, chỉ có point rewards.

---

## 📊 Events cho Backend Indexing

### Rewards Events
```move
public struct PointsAwarded has copy, drop {
    user: address,
    points: u64,
    reason: vector<u8>,  // "trade_seller", "trade_buyer", "auction_seller", "auction_buyer"
    new_total: u64,
}

public struct TierChanged has copy, drop {
    user: address,
    old_tier: u8,
    new_tier: u8,
    points: u64,
}

public struct RefundCalculated has copy, drop {
    user: address,
    tier: u8,
    amount: u64,
    refund_percentage: u64,
    refund_amount: u64,
}
```

### Admin Pool Events
```move
public struct PlatformFeeCollected has copy, drop {
    auction_id: ID,
    amount: u64,
}

public struct AdminWithdrawal has copy, drop {
    admin: address,
    amount: u64,
}
```

---

## 🗄️ Backend Implementation Guide

### 1. Leaderboard với Redis

```python
# Listen to PointsAwarded events
def on_points_awarded(event):
    user = event.user
    new_total = event.new_total

    # Update Redis sorted set
    redis.zadd("leaderboard", {user: new_total})

# Query top 100 users
def get_leaderboard(limit=100):
    return redis.zrevrange("leaderboard", 0, limit-1, withscores=True)
```

### 2. User Profile API

```typescript
// Query user profile from blockchain
async function getUserProfile(address: string) {
    const tx = new Transaction();
    tx.moveCall({
        target: `${PACKAGE_ID}::rewards::get_user_profile`,
        arguments: [
            tx.object(REWARDS_REGISTRY_ID),
            tx.pure(address, 'address')
        ],
    });

    const result = await provider.devInspectTransactionBlock({
        transactionBlock: tx,
        sender: address
    });

    // Parse result: [points, tier, total_trades, total_auctions]
    return parseUserProfile(result);
}
```

### 3. Admin Pool Dashboard

```typescript
// Check admin pool balance
async function getAdminPoolBalance() {
    const tx = new Transaction();
    tx.moveCall({
        target: `${PACKAGE_ID}::auction::admin_pool_balance`,
        arguments: [tx.object(ADMIN_POOL_ID)],
    });

    const result = await provider.devInspectTransactionBlock({
        transactionBlock: tx,
        sender: ADMIN_ADDRESS
    });

    return parseBalance(result);
}

// Admin withdraw
async function adminWithdraw(amount: number) {
    const tx = new Transaction();
    tx.moveCall({
        target: `${PACKAGE_ID}::auction::admin_withdraw`,
        arguments: [
            tx.object(ADMIN_CAP_ID),
            tx.object(ADMIN_POOL_ID),
            tx.pure(amount, 'u64')
        ],
    });

    await signAndExecute(tx);
}
```

---

## 🚀 Deployment Checklist

### 1. Deploy Smart Contracts
```bash
cd smart-contract
sui move build
sui client publish --gas-budget 100000000
```

### 2. Save Object IDs
Sau khi deploy, lưu lại các object IDs:
- ✅ `PACKAGE_ID`: Address của package
- ✅ `REWARDS_REGISTRY_ID`: RewardsRegistry shared object
- ✅ `ADMIN_POOL_ID`: AdminPool shared object
- ✅ `ADMIN_CAP_ID`: AdminCap object (thuộc deployer)

### 3. Backend Configuration
```env
SUI_PACKAGE_ID=0x...
REWARDS_REGISTRY_ID=0x...
ADMIN_POOL_ID=0x...
ADMIN_CAP_ID=0x...
ADMIN_ADDRESS=0x...
```

### 4. Index Events
Setup event listener cho:
- `PointsAwarded`
- `TierChanged`
- `PlatformFeeCollected`
- `AdminWithdrawal`
- `RefundCalculated`

---

## 📝 Important Notes

### Security
1. ✅ **AdminCap Protection**: Chỉ admin owner mới có thể rút tiền từ pool
2. ✅ **Automatic Fee Collection**: Không thể bypass, tự động thu khi claim
3. ✅ **Points Cap**: Giới hạn 1500 points để tránh overflow
4. ✅ **Tier Validation**: Auto-calculate tier dựa trên points

### Limitations
1. **Max Points**: 1500 (có thể adjust bằng cách thay đổi constants)
2. **Platform Fee**: 5% fixed (có thể thay đổi constant `PLATFORM_FEE_BPS`)
3. **Refund Percentages**: Fixed per tier (có thể adjust constants)

### Gas Optimization
- Use `RewardsRegistry` và `AdminPool` as shared objects
- Batch event emissions
- Efficient Table lookups

---

## 🧪 Testing

### Run Tests
```bash
# Build
sui move build

# Run all tests
sui move test

# Run specific test file
sui move test rewards

# Run specific test function
sui move test test_points_and_tier
```

### Test Coverage
✅ Points accumulation
✅ Tier upgrades
✅ Refund calculation
✅ Admin pool withdrawal
✅ Leaderboard ranking
✅ Complete auction flow
✅ Points capping
✅ Seller vs buyer points

---

## 📚 References

- **Test Cases**: `TEST_CASES.md`
- **Rewards Module**: `sources/rewards.move`
- **Auction Module**: `sources/auction.move`
- **Trade Module**: `sources/trade.move`
- **Test Suite**: `tests/rewards_tests.move`

---

## 🎉 Summary

Hệ thống đã hoàn thiện với:
- ✅ Rewards & Tier system
- ✅ 5% Platform fee collection
- ✅ Tier-based refunds (0.5% - 4%)
- ✅ Admin pool với withdrawal functions
- ✅ Leaderboard-ready event emissions
- ✅ Comprehensive test suite
- ✅ Integration với Trade & Auction modules

**Ready for deployment and production use! 🚀**
