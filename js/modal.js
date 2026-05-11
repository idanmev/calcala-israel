// modal.js — Step-based quiz modal for Calcala-News

const MODAL_SB_URL = 'https://gtuxstslzsiuinxjvfdj.supabase.co';
const MODAL_SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0dXhzdHNsenNpdWlueGp2ZmRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyMTU2NjIsImV4cCI6MjA4Njc5MTY2Mn0.ZYbL9PVGUdehVEtg18bi-Uyw-iy857KVM7Yceh7NMaM';
const SUBMIT_LEAD_URL = `${MODAL_SB_URL}/functions/v1/submit-lead`;

const _e = (s) => window.CalcalaSanitize ? window.CalcalaSanitize.escapeHtml(s) : String(s || '');

let supabaseModal = null;
function getSupabaseModal() {
  if (!supabaseModal) {
    if (!window.supabase) { console.error('Supabase not loaded'); return null; }
    supabaseModal = window.supabase.createClient(MODAL_SB_URL, MODAL_SB_KEY);
  }
  return supabaseModal;
}

// ── State ──────────────────────────────────────────────────────
let currentConfig = null;
let currentSteps = [];
let currentStepIndex = 0;
let userAnswers = {};
let isEligible = true;
let collectedName = '';
let currentVertical = 'taxation';

const DEFAULT_ADVISOR_IMG = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 80 80'%3E%3Ccircle cx='40' cy='40' r='40' fill='%23e5e7eb'/%3E%3Ccircle cx='40' cy='30' r='14' fill='%239ca3af'/%3E%3Cellipse cx='40' cy='68' rx='22' ry='16' fill='%239ca3af'/%3E%3C/svg%3E`;

const DEFAULT_CONFIG = {
  display_name: 'בדיקת זכאות חינמית',
  vertical_name: 'כללי',
  questions: [
    { id: 'q1', text: 'מה מצבך התעסוקתי?', options: ['שכיר/ת', 'עצמאי/ת', 'לא עובד/ת'] }
  ],
  success_title: 'בשורות טובות!',
  success_subtitle: 'נציג שלנו יצור איתך קשר בהקדם',
};

// ── CSS (injected once) ────────────────────────────────────────
function injectModalStyles() {
  if (document.getElementById('qm-styles')) return;
  const s = document.createElement('style');
  s.id = 'qm-styles';
  s.textContent = `
    .qm-shell{background:#f8f9fa;border-radius:1.25rem;max-width:560px;width:100%;margin:0 auto;position:relative;font-family:inherit;}
    .qm-close{position:absolute;top:0.85rem;left:0.85rem;z-index:20;background:rgba(0,0,0,0.08);border:none;border-radius:9999px;width:2rem;height:2rem;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#6b7280;font-size:0.85rem;transition:background 0.15s;}
    .qm-close:hover{background:rgba(0,0,0,0.14);color:#111827;}
    .qm-header{padding:1.25rem 3rem 0.75rem;text-align:center;}
    .qm-title{font-size:1rem;font-weight:700;color:#111827;line-height:1.5;margin-bottom:0.65rem;}
    .qm-progress-track{height:4px;background:#e5e7eb;border-radius:9999px;overflow:hidden;}
    .qm-progress-fill{height:100%;background:#111827;border-radius:9999px;transform-origin:right;transition:transform 0.4s cubic-bezier(0.4,0,0.2,1);}
    .qm-advisor{display:flex;justify-content:center;margin-bottom:-2rem;position:relative;z-index:2;}
    .qm-advisor-img{width:76px;height:76px;border-radius:9999px;border:3px solid #fff;box-shadow:0 2px 14px rgba(0,0,0,0.13);object-fit:cover;background:#e5e7eb;}
    .qm-card-wrapper{position:relative;padding:0 3rem 0 1.1rem;}
    .qm-card{background:#fff;border:1.5px solid #e5e7eb;border-radius:1.1rem;padding:2.75rem 1.5rem 1.5rem;min-height:220px;box-shadow:0 1px 6px rgba(0,0,0,0.06);}
    .qm-arrow{position:absolute;right:0.6rem;top:50%;transform:translateY(-50%);width:2.5rem;height:2.5rem;border-radius:9999px;background:#111827;color:#fff;border:none;cursor:pointer;font-size:1.05rem;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 10px rgba(0,0,0,0.2);transition:transform 0.15s,box-shadow 0.15s;z-index:3;}
    .qm-arrow:hover{transform:translateY(-50%) scale(1.08);box-shadow:0 4px 14px rgba(0,0,0,0.25);}
    .qm-ssl-footer{display:flex;align-items:center;justify-content:center;gap:0.35rem;font-size:0.7rem;color:#9ca3af;padding:0.7rem 1rem 0.85rem;text-align:center;}
    .qm-question{text-align:center;font-size:1.05rem;font-weight:700;color:#111827;line-height:1.5;margin-bottom:1.5rem;}
    .qm-circles{display:flex;flex-wrap:wrap;gap:0.7rem;justify-content:center;align-items:center;}
    .qm-circle{border:2px solid #d1d5db;background:#fff;border-radius:9999px;cursor:pointer;display:flex;align-items:center;justify-content:center;text-align:center;font-size:0.85rem;font-weight:600;color:#374151;transition:all 0.18s;line-height:1.25;padding:0.5rem;word-break:break-word;}
    .qm-circle:hover{border-color:#6b7280;background:#f9fafb;}
    .qm-circle.selected{background:#111827 !important;border-color:#111827 !important;color:#fff !important;}
    .qm-input-label{text-align:center;font-size:0.9rem;color:#374151;line-height:1.55;margin-bottom:1.25rem;}
    .qm-input-wrap{position:relative;margin-bottom:0.75rem;}
    .qm-input{width:100%;border:2px solid #d1d5db;border-radius:9999px;padding:0.85rem 1.25rem 0.85rem 3rem;font-size:1rem;outline:none;transition:border-color 0.2s;box-sizing:border-box;background:#fff;color:#111827;text-align:right;}
    .qm-input:focus{border-color:#111827;}
    .qm-input[dir="ltr"]{text-align:left;}
    .qm-input-icon{position:absolute;left:1.1rem;top:50%;transform:translateY(-50%);color:#9ca3af;line-height:0;}
    .qm-continue-btn{width:100%;background:#111827;color:#fff;font-weight:700;font-size:1rem;padding:0.9rem 1.5rem;border-radius:9999px;border:none;cursor:pointer;transition:opacity 0.18s;display:flex;align-items:center;justify-content:center;gap:0.4rem;}
    .qm-continue-btn:hover{opacity:0.85;}
    .qm-continue-btn:disabled{opacity:0.5;cursor:not-allowed;}
    .qm-input-error{color:#dc2626;font-size:0.78rem;margin-bottom:0.5rem;display:none;text-align:center;}
    .qm-elig-icon{width:3rem;height:3rem;border-radius:9999px;display:flex;align-items:center;justify-content:center;margin:0 auto 0.75rem;}
    .qm-elig-title{font-size:1.15rem;font-weight:800;color:#111827;margin-bottom:0.4rem;text-align:center;}
    .qm-elig-sub{font-size:0.88rem;color:#6b7280;line-height:1.55;text-align:center;}
    .qm-ty-icon{width:3.5rem;height:3.5rem;background:#f0fdf4;border-radius:9999px;display:flex;align-items:center;justify-content:center;margin:0 auto 0.75rem;}
    .qm-ty-title{font-size:1.2rem;font-weight:800;color:#111827;margin-bottom:0.4rem;text-align:center;}
    .qm-ty-sub{font-size:0.88rem;color:#6b7280;text-align:center;line-height:1.55;}
    .qm-close-btn{background:#f3f4f6;color:#374151;font-weight:700;padding:0.7rem 2rem;border-radius:9999px;border:none;cursor:pointer;font-size:0.9rem;margin-top:1.25rem;transition:background 0.15s;}
    .qm-close-btn:hover{background:#e5e7eb;}
    @keyframes qm-spin{to{transform:rotate(360deg)}}
  `;
  document.head.appendChild(s);
}

// ── Open / Close ───────────────────────────────────────────────
function _openQuizModalImpl(vertical = null, prefillAnswer = null, fallbackCategory = null, quizId = null) {
  currentVertical = vertical || fallbackCategory || getCurrentVertical();
  userAnswers = {};
  currentStepIndex = 0;
  isEligible = true;
  collectedName = '';
  _eligibilityHandledPhone = false;

  if (window.CalcalaTracking) {
    window.CalcalaTracking.trackQuizOpen(currentVertical);
  }

  if (prefillAnswer) userAnswers['entry_hook'] = prefillAnswer;

  const modal = document.getElementById('quiz-modal');
  if (!modal) return;

  // Reset inner card
  const inner = modal.querySelector(':scope > div');
  if (inner) {
    inner.className = '';
    inner.style.cssText = '';
  }

  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';

  injectModalStyles();
  renderLoadingShell();

  if (quizId) loadConfigById(quizId);
  else loadConfig(currentVertical);
}

function _closeQuizModalImpl() {
  const modal = document.getElementById('quiz-modal');
  if (!modal) return;
  modal.classList.add('hidden');
  document.body.style.overflow = '';
  const inner = modal.querySelector(':scope > div');
  if (inner) inner.innerHTML = '<div id="quiz-modal-content"></div>';
}

// Register implementations under private names for lazy-proxy pages (medton-lp).
// These are always set so the proxy can delegate here at call time.
window._quizModalOpen  = _openQuizModalImpl;
window._quizModalClose = _closeQuizModalImpl;

// Only set the global if it hasn't been installed by a page's own wrapper.
// (medton-lp's inline script defines window.openQuizModal BEFORE this runs.)
if (typeof window.openQuizModal !== 'function') {
  window.openQuizModal  = _openQuizModalImpl;
  window.closeQuizModal = _closeQuizModalImpl;
}

// Notify medton-lp's lazy hook so any queued call gets replayed.
// On other pages _quizModalReadyHook is undefined — the try/catch is a no-op.
try { window._quizModalReadyHook = _openQuizModalImpl; } catch(e) {}

function getCurrentVertical() {
  if (window.currentArticleCategory) return window.currentArticleCategory;
  return 'taxation';
}

// ── Load config ────────────────────────────────────────────────
async function loadConfigById(quizId) {
  try {
    const { data, error } = await getSupabaseModal()
      .from('quiz_configs').select('*').eq('id', quizId).eq('is_active', true).single();
    currentConfig = (error || !data) ? DEFAULT_CONFIG : data;
  } catch { currentConfig = DEFAULT_CONFIG; }
  initFlow();
}

async function loadConfig(slug) {
  try {
    const { data, error } = await getSupabaseModal()
      .from('quiz_configs').select('*').eq('category_slug', slug).eq('is_active', true).single();
    currentConfig = (error || !data) ? DEFAULT_CONFIG : data;
  } catch { currentConfig = DEFAULT_CONFIG; }
  initFlow();
}

// ── Init step flow ─────────────────────────────────────────────
function initFlow() {
  const raw = currentConfig.steps;
  if (raw && Array.isArray(raw) && raw.length > 0) {
    currentSteps = raw;
  } else if (typeof raw === 'string') {
    try { currentSteps = JSON.parse(raw); } catch { currentSteps = buildLegacySteps(); }
  } else {
    currentSteps = buildLegacySteps();
  }

  setupShell();
  renderStep();
}

function buildLegacySteps() {
  const c = currentConfig;
  const steps = [];

  steps.push({ type: 'name_input', question_text: 'מה שמך?' });

  (c.questions || []).forEach(q => {
    steps.push({ type: 'question', id: q.id, text: q.text, options: q.options || [] });
  });

  steps.push({
    type: 'eligibility_result',
    eligible_title: c.success_title || 'בשורות מצוינות!',
    eligible_subtitle: c.success_subtitle || 'נראה כי מגיע לך לבדוק זכאות מלאה.',
    not_eligible_title: 'לא נמצאה זכאות',
    not_eligible_subtitle: 'על פי הנתונים שהזנת, לא נמצאה זכאות כרגע.',
    eligible_conditions: [],
    show_phone_if_not_eligible: true,
  });

  steps.push({ type: 'phone_input', question_text: 'מספר טלפון לחזרה — נציג ייצור איתך קשר בהקדם.' });
  steps.push({ type: 'thank_you', title: c.success_title || 'תודה!', subtitle: c.success_subtitle || 'נציג שלנו יחזור אליך בהקדם.' });

  return steps;
}

// ── Modal shell (persistent wrapper) ──────────────────────────
function setupShell() {
  const modal = document.getElementById('quiz-modal');
  if (!modal) return;
  const inner = modal.querySelector(':scope > div');
  if (!inner) return;

  const title = _e(currentConfig.display_name || currentConfig.vertical_name || 'בדיקת זכאות');
  const advisorSrc = currentConfig.advisor_image_url || DEFAULT_ADVISOR_IMG;

  inner.innerHTML = `
    <div class="qm-shell" dir="rtl">
      <button class="qm-close" id="qm-close-btn" aria-label="סגור">✕</button>

      <div class="qm-header">
        <h2 class="qm-title" id="qm-title">${title}</h2>
        <div class="qm-progress-track">
          <div class="qm-progress-fill" id="qm-fill" style="transform:scaleX(0)"></div>
        </div>
      </div>

      <div class="qm-advisor">
        <img class="qm-advisor-img" id="qm-advisor-img" src="${_e(advisorSrc)}" alt="יועץ"
          onerror="this.onerror=null;this.src='${DEFAULT_ADVISOR_IMG}'" />
      </div>

      <div class="qm-card-wrapper">
        <div class="qm-card" id="qm-step-content"></div>
        <button class="qm-arrow" id="qm-arrow" style="display:none;">→</button>
      </div>

      <div class="qm-ssl-footer">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        פרטיך מוגנים באמצעות הצפנת SSL
      </div>
    </div>
  `;

  document.getElementById('qm-close-btn')?.addEventListener('click', closeQuizModal);
}

// ── Step rendering ─────────────────────────────────────────────
function renderStep() {
  if (!currentSteps.length) return;
  const step = currentSteps[currentStepIndex];
  if (!step) return;

  updateProgress();

  const arrow = document.getElementById('qm-arrow');
  if (arrow) { arrow.style.display = 'none'; arrow.onclick = null; }

  switch (step.type) {
    case 'name_input':        renderNameInput(step); break;
    case 'question':          renderQuestion(step);  break;
    case 'eligibility_result':renderEligibility(step); break;
    case 'phone_input':       renderPhoneInput(step); break;
    case 'thank_you':         renderThankYou(step);  break;
    default: advance(); break;
  }
}

function updateProgress() {
  const fill = document.getElementById('qm-fill');
  if (!fill || currentSteps.length < 2) return;
  const pct = currentStepIndex / (currentSteps.length - 1);
  fill.style.transform = `scaleX(${Math.min(1, pct)})`;
}

function advance() {
  currentStepIndex++;
  if (currentStepIndex >= currentSteps.length) return;

  const next = currentSteps[currentStepIndex];

  // Skip phone if not eligible and step opts out
  if (next.type === 'phone_input' && !isEligible) {
    const show = next.show_phone_if_not_eligible !== false;
    if (!show) { currentStepIndex++; renderStep(); return; }
  }

  renderStep();
}

function goBack() {
  if (currentStepIndex <= 0) return;
  currentStepIndex--;
  renderStep();
}

// ── Name input ─────────────────────────────────────────────────
function renderNameInput(step) {
  const el = document.getElementById('qm-step-content');
  if (!el) return;
  const label = _e(step.question_text || 'מה שמך?');

  el.innerHTML = `
    <p class="qm-input-label">${label}</p>
    <div class="qm-input-wrap">
      <input type="text" class="qm-input" id="qm-name" placeholder="שם מלא" autocomplete="given-name" />
      <span class="qm-input-icon">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
      </span>
    </div>
    <p class="qm-input-error" id="qm-name-err"></p>
    <button class="qm-continue-btn" id="qm-name-btn">המשך ←</button>
  `;

  const go = () => {
    const val = document.getElementById('qm-name')?.value?.trim();
    const errEl = document.getElementById('qm-name-err');
    if (!val || val.length < 2) {
      if (errEl) { errEl.textContent = 'נא להזין שם תקין'; errEl.style.display = 'block'; }
      return;
    }
    collectedName = val;
    userAnswers['name'] = val;
    advance();
  };

  document.getElementById('qm-name-btn')?.addEventListener('click', go);
  document.getElementById('qm-name')?.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
  setTimeout(() => document.getElementById('qm-name')?.focus(), 80);
}

// ── Question (circular buttons) ────────────────────────────────
function renderQuestion(step) {
  const el = document.getElementById('qm-step-content');
  if (!el) return;
  const opts = step.options || [];
  const n = opts.length;
  const diameter = n <= 2 ? '110px' : n <= 4 ? '92px' : '76px';
  const fontSize = n <= 2 ? '0.95rem' : n <= 4 ? '0.84rem' : '0.78rem';

  el.innerHTML = `
    <p class="qm-question">${_e(step.text)}</p>
    <div class="qm-circles" id="qm-circles">
      ${opts.map(opt => `
        <button class="qm-circle"
          data-value="${_e(opt)}"
          data-qid="${_e(step.id || 'q')}"
          style="width:${diameter};height:${diameter};font-size:${fontSize};">
          ${_e(opt)}
        </button>
      `).join('')}
    </div>
  `;

  document.getElementById('qm-circles')?.addEventListener('click', e => {
    const btn = e.target.closest('.qm-circle');
    if (!btn) return;
    document.querySelectorAll('#qm-circles .qm-circle').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    setTimeout(() => {
      userAnswers[btn.dataset.qid] = btn.dataset.value;
      // Track quiz_step via GTM
      if (window.CalcalaTracking) {
        window.CalcalaTracking.trackQuizStep(currentStepIndex, btn.dataset.qid, btn.dataset.value, currentVertical);
      }
      advance();
    }, 200);
  });

  // Arrow visible on non-first question steps — navigates to previous step
  const arrow = document.getElementById('qm-arrow');
  if (arrow) {
    if (currentStepIndex > 0) {
      arrow.style.display = 'flex';
      arrow.onclick = () => goBack();
    } else {
      arrow.style.display = 'none';
      arrow.onclick = null;
    }
  }
}

// ── Eligibility result (loading → result + phone on same screen) ─
function renderEligibility(step) {
  const el = document.getElementById('qm-step-content');
  if (!el) return;

  // Compute eligibility from conditions
  const conditions = step.eligible_conditions || [];
  if (conditions.length > 0) {
    isEligible = conditions.every(c => {
      const ans = userAnswers[c.question_id];
      return Array.isArray(c.answers) ? c.answers.includes(ans) : ans === c.answer;
    });
  } else {
    isEligible = true;
  }

  // Hide arrow during loading/result screen
  const arrow = document.getElementById('qm-arrow');
  if (arrow) arrow.style.display = 'none';

  // Step 1: loading animation
  el.innerHTML = `
    <div id="qm-elig-loading" style="text-align:center;padding:1.5rem 0;">
      <div style="width:3rem;height:3rem;border-radius:9999px;border:3px solid #e5e7eb;border-top-color:#111827;animation:qm-spin 0.7s linear infinite;margin:0 auto 1rem;"></div>
      <p style="font-size:0.9rem;font-weight:600;color:#374151;">בודק זכאות...</p>
    </div>
  `;

  // Step 2: after 1.6s show result + phone input on same screen
  setTimeout(() => {
    const title = isEligible
      ? _e(step.eligible_title || 'חדשות טובות!')
      : _e(step.not_eligible_title || 'לא נמצאה זכאות');
    const sub = isEligible
      ? _e(step.eligible_subtitle || '')
      : _e(step.not_eligible_subtitle || '');

    // Icon: eligible always gets check. Ineligible respects `not_eligible_icon` field:
    //   'check' → green ✓,  'x' → red X,  'none' → hidden (default)
    const notEligIcon = step.not_eligible_icon || 'none';
    const iconBg = isEligible
      ? '#f0fdf4'
      : (notEligIcon === 'check' ? '#f0fdf4' : '#fef2f2');
    const iconColor = isEligible
      ? '#16a34a'
      : (notEligIcon === 'check' ? '#16a34a' : '#dc2626');
    const iconPath = isEligible
      ? '<path d="M5 13l4 4L19 7"/>'
      : (notEligIcon === 'check'
          ? '<path d="M5 13l4 4L19 7"/>'
          : '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>');
    const showIcon = isEligible || notEligIcon !== 'none';

    // Look for next phone_input step config for custom text
    const nextPhoneStep = currentSteps.slice(currentStepIndex + 1).find(s => s.type === 'phone_input');
    const showPhone = isEligible || (step.show_phone_if_not_eligible !== false);
    const phoneLabel = _e(nextPhoneStep?.question_text || 'הזינו מספר טלפון ונציג ייצור איתכם קשר בהקדם.');
    const needsName = !collectedName;

    el.innerHTML = `
      <div style="text-align:center;margin-bottom:1.25rem;">
        ${showIcon ? `<div class="qm-elig-icon" style="background:${iconBg};">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="${iconColor}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">${iconPath}</svg>
        </div>` : ''}
        <p class="qm-elig-title">${title}</p>
        ${sub ? `<p class="qm-elig-sub">${sub}</p>` : ''}
      </div>

      ${showPhone ? `
        <div style="border-top:1px solid #f3f4f6;padding-top:1.1rem;">
          <p class="qm-input-label" style="margin-bottom:1rem;">${phoneLabel}</p>
          ${needsName ? `
          <div class="qm-input-wrap">
            <input type="text" class="qm-input" id="qm-ph-name" placeholder="שם מלא" autocomplete="given-name" />
            <span class="qm-input-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            </span>
          </div>` : ''}
          <div class="qm-input-wrap">
            <input type="tel" class="qm-input" id="qm-phone" placeholder="050-0000000" dir="ltr" autocomplete="tel" />
            <span class="qm-input-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.41 2 2 0 0 1 3.6 1.21h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.78a16 16 0 0 0 5.99 6l.85-.85a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21.61 17l.31-.08Z"/></svg>
            </span>
          </div>
          <!-- Honeypot -->
          <div style="position:absolute;left:-9999px;" aria-hidden="true">
            <input type="text" id="qm-honeypot" name="company" tabindex="-1" autocomplete="off">
          </div>
          <p class="qm-input-error" id="qm-phone-err"></p>
          <button class="qm-continue-btn" id="qm-phone-btn">שלח ←</button>
        </div>
      ` : `
        <div style="text-align:center;margin-top:1rem;">
          <button class="qm-close-btn" id="qm-close-elig">סגור</button>
        </div>
      `}
    `;

    if (showPhone) {
      document.getElementById('qm-phone-btn')?.addEventListener('click', submitQuizLead);
      document.getElementById('qm-phone')?.addEventListener('keydown', e => { if (e.key === 'Enter') submitQuizLead(); });
      setTimeout(() => document.getElementById(needsName ? 'qm-ph-name' : 'qm-phone')?.focus(), 80);
    } else {
      document.getElementById('qm-close-elig')?.addEventListener('click', closeQuizModal);
    }

    // Track quiz_complete + lead_form_view via GTM
    if (window.CalcalaTracking) {
      window.CalcalaTracking.trackQuizComplete(userAnswers, currentVertical);
      if (showPhone) window.CalcalaTracking.trackLeadFormView(currentVertical);
    }

    // Mark phone step as already handled so advance() skips it
    _eligibilityHandledPhone = true;

    // Update progress to near-end
    const fill = document.getElementById('qm-fill');
    if (fill) fill.style.transform = 'scaleX(0.9)';
  }, 1600);
}

// Flag so advance() skips phone_input if eligibility already embedded it
let _eligibilityHandledPhone = false;

// ── Phone input ────────────────────────────────────────────────
function renderPhoneInput(step) {
  const el = document.getElementById('qm-step-content');
  if (!el) return;
  const label = _e(step.question_text || 'מספר טלפון לחזרה');

  // If name was never collected, show name field too
  const needsName = !collectedName;

  el.innerHTML = `
    <p class="qm-input-label">${label}</p>
    ${needsName ? `
    <div class="qm-input-wrap">
      <input type="text" class="qm-input" id="qm-ph-name" placeholder="שם מלא" autocomplete="given-name" />
      <span class="qm-input-icon">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
      </span>
    </div>
    ` : ''}
    <div class="qm-input-wrap">
      <input type="tel" class="qm-input" id="qm-phone" placeholder="050-0000000" dir="ltr" autocomplete="tel" />
      <span class="qm-input-icon">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.41 2 2 0 0 1 3.6 1.21h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.78a16 16 0 0 0 5.99 6l.85-.85a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21.61 17l.31-.08Z"/></svg>
      </span>
    </div>
    <!-- Honeypot -->
    <div style="position:absolute;left:-9999px;" aria-hidden="true">
      <input type="text" id="qm-honeypot" name="company" tabindex="-1" autocomplete="off">
    </div>
    <p class="qm-input-error" id="qm-phone-err"></p>
    <button class="qm-continue-btn" id="qm-phone-btn">המשך ←</button>
  `;

  document.getElementById('qm-phone-btn')?.addEventListener('click', submitQuizLead);
  document.getElementById('qm-phone')?.addEventListener('keydown', e => { if (e.key === 'Enter') submitQuizLead(); });
  setTimeout(() => {
    const focus = needsName ? 'qm-ph-name' : 'qm-phone';
    document.getElementById(focus)?.focus();
  }, 80);
}

// ── Thank you ──────────────────────────────────────────────────
function renderThankYou(step) {
  const el = document.getElementById('qm-step-content');
  if (!el) return;

  el.innerHTML = `
    <div class="qm-ty-icon">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7"/></svg>
    </div>
    <p class="qm-ty-title">${_e(step.title || 'תודה!')}</p>
    <p class="qm-ty-sub">${_e(step.subtitle || 'נציג שלנו יחזור אליך בהקדם.')}</p>
    <div style="text-align:center;">
      <button class="qm-close-btn" id="qm-close-final">סגור</button>
    </div>
  `;

  document.getElementById('qm-close-final')?.addEventListener('click', closeQuizModal);
  const arrow = document.getElementById('qm-arrow');
  if (arrow) arrow.style.display = 'none';
}

// ── Submit lead ────────────────────────────────────────────────
async function submitQuizLead() {
  const phoneEl = document.getElementById('qm-phone');
  const nameEl = document.getElementById('qm-ph-name');
  const honeypot = document.getElementById('qm-honeypot')?.value?.trim();
  const errEl = document.getElementById('qm-phone-err');
  const btn = document.getElementById('qm-phone-btn');

  const phone = phoneEl?.value?.trim() || '';
  const name = collectedName || nameEl?.value?.trim() || userAnswers['name'] || '';

  if (!name || name.length < 2) {
    if (errEl) { errEl.textContent = 'נא להזין שם מלא'; errEl.style.display = 'block'; }
    nameEl?.focus();
    return;
  }
  const phoneClean = phone.replace(/[\s\-]/g, '');
  if (!/^05\d{8}$/.test(phoneClean)) {
    if (errEl) { errEl.textContent = 'נא להזין מספר נייד תקין (לדוגמה: 0501234567)'; errEl.style.display = 'block'; }
    phoneEl?.focus();
    return;
  }
  if (errEl) errEl.style.display = 'none';

  if (btn) { btn.textContent = 'שולח...'; btn.disabled = true; }

  // Track lead_submit_attempt via GTM
  if (window.CalcalaTracking) {
    window.CalcalaTracking.trackLeadSubmitAttempt(currentVertical);
  }

  try {
    const urlParams = new URLSearchParams(window.location.search);
    const payload = {
      quiz_id: currentConfig?.id || null,
      vertical: currentConfig?.vertical_name || 'כללי',
      category_slug: currentVertical || 'general',
      name,
      phone: phoneClean,
      email: null,
      company: honeypot || '',
      answers: userAnswers,
      source_url: window.location.href,
      article_slug: urlParams.get('slug'),
      utm_source: urlParams.get('utm_source'),
      utm_campaign: urlParams.get('utm_campaign'),
    };

    const res = await fetch(SUBMIT_LEAD_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'שגיאה בשליחת הטופס');

    // Find and render thank_you step
    const tyStep = currentSteps.find(s => s.type === 'thank_you')
      || { title: 'תודה!', subtitle: 'נציג שלנו יחזור אליך בהקדם.' };

    const fill = document.getElementById('qm-fill');
    if (fill) fill.style.transform = 'scaleX(1)';

    // Track lead_success via GTM (fires Outbrain, Meta, GA4 etc.)
    if (window.CalcalaTracking) {
      window.CalcalaTracking.trackLeadSuccess(currentVertical, userAnswers);
    }

    renderThankYou(tyStep);

  } catch (err) {
    console.error('Lead submit failed:', err);
    if (errEl) { errEl.textContent = err.message || 'שגיאה — נסה שוב'; errEl.style.display = 'block'; }
    if (btn) { btn.textContent = 'המשך ←'; btn.disabled = false; }
  }
}

// ── Loading shell ──────────────────────────────────────────────
function renderLoadingShell() {
  const modal = document.getElementById('quiz-modal');
  if (!modal) return;
  const inner = modal.querySelector(':scope > div');
  if (!inner) return;
  inner.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:center;padding:4rem 2rem;background:#fff;border-radius:1.25rem;">
      <div style="width:2.5rem;height:2.5rem;border-radius:9999px;border:3px solid #e5e7eb;border-top-color:#111827;animation:qm-spin 0.7s linear infinite;"></div>
      <style>@keyframes qm-spin{to{transform:rotate(360deg)}}</style>
    </div>
  `;
}

// ── Overlay + ESC close ────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const modal = document.getElementById('quiz-modal');
  if (modal) {
    modal.addEventListener('click', e => { if (e.target === modal) closeQuizModal(); });
  }
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeQuizModal(); });
});
