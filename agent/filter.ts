import Anthropic from '@anthropic-ai/sdk';
import { TopicGroup } from './selector';

const MODEL_HAIKU = 'claude-haiku-4-5-20251001' as const;

const FILTER_SYSTEM_PROMPT = `You are a content editor for calcala-news.co.il, an Israeli personal finance and economics website. Your audience is Israeli adults interested in personal financial decisions — mortgages, savings, insurance, pensions, banking, real estate, cost of living, taxation, and the Israeli capital market.

You will receive a news topic with its headline and source summaries. Decide if this topic warrants a full 700-word Hebrew article for this specific audience.

Answer YES only if the topic meets at least one of these criteria:
- Directly affects Israeli consumers financially (interest rates, mortgage changes, cost of living, taxes, insurance, pension)
- Covers the Israeli capital market or Israeli economy with data or decisions
- Covers a global financial event with clear and direct implications for Israeli investors or consumers
- Covers a Israeli tech or startup story with significant economic impact

Answer NO if:
- The topic is primarily about US or international politics with no direct Israeli financial impact
- The topic is a generic international company earnings call with no Israeli angle
- The topic is too thin or is a single flash news item without enough substance for a 700-word article
- The topic is military, geopolitical, or general world news without a clear financial angle for Israelis

Respond with ONLY a JSON object in this exact format, nothing else:
{"decision": "YES" or "NO", "reason": "one sentence explanation in English", "score": number between 1 and 10 indicating topic quality/relevance}`;

interface FilterDecision {
  decision: 'YES' | 'NO';
  reason: string;
  score: number;
}

async function callHaikuFilter(
  client: Anthropic,
  userContent: string
): Promise<string> {
  const response = await client.messages.create({
    model: MODEL_HAIKU,
    max_tokens: 300,
    system: FILTER_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userContent }],
  });

  for (const block of response.content) {
    if (block.type === 'text') return block.text.trim();
  }
  throw new Error('No text block in Haiku filter response');
}

function parseFilterDecision(raw: string, topicName: string): FilterDecision {
  // Strip markdown fences if model ignores instructions
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim();

  try {
    const parsed = JSON.parse(cleaned);
    if (parsed.decision !== 'YES' && parsed.decision !== 'NO') {
      throw new Error(`Unexpected decision value: ${parsed.decision}`);
    }
    return { 
      decision: parsed.decision, 
      reason: parsed.reason || '',
      score: typeof parsed.score === 'number' ? parsed.score : 0
    };
  } catch (err) {
    throw new Error(
      `[FILTER] Could not parse decision JSON for "${topicName}". Raw: ${raw.slice(0, 200)}`
    );
  }
}

export async function filterTopics(
  topics: TopicGroup[]
): Promise<TopicGroup[]> {
  console.log(`\n[FILTER] Starting... Evaluating ${topics.length} topic(s).`);

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn('[FILTER] ANTHROPIC_API_KEY not set. Keeping all topics by default.');
    return topics;
  }

  const client = new Anthropic({ apiKey });
  const approved: TopicGroup[] = [];
  const rejectedWithScores: { topic: TopicGroup; reason: string; score: number }[] = [];

  for (const topic of topics) {
    // Build user message: topic name + each story's title and summary
    const storySummaries = topic.stories
      .map((s, i) => `Story ${i + 1}: ${s.title}\nSummary: ${s.summary}`)
      .join('\n\n');

    const userMessage = `Topic name: "${topic.topic_name}"\n\nStories in this group:\n${storySummaries}`;

    try {
      const raw = await callHaikuFilter(client, userMessage);
      const { decision, reason, score } = parseFilterDecision(raw, topic.topic_name);

      if (decision === 'YES') {
        console.log(`[FILTER] ✅ Approved: ${topic.topic_name} — ${reason} (Score: ${score})`);
        approved.push(topic);
      } else {
        console.log(`[FILTER] ❌ Rejected: ${topic.topic_name} — ${reason} (Score: ${score})`);
        rejectedWithScores.push({ topic, reason, score });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[FILTER] ⚠️  Filter failed for "${topic.topic_name}", keeping by default. Error: ${msg}`);
      approved.push(topic);
    }
  }

  // Fallback: If nothing approved, pick the best rejected one
  if (approved.length === 0 && rejectedWithScores.length > 0) {
    console.log(`[FILTER] ⚠️ No topics approved — selecting best available fallback topic.`);
    
    // Sort by score descending
    rejectedWithScores.sort((a, b) => b.score - a.score);
    const best = rejectedWithScores[0];
    
    console.log(`[FILTER] ⚠️ Fallback selection: ${best.topic.topic_name} (Original reason: ${best.reason}, Score: ${best.score})`);
    
    // Optional: could update the topic_name or internal metadata if needed, 
    // but the request just says to approve it.
    approved.push(best.topic);
  }

  console.log(`[FILTER] Finished. ${approved.length}/${topics.length} topic(s) approved.`);
  return approved;
}
