// Buyer Dashboard
let currentUser = null;
let orders = [];

document.addEventListener('DOMContentLoaded', async () => {
    currentUser = await Utils.requireAuth();
    if (!currentUser) return;

    // Update welcome message
    const welcomeMessage = document.getElementById('welcomeMessage');
    if (welcomeMessage) {
        welcomeMessage.textContent = `Welcome back, ${currentUser.firstName}!`;
    }

    // Check for payment success
    const params = Utils.getQueryParams();
    if (params.payment === 'success') {
        const successMessage = document.getElementById('successMessage');
        if (successMessage) {
            successMessage.style.display = 'block';
            // Clear the URL parameter
            window.history.replaceState({}, '', window.location.pathname);
        }
    }

    // Setup tab navigation
    setupTabs();

    // Load initial data
    await loadOrders();
    loadProfile();

    // Setup event listeners
    setupEventListeners();
});

function setupTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active from all
            tabButtons.forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(t => t.style.display = 'none');

            // Activate clicked tab
            btn.classList.add('active');
            const tabId = btn.dataset.tab;
            const tabContent = document.getElementById(`${tabId}-tab`);
            if (tabContent) {
                tabContent.style.display = 'block';
            }
        });
    });
}

async function loadOrders() {
    try {
        orders = await API.orders.getMyPurchases();
        displayOrders(orders);
    } catch (error) {
        console.error('Error loading orders:', error);
        const container = document.getElementById('ordersContainer');
        if (container) {
            container.innerHTML = `
                <div class="box" style="text-align: center; padding: 40px; color: #f67481;">
                    <p>Failed to load orders</p>
                    <button class="btn mt-md" onclick="location.reload()">Retry</button>
                </div>
            `;
        }
    }
}

function displayOrders(orders) {
    const container = document.getElementById('ordersContainer');
    if (!container) return;

    if (orders.length === 0) {
        container.innerHTML = `
            <div class="box" style="text-align: center; padding: 40px;">
                <h3>No orders yet</h3>
                <p class="mt-sm">Browse our available pets to get started!</p>
                <a href="browse.html" class="btn mt-lg">Browse Pets</a>
            </div>
        `;
        return;
    }

    container.innerHTML = orders.map(order => createOrderCard(order)).join('');
}

function createOrderCard(order) {
    const statusColors = {
        pending: '#c06d84',
        paid: '#6c5b80',
        shipped: '#6c5b80',
        delivered: '#4a9b7f',
        cancelled: '#f67481'
    };

    const statusMessages = {
        pending: 'Payment processing...',
        paid: 'Waiting for seller to ship',
        shipped: 'On the way!',
        delivered: 'Delivered - Enjoy your new pet!',
        cancelled: 'Order cancelled'
    };

    return `
        <article class="box left-align mb-md">
            <div style="display: flex; justify-content: space-between; align-items: start;">
                <div style="flex: 1;">
                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px;">
                        <div>
                            <h4 style="margin: 0 0 4px 0;">Order #${order.id}</h4>
                            <p style="margin: 0; font-size: 14px; color: #666;">
                                ${Utils.formatDate(order.created_at)}
                            </p>
                        </div>
                        <span style="display: inline-block; padding: 6px 12px; background: ${statusColors[order.status] || '#999'}; color: white; border-radius: 4px; font-size: 12px; font-weight: bold;">
                            ${order.status.toUpperCase()}
                        </span>
                    </div>

                    <div class="mt-md" style="padding: 15px; background: #f5f5f5; border-radius: 8px;">
                        <p style="margin: 0 0 8px 0;">
                            <strong>Pet:</strong> ${Utils.sanitizeHTML(order.pet_name || order.pet_breed)}
                        </p>
                        <p style="margin: 0 0 8px 0;">
                            <strong>Quantity:</strong> ${order.quantity}
                        </p>
                        <p style="margin: 0 0 8px 0;">
                            <strong>Seller:</strong> ${Utils.sanitizeHTML(order.seller_name)}
                        </p>
                        <p style="margin: 0;">
                            <strong>Total Paid:</strong> ${Utils.formatPrice(order.total_amount)}
                        </p>
                    </div>

                    ${order.shipping_address ? `
                        <details class="mt-md">
                            <summary style="cursor: pointer; color: #6c5b80; font-weight: bold;">
                                Delivery Information
                            </summary>
                            <div class="mt-sm" style="padding: 12px; background: #f9f9f9; border-left: 3px solid #6c5b80; font-size: 14px;">
                                <p style="margin: 0 0 4px 0;"><strong>${Utils.sanitizeHTML(order.shipping_address.name)}</strong></p>
                                <p style="margin: 0; color: #666;">
                                    ${Utils.sanitizeHTML(order.shipping_address.street)}<br>
                                    ${Utils.sanitizeHTML(order.shipping_address.city)}, ${Utils.sanitizeHTML(order.shipping_address.state)} ${Utils.sanitizeHTML(order.shipping_address.zipCode)}<br>
                                    ${order.shipping_address.phone ? 'Phone: ' + Utils.sanitizeHTML(order.shipping_address.phone) : ''}
                                </p>
                            </div>
                        </details>
                    ` : ''}

                    <div class="mt-md" style="padding: 12px; background: ${statusColors[order.status]}20; border-left: 3px solid ${statusColors[order.status]}; border-radius: 4px;">
                        <p style="margin: 0; font-weight: bold; color: ${statusColors[order.status]};">
                            ${statusMessages[order.status] || 'Processing...'}
                        </p>
                    </div>

                    ${order.status === 'paid' || order.status === 'shipped' ? `
                        <div class="mt-md">
                            <a href="messages.html?seller=${order.seller_id}" class="btn btn-secondary btn-small">
                                Contact Seller
                            </a>
                        </div>
                    ` : ''}
                </div>
            </div>
        </article>
    `;
}

function loadProfile() {
    const firstNameInput = document.getElementById('firstName');
    const lastNameInput = document.getElementById('lastName');
    const emailInput = document.getElementById('email');
    const phoneInput = document.getElementById('phone');

    if (firstNameInput && currentUser.firstName) firstNameInput.value = currentUser.firstName;
    if (lastNameInput && currentUser.lastName) lastNameInput.value = currentUser.lastName;
    if (emailInput && currentUser.email) emailInput.value = currentUser.email;
    if (phoneInput && currentUser.phone) phoneInput.value = currentUser.phone;
}

function setupEventListeners() {
    // Logout button
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            try {
                await API.auth.logout();
                window.location.href = '/login.html';
            } catch (error) {
                console.error('Logout error:', error);
                window.location.href = '/login.html';
            }
        });
    }

    // Account link
    const accountLink = document.getElementById('accountLink');
    if (accountLink && currentUser) {
        accountLink.textContent = currentUser.firstName || 'My Account';
        accountLink.href = '#';
    }

    // Profile form
    const profileForm = document.getElementById('profileForm');
    if (profileForm) {
        profileForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await updateProfile();
        });
    }

    // Password form
    const passwordForm = document.getElementById('passwordForm');
    if (passwordForm) {
        passwordForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await changePassword();
        });
    }
}

async function updateProfile() {
    const submitBtn = document.querySelector('#profileForm button[type="submit"]');
    const originalText = submitBtn.textContent;

    try {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Updating...';

        const updates = {
            firstName: document.getElementById('firstName').value,
            lastName: document.getElementById('lastName').value,
            phone: document.getElementById('phone').value
        };

        await API.auth.updateProfile(updates);

        Utils.showToast('Profile updated successfully!', 'success');
        submitBtn.textContent = '✓ Updated!';

        // Update current user
        currentUser = { ...currentUser, ...updates };

        setTimeout(() => {
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }, 2000);

    } catch (error) {
        console.error('Error updating profile:', error);
        Utils.showToast(error.message || 'Failed to update profile', 'error');
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
    }
}

async function changePassword() {
    const submitBtn = document.querySelector('#passwordForm button[type="submit"]');
    const originalText = submitBtn.textContent;
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    // Validate passwords match
    if (newPassword !== confirmPassword) {
        Utils.showToast('New passwords do not match', 'error');
        return;
    }

    // Validate password length
    if (newPassword.length < 8) {
        Utils.showToast('Password must be at least 8 characters', 'error');
        return;
    }

    try {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Changing...';

        await API.auth.updateProfile({
            currentPassword,
            newPassword
        });

        Utils.showToast('Password changed successfully!', 'success');
        submitBtn.textContent = '✓ Changed!';

        // Clear form
        document.getElementById('passwordForm').reset();

        setTimeout(() => {
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }, 2000);

    } catch (error) {
        console.error('Error changing password:', error);
        Utils.showToast(error.message || 'Failed to change password', 'error');
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
    }
}

async function upgradeToSeller() {
    if (!confirm('Upgrade to a seller account? This will allow you to list pets for sale.')) {
        return;
    }

    try {
        await API.auth.updateProfile({ role: 'seller' });
        Utils.showToast('Account upgraded to seller! Redirecting...', 'success');
        setTimeout(() => {
            window.location.href = '/dashboard-seller.html';
        }, 2000);
    } catch (error) {
        console.error('Error upgrading account:', error);
        Utils.showToast('Failed to upgrade account. Please try again.', 'error');
    }
}

// Make function globally available
window.upgradeToSeller = upgradeToSeller;
