// ============================================================
//  api/payment/webhook.js
//  Vercel Serverless Function — Webhook CinetPay
//  CinetPay appelle cette URL automatiquement après paiement
//
//  Variables d'environnement Vercel à ajouter :
//  CINETPAY_API_KEY  = ta clé API CinetPay
//  CINETPAY_SITE_ID  = ton site ID CinetPay
//  SUPABASE_URL      = https://xxxxx.supabase.co
//  SUPABASE_SERVICE_KEY = ta clé SERVICE (pas anon !) depuis
//                         Supabase → Settings → API → service_role
// ============================================================

import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {

  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // CinetPay envoie POST avec les données du paiement
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const { cpm_trans_id, cpm_site_id } = req.body;

    if (!cpm_trans_id) {
      return res.status(400).json({ error: 'transaction_id manquant' });
    }

    // ── 1. Vérifier le paiement auprès de CinetPay ──
    const verifyRes = await fetch('https://api-checkout.cinetpay.com/v2/payment/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apikey:         process.env.CINETPAY_API_KEY,
        site_id:        process.env.CINETPAY_SITE_ID,
        transaction_id: cpm_trans_id
      })
    });

    const verifyData = await verifyRes.json();

    // Statut attendu = '00' pour paiement accepté
    if (verifyData.code !== '00' || verifyData.data?.status !== 'ACCEPTED') {
      console.log('Paiement non accepté:', verifyData);
      return res.status(200).json({ message: 'Paiement non accepté — ignoré' });
    }

    // ── 2. Mettre à jour la commande dans Supabase ──
    // On utilise la clé SERVICE pour bypasser le RLS
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    // Trouver la commande par payment_ref
    const { data: order, error: findErr } = await supabase
      .from('orders')
      .select('*, tunnels(user_id, orders, revenue)')
      .eq('payment_ref', cpm_trans_id)
      .single();

    if (findErr || !order) {
      console.error('Commande introuvable:', cpm_trans_id);
      return res.status(200).json({ message: 'Commande introuvable — ignorée' });
    }

    // Éviter les doublons (webhook peut être appelé 2x)
    if (order.payment_status === 'paid') {
      return res.status(200).json({ message: 'Déjà traité' });
    }

    // Marquer la commande comme payée
    await supabase
      .from('orders')
      .update({
        payment_status: 'paid',
        paid_at: new Date().toISOString()
      })
      .eq('id', order.id);

    // ── 3. Mettre à jour les stats du tunnel ──
    if (order.tunnel_id && order.tunnels) {
      await supabase
        .from('tunnels')
        .update({
          orders:  (order.tunnels.orders  || 0) + 1,
          revenue: (order.tunnels.revenue || 0) + order.amount
        })
        .eq('id', order.tunnel_id);
    }

    // ── 4. Ajouter le contact à la liste email ──
    if (order.tunnels?.user_id) {
      await supabase
        .from('contacts')
        .upsert({
          user_id:   order.tunnels.user_id,
          tunnel_id: order.tunnel_id,
          name:      order.buyer_name,
          email:     order.buyer_email,
          phone:     order.buyer_phone,
          country:   order.buyer_country,
          source:    'purchase'
        }, { onConflict: 'user_id,email' });
    }

    // ── 5. (Optionnel) Envoyer email de confirmation ──
    // await sendConfirmationEmail(order);

    console.log(`✅ Paiement confirmé : ${cpm_trans_id} — ${order.amount} ${order.currency}`);
    return res.status(200).json({ message: 'OK' });

  } catch (err) {
    console.error('Webhook error:', err);
    // Toujours retourner 200 à CinetPay sinon il réessaie
    return res.status(200).json({ error: 'Erreur interne — logged' });
  }
}
