// Login Page - Uses shared firebase-config.js for Firebase initialization
// auth and db are available from firebase-config.js

// DOM elements
const loginForm = document.getElementById('login-form');
const loginBtn = document.getElementById('login-btn');
const errorMessage = document.getElementById('error-message');

// Initialize login page
document.addEventListener('DOMContentLoaded', () => {
    // Check if user is already logged in
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            // Check if user is admin
            const isAdmin = await checkAdminStatus(user.email);
            if (isAdmin) {
                window.location.href = 'admin.html';
            }
        }
    });

    setupLoginForm();
});

// Setup login form
function setupLoginForm() {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await handleLogin();
    });
}

// Handle login
async function handleLogin() {
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    if (!email || !password) {
        showError('Please enter both email and password');
        return;
    }

    // Show loading state
    loginBtn.disabled = true;
    loginBtn.innerHTML = '<span class="spinner"></span> Signing in...';
    hideError();

    try {
        // Sign in with Firebase Auth
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        const user = userCredential.user;

        console.log('User signed in:', user.email);

        // Check if user is an admin
        const isAdmin = await checkAdminStatus(user.email);

        if (isAdmin) {
            console.log('Admin access granted');
            // Redirect to admin dashboard
            window.location.href = 'admin.html';
        } else {
            // Not an admin - sign out and show error
            await auth.signOut();
            showError('Access denied. You are not authorized as an admin.');
        }

    } catch (error) {
        console.error('Login error:', error);

        let errorMsg = 'Login failed. Please try again.';

        switch (error.code) {
            case 'auth/user-not-found':
                errorMsg = 'No account found with this email.';
                break;
            case 'auth/wrong-password':
                errorMsg = 'Incorrect password.';
                break;
            case 'auth/invalid-email':
                errorMsg = 'Invalid email address.';
                break;
            case 'auth/too-many-requests':
                errorMsg = 'Too many failed attempts. Please try again later.';
                break;
        }

        showError(errorMsg);
    } finally {
        // Reset button
        loginBtn.disabled = false;
        loginBtn.innerHTML = 'Sign In';
    }
}

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

// Show error message
function showError(message) {
    errorMessage.textContent = message;
    errorMessage.classList.remove('hidden');
}

// Hide error message
function hideError() {
    errorMessage.classList.add('hidden');
}