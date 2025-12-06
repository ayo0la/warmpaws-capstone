// Checkout Page with Stripe Integration
let stripe;
let elements;
let cardElement;
let cartData;

document.addEventListener('DOMContentLoaded', async () => {
    const user = await Utils.requireAuth();
    if (!user) return;

    // Initialize Stripe
    initializeStripe();

    // Load cart and order summary
    await loadOrderSummary();

    // Pre-fill user info
    prefillUserInfo(user);

    // Setup form submission
    setupCheckoutForm();
});

function initializeStripe() {
    // Get Stripe publishable key from env (will be loaded from backend)
    const stripeKey = window.STRIPE_PUBLIC_KEY || 'pk_test_placeholder';

    try {
        stripe = Stripe(stripeKey);
        elements = stripe.elements();

        // Create card element
        cardElement = elements.create('card', {
            style: {
                base: {
                    fontSize: '16px',
                    color: '#32325d',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                    '::placeholder': {
                        color: '#aab7c4'
                    }
                },
                invalid: {
                    color: '#f67481',
                    iconColor: '#f67481'
                }
            }
        });

        cardElement.mount('#card-element');

        // Handle real-time validation errors
        cardElement.on('change', (event) => {
            const displayError = document.getElementById('card-errors');
            if (event.error) {
                displayError.textContent = event.error.message;
            } else {
                displayError.textContent = '';
            }
        });

    } catch (error) {
        console.error('Stripe initialization error:', error);
        Utils.showToast('Payment system initialization failed. Please check Stripe configuration.', 'error');
    }
}

async function loadOrderSummary() {
    try {
        cartData = await API.cart.get();

        if (cartData.items.length === 0) {
            Utils.showToast('Your cart is empty', 'error');
            window.location.href = '/cart.html';
            return;
        }

        displayOrderSummary(cartData);

    } catch (error) {
        console.error('Error loading cart:', error);
        Utils.showToast('Failed to load order details', 'error');
        setTimeout(() => window.location.href = '/cart.html', 2000);
    }
}

function displayOrderSummary(data) {
    const orderItems = document.getElementById('orderItems');
    const subtotal = document.getElementById('subtotal');
    const buyerFee = document.getElementById('buyerFee');
    const total = document.getElementById('total');
    const submitBtn = document.getElementById('submitBtn');

    // Display items
    orderItems.innerHTML = data.items.map(item => `
        <div style="display: flex; justify-content: space-between; margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid #eee;">
            <div>
                <strong>${Utils.sanitizeHTML(item.name || item.breed)}</strong><br>
                <span style="font-size: 12px; color: #666;">Qty: ${item.quantity} × ${Utils.formatPrice(item.price)}</span>
            </div>
            <div style="text-align: right;">
                <strong>${Utils.formatPrice(item.price * item.quantity)}</strong>
            </div>
        </div>
    `).join('');

    // Update totals
    if (subtotal) subtotal.textContent = Utils.formatPrice(data.summary.subtotal);
    if (buyerFee) buyerFee.textContent = Utils.formatPrice(data.summary.buyerFee);
    if (total) total.textContent = Utils.formatPrice(data.summary.total);

    // Update button
    if (submitBtn) {
        submitBtn.textContent = `Pay ${Utils.formatPrice(data.summary.total)}`;
    }
}

function prefillUserInfo(user) {
    const emailInput = document.getElementById('email');
    if (emailInput && user.email) {
        emailInput.value = user.email;
    }

    const fullNameInput = document.getElementById('fullName');
    if (fullNameInput && user.firstName) {
        fullNameInput.value = user.firstName + (user.lastName ? ' ' + user.lastName : '');
    }
}

function setupCheckoutForm() {
    const form = document.getElementById('checkoutForm');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await handleCheckout();
    });
}

async function handleCheckout() {
    const submitBtn = document.getElementById('submitBtn');
    const paymentStatus = document.getElementById('payment-status');
    const originalBtnText = submitBtn.textContent;

    try {
        // Disable button and show processing
        submitBtn.disabled = true;
        submitBtn.textContent = 'Processing...';
        paymentStatus.innerHTML = '<p style="color: #666;">Processing payment...</p>';

        // Gather shipping information
        const shippingInfo = {
            email: document.getElementById('email').value,
            phone: document.getElementById('phone').value,
            name: document.getElementById('fullName').value,
            address: {
                street: document.getElementById('address').value,
                city: document.getElementById('city').value,
                state: document.getElementById('state').value,
                zipCode: document.getElementById('zipCode').value
            },
            notes: document.getElementById('notes').value || null
        };

        // Step 1: Create orders from cart
        const checkoutResponse = await API.orders.checkout(shippingInfo);
        const orderIds = checkoutResponse.orderIds;

        // Step 2: Create payment intent
        const paymentResponse = await API.orders.createPaymentIntent(orderIds);
        const clientSecret = paymentResponse.clientSecret;

        // Step 3: Confirm payment with Stripe
        const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
            payment_method: {
                card: cardElement,
                billing_details: {
                    name: shippingInfo.name,
                    email: shippingInfo.email,
                    phone: shippingInfo.phone,
                    address: {
                        line1: shippingInfo.address.street,
                        city: shippingInfo.address.city,
                        state: shippingInfo.address.state,
                        postal_code: shippingInfo.address.zipCode,
                        country: 'US'
                    }
                }
            }
        });

        if (error) {
            throw new Error(error.message);
        }

        // Step 4: Confirm payment on backend
        await API.orders.confirmPayment(orderIds, paymentIntent.id);

        // Success!
        paymentStatus.innerHTML = '<p style="color: #6c5b80;">✓ Payment successful!</p>';
        Utils.showToast('Payment successful! Redirecting...', 'success');

        // Redirect to order confirmation
        setTimeout(() => {
            window.location.href = '/dashboard-buyer.html?payment=success';
        }, 2000);

    } catch (error) {
        console.error('Checkout error:', error);
        Utils.showToast(error.message || 'Payment failed. Please try again.', 'error');

        paymentStatus.innerHTML = `<p style="color: #f67481;">✗ ${error.message || 'Payment failed'}</p>`;
        submitBtn.disabled = false;
        submitBtn.textContent = originalBtnText;
    }
}
