/**
 * article-renderer.ts — Server-side renderer for article pages.
 *
 * Reads article.html, fetches the article from Supabase by slug,
 * and injects SEO metadata (title, OG tags, JSON-LD NewsArticle schema)
 * before returning the HTML. This ensures crawlers and social-media
 * scrapers (WhatsApp, Facebook, Twitter, Googlebot) see real content
 * instead of client-side placeholder text.
 */

import { load as cheerioLoad } from 'cheerio';
import fs from 'fs';
import path from 'path';

const SUPABASE_URL = 'https://gtuxstslzsiuinxjvfdj.supabase.co';
const SUPABASE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0dXhzdHNsenNpdWlueGp2ZmRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyMTU2NjIsImV4cCI6MjA4Njc5MTY2Mn0.ZYbL9PVGUdehVEtg18bi-Uyw-iy857KVM7Yceh7NMaM';
const BASE_URL = 'https://calcala-news.co.il';
const DEFAULT_IMAGE = `${BASE_URL}/images/og-default.jpg`;

// ── helpers ────────────────────────────────────────────────────────

function escXml(s: string): string {
  if (!s) return '';
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/** Ensure an image URL is absolute. */
function absImage(url: string | null | undefined): string {
  if (!url) return DEFAULT_IMAGE;
  if (url.startsWith('http')) return url;
  return `${BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
}

// ── cache the template in module scope (warm-start reuse) ─────────

let templateCache: string | null = null;

function getTemplate(): string {
  if (templateCache) return templateCache;
  const filePath = path.join(process.cwd(), 'article.html');
  templateCache = fs.readFileSync(filePath, 'utf-8');
  return templateCache;
}

// ── main handler ──────────────────────────────────────────────────

export default async function handler(req: any, res: any) {
  try {
    // 1. Extract slug from query string (Vercel rewrites pass :slug as ?slug=)
    const slug = req.query?.slug as string | undefined;

    if (!slug) {
      res.status(404);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(get404Html());
    }

    // 2. Fetch article from Supabase
    const apiUrl =
      `${SUPABASE_URL}/rest/v1/articles` +
      `?select=title,subtitle,meta_description,featured_image_url,publish_date,updated_at,author,slug,categories(id,name,slug)` +
      `&slug=eq.${encodeURIComponent(slug)}` +
      `&status=in.(published,hidden)` +
      `&limit=1`;

    const supaRes = await fetch(apiUrl, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
    });

    const rows = await supaRes.json();
    const article = Array.isArray(rows) ? rows[0] : null;

    // 3. 404 — article not found
    if (!article) {
      res.status(404);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(get404Html());
    }

    // 4. Build metadata values
    const title = `${article.title} | כלכלה-ניוז`;
    const description =
      article.meta_description || article.subtitle || article.title;
    const canonicalUrl = `${BASE_URL}/article/${encodeURIComponent(article.slug)}`;
    const imageUrl = absImage(article.featured_image_url);
    const catName = article.categories?.name || 'כללי';
    const catSlug = article.categories?.slug || '';
    const author = article.author || 'מערכת כלכלה-ניוז';
    const publishDate = article.publish_date || new Date().toISOString();
    const modifiedDate = article.updated_at || publishDate;
    const headline =
      article.title && article.title.length > 110
        ? article.title.substring(0, 107) + '...'
        : article.title;

    // 5. Build JSON-LD
    const jsonLd = {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'BreadcrumbList',
          itemListElement: [
            {
              '@type': 'ListItem',
              position: 1,
              name: 'ראשי',
              item: `${BASE_URL}/`,
            },
            ...(catSlug
              ? [
                  {
                    '@type': 'ListItem',
                    position: 2,
                    name: catName,
                    item: `${BASE_URL}/category/${encodeURIComponent(catSlug)}`,
                  },
                ]
              : []),
            {
              '@type': 'ListItem',
              position: catSlug ? 3 : 2,
              name: article.title,
              item: canonicalUrl,
            },
          ],
        },
        {
          '@type': 'NewsArticle',
          headline,
          description,
          image: {
            '@type': 'ImageObject',
            url: imageUrl,
            width: 1200,
            height: 630,
          },
          datePublished: publishDate,
          dateModified: modifiedDate,
          author: { '@type': 'Person', name: author },
          publisher: {
            '@type': 'Organization',
            name: 'כלכלה-ניוז',
            logo: {
              '@type': 'ImageObject',
              url: `${BASE_URL}/images/og-default.jpg`,
            },
          },
          mainEntityOfPage: { '@type': 'WebPage', '@id': canonicalUrl },
          inLanguage: 'he-IL',
          isPartOf: { '@id': `${BASE_URL}/#website` },
        },
      ],
    };

    // 6. Inject into HTML via Cheerio
    const html = getTemplate();
    const $ = cheerioLoad(html);

    // Title
    $('title').text(title);

    // Meta description
    $('meta[name="description"]').attr('content', description);

    // Canonical
    let $canonical = $('link[rel="canonical"]');
    if ($canonical.length === 0) {
      $('head').append(`<link rel="canonical" href="${escXml(canonicalUrl)}" />`);
    } else {
      $canonical.attr('href', canonicalUrl);
    }

    // Hreflang
    let $hreflang = $('link[hreflang="he-IL"]');
    if ($hreflang.length === 0) {
      $('head').append(
        `<link rel="alternate" hreflang="he-IL" href="${escXml(canonicalUrl)}" />`
      );
    } else {
      $hreflang.attr('href', canonicalUrl);
    }

    // Open Graph tags
    const ogTags: Record<string, string> = {
      'og:title': title,
      'og:description': description,
      'og:image': imageUrl,
      'og:url': canonicalUrl,
      'og:type': 'article',
      'og:site_name': 'כלכלה-ניוז',
    };

    for (const [prop, content] of Object.entries(ogTags)) {
      let $tag = $(`meta[property="${prop}"]`);
      if ($tag.length === 0) {
        $('head').append(
          `<meta property="${prop}" content="${escXml(content)}" />`
        );
      } else {
        $tag.attr('content', content);
      }
    }

    // Twitter Card tags
    const twitterTags: Record<string, string> = {
      'twitter:card': 'summary_large_image',
      'twitter:title': article.title,
      'twitter:description': description,
      'twitter:image': imageUrl,
    };

    for (const [name, content] of Object.entries(twitterTags)) {
      let $tag = $(`meta[name="${name}"]`);
      if ($tag.length === 0) {
        $('head').append(
          `<meta name="${name}" content="${escXml(content)}" />`
        );
      } else {
        $tag.attr('content', content);
      }
    }

    // JSON-LD
    $('head').append(
      `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`
    );

    // 7. Send response with caching
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader(
      'Cache-Control',
      'public, s-maxage=3600, stale-while-revalidate=86400'
    );
    return res.status(200).send($.html());
  } catch (err: any) {
    console.error('[article-renderer] Error:', err);
    // On unexpected error, fall through to the raw template so the
    // page still works (client-side JS will hydrate it).
    try {
      const html = getTemplate();
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(500).send(html);
    } catch {
      return res.status(500).send('Internal Server Error');
    }
  }
}

// ── 404 page ──────────────────────────────────────────────────────

function get404Html(): string {
  // Try to serve a custom 404.html if it exists
  try {
    const custom404 = path.join(process.cwd(), '404.html');
    if (fs.existsSync(custom404)) {
      return fs.readFileSync(custom404, 'utf-8');
    }
  } catch {
    // ignore
  }

  return `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>404 - הדף לא נמצא | כלכלה-ניוז</title>
  <meta name="robots" content="noindex" />
  <link href="https://fonts.googleapis.com/css2?family=Heebo:wght@400;700;800&display=swap" rel="stylesheet" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Heebo', sans-serif; background: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; color: #0f172a; }
    .container { text-align: center; padding: 2rem; }
    .code { font-size: 6rem; font-weight: 800; color: #e2e8f0; line-height: 1; }
    h1 { font-size: 1.5rem; margin: 1rem 0 0.5rem; }
    p { color: #64748b; margin-bottom: 1.5rem; }
    a { display: inline-block; background: #dc2626; color: #fff; padding: 0.75rem 2rem; border-radius: 0.5rem; text-decoration: none; font-weight: 700; transition: background 0.2s; }
    a:hover { background: #b91c1c; }
  </style>
</head>
<body>
  <div class="container">
    <div class="code">404</div>
    <h1>הדף לא נמצא</h1>
    <p>המאמר שחיפשת לא קיים או הוסר מהאתר.</p>
    <a href="/">← חזרה לדף הבית</a>
  </div>
</body>
</html>`;
}
