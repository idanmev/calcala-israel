import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const categoryTemplates: Record<string, string> = {
  'shuk-hahon': 'Photorealistic newswire photograph from the Tel Aviv Stock Exchange trading floor, taken with a Canon 5D and 35mm lens. Mid-day natural fluorescent lighting, Israeli traders in business shirts looking at large monitors showing red and green numbers, documentary photojournalism tone, Reuters/AP news style, muted colors, no dramatic cinematic lighting, no stock-photo posing.',
  'mishkantaot-venadlan': 'Realistic press-style photograph of an Israeli apartment building or real estate scene, natural daylight, slightly overcast, documentary style, rule of thirds composition, looks like a wire-service news photo, no artistic filters.',
  'pensiya-vechasachon': 'Photographic news image of an Israeli couple in their 50s reviewing financial documents at a kitchen table, shot on 50mm lens at eye level, natural window light, realistic, no posed smiles, documentary photojournalism tone.',
  'misuy': 'Realistic documentary photograph of Israeli tax office or accountant meeting, natural office lighting, 35mm lens, Reuters/AP style, no stock-photo posing.',
  'bri-ut': 'Photorealistic news photograph inside an Israeli clinic or pharmacy, natural fluorescent lighting, 50mm lens, documentary style, Reuters/AP wire photo look.',
  'default': 'Photorealistic newswire photograph related to Israeli economy and finance, natural lighting, 35mm lens, documentary photojournalism style, Reuters/AP news wire look, no studio lighting, no posed corporate handshake, no infographics, no floating icons.'
};

export async function generateArticleImage(
  articleTitle: string,
  topicName: string,
  metaDescription: string,
  categorySlug: string | null
): Promise<string | null> {
  try {
    console.log(`[IMAGE] Generating prompt for: ${articleTitle} (Category: ${categorySlug})`);
    
    const template = categoryTemplates[categorySlug || 'default'] || categoryTemplates['default'];

    // Step 1 — Generate image prompt using GPT-4o-mini
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
    console.log(`[IMAGE] Prompt: ${imagePrompt}`);

    // Step 2 — Generate image using gpt-image-1
    console.log('[IMAGE] Calling OpenAI Image API...');
    const imageResponse = await openai.images.generate({
      model: 'gpt-image-1' as any,
      prompt: imagePrompt,
      size: '1536x1024' as any,
      quality: 'medium' as any,
      output_format: 'png' as any
    } as any);

    const base64Image = (imageResponse.data[0] as any).b64_json;
    if (!base64Image) {
      console.error('[IMAGE] No image in response');
      return null;
    }

    // Step 3 — Upload to Supabase Storage
    console.log('[IMAGE] Uploading to Supabase Storage...');
    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
    const imageBuffer = Buffer.from(base64Image, 'base64');
    
    // Sanitize fileName: remove non-ASCII and non-alphanumeric
    const sanitizedTopic = topicName.replace(/[^\x00-\x7F]/g, '').replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-').toLowerCase();
    const fileName = `${Date.now()}-${sanitizedTopic || 'article-image'}.png`;

    // Ensure bucket exists
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
      console.error('[IMAGE] Upload error:', JSON.stringify(uploadError));
      return null;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('article-images')
      .getPublicUrl(fileName);

    console.log(`[IMAGE] Uploaded: ${publicUrl}`);
    return publicUrl;

  } catch (err: any) {
    console.error('[IMAGE] Error:', err.message);
    return null;
  }
}
