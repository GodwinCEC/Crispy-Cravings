// Admin Dashboard - Enhanced with filters and multi-item order support

// State
let currentAdmin = null;
let ordersListener = null;
let allOrders = [];
let currentFilters = {
    status: 'all',
    payment: 'all',
    delivery: 'all',
    time: 'all',
    search: '',
    sort: 'newest',
    group: 'delivery'
};
let collapsedColumns = new Set();

// DOM elements
const restaurantOpenCheckbox = document.getElementById('restaurant-open');
const storeStatusText = document.getElementById('store-status-text');
const ordersTableBody = document.getElementById('orders-table-body');
const logoutBtn = document.getElementById('logout-btn');
const adminEmailEl = document.getElementById('admin-email');
const orderModal = document.getElementById('order-modal');
const closeModal = document.getElementById('close-modal');
const orderSearchInput = document.getElementById('order-search');
const exportBtn = document.getElementById('export-btn');
const refreshBtn = document.getElementById('refresh-btn');

// Close modal logic
if (closeModal) {
    closeModal.onclick = () => {
        orderModal.style.display = 'none';
        document.body.style.overflow = 'auto';
    };
}
window.onclick = (event) => {
    if (event.target === orderModal) {
        orderModal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
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
    setupColumnCollapsing();
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

    // Search
    if (orderSearchInput) {
        orderSearchInput.addEventListener('input', (e) => {
            currentFilters.search = e.target.value.toLowerCase();
            const filtered = filterOrders(allOrders);
            displayOrders(filtered);
            updateStats(filtered);
            updateKitchenSummary(filtered);
        });
    }

    // Export
    if (exportBtn) {
        exportBtn.addEventListener('click', exportToCSV);
    }

    // Refresh
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            refreshBtn.disabled = true;
            refreshBtn.innerHTML = '⏳...';
            loadOrders();
            setTimeout(() => {
                refreshBtn.disabled = false;
                refreshBtn.innerHTML = '🔄 Refresh';
            }, 1000);
        });
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

            // Re-render orders and summary
            const filtered = filterOrders(allOrders);
            displayOrders(filtered);
            updateStats(filtered);
            updateKitchenSummary(filtered);
        });
    });
}

// Setup Column Collapsing
function setupColumnCollapsing() {
    const headers = document.querySelectorAll('.orders-table th');
    headers.forEach((th, index) => {
        th.addEventListener('click', () => {
            const colIndex = index + 1; // 1-indexed
            if (collapsedColumns.has(colIndex)) {
                collapsedColumns.delete(colIndex);
            } else {
                collapsedColumns.add(colIndex);
            }
            // Update table headers
            th.classList.toggle('collapsed-col');
            // Update current body
            const filtered = filterOrders(allOrders);
            displayOrders(filtered);
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

            const filtered = filterOrders(allOrders);
            displayOrders(filtered);
            updateStats(filtered);
            updateKitchenSummary(filtered);
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
        // Time filter
        if (currentFilters.time !== 'all') {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const orderDate = order.createdAt?.toDate ? order.createdAt.toDate() : new Date();

            if (currentFilters.time === 'today') {
                if (orderDate < today) return false;
            } else if (currentFilters.time === 'week') {
                const lastWeek = new Date(today);
                lastWeek.setDate(today.getDate() - 7);
                if (orderDate < lastWeek) return false;
            }
        }

        // Status filter
        if (currentFilters.status !== 'all') {
            const paymentStatus = order.payment?.status || 'unpaid';
            const paymentMethod = (order.payment?.method || 'momo').toLowerCase();
            const isPaid = paymentStatus === 'paid';
            const isCash = paymentMethod === 'cash';
            const isDelivered = order.status === 'delivered';

            if (currentFilters.status === 'confirmed') {
                // Confirmed consists of both paid (momo) and cash
                if (!isPaid && !isCash) return false;
                if (isDelivered) return false;
            } else if (currentFilters.status === 'delivered') {
                if (!isDelivered) return false;
            }
        }

        // Payment filter
        if (currentFilters.payment !== 'all') {
            const paymentStatus = order.payment?.status || 'unpaid';
            const paymentMethod = (order.payment?.method || 'momo').toLowerCase();
            const isDigitalPaid = paymentStatus === 'paid';
            const isCash = paymentMethod === 'cash';

            if (currentFilters.payment === 'paid' && !isDigitalPaid) {
                return false;
            }
            if (currentFilters.payment === 'verified') {
                if (!isDigitalPaid && !isCash) return false;
            }
            if (currentFilters.payment === 'unpaid' && isDigitalPaid) {
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

        // Search filter
        if (currentFilters.search) {
            const searchLower = currentFilters.search;
            const customerName = (order.customer?.name || '').toLowerCase();
            const customerPhone = (order.customer?.phone || '').toLowerCase();
            const orderID = (order.orderNumber || order.id || '').toLowerCase();

            if (!customerName.includes(searchLower) &&
                !customerPhone.includes(searchLower) &&
                !orderID.includes(searchLower)) {
                return false;
            }
        }

        return true;
    }).sort((a, b) => {
        if (currentFilters.sort === 'name') {
            const nameA = (a.customer?.name || '').toLowerCase();
            const nameB = (b.customer?.name || '').toLowerCase();
            return nameA.localeCompare(nameB);
        }

        const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
        const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
        return currentFilters.sort === 'newest' ? timeB - timeA : timeA - timeB;
    });
}

// Helper to determine order type for grouping
function getOrderTypeIdentifier(order) {
    if (!order.items || order.items.length === 0) return 'Empty Order';
    if (order.items.length > 1) return 'Mixed / Multi-pack';

    const item = order.items[0];
    return `${item.springRolls}SR + ${item.samosas}S (${item.categoryName})`;
}

// Display orders in table with grouping
function displayOrders(orders) {
    if (orders.length === 0) {
        ordersTableBody.innerHTML = `
            <tr>
                <td colspan="10" style="text-align: center; padding: var(--space-xl); color: var(--text-light);">
                    <div style="font-size: 2rem; margin-bottom: var(--space-md);">📭</div>
                    <div>No orders found matching your filters.</div>
                </td>
            </tr>
        `;
        return;
    }

    const getColClass = (index) => collapsedColumns.has(index) ? 'class="collapsed-col"' : '';

    const groups = {};
    orders.forEach(order => {
        let key = 'Other';
        if (currentFilters.group === 'delivery') {
            key = order.delivery?.day || 'Other';
        } else {
            key = getOrderTypeIdentifier(order);
        }

        if (!groups[key]) groups[key] = [];
        groups[key].push(order);
    });

    // Sort group keys for consistent display
    const groupKeys = Object.keys(groups).sort((a, b) => {
        if (currentFilters.group === 'delivery') {
            const dayOrder = { 'wednesday': 1, 'saturday': 2, 'other': 3 };
            return (dayOrder[a.toLowerCase()] || 4) - (dayOrder[b.toLowerCase()] || 4);
        }
        return a.localeCompare(b);
    });

    let html = '';

    groupKeys.forEach(key => {
        const groupOrders = groups[key];
        if (groupOrders.length === 0) return;

        const label = currentFilters.group === 'delivery' ? `Delivery: ${key.toUpperCase()}` : `Type: ${key}`;

        // Header for the group
        html += `
            <tr class="group-header">
                <td colspan="10" style="background: var(--light-cream); font-weight: 800; color: var(--text-dark); padding: var(--space-sm) var(--space-md); border-left: 5px solid var(--primary-orange);">
                    📦 ${label} (${groupOrders.length})
                </td>
            </tr>
        `;

        groupOrders.forEach(order => {
            // Format items summary
            const itemsSummary = (order.items || []).map(item =>
                `${item.springRolls}SR + ${item.samosas}S (${item.categoryName})`
            ).join(' | ');

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
            let displayStatus = order.status || 'pending';
            if (displayStatus === 'pending' && !isDigital) {
                displayStatus = 'confirmed';
            }
            const statusBadgeClass = displayStatus;

            // Location
            const location = order.customer?.location || {};
            const locationText = `${location.hostel || 'Unknown'}, R${location.room || 'N/A'}`;

            // Date & Time Ordered
            const orderDateObj = order.createdAt?.toDate ? order.createdAt.toDate() : new Date();
            const timeStr = orderDateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const dateStr = orderDateObj.toLocaleDateString([], { month: 'short', day: 'numeric' });
            const dateTimeDisplay = `${dateStr}, ${timeStr}`;

            const actionButtonsHtml = `
                <button class="action-btn btn-manage" onclick="openOrderModal('${order.id}')">Manage</button>
                <!-- DELETE_START -->
                <!-- <button class="action-btn btn-cancel" style="background: var(--accent-red); color: white;" onclick="deleteOrder('${order.id}')">Delete</button> -->
                <!-- DELETE_END -->
            `;

            html += `
                <tr class="order-row ${displayStatus === 'pending' ? 'new-order' : ''}">
                    <td ${getColClass(1)}>
                        ${actionButtonsHtml}
                    </td>
                    <td ${getColClass(2)}>
                        <strong>${order.customer?.name || 'Unknown'}</strong>
                    </td>
                    <td ${getColClass(3)} style="font-size: 0.85rem; font-weight: 600; color: var(--text-light); line-height: 1.2;">
                        ${dateTimeDisplay}
                    </td>
                    <td ${getColClass(4)}>
                        <div style="display: flex; align-items: center; gap: 4px;">
                            <span>${paymentMethodIcon}</span>
                            <span class="status-badge ${paymentBadgeClass}" style="font-size: 0.7rem; padding: 2px 4px;">${paymentLabel}</span>
                        </div>
                    </td>
                    <td ${getColClass(5)}>
                        <a href="tel:${order.customer?.phone || ''}" style="color: var(--primary-orange); text-decoration: none; font-weight: 600;">
                            ${order.customer?.phone || 'N/A'}
                        </a>
                    </td>
                    <td ${getColClass(6)} style="font-size: 0.85rem;">
                        ${itemsSummary}
                    </td>
                    <td ${getColClass(7)} style="font-size: 0.85rem;">${locationText}</td>
                    <td ${getColClass(8)}>
                        <span style="font-weight: 600; font-size: 0.85rem;">${(order.delivery?.day || 'Other').toUpperCase()}</span>
                    </td>
                    <td ${getColClass(9)}>
                        <span class="status-badge ${statusBadgeClass}" style="font-size: 0.75rem;">${displayStatus.toUpperCase()}</span>
                    </td>
                    <td ${getColClass(10)}>
                        <span class="order-id" style="font-weight: 700; color: var(--text-dark);">${order.orderNumber || order.id.substring(0, 8)}</span>
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
    document.body.style.overflow = 'hidden';
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
        } else if (!isDigital) {
            // Cash Order buttons
            if (!isPaid) {
                actionButtons += `
                    <button class="btn-modal" onclick="markCashAsPaid('${order.id}')" style="background: var(--success-green); color: white;">
                        💵 Paid Cash
                    </button>
                `;
            }
            actionButtons += `
                <button class="btn-modal" onclick="handleDeliveryClick('${order.id}', 'cash')" style="background: var(--primary-orange); color: white;">
                    🚚 Confirm Delivered
                </button>
            `;
        } else {
            // Paid MoMo
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
            <div>
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
                    <span class="status-badge ${status}">
                        ${(!isDigital && status === 'pending') ? 'CASH PENDING' : status.toUpperCase()}
                    </span>
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
        const order = allOrders.find(o => o.id === orderId);
        // On Cash orders, only change Status to Delivered. Payment is independent.
        await updateDeliveryStatus(orderId, 'delivered', order.payment?.status === 'paid');
    } else {
        await updateDeliveryStatus(orderId, 'delivered', true);
    }
};

// Mark Cash as Paid
window.markCashAsPaid = async function (orderId) {
    try {
        await db.collection('orders').doc(orderId).update({
            'payment.status': 'paid',
            'payment.paidAt': firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedBy: currentAdmin.email
        });

        const orderIndex = allOrders.findIndex(o => o.id === orderId);
        if (orderIndex > -1) {
            allOrders[orderIndex].payment.status = 'paid';
            renderModalContent(allOrders[orderIndex]);
        }
    } catch (error) {
        console.error('Error marking cash as paid:', error);
        alert('Failed to update payment status.');
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

    const pendingPayments = orders.filter(order =>
        order.payment?.status !== 'paid' &&
        order.status !== 'cancelled'
    );

    // Calculate Revenues based on CURRENTLY FILTERED orders
    // So if "Today" is selected, these are Today's revenues.
    // If "All" is selected, it's Total revenues.

    // 1. Expected Revenue: All Confirmed Cash + All Successful Momo Paid
    // Exclude cancelled orders
    const expectedRevenueOrders = orders.filter(order => {
        if (order.status === 'cancelled') return false;
        const isPaid = order.payment?.status === 'paid';
        const isCash = (order.payment?.method || 'momo').toLowerCase() === 'cash';
        return isPaid || isCash;
    });
    const expectedRevenue = expectedRevenueOrders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);

    // 2. Realized Revenue: ONLY Successful Paid (Momo + Cash Paid)
    const realizedRevenueOrders = orders.filter(order => {
        if (order.status === 'cancelled') return false;
        return order.payment?.status === 'paid';
    });
    const realizedRevenue = realizedRevenueOrders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);

    // Update stat elements
    // const statPending = document.getElementById('stat-pending'); // Removed
    const statExpected = document.getElementById('stat-revenue-expected');
    if (statExpected) statExpected.textContent = formatCurrency(expectedRevenue);

    document.getElementById('stat-today').textContent = todayOrders.length;
    document.getElementById('stat-unpaid').textContent = pendingPayments.length;
    document.getElementById('stat-revenue').textContent = formatCurrency(realizedRevenue);
}

// Show error state
function showError(message) {
    ordersTableBody.innerHTML = `
        <tr>
            <td colspan="10" style="text-align: center; padding: var(--space-xl); color: var(--accent-red);">
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

    // 1. Determine next delivery day (closest Wed or Sat)
    const today = new Date();
    const day = today.getDay(); // 0-6 (Sun-Sat)

    // If today is Sun-Wed (0-3), next is Wed. If Thu-Sat (4-6), next is Sat.
    let nextDay = (day >= 0 && day <= 3) ? 'wednesday' : 'saturday';

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

    // Filter title to show which day we are prepped for
    const summaryTitle = summaryContainer.querySelector('h3');
    if (summaryTitle) {
        summaryTitle.textContent = `🍳 Kitchen Prep: ${nextDay.toUpperCase()} (${activeOrders.length} Orders)`;
    }

    // Count totals AND specific combinations
    let totals = {
        regular: { sr: 0, s: 0, count: 0, combinations: {} },
        meat_crunch_10: { sr: 0, s: 0, count: 0, combinations: {} },
        meat_crunch_7: { sr: 0, s: 0, count: 0, combinations: {} }
    };

    activeOrders.forEach(order => {
        order.items.forEach(item => {
            const cat = item.category;
            if (totals[cat]) {
                const sr = item.springRolls || 0;
                const s = item.samosas || 0;
                totals[cat].sr += sr;
                totals[cat].s += s;
                totals[cat].count++;

                const comboKey = `${sr}SR + ${s}S`;
                totals[cat].combinations[comboKey] = (totals[cat].combinations[comboKey] || 0) + 1;
            }
        });
    });

    summaryContent.innerHTML = Object.entries(totals)
        .filter(([_, data]) => data.sr + data.s > 0)
        .map(([cat, data]) => {
            const productInfo = PRODUCTS[cat] || { name: cat };
            const combosHtml = Object.entries(data.combinations)
                .sort((a, b) => b[1] - a[1]) // Sort by frequency
                .map(([combo, count]) => `
                    <div style="display: flex; justify-content: space-between; font-size: 0.8rem; margin-top: 5px; padding: 4px; background: rgba(0,0,0,0.02); border-radius: 4px;">
                        <span style="font-weight: 500;">${combo}</span>
                        <span style="font-weight: 800; color: var(--primary-orange);">x${count}</span>
                    </div>
                `).join('');

            return `
                <div class="stat-card" style="padding: var(--space-md); text-align: left; border-left: 5px solid var(--primary-orange); display: flex; flex-direction: column; gap: 8px;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                        <div>
                            <div style="font-weight: 800; color: var(--text-dark); font-size: 1.1rem;">${productInfo.name}</div>
                            <div style="font-size: 0.7rem; color: var(--text-light); text-transform: uppercase;">${productInfo.subtitle || ''}</div>
                        </div>
                        <span style="font-size: 0.75rem; background: var(--light-cream); color: var(--primary-orange); padding: 2px 8px; border-radius: 10px; font-weight: 700;">${data.count} packs</span>
                    </div>
                    
                    <div style="background: var(--gradient-warm); color: white; padding: 10px; border-radius: 8px; text-align: center;">
                        <div style="font-size: 1.35rem; font-weight: 900; letter-spacing: 1px;">
                            ${data.sr} SR / ${data.s} S
                        </div>
                        <div style="font-size: 0.65rem; text-transform: uppercase; font-weight: 600; opacity: 0.9;">Total Pieces Required</div>
                    </div>

                    <div style="margin-top: 5px;">
                        <div style="font-size: 0.65rem; color: var(--text-light); text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px; border-bottom: 1px solid #eee; padding-bottom: 4px; margin-bottom: 4px;">Splits Breakdown</div>
                        <div style="max-height: 150px; overflow-y: auto; padding-right: 4px;">
                            ${combosHtml}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
}

// Quick Delete for Development (Hide/Comment this before deployment)
window.deleteOrder = async function (orderId) {
    if (!confirm('Are you absolutely sure you want to PERMANENTLY delete this order? This cannot be undone.')) {
        return;
    }

    try {
        await db.collection('orders').doc(orderId).delete();
        // The listener will automatically remove it from the UI
        console.log(`Order ${orderId} deleted successfully`);
    } catch (error) {
        console.error('Delete error:', error);
        alert('Failed to delete order: ' + error.message);
    }
};

// Export orders to CSV
function exportToCSV() {
    if (allOrders.length === 0) {
        alert('No orders to export');
        return;
    }

    const filtered = filterOrders(allOrders);
    if (filtered.length === 0) {
        alert('No filtered orders to export');
        return;
    }

    const headers = ['Order #', 'Customer', 'Phone', 'Items', 'Amount', 'Location', 'Delivery', 'Payment Status', 'Order Status', 'Date'];
    const rows = filtered.map(order => [
        order.orderNumber || order.id.substring(0, 8),
        order.customer?.name || 'N/A',
        order.customer?.phone || 'N/A',
        (order.items || []).map(i => `${i.springRolls}SR+${i.samosas}S`).join('; '),
        order.totalAmount || 0,
        `${order.customer?.location?.hostel || 'N/A'}, R${order.customer?.location?.room || 'N/A'}`,
        order.delivery?.day || 'N/A',
        order.payment?.status || 'unpaid',
        order.status || 'pending',
        order.createdAt?.toDate ? order.createdAt.toDate().toLocaleString() : 'N/A'
    ]);

    const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `orders_export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
