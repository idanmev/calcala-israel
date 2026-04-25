import OpenAI from "openai";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WriterOutput {
  editorjs: any[];
  meta_description: string;
}

/** A single shell returned by Stage 1 — describes one block to be written. */
interface BlockShell {
  type: "header" | "paragraph";
  level?: 1 | 2; // only present when type === "header"
  instruction: string; // what this block should say, in Hebrew
}

// ---------------------------------------------------------------------------
// Model constants
// ---------------------------------------------------------------------------

const MODEL_MINI = "gpt-4o-mini";
const MODEL_MAIN = "gpt-4o";

/**
 * Core system prompt.
 * EM DASH BAN comes first (verbatim Hebrew), followed by all other rules.
 */
const SYSTEM_PROMPT = `אסור בהחלט להשתמש במקף ארוך (—). במקום זאת, השתמש תמיד במקף רגיל (-) או בנסח את המשפט מחדש כך שאין צורך במקף כלל.

אסור לציין אתרי חדשות ישראלים מתחרים כמקור — לא וואלה, לא מאקו, לא ידיעות, לא גלובס, לא כלכליסט, לא דה מרקר, לא N12, לא ערוץ 13, לא איס, לא ביזפורטל, ולא שום אתר ישראלי אחר. אם המידע מגיע ממקור בינלאומי (רויטרס, בלומברג, CNBC, גרדיאן וכו׳) — ציין אותו. אם המקור הוא ישראלי — נסח את המשפט כעובדה עצמאית ללא ייחוס, או השמט אותו לחלוטין.

אסור בהחלט לכתוב מספרים ספציפיים (מחירים, אחוזים, תאריכים, סכומים בדולר או בשקל) שלא מופיעים במפורש בטקסטי המקור שסופקו לך. אם מספר מסוים אינו במקורות — אל תכתוב אותו. השתמש בניסוחים כלליים במקום מספרים שאינך בטוח לגביהם. זהו כלל מוחלט.

כתוב אך ורק במילים עבריות קיימות ומוכרות. אסור להמציא מילים, לשלב שורשים בצורה לא נכונה, או להשתמש במילים שאינן קיימות בעברית תקנית. אם אינך בטוח במילה — השתמש בניסוח פשוט יותר. כותרות חייבות להיות ברורות, טבעיות, ומובנות לכל קורא ישראלי.

You are a professional Hebrew financial journalist writing for calcala-news.co.il.

Your job is to write original Hebrew content based ONLY on the source texts provided to you. You are not allowed to add any claim, statistic, quote, or fact that does not appear in the provided sources. If you cannot attribute something to a source, do not write it.

Do not use vague attribution phrases like "מומחים אומרים", "על פי מקורות", or "מדווחים". If you cite something, name the specific source (e.g., "לפי רויטרס", "על פי CNBC").

סגנון כתיבה: אתה עיתונאי כלכלי ישראלי ותיק שכותב לאתר כמו ynet כלכלה או גלובס. הסגנון שלך הוא:
- משפטים קצרים וחדים. לפעמים משפט של 4 מילים. זה בסדר.
- עברית מדוברת ומקצועית — לא אקדמית, לא רשמית מדי
- שאלות רטוריות שמערבות את הקורא: "אז מה זה אומר עליך?" / "למה זה חשוב?"
- פסקאות בגדלים שונים — חלקן 2 משפטים, חלקן 5. אל תהיה אחיד
- כותרות משנה חדות וסקרניות — לא תיאוריות. "הכסף שלך בסכנה?" עדיף על "השפעות על החיסכון"
- הימנע ממילים כמו: "משמעותי", "ניכר", "מהותי", "לאור האמור", "יצוין כי"
- תן זווית — לא רק מה קרה, אלא מה זה אומר לישראלי הממוצע
- סיים עם משפט שמשאיר את הקורא עם משהו לחשוב עליו

מבנה המשפטים: שלב בין משפטים קצרים מאוד (4-7 מילים) למשפטים ארוכים יותר. לפחות בכל פסקה יהיו שני משפטים קצרים ואחד ארוך. אסור להתחיל פסקאות עם: "בנוסף לכך", "יתרה מזאת", "לסיכום", "כמו כן", "יש לציין". אסור להשתמש בביטויים: "משמעותי", "ניכר", "מהותי", "לאור האמור", "בהקשר זה", "חשוב לציין".

מבנה הכתבה:
- כותרת ראשית (H1): חדה, סקרנית, עד 10 מילים. שאלה או טענה — לא תיאור
- פסקת פתיחה: 2-3 משפטים שתופסים את הקורא. תתחיל עם העובדה הכי מעניינת, לא עם הרקע
- 2-3 כותרות משנה (H2) עם פסקאות מתחתיהן — אורך משתנה
- סיום: משפט אחד או שניים שמשאירים הרגשה, לא סיכום יבש
- סה"כ: 500-750 מילים. עדיף קצר וחד על ארוך ומשעמם

Return only the JSON asked of you. No preamble, no explanation, no markdown fences.`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Replace every em dash (—, U+2014) in a string with a regular hyphen (-).
 * This is the post-processing safety net in case the model ignores the prompt rule.
 */
function banEmDash(text: string): string {
  return text.replace(/\u2014/g, "-");
}

/**
 * Builds the sources block that is injected into every API call.
 */
function buildSourcesBlock(scrapedTexts: string[]): string {
  return scrapedTexts
    .map((text, idx) => `[Source ${idx + 1}]\n${text.trim()}`)
    .join("\n\n---\n\n");
}

/**
 * Strips any accidental markdown code fences Claude/GPT might add despite the
 * system prompt forbidding them (belt-and-suspenders).
 */
function stripMarkdownFences(raw: string): string {
  return raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();
}

/**
 * Attempts to repair and parse a JSON string that may be truncated.
 * Handles nested cases: truncated mid-string, mid-object, mid-array.
 */
function repairAndParseJSON(raw: string, label: string): any {
  let cleaned = stripMarkdownFences(raw);

  // First try as-is
  try { return JSON.parse(cleaned); } catch (_) {}

  // Repair strategy: track open brackets/braces and close them
  const stack: string[] = [];
  let inString = false;
  let escape = false;

  for (const ch of cleaned) {
    if (escape) { escape = false; continue; }
    if (ch === '\\' && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') stack.push('}');
    else if (ch === '[') stack.push(']');
    else if (ch === '}' || ch === ']') stack.pop();
  }

  // If we were left inside a string, close it
  if (inString) cleaned += '"';

  // Close any dangling comma before closing bracket
  cleaned = cleaned.replace(/,\s*$/, '');

  // Close open brackets/braces in reverse order
  while (stack.length > 0) {
    cleaned += stack.pop();
  }

  try {
    return JSON.parse(cleaned);
  } catch (parseErr: unknown) {
    const msg = parseErr instanceof Error ? parseErr.message : String(parseErr);
    throw new Error(
      `[WRITER - ${label}] Failed to parse JSON after repair.\nError: ${msg}\nRaw (first 1000): ${raw.slice(0, 1000)}`
    );
  }
}

/**
 * Makes an OpenAI API call and returns the cleaned, em-dash-free text.
 * Retries once on failure.
 */
async function callOpenAI(
  openai: OpenAI,
  modelName: string,
  maxTokens: number,
  userContent: string,
  label: string,
  overrideSystemPrompt?: string
): Promise<string> {
  const attempt = async (): Promise<string> => {
    const response = await openai.chat.completions.create({
      model: modelName,
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: overrideSystemPrompt || SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
    });
    const raw = response.choices[0].message.content ?? "";
    return banEmDash(raw);
  };

  try {
    return await attempt();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[WRITER] ${label} failed (attempt 1): ${message}. Retrying…`);
    try {
      return await attempt();
    } catch (retryErr: unknown) {
      const retryMessage =
        retryErr instanceof Error ? retryErr.message : String(retryErr);
      throw new Error(
        `[WRITER] ${label} failed after retry: ${retryMessage}`
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Main exported function
// ---------------------------------------------------------------------------

export async function writer(
  scrapedTexts: string[],
  topicName: string
): Promise<WriterOutput> {
  // -------------------------------------------------------------------------
  // Input guards (must remain: 1,500 words/source, 6,000 words total)
  // -------------------------------------------------------------------------
  let totalWords = scrapedTexts.reduce(
    (acc, text) => acc + (text.match(/\S+/g) || []).length,
    0
  );
  let droppedCount = 0;

  while (totalWords > 6000 && scrapedTexts.length > 1) {
    const dropped = scrapedTexts.pop();
    if (dropped) {
      totalWords -= (dropped.match(/\S+/g) || []).length;
      droppedCount++;
    }
  }

  if (droppedCount > 0) {
    console.warn(
      `[WRITER] Input exceeded 6,000 words limit. Dropped ${droppedCount} source(s). ` +
        `Remaining sources: ${scrapedTexts.length}, total words: ${totalWords}.`
    );
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "[WRITER] OPENAI_API_KEY environment variable is not set."
    );
  }

  const openai = new OpenAI({ apiKey });
  const sourcesBlock = buildSourcesBlock(scrapedTexts);

  // =========================================================================
  // STAGE 1 — Structure call (gpt-4o-mini, max_tokens: 3000)
  // =========================================================================
  console.log(`[WRITER - STRUCTURE] Planning article structure for topic: "${topicName}"…`);

  const structureUserMessage = `Topic: ${topicName}

Below are the source texts the article must be based on:

${sourcesBlock}

---

Return ONLY a JSON array of block shells describing the article structure. Each object must have:
- "type": either "header" or "paragraph"
- "level": 1 or 2 (only when type is "header"; H1 first, then H2s)
- "instruction": a short Hebrew string (one sentence max) describing exactly what this block should say

Rules:
- The first shell must be the H1 header
- Follow with a short intro paragraph
- Then 2-3 H2 headers, each followed by 1-2 paragraph shells
- End with a closing paragraph shell
- Do NOT write any actual article text — only instructions

Example format:
[
  { "type": "header", "level": 1, "instruction": "כותרת ראשית: כותרת חזקה שמסכמת את הנושא" },
  { "type": "paragraph", "instruction": "פסקת פתיחה שמציגה את עליית הריבית ואת ההשפעה הצפויה על המשכנתאות" },
  { "type": "header", "level": 2, "instruction": "כותרת משנה: השפעה על שוק הנדל\"ן" },
  { "type": "paragraph", "instruction": "פסקה המפרטת כיצד העלאת הריבית משפיעה על מחירי הדירות" }
]

Return only the JSON array. No preamble, no markdown fences.`;

  const structureRaw = await callOpenAI(
    openai,
    MODEL_MINI,
    3000,
    structureUserMessage,
    "STRUCTURE"
  );

  let shells: BlockShell[];
  shells = repairAndParseJSON(structureRaw, 'STRUCTURE') as BlockShell[];

  // Structure validation guard
  if (!Array.isArray(shells)) {
    throw new Error(`[WRITER - STRUCTURE] Parsed structure is not an array. Got: ${typeof shells}`);
  }
  if (shells.length < 4) {
    throw new Error(`[WRITER - STRUCTURE] Structure has fewer than 4 blocks (got ${shells.length}). Raw: ${structureRaw.slice(0, 500)}`);
  }
  if (shells[0]?.type !== 'header' || shells[0]?.level !== 1) {
    throw new Error(`[WRITER - STRUCTURE] First block must be type "header" with level 1. Got: ${JSON.stringify(shells[0])}`);
  }

  console.log(
    `[WRITER - STRUCTURE] Structure planned: ${shells.length} blocks.`
  );

  // =========================================================================
  // STAGE 2 — Block-by-block generation
  // =========================================================================
  const completedBlocks: any[] = [];
  const totalBlocks = shells.length;

  for (let i = 0; i < shells.length; i++) {
    const shell = shells[i];
    const blockNum = i + 1;
    console.log(
      `[WRITER - BLOCK ${blockNum}/${totalBlocks}] Generating ${shell.type}${shell.level ? ` (H${shell.level})` : ""}…`
    );

    const writtenSoFar =
      completedBlocks.length > 0
        ? `\n\nAlready written blocks (maintain continuity):\n${JSON.stringify(completedBlocks, null, 2)}`
        : "";

    // Model and token logic
    let model = MODEL_MINI;
    let maxTokens = 300; // default for headers
    if (shell.type === "paragraph") {
      model = MODEL_MAIN;
      maxTokens = 1000;
    }

    console.log(`[WRITER - BLOCK ${blockNum}/${totalBlocks}] Using model: ${model}`);

    const blockUserMessage = `Topic: ${topicName}

Source texts:
${sourcesBlock}

---

Full article structure plan (${shells.length} blocks total):
${JSON.stringify(shells, null, 2)}

${writtenSoFar}

---

Now write ONLY block ${blockNum} of ${totalBlocks}.
Instruction for this block: ${shell.instruction}
Block type: ${shell.type}${shell.level ? `, level: ${shell.level}` : ""}

Return ONLY a single Editor.js block as a JSON object. Examples:
- Header: { "type": "header", "data": { "text": "כותרת", "level": 1 } }
- Paragraph: { "type": "paragraph", "data": { "text": "תוכן הפסקה..." } }

Do not write any text outside the JSON object. No markdown fences.`;

    const blockRaw = await callOpenAI(
      openai,
      model,
      maxTokens,
      blockUserMessage,
      `BLOCK ${blockNum}/${totalBlocks}`
    );

    const blockCleaned = stripMarkdownFences(blockRaw);

    let blockObj: any;
    try {
      blockObj = repairAndParseJSON(blockCleaned, `BLOCK ${blockNum}/${totalBlocks}`);
    } catch (parseErr: unknown) {
      const msg = parseErr instanceof Error ? parseErr.message : String(parseErr);
      throw new Error(
        `[WRITER - BLOCK ${blockNum}/${totalBlocks}] Failed to parse block JSON.\nError: ${msg}\nRaw: ${blockRaw.slice(0, 500)}`
      );
    }

    if (!blockObj.type || !blockObj.data) {
      throw new Error(
        `[WRITER - BLOCK ${blockNum}/${totalBlocks}] Invalid block shape (missing type or data).\nGot: ${JSON.stringify(blockObj)}`
      );
    }

    // H1 validation using gpt-4o-mini
    if (shell.type === 'header' && shell.level === 1) {
      const headline = blockObj.data?.text || '';
      const validationPrompt = `You are a Hebrew language checker. Read this Hebrew headline and answer only with valid JSON: {"valid": true or false, "issue": "description if invalid, or null if valid"}

A headline is invalid if it:
- Contains a non-existent Hebrew word
- Is grammatically broken or unnatural
- Contains mixed languages incorrectly
- Is longer than 15 words

Headline to check: ${headline}`;

      try {
        const validationRaw = await callOpenAI(
          openai,
          MODEL_MINI,
          200,
          validationPrompt,
          'BLOCK 1 VALIDATION'
        );
        const validationResult = repairAndParseJSON(stripMarkdownFences(validationRaw), 'H1 VALIDATION');

        if (validationResult.valid === false) {
          const issue = validationResult.issue || 'unknown issue';
          console.log(`[WRITER - BLOCK 1] ⚠️ Headline failed validation: ${issue} — regenerating.`);

          const regenMessage = blockUserMessage +
            `\n\nIMPORTANT: The previous attempt was rejected. Issue: "${issue}". Write a clear, natural Hebrew headline using only real, existing Hebrew words.`;
          const regenRaw = await callOpenAI(
            openai,
            MODEL_MINI,
            300,
            regenMessage,
            'BLOCK 1 REGEN'
          );
          const regenCleaned = stripMarkdownFences(regenRaw);
          const regenObj = repairAndParseJSON(regenCleaned, 'BLOCK 1 REGEN');
          if (regenObj.type && regenObj.data) {
            blockObj = regenObj;
            console.log(`[WRITER - BLOCK 1] ✅ Regenerated headline: "${regenObj.data?.text}"`);
          }
        } else {
          console.log(`[WRITER - BLOCK 1] ✅ Headline passed validation: "${headline}"`);
        }
      } catch (valErr) {
        const msg = valErr instanceof Error ? valErr.message : String(valErr);
        console.warn(`[WRITER - BLOCK 1] Validation check failed (non-fatal): ${msg}`);
      }
    }

    completedBlocks.push(blockObj);
  }

  // =========================================================================
  // STAGE 3 — Humanization Pass (gpt-4o, max_tokens: 4000)
  // =========================================================================
  console.log(`[WRITER - HUMANIZE] Running humanization pass...`);
  const humanizationSystemPrompt = `You are a senior Hebrew editor at an Israeli news website. You receive an article in Editor.js JSON format and improve it to sound more human and natural. Rules:
- Fix any sentences that sound translated from English
- Remove corporate or academic language
- Add occasional short punchy sentences that convey feeling ("המשקיעים לא אוהבים הפתעות")
- Vary paragraph lengths — break up any paragraph with 4+ similar-length sentences
- Remove repeated transitions and filler phrases
- Keep all facts exactly as they are — only improve style
- Return the SAME Editor.js JSON structure with improved text in each block
- Return only valid JSON, no preamble`;

  const humanizationUserMessage = `Improve this Hebrew article to sound more natural and human:\n${JSON.stringify(completedBlocks)}`;

  const humanizedRaw = await callOpenAI(
    openai,
    MODEL_MAIN,
    4000,
    humanizationUserMessage,
    "HUMANIZE",
    humanizationSystemPrompt
  );

  let finalBlocks: any[];
  try {
    finalBlocks = repairAndParseJSON(humanizedRaw, 'HUMANIZE');
  } catch (err) {
    console.warn(`[WRITER - HUMANIZE] Humanization parse failed, falling back to original blocks.`);
    finalBlocks = completedBlocks;
  }
  console.log(`[WRITER - HUMANIZE] Done.`);

  // Validate first block is H1
  const firstBlock = finalBlocks[0];
  if (firstBlock?.type !== "header" || firstBlock?.data?.level !== 1) {
    throw new Error(
      `[WRITER] Invalid structure: first block must be a level-1 header.\nGot: ${JSON.stringify(firstBlock)}`
    );
  }

  // Minimum quality gate
  const paragraphWordCount = finalBlocks
    .filter(b => b.type === 'paragraph')
    .reduce((acc, b) => {
      const text = b.data?.text || '';
      return acc + (text.match(/\S+/g) || []).length;
    }, 0);

  if (paragraphWordCount < 150) {
    throw new Error(
      `[WRITER] Article too short (${paragraphWordCount} words) — insufficient source material for a quality article`
    );
  }

  // =========================================================================
  // STAGE 4 — Meta description (gpt-4o-mini, max_tokens: 200)
  // =========================================================================
  console.log(`[WRITER - META] Generating meta description…`);

  const assembledText = finalBlocks
    .map((b) => b.data?.text || "")
    .join(" ");

  const metaUserMessage = `Below is a Hebrew article. Write a meta description for it in Hebrew — maximum 155 characters, suitable for search engines. Return ONLY the meta description string, nothing else.

Article:
${assembledText}`;

  const metaRaw = await callOpenAI(
    openai,
    MODEL_MINI,
    200,
    metaUserMessage,
    "META"
  );
  let metaDescription = metaRaw.trim().replace(/^["']|["']$/g, "");

  if (metaDescription.length > 155) {
    console.warn(
      `[WRITER - META] meta_description exceeds 155 chars (${metaDescription.length}). Truncating.`
    );
    metaDescription = metaDescription.slice(0, 155);
  }

  console.log(
    `[WRITER - META] Done. meta_description length: ${metaDescription.length} chars.`
  );

  // =========================================================================
  // Final assembly
  // =========================================================================
  console.log(
    `[WRITER] Article complete: "${firstBlock.data?.text?.slice(0, 60)}…" ` +
      `(${finalBlocks.length} blocks, meta: ${metaDescription.length} chars)`
  );

  return {
    editorjs: finalBlocks,
    meta_description: metaDescription,
  };
}
