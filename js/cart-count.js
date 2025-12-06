// Cart Count Update Script
// This script should be loaded on all pages to keep the cart count updated

document.addEventListener('DOMContentLoaded', async () => {
    // Update cart count when page loads
    if (typeof Utils !== 'undefined' && Utils.updateCartCount) {
        await Utils.updateCartCount();
    }
});
