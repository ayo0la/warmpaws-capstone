-- Create pet_images table for storing listing photos

CREATE TABLE public.pet_images (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    listing_id UUID REFERENCES public.listings(id) ON DELETE CASCADE NOT NULL,
    storage_path TEXT NOT NULL,
    public_url TEXT NOT NULL,
    is_primary BOOLEAN DEFAULT FALSE,
    display_order INTEGER DEFAULT 0,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.pet_images ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX idx_images_listing ON public.pet_images(listing_id);
CREATE INDEX idx_images_primary ON public.pet_images(listing_id, is_primary);
CREATE INDEX idx_images_order ON public.pet_images(listing_id, display_order);

-- Ensure only one primary image per listing
CREATE UNIQUE INDEX idx_one_primary_per_listing
ON public.pet_images(listing_id)
WHERE is_primary = TRUE;

-- Add comments
COMMENT ON TABLE public.pet_images IS 'Photos for pet listings';
COMMENT ON COLUMN public.pet_images.storage_path IS 'Path in Supabase Storage bucket';
COMMENT ON COLUMN public.pet_images.is_primary IS 'Whether this is the main listing photo';
COMMENT ON COLUMN public.pet_images.display_order IS 'Order to display images (0 = first)';
