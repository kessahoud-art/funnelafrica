// ============================================================
//  api/public/index.js — Router API publique FunnelAfrica
//  Remplace tunnels.js + orders.js + stats.js en 1 seul fichier
//  Vercel Hobby : max 12 serverless functions
//
//  Routes :
//  GET /api/public?resource=tunnels&api_key=fa_xxx
//  GET /api/public?resource=orders&api_key=fa_xxx
//  GET /api/public?resource=stats&api_key=fa_xxx
// ============================================================
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const sb = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// ── Vérification clé API ──
async function verifyApiKey(rawKey) {
  if (!rawKey || !rawKey.startsWith('fa_')) return null;
  const hash = crypto.createHash('sha256').update(rawKey).digest('hex');
  const { data } = await sb.from('api_keys')
    .select('user_id, scopes, is_active, expires_at')
    .eq('key_hash', hash).single();
  if (!data || !data.is_active) return null;
  if (data.expires_at && new Date(data.expires_at) < new Date()) return null;
  await sb.from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('key_hash', hash);
  return data;
}

// ── Handler tunnels ──
async function handleTunnels(keyData, query) {
  const { status, limit = 10, offset = 0 } = query;
  let q = sb.from('tunnels')
    .select('id, name, slug, status, price, views, revenue, orders, created_at')
    .eq('user_id', keyData.user_id)
    .order('created_at', { ascending: false })
    .range(offset, Number(offset) + Number(limit) - 1);
  if (status) q = q.eq('status', status);
  const { data, error } = await q;
  if (error) return { status: 500, body: { error: error.message } };
  return { status: 200, body: { tunnels: data, total: data.length, limit, offset } };
}

// ── Handler orders ──
async function handleOrders(keyData, query) {
  const { tunnel_id, status, limit = 20, offset = 0 } = query;
  let q = sb.from('orders')
    .select('id, tunnel_id, buyer_name, buyer_email, amount, payment_method, payment_status, created_at')
    .eq('user_id', keyData.user_id)
    .order('created_at', { ascending: false })
    .range(offset, Number(offset) + Number(limit) - 1);
  if (tunnel_id) q = q.eq('tunnel_id', tunnel_id);
  if (status)    q = q.eq('payment_status', status);
  const { data, error } = await q;
  if (error) return { status: 500, body: { error: error.message } };
  return { status: 200, body: { orders: data, total: data.length } };
}

// ── Handler stats ──
async function handleStats(keyData) {
  const [revenueRes, ordersRes, tunnelsRes, contactsRes] = await Promise.all([
    sb.from('orders').select('amount').eq('user_id', keyData.user_id).eq('payment_status', 'paid'),
    sb.from('orders').select('id').eq('user_id', keyData.user_id).eq('payment_status', 'paid'),
    sb.from('tunnels').select('id, status').eq('user_id', keyData.user_id),
    sb.from('contacts').select('id').eq('user_id', keyData.user_id),
  ]);
  const revenue = (revenueRes.data || []).reduce((s, o) => s + o.amount, 0);
  return {
    status: 200,
    body: {
      revenue_total:  revenue,
      orders_total:   (ordersRes.data || []).length,
      tunnels_live:   (tunnelsRes.data || []).filter(t => t.status === 'live').length,
      tunnels_total:  (tunnelsRes.data || []).length,
      contacts_total: (contactsRes.data || []).length,
      currency:       'XOF',
      generated_at:   new Date().toISOString()
    }
  };
}

// ── Main handler ──
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const apiKey = (req.headers.authorization || '').replace('Bearer ', '') || req.query.api_key;
  const keyData = await verifyApiKey(apiKey);
  if (!keyData) return res.status(401).json({ error: 'Clé API invalide ou expirée' });

  const resource = req.query.resource;

  try {
    let result;
    if (resource === 'tunnels') {
      result = await handleTunnels(keyData, req.query);
    } else if (resource === 'orders') {
      result = await handleOrders(keyData, req.query);
    } else if (resource === 'stats') {
      result = await handleStats(keyData);
    } else {
      return res.status(400).json({
        error: 'Paramètre resource requis : tunnels | orders | stats',
        usage: {
          tunnels: 'GET /api/public?resource=tunnels&api_key=fa_xxx',
          orders:  'GET /api/public?resource=orders&api_key=fa_xxx',
          stats:   'GET /api/public?resource=stats&api_key=fa_xxx'
        }
      });
    }
    return res.status(result.status).json(result.body);
  } catch (err) {
    console.error('API public error:', err);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
};
