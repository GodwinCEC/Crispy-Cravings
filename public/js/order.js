// Firebase configuration
const firebaseConfig = {
    apiKey: "your-api-key-here",
    authDomain: "your-project-id.firebaseapp.com",
    projectId: "your-project-id",
    storageBucket: "your-project-id.appspot.com",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:abcdefghijklmnop"
};

let db;
try {
    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
    console.log('Firebase initialized successfully for orders');
} catch (error) {
    console.error('Firebase initialization error:', error);
}

const selectedItemDiv = document.getElementById('selected-item');
const orderForm = document.getElementById('order-form');
const submitButton = document.getElementById('submit-order');
const successModal = document.getElementById('success-modal');

document.addEventListener('DOMContentLoaded', () => {
    loadSelectedItem();
    setupFormSubmission();
});

function loadSelectedItem() {
    const orderItem = localStorage.getItem('orderItem');
    if (!orderItem) {
        window.location.href = 'index.html';
        return;
    }

    const item = JSON.parse(orderItem);
    selectedItemDiv.innerHTML = `
    <div style="background: var(--light-cream); padding: var(--space-md); border-radius: var(--radius-md);">
        <h3 style="font-family: var(--font-display); color: var(--text-dark); margin-bottom: var(--space-xs);">${item.name}</h3>
        <p style="color: var(--text-light); margin-bottom: var(--space-xs);">${item.description}</p>
        <div style="font-weight: 600; color: var(--primary-orange);" id="price-display">GH¢ ${item.price.toFixed(2)} each</div>
    </div>
`;

    document.getElementById('snack-name').value = item.name;
    document.getElementById('snack-price').value = item.price;
    updateTotalPrice();
}

function setupFormSubmission() {
    orderForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (!db) {
            alert('Unable to connect to database. Please check your internet connection and try again.');
            return;
        }

        submitButton.disabled = true;
        submitButton.innerHTML = '<span class="spinner"></span> Placing Order...';

        try {
            const formData = new FormData(orderForm);
            const orderData = {
                customerName: formData.get('customerName'),
                phoneNumber: formData.get('phoneNumber'),
                hostelName: formData.get('hostelName'),
                roomNumber: formData.get('roomNumber'),
                quantity: parseInt(formData.get('quantity')),
                specialInstructions: formData.get('specialInstructions') || '',
                snackName: formData.get('snackName'),
                snackPrice: parseFloat(formData.get('snackPrice')),
                totalPrice: parseFloat(formData.get('snackPrice')) * parseInt(formData.get('quantity')),
                status: 'pending',
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                orderDate: new Date().toISOString()
            };

            if (!orderData.customerName || !orderData.phoneNumber || !orderData.hostelName || !orderData.roomNumber) {
                throw new Error('Please fill in all required fields');
            }

            if (orderData.quantity < 1 || orderData.quantity > 10) {
                throw new Error('Quantity must be between 1 and 10');
            }

            const docRef = await db.collection('orders').add(orderData);
            console.log('Order submitted successfully with ID:', docRef.id);
            localStorage.removeItem('orderItem');
            successModal.classList.remove('hidden');

        } catch (error) {
            console.error('Error submitting order:', error);
            let errorMessage = 'Failed to submit order. Please try again.';
            if (error.message.includes('offline')) {
                errorMessage = 'You appear to be offline. Please check your internet connection and try again.';
            } else if (error.message.includes('permission-denied')) {
                errorMessage = 'Database access denied. Please contact support.';
            } else if (error.message) {
                errorMessage = error.message;
            }
            alert(errorMessage);
            submitButton.disabled = false;
            submitButton.innerHTML = 'Place Order';
        }
    });

    document.getElementById('quantity').addEventListener('input', updateTotalPrice);
}

function updateTotalPrice() {
    const quantity = parseInt(document.getElementById('quantity').value) || 1;
    const price = parseFloat(document.getElementById('snack-price').value) || 0;
    const total = price * quantity;

    const priceDisplay = document.getElementById('price-display');
    if (priceDisplay) {
        priceDisplay.innerHTML = `GH¢ ${price.toFixed(2)} each | Total: <strong>GH¢ ${total.toFixed(2)}</strong>`;
    }
}