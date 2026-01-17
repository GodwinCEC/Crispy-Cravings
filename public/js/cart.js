// Cart Management System
// Handles cart operations with localStorage persistence

class CartManager {
    constructor() {
        this.storageKey = 'crispyCravingsCart';
        this.items = this.loadFromStorage();
    }

    // Load cart from localStorage
    loadFromStorage() {
        try {
            const stored = localStorage.getItem(this.storageKey);
            return stored ? JSON.parse(stored) : [];
        } catch (error) {
            console.error('Error loading cart:', error);
            return [];
        }
    }

    // Save cart to localStorage
    saveToStorage() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.items));
        } catch (error) {
            console.error('Error saving cart:', error);
        }
    }

    // Add item to cart
    addItem(item) {
        const cartItem = {
            id: generateId(),
            category: item.category,
            categoryName: PRODUCTS[item.category].name,
            subtitle: PRODUCTS[item.category].subtitle,
            preparation: item.preparation,
            springRolls: item.springRolls,
            samosas: item.samosas,
            pieceCount: item.springRolls + item.samosas,
            price: PRODUCTS[item.category].pricing[item.preparation],
            addedAt: new Date().toISOString()
        };

        this.items.push(cartItem);
        this.saveToStorage();
        this.dispatchCartUpdate();
        return cartItem;
    }

    // Remove item from cart by ID
    removeItem(itemId) {
        const index = this.items.findIndex(item => item.id === itemId);
        if (index !== -1) {
            this.items.splice(index, 1);
            this.saveToStorage();
            this.dispatchCartUpdate();
            return true;
        }
        return false;
    }

    // Update item in cart
    updateItem(itemId, updates) {
        const item = this.items.find(item => item.id === itemId);
        if (item) {
            Object.assign(item, updates);
            // Recalculate price if preparation or category changed
            if (updates.preparation || updates.category) {
                item.price = PRODUCTS[item.category].pricing[item.preparation];
            }
            this.saveToStorage();
            this.dispatchCartUpdate();
            return true;
        }
        return false;
    }

    // Get all items
    getItems() {
        return [...this.items];
    }

    // Get item count
    getItemCount() {
        return this.items.length;
    }

    // Get total price
    getTotal() {
        return this.items.reduce((sum, item) => sum + item.price, 0);
    }

    // Clear entire cart
    clear() {
        this.items = [];
        this.saveToStorage();
        this.dispatchCartUpdate();
    }

    // Check if cart is empty
    isEmpty() {
        return this.items.length === 0;
    }

    // Get cart summary for display
    getSummary() {
        return {
            items: this.getItems(),
            itemCount: this.getItemCount(),
            total: this.getTotal()
        };
    }

    // Dispatch custom event for cart updates
    dispatchCartUpdate() {
        const event = new CustomEvent('cartUpdate', {
            detail: this.getSummary()
        });
        window.dispatchEvent(event);
    }
}

// Create global cart instance
const cart = new CartManager();

// Update cart badge/preview on page load and cart updates
function updateCartUI() {
    const cartBadge = document.getElementById('cart-badge');
    const cartPreview = document.getElementById('cart-preview');
    const cartTotal = document.getElementById('cart-total');
    const cartCount = document.getElementById('cart-count');

    const summary = cart.getSummary();

    if (cartBadge) {
        cartBadge.textContent = summary.itemCount;
        cartBadge.style.display = summary.itemCount > 0 ? 'flex' : 'none';
    }

    if (cartCount) {
        cartCount.textContent = summary.itemCount;
    }

    if (cartTotal) {
        cartTotal.textContent = formatCurrency(summary.total);
    }

    if (cartPreview) {
        if (summary.itemCount > 0) {
            cartPreview.classList.remove('hidden');
        } else {
            cartPreview.classList.add('hidden');
        }
    }
}

// Listen for cart updates
window.addEventListener('cartUpdate', updateCartUI);

// Initialize cart UI on page load
document.addEventListener('DOMContentLoaded', updateCartUI);

// Render cart items on cart page
function renderCartItems() {
    const container = document.getElementById('cart-items-container');
    if (!container) return;

    const items = cart.getItems();

    if (items.length === 0) {
        container.innerHTML = `
            <div class="empty-cart">
                <div class="empty-cart-icon">🛒</div>
                <h3>Your cart is empty</h3>
                <p>Add some delicious crispies to get started!</p>
                <div style="display: flex; flex-direction: column; gap: var(--space-md); max-width: 250px; margin: 0 auto;">
                    <a href="index.html" class="btn-primary">Browse Menu</a>
                    <a href="track.html" class="btn-secondary" style="text-decoration: none;">Track Existing Order</a>
                </div>
            </div>
        `;
        return;
    }

    container.innerHTML = items.map(item => `
        <div class="cart-item" data-id="${item.id}">
            <div class="cart-item-info">
                <div class="cart-item-header">
                    <h3 class="cart-item-name">${item.categoryName}</h3>
                    <span class="cart-item-subtitle">${item.subtitle}</span>
                </div>
                <div class="cart-item-details">
                    <span class="cart-item-combo">
                        ${item.springRolls} Spring Rolls + ${item.samosas} Samosas
                    </span>
                    <span class="cart-item-prep ${item.preparation}">
                        ${item.preparation === 'fried' ? '🔥 Crispy Fried' : '❄️ Freshly Frozen'}
                    </span>
                </div>
            </div>
            <div class="cart-item-actions">
                <span class="cart-item-price">${formatCurrency(item.price)}</span>
                <button class="btn-remove" onclick="removeCartItem('${item.id}')" title="Remove item">
                    ✕
                </button>
            </div>
        </div>
    `).join('');

    // Update totals
    const totalElement = document.getElementById('cart-total-amount');
    if (totalElement) {
        totalElement.textContent = formatCurrency(cart.getTotal());
    }

    const countElement = document.getElementById('cart-item-count');
    if (countElement) {
        countElement.textContent = `${cart.getItemCount()} item${cart.getItemCount() !== 1 ? 's' : ''}`;
    }
}

// Remove item from cart (global function for onclick)
function removeCartItem(itemId) {
    cart.removeItem(itemId);
    renderCartItems();
}

// Clear entire cart
function clearCart() {
    if (confirm('Are you sure you want to clear your cart?')) {
        cart.clear();
        renderCartItems();
    }
}

// Proceed to checkout
function proceedToCheckout() {
    if (cart.isEmpty()) {
        alert('Your cart is empty!');
        return;
    }
    window.location.href = 'checkout.html';
}
