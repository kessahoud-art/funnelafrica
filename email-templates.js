// ============================================================
//  api/email/templates.js — Templates HTML email FunnelAfrica
//  Utilisé par confirmation.js, sequence.js, trigger.js
//  Intègre : IA Groq pour personnalisation + design premium
// ============================================================

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const APP_URL      = process.env.APP_URL || 'https://funnelafrica.vercel.app';

// ── Couleurs & style global ──
const COLORS = {
  bg:      '#0a0f14',
  surface: '#111820',
  border:  '#1e2a38',
  green:   '#00c896',
  gold:    '#f5a623',
  text:    '#e8f0f8',
  muted:   '#6b7e93',
  danger:  '#ff4d6d',
};

// ── Wrapper HTML global ──
function wrap(content, opts = {}) {
  const color = opts.accentColor || COLORS.green;
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<meta name="color-scheme" content="dark">
<title>${opts.title || 'FunnelAfrica'}</title>
</head>
<body style="margin:0;padding:0;background:${COLORS.bg};font-family:Arial,'Helvetica Neue',sans-serif;-webkit-font-smoothing:antialiased;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:${COLORS.bg};padding:32px 16px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

  <!-- HEADER -->
  <tr><td style="background:${COLORS.surface};border:1px solid ${COLORS.border};border-radius:14px 14px 0 0;padding:24px 32px;text-align:center;border-bottom:3px solid ${color};">
    <div style="display:inline-flex;align-items:center;gap:10px;">
      <div style="width:36px;height:36px;background:linear-gradient(135deg,${color},#00a87a);border-radius:9px;display:inline-block;vertical-align:middle;"></div>
      <span style="font-family:Arial,sans-serif;font-weight:900;font-size:20px;color:${color};vertical-align:middle;letter-spacing:-0.5px;">FunnelAfrica</span>
    </div>
  </td></tr>

  <!-- BODY -->
  <tr><td style="background:${COLORS.surface};border-left:1px solid ${COLORS.border};border-right:1px solid ${COLORS.border};padding:32px;">
    ${content}
  </td></tr>

  <!-- FOOTER -->
  <tr><td style="background:#0d1318;border:1px solid ${COLORS.border};border-top:none;border-radius:0 0 14px 14px;padding:20px 32px;text-align:center;">
    <p style="color:${COLORS.muted};font-size:12px;margin:0 0 6px;">FunnelAfrica · La plateforme de vente africaine</p>
    <p style="color:${COLORS.muted};font-size:11px;margin:0;">
      <a href="${APP_URL}/funnelafrica-dashboard.html" style="color:${color};text-decoration:none;">Mon dashboard</a>
      &nbsp;·&nbsp;
      <a href="${APP_URL}/ressources.html" style="color:${COLORS.muted};text-decoration:none;">Ressources</a>
      &nbsp;·&nbsp;
      <a href="${APP_URL}/profil.html?unsubscribe=1" style="color:${COLORS.muted};text-decoration:none;font-size:10px;">Se désabonner</a>
    </p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

// ── Composants réutilisables ──
function btn(text, url, color) {
  const c = color || COLORS.green;
  return `<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:20px 0;">
    <a href="${url}" style="display:inline-block;background:${c};color:#0a0f14;font-family:Arial,sans-serif;font-weight:900;font-size:16px;text-decoration:none;padding:14px 32px;border-radius:10px;letter-spacing:0.3px;">${text}</a>
  </td></tr></table>`;
}

function divider() {
  return `<hr style="border:none;border-top:1px solid ${COLORS.border};margin:24px 0;">`;
}

function badge(text, color) {
  const c = color || COLORS.green;
  return `<span style="display:inline-block;background:${c}20;border:1px solid ${c}40;color:${c};font-family:Arial,sans-serif;font-weight:700;font-size:12px;padding:4px 12px;border-radius:20px;">${text}</span>`;
}

function statBox(label, value, color) {
  const c = color || COLORS.green;
  return `<td width="33%" style="text-align:center;padding:14px;background:#0d1318;border:1px solid ${COLORS.border};border-radius:10px;">
    <div style="font-family:Arial,sans-serif;font-weight:900;font-size:20px;color:${c};margin-bottom:4px;">${value}</div>
    <div style="font-size:11px;color:${COLORS.muted};">${label}</div>
  </td>`;
}

function h1(text, color) {
  return `<h1 style="color:${color||COLORS.text};font-family:Arial,sans-serif;font-size:26px;font-weight:900;margin:0 0 12px;line-height:1.3;">${text}</h1>`;
}

function p(text) {
  return `<p style="color:${COLORS.muted};font-family:Arial,sans-serif;font-size:15px;line-height:1.7;margin:0 0 14px;">${text}</p>`;
}

function checkItem(text, color) {
  const c = color || COLORS.green;
  return `<div style="display:flex;align-items:flex-start;gap:10px;padding:8px 0;border-bottom:1px solid ${COLORS.border};">
    <span style="color:${c};font-size:16px;flex-shrink:0;">✓</span>
    <span style="color:${COLORS.text};font-family:Arial,sans-serif;font-size:14px;line-height:1.5;">${text}</span>
  </div>`;
}

// ════════════════════════════════════════════════
//  TEMPLATE 1 — CONFIRMATION ACHAT (acheteur)
// ════════════════════════════════════════════════
function tplConfirmation(data) {
  const {
    buyer_name, product_name, amount, currency = 'FCFA',
    payment_method, order_ref, access_url,
    download_url, thank_you_msg, vendor_name,
    primary_color
  } = data;

  const color    = primary_color || COLORS.green;
  const prenom   = (buyer_name || '').split(' ')[0] || 'cher client';
  const amountFmt = (amount || 0).toLocaleString('fr') + ' ' + currency;
  const methods  = { wave:'🌊 Wave', mtn:'💛 MTN MoMo', orange:'🟠 Orange Money', moov:'💚 Moov Money', card:'💳 Carte' };
  const methodLabel = methods[payment_method] || payment_method || 'Mobile Money';
  const date     = new Date().toLocaleDateString('fr-FR', { day:'2-digit', month:'long', year:'numeric' });

  const content = `
    <div style="text-align:center;margin-bottom:24px;">
      <div style="font-size:48px;margin-bottom:12px;">✅</div>
      ${badge('Paiement confirmé', color)}
      <br><br>
      ${h1(`Merci ${prenom} !`, COLORS.text)}
      ${p(`Votre paiement pour <strong style="color:${COLORS.text};">${product_name || 'votre achat'}</strong> a été confirmé avec succès.`)}
    </div>

    <table width="100%" cellpadding="8" cellspacing="0" style="background:#0d1318;border:1px solid ${COLORS.border};border-radius:10px;margin-bottom:20px;">
      <tr><td style="font-size:13px;color:${COLORS.muted};font-family:Arial,sans-serif;">Référence commande</td><td style="font-size:13px;color:${COLORS.text};font-family:monospace;text-align:right;">${order_ref || '—'}</td></tr>
      <tr style="border-top:1px solid ${COLORS.border};"><td style="font-size:13px;color:${COLORS.muted};font-family:Arial,sans-serif;">Montant payé</td><td style="font-size:15px;color:${color};font-weight:900;font-family:Arial,sans-serif;text-align:right;">${amountFmt}</td></tr>
      <tr style="border-top:1px solid ${COLORS.border};"><td style="font-size:13px;color:${COLORS.muted};font-family:Arial,sans-serif;">Méthode</td><td style="font-size:13px;color:${COLORS.text};font-family:Arial,sans-serif;text-align:right;">${methodLabel}</td></tr>
      <tr style="border-top:1px solid ${COLORS.border};"><td style="font-size:13px;color:${COLORS.muted};font-family:Arial,sans-serif;">Date</td><td style="font-size:13px;color:${COLORS.text};font-family:Arial,sans-serif;text-align:right;">${date}</td></tr>
      ${vendor_name ? `<tr style="border-top:1px solid ${COLORS.border};"><td style="font-size:13px;color:${COLORS.muted};font-family:Arial,sans-serif;">Vendeur</td><td style="font-size:13px;color:${COLORS.text};font-family:Arial,sans-serif;text-align:right;">${vendor_name}</td></tr>` : ''}
    </table>

    ${thank_you_msg ? `<div style="background:${color}15;border-left:3px solid ${color};padding:14px 18px;border-radius:0 8px 8px 0;margin-bottom:20px;"><p style="color:${COLORS.text};font-family:Arial,sans-serif;font-size:14px;margin:0;line-height:1.7;">${thank_you_msg}</p></div>` : ''}

    ${btn('🚀 Accéder à ma commande', access_url || APP_URL + '/espace-membre.html', color)}

    ${download_url ? `${divider()}<div style="text-align:center;">${badge('⬇️ Téléchargement disponible', COLORS.gold)}<br><br>${btn('⬇️ Télécharger mon produit', download_url, COLORS.gold)}</div>` : ''}

    ${divider()}
    ${p('Un problème avec votre commande ? Répondez directement à cet email.')}
  `;

  return {
    subject: `✅ Paiement confirmé — ${product_name || 'Votre achat'} (${amountFmt})`,
    html:    wrap(content, { accentColor: color, title: 'Confirmation de paiement' })
  };
}

// ════════════════════════════════════════════════
//  TEMPLATE 2 — BIENVENUE VENDEUR (J+0)
// ════════════════════════════════════════════════
function tplWelcome(data) {
  const { to_name, ai_tip } = data;
  const prenom = (to_name || '').split(' ')[0] || 'entrepreneur';

  const content = `
    <div style="text-align:center;margin-bottom:28px;">
      <div style="font-size:52px;margin-bottom:14px;">🚀</div>
      ${h1(`Bienvenue sur FunnelAfrica, ${prenom} !`, COLORS.green)}
      ${p('Tu rejoins la plateforme africaine qui permet aux entrepreneurs de vendre leurs formations, ebooks et services — avec Mobile Money.')}
    </div>

    <div style="background:#0d1318;border:1px solid ${COLORS.border};border-radius:10px;padding:20px;margin-bottom:20px;">
      <p style="color:${COLORS.green};font-family:Arial,sans-serif;font-weight:700;font-size:14px;margin:0 0 14px;text-transform:uppercase;letter-spacing:1px;">⚡ Tes 3 premières actions</p>
      ${checkItem('Crée ton premier tunnel de vente (5 min)', COLORS.green)}
      ${checkItem('Configure ton prix et tes méthodes de paiement', COLORS.green)}
      ${checkItem('Partage ton lien sur WhatsApp et Facebook', COLORS.green)}
    </div>

    ${ai_tip ? `<div style="background:#00c89610;border:1px solid #00c89630;border-radius:10px;padding:16px 20px;margin-bottom:20px;">
      <p style="color:${COLORS.green};font-family:Arial,sans-serif;font-weight:700;font-size:13px;margin:0 0 8px;">🤖 Conseil IA personnalisé</p>
      <p style="color:${COLORS.text};font-family:Arial,sans-serif;font-size:14px;line-height:1.7;margin:0;">${ai_tip}</p>
    </div>` : ''}

    ${btn('✨ Créer mon premier tunnel →', APP_URL + '/funnelafrica-templates.html?new=1', COLORS.green)}

    ${divider()}
    <table width="100%" cellpadding="6" cellspacing="6">
      <tr>
        ${statBox('Plans dispo', '3', COLORS.blue)}
        <td width="4%"></td>
        ${statBox('Pays couverts', '9', COLORS.gold)}
        <td width="4%"></td>
        ${statBox('Méthodes paiement', '4+', COLORS.green)}
      </tr>
    </table>
    ${divider()}
    ${p('Des questions ? Réponds à cet email — nous sommes là pour t\'aider à faire ta première vente.')}
  `;

  return {
    subject: `🚀 Bienvenue sur FunnelAfrica, ${prenom} ! Commence ici →`,
    html:    wrap(content, { accentColor: COLORS.green, title: 'Bienvenue sur FunnelAfrica' })
  };
}

// ════════════════════════════════════════════════
//  TEMPLATE 3 — RELANCE J+3 (pas de tunnel)
// ════════════════════════════════════════════════
function tplRelance(data) {
  const { to_name, tunnel_name, tunnel_url, ai_tip } = data;
  const prenom = (to_name || '').split(' ')[0] || 'entrepreneur';

  const content = `
    <div style="text-align:center;margin-bottom:24px;">
      <div style="font-size:48px;margin-bottom:12px;">💡</div>
      ${h1(`${prenom}, ta première vente t'attend`, COLORS.gold)}
      ${p(`Tu t'es inscrit il y a 3 jours, mais tu n'as pas encore publié ton premier tunnel. Pas de panique — c'est plus simple que tu ne le penses.`)}
    </div>

    <div style="background:#f5a62310;border:1px solid #f5a62330;border-radius:10px;padding:18px 20px;margin-bottom:20px;">
      <p style="color:${COLORS.gold};font-family:Arial,sans-serif;font-weight:700;font-size:14px;margin:0 0 12px;">⏱️ En 10 minutes tu peux :</p>
      ${checkItem('Choisir un template parmi 6 disponibles', COLORS.gold)}
      ${checkItem('Personnaliser ton titre et ton prix', COLORS.gold)}
      ${checkItem('Publier et partager ton lien', COLORS.gold)}
    </div>

    ${tunnel_name ? `<div style="background:#0d1318;border:1px solid ${COLORS.border};border-radius:10px;padding:16px 20px;margin-bottom:20px;">
      <p style="color:${COLORS.muted};font-size:13px;font-family:Arial,sans-serif;margin:0 0 6px;">Ton tunnel en brouillon :</p>
      <p style="color:${COLORS.text};font-family:Arial,sans-serif;font-size:15px;font-weight:700;margin:0;">${tunnel_name}</p>
      ${tunnel_url ? `<a href="${tunnel_url}" style="color:${COLORS.gold};font-size:13px;font-family:Arial,sans-serif;">Voir le tunnel →</a>` : ''}
    </div>` : ''}

    ${ai_tip ? `<div style="background:#f5a62310;border-left:3px solid ${COLORS.gold};padding:14px 18px;border-radius:0 8px 8px 0;margin-bottom:20px;">
      <p style="color:${COLORS.gold};font-family:Arial,sans-serif;font-weight:700;font-size:13px;margin:0 0 6px;">🤖 L'IA te suggère :</p>
      <p style="color:${COLORS.text};font-family:Arial,sans-serif;font-size:14px;line-height:1.7;margin:0;">${ai_tip}</p>
    </div>` : ''}

    ${btn('🎯 Publier mon tunnel maintenant', APP_URL + '/funnelafrica-dashboard.html', COLORS.gold)}

    ${divider()}
    ${p('Les meilleurs vendeurs africains ont commencé exactement là où tu es. La seule différence : ils ont cliqué sur "Publier".')}
  `;

  return {
    subject: `${prenom}, ta première vente t'attend 💡 (3 jours sans tunnel)`,
    html:    wrap(content, { accentColor: COLORS.gold, title: 'Relance FunnelAfrica' })
  };
}

// ════════════════════════════════════════════════
//  TEMPLATE 4 — UPGRADE PRO (J+7)
// ════════════════════════════════════════════════
function tplUpgrade(data) {
  const { to_name, tunnel_count, revenue, ai_tip } = data;
  const prenom = (to_name || '').split(' ')[0] || 'entrepreneur';

  const content = `
    <div style="text-align:center;margin-bottom:24px;">
      <div style="font-size:48px;margin-bottom:12px;">⚡</div>
      ${h1(`${prenom}, tu es prêt pour le niveau Pro`, COLORS.green)}
      ${p('Tu es sur FunnelAfrica depuis 7 jours. C\'est le bon moment pour débloquer les outils qui te feront 10x tes résultats.')}
    </div>

    ${revenue ? `<div style="text-align:center;background:#0d1318;border:2px solid ${COLORS.green};border-radius:12px;padding:18px;margin-bottom:20px;">
      <p style="color:${COLORS.muted};font-size:13px;font-family:Arial,sans-serif;margin:0 0 4px;">Tes revenus cette semaine</p>
      <p style="color:${COLORS.green};font-family:Arial,sans-serif;font-weight:900;font-size:28px;margin:0;">${parseInt(revenue).toLocaleString('fr')} FCFA</p>
      <p style="color:${COLORS.muted};font-size:12px;font-family:Arial,sans-serif;margin:4px 0 0;">Imagine ça × 10 avec le plan Pro</p>
    </div>` : ''}

    <div style="background:#0d1318;border:1px solid ${COLORS.border};border-radius:10px;padding:20px;margin-bottom:20px;">
      <p style="color:${COLORS.green};font-family:Arial,sans-serif;font-weight:700;font-size:14px;margin:0 0 14px;text-transform:uppercase;letter-spacing:1px;">✅ Plan Pro — 9 900 FCFA/mois</p>
      ${checkItem('Tunnels illimités (vs 1 sur Starter)', COLORS.green)}
      ${checkItem('Email marketing — 6 séquences automatiques', COLORS.green)}
      ${checkItem('5 000 contacts clients', COLORS.green)}
      ${checkItem('WhatsApp automation — 5 séquences', COLORS.green)}
      ${checkItem('A/B Testing — compare 2 versions', COLORS.green)}
      ${checkItem('API publique — connecte tes outils', COLORS.green)}
    </div>

    ${ai_tip ? `<div style="background:#00c89610;border-left:3px solid ${COLORS.green};padding:14px 18px;border-radius:0 8px 8px 0;margin-bottom:20px;">
      <p style="color:${COLORS.green};font-family:Arial,sans-serif;font-weight:700;font-size:13px;margin:0 0 6px;">🤖 Conseil IA pour toi :</p>
      <p style="color:${COLORS.text};font-family:Arial,sans-serif;font-size:14px;line-height:1.7;margin:0;">${ai_tip}</p>
    </div>` : ''}

    ${btn('🚀 Passer au plan Pro →', APP_URL + '/abonnement.html', COLORS.green)}
    ${divider()}
    ${p('Offre valable 48h. Après, le tarif reste à 9 900 FCFA/mois sans engagement.')}
  `;

  return {
    subject: `⚡ ${prenom}, débloquez le plan Pro — 9 900 FCFA/mois`,
    html:    wrap(content, { accentColor: COLORS.green, title: 'Passage au plan Pro' })
  };
}

// ════════════════════════════════════════════════
//  TEMPLATE 5 — SÉQUENCE ACHETEUR J+1 (vendeur → acheteur)
// ════════════════════════════════════════════════
function tplBuyerFollowup(data) {
  const {
    buyer_name, product_name, access_url,
    vendor_name, vendor_message, primary_color,
    day // '1' | '3' | '7'
  } = data;

  const color  = primary_color || COLORS.green;
  const prenom = (buyer_name || '').split(' ')[0] || 'client';
  const dayMessages = {
    '1': { icon:'🎯', subject:`${prenom}, comment se passe ${product_name} ?`, intro:'Cela fait maintenant 24h que tu as accès. J\'espère que tu as déjà commencé !' },
    '3': { icon:'💪', subject:`${prenom}, tu progresses avec ${product_name} ?`, intro:'3 jours déjà ! Les résultats viennent à ceux qui passent à l\'action.' },
    '7': { icon:'🏆', subject:`${prenom}, une semaine avec ${product_name}`, intro:'Une semaine entière ! Tu fais partie des rares personnes qui restent engagées.' },
  };
  const msg = dayMessages[day] || dayMessages['1'];

  const content = `
    <div style="text-align:center;margin-bottom:24px;">
      <div style="font-size:48px;margin-bottom:12px;">${msg.icon}</div>
      ${h1(msg.subject.replace(`${prenom}, `, ''), color)}
      ${p(msg.intro)}
    </div>

    ${vendor_message ? `<div style="background:${color}10;border-left:3px solid ${color};padding:14px 18px;border-radius:0 8px 8px 0;margin-bottom:20px;">
      <p style="color:${COLORS.muted};font-size:12px;font-family:Arial,sans-serif;margin:0 0 6px;">Message de ${vendor_name || 'votre formateur'} :</p>
      <p style="color:${COLORS.text};font-family:Arial,sans-serif;font-size:14px;line-height:1.7;margin:0;">${vendor_message}</p>
    </div>` : ''}

    ${btn(`📚 Reprendre ${product_name}`, access_url || APP_URL + '/espace-membre.html', color)}

    ${divider()}
    ${p('Des questions ? Répondez directement à cet email.')}
    <p style="color:${COLORS.muted};font-family:Arial,sans-serif;font-size:12px;text-align:center;margin:0;">Envoyé par <strong style="color:${COLORS.text};">${vendor_name || 'FunnelAfrica'}</strong> via FunnelAfrica</p>
  `;

  return {
    subject: msg.subject,
    html:    wrap(content, { accentColor: color, title: msg.subject })
  };
}

// ════════════════════════════════════════════════
//  IA — Générer un tip personnalisé via Groq
// ════════════════════════════════════════════════
async function generateAITip(context) {
  if (!GROQ_API_KEY) return null;
  try {
    const prompts = {
      welcome: `Tu es un coach business africain. Donne 1 conseil court (2-3 phrases max) à un nouvel entrepreneur africain qui vient de s'inscrire sur une plateforme de vente en ligne. Contexte : ${context}. Réponds directement en français, sans guillemets.`,
      relance: `Tu es un coach business africain. Donne 1 conseil motivant (2-3 phrases) à un entrepreneur qui a créé un compte mais n'a pas encore publié son premier produit en ligne. Contexte : ${context}. Réponds en français, direct et percutant.`,
      upgrade: `Tu es un coach business africain. Donne 1 argument concret (2-3 phrases) pour convaincre un entrepreneur africain de passer à un plan payant. Mentionne la rentabilité. Contexte : ${context}. Réponds en français.`,
    };
    const prompt = prompts[context.type] || prompts.welcome;
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages: [{ role: 'user', content: prompt }], max_tokens: 150, temperature: 0.8 })
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() || null;
  } catch (e) {
    console.error('AI tip error:', e);
    return null;
  }
}

// ── Envoyer via Brevo ──
async function sendBrevo(to_email, to_name, subject, html, from_email, from_name) {
  const BREVO_KEY = process.env.BREVO_API_KEY;
  if (!BREVO_KEY) {
    console.log('[DEV] Email simulé →', to_email, '|', subject);
    return { simulated: true };
  }
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method:  'POST',
    headers: { 'api-key': BREVO_KEY, 'Content-Type': 'application/json' },
    body:    JSON.stringify({
      sender:   { name: from_name || 'FunnelAfrica', email: from_email || process.env.FROM_EMAIL || 'noreply@funnelafrica.com' },
      to:       [{ email: to_email, name: to_name }],
      subject,
      htmlContent: html
    })
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error('Brevo: ' + err);
  }
  return { sent: true };
}


// ════════════════════════════════════════════════
//  TEMPLATE 6 — PANIER ABANDONNÉ (H+2)
// ════════════════════════════════════════════════
function tplAbandonCart(data) {
  const { buyer_name, product_name, price, currency='FCFA', checkout_url, primary_color, vendor_name } = data;
  const color  = primary_color || '#f5a623';
  const prenom = (buyer_name||'').split(' ')[0] || 'ami(e)';
  const priceFmt = price ? (parseInt(price)).toLocaleString('fr')+' '+currency : '';

  const content = `
    <div style="text-align:center;margin-bottom:24px;">
      <div style="font-size:48px;margin-bottom:12px;">🛒</div>
      ${h1(`${prenom}, vous avez oublié quelque chose !`, COLORS.text)}
      ${p(`Vous avez failli accéder à <strong style="color:${COLORS.text};">${product_name||'ce produit'}</strong> mais n'avez pas finalisé votre paiement.`)}
    </div>
    <div style="background:#0d1318;border:2px solid ${color};border-radius:12px;padding:20px;text-align:center;margin-bottom:20px;">
      <div style="font-size:.78rem;color:${COLORS.muted};margin-bottom:6px;">Votre panier vous attend</div>
      <div style="font-family:Arial,sans-serif;font-weight:900;font-size:1.6rem;color:${color};margin-bottom:8px;">${product_name||'Votre produit'}</div>
      ${priceFmt?`<div style="font-family:Arial,sans-serif;font-weight:900;font-size:1.2rem;color:${COLORS.text};">${priceFmt}</div>`:''}
    </div>
    <div style="background:#f5a62310;border-left:3px solid ${color};padding:12px 16px;border-radius:0 8px 8px 0;margin-bottom:20px;">
      <p style="color:${COLORS.text};font-family:Arial,sans-serif;font-size:13px;margin:0;">💡 Le paiement prend moins de 2 minutes avec Wave ou MTN MoMo — aucune carte bancaire requise.</p>
    </div>
    ${btn('✅ Finaliser mon paiement maintenant', checkout_url||APP_URL+'/funnelafrica-checkout.html', color)}
    ${divider()}
    ${p('Ce lien expire dans 24h. Après, vous devrez recommencer votre commande.')}
    <p style="color:${COLORS.muted};font-family:Arial,sans-serif;font-size:12px;text-align:center;margin:0;">Envoyé par ${vendor_name||'FunnelAfrica'}</p>
  `;
  return {
    subject: `🛒 ${prenom}, votre panier vous attend — ${product_name||'Votre achat'}`,
    html: wrap(content, { accentColor:color, title:'Panier abandonné' })
  };
}

// ════════════════════════════════════════════════
//  TEMPLATE 7 — REMBOURSEMENT
// ════════════════════════════════════════════════
function tplRefund(data) {
  const { buyer_name, product_name, amount, currency='FCFA', order_ref, reason, vendor_name } = data;
  const prenom   = (buyer_name||'').split(' ')[0] || 'client';
  const amountFmt = (amount||0).toLocaleString('fr')+' '+currency;

  const content = `
    <div style="text-align:center;margin-bottom:24px;">
      <div style="font-size:48px;margin-bottom:12px;">💸</div>
      ${badge('Remboursement confirmé', COLORS.blue)}
      <br><br>
      ${h1(`Remboursement traité, ${prenom}`, COLORS.text)}
      ${p(`Votre remboursement pour <strong style="color:${COLORS.text};">${product_name||'votre achat'}</strong> a été initié avec succès.`)}
    </div>
    <table width="100%" cellpadding="8" cellspacing="0" style="background:#0d1318;border:1px solid ${COLORS.border};border-radius:10px;margin-bottom:20px;">
      <tr><td style="font-size:13px;color:${COLORS.muted};font-family:Arial,sans-serif;">Référence</td><td style="font-size:13px;color:${COLORS.text};text-align:right;font-family:monospace;">${order_ref||'—'}</td></tr>
      <tr style="border-top:1px solid ${COLORS.border};"><td style="font-size:13px;color:${COLORS.muted};font-family:Arial,sans-serif;">Montant remboursé</td><td style="font-size:15px;color:${COLORS.blue};font-weight:900;font-family:Arial,sans-serif;text-align:right;">${amountFmt}</td></tr>
      <tr style="border-top:1px solid ${COLORS.border};"><td style="font-size:13px;color:${COLORS.muted};font-family:Arial,sans-serif;">Délai de traitement</td><td style="font-size:13px;color:${COLORS.text};text-align:right;font-family:Arial,sans-serif;">2-5 jours ouvrés</td></tr>
      ${reason?`<tr style="border-top:1px solid ${COLORS.border};"><td style="font-size:13px;color:${COLORS.muted};font-family:Arial,sans-serif;">Motif</td><td style="font-size:13px;color:${COLORS.text};text-align:right;font-family:Arial,sans-serif;">${reason}</td></tr>`:''}
    </table>
    ${p('Le remboursement sera crédité sur votre compte Mobile Money. Si vous ne le recevez pas sous 5 jours, contactez-nous.')}
    ${btn('📞 Contacter le support', APP_URL+'/contact', COLORS.blue)}
    <p style="color:${COLORS.muted};font-family:Arial,sans-serif;font-size:12px;text-align:center;margin:16px 0 0;">Par ${vendor_name||'FunnelAfrica'}</p>
  `;
  return {
    subject: `💸 Remboursement de ${amountFmt} — ${product_name||'Votre commande'}`,
    html: wrap(content, { accentColor:COLORS.blue, title:'Remboursement' })
  };
}

// ════════════════════════════════════════════════
//  TEMPLATE 8 — OFFRE UPSELL (après achat principal)
// ════════════════════════════════════════════════
function tplUpsellOffer(data) {
  const { buyer_name, main_product, upsell_title, upsell_price, upsell_desc, upsell_url, primary_color, vendor_name, ai_pitch } = data;
  const color  = primary_color || COLORS.green;
  const prenom = (buyer_name||'').split(' ')[0] || 'client';
  const priceFmt = upsell_price ? parseInt(upsell_price).toLocaleString('fr')+' FCFA' : '';

  const content = `
    <div style="text-align:center;margin-bottom:24px;">
      <div style="font-size:48px;margin-bottom:12px;">🎁</div>
      ${badge('Offre exclusive — 24h seulement', COLORS.gold)}
      <br><br>
      ${h1(`${prenom}, voici une offre spéciale pour vous`, COLORS.text)}
      ${p(`Merci pour votre achat de <strong style="color:${COLORS.text};">${main_product||'votre produit'}</strong>. En tant que client, vous avez accès à cette offre exclusive.`)}
    </div>
    <div style="background:#0d1318;border:2px solid ${COLORS.gold};border-radius:14px;padding:24px;margin-bottom:20px;text-align:center;">
      <div style="font-family:Arial,sans-serif;font-weight:900;font-size:18px;color:${COLORS.text};margin-bottom:8px;">${upsell_title||'Offre complémentaire'}</div>
      ${upsell_desc?`<p style="color:${COLORS.muted};font-family:Arial,sans-serif;font-size:14px;line-height:1.6;margin:0 0 14px;">${upsell_desc}</p>`:''}
      ${priceFmt?`<div style="font-family:Arial,sans-serif;font-weight:900;font-size:26px;color:${COLORS.gold};">${priceFmt}</div><div style="font-size:12px;color:${COLORS.muted};margin-top:4px;">Paiement unique · Accès immédiat</div>`:''}
    </div>
    ${ai_pitch?`<div style="background:${COLORS.gold}10;border-left:3px solid ${COLORS.gold};padding:12px 16px;border-radius:0 8px 8px 0;margin-bottom:20px;"><p style="color:${COLORS.text};font-family:Arial,sans-serif;font-size:14px;margin:0;line-height:1.7;">${ai_pitch}</p></div>`:''}
    ${btn('🎁 Profiter de l\'offre maintenant', upsell_url||APP_URL, COLORS.gold)}
    ${divider()}
    ${p('Cette offre expire dans 24h. Elle ne vous sera plus proposée après.')}
    <p style="color:${COLORS.muted};font-family:Arial,sans-serif;font-size:12px;text-align:center;margin:0;">De ${vendor_name||'FunnelAfrica'}</p>
  `;
  return {
    subject: `🎁 ${prenom}, offre exclusive 24h — ${upsell_title||'Complément'}`,
    html: wrap(content, { accentColor:COLORS.gold, title:'Offre upsell' })
  };
}

// ════════════════════════════════════════════════
//  TEMPLATE 9 — BIENVENUE AFFILIÉ
// ════════════════════════════════════════════════
function tplAffiliateWelcome(data) {
  const { affiliate_name, affiliate_code, vendor_name, product_name, commission, affiliate_url } = data;
  const prenom = (affiliate_name||'').split(' ')[0] || 'ami(e)';

  const content = `
    <div style="text-align:center;margin-bottom:24px;">
      <div style="font-size:48px;margin-bottom:12px;">🤝</div>
      ${badge('Programme d\'affiliation activé', COLORS.purple)}
      <br><br>
      ${h1(`Bienvenue dans le programme, ${prenom} !`, COLORS.text)}
      ${p(`Vous avez été invité(e) par <strong style="color:${COLORS.text};">${vendor_name||'un vendeur FunnelAfrica'}</strong> à promouvoir <strong style="color:${COLORS.text};">${product_name||'leur produit'}</strong>.`)}
    </div>
    <div style="background:#0d1318;border:2px solid ${COLORS.purple};border-radius:12px;padding:20px;margin-bottom:20px;">
      <div style="text-align:center;margin-bottom:16px;">
        <div style="font-size:12px;color:${COLORS.muted};font-family:Arial,sans-serif;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Votre commission par vente</div>
        <div style="font-family:Arial,sans-serif;font-weight:900;font-size:36px;color:${COLORS.purple};">${commission||'20'}%</div>
      </div>
      <div style="background:#111820;border-radius:8px;padding:12px;text-align:center;">
        <div style="font-size:11px;color:${COLORS.muted};margin-bottom:4px;">Votre lien affilié</div>
        <div style="font-family:monospace;font-size:13px;color:${COLORS.purple};word-break:break-all;">${affiliate_url||APP_URL+'/t/produit?ref='+affiliate_code}</div>
      </div>
    </div>
    ${checkItem('Partagez votre lien sur WhatsApp, Facebook, TikTok', COLORS.purple)}
    ${checkItem('Chaque vente = commission automatique', COLORS.purple)}
    ${checkItem('Paiement sur votre Mobile Money', COLORS.purple)}
    ${btn('🚀 Accéder à mes ressources promo', APP_URL+'/affiliation.html', COLORS.purple)}
    ${divider()}
    ${p('Votre code affilié : <strong style="color:'+COLORS.text+';">'+affiliate_code+'</strong>')}
  `;
  return {
    subject: `🤝 ${prenom}, votre lien affilié est prêt — ${commission||'20'}% par vente`,
    html: wrap(content, { accentColor:COLORS.purple, title:'Bienvenue affilié' })
  };
}

// ════════════════════════════════════════════════
//  TEMPLATE 10 — RÉSUMÉ HEBDO VENDEUR (CEO → vendeur)
// ════════════════════════════════════════════════
function tplWeeklyDigest(data) {
  const { vendor_name, week_revenue, week_orders, week_views, top_tunnel, tip_ia, period } = data;
  const prenom = (vendor_name||'').split(' ')[0] || 'entrepreneur';

  const content = `
    <div style="text-align:center;margin-bottom:24px;">
      <div style="font-size:48px;margin-bottom:12px;">📊</div>
      ${badge('Votre rapport de la semaine', COLORS.blue)}
      <br><br>
      ${h1(`${prenom}, voici vos résultats`, COLORS.text)}
      ${p(`Semaine du ${period||'cette semaine'} — Résumé de votre activité FunnelAfrica.`)}
    </div>
    <table width="100%" cellpadding="8" cellspacing="8" style="margin-bottom:20px;">
      <tr>
        ${statBox('Revenus', (week_revenue||0).toLocaleString('fr')+' F', COLORS.green)}
        <td width="4%"></td>
        ${statBox('Commandes', week_orders||0, COLORS.gold)}
        <td width="4%"></td>
        ${statBox('Visites', week_views||0, COLORS.blue)}
      </tr>
    </table>
    ${top_tunnel?`<div style="background:#0d1318;border:1px solid ${COLORS.border};border-radius:10px;padding:16px;margin-bottom:20px;"><div style="font-size:11px;color:${COLORS.muted};text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">🏆 Meilleur tunnel</div><div style="font-family:Arial,sans-serif;font-weight:700;color:${COLORS.text};font-size:15px;">${top_tunnel}</div></div>`:''}
    ${tip_ia?`<div style="background:#00c89610;border-left:3px solid ${COLORS.green};padding:14px 18px;border-radius:0 8px 8px 0;margin-bottom:20px;"><div style="color:${COLORS.green};font-family:Arial,sans-serif;font-weight:700;font-size:13px;margin-bottom:6px;">🤖 Conseil IA de la semaine</div><p style="color:${COLORS.text};font-family:Arial,sans-serif;font-size:14px;line-height:1.7;margin:0;">${tip_ia}</p></div>`:''}
    ${btn('📈 Voir mes statistiques complètes', APP_URL+'/statistiques.html', COLORS.green)}
    ${divider()}
    ${p('Continuez comme ça ! La régularité est la clé du succès en vente en ligne.')}
  `;
  return {
    subject: `📊 ${prenom}, vos résultats de la semaine — ${(week_revenue||0).toLocaleString('fr')} FCFA`,
    html: wrap(content, { accentColor:COLORS.blue, title:'Rapport hebdomadaire' })
  };
}

module.exports = {
  tplConfirmation,
  tplWelcome,
  tplRelance,
  tplUpgrade,
  tplBuyerFollowup,
  tplAbandonCart,
  tplRefund,
  tplUpsellOffer,
  tplAffiliateWelcome,
  tplWeeklyDigest,
  generateAITip,
  sendBrevo,
  wrap, btn, divider, badge, h1, p, checkItem, statBox
};
