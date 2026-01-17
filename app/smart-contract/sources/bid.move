#[allow(duplicate_alias, lint(public_entry))]
module suibid::auction {
    // ──────────────────────────────────────────────
    // Imports
    // ──────────────────────────────────────────────
    use sui::clock::{Self, Clock};
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use sui::event;
    use sui::balance::{Self, Balance};
    use sui::table::{Self, Table};

    // ──────────────────────────────────────────────
    // Error codes
    // ──────────────────────────────────────────────
    const E_AUCTION_NOT_ACTIVE: u64 = 0;
    const E_BID_TOO_LOW: u64 = 1;
    const E_AUCTION_ENDED: u64 = 2;
    const E_NOT_WINNER: u64 = 3;
    const E_NOT_SELLER: u64 = 4;
    const E_NO_POSITION: u64 = 5;
    const E_AUCTION_STILL_ACTIVE: u64 = 6;
    const E_IS_WINNER: u64 = 7;

    // ──────────────────────────────────────────────
    // Events
    // ──────────────────────────────────────────────
    public struct AuctionCreated has copy, drop {
        auction_id: ID,
        seller: address,
        min_bid: u64,
        end_time: u64,
    }

    public struct BidPlaced has copy, drop {
        auction_id: ID,
        bidder: address,
        bid_amount: u64,
        total_position: u64,
    }

    public struct AuctionEnded has copy, drop {
        auction_id: ID,
        winner: Option<address>,
        final_bid: u64,
    }

    public struct Withdrawn has copy, drop {
        auction_id: ID,
        bidder: address,
        amount: u64,
    }

    // ──────────────────────────────────────────────
    // Core shared Auction object
    // ──────────────────────────────────────────────
    public struct Auction<Item: key + store> has key {
        id: UID,
        item: Option<Item>,             // Wrapped in Option to allow extraction
        seller: address,
        min_bid: u64,
        highest_bid: u64,               // Current highest position value
        highest_bidder: Option<address>,
        end_time: u64,
        active: bool,
        total_balance: Balance<SUI>,    // Holds ALL staked bids
        positions: Table<address, u64>, // Each user's total staked amount
    }

    // ──────────────────────────────────────────────
    // Create auction (called by seller)
    // ──────────────────────────────────────────────
    public entry fun create_auction<Item: key + store>(
        item: Item,
        min_bid: u64,
        duration_ms: u64,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        let sender = tx_context::sender(ctx);
        let end_time = clock::timestamp_ms(clock) + duration_ms;

        let auction = Auction<Item> {
            id: object::new(ctx),
            item: option::some(item),
            seller: sender,
            min_bid,
            highest_bid: 0,
            highest_bidder: option::none(),
            end_time,
            active: true,
            total_balance: balance::zero<SUI>(),
            positions: table::new(ctx),
        };

        event::emit(AuctionCreated {
            auction_id: object::id(&auction),
            seller: sender,
            min_bid,
            end_time,
        });

        transfer::share_object(auction);
    }

    // ──────────────────────────────────────────────
    // Place bid - accumulates into user's position
    // ──────────────────────────────────────────────
    public entry fun place_bid<Item: key + store>(
        auction: &mut Auction<Item>,
        bid_coin: Coin<SUI>,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        let sender = tx_context::sender(ctx);
        let current_time = clock::timestamp_ms(clock);

        // Validate auction state
        assert!(auction.active, E_AUCTION_NOT_ACTIVE);
        assert!(current_time < auction.end_time, E_AUCTION_ENDED);

        let bid_amount = coin::value(&bid_coin);

        // Get current position or 0 if new bidder
        let current_position = if (table::contains(&auction.positions, sender)) {
            *table::borrow(&auction.positions, sender)
        } else {
            0
        };

        // Calculate new total position after this bid
        let new_position = current_position + bid_amount;

        // New position must be higher than current highest bid
        let required_min = if (auction.highest_bid == 0) {
            auction.min_bid
        } else {
            auction.highest_bid + 1
        };

        assert!(new_position >= required_min, E_BID_TOO_LOW);

        // Add coin to total balance
        balance::join(&mut auction.total_balance, coin::into_balance(bid_coin));

        // Update or create position
        if (table::contains(&auction.positions, sender)) {
            let position = table::borrow_mut(&mut auction.positions, sender);
            *position = new_position;
        } else {
            table::add(&mut auction.positions, sender, new_position);
        };

        // Update highest bid and bidder
        auction.highest_bid = new_position;
        auction.highest_bidder = option::some(sender);

        event::emit(BidPlaced {
            auction_id: object::id(auction),
            bidder: sender,
            bid_amount,
            total_position: new_position,
        });
    }

    // ──────────────────────────────────────────────
    // End auction
    // ──────────────────────────────────────────────
    public entry fun end_auction<Item: key + store>(
        auction: &mut Auction<Item>,
        clock: &Clock,
        _ctx: &mut TxContext,
    ) {
        let current_time = clock::timestamp_ms(clock);
        assert!(current_time >= auction.end_time, E_AUCTION_STILL_ACTIVE);
        assert!(auction.active, E_AUCTION_NOT_ACTIVE);

        auction.active = false;

        event::emit(AuctionEnded {
            auction_id: object::id(auction),
            winner: auction.highest_bidder,
            final_bid: auction.highest_bid,
        });
    }

    // ──────────────────────────────────────────────
    // Claim - Winner gets item, Seller gets winner's position
    // ──────────────────────────────────────────────
    public entry fun claim<Item: key + store>(
        auction: &mut Auction<Item>,
        ctx: &mut TxContext,
    ) {
        let sender = tx_context::sender(ctx);
        assert!(!auction.active, E_AUCTION_STILL_ACTIVE);

        if (option::is_some(&auction.highest_bidder)) {
            let winner = *option::borrow(&auction.highest_bidder);
            assert!(sender == winner, E_NOT_WINNER);

            // Transfer item to winner
            let item = option::extract(&mut auction.item);
            transfer::public_transfer(item, winner);

            // Transfer winner's position amount to seller
            let winner_position = *table::borrow(&auction.positions, winner);
            let payment = coin::from_balance(
                balance::split(&mut auction.total_balance, winner_position),
                ctx
            );
            transfer::public_transfer(payment, auction.seller);

            // Remove winner's position (they can't withdraw)
            table::remove(&mut auction.positions, winner);
        } else {
            // No bids → seller reclaims item
            assert!(sender == auction.seller, E_NOT_SELLER);
            let item = option::extract(&mut auction.item);
            transfer::public_transfer(item, auction.seller);
        };
    }

    // ──────────────────────────────────────────────
    // Withdraw - Non-winners can withdraw their position after auction ends
    // ──────────────────────────────────────────────
    public entry fun withdraw<Item: key + store>(
        auction: &mut Auction<Item>,
        ctx: &mut TxContext,
    ) {
        let sender = tx_context::sender(ctx);

        // Must be ended
        assert!(!auction.active, E_AUCTION_STILL_ACTIVE);

        // Must not be winner
        if (option::is_some(&auction.highest_bidder)) {
            let winner = *option::borrow(&auction.highest_bidder);
            assert!(sender != winner, E_IS_WINNER);
        };

        // Must have a position
        assert!(table::contains(&auction.positions, sender), E_NO_POSITION);

        // Get and remove position
        let position_amount = table::remove(&mut auction.positions, sender);

        // Transfer back to bidder
        let refund = coin::from_balance(
            balance::split(&mut auction.total_balance, position_amount),
            ctx
        );
        transfer::public_transfer(refund, sender);

        event::emit(Withdrawn {
            auction_id: object::id(auction),
            bidder: sender,
            amount: position_amount,
        });
    }

    // ──────────────────────────────────────────────
    // View functions
    // ──────────────────────────────────────────────
    public fun highest_bid<Item: key + store>(auction: &Auction<Item>): u64 {
        auction.highest_bid
    }

    public fun highest_bidder<Item: key + store>(auction: &Auction<Item>): Option<address> {
        auction.highest_bidder
    }

    public fun is_active<Item: key + store>(auction: &Auction<Item>): bool {
        auction.active
    }

    public fun get_position<Item: key + store>(auction: &Auction<Item>, bidder: address): u64 {
        if (table::contains(&auction.positions, bidder)) {
            *table::borrow(&auction.positions, bidder)
        } else {
            0
        }
    }

    public fun min_bid<Item: key + store>(auction: &Auction<Item>): u64 {
        auction.min_bid
    }

    public fun end_time<Item: key + store>(auction: &Auction<Item>): u64 {
        auction.end_time
    }
}
