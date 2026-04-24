import { createClient } from '@supabase/supabase-js';

// Transliteration map for Hebrew to Latin
const HEBREW_TO_LATIN: Record<string, string> = {
  'א': 'a', 'ב': 'b', 'ג': 'g', 'ד': 'd', 'ה': 'h', 'ו': 'v', 'ז': 'z',
  'ח': 'ch', 'ט': 't', 'י': 'y', 'כ': 'k', 'ל': 'l', 'מ': 'm', 'נ': 'n',
  'ס': 's', 'ע': 'a', 'פ': 'p', 'צ': 'tz', 'ק': 'k', 'ר': 'r', 'ש': 'sh', 'ת': 't',
  'ך': 'k', 'ם': 'm', 'ן': 'n', 'ף': 'p', 'ץ': 'tz'
};

function transliterate(hebrewString: string): string {
  let result = '';
  for (const char of hebrewString) {
    result += HEBREW_TO_LATIN[char] || char;
  }
  return result;
}

function createSlug(title: string): string {
  const transliterated = transliterate(title);
  const baseSlug = transliterated
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
  
  const shortTimestamp = Date.now().toString(36).slice(-5);
  return `${baseSlug}-${shortTimestamp}`;
}

export interface InserterResult {
  id: string;
  slug: string;
}

export async function insertArticle(
  editorJsBlocks: any[],
  metaDescription: string
): Promise<InserterResult> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY environment variables');
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Extract title from the first Editor.js block (H1)
  let title = 'Untitled Article';
  if (editorJsBlocks && editorJsBlocks.length > 0 && editorJsBlocks[0].type === 'header') {
    title = editorJsBlocks[0].data.text.replace(/<[^>]*>?/gm, ''); // remove html tags just in case
  }

  const slug = createSlug(title);

  console.log(`[INSERTER] Querying categories for matching keywords...`);
  const { data: categories, error: catError } = await supabase
    .from('categories')
    .select('id, name, slug');

  if (catError) {
    console.error('[INSERTER] Error fetching categories:', catError);
  }

  let categoryId = null;
  if (categories && categories.length > 0) {
    try {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) throw new Error("Missing Anthropic API Key for categorization");
      
      // Import anthropic inside the function to avoid circular or missing dependencies if not at top-level
      const Anthropic = require('@anthropic-ai/sdk');
      const client = new Anthropic({ apiKey });

      const categoryListStr = categories.map((c: any) => `- Name: ${c.name}, Slug: ${c.slug}`).join('\n');
      
      const response = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 200,
        system: `You are a content categorization assistant. Given an article title and description, and a list of available categories, return only the slug of the single most relevant category. Return only the slug string, nothing else.

Category assignment rules:
- Oil prices, commodities, global markets → שוק-ההון
- Interest rates, Bank of Israel decisions → משכנתאות-ונדלן OR פנסיה-וחסכון depending on context
- Cost of living, inflation, consumer prices → כללי or the closest match
- Pension, provident funds, savings → פנסיה-וחסכון
- Real estate, mortgages → משכנתאות-ונדלן
- Taxation → מיסוי
- Insurance, health costs → בריאות
- Tech, startups → טכנולוגיה
- Law, regulation → משפט
When in doubt between categories, prefer שוק-ההון for market/economy stories.`,
        messages: [{
          role: 'user',
          content: `Title: ${title}\nDescription: ${metaDescription}\n\nCategories:\n${categoryListStr}`
        }]
      });

      // Handle the content block assuming the first block is text
      const contentBlock: any = response.content[0];
      const returnedSlug = contentBlock.text ? contentBlock.text.trim() : '';
      
      const matchedCategory = categories.find((c: any) => c.slug === returnedSlug);
      
      if (matchedCategory) {
        categoryId = matchedCategory.id;
        console.log(`[INSERTER] AI matched category: ${matchedCategory.name} (id: ${categoryId})`);
      } else {
        throw new Error(`AI returned invalid slug: ${returnedSlug}`);
      }
    } catch (aiErr) {
      console.warn('[INSERTER] AI category matching failed, falling back to keywords:', (aiErr as any).message);
      
      // Simple keyword matching against title
      const titleWords = title.split(/\s+/);
      let bestMatchCount = 0;
      let bestCategory = categories[0];

      for (const category of categories) {
        let matchCount = 0;
        for (const word of titleWords) {
          if (word.length > 2 && (category.name.includes(word) || (category.slug && category.slug.includes(word)))) {
            matchCount++;
          }
        }
        if (matchCount > bestMatchCount) {
          bestMatchCount = matchCount;
          bestCategory = category;
        }
      }
      categoryId = bestCategory.id;
      console.log(`[INSERTER] Fallback selected category: ${bestCategory.name} (id: ${categoryId})`);
    }
  }

  console.log(`[INSERTER] Inserting article with slug: ${slug}`);
  const payload: any = {
    title: title,
    body: { blocks: editorJsBlocks },
    slug: slug,
    status: 'hidden',
    category_id: categoryId,
    author: 'צוות כלכלה ניוז',
    featured_image_url: null,
  };

  // We attempt to include meta_description. Supabase ignores fields that don't exist if not strictly enforced,
  // but to be safe we insert it. If there's an error due to column missing, we should catch and retry without it.
  payload.meta_description = metaDescription;

  let { data, error } = await supabase
    .from('articles')
    .insert([payload])
    .select('id, slug')
    .single();

  if (error && error.message.includes('meta_description')) {
    console.log('[INSERTER] meta_description column likely does not exist, logging it instead and retrying without it.');
    console.log(`[INSERTER] Meta Description: ${metaDescription}`);
    delete payload.meta_description;
    
    const retryResult = await supabase
      .from('articles')
      .insert([payload])
      .select('id, slug')
      .single();
      
    data = retryResult.data;
    error = retryResult.error;
  }

  if (error || !data) {
    throw new Error(`Failed to insert article: ${error?.message || 'Unknown error'}`);
  }

  console.log(`[INSERTER] Article inserted successfully with id: ${data.id}`);
  
  return {
    id: data.id,
    slug: data.slug
  };
}
