import { createClient } from '@supabase/supabase-js';
import { PredictionServiceClient, helpers } from '@google-cloud/aiplatform';
import Anthropic from '@anthropic-ai/sdk';

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
  return transliterated
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
    .slice(0, 50);
}

export async function generateArticleImage(
  articleTitle: string,
  topicName: string,
  metaDescription: string
): Promise<string | null> {
  try {
    console.log(`[IMAGE] Generating prompt for: ${articleTitle}`);

    // 1. Generate Prompt using Claude
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("Missing ANTHROPIC_API_KEY");
    
    const anthropic = new Anthropic({ apiKey });
    
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 150,
      system: `You are an image prompt writer for a news website. Given a Hebrew article title and description, write a photorealistic image generation prompt in English that would work as a professional news photo for this article. The image must be safe for work, non-violent, non-political (no politicians, no flags, no protests). Focus on symbolic, conceptual, or lifestyle imagery that represents the financial topic. Maximum 100 words. Return only the prompt, nothing else.`,
      messages: [{
        role: 'user',
        content: `Title: ${articleTitle}\nDescription: ${metaDescription}\nTopic: ${topicName}`
      }]
    });

    const contentBlock: any = response.content[0];
    const generatedPrompt = contentBlock.text ? contentBlock.text.trim() : '';
    
    console.log(`[IMAGE] Prompt: ${generatedPrompt}`);
    console.log(`[IMAGE] Calling Imagen 4...`);

    // 2. Call Vertex AI Imagen 4
    if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
      throw new Error("Missing GOOGLE_SERVICE_ACCOUNT_JSON");
    }

    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
    
    const predictionServiceClient = new PredictionServiceClient({
      apiEndpoint: 'us-central1-aiplatform.googleapis.com',
      credentials
    });

    const endpoint = `projects/calcala-news/locations/us-central1/publishers/google/models/imagegeneration@006`;
    const parameters = helpers.toValue({
      sampleCount: 1,
      aspectRatio: "16:9",
      personGeneration: "DONT_ALLOW"
    });
    
    const instances = [
      helpers.toValue({
        prompt: generatedPrompt
      })
    ];

    const request = {
      endpoint,
      instances,
      parameters,
    };

    const [imagenResponse] = await predictionServiceClient.predict(request);
    
    if (!imagenResponse.predictions || imagenResponse.predictions.length === 0) {
      throw new Error("No predictions returned from Imagen 4");
    }
    
    // @ts-ignore
    const base64Image = imagenResponse.predictions[0].structValue.fields.bytesBase64Encoded.stringValue;
    if (!base64Image) {
      throw new Error("Missing bytesBase64Encoded in prediction response");
    }

    console.log(`[IMAGE] Image generated, uploading to Supabase Storage...`);

    // 3. Upload to Supabase Storage
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const bucketName = 'article-images';

    const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
    if (bucketError) throw bucketError;
    
    if (!buckets?.find(b => b.name === bucketName)) {
      await supabase.storage.createBucket(bucketName, { public: true });
    }

    const buffer = Buffer.from(base64Image, 'base64');
    const slug = createSlug(articleTitle);
    const fileName = `${Date.now()}-${slug}.png`;

    const { error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(fileName, buffer, { contentType: 'image/png' });

    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage.from(bucketName).getPublicUrl(fileName);
    const publicUrl = urlData.publicUrl;

    console.log(`[IMAGE] Uploaded: ${publicUrl}`);
    return publicUrl;

  } catch (error) {
    console.error(`[IMAGE] Error during image generation:`, error);
    return null;
  }
}
