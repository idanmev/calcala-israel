-- =============================================================
-- Migration 07: Fix leads RLS — grant authenticated full access
-- =============================================================

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users (admins) full access to leads
DROP POLICY IF EXISTS "authenticated_full_access_leads" ON leads;
CREATE POLICY "authenticated_full_access_leads" ON leads
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- Ensure anon can still INSERT (for lead capture from articles)
DROP POLICY IF EXISTS "anon_insert_leads" ON leads;
CREATE POLICY "anon_insert_leads" ON leads
  FOR INSERT TO anon
  WITH CHECK (true);
