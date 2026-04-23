import { fetchAllStories } from './fetcher';
import { selectTopics } from './selector';

async function main() {
  console.log('--- Starting Fetch ---');
  const stories = await fetchAllStories();
  
  const sourceCounts: Record<string, number> = {};
  for (const story of stories) {
    sourceCounts[story.source_name] = (sourceCounts[story.source_name] || 0) + 1;
  }
  
  console.log('\n--- Fetch Results ---');
  let totalRetrieved = 0;
  for (const [source, count] of Object.entries(sourceCounts)) {
    console.log(`- ${source}: ${count} stories`);
    totalRetrieved += count;
  }
  
  // Note: Actual fetch failures are logged by fetcher.ts to console.error during the process.
  console.log(`\nTotal unique stories retrieved: ${totalRetrieved}`);
  
  console.log('\n--- Starting Selection ---');
  const topics = await selectTopics(stories);
  
  console.log('\n--- Top 2 Selected Topics ---');
  topics.forEach((topic, index) => {
    console.log(`\n#${index + 1} Topic: ${topic.topic_name}`);
    console.log(`Gap Score: ${topic.gap_score}`);
    console.log(`Score: ${topic.score}`);
    if (topic.fallback_tier) {
      console.log(`Fallback Tier: ${topic.fallback_tier}`);
    }
    console.log(`Source URLs:`);
    const breakdown = new Map<string, number>();
    topic.stories.forEach(s => {
      breakdown.set(s.source_name, (breakdown.get(s.source_name) || 0) + 1);
      console.log(`  -> [${s.source_name}] ${s.url}`);
    });
    console.log(`\nSource Breakdown:`);
    for (const [src, count] of breakdown.entries()) {
      console.log(`  - ${src}: ${count} stories`);
    }
  });
  
  console.log('\nProcess completed successfully.');
  process.exit(0);
}

main().catch(error => {
  console.error('Fatal Error:', error);
  process.exit(1);
});
