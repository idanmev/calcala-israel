import Parser from 'rss-parser';

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
  { name: 'Google News - Israeli Economy', url: 'https://news.google.com/rss/search?q=%D7%9B%D7%9C%D7%9B%D7%9C%D7%94&hl=iw&gl=IL&ceid=IL:iw', language: 'he' },
  { name: 'Google News - Israeli Finance', url: 'https://news.google.com/rss/search?q=%D7%91%D7%95%D7%A8%D7%A1%D7%94+%D7%99%D7%A9%D7%A8%D7%90%D7%9C&hl=iw&gl=IL&ceid=IL:iw', language: 'he' },
  { name: 'Google News - Israeli Real Estate', url: 'https://news.google.com/rss/search?q=%D7%A0%D7%93%D7%9C%D7%9F+%D7%99%D7%A9%D7%A8%D7%90%D7%9C&hl=iw&gl=IL&ceid=IL:iw', language: 'he' },
  { name: 'Google News - Israeli Tech', url: 'https://news.google.com/rss/search?q=%D7%94%D7%99%D7%99%D7%98%D7%A7+%D7%99%D7%A9%D7%A3%D7%90%D7%9C&hl=iw&gl=IL&ceid=IL:iw', language: 'he' },
  { name: 'Google News - Israeli Mortgage', url: 'https://news.google.com/rss/search?q=%D7%A8%D7%99%D7%91%D7%99%D7%AA+%D7%9E%D7%A9%D7%9B%D7%A0%D7%AA%D7%90&hl=iw&gl=IL&ceid=IL:iw', language: 'he' },
  { name: 'Google News - Israeli Mortgage Search', url: 'https://news.google.com/rss/search?q=%D7%9E%D7%A9%D7%9B%D7%A0%D7%AA%D7%90+%D7%91%D7%99%D7%A9%D7%A8%D7%90%D7%9C&hl=iw&gl=IL&ceid=IL:iw', language: 'he' },
  { name: 'Google News - Israeli Insurance', url: 'https://news.google.com/rss/search?q=%D7%91%D7%99%D7%98%D7%95%D7%97+%D7%99%D7%A9%D7%A8%D7%90%D7%9C&hl=iw&gl=IL&ceid=IL:iw', language: 'he' },
  { name: 'Google News - Israeli Pension', url: 'https://news.google.com/rss/search?q=%D7%A4%D7%A0%D7%A1%D7%99%D7%94+%D7%92%D7%9E%D7%9C+%D7%99%D7%A9%D7%A8%D7%90%D7%9C&hl=iw&gl=IL&ceid=IL:iw', language: 'he' },
  { name: 'Google News - Israeli Banking', url: 'https://news.google.com/rss/search?q=%D7%91%D7%A0%D7%A7%D7%99%D7%9D+%D7%99%D7%A9%D7%A8%D7%90%D7%9C&hl=iw&gl=IL&ceid=IL:iw', language: 'he' },
  { name: 'Google News - Israeli Capital Market', url: 'https://news.google.com/rss/search?q=%D7%A9%D7%95%D7%A7+%D7%94%D7%94%D7%95%D7%9F+%D7%99%D7%A9%D7%A8%D7%90%D7%9C&hl=iw&gl=IL&ceid=IL:iw', language: 'he' },
  { name: 'Google News - Israeli Economy 2026', url: 'https://news.google.com/rss/search?q=%D7%9B%D7%9C%D7%9B%D7%9C%D7%94+%D7%99%D7%A9%D7%A8%D7%90%D7%9C+2026&hl=iw&gl=IL&ceid=IL:iw', language: 'he' },
  { name: 'Google News - Bank of Israel Interest', url: 'https://news.google.com/rss/search?q=%D7%91%D7%A0%D7%A7+%D7%99%D7%A9%D7%A8%D7%90%D7%9C+%D7%A8%D7%99%D7%91%D7%99%D7%AA&hl=iw&gl=IL&ceid=IL:iw', language: 'he' },
  { name: 'Google News - Israeli Market', url: 'https://news.google.com/rss/search?q=%D7%9E%D7%A9%D7%A7+%D7%99%D7%A9%D7%A8%D7%90%D7%9C%D7%99&hl=iw&gl=IL&ceid=IL:iw', language: 'he' },
  // English sources
  { name: 'Reuters Business', url: 'https://feeds.reuters.com/reuters/businessNews', language: 'en' },
  { name: 'CNBC Top News', url: 'https://www.cnbc.com/id/100003114/device/rss/rss.html', language: 'en' },
  { name: 'MarketWatch', url: 'https://feeds.content.dowjones.io/public/rss/mw_realtimeheadlines', language: 'en' },
  { name: 'Yahoo Finance', url: 'https://finance.yahoo.com/news/rssindex', language: 'en' },
  { name: 'Seeking Alpha', url: 'https://seekingalpha.com/feed.xml', language: 'en' },
  { name: 'The Guardian Business', url: 'https://www.theguardian.com/us/business/rss', language: 'en' }
];

export async function fetchAllStories(): Promise<Story[]> {
  const parser = new Parser({
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RSS reader)' }
  });
  const allStories: Story[] = [];
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

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
      if (publishedAt < twentyFourHoursAgo) continue;

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
      'Ynet כלכלה'
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
