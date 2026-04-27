-- Add editable trust/footer text line to quiz configs
ALTER TABLE quiz_configs ADD COLUMN IF NOT EXISTS trust_text text DEFAULT NULL;
