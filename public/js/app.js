// Crispy Cravings - Main Application
// Product selection and ordering functionality

// Current state for each product category
const productStates = {
    regular: {
        springRolls: PRODUCTS.regular.defaultSplit.springRolls,
        samosas: PRODUCTS.regular.defaultSplit.samosas,
        preparation: 'fried'
    },
    meat_crunch_10: {
        springRolls: PRODUCTS.meat_crunch_10.defaultSplit.springRolls,
        samosas: PRODUCTS.meat_crunch_10.defaultSplit.samosas,
        preparation: 'fried'
    },
    meat_crunch_7: {
        springRolls: PRODUCTS.meat_crunch_7.defaultSplit.springRolls,
        samosas: PRODUCTS.meat_crunch_7.defaultSplit.samosas,
        preparation: 'fried'
    }
};

// Store availability status
let isStoreOpen = true;

// DOM elements
const availabilityBanner = document.getElementById('availability-banner');
const tabButtons = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
    console.log('Crispy Cravings initialized');
    initializeTabs();
    initializeProductSelectors();
    checkStoreStatus();
});

// Initialize tab navigation
function initializeTabs() {
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetTab = button.dataset.tab;
            switchTab(targetTab);
        });
    });

    // Initialize sub-tabs (Meat Crunch)
    const subTabButtons = document.querySelectorAll('.sub-tab-btn');
    const subTabContents = document.querySelectorAll('.sub-tab-content');

    subTabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetSubTab = button.dataset.subtab;

            // Update button states
            subTabButtons.forEach(btn => {
                btn.classList.toggle('active', btn.dataset.subtab === targetSubTab);
            });

            // Update content visibility
            subTabContents.forEach(content => {
                content.classList.toggle('active', content.id === targetSubTab);
            });
        });
    });
}

// Switch between tabs
function switchTab(tabId) {
    // Update button states
    tabButtons.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabId);
    });

    // Update content visibility
    tabContents.forEach(content => {
        content.classList.toggle('active', content.id === tabId);
    });
}

// Initialize all product selectors
function initializeProductSelectors() {
    Object.keys(PRODUCTS).forEach(category => {
        updateProductDisplay(category);
    });
}

// Update the count for a product
function updateCount(category, type, delta) {
    const state = productStates[category];
    const product = PRODUCTS[category];

    if (!product.allowedSplits) {
        // Fallback to old logic if allowedSplits not defined
        let newValue = state[type] + delta;
        const maxPieces = product.pieceCount;
        const otherType = type === 'springRolls' ? 'samosas' : 'springRolls';
        if (newValue < 0) newValue = 0;
        if (newValue > maxPieces) newValue = maxPieces;
        state[type] = newValue;
        state[otherType] = maxPieces - newValue;
        updateProductDisplay(category);
        return;
    }

    // Find current split index
    const currentSplitIndex = product.allowedSplits.findIndex(s =>
        s.springRolls === state.springRolls && s.samosas === state.samosas
    );

    // Get all allowed values for the requested type, sorted
    const allowedValues = product.allowedSplits
        .map(s => s[type])
        .filter((v, i, a) => a.indexOf(v) === i) // unique
        .sort((a, b) => a - b);

    const currentIndex = allowedValues.indexOf(state[type]);
    let nextIndex = currentIndex + delta;

    // Boundary checks
    if (nextIndex < 0) nextIndex = 0;
    if (nextIndex >= allowedValues.length) nextIndex = allowedValues.length - 1;

    const nextValue = allowedValues[nextIndex];

    // Find the split that matches this next value
    const nextSplit = product.allowedSplits.find(s => s[type] === nextValue);

    if (nextSplit) {
        state.springRolls = nextSplit.springRolls;
        state.samosas = nextSplit.samosas;
    }

    // Update display
    updateProductDisplay(category);
}

// Set preparation type
function setPreparation(category, preparation) {
    productStates[category].preparation = preparation;
    updateProductDisplay(category);
}

// Update the product display for a category
function updateProductDisplay(category) {
    const state = productStates[category];
    const product = PRODUCTS[category];

    // Update spring rolls count
    const springRollsEl = document.getElementById(`${category}-spring-rolls`);
    if (springRollsEl) {
        springRollsEl.textContent = state.springRolls;
    }

    // Update samosas count
    const samosasEl = document.getElementById(`${category}-samosas`);
    if (samosasEl) {
        samosasEl.textContent = state.samosas;
    }

    // Update progress bar
    const progressEl = document.getElementById(`${category}-progress`);
    if (progressEl) {
        const percentage = ((state.springRolls + state.samosas) / product.pieceCount) * 100;
        progressEl.style.width = `${percentage}%`;
    }

    // Update piece count display
    const pieceCountEl = document.getElementById(`${category}-piece-count`);
    if (pieceCountEl) {
        pieceCountEl.textContent = `${state.springRolls + state.samosas}/${product.pieceCount}`;
    }

    // Update preparation buttons
    const prepButtons = document.querySelectorAll(`[data-category="${category}"][data-prep]`);
    prepButtons.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.prep === state.preparation);
    });

    // Update price display
    const priceEl = document.getElementById(`${category}-price`);
    if (priceEl) {
        const price = product.pricing[state.preparation];
        priceEl.textContent = formatCurrency(price);
    }

    // Update add to cart button text
    const addBtnEl = document.getElementById(`${category}-add-btn`);
    if (addBtnEl) {
        if (isStoreOpen) {
            addBtnEl.innerHTML = `Add to Cart`;
            addBtnEl.disabled = false;
        } else {
            addBtnEl.innerHTML = 'Store Closed';
            addBtnEl.disabled = true;
        }
    }
}

// Add product to cart
function addToCart(category) {
    if (!isStoreOpen) {
        alert('Sorry, we are currently not taking orders. Please check back later!');
        return;
    }

    const state = productStates[category];
    const product = PRODUCTS[category];

    // Validate that total equals required piece count
    const total = state.springRolls + state.samosas;
    if (total !== product.pieceCount) {
        alert(`Please select exactly ${product.pieceCount} pieces.`);
        return;
    }

    // Add to cart
    const item = cart.addItem({
        category: category,
        preparation: state.preparation,
        springRolls: state.springRolls,
        samosas: state.samosas
    });

    // Show feedback
    showAddedFeedback(category);

    console.log('Added to cart:', item);
}

// Show visual feedback when item is added
function showAddedFeedback(category) {
    const addBtn = document.getElementById(`${category}-add-btn`);
    if (addBtn) {
        const originalText = addBtn.innerHTML;
        addBtn.innerHTML = '✓ Added!';
        addBtn.classList.add('added');

        setTimeout(() => {
            addBtn.innerHTML = originalText;
            addBtn.classList.remove('added');
        }, 1500);
    }
}

// Check store status from Firestore
async function checkStoreStatus() {
    if (!db) {
        console.log('No database connection, defaulting to open');
        return;
    }

    try {
        const settingsRef = db.collection('settings').doc('restaurant');
        const settingsSnap = await settingsRef.get();

        if (settingsSnap.exists) {
            const settings = settingsSnap.data();
            isStoreOpen = settings.isOpen !== false; // Default to true if not set
        } else {
            isStoreOpen = true;
        }

        updateStoreStatusUI();
    } catch (error) {
        console.error('Error checking store status:', error);
        isStoreOpen = true;
        updateStoreStatusUI();
    }
}

// Update UI based on store status
function updateStoreStatusUI() {
    if (availabilityBanner) {
        if (isStoreOpen) {
            // availabilityBanner.textContent = "We're open! Order now for Wednesday or Sunday delivery 🎉";
            availabilityBanner.textContent = "";
            availabilityBanner.classList.add('available');
            // availabilityBanner.classList.remove('hidden');
        } else {
            availabilityBanner.textContent = "We're currently not taking orders. Check back soon!";
            availabilityBanner.classList.remove('available');
            availabilityBanner.classList.remove('hidden');
        }
    }

    // Update all add buttons
    Object.keys(PRODUCTS).forEach(category => {
        updateProductDisplay(category);
    });
}

// Navigate to cart
function goToCart() {
    window.location.href = 'cart.html';
}

// Carousel Logic
let currentSlide = 0;
const slides = document.querySelectorAll('.carousel-slide');
const indicators = document.querySelectorAll('.indicator');
const track = document.getElementById('carousel-track');
let carouselInterval;

// Touch/Swipe State
let startX = 0;
let isDragging = false;

function showSlide(index) {
    if (slides.length === 0 || !track) return;

    // Boundary checks
    if (index >= slides.length) currentSlide = 0;
    else if (index < 0) currentSlide = slides.length - 1;
    else currentSlide = index;

    // Move the track
    track.style.transform = `translateX(-${currentSlide * 100}%)`;

    // Update slides classes
    slides.forEach((slide, i) => {
        slide.classList.toggle('active', i === currentSlide);
    });

    // Update indicators
    indicators.forEach((indicator, i) => {
        indicator.classList.toggle('active', i === currentSlide);
    });
}

function moveSlide(delta) {
    showSlide(currentSlide + delta);
    resetCarouselInterval();
}

function setSlide(index) {
    showSlide(index);
    resetCarouselInterval();
}

function resetCarouselInterval() {
    clearInterval(carouselInterval);
    carouselInterval = setInterval(() => {
        moveSlide(1);
    }, 6000); // Slightly slower for better reading
}

// Swipe Support
if (track) {
    track.addEventListener('mousedown', (e) => {
        startX = e.pageX;
        isDragging = true;
    });

    track.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        e.preventDefault();
    });

    track.addEventListener('mouseup', (e) => {
        if (!isDragging) return;
        const endX = e.pageX;
        const diff = startX - endX;
        if (Math.abs(diff) > 50) {
            moveSlide(diff > 0 ? 1 : -1);
        }
        isDragging = false;
    });

    track.addEventListener('touchstart', (e) => {
        startX = e.touches[0].pageX;
    });

    track.addEventListener('touchend', (e) => {
        const endX = e.changedTouches[0].pageX;
        const diff = startX - endX;
        if (Math.abs(diff) > 50) {
            moveSlide(diff > 0 ? 1 : -1);
        }
    });

    // Initialize carousel auto-play
    resetCarouselInterval();
}
