// ============================================================
//  api/payment/initiate.js
//  Vercel Serverless Function — Initier un paiement FedaPay
//  Supporte : paiement tunnel, upsell, abonnement plan
//
//  Variables Vercel :
//  FEDAPAY_SECRET_KEY = sk_live_xxxx
//  APP_URL            = https://funnelafrica.vercel.app
// ============================================================

export default async function handler(req, res) {

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée' });

  try {
    const {
      amount,
      currency      = 'XOF',
      buyer_name,
      buyer_email,
      buyer_phone,
      order_id,
      tunnel_slug,
      description   = 'Achat sur FunnelAfrica',
      has_upsell    = false   // ← true si le tunnel a un upsell configuré
    } = req.body;

    if (!amount || !buyer_name || !buyer_email || !order_id) {
      return res.status(400).json({
        error: 'Champs manquants : amount, buyer_name, buyer_email, order_id'
      });
    }

    if (amount < 100) {
      return res.status(400).json({ error: 'Montant minimum : 100 XOF' });
    }

    const APP_URL   = process.env.APP_URL || 'https://funnelafrica.vercel.app';
    const nameParts = buyer_name.trim().split(' ');
    const firstName = nameParts[0] || buyer_name;
    const lastName  = nameParts.slice(1).join(' ') || firstName;

    // ── Construire l'URL de retour ──
    // Si upsell → rediriger vers upsell.html après paiement
    // Sinon → rediriger vers merci.html
    let callbackUrl;

    if (has_upsell && tunnel_slug && !order_id.startsWith('UP-')) {
      // Après paiement principal → page upsell
      callbackUrl = `${APP_URL}/upsell.html?order=${order_id}&tunnel=${tunnel_slug}&email=${encodeURIComponent(buyer_email)}&name=${encodeURIComponent(buyer_name)}`;
    } else if (tunnel_slug) {
      // Après upsell ou pas d'upsell → merci avec tunnel
      callbackUrl = `${APP_URL}/merci.html?order=${order_id}&tunnel=${tunnel_slug}`;
    } else {
      // Abonnement plan → merci sans tunnel
      callbackUrl = `${APP_URL}/merci.html?order=${order_id}`;
    }

    // ── Créer la transaction FedaPay ──
    const response = await fetch('https://api.fedapay.com/v1/transactions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.FEDAPAY_SECRET_KEY}`,
        'Content-Type':  'application/json'
      },
      body: JSON.stringify({
        description:   description,
        amount:        amount,
        currency:      { iso: currency },
        callback_url:  callbackUrl,
        cancel_url:    `${APP_URL}/funnelafrica-checkout.html?cancelled=1`,
        customer: {
          firstname: firstName,
          lastname:  lastName,
          email:     buyer_email,
          phone_number: { number: buyer_phone || '', country: 'BJ' }
        },
        metadata: {
          order_id:    order_id,
          tunnel_slug: tunnel_slug || ''
        }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('FedaPay error:', data);
      return res.status(400).json({ error: data.message || 'Erreur FedaPay', details: data });
    }

    const transaction   = data.v1 || data;
    const transactionId = transaction?.transaction?.id || transaction?.id;

    if (!transactionId) {
      return res.status(500).json({ error: 'ID de transaction manquant' });
    }

    // ── Générer le token de paiement ──
    const tokenResponse = await fetch(
      `https://api.fedapay.com/v1/transactions/${transactionId}/token`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${process.env.FEDAPAY_SECRET_KEY}`,
          'Content-Type':  'application/json'
        }
      }
    );

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error('Token error:', tokenData);
      return res.status(500).json({ error: 'Erreur génération token' });
    }

    const paymentUrl = `https://pay.fedapay.com/${tokenData.token}`;

    console.log(`✅ Transaction créée : ${transactionId} — ${amount} ${currency}`);
    if (has_upsell) console.log(`Upsell activé → callback: ${callbackUrl}`);

    return res.status(200).json({
      success:        true,
      payment_url:    paymentUrl,
      transaction_id: transactionId,
      order_id:       order_id
    });

  } catch (err) {
    console.error('Initiate error:', err);
    return res.status(500).json({ error: 'Erreur serveur. Réessayez.' });
  }
}
