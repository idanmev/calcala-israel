const fs = require('fs');
const path = require('path');

const SUPABASE_API = 'https://gtuxstslzsiuinxjvfdj.supabase.co/rest/v1';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0dXhzdHNsenNpdWlueGp2ZmRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyMTU2NjIsImV4cCI6MjA4Njc5MTY2Mn0.ZYbL9PVGUdehVEtg18bi-Uyw-iy857KVM7Yceh7NMaM';
const SUPABASE_STORAGE_BASE = 'https://gtuxstslzsiuinxjvfdj.supabase.co/storage/v1/object/public/';
const IMAGEKIT_ENDPOINT = 'https://ik.imagekit.io/7slg7dpqm/calcala/';

function getOptimizedUrl(url, w) {
    if (!url) return `https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=${w}`;
    const trString = `tr:w-${w},f-auto,q-90`;
    if (url.startsWith(SUPABASE_STORAGE_BASE)) {
        const relativePath = url.slice(SUPABASE_STORAGE_BASE.length);
        return IMAGEKIT_ENDPOINT + `${trString}/${relativePath}`;
    }
    return url;
}

function esc(str) {
    if (!str) return '';
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function formatHebrewDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' });
}

async function build() {
    console.log('[SSG] Starting Static Site Generation for index.html...');
    
    // Fetch Hero
    const heroRes = await fetch(`${SUPABASE_API}/articles?select=*,categories%28name,slug%29&status=eq.published&is_featured=eq.true&order=publish_date.desc&limit=1`, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    });
    const heroData = await heroRes.json();
    let heroArticle = heroData[0];

    // Fallback if no hero
    if (!heroArticle) {
        const latestRes = await fetch(`${SUPABASE_API}/articles?select=*,categories%28name,slug%29&status=eq.published&order=publish_date.desc&limit=1`, {
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
        });
        const latestData = await latestRes.json();
        heroArticle = latestData[0];
    }

    // Fetch Grid
    const gridRes = await fetch(`${SUPABASE_API}/articles?select=*,categories%28name,slug%29&status=eq.published&order=publish_date.desc&limit=13`, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    });
    let gridData = await gridRes.json();

    // Filter out the hero from the grid
    if (heroArticle) {
         gridData = gridData.filter(a => a.id !== heroArticle.id).slice(0, 12);
    } else {
         gridData = gridData.slice(0, 12);
    }

    // Generate Hero HTML
    let heroHtml = '';
    if (heroArticle) {
        const title = esc(heroArticle.title);
        const subtitle = heroArticle.subtitle ? `<p class="text-lg text-gray-200">${esc(heroArticle.subtitle)}</p>` : '';
        const catName = esc(heroArticle.categories?.name || 'כללי');
        const dateStr = formatHebrewDate(heroArticle.publish_date);
        const slug = encodeURIComponent(heroArticle.slug);
        
        // Responsive Image srcset
        const img400 = getOptimizedUrl(heroArticle.featured_image_url, 400);
        const img800 = getOptimizedUrl(heroArticle.featured_image_url, 800);
        const img1200 = getOptimizedUrl(heroArticle.featured_image_url, 1200);
        const img1600 = getOptimizedUrl(heroArticle.featured_image_url, 1600);

        heroHtml = `
      <a href="/article/${slug}" id="hero-article" data-id="${heroArticle.id}" class="lg:col-span-8 block relative h-full min-h-[384px] bg-slate-900 rounded-sm overflow-hidden group" style="cursor: pointer;">
        <picture>
            <source media="(max-width: 640px)" srcset="${img400} 400w, ${img800} 800w, ${img1200} 1200w" sizes="100vw">
            <source media="(max-width: 1024px)" srcset="${img1200} 1200w, ${img1600} 1600w" sizes="100vw">
            <img src="${img1200}" alt="${title}" class="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" width="1200" height="675" fetchpriority="high" />
        </picture>
        <div class="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent"></div>
        <div class="absolute bottom-0 right-0 p-8 text-white z-10 w-full">
          <div class="flex items-center gap-4 mb-3">
            <span class="bg-red-600 px-3 py-1 text-sm font-bold rounded-sm shadow-md">${catName}</span>
            <span class="text-sm text-gray-300 font-medium">${dateStr}</span>
          </div>
          <h1 class="text-3xl md:text-4xl font-bold mb-3 leading-tight text-white drop-shadow-md transition-colors">${title}</h1>
          ${subtitle}
        </div>
      </a>
        `;
    }

    // Generate Grid HTML
    let gridHtml = '';
    if (gridData.length > 0) {
        gridHtml = gridData.map(article => {
            const img400 = getOptimizedUrl(article.featured_image_url, 400);
            const img600 = getOptimizedUrl(article.featured_image_url, 600);
            const img800 = getOptimizedUrl(article.featured_image_url, 800);
            const img1200 = getOptimizedUrl(article.featured_image_url, 1200);
            return `
        <a href="/article/${encodeURIComponent(article.slug)}" class="bg-white border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow cursor-pointer block group rounded-lg">
          <picture>
            <source media="(max-width: 640px)" srcset="${img400} 400w, ${img800} 800w, ${img1200} 1200w" sizes="100vw">
            <img src="${img600}" 
                 srcset="${img600} 600w, ${img800} 800w, ${img1200} 1200w" sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                 alt="${esc(article.title)}" 
                 class="w-full h-48 object-cover transition-transform duration-300 group-hover:scale-105"
                 width="600" height="192"
                 loading="lazy">
          </picture>
          <div class="p-5">
            <div class="flex items-center gap-3 mb-2 text-sm relative z-10">
              <span class="text-red-600 font-bold bg-red-50 px-2 py-0.5 rounded">${esc(article.categories?.name || 'כללי')}</span>
              <span class="text-gray-500 font-medium">${formatHebrewDate(article.publish_date)}</span>
            </div>
            <h3 class="text-xl font-bold mb-2 group-hover:text-red-600 transition-colors line-clamp-2 leading-tight">${esc(article.title)}</h3>
            ${article.subtitle ? `<p class="text-gray-600 text-sm line-clamp-2">${esc(article.subtitle)}</p>` : ''}
          </div>
        </a>
            `;
        }).join('');
    }

    const indexPath = path.join(__dirname, '../index.html');
    let indexHtml = fs.readFileSync(indexPath, 'utf8');

    // Remove inline fetch script if present
    indexHtml = indexHtml.replace(/<script>\s*window\.__HERO_FETCH__[\s\S]*?<\/script>/, '');

    // Inject PRELOAD data flag so JS knows not to re-render
    if (!indexHtml.includes('window.__PRELOADED_ARTICLES__ = true;')) {
        const preloadedScript = `
    <!-- SSG Preload Flag -->
    <script>
        window.__PRELOADED_ARTICLES__ = true;
    </script>
    `;
        if (indexHtml.includes('<!-- LCP Pre-fetch for Hero Article -->')) {
            indexHtml = indexHtml.replace('<!-- LCP Pre-fetch for Hero Article -->', preloadedScript);
        } else {
            // Fallback injection after <head>
            indexHtml = indexHtml.replace('<head>', '<head>\n' + preloadedScript);
        }
    }

    // Inject Hero Container (Replacing entire `<a id="hero-article">...</a>`)
    indexHtml = indexHtml.replace(
        /<a[^>]*id="hero-article"[^>]*>[\s\S]*?<\/a>/,
        heroHtml.trim()
    );

    // Inject Grid Container (Replacing entire `<div id="articles-grid">...</div>`)
    indexHtml = indexHtml.replace(
        /<div id="articles-grid"[^>]*>[\s\S]*?<\/div>\s*<!-- ===== COMMENTARY/m,
        `<div id="articles-grid" class="col-span-12 lg:col-span-9">\n<h2 class="text-2xl font-bold mb-6 border-b-2 border-red-600 pb-2 flex items-center">חדשות השוק</h2>\n<div class="grid md:grid-cols-2 lg:grid-cols-3 gap-6">\n${gridHtml}\n</div>\n</div>\n        <!-- ===== COMMENTARY`
    );

    fs.writeFileSync(indexPath, indexHtml);
    console.log('[SSG] Successfully pre-rendered index.html');
}

build().catch(err => {
    console.error('[SSG] Error during build:', err);
    process.exit(1);
});
