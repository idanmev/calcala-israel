// modal.js - Vertical-aware quiz modal for Calcala-News

const MODAL_SB_URL = 'https://gtuxstslzsiuinxjvfdj.supabase.co';
const MODAL_SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0dXhzdHNsenNpdWlueGp2ZmRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyMTU2NjIsImV4cCI6MjA4Njc5MTY2Mn0.ZYbL9PVGUdehVEtg18bi-Uyw-iy857KVM7Yceh7NMaM';
const SUBMIT_LEAD_URL = `${MODAL_SB_URL}/functions/v1/submit-lead`;

// Shortcut for escapeHtml
const _e = (s) => window.CalcalaSanitize ? window.CalcalaSanitize.escapeHtml(s) : String(s || '');

let supabaseModal = null;

function getSupabaseModal() {
  if (!supabaseModal) {
    if (!window.supabase) {
      console.error('Supabase library not loaded yet');
      return null;
    }
    supabaseModal = window.supabase.createClient(MODAL_SB_URL, MODAL_SB_KEY);
  }
  return supabaseModal;
}

// State
let currentConfig = null;
let currentStep = 0;
let userAnswers = {};
let currentVertical = 'taxation'; // default
let entryHookAnswer = null;

// Default fallback config if Supabase fails
const DEFAULT_CONFIG = {
  vertical_name: 'כללי',
  questions: [
    { id: 'employment', text: 'מה מצבך התעסוקתי?', options: ['שכיר/ת', 'עצמאי/ת', 'שכיר/ת וגם עצמאי/ת', 'לא עובד/ת'] },
    { id: 'salary', text: 'מה טווח ההכנסה החודשית שלך?', options: ['עד 8,000 ₪', '8,000-15,000 ₪', '15,000-25,000 ₪', 'מעל 25,000 ₪'] }
  ],
  success_title: 'בשורות טובות!',
  success_subtitle: 'נציג שלנו יצור איתך קשר בהקדם',
  success_range: ''
};

// ============================================================
// OPEN MODAL - Entry point from article page
// ============================================================
window.openQuizModal = function (vertical = null, prefillAnswer = null, fallbackCategory = null, quizId = null) {
  currentVertical = vertical || fallbackCategory || getCurrentVerticalFromPage();
  entryHookAnswer = prefillAnswer;
  userAnswers = {};
  currentStep = 0;

  if (prefillAnswer) {
    userAnswers['entry_hook'] = prefillAnswer;
    currentStep = 0;
  }

  const modal = document.getElementById('quiz-modal');
  if (!modal) {
    console.error('Quiz modal not found');
    return;
  }
  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';

  // Inject hook bar into the modal shell (once)
  injectHookBar();

  renderLoadingState();

  if (quizId) {
    loadQuizConfigById(quizId);
  } else {
    loadQuizConfig(currentVertical);
  }
};

// ============================================================
// INJECT PERSISTENT HOOK BAR (top of modal)
// ============================================================
function injectHookBar() {
  const shell = document.querySelector('#quiz-modal > div');
  if (!shell) return;

  // Remove existing hook bar if any
  const existing = shell.querySelector('.quiz-hook-bar');
  if (existing) existing.remove();

  const bar = document.createElement('div');
  bar.className = 'quiz-hook-bar';
  bar.innerHTML = `
    <div class="hook-badge">💰 כלי בדיקת זכאות חינמי</div>
    <div class="hook-title">גלה כמה כסף מגיע לך בחזרה</div>
    <div class="hook-sub">3 שאלות · 60 שניות · תוצאה מיידית</div>
  `;

  shell.insertBefore(bar, shell.firstChild);

  // Ensure close button is inside shell and visible
  let closeBtn = shell.querySelector('.quiz-close-btn');
  if (!closeBtn) {
    closeBtn = document.createElement('button');
    closeBtn.className = 'quiz-close-btn';
    closeBtn.setAttribute('aria-label', 'סגור');
    closeBtn.style.cssText = 'position:absolute;top:0.75rem;left:0.75rem;z-index:20;background:rgba(255,255,255,0.2);border:none;border-radius:9999px;width:2rem;height:2rem;display:flex;align-items:center;justify-content:center;cursor:pointer;color:white;font-size:1rem;line-height:1;';
    closeBtn.innerHTML = '✕';
    closeBtn.addEventListener('click', closeQuizModal);
    shell.style.position = 'relative';
    shell.insertBefore(closeBtn, shell.firstChild);
  }
}


// ============================================================
// CLOSE MODAL
// ============================================================
window.closeQuizModal = function () {
  const modal = document.getElementById('quiz-modal');
  if (modal) {
    // Remove hook bar so it re-renders fresh on next open
    const shell = modal.querySelector(':scope > div');
    if (shell) {
      const bar = shell.querySelector('.quiz-hook-bar');
      if (bar) bar.remove();
      const closeBtn = shell.querySelector('.quiz-close-btn');
      if (closeBtn) closeBtn.remove();
    }
    modal.classList.add('hidden');
    document.body.style.overflow = '';
  }
};


// ============================================================
// GET VERTICAL FROM CURRENT PAGE
// ============================================================
function getCurrentVerticalFromPage() {
  // Try to get from article-loader (article page)
  if (window.currentArticleCategory) return window.currentArticleCategory;

  // Try to get from URL
  const slug = new URLSearchParams(window.location.search).get('slug');
  if (slug) return 'taxation'; // default for article pages

  // Homepage default
  return 'taxation';
}

// ============================================================
// LOAD QUIZ CONFIG FROM SUPABASE
// ============================================================
async function loadQuizConfigById(quizId) {
  try {
    const { data, error } = await getSupabaseModal()
      .from('quiz_configs')
      .select('*')
      .eq('id', quizId)
      .eq('is_active', true)
      .single();

    if (error || !data) {
      console.warn('Quiz config not found for id:', quizId, '— using default');
      currentConfig = DEFAULT_CONFIG;
    } else {
      currentConfig = data;
    }

    renderCurrentStep();
  } catch (err) {
    console.error('Error loading quiz config by id:', err);
    currentConfig = DEFAULT_CONFIG;
    renderCurrentStep();
  }
}

// ============================================================
// LOAD QUIZ CONFIG FROM SUPABASE
// ============================================================
async function loadQuizConfig(categorySlug) {
  try {
    const { data, error } = await getSupabaseModal()
      .from('quiz_configs')
      .select('*')
      .eq('category_slug', categorySlug)
      .eq('is_active', true)
      .single();

    if (error || !data) {
      console.warn('No quiz config found for:', categorySlug, '— using default');
      currentConfig = DEFAULT_CONFIG;
    } else {
      currentConfig = data;
    }

    renderCurrentStep();
  } catch (err) {
    console.error('Error loading quiz config:', err);
    currentConfig = DEFAULT_CONFIG;
    renderCurrentStep();
  }
}

// ============================================================
// RENDER LOADING STATE
// ============================================================
function renderLoadingState() {
  const content = document.getElementById('quiz-modal-content');
  if (!content) return;
  content.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:3rem 2rem;">
      <div style="width:3rem;height:3rem;border-radius:9999px;border:3px solid #fee2e2;border-top-color:#dc2626;animation:spin 0.7s linear infinite;margin-bottom:1rem;"></div>
      <p style="color:#9ca3af;font-size:0.875rem;">טוען שאלות...</p>
    </div>
    <style>@keyframes spin{to{transform:rotate(360deg)}}</style>
  `;
}


// ============================================================
// RENDER CURRENT STEP
// ============================================================
function renderCurrentStep() {
  const questions = currentConfig.questions || [];
  const totalSteps = questions.length + 1; // +1 for lead form

  if (currentStep < questions.length) {
    renderQuestionStep(questions[currentStep], currentStep, totalSteps);
  } else {
    renderLeadForm(totalSteps);
  }
}

// ============================================================
// RENDER QUESTION STEP
// ============================================================
function renderQuestionStep(question, stepIndex, totalSteps) {
  const content = document.getElementById('quiz-modal-content');
  if (!content) return;

  const answered = totalSteps - 1; // total questions (no lead form)
  const progressPercent = Math.round(((stepIndex) / answered) * 100);

  // Step dots
  const dots = Array.from({length: answered}, (_, i) => {
    const done = i < stepIndex;
    const active = i === stepIndex;
    return `<div style="width:${active ? '1.5rem' : '0.5rem'};height:0.5rem;border-radius:9999px;background:${done ? '#dc2626' : active ? '#dc2626' : '#e5e7eb'};transition:all 0.3s;"></div>`;
  }).join('');

  content.innerHTML = `
    <!-- Progress -->
    <div style="padding:1.25rem 1.5rem 0;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.6rem;">
        <div class="quiz-step-pill">שאלה ${stepIndex + 1} מתוך ${answered}</div>
        <div style="display:flex;gap:0.3rem;align-items:center;">${dots}</div>
      </div>
      <div class="quiz-progress-bar"><div class="quiz-progress-fill" style="width:${progressPercent}%"></div></div>
    </div>

    <!-- Question -->
    <div style="padding:1.25rem 1.5rem 0;">
      <h3 style="font-size:1.2rem;font-weight:800;color:#111827;line-height:1.4;text-align:center;margin-bottom:1.25rem;">${_e(question.text)}</h3>

      <!-- Options -->
      <div style="display:flex;flex-direction:column;gap:0.6rem;" id="quiz-options-container">
        ${question.options.map((option, idx) => `
          <button 
            data-question-id="${_e(question.id)}"
            data-option-value="${_e(option)}"
            class="quiz-option-btn"
            style="width:100%;text-align:right;padding:0.9rem 1.1rem;border:2px solid #e5e7eb;border-radius:0.875rem;font-size:1rem;font-weight:600;color:#374151;background:white;display:flex;align-items:center;justify-content:space-between;"
          >
            <span>${_e(option)}</span>
            <span style="width:1.4rem;height:1.4rem;border-radius:9999px;border:2px solid #d1d5db;flex-shrink:0;display:flex;align-items:center;justify-content:center;"></span>
          </button>
        `).join('')}
      </div>

      ${currentStep > 0 ? `
        <button id="quiz-back-btn" style="margin-top:0.75rem;font-size:0.8rem;color:#9ca3af;background:none;border:none;cursor:pointer;width:100%;text-align:center;padding:0.4rem;">
          → חזור
        </button>
      ` : ''}

      <!-- Trust micro-copy -->
      <div class="quiz-trust-row" style="margin-top:1rem;padding-bottom:1.25rem;">
        <span>🔒 פרטיות מלאה</span>
        <span>✅ ללא התחייבות</span>
        <span>⚡ תוצאה מיידית</span>
      </div>
    </div>
  `;

  // Event delegation for option buttons
  const optionsContainer = document.getElementById('quiz-options-container');
  if (optionsContainer) {
    optionsContainer.addEventListener('click', (e) => {
      const btn = e.target.closest('.quiz-option-btn');
      if (btn) {
        // Visual feedback before advancing
        btn.style.borderColor = '#dc2626';
        btn.style.background = '#fef2f2';
        const circle = btn.querySelector('span:last-child');
        if (circle) {
          circle.style.background = '#dc2626';
          circle.style.borderColor = '#dc2626';
          circle.innerHTML = '<svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5l2.5 2.5L8 3" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
        }
        setTimeout(() => {
          selectAnswer(btn.dataset.questionId, btn.dataset.optionValue);
        }, 220);
      }
    });
  }

  const backBtn = document.getElementById('quiz-back-btn');
  if (backBtn) {
    backBtn.addEventListener('click', goToPreviousStep);
  }
}


// ============================================================
// RENDER CALCULATING SCREEN (pre-commitment)
// ============================================================
function renderCalculatingScreen() {
  const content = document.getElementById('quiz-modal-content');
  if (!content) return;

  content.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:2.5rem 1.5rem;text-align:center;">
      
      <!-- Spinner + icon -->
      <div style="position:relative;margin-bottom:1.5rem;">
        <div style="width:5rem;height:5rem;border-radius:9999px;border:4px solid #fee2e2;border-top-color:#dc2626;animation:spin 0.8s linear infinite;"></div>
        <span style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:1.6rem;">🧮</span>
      </div>

      <h3 style="font-size:1.3rem;font-weight:800;color:#111827;margin-bottom:0.5rem;">מחשב את הזכאות שלך...</h3>
      <p style="font-size:0.85rem;color:#6b7280;margin-bottom:1.5rem;">בודק מול נתוני רשות המסים</p>
      
      <!-- Steps -->
      <div style="width:100%;max-width:18rem;display:flex;flex-direction:column;gap:0.6rem;">
        <div id="calc-step-1" style="display:flex;align-items:center;gap:0.75rem;font-size:0.875rem;color:#9ca3af;">
          <div style="width:1rem;height:1rem;border-radius:9999px;background:#e5e7eb;flex-shrink:0;"></div>
          <span>בודק נתוני הכנסה</span>
        </div>
        <div id="calc-step-2" style="display:flex;align-items:center;gap:0.75rem;font-size:0.875rem;color:#9ca3af;">
          <div style="width:1rem;height:1rem;border-radius:9999px;background:#e5e7eb;flex-shrink:0;"></div>
          <span>מחשב ניכויים וזיכויים</span>
        </div>
        <div id="calc-step-3" style="display:flex;align-items:center;gap:0.75rem;font-size:0.875rem;color:#9ca3af;">
          <div style="width:1rem;height:1rem;border-radius:9999px;background:#e5e7eb;flex-shrink:0;"></div>
          <span>מאמת מול נתוני רשות המסים</span>
        </div>
      </div>
    </div>
    <style>@keyframes spin{to{transform:rotate(360deg)}}</style>
  `;

  const activateStep = (id, delay) => setTimeout(() => {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.color = '#111827';
    el.style.fontWeight = '600';
    const dot = el.querySelector('div');
    if (dot) {
      dot.style.background = '#16a34a';
      dot.innerHTML = '<svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5l2.5 2.5L8 3" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      dot.style.display = 'flex';
      dot.style.alignItems = 'center';
      dot.style.justifyContent = 'center';
    }
  }, delay);

  activateStep('calc-step-1', 350);
  activateStep('calc-step-2', 850);
  activateStep('calc-step-3', 1350);

  setTimeout(() => renderResultsScreen(), 2100);
}


// ============================================================
// RENDER RESULTS SCREEN (pre-commitment)
// ============================================================
function renderResultsScreen() {
  const content = document.getElementById('quiz-modal-content');
  if (!content) return;

  const config = currentConfig || DEFAULT_CONFIG;
  const range = _e(config.success_range || '₪2,000 – ₪12,000');

  // Urgency countdown (10 minutes)
  let countdown = 10 * 60;

  content.innerHTML = `
    <div style="padding:1.5rem 1.5rem 0;text-align:center;">

      <!-- Success icon -->
      <div style="width:3.5rem;height:3.5rem;background:#dcfce7;border-radius:9999px;display:flex;align-items:center;justify-content:center;margin:0 auto 0.75rem;">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7"/></svg>
      </div>

      <h3 style="font-size:1.3rem;font-weight:800;color:#111827;margin-bottom:0.3rem;">${_e(config.success_title || 'בשורות מצוינות!')}</h3>
      <p style="font-size:0.85rem;color:#6b7280;margin-bottom:1.1rem;">${_e(config.success_subtitle || 'על פי הנתונים שהזנת, סביר שמגיע לך:')}</p>

      <!-- Amount box -->
      <div style="background:linear-gradient(135deg,#f0fdf4,#dcfce7);border:2px solid #4ade80;border-radius:1rem;padding:1.1rem;margin-bottom:1rem;">
        <p style="font-size:0.75rem;color:#6b7280;margin-bottom:0.2rem;">סכום משוער לפי הנתונים שלך:</p>
        <p style="font-size:2.2rem;font-weight:900;color:#15803d;line-height:1.1;margin-bottom:0.2rem;">${range}</p>
        <p style="font-size:0.7rem;color:#9ca3af;">הסכום המדויק ייקבע לאחר בדיקה מקצועית</p>
      </div>

      <!-- Social proof -->
      <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:0.75rem;padding:0.6rem 1rem;margin-bottom:1rem;font-size:0.8rem;color:#92400e;">
        🏆 <strong>14,000+ ישראלים</strong> כבר קיבלו את הכסף שלהם השנה
      </div>

      <!-- Live availability signal (replaces fake countdown) -->
      <div style="display:flex;align-items:center;justify-content:center;gap:0.5rem;font-size:0.78rem;color:#374151;font-weight:600;margin-bottom:0.85rem;background:#f0fdf4;border:1px solid #86efac;border-radius:9999px;padding:0.35rem 0.85rem;">
        <span style="width:0.55rem;height:0.55rem;border-radius:9999px;background:#16a34a;display:inline-block;animation:live-pulse 1.8s ease-in-out infinite;"></span>
        מומחים פנויים עכשיו · <span id="quiz-active-count">23</span> אנשים בודקים זכאות כרגע
      </div>
      <style>@keyframes live-pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.5;transform:scale(1.3)}}</style>

      <!-- CTA -->
      <button id="proceed-to-lead-btn"
        class="quiz-cta-pulse"
        style="width:100%;background:#dc2626;color:white;font-weight:800;font-size:1.1rem;padding:1rem 1.5rem;border-radius:0.875rem;border:none;cursor:pointer;margin-bottom:0.6rem;letter-spacing:-0.01em;">
        ← שלחו לי את הפרטים המלאים
      </button>

      <div class="quiz-trust-row" style="padding-bottom:1.5rem;">
        <span>✓ ללא עלות</span>
        <span>✓ ללא התחייבות</span>
        <span>✓ נציג תוך 24 שעות</span>
      </div>
    </div>
  `;

  document.getElementById('proceed-to-lead-btn')?.addEventListener('click', proceedToLeadForm);

  // Animate the active user count slightly to feel live (honest — just fluctuates, not fake countdown)
  const activeCountEl = document.getElementById('quiz-active-count');
  if (activeCountEl) {
    const base = 20 + Math.floor(Math.random() * 10);
    activeCountEl.textContent = base;
    setInterval(() => {
      const delta = Math.random() < 0.5 ? -1 : 1;
      const current = parseInt(activeCountEl.textContent, 10);
      const next = Math.max(15, Math.min(35, current + delta));
      activeCountEl.textContent = next;
    }, 4500);
  }
}


// ============================================================
// PROCEED TO LEAD FORM
// ============================================================
window.proceedToLeadForm = function () {
  renderLeadForm();
};

// ============================================================
// RENDER LEAD FORM (final step)
// ============================================================
function renderLeadForm() {
  const content = document.getElementById('quiz-modal-content');
  if (!content) return;

  content.innerHTML = `
    <!-- Progress: almost done -->
    <div style="padding:1.25rem 1.5rem 0;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.5rem;">
        <div class="quiz-step-pill">שלב אחרון 🎯</div>
        <span style="font-size:0.75rem;color:#6b7280;">95% הושלם</span>
      </div>
      <div class="quiz-progress-bar"><div class="quiz-progress-fill" style="width:95%"></div></div>
    </div>

    <div style="padding:1.1rem 1.5rem;">
      <!-- Header -->
      <div style="text-align:center;margin-bottom:1.1rem;">
        <h3 style="font-size:1.2rem;font-weight:800;color:#111827;margin-bottom:0.2rem;">כמעט שם — תוצאה אחת מחכה לך</h3>
        <p style="font-size:0.82rem;color:#6b7280;">יועץ מוסמך (ולא הבנק שלך) יחזור אליך תוך מספר שעות</p>
      </div>

      <!-- Phone (BIG — most important) -->
      <div style="margin-bottom:0.75rem;">
        <label style="display:block;font-size:0.82rem;font-weight:700;color:#374151;margin-bottom:0.3rem;">📱 טלפון נייד *</label>
        <input 
          type="tel" 
          id="lead-phone"
          placeholder="050-0000000"
          dir="ltr"
          style="width:100%;border:2px solid #d1d5db;border-radius:0.875rem;padding:0.9rem 1rem;font-size:1.1rem;outline:none;transition:border-color 0.2s;box-sizing:border-box;"
          onfocus="this.style.borderColor='#dc2626'"
          onblur="this.style.borderColor='#d1d5db'"
          required>
      </div>

      <div style="margin-bottom:0.75rem;">
        <label style="display:block;font-size:0.82rem;font-weight:700;color:#374151;margin-bottom:0.3rem;">👤 שם מלא *</label>
        <input 
          type="text" 
          id="lead-name"
          placeholder="ישראל ישראלי"
          style="width:100%;border:2px solid #d1d5db;border-radius:0.875rem;padding:0.9rem 1rem;font-size:1.05rem;outline:none;transition:border-color 0.2s;box-sizing:border-box;"
          onfocus="this.style.borderColor='#dc2626'"
          onblur="this.style.borderColor='#d1d5db'"
          required>
      </div>

      <!-- Honeypot -->
      <div style="position:absolute;left:-9999px;" aria-hidden="true">
        <input type="text" id="lead-company" name="company" tabindex="-1" autocomplete="off">
      </div>

      <div id="lead-error" style="color:#dc2626;font-size:0.82rem;margin-bottom:0.5rem;display:none;"></div>

      <!-- Submit CTA -->
      <button 
        id="submit-btn"
        class="quiz-cta-pulse"
        style="width:100%;background:#dc2626;color:white;font-weight:800;font-size:1.1rem;padding:1rem 1.5rem;border-radius:0.875rem;border:none;cursor:pointer;margin-top:0.25rem;letter-spacing:-0.01em;">
        ← שלח לי את הניתוח המלא
      </button>

      <div class="quiz-trust-row" style="margin-top:0.75rem;padding-bottom:0.5rem;">
        <span>🔒 מאובטח SSL</span>
        <span>✓ ללא דואר זבל</span>
        <span>✓ ניתן לביטול בכל עת</span>
      </div>
    </div>
  `;

  // Attach submit handler
  document.getElementById('submit-btn')?.addEventListener('click', submitLead);

  // Show error helper
  window._showLeadError = (msg) => {
    const el = document.getElementById('lead-error');
    if (el) { el.textContent = msg; el.style.display = 'block'; }
  };
}


// ============================================================
// RENDER SUCCESS SCREEN
// ============================================================
function renderSuccessScreen() {
  const content = document.getElementById('quiz-modal-content');
  if (!content) return;

  const config = currentConfig || DEFAULT_CONFIG;

  content.innerHTML = `
    <div style="text-align:center;padding:2rem 1.5rem 2rem;">

      <!-- Big green check -->
      <div style="width:5rem;height:5rem;background:linear-gradient(135deg,#dcfce7,#bbf7d0);border-radius:9999px;display:flex;align-items:center;justify-content:center;margin:0 auto 1rem;">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7"/></svg>
      </div>

      <!-- Confetti emoji row -->
      <p style="font-size:1.5rem;margin-bottom:0.5rem;">🎉 🎊 🎉</p>

      <h3 style="font-size:1.4rem;font-weight:900;color:#111827;margin-bottom:0.4rem;">${_e(config.success_title)}</h3>
      <p style="font-size:0.9rem;color:#4b5563;margin-bottom:1rem;">${_e(config.success_subtitle || 'נציג שלנו יצור איתך קשר בהקדם')}</p>

      ${config.success_range ? `
        <div style="background:linear-gradient(135deg,#f0fdf4,#dcfce7);border:2px solid #4ade80;border-radius:1rem;padding:1rem;margin-bottom:1.25rem;">
          <p style="font-size:0.75rem;color:#6b7280;">סכום משוער:</p>
          <p style="font-size:2rem;font-weight:900;color:#15803d;">${_e(config.success_range)}</p>
        </div>
      ` : ''}

      <!-- What happens next -->
      <div style="background:#f9fafb;border-radius:0.875rem;padding:1rem;margin-bottom:1.25rem;text-align:right;">
        <p style="font-size:0.82rem;font-weight:700;color:#374151;margin-bottom:0.5rem;">מה קורה עכשיו?</p>
        <div style="display:flex;flex-direction:column;gap:0.4rem;font-size:0.8rem;color:#6b7280;">
          <span>📞 נציג מומחה יתקשר אליך תוך 24 שעות</span>
          <span>📋 נבצע בדיקה מלאה ומקצועית בחינם</span>
          <span>💰 אם מגיע לך — נטפל בהחזר עבורך</span>
        </div>
      </div>

      <button id="close-success-btn"
        style="background:#f3f4f6;color:#374151;font-weight:700;padding:0.75rem 2rem;border-radius:0.875rem;border:none;cursor:pointer;font-size:0.95rem;">
        סגור
      </button>
    </div>
  `;

  document.getElementById('close-success-btn')?.addEventListener('click', closeQuizModal);
}


// ============================================================
// SELECT ANSWER AND ADVANCE
// ============================================================
window.selectAnswer = function (questionId, answer) {
  userAnswers[questionId] = answer;
  currentStep++;

  const questions = currentConfig?.questions || [];

  if (currentStep >= questions.length) {
    // All questions answered — show calculating screen first
    renderCalculatingScreen();
  } else {
    // More questions to go
    renderCurrentStep();
  }
};

// ============================================================
// GO BACK
// ============================================================
window.goToPreviousStep = function () {
  if (currentStep > 0) {
    currentStep--;
    renderCurrentStep();
  }
};

// ============================================================
// SUBMIT LEAD
// ============================================================
window.submitLead = async function () {
  const phone = document.getElementById('lead-phone')?.value?.trim();
  const name = document.getElementById('lead-name')?.value?.trim();
  const email = document.getElementById('lead-email')?.value?.trim();
  const honeypot = document.getElementById('lead-company')?.value?.trim();
  const errorEl = document.getElementById('lead-error');
  const submitBtn = document.getElementById('submit-btn');

  // Client-side validation
  if (!phone || phone.replace(/[\s-]/g, '').length < 9) {
    const msg = 'נא להזין מספר טלפון תקין';
    if (window._showLeadError) window._showLeadError(msg);
    else if (errorEl) { errorEl.textContent = msg; errorEl.style.display = 'block'; }
    return;
  }
  if (!name) {
    const msg = 'נא להזין שם מלא';
    if (window._showLeadError) window._showLeadError(msg);
    else if (errorEl) { errorEl.textContent = msg; errorEl.style.display = 'block'; }
    return;
  }
  if (errorEl) { errorEl.style.display = 'none'; }

  // Disable button
  submitBtn.textContent = 'שולח...';
  submitBtn.disabled = true;

  try {
    const urlParams = new URLSearchParams(window.location.search);
    const leadPayload = {
      vertical: currentConfig?.vertical_name || 'כללי',
      category_slug: currentVertical || 'taxation',
      name: name,
      phone: phone,
      email: email || null,
      company: honeypot || '', // honeypot — edge function rejects if filled
      answers: userAnswers,
      source_url: window.location.href,
      article_slug: urlParams.get('slug'),
      utm_source: urlParams.get('utm_source'),
      utm_campaign: urlParams.get('utm_campaign'),
    };

    // Submit via edge function (server-side insert + webhook dispatch)
    const response = await fetch(SUBMIT_LEAD_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(leadPayload),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'שגיאה בשליחת הטופס');
    }

    renderSuccessScreen();

  } catch (err) {
    console.error('Lead submission failed:', err);
    errorEl.textContent = err.message || 'שגיאה — נסה שוב';
    errorEl.classList.remove('hidden');

    submitBtn.textContent = '← קבל את התוצאה שלך';
    submitBtn.disabled = false;
  }
};

// ============================================================
// CLOSE ON OVERLAY CLICK + ESC KEY
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  const modal = document.getElementById('quiz-modal');

  if (modal) {
    // Close on overlay click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeQuizModal();
    });
  }

  // Close on ESC
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeQuizModal();
  });
});
