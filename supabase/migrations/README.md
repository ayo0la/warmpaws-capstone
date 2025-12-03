# Supabase Database Migrations

This directory contains SQL migration files to set up your WarmPaws database in Supabase.

## Running Migrations

### Option 1: Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard
2. Click on **SQL Editor** in the left sidebar
3. Run each migration file in order (001, 002, 003, etc.)
4. Copy and paste the entire contents of each file
5. Click **Run** to execute

### Option 2: Supabase CLI

```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Link your project
supabase link --project-ref your-project-ref

# Run all migrations
supabase db push
```

## Migration Order

**Run in this exact order:**

1. `001_enable_extensions.sql` - Enable PostgreSQL extensions (UUID, full-text search)
2. `002_create_profiles_table.sql` - User profiles table with auto-creation trigger
3. `003_create_listings_table.sql` - Pet listings table with search indexes
4. `004_create_pet_images_table.sql` - Pet images table for photos
5. `005_create_transactions_table.sql` - Payment transaction records
6. `006_create_favorites_table.sql` - User favorites/saved listings
7. `007_row_level_security_policies.sql` - RLS policies for security
8. `008_helper_functions.sql` - Helper functions for common operations

## What Each Migration Does

### 001 - Extensions
- Enables UUID generation
- Enables fuzzy text search

### 002 - Profiles Table
- Extends auth.users with custom fields
- Auto-creates profile on signup
- Tracks user role (buyer/seller/admin)

### 003 - Listings Table
- Stores pet postings
- Full-text search on breed/description
- Tracks views, quantity, status

### 004 - Pet Images Table
- Stores image URLs
- Links to Supabase Storage
- Supports primary image

### 005 - Transactions Table
- Payment records
- Stripe integration
- Fee tracking

### 006 - Favorites Table
- User saved listings
- Quick access to favorites

### 007 - RLS Policies
- Database-level security
- Controls who can view/edit data
- Prevents unauthorized access

### 008 - Helper Functions
- `decrement_listing_quantity()` - Update quantity after purchase
- `increment_listing_views()` - Track listing views
- `get_seller_stats()` - Seller dashboard statistics
- `search_listings()` - Full-text search

## Verifying Migrations

After running all migrations, verify with:

```sql
-- Check all tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- Should return:
-- favorites
-- listings
-- pet_images
-- profiles
-- transactions

-- Check RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public';

-- All tables should have rowsecurity = true
```

## Rollback (if needed)

If you need to start over:

```sql
-- WARNING: This deletes ALL data!
DROP TABLE IF EXISTS public.favorites CASCADE;
DROP TABLE IF EXISTS public.transactions CASCADE;
DROP TABLE IF EXISTS public.pet_images CASCADE;
DROP TABLE IF EXISTS public.listings CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- Then re-run migrations from 002 onwards
```

## Next Steps

After running migrations:

1. Set up Storage bucket for images (see main guide)
2. Configure RLS policies for Storage
3. Deploy Edge Functions for Stripe
4. Configure authentication providers
5. Test database access from frontend

## Troubleshooting

**Error: "extension does not exist"**
- Run migration 001 first

**Error: "relation does not exist"**
- Check you ran migrations in order
- Verify table was created successfully

**Error: "permission denied"**
- Check RLS policies are set up correctly
- Ensure user is authenticated

**Error: "duplicate key violation"**
- Table already exists
- Either drop table or skip migration

## Support

See the main `SUPABASE_IMPLEMENTATION_GUIDE.md` for full documentation.
