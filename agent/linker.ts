import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

/**
 * Internal Linking Agent for Calcala News
 * Finds relevant existing articles and injects links into the new article body.
 */

export async function addInternalLinks(
  editorjsBlocks: any[],
  articleTitle: string,
  categorySlug: string
): Promise<any[]> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (!supabaseUrl || !supabaseKey || !openaiKey) {
    console.error('[LINKER] Missing environment variables, skipping.');
    return editorjsBlocks;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const openai = new OpenAI({ apiKey: openaiKey });

  try {
    // Step 1 — Fetch candidate articles from Supabase
    const { data: candidates, error } = await supabase
      .from('articles')
      .select('id, title, slug, category_id')
      .eq('status', 'published')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    console.log(`[LINKER] Found ${candidates?.length || 0} published articles`);

    if (!candidates || candidates.length < 3) {
      console.log('[LINKER] Not enough published articles for internal linking, skipping.');
      return editorjsBlocks;
    }

    // Step 2 — Find relevant articles using GPT-4o-mini
    const systemPrompt = `You are an internal linking assistant for a Hebrew financial news website. Given a new article title and a list of existing published articles, select the 2-3 most thematically relevant existing articles that would make sense to link to from the new article. Return only a JSON array of slugs, nothing else. Example: ["slug-one", "slug-two"]`;
    
    const userMessage = `New article: ${articleTitle}

Existing articles (title → slug):
${candidates.map(a => `${a.title} → ${a.slug}`).join('\n')}

Return the 2-3 most relevant slugs as a JSON array.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 500,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ]
    });

    const rawContent = response.choices[0].message.content || '[]';
    let selectedSlugs: string[] = [];
    try {
      selectedSlugs = JSON.parse(rawContent.replace(/```json|```/g, '').trim());
    } catch (e) {
      console.error('[LINKER] Failed to parse GPT response:', rawContent);
      return editorjsBlocks;
    }

    if (!Array.isArray(selectedSlugs) || selectedSlugs.length === 0) {
      console.log('[LINKER] No relevant articles selected, skipping.');
      return editorjsBlocks;
    }

    console.log(`[LINKER] Selected ${selectedSlugs.length} relevant articles to link to`);

    // Get the full article objects for the selected slugs
    const selectedArticles = candidates.filter(a => selectedSlugs.includes(a.slug));
    
    const newBlocks = [...editorjsBlocks];
    const linkedSlugs = new Set<string>();
    const usedParagraphIndices = new Set<number>();
    let totalInjected = 0;

    // Step 3 — Inject links into paragraph blocks
    for (const article of selectedArticles) {
      if (totalInjected >= 3) break;

      let foundMatch = false;
      // Try to find a keyword match in paragraphs
      // We'll search for the title or significant parts of it
      // For Hebrew, we'll try to find the longest common substring or just check if the title exists
      // A more robust way is to check for words of the title
      const titleWords = article.title.split(/\s+/).filter(w => w.length > 3);
      
      for (let i = 0; i < newBlocks.length; i++) {
        const block = newBlocks[i];
        if (block.type !== 'paragraph' || usedParagraphIndices.has(i)) continue;

        let text = block.data.text;
        let matchedKeyword = '';

        // Try exact title match first
        if (text.includes(article.title)) {
          matchedKeyword = article.title;
        } else {
          // Try words
          for (const word of titleWords) {
            if (text.includes(word)) {
              matchedKeyword = word;
              break;
            }
          }
        }

        if (matchedKeyword) {
          const link = `<a href="https://calcala-news.co.il/article.html?slug=${article.slug}">${matchedKeyword}</a>`;
          // Replace only the first occurrence to be safe
          newBlocks[i].data.text = text.replace(matchedKeyword, link);
          usedParagraphIndices.add(i);
          linkedSlugs.add(article.slug);
          totalInjected++;
          foundMatch = true;
          console.log(`[LINKER] Injected link to: ${article.slug} in block ${i}`);
          break;
        }
      }
    }

    // Handle "related articles" for those not matched
    const remainingArticles = selectedArticles.filter(a => !linkedSlugs.has(a.slug));
    if (remainingArticles.length > 0) {
      const links = remainingArticles.map(a => `<a href="https://calcala-news.co.il/article.html?slug=${a.slug}">${a.title}</a>`);
      const relatedBlock = {
        type: 'paragraph',
        data: {
          text: `לקריאה נוספת: ${links.join(', ')}`
        }
      };
      newBlocks.push(relatedBlock);
      console.log(`[LINKER] Added related articles block with ${remainingArticles.length} links`);
    }

    return newBlocks;
  } catch (error) {
    console.error('[LINKER] Error in internal linking:', error);
    return editorjsBlocks;
  }
}
