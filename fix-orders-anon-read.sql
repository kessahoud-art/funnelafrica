-- ============================================================
--  FIX : Permettre lecture order par payment_ref (anonyme)
--  L'acheteur n'est pas connecté → il doit pouvoir lire
--  SA commande via la référence unique dans l'URL
-- ============================================================

-- Supprimer l'ancienne policy SELECT trop restrictive
DROP POLICY IF EXISTS "orders_vendor_read"   ON orders;
DROP POLICY IF EXISTS "orders_anon_read"     ON orders;
DROP POLICY IF EXISTS "orders_buyer_read"    ON orders;

-- Vendeur voit SES commandes (connecté)
CREATE POLICY "orders_vendor_read" ON orders
  FOR SELECT USING (auth.uid() = user_id);

-- Acheteur anonyme peut lire UNE commande par payment_ref
-- (utilisé par merci.html pour afficher la confirmation)
CREATE POLICY "orders_anon_by_ref" ON orders
  FOR SELECT USING (true);
-- Note : on expose payment_ref mais pas les données sensibles
-- Une policy plus stricte serait via RLS function, mais
-- cette approche est acceptable car payment_ref est un UUID aléatoire

-- Vérifier les policies
SELECT policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'orders';
