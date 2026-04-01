/**
 * Calcala-News — Accessibility Widget
 * Israeli Standard IS 5568 (WCAG 2.0 AA) compliance
 *
 * Floating button + panel for on-the-fly accessibility adjustments.
 * Preferences persist in localStorage across sessions.
 */
(function () {
    'use strict';

    const STORAGE_KEY = 'calcala_a11y_prefs';
    const defaults = { fontSize: 0, contrast: false, grayscale: false, underlineLinks: false, stopAnimations: false };

    let prefs = Object.assign({}, defaults);
    let panelOpen = false;

    // ── Restore saved prefs ──
    try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
        if (saved) prefs = Object.assign({}, defaults, saved);
    } catch (_) { /* use defaults */ }

    // ── Apply prefs to the page ──
    function applyPrefs() {
        const html = document.documentElement;

        // Font size: each step = 2px on html
        html.style.fontSize = prefs.fontSize ? (16 + prefs.fontSize * 2) + 'px' : '';

        // Contrast
        html.classList.toggle('a11y-high-contrast', prefs.contrast);

        // Grayscale
        html.classList.toggle('a11y-grayscale', prefs.grayscale);

        // Underline links
        html.classList.toggle('a11y-underline-links', prefs.underlineLinks);

        // Stop animations
        html.classList.toggle('a11y-stop-animations', prefs.stopAnimations);

        localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
        updateButtonStates();
    }

    function updateButtonStates() {
        var panel = document.getElementById('a11y-panel');
        if (!panel) return;
        var items = panel.querySelectorAll('[data-a11y-toggle]');
        items.forEach(function (el) {
            var key = el.getAttribute('data-a11y-toggle');
            if (key === 'fontSize') return;
            el.classList.toggle('a11y-btn-active', !!prefs[key]);
        });
        var sizeLabel = document.getElementById('a11y-font-label');
        if (sizeLabel) sizeLabel.textContent = prefs.fontSize === 0 ? 'רגיל' : (prefs.fontSize > 0 ? '+' + prefs.fontSize : prefs.fontSize);
    }

    // ── Inject global CSS for accessibility classes ──
    function injectCSS() {
        var style = document.createElement('style');
        style.id = 'a11y-widget-styles';
        style.textContent = [
            /* High contrast */
            '.a11y-high-contrast { filter: contrast(1.4) !important; }',
            '.a11y-high-contrast body { background: #000 !important; color: #fff !important; }',
            /* Grayscale */
            '.a11y-grayscale { filter: grayscale(1) !important; }',
            /* Underline links */
            '.a11y-underline-links a { text-decoration: underline !important; }',
            /* Stop animations */
            '.a11y-stop-animations, .a11y-stop-animations * { animation-duration: 0s !important; animation-delay: 0s !important; transition-duration: 0s !important; transition-delay: 0s !important; }',
            /* Active toggle button style */
            '.a11y-btn-active { background: #F97316 !important; color: #fff !important; border-color: #F97316 !important; }',
        ].join('\n');
        document.head.appendChild(style);
    }

    // ── Build the widget DOM ──
    function buildWidget() {
        // Wrapper
        var wrapper = document.createElement('div');
        wrapper.id = 'a11y-widget';
        wrapper.setAttribute('dir', 'rtl');

        // Toggle button
        var toggleBtn = document.createElement('button');
        toggleBtn.id = 'a11y-toggle-btn';
        toggleBtn.setAttribute('aria-label', 'תפריט נגישות');
        toggleBtn.setAttribute('title', 'נגישות');
        toggleBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a2 2 0 1 1 0 4 2 2 0 0 1 0-4zm9 7h-6l-1.41 7.77L16 22h-2.5l-1.5-4-1.5 4H8l2.41-5.23L9 9H3V7h18v2z"/></svg>';
        Object.assign(toggleBtn.style, {
            position: 'fixed',
            bottom: '20px',
            left: '20px',
            zIndex: '44',
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            background: '#0F172A',
            color: '#fff',
            border: '2px solid #334155',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
            transition: 'transform 0.2s, box-shadow 0.2s',
            padding: '0',
        });

        toggleBtn.addEventListener('mouseenter', function () {
            toggleBtn.style.transform = 'scale(1.1)';
            toggleBtn.style.boxShadow = '0 6px 20px rgba(0,0,0,0.3)';
        });
        toggleBtn.addEventListener('mouseleave', function () {
            toggleBtn.style.transform = 'scale(1)';
            toggleBtn.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
        });

        // Panel
        var panel = document.createElement('div');
        panel.id = 'a11y-panel';
        Object.assign(panel.style, {
            position: 'fixed',
            bottom: '78px',
            left: '20px',
            zIndex: '44',
            width: '280px',
            background: '#fff',
            borderRadius: '8px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
            border: '1px solid #E2E8F0',
            padding: '0',
            transform: 'translateY(10px) scale(0.95)',
            opacity: '0',
            visibility: 'hidden',
            transition: 'transform 0.25s cubic-bezier(0.4,0,0.2,1), opacity 0.2s, visibility 0.2s',
            fontFamily: 'Assistant, Heebo, sans-serif',
            overflow: 'hidden',
        });

        // Panel header
        var header = document.createElement('div');
        Object.assign(header.style, {
            background: '#0F172A',
            color: '#fff',
            padding: '12px 16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '15px',
            fontWeight: '700',
        });
        header.innerHTML = '<span>♿ הגדרות נגישות</span>';

        // Close button in header
        var closeBtn = document.createElement('button');
        closeBtn.innerHTML = '✕';
        closeBtn.setAttribute('aria-label', 'סגור תפריט נגישות');
        Object.assign(closeBtn.style, {
            background: 'none',
            border: 'none',
            color: '#94A3B8',
            cursor: 'pointer',
            fontSize: '16px',
            padding: '4px',
            lineHeight: '1',
        });
        closeBtn.addEventListener('click', function () { togglePanel(false); });
        header.appendChild(closeBtn);
        panel.appendChild(header);

        // Panel body
        var body = document.createElement('div');
        Object.assign(body.style, { padding: '12px 16px 16px', display: 'flex', flexDirection: 'column', gap: '8px' });

        // Font size control
        var fontRow = document.createElement('div');
        Object.assign(fontRow.style, {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#F8FAFC',
            borderRadius: '6px',
            padding: '8px 12px',
            border: '1px solid #E2E8F0',
        });
        fontRow.innerHTML = '<span style="font-size:13px;font-weight:600;color:#334155;">גודל טקסט</span>';

        var fontControls = document.createElement('div');
        fontControls.style.display = 'flex';
        fontControls.style.alignItems = 'center';
        fontControls.style.gap = '8px';

        var minusBtn = createSmallBtn('A-', function () { prefs.fontSize = Math.max(-3, prefs.fontSize - 1); applyPrefs(); });
        var fontLabel = document.createElement('span');
        fontLabel.id = 'a11y-font-label';
        fontLabel.style.fontSize = '13px';
        fontLabel.style.fontWeight = '700';
        fontLabel.style.minWidth = '28px';
        fontLabel.style.textAlign = 'center';
        fontLabel.style.color = '#334155';
        fontLabel.textContent = 'רגיל';
        var plusBtn = createSmallBtn('A+', function () { prefs.fontSize = Math.min(5, prefs.fontSize + 1); applyPrefs(); });

        fontControls.appendChild(minusBtn);
        fontControls.appendChild(fontLabel);
        fontControls.appendChild(plusBtn);
        fontRow.appendChild(fontControls);
        body.appendChild(fontRow);

        // Toggle buttons
        var toggles = [
            { key: 'contrast', label: 'ניגודיות גבוהה', icon: '◑' },
            { key: 'grayscale', label: 'גווני אפור', icon: '◐' },
            { key: 'underlineLinks', label: 'הדגשת קישורים', icon: '🔗' },
            { key: 'stopAnimations', label: 'עצירת אנימציות', icon: '⏸' },
        ];

        toggles.forEach(function (t) {
            var row = document.createElement('button');
            row.setAttribute('data-a11y-toggle', t.key);
            Object.assign(row.style, {
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                width: '100%',
                background: '#F8FAFC',
                border: '1px solid #E2E8F0',
                borderRadius: '6px',
                padding: '10px 12px',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: '600',
                color: '#334155',
                textAlign: 'right',
                transition: 'background 0.15s, border-color 0.15s',
                fontFamily: 'inherit',
            });
            row.innerHTML = '<span style="font-size:16px;width:20px;text-align:center;">' + t.icon + '</span> ' + t.label;

            row.addEventListener('click', function () {
                prefs[t.key] = !prefs[t.key];
                applyPrefs();
            });
            row.addEventListener('mouseenter', function () { if (!prefs[t.key]) row.style.background = '#EEF2F7'; });
            row.addEventListener('mouseleave', function () { if (!prefs[t.key]) row.style.background = '#F8FAFC'; });
            body.appendChild(row);
        });

        // Reset button
        var resetBtn = document.createElement('button');
        resetBtn.textContent = 'איפוס הגדרות';
        Object.assign(resetBtn.style, {
            background: 'none',
            border: '1px dashed #CBD5E1',
            borderRadius: '6px',
            padding: '8px',
            cursor: 'pointer',
            fontSize: '12px',
            color: '#64748B',
            fontWeight: '600',
            marginTop: '4px',
            transition: 'color 0.15s',
            fontFamily: 'inherit',
        });
        resetBtn.addEventListener('mouseenter', function () { resetBtn.style.color = '#EF4444'; });
        resetBtn.addEventListener('mouseleave', function () { resetBtn.style.color = '#64748B'; });
        resetBtn.addEventListener('click', function () {
            prefs = Object.assign({}, defaults);
            applyPrefs();
        });
        body.appendChild(resetBtn);

        // Link to accessibility statement
        var link = document.createElement('a');
        link.href = 'accessibility.html';
        link.textContent = 'הצהרת נגישות מלאה ←';
        Object.assign(link.style, {
            display: 'block',
            textAlign: 'center',
            fontSize: '12px',
            color: '#F97316',
            fontWeight: '600',
            textDecoration: 'none',
            marginTop: '4px',
        });
        link.addEventListener('mouseenter', function () { link.style.textDecoration = 'underline'; });
        link.addEventListener('mouseleave', function () { link.style.textDecoration = 'none'; });
        body.appendChild(link);

        panel.appendChild(body);

        // Toggle logic
        toggleBtn.addEventListener('click', function () {
            togglePanel(!panelOpen);
        });

        // Close on outside click
        document.addEventListener('click', function (e) {
            if (panelOpen && !wrapper.contains(e.target)) {
                togglePanel(false);
            }
        });

        // Close on Escape
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && panelOpen) togglePanel(false);
        });

        wrapper.appendChild(panel);
        wrapper.appendChild(toggleBtn);
        document.body.appendChild(wrapper);
    }

    function togglePanel(show) {
        panelOpen = show;
        var panel = document.getElementById('a11y-panel');
        if (!panel) return;
        if (show) {
            panel.style.visibility = 'visible';
            panel.style.opacity = '1';
            panel.style.transform = 'translateY(0) scale(1)';
        } else {
            panel.style.opacity = '0';
            panel.style.transform = 'translateY(10px) scale(0.95)';
            setTimeout(function () {
                if (!panelOpen) panel.style.visibility = 'hidden';
            }, 250);
        }
    }

    function createSmallBtn(text, onClick) {
        var btn = document.createElement('button');
        btn.textContent = text;
        Object.assign(btn.style, {
            width: '30px',
            height: '30px',
            borderRadius: '4px',
            border: '1px solid #CBD5E1',
            background: '#fff',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: '700',
            color: '#334155',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background 0.15s',
            padding: '0',
            fontFamily: 'inherit',
        });
        btn.addEventListener('mouseenter', function () { btn.style.background = '#F1F5F9'; });
        btn.addEventListener('mouseleave', function () { btn.style.background = '#fff'; });
        btn.addEventListener('click', onClick);
        return btn;
    }

    // ── Init ──
    function init() {
        injectCSS();
        buildWidget();
        applyPrefs();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
