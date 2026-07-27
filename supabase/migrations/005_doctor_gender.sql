-- Per-doctor gender (male / female), used both as a list filter and as a hard
-- placement rule: the combined Ward 9 + Cabin duty is male-only, so female
-- doctors are never placed there. NULL means unspecified.

ALTER TABLE doctors ADD COLUMN IF NOT EXISTS gender TEXT;
