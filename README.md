# WarmPaws - Pet Marketplace Platform

A modern, full-stack e-commerce marketplace for buying and selling puppies and kittens. Built with Supabase, Stripe, and vanilla JavaScript.

## Features

- User authentication and authorization with role-based access control
- Pet listing management for sellers
- Shopping cart and checkout system
- Secure payment processing with Stripe
- Real-time messaging between buyers and sellers
- Admin dashboard for platform management
- Photo upload and storage
- Order tracking and management

## Tech Stack

**Frontend:**
- HTML5, CSS3, Vanilla JavaScript
- Responsive design

**Backend:**
- Supabase (PostgreSQL database, authentication, storage)
- Express.js (Stripe payment server only)
- Node.js

**Payments:**
- Stripe (payment processing)

**Hosting:**
- Supabase (database, auth, storage - free tier)
- Railway/Render/Vercel (Stripe server deployment)

## Prerequisites

- Node.js (v14 or higher)
- npm (comes with Node.js)
- Supabase account (free tier available)
- Stripe account (test mode available)

## Installation & Setup

### 1. Clone the Repository

```bash
git clone <repository-url>
cd project
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Supabase

1. Create a free account at [supabase.com](https://supabase.com)
2. Create a new project
3. Run the SQL scripts in order:
   - Navigate to SQL Editor in Supabase Dashboard
   - Run `supabase/schema.sql` - Creates all tables and functions
   - Run `supabase/rls-policies.sql` - Sets up security policies
4. Create storage bucket:
   - Go to Storage → Create bucket
   - Name: `pet-photos`
   - Make it public
5. Copy your project credentials:
   - Go to Settings → API
   - Copy the `Project URL` and `anon public` key

### 4. Configure Environment Variables

Create/update `.env` file in the project root:

```env
# Supabase Configuration
SUPABASE_URL=your-project-url
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-role-key

# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_your_test_key
STRIPE_PUBLIC_KEY=pk_test_your_test_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# Server Configuration
PORT=3001
NODE_ENV=development

# Platform Fees (percentage)
BUYER_FEE=5
SELLER_FEE=10

# Application URL
APP_URL=http://localhost:3000
ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

### 5. Update Frontend Configuration

Edit `js/supabase-client.js` with your Supabase credentials:

```javascript
const SUPABASE_URL = 'your-project-url';
const SUPABASE_ANON_KEY = 'your-anon-key';
```

### 6. Create Test Data (Optional)

```bash
node testing/setup-test-data.js
```

This creates sample users and pets for testing:
- seller1@warmpaws.test / seller2@warmpaws.test
- buyer1@warmpaws.test
- Password for all: `TestPassword123!`

### 7. Start the Application

**Option A: Frontend Only (if using Supabase hosted functions)**
```bash
# Open index.html in your browser
open index.html
```

**Option B: With Stripe Payment Server**
```bash
# Terminal 1 - Start Stripe server
npm run stripe:dev

# Terminal 2 - Serve frontend
npx http-server -p 3000
```

The application will be available at `http://localhost:3000`

## Project Structure

```
project/
├── js/                          # Frontend JavaScript
│   ├── supabase-client.js      # Supabase initialization
│   ├── api.js                  # API functions (Supabase queries)
│   ├── utils.js                # Utility functions
│   └── *.js                    # Page-specific scripts
├── server/                      # Backend (Stripe only)
│   └── stripe-server.js        # Payment processing server
├── supabase/                    # Database setup
│   ├── schema.sql              # Database schema
│   └── rls-policies.sql        # Security policies
├── testing/                     # Test utilities
│   ├── api-test.js             # Automated test suite
│   └── setup-test-data.js      # Test data generator
├── images/                      # Static assets
├── uploads/                     # Local file storage (legacy)
├── *.html                       # Frontend pages
├── project.css                  # Global styles
├── package.json                # Dependencies
└── .env                        # Configuration (do not commit)
```

## User Roles

### Buyer
- Browse and search pets
- Add pets to cart
- Complete purchases
- View order history
- Message sellers

### Seller
- Create pet listings
- Upload pet photos
- Manage inventory
- View sales
- Respond to buyer messages

### Admin
- View platform statistics
- Manage all users
- Manage all listings
- Access all orders

## Database Schema

### Tables
- **profiles** - User accounts and profiles
- **pets** - Pet listings
- **pet_photos** - Pet images
- **cart** - Shopping cart items
- **orders** - Purchase records
- **messages** - User communications
- **reviews** - Buyer/seller ratings (future)

### Security
All tables are protected with Row Level Security (RLS) policies:
- Users can only access their own data
- Sellers can only modify their own listings
- Buyers can only view available pets
- Admins have elevated permissions

## Payment Flow

1. Buyer adds pets to cart
2. Proceeds to checkout
3. Frontend calls Stripe server to create PaymentIntent
4. Stripe handles secure payment collection
5. Webhook confirms payment and updates order status
6. Inventory is automatically decremented

**Platform Fees:**
- Buyer pays 5% service fee
- Seller pays 10% commission
- Example: $1,000 pet → Buyer pays $1,050, Seller receives $900

## Testing

### Run Automated Tests

```bash
node testing/api-test.js
```

Tests cover:
- User authentication and registration
- Pet CRUD operations
- Shopping cart functionality
- Order management
- Messaging system
- Storage bucket access
- Row Level Security policies

### Manual Testing

1. Register as a seller
2. Create a pet listing with photos
3. Register as a buyer
4. Browse pets and add to cart
5. Complete checkout (use Stripe test card: 4242 4242 4242 4242)
6. Verify order appears in dashboards

## Deployment

### Deploy Stripe Server

**Railway:**
```bash
railway login
railway init
railway add
railway up
```

**Render:**
1. Connect your GitHub repository
2. Create new Web Service
3. Set environment variables
4. Deploy

**Vercel:**
```bash
vercel login
vercel --prod
```

### Deploy Frontend

**Option 1: Vercel/Netlify**
- Connect repository
- Deploy static files
- Update `APP_URL` in production `.env`

**Option 2: GitHub Pages**
- Push to GitHub
- Enable Pages in repository settings
- Update Supabase CORS settings

### Post-Deployment

1. Update Stripe webhook URL in Stripe Dashboard
2. Add production domain to Supabase URL allow list
3. Update `ALLOWED_ORIGINS` in server `.env`
4. Test payment flow end-to-end

## API Endpoints

### Stripe Server (Express)

```
GET  /api/health                         # Health check
POST /api/stripe/create-payment-intent   # Create payment
POST /api/stripe/webhook                 # Stripe webhooks
GET  /api/stripe/test                    # Test connection
```

### Frontend (Supabase Client)

All data operations use Supabase client library directly:
- `supabase.auth.*` - Authentication
- `supabase.from('pets').*` - Pet queries
- `supabase.from('cart').*` - Cart operations
- `supabase.from('orders').*` - Order management
- `supabase.from('messages').*` - Messaging
- `supabase.storage.*` - File uploads

## Security Features

- JWT-based authentication
- Row Level Security (RLS) on all tables
- Secure password hashing (Supabase Auth)
- HTTPS-only in production
- Environment variable protection
- Input validation and sanitization
- CORS configuration
- Stripe webhook signature verification

## Troubleshooting

**Supabase connection fails:**
- Verify `SUPABASE_URL` and `SUPABASE_ANON_KEY` are correct
- Check Supabase project is active
- Ensure RLS policies are applied

**Payments not working:**
- Verify Stripe keys are correct
- Check webhook URL is configured
- Use Stripe test cards in development
- Check server logs for errors

**Photos not uploading:**
- Ensure `pet-photos` bucket exists
- Verify bucket is public
- Check storage policies are applied
- File size limit is 5MB

**Tests failing:**
- Run `node testing/setup-test-data.js` first
- Verify database schema is applied
- Check environment variables

## Contributing

This is a capstone project for CS2100 at the University of West Georgia.

## License

Educational use only - CS2100 Capstone Project

---

**Last Updated:** December 2025
