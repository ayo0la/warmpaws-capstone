// Pet Detail Page
document.addEventListener('DOMContentLoaded', async () => {
    const params = Utils.getQueryParams();
    const petId = params.id;

    if (!petId) {
        Utils.showToast('No pet specified', 'error');
        window.location.href = '/browse.html';
        return;
    }

    await loadPetDetails(petId);
    setupEventListeners(petId);
    await Utils.updateCartCount();
});

async function loadPetDetails(petId) {
    try {
        const pet = await API.pets.getById(petId);
        displayPetDetails(pet);
    } catch (error) {
        console.error('Error loading pet details:', error);
        Utils.showToast('Failed to load pet details', 'error');
        setTimeout(() => window.location.href = '/browse.html', 2000);
    }
}

function displayPetDetails(pet) {
    // Update page title
    document.title = `${pet.name || pet.breed} - Warm Paws`;

    // Update main heading (if exists)
    const heading = document.querySelector('article.box.left-align h2');
    if (heading) heading.textContent = pet.name || pet.breed;

    // Update price
    const priceTag = document.querySelector('.price-tag.large');
    if (priceTag) priceTag.textContent = Utils.formatPrice(pet.price);

    // Update photos
    if (pet.photos && pet.photos.length > 0) {
        // Find main photo placeholder - look for the div with [Main Pet Photo] text
        const photoBoxes = document.querySelectorAll('.box');
        let mainPhotoPlaceholder = null;
        let thumbContainer = null;

        // Find the photo container (first article.box with images)
        for (const box of photoBoxes) {
            if (box.textContent.includes('[Main Pet Photo]') || box.querySelector('[aria-label*="Main photo"]')) {
                mainPhotoPlaceholder = box.querySelector('div[style*="height: 250px"]');
                thumbContainer = box.querySelector('div[style*="grid-template-columns"]');
                break;
            }
        }

        if (mainPhotoPlaceholder) {
            const primaryPhoto = pet.photos.find(p => p.is_primary) || pet.photos[0];
            mainPhotoPlaceholder.innerHTML = `<img src="${primaryPhoto.photo_url}" alt="${pet.name || pet.breed}" style="width: 100%; height: 100%; object-fit: cover;">`;
            mainPhotoPlaceholder.style.border = 'none';
        }

        // Update thumbnail gallery
        if (thumbContainer && pet.photos.length > 0) {
            thumbContainer.innerHTML = pet.photos.map((photo, index) => `
                <div style="height: 50px; border: ${photo.is_primary ? '2px solid #6c5b80' : '1px solid #999'}; cursor: pointer; overflow: hidden;" data-index="${index}">
                    <img src="${photo.photo_url}" alt="Photo ${index + 1}" style="width: 100%; height: 100%; object-fit: cover;">
                </div>
            `).join('');

            // Add click handlers for thumbnails
            thumbContainer.querySelectorAll('div[data-index]').forEach((thumb, index) => {
                thumb.addEventListener('click', () => {
                    if (mainPhotoPlaceholder) {
                        mainPhotoPlaceholder.innerHTML = `<img src="${pet.photos[index].photo_url}" alt="${pet.name || pet.breed}" style="width: 100%; height: 100%; object-fit: cover;">`;
                    }
                    // Update active state
                    thumbContainer.querySelectorAll('div[data-index]').forEach(t => {
                        t.style.border = '1px solid #999';
                    });
                    thumb.style.border = '2px solid #6c5b80';
                });
            });
        }
    }

    // Update details
    const detailsContainer = document.querySelector('.mt-md.mb-md');
    if (detailsContainer) {
        detailsContainer.innerHTML = `
            <p><strong>Type:</strong> ${pet.type}</p>
            <p><strong>Breed:</strong> ${pet.breed}</p>
            ${pet.age ? `<p><strong>Age:</strong> ${pet.age}</p>` : ''}
            <p><strong>Available:</strong> ${pet.quantity} available</p>
            ${pet.location ? `<p><strong>Location:</strong> ${pet.location}</p>` : ''}
            <p><strong>Posted:</strong> ${Utils.formatRelativeTime(pet.created_at)}</p>
        `;
    }

    // Update quantity selector
    const quantitySelect = document.getElementById('quantity');
    if (quantitySelect && pet.quantity > 0) {
        quantitySelect.innerHTML = '';
        for (let i = 1; i <= Math.min(pet.quantity, 10); i++) {
            const option = document.createElement('option');
            option.value = i;
            option.textContent = `${i} ${pet.type === 'dog' ? 'puppy' : 'kitten'}${i > 1 ? (pet.type === 'dog' ? 'puppies' : 'kittens').slice(-3) : ''} - ${Utils.formatPrice(pet.price * i)}`;
            quantitySelect.appendChild(option);
        }
    }

    // Update description
    const descriptionSection = document.querySelector('#description-heading');
    if (descriptionSection && descriptionSection.parentElement) {
        const descParagraph = descriptionSection.parentElement.querySelector('p');
        if (descParagraph && pet.description) {
            descParagraph.textContent = pet.description;
        }
    }

    // Update price breakdown
    updatePriceBreakdown(pet.price, 1);

    // Update seller info
    if (pet.seller_name) {
        const sellerInfo = document.querySelector('.seller-info');
        if (sellerInfo) {
            sellerInfo.innerHTML = `
                <strong>Seller:</strong> ${Utils.sanitizeHTML(pet.seller_name)}<br>
                <strong>Member since:</strong> ${new Date(pet.seller_created_at || Date.now()).getFullYear()}<br>
                <strong>Response time:</strong> Usually within 2 hours<br>
                <p style="font-size: 10px; margin-top: 8px; color: #666;">
                    Seller receives: ${Utils.formatPrice(pet.price * 0.9)} (after 10% platform fee)
                </p>
                <button type="button" class="btn btn-secondary btn-block" id="contactSellerBtn">Contact Seller</button>
            `;
        }
    }

    // Update add to cart button
    const addToCartBtn = document.querySelector('.btn.btn-large.btn-block');
    if (addToCartBtn) {
        const fees = Utils.calculateFees(pet.price, 1);
        addToCartBtn.textContent = `Add to Cart - ${Utils.formatPrice(fees.total)}`;
        addToCartBtn.disabled = pet.status !== 'available' || pet.quantity < 1;

        if (pet.status !== 'available') {
            addToCartBtn.textContent = 'Not Available';
        } else if (pet.quantity < 1) {
            addToCartBtn.textContent = 'Out of Stock';
        }
    }

    // Store pet data for later use
    window.currentPet = pet;
}

function setupEventListeners(petId) {
    // Quantity selector change
    const quantitySelect = document.getElementById('quantity');
    if (quantitySelect) {
        quantitySelect.addEventListener('change', (e) => {
            const quantity = parseInt(e.target.value);
            if (window.currentPet) {
                updatePriceBreakdown(window.currentPet.price, quantity);
            }
        });
    }

    // Add to cart button
    const addToCartBtn = document.querySelector('.btn.btn-large.btn-block');
    if (addToCartBtn) {
        addToCartBtn.addEventListener('click', async () => {
            const quantity = parseInt(quantitySelect?.value || 1);
            await addToCart(petId, quantity);
        });
    }

    // Contact seller button (delegated event listener)
    document.addEventListener('click', async (e) => {
        if (e.target.id === 'contactSellerBtn') {
            await contactSeller();
        }
    });
}

function updatePriceBreakdown(price, quantity) {
    const fees = Utils.calculateFees(price, quantity);
    const priceBreakdown = document.querySelector('.price-breakdown');

    if (priceBreakdown) {
        priceBreakdown.innerHTML = `
            <strong>Price Breakdown:</strong>
            <div class="price-row">
                <span>Pet Price (${quantity}x):</span>
                <span>${Utils.formatPrice(fees.subtotal)}</span>
            </div>
            <div class="price-row subtotal">
                <span>Service Fee (5%):</span>
                <span>${Utils.formatPrice(fees.buyerFee)}</span>
            </div>
            <div class="price-row total">
                <strong>Total:</strong>
                <strong>${Utils.formatPrice(fees.total)}</strong>
            </div>
        `;
    }

    // Update button text
    const addToCartBtn = document.querySelector('.btn.btn-large.btn-block');
    if (addToCartBtn && !addToCartBtn.disabled) {
        addToCartBtn.textContent = `Add to Cart - ${Utils.formatPrice(fees.total)}`;
    }
}

async function addToCart(petId, quantity) {
    try {
        // Check if user is logged in
        const user = await Utils.checkAuth();
        if (!user) {
            Utils.showToast('Please log in to add items to cart', 'error');
            window.location.href = `/login.html?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`;
            return;
        }

        const addToCartBtn = document.querySelector('.btn.btn-large.btn-block');
        const originalText = addToCartBtn.textContent;
        addToCartBtn.disabled = true;
        addToCartBtn.textContent = 'Adding...';

        await API.cart.add(petId, quantity);

        Utils.showToast(`Added ${quantity} item(s) to cart!`, 'success');
        addToCartBtn.textContent = 'Added to Cart!';

        // Update cart count
        await Utils.updateCartCount();

        setTimeout(() => {
            addToCartBtn.textContent = originalText;
            addToCartBtn.disabled = false;
        }, 2000);

    } catch (error) {
        console.error('Error adding to cart:', error);
        Utils.showToast(error.message || 'Failed to add to cart', 'error');

        const addToCartBtn = document.querySelector('.btn.btn-large.btn-block');
        addToCartBtn.disabled = false;
        addToCartBtn.textContent = 'Add to Cart';
    }
}

async function contactSeller() {
    const user = await Utils.checkAuth();
    if (!user) {
        Utils.showToast('Please log in to contact seller', 'error');
        window.location.href = `/login.html?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`;
        return;
    }

    // TODO: Implement messaging system or redirect to contact page
    Utils.showToast('Contact seller feature coming soon!', 'info');
}
