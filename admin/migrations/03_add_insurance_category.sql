-- Add insurance category if it doesn't exist
INSERT INTO categories (name, slug, display_order)
VALUES ('ביטוח בריאות', 'insurance', 7)
ON CONFLICT (slug) DO NOTHING;
