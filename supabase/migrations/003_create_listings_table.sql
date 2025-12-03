-- Create listings table for pet postings

CREATE TABLE public.listings (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    seller_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    pet_type TEXT NOT NULL CHECK (pet_type IN ('puppies', 'kittens')),
    breed TEXT NOT NULL,
    age_weeks INTEGER NOT NULL CHECK (age_weeks >= 0 AND age_weeks <= 52),
    price NUMERIC(10, 2) NOT NULL CHECK (price > 0),
    quantity_available INTEGER NOT NULL CHECK (quantity_available >= 0),
    quantity_sold INTEGER DEFAULT 0 CHECK (quantity_sold >= 0),
    description TEXT NOT NULL,
    location TEXT NOT NULL,
    seller_contact TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'sold_out', 'suspended', 'deleted')),
    views INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;

-- Full-text search index for breed and description
CREATE INDEX idx_listings_search ON public.listings
USING GIN (to_tsvector('english', breed || ' ' || description));

-- Performance indexes
CREATE INDEX idx_listings_seller ON public.listings(seller_id);
CREATE INDEX idx_listings_status ON public.listings(status);
CREATE INDEX idx_listings_pet_type ON public.listings(pet_type);
CREATE INDEX idx_listings_created ON public.listings(created_at DESC);
CREATE INDEX idx_listings_price ON public.listings(price);
CREATE INDEX idx_listings_location ON public.listings(location);

-- Auto-update updated_at timestamp
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON public.listings
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Add comments
COMMENT ON TABLE public.listings IS 'Pet listings posted by sellers';
COMMENT ON COLUMN public.listings.status IS 'Listing status: active, sold_out, suspended, or deleted';
COMMENT ON COLUMN public.listings.views IS 'Number of times listing has been viewed';
