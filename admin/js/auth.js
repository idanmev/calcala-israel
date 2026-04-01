/**
 * Authentication Utilities
 * Handles session management and authentication checks for admin panel
 */

/**
 * Check if user is authenticated
 * Redirects to login page if session is invalid
 */
async function checkAuth() {
    try {
        const { data: { session }, error } = await supabaseClient.auth.getSession();

        if (error || !session) {
            // No valid session, redirect to login
            window.location.href = '/admin/login.html';
            return false;
        }

        return true;
    } catch (error) {
        console.error('Auth check error:', error);
        window.location.href = '/admin/login.html';
        return false;
    }
}

/**
 * Logout user
 * Clears session and redirects to login page
 */
async function logout() {
    try {
        const { error } = await supabaseClient.auth.signOut();

        if (error) {
            console.error('Logout error:', error);
            showError('שגיאה בהתנתקות');
            return;
        }

        // Clear only Supabase-related localStorage keys (preserve market cache etc.)
        Object.keys(localStorage).forEach(key => {
            if (key.startsWith('sb-') || key.startsWith('supabase')) {
                localStorage.removeItem(key);
            }
        });

        // Redirect to login
        window.location.href = '/admin/login.html';
    } catch (error) {
        console.error('Logout error:', error);
        showError('שגיאה בהתנתקות');
    }
}

/**
 * Get current user
 * Returns the current authenticated user
 */
async function getCurrentUser() {
    try {
        const { data: { user }, error } = await supabaseClient.auth.getUser();

        if (error) {
            console.error('Get user error:', error);
            return null;
        }

        return user;
    } catch (error) {
        console.error('Get user error:', error);
        return null;
    }
}

/**
 * Show error message
 * @param {string} message - Error message to display
 */
function showError(message) {
    // Create error toast
    const toast = document.createElement('div');
    toast.className = 'fixed top-4 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-fade-in';
    toast.textContent = message;

    document.body.appendChild(toast);

    // Remove after 3 seconds
    setTimeout(() => {
        toast.classList.add('animate-fade-out');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

/**
 * Show success message
 * @param {string} message - Success message to display
 */
function showSuccess(message) {
    // Create success toast
    const toast = document.createElement('div');
    toast.className = 'fixed top-4 left-1/2 transform -translate-x-1/2 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-fade-in';
    toast.textContent = message;

    document.body.appendChild(toast);

    // Remove after 3 seconds
    setTimeout(() => {
        toast.classList.add('animate-fade-out');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Export functions
window.authUtils = {
    checkAuth,
    logout,
    getCurrentUser,
    showError,
    showSuccess
};
