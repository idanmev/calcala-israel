-- Step 1: Add quiz_id column to articles table
ALTER TABLE articles ADD COLUMN IF NOT EXISTS quiz_id UUID REFERENCES quiz_configs(id) ON DELETE SET NULL;

-- Step 2: Add display_name to quiz_configs so admins can identify quizzes
ALTER TABLE quiz_configs ADD COLUMN IF NOT EXISTS display_name VARCHAR(200);

-- Step 3: Update existing quiz configs with display names
UPDATE quiz_configs SET display_name = 'החזר מס - שכירים' WHERE category_slug = 'taxation';
UPDATE quiz_configs SET display_name = 'ביטוח בריאות - כללי' WHERE category_slug = 'insurance';
UPDATE quiz_configs SET display_name = 'פנסיה - שכירים' WHERE category_slug = 'pension';
UPDATE quiz_configs SET display_name = 'נדל"ן - רוכשים' WHERE category_slug = 'real-estate';

-- Step 4: Remove the UNIQUE constraint on category_slug (now multiple quizzes can share a category)
-- First drop the existing unique index if it exists
DROP INDEX IF EXISTS quiz_configs_category_slug_key;

-- Add a regular index instead (for performance, not uniqueness)
CREATE INDEX IF NOT EXISTS idx_quiz_configs_category ON quiz_configs(category_slug);
