/**
 * Calcala-News — Tracking & Conversion Pixels (Stub)
 * 
 * Ready for future integration with:
 *   - Taboola pixel
 *   - Outbrain pixel
 *   - Facebook/Meta pixel
 *   - Google Analytics / GTM
 */

(function () {
    'use strict';

    const TRACKING_DEBUG = true;

    /**
     * Track a generic event
     * @param {string} category - e.g. 'CTA', 'Navigation', 'Newsletter'
     * @param {string} action   - e.g. 'click', 'submit', 'view'
     * @param {string} [label]  - optional label e.g. 'hero_cta', 'bottom_bar'
     */
    function trackEvent(category, action, label) {
        if (TRACKING_DEBUG) {
            console.log(`[Track] Event: ${category} | ${action}` + (label ? ` | ${label}` : ''));
        }

        // Future: fbq('trackCustom', category, { action, label });
        // Future: _tfa.push({ notify: 'event', name: category, ... });
    }

    /**
     * Track a conversion funnel step
     * @param {string} step - e.g. 'quiz_start', 'quiz_step_2', 'quiz_complete'
     * @param {Object} [data] - optional data payload
     */
    function trackConversion(step, data) {
        if (TRACKING_DEBUG) {
            console.log(`[Track] Conversion: ${step}`, data || '');
        }

        // Future: fbq('track', 'Lead', { step, ...data });
        // Future: obApi('track', 'Lead');
    }

    /**
     * Track a page view
     */
    function trackPageView() {
        const page = window.location.pathname;
        if (TRACKING_DEBUG) {
            console.log(`[Track] PageView: ${page}`);
        }

        // Future: gtag('event', 'page_view', { page_path: page });
    }

    // Auto-track page view on load
    trackPageView();

    // Expose globally
    window.CalcalaTracking = {
        trackEvent,
        trackConversion,
        trackPageView,
    };
})();
