// Seller Dashboard
let currentUser = null;
let listings = [];
let sales = [];

document.addEventListener('DOMContentLoaded', async () => {
    currentUser = await Utils.requireAuth();
    if (!currentUser) return;

    // Check if user is seller
    if (currentUser.role !== 'seller' && currentUser.role !== 'admin') {
        Utils.showToast('Seller access required', 'error');
        window.location.href = '/dashboard-buyer.html';
        return;
    }

    // Update welcome message
    const welcomeMessage = document.getElementById('welcomeMessage');
    if (welcomeMessage) {
        welcomeMessage.textContent = `Welcome back, ${currentUser.firstName}!`;
    }

    // Setup tab navigation
    setupTabs();

    // Load initial data
    await loadListings();
    await loadSales();
    updateAnalytics();

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

async function loadListings() {
    try {
        listings = await API.pets.getMyListings();
        displayListings(listings);
    } catch (error) {
        console.error('Error loading listings:', error);
        const container = document.getElementById('listingsContainer');
        if (container) {
            container.innerHTML = `
                <div class="box" style="text-align: center; padding: 40px; color: #f67481;">
                    <p>Failed to load listings</p>
                    <button class="btn mt-md" onclick="location.reload()">Retry</button>
                </div>
            `;
        }
    }
}

function displayListings(listings) {
    const container = document.getElementById('listingsContainer');
    if (!container) return;

    if (listings.length === 0) {
        container.innerHTML = `
            <div class="box" style="text-align: center; padding: 40px;">
                <h3>No listings yet</h3>
                <p class="mt-sm">Create your first listing to start selling!</p>
                <a href="sell.html" class="btn mt-lg">Create Listing</a>
            </div>
        `;
        return;
    }

    container.innerHTML = listings.map(pet => createListingCard(pet)).join('');
}

function createListingCard(pet) {
    const photoUrl = pet.primary_photo || '/uploads/placeholder.jpg';
    const statusColor = pet.status === 'available' ? '#6c5b80' :
                        pet.status === 'pending' ? '#c06d84' : '#999';

    return `
        <article class="box left-align mb-md">
            <div style="display: grid; grid-template-columns: 150px 1fr auto; gap: 20px; align-items: start;">
                <div style="width: 150px; height: 150px; background: #e0e0e0; border-radius: 8px; overflow: hidden;">
                    <img src="${photoUrl}" alt="${Utils.sanitizeHTML(pet.name || pet.breed)}"
                         style="width: 100%; height: 100%; object-fit: cover;"
                         onerror="this.style.display='none';">
                </div>

                <div>
                    <h3 style="margin: 0 0 8px 0;">${Utils.sanitizeHTML(pet.name || pet.breed)}</h3>
                    <p style="margin: 4px 0;">
                        <span style="display: inline-block; padding: 4px 8px; background: ${statusColor}; color: white; border-radius: 4px; font-size: 12px; text-transform: uppercase;">
                            ${pet.status}
                        </span>
                    </p>
                    <p style="margin: 8px 0; color: #666;">
                        ${pet.type} • ${pet.breed}<br>
                        ${pet.age} • ${pet.quantity} available<br>
                        Listed: ${Utils.formatRelativeTime(pet.created_at)}
                    </p>

                    <div style="margin-top: 12px; display: flex; gap: 10px;">
                        <button class="btn btn-small" onclick="editListing(${pet.id})">Edit</button>
                        <button class="btn btn-secondary btn-small" onclick="toggleStatus(${pet.id}, '${pet.status}')">
                            ${pet.status === 'available' ? 'Mark Unavailable' : 'Mark Available'}
                        </button>
                        <button class="btn btn-secondary btn-small" onclick="deleteListing(${pet.id})" style="color: #f67481;">
                            Delete
                        </button>
                        <a href="/detail.html?id=${pet.id}" class="btn btn-secondary btn-small" target="_blank">
                            View
                        </a>
                    </div>
                </div>

                <div style="text-align: right;">
                    <div class="price-tag large">${Utils.formatPrice(pet.price)}</div>
                    <p style="font-size: 12px; color: #666; margin-top: 8px;">
                        You earn: ${Utils.formatPrice(pet.price * 0.9)}
                    </p>
                </div>
            </div>
        </article>
    `;
}

async function loadSales() {
    try {
        sales = await API.orders.getMySales();
        displaySales(sales);
    } catch (error) {
        console.error('Error loading sales:', error);
        const container = document.getElementById('salesContainer');
        if (container) {
            container.innerHTML = `
                <div class="box" style="text-align: center; padding: 40px; color: #f67481;">
                    <p>Failed to load sales</p>
                </div>
            `;
        }
    }
}

function displaySales(sales) {
    const container = document.getElementById('salesContainer');
    if (!container) return;

    if (sales.length === 0) {
        container.innerHTML = `
            <div class="box" style="text-align: center; padding: 40px;">
                <h3>No sales yet</h3>
                <p class="mt-sm">Your sales will appear here once buyers purchase your pets.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = sales.map(order => createSaleCard(order)).join('');
}

function createSaleCard(order) {
    const statusColors = {
        pending: '#c06d84',
        paid: '#6c5b80',
        shipped: '#6c5b80',
        delivered: '#4a9b7f',
        cancelled: '#f67481'
    };

    return `
        <article class="box left-align mb-md">
            <div style="display: flex; justify-content: space-between; align-items: start;">
                <div>
                    <h4 style="margin: 0 0 8px 0;">Order #${order.id}</h4>
                    <p style="margin: 4px 0;">
                        <strong>Pet:</strong> ${Utils.sanitizeHTML(order.pet_name || order.pet_breed)}<br>
                        <strong>Quantity:</strong> ${order.quantity}<br>
                        <strong>Buyer:</strong> ${Utils.sanitizeHTML(order.buyer_name)}<br>
                        <strong>Date:</strong> ${Utils.formatDate(order.created_at)}
                    </p>

                    ${order.shipping_address ? `
                        <details class="mt-sm">
                            <summary style="cursor: pointer; color: #6c5b80;">View Shipping Info</summary>
                            <div class="mt-sm" style="font-size: 14px; color: #666;">
                                ${Utils.sanitizeHTML(order.shipping_address.name)}<br>
                                ${Utils.sanitizeHTML(order.shipping_address.street)}<br>
                                ${Utils.sanitizeHTML(order.shipping_address.city)}, ${Utils.sanitizeHTML(order.shipping_address.state)} ${Utils.sanitizeHTML(order.shipping_address.zipCode)}<br>
                                ${order.shipping_address.phone ? 'Phone: ' + Utils.sanitizeHTML(order.shipping_address.phone) : ''}
                            </div>
                        </details>
                    ` : ''}

                    <div class="mt-md">
                        <label for="status-${order.id}" style="font-weight: bold; display: block; margin-bottom: 4px;">Order Status:</label>
                        <select id="status-${order.id}" class="form-control" style="width: 200px;"
                                onchange="updateOrderStatus(${order.id}, this.value)">
                            <option value="pending" ${order.status === 'pending' ? 'selected' : ''}>Pending</option>
                            <option value="paid" ${order.status === 'paid' ? 'selected' : ''}>Paid</option>
                            <option value="shipped" ${order.status === 'shipped' ? 'selected' : ''}>Shipped</option>
                            <option value="delivered" ${order.status === 'delivered' ? 'selected' : ''}>Delivered</option>
                            <option value="cancelled" ${order.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
                        </select>
                    </div>
                </div>

                <div style="text-align: right;">
                    <div class="price-tag">${Utils.formatPrice(order.total_amount)}</div>
                    <p style="font-size: 12px; color: #666; margin-top: 4px;">
                        <strong>Your earnings:</strong><br>
                        ${Utils.formatPrice(order.seller_amount)}
                    </p>
                    <p style="margin-top: 8px;">
                        <span style="display: inline-block; padding: 4px 8px; background: ${statusColors[order.status] || '#999'}; color: white; border-radius: 4px; font-size: 12px;">
                            ${order.status.toUpperCase()}
                        </span>
                    </p>
                </div>
            </div>
        </article>
    `;
}

function updateAnalytics() {
    const totalListingsEl = document.getElementById('totalListings');
    const activeListingsEl = document.getElementById('activeListings');
    const totalSalesEl = document.getElementById('totalSales');
    const totalEarningsEl = document.getElementById('totalEarnings');

    if (totalListingsEl) totalListingsEl.textContent = listings.length;
    if (activeListingsEl) {
        const active = listings.filter(l => l.status === 'available').length;
        activeListingsEl.textContent = active;
    }

    if (totalSalesEl && sales.length > 0) {
        const total = sales.reduce((sum, sale) => sum + parseFloat(sale.total_amount), 0);
        totalSalesEl.textContent = Utils.formatPrice(total);
    }

    if (totalEarningsEl && sales.length > 0) {
        const earnings = sales.reduce((sum, sale) => sum + parseFloat(sale.seller_amount), 0);
        totalEarningsEl.textContent = Utils.formatPrice(earnings);
    }
}

async function editListing(petId) {
    Utils.showToast('Edit functionality coming soon! For now, delete and recreate listing.', 'info');
}

async function toggleStatus(petId, currentStatus) {
    const newStatus = currentStatus === 'available' ? 'unavailable' : 'available';

    try {
        await API.pets.update(petId, { status: newStatus });
        Utils.showToast('Status updated', 'success');
        await loadListings();
        updateAnalytics();
    } catch (error) {
        console.error('Error updating status:', error);
        Utils.showToast('Failed to update status', 'error');
    }
}

async function deleteListing(petId) {
    if (!confirm('Are you sure you want to delete this listing? This cannot be undone.')) {
        return;
    }

    try {
        await API.pets.delete(petId);
        Utils.showToast('Listing deleted', 'success');
        await loadListings();
        updateAnalytics();
    } catch (error) {
        console.error('Error deleting listing:', error);
        Utils.showToast('Failed to delete listing', 'error');
    }
}

async function updateOrderStatus(orderId, newStatus) {
    try {
        await API.orders.updateStatus(orderId, newStatus);
        Utils.showToast('Order status updated', 'success');
        await loadSales();
    } catch (error) {
        console.error('Error updating order status:', error);
        Utils.showToast('Failed to update order status', 'error');
        await loadSales(); // Reload to reset the dropdown
    }
}

function setupEventListeners() {
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

    const accountLink = document.getElementById('accountLink');
    if (accountLink && currentUser) {
        accountLink.textContent = currentUser.firstName || 'My Account';
        accountLink.href = '#';
    }
}

// Make functions globally available
window.editListing = editListing;
window.toggleStatus = toggleStatus;
window.deleteListing = deleteListing;
window.updateOrderStatus = updateOrderStatus;
