import fs from 'fs';
import { generateArticleImage } from '../agent/image-generator';

// Manually set env vars for local test
process.env.GOOGLE_SERVICE_ACCOUNT_JSON = fs.readFileSync('/Users/idanmevasem/Downloads/calcala-news-f7b3e1bd4c77.json', 'utf8');
// The others should be in .env
import dotenv from 'dotenv';
dotenv.config();

async function test() {
  const url = await generateArticleImage(
    "Test Article Title",
    "Test Topic",
    "This is a test meta description for an article about the Israeli economy and finance."
  );
  console.log("RESULT URL:", url);
}

test();
