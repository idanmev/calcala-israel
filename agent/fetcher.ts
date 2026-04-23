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
  { name: 'Google News - Israeli Economy', url: 'https://news.google.com/rss/search?q=%D7%9B%D7%9C%D7%9B%D7%9C%D7%94&hl=iw&gl=IL&ceid=IL:iw', language: 'he' },
  { name: 'Google News - Israeli Finance', url: 'https://news.google.com/rss/search?q=%D7%91%D7%95%D7%A8%D7%A1%D7%94+%D7%99%D7%A9%D7%A8%D7%90%D7%9C&hl=iw&gl=IL&ceid=IL:iw', language: 'he' },
  { name: 'Google News - Israeli Real Estate', url: 'https://news.google.com/rss/search?q=%D7%A0%D7%93%D7%9C%D7%9F+%D7%99%D7%A9%D7%A8%D7%90%D7%9C&hl=iw&gl=IL&ceid=IL:iw', language: 'he' },
  { name: 'Google News - Israeli Tech', url: 'https://news.google.com/rss/search?q=%D7%94%D7%99%D7%99%D7%98%D7%A7+%D7%99%D7%A9%D7%A3%D7%90%D7%9C&hl=iw&gl=IL&ceid=IL:iw', language: 'he' },
  { name: 'Google News - Israeli Mortgage', url: 'https://news.google.com/rss/search?q=%D7%A8%D7%99%D7%91%D7%99%D7%AA+%D7%9E%D7%A9%D7%9B%D7%A0%D7%AA%D7%90&hl=iw&gl=IL&ceid=IL:iw', language: 'he' },
  { name: 'Google News - Israeli Capital Market', url: 'https://news.google.com/rss/search?q=%D7%A9%D7%95%D7%A7+%D7%94%D7%94%D7%95%D7%9F+%D7%99%D7%A9%D7%A8%D7%90%D7%9C&hl=iw&gl=IL&ceid=IL:iw', language: 'he' },
  { name: 'Google News - Israeli Economy 2026', url: 'https://news.google.com/rss/search?q=%D7%9B%D7%9C%D7%9B%D7%9C%D7%94+%D7%99%D7%A9%D7%A8%D7%90%D7%9C+2026&hl=iw&gl=IL&ceid=IL:iw', language: 'he' },
  { name: 'Google News - Bank of Israel Interest', url: 'https://news.google.com/rss/search?q=%D7%91%D7%A0%D7%A7+%D7%99%D7%A9%D7%A8%D7%90%D7%9C+%D7%A8%D7%99%D7%91%D7%99%D7%AA&hl=iw&gl=IL&ceid=IL:iw', language: 'he' },
  { name: 'Google News - Israeli Market', url: 'https://news.google.com/rss/search?q=%D7%9E%D7%A9%D7%A7+%D7%99%D7%A9%D7%A8%D7%90%D7%9C%D7%99&hl=iw&gl=IL&ceid=IL:iw', language: 'he' },
  // English sources
  { name: 'CTech by Calcalist', url: 'https://www.calcalistech.com/rss', language: 'en' },
  { name: 'Jerusalem Post Business', url: 'https://www.jpost.com/Rss/RssFeedsBusinessAndFinance.aspx', language: 'en' },
  { name: 'Reuters Business', url: 'https://feeds.reuters.com/reuters/businessNews', language: 'en' },
  { name: 'CNBC Top News', url: 'https://www.cnbc.com/id/100003114/device/rss/rss.html', language: 'en' },
  { name: 'MarketWatch', url: 'https://feeds.content.dowjones.io/public/rss/mw_realtimeheadlines', language: 'en' },
  { name: 'Yahoo Finance', url: 'https://finance.yahoo.com/news/rssindex', language: 'en' },
  { name: 'Seeking Alpha', url: 'https://seekingalpha.com/feed.xml', language: 'en' },
  { name: 'AP News Business', url: 'https://rsshub.app/apnews/topics/business', language: 'en' },
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
      
      let longestContent = contentOptions[0];
      for (const c of contentOptions) {
        if (c.length > longestContent.length) {
          longestContent = c;
        }
      }

      const rawContent = longestContent.replace(/<[^>]*>?/gm, '').replace(/\s+/g, ' ').trim();
      
      const summary = rawContent.substring(0, 300);
      const fullSummaryWords = rawContent.split(/\s+/);
      const fullSummary = fullSummaryWords.slice(0, 1500).join(' ');

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

    if (source.name === 'Seeking Alpha' || source.name === 'CNBC Top News' || source.name === 'MarketWatch' || source.name === 'Yahoo Finance' || source.name === 'AP News Business' || source.name === 'The Guardian Business') {
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
