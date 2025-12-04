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
let auth, db;
let currentAdmin = null;
let isFirebaseReady = false;

try {
    firebase.initializeApp(firebaseConfig);
    auth = firebase.auth();
    db = firebase.firestore();
    isFirebaseReady = true;
    console.log('Firebase initialized for admin');
} catch (error) {
    console.error('Firebase initialization error:', error);
}

// DOM elements
const restaurantOpenCheckbox = document.getElementById('restaurant-open');
const saveSettingsBtn = document.getElementById('save-settings');
const settingsStatus = document.getElementById('settings-status');
const ordersTableBody = document.getElementById('orders-table-body');
const statsContainer = document.getElementById('stats-container');
const logoutBtn = document.getElementById('logout-btn');
const adminInfo = document.getElementById('admin-info');

let ordersListener = null;

// Initialize admin dashboard
document.addEventListener('DOMContentLoaded', () => {
    if (!isFirebaseReady) {
        showError('Firebase not configured properly');
        return;
    }

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
                // Not an admin - redirect to login
                await auth.signOut();
                redirectToLogin();
            }
        } else {
            // Not logged in - redirect to login
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
            return adminData.role === 'admin';
        }
        
        return false;
    } catch (error) {
        console.error('Error checking admin status:', error);
        return false;
    }
}

// Initialize dashboard after authentication
function initializeDashboard() {
    loadRestaurantSettings();
    loadOrders();
    setupEventListeners();
}

// Setup event listeners
function setupEventListeners() {
    if (saveSettingsBtn) {
        saveSettingsBtn.addEventListener('click', saveRestaurantSettings);
    }
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
}

// Update admin info display
function updateAdminInfo(email) {
    if (adminInfo) {
        adminInfo.innerHTML = `
            <span style="color: var(--text-light); font-size: 0.9rem;">
                Logged in as: <strong>${email}</strong>
            </span>
        `;
    }
}

// Handle logout
async function handleLogout() {
    try {
        await auth.signOut();
        console.log('Admin logged out');
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

// Show error state
function showError(message) {
    ordersTableBody.innerHTML = `
        <tr>
            <td colspan="10" style="text-align: center; padding: var(--space-xl); color: var(--accent-red);">
                <div style="font-size: 1.2rem; margin-bottom: var(--space-md);">❌</div>
                <div>${message}</div>
            </td>
        </tr>
    `;
}

// Load restaurant settings
async function loadRestaurantSettings() {
    try {
        const settingsRef = db.collection('settings').doc('restaurant');
        const settingsSnap = await settingsRef.get();
        
        if (settingsSnap.exists) {
            const settings = settingsSnap.data();
            restaurantOpenCheckbox.checked = settings.isOpen || false;
        } else {
            await settingsRef.set({ 
                isOpen: true,
                created: firebase.firestore.FieldValue.serverTimestamp()
            });
            restaurantOpenCheckbox.checked = true;
        }
    } catch (error) {
        console.error('Error loading settings:', error);
    }
}

// Save restaurant settings
async function saveRestaurantSettings() {
    try {
        saveSettingsBtn.disabled = true;
        saveSettingsBtn.innerHTML = '<span class="spinner"></span> Saving...';
        
        const settingsRef = db.collection('settings').doc('restaurant');
        await settingsRef.set({
            isOpen: restaurantOpenCheckbox.checked,
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp(),
            updatedBy: currentAdmin.email
        });
        
        settingsStatus.textContent = 'Settings saved successfully!';
        settingsStatus.style.color = 'var(--primary-orange)';
        
        setTimeout(() => { settingsStatus.textContent = ''; }, 3000);
        
    } catch (error) {
        console.error('Error saving settings:', error);
        settingsStatus.textContent = 'Error saving settings';
        settingsStatus.style.color = 'var(--accent-red)';
    } finally {
        saveSettingsBtn.disabled = false;
        saveSettingsBtn.textContent = 'Save Settings';
    }
}

// Load orders with real-time updates
function loadOrders() {
    try {
        if (ordersListener) ordersListener();
        
        const ordersRef = db.collection('orders').orderBy('timestamp', 'desc');
        
        ordersListener = ordersRef.onSnapshot((snapshot) => {
            const orders = [];
            snapshot.forEach((doc) => {
                orders.push({ id: doc.id, ...doc.data() });
            });
            
            displayOrders(orders);
            updateStats(orders);
        }, (error) => {
            console.error('Error loading orders:', error);
            showError(`Error loading orders: ${error.message}`);
        });
        
    } catch (error) {
        console.error('Error setting up orders listener:', error);
        showError('Error setting up real-time updates');
    }
}

// Display orders in table
function displayOrders(orders) {
    if (orders.length === 0) {
        ordersTableBody.innerHTML = `
            <tr>
                <td colspan="10" style="text-align: center; padding: var(--space-xl); color: var(--text-light);">
                    <div style="font-size: 1.5rem; margin-bottom: var(--space-md);">🍽️</div>
                    <div>No orders yet.</div>
                </td>
            </tr>
        `;
        return;
    }
    
    ordersTableBody.innerHTML = orders.map(order => {
        const orderTime = order.timestamp?.toDate ? 
            order.timestamp.toDate().toLocaleString() : 
            new Date(order.orderDate).toLocaleString();
            
        return `
            <tr>
                <td style="font-family: monospace; font-size: 0.875rem;">${order.id.substring(0, 8)}...</td>
                <td>${order.customerName}</td>
                <td>${order.snackName}</td>
                <td>${order.quantity}</td>
                <td>${order.hostelName}<br><small>${order.roomNumber}</small></td>
                <td><a href="tel:${order.phoneNumber}" style="color: var(--primary-orange); text-decoration: none;">${order.phoneNumber}</a></td>
                <td style="font-weight: 600;">GH¢${(order.totalPrice || 0).toFixed(2)}</td>
                <td><span class="status-badge status-${order.status}">${order.status}</span></td>
                <td style="font-size: 0.875rem;">${orderTime}</td>
                <td>
                    ${order.status === 'pending' ? `
                        <button class="action-btn btn-deliver" onclick="updateOrderStatus('${order.id}', 'delivered')">Deliver</button>
                        <button class="action-btn btn-cancel" onclick="updateOrderStatus('${order.id}', 'cancelled')">Cancel</button>
                    ` : `<small style="color: var(--text-light);">${order.status === 'delivered' ? '✅ Delivered' : '❌ Cancelled'}</small>`}
                </td>
            </tr>
        `;
    }).join('');
}

// Update order status
window.updateOrderStatus = async function(orderId, newStatus) {
    if (!currentAdmin) {
        alert('Authentication required');
        return;
    }
    
    try {
        const orderRef = db.collection('orders').doc(orderId);
        await orderRef.update({
            status: newStatus,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedBy: currentAdmin.email
        });
        
        console.log(`Order ${orderId} updated to ${newStatus} by ${currentAdmin.email}`);
    } catch (error) {
        console.error('Error updating order:', error);
        alert('Failed to update order status. Please try again.');
    }
};

// Update statistics
function updateStats(orders) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayOrders = orders.filter(order => {
        const orderDate = order.timestamp?.toDate ? order.timestamp.toDate() : new Date(order.orderDate);
        return orderDate >= today;
    });
    
    const pendingOrders = orders.filter(order => order.status === 'pending');
    const deliveredToday = todayOrders.filter(order => order.status === 'delivered');
    const totalRevenue = deliveredToday.reduce((sum, order) => sum + (order.totalPrice || 0), 0);
    
    statsContainer.innerHTML = `
        <div style="background: white; border-radius: var(--radius-lg); padding: var(--space-lg); box-shadow: 0 4px 16px var(--shadow-warm);">
            <div style="font-size: 2rem; color: var(--primary-orange); margin-bottom: var(--space-xs);">${pendingOrders.length}</div>
            <div style="font-weight: 600; color: var(--text-dark);">Pending Orders</div>
        </div>
        <div style="background: white; border-radius: var(--radius-lg); padding: var(--space-lg); box-shadow: 0 4px 16px var(--shadow-warm);">
            <div style="font-size: 2rem; color: var(--primary-orange); margin-bottom: var(--space-xs);">${todayOrders.length}</div>
            <div style="font-weight: 600; color: var(--text-dark);">Today's Orders</div>
        </div>
        <div style="background: white; border-radius: var(--radius-lg); padding: var(--space-lg); box-shadow: 0 4px 16px var(--shadow-warm);">
            <div style="font-size: 2rem; color: var(--primary-orange); margin-bottom: var(--space-xs);">${deliveredToday.length}</div>
            <div style="font-weight: 600; color: var(--text-dark);">Delivered Today</div>
        </div>
        <div style="background: white; border-radius: var(--radius-lg); padding: var(--space-lg); box-shadow: 0 4px 16px var(--shadow-warm);">
            <div style="font-size: 2rem; color: var(--primary-orange); margin-bottom: var(--space-xs);">GH¢${totalRevenue.toFixed(2)}</div>
            <div style="font-weight: 600; color: var(--text-dark);">Today's Revenue</div>
        </div>
    `;
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (ordersListener) ordersListener();
});