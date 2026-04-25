import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function generateArticleImage(
  articleTitle: string,
  topicName: string,
  metaDescription: string
): Promise<string | null> {
  try {
    console.log(`[IMAGE] Generating prompt for: ${articleTitle}`);
    
    // Step 1 — Generate image prompt using GPT-4o-mini
    const promptResponse = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 300,
      messages: [
        {
          role: 'system',
          content: `You are a photojournalism art director for an Israeli financial news website. Given a Hebrew article title and description, write a prompt for gpt-image-2 that produces a REALISTIC news photograph — not an illustration, not a stock photo.

Follow these exact rules from OpenAI's prompting guide:
- Write the prompt as if describing a real photo being captured in the moment
- Use photography language: "shot on 35mm film", "50mm lens", "shallow depth of field", "natural window light", "candid moment"
- Ask for real texture: skin pores, fabric wear, imperfections, natural expressions
- Avoid: studio polish, staged poses, perfect symmetry, floating graphics, glowing charts
- Include Israeli context: Tel Aviv streets, Israeli shekel bills, Israeli bank branches, Israeli apartment buildings, local supermarkets, Israeli businesspeople in casual meetings
- Start prompt with: "Photorealistic candid photograph,"
- End prompt with: "Shot on 35mm film, natural light, no filters, honest and unposed."
- Maximum 120 words total`
        },
        {
          role: 'user',
          content: `Article title: ${articleTitle}\nDescription: ${metaDescription}`
        }
      ]
    });

    const imagePrompt = promptResponse.choices[0].message.content?.trim() ?? '';
    console.log(`[IMAGE] Prompt: ${imagePrompt}`);

    // Step 2 — Generate image using gpt-image-2
    console.log('[IMAGE] Calling OpenAI Image API...');
    const imageResponse = await openai.images.generate({
      model: 'gpt-image-2' as any,
      prompt: imagePrompt,
      size: '1536x1024' as any,
      quality: 'medium' as any,
      response_format: 'b64_json'
    } as any);

    const base64Image = imageResponse.data[0].b64_json;
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
