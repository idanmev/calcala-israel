-- Delete existing categories
DELETE FROM categories;

-- Insert correct categories to match frontend menu
INSERT INTO categories (name, slug, display_order) VALUES
  ('נדל"ן', 'real-estate', 1),
  ('קריפטו', 'crypto', 2),
  ('מיסוי', 'taxation', 3),
  ('משפט', 'law', 4),
  ('טכנולוגיה', 'technology', 5),
  ('שוק ההון', 'capital-market', 6);
