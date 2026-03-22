// ============================================================
//  api/affiliate/click.js
//  Tracker les clics affiliés depuis funnelafrica-tunnel-public.html
// ============================================================

const { createClient } = require('@supabase/supabase-js');

const sb = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { ref_code, tunnel_id } = req.body;
    if (!ref_code || !tunnel_id) return res.status(400).json({ error: 'ref_code et tunnel_id requis' });

    // Trouver l'affilié via son code
    const { data: profile } = await sb
      .from('profiles')
      .select('id')
      .eq('affiliate_code', ref_code)
      .single();

    if (!profile) return res.status(200).json({ ok: true, tracked: false });

    // Enregistrer le clic
    await sb.from('affiliate_clicks').insert({
      affiliate_id: profile.id,
      tunnel_id:    tunnel_id,
      ref_code:     ref_code,
      ip_hash:      Buffer.from(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').toString('base64').substring(0, 20)
    });

    // Incrémenter le compteur de clics
    await sb.from('affiliates')
      .update({ total_clicks: sb.rpc('total_clicks + 1') })
      .eq('affiliate_id', profile.id)
      .eq('tunnel_id', tunnel_id);

    return res.status(200).json({ ok: true, tracked: true });

  } catch (err) {
    console.error('affiliate/click error:', err);
    return res.status(200).json({ ok: true }); // Fail silently pour ne pas bloquer la page
  }
};
