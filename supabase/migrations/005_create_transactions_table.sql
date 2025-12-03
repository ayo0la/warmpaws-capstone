-- Create transactions table for payment records

CREATE TABLE public.transactions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    listing_id UUID REFERENCES public.listings(id) NOT NULL,
    buyer_id UUID REFERENCES public.profiles(id) NOT NULL,
    seller_id UUID REFERENCES public.profiles(id) NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    pet_price NUMERIC(10, 2) NOT NULL,
    service_fee NUMERIC(10, 2) NOT NULL,
    platform_fee NUMERIC(10, 2) NOT NULL,
    total_amount NUMERIC(10, 2) NOT NULL,
    payment_status TEXT DEFAULT 'pending' CHECK (
        payment_status IN ('pending', 'completed', 'failed', 'refunded')
    ),
    payment_method TEXT,
    stripe_payment_intent_id TEXT UNIQUE,
    stripe_transfer_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,

    CONSTRAINT positive_amount CHECK (total_amount > 0)
);

-- Enable Row Level Security
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Indexes for queries
CREATE INDEX idx_transactions_buyer ON public.transactions(buyer_id);
CREATE INDEX idx_transactions_seller ON public.transactions(seller_id);
CREATE INDEX idx_transactions_listing ON public.transactions(listing_id);
CREATE INDEX idx_transactions_status ON public.transactions(payment_status);
CREATE INDEX idx_transactions_stripe ON public.transactions(stripe_payment_intent_id);
CREATE INDEX idx_transactions_created ON public.transactions(created_at DESC);

-- Add comments
COMMENT ON TABLE public.transactions IS 'Payment transaction records';
COMMENT ON COLUMN public.transactions.service_fee IS '5% buyer fee';
COMMENT ON COLUMN public.transactions.platform_fee IS '10% seller fee (kept by platform)';
COMMENT ON COLUMN public.transactions.stripe_payment_intent_id IS 'Stripe Payment Intent ID';
