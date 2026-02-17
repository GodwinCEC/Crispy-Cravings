// Order Tracking Functionality

// Initialize tracking page
document.addEventListener('DOMContentLoaded', () => {
    setupTrackForm();

    // Check if coming from success page with order data
    const lastOrder = sessionStorage.getItem('lastOrder');
    if (lastOrder) {
        const order = JSON.parse(lastOrder);
        document.getElementById('track-order-number').value = order.orderNumber;
        document.getElementById('track-phone').value = order.customerPhone;
    }
});

// Setup track form
function setupTrackForm() {
    const form = document.getElementById('track-form');
    form.addEventListener('submit', handleTrackSubmit);
}

// Handle track form submission
async function handleTrackSubmit(e) {
    e.preventDefault();

    const orderNumber = document.getElementById('track-order-number').value.trim().toUpperCase();
    const phone = document.getElementById('track-phone').value.trim();
    const errorEl = document.getElementById('track-error');
    const submitBtn = e.target.querySelector('button[type="submit"]');

    // Hide error
    errorEl.classList.add('hidden');

    // Validate inputs
    if (!orderNumber || !phone) {
        showError('Please enter both order number and phone number');
        return;
    }

    // Show loading state
    const originalBtnText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="loading-spinner"></span> Tracking...';

    try {
        // Call Cloud Function to track order (bypasses Firestore rules)
        const trackOrderFn = firebase.functions().httpsCallable('trackOrder');

        console.log('Sending tracking request:', { orderNumber, phone });

        const result = await trackOrderFn({
            orderNumber: orderNumber,
            phone: phone
        });

        const order = result.data;

        // Display order status
        displayOrderStatus(order);

    } catch (error) {
        console.error('Error tracking order:', error);

        let msg = 'Unable to track order. Please try again later.';
        if (error.code === 'not-found' || (error.message && error.message.includes('not found'))) {
            msg = 'Order not found. Please check your order number and phone number.'; // More specific error
        }

        showError(msg);
    } finally {
        // Restore button state
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnText;
    }
}

// Show error message
function showError(message) {
    const errorEl = document.getElementById('track-error');
    errorEl.textContent = message;
    errorEl.classList.remove('hidden');
}

// Display order status
function displayOrderStatus(order) {
    // Hide form, show status
    document.getElementById('track-form-container').classList.add('hidden');
    document.getElementById('order-status-container').classList.remove('hidden');

    // Status icon and text based on order status
    const statusIcon = document.getElementById('status-icon');
    const statusText = document.getElementById('status-text');
    const statusBadge = document.getElementById('status-badge');

    switch (order.status) {
        case 'pending':
            statusIcon.textContent = '📦';
            statusText.textContent = 'Order Received';
            statusBadge.textContent = 'Pending';
            statusBadge.className = 'status-badge pending';
            break;
        case 'confirmed':
            statusIcon.textContent = '👨‍🍳';
            statusText.textContent = 'Order Confirmed';
            statusBadge.textContent = 'Confirmed';
            statusBadge.className = 'status-badge confirmed';
            break;
        case 'delivered':
            statusIcon.textContent = '✅';
            statusText.textContent = 'Order Delivered';
            statusBadge.textContent = 'Delivered';
            statusBadge.className = 'status-badge delivered';
            break;
        case 'cancelled':
            statusIcon.textContent = '❌';
            statusText.textContent = 'Order Cancelled';
            statusBadge.textContent = 'Cancelled';
            statusBadge.className = 'status-badge cancelled';
            break;
        default:
            statusIcon.textContent = '📦';
            statusText.textContent = 'Order Status';
            statusBadge.textContent = order.status;
            statusBadge.className = 'status-badge pending';
    }

    // Order details
    document.getElementById('display-order-number').textContent = order.orderNumber;
    document.getElementById('display-customer').textContent = order.customer.name;
    document.getElementById('display-location').textContent = `${order.customer.location.hostel}, Room ${order.customer.location.room}`;
    document.getElementById('display-delivery-day').textContent = capitalizeFirst(order.delivery.day);

    // Payment status & Method
    const paymentStatusEl = document.getElementById('display-payment-status');
    const paymentMethodIcon = document.getElementById('display-payment-method-icon');
    const rePaymentContainer = document.getElementById('re-payment-container');
    const payNowBtn = document.getElementById('btn-pay-now');

    const isDigital = (order.payment?.method || 'momo').toLowerCase() !== 'cash';
    const isPaid = order.payment.status === 'paid';

    // Set method icon/text
    paymentMethodIcon.innerHTML = isDigital ? '📱 MoMo' : '💵 Cash';
    paymentMethodIcon.style.fontSize = '0.85rem';
    paymentMethodIcon.style.fontWeight = '600';

    if (isPaid) {
        paymentStatusEl.textContent = 'Paid';
        paymentStatusEl.className = 'status-badge paid';
        rePaymentContainer.classList.add('hidden');
    } else {
        paymentStatusEl.textContent = isDigital ? 'Pending Payment' : 'Pay on Delivery';
        paymentStatusEl.className = 'status-badge unpaid';

        // Show Pay Now button only for MoMo that isn't paid
        if (isDigital) {
            rePaymentContainer.classList.remove('hidden');

            // Setup re-payment handler
            payNowBtn.onclick = () => initiateRePayment(order);
        }
    }

    // Items
    const itemsContainer = document.getElementById('display-items');
    itemsContainer.innerHTML = order.items.map(item => `
        <div style="padding: var(--space-xs) 0; border-bottom: 1px solid var(--light-cream);">
            <div style="display: flex; justify-content: space-between;">
                <span>${PRODUCTS[item.category]?.name || item.categoryName} (${PRODUCTS[item.category]?.subtitle || item.subtitle})</span>
                <span style="font-weight: 600;">${formatCurrency(item.price)}</span>
            </div>
            <div style="font-size: 0.85rem; color: var(--text-light);">
                ${item.springRolls} Spring Rolls + ${item.samosas} Samosas - ${item.preparation === 'fried' ? 'Crispy Fried' : 'Freshly Frozen'}
            </div>
        </div>
    `).join('');

    // Total
    document.getElementById('display-total').textContent = formatCurrency(order.totalAmount);
}

// Initiate re-payment for existing order
async function initiateRePayment(order) {
    const payNowBtn = document.getElementById('btn-pay-now');
    const originalText = payNowBtn.innerHTML;

    payNowBtn.disabled = true;
    payNowBtn.innerHTML = '<span class="loading-spinner" style="width:12px; height:12px; margin-right:4px;"></span> Initializing...';

    try {
        const handler = PaystackPop.setup({
            key: PAYSTACK_PUBLIC_KEY,
            email: order.customer.email || 'customer@crispycravings.com',
            amount: Math.ceil(order.totalAmount * 100),
            currency: 'GHS',
            ref: order.orderNumber,
            callback: async function (response) {
                payNowBtn.innerHTML = 'Verifying...';
                try {
                    const verifyPayment = firebase.functions().httpsCallable('verifyPayment');
                    await verifyPayment({ reference: response.reference });

                    // Refresh current view
                    alert('Payment successful!');
                    location.reload();
                } catch (err) {
                    console.error('Verification error:', err);
                    alert('Payment received but verification failed. Our team will check manually.');
                    location.reload();
                }
            },
            onClose: function () {
                payNowBtn.disabled = false;
                payNowBtn.innerHTML = originalText;
            }
        });
        handler.openIframe();
    } catch (err) {
        console.error('Paystack error:', err);
        alert('Error starting payment: ' + err.message);
        payNowBtn.disabled = false;
        payNowBtn.innerHTML = originalText;
    }
}

// Reset tracker to search again
function resetTracker() {
    document.getElementById('track-form-container').classList.remove('hidden');
    document.getElementById('order-status-container').classList.add('hidden');
    document.getElementById('track-form').reset();
    document.getElementById('track-error').classList.add('hidden');
}

// Helper function
function capitalizeFirst(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}
