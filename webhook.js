// ============================================================
//  api/payment/webhook.js
//  Webhook FedaPay — Confirmation paiement + gestion upsell
//
//  Variables Vercel :
//  FEDAPAY_SECRET_KEY   = sk_live_xxxx
//  SUPABASE_URL         = https://xxxxx.supabase.co
//  SUPABASE_SERVICE_KEY = clé service_role
//  APP_URL              = https://funnelafrica.vercel.app
// ============================================================

const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const payload     = req.body;
    const eventName   = payload.name || payload.event;
    const transaction = payload.data?.object || payload.transaction;

    const isApproved = (
      eventName === 'transaction.approved' ||
      transaction?.status === 'approved'
    );

    if (!isApproved) {
      console.log('Événement ignoré:', eventName);
      return res.status(200).json({ message: 'Ignoré' });
    }

    const metadata = transaction?.metadata || {};
    const orderId  = metadata.order_id || transaction?.custom_metadata?.order_id;

    if (!orderId) {
      console.error('order_id manquant');
      return res.status(200).json({ message: 'order_id manquant' });
    }

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    // ── Cas 1 : Abonnement plan ──
    if (orderId.startsWith('SUB-')) {
      const { data: order } = await supabase
        .from('orders').select('*').eq('payment_ref', orderId).single();

      if (!order || order.payment_status === 'paid') {
        return res.status(200).json({ message: 'Déjà traité ou introuvable' });
      }

      await supabase.from('orders')
        .update({ payment_status:'paid', paid_at: new Date().toISOString() })
        .eq('id', order.id);

      const planKey    = orderId.split('-')[1]?.toLowerCase() || 'starter';
      const validPlans = ['starter','pro','scale'];
      const plan       = validPlans.includes(planKey) ? planKey : 'starter';

      await supabase.from('profiles')
        .update({ plan, plan_status:'active', updated_at: new Date().toISOString() })
        .eq('id', order.user_id);

      console.log(`✅ Plan ${plan} activé`);
      return res.status(200).json({ message: 'Plan activé', plan });
    }

    // ── Cas 2 : Upsell ──
    if (orderId.startsWith('UP-')) {
      const { data: order } = await supabase
        .from('orders').select('*').eq('payment_ref', orderId).single();

      if (!order || order.payment_status === 'paid') {
        return res.status(200).json({ message: 'Déjà traité' });
      }

      await supabase.from('orders')
        .update({ payment_status:'paid', paid_at: new Date().toISOString() })
        .eq('id', order.id);

      console.log(`✅ Upsell payé : ${orderId}`);

      // Envoyer email de confirmation upsell
      const APP_URL = process.env.APP_URL || 'https://funnelafrica.vercel.app';
      try {
        await fetch(`${APP_URL}/api/email/confirmation`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            buyer_name:     order.buyer_name,
            buyer_email:    order.buyer_email,
            product_name:   'Offre complémentaire',
            amount:         order.amount,
            currency:       order.currency || 'XOF',
            payment_method: order.payment_method || 'fedapay',
            order_ref:      order.payment_ref
          })
        });
      } catch(e) { console.error('Email upsell:', e); }

      return res.status(200).json({ message: 'Upsell traité' });
    }

    // ── Cas 3 : Paiement tunnel principal (FA-) ──
    const { data: order } = await supabase
      .from('orders')
      .select('*, tunnels(user_id, name, orders, revenue, slug, page_config)')
      .eq('payment_ref', orderId)
      .single();

    if (!order) {
      console.error('Commande introuvable:', orderId);
      return res.status(200).json({ message: 'Introuvable' });
    }

    if (order.payment_status === 'paid') {
      return res.status(200).json({ message: 'Déjà traité' });
    }

    // Marquer comme payé
    await supabase.from('orders')
      .update({ payment_status:'paid', paid_at: new Date().toISOString() })
      .eq('id', order.id);

    // Mettre à jour les stats tunnel
    if (order.tunnel_id && order.tunnels) {
      await supabase.from('tunnels').update({
        orders:  (order.tunnels.orders  || 0) + 1,
        revenue: (order.tunnels.revenue || 0) + (order.amount || 0)
      }).eq('id', order.tunnel_id);
    }

    // Ajouter le contact à la liste
    if (order.tunnels?.user_id) {
      await supabase.from('contacts').upsert({
        user_id:   order.tunnels.user_id,
        tunnel_id: order.tunnel_id,
        name:      order.buyer_name,
        email:     order.buyer_email,
        phone:     order.buyer_phone,
        country:   order.buyer_country || 'BJ',
        source:    'purchase'
      }, { onConflict: 'user_id,email' });
    }

    // Envoyer email de confirmation
    const APP_URL = process.env.APP_URL || 'https://funnelafrica.vercel.app';
    try {
      await fetch(`${APP_URL}/api/email/confirmation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          buyer_name:     order.buyer_name,
          buyer_email:    order.buyer_email,
          product_name:   order.tunnels?.name || 'Votre achat',
          amount:         order.amount,
          currency:       order.currency || 'XOF',
          payment_method: order.payment_method || 'fedapay',
          order_ref:      order.payment_ref,
          // Lien vers l'espace membre du bon tunnel
          access_url:     order.tunnels?.slug
            ? `${APP_URL}/espace-membre.html?tunnel=${order.tunnels.slug}`
            : `${APP_URL}/espace-membre.html`
        })
      });
    } catch(e) { console.error('Email confirmation:', e); }

    console.log(`✅ Paiement confirmé : ${orderId}`);

    // ── Vérifier si le tunnel a un upsell configuré ──
    const hasUpsell = order.tunnels?.page_config?.upsell?.enabled === true;

    if (hasUpsell) {
      // Logger que l'acheteur doit voir l'upsell
      // (FedaPay redirige vers merci.html ou upsell.html selon la config)
      console.log('Upsell disponible pour ce tunnel');
    }

    return res.status(200).json({ message: 'OK', hasUpsell });

  } catch (err) {
    console.error('Webhook error:', err);
    return res.status(200).json({ error: 'Erreur interne' });
  }
}
