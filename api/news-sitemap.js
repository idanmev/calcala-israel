// Google News Sitemap — articles published within last 2 days
// Spec: https://developers.google.com/search/docs/crawling-indexing/sitemaps/news-sitemap

const SUPABASE_URL = 'https://gtuxstslzsiuinxjvfdj.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0dXhzdHNsenNpdWlueGp2ZmRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyMTU2NjIsImV4cCI6MjA4Njc5MTY2Mn0.ZYbL9PVGUdehVEtg18bi-Uyw-iy857KVM7Yceh7NMaM';

module.exports = async function handler(req, res) {
  try {
    const headers = {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`
    };

    // Google News only indexes articles from last 2 days
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    const twoDaysAgoISO = twoDaysAgo.toISOString();

    const url = `${SUPABASE_URL}/rest/v1/articles?select=slug,title,publish_date,author&status=eq.published&publish_date=gte.${encodeURIComponent(twoDaysAgoISO)}&order=publish_date.desc&limit=1000`;
    const articlesRes = await fetch(url, { headers });
    const articles = await articlesRes.json();

    const baseUrl = 'https://calcala-news.co.il';

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<urlset\n`;
    xml += `  xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n`;
    xml += `  xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">\n`;

    if (Array.isArray(articles)) {
      for (const art of articles) {
        if (!art.slug || !art.title) continue;

        const pubDate = art.publish_date
          ? new Date(art.publish_date).toISOString()
          : new Date().toISOString();

        // Escape XML special characters in title
        const safeTitle = art.title
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&apos;');

        xml += `  <url>\n`;
        xml += `    <loc>${baseUrl}/article/${encodeURIComponent(art.slug)}</loc>\n`;
        xml += `    <news:news>\n`;
        xml += `      <news:publication>\n`;
        xml += `        <news:name>כלכלה-ניוז</news:name>\n`;
        xml += `        <news:language>he</news:language>\n`;
        xml += `      </news:publication>\n`;
        xml += `      <news:publication_date>${pubDate}</news:publication_date>\n`;
        xml += `      <news:title>${safeTitle}</news:title>\n`;
        xml += `    </news:news>\n`;
        xml += `  </url>\n`;
      }
    }

    xml += `</urlset>`;

    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate'); // 10 min cache
    res.status(200).send(xml);

  } catch (error) {
    console.error('Error generating news sitemap:', error);
    res.status(500).send('Error generating news sitemap');
  }
};
