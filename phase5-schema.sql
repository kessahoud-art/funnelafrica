-- ============================================================
--  FunnelAfrica — Phase 5 : Scalabilité & Expansion
--  SQL à exécuter dans Supabase SQL Editor
-- ============================================================

-- 1. TABLE WHITE_LABELS (agences revendeuses)
CREATE TABLE IF NOT EXISTS public.white_labels (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id        UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  agency_name     TEXT NOT NULL,
  subdomain       TEXT UNIQUE NOT NULL,
  custom_domain   TEXT UNIQUE,
  logo_url        TEXT,
  primary_color   TEXT DEFAULT '#00c896',
  plan_override   TEXT DEFAULT 'pro',
  max_vendors     INTEGER DEFAULT 50,
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.white_labels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wl_ceo_only" ON public.white_labels
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 2. TABLE EXPANSION_CONFIGS (config paiement par pays)
CREATE TABLE IF NOT EXISTS public.expansion_configs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  country_code    TEXT NOT NULL,
  provider        TEXT NOT NULL, -- fedapay | paystack | mpesa | cinetpay
  public_key      TEXT,
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, country_code)
);
ALTER TABLE public.expansion_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "expansion_own" ON public.expansion_configs
  FOR ALL USING (auth.uid() = user_id);

-- 3. TABLE AI_GENERATIONS (historique générations IA)
CREATE TABLE IF NOT EXISTS public.ai_generations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  tunnel_id       UUID REFERENCES public.tunnels(id) ON DELETE SET NULL,
  type            TEXT NOT NULL,
  prompt_summary  TEXT,
  result          JSONB,
  tokens_used     INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.ai_generations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_gen_own" ON public.ai_generations
  FOR ALL USING (auth.uid() = user_id);

-- 4. TABLE MOBILE_TOKENS (push notifications app mobile)
CREATE TABLE IF NOT EXISTS public.mobile_tokens (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  token           TEXT NOT NULL,
  platform        TEXT NOT NULL, -- ios | android
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, token)
);
ALTER TABLE public.mobile_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tokens_own" ON public.mobile_tokens
  FOR ALL USING (auth.uid() = user_id);

-- 5. Colonnes supplémentaires dans profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS country_code       TEXT DEFAULT 'BJ',
  ADD COLUMN IF NOT EXISTS expansion_enabled  BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_credits         INTEGER DEFAULT 10,
  ADD COLUMN IF NOT EXISTS white_label_id     UUID REFERENCES public.white_labels(id),
  ADD COLUMN IF NOT EXISTS mobile_push_token  TEXT;

-- 6. Colonnes tunnels pour expansion
ALTER TABLE public.tunnels
  ADD COLUMN IF NOT EXISTS currency          TEXT DEFAULT 'XOF',
  ADD COLUMN IF NOT EXISTS country_code      TEXT DEFAULT 'BJ',
  ADD COLUMN IF NOT EXISTS payment_provider  TEXT DEFAULT 'fedapay';

-- 7. Donner 10 crédits IA à tous les vendeurs existants
UPDATE public.profiles SET ai_credits = 10 WHERE ai_credits IS NULL OR ai_credits = 0;

-- Vérification
SELECT 'white_labels' AS tbl, COUNT(*) FROM public.white_labels
UNION SELECT 'expansion_configs', COUNT(*) FROM public.expansion_configs
UNION SELECT 'ai_generations', COUNT(*) FROM public.ai_generations
UNION SELECT 'mobile_tokens', COUNT(*) FROM public.mobile_tokens;
