-- ============================================================
--  FunnelAfrica — Phase 4 : Monétisation Avancée
--  SQL à exécuter dans Supabase SQL Editor
-- ============================================================

-- 1. TABLE PAYOUTS (retraits vendeurs)
CREATE TABLE IF NOT EXISTS public.payouts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount           BIGINT NOT NULL,
  currency         TEXT DEFAULT 'XOF',
  method           TEXT NOT NULL, -- wave | mtn | orange | moov
  phone            TEXT NOT NULL,
  status           TEXT DEFAULT 'pending', -- pending | processing | paid | failed
  reference        TEXT UNIQUE,
  fedapay_id       TEXT,
  note             TEXT,
  created_at       TIMESTAMPTZ DEFAULT now(),
  processed_at     TIMESTAMPTZ
);
ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payouts_own" ON public.payouts FOR ALL USING (auth.uid() = user_id);

-- 2. TABLE API_KEYS (clés API publique)
CREATE TABLE IF NOT EXISTS public.api_keys (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  key_hash         TEXT UNIQUE NOT NULL,
  key_prefix       TEXT NOT NULL,
  scopes           TEXT[] DEFAULT ARRAY['read'],
  last_used_at     TIMESTAMPTZ,
  expires_at       TIMESTAMPTZ,
  is_active        BOOLEAN DEFAULT true,
  created_at       TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "api_keys_own" ON public.api_keys FOR ALL USING (auth.uid() = user_id);

-- 3. TABLE AB_TESTS (A/B testing tunnels)
CREATE TABLE IF NOT EXISTS public.ab_tests (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  tunnel_a_id      UUID REFERENCES public.tunnels(id),
  tunnel_b_id      UUID REFERENCES public.tunnels(id),
  name             TEXT NOT NULL,
  split            INTEGER DEFAULT 50,
  status           TEXT DEFAULT 'running', -- running | paused | winner_a | winner_b
  views_a          INTEGER DEFAULT 0,
  views_b          INTEGER DEFAULT 0,
  conversions_a    INTEGER DEFAULT 0,
  conversions_b    INTEGER DEFAULT 0,
  winner           TEXT,
  created_at       TIMESTAMPTZ DEFAULT now(),
  ended_at         TIMESTAMPTZ
);
ALTER TABLE public.ab_tests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ab_tests_own" ON public.ab_tests FOR ALL USING (auth.uid() = user_id);

-- 4. TABLE CUSTOM_DOMAINS (domaines personnalisés - Plan Scale)
CREATE TABLE IF NOT EXISTS public.custom_domains (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  domain           TEXT UNIQUE NOT NULL,
  verified         BOOLEAN DEFAULT false,
  ssl_status       TEXT DEFAULT 'pending',
  cname_target     TEXT DEFAULT 'cname.vercel-dns.com',
  created_at       TIMESTAMPTZ DEFAULT now(),
  verified_at      TIMESTAMPTZ
);
ALTER TABLE public.custom_domains ENABLE ROW LEVEL SECURITY;
CREATE POLICY "domains_own" ON public.custom_domains FOR ALL USING (auth.uid() = user_id);

-- 5. Ajouter colonne payout_balance dans profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS payout_balance  BIGINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_withdrawn BIGINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payout_phone    TEXT,
  ADD COLUMN IF NOT EXISTS payout_method   TEXT,
  ADD COLUMN IF NOT EXISTS domain          TEXT,
  ADD COLUMN IF NOT EXISTS api_enabled     BOOLEAN DEFAULT false;

-- Vérification
SELECT 'payouts' as tbl, count(*) FROM public.payouts
UNION SELECT 'api_keys', count(*) FROM public.api_keys
UNION SELECT 'ab_tests', count(*) FROM public.ab_tests
UNION SELECT 'custom_domains', count(*) FROM public.custom_domains;
