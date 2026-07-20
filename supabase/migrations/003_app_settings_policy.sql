-- app_settings had ROW LEVEL SECURITY enabled without a permissive policy, so
-- anonymous writes were rejected (Postgres error 42501). That silently blocked
-- saving the printed-roster letterhead, shared notes, and the master password.
-- Add the same allow-all policy the other tables use.

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all" ON app_settings;
CREATE POLICY "Allow all" ON app_settings FOR ALL USING (true) WITH CHECK (true);

-- Reseed the default hospital letterhead if it is missing.
INSERT INTO app_settings (key, value)
VALUES ('hospital_config', '{"name": "National Heart Foundation Hospital and Research Institute", "preparedBy": ""}')
ON CONFLICT (key) DO NOTHING;
