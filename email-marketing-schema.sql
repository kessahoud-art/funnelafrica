-- ============================================================
--  FunnelAfrica — Email Marketing Schema Update
-- ============================================================

-- 1. Table campaigns (campagnes email vendeurs)
CREATE TABLE IF NOT EXISTS public.campaigns (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  subject         TEXT NOT NULL,
  body_html       TEXT,
  body_text       TEXT,
  target_segment  TEXT DEFAULT 'all', -- all | buyers | leads
  status          TEXT DEFAULT 'draft', -- draft | sent | scheduled
  sent_count      INTEGER DEFAULT 0,
  open_count      INTEGER DEFAULT 0,
  click_count     INTEGER DEFAULT 0,
  unsub_count     INTEGER DEFAULT 0,
  scheduled_at    TIMESTAMPTZ,
  sent_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "campaigns_own" ON public.campaigns FOR ALL USING (auth.uid() = user_id);

-- 2. Table email_events (tracking open/click/unsub)
CREATE TABLE IF NOT EXISTS public.email_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  campaign_id     UUID REFERENCES public.campaigns(id) ON DELETE CASCADE,
  contact_email   TEXT NOT NULL,
  event_type      TEXT NOT NULL, -- open | click | unsub | bounce
  url_clicked     TEXT,
  ip_hash         TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.email_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "events_own" ON public.email_events FOR ALL USING (auth.uid() = user_id);

-- 3. Table unsubscribes (désabonnements)
CREATE TABLE IF NOT EXISTS public.unsubscribes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id       UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  email           TEXT NOT NULL,
  reason          TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(vendor_id, email)
);
ALTER TABLE public.unsubscribes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "unsub_own"       ON public.unsubscribes FOR ALL USING (auth.uid() = vendor_id);
CREATE POLICY "unsub_insert_anon" ON public.unsubscribes FOR INSERT WITH CHECK (TRUE);

-- 4. Colonnes config email dans profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email_enabled      BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS email_sequences_on BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS brevo_key          TEXT,
  ADD COLUMN IF NOT EXISTS from_email         TEXT,
  ADD COLUMN IF NOT EXISTS from_name          TEXT;

-- 5. Colonnes contacts manquantes
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS tags         TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS source       TEXT DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS unsubscribed BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS country      TEXT,
  ADD COLUMN IF NOT EXISTS phone        TEXT;

-- 6. Index performance
CREATE INDEX IF NOT EXISTS idx_campaigns_user    ON public.campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_email_events_camp ON public.email_events(campaign_id);
CREATE INDEX IF NOT EXISTS idx_unsubscribes_email ON public.unsubscribes(email, vendor_id);

SELECT 'campaigns'     AS tbl, COUNT(*) FROM public.campaigns
UNION SELECT 'email_events', COUNT(*) FROM public.email_events
UNION SELECT 'unsubscribes', COUNT(*) FROM public.unsubscribes;
