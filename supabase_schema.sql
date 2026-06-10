-- MDR Platform Schema (Auth & RLS Skipped for now)
-- Execute this script in your Supabase SQL Editor

-- 1. Create Extensions if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Create user_profiles table (linked to auth.users in future)
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  role TEXT NOT NULL DEFAULT 'analyst' CHECK (role IN ('admin', 'analyst')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Create clients table
CREATE TABLE IF NOT EXISTS public.clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  industry TEXT,
  splunk_url TEXT,
  splunk_token TEXT,
  edr_vendor TEXT,
  firewall_vendor TEXT,
  contact_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Create user_clients table (maps analysts to clients)
CREATE TABLE IF NOT EXISTS public.user_clients (
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, client_id)
);

-- 5. Create hypotheses table
CREATE TABLE IF NOT EXISTS public.hypotheses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  mitre_id TEXT,
  mitre_tactic TEXT,
  source TEXT CHECK (source IN ('manual', 'ai')),
  status TEXT CHECK (status IN ('draft', 'approved', 'running', 'complete')),
  splunk_query TEXT,
  created_by TEXT, -- Changed to TEXT temporarily to accept mock string IDs
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  approved_by TEXT, -- Changed to TEXT temporarily to accept mock string IDs
  rejected_reason TEXT
);

-- 6. Create hunt_results table
CREATE TABLE IF NOT EXISTS public.hunt_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  hypothesis_id UUID NOT NULL REFERENCES public.hypotheses(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  verdict TEXT CHECK (verdict IN ('TP', 'FP', 'clean')),
  evidence TEXT,
  analyst_notes TEXT,
  executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Create ioc_reports table
CREATE TABLE IF NOT EXISTS public.ioc_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  ioc_type TEXT CHECK (ioc_type IN ('ip', 'domain', 'hash', 'url')),
  value TEXT NOT NULL,
  confidence TEXT,
  threat_actor TEXT,
  source TEXT,
  ai_summary TEXT,
  report_date TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. Create reports table
CREATE TABLE IF NOT EXISTS public.reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  report_type TEXT CHECK (report_type IN ('hunt', 'ioc')),
  file_url TEXT NOT NULL,
  sent_at TIMESTAMPTZ,
  report_date TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- NOTE: Row Level Security (RLS) is disabled so you can test the UI without configuring Authentication first.

-- 9. Create pipeline_logs table
CREATE TABLE IF NOT EXISTS public.pipeline_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  crew_type TEXT NOT NULL,
  status TEXT CHECK (status IN ('started', 'success', 'failed')),
  error_msg TEXT,
  run_date TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

