// articles.js - Dynamic article loading for Calcala-News
console.log('Articles JS: Initializing...');

// Shortcut for escapeHtml
const _esc = (s) => window.CalcalaSanitize ? window.CalcalaSanitize.escapeHtml(s) : String(s || '');
const _url = (s) => window.CalcalaSanitize ? window.CalcalaSanitize.sanitizeUrl(s) : String(s || '');

// Supabase configuration
const ARTICLES_SUPABASE_URL = 'https://gtuxstslzsiuinxjvfdj.supabase.co';
const ARTICLES_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0dXhzdHNsenNpdWlueGp2ZmRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyMTU2NjIsImV4cCI6MjA4Njc5MTY2Mn0.ZYbL9PVGUdehVEtg18bi-Uyw-iy857KVM7Yceh7NMaM';

let supabaseArticles = null;

// Initialize Supabase client safely
function initSupabase() {
    if (window.supabase) {
        supabaseArticles = window.supabase.createClient(ARTICLES_SUPABASE_URL, ARTICLES_SUPABASE_KEY);
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

// Render hero article
async function renderHeroArticle() {
    if (window.__PRELOADED_ARTICLES__) {
        console.log('Articles JS: SSG preloaded, skipping hero render');
        return;
    }
    console.log('Articles JS: Rendering hero article...');
    try {
        let heroData = null;

        // Fast-path: use LCP pre-fetch if available
        if (window.__HERO_FETCH__) {
            console.log('Articles JS: Using LCP pre-fetch data');
            try {
                const prefetchResult = await window.__HERO_FETCH__;
                if (prefetchResult && prefetchResult.length > 0) {
                    heroData = prefetchResult;
                }
                // Clear so we don't accidentally reuse it later if re-rendering
                window.__HERO_FETCH__ = null;
            } catch (err) {
                console.warn('Hero prefetch failed, falling back to Supabase SDK', err);
            }
        }

        // Fallback: fetch via Supabase SDK if pre-fetch wasn't available or failed
        if (!heroData) {
            if (!supabaseArticles) return;
            const { data, error } = await supabaseArticles
                .from('articles')
                .select('*, categories(name, slug)')
                .eq('status', 'published')
                .eq('is_featured', true)
                .order('publish_date', { ascending: false })
                .limit(1);

            if (error) throw error;
            heroData = data;
        }

        const article = heroData && heroData.length > 0 ? heroData[0] : null;
        const heroContainer = document.getElementById('hero-article');
        if (!heroContainer) return;

        if (!article) {
            console.warn('No featured article found, trying to use latest published article');
            // Fallback: use latest published article if no featured article exists
            const { data: latestData, error: latestError } = await supabaseArticles
                .from('articles')
                .select('*, categories(name, slug)')
                .eq('status', 'published')
                .order('publish_date', { ascending: false })
                .limit(1);

            if (latestError || !latestData || latestData.length === 0) {
                heroContainer.innerHTML = `
                    <div class="relative h-full min-h-[384px] bg-gray-900 flex items-center justify-center">
                        <p class="text-gray-600">טרם פורסמו מאמרים</p>
                    </div>
                `;
                return;
            }
            // Use latest as hero
            const latestArticle = latestData[0];
            updateHeroUI(heroContainer, latestArticle);
        } else {
            updateHeroUI(heroContainer, article);
        }

    } catch (error) {
        console.error('Error loading hero article:', error);
    }
}

function updateHeroUI(container, article) {
    const rawImgUrl = article.featured_image_url || '/images/placeholder.jpg';
    const imgUrl = _esc(
        window.getOptimizedImageUrl
            ? window.getOptimizedImageUrl(rawImgUrl, { w: 1200, f: 'auto' })
            : rawImgUrl
    );
    const catName = _esc(article.categories?.name || 'כללי');
    const dateStr = formatHebrewDate(article.publish_date);
    const title = _esc(article.title);
    const subtitle = article.subtitle ? `<p class="text-lg text-gray-200">${_esc(article.subtitle)}</p>` : '';
    const slug = encodeURIComponent(article.slug);

    container.innerHTML = `
      <div class="relative h-full min-h-[384px] overflow-hidden">
        <img src="${imgUrl}" alt="${title}" class="absolute inset-0 w-full h-full object-cover" width="1200" height="675" fetchpriority="high" />
        <div class="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent"></div>
        <div class="absolute bottom-0 right-0 p-8 text-white">
          <div class="flex items-center gap-4 mb-3">
            <span class="bg-red-600 px-3 py-1 text-sm font-bold">${catName}</span>
            <span class="text-sm text-gray-300">${dateStr}</span>
          </div>
          <h1 class="text-xl md:text-2xl lg:text-3xl font-bold mb-3 leading-snug text-white">${title}</h1>
          ${subtitle}
        </div>
      </div>
    `;
    container.style.cursor = 'pointer';
    container.onclick = () => window.location.href = `/article/${slug}`;
}

// Render grid articles
async function renderGridArticles() {
    if (window.__PRELOADED_ARTICLES__) {
        console.log('Articles JS: SSG preloaded, skipping grid render');
        return;
    }
    try {
        const { data, error } = await supabaseArticles
            .from('articles')
            .select('*, categories(name, slug)')
            .eq('status', 'published')
            .order('publish_date', { ascending: false })
            .limit(12);

        if (error) {
            console.error('Grid articles error:', error);
            return;
        }

        if (!data || data.length === 0) {
            console.warn('No published articles found');
            return;
        }

        const gridContainer = document.getElementById('articles-grid');
        if (!gridContainer) {
            console.warn('articles-grid container not found');
            return;
        }

        console.log('Rendering', data.length, 'articles to grid');

        // Filter out featured articles
        const articlesToShow = data.filter(a => !a.is_featured);

        // Keep the heading if it exists, replace everything else
        const heading = gridContainer.querySelector('h2');

        // Clear the container
        gridContainer.innerHTML = '';

        // Re-add heading
        if (heading) {
            gridContainer.appendChild(heading);
        } else {
            const h2 = document.createElement('h2');
            h2.className = 'text-2xl font-bold mb-6 border-b-2 border-red-600 pb-2';
            h2.textContent = 'חדשות השוק';
            gridContainer.appendChild(h2);
        }

        // Create grid wrapper
        const gridWrapper = document.createElement('div');
        gridWrapper.className = 'grid md:grid-cols-2 gap-6';
        gridContainer.appendChild(gridWrapper);

        // Render each article
        const _img = (url, w) => window.getOptimizedImageUrl
            ? window.getOptimizedImageUrl(url || 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800', { w, f: 'auto' })
            : (url || `https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=${w}`);

        articlesToShow.forEach(article => {
            const articleEl = document.createElement('article');
            articleEl.className = 'bg-white border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow cursor-pointer rounded-lg';
            
            const img400 = _img(article.featured_image_url, 400);
            const img600 = _img(article.featured_image_url, 600);
            const img800 = _img(article.featured_image_url, 800);
            const img1200 = _img(article.featured_image_url, 1200);

            articleEl.innerHTML = `
        <a href="/article/${encodeURIComponent(article.slug)}" class="block">
          <picture>
            <source media="(max-width: 640px)" srcset="${_esc(img400)} 400w, ${_esc(img800)} 800w, ${_esc(img1200)} 1200w" sizes="100vw">
            <img src="${_esc(img600)}" 
                 srcset="${_esc(img600)} 600w, ${_esc(img800)} 800w, ${_esc(img1200)} 1200w" sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                 alt="${_esc(article.title)}" 
                 class="w-full h-48 object-cover transition-transform duration-300 group-hover:scale-105"
                 width="600" height="192"
                 loading="lazy">
          </picture>
          <div class="p-5">
            <div class="flex items-center gap-3 mb-2 text-sm">
              <span class="text-red-600 font-bold">${_esc(article.categories?.name || 'כללי')}</span>
              <span class="text-gray-600">${formatHebrewDate(article.publish_date)}</span>
            </div>
            <h3 class="text-lg font-bold mb-2 hover:text-red-600 transition-colors leading-snug">${_esc(article.title)}</h3>
            ${article.subtitle ? `<p class="text-gray-600 text-sm line-clamp-2">${_esc(article.subtitle)}</p>` : ''}
          </div>
        </a>
      `;
            gridWrapper.appendChild(articleEl);
        });

    } catch (error) {
        console.error('Error in renderGridArticles:', error);
    }
}

// Render Most Read widget
async function renderMostReadWidget() {
    console.log('Articles JS: Rendering most read widget...');
    try {
        if (!supabaseArticles) return;

        // Try to fetch curated articles first
        const { data: curatedData } = await supabaseArticles
            .from('curated_widgets')
            .select('articles(id, slug, title, publish_date)')
            .eq('widget_type', 'most_read')
            .order('display_order', { ascending: true })
            .limit(5);

        let articles = [];

        if (curatedData && curatedData.length > 0) {
            articles = curatedData.map(item => item.articles).filter(Boolean);
        } else {
            // Fallback: Most viewed articles
            const { data: viewedData } = await supabaseArticles
                .from('articles')
                .select('id, slug, title, publish_date, view_count')
                .eq('status', 'published')
                .order('view_count', { ascending: false })
                .limit(5);

            if (viewedData) articles = viewedData;
        }

        const widgetContainer = document.getElementById('most-read-widget');
        if (!widgetContainer) return;

        // Clean up loading indicators
        const loadingIndicators = widgetContainer.querySelectorAll('.animate-pulse, p.text-center');
        loadingIndicators.forEach(el => el.remove());

        let listContainer = widgetContainer.querySelector('.flex.flex-col, .space-y-4');
        if (!listContainer) {
            listContainer = document.createElement('div');
            listContainer.className = 'flex flex-col gap-4';
            widgetContainer.appendChild(listContainer);
        }

        // Clear
        listContainer.innerHTML = '';

        if (!articles || articles.length === 0) {
            listContainer.innerHTML = '<p class="text-xs text-gray-600 text-center py-4">אין נתונים עדיין</p>';
            return;
        }

        // Render each article
        articles.forEach((article, index) => {
            const itemEl = document.createElement('a');
            itemEl.href = `/article/${article.slug}`;
            itemEl.className = 'flex items-start gap-4 hover:bg-gray-50 p-2 transition-colors group';
            itemEl.innerHTML = `
        <span class="text-3xl font-bold text-gray-200 leading-none group-hover:text-red-100 transition-colors">${index + 1}</span>
        <div class="flex-1">
          <h4 class="text-sm font-bold leading-tight group-hover:text-red-600 transition-colors line-clamp-2">
            ${_esc(article.title)}
          </h4>
          <span class="text-xs text-gray-600 mt-1 block">${formatHebrewDate(article.publish_date)}</span>
        </div>
      `;
            listContainer.appendChild(itemEl);
        });

    } catch (error) {
        console.error('Error loading most read widget:', error);
    }
}

// Initialize on page load
function startLoading() {
    if (initSupabase()) {
        renderHeroArticle();
        renderGridArticles();
        renderMostReadWidget();
    } else {
        // Retry if Supabase library is still loading
        let attempts = 0;
        const interval = setInterval(() => {
            attempts++;
            if (initSupabase()) {
                clearInterval(interval);
                renderHeroArticle();
                renderGridArticles();
                renderMostReadWidget();
            } else if (attempts > 50) { // Give up after 5 seconds
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

