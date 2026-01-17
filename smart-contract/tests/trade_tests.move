#[test_only]
module suibid::trade_tests {
    use sui::test_scenario::{Self as ts};
    use sui::clock::{Self, Clock};
    use suibid::trade::{Self, Trade};

    // Test NFT struct
    public struct TestNFT has key, store {
        id: UID,
        name: vector<u8>,
        rarity: u8,
    }

    public struct GameSkin has key, store {
        id: UID,
        skin_name: vector<u8>,
        rarity: u8,
    }

    public struct Ticket has key, store {
        id: UID,
        event_name: vector<u8>,
        seat: vector<u8>,
    }

    // Helper function to create a test NFT
    fun create_test_nft(name: vector<u8>, rarity: u8, ctx: &mut TxContext): TestNFT {
        TestNFT {
            id: object::new(ctx),
            name,
            rarity,
        }
    }

    fun create_game_skin(name: vector<u8>, rarity: u8, ctx: &mut TxContext): GameSkin {
        GameSkin {
            id: object::new(ctx),
            skin_name: name,
            rarity,
        }
    }

    fun create_ticket(event: vector<u8>, seat: vector<u8>, ctx: &mut TxContext): Ticket {
        Ticket {
            id: object::new(ctx),
            event_name: event,
            seat,
        }
    }

    // Helper to advance time
    fun advance_time(clock: &mut Clock, ms: u64) {
        clock::increment_for_testing(clock, ms);
    }

    // ===== Test Case 1: Happy Path - Complete Trade Flow =====
    #[test]
    fun test_complete_trade_flow() {
        let seller = @0xA;
        let buyer1 = @0xB;
        let buyer2 = @0xC;

        let mut scenario = ts::begin(seller);
        let mut clock = clock::create_for_testing(ts::ctx(&mut scenario));

        // Seller creates trade
        ts::next_tx(&mut scenario, seller);
        {
            let ctx = ts::ctx(&mut scenario);
            let end_time = clock::timestamp_ms(&clock) + 86400000; // 1 day
            let mut trade = trade::create_trade(end_time, &clock, ctx);

            // Seller adds NFTs
            let nft1 = create_test_nft(b"Legendary Sword", 5, ctx);
            let nft2 = create_test_nft(b"Epic Shield", 4, ctx);
            trade::add_seller_item(&mut trade, nft1, ctx);
            trade::add_seller_item(&mut trade, nft2, ctx);

            transfer::public_transfer(trade, seller);
        };

        // Buyer 1 places offer
        ts::next_tx(&mut scenario, buyer1);
        {
            let mut trade = ts::take_from_address<Trade>(&scenario, seller);
            let ctx = ts::ctx(&mut scenario);

            trade::place_offer(&mut trade, &clock, ctx);
            let skin1 = create_game_skin(b"Dragon Skin", 5, ctx);
            trade::add_buyer_item(&mut trade, 0, skin1, ctx);

            ts::return_to_address(seller, trade);
        };

        // Buyer 2 places offer
        ts::next_tx(&mut scenario, buyer2);
        {
            let mut trade = ts::take_from_address<Trade>(&scenario, seller);
            let ctx = ts::ctx(&mut scenario);

            trade::place_offer(&mut trade, &clock, ctx);
            let ticket1 = create_ticket(b"Concert 2024", b"A1", ctx);
            let ticket2 = create_ticket(b"Festival", b"VIP", ctx);
            trade::add_buyer_item(&mut trade, 1, ticket1, ctx);
            trade::add_buyer_item(&mut trade, 1, ticket2, ctx);

            ts::return_to_address(seller, trade);
        };

        // Seller views all offers
        ts::next_tx(&mut scenario, seller);
        {
            let trade = ts::take_from_sender<Trade>(&scenario);

            // Check offer count
            assert!(trade::offer_count(&trade) == 2, 0);

            // Check buyer1's offer
            assert!(trade::get_offer_buyer(&trade, 0) == buyer1, 1);
            assert!(trade::count_offer_items(&trade, 0) == 1, 2);

            // Check buyer2's offer
            assert!(trade::get_offer_buyer(&trade, 1) == buyer2, 3);
            assert!(trade::count_offer_items(&trade, 1) == 2, 4);

            // Check buyer2's items
            assert!(trade::has_offer_item<Ticket>(&trade, 1, 0), 5);
            assert!(trade::has_offer_item<Ticket>(&trade, 1, 1), 6);

            let ticket_ref = trade::borrow_offer_item<Ticket>(&trade, 1, 0);
            assert!(ticket_ref.event_name == b"Concert 2024", 7);

            ts::return_to_sender(&scenario, trade);
        };

        // Advance time past end_time
        advance_time(&mut clock, 86400001);

        // Seller accepts buyer2's offer
        ts::next_tx(&mut scenario, seller);
        {
            let ctx = ts::ctx(&mut scenario);
            let trade = ts::take_from_sender<Trade>(&scenario);

            trade::accept_offer<TestNFT, Ticket>(trade, 1, &clock, ctx);
        };

        // Verify seller received tickets
        ts::next_tx(&mut scenario, seller);
        {
            assert!(ts::has_most_recent_for_sender<Ticket>(&scenario), 8);
        };

        // Verify buyer2 received NFTs
        ts::next_tx(&mut scenario, buyer2);
        {
            assert!(ts::has_most_recent_for_sender<TestNFT>(&scenario), 9);
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    // ===== Test Case 2: Multiple Offers from Same Buyer =====
    #[test]
    fun test_multiple_offers_same_buyer() {
        let seller = @0xA;
        let buyer = @0xB;

        let mut scenario = ts::begin(seller);
        let mut clock = clock::create_for_testing(ts::ctx(&mut scenario));

        // Seller creates trade
        ts::next_tx(&mut scenario, seller);
        {
            let ctx = ts::ctx(&mut scenario);
            let end_time = clock::timestamp_ms(&clock) + 86400000;
            let mut trade = trade::create_trade(end_time, &clock, ctx);
            let nft1 = create_test_nft(b"Item", 3, ctx);
            trade::add_seller_item(&mut trade, nft1, ctx);
            transfer::public_transfer(trade, seller);
        };

        // Buyer places first offer
        ts::next_tx(&mut scenario, buyer);
        {
            let ctx = ts::ctx(&mut scenario);
            let mut trade = ts::take_from_address<Trade>(&scenario, seller);
            trade::place_offer(&mut trade, &clock, ctx);
            let skin1 = create_game_skin(b"Skin1", 3, ctx);
            trade::add_buyer_item(&mut trade, 0, skin1, ctx);
            ts::return_to_address(seller, trade);
        };

        // Buyer places second offer
        ts::next_tx(&mut scenario, buyer);
        {
            let ctx = ts::ctx(&mut scenario);
            let mut trade = ts::take_from_address<Trade>(&scenario, seller);
            trade::place_offer(&mut trade, &clock, ctx);
            let skin2 = create_game_skin(b"Skin2", 4, ctx);
            trade::add_buyer_item(&mut trade, 1, skin2, ctx);
            ts::return_to_address(seller, trade);
        };

        // Verify multiple offers
        ts::next_tx(&mut scenario, seller);
        {
            let trade = ts::take_from_sender<Trade>(&scenario);
            assert!(trade::offer_count(&trade) == 2, 0);
            assert!(trade::get_offer_buyer(&trade, 0) == buyer, 1);
            assert!(trade::get_offer_buyer(&trade, 1) == buyer, 2);
            ts::return_to_sender(&scenario, trade);
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    // ===== Test Case 3: Buyer Withdraws Offer =====
    #[test]
    fun test_withdraw_offer() {
        let seller = @0xA;
        let buyer = @0xB;

        let mut scenario = ts::begin(seller);
        let mut clock = clock::create_for_testing(ts::ctx(&mut scenario));

        // Setup trade with offer
        ts::next_tx(&mut scenario, seller);
        {
            let ctx = ts::ctx(&mut scenario);
            let end_time = clock::timestamp_ms(&clock) + 86400000;
            let mut trade = trade::create_trade(end_time, &clock, ctx);
            let nft1 = create_test_nft(b"Item", 3, ctx);
            trade::add_seller_item(&mut trade, nft1, ctx);
            transfer::public_transfer(trade, seller);
        };

        ts::next_tx(&mut scenario, buyer);
        {
            let ctx = ts::ctx(&mut scenario);
            let mut trade = ts::take_from_address<Trade>(&scenario, seller);
            trade::place_offer(&mut trade, &clock, ctx);
            let skin1 = create_game_skin(b"Skin", 4, ctx);
            trade::add_buyer_item(&mut trade, 0, skin1, ctx);
            ts::return_to_address(seller, trade);
        };

        // Buyer withdraws offer
        ts::next_tx(&mut scenario, buyer);
        {
            let ctx = ts::ctx(&mut scenario);
            let mut trade = ts::take_from_address<Trade>(&scenario, seller);
            trade::withdraw_offer<GameSkin>(&mut trade, 0, ctx);
            ts::return_to_address(seller, trade);
        };

        // Verify offer removed
        ts::next_tx(&mut scenario, seller);
        {
            let trade = ts::take_from_sender<Trade>(&scenario);
            assert!(!trade::has_offer(&trade, 0), 0);
            ts::return_to_sender(&scenario, trade);
        };

        // Verify buyer received item back
        ts::next_tx(&mut scenario, buyer);
        {
            assert!(ts::has_most_recent_for_sender<GameSkin>(&scenario), 1);
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    // ===== Test Case 4: Seller Cancels Trade =====
    #[test]
    fun test_cancel_trade() {
        let seller = @0xA;
        let buyer1 = @0xB;
        let buyer2 = @0xC;

        let mut scenario = ts::begin(seller);
        let mut clock = clock::create_for_testing(ts::ctx(&mut scenario));

        // Setup trade with multiple offers
        ts::next_tx(&mut scenario, seller);
        {
            let ctx = ts::ctx(&mut scenario);
            let end_time = clock::timestamp_ms(&clock) + 86400000;
            let mut trade = trade::create_trade(end_time, &clock, ctx);
            let nft1 = create_test_nft(b"Item1", 3, ctx);
            let nft2 = create_test_nft(b"Item2", 4, ctx);
            trade::add_seller_item(&mut trade, nft1, ctx);
            trade::add_seller_item(&mut trade, nft2, ctx);
            transfer::public_transfer(trade, seller);
        };

        ts::next_tx(&mut scenario, buyer1);
        {
            let ctx = ts::ctx(&mut scenario);
            let mut trade = ts::take_from_address<Trade>(&scenario, seller);
            trade::place_offer(&mut trade, &clock, ctx);
            let skin1 = create_game_skin(b"Skin1", 4, ctx);
            trade::add_buyer_item(&mut trade, 0, skin1, ctx);
            ts::return_to_address(seller, trade);
        };

        ts::next_tx(&mut scenario, buyer2);
        {
            let ctx = ts::ctx(&mut scenario);
            let mut trade = ts::take_from_address<Trade>(&scenario, seller);
            trade::place_offer(&mut trade, &clock, ctx);
            let ticket1 = create_ticket(b"Event", b"A1", ctx);
            trade::add_buyer_item(&mut trade, 1, ticket1, ctx);
            ts::return_to_address(seller, trade);
        };

        // Seller cancels trade
        ts::next_tx(&mut scenario, seller);
        {
            let ctx = ts::ctx(&mut scenario);
            let trade = ts::take_from_sender<Trade>(&scenario);
            trade::cancel_trade<TestNFT, GameSkin>(trade, ctx);
        };

        // Verify seller got items back
        ts::next_tx(&mut scenario, seller);
        {
            assert!(ts::has_most_recent_for_sender<TestNFT>(&scenario), 0);
        };

        // Verify buyer1 got items back
        ts::next_tx(&mut scenario, buyer1);
        {
            assert!(ts::has_most_recent_for_sender<GameSkin>(&scenario), 1);
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    // ===== Test Case 5: Error - Place Offer After Expiration =====
    #[test]
    #[expected_failure(abort_code = trade::ETradeExpired)]
    fun test_error_offer_after_expiration() {
        let seller = @0xA;
        let buyer = @0xB;

        let mut scenario = ts::begin(seller);
        let mut clock = clock::create_for_testing(ts::ctx(&mut scenario));

        ts::next_tx(&mut scenario, seller);
        {
            let ctx = ts::ctx(&mut scenario);
            let end_time = clock::timestamp_ms(&clock) + 1000;
            let trade = trade::create_trade(end_time, &clock, ctx);
            transfer::public_transfer(trade, seller);
        };

        // Advance time past expiration
        advance_time(&mut clock, 2000);

        // Try to place offer - should fail
        ts::next_tx(&mut scenario, buyer);
        {
            let ctx = ts::ctx(&mut scenario);
            let mut trade = ts::take_from_address<Trade>(&scenario, seller);
            trade::place_offer(&mut trade, &clock, ctx); // Should abort
            ts::return_to_address(seller, trade);
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    // ===== Test Case 6: Error - Accept Offer Before Expiration =====
    #[test]
    #[expected_failure(abort_code = trade::ETradeNotExpired)]
    fun test_error_accept_before_expiration() {
        let seller = @0xA;
        let buyer = @0xB;

        let mut scenario = ts::begin(seller);
        let mut clock = clock::create_for_testing(ts::ctx(&mut scenario));

        ts::next_tx(&mut scenario, seller);
        {
            let ctx = ts::ctx(&mut scenario);
            let end_time = clock::timestamp_ms(&clock) + 86400000;
            let mut trade = trade::create_trade(end_time, &clock, ctx);
            let nft1 = create_test_nft(b"Item", 3, ctx);
            trade::add_seller_item(&mut trade, nft1, ctx);
            transfer::public_transfer(trade, seller);
        };

        ts::next_tx(&mut scenario, buyer);
        {
            let ctx = ts::ctx(&mut scenario);
            let mut trade = ts::take_from_address<Trade>(&scenario, seller);
            trade::place_offer(&mut trade, &clock, ctx);
            let skin1 = create_game_skin(b"Skin", 4, ctx);
            trade::add_buyer_item(&mut trade, 0, skin1, ctx);
            ts::return_to_address(seller, trade);
        };

        // Try to accept before expiration - should fail
        ts::next_tx(&mut scenario, seller);
        {
            let ctx = ts::ctx(&mut scenario);
            let trade = ts::take_from_sender<Trade>(&scenario);
            trade::accept_offer<TestNFT, GameSkin>(trade, 0, &clock, ctx); // Should abort
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    // ===== Test Case 7: Error - Non-seller Tries to Accept Offer =====
    #[test]
    #[expected_failure(abort_code = trade::ENotSeller)]
    fun test_error_non_seller_accept() {
        let seller = @0xA;
        let buyer = @0xB;
        let attacker = @0xD;

        let mut scenario = ts::begin(seller);
        let mut clock = clock::create_for_testing(ts::ctx(&mut scenario));

        ts::next_tx(&mut scenario, seller);
        {
            let ctx = ts::ctx(&mut scenario);
            let end_time = clock::timestamp_ms(&clock) + 1000;
            let mut trade = trade::create_trade(end_time, &clock, ctx);
            let nft1 = create_test_nft(b"Item", 3, ctx);
            trade::add_seller_item(&mut trade, nft1, ctx);
            transfer::public_transfer(trade, seller);
        };

        ts::next_tx(&mut scenario, buyer);
        {
            let ctx = ts::ctx(&mut scenario);
            let mut trade = ts::take_from_address<Trade>(&scenario, seller);
            trade::place_offer(&mut trade, &clock, ctx);
            let skin1 = create_game_skin(b"Skin", 4, ctx);
            trade::add_buyer_item(&mut trade, 0, skin1, ctx);
            ts::return_to_address(seller, trade);
        };

        advance_time(&mut clock, 2000);

        // Attacker tries to accept - should fail
        ts::next_tx(&mut scenario, attacker);
        {
            let ctx = ts::ctx(&mut scenario);
            let trade = ts::take_from_address<Trade>(&scenario, seller);
            trade::accept_offer<TestNFT, GameSkin>(trade, 0, &clock, ctx); // Should abort
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    // ===== Test Case 8: Error - Non-buyer Tries to Withdraw Offer =====
    #[test]
    #[expected_failure(abort_code = trade::ENotBuyer)]
    fun test_error_non_buyer_withdraw() {
        let seller = @0xA;
        let buyer = @0xB;
        let attacker = @0xD;

        let mut scenario = ts::begin(seller);
        let mut clock = clock::create_for_testing(ts::ctx(&mut scenario));

        ts::next_tx(&mut scenario, seller);
        {
            let ctx = ts::ctx(&mut scenario);
            let end_time = clock::timestamp_ms(&clock) + 86400000;
            let mut trade = trade::create_trade(end_time, &clock, ctx);
            let nft1 = create_test_nft(b"Item", 3, ctx);
            trade::add_seller_item(&mut trade, nft1, ctx);
            transfer::public_transfer(trade, seller);
        };

        ts::next_tx(&mut scenario, buyer);
        {
            let ctx = ts::ctx(&mut scenario);
            let mut trade = ts::take_from_address<Trade>(&scenario, seller);
            trade::place_offer(&mut trade, &clock, ctx);
            let skin1 = create_game_skin(b"Skin", 4, ctx);
            trade::add_buyer_item(&mut trade, 0, skin1, ctx);
            ts::return_to_address(seller, trade);
        };

        // Attacker tries to withdraw buyer's offer - should fail
        ts::next_tx(&mut scenario, attacker);
        {
            let ctx = ts::ctx(&mut scenario);
            let mut trade = ts::take_from_address<Trade>(&scenario, seller);
            trade::withdraw_offer<GameSkin>(&mut trade, 0, ctx); // Should abort
            ts::return_to_address(seller, trade);
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    // ===== Test Case 9: Error - Add Item to Non-existent Offer =====
    #[test]
    #[expected_failure(abort_code = trade::EInvalidOffer)]
    fun test_error_add_item_invalid_offer() {
        let seller = @0xA;
        let buyer = @0xB;

        let mut scenario = ts::begin(seller);
        let mut clock = clock::create_for_testing(ts::ctx(&mut scenario));

        ts::next_tx(&mut scenario, seller);
        {
            let ctx = ts::ctx(&mut scenario);
            let end_time = clock::timestamp_ms(&clock) + 86400000;
            let trade = trade::create_trade(end_time, &clock, ctx);
            transfer::public_transfer(trade, seller);
        };

        // Try to add item to non-existent offer - should fail
        ts::next_tx(&mut scenario, buyer);
        {
            let ctx = ts::ctx(&mut scenario);
            let mut trade = ts::take_from_address<Trade>(&scenario, seller);
            let skin1 = create_game_skin(b"Skin", 4, ctx);
            trade::add_buyer_item(&mut trade, 999, skin1, ctx); // Should abort
            ts::return_to_address(seller, trade);
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    // ===== Test Case 10: Edge Case - Empty Trade (No Items) =====
    #[test]
    fun test_empty_trade() {
        let seller = @0xA;
        let buyer = @0xB;

        let mut scenario = ts::begin(seller);
        let mut clock = clock::create_for_testing(ts::ctx(&mut scenario));

        // Create trade with no items
        ts::next_tx(&mut scenario, seller);
        {
            let ctx = ts::ctx(&mut scenario);
            let end_time = clock::timestamp_ms(&clock) + 86400000;
            let trade = trade::create_trade(end_time, &clock, ctx);
            assert!(trade::count_seller_trade_items(&trade) == 0, 0);
            transfer::public_transfer(trade, seller);
        };

        // Buyer places empty offer
        ts::next_tx(&mut scenario, buyer);
        {
            let ctx = ts::ctx(&mut scenario);
            let mut trade = ts::take_from_address<Trade>(&scenario, seller);
            trade::place_offer(&mut trade, &clock, ctx);
            assert!(trade::count_offer_items(&trade, 0) == 0, 1);
            ts::return_to_address(seller, trade);
        };

        advance_time(&mut clock, 86400001);

        // Accept empty offer
        ts::next_tx(&mut scenario, seller);
        {
            let ctx = ts::ctx(&mut scenario);
            let trade = ts::take_from_sender<Trade>(&scenario);
            trade::accept_offer<TestNFT, GameSkin>(trade, 0, &clock, ctx);
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    // ===== Test Case 11: View Functions =====
    #[test]
    fun test_view_functions() {
        let seller = @0xA;
        let buyer = @0xB;

        let mut scenario = ts::begin(seller);
        let mut clock = clock::create_for_testing(ts::ctx(&mut scenario));

        ts::next_tx(&mut scenario, seller);
        {
            let ctx = ts::ctx(&mut scenario);
            let end_time = clock::timestamp_ms(&clock) + 86400000;
            let mut trade = trade::create_trade(end_time, &clock, ctx);

            // Test view functions
            assert!(trade::seller(&trade) == seller, 0);
            assert!(trade::end_time(&trade) == clock::timestamp_ms(&clock) + 86400000, 1);
            assert!(trade::is_active(&trade) == true, 2);
            assert!(trade::offer_count(&trade) == 0, 3);

            let nft1 = create_test_nft(b"Item", 5, ctx);
            trade::add_seller_item(&mut trade, nft1, ctx);
            assert!(trade::count_seller_trade_items(&trade) == 1, 4);
            assert!(trade::has_seller_item<TestNFT>(&trade, 0), 5);

            let nft_ref = trade::borrow_seller_item<TestNFT>(&trade, 0);
            assert!(nft_ref.name == b"Item", 6);
            assert!(nft_ref.rarity == 5, 7);

            transfer::public_transfer(trade, seller);
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }
}
