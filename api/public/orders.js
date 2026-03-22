// api/public/orders.js — API publique : commandes
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function verifyApiKey(rawKey) {
  if (!rawKey || !rawKey.startsWith('fa_')) return null;
  const hash = crypto.createHash('sha256').update(rawKey).digest('hex');
  const { data } = await sb.from('api_keys').select('user_id,scopes,is_active,expires_at').eq('key_hash', hash).single();
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
  const { tunnel_id, status, limit=20, offset=0 } = req.query;
  let query = sb.from('orders')
    .select('id,tunnel_id,buyer_name,buyer_email,amount,payment_method,payment_status,created_at')
    .eq('user_id', keyData.user_id)
    .order('created_at', { ascending: false })
    .range(offset, offset+limit-1);
  if (tunnel_id) query = query.eq('tunnel_id', tunnel_id);
  if (status) query = query.eq('payment_status', status);
  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ orders: data, total: data.length });
};
