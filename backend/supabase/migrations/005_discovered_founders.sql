-- Create Discovered Founders Table for Discovery pipeline
CREATE TABLE IF NOT EXISTS discovered_founders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name TEXT NOT NULL,
    email TEXT,
    source_platform VARCHAR(100) NOT NULL,
    platform_profile_url TEXT,
    bio TEXT,
    skills TEXT[],
    calculated_score NUMERIC(5,2) NOT NULL DEFAULT 50.0,
    outreach_email TEXT,
    outreach_status VARCHAR(50) NOT NULL DEFAULT 'draft', -- 'draft', 'sent', 'replied', 'ignored'
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Enable RLS (Row Level Security) if not already enabled on other tables
ALTER TABLE discovered_founders ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read and write discovered founders
CREATE POLICY "Allow authenticated users all operations on discovered_founders"
  ON discovered_founders
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
