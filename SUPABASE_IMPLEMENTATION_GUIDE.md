# WarmPaws - Supabase Implementation Guide

**Backend:** Supabase (PostgreSQL + Auth + Storage + Edge Functions)
**Estimated Timeline:** 6-8 weeks
**Cost:** Free tier (up to 500MB database, 1GB storage, 2GB bandwidth)

---

## Table of Contents
1. [Why Supabase](#why-supabase)
2. [Project Setup](#project-setup)
3. [Database Schema & Migrations](#database-schema--migrations)
4. [Authentication Setup](#authentication-setup)
5. [Storage Configuration](#storage-configuration)
6. [Row Level Security (RLS)](#row-level-security-rls)
7. [Edge Functions for Stripe](#edge-functions-for-stripe)
8. [Frontend Integration](#frontend-integration)
9. [Step-by-Step Implementation](#step-by-step-implementation)
10. [Deployment](#deployment)

---

## Why Supabase?

### Benefits for WarmPaws
✅ **PostgreSQL Database** - Production-ready, with instant REST API
✅ **Built-in Authentication** - Email, OAuth (Google, Facebook), magic links
✅ **Storage** - S3-compatible object storage for pet images
✅ **Real-time** - Live updates for new listings
✅ **Row Level Security** - Database-level authorization
✅ **Edge Functions** - Serverless functions for Stripe payments
✅ **Free Tier** - Perfect for MVP launch
✅ **Auto-generated API** - No need to build REST endpoints manually

### What Supabase Replaces
- ❌ ~~Custom Express/FastAPI backend~~
- ❌ ~~Manual JWT implementation~~
- ❌ ~~AWS S3 setup~~
- ❌ ~~Session management~~
- ❌ ~~CORS configuration~~
- ❌ ~~Database connection pooling~~

### What You Still Need
- ✅ Frontend (React/Vue/Vanilla JS)
- ✅ Stripe for payments
- ✅ Email service (can use Supabase's built-in)
- ✅ Domain and hosting (Vercel/Netlify)

---

## Project Setup

### Step 1: Create Supabase Project

1. Go to [https://supabase.com](https://supabase.com)
2. Sign up / Log in
3. Click "New Project"
4. Fill in:
   - **Name:** warmpaws
   - **Database Password:** (generate strong password)
   - **Region:** Choose closest to your users
   - **Pricing Plan:** Free (start here)

5. Wait 2-3 minutes for provisioning

### Step 2: Get Your Credentials

After project is created, go to **Settings > API**:

```bash
# Save these to your .env file
VITE_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... # KEEP SECRET!
```

**Important:**
- `ANON_KEY` - Safe for frontend (public)
- `SERVICE_ROLE_KEY` - Backend only, bypasses RLS (never expose!)

### Step 3: Install Supabase Client

```bash
# For React/Vue/Vanilla JS
npm install @supabase/supabase-js

# For TypeScript (recommended)
npm install @supabase/supabase-js @supabase/auth-helpers-react
```

---

## Database Schema & Migrations

### Overview
Supabase uses PostgreSQL. You'll create tables using SQL migrations in the Supabase dashboard.

### Complete Database Schema

Go to **SQL Editor** in Supabase dashboard and run these migrations:

#### Migration 1: Enable Extensions

```sql
-- Enable UUID extension for generating IDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable pg_trgm for fuzzy text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```

#### Migration 2: Create Users Profile Table

```sql
-- Extends Supabase's auth.users table with custom profile data
CREATE TABLE public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    first_name TEXT,
    last_name TEXT,
    phone TEXT,
    role TEXT DEFAULT 'buyer' CHECK (role IN ('buyer', 'seller', 'admin')),
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, role)
    VALUES (NEW.id, NEW.email, 'buyer');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Indexes
CREATE INDEX idx_profiles_email ON public.profiles(email);
CREATE INDEX idx_profiles_role ON public.profiles(role);
```

#### Migration 3: Create Listings Table

```sql
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

-- Enable RLS
ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;

-- Full-text search index
CREATE INDEX idx_listings_search ON public.listings
USING GIN (to_tsvector('english', breed || ' ' || description));

-- Other indexes
CREATE INDEX idx_listings_seller ON public.listings(seller_id);
CREATE INDEX idx_listings_status ON public.listings(status);
CREATE INDEX idx_listings_pet_type ON public.listings(pet_type);
CREATE INDEX idx_listings_created ON public.listings(created_at DESC);
CREATE INDEX idx_listings_price ON public.listings(price);

-- Auto-update updated_at
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON public.listings
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();
```

#### Migration 4: Create Pet Images Table

```sql
CREATE TABLE public.pet_images (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    listing_id UUID REFERENCES public.listings(id) ON DELETE CASCADE NOT NULL,
    storage_path TEXT NOT NULL,
    public_url TEXT NOT NULL,
    is_primary BOOLEAN DEFAULT FALSE,
    display_order INTEGER DEFAULT 0,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.pet_images ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX idx_images_listing ON public.pet_images(listing_id);
CREATE INDEX idx_images_primary ON public.pet_images(listing_id, is_primary);

-- Ensure only one primary image per listing
CREATE UNIQUE INDEX idx_one_primary_per_listing
ON public.pet_images(listing_id)
WHERE is_primary = TRUE;
```

#### Migration 5: Create Transactions Table

```sql
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

-- Enable RLS
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX idx_transactions_buyer ON public.transactions(buyer_id);
CREATE INDEX idx_transactions_seller ON public.transactions(seller_id);
CREATE INDEX idx_transactions_listing ON public.transactions(listing_id);
CREATE INDEX idx_transactions_status ON public.transactions(payment_status);
CREATE INDEX idx_transactions_stripe ON public.transactions(stripe_payment_intent_id);
```

#### Migration 6: Create Favorites Table

```sql
CREATE TABLE public.favorites (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    listing_id UUID REFERENCES public.listings(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(user_id, listing_id)
);

-- Enable RLS
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX idx_favorites_user ON public.favorites(user_id);
CREATE INDEX idx_favorites_listing ON public.favorites(listing_id);
```

---

## Row Level Security (RLS)

RLS is Supabase's security model. It enforces access control at the database level.

### Profiles Policies

```sql
-- Users can view all public profiles
CREATE POLICY "Public profiles are viewable by everyone"
ON public.profiles FOR SELECT
USING (true);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = id);

-- Users can insert their own profile (handled by trigger)
CREATE POLICY "Users can insert own profile"
ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = id);
```

### Listings Policies

```sql
-- Anyone can view active listings
CREATE POLICY "Active listings are viewable by everyone"
ON public.listings FOR SELECT
USING (status = 'active' OR seller_id = auth.uid());

-- Sellers can create listings
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
```

### Pet Images Policies

```sql
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
```

### Transactions Policies

```sql
-- Buyers can view their own purchases
CREATE POLICY "Buyers can view own purchases"
ON public.transactions FOR SELECT
USING (auth.uid() = buyer_id);

-- Sellers can view their own sales
CREATE POLICY "Sellers can view own sales"
ON public.transactions FOR SELECT
USING (auth.uid() = seller_id);

-- Only backend can insert transactions (via service role)
-- No INSERT policy for regular users
```

### Favorites Policies

```sql
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
```

---

## Authentication Setup

### Configure Auth Providers

Go to **Authentication > Providers** in Supabase dashboard:

#### 1. Email Authentication
- Already enabled by default
- Configure email templates:
  - **Confirm signup:** Customize welcome email
  - **Magic Link:** For passwordless login
  - **Reset Password:** Password reset email

#### 2. Google OAuth
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create OAuth 2.0 credentials
3. Add authorized redirect URI:
   ```
   https://xxxxxxxxxxxxx.supabase.co/auth/v1/callback
   ```
4. Copy Client ID and Secret to Supabase

#### 3. Facebook OAuth
1. Go to [Facebook Developers](https://developers.facebook.com)
2. Create app
3. Add Facebook Login product
4. Add redirect URI:
   ```
   https://xxxxxxxxxxxxx.supabase.co/auth/v1/callback
   ```
5. Copy App ID and Secret to Supabase

### Email Templates

Go to **Authentication > Email Templates** and customize:

#### Confirm Signup Email
```html
<h2>Welcome to Warm Paws!</h2>
<p>Click the link below to confirm your email address:</p>
<p><a href="{{ .ConfirmationURL }}">Confirm Email</a></p>
```

#### Reset Password Email
```html
<h2>Reset Your Password</h2>
<p>Click the link below to reset your password:</p>
<p><a href="{{ .ConfirmationURL }}">Reset Password</a></p>
<p>This link expires in 1 hour.</p>
```

---

## Storage Configuration

### Create Storage Buckets

Go to **Storage** in Supabase dashboard:

#### 1. Create "pet-images" Bucket
```sql
-- Run in SQL Editor
INSERT INTO storage.buckets (id, name, public)
VALUES ('pet-images', 'pet-images', true);
```

Or use the UI:
- Click "New Bucket"
- Name: `pet-images`
- Public: ✅ (images need to be publicly accessible)

#### 2. Set Up Storage Policies

```sql
-- Allow authenticated users to upload images
CREATE POLICY "Authenticated users can upload pet images"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'pet-images'
    AND auth.role() = 'authenticated'
);

-- Allow users to update their own images
CREATE POLICY "Users can update own images"
ON storage.objects FOR UPDATE
USING (
    bucket_id = 'pet-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to delete their own images
CREATE POLICY "Users can delete own images"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'pet-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Everyone can view public images
CREATE POLICY "Anyone can view pet images"
ON storage.objects FOR SELECT
USING (bucket_id = 'pet-images');
```

#### 3. Configure File Upload Limits

Go to **Storage > pet-images > Configuration**:
- Max file size: **5 MB**
- Allowed MIME types: `image/jpeg`, `image/png`, `image/webp`

---

## Edge Functions for Stripe

Edge Functions are Supabase's serverless functions (Deno runtime).

### Setup Edge Functions

```bash
# Install Supabase CLI
npm install -g supabase

# Login
supabase login

# Link to your project
supabase link --project-ref xxxxxxxxxxxxx

# Create functions directory
supabase functions new create-checkout
supabase functions new stripe-webhook
```

### Function 1: Create Checkout Session

**File:** `supabase/functions/create-checkout/index.ts`

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import Stripe from 'https://esm.sh/stripe@11.1.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2022-11-15',
})

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

serve(async (req) => {
  try {
    // Get authenticated user
    const authHeader = req.headers.get('Authorization')!
    const token = authHeader.replace('Bearer ', '')
    const { data: { user } } = await supabase.auth.getUser(token)

    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Parse request body
    const { listingId, quantity } = await req.json()

    // Get listing details
    const { data: listing, error: listingError } = await supabase
      .from('listings')
      .select('*, profiles!seller_id(*)')
      .eq('id', listingId)
      .single()

    if (listingError || !listing) {
      return new Response(JSON.stringify({ error: 'Listing not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Check availability
    if (listing.quantity_available < quantity) {
      return new Response(JSON.stringify({ error: 'Not enough pets available' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Calculate fees
    const petPrice = parseFloat(listing.price) * quantity
    const serviceFee = petPrice * 0.05 // 5% buyer fee
    const platformFee = petPrice * 0.10 // 10% seller fee
    const totalAmount = petPrice + serviceFee

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `${listing.breed} ${listing.pet_type}`,
              description: `Quantity: ${quantity}`,
              images: [], // Add image URLs here
            },
            unit_amount: Math.round(totalAmount * 100), // Convert to cents
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${Deno.env.get('FRONTEND_URL')}/purchase-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${Deno.env.get('FRONTEND_URL')}/listing/${listingId}`,
      metadata: {
        listingId,
        buyerId: user.id,
        sellerId: listing.seller_id,
        quantity: quantity.toString(),
        petPrice: petPrice.toString(),
        serviceFee: serviceFee.toString(),
        platformFee: platformFee.toString(),
      },
    })

    return new Response(JSON.stringify({ sessionId: session.id, url: session.url }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
```

### Function 2: Stripe Webhook Handler

**File:** `supabase/functions/stripe-webhook/index.ts`

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import Stripe from 'https://esm.sh/stripe@11.1.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2022-11-15',
})

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

serve(async (req) => {
  const signature = req.headers.get('stripe-signature')!
  const body = await req.text()

  try {
    // Verify webhook signature
    const event = stripe.webhooks.constructEvent(
      body,
      signature,
      Deno.env.get('STRIPE_WEBHOOK_SECRET')!
    )

    // Handle different event types
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session
      const metadata = session.metadata!

      // Create transaction record
      const { data, error } = await supabase
        .from('transactions')
        .insert({
          listing_id: metadata.listingId,
          buyer_id: metadata.buyerId,
          seller_id: metadata.sellerId,
          quantity: parseInt(metadata.quantity),
          pet_price: parseFloat(metadata.petPrice),
          service_fee: parseFloat(metadata.serviceFee),
          platform_fee: parseFloat(metadata.platformFee),
          total_amount: session.amount_total! / 100,
          payment_status: 'completed',
          stripe_payment_intent_id: session.payment_intent as string,
          completed_at: new Date().toISOString(),
        })

      if (error) throw error

      // Update listing quantity
      await supabase.rpc('decrement_listing_quantity', {
        listing_id: metadata.listingId,
        qty: parseInt(metadata.quantity),
      })

      // TODO: Send confirmation emails
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
```

### Helper Function: Decrement Quantity

Run in SQL Editor:

```sql
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
        END
    WHERE id = listing_id;
END;
$$ LANGUAGE plpgsql;
```

### Deploy Edge Functions

```bash
# Set environment variables
supabase secrets set STRIPE_SECRET_KEY=sk_test_...
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
supabase secrets set FRONTEND_URL=http://localhost:5173

# Deploy functions
supabase functions deploy create-checkout
supabase functions deploy stripe-webhook

# Get function URLs
supabase functions list
```

### Configure Stripe Webhook

1. Go to Stripe Dashboard > Developers > Webhooks
2. Add endpoint: `https://xxxxxxxxxxxxx.supabase.co/functions/v1/stripe-webhook`
3. Select events: `checkout.session.completed`
4. Copy webhook secret to Supabase secrets

---

## Frontend Integration

### Setup Supabase Client

**File:** `src/lib/supabase.js`

```javascript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

### Authentication Examples

#### User Registration

```javascript
import { supabase } from './lib/supabase'

async function signUp(email, password, firstName, lastName) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        first_name: firstName,
        last_name: lastName,
      }
    }
  })

  if (error) {
    console.error('Error signing up:', error.message)
    return
  }

  console.log('Check your email for verification link')
}
```

#### User Login

```javascript
async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    console.error('Error signing in:', error.message)
    return
  }

  console.log('Logged in:', data.user)
}
```

#### Google OAuth

```javascript
async function signInWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`
    }
  })
}
```

#### Get Current User

```javascript
const { data: { user } } = await supabase.auth.getUser()
console.log('Current user:', user)
```

#### Sign Out

```javascript
async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) console.error('Error signing out:', error.message)
}
```

### Database Operations

#### Fetch All Listings

```javascript
const { data: listings, error } = await supabase
  .from('listings')
  .select(`
    *,
    profiles:seller_id (first_name, last_name, email),
    pet_images (*)
  `)
  .eq('status', 'active')
  .order('created_at', { ascending: false })
  .limit(20)

console.log('Listings:', listings)
```

#### Search with Filters

```javascript
let query = supabase
  .from('listings')
  .select('*, profiles:seller_id(*), pet_images(*)')
  .eq('status', 'active')

// Filter by pet type
if (petType) {
  query = query.eq('pet_type', petType)
}

// Filter by price range
if (minPrice) {
  query = query.gte('price', minPrice)
}
if (maxPrice) {
  query = query.lte('price', maxPrice)
}

// Full-text search
if (searchTerm) {
  query = query.textSearch('breed', searchTerm)
}

// Sort
query = query.order('created_at', { ascending: false })

const { data, error } = await query
```

#### Create New Listing

```javascript
async function createListing(listingData) {
  const { data: { user } } = await supabase.auth.getUser()

  const { data, error } = await supabase
    .from('listings')
    .insert({
      seller_id: user.id,
      pet_type: listingData.petType,
      breed: listingData.breed,
      age_weeks: listingData.ageWeeks,
      price: listingData.price,
      quantity_available: listingData.quantity,
      description: listingData.description,
      location: listingData.location,
      seller_contact: listingData.contact,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating listing:', error.message)
    return null
  }

  return data
}
```

### Image Upload

```javascript
async function uploadImage(file, listingId) {
  const { data: { user } } = await supabase.auth.getUser()

  // Generate unique filename
  const fileExt = file.name.split('.').pop()
  const fileName = `${user.id}/${listingId}/${Date.now()}.${fileExt}`

  // Upload to storage
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('pet-images')
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: false
    })

  if (uploadError) {
    console.error('Error uploading:', uploadError.message)
    return null
  }

  // Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from('pet-images')
    .getPublicUrl(fileName)

  // Save to database
  const { data, error } = await supabase
    .from('pet_images')
    .insert({
      listing_id: listingId,
      storage_path: fileName,
      public_url: publicUrl,
      is_primary: false,
      display_order: 0,
    })
    .select()
    .single()

  return data
}
```

### Initiate Checkout

```javascript
async function purchasePet(listingId, quantity) {
  const { data: { session } } = await supabase.auth.getSession()

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-checkout`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ listingId, quantity }),
    }
  )

  const { url } = await response.json()

  // Redirect to Stripe Checkout
  window.location.href = url
}
```

### Real-time Updates

```javascript
// Subscribe to new listings
const channel = supabase
  .channel('listings-changes')
  .on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'listings'
    },
    (payload) => {
      console.log('New listing:', payload.new)
      // Update UI with new listing
    }
  )
  .subscribe()

// Unsubscribe when component unmounts
channel.unsubscribe()
```

---

## Step-by-Step Implementation

### Week 1-2: Foundation

#### Day 1-2: Supabase Setup
- [ ] Create Supabase project
- [ ] Run all database migrations
- [ ] Set up RLS policies
- [ ] Create storage bucket
- [ ] Configure storage policies

#### Day 3-4: Frontend Setup
- [ ] Create React/Vue project with Vite
- [ ] Install Supabase client
- [ ] Set up environment variables
- [ ] Create Supabase client file
- [ ] Test connection

#### Day 5-7: Authentication UI
- [ ] Build registration form
- [ ] Build login form
- [ ] Add Google/Facebook OAuth buttons
- [ ] Implement password reset
- [ ] Create auth context/store
- [ ] Add protected routes

### Week 3-4: Core Features

#### Day 8-10: Browse Listings
- [ ] Create browse page component
- [ ] Fetch listings from Supabase
- [ ] Implement filters (type, price, location)
- [ ] Add search functionality
- [ ] Implement pagination
- [ ] Add loading states

#### Day 11-14: Listing Details & Creation
- [ ] Build listing detail page
- [ ] Create "Post a Pet" form
- [ ] Implement image upload
- [ ] Add image preview
- [ ] Handle form submission
- [ ] Add validation

### Week 5-6: Payments & Transactions

#### Day 15-17: Stripe Integration
- [ ] Create Stripe account
- [ ] Deploy Edge Functions
- [ ] Configure webhooks
- [ ] Test checkout flow (test mode)
- [ ] Handle success/cancel redirects
- [ ] Display transaction history

#### Day 18-21: User Dashboards
- [ ] Build buyer dashboard (purchases, favorites)
- [ ] Build seller dashboard (listings, sales)
- [ ] Add edit/delete listing functionality
- [ ] Show earnings & payouts
- [ ] Add profile settings page

### Week 7: Polish & Testing

#### Day 22-24: UX Improvements
- [ ] Add loading spinners
- [ ] Implement toast notifications
- [ ] Add error handling
- [ ] Improve mobile responsiveness
- [ ] Optimize images
- [ ] Add favorites functionality

#### Day 25-28: Testing
- [ ] Test all user flows
- [ ] Test payment flow thoroughly
- [ ] Test RLS policies
- [ ] Security audit
- [ ] Performance testing
- [ ] Cross-browser testing

### Week 8: Deployment

#### Day 29-30: Production Deployment
- [ ] Deploy frontend to Vercel/Netlify
- [ ] Configure custom domain
- [ ] Set up SSL
- [ ] Switch Stripe to live mode
- [ ] Set up monitoring (Sentry)
- [ ] Final security check

#### Day 31: Launch
- [ ] Create test transactions
- [ ] Monitor for errors
- [ ] Prepare support documentation
- [ ] Launch announcement
- [ ] Monitor user feedback

---

## Deployment

### Frontend Deployment (Vercel)

```bash
# Install Vercel CLI
npm install -g vercel

# Build your frontend
npm run build

# Deploy
vercel --prod

# Set environment variables in Vercel dashboard
VITE_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...
```

### Environment Variables

**Frontend (.env)**
```bash
VITE_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_...
```

**Supabase Secrets (Edge Functions)**
```bash
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
FRONTEND_URL=https://warmpaws.com
```

### Post-Deployment Checklist

- [ ] Custom domain configured
- [ ] SSL certificate active
- [ ] Stripe live mode enabled
- [ ] Email templates customized
- [ ] OAuth redirects updated
- [ ] Monitoring enabled
- [ ] Backups configured
- [ ] Error tracking setup (Sentry)
- [ ] Analytics installed (Google Analytics)

---

## Cost Breakdown (Supabase Architecture)

### Free Tier Limits
- Database: 500 MB
- Storage: 1 GB
- Bandwidth: 2 GB/month
- Edge Functions: 500K invocations/month
- Auth users: Unlimited

### Paid Tier (Pro: $25/month)
- Database: 8 GB
- Storage: 100 GB
- Bandwidth: 50 GB/month
- Edge Functions: 2M invocations/month
- Daily backups
- No pausing
- Email support

### Total Monthly Costs

**MVP Launch (Free Tier)**
- Supabase: $0
- Vercel: $0 (hobby tier)
- Domain: $12/year = $1/month
- Stripe: 2.9% + $0.30 per transaction
- **Total: ~$1/month + transaction fees**

**Production (1000+ users/day)**
- Supabase Pro: $25/month
- Vercel Pro: $20/month
- Domain: $1/month
- Monitoring (Sentry): $26/month
- Email (SendGrid): $15/month
- **Total: ~$87/month + transaction fees**

---

## Next Steps

1. **Create Supabase account** and project
2. **Run database migrations** in SQL Editor
3. **Set up storage bucket** for images
4. **Deploy Edge Functions** for Stripe
5. **Build frontend** with React/Vue
6. **Test thoroughly** in development
7. **Deploy to production**

---

## Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Supabase Auth Guide](https://supabase.com/docs/guides/auth)
- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)
- [Supabase Storage](https://supabase.com/docs/guides/storage)
- [Edge Functions](https://supabase.com/docs/guides/functions)
- [Stripe + Supabase](https://supabase.com/partners/integrations/stripe)

---

**Ready to start building?** Follow the step-by-step implementation guide and you'll have a functional MVP in 6-8 weeks! 🚀
