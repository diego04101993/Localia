ALTER TABLE branches
ADD COLUMN IF NOT EXISTS search_keywords text;
