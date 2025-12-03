# WarmPaws Supabase Quick Start

Get your backend running in 30 minutes! ⚡

## Prerequisites

- [x] Supabase account (free)
- [x] Node.js 18+ installed
- [x] Git installed

## Step 1: Create Supabase Project (5 min)

1. Go to [https://supabase.com](https://supabase.com)
2. Sign up / Log in
3. Click **"New Project"**
4. Fill in:
   - Name: `warmpaws`
   - Database Password: **(save this!)**
   - Region: **Choose closest to you**
   - Plan: **Free**
5. Wait 2-3 minutes for provisioning

## Step 2: Run Database Migrations (10 min)

1. In Supabase dashboard, click **"SQL Editor"**
2. Copy/paste each migration file from `supabase/migrations/` folder
3. Run them **in order** (001, 002, 003...):
   ```
   ✅ 001_enable_extensions.sql
   ✅ 002_create_profiles_table.sql
   ✅ 003_create_listings_table.sql
   ✅ 004_create_pet_images_table.sql
   ✅ 005_create_transactions_table.sql
   ✅ 006_create_favorites_table.sql
   ✅ 007_row_level_security_policies.sql
   ✅ 008_helper_functions.sql
   ```
4. Verify: Go to **Table Editor** - you should see 5 tables

## Step 3: Set Up Image Storage (5 min)

1. Click **"Storage"** in sidebar
2. Click **"New Bucket"**
3. Name: `pet-images`
4. Public: **✅ ON**
5. Click **"Create bucket"**

6. Go to **"Policies"** tab in the bucket
7. Click **"New Policy"** → **"Get started quickly"**
8. Enable all operations for authenticated users

## Step 4: Configure Authentication (5 min)

### Email Auth (already enabled)
1. Go to **Authentication** → **Email Templates**
2. Customize "Confirm signup" and "Reset password" emails
3. Update sender name to "Warm Paws"

### Optional: Google OAuth
1. Go to **Authentication** → **Providers**
2. Find **Google**
3. Follow instructions to get Client ID/Secret from Google Cloud
4. Save

### Optional: Facebook OAuth
1. Same steps for **Facebook** provider
2. Get App ID/Secret from Facebook Developers

## Step 5: Get Your API Keys (2 min)

1. Go to **Settings** → **API**
2. Copy these values:

```env
VITE_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...
```

3. Save to `.env` file in your project root

## Step 6: Test Connection (3 min)

Create a test file:

```javascript
// test-connection.js
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'YOUR_SUPABASE_URL',
  'YOUR_ANON_KEY'
)

async function test() {
  // Test database connection
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .limit(1)

  if (error) {
    console.error('❌ Error:', error.message)
  } else {
    console.log('✅ Connected! Database ready.')
  }
}

test()
```

Run:
```bash
npm install @supabase/supabase-js
node test-connection.js
```

You should see: `✅ Connected! Database ready.`

## You're Done! 🎉

Your backend is now ready with:
- ✅ PostgreSQL database
- ✅ User authentication
- ✅ Image storage
- ✅ Row-level security
- ✅ Auto-generated REST API

## Next Steps

### For Development:

1. **Set up Stripe** (for payments)
   - Create Stripe account
   - Get API keys
   - Deploy Edge Functions (see guide)

2. **Build Frontend**
   - Install React/Vue
   - Add Supabase client
   - Build UI components
   - Connect to API

3. **Test Features**
   - User signup/login
   - Create listing
   - Upload images
   - Browse listings

### Quick Frontend Setup

```bash
# Create React app with Vite
npm create vite@latest warmpaws-frontend -- --template react

cd warmpaws-frontend

# Install Supabase client
npm install @supabase/supabase-js

# Create .env file
echo "VITE_SUPABASE_URL=your_url_here" > .env
echo "VITE_SUPABASE_ANON_KEY=your_key_here" >> .env

# Start development server
npm run dev
```

## Helpful Commands

```bash
# View database tables
# Go to: Table Editor in Supabase dashboard

# View API documentation
# Go to: API Docs in Supabase dashboard

# Check authentication
# Go to: Authentication in Supabase dashboard

# View storage files
# Go to: Storage in Supabase dashboard

# Run SQL queries
# Go to: SQL Editor in Supabase dashboard
```

## Troubleshooting

**Can't connect to database?**
- Check your internet connection
- Verify API keys are correct
- Check if Supabase project is paused (free tier pauses after 1 week inactivity)

**RLS errors when querying?**
- Make sure you ran migration 007 (RLS policies)
- Check if user is authenticated
- Verify policy matches your query

**Can't upload images?**
- Check bucket name is `pet-images`
- Verify bucket is set to public
- Check storage policies are configured

**Authentication not working?**
- Verify email templates are set up
- Check spam folder for verification email
- Ensure redirect URLs are configured

## Resources

- 📚 [Full Implementation Guide](./SUPABASE_IMPLEMENTATION_GUIDE.md)
- 📚 [Migrations README](./migrations/README.md)
- 🌐 [Supabase Documentation](https://supabase.com/docs)
- 💬 [Supabase Discord](https://discord.supabase.com)

## Need Help?

1. Check the full implementation guide
2. Review Supabase docs
3. Ask in Supabase Discord
4. Open an issue on GitHub

---

**Estimated Total Time:** 30 minutes ⏱️
**Difficulty:** Beginner-friendly ✨
**Cost:** $0 (free tier) 💰
