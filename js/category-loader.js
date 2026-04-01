// category-loader.js - Dynamic category page loading for Calcala-News
console.log('Category JS: Initializing...');

// Shortcut for escapeHtml
const _esc = (s) => window.CalcalaSanitize ? window.CalcalaSanitize.escapeHtml(s) : String(s || '');
const _url = (s) => window.CalcalaSanitize ? window.CalcalaSanitize.sanitizeUrl(s) : String(s || '');

// Supabase configuration
const CATEGORY_SUPABASE_URL = 'https://gtuxstslzsiuinxjvfdj.supabase.co';
const CATEGORY_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0dXhzdHNsenNpdWlueGp2ZmRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyMTU2NjIsImV4cCI6MjA4Njc5MTY2Mn0.ZYbL9PVGUdehVEtg18bi-Uyw-iy857KVM7Yceh7NMaM';

let supabaseCat = null;
let currentCategory = null;
let currentArticles = [];

// Initialize Supabase client safely
function initSupabase() {
    if (window.supabase) {
        supabaseCat = window.supabase.createClient(CATEGORY_SUPABASE_URL, CATEGORY_SUPABASE_KEY);
        return true;
    }
    return false;
}

// Hebrew date formatter
function formatHebrewDate(dateString) {
    if (!dateString) return 'לפני זמן קצר';

    const now = new Date();
    const date = new Date(dateString);
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'עכשיו';
    if (diffMins < 60) return `לפני ${diffMins} דק'`;
    if (diffHours < 24) return `לפני ${diffHours} שעות`;
    if (diffDays === 1) return 'אתמול';
    if (diffDays < 7) return `לפני ${diffDays} ימים`;

    return date.toLocaleDateString('he-IL', { day: 'numeric', month: 'short', year: 'numeric' });
}

async function loadCategoryData() {
    try {
        if (!supabaseCat) return;

        // 1. Get slug from URL
        const urlParams = new URLSearchParams(window.location.search);
        const slug = urlParams.get('slug');

        if (!slug) {
            window.location.href = '/';
            return;
        }

        // Highlight active nav item
        document.querySelectorAll(`[data-category-slug="${slug}"]`).forEach(el => {
            el.classList.remove('text-text-main', 'border-transparent', 'hover:border-accent/50', 'hover:text-primary');
            el.classList.add('font-bold', 'text-primary', 'border-primary', 'bg-slate-50');
        });

        // 2. Fetch category details
        const { data: categoryData, error: catError } = await supabaseCat
            .from('categories')
            .select('*')
            .eq('slug', slug)
            .single();

        if (catError || !categoryData) {
            console.error('Category not found:', catError);
            document.getElementById('category-title').textContent = 'קטגוריה לא נמצאה';
            document.getElementById('breadcrumb-name').textContent = 'שגיאה';
            document.getElementById('category-skeleton').classList.add('hidden');
            return;
        }

        currentCategory = categoryData;
        document.title = `כלכלה-ניוז: ${categoryData.name} - חדשות, השקעות ומגמות`;
        document.getElementById('meta-description').content = `כל הכתבות והעדכונים בנושא ${categoryData.name} מבית כלכלה-ניוז.`;

        document.getElementById('category-title').textContent = categoryData.name;
        document.getElementById('breadcrumb-name').textContent = categoryData.name;

        const mostReadTitle = document.getElementById('most-read-title');
        if (mostReadTitle) {
            mostReadTitle.textContent = `הנקראים ביותר ב${categoryData.name}`;
        }


        // 3. Fetch articles for this category
        const { data: articlesData, error: artError } = await supabaseCat
            .from('articles')
            .select('*')
            .eq('status', 'published')
            .eq('category_id', categoryData.id)
            .order('publish_date', { ascending: false });

        if (artError) {
            console.error('Error fetching articles:', artError);
            throw artError;
        }

        currentArticles = articlesData || [];
        document.getElementById('category-article-count').textContent = `${currentArticles.length.toLocaleString('en-US')} כתבות`;

        // 4. Render Articles
        renderArticles();

        // 5. Fetch and Render Quiz Sidebar CTA
        loadCategoryQuizCta(slug);

        // 6. Fetch Most Read for Widget
        renderCategoryMostRead();

    } catch (error) {
        console.error('Fatal error loading category page:', error);
    }
}

function renderArticles() {
    const skeleton = document.getElementById('category-skeleton');
    const articlesList = document.getElementById('category-articles-list');
    const emptyState = document.getElementById('category-empty-state');
    const leadContainer = document.getElementById('category-lead-article');

    if (skeleton) skeleton.classList.add('hidden');

    if (!currentArticles || currentArticles.length === 0) {
        if (emptyState) emptyState.classList.remove('hidden');
        return;
    }

    if (articlesList) articlesList.classList.remove('hidden');

    // Render lead article (first one)
    const leadArticle = currentArticles[0];
    if (leadContainer && leadArticle) {
        leadContainer.innerHTML = createLeadArticleHTML(leadArticle);
    }

    // Render rest of articles
    if (currentArticles.length > 1) {
        const restArticles = currentArticles.slice(1);
        const listHTML = restArticles.map(article => createListArticleHTML(article)).join('');
        articlesList.innerHTML = listHTML;
    }
}

function createLeadArticleHTML(article) {
    const slug = encodeURIComponent(article.slug);
    const imgUrl = _esc(article.featured_image_url || 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800');
    const title = _esc(article.title);
    const dateStr = formatHebrewDate(article.publish_date);
    const authorName = _esc(article.author || 'מערכת כלכלה-ניוז');

    return `
    <article class="flex gap-4 group cursor-pointer border-b border-border-color pb-6 mb-6" onclick="window.location.href='/article.html?slug=${slug}'">
        <div class="w-[200px] sm:w-[320px] aspect-[16/10] rounded-sm overflow-hidden relative bg-slate-100 shrink-0 border border-slate-200">
            <img class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" src="${imgUrl}" alt="${title}"/>
        </div>
        <div class="flex-1 flex flex-col justify-center gap-1">
            <h2 class="font-heading font-extrabold text-xl md:text-2xl leading-tight text-primary group-hover:text-accent transition-colors">
                ${title}
            </h2>
            <div class="flex items-center gap-3 text-text-muted text-xs font-medium">
                <span class="font-mono">${dateStr}</span>
                <span>•</span>
                <span>${authorName}</span>
            </div>
        </div>
    </article>
    `;
}

function createListArticleHTML(article) {
    const slug = encodeURIComponent(article.slug);
    const imgUrl = _esc(article.featured_image_url || 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=400');
    const title = _esc(article.title);
    const dateStr = formatHebrewDate(article.publish_date);
    const authorName = _esc(article.author || 'מערכת כלכלה-ניוז');

    return `
    <article class="flex gap-4 group cursor-pointer border-b border-border-color pb-4 mb-4" onclick="window.location.href='/article.html?slug=${slug}'">
        <div class="w-[140px] sm:w-[200px] aspect-[16/10] rounded-sm overflow-hidden relative bg-slate-100 shrink-0 border border-slate-100">
            <img class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" src="${imgUrl}" alt="${title}"/>
        </div>
        <div class="flex-1 flex flex-col justify-center gap-1">
            <h3 class="font-heading font-bold text-base md:text-lg leading-snug text-primary group-hover:text-accent transition-colors">
                ${title}
            </h3>
            <div class="flex items-center gap-2 text-text-muted text-[11px]">
                <span class="font-mono">${dateStr}</span>
                <span>•</span>
                <span>${authorName}</span>
            </div>
        </div>
    </article>
    `;
}

async function renderCategoryMostRead() {
    try {
        if (!currentCategory || !supabaseCat) return;

        // Try getting curated first
        const { data: curatedData } = await supabaseCat
            .from('curated_widgets')
            .select('articles(id, slug, title, publish_date, view_count)')
            .eq('widget_type', 'most_read')
            .order('display_order', { ascending: true });

        let articles = [];

        // Filter curated data to match current category
        if (curatedData && curatedData.length > 0) {
            articles = curatedData
                .map(item => item.articles)
                .filter(a => a && a.category_id === currentCategory.id)
                .slice(0, 5);
        }

        // If not enough curated, fill with organic most viewed
        if (articles.length < 5) {
            const { data: viewedData } = await supabaseCat
                .from('articles')
                .select('id, slug, title, publish_date, view_count')
                .eq('status', 'published')
                .eq('category_id', currentCategory.id)
                .order('view_count', { ascending: false })
                .limit(5);

            if (viewedData) {
                // Avoid duplicates
                const existingIds = new Set(articles.map(a => a.id));
                for (const article of viewedData) {
                    if (!existingIds.has(article.id) && articles.length < 5) {
                        articles.push(article);
                    }
                }
            }
        }

        const widgetContainer = document.getElementById('most-read-widget');
        if (!widgetContainer) return;

        widgetContainer.innerHTML = '';

        if (!articles || articles.length === 0) {
            widgetContainer.innerHTML = '<p class="text-xs text-gray-400 text-center py-4">אין נתונים מספיקים לשבוע זה</p>';
            return;
        }

        articles.forEach((article, index) => {
            const itemEl = document.createElement('a');
            itemEl.href = `/article.html?slug=${encodeURIComponent(article.slug)}`;
            itemEl.className = 'flex gap-3 items-start p-4 border-b border-slate-100 group hover:bg-slate-50 transition-colors';
            itemEl.innerHTML = `
                <span class="text-2xl font-heading font-bold text-accent/20 group-hover:text-accent transition-colors leading-none -mt-1">${index + 1}</span>
                <div class="flex flex-col">
                    <h4 class="text-sm font-bold text-primary group-hover:text-accent transition-colors leading-snug mb-1">${_esc(article.title)}</h4>
                    <span class="text-[10px] text-text-muted">${(article.view_count || 0).toLocaleString()} צפיות</span>
                </div>
            `;
            widgetContainer.appendChild(itemEl);
        });

    } catch (error) {
        console.error('Error loading category most read:', error);
    }
}

async function loadCategoryQuizCta(categorySlug) {
    const sidebarCta = document.getElementById('sidebar-quiz-cta');
    if (!sidebarCta || !supabaseCat) return;

    try {
        const { data: config } = await supabaseCat
            .from('quiz_configs')
            .select('*')
            .eq('category_slug', categorySlug)
            .eq('is_active', true)
            .single();

        if (config) {
            const title = _esc(config.display_name || config.entry_hook_title || 'בדוק זכאות');
            const subtitle = _esc(config.entry_hook_subtitle || 'בדוק כמה מגיע לך');
            const quizId = config.id;

            sidebarCta.innerHTML = `
                <div class="flex items-center justify-center gap-2 mb-3 mt-4">
                    <span class="bg-red-100 text-red-600 text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse">הזדמנות אחרונה</span>
                </div>
                <div class="bg-white border border-slate-200 rounded-full size-14 flex items-center justify-center mx-auto mb-3 shadow-sm text-accent group-hover:scale-110 transition-transform duration-300">
                    <span class="material-symbols-outlined text-[28px]">currency_exchange</span>
                </div>
                <h3 class="font-heading font-extrabold text-2xl text-primary mb-1 leading-tight text-center">💰 ${title}</h3>
                <p class="text-text-main text-sm mb-4 font-medium leading-snug text-center px-4">
                    ${subtitle}
                </p>
                <div class="p-5 pt-0">
                    ${config.button_a_label && config.button_b_label ? `
                        <div class="grid grid-cols-2 gap-3 mb-4">
                            <button onclick="parent.openQuizModal('${categorySlug}', '${config.button_a_value}', null, '${quizId}')"
                                    class="bg-gray-900 hover:bg-gray-800 text-white font-bold py-3 px-3 rounded-lg text-base transition-all">
                                ${_esc(config.button_a_label)}
                            </button>
                            <button onclick="parent.openQuizModal('${categorySlug}', '${config.button_b_value}', null, '${quizId}')"
                                    class="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-3 rounded-lg text-base transition-all">
                                ${_esc(config.button_b_label)}
                            </button>
                        </div>
                    ` : `
                        <button onclick="parent.openQuizModal('${categorySlug}', null, null, '${quizId}')"
                                class="w-full bg-gradient-to-l from-accent to-accent-secondary hover:from-orange-600 hover:to-pink-600 text-white font-bold py-3 px-4 rounded-lg text-lg transition-colors shadow-md">
                            בדוק זכאות עכשיו <span class="material-symbols-outlined text-[14px] rotate-180 inline-block align-middle">arrow_forward</span>
                        </button>
                    `}
                    <p class="text-[11px] text-gray-400 text-center mt-3 font-bold">✓ תוצאה מיידית ✓ בדיקה חינם ללא התחייבות</p>
                </div>
            `;
            sidebarCta.classList.remove('hidden');
        } else {
            sidebarCta.classList.add('hidden');
        }
    } catch (e) {
        console.error('Error fetching generic quiz config for category', e);
        sidebarCta.classList.add('hidden');
    }
}

// Start when DOM is ready
function startLoading() {
    if (initSupabase()) {
        loadCategoryData();
    } else {
        let attempts = 0;
        const interval = setInterval(() => {
            attempts++;
            if (initSupabase()) {
                clearInterval(interval);
                loadCategoryData();
            } else if (attempts > 50) {
                clearInterval(interval);
                console.error('Failed to load Supabase library after 5 seconds');
            }
        }, 100);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startLoading);
} else {
    startLoading();
}
