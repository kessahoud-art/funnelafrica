// api/public/stats.js — API publique : statistiques
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function verifyApiKey(rawKey) {
  if (!rawKey || !rawKey.startsWith('fa_')) return null;
  const hash = crypto.createHash('sha256').update(rawKey).digest('hex');
  const { data } = await sb.from('api_keys').select('user_id,is_active,expires_at').eq('key_hash', hash).single();
  if (!data || !data.is_active) return null;
  if (data.expires_at && new Date(data.expires_at) < new Date()) return null;
  return data;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  const apiKey = req.headers.authorization?.replace('Bearer ','') || req.query.api_key;
  const keyData = await verifyApiKey(apiKey);
  if (!keyData) return res.status(401).json({ error: 'Clé API invalide' });

  const [revenueRes, ordersRes, tunnelsRes, contactsRes] = await Promise.all([
    sb.from('orders').select('amount').eq('user_id', keyData.user_id).eq('payment_status','paid'),
    sb.from('orders').select('id').eq('user_id', keyData.user_id).eq('payment_status','paid'),
    sb.from('tunnels').select('id,status').eq('user_id', keyData.user_id),
    sb.from('contacts').select('id').eq('user_id', keyData.user_id),
  ]);

  const revenue = (revenueRes.data||[]).reduce((s,o)=>s+o.amount,0);
  return res.status(200).json({
    revenue_total: revenue,
    orders_total:  (ordersRes.data||[]).length,
    tunnels_live:  (tunnelsRes.data||[]).filter(t=>t.status==='live').length,
    tunnels_total: (tunnelsRes.data||[]).length,
    contacts_total:(contactsRes.data||[]).length,
    currency: 'XOF',
    generated_at: new Date().toISOString()
  });
};
