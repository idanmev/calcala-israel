-- =============================================================
-- Migration 05: Security hardening — RLS, view count RPC,
--               leads webhook_status, remove anon INSERT
-- =============================================================

-- ----- 1. Add webhook_status column to leads -----
ALTER TABLE leads ADD COLUMN IF NOT EXISTS webhook_status VARCHAR(20) DEFAULT 'pending';

-- ----- 2. RLS on articles -----
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_read_published_articles" ON articles
  FOR SELECT TO anon
  USING (status = 'published');

CREATE POLICY "authenticated_full_access_articles" ON articles
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- ----- 3. RLS on quiz_configs -----
ALTER TABLE quiz_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_read_active_quiz_configs" ON quiz_configs
  FOR SELECT TO anon
  USING (is_active = true);

CREATE POLICY "authenticated_full_access_quiz_configs" ON quiz_configs
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- ----- 4. RLS on categories -----
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_read_categories" ON categories
  FOR SELECT TO anon
  USING (true);

CREATE POLICY "authenticated_full_access_categories" ON categories
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- ----- 5. RLS on tags -----
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_read_tags" ON tags
  FOR SELECT TO anon
  USING (true);

CREATE POLICY "authenticated_full_access_tags" ON tags
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- ----- 6. RLS on article_tags -----
ALTER TABLE article_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_read_article_tags" ON article_tags
  FOR SELECT TO anon
  USING (true);

CREATE POLICY "authenticated_full_access_article_tags" ON article_tags
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- ----- 7. RLS on curated_widgets -----
ALTER TABLE curated_widgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_read_curated_widgets" ON curated_widgets
  FOR SELECT TO anon
  USING (true);

CREATE POLICY "authenticated_full_access_curated_widgets" ON curated_widgets
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- ----- 8. Lock down leads table further -----
-- Remove the old anon INSERT policy (leads now go through edge function)
DROP POLICY IF EXISTS "Allow anonymous lead inserts" ON leads;

-- Deny anon UPDATE/DELETE explicitly
CREATE POLICY "deny_anon_update_leads" ON leads
  FOR UPDATE TO anon
  USING (false);

CREATE POLICY "deny_anon_delete_leads" ON leads
  FOR DELETE TO anon
  USING (false);

-- Deny anon SELECT on leads
CREATE POLICY "deny_anon_select_leads" ON leads
  FOR SELECT TO anon
  USING (false);

-- ----- 9. Increment view count RPC (atomic, no race condition) -----
CREATE OR REPLACE FUNCTION increment_view_count(target_article_id UUID)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE articles
  SET view_count = COALESCE(view_count, 0) + 1
  WHERE id = target_article_id;
$$;

-- Allow anon to call the RPC
GRANT EXECUTE ON FUNCTION increment_view_count(UUID) TO anon;
GRANT EXECUTE ON FUNCTION increment_view_count(UUID) TO authenticated;
