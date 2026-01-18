module suibid::trade {
    use sui::clock::{Self, Clock};
    use sui::event;
    use sui::dynamic_object_field as dof;
    use suibid::rewards::{Self, RewardsRegistry};

    // ===== Errors =====
    const ETradeNotActive: u64 = 1;
    const ETradeExpired: u64 = 2;
    const ETradeNotExpired: u64 = 3;
    const ENotSeller: u64 = 4;
    const ENotBuyer: u64 = 5;
    const EInvalidOffer: u64 = 6;

    // ===== Structs =====

    /// Trade transaction được tạo bởi seller
    public struct Trade has key, store {
        id: UID,
        seller: address,
        end_time: u64,
        active: bool,
        offer_count: u64,  // Số lượng offers hiện tại
    }

    /// Offer được đặt bởi buyer
    public struct Offer has key, store {
        id: UID,
        buyer: address,
        offer_index: u64,  // Index của offer trong Trade
    }

    /// Key để lưu seller's items trong Trade object
    public struct SellerItemKey has copy, drop, store {
        index: u64,
    }

    /// Key để lưu buyer's items trong Offer object
    public struct BuyerItemKey has copy, drop, store {
        index: u64,
    }

    /// Key để lưu offers trong Trade object
    public struct OfferKey has copy, drop, store {
        index: u64,
    }

    // ===== Events =====

    public struct TradeCreated has copy, drop {
        trade_id: ID,
        seller: address,
        end_time: u64,
    }

    public struct OfferPlaced has copy, drop {
        offer_id: ID,
        trade_id: ID,
        buyer: address,
    }

    public struct TradeCompleted has copy, drop {
        trade_id: ID,
        offer_id: ID,
        seller: address,
        buyer: address,
    }

    public struct TradeCancelled has copy, drop {
        trade_id: ID,
        seller: address,
    }

    public struct OfferWithdrawn has copy, drop {
        offer_id: ID,
        buyer: address,
    }

    // ===== Public Functions =====

    /// Seller tạo trade transaction với các NFTs của mình
    public fun create_trade(
        end_time: u64,
        clock: &Clock,
        ctx: &mut TxContext
    ): Trade {
        let current_time = clock::timestamp_ms(clock);
        assert!(end_time > current_time, ETradeExpired);

        let trade = Trade {
            id: object::new(ctx),
            seller: ctx.sender(),
            end_time,
            active: true,
            offer_count: 0,
        };

        event::emit(TradeCreated {
            trade_id: object::id(&trade),
            seller: ctx.sender(),
            end_time,
        });

        trade
    }

    /// Seller thêm NFT vào trade transaction
    public fun add_seller_item<T: key + store>(
        trade: &mut Trade,
        item: T,
        ctx: &TxContext
    ) {
        assert!(trade.seller == ctx.sender(), ENotSeller);
        assert!(trade.active, ETradeNotActive);

        let items_count = count_seller_items(trade);
        let key = SellerItemKey { index: items_count };
        dof::add(&mut trade.id, key, item);
    }

    /// Buyer tạo offer với các NFTs của mình
    /// Offer sẽ được lưu trực tiếp vào Trade object
    public fun place_offer(
        trade: &mut Trade,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        assert!(trade.active, ETradeNotActive);

        let current_time = clock::timestamp_ms(clock);
        assert!(current_time < trade.end_time, ETradeExpired);

        let offer = Offer {
            id: object::new(ctx),
            buyer: ctx.sender(),
            offer_index: trade.offer_count,
        };

        let offer_id = object::id(&offer);

        event::emit(OfferPlaced {
            offer_id,
            trade_id: object::id(trade),
            buyer: ctx.sender(),
        });

        // Lưu offer vào Trade object
        let key = OfferKey { index: trade.offer_count };
        dof::add(&mut trade.id, key, offer);
        trade.offer_count = trade.offer_count + 1;
    }

    /// Buyer thêm NFT vào offer của mình
    /// Cần truyền Trade object để truy cập offer bên trong
    public fun add_buyer_item<T: key + store>(
        trade: &mut Trade,
        offer_index: u64,
        item: T,
        ctx: &TxContext
    ) {
        let offer_key = OfferKey { index: offer_index };
        assert!(dof::exists_<OfferKey>(&trade.id, offer_key), EInvalidOffer);

        let offer: &mut Offer = dof::borrow_mut(&mut trade.id, offer_key);
        assert!(offer.buyer == ctx.sender(), ENotBuyer);

        let items_count = count_buyer_items(offer);
        let key = BuyerItemKey { index: items_count };
        dof::add(&mut offer.id, key, item);
    }

    /// Seller chấp nhận offer và hoàn tất trade
    /// Offer được lấy từ Trade object dựa trên offer_index
    public fun accept_offer<T: key + store, U: key + store>(
        trade: Trade,
        offer_index: u64,
        clock: &Clock,
        rewards_registry: &mut RewardsRegistry,
        ctx: &mut TxContext
    ) {
        assert!(trade.seller == ctx.sender(), ENotSeller);
        assert!(trade.active, ETradeNotActive);

        let current_time = clock::timestamp_ms(clock);
        assert!(current_time >= trade.end_time, ETradeNotExpired);

        let Trade {
            mut id,
            seller,
            end_time: _,
            active: _,
            offer_count: _,
        } = trade;

        // Lấy offer từ Trade object
        let offer_key = OfferKey { index: offer_index };
        assert!(dof::exists_<OfferKey>(&id, offer_key), EInvalidOffer);

        let Offer {
            id: offer_id_uid,
            buyer,
            offer_index: _,
        } = dof::remove(&mut id, offer_key);

        let mut trade_id = id;
        let mut offer_id = offer_id_uid;

        event::emit(TradeCompleted {
            trade_id: object::uid_to_inner(&trade_id),
            offer_id: object::uid_to_inner(&offer_id),
            seller,
            buyer,
        });

        // Award points to seller and buyer
        rewards::award_trade_seller_points(rewards_registry, seller, ctx);
        rewards::award_trade_buyer_points(rewards_registry, buyer, ctx);

        // Transfer seller's items to buyer
        let seller_items_count = count_seller_items_from_uid(&trade_id);
        let mut i = 0;
        while (i < seller_items_count) {
            let key = SellerItemKey { index: i };
            if (dof::exists_<SellerItemKey>(&trade_id, key)) {
                let item: T = dof::remove(&mut trade_id, key);
                transfer::public_transfer(item, buyer);
            };
            i = i + 1;
        };

        // Transfer buyer's items to seller
        let buyer_items_count = count_buyer_items_from_uid(&offer_id);
        let mut j = 0;
        while (j < buyer_items_count) {
            let key = BuyerItemKey { index: j };
            if (dof::exists_<BuyerItemKey>(&offer_id, key)) {
                let item: U = dof::remove(&mut offer_id, key);
                transfer::public_transfer(item, seller);
            };
            j = j + 1;
        };

        object::delete(trade_id);
        object::delete(offer_id);
    }

    /// Seller hủy trade
    /// Tất cả offers và items sẽ được trả lại cho buyers và seller
    public fun cancel_trade<T: key + store, U: key + store>(
        trade: Trade,
        ctx: &TxContext
    ) {
        assert!(trade.seller == ctx.sender(), ENotSeller);

        let Trade {
            id,
            seller,
            end_time: _,
            active: _,
            offer_count,
        } = trade;

        let mut trade_id = id;

        event::emit(TradeCancelled {
            trade_id: object::uid_to_inner(&trade_id),
            seller,
        });

        // Return all seller's items to seller
        let items_count = count_seller_items_from_uid(&trade_id);
        let mut i = 0;
        while (i < items_count) {
            let key = SellerItemKey { index: i };
            if (dof::exists_<SellerItemKey>(&trade_id, key)) {
                let item: T = dof::remove(&mut trade_id, key);
                transfer::public_transfer(item, seller);
            };
            i = i + 1;
        };

        // Return all offers and their items to buyers
        let mut j = 0;
        while (j < offer_count) {
            let offer_key = OfferKey { index: j };
            if (dof::exists_<OfferKey>(&trade_id, offer_key)) {
                let Offer {
                    id: offer_uid,
                    buyer,
                    offer_index: _,
                } = dof::remove(&mut trade_id, offer_key);

                let mut offer_id = offer_uid;

                // Return all buyer's items
                let buyer_items_count = count_buyer_items_from_uid(&offer_id);
                let mut k = 0;
                while (k < buyer_items_count) {
                    let item_key = BuyerItemKey { index: k };
                    if (dof::exists_<BuyerItemKey>(&offer_id, item_key)) {
                        let item: U = dof::remove(&mut offer_id, item_key);
                        transfer::public_transfer(item, buyer);
                    };
                    k = k + 1;
                };

                object::delete(offer_id);
            };
            j = j + 1;
        };

        object::delete(trade_id);
    }

    /// Buyer rút offer từ Trade
    public fun withdraw_offer<T: key + store>(
        trade: &mut Trade,
        offer_index: u64,
        ctx: &TxContext
    ) {
        let offer_key = OfferKey { index: offer_index };
        assert!(dof::exists_<OfferKey>(&trade.id, offer_key), EInvalidOffer);

        // Borrow để check buyer
        let offer_ref: &Offer = dof::borrow(&trade.id, offer_key);
        assert!(offer_ref.buyer == ctx.sender(), ENotBuyer);

        // Remove offer
        let Offer {
            id,
            buyer,
            offer_index: _,
        } = dof::remove(&mut trade.id, offer_key);

        let mut offer_id = id;

        event::emit(OfferWithdrawn {
            offer_id: object::uid_to_inner(&offer_id),
            buyer,
        });

        // Return all items to buyer
        let items_count = count_buyer_items_from_uid(&offer_id);
        let mut i = 0;
        while (i < items_count) {
            let key = BuyerItemKey { index: i };
            if (dof::exists_<BuyerItemKey>(&offer_id, key)) {
                let item: T = dof::remove(&mut offer_id, key);
                transfer::public_transfer(item, buyer);
            };
            i = i + 1;
        };

        object::delete(offer_id);
    }

    // ===== View Functions =====

    public fun seller(trade: &Trade): address {
        trade.seller
    }

    public fun end_time(trade: &Trade): u64 {
        trade.end_time
    }

    public fun is_active(trade: &Trade): bool {
        trade.active
    }

    public fun offer_count(trade: &Trade): u64 {
        trade.offer_count
    }

    /// Kiểm tra xem offer có tồn tại không
    public fun has_offer(trade: &Trade, offer_index: u64): bool {
        let key = OfferKey { index: offer_index };
        dof::exists_<OfferKey>(&trade.id, key)
    }

    /// Lấy thông tin buyer của một offer
    public fun get_offer_buyer(trade: &Trade, offer_index: u64): address {
        let key = OfferKey { index: offer_index };
        let offer: &Offer = dof::borrow(&trade.id, key);
        offer.buyer
    }

    /// Đếm số items trong một offer cụ thể
    public fun count_offer_items(trade: &Trade, offer_index: u64): u64 {
        let key = OfferKey { index: offer_index };
        let offer: &Offer = dof::borrow(&trade.id, key);
        count_buyer_items(offer)
    }

    /// Kiểm tra xem item ở vị trí cụ thể có tồn tại trong offer không
    public fun has_offer_item<T: key + store>(
        trade: &Trade,
        offer_index: u64,
        item_index: u64
    ): bool {
        let offer_key = OfferKey { index: offer_index };
        if (!dof::exists_<OfferKey>(&trade.id, offer_key)) {
            return false
        };

        let offer: &Offer = dof::borrow(&trade.id, offer_key);
        let item_key = BuyerItemKey { index: item_index };
        dof::exists_with_type<BuyerItemKey, T>(&offer.id, item_key)
    }

    /// Lấy immutable reference đến item trong offer
    /// Seller có thể dùng để xem chi tiết NFT, skin, vé, etc.
    public fun borrow_offer_item<T: key + store>(
        trade: &Trade,
        offer_index: u64,
        item_index: u64
    ): &T {
        let offer_key = OfferKey { index: offer_index };
        let offer: &Offer = dof::borrow(&trade.id, offer_key);
        let item_key = BuyerItemKey { index: item_index };
        dof::borrow(&offer.id, item_key)
    }

    /// Kiểm tra xem seller's item ở vị trí cụ thể có tồn tại không
    public fun has_seller_item<T: key + store>(
        trade: &Trade,
        item_index: u64
    ): bool {
        let item_key = SellerItemKey { index: item_index };
        dof::exists_with_type<SellerItemKey, T>(&trade.id, item_key)
    }

    /// Lấy immutable reference đến seller's item
    /// Buyers có thể dùng để xem chi tiết những gì seller đang offer
    public fun borrow_seller_item<T: key + store>(
        trade: &Trade,
        item_index: u64
    ): &T {
        let item_key = SellerItemKey { index: item_index };
        dof::borrow(&trade.id, item_key)
    }

    /// Đếm số items của seller
    public fun count_seller_trade_items(trade: &Trade): u64 {
        count_seller_items(trade)
    }

    // ===== Helper Functions =====

    fun count_seller_items(trade: &Trade): u64 {
        let mut count = 0;
        let mut i = 0;
        while (i < 100) {  // Max 100 items
            let key = SellerItemKey { index: i };
            if (dof::exists_<SellerItemKey>(&trade.id, key)) {
                count = count + 1;
            } else {
                break
            };
            i = i + 1;
        };
        count
    }

    fun count_seller_items_from_uid(uid: &UID): u64 {
        let mut count = 0;
        let mut i = 0;
        while (i < 100) {
            let key = SellerItemKey { index: i };
            if (dof::exists_<SellerItemKey>(uid, key)) {
                count = count + 1;
            } else {
                break
            };
            i = i + 1;
        };
        count
    }

    fun count_buyer_items(offer: &Offer): u64 {
        let mut count = 0;
        let mut i = 0;
        while (i < 100) {
            let key = BuyerItemKey { index: i };
            if (dof::exists_<BuyerItemKey>(&offer.id, key)) {
                count = count + 1;
            } else {
                break
            };
            i = i + 1;
        };
        count
    }

    fun count_buyer_items_from_uid(uid: &UID): u64 {
        let mut count = 0;
        let mut i = 0;
        while (i < 100) {
            let key = BuyerItemKey { index: i };
            if (dof::exists_<BuyerItemKey>(uid, key)) {
                count = count + 1;
            } else {
                break
            };
            i = i + 1;
        };
        count
    }

    // ===== Test Functions =====

    #[test_only]
    public fun init_for_testing(ctx: &mut TxContext) {
        // Initialize module for testing
    }
}
