import 'dotenv/config';
import { fetchAllStories, enrichTopicWithSearch } from './fetcher';
import { selectTopics } from './selector';
import { filterTopics } from './filter';
import { scrapeTopics } from './scraper';
import { writer } from './writer';
import { insertArticle } from './inserter';
import { notifyTelegram } from './notifier';

export async function runAgent() {
  console.log('--- [ORCHESTRATOR] Starting Daily SEO Agent Run ---');

  try {
    // 1. Fetch
    console.log('\n[FETCHER] Starting...');
    const stories = await fetchAllStories();
    console.log(`[FETCHER] Finished. Retrieved ${stories.length} stories.`);

    if (stories.length === 0) {
      console.log('[ORCHESTRATOR] No stories fetched. Exiting.');
      return;
    }

    // 2. Select Topics
    console.log('\n[SELECTOR] Starting...');
    const topTopics = await selectTopics(stories);
    console.log(`[SELECTOR] Finished. Selected ${topTopics.length} topics.`);

    if (topTopics.length === 0) {
      console.log('[ORCHESTRATOR] No topics selected. Exiting.');
      return;
    }

    // 3. Filter Topics
    const approvedTopics = await filterTopics(topTopics);
    if (approvedTopics.length === 0) {
      console.log('[FILTER] No topics approved today. Ending run.');
      return;
    }

    // 4. Process each approved topic group
    for (const topicGroup of approvedTopics) {
      console.log(`\n--- Processing Topic: ${topicGroup.topic_name} ---`);
      
      try {
        // Scraper
        console.log(`[SCRAPER] Starting for topic: ${topicGroup.topic_name}`);
        const scrapedGroups = await scrapeTopics([topicGroup]);
        
        if (scrapedGroups.length === 0) {
          console.log(`[SCRAPER] Skipping topic ${topicGroup.topic_name} due to insufficient scrapes.`);
          continue;
        }
        
        const scrapedData = scrapedGroups[0];
        console.log(`[SCRAPER] Finished. Scraped ${scrapedData.scrapedTexts.length} articles.`);

        // Enricher — add live web research context
        const enrichmentText = await enrichTopicWithSearch(topicGroup.topic_name);
        const enrichedTexts = [...scrapedData.scrapedTexts];
        if (enrichmentText && enrichmentText.split(/\S+/g).length > 30) {
          const wordCount = (enrichmentText.match(/\S+/g) || []).length;
          enrichedTexts.push(`[Web Research]\n${enrichmentText}`);
          console.log(`[ENRICHER] Added web research context for topic: ${topicGroup.topic_name} (${wordCount} words).`);
        } else {
          console.log(`[ENRICHER] Enrichment skipped or too short for topic: ${topicGroup.topic_name}`);
        }

        // Writer
        console.log(`[WRITER] Starting...`);
        const { editorjs, meta_description } = await writer(enrichedTexts, scrapedData.topic_name);
        console.log(`[WRITER] Finished. Generated ${editorjs.length} blocks.`);

        // Inserter
        console.log(`[INSERTER] Starting...`);
        const { id, slug } = await insertArticle(editorjs, meta_description);
        console.log(`[INSERTER] Finished. Inserted ID: ${id}, Slug: ${slug}`);

        // Notifier
        console.log(`[NOTIFIER] Starting...`);
        const title = editorjs.find(b => b.type === 'header')?.data?.text?.replace(/<[^>]*>?/gm, '') || scrapedData.topic_name;
        await notifyTelegram(id, slug, title, meta_description);
        console.log(`[NOTIFIER] Finished.`);

      } catch (topicError) {
        console.error(`[ORCHESTRATOR] Error processing topic ${topicGroup.topic_name}:`, topicError);
        console.log('[ORCHESTRATOR] Continuing to next topic...');
      }
    }

    console.log('\n--- [ORCHESTRATOR] Agent Run Completed Successfully ---');
  } catch (error) {
    console.error('--- [ORCHESTRATOR] Fatal Error during agent run ---', error);
  }
}

// Allow running directly
if (require.main === module) {
  runAgent();
}
