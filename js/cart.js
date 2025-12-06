// Shopping Cart Page
document.addEventListener('DOMContentLoaded', async () => {
    const user = await Utils.requireAuth();
    if (!user) return;

    await loadCart();
    setupEventListeners();
});

let cartData = null;

async function loadCart() {
    try {
        cartData = await API.cart.get();
        displayCart(cartData);
    } catch (error) {
        console.error('Error loading cart:', error);
        const cartItems = document.getElementById('cartItems');
        if (cartItems) {
            cartItems.innerHTML = `
                <div class="box" style="text-align: center; padding: 40px; color: #f67481;">
                    <p>Failed to load cart. Please try again.</p>
                    <button class="btn mt-md" onclick="location.reload()">Retry</button>
                </div>
            `;
        }
    }
}

function displayCart(data) {
    const cartItems = document.getElementById('cartItems');
    const cartCount = document.getElementById('cart-count');
    const subtotal = document.getElementById('subtotal');
    const buyerFee = document.getElementById('buyerFee');
    const total = document.getElementById('total');
    const checkoutBtn = document.getElementById('checkoutBtn');
    const cartSubtitle = document.getElementById('cart-subtitle');

    // Update cart count
    if (cartCount) {
        cartCount.textContent = data.items.length;
    }

    // Empty cart
    if (data.items.length === 0) {
        cartItems.innerHTML = `
            <div class="box" style="text-align: center; padding: 40px;">
                <h3>Your cart is empty</h3>
                <p class="mt-sm">Browse our available pets to get started!</p>
                <a href="browse.html" class="btn mt-lg">Browse Pets</a>
            </div>
        `;
        if (cartSubtitle) cartSubtitle.textContent = 'Your cart is empty';
        if (checkoutBtn) checkoutBtn.disabled = true;
        return;
    }

    // Display cart items
    cartItems.innerHTML = data.items.map(item => createCartItemHTML(item)).join('');

    // Update summary
    if (subtotal) subtotal.textContent = Utils.formatPrice(data.summary.subtotal);
    if (buyerFee) buyerFee.textContent = Utils.formatPrice(data.summary.buyerFee);
    if (total) total.textContent = Utils.formatPrice(data.summary.total);

    // Enable checkout button
    if (checkoutBtn) {
        checkoutBtn.disabled = false;
        checkoutBtn.textContent = `Checkout - ${Utils.formatPrice(data.summary.total)}`;
    }

    if (cartSubtitle) {
        cartSubtitle.textContent = `${data.items.length} item${data.items.length !== 1 ? 's' : ''} in your cart`;
    }

    // Setup item-specific event listeners
    setupCartItemListeners();
}

function createCartItemHTML(item) {
    const itemTotal = (item.price * item.quantity).toFixed(2);
    const photoUrl = item.primary_photo || '/uploads/placeholder.jpg';
    const maxQuantity = Math.min(item.available_quantity, 10);

    return `
        <article class="box left-align mb-md" data-cart-id="${item.id}">
            <div style="display: flex; gap: 20px; align-items: flex-start; flex-wrap: wrap;">
                <!-- Pet Image -->
                <div style="flex-shrink: 0; width: 150px; height: 150px; background: #e0e0e0; border-radius: 8px; overflow: hidden;">
                    <img src="${photoUrl}" alt="${Utils.sanitizeHTML(item.name || item.breed)}"
                         style="width: 100%; height: 100%; object-fit: cover;"
                         onerror="this.src='/uploads/placeholder.jpg'; this.onerror=null;">
                </div>

                <!-- Pet Details -->
                <div style="flex: 1; min-width: 250px;">
                    <h3 style="margin: 0 0 12px 0; font-size: 1.3rem;">${Utils.sanitizeHTML(item.name || item.breed)}</h3>
                    <div style="display: flex; flex-direction: column; gap: 8px;">
                        <p style="margin: 0; color: #666; font-size: 0.95rem;">
                            <strong>Type:</strong> ${Utils.sanitizeHTML(item.type)} ${item.breed ? `• ${Utils.sanitizeHTML(item.breed)}` : ''}
                        </p>
                        <p style="margin: 0; color: #666; font-size: 0.95rem;">
                            <strong>Seller:</strong> ${Utils.sanitizeHTML(item.seller_name)}
                        </p>
                        <p style="margin: 0; font-size: 1rem;">
                            <strong>Price:</strong> ${Utils.formatPrice(item.price)} each
                        </p>
                    </div>

                    <div style="margin-top: 16px; display: flex; gap: 15px; align-items: center; flex-wrap: wrap;">
                        <div style="display: flex; gap: 8px; align-items: center;">
                            <label for="qty-${item.id}" style="font-weight: bold; font-size: 0.95rem;">Qty:</label>
                            <select id="qty-${item.id}" class="form-control quantity-select"
                                    data-cart-id="${item.id}" data-current-qty="${item.quantity}"
                                    style="width: auto; padding: 6px 12px; font-size: 0.95rem;">
                                ${Array.from({length: maxQuantity}, (_, i) => i + 1).map(q => `
                                    <option value="${q}" ${q === item.quantity ? 'selected' : ''}>${q}</option>
                                `).join('')}
                            </select>
                            ${item.quantity >= item.available_quantity ?
                                `<span style="color: #f67481; font-size: 0.85rem;">(Max available)</span>` : ''}
                        </div>

                        <button class="btn btn-secondary btn-small remove-item-btn"
                                data-cart-id="${item.id}">
                            Remove from Cart
                        </button>
                    </div>
                </div>

                <!-- Item Total -->
                <div style="flex-shrink: 0; text-align: right; padding-top: 4px;">
                    <div style="font-size: 0.85rem; color: #666; margin-bottom: 4px;">Item Total</div>
                    <div class="price-tag large" style="font-size: 1.5rem;">${Utils.formatPrice(itemTotal)}</div>
                </div>
            </div>
        </article>
    `;
}

function setupCartItemListeners() {
    // Quantity change listeners
    const quantitySelects = document.querySelectorAll('.quantity-select');
    quantitySelects.forEach(select => {
        select.addEventListener('change', async (e) => {
            const cartId = parseInt(e.target.dataset.cartId);
            const newQuantity = parseInt(e.target.value);
            const currentQty = parseInt(e.target.dataset.currentQty);

            if (newQuantity !== currentQty) {
                await updateCartItemQuantity(cartId, newQuantity, e.target);
            }
        });
    });

    // Remove item listeners
    const removeButtons = document.querySelectorAll('.remove-item-btn');
    removeButtons.forEach(button => {
        button.addEventListener('click', async (e) => {
            const cartId = parseInt(e.target.dataset.cartId);
            await removeCartItem(cartId);
        });
    });
}

async function updateCartItemQuantity(cartId, quantity, selectElement) {
    const originalValue = selectElement.dataset.currentQty;

    try {
        selectElement.disabled = true;
        await API.cart.update(cartId, quantity);

        // Update the current quantity
        selectElement.dataset.currentQty = quantity;

        // Reload cart to update totals
        await loadCart();
        Utils.showToast('Cart updated', 'success');

    } catch (error) {
        console.error('Error updating cart:', error);
        Utils.showToast(error.message || 'Failed to update cart', 'error');

        // Revert to original value
        selectElement.value = originalValue;
        selectElement.disabled = false;
    }
}

async function removeCartItem(cartId) {
    if (!confirm('Remove this item from your cart?')) {
        return;
    }

    try {
        await API.cart.remove(cartId);
        Utils.showToast('Item removed from cart', 'success');
        await loadCart();
        await Utils.updateCartCount();
    } catch (error) {
        console.error('Error removing item:', error);
        Utils.showToast(error.message || 'Failed to remove item', 'error');
    }
}

function setupEventListeners() {
    const checkoutBtn = document.getElementById('checkoutBtn');
    if (checkoutBtn) {
        checkoutBtn.addEventListener('click', () => {
            if (cartData && cartData.items.length > 0) {
                window.location.href = '/checkout.html';
            }
        });
    }

    // Update account link
    updateAccountLink();
}

async function updateAccountLink() {
    const accountLink = document.getElementById('accountLink');
    if (accountLink) {
        const user = await Utils.checkAuth();
        if (user) {
            accountLink.textContent = user.firstName || 'My Account';
            accountLink.href = user.role === 'seller' ? '/dashboard-seller.html' :
                              user.role === 'admin' ? '/dashboard-admin.html' :
                              '/dashboard-buyer.html';
        } else {
            accountLink.textContent = 'Login';
            accountLink.href = '/login.html';
        }
    }
}
