/**
 * Codeforces Tracker - Main JavaScript
 */

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Escape HTML to prevent XSS attacks
 */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Format ISO date to readable format
 */
function formatDate(isoDate) {
    if (!isoDate) return '';
    const date = new Date(isoDate);
    const now = new Date();
    const diff = now - date;

    // Within last hour
    if (diff < 3600000) {
        const mins = Math.floor(diff / 60000);
        return mins <= 1 ? 'Just now' : `${mins} minutes ago`;
    }

    // Within last day
    if (diff < 86400000) {
        const hours = Math.floor(diff / 3600000);
        return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
    }

    // Within last week
    if (diff < 604800000) {
        const days = Math.floor(diff / 86400000);
        return days === 1 ? 'Yesterday' : `${days} days ago`;
    }

    // Otherwise show date
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

// ============================================================================
// Toast Notifications
// ============================================================================

/**
 * Show a toast notification
 * @param {string} message - Message to display
 * @param {string} type - 'success', 'error', or 'info'
 */
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const icons = {
        success: '✅',
        error: '❌',
        info: 'ℹ️'
    };

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <span class="toast-icon">${icons[type] || icons.info}</span>
        <span class="toast-message">${escapeHtml(message)}</span>
    `;

    container.appendChild(toast);

    // Auto remove after 4 seconds
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// ============================================================================
// Modal Functions
// ============================================================================

/**
 * Open a modal with given title and content
 */
function openModal(title, content) {
    const overlay = document.getElementById('modalOverlay');
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');

    if (!overlay || !modalTitle || !modalBody) return;

    modalTitle.textContent = title;
    modalBody.innerHTML = content;
    overlay.classList.add('active');

    // Focus first input
    setTimeout(() => {
        const firstInput = modalBody.querySelector('input, textarea');
        if (firstInput) firstInput.focus();
    }, 100);
}

/**
 * Close the modal
 */
function closeModal() {
    const overlay = document.getElementById('modalOverlay');
    if (overlay) {
        overlay.classList.remove('active');
    }
}

// Close modal on overlay click
document.addEventListener('DOMContentLoaded', function () {
    const overlay = document.getElementById('modalOverlay');
    if (overlay) {
        overlay.addEventListener('click', function (e) {
            if (e.target === overlay) {
                closeModal();
            }
        });
    }

    // Close modal on Escape key
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
            closeModal();
        }
    });

    // Check API status
    checkApiStatus();
});

// ============================================================================
// API Status
// ============================================================================

/**
 * Check if the Codeforces API is accessible
 */
async function checkApiStatus() {
    const statusDot = document.querySelector('.status-dot');
    const statusText = document.querySelector('.status-text');

    if (!statusDot || !statusText) return;

    try {
        const response = await fetch('/api/analytics');
        if (response.ok) {
            statusDot.style.background = 'var(--accent-success)';
            statusText.textContent = 'API Connected';
        } else {
            statusDot.style.background = 'var(--accent-warning)';
            statusText.textContent = 'API Issues';
        }
    } catch (error) {
        statusDot.style.background = 'var(--accent-secondary)';
        statusText.textContent = 'API Offline';
    }
}

// ============================================================================
// Keyboard Shortcuts
// ============================================================================

document.addEventListener('keydown', function (e) {
    // Ctrl/Cmd + K to focus search (if exists)
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        const searchInput = document.querySelector('input[type="search"]');
        if (searchInput) searchInput.focus();
    }
});
