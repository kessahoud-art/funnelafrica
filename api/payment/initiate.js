// ============================================================
//  api/payment/initiate.js
//  Vercel Serverless Function — Initier un paiement FedaPay
//  Supporte : paiement tunnel, upsell, abonnement plan
//
//  Variables Vercel :
//  FEDAPAY_SECRET_KEY = sk_live_xxxx
//  APP_URL            = https://funnelafrica.vercel.app
// ============================================================

module.exports = async function handler(req, res) {

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
    const cleanPhone = String(buyer_phone || '').replace(/\s/g,'').replace(/\+/g,'');

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
    // FedaPay v1 : currency = string "XOF" (pas un objet)
    const response = await fetch('https://api.fedapay.com/v1/transactions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.FEDAPAY_SECRET_KEY}`,
        'Content-Type':  'application/json'
      },
      body: JSON.stringify({
        description:   description,
        amount:        parseInt(amount),
        currency:      { iso: 'XOF' },
        callback_url:  callbackUrl,
        cancel_url:    `${APP_URL}/funnelafrica-checkout.html?cancelled=1`,
        customer: Object.assign(
          {
            firstname: firstName,
            lastname:  lastName,
            email:     buyer_email
          },
          cleanPhone ? { phone_number: { number: cleanPhone, country: 'BJ' } } : {}
        ),
        metadata: {
          order_id:    order_id,
          tunnel_slug: tunnel_slug || ''
        }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('FedaPay error:', JSON.stringify(data));
      const errMsg = data.message || 'Erreur FedaPay';
      return res.status(400).json({ error: errMsg });
    }

    // FedaPay retourne { "v1/transaction": { id, payment_url, payment_token, ... } }
    const transaction   = data['v1/transaction'];
    const transactionId = transaction?.id;
    const paymentUrl    = transaction?.payment_url;

    if (!transactionId || !paymentUrl) {
      console.error('Missing data:', JSON.stringify(data));
      return res.status(500).json({ error: 'Réponse FedaPay invalide' });
    }

    console.log(`✅ Transaction ${transactionId} — ${amount} XOF → ${paymentUrl}`);

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
