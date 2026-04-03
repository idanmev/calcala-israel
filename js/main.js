/**
 * Calcala-News — Core Functionality
 * Social proof counter, market data, mobile menu, newsletter, timestamps
 */

(function () {
    'use strict';

    // =========================================================================
    // 1. SOCIAL PROOF COUNTER
    // =========================================================================
    function initCounter() {
        const counterEl = document.getElementById('socialProofCount');
        if (!counterEl) return;

        let count = 12847;
        counterEl.textContent = count.toLocaleString('en-US');

        function tick() {
            count++;
            counterEl.textContent = count.toLocaleString('en-US');
            // Random interval between 3-5 seconds
            const next = 3000 + Math.random() * 2000;
            setTimeout(tick, next);
        }

        setTimeout(tick, 3000 + Math.random() * 2000);
    }

    // =========================================================================
    // 2. MARKET DATA WIDGET (LIVE)
    // =========================================================================
    function initMarketData() {
        const rows = document.querySelectorAll('[data-market-row]');
        const refreshIndicator = document.getElementById('marketRefreshIndicator');
        const lastUpdateEl = document.getElementById('marketLastUpdate');
        if (!rows.length) return;

        const CACHE_KEY = 'calcala_market_cache';
        const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

        const config = {
            '^TA125.TA': { name: 'ת"א-35', decimals: 2, currency: '₪' },
            'ILS=X': { name: 'דולר/שקל', decimals: 4, currency: '₪' },
            'EURILS=X': { name: 'אירו/שקל', decimals: 4, currency: '₪', fallback: 'GC=F' },
            'BTC-USD': { name: 'ביטקוין', decimals: 0, currency: '$' },
            'POLI.TA': { name: 'בנק הפועלים', decimals: 2, currency: '₪' },
            // Fallback config
            'GC=F': { name: 'זהב', decimals: 2, currency: '$' }
        };

        function formatValue(symbol, val) {
            const cfg = config[symbol] || { decimals: 2, currency: '' };
            const formatted = val.toLocaleString('he-IL', {
                minimumFractionDigits: cfg.decimals,
                maximumFractionDigits: cfg.decimals
            });
            return cfg.currency + formatted;
        }

        function updateTimestamp(ts) {
            if (!lastUpdateEl) return;
            const date = new Date(ts);
            const formatted = date.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' }) +
                ' ' + date.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
            lastUpdateEl.textContent = 'עודכן: ' + formatted;
            lastUpdateEl.classList.remove('hidden');
        }

        async function fetchSymbolData(symbol) {
            try {
                // Add cache buster and range params to get latest data
                const queryParams = `?interval=1m&range=1d&_=${Date.now()}`;
                
                let url;
                // For local development, use a CORS proxy since local serve doesn't handle rewrites
                if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                    const targetUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}${queryParams}`;
                    url = `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`;
                } else {
                    // In production (Vercel), we use the rewrite rule configured in vercel.json
                    url = `/api/finance/${symbol}${queryParams}`;
                }

                const response = await fetch(url);
                const data = await response.json();

                return processYahooData(data, symbol);
            } catch (err) {
                console.warn(`Fetch error for ${symbol}:`, err);
                // Try fallback if defined
                if (config[symbol]?.fallback) {
                    console.log(`Switching to fallback for ${symbol}: ${config[symbol].fallback}`);
                    return await fetchSymbolData(config[symbol].fallback);
                }
                return null;
            }
        }

        function processYahooData(data, symbol) {
            const meta = data?.chart?.result?.[0]?.meta;
            if (!meta || meta.regularMarketPrice === undefined) {
                throw new Error(`Invalid data for ${symbol}`);
            }

            let price = meta.regularMarketPrice;
            const prevClose = meta.previousClose;

            // FIX: If ILS=X returns inverted rate (e.g. 0.28), invert it to 3.57
            if (symbol === 'ILS=X' && price < 1) {
                price = 1 / price;
            }

            const change = ((price - prevClose) / prevClose) * 100;
            return { price, change, symbol };
        }

        async function updateMarket() {
            if (refreshIndicator) refreshIndicator.classList.add('animate-spin');

            let cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
            const now = Date.now();
            let dataToUse = {};
            let timestamp = now;

            if (cache.timestamp && (now - cache.timestamp < CACHE_DURATION)) {
                console.log('[Market] Using cached data');
                dataToUse = cache.data;
                timestamp = cache.timestamp;
            } else {
                console.log('[Market] Fetching fresh data');
                const symbols = Object.keys(config).filter(s => !['GC=F'].includes(s));

                const results = {};
                for (const symbol of symbols) {
                    results[symbol] = await fetchSymbolData(symbol);
                }

                symbols.forEach(s => {
                    if (results[s]) {
                        dataToUse[s] = results[s];
                    } else if (cache.data && cache.data[s]) {
                        dataToUse[s] = cache.data[s];
                    }
                });

                if (Object.keys(dataToUse).length > 0) {
                    localStorage.setItem(CACHE_KEY, JSON.stringify({
                        timestamp: now,
                        data: dataToUse
                    }));
                }
            }

            updateTimestamp(timestamp);

            rows.forEach(row => {
                const mapKey = row.dataset.marketRow;
                let inst = dataToUse[mapKey];
                if (!inst) return;

                let displaySymbol = mapKey;
                if (inst.symbol && inst.symbol !== mapKey) {
                    const nameEl = row.querySelector('td.font-bold');
                    if (nameEl && config[inst.symbol]) {
                        if (nameEl.innerText !== config[inst.symbol].name) {
                            nameEl.innerText = config[inst.symbol].name;
                        }
                        displaySymbol = inst.symbol;
                    }
                }

                const changeEl = row.querySelector('[data-market-change]');
                const priceEl = row.querySelector('[data-market-price]');

                if (changeEl) {
                    const sign = inst.change >= 0 ? '+' : '';
                    changeEl.textContent = sign + inst.change.toFixed(2) + '%';
                    changeEl.className = 'p-2 text-left font-medium transition-colors ' +
                        (inst.change >= 0 ? 'text-success' : 'text-error');
                }

                if (priceEl) {
                    priceEl.textContent = formatValue(displaySymbol, inst.price);
                    priceEl.className = 'p-2 text-left text-text-muted transition-colors';
                }

                row.classList.remove('bg-success/10', 'bg-error/10');
                setTimeout(() => {
                    row.classList.add(inst.change >= 0 ? 'bg-success/10' : 'bg-error/10');
                    setTimeout(() => row.classList.remove('bg-success/10', 'bg-error/10'), 1000);
                }, 50);
            });

            if (refreshIndicator) {
                setTimeout(() => refreshIndicator.classList.remove('animate-spin'), 1000);
            }
        }

        updateMarket();
        setInterval(updateMarket, 60000);
    }

    function initTimestamps() {
        const els = document.querySelectorAll('[data-timestamp]');
        els.forEach(el => {
            const hoursAgo = parseInt(el.dataset.timestamp, 10);
            if (isNaN(hoursAgo)) return;

            if (hoursAgo < 1) {
                el.textContent = 'לפני מספר דקות';
            } else if (hoursAgo === 1) {
                el.textContent = 'לפני שעה';
            } else if (hoursAgo === 2) {
                el.textContent = 'לפני שעתיים';
            } else if (hoursAgo <= 10) {
                el.textContent = 'לפני ' + hoursAgo + ' שעות';
            } else {
                el.textContent = 'לפני ' + hoursAgo + ' שעות';
            }
        });
    }

    function initMobileMenu() {
        const toggleBtn = document.getElementById('mobileMenuToggle');
        const drawer = document.getElementById('mobileMenuDrawer');
        const overlay = document.getElementById('mobileMenuOverlay');
        const closeBtn = document.getElementById('mobileMenuClose');

        if (!toggleBtn || !drawer || !overlay) return;

        function open() {
            drawer.classList.add('active');
            overlay.classList.add('active');
            document.body.classList.add('modal-open');
        }

        function close() {
            drawer.classList.remove('active');
            overlay.classList.remove('active');
            document.body.classList.remove('modal-open');
        }

        toggleBtn.addEventListener('click', open);
        if (closeBtn) closeBtn.addEventListener('click', close);
        overlay.addEventListener('click', close);
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && drawer.classList.contains('active')) close();
        });
    }

    function initNewsletter() {
        const forms = document.querySelectorAll('[data-newsletter-form]');
        forms.forEach(form => {
            const input = form.querySelector('input[type="email"]');
            const btn = form.querySelector('button');
            const toast = form.querySelector('[data-newsletter-toast]');

            if (!input || !btn) return;

            let submitted = false;

            btn.addEventListener('click', (e) => {
                e.preventDefault();
                if (submitted) return;

                const email = input.value.trim();
                if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                    input.style.borderColor = '#EF4444';
                    input.focus();
                    setTimeout(() => { input.style.borderColor = ''; }, 2000);
                    return;
                }

                submitted = true;
                btn.disabled = true;
                btn.textContent = '✓';

                if (toast) {
                    toast.classList.add('show');
                }

                input.value = '';
                input.disabled = true;

                if (window.CalcalaTracking) {
                    window.CalcalaTracking.trackEvent('Newsletter', 'submit', 'sidebar');
                }

                setTimeout(() => {
                    submitted = false;
                    btn.disabled = false;
                    btn.textContent = 'הצטרף';
                    input.disabled = false;
                    if (toast) toast.classList.remove('show');
                }, 5000);
            });

            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    btn.click();
                }
            });
        });
    }

    function initNavHighlight() {
        const navLinks = document.querySelectorAll('[data-nav-link]');
        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                navLinks.forEach(l => {
                    l.classList.remove('font-bold', 'text-primary', 'border-primary');
                    l.classList.add('font-medium', 'text-text-main', 'border-transparent');
                });
                link.classList.add('font-bold', 'text-primary', 'border-primary');
                link.classList.remove('font-medium', 'text-text-main', 'border-transparent');
            });
        });
    }

    function initSearch() {
        const searchInput = document.getElementById('searchInput');
        if (!searchInput) return;

        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const query = searchInput.value.trim();
                if (query) {
                    console.log('[Search] Query:', query);
                    if (window.CalcalaTracking) {
                        window.CalcalaTracking.trackEvent('Search', 'submit', query);
                    }
                }
            }
        });
    }

    function init() {
        initCounter();
        initMarketData();
        initTimestamps();
        initMobileMenu();
        initNewsletter();
        initNavHighlight();
        initSearch();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
// ============================================
// BREAKING NEWS TICKER - GOOGLE NEWS RSS
// ============================================

const SUPABASE_URL = 'https://gtuxstslzsiuinxjvfdj.supabase.co';
const TICKER_FUNCTION = `${SUPABASE_URL}/functions/v1/ticker-feed`;

let tickerHeadlines = [];
let currentTickerIndex = 0;

async function fetchTickerHeadlines() {
    try {
        const response = await fetch(TICKER_FUNCTION);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        if (Array.isArray(data) && data.length > 0) {
            tickerHeadlines = data;
            updateTickerDisplay();
            console.log(`✓ Loaded ${data.length} headlines from Google News`);
        } else {
            console.warn('No headlines returned from API');
        }
    } catch (error) {
        console.error('Failed to fetch ticker headlines:', error);
    }
}

function updateTickerDisplay() {
    const tickerContainer = document.querySelector('[data-breaking-ticker]');
    if (!tickerContainer || tickerHeadlines.length === 0) return;

    // Pick a set of 4-5 headlines to show
    const count = 4;
    const headlines = [];
    for (let i = 0; i < Math.min(count, tickerHeadlines.length); i++) {
        const index = (currentTickerIndex + i) % tickerHeadlines.length;
        headlines.push(tickerHeadlines[index]);
    }

    const html = headlines.map(item => {
        const timeAgo = getTimeAgo(item.pub_date);
        const esc = (s) => window.CalcalaSanitize ? window.CalcalaSanitize.escapeHtml(s) : String(s || '');
        const safeLink = (item.link && /^https?:\/\//i.test(item.link)) ? esc(item.link) : '#';
        return `
            <a href="${safeLink}" target="_blank" rel="noopener noreferrer" 
               class="block p-4 border-b border-border-color hover:bg-slate-50 cursor-pointer group transition-colors">
                <div class="flex items-center gap-2 mb-1">
                    <span class="text-error text-[10px]">●</span>
                    <span class="text-text-muted text-[10px] font-bold tracking-wide">${timeAgo}</span>
                </div>
                <h4 class="font-heading font-bold text-sm text-primary leading-snug group-hover:text-accent transition-colors">
                    ${esc(item.title)}
                </h4>
                <div class="text-[10px] text-text-muted mt-1">מקור: ${esc(item.source)}</div>
            </a>
        `;
    }).join('');

    tickerContainer.innerHTML = html;
    currentTickerIndex = (currentTickerIndex + count) % tickerHeadlines.length;
}

function getTimeAgo(dateString) {
    const now = new Date();
    const then = new Date(dateString);
    const diffMs = now - then;
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'עכשיו';
    if (diffMins < 60) return `לפני ${diffMins} דק'`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `לפני ${diffHours} שעות`;

    const diffDays = Math.floor(diffHours / 24);
    return `לפני ${diffDays} ימים`;
}

// Initialize on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTicker);
} else {
    initTicker();
}

function initTicker() {
    fetchTickerHeadlines();
    setInterval(fetchTickerHeadlines, 5 * 60 * 1000); // Refresh every 5 min
    setInterval(updateTickerDisplay, 10000); // Rotate every 10 sec
}