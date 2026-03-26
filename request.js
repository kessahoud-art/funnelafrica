// ============================================================
//  api/payout/request.js
//  Système de retrait automatique via FedaPay Payout API
// ============================================================
const { createClient } = require('@supabase/supabase-js');

const sb = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const MIN_PAYOUT = 5000; // 5 000 FCFA minimum

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { amount, method, phone, user_id } = req.body;

    if (!amount || !method || !phone || !user_id) {
      return res.status(400).json({ error: 'Champs manquants' });
    }
    if (amount < MIN_PAYOUT) {
      return res.status(400).json({ error: `Minimum ${MIN_PAYOUT.toLocaleString('fr')} FCFA` });
    }

    // Vérifier solde vendeur
    const { data: profile } = await sb
      .from('profiles')
      .select('payout_balance, full_name, commission_rate')
      .eq('id', user_id)
      .single();

    if (!profile) return res.status(404).json({ error: 'Profil introuvable' });
    if ((profile.payout_balance || 0) < amount) {
      return res.status(400).json({ error: 'Solde insuffisant' });
    }

    // Créer le retrait en BDD
    const ref = 'PAY-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).substring(2,5).toUpperCase();
    const { data: payout, error: payoutErr } = await sb.from('payouts').insert({
      user_id, amount, currency: 'XOF', method, phone,
      status: 'processing', reference: ref
    }).select().single();

    if (payoutErr) throw payoutErr;

    // Déduire du solde immédiatement
    await sb.from('profiles').update({
      payout_balance:  (profile.payout_balance || 0) - amount,
      total_withdrawn: ((profile.total_withdrawn || 0)) + amount
    }).eq('id', user_id);

    // Appel FedaPay Payout (simulation — activer avec clé live)
    let fedapayResult = { status: 'simulated', message: 'Payout en cours' };
    try {
      const fedapayRes = await fetch('https://api.fedapay.com/v1/payouts', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + process.env.FEDAPAY_SECRET_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          amount: amount,
          currency: { iso: 'XOF' },
          mode: method,
          customer: { phone_number: { number: phone, country: 'BJ' } },
          description: 'Retrait FunnelAfrica - ' + ref
        })
      });
      if (fedapayRes.ok) {
        const fedaData = await fedapayRes.json();
        fedapayResult = { status: 'sent', fedapay_id: fedaData.v1?.payout?.id };
        await sb.from('payouts').update({
          status: 'paid',
          fedapay_id: fedapayResult.fedapay_id,
          processed_at: new Date().toISOString()
        }).eq('id', payout.id);
      }
    } catch (fedaErr) {
      console.log('FedaPay payout non disponible, enregistré manuellement');
    }

    // Email notification
    try {
      const APP_URL = process.env.APP_URL || 'https://funnelafrica.vercel.app';
      await fetch(`${APP_URL}/api/email/confirmation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          buyer_name: profile.full_name,
          buyer_email: req.body.email,
          product_name: `Retrait FunnelAfrica — ${amount.toLocaleString('fr')} FCFA`,
          amount, currency: 'XOF',
          payment_method: method,
          order_ref: ref,
          access_url: `${APP_URL}/profil.html`
        })
      });
    } catch (e) {}

    return res.status(200).json({
      success: true,
      reference: ref,
      amount,
      method,
      status: fedapayResult.status,
      message: `Retrait de ${amount.toLocaleString('fr')} FCFA initié avec succès`
    });

  } catch (err) {
    console.error('Payout error:', err);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
};
