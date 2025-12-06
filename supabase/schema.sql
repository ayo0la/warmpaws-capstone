-- WarmPaws Database Schema for Supabase PostgreSQL
-- Migration from SQLite to Supabase
-- Run this script in the Supabase SQL Editor

-- Enable UUID extension for primary keys
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- PROFILES TABLE
-- Linked to Supabase Auth (auth.users)
-- Stores user profile information and role
-- ============================================================================

CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    phone TEXT,
    role TEXT DEFAULT 'buyer' CHECK(role IN ('buyer', 'seller', 'admin')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for role-based queries
CREATE INDEX idx_profiles_role ON profiles(role);

-- ============================================================================
-- PETS TABLE
-- Product listings for puppies and kittens
-- ============================================================================

CREATE TABLE pets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    seller_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('dog', 'cat')),
    breed TEXT NOT NULL,
    age_months INTEGER NOT NULL CHECK(age_months >= 0),
    price DECIMAL(10, 2) NOT NULL CHECK(price >= 0),
    description TEXT,
    location TEXT NOT NULL,
    gender TEXT CHECK(gender IN ('male', 'female')),
    vaccinated BOOLEAN DEFAULT FALSE,
    neutered BOOLEAN DEFAULT FALSE,
    status TEXT DEFAULT 'available' CHECK(status IN ('available', 'pending', 'sold', 'removed')),
    quantity INTEGER DEFAULT 1 CHECK(quantity >= 0),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX idx_pets_seller ON pets(seller_id);
CREATE INDEX idx_pets_status ON pets(status);
CREATE INDEX idx_pets_type ON pets(type);
CREATE INDEX idx_pets_price ON pets(price);
CREATE INDEX idx_pets_created_at ON pets(created_at DESC);

-- ============================================================================
-- PET_PHOTOS TABLE
-- Stores URLs and storage paths for pet images
-- ============================================================================

CREATE TABLE pet_photos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pet_id UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
    photo_url TEXT NOT NULL,
    storage_path TEXT NOT NULL, -- Path in Supabase Storage
    is_primary BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for pet photo lookups
CREATE INDEX idx_pet_photos_pet_id ON pet_photos(pet_id);
CREATE INDEX idx_pet_photos_primary ON pet_photos(pet_id, is_primary);

-- ============================================================================
-- ORDERS TABLE
-- Purchase transactions with fee calculations
-- ============================================================================

CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    buyer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    seller_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    pet_id UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
    quantity INTEGER DEFAULT 1 CHECK(quantity > 0),
    pet_price DECIMAL(10, 2) NOT NULL CHECK(pet_price >= 0),
    buyer_fee DECIMAL(10, 2) NOT NULL CHECK(buyer_fee >= 0),
    seller_fee DECIMAL(10, 2) NOT NULL CHECK(seller_fee >= 0),
    total_amount DECIMAL(10, 2) NOT NULL CHECK(total_amount >= 0),
    seller_payout DECIMAL(10, 2) NOT NULL CHECK(seller_payout >= 0),
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'paid', 'shipped', 'delivered', 'cancelled', 'refunded')),
    stripe_payment_id TEXT,
    buyer_email TEXT NOT NULL,
    buyer_phone TEXT,
    shipping_address JSONB NOT NULL, -- Flexible JSON structure for address
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for order queries
CREATE INDEX idx_orders_buyer ON orders(buyer_id);
CREATE INDEX idx_orders_seller ON orders(seller_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX idx_orders_stripe_payment ON orders(stripe_payment_id);

-- ============================================================================
-- MESSAGES TABLE
-- User-to-user messaging system
-- ============================================================================

CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    recipient_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    pet_id UUID REFERENCES pets(id) ON DELETE SET NULL, -- Optional reference to pet listing
    subject TEXT,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for message queries
CREATE INDEX idx_messages_sender ON messages(sender_id);
CREATE INDEX idx_messages_recipient ON messages(recipient_id);
CREATE INDEX idx_messages_recipient_unread ON messages(recipient_id, is_read);
CREATE INDEX idx_messages_created_at ON messages(created_at DESC);

-- ============================================================================
-- CART TABLE
-- Shopping cart for users
-- ============================================================================

CREATE TABLE cart (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    pet_id UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
    quantity INTEGER DEFAULT 1 CHECK(quantity > 0),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, pet_id) -- Prevent duplicate entries
);

-- Index for cart queries
CREATE INDEX idx_cart_user ON cart(user_id);

-- ============================================================================
-- REVIEWS TABLE (Future Feature)
-- Rating and review system for completed transactions
-- ============================================================================

CREATE TABLE reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    reviewer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    reviewee_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(order_id, reviewer_id) -- One review per order per reviewer
);

-- Indexes for review queries
CREATE INDEX idx_reviews_order ON reviews(order_id);
CREATE INDEX idx_reviews_reviewee ON reviews(reviewee_id);

-- ============================================================================
-- TRIGGERS
-- Auto-update timestamps
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to profiles table
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to pets table
CREATE TRIGGER update_pets_updated_at
    BEFORE UPDATE ON pets
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to orders table
CREATE TRIGGER update_orders_updated_at
    BEFORE UPDATE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- AUTH INTEGRATION
-- Automatically create profile when user signs up
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, first_name, last_name, role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
        COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
        COALESCE(NEW.raw_user_meta_data->>'role', 'buyer')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to execute on user creation
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- HELPER FUNCTIONS
-- Database functions for common operations
-- ============================================================================

-- Function to decrement pet quantity after purchase
-- Used by Stripe webhook to update inventory atomically
CREATE OR REPLACE FUNCTION decrement_pet_quantity(pet_id UUID, qty INTEGER)
RETURNS VOID AS $$
BEGIN
    UPDATE pets
    SET
        quantity = quantity - qty,
        status = CASE
            WHEN (quantity - qty) <= 0 THEN 'sold'
            ELSE status
        END,
        updated_at = NOW()
    WHERE id = pet_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get pet count by status
CREATE OR REPLACE FUNCTION get_pet_count_by_status(pet_status TEXT)
RETURNS INTEGER AS $$
DECLARE
    count INTEGER;
BEGIN
    SELECT COUNT(*) INTO count
    FROM pets
    WHERE status = pet_status;

    RETURN count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to calculate platform revenue
CREATE OR REPLACE FUNCTION calculate_platform_revenue()
RETURNS DECIMAL AS $$
DECLARE
    revenue DECIMAL;
BEGIN
    SELECT COALESCE(SUM(buyer_fee + seller_fee), 0) INTO revenue
    FROM orders
    WHERE status = 'paid';

    RETURN revenue;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- COMMENTS
-- Documentation for tables and columns
-- ============================================================================

COMMENT ON TABLE profiles IS 'User profiles linked to Supabase Auth';
COMMENT ON TABLE pets IS 'Pet listings (puppies and kittens) for sale';
COMMENT ON TABLE pet_photos IS 'Photos stored in Supabase Storage';
COMMENT ON TABLE orders IS 'Purchase transactions with fee calculations';
COMMENT ON TABLE messages IS 'User-to-user messaging system';
COMMENT ON TABLE cart IS 'Shopping cart items';
COMMENT ON TABLE reviews IS 'Reviews and ratings (future feature)';

COMMENT ON COLUMN orders.buyer_fee IS '5% fee charged to buyer';
COMMENT ON COLUMN orders.seller_fee IS '10% fee charged to seller';
COMMENT ON COLUMN orders.total_amount IS 'pet_price + buyer_fee (amount buyer pays)';
COMMENT ON COLUMN orders.seller_payout IS 'pet_price - seller_fee (amount seller receives)';

-- ============================================================================
-- SCHEMA COMPLETE
-- Next steps:
-- 1. Run rls-policies.sql to enable Row Level Security
-- 2. Configure Storage bucket for pet photos
-- 3. Enable Email/Password authentication in Supabase Dashboard
-- ============================================================================
