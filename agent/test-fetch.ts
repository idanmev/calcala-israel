import 'dotenv/config';
import { fetchAllStories } from './fetcher';
import { selectTopics } from './selector';

async function runDiagnostics() {
  console.log('--- Starting Fetch & Select Diagnostics ---');
  
  // 1. Fetch Stories
  console.log('\n[FETCHER] Fetching stories...');
  const stories = await fetchAllStories();
  console.log(`[FETCHER] Total stories fetched: ${stories.length}\n`);

  // Group and count by source
  const sourceCounts: Record<string, number> = {};
  for (const story of stories) {
    sourceCounts[story.source_name] = (sourceCounts[story.source_name] || 0) + 1;
  }
  
  console.log('--- Stories per Source ---');
  for (const [source, count] of Object.entries(sourceCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`${source}: ${count} stories`);
  }

  if (stories.length === 0) {
    console.log('\nNo stories fetched. Exiting.');
    return;
  }

  // 2. Select Topics
  console.log('\n[SELECTOR] Running topic selection...');
  const topics = await selectTopics(stories);
  console.log(`[SELECTOR] Found ${topics.length} topic groups.\n`);

  // 3. Print Top 5 Topics
  console.log('--- Top 5 Selected Topics ---');
  const topTopics = topics.slice(0, 5);
  
  for (let i = 0; i < topTopics.length; i++) {
    const t = topTopics[i];
    console.log(`${i + 1}. Topic: "${t.topic_name}"`);
    console.log(`   Score: ${t.score || 'N/A'}`);
    console.log(`   Stories in group (${t.stories.length}):`);
    
    for (const s of t.stories) {
      console.log(`      - [${s.source_name}] ${s.title}`);
    }
    console.log('');
  }
}

runDiagnostics().catch(console.error);
