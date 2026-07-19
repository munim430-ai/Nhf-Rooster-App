-- Roster snapshots table (saved/generated monthly rosters)
CREATE TABLE IF NOT EXISTS roster_snapshots (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  days INTEGER NOT NULL,
  roster JSONB NOT NULL,
  effective_stations JSONB,
  warnings TEXT[],
  notes TEXT,
  generated_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Duty bank table (tracks each doctor's duty target/balance per month)
CREATE TABLE IF NOT EXISTS duty_bank (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  month_key TEXT NOT NULL,
  doctor_id UUID REFERENCES doctors(id) ON DELETE CASCADE,
  base_target INTEGER NOT NULL,
  effective_target INTEGER NOT NULL,
  assigned INTEGER NOT NULL DEFAULT 0,
  balance INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (month_key, doctor_id)
);

ALTER TABLE roster_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE duty_bank ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all" ON roster_snapshots FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON duty_bank FOR ALL USING (true) WITH CHECK (true);
