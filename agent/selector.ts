import { Story } from './fetcher';

export interface TopicGroup {
  topic_name: string;
  stories: Story[];
  gap_score: boolean;
  score?: number;
  fallback_tier?: string;
  relevanceScore?: number;
}

const STOP_WORDS = new Set([
  'the', 'is', 'in', 'at', 'of', 'on', 'and', 'a', 'to', 'for', 'with', 'it', 'as', 'by', 'this',
  'that', 'from', 'an', 'are', 'was', 'were', 'be', 'has', 'have', 'had', 'not', 'but', 'or',
  'את', 'של', 'על', 'עם', 'כל', 'זה', 'גם', 'לא', 'כי', 'אבל', 'או', 'אם', 'הוא', 'היא', 'הם', 'הן',
  'ב', 'ל', 'מ', 'ש', 'ה', 'ו', 'כ', 'עד', 'אשר', 'כך', 'רק', 'בין', 'כדי', 'לפני', 'אחרי'
]);

const israelKeywords = ['israel', 'israeli', 'tel aviv', 'shekel', 'sheqel', 'bank of israel',
  'tase', 'כלכלה', 'ישראל', 'בורסה', 'שקל', 'נדלן', 'ריבית', 'משכנתא', 'היטק',
  'סטארטאפ', 'ביטוח', 'פנסיה', 'מיסים', 'השקעות'];

const financeKeywords = ['rate', 'inflation', 'recession', 'gdp', 'fed', 'interest',
  'mortgage', 'stock', 'market', 'earnings', 'economy', 'crypto', 'bitcoin',
  'real estate', 'investment', 'fund', 'bank', 'finance', 'tax'];

function tokenize(text: string): string[] {
  return text.toLowerCase()
    .replace(/[^\w\sא-ת]/g, '')
    .split(/\s+/)
    .filter(word => word.length > 2 && !STOP_WORDS.has(word));
}

function calculateSimilarity(tokensA: string[], tokensB: string[]): number {
  const setA = new Set(tokensA);
  const setB = new Set(tokensB);
  
  if (setA.size === 0 || setB.size === 0) return 0;
  
  let intersection = 0;
  for (const token of setA) {
    if (setB.has(token)) intersection++;
  }
  
  const union = setA.size + setB.size - intersection;
  return intersection / union;
}

function extractKeywords(stories: Story[]): string {
  const wordCounts = new Map<string, number>();
  
  for (const story of stories) {
    const tokens = tokenize(story.title + ' ' + story.summary);
    for (const token of tokens) {
      wordCounts.set(token, (wordCounts.get(token) || 0) + 1);
    }
  }
  
  const sortedWords = Array.from(wordCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(entry => entry[0]);
    
  return sortedWords.join(' ') || 'General News';
}

export async function selectTopics(stories: Story[]): Promise<TopicGroup[]> {
  console.log(`[SELECTOR] Received ${stories.length} stories for processing`);
  
  // 1. Group stories using keyword and title similarity
  const groups: Story[][] = [];
  const SIMILARITY_THRESHOLD = 0.08; // Jaccard similarity threshold

  for (const story of stories) {
    const storyTokens = tokenize(story.title + ' ' + story.summary);
    let matchedGroup: Story[] | null = null;
    let maxSimilarity = 0;

    for (const group of groups) {
      // Check similarity against the first story in the group (or all and average)
      let totalSimilarity = 0;
      for (const groupStory of group) {
        const groupStoryTokens = tokenize(groupStory.title + ' ' + groupStory.summary);
        totalSimilarity += calculateSimilarity(storyTokens, groupStoryTokens);
      }
      const avgSimilarity = totalSimilarity / group.length;

      if (avgSimilarity > SIMILARITY_THRESHOLD && avgSimilarity > maxSimilarity) {
        maxSimilarity = avgSimilarity;
        matchedGroup = group;
      }
    }

    if (matchedGroup) {
      matchedGroup.push(story);
    } else {
      groups.push([story]);
    }
  }

  // 2. Score each topic group
  const scoredGroups: TopicGroup[] = groups.map(group => {
    const uniqueSources = new Set(group.map(s => s.source_name)).size;
    
    const englishCount = group.filter(s => s.language === 'en').length;
    const hebrewCount = group.filter(s => s.language === 'he').length;
    
    // Gap opportunity: High English coverage, low/no Hebrew coverage
    const isGapOpportunity = englishCount >= 2 && hebrewCount <= 1;
    
    // Calculate recency score (closer to now is better)
    const now = Date.now();
    const averageAgeHours = group.reduce((sum, story) => {
      return sum + (now - story.published_at.getTime()) / (1000 * 60 * 60);
    }, 0) / group.length;
    
    // Relevance scoring
    let relevanceScore = 0;
    for (const story of group) {
      const text = (story.title + ' ' + story.summary).toLowerCase();
      
      const hasIsraelKeyword = israelKeywords.some(kw => text.includes(kw));
      if (hasIsraelKeyword) relevanceScore += 3;
      
      const hasFinanceKeyword = financeKeywords.some(kw => text.includes(kw));
      if (hasFinanceKeyword) relevanceScore += 1;
    }

    // Scoring logic:
    // Base score = number of unique sources
    // Gap bonus = 5 points
    // Recency penalty = minus 0.1 for every hour old
    let score = uniqueSources;
    if (isGapOpportunity) score += 5;
    score -= (averageAgeHours * 0.1);
    
    // Apply relevance blending and penalty
    score = score * (1 + relevanceScore / 10);
    if (relevanceScore === 0) {
      score *= 0.5; // 50% penalty for zero relevance
    }

    // Source concentration penalty
    const sourceCounts = new Map<string, number>();
    group.forEach(s => {
      sourceCounts.set(s.source_name, (sourceCounts.get(s.source_name) || 0) + 1);
    });
    
    let maxSourceCount = 0;
    for (const count of sourceCounts.values()) {
      if (count > maxSourceCount) maxSourceCount = count;
    }
    
    const maxSourcePercentage = maxSourceCount / group.length;
    if (maxSourcePercentage > 0.70) {
      score *= 0.7; // 30% penalty
    }

    return {
      topic_name: extractKeywords(group),
      stories: group,
      gap_score: isGapOpportunity,
      score,
      relevanceScore
    };
  });

  // Tiered Fallback Logic
  const preferredGroups = scoredGroups.filter(g => {
    const uniqueSources = new Set(g.stories.map(s => s.source_name)).size;
    return uniqueSources >= 2;
  });
  preferredGroups.sort((a, b) => (b.score || 0) - (a.score || 0));

  const singleSourceGroups = scoredGroups.filter(g => {
    const uniqueSources = new Set(g.stories.map(s => s.source_name)).size;
    if (uniqueSources >= 2) return false;
    if ((g.relevanceScore || 0) === 0) return false;
    
    const sourceName = g.stories[0].source_name;
    return sourceName === 'Financial Times' || sourceName.includes('Google News');
  });
  singleSourceGroups.sort((a, b) => (b.score || 0) - (a.score || 0));

  const finalGroups: TopicGroup[] = [];
  
  for (const g of preferredGroups) {
    if (finalGroups.length >= 2) break;
    g.fallback_tier = 'Preferred (2+ sources)';
    finalGroups.push(g);
  }
  
  for (const g of singleSourceGroups) {
    if (finalGroups.length >= 2) break;
    g.fallback_tier = 'Fallback 1 (Single source, approved publisher)';
    finalGroups.push(g);
  }

  // Standalone topic fallback
  if (finalGroups.length < 2) {
    console.log('[SELECTOR] WARNING: falling back to individual story selection');
    
    const usedStoryUrls = new Set<string>();
    finalGroups.forEach(g => g.stories.forEach(s => usedStoryUrls.add(s.url)));
    
    const availableStories = stories.filter(s => !usedStoryUrls.has(s.url));
    
    const scoredStories = availableStories.map(story => {
      let relScore = 0;
      const text = (story.title + ' ' + story.summary).toLowerCase();
      if (israelKeywords.some(kw => text.includes(kw))) relScore += 3;
      if (financeKeywords.some(kw => text.includes(kw))) relScore += 1;
      return { story, relScore };
    });
    
    scoredStories.sort((a, b) => b.relScore - a.relScore);
    
    for (const { story, relScore } of scoredStories) {
      if (finalGroups.length >= 2) break;
      finalGroups.push({
        topic_name: extractKeywords([story]),
        stories: [story],
        gap_score: false, // Single story can't have a true gap score
        score: relScore,
        fallback_tier: 'Fallback 2 (Standalone story)',
        relevanceScore: relScore
      });
    }
  }

  console.log(`[SELECTOR] Selected ${finalGroups.length} topic groups`);
  return finalGroups;
}
