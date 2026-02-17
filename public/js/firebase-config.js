// Firebase Configuration - Single Source of Truth
console.log('--- Config Version 2.0 Loaded ---');
// All other JS files should use this config

const firebaseConfig = {
    apiKey: "AIzaSyDN9Zg0OhiEy2v1vjvgsd9UZE4qbPAfWIM",
    authDomain: "crispy-cravings.firebaseapp.com",
    projectId: "crispy-cravings",
    storageBucket: "crispy-cravings.firebasestorage.app",
    messagingSenderId: "823824324484",
    appId: "1:823824324484:web:ac23c1418fcfb0c8d56fd1",
    measurementId: "G-2NB4SKB853"
};

// Paystack Public Key (replace with your actual key)
const PAYSTACK_PUBLIC_KEY = 'pk_live_c5dda9f9570df27bfddfdf976407c79d0a12bb57';

// Product Configuration
const PRODUCTS = {
    regular: {
        id: 'regular',
        name: 'Regular Crispies',
        subtitle: 'Meat and veggie mix',
        description: '5-piece combo of glazed spring rolls and samosas with a savory mix of meat and fresh veggies',
        pieceCount: 5,
        defaultSplit: { springRolls: 3, samosas: 2 },
        allowedSplits: [
            { springRolls: 5, samosas: 0 },
            { springRolls: 3, samosas: 2 },
            { springRolls: 2, samosas: 3 },
            { springRolls: 0, samosas: 5 }
        ],
        pricing: { frozen: 30, fried: 35 },
        emoji: '🥟'
    },
    meat_crunch_10: {
        id: 'meat_crunch_10',
        name: 'Meat Crunch',
        subtitle: '10-Piece Pure Meat',
        description: '10-piece combo with savory meat filling - no veggies, just pure meat goodness',
        pieceCount: 10,
        defaultSplit: { springRolls: 5, samosas: 5 },
        allowedSplits: [
            { springRolls: 10, samosas: 0 },
            { springRolls: 5, samosas: 5 },
            { springRolls: 0, samosas: 10 }
        ],
        pricing: { frozen: 70, fried: 75 },
        emoji: '🍖'
    },
    meat_crunch_7: {
        id: 'meat_crunch_7',
        name: 'Meat Crunch',
        subtitle: '7-Piece Pure Meat',
        description: '7-piece combo with savory meat filling - no veggies, just pure meat goodness',
        pieceCount: 7,
        defaultSplit: { springRolls: 4, samosas: 3 },
        allowedSplits: [
            { springRolls: 7, samosas: 0 },
            { springRolls: 4, samosas: 3 },
            { springRolls: 3, samosas: 4 },
            { springRolls: 0, samosas: 7 }
        ],
        pricing: { frozen: 45, fried: 50 },
        emoji: '🍖'
    }
};

// Location Options
const LOCATIONS = {
    knust: {
        label: 'KNUST Campus',
        options: [
            { value: 'unity', label: 'Unity Hall (Conti)' },
            { value: 'katanga', label: 'University Hall (Katanga)' },
            { value: 'independence', label: 'Independence Hall' },
            { value: 'republic', label: 'Republic Hall' },
            { value: 'qeh', label: 'Queen Elizabeth Hall' }
        ]
    },
    kath: {
        label: 'KATH Campus',
        options: [
            { value: 'laing', label: 'Laing Hostel' },
            { value: 'valco', label: 'Valco' },
            { value: 'getfund', label: 'Getfund' },
            { value: 'gold', label: 'Gold' }
        ]
    }
};

// Delivery Days
const DELIVERY_DAYS = ['wednesday', 'saturday'];

// Initialize Firebase (only if not already initialized)
// Initialize Firebase (only if not already initialized)
let db, auth, functions;
try {
    if (typeof firebase !== 'undefined') {
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }
        db = firebase.firestore();

        // Initialize Auth if available
        if (typeof firebase.auth === 'function') {
            auth = firebase.auth();
        }

        // Initialize Functions if available
        if (typeof firebase.functions === 'function') {
            functions = firebase.functions();
        }

        console.log('Firebase initialized successfully');
    } else {
        console.warn('Firebase SDK not loaded.');
    }
} catch (error) {
    console.error('Firebase initialization error:', error);
}

// Utility function to format currency
function formatCurrency(amount) {
    return `GH₵${amount.toFixed(2)}`;
}

// Utility function to generate unique IDs
function generateId() {
    return 'item_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Get next delivery date for a given day
function getNextDeliveryDate(day) {
    const days = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };
    const today = new Date();
    const targetDay = days[day.toLowerCase()];
    const currentDay = today.getDay();

    let daysUntil = targetDay - currentDay;
    if (daysUntil <= 0) {
        daysUntil += 7;
    }

    const nextDate = new Date(today);
    nextDate.setDate(today.getDate() + daysUntil);
    return nextDate;
}

// Format date for display
function formatDeliveryDate(day) {
    const date = getNextDeliveryDate(day);
    return date.toLocaleDateString('en-GB', {
        weekday: 'long',
        day: 'numeric',
        month: 'short'
    });
}


