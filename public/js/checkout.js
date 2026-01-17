// Checkout Page Functionality

// Initialize checkout page
document.addEventListener('DOMContentLoaded', () => {
    // Check if cart is empty
    if (cart.isEmpty()) {
        alert('Your cart is empty. Redirecting to menu...');
        window.location.href = 'index.html';
        return;
    }

    initializeCheckout();
});

// Initialize checkout
function initializeCheckout() {
    renderOrderSummary();
    setDeliveryDates();
    setupFormListeners();
}

// Render order summary
function renderOrderSummary() {
    const summaryContainer = document.getElementById('order-summary-items');
    const totalEl = document.getElementById('order-total');
    const items = cart.getItems();

    summaryContainer.innerHTML = items.map(item => `
        <div class="order-summary-item">
            <span>${item.categoryName} (${item.subtitle})</span>
            <span>${formatCurrency(item.price)}</span>
        </div>
        <div class="order-summary-item" style="font-size: 0.8rem; color: var(--text-light);">
            <span>${item.springRolls} Spring Rolls + ${item.samosas} Samosas - ${item.preparation === 'fried' ? 'Crispy Fried' : 'Freshly Frozen'}</span>
            <span></span>
        </div>
    `).join('');

    totalEl.textContent = formatCurrency(cart.getTotal());

    // Update place order button
    const placeOrderBtn = document.querySelector('.btn-checkout-premium');
    if (placeOrderBtn) {
        placeOrderBtn.innerHTML = `PROCEED TO PAYMENT <span class="btn-arrow">❯</span>`;
    }
}

// Set delivery dates
function setDeliveryDates() {
    const wednesdayEl = document.getElementById('wednesday-date');
    const sundayEl = document.getElementById('sunday-date');

    wednesdayEl.textContent = formatDeliveryDate('wednesday');
    sundayEl.textContent = formatDeliveryDate('sunday');

    // Auto-select the nearest delivery day
    const today = new Date().getDay();
    if (today <= 3) { // Sunday to Wednesday
        document.getElementById('delivery-wednesday').checked = true;
    } else {
        document.getElementById('delivery-sunday').checked = true;
    }
}

// Setup form listeners
function setupFormListeners() {
    const form = document.getElementById('checkout-form');
    form.addEventListener('submit', handleFormSubmit);
}

// Handle location change
function handleLocationChange() {
    const locationSelect = document.getElementById('location-select');
    const customWrapper = document.getElementById('custom-location-wrapper');
    const customInput = document.getElementById('custom-location');

    if (locationSelect.value === 'other') {
        customWrapper.classList.remove('hidden');
        customInput.required = true;
    } else {
        customWrapper.classList.add('hidden');
        customInput.required = false;
    }
}

// Handle payment method change
function handlePaymentMethodChange() {
    const momoSelected = document.getElementById('payment-momo').checked;
    const emailWrapper = document.getElementById('momo-email-wrapper');
    const emailInput = document.getElementById('momo-email');

    if (momoSelected) {
        emailWrapper.classList.remove('hidden');
        emailInput.required = true;
    } else {
        emailWrapper.classList.add('hidden');
        emailInput.required = false;
    }
}

// Handle form submission
// Handle form submission
async function handleFormSubmit(e) {
    e.preventDefault();

    const form = e.target;
    const placeOrderBtn = document.querySelector('.btn-checkout-premium');
    const loadingOverlay = document.getElementById('loading-overlay');

    // Validate form
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }

    // Get form data
    const formData = getFormData();

    // Validate location
    if (formData.location.value === 'other' && !formData.customLocation) {
        alert('Please specify your location');
        return;
    }

    // Disable button and show loading
    placeOrderBtn.disabled = true;
    placeOrderBtn.innerHTML = '<span class="spinner"></span> Processing...';
    loadingOverlay.classList.remove('hidden');

    try {
        // Create order object
        const order = createOrderObject(formData);

        // 1. Create the order in Firestore FIRST (Status: Pending)
        // This ensures the ID exists when the Paystack Webhook arrives
        const orderRef = await saveOrder(order);
        const orderId = orderRef.id;
        console.log('Order created pending payment:', orderId);

        if (formData.paymentMethod === 'momo') {
            // 2a. Process Paystack Payment
            await handlePaystackPayment(order, orderId, formData);
        } else {
            // 2b. Cash on Delivery - Finalize immediately
            await finalizeSuccessfulOrder(order, orderId);
        }
    } catch (error) {
        console.error('Order error:', error);
        alert('There was an error processing your order. Please try again.');
        placeOrderBtn.disabled = false;
        placeOrderBtn.innerHTML = `PROCEED TO PAYMENT <span class="btn-arrow">❯</span>`;
        loadingOverlay.classList.add('hidden');
    }
}

// Get form data
function getFormData() {
    const locationSelect = document.getElementById('location-select');
    const locationValue = locationSelect.value;
    let campus = 'other';
    let hostel = '';

    if (locationValue && locationValue !== 'other') {
        const parts = locationValue.split(':');
        campus = parts[0];
        hostel = locationSelect.options[locationSelect.selectedIndex].text;
    } else if (locationValue === 'other') {
        hostel = document.getElementById('custom-location').value;
    }

    return {
        name: document.getElementById('customer-name').value.trim(),
        phone: document.getElementById('customer-phone').value.trim(),
        email: document.getElementById('momo-email').value.trim(),
        location: {
            value: locationValue,
            campus: campus,
            hostel: hostel
        },
        customLocation: document.getElementById('custom-location').value.trim(),
        room: document.getElementById('room-number').value.trim(),
        deliveryDay: document.querySelector('input[name="delivery-day"]:checked')?.value,
        paymentMethod: document.querySelector('input[name="payment-method"]:checked')?.value,
        notes: document.getElementById('special-instructions').value.trim()
    };
}

// Create order object
function createOrderObject(formData) {
    const items = cart.getItems();
    const orderNumber = generateOrderNumber(); // Generate here for consistency

    return {
        orderNumber: orderNumber,
        customer: {
            name: formData.name,
            phone: formData.phone,
            email: formData.email || null,
            location: {
                campus: formData.location.campus,
                hostel: formData.location.hostel,
                room: formData.room,
                customLocation: formData.location.value === 'other' ? formData.customLocation : null
            }
        },
        items: items.map(item => ({
            id: item.id,
            category: item.category,
            categoryName: item.categoryName,
            subtitle: item.subtitle,
            preparation: item.preparation,
            springRolls: item.springRolls,
            samosas: item.samosas,
            pieceCount: item.pieceCount,
            price: item.price
        })),
        totalAmount: cart.getTotal(),
        delivery: {
            day: formData.deliveryDay,
            scheduledDate: getNextDeliveryDate(formData.deliveryDay).toISOString().split('T')[0],
            status: 'pending'
        },
        payment: {
            method: formData.paymentMethod,
            status: 'pending', // Always pending initially
            reference: null,
            paidAt: null
        },
        status: 'pending',
        notes: formData.notes || null,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
}

// Generate order number
function generateOrderNumber() {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `CC-${dateStr}-${randomStr}`;
}

// Handle Paystack payment
async function handlePaystackPayment(order, orderId, formData) {
    const loadingOverlay = document.getElementById('loading-overlay');

    // Hide loading overlay so user can see Paystack popup
    loadingOverlay.classList.add('hidden');

    // Use customer's email for Paystack
    const email = formData.email;

    try {
        const handler = PaystackPop.setup({
            key: PAYSTACK_PUBLIC_KEY,
            email: email,
            amount: Math.ceil(order.totalAmount * 100), // Ensure integer
            currency: 'GHS',
            ref: order.orderNumber, // Use the generated order number as reference
            metadata: {
                orderId: orderId, // Pass Firestore ID in metadata
                orderNumber: order.orderNumber,
                customerName: formData.name,
                customerPhone: formData.phone,
                custom_fields: [
                    {
                        display_name: "Customer Name",
                        variable_name: "customer_name",
                        value: formData.name
                    },
                    {
                        display_name: "Phone",
                        variable_name: "phone",
                        value: formData.phone
                    }
                ]
            },
            callback: function (response) {
                // Payment successful
                console.log('Payment successful:', response);
                loadingOverlay.classList.remove('hidden');

                // Use IIFE to handle async operations
                (async () => {
                    try {
                        // Call Cloud Function to verify and update status immediately
                        // This acts as a reliable fallback/primary method alongside the webhook
                        const verifyPayment = firebase.functions().httpsCallable('verifyPayment');
                        await verifyPayment({ reference: response.reference });

                        // Update local object for receipt display
                        order.payment.status = 'paid';
                        order.payment.reference = response.reference;

                        await finalizeSuccessfulOrder(order, orderId);
                    } catch (error) {
                        console.error('Error verifying payment:', error);
                        // If verification fails here, we hope the webhook picks it up.
                        // We still redirect to success page but maybe with a warning?
                        // For now, let's assume success since Paystack said so, but the db update might be pending.
                        order.payment.status = 'paid';
                        order.payment.reference = response.reference;

                        // We still finalize locally so the user isn't stuck
                        await finalizeSuccessfulOrder(order, orderId);
                    }
                })();
            },
            onClose: function () {
                // User closed payment popup
                // The order is already created as 'pending'. We can leave it or mark as abandoned.
                console.log('Payment popup closed');

                const placeOrderBtn = document.querySelector('.btn-checkout-premium');
                placeOrderBtn.disabled = false;
                placeOrderBtn.innerHTML = `PROCEED TO PAYMENT <span class="btn-arrow">❯</span>`;

                // Show a message?
                alert('Payment cancelled. You can try again or change payment method.');
            }
        });

        handler.openIframe();
    } catch (err) {
        console.error("Paystack initialization error:", err);
        alert("Error initializing payment: " + err.message);
        const placeOrderBtn = document.querySelector('.btn-checkout-premium');
        placeOrderBtn.disabled = false;
        placeOrderBtn.innerHTML = `PROCEED TO PAYMENT <span class="btn-arrow">❯</span>`;
    }
}

// 1. Save initial order to Firestore
async function saveOrder(order) {
    // Create a timeout promise to prevent hanging
    const timeout = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Connection to server timed out.')), 15000);
    });

    // Add to Firestore (race against timeout)
    const docRef = await Promise.race([
        db.collection('orders').add(order),
        timeout
    ]);

    return docRef;
}

// 2. Finalize successful order (Cleanup and Redirect)
async function finalizeSuccessfulOrder(order, orderId) {
    console.log('Finalizing order:', orderId);

    // Store order info for success page
    sessionStorage.setItem('lastOrder', JSON.stringify({
        orderId: orderId,
        orderNumber: order.orderNumber,
        totalAmount: order.totalAmount,
        deliveryDay: order.delivery.day,
        paymentMethod: order.payment.method,
        paymentStatus: order.payment.status,
        customerName: order.customer.name,
        customerPhone: order.customer.phone
    }));

    // Clear cart
    cart.clear();

    // Redirect to success page
    window.location.href = 'order-success.html';
}
