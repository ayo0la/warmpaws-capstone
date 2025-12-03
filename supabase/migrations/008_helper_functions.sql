-- Helper functions for common operations

-- Function to decrement listing quantity after purchase
CREATE OR REPLACE FUNCTION decrement_listing_quantity(listing_id UUID, qty INTEGER)
RETURNS VOID AS $$
BEGIN
    UPDATE public.listings
    SET
        quantity_available = quantity_available - qty,
        quantity_sold = quantity_sold + qty,
        status = CASE
            WHEN quantity_available - qty <= 0 THEN 'sold_out'
            ELSE status
        END,
        updated_at = NOW()
    WHERE id = listing_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION decrement_listing_quantity IS 'Decrements quantity and updates status after purchase';

-- Function to increment listing views
CREATE OR REPLACE FUNCTION increment_listing_views(listing_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE public.listings
    SET views = views + 1
    WHERE id = listing_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION increment_listing_views IS 'Increments view count for a listing';

-- Function to get seller statistics
CREATE OR REPLACE FUNCTION get_seller_stats(seller_id UUID)
RETURNS TABLE (
    total_listings BIGINT,
    active_listings BIGINT,
    total_sales BIGINT,
    total_revenue NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(l.id) as total_listings,
        COUNT(l.id) FILTER (WHERE l.status = 'active') as active_listings,
        COUNT(t.id) as total_sales,
        COALESCE(SUM(t.pet_price), 0) as total_revenue
    FROM public.listings l
    LEFT JOIN public.transactions t ON t.listing_id = l.id AND t.payment_status = 'completed'
    WHERE l.seller_id = get_seller_stats.seller_id
    GROUP BY l.seller_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_seller_stats IS 'Returns statistics for a seller';

-- Function to search listings (full-text search)
CREATE OR REPLACE FUNCTION search_listings(search_term TEXT)
RETURNS SETOF public.listings AS $$
BEGIN
    RETURN QUERY
    SELECT *
    FROM public.listings
    WHERE
        status = 'active'
        AND to_tsvector('english', breed || ' ' || description) @@ plainto_tsquery('english', search_term)
    ORDER BY ts_rank(to_tsvector('english', breed || ' ' || description), plainto_tsquery('english', search_term)) DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION search_listings IS 'Full-text search for listings by breed and description';
