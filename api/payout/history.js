// api/payout/history.js — Historique retraits d'un vendeur
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method !== 'GET') return res.status(405).end();
  const { user_id, limit = 20, offset = 0 } = req.query;
  if (!user_id) return res.status(400).json({ error: 'user_id requis' });
  const { data, error } = await sb.from('payouts')
    .select('*').eq('user_id', user_id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ payouts: data });
};
