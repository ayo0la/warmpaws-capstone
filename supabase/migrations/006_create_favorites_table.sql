-- Create favorites table for users to save listings

CREATE TABLE public.favorites (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    listing_id UUID REFERENCES public.listings(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(user_id, listing_id)
);

-- Enable Row Level Security
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX idx_favorites_user ON public.favorites(user_id);
CREATE INDEX idx_favorites_listing ON public.favorites(listing_id);

-- Add comments
COMMENT ON TABLE public.favorites IS 'User saved/favorited listings';
