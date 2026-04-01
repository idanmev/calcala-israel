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

  renderLoadingState();

  if (quizId) {
    loadQuizConfigById(quizId);
  } else {
    loadQuizConfig(currentVertical);
  }
};

// ============================================================
// CLOSE MODAL
// ============================================================
window.closeQuizModal = function () {
  const modal = document.getElementById('quiz-modal');
  if (modal) {
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
    <div class="flex flex-col items-center justify-center py-16 px-8">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mb-4"></div>
      <p class="text-gray-500 text-sm">טוען...</p>
    </div>
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

  const progressPercent = Math.round(((stepIndex) / totalSteps) * 100);

  content.innerHTML = `
    <!-- Progress bar -->
    <div class="w-full bg-gray-200 h-2 rounded-full mb-6">
      <div class="bg-red-600 h-2 rounded-full transition-all duration-500" style="width: ${progressPercent}%"></div>
    </div>

    <!-- Step indicator -->
    <p class="text-sm text-gray-500 mb-4 text-center">שאלה ${stepIndex + 1} מתוך ${totalSteps - 1}</p>

    <!-- Question -->
    <h3 class="text-2xl font-bold text-gray-900 mb-6 text-center leading-tight">${_e(question.text)}</h3>

    <!-- Options -->
    <div class="space-y-3" id="quiz-options-container">
      ${question.options.map(option => `
        <button 
          data-question-id="${_e(question.id)}"
          data-option-value="${_e(option)}"
          class="quiz-option-btn w-full text-right px-5 py-4 border-2 border-gray-200 rounded-xl font-medium text-gray-800 hover:border-red-500 hover:bg-red-50 transition-all duration-200 text-lg">
          ${_e(option)}
        </button>
      `).join('')}
    </div>

    <!-- Back button -->
    ${currentStep > 0 ? `
      <button id="quiz-back-btn" class="mt-4 text-sm text-gray-400 hover:text-gray-600 underline w-full text-center">
        ← חזור
      </button>
    ` : ''}
  `;

  // Event delegation for option buttons
  const optionsContainer = document.getElementById('quiz-options-container');
  if (optionsContainer) {
    optionsContainer.addEventListener('click', (e) => {
      const btn = e.target.closest('.quiz-option-btn');
      if (btn) {
        selectAnswer(btn.dataset.questionId, btn.dataset.optionValue);
      }
    });
  }

  // Back button
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
    <div class="flex flex-col items-center justify-center py-12 px-8 text-center">
      
      <!-- Animated calculation icon -->
      <div class="relative mb-6">
        <div class="w-20 h-20 rounded-full border-4 border-gray-200 flex items-center justify-center">
          <div class="w-20 h-20 rounded-full border-4 border-red-600 border-t-transparent animate-spin absolute top-0 left-0"></div>
          <span class="text-3xl">🧮</span>
        </div>
      </div>

      <!-- Calculating text with animated dots -->
      <h3 class="text-2xl font-bold text-gray-900 mb-3">בודק את הזכאות שלך...</h3>
      
      <!-- Animated progress steps -->
      <div class="w-full max-w-xs space-y-2 mt-4">
        <div class="flex items-center gap-3 text-sm text-gray-600" id="calc-step-1">
          <div class="w-4 h-4 rounded-full bg-gray-200 flex-shrink-0"></div>
          <span>בודק נתוני הכנסה</span>
        </div>
        <div class="flex items-center gap-3 text-sm text-gray-400" id="calc-step-2">
          <div class="w-4 h-4 rounded-full bg-gray-200 flex-shrink-0"></div>
          <span>מחשב ניכויים</span>
        </div>
        <div class="flex items-center gap-3 text-sm text-gray-400" id="calc-step-3">
          <div class="w-4 h-4 rounded-full bg-gray-200 flex-shrink-0"></div>
          <span>מאמת מול נתוני רשות המסים</span>
        </div>
      </div>

    </div>
  `;

  // Animate the steps with delays
  setTimeout(() => {
    const step1 = document.getElementById('calc-step-1');
    if (step1) {
      step1.querySelector('div').className = 'w-4 h-4 rounded-full bg-green-500 flex-shrink-0';
      step1.className = 'flex items-center gap-3 text-sm text-gray-800 font-medium';
    }
  }, 400);

  setTimeout(() => {
    const step2 = document.getElementById('calc-step-2');
    if (step2) {
      step2.querySelector('div').className = 'w-4 h-4 rounded-full bg-green-500 flex-shrink-0';
      step2.className = 'flex items-center gap-3 text-sm text-gray-800 font-medium';
    }
  }, 900);

  setTimeout(() => {
    const step3 = document.getElementById('calc-step-3');
    if (step3) {
      step3.querySelector('div').className = 'w-4 h-4 rounded-full bg-green-500 flex-shrink-0';
      step3.className = 'flex items-center gap-3 text-sm text-gray-800 font-medium';
    }
  }, 1400);

  // After 2 seconds, show results
  setTimeout(() => {
    renderResultsScreen();
  }, 2000);
}

// ============================================================
// RENDER RESULTS SCREEN (pre-commitment)
// ============================================================
function renderResultsScreen() {
  const content = document.getElementById('quiz-modal-content');
  if (!content) return;

  const config = currentConfig || DEFAULT_CONFIG;
  const range = _e(config.success_range || '₪2,000 - ₪12,000');

  content.innerHTML = `
    <div class="text-center">

      <!-- Success checkmark -->
      <div class="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <svg class="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path>
        </svg>
      </div>

      <!-- Result headline -->
      <h3 class="text-2xl font-bold text-gray-900 mb-2">
        ${_e(config.success_title || 'בשורות מצוינות!')}
      </h3>
      <p class="text-gray-500 mb-6 text-sm">
        ${_e(config.success_subtitle || 'על פי הנתונים שהזנת, סביר שמגיע לך:')}
      </p>

      <!-- Big amount display -->
      <div class="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-400 rounded-2xl p-6 mb-6 inline-block w-full">
        <p class="text-sm text-gray-500 mb-1">סכום משוער:</p>
        <p class="text-4xl font-bold text-green-700 mb-1">${range}</p>
        <p class="text-xs text-gray-400">הסכום המדויק ייקבע לאחר בדיקה מקצועית</p>
      </div>

      <!-- Social proof -->
      <p class="text-sm text-gray-500 mb-6">
        🏆 מעל 14,000 ישראלים כבר קיבלו את הכסף שלהם
      </p>

      <!-- CTA to lead form -->
      <button id="proceed-to-lead-btn"
              class="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-4 px-8 rounded-xl text-xl transition-colors shadow-lg hover:shadow-xl transform hover:-translate-y-0.5">
        ← שלחו לי את הפרטים המלאים
      </button>

      <p class="text-xs text-gray-400 mt-3">
        ✓ ללא עלות ✓ ללא התחייבות ✓ נציג יחזור תוך 24 שעות
      </p>

    </div>
  `;

  document.getElementById('proceed-to-lead-btn')?.addEventListener('click', proceedToLeadForm);
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
    <!-- Progress bar (almost complete) -->
    <div class="w-full bg-gray-200 h-2 rounded-full mb-6">
      <div class="bg-red-600 h-2 rounded-full" style="width: 95%"></div>
    </div>

    <div class="text-center mb-6">
      <h3 class="text-2xl font-bold text-gray-900 mb-1">לאיזה מספר לשלוח את הפרטים?</h3>
      <p class="text-gray-500 text-sm">המומחה שלנו יחזור אליך תוך 24 שעות</p>
    </div>

    <div class="space-y-4">
      <!-- Phone FIRST -->
      <div>
        <label class="block text-sm font-bold text-gray-700 mb-1">טלפון נייד *</label>
        <input 
          type="tel" 
          id="lead-phone"
          placeholder="050-0000000"
          dir="ltr"
          class="w-full border-2 border-gray-300 rounded-xl px-4 py-3 text-lg focus:border-red-500 focus:outline-none transition-colors"
          required>
      </div>
      
      <div>
        <label class="block text-sm font-bold text-gray-700 mb-1">שם מלא *</label>
        <input 
          type="text" 
          id="lead-name"
          placeholder="ישראל ישראלי"
          class="w-full border-2 border-gray-300 rounded-xl px-4 py-3 text-lg focus:border-red-500 focus:outline-none transition-colors"
          required>
      </div>

      <div>
        <label class="block text-sm font-bold text-gray-700 mb-1">דוא"ל <span class="text-gray-400 font-normal">(אופציונלי)</span></label>
        <input 
          type="email" 
          id="lead-email"
          placeholder="israel@gmail.com"
          dir="ltr"
          class="w-full border-2 border-gray-300 rounded-xl px-4 py-3 text-lg focus:border-red-500 focus:outline-none transition-colors">
      </div>

      <!-- HONEYPOT: hidden field, bots auto-fill it, humans never see it -->
      <div style="position:absolute;left:-9999px;" aria-hidden="true">
        <input type="text" id="lead-company" name="company" tabindex="-1" autocomplete="off">
      </div>

      <div id="lead-error" class="text-red-600 text-sm hidden"></div>

      <button 
        id="submit-btn"
        class="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-4 px-8 rounded-xl text-xl transition-colors shadow-lg">
        ← קבל את ההחזר שלך
      </button>

      <p class="text-xs text-gray-400 text-center">
        ✓ המידע מאובטח ✓ ללא דואר זבל ✓ ניתן לביטול בכל עת
      </p>
    </div>
  `;

  // Attach submit handler via addEventListener
  document.getElementById('submit-btn')?.addEventListener('click', submitLead);
}

// ============================================================
// RENDER SUCCESS SCREEN
// ============================================================
function renderSuccessScreen() {
  const content = document.getElementById('quiz-modal-content');
  if (!content) return;

  const config = currentConfig || DEFAULT_CONFIG;

  content.innerHTML = `
    <div class="text-center py-4">
      <!-- Success icon -->
      <div class="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
        <svg class="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
        </svg>
      </div>

      <h3 class="text-3xl font-bold text-gray-900 mb-3">${_e(config.success_title)}</h3>
      <p class="text-gray-600 mb-4">${_e(config.success_subtitle || 'נציג שלנו יצור איתך קשר בהקדם')}</p>
      
      ${config.success_range ? `
        <div class="bg-green-50 border-2 border-green-400 rounded-xl p-4 mb-6 inline-block">
          <p class="text-sm text-gray-600">סכום משוער:</p>
          <p class="text-3xl font-bold text-green-700">${_e(config.success_range)}</p>
        </div>
      ` : ''}

      <p class="text-gray-500 mb-6">נציג מומחה יחזור אליך תוך 24 שעות לתיאום הטיפול</p>

      <button id="close-success-btn"
              class="bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3 px-8 rounded-xl transition-colors">
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
    errorEl.textContent = 'נא להזין מספר טלפון תקין';
    errorEl.classList.remove('hidden');
    return;
  }
  if (!name) {
    errorEl.textContent = 'נא להזין שם מלא';
    errorEl.classList.remove('hidden');
    return;
  }
  errorEl.classList.add('hidden');

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
