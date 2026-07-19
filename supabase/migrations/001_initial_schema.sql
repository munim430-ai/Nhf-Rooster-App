-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Maker Passwords table
CREATE TABLE IF NOT EXISTS maker_passwords (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  password_hash TEXT NOT NULL,
  label TEXT NOT NULL,
  expires_at TIMESTAMPTZ,
  active BOOLEAN DEFAULT true,
  created_by TEXT DEFAULT 'master',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Doctors table
CREATE TABLE IF NOT EXISTS doctors (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  categories TEXT[] DEFAULT '{}',
  secret BOOLEAN DEFAULT false,
  allowed_wards TEXT[] DEFAULT '{}',
  cath_eligible BOOLEAN DEFAULT false,
  cath_quota INTEGER DEFAULT 0,
  target INTEGER DEFAULT 23,
  night_target INTEGER DEFAULT 6,
  opd_min INTEGER DEFAULT 0,
  opd_max INTEGER,
  duty_start_date DATE,
  duty_end_date DATE,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Wards table
CREATE TABLE IF NOT EXISTS wards (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  group_name TEXT DEFAULT 'General',
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Stations table
CREATE TABLE IF NOT EXISTS stations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  label TEXT NOT NULL,
  wards TEXT[] DEFAULT '{}',
  needed INTEGER DEFAULT 1,
  shift TEXT NOT NULL CHECK (shift IN ('morning', 'evening', 'night')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Demands table
CREATE TABLE IF NOT EXISTS demands (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  doctor_id UUID REFERENCES doctors(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('off', 'double', 'single', 'leave', 'assign')),
  scope TEXT NOT NULL CHECK (scope IN ('weekly', 'date', 'always')),
  shift TEXT,
  pair TEXT,
  ward_name TEXT,
  day_of_week INTEGER,
  date INTEGER,
  start_date DATE,
  end_date DATE,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Holidays table
CREATE TABLE IF NOT EXISTS holidays (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  date INTEGER NOT NULL,
  label TEXT NOT NULL,
  year INTEGER DEFAULT EXTRACT(YEAR FROM NOW()),
  month INTEGER DEFAULT EXTRACT(MONTH FROM NOW()),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Settings table
CREATE TABLE IF NOT EXISTS app_settings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default settings
INSERT INTO app_settings (key, value) 
VALUES ('hospital_config', '{"name": "National Heart Foundation Hospital and Research Institute", "preparedBy": ""}') 
ON CONFLICT DO NOTHING;

-- Row Level Security (RLS)
ALTER TABLE maker_passwords ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctors ENABLE ROW LEVEL SECURITY;
ALTER TABLE wards ENABLE ROW LEVEL SECURITY;
ALTER TABLE stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE demands ENABLE ROW LEVEL SECURITY;
ALTER TABLE holidays ENABLE ROW LEVEL SECURITY;

-- Create policies (allow all for now, restrict later)
CREATE POLICY "Allow all" ON maker_passwords FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON doctors FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON wards FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON stations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON demands FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON holidays FOR ALL USING (true) WITH CHECK (true);
