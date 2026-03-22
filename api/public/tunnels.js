// ============================================================
//  api/public/tunnels.js — API publique FunnelAfrica
//  GET /api/public/tunnels?api_key=fa_xxx
// ============================================================
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function verifyApiKey(rawKey) {
  if (!rawKey || !rawKey.startsWith('fa_')) return null;
  const hash = crypto.createHash('sha256').update(rawKey).digest('hex');
  const { data } = await sb.from('api_keys')
    .select('user_id, scopes, is_active, expires_at')
    .eq('key_hash', hash).single();
  if (!data || !data.is_active) return null;
  if (data.expires_at && new Date(data.expires_at) < new Date()) return null;
  await sb.from('api_keys').update({ last_used_at: new Date().toISOString() }).eq('key_hash', hash);
  return data;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const apiKey = req.headers.authorization?.replace('Bearer ', '') || req.query.api_key;
  const keyData = await verifyApiKey(apiKey);
  if (!keyData) return res.status(401).json({ error: 'Clé API invalide ou expirée' });

  if (req.method === 'GET') {
    const { status, limit = 10, offset = 0 } = req.query;
    let query = sb.from('tunnels')
      .select('id, name, slug, status, price, views, revenue, orders, created_at')
      .eq('user_id', keyData.user_id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (status) query = query.eq('status', status);
    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ tunnels: data, total: data.length, limit, offset });
  }
  return res.status(405).json({ error: 'Méthode non supportée' });
};
