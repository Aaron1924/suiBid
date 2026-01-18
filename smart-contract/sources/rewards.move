module suibid::rewards {
    use sui::event;
    use sui::table::{Self, Table};

    // ===== Constants =====

    // Point rewards
    const TRADE_SELLER_POINTS: u64 = 2;
    const TRADE_BUYER_POINTS: u64 = 2;
    const AUCTION_SELLER_POINTS: u64 = 5;
    const AUCTION_BUYER_POINTS: u64 = 2;

    // Tier thresholds (0-1500 points)
    const TIER_SILVER: u64 = 5;    // 200-399 points
    const TIER_GOLD: u64 = 700;      // 400-599 points
    const TIER_PLATINUM: u64 = 1200;  // 600-799 points
    const TIER_DIAMOND: u64 = 1500;   // 800-1000 points

    // Refund percentages (in basis points, 100 = 1%)
    const BRONZE_REFUND: u64 = 50;      // 0.5%
    const SILVER_REFUND: u64 = 100;    // 1%
    const GOLD_REFUND: u64 = 300;      // 3%
    const PLATINUM_REFUND: u64 = 350;  // 3.5%
    const DIAMOND_REFUND: u64 = 400;  // 4%

    // ===== Structs =====

    /// User profile để lưu điểm và tier
    public struct UserProfile has store {
        points: u64,
        tier: u8,  // 0=Bronze, 1=Silver, 2=Gold, 3=Platinum, 4=Diamond
        total_trades: u64,
        total_auctions: u64,
    }

    /// Registry để quản lý tất cả user profiles
    public struct RewardsRegistry has key {
        id: UID,
        profiles: Table<address, UserProfile>,
    }

    // ===== Events =====

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

    // ===== Init Function =====

    fun init(ctx: &mut TxContext) {
        let registry = RewardsRegistry {
            id: object::new(ctx),
            profiles: table::new(ctx),
        };
        transfer::share_object(registry);
    }

    // ===== Public Functions =====

    /// Award points for completing a trade (seller)
    public fun award_trade_seller_points(
        registry: &mut RewardsRegistry,
        seller: address,
        ctx: &mut TxContext
    ) {
        award_points(
            registry,
            seller,
            TRADE_SELLER_POINTS,
            b"trade_seller",
            ctx
        );

        // Increment trade count
        let profile = table::borrow_mut(&mut registry.profiles, seller);
        profile.total_trades = profile.total_trades + 1;
    }

    /// Award points for completing a trade (buyer)
    public fun award_trade_buyer_points(
        registry: &mut RewardsRegistry,
        buyer: address,
        ctx: &mut TxContext
    ) {
        award_points(
            registry,
            buyer,
            TRADE_BUYER_POINTS,
            b"trade_buyer",
            ctx
        );

        // Increment trade count
        let profile = table::borrow_mut(&mut registry.profiles, buyer);
        profile.total_trades = profile.total_trades + 1;
    }

    /// Award points for completing an auction (seller)
    public fun award_auction_seller_points(
        registry: &mut RewardsRegistry,
        seller: address,
        ctx: &mut TxContext
    ) {
        award_points(
            registry,
            seller,
            AUCTION_SELLER_POINTS,
            b"auction_seller",
            ctx
        );

        // Increment auction count
        let profile = table::borrow_mut(&mut registry.profiles, seller);
        profile.total_auctions = profile.total_auctions + 1;
    }

    /// Award points for winning an auction (buyer)
    public fun award_auction_buyer_points(
        registry: &mut RewardsRegistry,
        buyer: address,
        ctx: &mut TxContext
    ) {
        award_points(
            registry,
            buyer,
            AUCTION_BUYER_POINTS,
            b"auction_buyer",
            ctx
        );

        // Increment auction count
        let profile = table::borrow_mut(&mut registry.profiles, buyer);
        profile.total_auctions = profile.total_auctions + 1;
    }

    /// Calculate refund amount based on user's tier
    /// Returns the refund amount in MIST (1 SUI = 1,000,000,000 MIST)
    public fun calculate_refund(
        registry: &RewardsRegistry,
        user: address,
        amount: u64,
    ): u64 {
        if (!table::contains(&registry.profiles, user)) {
            return 0
        };

        let profile = table::borrow(&registry.profiles, user);
        let refund_percentage = get_refund_percentage(profile.tier);

        // Calculate refund: amount * percentage / 10000
        let refund = (amount * refund_percentage) / 10000;

        event::emit(RefundCalculated {
            user,
            tier: profile.tier,
            amount,
            refund_percentage,
            refund_amount: refund,
        });

        refund
    }

    // ===== View Functions =====

    /// Get user's profile
    public fun get_user_profile(registry: &RewardsRegistry, user: address): (u64, u8, u64, u64) {
        if (!table::contains(&registry.profiles, user)) {
            return (0, 0, 0, 0)
        };

        let profile = table::borrow(&registry.profiles, user);
        (profile.points, profile.tier, profile.total_trades, profile.total_auctions)
    }

    /// Get user's points
    public fun get_points(registry: &RewardsRegistry, user: address): u64 {
        if (!table::contains(&registry.profiles, user)) {
            return 0
        };

        let profile = table::borrow(&registry.profiles, user);
        profile.points
    }

    /// Get user's tier
    public fun get_tier(registry: &RewardsRegistry, user: address): u8 {
        if (!table::contains(&registry.profiles, user)) {
            return 0
        };

        let profile = table::borrow(&registry.profiles, user);
        profile.tier
    }

    /// Get refund percentage for a tier (in basis points)
    public fun get_refund_percentage(tier: u8): u64 {
        if (tier == 0) {
            BRONZE_REFUND
        } else if (tier == 1) {
            SILVER_REFUND
        } else if (tier == 2) {
            GOLD_REFUND
        } else if (tier == 3) {
            PLATINUM_REFUND
        } else if (tier == 4) {
            DIAMOND_REFUND
        } else {
            0
        }
    }

    /// Check if user has a profile
    public fun has_profile(registry: &RewardsRegistry, user: address): bool {
        table::contains(&registry.profiles, user)
    }

    // ===== Helper Functions =====

    /// Internal function to award points
    fun award_points(
        registry: &mut RewardsRegistry,
        user: address,
        points: u64,
        reason: vector<u8>,
        _ctx: &mut TxContext
    ) {
        // Create profile if doesn't exist
        if (!table::contains(&registry.profiles, user)) {
            let profile = UserProfile {
                points: 0,
                tier: 0,
                total_trades: 0,
                total_auctions: 0,
            };
            table::add(&mut registry.profiles, user, profile);
        };

        let profile = table::borrow_mut(&mut registry.profiles, user);
        let old_tier = profile.tier;

        // Add points (cap at 1000)
        profile.points = profile.points + points;
        if (profile.points > 1000) {
            profile.points = 1000;
        };

        // Update tier based on new points
        let new_tier = calculate_tier(profile.points);
        profile.tier = new_tier;

        event::emit(PointsAwarded {
            user,
            points,
            reason,
            new_total: profile.points,
        });

        // Emit tier change event if tier changed
        if (old_tier != new_tier) {
            event::emit(TierChanged {
                user,
                old_tier,
                new_tier,
                points: profile.points,
            });
        };
    }

    /// Calculate tier based on points
    fun calculate_tier(points: u64): u8 {
        if (points >= TIER_DIAMOND) {
            4  // Diamond
        } else if (points >= TIER_PLATINUM) {
            3  // Platinum
        } else if (points >= TIER_GOLD) {
            2  // Gold
        } else if (points >= TIER_SILVER) {
            1  // Silver
        } else {
            0  // Bronze
        }
    }

    // ===== Test Functions =====

    #[test_only]
    public fun init_for_testing(ctx: &mut TxContext) {
        init(ctx);
    }

    #[test_only]
    public fun get_trade_seller_points(): u64 { TRADE_SELLER_POINTS }

    #[test_only]
    public fun get_trade_buyer_points(): u64 { TRADE_BUYER_POINTS }

    #[test_only]
    public fun get_auction_seller_points(): u64 { AUCTION_SELLER_POINTS }

    #[test_only]
    public fun get_auction_buyer_points(): u64 { AUCTION_BUYER_POINTS }
}
