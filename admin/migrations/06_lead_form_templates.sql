-- Lead form templates
CREATE TABLE lead_form_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  title TEXT NOT NULL DEFAULT 'התעניינתם?',
  subtitle TEXT NOT NULL DEFAULT 'השאירו פרטים ויענו לכם על כל השאלות.',
  button_text VARCHAR(100) NOT NULL DEFAULT 'שלח פרטים',
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Only one default at a time
CREATE UNIQUE INDEX lead_form_templates_default_idx ON lead_form_templates (is_default) WHERE is_default = true;

-- RLS
ALTER TABLE lead_form_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins full access lead_form_templates" ON lead_form_templates
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Public read lead_form_templates" ON lead_form_templates
  FOR SELECT TO anon USING (true);

-- Default template
INSERT INTO lead_form_templates (name, title, subtitle, button_text, is_default)
VALUES ('ברירת מחדל', 'התעניינתם?', 'השאירו פרטים ויענו לכם על כל השאלות.', 'שלח פרטים', true);
