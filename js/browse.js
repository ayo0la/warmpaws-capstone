// Browse Pets Page
document.addEventListener('DOMContentLoaded', async () => {
    await loadPets();
    setupFilterListeners();
    await Utils.updateNavigation();
    await Utils.updateCartCount();
});

let currentFilters = {
    type: [], // Empty array means no type filter applied
    minPrice: null,
    maxPrice: null,
    age: [],
    distance: null,
    sort: 'newest'
};

// Debug: log current filters on page load
console.log('Initial filters:', currentFilters);

async function loadPets(filters = currentFilters) {
    try {
        const petsContainer = document.querySelector('.grid');
        if (!petsContainer) {
            console.error('Grid container not found');
            return;
        }

        // Show loading state
        petsContainer.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 40px;">Loading pets...</div>';

        // Fetch pets from API
        console.log('Fetching pets with filters:', filters);
        const pets = await API.pets.getAll(filters);
        console.log('Fetched pets:', pets);

        // Update results count
        const resultsCount = document.querySelector('.price-row span');
        if (resultsCount) {
            resultsCount.textContent = `Showing ${pets.length} pet${pets.length !== 1 ? 's' : ''}`;
        }

        // Display pets
        if (pets.length === 0) {
            petsContainer.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 40px;">No pets found. Try adjusting your filters.</div>';
            return;
        }

        petsContainer.innerHTML = pets.map(pet => createPetCard(pet)).join('');

        // Add event listeners to Buy Now buttons
        setupBuyNowButtons();

    } catch (error) {
        console.error('Error loading pets:', error);
        console.error('Error details:', error.message, error.stack);
        const petsContainer = document.querySelector('.grid');
        if (petsContainer) {
            petsContainer.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #f67481;">Failed to load pets: ${error.message}<br>Please try again.</div>`;
        }
    }
}

function createPetCard(pet) {
    const primaryPhoto = pet.primary_photo || '/uploads/placeholder.jpg';
    const distance = pet.distance ? `${Math.round(pet.distance)} miles` : 'Location N/A';
    const petType = pet.type === 'dog' ? 'puppy' : 'kitten';
    const available = pet.quantity > 0 ? `${pet.quantity} available` : 'Sold out';

    return `
        <article class="card" data-pet-id="${pet.id}">
            <div class="img-box" role="img" aria-label="${Utils.sanitizeHTML(pet.breed)} photo" style="background-image: url('${primaryPhoto}'); background-size: cover; background-position: center;">
                ${!pet.primary_photo ? '[Pet Photo]' : ''}
            </div>
            <h3>${Utils.sanitizeHTML(pet.breed)}</h3>
            <p>${pet.age || 'Age N/A'} • ${available}</p>
            <p>${Utils.sanitizeHTML(pet.location || 'Location N/A')} • ${distance}</p>
            <div class="price-tag">${Utils.formatPrice(pet.price)}</div>
            ${pet.status === 'available' && pet.quantity > 0
                ? `<button class="btn btn-small buy-now-btn" data-pet-id="${pet.id}">Add to Cart</button>`
                : `<button class="btn btn-small" disabled>${pet.status === 'sold' ? 'Sold' : 'Unavailable'}</button>`
            }
        </article>
    `;
}

function setupBuyNowButtons() {
    const buyNowButtons = document.querySelectorAll('.buy-now-btn');
    buyNowButtons.forEach(button => {
        button.addEventListener('click', async (e) => {
            e.preventDefault();
            const petId = parseInt(button.dataset.petId);
            await addToCartFromBrowse(petId, button);
        });
    });
}

async function addToCartFromBrowse(petId, button) {
    try {
        // Check if user is logged in
        const user = await Utils.checkAuth();
        if (!user) {
            Utils.showToast('Please log in to add items to cart', 'error');
            window.location.href = `/login.html?redirect=${encodeURIComponent(window.location.pathname)}`;
            return;
        }

        const originalText = button.textContent;
        button.disabled = true;
        button.textContent = 'Adding...';

        await API.cart.add(petId, 1);

        Utils.showToast('Added to cart!', 'success');
        button.textContent = 'Added!';

        // Update cart count
        await Utils.updateCartCount();

        setTimeout(() => {
            button.textContent = originalText;
            button.disabled = false;
        }, 2000);

    } catch (error) {
        console.error('Error adding to cart:', error);
        Utils.showToast(error.message || 'Failed to add to cart', 'error');
        button.disabled = false;
        button.textContent = 'Add to Cart';
    }
}

function setupFilterListeners() {
    // Type checkboxes
    const typeCheckboxes = document.querySelectorAll('input[name="type"]');
    typeCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', () => {
            currentFilters.type = Array.from(typeCheckboxes)
                .filter(cb => cb.checked)
                .map(cb => cb.value);
        });
    });

    // Price filters
    const minPriceInput = document.getElementById('min-price');
    const maxPriceInput = document.getElementById('max-price');

    if (minPriceInput) {
        minPriceInput.addEventListener('change', () => {
            currentFilters.minPrice = minPriceInput.value ? parseFloat(minPriceInput.value) : null;
        });
    }

    if (maxPriceInput) {
        maxPriceInput.addEventListener('change', () => {
            currentFilters.maxPrice = maxPriceInput.value ? parseFloat(maxPriceInput.value) : null;
        });
    }

    // Age checkboxes
    const ageCheckboxes = document.querySelectorAll('input[name="age"]');
    ageCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', () => {
            currentFilters.age = Array.from(ageCheckboxes)
                .filter(cb => cb.checked)
                .map(cb => cb.value);
        });
    });

    // Distance filter
    const distanceInput = document.getElementById('distance');
    if (distanceInput) {
        distanceInput.addEventListener('change', () => {
            currentFilters.distance = distanceInput.value ? parseFloat(distanceInput.value) : null;
        });
    }

    // Sort select
    const sortSelect = document.getElementById('sort-select');
    if (sortSelect) {
        sortSelect.addEventListener('change', () => {
            currentFilters.sort = sortSelect.value;
            loadPets(currentFilters);
        });
    }

    // Apply filters button
    const applyFiltersBtn = document.querySelector('.sidebar .btn.btn-block');
    if (applyFiltersBtn) {
        applyFiltersBtn.addEventListener('click', () => {
            loadPets(currentFilters);
        });
    }
}
