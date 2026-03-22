// ============================================================
//  api/email/confirmation.js — Email confirmation achat
//  Utilise templates.js pour le design HTML + IA Groq
// ============================================================
const { createClient } = require('@supabase/supabase-js');
const { tplConfirmation, sendBrevo } = require('../../lib/email-templates');

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST requis' });

  try {
    const { buyer_name, buyer_email, product_name, amount, currency='FCFA',
            payment_method, order_ref, access_url, download_url,
            thank_you_msg, tunnel_id, vendor_id } = req.body;

    if (!buyer_email || !buyer_name) {
      return res.status(400).json({ error: 'buyer_email et buyer_name requis' });
    }

    // Récupérer config vendeur
    var primary_color = '#00c896';
    var vendor_name   = 'FunnelAfrica';
    if (tunnel_id) {
      const { data: tunnel } = await sb.from('tunnels')
        .select('page_config,profiles(full_name)').eq('id', tunnel_id).single();
      if (tunnel) {
        primary_color = tunnel.page_config?.primary_color || primary_color;
        vendor_name   = tunnel.profiles?.full_name || vendor_name;
      }
    }

    const { subject, html } = tplConfirmation({
      buyer_name, product_name, amount, currency,
      payment_method, order_ref, access_url,
      download_url, thank_you_msg, vendor_name, primary_color
    });

    const result = await sendBrevo(
      buyer_email, buyer_name, subject, html,
      process.env.FROM_EMAIL, process.env.FROM_NAME || 'FunnelAfrica'
    );

    // Sauvegarder contact
    if (vendor_id && tunnel_id) {
      await sb.from('contacts').upsert({
        user_id: vendor_id, tunnel_id, email: buyer_email,
        name: buyer_name, source: 'purchase', tags: ['acheteur']
      }, { onConflict: 'user_id,email' }).catch(() => {});
    }

    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    console.error('Confirmation error:', err);
    return res.status(500).json({ error: err.message });
  }
};
