// Sell/List Pet Page
document.addEventListener('DOMContentLoaded', async () => {
    const user = await Utils.checkAuth();

    // Update account link
    updateAccountLink(user);

    // If user is not logged in, show message and disable form
    if (!user) {
        showLoginRequired();
        return;
    }

    // Check if user has seller role
    if (user.role === 'buyer') {
        showUpgradeToSeller();
        return;
    }

    // Setup form submission
    setupListingForm();
    setupPhotoPreview();
});

function showLoginRequired() {
    const form = document.querySelector('form');
    if (form) {
        form.innerHTML = `
            <div class="box info text-center" style="padding: 40px;">
                <h3>Login Required</h3>
                <p class="mt-sm">You need to be logged in to create a listing.</p>
                <a href="/login.html?redirect=${encodeURIComponent(window.location.pathname)}"
                   class="btn mt-lg">Login or Sign Up</a>
            </div>
        `;
    }
}

function showUpgradeToSeller() {
    const form = document.querySelector('form');
    if (form) {
        form.innerHTML = `
            <div class="box warning text-center" style="padding: 40px;">
                <h3>Seller Account Required</h3>
                <p class="mt-sm">To post listings, you need to upgrade to a seller account.</p>
                <p class="mt-sm">This is free and takes just a moment!</p>
                <button onclick="upgradeTos()" class="btn mt-lg">Upgrade to Seller</button>
            </div>
        `;
    }
}

async function upgradeToSeller() {
    try {
        await API.auth.updateProfile({ role: 'seller' });
        Utils.showToast('Account upgraded to seller!', 'success');
        location.reload();
    } catch (error) {
        console.error('Error upgrading account:', error);
        Utils.showToast('Failed to upgrade account. Please try again.', 'error');
    }
}

function setupPhotoPreview() {
    const photoInput = document.getElementById('photos');
    if (!photoInput) return;

    photoInput.addEventListener('change', (e) => {
        const files = Array.from(e.target.files);

        if (files.length > 0) {
            // Update the label text to show selected count
            const fileUploadDiv = photoInput.closest('.file-upload');
            const label = fileUploadDiv.querySelector('label');
            const labelText = label.childNodes[0]; // Get the text node

            // Update just the text, not the input element
            if (labelText && labelText.nodeType === Node.TEXT_NODE) {
                const baseText = labelText.textContent.split('(')[0].trim();
                labelText.textContent = `${baseText} (${files.length} selected) `;
            }

            // Validate file sizes
            const maxSize = 5 * 1024 * 1024; // 5MB
            const oversized = files.filter(f => f.size > maxSize);
            if (oversized.length > 0) {
                Utils.showToast(`${oversized.length} file(s) exceed 5MB limit`, 'error');
                photoInput.value = '';
                // Reset label text
                if (labelText && labelText.nodeType === Node.TEXT_NODE) {
                    const baseText = labelText.textContent.split('(')[0].trim();
                    labelText.textContent = `${baseText} `;
                }
                return;
            }

            // Validate file types
            const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
            const invalidFiles = files.filter(f => !validTypes.includes(f.type));
            if (invalidFiles.length > 0) {
                Utils.showToast('Only image files (JPG, PNG, GIF, WebP) are allowed', 'error');
                photoInput.value = '';
                // Reset label text
                if (labelText && labelText.nodeType === Node.TEXT_NODE) {
                    const baseText = labelText.textContent.split('(')[0].trim();
                    labelText.textContent = `${baseText} `;
                }
                return;
            }

            console.log('Files selected:', files.map(f => f.name));
        }
    });
}

function setupListingForm() {
    const form = document.querySelector('form');
    if (!form) return;

    // Update form to prevent default browser submission
    form.removeAttribute('action');
    form.removeAttribute('method');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await handleListingSubmission();
    });

    // Add price preview
    const priceInput = document.getElementById('price');
    if (priceInput) {
        priceInput.addEventListener('input', (e) => {
            updatePricePreview(e.target.value);
        });
    }
}

function updatePricePreview(price) {
    const successBox = document.querySelector('.box.success');
    if (!successBox || !price) return;

    const priceNum = parseFloat(price);
    if (isNaN(priceNum) || priceNum <= 0) return;

    const sellerReceives = (priceNum * 0.9).toFixed(2);
    const platformFee = (priceNum * 0.1).toFixed(2);

    const exampleP = successBox.querySelector('p[style*="color: #666"]');
    if (exampleP) {
        exampleP.innerHTML = `Example: Sell for ${Utils.formatPrice(priceNum)} → You receive ${Utils.formatPrice(sellerReceives)} (Platform fee: ${Utils.formatPrice(platformFee)})`;
    }
}

async function handleListingSubmission() {
    const submitBtn = document.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;

    try {
        // Disable submit button
        submitBtn.disabled = true;
        submitBtn.textContent = 'Creating Listing...';

        // Gather form data
        const formData = new FormData();

        // Basic pet info - map form fields to API fields
        const petType = document.getElementById('pet-type').value;
        const ageValue = parseInt(document.getElementById('age').value);
        const litterSize = parseInt(document.getElementById('litter-size').value);
        const priceValue = parseFloat(document.getElementById('price').value);

        // Convert age from weeks to months (API expects age_months)
        const ageInMonths = Math.floor(ageValue / 4);

        formData.append('name', document.getElementById('breed').value);
        formData.append('type', petType === 'puppies' ? 'dog' : 'cat');
        formData.append('breed', document.getElementById('breed').value);
        formData.append('age_months', ageInMonths.toString());
        formData.append('price', priceValue.toString());
        formData.append('location', document.getElementById('location').value);
        formData.append('description', document.getElementById('description').value);
        formData.append('quantity', litterSize.toString());

        // Set default gender and vaccination status
        formData.append('gender', 'male'); // Default, could be added to form
        formData.append('vaccinated', 'true');
        formData.append('neutered', 'false');

        // Add photos
        const photoFiles = document.getElementById('photos').files;
        if (photoFiles.length === 0) {
            throw new Error('Please select at least one photo');
        }

        if (photoFiles.length > 5) {
            throw new Error('Maximum 5 photos allowed');
        }

        console.log(`Uploading ${photoFiles.length} photo(s)...`);
        for (let i = 0; i < photoFiles.length; i++) {
            formData.append('photos', photoFiles[i]);
            console.log(`- ${photoFiles[i].name} (${(photoFiles[i].size / 1024).toFixed(2)} KB)`);
        }

        // Submit to API
        const result = await API.pets.create(formData);

        // Success!
        Utils.showToast('Listing created successfully!', 'success');

        // Show success message and redirect
        submitBtn.textContent = '✓ Listing Created!';
        setTimeout(() => {
            window.location.href = `/detail.html?id=${result.id}`;
        }, 1500);

    } catch (error) {
        console.error('Error creating listing:', error);
        Utils.showToast(error.message || 'Failed to create listing. Please try again.', 'error');

        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
    }
}

function updateAccountLink(user) {
    const accountLink = document.querySelector('.login-btn');
    if (accountLink && user) {
        accountLink.textContent = user.firstName || 'My Account';
        accountLink.href = user.role === 'seller' ? '/dashboard-seller.html' :
                          user.role === 'admin' ? '/dashboard-admin.html' :
                          '/dashboard-buyer.html';
    }
}

// Make upgradeToSeller available globally
window.upgradeToSeller = upgradeToSeller;
