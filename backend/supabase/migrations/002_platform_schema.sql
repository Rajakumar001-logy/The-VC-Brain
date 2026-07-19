-- =============================================================================
-- VC Brain — Scalable PostgreSQL schema for Supabase
-- =============================================================================
-- Features: UUID PKs, FKs, indexes, soft deletes, timestamps, audit fields,
--           pgvector for semantic search over evidence & documents
-- Run in Supabase SQL Editor (or via CLI migrations) after enabling extensions.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE company_stage AS ENUM (
    'idea', 'pre_seed', 'seed', 'series_a', 'series_b', 'series_c', 'growth', 'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE application_status AS ENUM (
    'draft', 'submitted', 'screening', 'diligence', 'partner_meeting',
    'term_sheet', 'invested', 'passed', 'withdrawn'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE memo_status AS ENUM ('draft', 'review', 'approved', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE memo_recommendation AS ENUM ('invest', 'pass', 'watch');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE risk_level AS ENUM ('low', 'medium', 'high', 'critical');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE evidence_type AS ENUM (
    'metric', 'quote', 'link', 'document', 'github', 'paper',
    'hackathon', 'product', 'interview', 'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE evidence_source AS ENUM (
    'founder', 'company', 'application', 'pitch_deck', 'github_profile',
    'research_paper', 'hackathon', 'product', 'manual', 'ai'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE investor_role AS ENUM (
    'admin', 'partner', 'principal', 'associate', 'analyst', 'ops', 'viewer'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE founder_company_role AS ENUM (
    'founder', 'co_founder', 'ceo', 'cto', 'coo', 'cpo', 'advisor', 'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- -----------------------------------------------------------------------------
-- Shared helpers
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Soft-delete helper view pattern: query with WHERE deleted_at IS NULL

-- -----------------------------------------------------------------------------
-- Investors (platform users / fund team)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS investors (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Link to Supabase Auth when available:
  -- ALTER TABLE investors ADD CONSTRAINT investors_auth_user_id_fkey
  --   FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
  auth_user_id    UUID UNIQUE,
  email           TEXT NOT NULL,
  full_name       TEXT NOT NULL,
  role            investor_role NOT NULL DEFAULT 'analyst',
  firm_name       TEXT,
  title           TEXT,
  avatar_url      TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ,
  created_by      UUID,
  updated_by      UUID,

  CONSTRAINT investors_email_nonempty CHECK (length(trim(email)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS investors_email_active_uidx
  ON investors (lower(email))
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS investors_role_idx
  ON investors (role)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS investors_auth_user_id_idx
  ON investors (auth_user_id)
  WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_investors_updated_at ON investors;
CREATE TRIGGER trg_investors_updated_at
  BEFORE UPDATE ON investors
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Self-referential audit FKs (after table exists)
ALTER TABLE investors
  DROP CONSTRAINT IF EXISTS investors_created_by_fkey,
  DROP CONSTRAINT IF EXISTS investors_updated_by_fkey;

ALTER TABLE investors
  ADD CONSTRAINT investors_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES investors(id) ON DELETE SET NULL,
  ADD CONSTRAINT investors_updated_by_fkey
    FOREIGN KEY (updated_by) REFERENCES investors(id) ON DELETE SET NULL;

-- -----------------------------------------------------------------------------
-- Founders
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS founders (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name           TEXT NOT NULL,
  email               TEXT,
  phone               TEXT,
  headline            TEXT,
  bio                 TEXT NOT NULL DEFAULT '',
  location            TEXT,
  linkedin_url        TEXT,
  twitter_url         TEXT,
  personal_website    TEXT,
  avatar_url          TEXT,
  years_experience    INTEGER NOT NULL DEFAULT 0 CHECK (years_experience >= 0),
  previous_exits      INTEGER NOT NULL DEFAULT 0 CHECK (previous_exits >= 0),
  education           TEXT[] NOT NULL DEFAULT '{}',
  skills              TEXT[] NOT NULL DEFAULT '{}',
  tags                TEXT[] NOT NULL DEFAULT '{}',
  metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- denormalized latest scores for fast reads (history tables are source of truth)
  current_founder_score   NUMERIC(5,2),
  current_trust_score     NUMERIC(5,2),

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at          TIMESTAMPTZ,
  created_by          UUID REFERENCES investors(id) ON DELETE SET NULL,
  updated_by          UUID REFERENCES investors(id) ON DELETE SET NULL,

  CONSTRAINT founders_name_nonempty CHECK (length(trim(full_name)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS founders_email_active_uidx
  ON founders (lower(email))
  WHERE deleted_at IS NULL AND email IS NOT NULL;

CREATE INDEX IF NOT EXISTS founders_name_trgm_idx
  ON founders USING gin (full_name gin_trgm_ops)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS founders_skills_gin_idx
  ON founders USING gin (skills)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS founders_current_scores_idx
  ON founders (current_founder_score DESC NULLS LAST, current_trust_score DESC NULLS LAST)
  WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_founders_updated_at ON founders;
CREATE TRIGGER trg_founders_updated_at
  BEFORE UPDATE ON founders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- -----------------------------------------------------------------------------
-- Companies
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS companies (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT NOT NULL,
  slug                TEXT,
  tagline             TEXT,
  description         TEXT NOT NULL DEFAULT '',
  sector              TEXT,
  sub_sector          TEXT,
  stage               company_stage NOT NULL DEFAULT 'idea',
  location            TEXT,
  website_url         TEXT,
  founded_year        INTEGER CHECK (founded_year IS NULL OR founded_year BETWEEN 1900 AND 2100),
  employee_count      INTEGER CHECK (employee_count IS NULL OR employee_count >= 0),
  funding_raised_usd  NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK (funding_raised_usd >= 0),
  valuation_usd       NUMERIC(18,2) CHECK (valuation_usd IS NULL OR valuation_usd >= 0),
  traction_summary    TEXT,
  logo_url            TEXT,
  tags                TEXT[] NOT NULL DEFAULT '{}',
  metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at          TIMESTAMPTZ,
  created_by          UUID REFERENCES investors(id) ON DELETE SET NULL,
  updated_by          UUID REFERENCES investors(id) ON DELETE SET NULL,

  CONSTRAINT companies_name_nonempty CHECK (length(trim(name)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS companies_slug_active_uidx
  ON companies (slug)
  WHERE deleted_at IS NULL AND slug IS NOT NULL;

CREATE INDEX IF NOT EXISTS companies_name_trgm_idx
  ON companies USING gin (name gin_trgm_ops)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS companies_sector_stage_idx
  ON companies (sector, stage)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS companies_tags_gin_idx
  ON companies USING gin (tags)
  WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_companies_updated_at ON companies;
CREATE TRIGGER trg_companies_updated_at
  BEFORE UPDATE ON companies
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- -----------------------------------------------------------------------------
-- Company ↔ Founder (M:N)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS company_founders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  founder_id      UUID NOT NULL REFERENCES founders(id) ON DELETE CASCADE,
  role            founder_company_role NOT NULL DEFAULT 'founder',
  title           TEXT,
  equity_pct      NUMERIC(5,2) CHECK (equity_pct IS NULL OR (equity_pct >= 0 AND equity_pct <= 100)),
  is_primary      BOOLEAN NOT NULL DEFAULT FALSE,
  started_on      DATE,
  ended_on        DATE,
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ,
  created_by      UUID REFERENCES investors(id) ON DELETE SET NULL,
  updated_by      UUID REFERENCES investors(id) ON DELETE SET NULL,

  CONSTRAINT company_founders_dates_chk
    CHECK (ended_on IS NULL OR started_on IS NULL OR ended_on >= started_on)
);

CREATE UNIQUE INDEX IF NOT EXISTS company_founders_active_uidx
  ON company_founders (company_id, founder_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS company_founders_founder_idx
  ON company_founders (founder_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS company_founders_company_idx
  ON company_founders (company_id)
  WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_company_founders_updated_at ON company_founders;
CREATE TRIGGER trg_company_founders_updated_at
  BEFORE UPDATE ON company_founders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- -----------------------------------------------------------------------------
-- Applications (funding applications / deal opportunities)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS applications (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  primary_founder_id  UUID REFERENCES founders(id) ON DELETE SET NULL,
  assigned_investor_id UUID REFERENCES investors(id) ON DELETE SET NULL,
  status              application_status NOT NULL DEFAULT 'draft',
  source              TEXT, -- inbound, referral, outbound, event, etc.
  ask_amount_usd      NUMERIC(18,2) CHECK (ask_amount_usd IS NULL OR ask_amount_usd >= 0),
  proposed_ownership_pct NUMERIC(5,2)
    CHECK (proposed_ownership_pct IS NULL OR (proposed_ownership_pct >= 0 AND proposed_ownership_pct <= 100)),
  round_name          TEXT,
  summary             TEXT,
  notes               TEXT,
  submitted_at        TIMESTAMPTZ,
  decision_at         TIMESTAMPTZ,
  metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at          TIMESTAMPTZ,
  created_by          UUID REFERENCES investors(id) ON DELETE SET NULL,
  updated_by          UUID REFERENCES investors(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS applications_company_idx
  ON applications (company_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS applications_status_idx
  ON applications (status, submitted_at DESC NULLS LAST)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS applications_assigned_investor_idx
  ON applications (assigned_investor_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS applications_primary_founder_idx
  ON applications (primary_founder_id)
  WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_applications_updated_at ON applications;
CREATE TRIGGER trg_applications_updated_at
  BEFORE UPDATE ON applications
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- -----------------------------------------------------------------------------
-- Pitch Decks
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS pitch_decks (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  application_id    UUID REFERENCES applications(id) ON DELETE SET NULL,
  title             TEXT NOT NULL,
  version_label     TEXT,
  storage_path      TEXT,          -- Supabase Storage path
  file_url          TEXT,
  mime_type         TEXT,
  file_size_bytes   BIGINT CHECK (file_size_bytes IS NULL OR file_size_bytes >= 0),
  page_count        INTEGER CHECK (page_count IS NULL OR page_count >= 0),
  extracted_text    TEXT,
  ai_summary        TEXT,
  is_primary        BOOLEAN NOT NULL DEFAULT FALSE,
  uploaded_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata          JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at        TIMESTAMPTZ,
  created_by        UUID REFERENCES investors(id) ON DELETE SET NULL,
  updated_by        UUID REFERENCES investors(id) ON DELETE SET NULL,

  CONSTRAINT pitch_decks_title_nonempty CHECK (length(trim(title)) > 0)
);

CREATE INDEX IF NOT EXISTS pitch_decks_company_idx
  ON pitch_decks (company_id, uploaded_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS pitch_decks_application_idx
  ON pitch_decks (application_id)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS pitch_decks_primary_per_company_uidx
  ON pitch_decks (company_id)
  WHERE deleted_at IS NULL AND is_primary = TRUE;

DROP TRIGGER IF EXISTS trg_pitch_decks_updated_at ON pitch_decks;
CREATE TRIGGER trg_pitch_decks_updated_at
  BEFORE UPDATE ON pitch_decks
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- -----------------------------------------------------------------------------
-- GitHub Profiles
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS github_profiles (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  founder_id        UUID REFERENCES founders(id) ON DELETE CASCADE,
  company_id        UUID REFERENCES companies(id) ON DELETE CASCADE,
  github_username   TEXT NOT NULL,
  profile_url       TEXT,
  avatar_url        TEXT,
  bio               TEXT,
  public_repos      INTEGER NOT NULL DEFAULT 0 CHECK (public_repos >= 0),
  followers         INTEGER NOT NULL DEFAULT 0 CHECK (followers >= 0),
  following         INTEGER NOT NULL DEFAULT 0 CHECK (following >= 0),
  total_stars       INTEGER NOT NULL DEFAULT 0 CHECK (total_stars >= 0),
  total_forks       INTEGER NOT NULL DEFAULT 0 CHECK (total_forks >= 0),
  top_languages     TEXT[] NOT NULL DEFAULT '{}',
  contributions_1y  INTEGER,
  account_created_at TIMESTAMPTZ,
  last_synced_at    TIMESTAMPTZ,
  raw_payload       JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata          JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at        TIMESTAMPTZ,
  created_by        UUID REFERENCES investors(id) ON DELETE SET NULL,
  updated_by        UUID REFERENCES investors(id) ON DELETE SET NULL,

  CONSTRAINT github_profiles_subject_chk
    CHECK (founder_id IS NOT NULL OR company_id IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS github_profiles_username_active_uidx
  ON github_profiles (lower(github_username))
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS github_profiles_founder_idx
  ON github_profiles (founder_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS github_profiles_company_idx
  ON github_profiles (company_id)
  WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_github_profiles_updated_at ON github_profiles;
CREATE TRIGGER trg_github_profiles_updated_at
  BEFORE UPDATE ON github_profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- -----------------------------------------------------------------------------
-- Research Papers
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS research_papers (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  founder_id        UUID REFERENCES founders(id) ON DELETE SET NULL,
  company_id        UUID REFERENCES companies(id) ON DELETE SET NULL,
  title             TEXT NOT NULL,
  abstract          TEXT,
  authors           TEXT[] NOT NULL DEFAULT '{}',
  venue             TEXT,
  published_on      DATE,
  doi               TEXT,
  arxiv_id          TEXT,
  url               TEXT,
  citation_count    INTEGER NOT NULL DEFAULT 0 CHECK (citation_count >= 0),
  topics            TEXT[] NOT NULL DEFAULT '{}',
  pdf_url           TEXT,
  metadata          JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at        TIMESTAMPTZ,
  created_by        UUID REFERENCES investors(id) ON DELETE SET NULL,
  updated_by        UUID REFERENCES investors(id) ON DELETE SET NULL,

  CONSTRAINT research_papers_title_nonempty CHECK (length(trim(title)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS research_papers_doi_active_uidx
  ON research_papers (doi)
  WHERE deleted_at IS NULL AND doi IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS research_papers_arxiv_active_uidx
  ON research_papers (arxiv_id)
  WHERE deleted_at IS NULL AND arxiv_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS research_papers_founder_idx
  ON research_papers (founder_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS research_papers_company_idx
  ON research_papers (company_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS research_papers_title_trgm_idx
  ON research_papers USING gin (title gin_trgm_ops)
  WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_research_papers_updated_at ON research_papers;
CREATE TRIGGER trg_research_papers_updated_at
  BEFORE UPDATE ON research_papers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- -----------------------------------------------------------------------------
-- Hackathons
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS hackathons (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT NOT NULL,
  organizer         TEXT,
  location          TEXT,
  is_virtual        BOOLEAN NOT NULL DEFAULT FALSE,
  starts_on         DATE,
  ends_on           DATE,
  website_url       TEXT,
  description       TEXT,
  metadata          JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at        TIMESTAMPTZ,
  created_by        UUID REFERENCES investors(id) ON DELETE SET NULL,
  updated_by        UUID REFERENCES investors(id) ON DELETE SET NULL,

  CONSTRAINT hackathons_name_nonempty CHECK (length(trim(name)) > 0),
  CONSTRAINT hackathons_dates_chk
    CHECK (ends_on IS NULL OR starts_on IS NULL OR ends_on >= starts_on)
);

CREATE INDEX IF NOT EXISTS hackathons_name_trgm_idx
  ON hackathons USING gin (name gin_trgm_ops)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS hackathons_dates_idx
  ON hackathons (starts_on DESC NULLS LAST)
  WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_hackathons_updated_at ON hackathons;
CREATE TRIGGER trg_hackathons_updated_at
  BEFORE UPDATE ON hackathons
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Founder participation in hackathons
CREATE TABLE IF NOT EXISTS founder_hackathons (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  founder_id        UUID NOT NULL REFERENCES founders(id) ON DELETE CASCADE,
  hackathon_id      UUID NOT NULL REFERENCES hackathons(id) ON DELETE CASCADE,
  project_name      TEXT,
  project_url       TEXT,
  award             TEXT,
  placement         TEXT,
  role              TEXT,
  notes             TEXT,
  metadata          JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at        TIMESTAMPTZ,
  created_by        UUID REFERENCES investors(id) ON DELETE SET NULL,
  updated_by        UUID REFERENCES investors(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS founder_hackathons_active_uidx
  ON founder_hackathons (founder_id, hackathon_id, COALESCE(project_name, ''))
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS founder_hackathons_hackathon_idx
  ON founder_hackathons (hackathon_id)
  WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_founder_hackathons_updated_at ON founder_hackathons;
CREATE TRIGGER trg_founder_hackathons_updated_at
  BEFORE UPDATE ON founder_hackathons
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- -----------------------------------------------------------------------------
-- Products
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS products (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  description       TEXT,
  product_url       TEXT,
  category          TEXT,
  status            TEXT NOT NULL DEFAULT 'active', -- active, beta, sunset, planned
  launch_date       DATE,
  mrr_usd           NUMERIC(18,2) CHECK (mrr_usd IS NULL OR mrr_usd >= 0),
  active_users      INTEGER CHECK (active_users IS NULL OR active_users >= 0),
  tech_stack        TEXT[] NOT NULL DEFAULT '{}',
  metadata          JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at        TIMESTAMPTZ,
  created_by        UUID REFERENCES investors(id) ON DELETE SET NULL,
  updated_by        UUID REFERENCES investors(id) ON DELETE SET NULL,

  CONSTRAINT products_name_nonempty CHECK (length(trim(name)) > 0)
);

CREATE INDEX IF NOT EXISTS products_company_idx
  ON products (company_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS products_status_idx
  ON products (status)
  WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_products_updated_at ON products;
CREATE TRIGGER trg_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- -----------------------------------------------------------------------------
-- Evidence (atomic facts supporting scores / memos)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS evidence (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evidence_type     evidence_type NOT NULL DEFAULT 'other',
  source_kind       evidence_source NOT NULL DEFAULT 'manual',
  title             TEXT NOT NULL,
  body              TEXT,
  url               TEXT,
  confidence        NUMERIC(4,3) CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  observed_at       TIMESTAMPTZ,
  is_verified       BOOLEAN NOT NULL DEFAULT FALSE,
  verified_at       TIMESTAMPTZ,
  verified_by       UUID REFERENCES investors(id) ON DELETE SET NULL,

  -- optional polymorphic links
  founder_id        UUID REFERENCES founders(id) ON DELETE CASCADE,
  company_id        UUID REFERENCES companies(id) ON DELETE CASCADE,
  application_id    UUID REFERENCES applications(id) ON DELETE CASCADE,
  pitch_deck_id     UUID REFERENCES pitch_decks(id) ON DELETE SET NULL,
  github_profile_id UUID REFERENCES github_profiles(id) ON DELETE SET NULL,
  research_paper_id UUID REFERENCES research_papers(id) ON DELETE SET NULL,
  hackathon_id      UUID REFERENCES hackathons(id) ON DELETE SET NULL,
  product_id        UUID REFERENCES products(id) ON DELETE SET NULL,

  metadata          JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- optional embedding for semantic retrieval of evidence snippets
  embedding         VECTOR(1536),

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at        TIMESTAMPTZ,
  created_by        UUID REFERENCES investors(id) ON DELETE SET NULL,
  updated_by        UUID REFERENCES investors(id) ON DELETE SET NULL,

  CONSTRAINT evidence_title_nonempty CHECK (length(trim(title)) > 0),
  CONSTRAINT evidence_has_subject_chk CHECK (
    founder_id IS NOT NULL
    OR company_id IS NOT NULL
    OR application_id IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS evidence_founder_idx
  ON evidence (founder_id, observed_at DESC NULLS LAST)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS evidence_company_idx
  ON evidence (company_id, observed_at DESC NULLS LAST)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS evidence_application_idx
  ON evidence (application_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS evidence_type_idx
  ON evidence (evidence_type, source_kind)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS evidence_verified_idx
  ON evidence (is_verified)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS evidence_embedding_idx
  ON evidence
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

DROP TRIGGER IF EXISTS trg_evidence_updated_at ON evidence;
CREATE TRIGGER trg_evidence_updated_at
  BEFORE UPDATE ON evidence
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- -----------------------------------------------------------------------------
-- Founder Score History (append-only scoring timeline)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS founder_score_history (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  founder_id        UUID NOT NULL REFERENCES founders(id) ON DELETE CASCADE,
  application_id    UUID REFERENCES applications(id) ON DELETE SET NULL,
  score             NUMERIC(5,2) NOT NULL CHECK (score >= 0 AND score <= 100),
  model_version     TEXT,
  score_components  JSONB NOT NULL DEFAULT '{}'::jsonb, -- e.g. {github: 80, papers: 70, ...}
  rationale         TEXT,
  evidence_ids      UUID[] NOT NULL DEFAULT '{}',
  scored_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  scored_by         UUID REFERENCES investors(id) ON DELETE SET NULL, -- null => system/AI
  metadata          JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at        TIMESTAMPTZ,
  created_by        UUID REFERENCES investors(id) ON DELETE SET NULL,
  updated_by        UUID REFERENCES investors(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS founder_score_history_founder_scored_idx
  ON founder_score_history (founder_id, scored_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS founder_score_history_application_idx
  ON founder_score_history (application_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS founder_score_history_score_idx
  ON founder_score_history (score DESC)
  WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_founder_score_history_updated_at ON founder_score_history;
CREATE TRIGGER trg_founder_score_history_updated_at
  BEFORE UPDATE ON founder_score_history
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Keep founders.current_founder_score in sync on insert
CREATE OR REPLACE FUNCTION sync_founder_current_score()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.deleted_at IS NULL THEN
    UPDATE founders
    SET current_founder_score = NEW.score,
        updated_at = NOW()
    WHERE id = NEW.founder_id
      AND deleted_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_founder_current_score ON founder_score_history;
CREATE TRIGGER trg_sync_founder_current_score
  AFTER INSERT ON founder_score_history
  FOR EACH ROW EXECUTE FUNCTION sync_founder_current_score();

-- -----------------------------------------------------------------------------
-- Trust Score (current snapshot + history)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS trust_scores (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  founder_id        UUID NOT NULL REFERENCES founders(id) ON DELETE CASCADE,
  score             NUMERIC(5,2) NOT NULL CHECK (score >= 0 AND score <= 100),
  risk_level        risk_level NOT NULL DEFAULT 'medium',
  model_version     TEXT,
  factors           JSONB NOT NULL DEFAULT '{}'::jsonb,
  rationale         TEXT,
  evidence_ids      UUID[] NOT NULL DEFAULT '{}',
  is_current        BOOLEAN NOT NULL DEFAULT TRUE,
  scored_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  scored_by         UUID REFERENCES investors(id) ON DELETE SET NULL,
  metadata          JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at        TIMESTAMPTZ,
  created_by        UUID REFERENCES investors(id) ON DELETE SET NULL,
  updated_by        UUID REFERENCES investors(id) ON DELETE SET NULL
);

-- One current trust score per founder (soft-delete aware)
CREATE UNIQUE INDEX IF NOT EXISTS trust_scores_current_per_founder_uidx
  ON trust_scores (founder_id)
  WHERE deleted_at IS NULL AND is_current = TRUE;

CREATE INDEX IF NOT EXISTS trust_scores_founder_scored_idx
  ON trust_scores (founder_id, scored_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS trust_scores_risk_idx
  ON trust_scores (risk_level, score DESC)
  WHERE deleted_at IS NULL AND is_current = TRUE;

DROP TRIGGER IF EXISTS trg_trust_scores_updated_at ON trust_scores;
CREATE TRIGGER trg_trust_scores_updated_at
  BEFORE UPDATE ON trust_scores
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE FUNCTION sync_founder_trust_score()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.deleted_at IS NULL AND NEW.is_current IS TRUE THEN
    -- demote previous current rows
    UPDATE trust_scores
    SET is_current = FALSE,
        updated_at = NOW()
    WHERE founder_id = NEW.founder_id
      AND id <> NEW.id
      AND deleted_at IS NULL
      AND is_current = TRUE;

    UPDATE founders
    SET current_trust_score = NEW.score,
        updated_at = NOW()
    WHERE id = NEW.founder_id
      AND deleted_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_founder_trust_score ON trust_scores;
CREATE TRIGGER trg_sync_founder_trust_score
  AFTER INSERT OR UPDATE OF is_current, score, deleted_at ON trust_scores
  FOR EACH ROW EXECUTE FUNCTION sync_founder_trust_score();

-- -----------------------------------------------------------------------------
-- Investment Memos
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS investment_memos (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id            UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  application_id        UUID REFERENCES applications(id) ON DELETE SET NULL,
  author_id             UUID REFERENCES investors(id) ON DELETE SET NULL,
  title                 TEXT NOT NULL,
  status                memo_status NOT NULL DEFAULT 'draft',
  recommendation        memo_recommendation NOT NULL DEFAULT 'watch',
  conviction            INTEGER NOT NULL DEFAULT 50 CHECK (conviction >= 0 AND conviction <= 100),
  risk_level            risk_level NOT NULL DEFAULT 'medium',
  summary               TEXT NOT NULL DEFAULT '',
  thesis                TEXT NOT NULL DEFAULT '',
  market                TEXT NOT NULL DEFAULT '',
  team                  TEXT NOT NULL DEFAULT '',
  product               TEXT NOT NULL DEFAULT '',
  risks                 TEXT[] NOT NULL DEFAULT '{}',
  ask_amount_usd        NUMERIC(18,2) CHECK (ask_amount_usd IS NULL OR ask_amount_usd >= 0),
  proposed_ownership_pct NUMERIC(5,2)
    CHECK (proposed_ownership_pct IS NULL OR (proposed_ownership_pct >= 0 AND proposed_ownership_pct <= 100)),
  evidence_ids          UUID[] NOT NULL DEFAULT '{}',
  published_at          TIMESTAMPTZ,
  metadata              JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at            TIMESTAMPTZ,
  created_by            UUID REFERENCES investors(id) ON DELETE SET NULL,
  updated_by            UUID REFERENCES investors(id) ON DELETE SET NULL,

  CONSTRAINT investment_memos_title_nonempty CHECK (length(trim(title)) > 0)
);

CREATE INDEX IF NOT EXISTS investment_memos_company_idx
  ON investment_memos (company_id, updated_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS investment_memos_application_idx
  ON investment_memos (application_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS investment_memos_status_idx
  ON investment_memos (status, recommendation)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS investment_memos_author_idx
  ON investment_memos (author_id)
  WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_investment_memos_updated_at ON investment_memos;
CREATE TRIGGER trg_investment_memos_updated_at
  BEFORE UPDATE ON investment_memos
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Memo reviewers (optional IC workflow)
CREATE TABLE IF NOT EXISTS investment_memo_reviews (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  memo_id           UUID NOT NULL REFERENCES investment_memos(id) ON DELETE CASCADE,
  reviewer_id       UUID NOT NULL REFERENCES investors(id) ON DELETE CASCADE,
  decision          memo_recommendation,
  comments          TEXT,
  reviewed_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata          JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at        TIMESTAMPTZ,
  created_by        UUID REFERENCES investors(id) ON DELETE SET NULL,
  updated_by        UUID REFERENCES investors(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS investment_memo_reviews_active_uidx
  ON investment_memo_reviews (memo_id, reviewer_id)
  WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_investment_memo_reviews_updated_at ON investment_memo_reviews;
CREATE TRIGGER trg_investment_memo_reviews_updated_at
  BEFORE UPDATE ON investment_memo_reviews
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- -----------------------------------------------------------------------------
-- Documents (general knowledge base + pgvector)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS documents (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type       TEXT NOT NULL, -- memo, pitch_deck, evidence, paper, note, etc.
  source_id         UUID,
  title             TEXT NOT NULL,
  content           TEXT NOT NULL,
  metadata          JSONB NOT NULL DEFAULT '{}'::jsonb,
  embedding         VECTOR(1536),

  founder_id        UUID REFERENCES founders(id) ON DELETE SET NULL,
  company_id        UUID REFERENCES companies(id) ON DELETE SET NULL,
  application_id    UUID REFERENCES applications(id) ON DELETE SET NULL,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at        TIMESTAMPTZ,
  created_by        UUID REFERENCES investors(id) ON DELETE SET NULL,
  updated_by        UUID REFERENCES investors(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS documents_source_idx
  ON documents (source_type, source_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS documents_company_idx
  ON documents (company_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS documents_founder_idx
  ON documents (founder_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS documents_embedding_idx
  ON documents
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

DROP TRIGGER IF EXISTS trg_documents_updated_at ON documents;
CREATE TRIGGER trg_documents_updated_at
  BEFORE UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE FUNCTION match_documents(
  query_embedding VECTOR(1536),
  match_count INT DEFAULT 10,
  filter_company_id UUID DEFAULT NULL,
  filter_founder_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  source_type TEXT,
  source_id UUID,
  title TEXT,
  content TEXT,
  metadata JSONB,
  similarity FLOAT
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    d.id,
    d.source_type,
    d.source_id,
    d.title,
    d.content,
    d.metadata,
    1 - (d.embedding <=> query_embedding) AS similarity
  FROM documents d
  WHERE d.deleted_at IS NULL
    AND d.embedding IS NOT NULL
    AND (filter_company_id IS NULL OR d.company_id = filter_company_id)
    AND (filter_founder_id IS NULL OR d.founder_id = filter_founder_id)
  ORDER BY d.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- -----------------------------------------------------------------------------
-- Soft-delete helper
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION soft_delete(p_table TEXT, p_id UUID, p_actor UUID DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  EXECUTE format(
    'UPDATE %I SET deleted_at = NOW(), updated_at = NOW(), updated_by = $2 WHERE id = $1 AND deleted_at IS NULL',
    p_table
  )
  USING p_id, p_actor;
END;
$$;

-- -----------------------------------------------------------------------------
-- Row Level Security (optional baseline — enable as needed)
-- -----------------------------------------------------------------------------
-- ALTER TABLE investors ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY investors_self_read ON investors
--   FOR SELECT USING (auth_user_id = auth.uid() OR deleted_at IS NULL);
