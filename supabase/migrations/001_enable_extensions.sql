-- Enable required PostgreSQL extensions
-- Run this first in Supabase SQL Editor

-- UUID extension for generating unique IDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Text search extension for fuzzy matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Comment on extensions
COMMENT ON EXTENSION "uuid-ossp" IS 'Generate universally unique identifiers (UUIDs)';
COMMENT ON EXTENSION pg_trgm IS 'Text similarity measurement and index searching';
