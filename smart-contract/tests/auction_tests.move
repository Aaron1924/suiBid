#[test_only]
module suibid::auction_tests {
    use sui::test_scenario::{Self as ts};
    use sui::clock::{Self, Clock};
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;

    use suibid::auction::{Self, Auction};

    // ══════════════════════════════════════════════════════════════
    // Test NFT
    // ══════════════════════════════════════════════════════════════
    public struct TestNFT has key, store {
        id: UID,
        name: vector<u8>,
    }

    fun create_test_nft(ctx: &mut TxContext): TestNFT {
        TestNFT {
            id: object::new(ctx),
            name: b"Test Item",
        }
    }

    fun mint_sui(amount: u64, ctx: &mut TxContext): Coin<SUI> {
        coin::mint_for_testing<SUI>(amount, ctx)
    }

    // ══════════════════════════════════════════════════════════════
    // Test 1: Create auction
    // ══════════════════════════════════════════════════════════════
    #[test]
    fun test_create_auction() {
        let seller = @0xSELLER;
        let mut scenario = ts::begin(seller);

        // Create clock
        ts::next_tx(&mut scenario, seller);
        {
            let clock = clock::create_for_testing(ts::ctx(&mut scenario));
            clock::share_for_testing(clock);
        };

        // Seller creates auction
        ts::next_tx(&mut scenario, seller);
        {
            let clock = ts::take_shared<Clock>(&scenario);
            let nft = create_test_nft(ts::ctx(&mut scenario));

            auction::create_auction(
                nft,
                100_000_000, // min_bid: 0.1 SUI
                86400000,    // duration: 1 day
                &clock,
                ts::ctx(&mut scenario)
            );

            ts::return_shared(clock);
        };

        // Verify auction
        ts::next_tx(&mut scenario, seller);
        {
            let auction = ts::take_shared<Auction<TestNFT>>(&scenario);
            assert!(auction::is_active(&auction) == true);
            assert!(auction::highest_bid(&auction) == 0);
            assert!(auction::min_bid(&auction) == 100_000_000);
            ts::return_shared(auction);
        };

        ts::end(scenario);
    }

    // ══════════════════════════════════════════════════════════════
    // Test 2: Place first bid
    // ══════════════════════════════════════════════════════════════
    #[test]
    fun test_place_first_bid() {
        let seller = @0xSELLER;
        let bidder_a = @0xBIDDER_A;
        let mut scenario = ts::begin(seller);

        // Setup
        ts::next_tx(&mut scenario, seller);
        {
            let clock = clock::create_for_testing(ts::ctx(&mut scenario));
            clock::share_for_testing(clock);
        };

        ts::next_tx(&mut scenario, seller);
        {
            let clock = ts::take_shared<Clock>(&scenario);
            let nft = create_test_nft(ts::ctx(&mut scenario));
            auction::create_auction(nft, 100, 86400000, &clock, ts::ctx(&mut scenario));
            ts::return_shared(clock);
        };

        // Bidder A places first bid
        ts::next_tx(&mut scenario, bidder_a);
        {
            let mut auction = ts::take_shared<Auction<TestNFT>>(&scenario);
            let clock = ts::take_shared<Clock>(&scenario);
            let bid_coin = mint_sui(100, ts::ctx(&mut scenario));

            auction::place_bid(&mut auction, bid_coin, &clock, ts::ctx(&mut scenario));

            assert!(auction::highest_bid(&auction) == 100);
            assert!(auction::get_position(&auction, bidder_a) == 100);

            ts::return_shared(auction);
            ts::return_shared(clock);
        };

        ts::end(scenario);
    }

    // ══════════════════════════════════════════════════════════════
    // Test 3: Accumulating positions - MAIN FLOW
    // User A bids 100 → User B bids 150 → User A adds 60 (total 160)
    // ══════════════════════════════════════════════════════════════
    #[test]
    fun test_accumulating_positions() {
        let seller = @0xSELLER;
        let bidder_a = @0xBIDDER_A;
        let bidder_b = @0xBIDDER_B;
        let mut scenario = ts::begin(seller);

        // Setup
        ts::next_tx(&mut scenario, seller);
        {
            let clock = clock::create_for_testing(ts::ctx(&mut scenario));
            clock::share_for_testing(clock);
        };

        ts::next_tx(&mut scenario, seller);
        {
            let clock = ts::take_shared<Clock>(&scenario);
            let nft = create_test_nft(ts::ctx(&mut scenario));
            auction::create_auction(nft, 100, 86400000, &clock, ts::ctx(&mut scenario));
            ts::return_shared(clock);
        };

        // ─── User A bids 100 ───
        ts::next_tx(&mut scenario, bidder_a);
        {
            let mut auction = ts::take_shared<Auction<TestNFT>>(&scenario);
            let clock = ts::take_shared<Clock>(&scenario);
            let bid_coin = mint_sui(100, ts::ctx(&mut scenario));

            auction::place_bid(&mut auction, bid_coin, &clock, ts::ctx(&mut scenario));

            assert!(auction::highest_bid(&auction) == 100);
            assert!(auction::get_position(&auction, bidder_a) == 100);

            ts::return_shared(auction);
            ts::return_shared(clock);
        };

        // ─── User B bids 150 → becomes highest ───
        ts::next_tx(&mut scenario, bidder_b);
        {
            let mut auction = ts::take_shared<Auction<TestNFT>>(&scenario);
            let clock = ts::take_shared<Clock>(&scenario);
            let bid_coin = mint_sui(150, ts::ctx(&mut scenario));

            auction::place_bid(&mut auction, bid_coin, &clock, ts::ctx(&mut scenario));

            assert!(auction::highest_bid(&auction) == 150);
            assert!(auction::get_position(&auction, bidder_b) == 150);
            // A's position still exists (NOT refunded!)
            assert!(auction::get_position(&auction, bidder_a) == 100);

            ts::return_shared(auction);
            ts::return_shared(clock);
        };

        // ─── User A adds 60 more → total 160 → becomes highest again ───
        ts::next_tx(&mut scenario, bidder_a);
        {
            let mut auction = ts::take_shared<Auction<TestNFT>>(&scenario);
            let clock = ts::take_shared<Clock>(&scenario);
            let bid_coin = mint_sui(60, ts::ctx(&mut scenario));

            auction::place_bid(&mut auction, bid_coin, &clock, ts::ctx(&mut scenario));

            assert!(auction::highest_bid(&auction) == 160);
            assert!(auction::get_position(&auction, bidder_a) == 160);
            // B's position unchanged
            assert!(auction::get_position(&auction, bidder_b) == 150);

            ts::return_shared(auction);
            ts::return_shared(clock);
        };

        ts::end(scenario);
    }

    // ══════════════════════════════════════════════════════════════
    // Test 4: End auction and winner claims
    // ══════════════════════════════════════════════════════════════
    #[test]
    fun test_end_auction_and_claim() {
        let seller = @0xSELLER;
        let winner = @0xWINNER;
        let mut scenario = ts::begin(seller);

        // Setup
        ts::next_tx(&mut scenario, seller);
        {
            let clock = clock::create_for_testing(ts::ctx(&mut scenario));
            clock::share_for_testing(clock);
        };

        ts::next_tx(&mut scenario, seller);
        {
            let clock = ts::take_shared<Clock>(&scenario);
            let nft = create_test_nft(ts::ctx(&mut scenario));
            auction::create_auction(nft, 100, 1000, &clock, ts::ctx(&mut scenario));
            ts::return_shared(clock);
        };

        // Winner bids
        ts::next_tx(&mut scenario, winner);
        {
            let mut auction = ts::take_shared<Auction<TestNFT>>(&scenario);
            let clock = ts::take_shared<Clock>(&scenario);
            let bid_coin = mint_sui(500, ts::ctx(&mut scenario));
            auction::place_bid(&mut auction, bid_coin, &clock, ts::ctx(&mut scenario));
            ts::return_shared(auction);
            ts::return_shared(clock);
        };

        // End auction (advance time)
        ts::next_tx(&mut scenario, seller);
        {
            let mut auction = ts::take_shared<Auction<TestNFT>>(&scenario);
            let mut clock = ts::take_shared<Clock>(&scenario);
            clock::increment_for_testing(&mut clock, 2000);
            auction::end_auction(&mut auction, &clock, ts::ctx(&mut scenario));
            assert!(auction::is_active(&auction) == false);
            ts::return_shared(auction);
            ts::return_shared(clock);
        };

        // Winner claims
        ts::next_tx(&mut scenario, winner);
        {
            let mut auction = ts::take_shared<Auction<TestNFT>>(&scenario);
            auction::claim(&mut auction, ts::ctx(&mut scenario));
            ts::return_shared(auction);
        };

        // Verify winner received NFT
        ts::next_tx(&mut scenario, winner);
        {
            assert!(ts::has_most_recent_for_address<TestNFT>(winner));
        };

        // Verify seller received payment
        ts::next_tx(&mut scenario, seller);
        {
            assert!(ts::has_most_recent_for_address<Coin<SUI>>(seller));
        };

        ts::end(scenario);
    }

    // ══════════════════════════════════════════════════════════════
    // Test 5: Loser withdraws position after auction ends
    // ══════════════════════════════════════════════════════════════
    #[test]
    fun test_loser_withdraw() {
        let seller = @0xSELLER;
        let winner = @0xWINNER;
        let loser = @0xLOSER;
        let mut scenario = ts::begin(seller);

        // Setup
        ts::next_tx(&mut scenario, seller);
        {
            let clock = clock::create_for_testing(ts::ctx(&mut scenario));
            clock::share_for_testing(clock);
        };

        ts::next_tx(&mut scenario, seller);
        {
            let clock = ts::take_shared<Clock>(&scenario);
            let nft = create_test_nft(ts::ctx(&mut scenario));
            auction::create_auction(nft, 100, 1000, &clock, ts::ctx(&mut scenario));
            ts::return_shared(clock);
        };

        // Loser bids 100
        ts::next_tx(&mut scenario, loser);
        {
            let mut auction = ts::take_shared<Auction<TestNFT>>(&scenario);
            let clock = ts::take_shared<Clock>(&scenario);
            let bid_coin = mint_sui(100, ts::ctx(&mut scenario));
            auction::place_bid(&mut auction, bid_coin, &clock, ts::ctx(&mut scenario));
            ts::return_shared(auction);
            ts::return_shared(clock);
        };

        // Winner bids 200
        ts::next_tx(&mut scenario, winner);
        {
            let mut auction = ts::take_shared<Auction<TestNFT>>(&scenario);
            let clock = ts::take_shared<Clock>(&scenario);
            let bid_coin = mint_sui(200, ts::ctx(&mut scenario));
            auction::place_bid(&mut auction, bid_coin, &clock, ts::ctx(&mut scenario));
            ts::return_shared(auction);
            ts::return_shared(clock);
        };

        // End auction
        ts::next_tx(&mut scenario, seller);
        {
            let mut auction = ts::take_shared<Auction<TestNFT>>(&scenario);
            let mut clock = ts::take_shared<Clock>(&scenario);
            clock::increment_for_testing(&mut clock, 2000);
            auction::end_auction(&mut auction, &clock, ts::ctx(&mut scenario));
            ts::return_shared(auction);
            ts::return_shared(clock);
        };

        // Winner claims
        ts::next_tx(&mut scenario, winner);
        {
            let mut auction = ts::take_shared<Auction<TestNFT>>(&scenario);
            auction::claim(&mut auction, ts::ctx(&mut scenario));
            ts::return_shared(auction);
        };

        // Loser withdraws
        ts::next_tx(&mut scenario, loser);
        {
            let mut auction = ts::take_shared<Auction<TestNFT>>(&scenario);
            assert!(auction::get_position(&auction, loser) == 100);
            auction::withdraw(&mut auction, ts::ctx(&mut scenario));
            assert!(auction::get_position(&auction, loser) == 0);
            ts::return_shared(auction);
        };

        // Verify loser got coins back
        ts::next_tx(&mut scenario, loser);
        {
            assert!(ts::has_most_recent_for_address<Coin<SUI>>(loser));
        };

        ts::end(scenario);
    }

    // ══════════════════════════════════════════════════════════════
    // Test 6: Bid too low should fail
    // ══════════════════════════════════════════════════════════════
    #[test]
    #[expected_failure(abort_code = auction::E_BID_TOO_LOW)]
    fun test_bid_too_low() {
        let seller = @0xSELLER;
        let bidder = @0xBIDDER;
        let mut scenario = ts::begin(seller);

        // Setup
        ts::next_tx(&mut scenario, seller);
        {
            let clock = clock::create_for_testing(ts::ctx(&mut scenario));
            clock::share_for_testing(clock);
        };

        ts::next_tx(&mut scenario, seller);
        {
            let clock = ts::take_shared<Clock>(&scenario);
            let nft = create_test_nft(ts::ctx(&mut scenario));
            auction::create_auction(nft, 100, 86400000, &clock, ts::ctx(&mut scenario));
            ts::return_shared(clock);
        };

        // Bid below min_bid
        ts::next_tx(&mut scenario, bidder);
        {
            let mut auction = ts::take_shared<Auction<TestNFT>>(&scenario);
            let clock = ts::take_shared<Clock>(&scenario);
            let bid_coin = mint_sui(50, ts::ctx(&mut scenario)); // Below min 100

            auction::place_bid(&mut auction, bid_coin, &clock, ts::ctx(&mut scenario));

            ts::return_shared(auction);
            ts::return_shared(clock);
        };

        ts::end(scenario);
    }

    // ══════════════════════════════════════════════════════════════
    // Test 7: Cannot bid after end time
    // ══════════════════════════════════════════════════════════════
    #[test]
    #[expected_failure(abort_code = auction::E_AUCTION_ENDED)]
    fun test_cannot_bid_after_end_time() {
        let seller = @0xSELLER;
        let bidder = @0xBIDDER;
        let mut scenario = ts::begin(seller);

        // Setup
        ts::next_tx(&mut scenario, seller);
        {
            let clock = clock::create_for_testing(ts::ctx(&mut scenario));
            clock::share_for_testing(clock);
        };

        ts::next_tx(&mut scenario, seller);
        {
            let clock = ts::take_shared<Clock>(&scenario);
            let nft = create_test_nft(ts::ctx(&mut scenario));
            auction::create_auction(nft, 100, 1000, &clock, ts::ctx(&mut scenario));
            ts::return_shared(clock);
        };

        // Try bid after time expired
        ts::next_tx(&mut scenario, bidder);
        {
            let mut auction = ts::take_shared<Auction<TestNFT>>(&scenario);
            let mut clock = ts::take_shared<Clock>(&scenario);
            clock::increment_for_testing(&mut clock, 2000);

            let bid_coin = mint_sui(100, ts::ctx(&mut scenario));
            auction::place_bid(&mut auction, bid_coin, &clock, ts::ctx(&mut scenario));

            ts::return_shared(auction);
            ts::return_shared(clock);
        };

        ts::end(scenario);
    }

    // ══════════════════════════════════════════════════════════════
    // Test 8: Winner cannot withdraw (must claim instead)
    // ══════════════════════════════════════════════════════════════
    #[test]
    #[expected_failure(abort_code = auction::E_IS_WINNER)]
    fun test_winner_cannot_withdraw() {
        let seller = @0xSELLER;
        let winner = @0xWINNER;
        let mut scenario = ts::begin(seller);

        // Setup
        ts::next_tx(&mut scenario, seller);
        {
            let clock = clock::create_for_testing(ts::ctx(&mut scenario));
            clock::share_for_testing(clock);
        };

        ts::next_tx(&mut scenario, seller);
        {
            let clock = ts::take_shared<Clock>(&scenario);
            let nft = create_test_nft(ts::ctx(&mut scenario));
            auction::create_auction(nft, 100, 1000, &clock, ts::ctx(&mut scenario));
            ts::return_shared(clock);
        };

        // Winner bids
        ts::next_tx(&mut scenario, winner);
        {
            let mut auction = ts::take_shared<Auction<TestNFT>>(&scenario);
            let clock = ts::take_shared<Clock>(&scenario);
            let bid_coin = mint_sui(100, ts::ctx(&mut scenario));
            auction::place_bid(&mut auction, bid_coin, &clock, ts::ctx(&mut scenario));
            ts::return_shared(auction);
            ts::return_shared(clock);
        };

        // End auction
        ts::next_tx(&mut scenario, seller);
        {
            let mut auction = ts::take_shared<Auction<TestNFT>>(&scenario);
            let mut clock = ts::take_shared<Clock>(&scenario);
            clock::increment_for_testing(&mut clock, 2000);
            auction::end_auction(&mut auction, &clock, ts::ctx(&mut scenario));
            ts::return_shared(auction);
            ts::return_shared(clock);
        };

        // Winner tries withdraw (should fail)
        ts::next_tx(&mut scenario, winner);
        {
            let mut auction = ts::take_shared<Auction<TestNFT>>(&scenario);
            auction::withdraw(&mut auction, ts::ctx(&mut scenario));
            ts::return_shared(auction);
        };

        ts::end(scenario);
    }

    // ══════════════════════════════════════════════════════════════
    // Test 9: Cannot bid on inactive auction (after ended)
    // ══════════════════════════════════════════════════════════════
    #[test]
    #[expected_failure(abort_code = auction::E_AUCTION_NOT_ACTIVE)]
    fun test_cannot_bid_on_inactive_auction() {
        let seller = @0xSELLER;
        let bidder_a = @0xBIDDER_A;
        let bidder_b = @0xBIDDER_B;
        let mut scenario = ts::begin(seller);

        // Setup
        ts::next_tx(&mut scenario, seller);
        {
            let clock = clock::create_for_testing(ts::ctx(&mut scenario));
            clock::share_for_testing(clock);
        };

        ts::next_tx(&mut scenario, seller);
        {
            let clock = ts::take_shared<Clock>(&scenario);
            let nft = create_test_nft(ts::ctx(&mut scenario));
            auction::create_auction(nft, 100, 1000, &clock, ts::ctx(&mut scenario));
            ts::return_shared(clock);
        };

        // First bidder
        ts::next_tx(&mut scenario, bidder_a);
        {
            let mut auction = ts::take_shared<Auction<TestNFT>>(&scenario);
            let clock = ts::take_shared<Clock>(&scenario);
            let bid_coin = mint_sui(100, ts::ctx(&mut scenario));
            auction::place_bid(&mut auction, bid_coin, &clock, ts::ctx(&mut scenario));
            ts::return_shared(auction);
            ts::return_shared(clock);
        };

        // End auction
        ts::next_tx(&mut scenario, seller);
        {
            let mut auction = ts::take_shared<Auction<TestNFT>>(&scenario);
            let mut clock = ts::take_shared<Clock>(&scenario);
            clock::increment_for_testing(&mut clock, 2000);
            auction::end_auction(&mut auction, &clock, ts::ctx(&mut scenario));
            ts::return_shared(auction);
            ts::return_shared(clock);
        };

        // Try to bid on ended auction (should fail)
        ts::next_tx(&mut scenario, bidder_b);
        {
            let mut auction = ts::take_shared<Auction<TestNFT>>(&scenario);
            let clock = ts::take_shared<Clock>(&scenario);
            let bid_coin = mint_sui(200, ts::ctx(&mut scenario));
            auction::place_bid(&mut auction, bid_coin, &clock, ts::ctx(&mut scenario));
            ts::return_shared(auction);
            ts::return_shared(clock);
        };

        ts::end(scenario);
    }

    // ══════════════════════════════════════════════════════════════
    // Test 10: Non-winner cannot claim
    // ══════════════════════════════════════════════════════════════
    #[test]
    #[expected_failure(abort_code = auction::E_NOT_WINNER)]
    fun test_non_winner_cannot_claim() {
        let seller = @0xSELLER;
        let winner = @0xWINNER;
        let loser = @0xLOSER;
        let mut scenario = ts::begin(seller);

        // Setup
        ts::next_tx(&mut scenario, seller);
        {
            let clock = clock::create_for_testing(ts::ctx(&mut scenario));
            clock::share_for_testing(clock);
        };

        ts::next_tx(&mut scenario, seller);
        {
            let clock = ts::take_shared<Clock>(&scenario);
            let nft = create_test_nft(ts::ctx(&mut scenario));
            auction::create_auction(nft, 100, 1000, &clock, ts::ctx(&mut scenario));
            ts::return_shared(clock);
        };

        // Loser bids first
        ts::next_tx(&mut scenario, loser);
        {
            let mut auction = ts::take_shared<Auction<TestNFT>>(&scenario);
            let clock = ts::take_shared<Clock>(&scenario);
            let bid_coin = mint_sui(100, ts::ctx(&mut scenario));
            auction::place_bid(&mut auction, bid_coin, &clock, ts::ctx(&mut scenario));
            ts::return_shared(auction);
            ts::return_shared(clock);
        };

        // Winner outbids
        ts::next_tx(&mut scenario, winner);
        {
            let mut auction = ts::take_shared<Auction<TestNFT>>(&scenario);
            let clock = ts::take_shared<Clock>(&scenario);
            let bid_coin = mint_sui(200, ts::ctx(&mut scenario));
            auction::place_bid(&mut auction, bid_coin, &clock, ts::ctx(&mut scenario));
            ts::return_shared(auction);
            ts::return_shared(clock);
        };

        // End auction
        ts::next_tx(&mut scenario, seller);
        {
            let mut auction = ts::take_shared<Auction<TestNFT>>(&scenario);
            let mut clock = ts::take_shared<Clock>(&scenario);
            clock::increment_for_testing(&mut clock, 2000);
            auction::end_auction(&mut auction, &clock, ts::ctx(&mut scenario));
            ts::return_shared(auction);
            ts::return_shared(clock);
        };

        // Loser tries to claim (should fail)
        ts::next_tx(&mut scenario, loser);
        {
            let mut auction = ts::take_shared<Auction<TestNFT>>(&scenario);
            auction::claim(&mut auction, ts::ctx(&mut scenario));
            ts::return_shared(auction);
        };

        ts::end(scenario);
    }

    // ══════════════════════════════════════════════════════════════
    // Test 11: Non-seller cannot reclaim item when no bids
    // ══════════════════════════════════════════════════════════════
    #[test]
    #[expected_failure(abort_code = auction::E_NOT_SELLER)]
    fun test_non_seller_cannot_reclaim() {
        let seller = @0xSELLER;
        let random_user = @0xRANDOM;
        let mut scenario = ts::begin(seller);

        // Setup
        ts::next_tx(&mut scenario, seller);
        {
            let clock = clock::create_for_testing(ts::ctx(&mut scenario));
            clock::share_for_testing(clock);
        };

        ts::next_tx(&mut scenario, seller);
        {
            let clock = ts::take_shared<Clock>(&scenario);
            let nft = create_test_nft(ts::ctx(&mut scenario));
            auction::create_auction(nft, 100, 1000, &clock, ts::ctx(&mut scenario));
            ts::return_shared(clock);
        };

        // End auction without any bids
        ts::next_tx(&mut scenario, seller);
        {
            let mut auction = ts::take_shared<Auction<TestNFT>>(&scenario);
            let mut clock = ts::take_shared<Clock>(&scenario);
            clock::increment_for_testing(&mut clock, 2000);
            auction::end_auction(&mut auction, &clock, ts::ctx(&mut scenario));
            ts::return_shared(auction);
            ts::return_shared(clock);
        };

        // Random user tries to claim (should fail - only seller can reclaim)
        ts::next_tx(&mut scenario, random_user);
        {
            let mut auction = ts::take_shared<Auction<TestNFT>>(&scenario);
            auction::claim(&mut auction, ts::ctx(&mut scenario));
            ts::return_shared(auction);
        };

        ts::end(scenario);
    }

    // ══════════════════════════════════════════════════════════════
    // Test 12: Cannot withdraw without position
    // ══════════════════════════════════════════════════════════════
    #[test]
    #[expected_failure(abort_code = auction::E_NO_POSITION)]
    fun test_cannot_withdraw_without_position() {
        let seller = @0xSELLER;
        let winner = @0xWINNER;
        let random_user = @0xRANDOM;
        let mut scenario = ts::begin(seller);

        // Setup
        ts::next_tx(&mut scenario, seller);
        {
            let clock = clock::create_for_testing(ts::ctx(&mut scenario));
            clock::share_for_testing(clock);
        };

        ts::next_tx(&mut scenario, seller);
        {
            let clock = ts::take_shared<Clock>(&scenario);
            let nft = create_test_nft(ts::ctx(&mut scenario));
            auction::create_auction(nft, 100, 1000, &clock, ts::ctx(&mut scenario));
            ts::return_shared(clock);
        };

        // Winner bids
        ts::next_tx(&mut scenario, winner);
        {
            let mut auction = ts::take_shared<Auction<TestNFT>>(&scenario);
            let clock = ts::take_shared<Clock>(&scenario);
            let bid_coin = mint_sui(100, ts::ctx(&mut scenario));
            auction::place_bid(&mut auction, bid_coin, &clock, ts::ctx(&mut scenario));
            ts::return_shared(auction);
            ts::return_shared(clock);
        };

        // End auction
        ts::next_tx(&mut scenario, seller);
        {
            let mut auction = ts::take_shared<Auction<TestNFT>>(&scenario);
            let mut clock = ts::take_shared<Clock>(&scenario);
            clock::increment_for_testing(&mut clock, 2000);
            auction::end_auction(&mut auction, &clock, ts::ctx(&mut scenario));
            ts::return_shared(auction);
            ts::return_shared(clock);
        };

        // Random user (no position) tries to withdraw (should fail)
        ts::next_tx(&mut scenario, random_user);
        {
            let mut auction = ts::take_shared<Auction<TestNFT>>(&scenario);
            auction::withdraw(&mut auction, ts::ctx(&mut scenario));
            ts::return_shared(auction);
        };

        ts::end(scenario);
    }

    // ══════════════════════════════════════════════════════════════
    // Test 13: Cannot end auction while still active (before end_time)
    // ══════════════════════════════════════════════════════════════
    #[test]
    #[expected_failure(abort_code = auction::E_AUCTION_STILL_ACTIVE)]
    fun test_cannot_end_auction_early() {
        let seller = @0xSELLER;
        let mut scenario = ts::begin(seller);

        // Setup
        ts::next_tx(&mut scenario, seller);
        {
            let clock = clock::create_for_testing(ts::ctx(&mut scenario));
            clock::share_for_testing(clock);
        };

        ts::next_tx(&mut scenario, seller);
        {
            let clock = ts::take_shared<Clock>(&scenario);
            let nft = create_test_nft(ts::ctx(&mut scenario));
            auction::create_auction(nft, 100, 86400000, &clock, ts::ctx(&mut scenario)); // 1 day
            ts::return_shared(clock);
        };

        // Try to end auction early (should fail)
        ts::next_tx(&mut scenario, seller);
        {
            let mut auction = ts::take_shared<Auction<TestNFT>>(&scenario);
            let clock = ts::take_shared<Clock>(&scenario);
            auction::end_auction(&mut auction, &clock, ts::ctx(&mut scenario));
            ts::return_shared(auction);
            ts::return_shared(clock);
        };

        ts::end(scenario);
    }

    // ══════════════════════════════════════════════════════════════
    // Test 14: Cannot claim while auction still active
    // ══════════════════════════════════════════════════════════════
    #[test]
    #[expected_failure(abort_code = auction::E_AUCTION_STILL_ACTIVE)]
    fun test_cannot_claim_while_active() {
        let seller = @0xSELLER;
        let bidder = @0xBIDDER;
        let mut scenario = ts::begin(seller);

        // Setup
        ts::next_tx(&mut scenario, seller);
        {
            let clock = clock::create_for_testing(ts::ctx(&mut scenario));
            clock::share_for_testing(clock);
        };

        ts::next_tx(&mut scenario, seller);
        {
            let clock = ts::take_shared<Clock>(&scenario);
            let nft = create_test_nft(ts::ctx(&mut scenario));
            auction::create_auction(nft, 100, 86400000, &clock, ts::ctx(&mut scenario));
            ts::return_shared(clock);
        };

        // Bidder bids
        ts::next_tx(&mut scenario, bidder);
        {
            let mut auction = ts::take_shared<Auction<TestNFT>>(&scenario);
            let clock = ts::take_shared<Clock>(&scenario);
            let bid_coin = mint_sui(100, ts::ctx(&mut scenario));
            auction::place_bid(&mut auction, bid_coin, &clock, ts::ctx(&mut scenario));
            ts::return_shared(auction);
            ts::return_shared(clock);
        };

        // Bidder tries to claim while active (should fail)
        ts::next_tx(&mut scenario, bidder);
        {
            let mut auction = ts::take_shared<Auction<TestNFT>>(&scenario);
            auction::claim(&mut auction, ts::ctx(&mut scenario));
            ts::return_shared(auction);
        };

        ts::end(scenario);
    }

    // ══════════════════════════════════════════════════════════════
    // Test 15: Cannot withdraw while auction still active
    // ══════════════════════════════════════════════════════════════
    #[test]
    #[expected_failure(abort_code = auction::E_AUCTION_STILL_ACTIVE)]
    fun test_cannot_withdraw_while_active() {
        let seller = @0xSELLER;
        let bidder_a = @0xBIDDER_A;
        let bidder_b = @0xBIDDER_B;
        let mut scenario = ts::begin(seller);

        // Setup
        ts::next_tx(&mut scenario, seller);
        {
            let clock = clock::create_for_testing(ts::ctx(&mut scenario));
            clock::share_for_testing(clock);
        };

        ts::next_tx(&mut scenario, seller);
        {
            let clock = ts::take_shared<Clock>(&scenario);
            let nft = create_test_nft(ts::ctx(&mut scenario));
            auction::create_auction(nft, 100, 86400000, &clock, ts::ctx(&mut scenario));
            ts::return_shared(clock);
        };

        // Bidder A bids
        ts::next_tx(&mut scenario, bidder_a);
        {
            let mut auction = ts::take_shared<Auction<TestNFT>>(&scenario);
            let clock = ts::take_shared<Clock>(&scenario);
            let bid_coin = mint_sui(100, ts::ctx(&mut scenario));
            auction::place_bid(&mut auction, bid_coin, &clock, ts::ctx(&mut scenario));
            ts::return_shared(auction);
            ts::return_shared(clock);
        };

        // Bidder B outbids
        ts::next_tx(&mut scenario, bidder_b);
        {
            let mut auction = ts::take_shared<Auction<TestNFT>>(&scenario);
            let clock = ts::take_shared<Clock>(&scenario);
            let bid_coin = mint_sui(200, ts::ctx(&mut scenario));
            auction::place_bid(&mut auction, bid_coin, &clock, ts::ctx(&mut scenario));
            ts::return_shared(auction);
            ts::return_shared(clock);
        };

        // Bidder A tries to withdraw while active (should fail)
        ts::next_tx(&mut scenario, bidder_a);
        {
            let mut auction = ts::take_shared<Auction<TestNFT>>(&scenario);
            auction::withdraw(&mut auction, ts::ctx(&mut scenario));
            ts::return_shared(auction);
        };

        ts::end(scenario);
    }

    // ══════════════════════════════════════════════════════════════
    // Test 16: Seller reclaims item when no bids
    // ══════════════════════════════════════════════════════════════
    #[test]
    fun test_seller_reclaims_when_no_bids() {
        let seller = @0xSELLER;
        let mut scenario = ts::begin(seller);

        // Setup
        ts::next_tx(&mut scenario, seller);
        {
            let clock = clock::create_for_testing(ts::ctx(&mut scenario));
            clock::share_for_testing(clock);
        };

        ts::next_tx(&mut scenario, seller);
        {
            let clock = ts::take_shared<Clock>(&scenario);
            let nft = create_test_nft(ts::ctx(&mut scenario));
            auction::create_auction(nft, 100, 1000, &clock, ts::ctx(&mut scenario));
            ts::return_shared(clock);
        };

        // End auction without any bids
        ts::next_tx(&mut scenario, seller);
        {
            let mut auction = ts::take_shared<Auction<TestNFT>>(&scenario);
            let mut clock = ts::take_shared<Clock>(&scenario);
            clock::increment_for_testing(&mut clock, 2000);
            auction::end_auction(&mut auction, &clock, ts::ctx(&mut scenario));
            assert!(auction::is_active(&auction) == false);
            ts::return_shared(auction);
            ts::return_shared(clock);
        };

        // Seller reclaims item
        ts::next_tx(&mut scenario, seller);
        {
            let mut auction = ts::take_shared<Auction<TestNFT>>(&scenario);
            auction::claim(&mut auction, ts::ctx(&mut scenario));
            ts::return_shared(auction);
        };

        // Verify seller got NFT back
        ts::next_tx(&mut scenario, seller);
        {
            assert!(ts::has_most_recent_for_address<TestNFT>(seller));
        };

        ts::end(scenario);
    }

    // ══════════════════════════════════════════════════════════════
    // Test 17: Multiple losers can withdraw
    // ══════════════════════════════════════════════════════════════
    #[test]
    fun test_multiple_losers_withdraw() {
        let seller = @0xSELLER;
        let winner = @0xWINNER;
        let loser_a = @0xLOSER_A;
        let loser_b = @0xLOSER_B;
        let mut scenario = ts::begin(seller);

        // Setup
        ts::next_tx(&mut scenario, seller);
        {
            let clock = clock::create_for_testing(ts::ctx(&mut scenario));
            clock::share_for_testing(clock);
        };

        ts::next_tx(&mut scenario, seller);
        {
            let clock = ts::take_shared<Clock>(&scenario);
            let nft = create_test_nft(ts::ctx(&mut scenario));
            auction::create_auction(nft, 100, 1000, &clock, ts::ctx(&mut scenario));
            ts::return_shared(clock);
        };

        // Loser A bids 100
        ts::next_tx(&mut scenario, loser_a);
        {
            let mut auction = ts::take_shared<Auction<TestNFT>>(&scenario);
            let clock = ts::take_shared<Clock>(&scenario);
            let bid_coin = mint_sui(100, ts::ctx(&mut scenario));
            auction::place_bid(&mut auction, bid_coin, &clock, ts::ctx(&mut scenario));
            ts::return_shared(auction);
            ts::return_shared(clock);
        };

        // Loser B bids 150
        ts::next_tx(&mut scenario, loser_b);
        {
            let mut auction = ts::take_shared<Auction<TestNFT>>(&scenario);
            let clock = ts::take_shared<Clock>(&scenario);
            let bid_coin = mint_sui(150, ts::ctx(&mut scenario));
            auction::place_bid(&mut auction, bid_coin, &clock, ts::ctx(&mut scenario));
            ts::return_shared(auction);
            ts::return_shared(clock);
        };

        // Winner bids 300
        ts::next_tx(&mut scenario, winner);
        {
            let mut auction = ts::take_shared<Auction<TestNFT>>(&scenario);
            let clock = ts::take_shared<Clock>(&scenario);
            let bid_coin = mint_sui(300, ts::ctx(&mut scenario));
            auction::place_bid(&mut auction, bid_coin, &clock, ts::ctx(&mut scenario));
            ts::return_shared(auction);
            ts::return_shared(clock);
        };

        // End auction
        ts::next_tx(&mut scenario, seller);
        {
            let mut auction = ts::take_shared<Auction<TestNFT>>(&scenario);
            let mut clock = ts::take_shared<Clock>(&scenario);
            clock::increment_for_testing(&mut clock, 2000);
            auction::end_auction(&mut auction, &clock, ts::ctx(&mut scenario));
            ts::return_shared(auction);
            ts::return_shared(clock);
        };

        // Winner claims
        ts::next_tx(&mut scenario, winner);
        {
            let mut auction = ts::take_shared<Auction<TestNFT>>(&scenario);
            auction::claim(&mut auction, ts::ctx(&mut scenario));
            ts::return_shared(auction);
        };

        // Loser A withdraws
        ts::next_tx(&mut scenario, loser_a);
        {
            let mut auction = ts::take_shared<Auction<TestNFT>>(&scenario);
            assert!(auction::get_position(&auction, loser_a) == 100);
            auction::withdraw(&mut auction, ts::ctx(&mut scenario));
            assert!(auction::get_position(&auction, loser_a) == 0);
            ts::return_shared(auction);
        };

        // Verify loser A got coins
        ts::next_tx(&mut scenario, loser_a);
        {
            assert!(ts::has_most_recent_for_address<Coin<SUI>>(loser_a));
        };

        // Loser B withdraws
        ts::next_tx(&mut scenario, loser_b);
        {
            let mut auction = ts::take_shared<Auction<TestNFT>>(&scenario);
            assert!(auction::get_position(&auction, loser_b) == 150);
            auction::withdraw(&mut auction, ts::ctx(&mut scenario));
            assert!(auction::get_position(&auction, loser_b) == 0);
            ts::return_shared(auction);
        };

        // Verify loser B got coins
        ts::next_tx(&mut scenario, loser_b);
        {
            assert!(ts::has_most_recent_for_address<Coin<SUI>>(loser_b));
        };

        ts::end(scenario);
    }

    // ══════════════════════════════════════════════════════════════
    // Test 18: Second bid must be higher than highest bid + 1
    // ══════════════════════════════════════════════════════════════
    #[test]
    #[expected_failure(abort_code = auction::E_BID_TOO_LOW)]
    fun test_second_bid_must_exceed_highest() {
        let seller = @0xSELLER;
        let bidder_a = @0xBIDDER_A;
        let bidder_b = @0xBIDDER_B;
        let mut scenario = ts::begin(seller);

        // Setup
        ts::next_tx(&mut scenario, seller);
        {
            let clock = clock::create_for_testing(ts::ctx(&mut scenario));
            clock::share_for_testing(clock);
        };

        ts::next_tx(&mut scenario, seller);
        {
            let clock = ts::take_shared<Clock>(&scenario);
            let nft = create_test_nft(ts::ctx(&mut scenario));
            auction::create_auction(nft, 100, 86400000, &clock, ts::ctx(&mut scenario));
            ts::return_shared(clock);
        };

        // Bidder A bids 100
        ts::next_tx(&mut scenario, bidder_a);
        {
            let mut auction = ts::take_shared<Auction<TestNFT>>(&scenario);
            let clock = ts::take_shared<Clock>(&scenario);
            let bid_coin = mint_sui(100, ts::ctx(&mut scenario));
            auction::place_bid(&mut auction, bid_coin, &clock, ts::ctx(&mut scenario));
            ts::return_shared(auction);
            ts::return_shared(clock);
        };

        // Bidder B tries to bid exactly 100 (should fail - need at least 101)
        ts::next_tx(&mut scenario, bidder_b);
        {
            let mut auction = ts::take_shared<Auction<TestNFT>>(&scenario);
            let clock = ts::take_shared<Clock>(&scenario);
            let bid_coin = mint_sui(100, ts::ctx(&mut scenario));
            auction::place_bid(&mut auction, bid_coin, &clock, ts::ctx(&mut scenario));
            ts::return_shared(auction);
            ts::return_shared(clock);
        };

        ts::end(scenario);
    }

    // ══════════════════════════════════════════════════════════════
    // Test 19: Cannot withdraw twice
    // ══════════════════════════════════════════════════════════════
    #[test]
    #[expected_failure(abort_code = auction::E_NO_POSITION)]
    fun test_cannot_withdraw_twice() {
        let seller = @0xSELLER;
        let winner = @0xWINNER;
        let loser = @0xLOSER;
        let mut scenario = ts::begin(seller);

        // Setup
        ts::next_tx(&mut scenario, seller);
        {
            let clock = clock::create_for_testing(ts::ctx(&mut scenario));
            clock::share_for_testing(clock);
        };

        ts::next_tx(&mut scenario, seller);
        {
            let clock = ts::take_shared<Clock>(&scenario);
            let nft = create_test_nft(ts::ctx(&mut scenario));
            auction::create_auction(nft, 100, 1000, &clock, ts::ctx(&mut scenario));
            ts::return_shared(clock);
        };

        // Loser bids
        ts::next_tx(&mut scenario, loser);
        {
            let mut auction = ts::take_shared<Auction<TestNFT>>(&scenario);
            let clock = ts::take_shared<Clock>(&scenario);
            let bid_coin = mint_sui(100, ts::ctx(&mut scenario));
            auction::place_bid(&mut auction, bid_coin, &clock, ts::ctx(&mut scenario));
            ts::return_shared(auction);
            ts::return_shared(clock);
        };

        // Winner outbids
        ts::next_tx(&mut scenario, winner);
        {
            let mut auction = ts::take_shared<Auction<TestNFT>>(&scenario);
            let clock = ts::take_shared<Clock>(&scenario);
            let bid_coin = mint_sui(200, ts::ctx(&mut scenario));
            auction::place_bid(&mut auction, bid_coin, &clock, ts::ctx(&mut scenario));
            ts::return_shared(auction);
            ts::return_shared(clock);
        };

        // End auction
        ts::next_tx(&mut scenario, seller);
        {
            let mut auction = ts::take_shared<Auction<TestNFT>>(&scenario);
            let mut clock = ts::take_shared<Clock>(&scenario);
            clock::increment_for_testing(&mut clock, 2000);
            auction::end_auction(&mut auction, &clock, ts::ctx(&mut scenario));
            ts::return_shared(auction);
            ts::return_shared(clock);
        };

        // Loser withdraws first time (success)
        ts::next_tx(&mut scenario, loser);
        {
            let mut auction = ts::take_shared<Auction<TestNFT>>(&scenario);
            auction::withdraw(&mut auction, ts::ctx(&mut scenario));
            ts::return_shared(auction);
        };

        // Loser tries to withdraw again (should fail)
        ts::next_tx(&mut scenario, loser);
        {
            let mut auction = ts::take_shared<Auction<TestNFT>>(&scenario);
            auction::withdraw(&mut auction, ts::ctx(&mut scenario));
            ts::return_shared(auction);
        };

        ts::end(scenario);
    }

    // ══════════════════════════════════════════════════════════════
    // Test 20: Exact minimum bid is accepted
    // ══════════════════════════════════════════════════════════════
    #[test]
    fun test_exact_minimum_bid_accepted() {
        let seller = @0xSELLER;
        let bidder = @0xBIDDER;
        let mut scenario = ts::begin(seller);

        // Setup
        ts::next_tx(&mut scenario, seller);
        {
            let clock = clock::create_for_testing(ts::ctx(&mut scenario));
            clock::share_for_testing(clock);
        };

        ts::next_tx(&mut scenario, seller);
        {
            let clock = ts::take_shared<Clock>(&scenario);
            let nft = create_test_nft(ts::ctx(&mut scenario));
            auction::create_auction(nft, 100, 86400000, &clock, ts::ctx(&mut scenario));
            ts::return_shared(clock);
        };

        // Bid exactly min_bid
        ts::next_tx(&mut scenario, bidder);
        {
            let mut auction = ts::take_shared<Auction<TestNFT>>(&scenario);
            let clock = ts::take_shared<Clock>(&scenario);
            let bid_coin = mint_sui(100, ts::ctx(&mut scenario)); // Exact min_bid

            auction::place_bid(&mut auction, bid_coin, &clock, ts::ctx(&mut scenario));

            assert!(auction::highest_bid(&auction) == 100);
            assert!(auction::get_position(&auction, bidder) == 100);

            ts::return_shared(auction);
            ts::return_shared(clock);
        };

        ts::end(scenario);
    }

    // ══════════════════════════════════════════════════════════════
    // Test 21: Cannot end auction twice
    // ══════════════════════════════════════════════════════════════
    #[test]
    #[expected_failure(abort_code = auction::E_AUCTION_NOT_ACTIVE)]
    fun test_cannot_end_auction_twice() {
        let seller = @0xSELLER;
        let mut scenario = ts::begin(seller);

        // Setup
        ts::next_tx(&mut scenario, seller);
        {
            let clock = clock::create_for_testing(ts::ctx(&mut scenario));
            clock::share_for_testing(clock);
        };

        ts::next_tx(&mut scenario, seller);
        {
            let clock = ts::take_shared<Clock>(&scenario);
            let nft = create_test_nft(ts::ctx(&mut scenario));
            auction::create_auction(nft, 100, 1000, &clock, ts::ctx(&mut scenario));
            ts::return_shared(clock);
        };

        // End auction first time
        ts::next_tx(&mut scenario, seller);
        {
            let mut auction = ts::take_shared<Auction<TestNFT>>(&scenario);
            let mut clock = ts::take_shared<Clock>(&scenario);
            clock::increment_for_testing(&mut clock, 2000);
            auction::end_auction(&mut auction, &clock, ts::ctx(&mut scenario));
            ts::return_shared(auction);
            ts::return_shared(clock);
        };

        // Try to end again (should fail)
        ts::next_tx(&mut scenario, seller);
        {
            let mut auction = ts::take_shared<Auction<TestNFT>>(&scenario);
            let clock = ts::take_shared<Clock>(&scenario);
            auction::end_auction(&mut auction, &clock, ts::ctx(&mut scenario));
            ts::return_shared(auction);
            ts::return_shared(clock);
        };

        ts::end(scenario);
    }
}
