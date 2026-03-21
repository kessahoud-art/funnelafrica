// ============================================================
//  api/payment/initiate.js
//  Vercel Serverless Function — Initier un paiement CinetPay
//  
//  Dans Vercel Dashboard → Settings → Environment Variables :
//  CINETPAY_API_KEY    = ta clé API CinetPay
//  CINETPAY_SITE_ID    = ton site ID CinetPay
//  APP_URL             = https://funnelafrica.vercel.app
// ============================================================

export default async function handler(req, res) {

  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée' });

  try {
    const {
      amount,
      currency     = 'XOF',
      buyer_name,
      buyer_email,
      buyer_phone,
      order_id,
      tunnel_slug,
      description  = 'Achat sur FunnelAfrica'
    } = req.body;

    // Validation
    if (!amount || !buyer_name || !buyer_email || !order_id) {
      return res.status(400).json({ error: 'Champs manquants : amount, buyer_name, buyer_email, order_id' });
    }

    if (amount < 100) {
      return res.status(400).json({ error: 'Montant minimum : 100 FCFA' });
    }

    const APP_URL = process.env.APP_URL || 'https://funnelafrica.vercel.app';

    // Appel API CinetPay
    const response = await fetch('https://api-checkout.cinetpay.com/v2/payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apikey:           process.env.CINETPAY_API_KEY,
        site_id:          process.env.CINETPAY_SITE_ID,
        transaction_id:   order_id,
        amount:           amount,
        currency:         currency,
        description:      description,
        notify_url:       `${APP_URL}/api/payment/webhook`,
        return_url:       `${APP_URL}/merci.html?order=${order_id}`,
        cancel_url:       `${APP_URL}/checkout.html?cancelled=1`,
        customer_name:    buyer_name,
        customer_email:   buyer_email,
        customer_phone_number: buyer_phone || '',
        channels:         'ALL',
        metadata:         JSON.stringify({ tunnel_slug, order_id }),
        lang:             'fr'
      })
    });

    const data = await response.json();

    // CinetPay renvoie code 201 si succès
    if (data.code !== '201') {
      console.error('CinetPay error:', data);
      return res.status(400).json({
        error: data.message || 'Erreur CinetPay',
        code: data.code
      });
    }

    // Retourner l'URL de paiement au frontend
    return res.status(200).json({
      success:     true,
      payment_url: data.data.payment_url,
      payment_token: data.data.payment_token,
      order_id:    order_id
    });

  } catch (err) {
    console.error('Initiate payment error:', err);
    return res.status(500).json({ error: 'Erreur serveur. Réessayez.' });
  }
}
