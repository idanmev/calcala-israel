/**
 * Calcala-News — Cookie Consent Banner
 * Israeli Privacy Protection Law compliance
 * 
 * Minimal, non-blocking banner that remembers the user's choice.
 * Designed to NOT interfere with conversion flows.
 */
(function () {
    'use strict';

    const STORAGE_KEY = 'calcala_cookie_consent';
    const SHOW_DELAY_MS = 1000;

    // Already consented — bail out immediately
    if (localStorage.getItem(STORAGE_KEY)) return;

    function injectBanner() {
        const banner = document.createElement('div');
        banner.id = 'cookie-consent-banner';
        banner.setAttribute('dir', 'rtl');
        banner.setAttribute('role', 'alert');
        banner.setAttribute('aria-live', 'polite');

        Object.assign(banner.style, {
            position: 'fixed',
            bottom: '0',
            left: '0',
            right: '0',
            zIndex: '45',
            background: 'rgba(15, 23, 42, 0.95)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            color: '#fff',
            fontFamily: 'Assistant, Heebo, sans-serif',
            fontSize: '14px',
            lineHeight: '1.5',
            padding: '12px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '16px',
            flexWrap: 'wrap',
            transform: 'translateY(100%)',
            transition: 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
            boxShadow: '0 -2px 16px rgba(0,0,0,0.15)',
        });

        // Text
        const text = document.createElement('span');
        text.style.flex = '1 1 auto';
        text.style.minWidth = '200px';
        text.innerHTML = 'אתר זה משתמש בעוגיות (Cookies) לשיפור חוויית השימוש. המשך גלישה מהווה הסכמה. '
            + '<a href="privacy.html" style="color:#F97316;text-decoration:underline;white-space:nowrap;">מדיניות פרטיות</a>';

        // Accept button
        const btn = document.createElement('button');
        btn.id = 'cookie-consent-accept';
        btn.textContent = 'אישור';
        Object.assign(btn.style, {
            background: '#F97316',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            padding: '8px 24px',
            fontWeight: '700',
            fontSize: '14px',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            transition: 'background 0.2s',
            flexShrink: '0',
        });

        btn.addEventListener('mouseenter', function () { btn.style.background = '#EA580C'; });
        btn.addEventListener('mouseleave', function () { btn.style.background = '#F97316'; });

        btn.addEventListener('click', function () {
            localStorage.setItem(STORAGE_KEY, Date.now().toString());
            banner.style.transform = 'translateY(100%)';
            setTimeout(function () { banner.remove(); }, 400);
        });

        banner.appendChild(text);
        banner.appendChild(btn);
        document.body.appendChild(banner);

        // Trigger slide-in after a frame
        requestAnimationFrame(function () {
            requestAnimationFrame(function () {
                banner.style.transform = 'translateY(0)';
            });
        });
    }

    // Delay showing so it doesn't compete with first paint
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
            setTimeout(injectBanner, SHOW_DELAY_MS);
        });
    } else {
        setTimeout(injectBanner, SHOW_DELAY_MS);
    }
})();
