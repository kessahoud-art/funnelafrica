// ============================================================
//  api/email/trigger.js — Déclencheur séquences automatiques
//  P3 : Séquences vendeur → acheteurs branchées
//  Cron Vercel : 0 8 * * * (tous les jours à 8h)
// ============================================================
const { createClient } = require('@supabase/supabase-js');

const sb      = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const APP_URL = process.env.APP_URL || 'https://funnelafrica.vercel.app';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // GET = cron Vercel · POST = manuel/webhook
  const isGet = req.method === 'GET';
  const body  = isGet ? {} : (req.body || {});

  try {
    // ══════════════════════════════════════════
    //  CRON JOURNALIER (GET depuis Vercel cron)
    //  → CEO check J+3 + J+7
    //  → Vendeurs : buyer_followup J+1, J+3, J+7
    // ══════════════════════════════════════════
    if (isGet || body.event === 'cron') {
      let totalSent = 0;

      // 1. Check J+3 — relance vendeurs sans tunnel publié
      const j3Users = await sb.from('profiles')
        .select('id, full_name, email, created_at')
        .gte('created_at', new Date(Date.now() - 4*24*60*60*1000).toISOString())
        .lte('created_at', new Date(Date.now() - 2*24*60*60*1000).toISOString());

      for (const user of (j3Users.data || [])) {
        const { data: live } = await sb.from('tunnels').select('id')
          .eq('user_id', user.id).eq('status', 'live').limit(1);
        if (!live || !live.length) {
          const { data: draft } = await sb.from('tunnels').select('name,slug')
            .eq('user_id', user.id).limit(1).single();
          await seq('relance', {
            to_email: user.email, to_name: user.full_name || user.email.split('@')[0],
            tunnel_name: draft?.name, tunnel_url: draft?.slug ? `${APP_URL}/t/${draft.slug}` : null
          });
          totalSent++;
        }
      }

      // 2. Check J+7 — upgrade Starter
      const j7Users = await sb.from('profiles')
        .select('id, full_name, email, plan, created_at')
        .eq('plan', 'starter')
        .gte('created_at', new Date(Date.now() - 8*24*60*60*1000).toISOString())
        .lte('created_at', new Date(Date.now() - 6*24*60*60*1000).toISOString());

      for (const user of (j7Users.data || [])) {
        // Récupérer stats du vendeur
        const { data: tunnels } = await sb.from('tunnels').select('id').eq('user_id', user.id);
        const { data: orders }  = await sb.from('orders').select('amount').eq('user_id', user.id).eq('payment_status', 'paid');
        const revenue = (orders || []).reduce((s, o) => s + o.amount, 0);
        await seq('upgrade', {
          to_email: user.email, to_name: user.full_name || user.email.split('@')[0],
          tunnel_count: (tunnels || []).length, revenue
        });
        totalSent++;
      }

      // 3. P3 — Séquences acheteurs J+1, J+3, J+7
      for (const [dayN, dayKey] of [[1,'1'],[3,'3'],[7,'7']]) {
        const start = new Date(Date.now() - (dayN+0.5)*24*60*60*1000).toISOString();
        const end   = new Date(Date.now() - (dayN-0.5)*24*60*60*1000).toISOString();

        const { data: orders } = await sb.from('orders')
          .select('buyer_name,buyer_email,user_id,tunnel_id,created_at')
          .eq('payment_status', 'paid')
          .gte('created_at', start)
          .lte('created_at', end);

        for (const order of (orders || [])) {
          // Récupérer config tunnel du vendeur
          const { data: tunnel } = await sb.from('tunnels')
            .select('name,page_config,profiles(full_name)')
            .eq('id', order.tunnel_id).single();

          if (!tunnel) continue;

          // Vérifier si email déjà envoyé (via ai_generations comme log simple)
          const logKey = `followup_${order.buyer_email}_${order.tunnel_id}_j${dayKey}`;
          const { data: existing } = await sb.from('ai_generations')
            .select('id').eq('user_id', order.user_id).eq('prompt_summary', logKey).limit(1);
          if (existing && existing.length) continue; // déjà envoyé

          await seq('buyer_followup', {
            buyer_name:     order.buyer_name,
            buyer_email:    order.buyer_email,
            product_name:   tunnel.name,
            access_url:     `${APP_URL}/espace-membre.html?tunnel=${tunnel.page_config?.slug||''}`,
            vendor_name:    tunnel.profiles?.full_name || 'FunnelAfrica',
            vendor_message: tunnel.page_config?.[`followup_j${dayKey}`] || null,
            primary_color:  tunnel.page_config?.primary_color || '#00c896',
            day:            dayKey
          });

          // Logger l'envoi pour éviter doublons
          await sb.from('ai_generations').insert({
            user_id: order.user_id,
            tunnel_id: order.tunnel_id,
            type: 'email_followup',
            prompt_summary: logKey,
            result: { day: dayKey, sent_to: order.buyer_email }
          }).catch(() => {});

          totalSent++;
        }
      }

      return res.status(200).json({ success: true, cron: true, totalSent });
    }

    // ══════════════════════════════════════════
    //  ÉVÉNEMENTS PONCTUELS (POST)
    // ══════════════════════════════════════════

    // Nouvelle inscription
    if (body.event === 'signup') {
      await seq('welcome', { to_email: body.email, to_name: body.name || body.email.split('@')[0] });
      return res.status(200).json({ success: true, sent: 'welcome', to: body.email });
    }

    // Manuel CEO depuis admin.html
    if (body.event === 'manual') {
      const { data: profile } = await sb.from('profiles').select('*').eq('id', body.user_id).single();
      if (!profile) return res.status(404).json({ error: 'Vendeur introuvable' });
      await seq(body.type || 'welcome', {
        to_email: profile.email,
        to_name:  profile.full_name || profile.email.split('@')[0]
      });
      return res.status(200).json({ success: true, sent: body.type, to: profile.email });
    }


    // ══════════════════════════════════════════
    //  WEBHOOK BREVO (open/click/unsub/bounce)
    //  Brevo → Settings → Webhooks → /api/email/trigger
    // ══════════════════════════════════════════
    if (body.event === 'brevo_webhook' || body.email && body['event'] && ['opened','clicked','unsubscribed','hard_bounce','soft_bounce'].includes(body['event'])) {
      const events = Array.isArray(req.body) ? req.body : [req.body];
      const crypto = require('crypto');
      for (const ev of events) {
        const typeMap = { opened:'open', clicked:'click', unsubscribed:'unsub', hard_bounce:'bounce', soft_bounce:'bounce' };
        const mappedType = typeMap[ev.event];
        if (!mappedType || !ev.email) continue;
        const campaignId = ev.tags?.campaign_id;
        const vendorId   = ev.tags?.vendor_id;
        if (campaignId && vendorId) {
          await sb.from('email_events').insert({ user_id:vendorId, campaign_id:campaignId, contact_email:ev.email, event_type:mappedType, url_clicked:ev.link||null }).catch(()=>{});
          const fieldMap = { open:'open_count', click:'click_count', unsub:'unsub_count' };
          const field = fieldMap[mappedType];
          if (field) {
            const { data: camp } = await sb.from('campaigns').select(field).eq('id', campaignId).single().catch(()=>({data:null}));
            if (camp) { const u={}; u[field]=(camp[field]||0)+1; await sb.from('campaigns').update(u).eq('id',campaignId).catch(()=>{}); }
          }
        }
        if (mappedType === 'unsub' && vendorId) {
          await sb.from('unsubscribes').upsert({ vendor_id:vendorId, email:ev.email, reason:ev.reason||'Email' },{ onConflict:'vendor_id,email' }).catch(()=>{});
          await sb.from('contacts').update({ unsubscribed:true }).eq('user_id',vendorId).eq('email',ev.email).catch(()=>{});
        }
      }
      return res.status(200).json({ ok:true, processed:events.length });
    }

    return res.status(400).json({ error: 'Événement non reconnu. Utilisez : cron | signup | manual' });

  } catch (err) {
    console.error('Trigger error:', err);
    return res.status(500).json({ error: err.message });
  }
};

// Helper — appel interne à sequence.js
async function seq(type, data) {
  try {
    const res = await fetch(`${APP_URL}/api/email/sequence`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ type, ...data })
    });
    return res.json();
  } catch (e) {
    console.error('seq() error:', type, e.message);
  }
}

// ── WEBHOOK BREVO intégré dans trigger.js ──
// POST /api/email/trigger  avec body.event = 'brevo_webhook'
// Brevo → Settings → Webhooks → Ajouter /api/email/trigger
