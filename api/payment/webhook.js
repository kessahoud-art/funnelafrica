// ============================================================
//  api/payment/webhook.js
//  Vercel Serverless Function — Webhook FedaPay
//  FedaPay appelle cette URL automatiquement après paiement
//
//  Variables Vercel requises :
//  FEDAPAY_SECRET_KEY   = sk_live_xxxx
//  SUPABASE_URL         = https://xxxxx.supabase.co
//  SUPABASE_SERVICE_KEY = ta clé service_role Supabase
//  APP_URL              = https://funnelafrica.vercel.app
// ============================================================

import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const payload = req.body;

    console.log('FedaPay webhook reçu:', JSON.stringify(payload));

    // FedaPay envoie l'événement dans payload
    const eventName    = payload.name || payload.event;
    const transaction  = payload.data?.object || payload.transaction;

    // On traite uniquement les paiements approuvés
    const isApproved = (
      eventName === 'transaction.approved' ||
      transaction?.status === 'approved'
    );

    if (!isApproved) {
      console.log(`Événement ignoré: ${eventName}`);
      return res.status(200).json({ message: 'Ignoré' });
    }

    // Récupérer l'order_id depuis les métadonnées
    const metadata   = transaction?.metadata || {};
    const orderId    = metadata.order_id || transaction?.custom_metadata?.order_id;
    const amount     = transaction?.amount;
    const currency   = transaction?.currency?.iso || 'XOF';

    if (!orderId) {
      console.error('order_id manquant dans metadata');
      return res.status(200).json({ message: 'order_id manquant' });
    }

    // ── Initialiser Supabase avec clé SERVICE ──
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    // ── Trouver la commande ──
    const { data: order, error: findErr } = await supabase
      .from('orders')
      .select('*, tunnels(user_id, name, orders, revenue)')
      .eq('payment_ref', orderId)
      .single();

    if (findErr || !order) {
      console.error('Commande introuvable:', orderId);
      return res.status(200).json({ message: 'Commande introuvable' });
    }

    // Éviter les doublons
    if (order.payment_status === 'paid') {
      console.log('Déjà traité:', orderId);
      return res.status(200).json({ message: 'Déjà traité' });
    }

    // ── Marquer la commande comme payée ──
    await supabase
      .from('orders')
      .update({
        payment_status: 'paid',
        paid_at:        new Date().toISOString()
      })
      .eq('id', order.id);

    console.log(`✅ Commande payée : ${orderId}`);

    // ── Mettre à jour les stats du tunnel ──
    if (order.tunnel_id && order.tunnels) {
      await supabase
        .from('tunnels')
        .update({
          orders:  (order.tunnels.orders  || 0) + 1,
          revenue: (order.tunnels.revenue || 0) + (order.amount || 0)
        })
        .eq('id', order.tunnel_id);
    }

    // ── Ajouter le contact à la liste email ──
    if (order.tunnels?.user_id) {
      await supabase
        .from('contacts')
        .upsert({
          user_id:   order.tunnels.user_id,
          tunnel_id: order.tunnel_id,
          name:      order.buyer_name,
          email:     order.buyer_email,
          phone:     order.buyer_phone,
          country:   order.buyer_country || 'BJ',
          source:    'purchase'
        }, { onConflict: 'user_id,email' });
    }

    // ── Envoyer email de confirmation ──
    const APP_URL = process.env.APP_URL || 'https://funnelafrica.vercel.app';

    try {
      await fetch(`${APP_URL}/api/email/confirmation`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          buyer_name:     order.buyer_name,
          buyer_email:    order.buyer_email,
          product_name:   order.tunnels?.name || 'Votre achat',
          amount:         order.amount,
          currency:       order.currency || 'XOF',
          payment_method: order.payment_method || 'fedapay',
          order_ref:      order.payment_ref
        })
      });
    } catch (emailErr) {
      console.error('Email error (non bloquant):', emailErr);
    }

    return res.status(200).json({ message: 'OK' });

  } catch (err) {
    console.error('Webhook error:', err);
    // Toujours retourner 200 pour éviter les retries
    return res.status(200).json({ error: 'Erreur interne — logged' });
  }
}
