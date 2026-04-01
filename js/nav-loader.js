/**
 * nav-loader.js — Dynamic Navigation from Supabase Categories
 * Fetches categories and renders them into desktop + mobile nav on all pages.
 */
(function () {
    'use strict';

    const NAV_SB_URL = 'https://gtuxstslzsiuinxjvfdj.supabase.co';
    const NAV_SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0dXhzdHNsenNpdWlueGp2ZmRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyMTU2NjIsImV4cCI6MjA4Njc5MTY2Mn0.ZYbL9PVGUdehVEtg18bi-Uyw-iy857KVM7Yceh7NMaM';

    // Material Symbols icon map — add more as needed
    const ICON_MAP = {
        'insurance': 'health_and_safety',
        'real-estate': 'apartment',
        'mortgage-real-estate': 'real_estate_agent',
        'crypto': 'currency_bitcoin',
        'taxation': 'receipt_long',
        'law': 'gavel',
        'technology': 'memory',
        'capital-market': 'show_chart',
        'pension-saving': 'savings',
    };
    const DEFAULT_ICON = 'category';

    function getIcon(slug) {
        return ICON_MAP[slug] || DEFAULT_ICON;
    }

    // Detect current page's active slug
    function getActiveSlug() {
        const params = new URLSearchParams(window.location.search);
        return params.get('slug') || '';
    }

    function isHomePage() {
        const path = window.location.pathname;
        return path === '/' || path.endsWith('/index.html') || path.endsWith('/index');
    }

    async function loadNav() {
        if (!window.supabase) {
            console.warn('nav-loader: Supabase not loaded yet');
            return;
        }

        const client = window.supabase.createClient(NAV_SB_URL, NAV_SB_KEY);

        try {
            const { data: categories, error } = await client
                .from('categories')
                .select('id, name, slug, display_order')
                .order('display_order', { ascending: true });

            if (error) throw error;
            if (!categories || categories.length === 0) return;

            renderDesktopNav(categories);
            renderMobileNav(categories);
        } catch (err) {
            console.error('nav-loader: Error fetching categories', err);
        }
    }

    function esc(s) {
        const div = document.createElement('div');
        div.textContent = s || '';
        return div.innerHTML;
    }

    function renderDesktopNav(categories) {
        const nav = document.getElementById('desktopNav');
        if (!nav) return;

        const activeSlug = getActiveSlug();

        // Keep any existing static links (like ראשי) that don't have data-category-slug
        const staticLinks = nav.querySelectorAll('a:not([data-category-slug])');

        // Remove all dynamic category links
        nav.querySelectorAll('a[data-category-slug]').forEach(el => el.remove());

        // Generate new links from Supabase data
        categories.forEach(cat => {
            const a = document.createElement('a');
            a.setAttribute('data-nav-link', '');
            a.setAttribute('data-category-slug', cat.slug);
            a.href = `category.html?slug=${encodeURIComponent(cat.slug)}`;
            a.className = 'h-full flex items-center px-3 text-sm font-medium text-text-main border-b-2 border-transparent hover:border-accent/50 hover:text-primary transition-colors';

            if (cat.slug === activeSlug) {
                a.classList.remove('border-transparent');
                a.classList.add('border-accent', 'text-primary', 'font-bold');
            }

            a.textContent = cat.name;
            nav.appendChild(a);
        });

        // Also update ראשי active state
        if (isHomePage()) {
            staticLinks.forEach(link => {
                if (link.textContent.trim() === 'ראשי') {
                    link.classList.remove('border-transparent');
                    link.classList.add('border-accent', 'text-primary', 'font-bold');
                }
            });
        }
    }

    function renderMobileNav(categories) {
        const drawer = document.getElementById('mobileMenuDrawer');
        if (!drawer) return;

        const navContainer = drawer.querySelector('nav');
        if (!navContainer) return;

        const activeSlug = getActiveSlug();

        // Remove all dynamic category links
        navContainer.querySelectorAll('a[data-category-slug]').forEach(el => el.remove());

        // Generate new mobile links
        categories.forEach(cat => {
            const a = document.createElement('a');
            a.setAttribute('data-mobile-link', '');
            a.setAttribute('data-category-slug', cat.slug);
            a.href = `category.html?slug=${encodeURIComponent(cat.slug)}`;
            a.className = 'flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-text-main hover:bg-slate-50 rounded-sm transition-colors';

            if (cat.slug === activeSlug) {
                a.classList.add('bg-slate-50', 'text-accent', 'font-bold');
            }

            const icon = document.createElement('span');
            icon.className = 'material-symbols-outlined text-[18px]';
            icon.textContent = getIcon(cat.slug);

            a.appendChild(icon);
            a.appendChild(document.createTextNode(' ' + cat.name));
            navContainer.appendChild(a);
        });
    }

    // Run on DOMContentLoaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', loadNav);
    } else {
        loadNav();
    }
})();
