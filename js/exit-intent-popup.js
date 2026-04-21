// exit-intent-popup.js
// Exit-intent / scroll-back popup that launches the article's own quiz modal (quiz articles)
// or shows a lead capture form (name + phone) for articles without a quiz.
// Trigger: desktop → mouseleave above viewport; mobile → scroll-up >100px after 50% depth.
// Suppression: quiz CTA clicked this session | quiz converted | dismissed within 7 days | not an article page.

(function () {
  'use strict';

  /* ──────────────────────────────────────────────
     CONSTANTS
  ────────────────────────────────────────────── */
  const POPUP_ID          = 'exit-intent-popup';
  const OVERLAY_ID        = 'exit-intent-overlay';
  const SESSION_SHOWN_KEY = 'exit_popup_shown';       // sessionStorage — once per session
  const SESSION_CONV_KEY  = 'quiz_converted';          // sessionStorage — lead submitted
  const LS_DISMISS_KEY    = 'popup_dismissed_at';      // localStorage — 7-day cap
  const DISMISS_DAYS      = 7;

  // Supabase (reuse same credentials as article-loader.js)
  const SUPABASE_URL = 'https://gtuxstslzsiuinxjvfdj.supabase.co';
  const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0dXhzdHNsenNpdWlueGp2ZmRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyMTU2NjIsImV4cCI6MjA4Njc5MTY2Mn0.ZYbL9PVGUdehVEtg18bi-Uyw-iy857KVM7Yceh7NMaM';

  /* ──────────────────────────────────────────────
     HEADLINE MAP  (quiz type → Hebrew copy)
  ────────────────────────────────────────────── */
  const HEADLINES = {
    mortgage:  'עוד לא בדקת אם מגיע לך החזר על המשכנתא שלך',
    insurance: 'עוד לא בדקת אם אתה משלם יותר מדי על הביטוח שלך',
    pension:   'עוד לא בדקת כמה כסף מחכה לך בפנסיה',
    default:   'עוד לא בדקת את הזכאות שלך',
  };

  /* ──────────────────────────────────────────────
     HELPERS
  ────────────────────────────────────────────── */

  /** Returns true only on article pages (has ?slug= or /article/ path) */
  function isArticlePage() {
    const q = new URLSearchParams(window.location.search);
    return q.has('slug') || /^\/article\//.test(window.location.pathname);
  }

  /** True if this popup has already fired this session */
  function hasShownThisSession() {
    return !!sessionStorage.getItem(SESSION_SHOWN_KEY);
  }

  /** True if user has converted (submitted the lead form) this session */
  function hasConverted() {
    return !!sessionStorage.getItem(SESSION_CONV_KEY);
  }

  /** True if user dismissed within the last 7 days */
  function recentlyDismissed() {
    const ts = localStorage.getItem(LS_DISMISS_KEY);
    if (!ts) return false;
    const diff = Date.now() - parseInt(ts, 10);
    return diff < DISMISS_DAYS * 24 * 60 * 60 * 1000;
  }

  /** True if user has already clicked any quiz CTA on this page this session */
  function ctaClickedThisSession() {
    return !!sessionStorage.getItem('quiz_cta_clicked');
  }

  /** True if the current article has a quiz assigned */
  function hasQuiz() {
    return !!window.currentArticleQuizId;
  }

  /** Master suppression check — now runs for ALL article pages */
  function shouldSuppress() {
    return !isArticlePage()
      || hasShownThisSession()
      || hasConverted()
      || recentlyDismissed()
      || ctaClickedThisSession();
  }

  /** Map a category slug → headline key */
  function resolveHeadline(categorySlug) {
    if (!categorySlug) return HEADLINES.default;
    const s = categorySlug.toLowerCase();
    if (s.includes('mortgage')  || s.includes('משכנתא')) return HEADLINES.mortgage;
    if (s.includes('insurance') || s.includes('ביטוח'))  return HEADLINES.insurance;
    if (s.includes('pension')   || s.includes('פנסיה'))  return HEADLINES.pension;
    return HEADLINES.default;
  }

  /* ──────────────────────────────────────────────
     BUILD QUIZ POPUP (articles with quiz)
  ────────────────────────────────────────────── */
  function buildQuizPopup() {
    const stale = document.getElementById(OVERLAY_ID);
    if (stale) stale.remove();

    const catSlug  = window.currentArticleCategory || '';
    const headline = resolveHeadline(catSlug);

    const overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.setAttribute('dir', 'rtl');
    overlay.innerHTML = `
      <div id="${POPUP_ID}" role="dialog" aria-modal="true" aria-labelledby="exit-popup-headline">

        <!-- Red header (matches quiz modal style) -->
        <div class="exit-popup-header">
          <button id="exit-popup-close" aria-label="סגור חלונית" class="exit-popup-x">✕</button>
          <div class="exit-popup-badge">⏱️ רגע לפני שאתה עוזב</div>
          <h2 id="exit-popup-headline" class="exit-popup-headline">${headline}</h2>
          <p class="exit-popup-sub">לוקח 60 שניות. בחינם לחלוטין.</p>
        </div>

        <!-- White body -->
        <div class="exit-popup-body">
          <button id="exit-popup-cta" class="exit-popup-cta-btn quiz-cta-pulse" data-quiz-id="${window.currentArticleQuizId || ''}">
            ← בדוק עכשיו בחינם
          </button>
          <button id="exit-popup-dismiss" class="exit-popup-dismiss-link">
            לא תודה, לא מעניין אותי
          </button>
        </div>

      </div>
    `;

    document.body.appendChild(overlay);

    document.getElementById('exit-popup-close').addEventListener('click', dismissPopup);
    document.getElementById('exit-popup-dismiss').addEventListener('click', dismissPopup);
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) dismissPopup();
    });
    document.addEventListener('keydown', handleEscKey);

    document.getElementById('exit-popup-cta').addEventListener('click', function () {
      sessionStorage.setItem('quiz_cta_clicked', '1');
      hidePopup();
      const quizId   = window.currentArticleQuizId   || null;
      const catSlugV = window.currentArticleCategory  || null;
      if (typeof window.openQuizModal === 'function') {
        window.openQuizModal(catSlugV, null, null, quizId);
      }
    });
  }

  /* ──────────────────────────────────────────────
     BUILD LEAD FORM POPUP (articles without quiz)
  ────────────────────────────────────────────── */
  function buildLeadPopup() {
    const stale = document.getElementById(OVERLAY_ID);
    if (stale) stale.remove();

    const overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.setAttribute('dir', 'rtl');
    overlay.innerHTML = `
      <div id="${POPUP_ID}" role="dialog" aria-modal="true" aria-labelledby="exit-lead-headline">

        <!-- Red header -->
        <div class="exit-popup-header">
          <button id="exit-popup-close" aria-label="סגור חלונית" class="exit-popup-x">✕</button>
          <div class="exit-popup-badge">💬 רגע לפני שאתה עוזב</div>
          <h2 id="exit-lead-headline" class="exit-popup-headline">התעניינתם?</h2>
          <p class="exit-popup-sub">השאירו פרטים ויענו לכם על כל השאלות.</p>
        </div>

        <!-- Form body -->
        <div class="exit-popup-body">
          <div id="exit-lead-form-wrap">
            <form id="exit-lead-form" novalidate>
              <div class="exit-lead-field">
                <label for="exit-lead-name" class="exit-lead-label">שם מלא</label>
                <input type="text" id="exit-lead-name" class="exit-lead-input" placeholder="ישראל ישראלי" autocomplete="name" required />
              </div>
              <div class="exit-lead-field">
                <label for="exit-lead-phone" class="exit-lead-label">מספר טלפון</label>
                <input type="tel" id="exit-lead-phone" class="exit-lead-input" placeholder="050-0000000" autocomplete="tel" required />
              </div>
              <div id="exit-lead-error" class="exit-lead-error" style="display:none;"></div>
              <button type="submit" id="exit-lead-submit" class="exit-popup-cta-btn" style="margin-top:0.5rem;">
                <span id="exit-lead-btn-text">שלח פרטים</span>
                <span id="exit-lead-spinner" class="exit-lead-spinner" style="display:none;"></span>
              </button>
            </form>
          </div>
          <div id="exit-lead-success" class="exit-lead-success" style="display:none;">
            <div class="exit-lead-success-icon">✅</div>
            <p class="exit-lead-success-title">תודה! קיבלנו את פרטיכם</p>
            <p class="exit-lead-success-sub">ניצור קשר בהקדם.</p>
          </div>
          <button id="exit-popup-dismiss" class="exit-popup-dismiss-link">
            לא תודה, לא מעניין אותי
          </button>
        </div>

      </div>
    `;

    document.body.appendChild(overlay);

    document.getElementById('exit-popup-close').addEventListener('click', dismissPopup);
    document.getElementById('exit-popup-dismiss').addEventListener('click', dismissPopup);
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) dismissPopup();
    });
    document.addEventListener('keydown', handleEscKey);

    // Form submission
    document.getElementById('exit-lead-form').addEventListener('submit', async function (e) {
      e.preventDefault();
      const name  = document.getElementById('exit-lead-name').value.trim();
      const phone = document.getElementById('exit-lead-phone').value.trim();
      const errorEl = document.getElementById('exit-lead-error');

      // Validation
      if (!name || !phone) {
        errorEl.textContent = 'נא למלא שם ומספר טלפון';
        errorEl.classList.remove('hidden');
        errorEl.style.display = 'block';
        return;
      }
      const phoneClean = phone.replace(/[\s\-]/g, '');
      if (!/^0\d{8,9}$/.test(phoneClean)) {
        errorEl.textContent = 'נא להזין מספר טלפון תקין (לדוגמה: 0501234567)';
        errorEl.classList.remove('hidden');
        errorEl.style.display = 'block';
        return;
      }
      errorEl.style.display = 'none';

      // Show spinner
      const submitBtn = document.getElementById('exit-lead-submit');
      submitBtn.disabled = true;
      document.getElementById('exit-lead-btn-text').style.display = 'none';
      document.getElementById('exit-lead-spinner').style.display = 'inline-block';

      try {
        // Submit to Supabase leads table
        const client = window.supabase
          ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY)
          : null;

        if (client) {
          const source = window.location.href;
          const articleTitle = document.title || '';
          await client.from('leads').insert([{
            name,
            phone: phoneClean,
            source: 'exit_popup',
            article_url: source,
            article_title: articleTitle,
            created_at: new Date().toISOString()
          }]);
        }

        // Mark converted so popup won't show again this session
        sessionStorage.setItem(SESSION_CONV_KEY, '1');

        // Show success state
        document.getElementById('exit-lead-form-wrap').style.display = 'none';
        document.getElementById('exit-lead-success').style.display = 'block';
        document.getElementById('exit-popup-dismiss').textContent = 'סגור';

      } catch (err) {
        console.error('Lead submission error:', err);
        errorEl.textContent = 'שגיאה בשליחת הפרטים. נסה שוב.';
        errorEl.style.display = 'block';
        submitBtn.disabled = false;
        document.getElementById('exit-lead-btn-text').style.display = 'inline';
        document.getElementById('exit-lead-spinner').style.display = 'none';
      }
    });
  }

  function handleEscKey(e) {
    if (e.key === 'Escape') dismissPopup();
  }

  /* ──────────────────────────────────────────────
     SHOW / HIDE / DISMISS
  ────────────────────────────────────────────── */
  function showPopup() {
    if (shouldSuppress()) return;

    // Build the correct popup variant
    if (hasQuiz()) {
      buildQuizPopup();
    } else {
      buildLeadPopup();
    }

    // Trigger transition on next paint
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const overlay = document.getElementById(OVERLAY_ID);
        const popup   = document.getElementById(POPUP_ID);
        if (overlay) overlay.classList.add('exit-overlay-visible');
        if (popup)   popup.classList.add('exit-popup-visible');
      });
    });

    // Mark shown for this session
    sessionStorage.setItem(SESSION_SHOWN_KEY, '1');
  }

  function hidePopup() {
    const overlay = document.getElementById(OVERLAY_ID);
    const popup   = document.getElementById(POPUP_ID);
    if (overlay) overlay.classList.remove('exit-overlay-visible');
    if (popup)   popup.classList.remove('exit-popup-visible');

    document.removeEventListener('keydown', handleEscKey);

    // Remove from DOM after transition
    setTimeout(function () {
      const el = document.getElementById(OVERLAY_ID);
      if (el) el.remove();
    }, 350);
  }

  function dismissPopup() {
    localStorage.setItem(LS_DISMISS_KEY, Date.now().toString());
    hidePopup();
  }

  /* ──────────────────────────────────────────────
     DESKTOP TRIGGER — mouse leaves viewport top
  ────────────────────────────────────────────── */
  function initDesktopTrigger() {
    document.addEventListener('mouseleave', function onMouseLeave(e) {
      if (e.clientY <= 0) {
        document.removeEventListener('mouseleave', onMouseLeave);
        showPopup();
      }
    });
  }

  /* ──────────────────────────────────────────────
     MOBILE TRIGGER — scroll-up >100px after 50% depth
  ────────────────────────────────────────────── */
  function initMobileTrigger() {
    let maxScrollY        = 0;
    let triggeredOnce     = false;
    let passedHalfway     = false;
    let ticking           = false;

    function onScroll() {
      if (triggeredOnce) return;
      
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const scrollY   = window.scrollY;
          const docHeight = document.documentElement.scrollHeight - window.innerHeight;
          const depth     = docHeight > 0 ? scrollY / docHeight : 0;

          if (scrollY > maxScrollY) {
            maxScrollY = scrollY;
          }

          if (depth >= 0.5) {
            passedHalfway = true;
          }

          if (passedHalfway && (maxScrollY - scrollY) > 100) {
            triggeredOnce = true;
            window.removeEventListener('scroll', onScroll, { passive: true });
            showPopup();
          }
          
          ticking = false;
        });
        ticking = true;
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* ──────────────────────────────────────────────
     INTERCEPT QUIZ CONVERSIONS
  ────────────────────────────────────────────── */
  function patchSubmitLead() {
    const originalFn = window.submitLead;
    if (typeof originalFn !== 'function') return false;

    window.submitLead = async function () {
      await originalFn.apply(this, arguments);
      sessionStorage.setItem(SESSION_CONV_KEY, '1');
    };
    return true;
  }

  /* ──────────────────────────────────────────────
     INTERCEPT openQuizModal CLICKS
  ────────────────────────────────────────────── */
  function patchOpenQuizModal() {
    const originalFn = window.openQuizModal;
    if (typeof originalFn !== 'function') return false;

    window.openQuizModal = function () {
      sessionStorage.setItem('quiz_cta_clicked', '1');
      return originalFn.apply(this, arguments);
    };
    return true;
  }

  /* ──────────────────────────────────────────────
     INJECT CSS
  ────────────────────────────────────────────── */
  function injectStyles() {
    if (document.getElementById('exit-intent-styles')) return;
    const style = document.createElement('style');
    style.id = 'exit-intent-styles';
    style.textContent = `
      /* ===== EXIT INTENT POPUP ===== */

      /* Backdrop */
      #exit-intent-overlay {
        position: fixed;
        inset: 0;
        z-index: 999;
        background: rgba(0, 0, 0, 0);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1rem;
        opacity: 0;
        visibility: hidden;
        transition: opacity 0.3s ease, visibility 0.3s ease, background 0.3s ease;
        direction: rtl;
      }

      #exit-intent-overlay.exit-overlay-visible {
        opacity: 1;
        visibility: visible;
        background: rgba(0, 0, 0, 0.55);
        backdrop-filter: blur(3px);
      }

      /* Card */
      #exit-intent-popup {
        background: #fff;
        border-radius: 1.25rem;
        width: 100%;
        max-width: 480px;
        overflow: hidden;
        box-shadow: 0 24px 64px rgba(0, 0, 0, 0.25);
        transform: translateY(24px) scale(0.96);
        opacity: 0;
        transition: transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s ease;
        position: relative;
      }

      #exit-intent-popup.exit-popup-visible {
        transform: translateY(0) scale(1);
        opacity: 1;
      }

      /* Red header */
      .exit-popup-header {
        background: linear-gradient(135deg, #7f1d1d 0%, #dc2626 100%);
        padding: 1.5rem 1.5rem 1.25rem;
        text-align: center;
        color: white;
        position: relative;
      }

      /* X close button */
      .exit-popup-x {
        position: absolute;
        top: 0.75rem;
        left: 0.75rem;
        background: rgba(255,255,255,0.18);
        border: 1px solid rgba(255,255,255,0.3);
        border-radius: 9999px;
        width: 2rem;
        height: 2rem;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 0.9rem;
        cursor: pointer;
        line-height: 1;
        transition: background 0.2s ease;
      }

      .exit-popup-x:hover {
        background: rgba(255,255,255,0.3);
      }

      /* Badge */
      .exit-popup-badge {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        background: rgba(255,255,255,0.18);
        border: 1px solid rgba(255,255,255,0.3);
        border-radius: 9999px;
        padding: 0.2rem 0.85rem;
        font-size: 0.75rem;
        font-weight: 600;
        letter-spacing: 0.02em;
        margin-bottom: 0.75rem;
      }

      /* Headline */
      .exit-popup-headline {
        font-size: 1.2rem;
        font-weight: 800;
        line-height: 1.4;
        margin: 0 0 0.5rem;
      }

      /* Sub-text */
      .exit-popup-sub {
        font-size: 0.85rem;
        opacity: 0.85;
        margin: 0;
      }

      /* White body */
      .exit-popup-body {
        padding: 1.5rem;
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
      }

      /* Red CTA button */
      .exit-popup-cta-btn {
        width: 100%;
        background: #dc2626;
        color: white;
        font-weight: 800;
        font-size: 1.1rem;
        padding: 1rem 1.5rem;
        border-radius: 0.875rem;
        border: none;
        cursor: pointer;
        letter-spacing: -0.01em;
        transition: background 0.18s ease, transform 0.15s ease;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
      }

      .exit-popup-cta-btn:hover {
        background: #b91c1c;
        transform: translateY(-1px);
      }

      .exit-popup-cta-btn:active {
        transform: scale(0.98);
      }

      .exit-popup-cta-btn:disabled {
        opacity: 0.7;
        cursor: not-allowed;
        transform: none;
      }

      /* Dismiss link */
      .exit-popup-dismiss-link {
        background: none;
        border: none;
        color: #9ca3af;
        font-size: 0.82rem;
        cursor: pointer;
        text-align: center;
        text-decoration: underline;
        padding: 0.25rem;
        transition: color 0.15s ease;
      }

      .exit-popup-dismiss-link:hover {
        color: #6b7280;
      }

      /* ── Lead form styles ── */
      .exit-lead-field {
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
        margin-bottom: 0.875rem;
      }

      .exit-lead-label {
        font-size: 0.82rem;
        font-weight: 600;
        color: #374151;
        text-align: right;
      }

      .exit-lead-input {
        width: 100%;
        padding: 0.7rem 0.9rem;
        border: 1.5px solid #d1d5db;
        border-radius: 0.625rem;
        font-size: 1rem;
        color: #111827;
        outline: none;
        transition: border-color 0.18s ease, box-shadow 0.18s ease;
        text-align: right;
        direction: rtl;
        box-sizing: border-box;
      }

      .exit-lead-input:focus {
        border-color: #dc2626;
        box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.12);
      }

      .exit-lead-error {
        font-size: 0.8rem;
        color: #dc2626;
        font-weight: 500;
        text-align: right;
        margin-top: -0.4rem;
        margin-bottom: 0.4rem;
      }

      /* Spinner */
      .exit-lead-spinner {
        display: inline-block;
        width: 20px;
        height: 20px;
        border: 2px solid rgba(255,255,255,0.4);
        border-top-color: #fff;
        border-radius: 50%;
        animation: exit-spin 0.7s linear infinite;
      }

      @keyframes exit-spin {
        to { transform: rotate(360deg); }
      }

      /* Success state */
      .exit-lead-success {
        text-align: center;
        padding: 1rem 0;
      }

      .exit-lead-success-icon {
        font-size: 2.5rem;
        margin-bottom: 0.5rem;
      }

      .exit-lead-success-title {
        font-size: 1.1rem;
        font-weight: 800;
        color: #111827;
        margin: 0 0 0.35rem;
      }

      .exit-lead-success-sub {
        font-size: 0.85rem;
        color: #6b7280;
        margin: 0;
      }

      /* ── Mobile: full-width bottom sheet ── */
      @media (max-width: 640px) {
        #exit-intent-overlay {
          align-items: flex-end;
          padding: 0;
        }

        #exit-intent-popup {
          max-width: 100%;
          border-radius: 1.25rem 1.25rem 0 0;
          transform: translateY(60px);
        }

        #exit-intent-popup.exit-popup-visible {
          transform: translateY(0);
        }

        .exit-popup-header {
          border-radius: 1.25rem 1.25rem 0 0;
        }
      }
    `;
    document.head.appendChild(style);
  }

  /* ──────────────────────────────────────────────
     BOOT
  ────────────────────────────────────────────── */
  function init() {
    // Only run on article pages
    if (!isArticlePage()) return;

    injectStyles();

    // Patch quiz functions
    if (!patchOpenQuizModal()) {
      setTimeout(patchOpenQuizModal, 500);
    }
    if (!patchSubmitLead()) {
      setTimeout(patchSubmitLead, 1000);
    }

    const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
      || window.matchMedia('(pointer: coarse)').matches;

    if (isMobile) {
      initMobileTrigger();
    } else {
      initDesktopTrigger();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
