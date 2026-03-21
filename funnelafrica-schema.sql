-- ============================================================
--  FUNNELAFRICA — SCHEMA SUPABASE COMPLET
--  Colle ce code dans : Supabase Dashboard → SQL Editor → Run
-- ============================================================


-- ══════════════════════════════════════════════
--  1. TABLE : profiles (vendeurs)
--  Créée automatiquement après auth.users
-- ══════════════════════════════════════════════
CREATE TABLE profiles (
  id          UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  full_name   TEXT,
  email       TEXT,
  phone       TEXT,
  country     TEXT DEFAULT 'CI',
  plan        TEXT DEFAULT 'starter' CHECK (plan IN ('starter','pro','scale')),
  plan_status TEXT DEFAULT 'active'  CHECK (plan_status IN ('active','expired','cancelled')),
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-créer le profil à l'inscription
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, full_name, email, plan)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'plan', 'starter')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();


-- ══════════════════════════════════════════════
--  2. TABLE : tunnels
-- ══════════════════════════════════════════════
CREATE TABLE tunnels (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  name         TEXT NOT NULL,
  slug         TEXT UNIQUE NOT NULL,
  status       TEXT DEFAULT 'draft' CHECK (status IN ('draft','live','paused','archived')),
  template     TEXT DEFAULT 'formation',
  currency     TEXT DEFAULT 'FCFA',
  price        INTEGER DEFAULT 0,
  old_price    INTEGER DEFAULT 0,
  -- Stats
  views        INTEGER DEFAULT 0,
  orders       INTEGER DEFAULT 0,
  revenue      INTEGER DEFAULT 0,
  -- Config JSON (blocs de la page)
  page_config  JSONB DEFAULT '{}',
  -- Paiements activés
  payment_wave    BOOLEAN DEFAULT TRUE,
  payment_orange  BOOLEAN DEFAULT TRUE,
  payment_mtn     BOOLEAN DEFAULT TRUE,
  payment_cinetpay BOOLEAN DEFAULT FALSE,
  payment_card    BOOLEAN DEFAULT FALSE,
  -- Meta
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour accès rapide par slug (page publique)
CREATE INDEX idx_tunnels_slug ON tunnels(slug);
CREATE INDEX idx_tunnels_user ON tunnels(user_id);


-- ══════════════════════════════════════════════
--  3. TABLE : orders (commandes)
-- ══════════════════════════════════════════════
CREATE TABLE orders (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tunnel_id       UUID REFERENCES tunnels(id) ON DELETE SET NULL,
  user_id         UUID REFERENCES profiles(id) ON DELETE SET NULL,
  -- Acheteur
  buyer_name      TEXT NOT NULL,
  buyer_email     TEXT NOT NULL,
  buyer_phone     TEXT,
  buyer_country   TEXT DEFAULT 'CI',
  -- Paiement
  amount          INTEGER NOT NULL,
  currency        TEXT DEFAULT 'FCFA',
  payment_method  TEXT CHECK (payment_method IN ('wave','orange','mtn','cinetpay','card')),
  payment_status  TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending','paid','failed','refunded')),
  payment_ref     TEXT UNIQUE,
  -- Meta
  ip_address      TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  paid_at         TIMESTAMPTZ
);

CREATE INDEX idx_orders_tunnel  ON orders(tunnel_id);
CREATE INDEX idx_orders_user    ON orders(user_id);
CREATE INDEX idx_orders_status  ON orders(payment_status);
CREATE INDEX idx_orders_date    ON orders(created_at DESC);


-- ══════════════════════════════════════════════
--  4. TABLE : contacts (liste email)
-- ══════════════════════════════════════════════
CREATE TABLE contacts (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  tunnel_id   UUID REFERENCES tunnels(id) ON DELETE SET NULL,
  name        TEXT,
  email       TEXT NOT NULL,
  phone       TEXT,
  country     TEXT DEFAULT 'CI',
  tags        TEXT[] DEFAULT '{}',
  source      TEXT DEFAULT 'tunnel',
  subscribed  BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, email)
);

CREATE INDEX idx_contacts_user  ON contacts(user_id);
CREATE INDEX idx_contacts_email ON contacts(email);


-- ══════════════════════════════════════════════
--  5. TABLE : email_sequences
-- ══════════════════════════════════════════════
CREATE TABLE email_sequences (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  tunnel_id   UUID REFERENCES tunnels(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  status      TEXT DEFAULT 'draft' CHECK (status IN ('draft','active','paused')),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE email_steps (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sequence_id     UUID REFERENCES email_sequences(id) ON DELETE CASCADE NOT NULL,
  step_order      INTEGER NOT NULL,
  delay_hours     INTEGER DEFAULT 0,
  subject         TEXT NOT NULL,
  body_html       TEXT,
  sent_count      INTEGER DEFAULT 0,
  open_count      INTEGER DEFAULT 0,
  click_count     INTEGER DEFAULT 0
);


-- ══════════════════════════════════════════════
--  6. ROW LEVEL SECURITY (RLS)
--  CRITIQUE : chaque vendeur ne voit QUE ses données
-- ══════════════════════════════════════════════

-- Activer RLS sur toutes les tables
ALTER TABLE profiles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE tunnels         ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders          ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts        ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_steps     ENABLE ROW LEVEL SECURITY;

-- PROFILES : chaque user voit/modifie uniquement son profil
CREATE POLICY "profiles_own" ON profiles
  FOR ALL USING (auth.uid() = id);

-- TUNNELS : chaque vendeur gère ses tunnels
CREATE POLICY "tunnels_own" ON tunnels
  FOR ALL USING (auth.uid() = user_id);

-- Tunnels publics lisibles par tous (page publique)
CREATE POLICY "tunnels_public_read" ON tunnels
  FOR SELECT USING (status = 'live');

-- ORDERS : vendeur voit ses commandes, acheteur anonyme peut créer
CREATE POLICY "orders_vendor_read" ON orders
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "orders_insert_anon" ON orders
  FOR INSERT WITH CHECK (TRUE);

-- CONTACTS : vendeur gère ses contacts
CREATE POLICY "contacts_own" ON contacts
  FOR ALL USING (auth.uid() = user_id);

-- Contacts : insert anonyme (formulaire tunnel)
CREATE POLICY "contacts_insert_anon" ON contacts
  FOR INSERT WITH CHECK (TRUE);

-- EMAIL SEQUENCES
CREATE POLICY "sequences_own" ON email_sequences
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "steps_own" ON email_steps
  FOR ALL USING (
    sequence_id IN (
      SELECT id FROM email_sequences WHERE user_id = auth.uid()
    )
  );


-- ══════════════════════════════════════════════
--  7. FONCTION : auto-update updated_at
-- ══════════════════════════════════════════════
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_tunnels_updated
  BEFORE UPDATE ON tunnels
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_profiles_updated
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ══════════════════════════════════════════════
--  8. VUE : dashboard_stats (stats vendeur)
-- ══════════════════════════════════════════════
CREATE OR REPLACE VIEW dashboard_stats AS
SELECT
  t.user_id,
  COUNT(DISTINCT t.id)                                    AS total_tunnels,
  COUNT(DISTINCT t.id) FILTER (WHERE t.status = 'live')  AS live_tunnels,
  COALESCE(SUM(t.views), 0)                              AS total_views,
  COALESCE(SUM(t.orders), 0)                             AS total_orders,
  COALESCE(SUM(t.revenue), 0)                            AS total_revenue,
  COUNT(DISTINCT c.id)                                    AS total_contacts
FROM tunnels t
LEFT JOIN contacts c ON c.user_id = t.user_id
GROUP BY t.user_id;


-- ══════════════════════════════════════════════
--  TERMINÉ — Schema prêt !
-- ══════════════════════════════════════════════
