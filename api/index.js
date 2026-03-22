// ============================================================
//  api/public/index.js — Router API publique FunnelAfrica
//  Routes disponibles :
//  GET /api/public?resource=tunnels
//  GET /api/public?resource=orders
//  GET /api/public?resource=stats
//  GET /api/public?resource=contacts
//  GET /api/public?resource=campaigns
//  GET /api/public?resource=affiliates
//  GET /api/public?resource=payouts
//  GET /api/public?resource=countries   (config expansion multi-pays)
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
    if      (resource === 'tunnels')   result = await handleTunnels(keyData, req.query);
    else if (resource === 'orders')    result = await handleOrders(keyData, req.query);
    else if (resource === 'stats')     result = await handleStats(keyData);
    else if (resource === 'contacts')  result = await handleContacts(keyData, req.query);
    else if (resource === 'campaigns') result = await handleCampaigns(keyData, req.query);
    else if (resource === 'affiliates')result = await handleAffiliates(keyData, req.query);
    else if (resource === 'payouts')   result = await handlePayouts(keyData, req.query);
    else if (resource === 'countries') result = await handleCountries(req.query);
    else {
      return res.status(400).json({
        error: 'Paramètre resource requis',
        resources: {
          tunnels:   'GET /api/public?resource=tunnels',
          orders:    'GET /api/public?resource=orders',
          stats:     'GET /api/public?resource=stats',
          contacts:  'GET /api/public?resource=contacts',
          campaigns: 'GET /api/public?resource=campaigns',
          affiliates:'GET /api/public?resource=affiliates',
          payouts:   'GET /api/public?resource=payouts',
          countries: 'GET /api/public?resource=countries&active_only=true',
        }
      });
    }
    return res.status(result.status).json(result.body);
  } catch (err) {
    console.error('API public error:', err);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
};

// ── Config pays expansion (statique — pas besoin de BDD) ──
const COUNTRIES_CONFIG = {
  BJ: { name:'Bénin',           currency:'XOF', provider:'fedapay',  methods:['mtn','moov'],          flag:'🇧🇯', active:true  },
  CI: { name:'Côte d\'Ivoire',  currency:'XOF', provider:'fedapay',  methods:['wave','mtn','orange','moov'], flag:'🇨🇮', active:true  },
  SN: { name:'Sénégal',         currency:'XOF', provider:'fedapay',  methods:['wave','orange'],        flag:'🇸🇳', active:true  },
  ML: { name:'Mali',            currency:'XOF', provider:'fedapay',  methods:['wave','orange'],        flag:'🇲🇱', active:true  },
  BF: { name:'Burkina Faso',    currency:'XOF', provider:'fedapay',  methods:['orange','moov'],        flag:'🇧🇫', active:true  },
  TG: { name:'Togo',            currency:'XOF', provider:'fedapay',  methods:['moov','tmoney'],        flag:'🇹🇬', active:true  },
  GN: { name:'Guinée',          currency:'GNF', provider:'fedapay',  methods:['orange','mtn'],         flag:'🇬🇳', active:true  },
  CM: { name:'Cameroun',        currency:'XAF', provider:'fedapay',  methods:['mtn','orange'],         flag:'🇨🇲', active:true  },
  NE: { name:'Niger',           currency:'XOF', provider:'fedapay',  methods:['airtel','moov'],        flag:'🇳🇪', active:true  },
  NG: { name:'Nigeria',         currency:'NGN', provider:'paystack', methods:['card','bank','ussd'],   flag:'🇳🇬', active:false, roadmap:'V2' },
  KE: { name:'Kenya',           currency:'KES', provider:'mpesa',    methods:['mpesa'],                flag:'🇰🇪', active:false, roadmap:'V2' },
  TZ: { name:'Tanzanie',        currency:'TZS', provider:'mpesa',    methods:['mpesa','tigo'],         flag:'🇹🇿', active:false, roadmap:'V2' },
  MA: { name:'Maroc',           currency:'MAD', provider:'cmi',      methods:['card','cmi'],           flag:'🇲🇦', active:false, roadmap:'V3' },
  EG: { name:'Égypte',          currency:'EGP', provider:'fawry',    methods:['fawry','card'],         flag:'🇪🇬', active:false, roadmap:'V3' },
  GH: { name:'Ghana',           currency:'GHS', provider:'paystack', methods:['momo','card'],          flag:'🇬🇭', active:false, roadmap:'V2' },
};

// ── Handler contacts ──
async function handleContacts(keyData, query) {
  const { limit=50, offset=0, unsubscribed, source } = query;
  let q = sb.from('contacts')
    .select('id,name,email,phone,source,tags,unsubscribed,created_at')
    .eq('user_id', keyData.user_id)
    .order('created_at', { ascending:false })
    .range(offset, Number(offset)+Number(limit)-1);
  if (unsubscribed !== undefined) q = q.eq('unsubscribed', unsubscribed==='true');
  if (source) q = q.eq('source', source);
  const { data, error } = await q;
  if (error) return { status:500, body:{ error:error.message } };
  return { status:200, body:{ contacts:data, total:data.length } };
}

// ── Handler campaigns ──
async function handleCampaigns(keyData, query) {
  const { status, limit=20, offset=0 } = query;
  let q = sb.from('campaigns')
    .select('id,name,subject,status,sent_count,open_count,click_count,unsub_count,sent_at,created_at')
    .eq('user_id', keyData.user_id)
    .order('created_at', { ascending:false })
    .range(offset, Number(offset)+Number(limit)-1);
  if (status) q = q.eq('status', status);
  const { data, error } = await q;
  if (error) return { status:500, body:{ error:error.message } };
  // Calculer taux
  const enriched = (data||[]).map(c => ({
    ...c,
    open_rate:  c.sent_count ? Math.round((c.open_count||0)/c.sent_count*100)+'%'  : '0%',
    click_rate: c.sent_count ? Math.round((c.click_count||0)/c.sent_count*100)+'%' : '0%',
    unsub_rate: c.sent_count ? Math.round((c.unsub_count||0)/c.sent_count*100)+'%' : '0%',
  }));
  return { status:200, body:{ campaigns:enriched, total:enriched.length } };
}

// ── Handler affiliates ──
async function handleAffiliates(keyData, query) {
  const { tunnel_id, limit=20 } = query;
  let q = sb.from('affiliates')
    .select('id,affiliate_id,tunnel_id,commission,total_clicks,total_sales,total_earned,created_at,profiles(full_name,email)')
    .eq('user_id', keyData.user_id)
    .order('total_earned', { ascending:false })
    .limit(Number(limit));
  if (tunnel_id) q = q.eq('tunnel_id', tunnel_id);
  const { data, error } = await q;
  if (error) return { status:500, body:{ error:error.message } };
  return { status:200, body:{ affiliates:data||[], total:(data||[]).length } };
}

// ── Handler payouts ──
async function handlePayouts(keyData, query) {
  const { status, limit=20, offset=0 } = query;
  let q = sb.from('payouts')
    .select('id,amount,currency,method,phone,status,reference,created_at,processed_at')
    .eq('user_id', keyData.user_id)
    .order('created_at', { ascending:false })
    .range(offset, Number(offset)+Number(limit)-1);
  if (status) q = q.eq('status', status);
  const { data, error } = await q;
  if (error) return { status:500, body:{ error:error.message } };
  const total_amount = (data||[]).filter(p=>p.status==='paid').reduce((s,p)=>s+p.amount,0);
  return { status:200, body:{ payouts:data||[], total:(data||[]).length, total_paid:total_amount } };
}

// ── Handler countries ──
async function handleCountries(query) {
  const { active_only, include_roadmap } = query;
  let countries = Object.entries(COUNTRIES_CONFIG).map(([code, cfg]) => ({ code, ...cfg }));
  if (active_only === 'true') countries = countries.filter(c => c.active);
  if (include_roadmap !== 'true') countries = countries.map(c => { const {roadmap,...rest} = c; return rest; });
  const active = countries.filter(c=>c.active);
  return {
    status: 200,
    body: {
      countries,
      active_count:  active.length,
      total_count:   countries.length,
      providers:     [...new Set(countries.map(c=>c.provider))],
      currencies:    [...new Set(countries.map(c=>c.currency))],
    }
  };
}
