-- WarmPaws Row Level Security (RLS) Policies
-- Run this AFTER schema.sql has been executed
-- These policies enforce data access rules at the database level

-- ============================================================================
-- ENABLE RLS ON ALL TABLES
-- ============================================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE pets ENABLE ROW LEVEL SECURITY;
ALTER TABLE pet_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE cart ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PROFILES POLICIES
-- Users can read all profiles, but only update their own
-- ============================================================================

-- Allow everyone to view profiles (needed for seller info on listings)
CREATE POLICY "Profiles are viewable by everyone"
    ON profiles
    FOR SELECT
    USING (true);

-- Users can update only their own profile
CREATE POLICY "Users can update own profile"
    ON profiles
    FOR UPDATE
    USING (auth.uid() = id);

-- Users can insert their own profile (auto-created by trigger, but allow manual inserts)
CREATE POLICY "Users can insert own profile"
    ON profiles
    FOR INSERT
    WITH CHECK (auth.uid() = id);

-- ============================================================================
-- PETS POLICIES
-- Public can view available pets
-- Sellers can manage their own pets
-- Admins can manage all pets
-- ============================================================================

-- Public can view available pets, sellers can view their own, admins can view all
CREATE POLICY "Available pets are viewable by everyone"
    ON pets
    FOR SELECT
    USING (
        status = 'available'
        OR seller_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Sellers and admins can insert pets
CREATE POLICY "Sellers can insert pets"
    ON pets
    FOR INSERT
    WITH CHECK (
        seller_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role IN ('seller', 'admin')
        )
    );

-- Sellers can update their own pets, admins can update all
CREATE POLICY "Sellers can update own pets"
    ON pets
    FOR UPDATE
    USING (
        seller_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Sellers can delete their own pets, admins can delete all
CREATE POLICY "Sellers can delete own pets"
    ON pets
    FOR DELETE
    USING (
        seller_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- ============================================================================
-- PET_PHOTOS POLICIES
-- Photos are public (since bucket is public)
-- Only pet owners can manage photos
-- ============================================================================

-- Everyone can view pet photos
CREATE POLICY "Pet photos are viewable by everyone"
    ON pet_photos
    FOR SELECT
    USING (true);

-- Pet owners can insert photos for their pets
CREATE POLICY "Pet owners can insert photos"
    ON pet_photos
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM pets
            WHERE id = pet_id AND seller_id = auth.uid()
        )
    );

-- Pet owners can update their photos (e.g., change is_primary)
CREATE POLICY "Pet owners can update photos"
    ON pet_photos
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM pets
            WHERE id = pet_id AND seller_id = auth.uid()
        )
    );

-- Pet owners can delete their photos
CREATE POLICY "Pet owners can delete photos"
    ON pet_photos
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM pets
            WHERE id = pet_id AND seller_id = auth.uid()
        )
    );

-- ============================================================================
-- ORDERS POLICIES
-- Orders are viewable by buyer, seller, or admin
-- Buyers create orders, sellers/admins update status
-- ============================================================================

-- Orders viewable by participants (buyer, seller) or admins
CREATE POLICY "Orders viewable by participants"
    ON orders
    FOR SELECT
    USING (
        buyer_id = auth.uid()
        OR seller_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Authenticated users can create orders (as buyer)
CREATE POLICY "Authenticated users can create orders"
    ON orders
    FOR INSERT
    WITH CHECK (buyer_id = auth.uid());

-- Sellers can update their sales, admins can update all orders
CREATE POLICY "Sellers and admins can update orders"
    ON orders
    FOR UPDATE
    USING (
        seller_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Only admins can delete orders (for cleanup/corrections)
CREATE POLICY "Admins can delete orders"
    ON orders
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- ============================================================================
-- CART POLICIES
-- Users can only access their own cart
-- ============================================================================

-- Users can view their own cart
CREATE POLICY "Users can view own cart"
    ON cart
    FOR SELECT
    USING (user_id = auth.uid());

-- Users can add items to their own cart
CREATE POLICY "Users can add to own cart"
    ON cart
    FOR INSERT
    WITH CHECK (user_id = auth.uid());

-- Users can update their own cart items
CREATE POLICY "Users can update own cart"
    ON cart
    FOR UPDATE
    USING (user_id = auth.uid());

-- Users can delete their own cart items
CREATE POLICY "Users can delete from own cart"
    ON cart
    FOR DELETE
    USING (user_id = auth.uid());

-- ============================================================================
-- MESSAGES POLICIES
-- Users can view messages they sent or received
-- Users can only send messages as themselves
-- ============================================================================

-- Users can view their own messages (sent or received)
CREATE POLICY "Users can view their messages"
    ON messages
    FOR SELECT
    USING (
        sender_id = auth.uid()
        OR recipient_id = auth.uid()
    );

-- Authenticated users can send messages (as themselves)
CREATE POLICY "Authenticated users can send messages"
    ON messages
    FOR INSERT
    WITH CHECK (sender_id = auth.uid());

-- Recipients can update messages (e.g., mark as read)
CREATE POLICY "Recipients can update messages"
    ON messages
    FOR UPDATE
    USING (recipient_id = auth.uid());

-- Participants can delete messages
CREATE POLICY "Message participants can delete"
    ON messages
    FOR DELETE
    USING (
        sender_id = auth.uid()
        OR recipient_id = auth.uid()
    );

-- ============================================================================
-- REVIEWS POLICIES (Future Feature)
-- Reviews are public, but only order participants can create them
-- ============================================================================

-- Everyone can view reviews
CREATE POLICY "Reviews are viewable by everyone"
    ON reviews
    FOR SELECT
    USING (true);

-- Order participants can create reviews
CREATE POLICY "Order participants can create reviews"
    ON reviews
    FOR INSERT
    WITH CHECK (
        reviewer_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM orders
            WHERE id = order_id
            AND (buyer_id = auth.uid() OR seller_id = auth.uid())
        )
    );

-- Reviewers can update their own reviews
CREATE POLICY "Reviewers can update own reviews"
    ON reviews
    FOR UPDATE
    USING (reviewer_id = auth.uid());

-- Reviewers or admins can delete reviews
CREATE POLICY "Reviewers and admins can delete reviews"
    ON reviews
    FOR DELETE
    USING (
        reviewer_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- ============================================================================
-- STORAGE POLICIES
-- Policies for Supabase Storage (pet-photos bucket)
-- Note: These need to be applied in the Supabase Dashboard under Storage > Policies
-- ============================================================================

-- Policy 1: Public Read Access
-- Name: "Pet photos are publicly accessible"
-- Operation: SELECT
-- Target roles: public
-- USING expression: bucket_id = 'pet-photos'

-- Policy 2: Authenticated Upload
-- Name: "Authenticated users can upload pet photos"
-- Operation: INSERT
-- Target roles: authenticated
-- WITH CHECK expression: bucket_id = 'pet-photos'

-- Policy 3: Owner Delete
-- Name: "Users can delete own pet photos"
-- Operation: DELETE
-- Target roles: authenticated
-- USING expression:
--   bucket_id = 'pet-photos' AND
--   auth.uid()::text = (storage.foldername(name))[1]

-- ============================================================================
-- TESTING RLS POLICIES
-- Use these queries to verify policies work correctly
-- ============================================================================

/*
-- Test 1: Check if public can view available pets
SET LOCAL ROLE anon;
SELECT * FROM pets WHERE status = 'available' LIMIT 5;
RESET ROLE;

-- Test 2: Check if user can only see their own cart
SET LOCAL jwt.claims.sub TO '<some-user-id>';
SELECT * FROM cart;
RESET ROLE;

-- Test 3: Check if seller can only update their own pets
SET LOCAL jwt.claims.sub TO '<seller-user-id>';
UPDATE pets SET price = 1500 WHERE id = '<pet-id>';
RESET ROLE;

-- Test 4: Check if buyer can view their orders
SET LOCAL jwt.claims.sub TO '<buyer-user-id>';
SELECT * FROM orders WHERE buyer_id = auth.uid();
RESET ROLE;

-- Test 5: Check if admin can access all data
SET LOCAL jwt.claims.sub TO '<admin-user-id>';
SELECT COUNT(*) FROM pets; -- Should return all pets
SELECT COUNT(*) FROM orders; -- Should return all orders
RESET ROLE;
*/

-- ============================================================================
-- RLS POLICIES COMPLETE
-- Security is now enforced at the database level!
--
-- Next steps:
-- 1. Apply storage policies in Supabase Dashboard
-- 2. Test policies with different user roles
-- 3. Configure auth settings
-- ============================================================================

-- Grant usage on schema to authenticated and anon roles
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- Grant access to all tables for authenticated users (RLS will control access)
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- Grant read access to anon (public) users
GRANT SELECT ON profiles, pets, pet_photos TO anon;

COMMENT ON POLICY "Profiles are viewable by everyone" ON profiles IS 'Public access to seller information on listings';
COMMENT ON POLICY "Available pets are viewable by everyone" ON pets IS 'Public browse functionality for available pets';
COMMENT ON POLICY "Users can view own cart" ON cart IS 'Privacy: users can only access their own shopping cart';
COMMENT ON POLICY "Orders viewable by participants" ON orders IS 'Privacy: orders visible only to buyer, seller, or admin';
