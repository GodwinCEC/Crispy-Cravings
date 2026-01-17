// Admin Dashboard - Enhanced with filters and multi-item order support

// State
let currentAdmin = null;
let ordersListener = null;
let allOrders = [];
let currentFilters = {
    status: 'all',
    payment: 'all',
    delivery: 'all'
};

// DOM elements
const restaurantOpenCheckbox = document.getElementById('restaurant-open');
const storeStatusText = document.getElementById('store-status-text');
const ordersTableBody = document.getElementById('orders-table-body');
const logoutBtn = document.getElementById('logout-btn');
const adminEmailEl = document.getElementById('admin-email');
const orderModal = document.getElementById('order-modal');
const closeModal = document.getElementById('close-modal');

// Close modal logic
if (closeModal) {
    closeModal.onclick = () => orderModal.style.display = 'none';
}
window.onclick = (event) => {
    if (event.target === orderModal) orderModal.style.display = 'none';
};

// Initialize admin dashboard
document.addEventListener('DOMContentLoaded', () => {
    // Check authentication state
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            // Check if user is admin
            const isAdmin = await checkAdminStatus(user.email);
            if (isAdmin) {
                currentAdmin = user;
                initializeDashboard();
                updateAdminInfo(user.email);
            } else {
                await auth.signOut();
                redirectToLogin();
            }
        } else {
            redirectToLogin();
        }
    });
});

// Check if user is admin
async function checkAdminStatus(email) {
    try {
        const adminRef = db.collection('admins').doc(email);
        const adminDoc = await adminRef.get();

        if (adminDoc.exists) {
            const adminData = adminDoc.data();
            return adminData.role === 'admin' || adminData.role === 'super_admin';
        }

        return false;
    } catch (error) {
        console.error('Error checking admin status:', error);
        return false;
    }
}

// Initialize dashboard
function initializeDashboard() {
    loadRestaurantSettings();
    loadOrders();
    setupEventListeners();
    setupFilterListeners();
}

// Setup event listeners
function setupEventListeners() {
    // Store toggle
    if (restaurantOpenCheckbox) {
        restaurantOpenCheckbox.addEventListener('change', saveRestaurantSettings);
    }

    // Logout
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
}

// Setup filter listeners
function setupFilterListeners() {
    const filterButtons = document.querySelectorAll('.filter-btn');

    filterButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const filterType = btn.dataset.filter;
            const filterValue = btn.dataset.value;

            // Update active state
            const group = btn.closest('.filter-buttons');
            group.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Update filter
            currentFilters[filterType] = filterValue;

            // Re-render orders
            displayOrders(filterOrders(allOrders));
        });
    });
}

// Update admin info display
function updateAdminInfo(email) {
    if (adminEmailEl) {
        adminEmailEl.textContent = email;
    }
}

// Handle logout
async function handleLogout() {
    try {
        await auth.signOut();
        redirectToLogin();
    } catch (error) {
        console.error('Logout error:', error);
        alert('Error signing out. Please try again.');
    }
}

// Redirect to login page
function redirectToLogin() {
    window.location.href = 'login.html';
}

// Load restaurant settings
async function loadRestaurantSettings() {
    try {
        const settingsRef = db.collection('settings').doc('restaurant');
        const settingsSnap = await settingsRef.get();

        if (settingsSnap.exists) {
            const settings = settingsSnap.data();
            restaurantOpenCheckbox.checked = settings.isOpen || false;
            updateStoreStatusText(settings.isOpen);
        } else {
            await settingsRef.set({
                isOpen: true,
                created: firebase.firestore.FieldValue.serverTimestamp()
            });
            restaurantOpenCheckbox.checked = true;
            updateStoreStatusText(true);
        }
    } catch (error) {
        console.error('Error loading settings:', error);
    }
}

// Save restaurant settings
async function saveRestaurantSettings() {
    try {
        const isOpen = restaurantOpenCheckbox.checked;

        const settingsRef = db.collection('settings').doc('restaurant');
        await settingsRef.set({
            isOpen: isOpen,
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp(),
            updatedBy: currentAdmin.email
        });

        updateStoreStatusText(isOpen);
    } catch (error) {
        console.error('Error saving settings:', error);
        alert('Error saving settings');
    }
}

// Update store status text
function updateStoreStatusText(isOpen) {
    if (storeStatusText) {
        storeStatusText.textContent = isOpen ? 'Store is open' : 'Store is closed';
        storeStatusText.style.color = isOpen ? 'var(--success-green)' : 'var(--accent-red)';
    }
}

// Load orders with real-time updates
function loadOrders() {
    try {
        if (ordersListener) ordersListener();

        const ordersRef = db.collection('orders').orderBy('createdAt', 'desc');

        ordersListener = ordersRef.onSnapshot((snapshot) => {
            allOrders = [];
            snapshot.forEach((doc) => {
                allOrders.push({ id: doc.id, ...doc.data() });
            });

            displayOrders(filterOrders(allOrders));
            updateStats(allOrders);
            updateKitchenSummary(allOrders);
        }, (error) => {
            console.error('Error loading orders:', error);
            showError(`Error loading orders: ${error.message}`);
        });

    } catch (error) {
        console.error('Error setting up orders listener:', error);
        showError('Error setting up real-time updates');
    }
}

// Filter orders based on current filters
function filterOrders(orders) {
    return orders.filter(order => {
        // Status filter
        if (currentFilters.status !== 'all' && order.status !== currentFilters.status) {
            return false;
        }

        // Payment filter
        if (currentFilters.payment !== 'all') {
            const paymentStatus = order.payment?.status || 'unpaid';
            if (currentFilters.payment === 'paid' && paymentStatus !== 'paid') {
                return false;
            }
            if (currentFilters.payment === 'unpaid' && paymentStatus === 'paid') {
                return false;
            }
        }

        // Delivery filter
        if (currentFilters.delivery !== 'all') {
            const deliveryDay = order.delivery?.day || '';
            if (deliveryDay !== currentFilters.delivery) {
                return false;
            }
        }

        return true;
    });
}

// Display orders in table with grouping
function displayOrders(orders) {
    if (orders.length === 0) {
        ordersTableBody.innerHTML = `
            <tr>
                <td colspan="9" style="text-align: center; padding: var(--space-xl); color: var(--text-light);">
                    <div style="font-size: 2rem; margin-bottom: var(--space-md);">📭</div>
                    <div>No orders found matching your filters.</div>
                </td>
            </tr>
        `;
        return;
    }

    // Group orders by delivery day
    const groups = {
        'wednesday': [],
        'sunday': [],
        'other': []
    };

    orders.forEach(order => {
        const day = order.delivery?.day || 'other';
        if (groups[day]) groups[day].push(order);
        else groups['other'].push(order);
    });

    let html = '';

    Object.entries(groups).forEach(([day, dayOrders]) => {
        if (dayOrders.length === 0) return;

        // Header for the group
        html += `
            <tr class="group-header">
                <td colspan="9" style="background: var(--light-cream); font-weight: 800; color: var(--text-dark); padding: var(--space-sm) var(--space-md); border-left: 5px solid var(--primary-orange);">
                    📦 Delivery: ${day.toUpperCase()} (${dayOrders.length})
                </td>
            </tr>
        `;

        dayOrders.forEach(order => {
            // Format items summary
            const itemCount = (order.items || []).length;
            const itemsSummary = itemCount > 0
                ? `${order.items[0].springRolls}SR + ${order.items[0].samosas}S ${itemCount > 1 ? `(+${itemCount - 1} more)` : ''}`
                : 'No items';

            // Payment logic
            const paymentStatus = order.payment?.status || 'unpaid';
            const isPaid = paymentStatus === 'paid';
            const rawMethod = (order.payment?.method || 'momo').toLowerCase();
            const isDigital = rawMethod !== 'cash';

            let paymentBadgeClass = '';
            let paymentLabel = isPaid ? 'PAID' : (isDigital ? 'UNVERIFIED' : 'CASH');

            if (isPaid) paymentBadgeClass = 'paid';
            else if (isDigital) paymentBadgeClass = 'pending';
            else paymentBadgeClass = 'unpaid';

            const paymentMethodIcon = isDigital ? '📱' : '💵';

            // Order status logic
            const status = order.status || 'pending';
            const statusBadgeClass = status;

            // Location
            const location = order.customer?.location || {};
            const locationText = `${location.hostel || 'Unknown'}, R${location.room || 'N/A'}`;

            html += `
                <tr class="order-row ${status === 'pending' ? 'new-order' : ''}">
                    <td>
                        <span class="order-id" style="font-weight: 700; color: var(--text-dark);">${order.orderNumber || order.id.substring(0, 8)}</span>
                    </td>
                    <td>
                        <strong>${order.customer?.name || 'Unknown'}</strong>
                    </td>
                    <td>
                        <a href="tel:${order.customer?.phone || ''}" style="color: var(--primary-orange); text-decoration: none; font-weight: 600;">
                            ${order.customer?.phone || 'N/A'}
                        </a>
                    </td>
                    <td style="font-size: 0.85rem;">
                        ${itemsSummary}
                    </td>
                    <td style="font-size: 0.85rem;">${locationText}</td>
                    <td>
                        <span style="font-weight: 600; font-size: 0.85rem;">${day.toUpperCase()}</span>
                    </td>
                    <td>
                        <div style="display: flex; align-items: center; gap: 4px;">
                            <span>${paymentMethodIcon}</span>
                            <span class="status-badge ${paymentBadgeClass}" style="font-size: 0.7rem; padding: 2px 4px;">${paymentLabel}</span>
                        </div>
                    </td>
                    <td>
                        <span class="status-badge ${statusBadgeClass}" style="font-size: 0.75rem;">${status.toUpperCase()}</span>
                    </td>
                    <td>
                        <button class="action-btn btn-manage" onclick="openOrderModal('${order.id}')">Manage</button>
                    </td>
                </tr>
            `;
        });
    });

    ordersTableBody.innerHTML = html;
}

// Open Order Management Modal
window.openOrderModal = function (orderId) {
    const order = allOrders.find(o => o.id === orderId);
    if (!order) return;

    renderModalContent(order);
    orderModal.style.display = 'block';
};

// Render Modal Content based on order state
function renderModalContent(order) {
    const modalBody = document.getElementById('modal-body');
    const orderNumber = order.orderNumber || order.id.substring(0, 8);
    document.getElementById('modal-order-number').textContent = `Order # ${orderNumber}`;

    const itemsHtml = (order.items || []).map(item => `
        <div style="padding: 10px; background: var(--light-cream); border-radius: 8px; margin-bottom: 8px;">
            <div style="font-weight: 700;">${item.categoryName} (${item.subtitle})</div>
            <div style="font-size: 0.85rem; color: var(--text-light);">
                ${item.springRolls} SR / ${item.samosas} S - ${item.preparation}
            </div>
            <div style="font-weight: 800; color: var(--primary-orange); text-align: right;">${formatCurrency(item.price)}</div>
        </div>
    `).join('');

    const isDigital = (order.payment?.method || 'momo').toLowerCase() !== 'cash';
    const isPaid = order.payment?.status === 'paid';
    const status = order.status || 'pending';

    // Primary Action Button logic based on state
    let actionButtons = '';

    if (status !== 'delivered' && status !== 'cancelled') {
        if (isDigital && !isPaid) {
            // Unverified MoMo
            actionButtons += `
                <button class="btn-modal" onclick="verifyOrderPayment('${order.id}')" style="background: var(--primary-orange); color: white;">
                    🔍 Verify Payment
                </button>
            `;
        } else {
            // Paid MoMo or Any Cash
            actionButtons += `
                <button class="btn-modal" onclick="handleDeliveryClick('${order.id}', '${order.payment?.method}')" style="background: var(--success-green); color: white;">
                    🚚 Mark Delivered
                </button>
            `;
        }

        // Always show Cancel option if not completed
        actionButtons += `
            <button class="btn-modal" onclick="updateStatusFromModal('${order.id}', 'cancelled')" style="background: var(--accent-red); color: white;">
                ❌ Cancel Order
            </button>
        `;
    } else {
        // Undo / Completion State
        actionButtons += `
            <div style="grid-column: span 2; text-align: center; padding: 10px; background: var(--light-cream); border-radius: 8px; font-weight: 600;">
                Order is ${status.toUpperCase()}
            </div>
            <button class="btn-modal" onclick="updateStatusFromModal('${order.id}', 'pending')" style="grid-column: span 2; background: var(--text-light); color: white; margin-top: 10px;">
                🔄 Reset to New Order (Undo)
            </button>
        `;
    }

    modalBody.innerHTML = `
        <div class="modal-section">
            <div class="modal-section-title">Customer Information</div>
            <div class="modal-grid">
                <div>
                    <div class="modal-label">Name</div>
                    <div class="modal-value">${order.customer?.name}</div>
                </div>
                <div>
                    <div class="modal-label">Phone</div>
                    <div class="modal-value">
                        <a href="tel:${order.customer?.phone}" style="color: var(--primary-orange); text-decoration: none;">${order.customer?.phone}</a>
                    </div>
                </div>
            </div>
            <div style="margin-top: 10px;">
                <div class="modal-label">Delivery Location</div>
                <div class="modal-value">${order.customer?.location?.hostel}, Room ${order.customer?.location?.room}</div>
            </div>
        </div>

        <div class="modal-section">
            <div class="modal-section-title">Order Items</div>
            <div style="max-height: 200px; overflow-y: auto;">
                ${itemsHtml}
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 15px; padding-top: 10px; border-top: 2px dashed var(--light-cream);">
                <span style="font-weight: 700;">TOTAL AMOUNT</span>
                <span style="font-size: 1.25rem; font-weight: 800; color: var(--primary-orange);">${formatCurrency(order.totalAmount)}</span>
            </div>
        </div>

        <div class="modal-section" style="border-bottom: none;">
            <div class="modal-section-title">Current Status</div>
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <span class="status-badge ${status}">${status.toUpperCase()}</span>
                    <span class="status-badge ${isPaid ? 'paid' : (isDigital ? 'pending' : 'unpaid')}" style="margin-left: 5px;">
                        ${isPaid ? 'PAID' : (isDigital ? 'UNVERIFIED' : 'CASH - UNPAID')}
                    </span>
                </div>
                <div style="font-size: 0.8rem; color: var(--text-light);">${order.delivery?.day.toUpperCase()} DELIVERY</div>
            </div>
            
            <div class="modal-actions">
                ${actionButtons}
            </div>
        </div>
    `;
}

// Handler for Delivery Button
window.handleDeliveryClick = async function (orderId, paymentMethod) {
    if (paymentMethod === 'cash') {
        // Default to Paid if it's Cash delivery, can be undone via Reset if needed
        await updateDeliveryStatus(orderId, 'delivered', true);
    } else {
        await updateDeliveryStatus(orderId, 'delivered', true);
    }
};

// Core status update via modal
window.updateStatusFromModal = async function (orderId, newStatus) {

    try {
        await db.collection('orders').doc(orderId).update({
            status: newStatus,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedBy: currentAdmin.email
        });

        // Refresh local UI
        const orderIndex = allOrders.findIndex(o => o.id === orderId);
        if (orderIndex > -1) {
            allOrders[orderIndex].status = newStatus;
            renderModalContent(allOrders[orderIndex]);
        }
    } catch (error) {
        console.error('Update error:', error);
        alert('Failed to update status.');
    }
};

// Update delivery and payment status
async function updateDeliveryStatus(orderId, status, isPaid) {
    try {
        const updateData = {
            status: status,
            'payment.status': isPaid ? 'paid' : 'unpaid',
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedBy: currentAdmin.email
        };

        if (isPaid) {
            updateData['payment.paidAt'] = firebase.firestore.FieldValue.serverTimestamp();
        }

        await db.collection('orders').doc(orderId).update(updateData);

        // Refresh local UI
        const orderIndex = allOrders.findIndex(o => o.id === orderId);
        if (orderIndex > -1) {
            allOrders[orderIndex].status = status;
            allOrders[orderIndex].payment.status = isPaid ? 'paid' : 'unpaid';
            renderModalContent(allOrders[orderIndex]);
        }
    } catch (error) {
        console.error('Delivery update error:', error);
        alert('Failed to update delivery.');
    }
}

// Manual verify from modal
window.verifyOrderPayment = async function (orderId) {
    const order = allOrders.find(o => o.id === orderId);
    if (!order) return;

    const btn = event.currentTarget;
    const originalContent = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '⏳ Verifying...';

    try {
        const verifyPayment = firebase.functions().httpsCallable('verifyPayment');
        const result = await verifyPayment({ reference: order.orderNumber });

        if (result.data.success) {
            // The listener will catch the remote DB update and refresh displays
            // but for immediate feedback:
            order.payment.status = 'paid';
            renderModalContent(order);
        }
    } catch (error) {
        console.error('Verify error:', error);
        alert('Could not verify payment: ' + error.message);
        btn.disabled = false;
        btn.innerHTML = originalContent;
    }
};

// Update statistics
function updateStats(orders) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayOrders = orders.filter(order => {
        const orderDate = order.createdAt?.toDate ? order.createdAt.toDate() : new Date();
        return orderDate >= today;
    });

    const pendingOrders = orders.filter(order => order.status === 'pending' || order.status === 'confirmed');
    const pendingPayments = orders.filter(order =>
        order.payment?.status !== 'paid' &&
        order.status !== 'cancelled'
    );

    const paidTodayOrders = todayOrders.filter(order => order.payment?.status === 'paid');
    const totalRevenue = paidTodayOrders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);

    // Update stat elements
    document.getElementById('stat-pending').textContent = pendingOrders.length;
    document.getElementById('stat-today').textContent = todayOrders.length;
    document.getElementById('stat-unpaid').textContent = pendingPayments.length;
    document.getElementById('stat-revenue').textContent = formatCurrency(totalRevenue);
}

// Show error state
function showError(message) {
    ordersTableBody.innerHTML = `
        <tr>
            <td colspan="9" style="text-align: center; padding: var(--space-xl); color: var(--accent-red);">
                <div style="font-size: 1.5rem; margin-bottom: var(--space-md);">❌</div>
                <div>${message}</div>
            </td>
        </tr>
    `;
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (ordersListener) ordersListener();
});

// Calculate and display kitchen prep summary
function updateKitchenSummary(orders) {
    const summaryContainer = document.getElementById('kitchen-summary-container');
    const summaryContent = document.getElementById('kitchen-summary-content');

    // 1. Determine next delivery day (closest Wed or Sun)
    const today = new Date();
    const day = today.getDay(); // 0-6 (Sun-Sat)

    // If today is Mon-Wed, next is Wed. If Thu-Sun, next is Sun.
    let nextDay = (day >= 1 && day <= 3) ? 'wednesday' : 'sunday';

    // Filter active orders for the next delivery day
    const activeOrders = orders.filter(o =>
        o.delivery?.day === nextDay &&
        (o.status === 'pending' || o.status === 'confirmed')
    );

    if (activeOrders.length === 0) {
        summaryContainer.classList.add('hidden');
        return;
    }

    summaryContainer.classList.remove('hidden');

    // Count totals
    let totals = {
        regular: { sr: 0, s: 0, count: 0 },
        meat_crunch_10: { sr: 0, s: 0, count: 0 },
        meat_crunch_7: { sr: 0, s: 0, count: 0 }
    };

    activeOrders.forEach(order => {
        order.items.forEach(item => {
            const cat = item.category;
            if (totals[cat]) {
                totals[cat].sr += (item.springRolls || 0);
                totals[cat].s += (item.samosas || 0);
                totals[cat].count++;
            }
        });
    });

    summaryContent.innerHTML = Object.entries(totals)
        .filter(([_, data]) => data.sr + data.s > 0)
        .map(([cat, data]) => {
            const name = PRODUCTS[cat]?.name || cat;
            return `
                <div class="stat-card" style="padding: var(--space-md); text-align: left; border-left: 4px solid var(--primary-orange);">
                    <div style="font-weight: 700; color: var(--text-dark); margin-bottom: 4px;">${name}</div>
                    <div style="font-size: 1.2rem; font-weight: 800; color: var(--primary-orange);">
                        ${data.sr} SR / ${data.s} S
                    </div>
                    <div style="font-size: 0.75rem; color: var(--text-light); text-transform: uppercase;">
                        From ${data.count} ${data.count === 1 ? 'order' : 'orders'}
                    </div>
                </div>
            `;
        }).join('');
}
