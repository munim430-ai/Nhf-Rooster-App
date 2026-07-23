-- Per-doctor soft placement bias: wards the roster generator should favour for
-- this doctor (they pick up more duties there when possible), separate from the
-- hard `allowed_wards` restriction.

ALTER TABLE doctors ADD COLUMN IF NOT EXISTS preferred_wards TEXT[] DEFAULT '{}';
