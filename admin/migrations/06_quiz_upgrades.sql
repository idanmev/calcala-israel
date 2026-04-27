-- Step 1: Add entry_hook_buttons to quiz_configs (to support up to 6 buttons with rich styling)
ALTER TABLE quiz_configs ADD COLUMN IF NOT EXISTS entry_hook_buttons JSONB DEFAULT '[]'::jsonb;

-- Step 2: Add results_routing to quiz_configs (for conditional results screens)
ALTER TABLE quiz_configs ADD COLUMN IF NOT EXISTS results_routing JSONB DEFAULT '{}'::jsonb;

-- Step 3: Add lead_form_order to quiz_configs
ALTER TABLE quiz_configs ADD COLUMN IF NOT EXISTS lead_form_order VARCHAR(50) DEFAULT 'phone_first';
