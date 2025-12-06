/**
 * WarmPaws Minimal Stripe Payment Server
 *
 * This is a lightweight Express server that ONLY handles:
 * 1. Stripe PaymentIntent creation (secure server-side)
 * 2. Stripe webhook processing (payment confirmations)
 *
 * All other operations (auth, database queries, file uploads) are handled
 * directly by the frontend using Supabase.
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const express = require('express');
const cors = require('cors');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');

// ============================================================================
// INITIALIZATION
// ============================================================================

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize Supabase client with service key (for admin operations)
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY // Service key for bypassing RLS
);

// Validate required environment variables
const requiredEnvVars = [
    'SUPABASE_URL',
    'SUPABASE_SERVICE_KEY',
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET'
];

for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
        console.error(`❌ Missing required environment variable: ${envVar}`);
        process.exit(1);
    }
}

// ============================================================================
// MIDDLEWARE
// ============================================================================

// CORS configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
    : ['http://localhost:3000', 'http://127.0.0.1:3000'];

app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, Postman, etc.)
        if (!origin) return callback(null, true);

        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
}));

// JSON parsing (except for webhook endpoint which needs raw body)
app.use((req, res, next) => {
    if (req.originalUrl === '/api/stripe/webhook') {
        next();
    } else {
        express.json()(req, res, next);
    }
});

// Request logging
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
});

// ============================================================================
// AUTHENTICATION MIDDLEWARE
// ============================================================================

/**
 * Verify JWT token from Supabase Auth
 * Extracts user from Authorization header
 */
async function verifyAuth(req, res, next) {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                error: 'Authentication required',
                message: 'Please provide a valid authorization token'
            });
        }

        const token = authHeader.replace('Bearer ', '');

        // Verify token with Supabase
        const { data: { user }, error } = await supabase.auth.getUser(token);

        if (error || !user) {
            return res.status(401).json({
                error: 'Invalid token',
                message: 'Your session has expired or is invalid'
            });
        }

        // Attach user to request
        req.user = user;
        next();

    } catch (error) {
        console.error('Auth verification error:', error);
        res.status(500).json({
            error: 'Authentication error',
            message: 'Failed to verify authentication'
        });
    }
}

// ============================================================================
// API ENDPOINTS
// ============================================================================

/**
 * Health check endpoint
 * Used to verify server is running
 */
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'WarmPaws Stripe Payment Server',
        version: '2.0.0',
        timestamp: new Date().toISOString(),
        stripe: !!process.env.STRIPE_SECRET_KEY,
        supabase: !!process.env.SUPABASE_URL
    });
});

/**
 * Create Stripe Payment Intent
 * POST /api/stripe/create-payment-intent
 *
 * Body: { orderIds: [uuid, uuid, ...] }
 *
 * This endpoint:
 * 1. Verifies user is authenticated
 * 2. Fetches orders from Supabase
 * 3. Calculates total amount
 * 4. Creates Stripe PaymentIntent
 * 5. Returns client secret for frontend
 */
app.post('/api/stripe/create-payment-intent', verifyAuth, async (req, res) => {
    try {
        const { orderIds } = req.body;

        // Validate input
        if (!Array.isArray(orderIds) || orderIds.length === 0) {
            return res.status(400).json({
                error: 'Invalid order IDs',
                message: 'Please provide an array of order IDs'
            });
        }

        // Fetch orders from Supabase
        const { data: orders, error: fetchError } = await supabase
            .from('orders')
            .select('id, total_amount, buyer_id, status')
            .in('id', orderIds)
            .eq('buyer_id', req.user.id)
            .eq('status', 'pending');

        if (fetchError) {
            console.error('Error fetching orders:', fetchError);
            return res.status(500).json({
                error: 'Database error',
                message: 'Failed to fetch orders'
            });
        }

        // Verify all orders belong to user and are pending
        if (!orders || orders.length !== orderIds.length) {
            return res.status(400).json({
                error: 'Invalid orders',
                message: 'Some orders are not found, not yours, or already paid'
            });
        }

        // Calculate total amount
        const totalAmount = orders.reduce((sum, order) =>
            sum + parseFloat(order.total_amount), 0
        );

        if (totalAmount <= 0) {
            return res.status(400).json({
                error: 'Invalid amount',
                message: 'Total amount must be greater than zero'
            });
        }

        // Create Stripe Payment Intent
        const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(totalAmount * 100), // Convert to cents
            currency: 'usd',
            automatic_payment_methods: {
                enabled: true,
            },
            metadata: {
                orderIds: orderIds.join(','),
                userId: req.user.id,
                platform: 'warmpaws'
            },
            description: `WarmPaws Order Payment (${orders.length} pet${orders.length > 1 ? 's' : ''})`
        });

        console.log(`✅ Payment Intent created: ${paymentIntent.id} for $${totalAmount.toFixed(2)}`);

        // Return client secret
        res.json({
            clientSecret: paymentIntent.client_secret,
            paymentIntentId: paymentIntent.id,
            amount: totalAmount.toFixed(2),
            orderCount: orders.length
        });

    } catch (error) {
        console.error('Payment intent creation error:', error);

        res.status(500).json({
            error: 'Payment processing error',
            message: error.message || 'Failed to create payment intent'
        });
    }
});

/**
 * Stripe Webhook Handler
 * POST /api/stripe/webhook
 *
 * Handles events from Stripe (payment success, failure, etc.)
 *
 * This endpoint:
 * 1. Verifies webhook signature
 * 2. Processes payment_intent.succeeded event
 * 3. Updates order status to 'paid'
 * 4. Decrements pet quantities
 * 5. Marks pets as 'sold' if quantity reaches 0
 */
app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        // Verify webhook signature
        event = stripe.webhooks.constructEvent(
            req.body,
            sig,
            process.env.STRIPE_WEBHOOK_SECRET
        );
    } catch (err) {
        console.error('❌ Webhook signature verification failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    console.log(`📥 Webhook received: ${event.type}`);

    // Handle payment success
    if (event.type === 'payment_intent.succeeded') {
        const paymentIntent = event.data.object;

        // Check if this is a test event without orderIds
        if (!paymentIntent.metadata || !paymentIntent.metadata.orderIds) {
            console.log('ℹ️  Test webhook received (no orderIds in metadata)');
            return res.json({ received: true });
        }

        const orderIds = paymentIntent.metadata.orderIds.split(',');

        console.log(`💳 Payment succeeded for orders: ${orderIds.join(', ')}`);

        try {
            // Update orders to 'paid' status
            const { error: updateError } = await supabase
                .from('orders')
                .update({
                    status: 'paid',
                    stripe_payment_id: paymentIntent.id,
                    updated_at: new Date().toISOString()
                })
                .in('id', orderIds);

            if (updateError) {
                console.error('❌ Error updating orders:', updateError);
                // Don't return error to Stripe - we'll retry manually
            } else {
                console.log(`✅ Orders updated to 'paid': ${orderIds.length} orders`);
            }

            // Decrement pet quantities for each order
            for (const orderId of orderIds) {
                const { data: order, error: orderError } = await supabase
                    .from('orders')
                    .select('pet_id, quantity')
                    .eq('id', orderId)
                    .single();

                if (orderError || !order) {
                    console.error(`❌ Error fetching order ${orderId}:`, orderError);
                    continue;
                }

                // Call database function to decrement quantity atomically
                const { error: decrementError } = await supabase.rpc('decrement_pet_quantity', {
                    pet_id: order.pet_id,
                    qty: order.quantity
                });

                if (decrementError) {
                    console.error(`❌ Error decrementing pet quantity:`, decrementError);
                } else {
                    console.log(`✅ Pet quantity decremented: ${order.pet_id} (-${order.quantity})`);
                }
            }

            console.log('✅ Webhook processing complete');

        } catch (error) {
            console.error('❌ Error processing webhook:', error);
            // Don't return error - acknowledge receipt to Stripe
        }
    }

    // Handle payment failure
    if (event.type === 'payment_intent.payment_failed') {
        const paymentIntent = event.data.object;
        const orderIds = paymentIntent.metadata.orderIds?.split(',') || [];

        console.log(`❌ Payment failed for orders: ${orderIds.join(', ')}`);
        console.log(`Reason: ${paymentIntent.last_payment_error?.message || 'Unknown'}`);

        // Optionally update orders to 'cancelled' status
        // Or leave as 'pending' for retry
    }

    // Acknowledge receipt of event
    res.json({ received: true });
});

/**
 * Test endpoint to verify Stripe connection
 * GET /api/stripe/test
 */
app.get('/api/stripe/test', async (req, res) => {
    try {
        // Try to retrieve Stripe account info
        const account = await stripe.accounts.retrieve();

        res.json({
            status: 'ok',
            message: 'Stripe connection successful',
            account: {
                id: account.id,
                country: account.country,
                currency: account.default_currency,
                email: account.email
            }
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'Stripe connection failed',
            error: error.message
        });
    }
});

// ============================================================================
// ERROR HANDLING
// ============================================================================

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Not found',
        message: `Endpoint ${req.method} ${req.path} not found`
    });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('❌ Unhandled error:', err);

    res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
    });
});

// ============================================================================
// SERVER STARTUP
// ============================================================================

app.listen(PORT, () => {
    console.log('\n' + '='.repeat(60));
    console.log('🚀 WarmPaws Stripe Payment Server');
    console.log('='.repeat(60));
    console.log(`📡 Server running on port ${PORT}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`💳 Stripe: ${process.env.STRIPE_SECRET_KEY ? '✅ Connected' : '❌ Not configured'}`);
    console.log(`🗄️  Supabase: ${process.env.SUPABASE_URL ? '✅ Connected' : '❌ Not configured'}`);
    console.log(`🔐 CORS Origins: ${allowedOrigins.join(', ')}`);
    console.log('\n📍 Endpoints:');
    console.log(`   GET  /api/health                       - Health check`);
    console.log(`   POST /api/stripe/create-payment-intent - Create payment`);
    console.log(`   POST /api/stripe/webhook               - Stripe webhooks`);
    console.log(`   GET  /api/stripe/test                  - Test Stripe connection`);
    console.log('='.repeat(60) + '\n');
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
    console.log('⚠️  SIGTERM received, shutting down gracefully...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('\n⚠️  SIGINT received, shutting down gracefully...');
    process.exit(0);
});
