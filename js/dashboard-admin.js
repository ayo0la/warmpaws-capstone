// Admin Dashboard
let currentUser = null;
let stats = null;
let users = [];
let pets = [];
let orders = [];

document.addEventListener('DOMContentLoaded', async () => {
    currentUser = await Utils.requireAuth();
    if (!currentUser) return;

    // Check if user is admin
    if (currentUser.role !== 'admin') {
        Utils.showToast('Admin access required', 'error');
        window.location.href = '/dashboard-buyer.html';
        return;
    }

    // Load data
    await loadStats();
    await loadUsers();

    // Setup tabs
    setupTabs();

    // Setup event listeners
    setupEventListeners();
});

function setupTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(btn => {
        btn.addEventListener('click', async () => {
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

            // Load data for tab if needed
            if (tabId === 'pets' && pets.length === 0) {
                await loadPets();
            } else if (tabId === 'orders' && orders.length === 0) {
                await loadOrders();
            }
        });
    });
}

async function loadStats() {
    try {
        stats = await API.admin.getStats();
        displayStats(stats);
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

function displayStats(stats) {
    const totalUsers = document.getElementById('totalUsers');
    const totalPets = document.getElementById('totalPets');
    const totalOrders = document.getElementById('totalOrders');
    const totalRevenue = document.getElementById('totalRevenue');

    if (totalUsers) totalUsers.textContent = stats.totalUsers || 0;
    if (totalPets) totalPets.textContent = stats.totalPets || 0;
    if (totalOrders) totalOrders.textContent = stats.totalOrders || 0;
    if (totalRevenue) totalRevenue.textContent = Utils.formatPrice(stats.totalRevenue || 0);
}

async function loadUsers() {
    try {
        users = await API.admin.getUsers();
        displayUsers(users);
    } catch (error) {
        console.error('Error loading users:', error);
        const container = document.getElementById('usersContainer');
        if (container) {
            container.innerHTML = `
                <div class="box" style="text-align: center; padding: 40px; color: #f67481;">
                    <p>Failed to load users</p>
                </div>
            `;
        }
    }
}

function displayUsers(users) {
    const container = document.getElementById('usersContainer');
    if (!container) return;

    if (users.length === 0) {
        container.innerHTML = `
            <div class="box" style="text-align: center; padding: 40px;">
                <p>No users found</p>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div class="box left-align">
            <table style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr style="border-bottom: 2px solid #eee;">
                        <th style="text-align: left; padding: 12px;">User</th>
                        <th style="text-align: left; padding: 12px;">Email</th>
                        <th style="text-align: left; padding: 12px;">Role</th>
                        <th style="text-align: left; padding: 12px;">Joined</th>
                        <th style="text-align: left; padding: 12px;">Stats</th>
                        <th style="text-align: left; padding: 12px;">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${users.map(user => `
                        <tr style="border-bottom: 1px solid #eee;">
                            <td style="padding: 12px;">
                                <strong>${Utils.sanitizeHTML(user.first_name)} ${Utils.sanitizeHTML(user.last_name)}</strong>
                            </td>
                            <td style="padding: 12px;">${Utils.sanitizeHTML(user.email)}</td>
                            <td style="padding: 12px;">
                                <select class="form-control" style="width: 120px;" onchange="changeUserRole(${user.id}, this.value)">
                                    <option value="buyer" ${user.role === 'buyer' ? 'selected' : ''}>Buyer</option>
                                    <option value="seller" ${user.role === 'seller' ? 'selected' : ''}>Seller</option>
                                    <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option>
                                </select>
                            </td>
                            <td style="padding: 12px; font-size: 14px; color: #666;">
                                ${Utils.formatDate(user.created_at)}
                            </td>
                            <td style="padding: 12px; font-size: 14px;">
                                ${user.total_listings || 0} listings<br>
                                ${user.total_purchases || 0} purchases
                            </td>
                            <td style="padding: 12px;">
                                <button class="btn btn-secondary btn-small" onclick="deleteUser(${user.id})" style="color: #f67481;">
                                    Delete
                                </button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

async function loadPets() {
    try {
        pets = await API.admin.getPets();
        displayPets(pets);
    } catch (error) {
        console.error('Error loading pets:', error);
        const container = document.getElementById('petsContainer');
        if (container) {
            container.innerHTML = `
                <div class="box" style="text-align: center; padding: 40px; color: #f67481;">
                    <p>Failed to load listings</p>
                </div>
            `;
        }
    }
}

function displayPets(pets) {
    const container = document.getElementById('petsContainer');
    if (!container) return;

    if (pets.length === 0) {
        container.innerHTML = `
            <div class="box" style="text-align: center; padding: 40px;">
                <p>No listings found</p>
            </div>
        `;
        return;
    }

    container.innerHTML = pets.map(pet => `
        <article class="box left-align mb-md">
            <div style="display: grid; grid-template-columns: 100px 1fr auto; gap: 20px; align-items: start;">
                <div style="width: 100px; height: 100px; background: #e0e0e0; border-radius: 8px; overflow: hidden;">
                    ${pet.primary_photo ? `
                        <img src="${pet.primary_photo}" alt="${Utils.sanitizeHTML(pet.name || pet.breed)}"
                             style="width: 100%; height: 100%; object-fit: cover;">
                    ` : '[Photo]'}
                </div>

                <div>
                    <h4 style="margin: 0 0 8px 0;">${Utils.sanitizeHTML(pet.name || pet.breed)}</h4>
                    <p style="margin: 4px 0; color: #666;">
                        <strong>Seller:</strong> ${Utils.sanitizeHTML(pet.seller_name)}<br>
                        <strong>Type:</strong> ${pet.type} • ${pet.breed}<br>
                        <strong>Price:</strong> ${Utils.formatPrice(pet.price)}<br>
                        <strong>Listed:</strong> ${Utils.formatRelativeTime(pet.created_at)}
                    </p>

                    <div class="mt-sm">
                        <label style="font-weight: bold; display: block; margin-bottom: 4px;">Status:</label>
                        <select class="form-control" style="width: 150px;" onchange="changePetStatus(${pet.id}, this.value)">
                            <option value="available" ${pet.status === 'available' ? 'selected' : ''}>Available</option>
                            <option value="pending" ${pet.status === 'pending' ? 'selected' : ''}>Pending</option>
                            <option value="sold" ${pet.status === 'sold' ? 'selected' : ''}>Sold</option>
                            <option value="removed" ${pet.status === 'removed' ? 'selected' : ''}>Removed</option>
                        </select>
                    </div>
                </div>

                <div style="text-align: right;">
                    <button class="btn btn-secondary btn-small" onclick="deletePet(${pet.id})" style="color: #f67481;">
                        Delete
                    </button>
                    <a href="/detail.html?id=${pet.id}" class="btn btn-secondary btn-small mt-sm" target="_blank">
                        View
                    </a>
                </div>
            </div>
        </article>
    `).join('');
}

async function loadOrders() {
    try {
        orders = await API.admin.getOrders();
        displayOrders(orders);
    } catch (error) {
        console.error('Error loading orders:', error);
        const container = document.getElementById('ordersContainer');
        if (container) {
            container.innerHTML = `
                <div class="box" style="text-align: center; padding: 40px; color: #f67481;">
                    <p>Failed to load orders</p>
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
                <p>No orders found</p>
            </div>
        `;
        return;
    }

    container.innerHTML = orders.map(order => `
        <article class="box left-align mb-md">
            <div style="display: flex; justify-content: space-between; align-items: start;">
                <div>
                    <h4 style="margin: 0 0 8px 0;">Order #${order.id}</h4>
                    <p style="margin: 4px 0; color: #666;">
                        <strong>Pet:</strong> ${Utils.sanitizeHTML(order.pet_name || order.pet_breed)}<br>
                        <strong>Buyer:</strong> ${Utils.sanitizeHTML(order.buyer_name)}<br>
                        <strong>Seller:</strong> ${Utils.sanitizeHTML(order.seller_name)}<br>
                        <strong>Date:</strong> ${Utils.formatDate(order.created_at)}<br>
                        <strong>Quantity:</strong> ${order.quantity}
                    </p>

                    <div class="mt-sm">
                        <label style="font-weight: bold; display: block; margin-bottom: 4px;">Status:</label>
                        <select class="form-control" style="width: 150px;" onchange="changeOrderStatus(${order.id}, this.value)">
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
                    <p style="font-size: 12px; color: #666; margin-top: 8px;">
                        Platform revenue:<br>
                        <strong>${Utils.formatPrice(order.platform_fee)}</strong>
                    </p>
                </div>
            </div>
        </article>
    `).join('');
}

async function changeUserRole(userId, newRole) {
    try {
        await API.admin.updateUserRole(userId, newRole);
        Utils.showToast('User role updated', 'success');
        await loadUsers();
        await loadStats();
    } catch (error) {
        console.error('Error updating user role:', error);
        Utils.showToast('Failed to update user role', 'error');
        await loadUsers();
    }
}

async function deleteUser(userId) {
    if (!confirm('Are you sure you want to delete this user? This will also delete all their listings and orders.')) {
        return;
    }

    try {
        await API.admin.deleteUser(userId);
        Utils.showToast('User deleted', 'success');
        await loadUsers();
        await loadStats();
    } catch (error) {
        console.error('Error deleting user:', error);
        Utils.showToast('Failed to delete user', 'error');
    }
}

async function changePetStatus(petId, newStatus) {
    try {
        await API.admin.updatePetStatus(petId, newStatus);
        Utils.showToast('Pet status updated', 'success');
        await loadPets();
        await loadStats();
    } catch (error) {
        console.error('Error updating pet status:', error);
        Utils.showToast('Failed to update pet status', 'error');
        await loadPets();
    }
}

async function deletePet(petId) {
    if (!confirm('Are you sure you want to delete this listing?')) {
        return;
    }

    try {
        await API.admin.deletePet(petId);
        Utils.showToast('Listing deleted', 'success');
        await loadPets();
        await loadStats();
    } catch (error) {
        console.error('Error deleting pet:', error);
        Utils.showToast('Failed to delete listing', 'error');
    }
}

async function changeOrderStatus(orderId, newStatus) {
    try {
        await API.admin.updateOrderStatus(orderId, newStatus);
        Utils.showToast('Order status updated', 'success');
        await loadOrders();
    } catch (error) {
        console.error('Error updating order status:', error);
        Utils.showToast('Failed to update order status', 'error');
        await loadOrders();
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
                window.location.href = '/login.html';
            }
        });
    }

    const accountLink = document.getElementById('accountLink');
    if (accountLink && currentUser) {
        accountLink.textContent = currentUser.first_name || 'Admin';
    }
}

// Make functions globally available
window.changeUserRole = changeUserRole;
window.deleteUser = deleteUser;
window.changePetStatus = changePetStatus;
window.deletePet = deletePet;
window.changeOrderStatus = changeOrderStatus;
