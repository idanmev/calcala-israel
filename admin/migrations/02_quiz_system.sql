-- Quiz configurations per vertical/category
CREATE TABLE quiz_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_slug VARCHAR(100) UNIQUE NOT NULL,
  vertical_name VARCHAR(100) NOT NULL,
  
  -- Entry hook (the age/type buttons above the quiz)
  entry_hook_title TEXT NOT NULL,
  entry_hook_subtitle TEXT,
  button_a_label VARCHAR(50) NOT NULL,
  button_a_value VARCHAR(50) NOT NULL,
  button_b_label VARCHAR(50) NOT NULL,
  button_b_value VARCHAR(50) NOT NULL,
  
  -- Quiz questions (JSON array)
  -- Format: [{"id": "q1", "text": "...", "options": ["opt1", "opt2", "opt3"]}]
  questions JSONB NOT NULL DEFAULT '[]',
  
  -- Success screen
  success_title TEXT NOT NULL,
  success_subtitle TEXT,
  success_range TEXT,
  
  -- Partner integration
  webhook_url TEXT,
  partner_name VARCHAR(100),
  
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Leads table (captures all quiz completions)
CREATE TABLE leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vertical VARCHAR(100) NOT NULL,
  category_slug VARCHAR(100),
  
  -- Contact info
  name VARCHAR(200),
  phone VARCHAR(20) NOT NULL,
  email VARCHAR(255),
  
  -- Quiz answers (JSON)
  -- Format: {"entry_hook": "מעל 45", "q1": "שכיר", "q2": "10,000-20,000"}
  answers JSONB DEFAULT '{}',
  
  -- Source tracking
  source_url TEXT,
  article_slug VARCHAR(255),
  utm_source VARCHAR(100),
  utm_campaign VARCHAR(100),
  
  -- Status
  status VARCHAR(50) DEFAULT 'new', -- new, contacted, qualified, rejected
  
  created_at TIMESTAMP DEFAULT NOW()
);

-- Insert default quiz configs for active verticals

-- 1. TAX REFUND
INSERT INTO quiz_configs (
  category_slug, vertical_name,
  entry_hook_title, entry_hook_subtitle,
  button_a_label, button_a_value,
  button_b_label, button_b_value,
  questions,
  success_title, success_subtitle, success_range,
  partner_name
) VALUES (
  'taxation', 'מיסוי',
  'האם מגיע לך החזר מס?',
  'בדוק תוך 60 שניות — אלפי ישראלים כבר קיבלו את הכסף שלהם',
  'מעל גיל 30', 'above_30',
  'מתחת לגיל 30', 'below_30',
  '[
    {"id": "employment", "text": "מה מצבך התעסוקתי?", "options": ["שכיר/ת", "עצמאי/ת", "שכיר/ת וגם עצמאי/ת", "לא עובד/ת כרגע"]},
    {"id": "salary", "text": "מה טווח המשכורת החודשי שלך?", "options": ["עד 8,000 ₪", "8,000-15,000 ₪", "15,000-25,000 ₪", "מעל 25,000 ₪"]},
    {"id": "years", "text": "כמה שנים עבדת בשכר ב-5 שנים האחרונות?", "options": ["פחות משנה", "1-3 שנים", "3-5 שנים", "כל 5 השנים"]}
  ]',
  'בשורות טובות! נראה שמגיע לך החזר מס',
  'על פי הנתונים שהזנת, ייתכן שמגיע לך החזר משמעותי',
  '₪2,000 - ₪12,000',
  'רואי חשבון מומחים'
);

-- 2. HEALTH INSURANCE
INSERT INTO quiz_configs (
  category_slug, vertical_name,
  entry_hook_title, entry_hook_subtitle,
  button_a_label, button_a_value,
  button_b_label, button_b_value,
  questions,
  success_title, success_subtitle, success_range,
  partner_name
) VALUES (
  'insurance', 'ביטוח בריאות',
  'האם ביטוח הבריאות שלך מכסה אותך באמת?',
  'רוב הישראלים משלמים יותר מדי — בדוק אם אתה אחד מהם',
  'מעל גיל 45', 'above_45',
  'מתחת לגיל 45', 'below_45',
  '[
    {"id": "coverage", "text": "איזה ביטוח בריאות יש לך כרגע?", "options": ["רק קופת חולים", "ביטוח משלים", "ביטוח פרטי מלא", "אין לי ביטוח"]},
    {"id": "family", "text": "מה גודל המשפחה שלך?", "options": ["רווק/ה", "זוג ללא ילדים", "זוג עם 1-2 ילדים", "זוג עם 3+ ילדים"]},
    {"id": "medical", "text": "האם יש לך מצב רפואי קיים?", "options": ["לא", "כן, מצב קל", "כן, מצב כרוני", "מעלה לא רוצה לציין"]}
  ]',
  'ניתן לשפר את הכיסוי שלך!',
  'על פי הנתונים, ייתכן שאתה משלם יותר ממה שצריך',
  'חיסכון אפשרי: ₪1,500 - ₪6,000 בשנה',
  'מומחי ביטוח'
);

-- 3. PENSION
INSERT INTO quiz_configs (
  category_slug, vertical_name,
  entry_hook_title, entry_hook_subtitle,
  button_a_label, button_a_value,
  button_b_label, button_b_value,
  questions,
  success_title, success_subtitle, success_range,
  partner_name
) VALUES (
  'pension', 'פנסיה',
  'האם הפנסיה שלך מספיקה לפרישה?',
  'בדוק עכשיו אם אתה חוסך מספיק לעתיד שלך',
  'שכיר/ת', 'employee',
  'עצמאי/ת', 'self_employed',
  '[
    {"id": "age", "text": "מה גילך?", "options": ["25-35", "35-45", "45-55", "מעל 55"]},
    {"id": "savings", "text": "כמה אתה חוסך לפנסיה בחודש?", "options": ["לא חוסך בכלל", "עד 1,000 ₪", "1,000-3,000 ₪", "מעל 3,000 ₪"]},
    {"id": "retire_age", "text": "מתי אתה מתכנן לפרוש?", "options": ["בעוד פחות מ-10 שנים", "בעוד 10-20 שנה", "בעוד 20-30 שנה", "לא יודע"]}
  ]',
  'יש מה לשפר בחיסכון הפנסיוני שלך',
  'על פי הנתונים, ייתכן שאתה לא חוסך מספיק',
  'פוטנציאל שיפור: ₪500,000+ לפרישה',
  'יועצי פנסיה'
);

-- 4. REAL ESTATE
INSERT INTO quiz_configs (
  category_slug, vertical_name,
  entry_hook_title, entry_hook_subtitle,
  button_a_label, button_a_value,
  button_b_label, button_b_value,
  questions,
  success_title, success_subtitle, success_range,
  partner_name
) VALUES (
  'real-estate', 'נדל"ן',
  'מחפש לקנות דירה? בדוק כמה אתה יכול לקבל',
  'גלה את תקרת המשכנתא שלך תוך דקה',
  'רוכש ראשון', 'first_buyer',
  'משדרג דירה', 'upgrading',
  '[
    {"id": "budget", "text": "מה תקציב הרכישה שלך?", "options": ["עד 1.5 מיליון ₪", "1.5-2.5 מיליון ₪", "2.5-4 מיליון ₪", "מעל 4 מיליון ₪"]},
    {"id": "equity", "text": "כמה הון עצמי יש לך?", "options": ["פחות מ-300,000 ₪", "300,000-600,000 ₪", "600,000-1,000,000 ₪", "מעל מיליון ₪"]},
    {"id": "location", "text": "באיזה אזור אתה מחפש?", "options": ["תל אביב והמרכז", "ירושלים", "חיפה והצפון", "דרום ופריפריה"]}
  ]',
  'כדאי לבדוק את אפשרויות המשכנתא שלך!',
  'על פי הנתונים, ייתכן שאתה זכאי לתנאים טובים',
  'אישור עקרוני: עד ₪2,500,000',
  'יועצי משכנתאות'
);

-- Enable RLS on leads table
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

-- Allow inserts from anonymous users (for lead capture)
CREATE POLICY "Allow anonymous lead inserts" ON leads
  FOR INSERT TO anon
  WITH CHECK (true);

-- Only authenticated users can read leads
CREATE POLICY "Only admins can read leads" ON leads
  FOR SELECT TO authenticated
  USING (true);
