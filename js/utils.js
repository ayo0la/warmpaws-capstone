// Utility Functions

const Utils = {
    // Format price as currency
    formatPrice(price) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(price);
    },

    // Format date
    formatDate(dateString) {
        const date = new Date(dateString);
        return new Intl.DateTimeFormat('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        }).format(date);
    },

    // Format relative time (e.g., "2 hours ago")
    formatRelativeTime(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const seconds = Math.floor((now - date) / 1000);

        const intervals = {
            year: 31536000,
            month: 2592000,
            week: 604800,
            day: 86400,
            hour: 3600,
            minute: 60
        };

        for (const [unit, secondsInUnit] of Object.entries(intervals)) {
            const interval = Math.floor(seconds / secondsInUnit);
            if (interval >= 1) {
                return `${interval} ${unit}${interval === 1 ? '' : 's'} ago`;
            }
        }

        return 'just now';
    },

    // Calculate fees
    calculateFees(price, quantity = 1) {
        const subtotal = parseFloat(price) * quantity;
        const buyerFee = subtotal * 0.05; // 5%
        const sellerFee = subtotal * 0.10; // 10%
        const total = subtotal + buyerFee;
        const sellerPayout = subtotal - sellerFee;

        return {
            subtotal: subtotal.toFixed(2),
            buyerFee: buyerFee.toFixed(2),
            sellerFee: sellerFee.toFixed(2),
            total: total.toFixed(2),
            sellerPayout: sellerPayout.toFixed(2)
        };
    },

    // Show toast notification
    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            background: ${type === 'error' ? '#f67481' : type === 'success' ? '#6c5b80' : '#c06d84'};
            color: white;
            border-radius: 5px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            z-index: 10000;
            animation: slideIn 0.3s ease;
        `;

        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    },

    // Show loading spinner
    showLoading(element) {
        const spinner = document.createElement('div');
        spinner.className = 'loading-spinner';
        spinner.innerHTML = '<div class="spinner"></div>';
        spinner.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
        `;
        element.style.position = 'relative';
        element.appendChild(spinner);
        return spinner;
    },

    hideLoading(spinner) {
        if (spinner && spinner.parentElement) {
            spinner.remove();
        }
    },

    // Validate email
    isValidEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    },

    // Get query parameters
    getQueryParams() {
        const params = new URLSearchParams(window.location.search);
        const obj = {};
        for (const [key, value] of params) {
            obj[key] = value;
        }
        return obj;
    },

    // Set query parameters
    setQueryParams(params) {
        const url = new URL(window.location);
        Object.entries(params).forEach(([key, value]) => {
            if (value) {
                url.searchParams.set(key, value);
            } else {
                url.searchParams.delete(key);
            }
        });
        window.history.pushState({}, '', url);
    },

    // Debounce function
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    // Store data in localStorage
    storage: {
        set(key, value) {
            try {
                localStorage.setItem(key, JSON.stringify(value));
            } catch (e) {
                console.error('Error saving to localStorage:', e);
            }
        },

        get(key) {
            try {
                const item = localStorage.getItem(key);
                return item ? JSON.parse(item) : null;
            } catch (e) {
                console.error('Error reading from localStorage:', e);
                return null;
            }
        },

        remove(key) {
            try {
                localStorage.removeItem(key);
            } catch (e) {
                console.error('Error removing from localStorage:', e);
            }
        }
    },

    // Check if user is logged in
    async checkAuth() {
        try {
            const user = await API.auth.getCurrentUser();
            return user;
        } catch (error) {
            return null;
        }
    },

    // Redirect if not authenticated
    async requireAuth() {
        const user = await this.checkAuth();
        if (!user) {
            window.location.href = '/login.html?redirect=' + encodeURIComponent(window.location.pathname);
            return null;
        }
        return user;
    },

    // Sanitize HTML to prevent XSS
    sanitizeHTML(str) {
        const temp = document.createElement('div');
        temp.textContent = str;
        return temp.innerHTML;
    },

    // Update cart count badge
    async updateCartCount() {
        try {
            const user = await this.checkAuth();
            if (!user) {
                // User not logged in, set count to 0
                this.setCartCountDisplay(0);
                return;
            }

            const cartData = await API.cart.get();
            const count = cartData.items.length;
            this.setCartCountDisplay(count);
        } catch (error) {
            console.error('Error updating cart count:', error);
            this.setCartCountDisplay(0);
        }
    },

    // Set cart count display
    setCartCountDisplay(count) {
        const cartCountElements = document.querySelectorAll('#cart-count');
        cartCountElements.forEach(element => {
            element.textContent = count;
        });
    },

    // Update navigation based on auth state
    async updateNavigation() {
        try {
            const user = await this.checkAuth();
            const loginBtn = document.querySelector('.login-btn');

            if (!loginBtn) return;

            if (user) {
                // User is logged in - show account menu
                const userName = user.first_name || user.email.split('@')[0];

                // Create dropdown menu
                loginBtn.textContent = `My Account (${userName})`;
                loginBtn.href = user.role === 'admin' ? '/dashboard-admin.html' :
                                user.role === 'seller' ? '/dashboard-seller.html' :
                                '/dashboard-buyer.html';

                // Add logout option (convert to a wrapper div with dropdown)
                const existingLogoutBtn = document.getElementById('logout-btn');
                if (!existingLogoutBtn) {
                    const logoutBtn = document.createElement('a');
                    logoutBtn.id = 'logout-btn';
                    logoutBtn.href = '#';
                    logoutBtn.className = 'nav-item';
                    logoutBtn.textContent = 'Logout';
                    logoutBtn.style.cssText = 'margin-left: 10px; font-size: 0.9em;';
                    logoutBtn.addEventListener('click', async (e) => {
                        e.preventDefault();
                        try {
                            await API.auth.logout();
                            Utils.showToast('Logged out successfully', 'success');
                            setTimeout(() => {
                                window.location.href = '/index.html';
                            }, 500);
                        } catch (error) {
                            Utils.showToast('Logout failed', 'error');
                        }
                    });
                    loginBtn.parentElement.appendChild(logoutBtn);
                }
            } else {
                // User is not logged in - show login/register button
                loginBtn.textContent = 'Login / Register';
                loginBtn.href = '/login.html';

                // Remove logout button if exists
                const logoutBtn = document.getElementById('logout-btn');
                if (logoutBtn) {
                    logoutBtn.remove();
                }
            }
        } catch (error) {
            console.error('Error updating navigation:', error);
        }
    }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Utils;
}
