-- ============================================================
--  FunnelAfrica — Nouveau modèle : Commission 15% uniquement
--  Suppression des plans Starter/Pro/Scale
--  Accès gratuit pour tous les vendeurs
-- ============================================================

-- 1. Taux commission fixe 15% dans profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS commission_rate   NUMERIC(5,2) DEFAULT 15.00,
  ADD COLUMN IF NOT EXISTS payout_balance    NUMERIC(12,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS total_gross       NUMERIC(12,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS total_commission  NUMERIC(12,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS total_net         NUMERIC(12,2) DEFAULT 0.00;

-- 2. Mettre tous les plans à NULL / 'free'
UPDATE public.profiles SET plan = 'free', commission_rate = 15.00;

-- 3. Colonnes commission dans orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS commission_rate   NUMERIC(5,2) DEFAULT 15.00,
  ADD COLUMN IF NOT EXISTS commission_amount NUMERIC(12,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS net_amount        NUMERIC(12,2) DEFAULT 0.00;

-- 4. Recalculer les orders payés existants
UPDATE public.orders
SET
  commission_rate   = 15.00,
  commission_amount = ROUND(amount * 0.15, 0),
  net_amount        = amount - ROUND(amount * 0.15, 0)
WHERE payment_status = 'paid'
  AND (net_amount IS NULL OR net_amount = 0);

-- 5. Recalculer les soldes vendeurs existants
UPDATE public.profiles p
SET
  total_gross       = COALESCE((SELECT SUM(amount)            FROM orders WHERE user_id = p.id AND payment_status = 'paid'), 0),
  total_commission  = COALESCE((SELECT SUM(commission_amount) FROM orders WHERE user_id = p.id AND payment_status = 'paid'), 0),
  total_net         = COALESCE((SELECT SUM(net_amount)        FROM orders WHERE user_id = p.id AND payment_status = 'paid'), 0),
  payout_balance    = COALESCE((SELECT SUM(net_amount)        FROM orders WHERE user_id = p.id AND payment_status = 'paid'), 0)
      - COALESCE((SELECT SUM(amount) FROM payouts WHERE user_id = p.id AND status = 'paid'), 0);

-- 6. Seuil retrait = 5000 FCFA
-- (géré dans api/payout/request.js)

-- Vérification
SELECT
  COUNT(*) as vendeurs,
  AVG(commission_rate) as taux_moyen,
  SUM(payout_balance) as solde_total
FROM public.profiles
WHERE role = 'vendor' OR plan = 'free';
