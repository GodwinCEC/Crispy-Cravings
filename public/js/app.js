// Firebase configuration
const firebaseConfig = {

    apiKey: "AIzaSyDN9Zg0OhiEy2v1vjvgsd9UZE4qbPAfWIM",

    authDomain: "crispy-cravings.firebaseapp.com",

    projectId: "crispy-cravings",

    storageBucket: "crispy-cravings.firebasestorage.app",

    messagingSenderId: "823824324484",

    appId: "1:823824324484:web:ac23c1418fcfb0c8d56fd1",

    measurementId: "G-2NB4SKB853"

};
// Initialize Firebase
let app, db;
try {
    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
    console.log('Firebase initialized successfully');
} catch (error) {
    console.error('Firebase initialization error:', error);
}

// Static menu data with emoji solution
const menuItems = [
    {
        id: 'crispy-chicken',
        name: 'Crispy Chicken Strips',
        description: 'Golden, crunchy chicken strips served with our signature spicy dipping sauce',
        price: 15.99,
        emoji: '🍗',
        bgColor: 'linear-gradient(135deg, #ff6b35, #f7931e)'
    },
    {
        id: 'loaded-fries',
        name: 'Loaded Cheese Fries',
        description: 'Crispy fries topped with melted cheese, bacon bits, and green onions',
        price: 12.50,
        emoji: '🍟',
        bgColor: 'linear-gradient(135deg, #ffd23f, #ff6b35)'
    },
    {
        id: 'spicy-wings',
        name: 'Buffalo Spicy Wings',
        description: 'Juicy chicken wings tossed in our fiery buffalo sauce with celery sticks',
        price: 18.75,
        emoji: '🔥',
        bgColor: 'linear-gradient(135deg, #ff4444, #cc1e1e)'
    },
    {
        id: 'mozzarella-sticks',
        name: 'Mozzarella Sticks',
        description: 'Crispy breaded mozzarella with warm marinara dipping sauce',
        price: 10.99,
        emoji: '🧀',
        bgColor: 'linear-gradient(135deg, #ffa500, #ff7f00)'
    },
    {
        id: 'nachos-supreme',
        name: 'Nachos Supreme',
        description: 'Tortilla chips loaded with cheese, jalapeños, sour cream, and guacamole',
        price: 14.25,
        emoji: '🌮',
        bgColor: 'linear-gradient(135deg, #32cd32, #228b22)'
    },
    {
        id: 'mini-burgers',
        name: 'Mini Burger Sliders',
        description: 'Three juicy mini burgers with pickles, cheese, and our special sauce',
        price: 16.50,
        emoji: '🍔',
        bgColor: 'linear-gradient(135deg, #8b4513, #654321)'
    },
    {
        id: 'onion-rings',
        name: 'Crispy Onion Rings',
        description: 'Golden beer-battered onion rings with ranch dipping sauce',
        price: 9.75,
        emoji: '🧅',
        bgColor: 'linear-gradient(135deg, #daa520, #b8860b)'
    },
    {
        id: 'chicken-quesadilla',
        name: 'Chicken Quesadilla',
        description: 'Grilled tortilla filled with seasoned chicken, cheese, and peppers',
        price: 13.99,
        emoji: '🫓',
        bgColor: 'linear-gradient(135deg, #ff69b4, #ff1493)'
    },
    {
        id: 'jalapeño-poppers',
        name: 'Jalapeño Poppers',
        description: 'Spicy jalapeños stuffed with cream cheese and wrapped in bacon',
        price: 11.50,
        emoji: '🌶️',
        bgColor: 'linear-gradient(135deg, #ff6347, #dc143c)'
    },
    {
        id: 'chocolate-brownie',
        name: 'Chocolate Brownie Bites',
        description: 'Warm chocolate brownies served with vanilla ice cream and chocolate sauce',
        price: 8.99,
        emoji: '🍫',
        bgColor: 'linear-gradient(135deg, #8b4513, #654321)'
    }
];

// DOM elements
const menuContainer = document.getElementById('menu-container');
const availabilityBanner = document.getElementById('availability-banner');

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing app...');
    loadMenu(); // Load menu first (static data)
    if (db) {
        checkRestaurantStatus(); // Then check availability (requires Firebase)
    }
});

// Load menu items
function loadMenu() {
    console.log('Loading menu with', menuItems.length, 'items');
    
    if (!menuContainer) {
        console.error('Menu container not found!');
        return;
    }
    
    menuContainer.innerHTML = '';
    
    menuItems.forEach(item => {
        console.log('Creating card for:', item.name);
        const menuCard = createMenuCard(item);
        menuContainer.appendChild(menuCard);
    });
    
    console.log('Menu loaded successfully');
}

// Create individual menu card with emoji
function createMenuCard(item) {
    const card = document.createElement('div');
    card.className = 'snack-card';
    
    card.innerHTML = `
        <div style="width: 100%; height: 200px; border-radius: var(--radius-md); background: ${item.bgColor}; display: flex; align-items: center; justify-content: center; font-size: 4rem; margin-bottom: var(--space-md); transition: transform 0.3s ease;">
            ${item.emoji}
        </div>
        <h3 class="snack-name">${item.name}</h3>
        <p class="snack-description">${item.description}</p>
        <div class="snack-price">GH¢ ${item.price.toFixed(2)}</div>
        <button class="order-btn" onclick="orderItem('${item.id}')">
            Order Now
        </button>
    `;
    return card;
}

// Handle ordering
window.orderItem = function(itemId) {
    console.log('Order clicked for:', itemId);
    const item = menuItems.find(i => i.id === itemId);
    if (item) {
        // Store item details in localStorage for the order page
        localStorage.setItem('orderItem', JSON.stringify(item));
        // Navigate to order page
        window.location.href = 'order.html';
    }
};

// Check restaurant availability (optional - requires Firebase)
async function checkRestaurantStatus() {
    if (!db) {
        console.log('No database connection, skipping availability check');
        return;
    }
    
    try {
        const settingsRef = db.collection('settings').doc('restaurant');
        const settingsSnap = await settingsRef.get();
        
        if (settingsSnap.exists) {
            const settings = settingsSnap.data();
            const isOpen = settings.isOpen || false;
            
            if (!isOpen) {
                availabilityBanner.textContent = 'Restaurant is currently closed. Orders are not being accepted.';
                availabilityBanner.classList.remove('available', 'hidden');
                disableOrdering(true);
            } else {
                availabilityBanner.textContent = 'We\'re open and accepting orders!';
                availabilityBanner.classList.add('available');
                // availabilityBanner.classList.remove('hidden');
                disableOrdering(false);
            }
        } else {
            // Default to open if no settings found
            if (availabilityBanner) {
                availabilityBanner.classList.add('hidden');
            }
            disableOrdering(false);
        }
    } catch (error) {
        console.log('Error checking restaurant status:', error);
        // Default to open on error
        if (availabilityBanner) {
            availabilityBanner.classList.add('hidden');
        }
        disableOrdering(false);
    }
}

// Disable/enable ordering
function disableOrdering(disabled) {
    setTimeout(() => {
        const orderButtons = document.querySelectorAll('.order-btn');
        console.log('Found', orderButtons.length, 'order buttons to', disabled ? 'disable' : 'enable');
        
        orderButtons.forEach(button => {
            if (disabled) {
                button.disabled = true;
                button.textContent = 'Currently Closed';
                button.style.opacity = '0.5';
                button.style.cursor = 'not-allowed';
            } else {
                button.disabled = false;
                button.textContent = 'Order Now';
                button.style.opacity = '1';
                button.style.cursor = 'pointer';
            }
        });
    }, 100);
}