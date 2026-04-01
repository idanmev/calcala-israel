import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const RSS_URL = "https://news.google.com/rss/search?q=כלכלה+OR+מס+OR+ביטוח+OR+דולר+OR+שקל&hl=iw&gl=IL&ceid=IL:iw";

function parseRSS(xml: string) {
  const items: any[] = [];
  const itemRegex = /<item>(.*?)<\/item>/gs;
  
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[1];
    
    const titleMatch = itemXml.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) || 
                       itemXml.match(/<title>(.*?)<\/title>/);
    const linkMatch = itemXml.match(/<link>(.*?)<\/link>/);
    const sourceMatch = itemXml.match(/<source.*?>(.*?)<\/source>/);
    const pubDateMatch = itemXml.match(/<pubDate>(.*?)<\/pubDate>/);
    
    const title = titleMatch?.[1] || '';
    const link = linkMatch?.[1] || '';
    const source = sourceMatch?.[1] || 'חדשות';
    const pubDate = pubDateMatch?.[1] || new Date().toISOString();
    
    if (title && link) {
      items.push({ 
        title: title.replace(/<[^>]+>/g, '').trim(),
        link, 
        source: source.replace(/<[^>]+>/g, '').trim(),
        pubDate 
      });
    }
  }
  
  return items;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: cachedData } = await supabase
      .from('ticker_headlines')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    if (cachedData) {
      const cacheAge = Date.now() - new Date(cachedData.updated_at).getTime();
      if (cacheAge < 5 * 60 * 1000) {
        const { data: headlines } = await supabase
          .from('ticker_headlines')
          .select('*')
          .order('updated_at', { ascending: false })
          .limit(20);

        return new Response(JSON.stringify(headlines || []), {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'public, max-age=300',
          },
        });
      }
    }

    console.log('Fetching fresh RSS from Google News...');
    const response = await fetch(RSS_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; CalcalaNews/1.0)',
      }
    });
    
    if (!response.ok) {
      throw new Error(`RSS fetch failed: ${response.status}`);
    }
    
    const xml = await response.text();
    const items = parseRSS(xml);
    console.log(`Parsed ${items.length} headlines`);

    if (items.length === 0) {
      throw new Error('No headlines parsed from RSS');
    }

    await supabase
      .from('ticker_headlines')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    
    const { data: insertedData, error } = await supabase
      .from('ticker_headlines')
      .insert(
        items.slice(0, 20).map(item => ({
          title: item.title,
          link: item.link,
          source: item.source,
          pub_date: new Date(item.pubDate).toISOString(),
        }))
      )
      .select();

    if (error) throw error;

    return new Response(JSON.stringify(insertedData || []), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=300',
      },
    });

  } catch (error: any) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      details: 'Check function logs for more info'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
});
