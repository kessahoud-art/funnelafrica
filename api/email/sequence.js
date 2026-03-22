   // ============================================================
//  api/email/sequence.js — Séquences email automatiques
//  P2 : Templates HTML premium via templates.js
//  P3 : Séquences vendeur → acheteurs intégrées
//  IA  : Tips Groq personnalisés dans chaque email
// ============================================================
const { createClient } = require('@supabase/supabase-js');
const {
  tplWelcome, tplRelance, tplUpgrade,
  tplBuyerFollowup, generateAITip, sendBrevo
} = require('./templates');

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const APP_URL   = process.env.APP_URL   || 'https://funnelafrica.vercel.app';
const FROM_NAME = process.env.FROM_NAME  || 'FunnelAfrica';
const FROM_EMAIL= process.env.FROM_EMAIL || 'noreply@funnelafrica.com';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST requis' });

  try {
    const { type, to_email, to_name, tunnel_name, tunnel_url,
            buyer_name, buyer_email, product_name, access_url,
            vendor_name, vendor_message, primary_color,
            tunnel_count, revenue, day } = req.body;

    if (!type) return res.status(400).json({ error: 'type requis' });

    let email_data = null;

    // ══ SÉQUENCES CEO → VENDEURS ══

    // 1. Bienvenue J+0
    if (type === 'welcome') {
      if (!to_email || !to_name) return res.status(400).json({ error: 'to_email et to_name requis' });
      const ai_tip = await generateAITip({ type: 'welcome', context: 'nouvel entrepreneur africain sur FunnelAfrica' });
      email_data = tplWelcome({ to_name, ai_tip });
      await sendBrevo(to_email, to_name, email_data.subject, email_data.html, FROM_EMAIL, FROM_NAME);
      return res.status(200).json({ success: true, type, sent_to: to_email });
    }

    // 2. Relance J+3
    if (type === 'relance') {
      if (!to_email || !to_name) return res.status(400).json({ error: 'to_email et to_name requis' });
      const ai_tip = await generateAITip({ type: 'relance', context: 'entrepreneur inscrit depuis 3 jours sans tunnel publié' });
      email_data = tplRelance({ to_name, tunnel_name, tunnel_url, ai_tip });
      await sendBrevo(to_email, to_name, email_data.subject, email_data.html, FROM_EMAIL, FROM_NAME);
      return res.status(200).json({ success: true, type, sent_to: to_email });
    }

    // 3. Upgrade J+7
    if (type === 'upgrade') {
      if (!to_email || !to_name) return res.status(400).json({ error: 'to_email et to_name requis' });
      const ai_tip = await generateAITip({ type: 'upgrade', context: `vendeur actif depuis 7 jours avec ${tunnel_count||0} tunnel(s) et ${revenue||0} FCFA de revenus` });
      email_data = tplUpgrade({ to_name, tunnel_count, revenue, ai_tip });
      await sendBrevo(to_email, to_name, email_data.subject, email_data.html, FROM_EMAIL, FROM_NAME);
      return res.status(200).json({ success: true, type, sent_to: to_email });
    }

    // ══ SÉQUENCES VENDEUR → ACHETEURS (P3) ══

    // 4. Suivi acheteur J+1, J+3, J+7
    if (type === 'buyer_followup') {
      if (!buyer_email || !buyer_name) return res.status(400).json({ error: 'buyer_email et buyer_name requis' });
      email_data = tplBuyerFollowup({
        buyer_name, product_name, access_url,
        vendor_name, vendor_message, primary_color,
        day: day || '1'
      });
      // Email envoyé au nom du vendeur (même compte Brevo CEO)
      const sender_name  = vendor_name  || FROM_NAME;
      const sender_email = FROM_EMAIL;
      await sendBrevo(buyer_email, buyer_name, email_data.subject, email_data.html, sender_email, sender_name);
      return res.status(200).json({ success: true, type, sent_to: buyer_email });
    }

    // 5. Broadcast vendeur → tous ses acheteurs (P3)
    if (type === 'vendor_broadcast') {
      const { vendor_id, message_subject, message_body } = req.body;
      if (!vendor_id) return res.status(400).json({ error: 'vendor_id requis' });

      // Récupérer tous les contacts du vendeur
      const { data: contacts } = await sb.from('contacts')
        .select('email, name')
        .eq('user_id', vendor_id)
        .limit(100); // Max 100 pour rester dans les 300 Brevo/jour

      if (!contacts || !contacts.length) {
        return res.status(200).json({ success: true, sent: 0, message: 'Aucun contact' });
      }

      // Récupérer profil vendeur
      const { data: vProfile } = await sb.from('profiles')
        .select('full_name').eq('id', vendor_id).single();
      const vName = vProfile?.full_name || 'Votre formateur';

      let sent = 0;
      for (const contact of contacts) {
        const { wrap, p, btn, divider } = require('./templates');
        const body_html = message_body
          .replace(/{prenom}/g, (contact.name||contact.email).split(' ')[0])
          .replace(/{email}/g, contact.email);

        const html = wrap(`
          <h2 style="color:#e8f0f8;font-family:Arial,sans-serif;font-size:22px;font-weight:900;margin:0 0 16px;">${message_subject}</h2>
          <p style="color:#6b7e93;font-family:Arial,sans-serif;font-size:15px;line-height:1.7;margin:0 0 20px;">${body_html}</p>
          <p style="color:#6b7e93;font-family:Arial,sans-serif;font-size:12px;margin:24px 0 0;">Message de <strong style="color:#e8f0f8;">${vName}</strong> via FunnelAfrica</p>
        `, { accentColor: primary_color || '#00c896' });

        await sendBrevo(contact.email, contact.name || contact.email, message_subject, html, FROM_EMAIL, vName)
          .catch(() => {});
        sent++;
        // Délai pour éviter spam Brevo
        await new Promise(r => setTimeout(r, 100));
      }

      return res.status(200).json({ success: true, type, sent, total: contacts.length });
    }

    // ══ NOUVELLES SÉQUENCES ══

    // 6. Panier abandonné H+2
    if (type === 'abandon_cart') {
      if (!buyer_email || !buyer_name) return res.status(400).json({ error: 'buyer_email et buyer_name requis' });
      const { tplAbandonCart } = require('./templates');
      const tpl = tplAbandonCart({
        buyer_name, product_name: req.body.product_name,
        price: req.body.price, currency: req.body.currency || 'FCFA',
        checkout_url: req.body.checkout_url,
        primary_color, vendor_name
      });
      await sendBrevo(buyer_email, buyer_name, tpl.subject, tpl.html, FROM_EMAIL, vendor_name||FROM_NAME);
      return res.status(200).json({ success: true, type, sent_to: buyer_email });
    }

    // 7. Remboursement
    if (type === 'refund') {
      if (!buyer_email || !buyer_name) return res.status(400).json({ error: 'buyer_email et buyer_name requis' });
      const { tplRefund } = require('./templates');
      const tpl = tplRefund({
        buyer_name, product_name: req.body.product_name,
        amount: req.body.amount, currency: req.body.currency || 'FCFA',
        order_ref: req.body.order_ref, reason: req.body.reason, vendor_name
      });
      await sendBrevo(buyer_email, buyer_name, tpl.subject, tpl.html, FROM_EMAIL, vendor_name||FROM_NAME);
      return res.status(200).json({ success: true, type, sent_to: buyer_email });
    }

    // 8. Offre Upsell
    if (type === 'upsell_offer') {
      if (!buyer_email || !buyer_name) return res.status(400).json({ error: 'buyer_email et buyer_name requis' });
      const { tplUpsellOffer, generateAITip } = require('./templates');
      const ai_pitch = await generateAITip({ type:'upgrade', context:'offre upsell pour acheteur récent de '+req.body.main_product });
      const tpl = tplUpsellOffer({ buyer_name, ...req.body, vendor_name, primary_color, ai_pitch });
      await sendBrevo(buyer_email, buyer_name, tpl.subject, tpl.html, FROM_EMAIL, vendor_name||FROM_NAME);
      return res.status(200).json({ success: true, type, sent_to: buyer_email });
    }

    // 9. Bienvenue affilié
    if (type === 'affiliate_welcome') {
      const { affiliate_email, affiliate_name, affiliate_code, commission } = req.body;
      if (!affiliate_email) return res.status(400).json({ error: 'affiliate_email requis' });
      const { tplAffiliateWelcome } = require('./templates');
      const tpl = tplAffiliateWelcome({
        affiliate_name, affiliate_code, vendor_name,
        product_name: req.body.product_name,
        commission: commission || 20,
        affiliate_url: `${APP_URL}/t/${req.body.tunnel_slug||''}?ref=${affiliate_code}`
      });
      await sendBrevo(affiliate_email, affiliate_name||affiliate_email, tpl.subject, tpl.html, FROM_EMAIL, vendor_name||FROM_NAME);
      return res.status(200).json({ success: true, type, sent_to: affiliate_email });
    }

    // 10. Résumé hebdo
    if (type === 'weekly_digest') {
      if (!req.body.to_email) return res.status(400).json({ error: 'to_email requis' });
      const { tplWeeklyDigest, generateAITip } = require('./templates');
      const tip_ia = await generateAITip({ type:'welcome', context:'vendeur actif avec '+req.body.week_revenue+' FCFA cette semaine' });
      const tpl = tplWeeklyDigest({ ...req.body, vendor_name:req.body.to_name, tip_ia });
      await sendBrevo(req.body.to_email, req.body.to_name, tpl.subject, tpl.html, FROM_EMAIL, FROM_NAME);
      return res.status(200).json({ success: true, type, sent_to: req.body.to_email });
    }

    // 11. Demande d'avis J+14
    if (type === 'review_request') {
      if (!buyer_email || !buyer_name) return res.status(400).json({ error: 'buyer_email et buyer_name requis' });
      const prenom = (buyer_name||'').split(' ')[0];
      const { wrap, h1, p, btn, divider } = require('./templates');
      const html = wrap(`
        <div style="text-align:center;margin-bottom:24px;">
          <div style="font-size:48px;margin-bottom:12px;">⭐</div>
          <h1 style="color:#e8f0f8;font-family:Arial,sans-serif;font-size:24px;font-weight:900;margin:0 0 12px;">${prenom}, votre avis compte !</h1>
          <p style="color:#6b7e93;font-family:Arial,sans-serif;font-size:15px;line-height:1.7;margin:0 0 14px;">Cela fait 2 semaines que vous avez accès à <strong style="color:#e8f0f8;">${product_name||'votre produit'}</strong>. Votre avis aide d'autres entrepreneurs africains à prendre leur décision.</p>
        </div>
        <div style="background:#0d1318;border:1px solid #1e2a38;border-radius:10px;padding:20px;margin-bottom:20px;text-align:center;">
          <p style="color:#6b7e93;font-family:Arial,sans-serif;font-size:14px;margin:0 0 12px;">Comment évaluez-vous votre expérience ?</p>
          <div style="display:flex;justify-content:center;gap:8px;">
            ${[1,2,3,4,5].map(n=>`<a href="${req.body.review_url||APP_URL}?rating=${n}" style="display:inline-block;width:40px;height:40px;line-height:40px;border-radius:50%;background:#182030;color:#e8f0f8;font-family:Arial,sans-serif;font-weight:900;text-decoration:none;font-size:16px;">${n}</a>`).join('')}
          </div>
        </div>
        ${btn('✍️ Laisser mon avis complet', req.body.review_url||APP_URL, '#00c896')}
      `, { accentColor: primary_color||'#00c896' });
      await sendBrevo(buyer_email, buyer_name, `⭐ ${prenom}, votre avis sur ${product_name||'votre achat'} ?`, html, FROM_EMAIL, vendor_name||FROM_NAME);
      return res.status(200).json({ success: true, type, sent_to: buyer_email });
    }

    return res.status(400).json({ error: `Type inconnu : ${type}. Types : welcome | relance | upgrade | buyer_followup | vendor_broadcast | abandon_cart | refund | upsell_offer | affiliate_welcome | weekly_digest | review_request` });

  } catch (err) {
    console.error('Sequence error:', err);
    return res.status(500).json({ error: err.message });
  }
};         
