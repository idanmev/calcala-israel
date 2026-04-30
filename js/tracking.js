/**
 * Calcala-News — Tracking & Conversion Layer
 *
 * Architecture:
 *   All events are pushed to window.dataLayer (GTM).
 *   GTM then forwards to: GA4, Meta Pixel, Hotjar, Google Ads.
 *
 * Events:
 *   quiz_open          — user opens the quiz modal
 *   quiz_step          — user answers a quiz question
 *   quiz_complete      — all quiz questions answered
 *   lead_form_view     — lead form is displayed
 *   lead_submit_attempt — user clicks submit
 *   lead_success       — lead submitted successfully
 *   scroll_depth       — scroll 25 / 50 / 75 / 90 %
 *   time_on_site       — 30s / 60s / 2min / 5min milestones
 */

(function () {
    'use strict';

    // ─── Helpers ───────────────────────────────────────────────
    window.dataLayer = window.dataLayer || [];

    // Enable debug mode via URL param (?debug=1) or explicit flag
    if (new URLSearchParams(window.location.search).get('debug') === '1') {
        window.__TRACKING_DEBUG__ = true;
    }

    function push(eventName, params) {
        const payload = Object.assign({ event: eventName }, params || {});
        window.dataLayer.push(payload);
        if (window.__TRACKING_DEBUG__) {
            console.group('%c[CalcalaTracking] ' + eventName, 'color:#6366f1;font-weight:bold');
            console.log('payload:', payload);
            console.log('dataLayer length:', window.dataLayer.length);
            console.groupEnd();
        }
    }

    // ─── Page View (GTM fires this automatically via gtm.js) ────
    // We still expose it for manual use (e.g. SPA navigation)
    function trackPageView(path) {
        push('page_view', {
            page_path: path || window.location.pathname,
            page_title: document.title,
        });
    }

    // ─── Generic event wrapper ───────────────────────────────────
    function trackEvent(category, action, label, extra) {
        push('custom_event', Object.assign({
            event_category: category,
            event_action: action,
            event_label: label || '',
        }, extra || {}));
    }

    // ─── Conversion funnel ───────────────────────────────────────
    function trackConversion(step, data) {
        push(step, data || {});
    }

    // ─── Quiz Events ─────────────────────────────────────────────
    function trackQuizOpen(vertical) {
        push('quiz_open', { quiz_vertical: vertical || 'unknown' });
    }

    function trackQuizStep(stepIndex, questionId, answer, vertical) {
        push('quiz_step', {
            quiz_step_index: stepIndex,
            quiz_question_id: questionId,
            quiz_answer: answer,
            quiz_vertical: vertical || 'unknown',
        });
    }

    function trackQuizComplete(answers, vertical) {
        push('quiz_complete', {
            quiz_vertical: vertical || 'unknown',
            quiz_answers: JSON.stringify(answers || {}),
        });
    }

    function trackLeadFormView(vertical) {
        push('lead_form_view', { quiz_vertical: vertical || 'unknown' });
    }

    function trackLeadSubmitAttempt(vertical) {
        push('lead_submit_attempt', { quiz_vertical: vertical || 'unknown' });
    }

    function trackLeadSuccess(vertical, answers) {
        push('lead_success', {
            quiz_vertical: vertical || 'unknown',
            quiz_answers: JSON.stringify(answers || {}),
        });
    }

    // ─── Expose public API immediately ───────────────────────────
    window.CalcalaTracking = {
        trackEvent: trackEvent,
        trackConversion: trackConversion,
        trackPageView: trackPageView,
        trackQuizOpen: trackQuizOpen,
        trackQuizStep: trackQuizStep,
        trackQuizComplete: trackQuizComplete,
        trackLeadFormView: trackLeadFormView,
        trackLeadSubmitAttempt: trackLeadSubmitAttempt,
        trackLeadSuccess: trackLeadSuccess,
        push: push,
    };

    // ─── Scroll Depth ────────────────────────────────────────────
    (function initScrollDepth() {
        const thresholds = [25, 50, 75, 90];
        const fired = {};

        function onScroll() {
            const scrollTop = window.scrollY || document.documentElement.scrollTop;
            const docHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
            if (docHeight <= 0) return;
            const pct = Math.round((scrollTop / docHeight) * 100);

            thresholds.forEach(function (t) {
                if (!fired[t] && pct >= t) {
                    fired[t] = true;
                    push('scroll_depth', { scroll_threshold: t, page_path: window.location.pathname });
                }
            });
        }

        window.addEventListener('scroll', onScroll, { passive: true });
    })();

    // ─── Time on Site ────────────────────────────────────────────
    (function initTimeOnSite() {
        var milestones = [30, 60, 120, 300]; // seconds
        milestones.forEach(function (seconds) {
            setTimeout(function () {
                push('time_on_site', { seconds_elapsed: seconds, page_path: window.location.pathname });
            }, seconds * 1000);
        });
    })();



    // ─── CTA / Button click tracking ────────────────────────────
    document.addEventListener('click', function (e) {
        var el = e.target.closest('[data-track-cta]');
        if (el) {
            push('cta_click', {
                cta_label: el.getAttribute('data-track-cta'),
                page_path: window.location.pathname,
            });
        }
    });



})();
