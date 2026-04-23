import * as cheerio from 'cheerio';
import fetch from 'node-fetch';
import { TopicGroup } from './selector';

export interface ScrapedTopicGroup extends TopicGroup {
  scrapedTexts: string[];
}

export async function scrapeTopics(topicGroups: TopicGroup[]): Promise<ScrapedTopicGroup[]> {
  const scrapedGroups: ScrapedTopicGroup[] = [];

  for (const group of topicGroups) {
    console.log(`[SCRAPER] Processing group: ${group.topic_name}`);
    const scrapedTexts: string[] = [];

    for (const story of group.stories) {
        let scrapeSuccess = false;
        console.log(`[SCRAPER] Fetching URL: ${story.url}`);
        
        try {
          const response = await fetch(story.url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            },
            timeout: 10000
          });

          if (response.ok) {
            const html = await response.text();
            const $ = cheerio.load(html);

            $('script').remove();
            $('style').remove();
            $('nav').remove();
            $('header').remove();
            $('footer').remove();
            $('aside').remove();
            $('iframe').remove();
            $('noscript').remove();
            $('[class*="ad"]').remove();
            $('[id*="ad"]').remove();
            $('[class*="menu"]').remove();
            $('[id*="menu"]').remove();
            $('[class*="nav"]').remove();
            $('[class*="cookie"]').remove();
            $('[class*="newsletter"]').remove();
            $('[class*="popup"]').remove();

            let content = '';
            const articleElements = $('article, [class*="article"], [class*="content"], main');
            
            if (articleElements.length > 0) {
              content = articleElements.text();
            } else {
              content = $('body').text();
            }

            let cleanText = content
              .replace(/\s+/g, ' ')
              .replace(/\n+/g, '\n')
              .trim();

            const words = cleanText.split(/\s+/);
            
            if (words.length >= 100) {
              if (words.length > 1500) {
                console.warn(`[SCRAPER] Truncating article from ${story.url}: originally ${words.length} words, cutting at 1500.`);
                cleanText = words.slice(0, 1500).join(' ');
              }
              scrapedTexts.push(cleanText);
              scrapeSuccess = true;
              console.log(`[SCRAPER] Successfully scraped ${cleanText.length} characters.`);
            } else {
              console.log(`[SCRAPER] Scraped content too short (${words.length} words).`);
            }
          } else {
            console.warn(`[SCRAPER] HTTP error! status: ${response.status} for ${story.url}`);
          }
        } catch (error) {
          console.error(`[SCRAPER] Failed to scrape ${story.url}:`, error);
        }

        // Tier 2: Fallback to fullSummary
        if (!scrapeSuccess) {
          const fullSummary = (story as any).fullSummary || '';
          const summaryWords = fullSummary.split(/\s+/).filter(w => w.length > 0);
          
          if (summaryWords.length >= 50) {
            console.log(`[SCRAPER] Using RSS summary fallback for: ${story.url}`);
            scrapedTexts.push(fullSummary);
          } else {
            console.log(`[SCRAPER] Skipping story: both scrape and summary fallback failed for ${story.url}`);
          }
        }

      // Stop if we have at least 2
      if (scrapedTexts.length >= 2) {
        break;
      }
    }

    if (scrapedTexts.length >= 2) {
      scrapedGroups.push({
        ...group,
        scrapedTexts
      });
      console.log(`[SCRAPER] Group ${group.topic_name} successfully scraped enough articles.`);
    } else {
      console.log(`[SCRAPER] Group ${group.topic_name} failed to get at least 2 scraped articles (got ${scrapedTexts.length}). Skipping group.`);
    }
  }

  return scrapedGroups;
}
