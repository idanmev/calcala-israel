-- Step-based quiz flow and per-quiz affiliate API config
ALTER TABLE quiz_configs
  ADD COLUMN IF NOT EXISTS steps JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS advisor_image_url TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS affiliate_config JSONB DEFAULT NULL;

-- Track affiliate dispatch result per lead
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS affiliate_status TEXT DEFAULT 'pending';
