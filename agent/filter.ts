import Anthropic from '@anthropic-ai/sdk';
import { TopicGroup } from './selector';

const MODEL_HAIKU = 'claude-haiku-4-5-20251001' as const;

const FILTER_SYSTEM_PROMPT = `You are a content editor for calcala-news.co.il, an Israeli financial and economic news website. The site covers the general Israeli economy, including macro-economics, industry, capital markets, real estate, tech, and personal finance — similar in scope to calcalist.co.il and bizportal.co.il.

You will receive a news topic with its headline and source summaries. Decide if this topic warrants a full 700-word Hebrew article about the Israeli economy.

Answer YES for these topic categories (all with strong Israeli audience relevance):
- Bank of Israel interest rate decisions or signals (ריבית בנק ישראל)
- Israeli stock market moves: TA-35, TA-125, specific Israeli-listed stocks
- Israeli real estate: apartment prices, new construction, housing affordability, rental prices
- Israeli mortgage market: monthly volume, new regulations, bank mortgage reform
- Israeli startup fundraising rounds of $10M+ or exits/acquisitions
- Israeli inflation data (CPI), GDP, unemployment, trade balance
- Israeli banking sector: earnings, new products, regulation, consumer protection rulings
- Israeli government budget, tax policy, social benefits changes
- Israeli consumer protection: court rulings about mortgages, insurance, fees
- Israeli pension, Keren Hishtalmut, long-term savings policy changes
- Israeli energy prices: fuel, electricity, natural gas
- Global tech investments with direct Israeli company angle (e.g., Google investing in Israeli startup, Intel Israel operations)
- Global AI/tech trends where Israeli companies or workforce are named specifically
- International interest rate decisions (Fed, ECB) when Israeli mortgage/shekel impact is explicitly discussed
- Corporate governance cases involving Israeli public companies (like Strauss recall settlement)
- Israeli labor market: salary data, layoffs at Israeli companies, employment law rulings
- Family law / divorce cases with significant personal finance dimension (alimony, asset disclosure, hidden wealth)
- New Israeli financial regulations: consumer credit, insurance, investment advisory

Answer NO only if:
- The topic has zero Israeli angle whatsoever (e.g., pure US company earnings with no Israeli operations/impact)
- The topic is pure military, security, or geopolitical news with absolutely no economic dimension
- The topic is celebrity, entertainment, sports, or health/medical with no financial angle
- The topic is too thin — a single one-sentence flash item without enough substance for a 700-word article
- The topic covers only a foreign market (e.g., US housing data) with no mention of Israeli relevance
- The topic is about international politics with no Israeli economic consequence mentioned

Borderline — lean YES if the Israeli connection is plausible even if not explicit:
- Global recession fears or tariff wars (Israeli exporters / tech sector affected)
- Global AI infrastructure investment boom (Israeli companies active in sector)
- International energy market shifts (Israel is a gas exporter; affects local prices)

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
    // Sort by score descending
    rejectedWithScores.sort((a, b) => b.score - a.score);
    const best = rejectedWithScores[0];
    
    if (best.score >= 5) {
      console.log(`[FILTER] ⚠️ Fallback approved (score: ${best.score}): ${best.topic.topic_name}`);
      approved.push(best.topic);
    } else {
      console.log(`[FILTER] ❌ No acceptable topics today — skipping run to avoid low quality content and return empty array`);
      return [];
    }
  }

  console.log(`[FILTER] Finished. ${approved.length}/${topics.length} topic(s) approved.`);
  return approved;
}
