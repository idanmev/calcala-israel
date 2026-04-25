import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

async function getGoogleAccessToken(): Promise<string> {
  const { SignJWT, importPKCS8 } = await import('jose');
  
  const serviceAccount = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON!);
  const now = Math.floor(Date.now() / 1000);
  const privateKey = await importPKCS8(serviceAccount.private_key, 'RS256');
  const jwt = await new SignJWT({
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  })
    .setProtectedHeader({ alg: 'RS256' })
    .sign(privateKey);

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  const data = await res.json() as any;
  if (!data.access_token) throw new Error(`Token error: ${JSON.stringify(data)}`);
  return data.access_token;
}

async function generateImagePrompt(articleTitle: string, metaDescription: string): Promise<string> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      system: 'You are an image prompt writer for a news website. Given a Hebrew article title and description, write a photorealistic image generation prompt in English for a professional news photo. No politicians, no flags, no protests, no violence. Focus on symbolic financial/economic imagery — money, buildings, graphs, people working, markets. Return only the prompt, maximum 80 words. If the topic is sensitive or violent, return a generic prompt for "Israeli financial district with modern skyscrapers and business people".',
      messages: [{ role: 'user', content: `Title: ${articleTitle}\nDescription: ${metaDescription}` }],
    }),
  });
  const data = await response.json() as any;
  const prompt = data.content[0].text.trim();
  
  // Safety check: if Claude still refuses or mentions refusal
  if (prompt.toLowerCase().includes("can't write") || prompt.toLowerCase().includes("subject matter involves")) {
    return "Israeli financial district with modern skyscrapers and professional business environment, high quality photorealistic news photography";
  }
  
  return prompt;
}

export async function generateArticleImage(
  articleTitle: string,
  topicName: string,
  metaDescription: string
): Promise<string | null> {
  try {
    console.log(`[IMAGE] Generating prompt for: ${articleTitle}`);
    const imagePrompt = await generateImagePrompt(articleTitle, metaDescription);
    console.log(`[IMAGE] Prompt: ${imagePrompt}`);

    console.log('[IMAGE] Getting Google access token...');
    const accessToken = await getGoogleAccessToken();

    console.log('[IMAGE] Calling Imagen API...');
    const imagenResponse = await fetch(
      'https://us-central1-aiplatform.googleapis.com/v1/projects/calcala-news/locations/us-central1/publishers/google/models/imagen-3.0-generate-002:predict',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          instances: [{ prompt: imagePrompt }],
          parameters: {
            sampleCount: 1,
            aspectRatio: '16:9',
            safetyFilterLevel: 'block_few',
            personGeneration: 'allow_adult',
          },
        }),
      }
    );

    const imagenData = await imagenResponse.json() as any;
    console.log('[IMAGE] Imagen response status:', imagenResponse.status);

    if (!imagenResponse.ok) {
      console.error('[IMAGE] Imagen API error:', JSON.stringify(imagenData));
      return null;
    }

    const base64Image = imagenData?.predictions?.[0]?.bytesBase64Encoded;
    if (!base64Image) {
      console.error('[IMAGE] No image in response:', JSON.stringify(imagenData));
      return null;
    }

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
