// article-loader.js - Complete dynamic article loader for Calcala-News

// Unique variable names to avoid conflicts with other scripts
const ART_SUPABASE_URL = 'https://gtuxstslzsiuinxjvfdj.supabase.co';
const ART_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0dXhzdHNsenNpdWlueGp2ZmRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyMTU2NjIsImV4cCI6MjA4Njc5MTY2Mn0.ZYbL9PVGUdehVEtg18bi-Uyw-iy857KVM7Yceh7NMaM';
let supabaseArt = null;

// Initialize Supabase client safely (may load async)
function initSupabaseArt() {
    if (supabaseArt) return true;
    if (window.supabase) {
        supabaseArt = window.supabase.createClient(ART_SUPABASE_URL, ART_SUPABASE_KEY);
        return true;
    }
    return false;
}

// Shortcut for escapeHtml
const _h = (s) => window.CalcalaSanitize ? window.CalcalaSanitize.escapeHtml(s) : String(s || '');

// Expose current article category for quiz modal
window.currentArticleCategory = null;

// Get slug from URL
function getSlug() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('slug')) return params.get('slug');
    
    const pathParts = window.location.pathname.split('/').filter(Boolean);
    if (pathParts.length >= 2 && pathParts[0] === 'article') {
        return decodeURIComponent(pathParts[pathParts.length - 1]);
    }
    return null;
}

// Format Hebrew date
function formatDateHebrew(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' });
}

// Estimate read time
function estimateReadTime(text) {
    const words = text ? text.replace(/<[^>]*>/g, '').split(/\s+/).length : 0;
    const minutes = Math.ceil(words / 200);
    return `${minutes} דקות קריאה`;
}

// Update reading progress bar (GPU-composited via transform:scaleX)
function initReadingProgress() {
    const progressBar = document.getElementById('reading-progress');
    if (!progressBar) return;

    let ticking = false;
    window.addEventListener('scroll', () => {
        if (!ticking) {
            window.requestAnimationFrame(() => {
                const scrollTop = window.scrollY;
                const docHeight = document.documentElement.scrollHeight - window.innerHeight;
                const progress = docHeight > 0 ? Math.min(scrollTop / docHeight, 1) : 0;
                progressBar.style.transform = `scaleX(${progress})`;
                ticking = false;
            });
            ticking = true;
        }
    });
}

// Load most read sidebar widget
async function loadSidebarMostRead() {
    try {
        const { data, error } = await supabaseArt
            .from('articles')
            .select('id, slug, title, publish_date')
            .eq('status', 'published')
            .order('view_count', { ascending: false })
            .limit(5);

        if (error || !data) return;

        const container = document.getElementById('sidebar-most-read');
        if (!container) return;

        container.innerHTML = data.map((article, index) => `
      <a href="/article/${encodeURIComponent(article.slug)}" 
         class="flex items-start gap-3 hover:bg-gray-50 p-2 rounded transition-colors">
        <span class="text-2xl font-bold text-gray-300 leading-none min-w-[24px]">${index + 1}</span>
        <div>
          <p class="text-sm font-bold text-gray-800 leading-tight line-clamp-2">${_h(article.title)}</p>
          <p class="text-xs text-gray-600 mt-1">${formatDateHebrew(article.publish_date)}</p>
        </div>
      </a>
    `).join('');
    } catch (err) {
        console.error('Sidebar most read error:', err);
    }
}

// Load related articles
async function loadRelatedArticles(categoryId, currentSlug) {
    try {
        let relatedArticles = [];

        // 1. Try to get articles from the same category
        if (categoryId) {
            const { data: categoryData, error: categoryError } = await supabaseArt
                .from('articles')
                .select('id, slug, title, featured_image_url, categories(name)')
                .eq('status', 'published')
                .eq('category_id', categoryId)
                .neq('slug', currentSlug)
                .order('publish_date', { ascending: false })
                .limit(3);

            if (!categoryError && categoryData) {
                relatedArticles = categoryData;
            }
        }

        // 2. Fallback: if we have less than 3, get more from any category
        if (relatedArticles.length < 3) {
            const needed = 3 - relatedArticles.length;
            const fetchedSlugs = new Set([currentSlug, ...relatedArticles.map(a => a.slug)]);

            // We over-fetch slightly to guarantee we have enough after filtering
            const { data: fallbackData, error: fallbackError } = await supabaseArt
                .from('articles')
                .select('id, slug, title, featured_image_url, categories(name)')
                .eq('status', 'published')
                .order('publish_date', { ascending: false })
                .limit(needed + fetchedSlugs.size);

            if (!fallbackError && fallbackData) {
                const uniqueFallback = fallbackData.filter(a => !fetchedSlugs.has(a.slug)).slice(0, needed);
                relatedArticles = [...relatedArticles, ...uniqueFallback];
            }
        }

        const container = document.getElementById('related-articles');
        if (!container) return;

        if (relatedArticles.length === 0) {
            // Hide the entire section if absolutely no articles exist
            if (container.parentElement) {
                container.parentElement.style.display = 'none';
            }
            return;
        }

        container.innerHTML = relatedArticles.map(article => {
            const _img = (w) => window.getOptimizedImageUrl
                ? window.getOptimizedImageUrl(article.featured_image_url || 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=400', { w, f: 'auto', q: 90 })
                : (article.featured_image_url || 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=400');
                
            return `
      <a href="/article/${encodeURIComponent(article.slug)}" 
         class="bg-white rounded-lg overflow-hidden border border-gray-200 hover:shadow-md transition-shadow block">
        <picture>
            <source media="(max-width: 640px)" srcset="${_h(_img(400))} 400w, ${_h(_img(800))} 800w" sizes="100vw">
            <img src="${_h(_img(600))}" 
                 srcset="${_h(_img(600))} 600w, ${_h(_img(800))} 800w" sizes="(max-width: 1024px) 50vw, 33vw"
                 alt="${_h(article.title)}" 
                 class="w-full h-32 object-cover"
                 width="400" height="128"
                 loading="lazy">
        </picture>
        <div class="p-3">
          <p class="text-xs text-red-600 font-bold mb-1">${_h(article.categories?.name || 'כללי')}</p>
          <h4 class="text-sm font-bold leading-tight line-clamp-2">${_h(article.title)}</h4>
        </div>
      </a>
    `;
        }).join('');
    } catch (err) {
        console.error('Related articles error:', err);
    }
}

// Set up share buttons
function initShareButtons(article) {
    const url = encodeURIComponent(window.location.href);
    const title = encodeURIComponent(article.title);

    const whatsappBtn = document.getElementById('whatsapp-share');
    if (whatsappBtn) {
        whatsappBtn.href = `https://wa.me/?text=${title}%20${url}`;
    }

    const facebookBtn = document.getElementById('facebook-share');
    if (facebookBtn) {
        facebookBtn.href = `https://www.facebook.com/sharer/sharer.php?u=${url}`;
    }
}

// Copy article link
window.copyArticleLink = function () {
    navigator.clipboard.writeText(window.location.href).then(() => {
        alert('הקישור הועתק!');
    });
};

// Increment view count via atomic RPC
async function incrementViewCount(articleId) {
    try {
        await supabaseArt.rpc('increment_view_count', { target_article_id: articleId });
    } catch (err) {
        // Silently fail - not critical
    }
}

// Load and render entry hook buttons
async function renderEntryHook(categorySlug) {
    console.log('renderEntryHook called with:', categorySlug);
    window.currentArticleCategory = categorySlug;

    const ctaEl = document.getElementById('article-inline-cta');
    if (!ctaEl) {
        console.warn('article-inline-cta element not found');
        return;
    }

    try {
        const { data: config, error } = await supabaseArt
            .from('quiz_configs')
            .select('entry_hook_title, entry_hook_subtitle, button_a_label, button_a_value, button_b_label, button_b_value')
            .eq('category_slug', categorySlug)
            .single();

        console.log('Quiz config result:', { config, error });

        if (error || !config) {
            // Generic fallback
            ctaEl.innerHTML = `
        <p class="text-lg font-bold text-gray-900 mb-4">האם גם לך מגיע החזר?</p>
        <button onclick="openQuizModal('${categorySlug}')" 
                class="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-8 rounded-lg text-lg transition-colors shadow-lg">
          ← בדוק עכשיו בחינם
        </button>
        <p class="text-xs text-gray-600 mt-2">✓ בחינם ✓ ללא התחייבות</p>
      `;
            ctaEl.classList.remove('hidden');
            return;
        }

        // Vertical-specific entry hook with two buttons
        ctaEl.innerHTML = `
      <p class="text-lg font-bold text-gray-900 mb-1">${config.entry_hook_title}</p>
      ${config.entry_hook_subtitle ? `<p class="text-sm text-gray-600 mb-4">${config.entry_hook_subtitle}</p>` : ''}
      <div class="grid grid-cols-2 gap-3 mt-4">
        <button onclick="openQuizModal('${categorySlug}', '${config.button_a_value}')"
                class="bg-gray-900 hover:bg-gray-800 text-white font-bold py-4 px-4 rounded-xl text-lg transition-all hover:scale-105 shadow-md">
          ${config.button_a_label}
        </button>
        <button onclick="openQuizModal('${categorySlug}', '${config.button_b_value}')"
                class="bg-red-600 hover:bg-red-700 text-white font-bold py-4 px-4 rounded-xl text-lg transition-all hover:scale-105 shadow-md">
          ${config.button_b_label}
        </button>
      </div>
      <p class="text-xs text-gray-600 mt-3">✓ בחינם ✓ ללא התחייבות ✓ 60 שניות בלבד</p>
    `;
        ctaEl.classList.remove('hidden');

        // Update bottom bar CTA if exists
        const bottomCta = document.querySelector('[data-cta-source="article_bottom_bar"]');
        if (bottomCta) {
            bottomCta.setAttribute('onclick', `openQuizModal('${categorySlug}')`);
        }

    } catch (err) {
        console.error('renderEntryHook error:', err);
    }
}

// Render entry hook from explicit config object
function renderEntryHookFromConfig(config, categorySlug) {
    const ctaEl = document.getElementById('article-inline-cta');
    if (!ctaEl) return;

    if (!config) {
        // Generic fallback
        ctaEl.innerHTML = `
      <p class="text-lg font-bold text-gray-900 mb-4">האם גם לך מגיע החזר?</p>
      <button onclick="openQuizModal(null, null, '${categorySlug}')" 
              class="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-8 rounded-lg text-lg">
        ← בדוק עכשיו בחינם
      </button>
    `;
        ctaEl.classList.remove('hidden');
        return;
    }

    ctaEl.innerHTML = `
    <p class="text-lg font-bold text-gray-900 mb-1">${config.entry_hook_title}</p>
    ${config.entry_hook_subtitle ? `<p class="text-sm text-gray-600 mb-4">${config.entry_hook_subtitle}</p>` : ''}
    <div class="grid grid-cols-2 gap-3 mt-4">
      <button onclick="openQuizModal('${categorySlug}', '${config.button_a_value}', null, '${config.id}')"
              class="bg-gray-900 hover:bg-gray-800 text-white font-bold py-4 px-4 rounded-xl text-lg transition-all hover:scale-105 shadow-md">
        ${config.button_a_label}
      </button>
      <button onclick="openQuizModal('${categorySlug}', '${config.button_b_value}', null, '${config.id}')"
              class="bg-red-600 hover:bg-red-700 text-white font-bold py-4 px-4 rounded-xl text-lg transition-all hover:scale-105 shadow-md">
        ${config.button_b_label}
      </button>
    </div>
    <p class="text-xs text-gray-600 mt-3">✓ בחינם ✓ ללא התחייבות ✓ 60 שניות בלבד</p>
  `;
    ctaEl.classList.remove('hidden');
}

// Hydrate sidebar quiz CTA based on resolved quiz config
function renderSidebarQuizCta(quizConfig, categorySlug) {
    const sidebarCta = document.getElementById('sidebar-quiz-cta');
    if (!sidebarCta) return;

    if (!quizConfig) {
        // No quiz assigned — keep sidebar CTA hidden
        sidebarCta.classList.add('hidden');
        return;
    }

    const title = _h(quizConfig.display_name || quizConfig.entry_hook_title || 'בדוק זכאות');
    const quizId = quizConfig.id;

    sidebarCta.innerHTML = `
        <div class="bg-red-600 text-white text-center py-4 px-4">
            <p class="font-bold text-lg leading-snug">💰 הבנק שלך אולי חייב לך כסף</p>
            <p class="text-sm opacity-90 mt-0.5">בדוק תוך 60 שניות כמה מגיע לך בחזרה</p>
        </div>
        <div class="p-5">
            <!-- Social proof -->
            <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:0.625rem;padding:0.5rem 0.75rem;margin-bottom:0.875rem;font-size:0.75rem;color:#92400e;text-align:center;">
                🏆 <strong>14,000+ ישראלים</strong> כבר קיבלו את הכסף שלהם השנה
            </div>
            ${quizConfig.button_a_label && quizConfig.button_b_label ? `
                <div class="grid grid-cols-2 gap-3 mb-4">
                    <button onclick="openQuizModal('${categorySlug || ''}', '${quizConfig.button_a_value || ''}', null, '${quizId}')"
                            class="bg-gray-900 hover:bg-gray-800 text-white font-bold py-3 px-3 rounded-lg text-base transition-all">
                        ${_h(quizConfig.button_a_label)}
                    </button>
                    <button onclick="openQuizModal('${categorySlug || ''}', '${quizConfig.button_b_value || ''}', null, '${quizId}')"
                            class="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-3 rounded-lg text-base transition-all">
                        ${_h(quizConfig.button_b_label)}
                    </button>
                </div>
            ` : `
                <button onclick="openQuizModal('${categorySlug || ''}', null, null, '${quizId}')"
                        class="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded-lg text-lg transition-colors mb-4">
                    ← בדוק זכאות עכשיו
                </button>
            `}
            <p class="text-xs text-gray-600 text-center">✓ ללא עלות ✓ ללא התחייבות ✓ 60 שניות בלבד</p>
        </div>
    `;
    sidebarCta.classList.remove('hidden');
}

// Convert Editor.js JSON Blocks to Tailwind HTML
function renderBlocksToHtml(blocks) {
    if (!blocks || !Array.isArray(blocks)) return '';

    return blocks.map(block => {
        switch (block.type) {
            case 'paragraph':
                return `<p class="mb-5 text-gray-800 leading-relaxed text-lg">${block.data.text}</p>`;
            case 'header':
                const level = block.data.level || 2;
                const classes = {
                    2: 'text-3xl font-bold mt-10 mb-5 text-gray-900 leading-tight',
                    3: 'text-2xl font-bold mt-8 mb-4 text-gray-900 leading-tight',
                    4: 'text-xl font-bold mt-6 mb-3 text-gray-900 leading-snug',
                    5: 'text-lg font-bold mt-5 mb-2 text-gray-900',
                    6: 'text-base font-bold mt-4 mb-2 text-gray-900'
                };
                return `<h${level} class="${classes[level] || classes[2]}">${block.data.text}</h${level}>`;
            case 'list':
                const listTag = block.data.style === 'ordered' ? 'ol' : 'ul';
                const listClass = block.data.style === 'ordered' ? 'list-decimal list-inside mb-6 space-y-2' : 'list-disc list-inside mb-6 space-y-2';
                // Handle both v1 (string[]) and v2 ({content, items}[]) list data formats
                const items = block.data.items.map(item => {
                    const text = typeof item === 'string' ? item : (item.content || item.text || '');
                    return `<li class="text-gray-800 text-lg">${text}</li>`;
                }).join('');
                return `<${listTag} class="${listClass}">${items}</${listTag}>`;
            case 'image':
                const caption = block.data.caption ? `<figcaption class="text-center text-sm text-gray-600 mt-2">${block.data.caption}</figcaption>` : '';
                const withBorder = block.data.withBorder ? 'border border-gray-200 p-2 rounded-lg' : '';
                const withBackground = block.data.withBackground ? 'bg-gray-50 p-4 rounded-lg' : '';
                const stretched = block.data.stretched ? 'w-full object-cover' : 'max-w-full mx-auto rounded-lg shadow-sm object-contain';

                const rawBlockImgUrl = block.data.file?.url || '';
                const blockImgUrl = window.getOptimizedImageUrl
                    ? window.getOptimizedImageUrl(rawBlockImgUrl, { w: 1000, f: 'auto', q: 90 })
                    : rawBlockImgUrl;

                return `
                    <figure class="my-8 ${withBorder} ${withBackground}">
                        <img src="${blockImgUrl}" alt="${block.data.caption || 'תמונה'}" class="${stretched}" loading="lazy" />
                        ${caption}
                    </figure>
                `;
            case 'quote':
                const alignmentClass = block.data.alignment === 'center' ? 'text-center' : 'text-right';
                const quoteCaption = block.data.caption ? `<cite class="block text-sm text-gray-600 mt-3 font-bold not-italic">- ${block.data.caption}</cite>` : '';
                return `
                    <blockquote class="border-r-4 border-red-600 pr-6 pl-4 my-8 bg-red-50 py-6 rounded-l-xl ${alignmentClass}">
                        <p class="text-xl md:text-2xl italic text-gray-800 font-medium leading-relaxed">"${block.data.text}"</p>
                        ${quoteCaption}
                    </blockquote>
                `;
            case 'embed':
                const embedUrl = block.data.embed;
                return `
                    <div class="my-8 w-full">
                        <div class="relative overflow-hidden pt-[56.25%] rounded-lg shadow-sm bg-gray-100">
                            <iframe src="${embedUrl}" class="absolute top-0 left-0 w-full h-full border-0" allowfullscreen></iframe>
                        </div>
                        ${block.data.caption ? `<p class="text-center text-sm text-gray-600 mt-2">${block.data.caption}</p>` : ''}
                    </div>
                `;
            case 'raw':
                return block.data.html;
            case 'quiz':
                if (!block.data.quizId) return '';
                return `
                    <div class="quiz-inline-block my-8" data-quiz-id="${block.data.quizId}" data-quiz-name="${_h(block.data.quizName || '')}">
                        <div style="background: linear-gradient(135deg, #fef2f2 0%, #fff7ed 100%); border: 2px solid #ef4444; border-radius: 16px; padding: 28px 24px; text-align: center;">
                            <p style="font-size: 22px; font-weight: 700; color: #991b1b; margin-bottom: 6px;">❓ בדוק את הזכאות שלך</p>
                            <p style="font-size: 14px; color: #6b7280; margin-bottom: 16px;">ענה על מספר שאלות קצרות וגלה אם מגיע לך החזר</p>
                            <div class="quiz-inline-buttons" style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; max-width: 420px; margin: 0 auto;"></div>
                            <p style="font-size: 12px; color: #9ca3af; margin-top: 12px;">✓ בחינם ✓ ללא התחייבות ✓ 60 שניות בלבד</p>
                        </div>
                    </div>
                `;
            case 'delimiter':
                return '<hr class="my-10 border-t-2 border-gray-200" />';
            default:
                console.warn(`Unknown block type: ${block.type}`);
                return '';
        }
    }).join('');
}

// MAIN LOADER
async function loadArticle() {
    const slug = getSlug();

    // No slug = redirect home
    if (!slug) {
        window.location.href = '/';
        return;
    }

    try {
        // Fetch article (without quiz_configs to avoid join failures breaking the page)
        // Note: Add disclaimer to select query
        const { data: article, error } = await supabaseArt
            .from('articles')
            .select('*, disclaimer, categories(id, name, slug)')
            .eq('slug', slug)
            .eq('status', 'published')
            .single();

        if (error || !article) {
            console.error('Article not found:', error);
            document.getElementById('article-skeleton').innerHTML = `
                <div class="text-center py-20">
                    <p class="text-xl text-gray-600">המאמר לא נמצא</p>
                    <a href="/" class="text-blue-600 underline mt-4 inline-block">חזרה לדף הבית</a>
                </div>`;
            return;
        }

        // Fetch quiz config separately (non-fatal — if this fails, article still loads)
        let quizConfig = null;
        if (article.quiz_id) {
            try {
                const { data: qc } = await supabaseArt
                    .from('quiz_configs')
                    .select('id, display_name, entry_hook_title, entry_hook_subtitle, button_a_label, button_a_value, button_b_label, button_b_value')
                    .eq('id', article.quiz_id)
                    .single();
                quizConfig = qc;
            } catch (qErr) {
                console.warn('Quiz config fetch failed (non-fatal):', qErr);
            }
        }

        // === POPULATE PAGE ===

        // 1. Update page title & meta
        document.title = `${article.title} | כלכלה - חדשות פורטל`;
        let metaDesc = document.querySelector('meta[name="description"]');
        if (!metaDesc) {
            metaDesc = document.createElement('meta');
            metaDesc.name = 'description';
            document.head.appendChild(metaDesc);
        }
        metaDesc.content = article.meta_description || article.subtitle || article.title;

        // Update or create Open Graph meta tags
        function setMetaTag(property, content) {
            let meta = document.querySelector(`meta[property="${property}"]`);
            if (!meta) {
                meta = document.createElement('meta');
                meta.setAttribute('property', property);
                document.head.appendChild(meta);
            }
            meta.setAttribute('content', content);
        }

        // Set canonical URL and OG URL
        const canonicalUrl = `https://calcala-news.co.il/article/${encodeURIComponent(slug)}`;
        
        let linkCanonical = document.querySelector('link[rel="canonical"]');
        if (!linkCanonical) {
            linkCanonical = document.createElement('link');
            linkCanonical.setAttribute('rel', 'canonical');
            document.head.appendChild(linkCanonical);
        }
        linkCanonical.setAttribute('href', canonicalUrl);

        // Set hreflang
        let linkHreflang = document.querySelector('link[hreflang="he-IL"]');
        if (!linkHreflang) {
            linkHreflang = document.createElement('link');
            linkHreflang.setAttribute('rel', 'alternate');
            linkHreflang.setAttribute('hreflang', 'he-IL');
            document.head.appendChild(linkHreflang);
        }
        linkHreflang.setAttribute('href', canonicalUrl);

        // Set OG tags
        setMetaTag('og:title', document.title);
        setMetaTag('og:description', article.meta_description || article.subtitle || article.title);
        setMetaTag('og:image', article.featured_image_url || 'https://calcala-news.co.il/images/default-share.jpg');
        setMetaTag('og:url', canonicalUrl);
        setMetaTag('og:type', 'article');
        setMetaTag('og:site_name', 'כלכלה - חדשות');

        // Twitter Card tags (for Twitter/X sharing)
        function setTwitterTag(name, content) {
            let meta = document.querySelector(`meta[name="${name}"]`);
            if (!meta) {
                meta = document.createElement('meta');
                meta.setAttribute('name', name);
                document.head.appendChild(meta);
            }
            meta.setAttribute('content', content);
        }

        setTwitterTag('twitter:card', 'summary_large_image');
        setTwitterTag('twitter:title', article.title);
        setTwitterTag('twitter:description', article.meta_description || article.subtitle || article.title);
        setTwitterTag('twitter:image', article.featured_image_url || 'https://calcala-news.co.il/images/default-share.jpg');

        // 2. Article header (category badge + title + subtitle)
        const headerEl = document.getElementById('article-header');
        if (headerEl) {
            headerEl.innerHTML = `
        <div class="flex items-center gap-3 mb-4">
          <span class="bg-red-600 text-white px-3 py-1 text-sm font-bold rounded">
            ${_h(article.categories?.name || 'כללי')}
          </span>
        </div>
        <h1 class="text-4xl font-bold text-gray-900 mb-3 leading-tight">${_h(article.title)}</h1>
        ${article.subtitle ? `<p class="text-xl text-gray-600">${_h(article.subtitle)}</p>` : ''}
      `;
        }

        // 3. Featured image
        const imageEl = document.getElementById('article-featured-image');
        if (imageEl && article.featured_image_url) {
            const _img = (w) => window.getOptimizedImageUrl
                ? window.getOptimizedImageUrl(article.featured_image_url, { w, f: 'auto', q: 90 })
                : article.featured_image_url;
                
            imageEl.innerHTML = `
        <picture>
            <source media="(max-width: 640px)" srcset="${_h(_img(400))} 400w, ${_h(_img(800))} 800w, ${_h(_img(1200))} 1200w" sizes="100vw">
            <img src="${_h(_img(1200))}" 
                 srcset="${_h(_img(1200))} 1200w"
                 alt="${_h(article.title)}" 
                 class="w-full h-auto max-h-[600px] object-cover rounded-lg shadow-md"
                 width="1200" height="675"
                 fetchpriority="high"
                 onerror="this.closest('picture').style.display='none'">
        </picture>
      `;
        } else if (imageEl) {
            imageEl.style.display = 'none';
        }

        // 4. Article meta
        const metaEl = document.getElementById('article-meta');
        if (metaEl) {
            metaEl.innerHTML = `
        ${article.author ? `<span class="font-medium">✍️ ${_h(article.author)}</span>` : ''}
        <span>📅 ${formatDateHebrew(article.publish_date)}</span>
        <span>⏱️ ${estimateReadTime(article.body)}</span>
      `;
        }

        // 5. Article body
        const bodyEl = document.getElementById('article-body');
        if (bodyEl) {
            let processedHtml = '<p>תוכן המאמר אינו זמין</p>';
            if (article.body) {
                try {
                    // Try to parse as JSON from Editor.js
                    const parsed = JSON.parse(article.body);
                    if (parsed && parsed.blocks) {
                        processedHtml = renderBlocksToHtml(parsed.blocks);
                    } else {
                        throw new Error('Not EditorJS format');
                    }
                } catch (e) {
                    // Legacy HTML string handling
                    processedHtml = article.body;
                }
            }

            // Use DOMPurify for article body HTML
            if (window.DOMPurify) {
                bodyEl.innerHTML = DOMPurify.sanitize(processedHtml, {
                    ADD_TAGS: ['iframe'],
                    ADD_ATTR: ['allow', 'allowfullscreen', 'frameborder', 'scrolling', 'data-quiz-id', 'data-quiz-name']
                });
            } else {
                bodyEl.innerHTML = processedHtml;
                console.warn('DOMPurify not loaded — article body not sanitized');
            }

            // Hydrate inline quiz blocks
            const inlineQuizBlocks = bodyEl.querySelectorAll('.quiz-inline-block[data-quiz-id]');
            for (const quizEl of inlineQuizBlocks) {
                const qId = quizEl.getAttribute('data-quiz-id');
                if (!qId) continue;
                try {
                    const { data: qCfg } = await supabaseArt
                        .from('quiz_configs')
                        .select('id, display_name, entry_hook_title, entry_hook_subtitle, button_a_label, button_a_value, button_b_label, button_b_value')
                        .eq('id', qId)
                        .single();

                    const catSlug = article.categories?.slug || '';
                    const titleEl = quizEl.querySelector('p');
                    const btnContainer = quizEl.querySelector('.quiz-inline-buttons');

                    if (qCfg && titleEl) {
                        titleEl.textContent = qCfg.entry_hook_title || 'בדוק את הזכאות שלך';
                    }
                    if (qCfg && btnContainer) {
                        btnContainer.innerHTML = `
                            <button onclick="openQuizModal('${catSlug}', '${qCfg.button_a_value}', null, '${qCfg.id}')"
                                    style="background: #111827; color: white; font-weight: 700; padding: 14px 16px; border-radius: 12px; font-size: 17px; border: none; cursor: pointer; transition: transform 0.2s;">
                                ${_h(qCfg.button_a_label)}
                            </button>
                            <button onclick="openQuizModal('${catSlug}', '${qCfg.button_b_value}', null, '${qCfg.id}')"
                                    style="background: #dc2626; color: white; font-weight: 700; padding: 14px 16px; border-radius: 12px; font-size: 17px; border: none; cursor: pointer; transition: transform 0.2s;">
                                ${_h(qCfg.button_b_label)}
                            </button>
                        `;
                    } else if (btnContainer) {
                        // Fallback: generic single button
                        btnContainer.style.gridTemplateColumns = '1fr';
                        btnContainer.innerHTML = `
                            <button onclick="openQuizModal('${catSlug}', null, null, '${qId}')"
                                    style="background: #dc2626; color: white; font-weight: 700; padding: 14px 24px; border-radius: 12px; font-size: 17px; border: none; cursor: pointer;">
                                ← בדוק עכשיו בחינם
                            </button>
                        `;
                    }
                } catch (qErr) {
                    console.warn('Inline quiz hydration failed for', qId, qErr);
                }
            }
        }

        // 5.5 Custom Disclaimer
        const disclaimerEl = document.getElementById('article-custom-disclaimer');
        if (disclaimerEl) {
            if (article.disclaimer && article.disclaimer.trim() !== '') {
                disclaimerEl.textContent = article.disclaimer; // Using textContent for safety against XSS
                disclaimerEl.classList.remove('hidden');
            } else {
                disclaimerEl.classList.add('hidden');
            }
        }

        // 6. Show inline CTA (after body loads)
        const ctaEl = document.getElementById('article-inline-cta');
        if (ctaEl) {
            ctaEl.classList.remove('hidden');
        }

        // 7. Share buttons
        initShareButtons(article);

        // 8. Related articles
        loadRelatedArticles(article.categories?.id, slug);

        if (article.categories?.id) {
            // Render entry hook if slug is available
            if (quizConfig) {
                // Article has a specific quiz assigned
                window.currentArticleQuizId = article.quiz_id;
                window.currentArticleCategory = article.categories?.slug;
                renderEntryHookFromConfig(quizConfig, article.categories?.slug);
                renderSidebarQuizCta(quizConfig, article.categories?.slug);
            } else if (article.categories?.slug) {
                // Fallback: use category-based lookup
                window.currentArticleCategory = article.categories.slug;
                renderEntryHook(article.categories.slug);
                // No specific quiz — sidebar CTA stays hidden
                renderSidebarQuizCta(null, article.categories.slug);
            }
        } else {
            // No category — sidebar CTA stays hidden
            renderSidebarQuizCta(null, null);
        }

        // 9. Sidebar most read
        loadSidebarMostRead();

        // 10. WhatsApp share URL update
        const whatsappBtn = document.getElementById('whatsapp-share');
        if (whatsappBtn) {
            whatsappBtn.href = `https://wa.me/?text=${encodeURIComponent(article.title + ' ' + window.location.href)}`;
        }

        // 11. Reading progress bar
        initReadingProgress();

        // 12. View count (async, non-blocking)
        incrementViewCount(article.id);

        // 12.5 Inject JSON-LD
        const jsonLdScript = document.createElement('script');
        jsonLdScript.type = 'application/ld+json';
        
        const catSlugLd = article.categories?.slug || '';
        const catNameLd = article.categories?.name || 'כללי';
        
        jsonLdScript.text = JSON.stringify({
            "@context": "https://schema.org",
            "@graph": [
                {
                    "@type": "BreadcrumbList",
                    "itemListElement": [
                        {
                            "@type": "ListItem",
                            "position": 1,
                            "name": "ראשי",
                            "item": "https://calcala-news.co.il/"
                        },
                        {
                            "@type": "ListItem",
                            "position": 2,
                            "name": catNameLd,
                            "item": catSlugLd ? `https://calcala-news.co.il/category/${encodeURIComponent(catSlugLd)}` : undefined
                        },
                        {
                            "@type": "ListItem",
                            "position": 3,
                            "name": article.title,
                            "item": canonicalUrl
                        }
                    ]
                },
                {
                    "@type": "NewsArticle",
                    "headline": article.title,
                    "image": [
                        article.featured_image_url || "https://calcala-news.co.il/images/og-default.jpg"
                    ],
                    "datePublished": article.publish_date,
                    "dateModified": article.publish_date,
                    "author": [{
                        "@type": "Person",
                        "name": article.author || "מערכת כלכלה-ניוז",
                        "url": article.author ? `https://calcala-news.co.il/author/${encodeURIComponent(article.author.replace(/\\s+/g, '-'))}` : "https://calcala-news.co.il/about"
                    }]
                }
            ]
        });
        document.head.appendChild(jsonLdScript);

        // 13. SHOW CONTENT, HIDE SKELETON
        document.getElementById('article-skeleton').style.display = 'none';
        document.getElementById('article-content').classList.remove('hidden');

    } catch (error) {
        console.error('Fatal error loading article:', error);
        // Show error instead of silently redirecting
        const skeleton = document.getElementById('article-skeleton');
        if (skeleton) {
            skeleton.innerHTML = `
                <div class="text-center py-20">
                    <p class="text-xl text-gray-600">שגיאה בטעינת המאמר</p>
                    <p class="text-sm text-gray-600 mt-2">${error.message || ''}</p>
                    <a href="/" class="text-blue-600 underline mt-4 inline-block">חזרה לדף הבית</a>
                </div>`;
        }
    }
}

// Wait for Supabase (async) then load article
function startArticleLoading() {
    if (initSupabaseArt()) {
        loadArticle();
    } else {
        let attempts = 0;
        const interval = setInterval(() => {
            attempts++;
            if (initSupabaseArt()) {
                clearInterval(interval);
                loadArticle();
            } else if (attempts > 50) {
                clearInterval(interval);
                console.error('Failed to load Supabase library after 5 seconds');
                const skeleton = document.getElementById('article-skeleton');
                if (skeleton) {
                    skeleton.innerHTML = `
                        <div class="text-center py-20">
                            <p class="text-xl text-gray-600">שגיאה בטעינת הדף</p>
                            <a href="/" class="text-blue-600 underline mt-4 inline-block">חזרה לדף הבית</a>
                        </div>`;
                }
            }
        }, 100);
    }
}

// Start when DOM is ready
document.addEventListener('DOMContentLoaded', startArticleLoading);

// Fallback if modal function not defined by other scripts
if (typeof openQuizModal === 'undefined') {
    window.openQuizModal = function () {
        const modal = document.getElementById('quiz-modal') || document.getElementById('modal');
        if (modal) {
            modal.classList.remove('hidden');
            document.body.style.overflow = 'hidden';
        } else if (window.CalcalaQuiz && window.CalcalaQuiz.open) {
            window.CalcalaQuiz.open();
        }
    };
}
