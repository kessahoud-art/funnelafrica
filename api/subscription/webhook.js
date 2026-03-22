// ============================================================
//  api/subscription/webhook.js
//  Active le plan vendeur après paiement FedaPay confirmé
// ============================================================

const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {

  res.setHeader('Access-Control-Allow-Origin', '*');
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
      return res.status(200).json({ message: 'Ignoré' });
    }

    const metadata = transaction?.metadata || {};
    const orderId  = metadata.order_id || transaction?.custom_metadata?.order_id;

    if (!orderId || !orderId.startsWith('SUB-')) {
      // Ce n'est pas un paiement d'abonnement → ignorer
      return res.status(200).json({ message: 'Pas un abonnement' });
    }

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    // Trouver la commande d'abonnement
    const { data: order, error } = await supabase
      .from('orders')
      .select('*')
      .eq('payment_ref', orderId)
      .single();

    if (error || !order) {
      console.error('Commande abonnement introuvable:', orderId);
      return res.status(200).json({ message: 'Commande introuvable' });
    }

    if (order.payment_status === 'paid') {
      return res.status(200).json({ message: 'Déjà traité' });
    }

    // Marquer la commande comme payée
    await supabase
      .from('orders')
      .update({ payment_status: 'paid', paid_at: new Date().toISOString() })
      .eq('id', order.id);

    // Déterminer le plan depuis l'order_id
    // Format : SUB-PRO-1234567-ABC
    const planKey = orderId.split('-')[1]?.toLowerCase() || 'starter';
    const validPlans = ['starter', 'pro', 'scale'];
    const plan = validPlans.includes(planKey) ? planKey : 'starter';

    // Calculer la date d'expiration (30 jours)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    // Mettre à jour le plan dans profiles
    await supabase
      .from('profiles')
      .update({
        plan:        plan,
        plan_status: 'active',
        updated_at:  new Date().toISOString()
      })
      .eq('id', order.user_id);

    console.log(`✅ Plan ${plan} activé pour user ${order.user_id}`);

    // Envoyer email de confirmation
    const APP_URL = process.env.APP_URL || 'https://funnelafrica.vercel.app';
    const planNames = { starter:'Starter', pro:'Pro', scale:'Scale' };
    const planPrices = { starter:'3 000', pro:'9 900', scale:'24 900' };

    try {
      await fetch(`${APP_URL}/api/email/confirmation`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          buyer_name:     order.buyer_name,
          buyer_email:    order.buyer_email,
          product_name:   `Abonnement FunnelAfrica Plan ${planNames[plan]}`,
          amount:         order.amount,
          currency:       'XOF',
          payment_method: 'fedapay',
          order_ref:      orderId,
          access_url:     `${APP_URL}/funnelafrica-dashboard.html`
        })
      });
    } catch (emailErr) {
      console.error('Email error:', emailErr);
    }

    return res.status(200).json({
      message: 'OK',
      plan:    plan,
      user_id: order.user_id
    });

  } catch (err) {
    console.error('Subscription webhook error:', err);
    return res.status(200).json({ error: 'Erreur interne' });
  }
}
