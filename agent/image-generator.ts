import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

// ---------------------------------------------------------------------------
// OpenAI client (used for keyword extraction + AI fallback)
// ---------------------------------------------------------------------------
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ---------------------------------------------------------------------------
// Category templates for the AI fallback path
// ---------------------------------------------------------------------------
const categoryTemplates: Record<string, string> = {
  'shuk-hahon': 'Photorealistic newswire photograph from the Tel Aviv Stock Exchange trading floor, taken with a Canon 5D and 35mm lens. Mid-day natural fluorescent lighting, Israeli traders in business shirts looking at large monitors showing red and green numbers, documentary photojournalism tone, Reuters/AP news style, muted colors, no dramatic cinematic lighting, no stock-photo posing.',
  'mishkantaot-venadlan': 'Realistic press-style photograph of an Israeli apartment building or real estate scene, natural daylight, slightly overcast, documentary style, rule of thirds composition, looks like a wire-service news photo, no artistic filters.',
  'pensiya-vechasachon': 'Photographic news image of an Israeli couple in their 50s reviewing financial documents at a kitchen table, shot on 50mm lens at eye level, natural window light, realistic, no posed smiles, documentary photojournalism tone.',
  'misuy': 'Realistic documentary photograph of Israeli tax office or accountant meeting, natural office lighting, 35mm lens, Reuters/AP style, no stock-photo posing.',
  'bri-ut': 'Photorealistic news photograph inside an Israeli clinic or pharmacy, natural fluorescent lighting, 50mm lens, documentary style, Reuters/AP wire photo look.',
  'default': 'Photorealistic newswire photograph related to Israeli economy and finance, natural lighting, 35mm lens, documentary photojournalism style, Reuters/AP news wire look, no studio lighting, no posed corporate handshake, no infographics, no floating icons.'
};

// ---------------------------------------------------------------------------
// Step 1 — Extract English search keywords using GPT-4o-mini
// ---------------------------------------------------------------------------
async function extractSearchKeywords(articleTitle: string): Promise<string> {
  try {
    const keywordResponse = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 50,
      messages: [
        {
          role: 'system',
          content: `Extract 2-3 English search keywords from this Hebrew article title for finding a relevant news photo. Return only keywords, nothing else. Rules:
- For stories about Israeli economy/finance: include "Israel" as one keyword
- For interest rates: use "interest rate bank"
- For real estate: use "Israel apartment" or "Tel Aviv building"
- For stock market: use "stock market trading"
- For cost of living: use "supermarket prices Israel"
- For pension/savings: use "retirement savings"
- For tax: use "tax Israel"
- Never return Hebrew characters
- Maximum 4 words total`
        },
        {
          role: 'user',
          content: articleTitle
        }
      ]
    });
    const query = keywordResponse.choices[0].message.content?.trim() ?? 'Israel economy';
    console.log(`[IMAGE] Search keywords: ${query}`);
    return query;
  } catch (err: any) {
    console.warn(`[IMAGE] Keyword extraction failed: ${err.message}. Using fallback.`);
    return 'Israel economy finance';
  }
}

// ---------------------------------------------------------------------------
// Step 2 — Try Pexels API
// ---------------------------------------------------------------------------
async function searchPexels(query: string): Promise<string | null> {
  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey) {
    console.log('[IMAGE] PEXELS_API_KEY not set, skipping.');
    return null;
  }
  try {
    const response = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=5&orientation=landscape`,
      { headers: { Authorization: apiKey } }
    );
    const data = await response.json() as any;
    if (data.photos && data.photos.length > 0) {
      const photo = data.photos[0];
      console.log(`[IMAGE] Pexels found: ${photo.url}`);
      return photo.src.large2x;
    }
    console.log('[IMAGE] Pexels: no results found.');
    return null;
  } catch (err: any) {
    console.warn(`[IMAGE] Pexels error: ${err.message}`);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Step 3 — Try Openverse (Creative Commons, no key required)
// ---------------------------------------------------------------------------
async function searchOpenverse(query: string): Promise<string | null> {
  try {
    const response = await fetch(
      `https://api.openverse.org/v1/images/?q=${encodeURIComponent(query)}&license_type=commercial&mature=false&page_size=5&orientation=landscape`,
      {
        headers: {
          'User-Agent': 'calcala-news-agent/1.0 (calcala-news.co.il)'
        }
      }
    );
    const data = await response.json() as any;
    if (data.results && data.results.length > 0) {
      const photo = data.results[0];
      const imageUrl = photo.url;
      console.log(`[IMAGE] Openverse found: ${imageUrl} (license: ${photo.license})`);
      return imageUrl;
    }
    console.log('[IMAGE] Openverse: no results found.');
    return null;
  } catch (err: any) {
    console.warn(`[IMAGE] Openverse error: ${err.message}`);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Step 4 — Try Unsplash API
// ---------------------------------------------------------------------------
async function searchUnsplash(query: string): Promise<string | null> {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY;
  if (!accessKey) {
    console.log('[IMAGE] UNSPLASH_ACCESS_KEY not set, skipping.');
    return null;
  }
  try {
    const response = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=5&orientation=landscape`,
      { headers: { Authorization: `Client-ID ${accessKey}` } }
    );
    const data = await response.json() as any;
    if (data.results && data.results.length > 0) {
      const photo = data.results[0];
      console.log(`[IMAGE] Unsplash found: ${photo.urls.regular}`);
      return photo.urls.regular;
    }
    console.log('[IMAGE] Unsplash: no results found.');
    return null;
  } catch (err: any) {
    console.warn(`[IMAGE] Unsplash error: ${err.message}`);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Step 5 — Try Pixabay API
// ---------------------------------------------------------------------------
async function searchPixabay(query: string): Promise<string | null> {
  const apiKey = process.env.PIXABAY_API_KEY;
  if (!apiKey) {
    console.log('[IMAGE] PIXABAY_API_KEY not set, skipping.');
    return null;
  }
  try {
    const response = await fetch(
      `https://pixabay.com/api/?key=${apiKey}&q=${encodeURIComponent(query)}&image_type=photo&orientation=horizontal&per_page=5&safesearch=true`
    );
    const data = await response.json() as any;
    if (data.hits && data.hits.length > 0) {
      console.log(`[IMAGE] Pixabay found: ${data.hits[0].webformatURL}`);
      return data.hits[0].largeImageURL;
    }
    console.log('[IMAGE] Pixabay: no results found.');
    return null;
  } catch (err: any) {
    console.warn(`[IMAGE] Pixabay error: ${err.message}`);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Step 6 — Upload image from URL to Supabase Storage
// ---------------------------------------------------------------------------
async function uploadImageFromUrl(imageUrl: string, fileName: string): Promise<string | null> {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      console.error(`[IMAGE] Failed to download image from: ${imageUrl} (status ${response.status})`);
      return null;
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

    // Ensure bucket exists
    const { data: buckets } = await supabase.storage.listBuckets();
    const bucketExists = buckets?.some(b => b.name === 'article-images');
    if (!bucketExists) {
      await supabase.storage.createBucket('article-images', { public: true });
      console.log('[IMAGE] Created article-images bucket');
    }

    const { error } = await supabase.storage
      .from('article-images')
      .upload(fileName, buffer, { contentType: 'image/jpeg', upsert: false });

    if (error) {
      console.error('[IMAGE] Upload error:', JSON.stringify(error));
      return null;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('article-images')
      .getPublicUrl(fileName);

    console.log(`[IMAGE] Uploaded to Supabase: ${publicUrl}`);
    return publicUrl;
  } catch (err: any) {
    console.error(`[IMAGE] uploadImageFromUrl error: ${err.message}`);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Step 7 — AI fallback: generate with gpt-image-1
// ---------------------------------------------------------------------------
async function generateWithAI(
  articleTitle: string,
  metaDescription: string,
  categorySlug: string
): Promise<string | null> {
  try {
    console.log(`[IMAGE] Generating AI image for: ${articleTitle} (Category: ${categorySlug})`);

    const template = categoryTemplates[categorySlug] || categoryTemplates['default'];

    const promptResponse = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 300,
      messages: [
        {
          role: 'system',
          content: `You are a photojournalism art director. Given a base image template and a specific article, write a final gpt-image-1 prompt that adapts the template with story-specific details. Keep the photojournalistic style. Add 1-2 specific visual details from the article (e.g. "screens show shekel weakening", "shelves with rising price tags"). Maximum 150 words. Start with "Photorealistic candid photograph," and end with "No studio lighting, no posed smiles, no floating graphics, no text overlays."`
        },
        {
          role: 'user',
          content: `Base Template: ${template}\n\nArticle Title: ${articleTitle}\nDescription: ${metaDescription}`
        }
      ]
    });

    const imagePrompt = promptResponse.choices[0].message.content?.trim() ?? '';
    console.log(`[IMAGE] AI prompt: ${imagePrompt}`);

    console.log('[IMAGE] Calling OpenAI Image API (gpt-image-1)...');
    const imageResponse = await openai.images.generate({
      model: 'gpt-image-1' as any,
      prompt: imagePrompt,
      size: '1536x1024' as any,
      quality: 'medium' as any,
      output_format: 'png' as any
    } as any);

    const base64Image = (imageResponse.data[0] as any).b64_json;
    if (!base64Image) {
      console.error('[IMAGE] No image in AI response');
      return null;
    }

    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
    const imageBuffer = Buffer.from(base64Image, 'base64');

    const sanitizedTitle = articleTitle.replace(/[^\x00-\x7F]/g, '').replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-').toLowerCase();
    const fileName = `${Date.now()}-${sanitizedTitle.slice(0, 30) || 'ai-article-image'}.png`;

    const { data: buckets } = await supabase.storage.listBuckets();
    const bucketExists = buckets?.some(b => b.name === 'article-images');
    if (!bucketExists) {
      await supabase.storage.createBucket('article-images', { public: true });
      console.log('[IMAGE] Created article-images bucket');
    }

    const { error: uploadError } = await supabase.storage
      .from('article-images')
      .upload(fileName, imageBuffer, { contentType: 'image/png', upsert: false });

    if (uploadError) {
      console.error('[IMAGE] AI image upload error:', JSON.stringify(uploadError));
      return null;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('article-images')
      .getPublicUrl(fileName);

    console.log(`[IMAGE] AI image uploaded: ${publicUrl}`);
    return publicUrl;

  } catch (err: any) {
    console.error(`[IMAGE] AI generation error: ${err.message}`);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Main export — waterfall: Pexels → Openverse → Unsplash → Pixabay → AI
// ---------------------------------------------------------------------------
export async function generateArticleImage(
  articleTitle: string,
  topicName: string,
  metaDescription: string,
  categorySlug: string | null
): Promise<string | null> {
  try {
    const searchQuery = await extractSearchKeywords(articleTitle);
    const sanitizedTopic = topicName.replace(/[^a-zA-Z0-9]/g, '-').slice(0, 30);
    const fileName = `${Date.now()}-${sanitizedTopic || 'article'}.jpg`;

    // 1. Pexels
    console.log('[IMAGE] Trying Pexels...');
    const pexelsUrl = await searchPexels(searchQuery);
    if (pexelsUrl) {
      const uploaded = await uploadImageFromUrl(pexelsUrl, fileName);
      if (uploaded) return uploaded;
    }

    // 2. Openverse (Creative Commons, no key needed)
    console.log('[IMAGE] Trying Openverse...');
    const openverseUrl = await searchOpenverse(searchQuery);
    if (openverseUrl) {
      const uploaded = await uploadImageFromUrl(openverseUrl, fileName);
      if (uploaded) return uploaded;
    }

    // 3. Unsplash
    console.log('[IMAGE] Trying Unsplash...');
    const unsplashUrl = await searchUnsplash(searchQuery);
    if (unsplashUrl) {
      const uploaded = await uploadImageFromUrl(unsplashUrl, fileName);
      if (uploaded) return uploaded;
    }

    // 4. Pixabay
    console.log('[IMAGE] Trying Pixabay...');
    const pixabayUrl = await searchPixabay(searchQuery);
    if (pixabayUrl) {
      const uploaded = await uploadImageFromUrl(pixabayUrl, fileName);
      if (uploaded) return uploaded;
    }

    // 5. AI fallback
    console.log('[IMAGE] All free sources failed — falling back to gpt-image-1...');
    return await generateWithAI(articleTitle, metaDescription, categorySlug || 'default');

  } catch (err: any) {
    console.error('[IMAGE] Error:', err.message);
    return null;
  }
}
