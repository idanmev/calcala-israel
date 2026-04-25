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
    if (!apiKey) {
      console.error("[IMAGE] Missing ANTHROPIC_API_KEY");
      return null;
    }
    
    const anthropic = new Anthropic({ apiKey });
    
    let generatedPrompt = '';
    try {
      const response = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 150,
        system: `You are an image prompt writer for a news website. Given a Hebrew article title and description, write a photorealistic image generation prompt in English that would work as a professional news photo for this article. The image must be safe for work, non-violent, non-political. Focus on symbolic, conceptual, or lifestyle imagery that represents the financial topic. Maximum 100 words. Return only the prompt, nothing else. If the topic is sensitive (violence, war), generate a generic "Israeli business/finance" prompt instead of refusing.`,
        messages: [{
          role: 'user',
          content: `Title: ${articleTitle}\nDescription: ${metaDescription}\nTopic: ${topicName}`
        }]
      });
      const contentBlock: any = response.content[0];
      generatedPrompt = contentBlock.text ? contentBlock.text.trim() : '';
      
      if (generatedPrompt.toLowerCase().includes("i can't") || generatedPrompt.toLowerCase().includes("sorry")) {
        console.warn("[IMAGE] Claude refusal detected, using fallback.");
        generatedPrompt = "A professional, symbolic image representing the Israeli economy and financial news, high quality photorealistic, neutral corporate setting.";
      }
      
      console.log(`[IMAGE] Prompt: ${generatedPrompt}`);
    } catch (promptErr) {
      console.error("[IMAGE] Failed to generate prompt with Claude:", promptErr);
      return null;
    }

    if (!generatedPrompt) return null;

    console.log(`[IMAGE] Calling Imagen API...`);

    // 2. Call Vertex AI Imagen
    if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
      console.error("[IMAGE] Missing GOOGLE_SERVICE_ACCOUNT_JSON");
      return null;
    }

    let base64Image = '';
    try {
      const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
      
      const predictionServiceClient = new PredictionServiceClient({
        apiEndpoint: 'us-central1-aiplatform.googleapis.com',
        credentials
      });

      const endpoint = `projects/calcala-news/locations/us-central1/publishers/google/models/imagen-3.0-generate-001`;
      
      const instances = [
        helpers.toValue({
          prompt: generatedPrompt
        })
      ];

      const parameters = helpers.toValue({
        sampleCount: 1,
        aspectRatio: "16:9",
        personGeneration: "dont_allow"
      });

      const request = {
        endpoint,
        instances,
        parameters,
      };

      console.log(`[IMAGE] Sending prediction request to Vertex AI...`);
      const [imagenResponse] = await predictionServiceClient.predict(request) as any;
      
      if (!imagenResponse || !imagenResponse.predictions || imagenResponse.predictions.length === 0) {
        console.error("[IMAGE] Empty predictions from Imagen. Full response:", JSON.stringify(imagenResponse));
        // Try one more time with a very simple prompt if it failed
        console.log("[IMAGE] Retrying with extremely simple prompt...");
        const retryRequest = {
          endpoint,
          instances: [helpers.toValue({ prompt: "A golden coin on a clean white professional background, high quality photography." })],
          parameters
        };
        const [retryResponse] = await predictionServiceClient.predict(retryRequest) as any;
        if (!retryResponse || !retryResponse.predictions || retryResponse.predictions.length === 0) {
           throw new Error("Imagen failed even with simple prompt");
        }
        const prediction = helpers.fromValue(retryResponse.predictions[0]) as any;
        base64Image = prediction.bytesBase64Encoded || prediction.stringValue;
      } else {
        const prediction = helpers.fromValue(imagenResponse.predictions[0]) as any;
        console.log(`[IMAGE] Prediction keys after fromValue: ${Object.keys(prediction)}`);
        base64Image = prediction.bytesBase64Encoded || prediction.stringValue;
      }

      if (!base64Image) {
        throw new Error("Could not find base64 image in Imagen response");
      }

      console.log(`[IMAGE] Image generated successfully (base64 length: ${base64Image.length})`);
    } catch (imagenErr) {
      console.error("[IMAGE] Imagen API call failed:", imagenErr);
      return null;
    }

    // 3. Upload to Supabase Storage
    console.log(`[IMAGE] Uploading to Supabase Storage...`);
    try {
      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
      if (!supabaseUrl || !supabaseKey) throw new Error('Missing Supabase credentials');

      const supabase = createClient(supabaseUrl, supabaseKey);
      const bucketName = 'article-images';

      const buffer = Buffer.from(base64Image, 'base64');
      const slug = createSlug(articleTitle);
      const fileName = `${Date.now()}-${slug}.png`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(fileName, buffer, { 
          contentType: 'image/png',
          upsert: true
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from(bucketName).getPublicUrl(fileName);
      const publicUrl = urlData.publicUrl;

      console.log(`[IMAGE] Uploaded: ${publicUrl}`);
      return publicUrl;
    } catch (storageErr) {
      console.error("[IMAGE] Supabase Storage failed:", storageErr);
      return null;
    }

  } catch (error) {
    console.error(`[IMAGE] Fatal error:`, error);
    return null;
  }
}
