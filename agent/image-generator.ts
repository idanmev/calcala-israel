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
        system: `You are an image prompt writer for a news website. Given a Hebrew article title and description, write a photorealistic image generation prompt in English that would work as a professional news photo for this article. The image must be safe for work, non-violent, non-political (no politicians, no flags, no protests). Focus on symbolic, conceptual, or lifestyle imagery that represents the financial topic. Maximum 100 words. Return only the prompt, nothing else. If you cannot generate a prompt due to safety reasons (e.g. violence), return a generic but relevant prompt about "Israeli economy" or "finance news" instead of a refusal.`,
        messages: [{
          role: 'user',
          content: `Title: ${articleTitle}\nDescription: ${metaDescription}\nTopic: ${topicName}`
        }]
      });
      const contentBlock: any = response.content[0];
      generatedPrompt = contentBlock.text ? contentBlock.text.trim() : '';
      
      // Basic check for Claude refusal
      if (generatedPrompt.toLowerCase().includes("i can't") || generatedPrompt.toLowerCase().includes("sorry")) {
        console.warn("[IMAGE] Claude refused, using fallback prompt");
        generatedPrompt = "A professional, symbolic image representing the Israeli economy and financial news, high quality photorealistic, neutral corporate setting.";
      }
      
      console.log(`[IMAGE] Prompt: ${generatedPrompt}`);
    } catch (promptErr) {
      console.error("[IMAGE] Failed to generate prompt with Claude:", promptErr);
      return null;
    }

    if (!generatedPrompt) {
      console.error("[IMAGE] Generated prompt is empty");
      return null;
    }

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

      // Using Imagen 3.0 (generate-001) as 3.0 is the current standard stable version.
      // EOL for 006 (Imagen 2) was the issue.
      const endpoint = `projects/calcala-news/locations/us-central1/publishers/google/models/imagen-3.0-generate-001`;
      const parameters = helpers.toValue({
        sampleCount: 1,
        aspectRatio: "16:9",
        personGeneration: "dont_allow"
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

      console.log(`[IMAGE] Sending prediction request to Vertex AI (Model: imagen-3.0-generate-001)...`);
      const predictPromise = predictionServiceClient.predict(request);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Imagen API request timed out after 60s")), 60000)
      );

      const [imagenResponse] = await Promise.race([predictPromise, timeoutPromise]) as any;
      
      if (!imagenResponse || !imagenResponse.predictions || imagenResponse.predictions.length === 0) {
        console.error("[IMAGE] No predictions returned from Imagen. Full response:", JSON.stringify(imagenResponse, null, 2));
        throw new Error("No predictions returned from Imagen");
      }
      
      // Extract base64. 
      const prediction = imagenResponse.predictions[0];
      
      // Imagen 3.0 response format handling
      if (prediction.bytesBase64Encoded) {
        base64Image = prediction.bytesBase64Encoded;
      } else if (prediction.structValue?.fields?.bytesBase64Encoded?.stringValue) {
        base64Image = prediction.structValue.fields.bytesBase64Encoded.stringValue;
      } else if (prediction.stringValue) {
        // Fallback for some SDK versions where the string itself is the base64
        base64Image = prediction.stringValue;
      } else {
        console.error("[IMAGE] Could not find base64 image in prediction. Keys found:", Object.keys(prediction));
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

      if (!supabaseUrl || !supabaseKey) {
        throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
      }

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

      if (uploadError) {
        console.error("[IMAGE] Supabase upload failed:", uploadError);
        throw uploadError;
      }

      const { data: urlData } = supabase.storage.from(bucketName).getPublicUrl(fileName);
      const publicUrl = urlData.publicUrl;

      console.log(`[IMAGE] Uploaded: ${publicUrl}`);
      return publicUrl;
    } catch (storageErr) {
      console.error("[IMAGE] Supabase Storage operation failed:", storageErr);
      return null;
    }

  } catch (error) {
    console.error(`[IMAGE] Fatal error in generateArticleImage:`, error);
    return null;
  }
}
