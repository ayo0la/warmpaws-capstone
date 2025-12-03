-- Row Level Security Policies
-- These enforce access control at the database level

-- ============================================
-- PROFILES POLICIES
-- ============================================

-- Anyone can view public profiles
CREATE POLICY "Public profiles are viewable by everyone"
ON public.profiles FOR SELECT
USING (true);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = id);

-- Users can insert their own profile (handled by trigger, but allow manual)
CREATE POLICY "Users can insert own profile"
ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = id);

-- ============================================
-- LISTINGS POLICIES
-- ============================================

-- Anyone can view active listings, sellers can view their own
CREATE POLICY "Active listings are viewable by everyone"
ON public.listings FOR SELECT
USING (status = 'active' OR seller_id = auth.uid());

-- Authenticated users can create listings
CREATE POLICY "Authenticated users can create listings"
ON public.listings FOR INSERT
WITH CHECK (auth.uid() = seller_id);

-- Sellers can update their own listings
CREATE POLICY "Sellers can update own listings"
ON public.listings FOR UPDATE
USING (auth.uid() = seller_id);

-- Sellers can delete their own listings
CREATE POLICY "Sellers can delete own listings"
ON public.listings FOR DELETE
USING (auth.uid() = seller_id);

-- ============================================
-- PET IMAGES POLICIES
-- ============================================

-- Anyone can view images of active listings
CREATE POLICY "Images are viewable if listing is active"
ON public.pet_images FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.listings
        WHERE listings.id = pet_images.listing_id
        AND (listings.status = 'active' OR listings.seller_id = auth.uid())
    )
);

-- Sellers can upload images to their listings
CREATE POLICY "Sellers can upload images to own listings"
ON public.pet_images FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.listings
        WHERE listings.id = listing_id
        AND listings.seller_id = auth.uid()
    )
);

-- Sellers can delete images from their listings
CREATE POLICY "Sellers can delete images from own listings"
ON public.pet_images FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM public.listings
        WHERE listings.id = listing_id
        AND listings.seller_id = auth.uid()
    )
);

-- ============================================
-- TRANSACTIONS POLICIES
-- ============================================

-- Buyers can view their own purchases
CREATE POLICY "Buyers can view own purchases"
ON public.transactions FOR SELECT
USING (auth.uid() = buyer_id);

-- Sellers can view their own sales
CREATE POLICY "Sellers can view own sales"
ON public.transactions FOR SELECT
USING (auth.uid() = seller_id);

-- Note: No INSERT policy - transactions created via Edge Functions with service role

-- ============================================
-- FAVORITES POLICIES
-- ============================================

-- Users can view their own favorites
CREATE POLICY "Users can view own favorites"
ON public.favorites FOR SELECT
USING (auth.uid() = user_id);

-- Users can add favorites
CREATE POLICY "Users can add favorites"
ON public.favorites FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can remove favorites
CREATE POLICY "Users can delete own favorites"
ON public.favorites FOR DELETE
USING (auth.uid() = user_id);
