const ART_SUPABASE_URL = 'https://gtuxstslzsiuinxjvfdj.supabase.co';
const ART_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0dXhzdHNsenNpdWlueGp2ZmRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyMTU2NjIsImV4cCI6MjA4Njc5MTY2Mn0.ZYbL9PVGUdehVEtg18bi-Uyw-iy857KVM7Yceh7NMaM';

module.exports = async function handler(req, res) {
  try {
    const headers = {
      'apikey': ART_SUPABASE_KEY,
      'Authorization': `Bearer ${ART_SUPABASE_KEY}`
    };

    // Fetch categories
    const categoriesRes = await fetch(`${ART_SUPABASE_URL}/rest/v1/categories?select=slug`, { headers });
    const categories = await categoriesRes.json();

    // Fetch published articles
    const articlesRes = await fetch(`${ART_SUPABASE_URL}/rest/v1/articles?select=slug,publish_date&status=eq.published`, { headers });
    const articles = await articlesRes.json();

    const baseUrl = 'https://calcala-news.co.il';
    
    // Core static pages
    const staticPages = [
      '',
      '/about.html',
      '/privacy.html',
      '/terms.html',
      '/usage.html',
      '/accessibility.html'
    ];

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

    // Add static pages
    for (const page of staticPages) {
      xml += `  <url>\n`;
      xml += `    <loc>${baseUrl}${page}</loc>\n`;
      xml += `    <changefreq>weekly</changefreq>\n`;
      xml += `    <priority>${page === '' ? '1.0' : '0.5'}</priority>\n`;
      xml += `  </url>\n`;
    }

    // Add categories
    if (Array.isArray(categories)) {
        for (const cat of categories) {
          xml += `  <url>\n`;
          xml += `    <loc>${baseUrl}/category/${encodeURIComponent(cat.slug)}</loc>\n`;
          xml += `    <changefreq>daily</changefreq>\n`;
          xml += `    <priority>0.8</priority>\n`;
          xml += `  </url>\n`;
        }
    }

    // Add articles
    if (Array.isArray(articles)) {
        for (const art of articles) {
          const date = art.publish_date ? art.publish_date.split('T')[0] : new Date().toISOString().split('T')[0];
          xml += `  <url>\n`;
          xml += `    <loc>${baseUrl}/article/${encodeURIComponent(art.slug)}</loc>\n`;
          xml += `    <lastmod>${date}</lastmod>\n`;
          xml += `    <changefreq>weekly</changefreq>\n`;
          xml += `    <priority>0.7</priority>\n`;
          xml += `  </url>\n`;
        }
    }

    xml += `</urlset>`;

    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate'); // Cache for 1 hour at edge
    res.status(200).send(xml);

  } catch (error) {
    console.error('Error generating sitemap:', error);
    res.status(500).send('Error generating sitemap');
  }
};
