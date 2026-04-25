import Parser from 'rss-parser';
import Anthropic from '@anthropic-ai/sdk';

export interface Story {
  source_name: string;
  language: 'he' | 'en';
  title: string;
  url: string;
  published_at: Date;
  summary: string;
  fullSummary?: string;
}

interface FeedSource {
  name: string;
  url: string;
  language: 'he' | 'en';
}

const SOURCES: FeedSource[] = [
  // Hebrew sources
  { name: 'Ynet כלכלה', url: 'https://www.ynet.co.il/Integration/StoryRss2.xml', language: 'he' },
  // פנסיה וחסכון
  { name: 'פנסיה וחסכון', url: 'https://news.google.com/rss/search?q=%D7%A4%D7%A0%D7%A1%D7%99%D7%94+%D7%92%D7%9E%D7%9C+%D7%A7%D7%A8%D7%9F+%D7%94%D7%A9%D7%AA%D7%9C%D7%9E%D7%95%D7%AA&hl=iw&gl=IL&ceid=IL:iw', language: 'he' },
  // משכנתאות ונדל"ן
  { name: 'משכנתאות ונדל"ן', url: 'https://news.google.com/rss/search?q=%D7%9E%D7%A9%D7%9B%D7%A0%D7%AA%D7%90+%D7%A8%D7%99%D7%91%D7%99%D7%AA+%D7%91%D7%A0%D7%A7+%D7%99%D7%A9%D7%A8%D7%90%D7%9C&hl=iw&gl=IL&ceid=IL:iw', language: 'he' },
  // השקעות וניהול כסף
  { name: 'השקעות וניהול כסף', url: 'https://news.google.com/rss/search?q=%D7%94%D7%A9%D7%A7%D7%A2%D7%95%D7%AA+%D7%91%D7%95%D7%A8%D7%A1%D7%94+%D7%99%D7%A9%D7%A8%D7%90%D7%9C&hl=iw&gl=IL&ceid=IL:iw', language: 'he' },
  // מיסוי
  { name: 'מיסוי', url: 'https://news.google.com/rss/search?q=%D7%9E%D7%A1+%D7%94%D7%9B%D7%A0%D7%A1%D7%94+%D7%9E%D7%A2%D7%A1%D7%99%D7%9D+%D7%99%D7%A9%D7%A8%D7%90%D7%9C&hl=iw&gl=IL&ceid=IL:iw', language: 'he' },
  // ביטוח ובריאות
  { name: 'ביטוח ובריאות', url: 'https://news.google.com/rss/search?q=%D7%91%D7%99%D7%98%D7%95%D7%97+%D7%91%D7%A8%D7%99%D7%90%D7%95%D7%AA+%D7%99%D7%A9%D7%A8%D7%90%D7%9C&hl=iw&gl=IL&ceid=IL:iw', language: 'he' },
  // שוק ההון
  { name: 'שוק ההון', url: 'https://news.google.com/rss/search?q=%D7%A9%D7%95%D7%A7+%D7%94%D7%94%D7%95%D7%9F+%D7%AA%D7%9C+%D7%90%D7%91%D7%99%D7%91&hl=iw&gl=IL&ceid=IL:iw', language: 'he' },
  // בנק ישראל וריבית
  { name: 'בנק ישראל וריבית', url: 'https://news.google.com/rss/search?q=%D7%91%D7%A0%D7%A7+%D7%99%D7%A9%D7%A8%D7%90%D7%9C+%D7%A8%D7%99%D7%91%D7%99%D7%AA+2026&hl=iw&gl=IL&ceid=IL:iw', language: 'he' },
  // עלות המחיה
  { name: 'עלות המחיה', url: 'https://news.google.com/rss/search?q=%D7%99%D7%95%D7%A7%D7%A8+%D7%94%D7%9E%D7%97%D7%99%D7%94+%D7%99%D7%A9%D7%A8%D7%90%D7%9C+2026&hl=iw&gl=IL&ceid=IL:iw', language: 'he' },
  // English sources
  { name: 'Reuters Business', url: 'https://feeds.reuters.com/reuters/businessNews', language: 'en' },
  { name: 'CNBC Top News', url: 'https://www.cnbc.com/id/100003114/device/rss/rss.html', language: 'en' },
  { name: 'MarketWatch', url: 'https://feeds.content.dowjones.io/public/rss/mw_realtimeheadlines', language: 'en' },
  { name: 'Yahoo Finance', url: 'https://finance.yahoo.com/news/rssindex', language: 'en' },
  { name: 'Seeking Alpha', url: 'https://seekingalpha.com/feed.xml', language: 'en' },
  { name: 'The Guardian Business', url: 'https://www.theguardian.com/us/business/rss', language: 'en' },
  { name: 'Reuters Israel', url: 'https://feeds.reuters.com/reuters/INeconomics', language: 'en' },
  { name: 'MarketWatch Economy', url: 'https://feeds.marketwatch.com/marketwatch/economy-politics/', language: 'en' },
  { name: 'Google News Economy', url: 'https://news.google.com/rss/search?q=%D7%9B%D7%9C%D7%9B%D7%9C%D7%94+%D7%99%D7%A9%D7%A8%D7%90%D7%9C+%D7%A9%D7%95%D7%A7&hl=iw&gl=IL&ceid=IL:iw', language: 'he' },
  { name: 'Google News Prices', url: 'https://news.google.com/rss/search?q=%D7%9E%D7%97%D7%99%D7%A8%D7%99%D7%9D+%D7%99%D7%95%D7%A7%D7%A8+%D7%A6%D7%A8%D7%9B%D7%9F&hl=iw&gl=IL&ceid=IL:iw', language: 'he' },
  { name: 'Google News Tech', url: 'https://news.google.com/rss/search?q=%D7%94%D7%99%D7%99%D7%98%D7%A7+%D7%9B%D7%9C%D7%9B%D7%9C%D7%94+%D7%99%D7%A9%D7%A8%D7%90%D7%9C&hl=iw&gl=IL&ceid=IL:iw', language: 'he' },
  { name: 'Google News Wages', url: 'https://news.google.com/rss/search?q=%D7%A9%D7%9B%D7%A8+%D7%9E%D7%99%D7%A0%D7%99%D7%9E%D7%95%D7%9D+%D7%AA%D7%A2%D7%A1%D7%95%D7%A7%D7%94+%D7%99%D7%A9%D7%A8%D7%90%D7%9C&hl=iw&gl=IL&ceid=IL:iw', language: 'he' }
];

export async function fetchAllStories(): Promise<Story[]> {
  return fetchStoriesForWindow(24);
}

async function fetchStoriesForWindow(hours: number): Promise<Story[]> {
  const parser = new Parser({
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RSS reader)' }
  });
  const allStories: Story[] = [];
  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);

  // First pass: 24h
  const results = await fetchFromSources(parser, cutoff);

  if (hours === 24 && results.length < 25) {
    console.log(`[FETCHER] Story pool too thin (${results.length} stories) — expanding to 72h window`);
    return fetchStoriesForWindow(72);
  }

  return results;
}

async function fetchFromSources(parser: any, cutoff: Date): Promise<Story[]> {
  const allStories: Story[] = [];

  for (const source of SOURCES) {
    let feedUrl = source.url;
    let feed;

    try {
      feed = await parser.parseURL(feedUrl);
    } catch (error: any) {
      if (error?.response?.status === 404) {
        // Fallback strategy: append /feed or /rss to base domain
        try {
          const urlObj = new URL(source.url);
          feedUrl = `${urlObj.origin}/feed`;
          console.log(`[FETCHER] Fallback to ${feedUrl} for ${source.name}`);
          feed = await parser.parseURL(feedUrl);
        } catch (fallbackError) {
          try {
            const urlObj = new URL(source.url);
            feedUrl = `${urlObj.origin}/rss`;
            console.log(`[FETCHER] Fallback to ${feedUrl} for ${source.name}`);
            feed = await parser.parseURL(feedUrl);
          } catch (finalError) {
            console.error(`[FETCHER] Failed to fetch feed for ${source.name} after fallbacks`, finalError);
            continue;
          }
        }
      } else {
        console.error(`[FETCHER] Failed to fetch feed for ${source.name}`, error);
        continue;
      }
    }

    if (!feed || !feed.items) continue;

    const sourceStories: Story[] = [];

    for (const item of feed.items) {
      if (!item.title || !item.link) continue;

      const publishedAt = item.pubDate ? new Date(item.pubDate) : new Date();
      if (publishedAt < cutoff) continue;

      // Extract raw text for summary (remove HTML if any)
      const contentOptions = [
        item['content:encoded'] || '',
        item.content || '',
        item.contentSnippet || '',
        item.summary || ''
      ];
      
      // Concatenate all available fields for maximum context
      const combinedContent = contentOptions.join(' ');
      const rawContent = combinedContent.replace(/<[^>]*>?/gm, '').replace(/\s+/g, ' ').trim();
      
      const summary = rawContent.substring(0, 300);
      const fullSummaryWords = rawContent.split(/\s+/);
      
      // Google News specific: include title at start of fullSummary
      let fullSummary = fullSummaryWords.slice(0, 1500).join(' ');
      if (item.link?.includes('news.google.com')) {
        fullSummary = `${item.title}. ${fullSummary}`;
      }

      sourceStories.push({
        source_name: source.name,
        language: source.language,
        title: item.title,
        url: item.link,
        published_at: publishedAt,
        summary,
        fullSummary
      });
    }

    sourceStories.sort((a, b) => b.published_at.getTime() - a.published_at.getTime());

    const cappedSources = [
      'Seeking Alpha', 
      'CNBC Top News', 
      'MarketWatch', 
      'Yahoo Finance', 
      'The Guardian Business',
      'Ynet כלכלה',
      'MarketWatch Economy'
    ];

    if (cappedSources.includes(source.name)) {
      allStories.push(...sourceStories.slice(0, 10));
    } else {
      allStories.push(...sourceStories);
    }
  }

  // Deduplicate by URL
  const uniqueStoriesMap = new Map<string, Story>();
  for (const story of allStories) {
    if (!uniqueStoriesMap.has(story.url)) {
      uniqueStoriesMap.set(story.url, story);
    }
  }

  return Array.from(uniqueStoriesMap.values());
}

/**
 * Enriches a topic with live web research using Anthropic's web_search tool.
 * Called after filter approval, before scraping.
 */
export async function enrichTopicWithSearch(topicName: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn('[ENRICHER] ANTHROPIC_API_KEY not set — skipping enrichment.');
    return '';
  }

  const client = new Anthropic({ apiKey });

  try {
    const response = await (client.messages.create as any)({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      system: 'You are a research assistant for an Israeli personal finance news website. Given a topic, search for recent factual information about it — focusing on data, numbers, decisions, and implications for Israeli consumers. Search in both Hebrew and English. Return a concise summary of what you find, maximum 400 words, in English. Only include verifiable facts. Do not editorialize.',
      tools: [
        {
          type: 'web_search_20250305',
          name: 'web_search'
        }
      ],
      messages: [
        {
          role: 'user',
          content: `Research this topic for an Israeli finance news article: ${topicName}. Focus on recent developments, specific numbers, official decisions, and what it means for Israeli consumers or investors.`
        }
      ]
    });

    // Concatenate all text blocks from the response
    const textParts: string[] = [];
    for (const block of response.content) {
      if (block.type === 'text' && block.text) {
        textParts.push(block.text.trim());
      }
    }

    return textParts.join('\n\n');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[ENRICHER] Web research failed: ${msg}`);
    return '';
  }
}
