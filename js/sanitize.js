/**
 * Calcala-News — Shared Sanitization Utilities
 * Prevents XSS by escaping HTML entities in dynamic content.
 */

(function () {
    'use strict';

    /**
     * Escape HTML entities in a string for safe interpolation in innerHTML templates.
     * Handles: & < > " ' ` to prevent tag injection and attribute breakout.
     * @param {*} str - Value to escape (non-strings are converted)
     * @returns {string} Escaped string safe for innerHTML
     */
    function escapeHtml(str) {
        if (str === null || str === undefined) return '';
        const s = String(str);
        return s
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;')
            .replace(/`/g, '&#x60;');
    }

    /**
     * Validate and sanitize a URL. Returns empty string if suspicious.
     * Only allows http:, https:, and mailto: protocols.
     * @param {string} url - URL to validate
     * @returns {string} Sanitized URL or empty string
     */
    function sanitizeUrl(url) {
        if (!url || typeof url !== 'string') return '';
        const trimmed = url.trim();
        // Block javascript:, data:, vbscript: etc.
        if (/^(javascript|data|vbscript):/i.test(trimmed)) return '';
        // Allow only http, https, mailto, or relative URLs
        if (/^(https?:|mailto:|\/)/i.test(trimmed) || !trimmed.includes(':')) {
            return escapeHtml(trimmed);
        }
        return '';
    }

    // Expose globally
    window.CalcalaSanitize = {
        escapeHtml,
        sanitizeUrl,
    };
})();
