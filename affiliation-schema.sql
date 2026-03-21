-- ============================================================
--  FunnelAfrica — Mise à jour schema Supabase : Affiliation
--  À exécuter dans Supabase SQL Editor
-- ============================================================

-- 1. Ajouter colonnes affiliation dans profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS affiliate_code       TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS affiliate_enabled    BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS affiliate_commission INTEGER DEFAULT 20;

-- 2. Table des affiliés (relation vendeur → affilié)
CREATE TABLE IF NOT EXISTS public.affiliates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id       UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  affiliate_id    UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  tunnel_id       UUID REFERENCES public.tunnels(id) ON DELETE CASCADE,
  status          TEXT DEFAULT 'active',  -- active | suspended
  commission_pct  INTEGER DEFAULT 20,
  total_clicks    INTEGER DEFAULT 0,
  total_sales     INTEGER DEFAULT 0,
  total_earned    BIGINT DEFAULT 0,
  total_paid      BIGINT DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(vendor_id, affiliate_id, tunnel_id)
);

-- 3. Table des clics affiliés
CREATE TABLE IF NOT EXISTS public.affiliate_clicks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id  UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  tunnel_id     UUID REFERENCES public.tunnels(id) ON DELETE CASCADE,
  ref_code      TEXT,
  ip_hash       TEXT,
  user_agent    TEXT,
  converted     BOOLEAN DEFAULT false,
  order_id      UUID REFERENCES public.orders(id),
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- 4. Table des commissions
CREATE TABLE IF NOT EXISTS public.affiliate_commissions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id  UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  vendor_id     UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  order_id      UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  tunnel_id     UUID REFERENCES public.tunnels(id),
  amount        BIGINT NOT NULL,
  commission_pct INTEGER DEFAULT 20,
  status        TEXT DEFAULT 'pending',  -- pending | paid | cancelled
  paid_at       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- 5. RLS policies
ALTER TABLE public.affiliates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_clicks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_commissions ENABLE ROW LEVEL SECURITY;

-- Vendeur peut voir ses affiliés
CREATE POLICY "vendor_see_affiliates" ON public.affiliates
  FOR SELECT USING (vendor_id = auth.uid());

-- Affilié peut voir ses commissions
CREATE POLICY "affiliate_see_commissions" ON public.affiliate_commissions
  FOR SELECT USING (affiliate_id = auth.uid() OR vendor_id = auth.uid());

-- 6. Fonction pour tracker un clic affilié
CREATE OR REPLACE FUNCTION track_affiliate_click(
  p_ref_code TEXT,
  p_tunnel_id UUID,
  p_ip_hash TEXT DEFAULT NULL
)
RETURNS void AS $$
DECLARE
  v_affiliate_id UUID;
BEGIN
  -- Trouver l'affilié via le code
  SELECT id INTO v_affiliate_id
    FROM public.profiles
   WHERE affiliate_code = p_ref_code
   LIMIT 1;

  IF v_affiliate_id IS NOT NULL THEN
    INSERT INTO public.affiliate_clicks
      (affiliate_id, tunnel_id, ref_code, ip_hash)
    VALUES
      (v_affiliate_id, p_tunnel_id, p_ref_code, p_ip_hash);

    -- Incrémenter le compteur
    UPDATE public.affiliates
       SET total_clicks = total_clicks + 1
     WHERE affiliate_id = v_affiliate_id AND tunnel_id = p_tunnel_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Fonction pour créer une commission après vente
CREATE OR REPLACE FUNCTION create_affiliate_commission(
  p_order_id UUID,
  p_ref_code TEXT
)
RETURNS void AS $$
DECLARE
  v_affiliate_id UUID;
  v_order        RECORD;
  v_commission   RECORD;
  v_amount       BIGINT;
BEGIN
  -- Récupérer l'affilié
  SELECT id INTO v_affiliate_id
    FROM public.profiles
   WHERE affiliate_code = p_ref_code;

  IF v_affiliate_id IS NULL THEN RETURN; END IF;

  -- Récupérer la commande
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
  IF NOT FOUND THEN RETURN; END IF;

  -- Récupérer la config affiliation du vendeur
  SELECT * INTO v_commission
    FROM public.affiliates
   WHERE affiliate_id = v_affiliate_id AND tunnel_id = v_order.tunnel_id;

  -- Commission = pourcentage du montant
  v_amount := (v_order.amount * COALESCE(v_commission.commission_pct, 20)) / 100;

  -- Créer la commission
  INSERT INTO public.affiliate_commissions
    (affiliate_id, vendor_id, order_id, tunnel_id, amount, commission_pct)
  VALUES
    (v_affiliate_id, v_order.user_id, p_order_id, v_order.tunnel_id, v_amount, COALESCE(v_commission.commission_pct, 20));

  -- Mettre à jour les totaux
  UPDATE public.affiliates
     SET total_sales = total_sales + 1,
         total_earned = total_earned + v_amount
   WHERE affiliate_id = v_affiliate_id AND tunnel_id = v_order.tunnel_id;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
