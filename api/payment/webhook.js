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
console.log("🚨 WEBHOOK HIT");
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

    const isDeclined = (
      eventName === 'transaction.declined' ||
      eventName === 'transaction.canceled'  ||
      transaction?.status === 'declined'    ||
      transaction?.status === 'canceled'
    );

    // ── Paiement échoué → notifier le vendeur ──
    if (isDeclined) {
      const supabaseD = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
      const metadata  = transaction?.metadata || {};
      const orderId   = metadata.order_id || transaction?.custom_metadata?.order_id;
      const APP_URL   = process.env.APP_URL || 'https://funnelafrica.vercel.app';

      console.warn(`⚠️ Paiement échoué — event: ${eventName} | order: ${orderId}`);

      if (orderId) {
        // Mettre à jour le statut de la commande
        await supabaseD.from('orders')
          .update({ payment_status: 'failed' })
          .eq('payment_ref', orderId);

        // Récupérer les infos pour notifier le vendeur
        const { data: order } = await supabaseD.from('orders')
          .select('*, tunnels(user_id, name, profiles(email, full_name))')
          .eq('payment_ref', orderId).single();

        if (order?.tunnels?.profiles?.email) {
          const vendorEmail = order.tunnels.profiles.email;
          const vendorName  = order.tunnels.profiles.full_name || vendorEmail.split('@')[0];

          // Enregistrer la notification dans Supabase
          await supabaseD.from('notifications').insert({
            user_id: order.tunnels.user_id,
            type:    'payment_failed',
            title:   '⚠️ Paiement échoué',
            message: `${order.buyer_name || 'Un client'} a tenté d'acheter "${order.tunnels.name}" mais le paiement a échoué (${transaction?.last_error_code || 'annulé'})`,
            data:    { order_id: order.id, order_ref: orderId },
            read:    false
          }).catch(() => {});

          // Email vendeur
          try {
            await fetch(`${APP_URL}/api/email/sequence`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                type:         'vendor_broadcast',
                vendor_id:    order.tunnels.user_id,
                message_subject: '⚠️ Paiement échoué sur votre tunnel',
                message_body:  `Bonjour ${vendorName},\n\n${order.buyer_name || 'Un visiteur'} a tenté d'acheter "${order.tunnels.name}" mais son paiement a échoué.\n\nRéférence : ${orderId}\nMontant : ${(order.amount||0).toLocaleString('fr')} FCFA\n\nVous pouvez contacter ce client directement si vous avez son numéro.`
              })
            });
          } catch(e) { console.error('Email vendeur paiement échoué:', e); }
        }
      }
      return res.status(200).json({ message: 'Paiement échoué traité', orderId });
    }

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
      .select('*, tunnels(user_id, name, orders, revenue, slug, page_config, profiles(payout_balance, total_gross, total_commission, total_net))')
      .eq('payment_ref', orderId)
      .single();

    if (!order) {
      console.error('Commande introuvable:', orderId);
      return res.status(200).json({ message: 'Introuvable' });
    }

    if (order.payment_status === 'paid') {
      return res.status(200).json({ message: 'Déjà traité' });
    }

    // ── Calcul commission — taux fixe 15% pour tous ──
    const gross      = order.amount || 0;
    const rate       = 15; // 15% fixe FunnelAfrica
    const commission = Math.round(gross * rate / 100);
    const net        = gross - commission;

    console.log(`💰 Montant: ${gross} FCFA | Commission: ${rate}% = ${commission} FCFA | Net vendeur: ${net} FCFA`);

    // Marquer comme payé avec les montants calculés
    await supabase.from('orders')
      .update({
        payment_status:    'paid',
        paid_at:           new Date().toISOString(),
        commission_rate:   rate,
        commission_amount: commission,
        net_amount:        net
      })
      .eq('id', order.id);

    // Mettre à jour les stats tunnel
    if (order.tunnel_id && order.tunnels) {
      await supabase.from('tunnels').update({
        orders:  (order.tunnels.orders  || 0) + 1,
        revenue: (order.tunnels.revenue || 0) + gross
      }).eq('id', order.tunnel_id);
    }

    // ── Mettre à jour le solde vendeur ──
    if (order.tunnels?.user_id) {
      const profile = order.tunnels.profiles || {};
      await supabase.from('profiles').update({
        payout_balance:   (profile.payout_balance   || 0) + net,
        total_gross:      (profile.total_gross      || 0) + gross,
        total_commission: (profile.total_commission || 0) + commission,
        total_net:        (profile.total_net        || 0) + net,
      }).eq('id', order.tunnels.user_id);

      console.log(`✅ Solde vendeur mis à jour — +${net} FCFA net`);
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
