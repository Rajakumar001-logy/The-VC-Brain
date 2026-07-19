-- Create vector similarity search function for evidence/memories linked to a specific founder
CREATE OR REPLACE FUNCTION match_evidence(
  query_embedding VECTOR(1536),
  match_founder_id UUID,
  match_count INT DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  evidence_type public.evidence_type,
  source_kind public.evidence_source,
  title TEXT,
  body TEXT,
  url TEXT,
  confidence NUMERIC,
  observed_at TIMESTAMPTZ,
  similarity FLOAT
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    e.id,
    e.evidence_type,
    e.source_kind,
    e.title,
    e.body,
    e.url,
    e.confidence,
    e.observed_at,
    1 - (e.embedding <=> query_embedding) AS similarity
  FROM evidence e
  WHERE e.founder_id = match_founder_id AND e.embedding IS NOT NULL AND e.deleted_at IS NULL
  ORDER BY e.embedding <=> query_embedding
  LIMIT match_count;
$$;
