// ============================================================
//  api/email/sequence.js
//  Vercel Serverless Function — Séquences email automatiques
//  Appelée depuis le webhook auth Supabase ou manuellement
//
//  Variables Vercel :
//  BREVO_API_KEY = xkeysib-xxxxx
//  FROM_EMAIL    = kessahoud@gmail.com
//  FROM_NAME     = FunnelAfrica
//  APP_URL       = https://funnelafrica.vercel.app
// ============================================================

module.exports = async function handler(req, res) {

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée' });

  try {
    const {
      type,         // 'welcome' | 'relance' | 'upgrade'
      to_email,
      to_name,
      tunnel_name,  // pour l'email de relance
      tunnel_url    // lien public du tunnel
    } = req.body;

    if (!type || !to_email || !to_name) {
      return res.status(400).json({ error: 'type, to_email, to_name requis' });
    }

    const APP_URL   = process.env.APP_URL || 'https://funnelafrica.vercel.app';
    const FROM_NAME = process.env.FROM_NAME  || 'FunnelAfrica';
    const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@funnelafrica.com';

    let subject, htmlContent;

    // ══════════════════════════════════════════
    //  EMAIL 1 — BIENVENUE (J+0)
    //  Envoyé dès l'inscription
    // ══════════════════════════════════════════
    if (type === 'welcome') {
      subject = `Bienvenue sur FunnelAfrica, ${to_name.split(' ')[0]} ! 🚀`;
      htmlContent = `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0a0f14;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0f14;padding:32px 16px;">
  <tr><td align="center">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">

      <!-- LOGO -->
      <tr><td align="center" style="padding-bottom:24px;">
        <span style="font-size:1.4rem;font-weight:800;color:#00c896;">⚡ FunnelAfrica</span>
      </td></tr>

      <!-- CARD -->
      <tr><td style="background:#111820;border:1px solid #1e2a38;border-radius:16px;overflow:hidden;">

        <!-- HEADER -->
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr><td style="background:linear-gradient(135deg,#0d2a1a,#0a1f2e);padding:36px 32px;text-align:center;border-bottom:1px solid #1e2a38;">
            <div style="font-size:2.5rem;margin-bottom:12px;">🚀</div>
            <h1 style="margin:0 0 8px;font-size:1.4rem;font-weight:800;color:#00c896;">Bienvenue sur FunnelAfrica !</h1>
            <p style="margin:0;font-size:.9rem;color:#8fa5bc;">Bonjour <strong style="color:#e8f0f8;">${to_name}</strong>, votre compte est prêt.</p>
          </td></tr>

          <!-- BODY -->
          <tr><td style="padding:28px 32px;">

            <p style="color:#8fa5bc;font-size:.88rem;line-height:1.7;margin-bottom:24px;">
              Vous avez rejoint la plateforme de vente en ligne conçue pour les entrepreneurs africains.
              Voici comment démarrer en 3 étapes :
            </p>

            <!-- ÉTAPES -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
              <tr><td style="background:#182030;border:1px solid #1e2a38;border-radius:10px;padding:14px 16px;margin-bottom:10px;">
                <table width="100%"><tr>
                  <td style="width:36px;"><div style="width:30px;height:30px;background:#00c896;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:.8rem;color:#0a0f14;text-align:center;line-height:30px;">1</div></td>
                  <td style="padding-left:12px;">
                    <div style="font-weight:700;font-size:.88rem;color:#e8f0f8;margin-bottom:3px;">Créez votre premier tunnel</div>
                    <div style="font-size:.78rem;color:#6b7e93;">Choisissez un template et personnalisez en 15 minutes</div>
                  </td>
                </tr></table>
              </td></tr>
              <tr><td style="height:8px;"></td></tr>
              <tr><td style="background:#182030;border:1px solid #1e2a38;border-radius:10px;padding:14px 16px;">
                <table width="100%"><tr>
                  <td style="width:36px;"><div style="width:30px;height:30px;background:#00c896;border-radius:50%;font-weight:800;font-size:.8rem;color:#0a0f14;text-align:center;line-height:30px;">2</div></td>
                  <td style="padding-left:12px;">
                    <div style="font-weight:700;font-size:.88rem;color:#e8f0f8;margin-bottom:3px;">Publiez et partagez votre lien</div>
                    <div style="font-size:.78rem;color:#6b7e93;">Partagez sur Facebook, WhatsApp, Instagram</div>
                  </td>
                </tr></table>
              </td></tr>
              <tr><td style="height:8px;"></td></tr>
              <tr><td style="background:#182030;border:1px solid #1e2a38;border-radius:10px;padding:14px 16px;">
                <table width="100%"><tr>
                  <td style="width:36px;"><div style="width:30px;height:30px;background:#00c896;border-radius:50%;font-weight:800;font-size:.8rem;color:#0a0f14;text-align:center;line-height:30px;">3</div></td>
                  <td style="padding-left:12px;">
                    <div style="font-weight:700;font-size:.88rem;color:#e8f0f8;margin-bottom:3px;">Encaissez avec Mobile Money</div>
                    <div style="font-size:.78rem;color:#6b7e93;">MTN MoMo, Moov Money, Wave, Orange Money</div>
                  </td>
                </tr></table>
              </td></tr>
            </table>

            <!-- CTA -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
              <tr><td align="center">
                <a href="${APP_URL}/funnelafrica-dashboard.html"
                   style="display:inline-block;background:#00c896;color:#0a0f14;font-weight:800;font-size:.95rem;padding:16px 36px;border-radius:12px;text-decoration:none;">
                  🚀 Accéder à mon dashboard
                </a>
              </td></tr>
            </table>

            <p style="font-size:.78rem;color:#6b7e93;text-align:center;line-height:1.6;">
              Des questions ? Répondez à cet email ou contactez-nous sur WhatsApp.<br>
              Nous répondons sous 24h.
            </p>

          </td></tr>
        </table>
      </td></tr>

      <!-- FOOTER -->
      <tr><td style="padding:20px;text-align:center;">
        <p style="font-size:.72rem;color:#3a4f65;margin:0;">
          © 2026 FunnelAfrica · <a href="${APP_URL}" style="color:#3a4f65;">funnelafrica.vercel.app</a>
        </p>
      </td></tr>

    </table>
  </td></tr>
</table>
</body>
</html>`;
    }

    // ══════════════════════════════════════════
    //  EMAIL 2 — RELANCE (J+3)
    //  Si tunnel créé mais pas encore publié
    // ══════════════════════════════════════════
    else if (type === 'relance') {
      subject = `${to_name.split(' ')[0]}, votre tunnel attend d'être publié 👀`;
      htmlContent = `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0a0f14;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0f14;padding:32px 16px;">
  <tr><td align="center">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">

      <tr><td align="center" style="padding-bottom:24px;">
        <span style="font-size:1.4rem;font-weight:800;color:#00c896;">⚡ FunnelAfrica</span>
      </td></tr>

      <tr><td style="background:#111820;border:1px solid #1e2a38;border-radius:16px;overflow:hidden;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr><td style="background:linear-gradient(135deg,#1a0d2a,#0f0a20);padding:36px 32px;text-align:center;border-bottom:1px solid #1e2a38;">
            <div style="font-size:2.5rem;margin-bottom:12px;">👀</div>
            <h1 style="margin:0 0 8px;font-size:1.3rem;font-weight:800;color:#e8f0f8;">Votre tunnel attend d'être publié</h1>
            <p style="margin:0;font-size:.9rem;color:#8fa5bc;">Il suffit d'un clic pour commencer à vendre.</p>
          </td></tr>

          <tr><td style="padding:28px 32px;">
            <p style="color:#8fa5bc;font-size:.88rem;line-height:1.7;margin-bottom:20px;">
              Bonjour <strong style="color:#e8f0f8;">${to_name.split(' ')[0]}</strong>,<br><br>
              ${tunnel_name ? `Votre tunnel "<strong style="color:#e8f0f8;">${tunnel_name}</strong>" est prêt` : 'Votre tunnel est prêt'} mais n'est pas encore publié.
              Pendant ce temps, des clients potentiels ne peuvent pas vous trouver.
            </p>

            <!-- STATS MOTIVANTES -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
              <tr>
                <td style="background:#182030;border:1px solid #1e2a38;border-radius:10px;padding:14px;text-align:center;width:33%;">
                  <div style="font-size:1.3rem;font-weight:800;color:#00c896;">15 min</div>
                  <div style="font-size:.7rem;color:#6b7e93;margin-top:4px;">pour publier</div>
                </td>
                <td style="width:10px;"></td>
                <td style="background:#182030;border:1px solid #1e2a38;border-radius:10px;padding:14px;text-align:center;width:33%;">
                  <div style="font-size:1.3rem;font-weight:800;color:#f5a623;">1ère vente</div>
                  <div style="font-size:.7rem;color:#6b7e93;margin-top:4px;">possible aujourd'hui</div>
                </td>
                <td style="width:10px;"></td>
                <td style="background:#182030;border:1px solid #1e2a38;border-radius:10px;padding:14px;text-align:center;width:33%;">
                  <div style="font-size:1.3rem;font-weight:800;color:#4da6ff;">0 FCFA</div>
                  <div style="font-size:.7rem;color:#6b7e93;margin-top:4px;">pour commencer</div>
                </td>
              </tr>
            </table>

            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
              <tr><td align="center">
                <a href="${APP_URL}/funnelafrica-dashboard.html"
                   style="display:inline-block;background:#00c896;color:#0a0f14;font-weight:800;font-size:.95rem;padding:16px 36px;border-radius:12px;text-decoration:none;">
                  ✅ Publier mon tunnel maintenant →
                </a>
              </td></tr>
            </table>

            <p style="font-size:.78rem;color:#6b7e93;text-align:center;">
              Besoin d'aide ? Répondez à cet email, on vous aide gratuitement.
            </p>
          </td></tr>
        </table>
      </td></tr>

      <tr><td style="padding:20px;text-align:center;">
        <p style="font-size:.72rem;color:#3a4f65;margin:0;">© 2026 FunnelAfrica · <a href="#" style="color:#3a4f65;">Se désabonner</a></p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
    }

    // ══════════════════════════════════════════
    //  EMAIL 3 — UPGRADE PLAN (J+7)
    //  Pour vendeurs actifs sur plan Starter
    // ══════════════════════════════════════════
    else if (type === 'upgrade') {
      subject = `${to_name.split(' ')[0]}, débloquez tout le potentiel de FunnelAfrica ⚡`;
      htmlContent = `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0a0f14;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0f14;padding:32px 16px;">
  <tr><td align="center">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">

      <tr><td align="center" style="padding-bottom:24px;">
        <span style="font-size:1.4rem;font-weight:800;color:#00c896;">⚡ FunnelAfrica</span>
      </td></tr>

      <tr><td style="background:#111820;border:1px solid #1e2a38;border-radius:16px;overflow:hidden;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr><td style="background:linear-gradient(135deg,#1a1000,#201500);padding:36px 32px;text-align:center;border-bottom:1px solid #1e2a38;">
            <div style="font-size:2.5rem;margin-bottom:12px;">⚡</div>
            <h1 style="margin:0 0 8px;font-size:1.3rem;font-weight:800;color:#f5a623;">Passez au niveau supérieur</h1>
            <p style="margin:0;font-size:.9rem;color:#d4a843;">Débloquez tout ce que FunnelAfrica peut faire pour vous.</p>
          </td></tr>

          <tr><td style="padding:28px 32px;">
            <p style="color:#8fa5bc;font-size:.88rem;line-height:1.7;margin-bottom:24px;">
              Bonjour <strong style="color:#e8f0f8;">${to_name.split(' ')[0]}</strong>,<br><br>
              Vous êtes sur le plan Starter depuis 7 jours. Voici ce que vous manquez avec le plan Pro :
            </p>

            <!-- COMPARAISON -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;border-collapse:collapse;">
              <tr style="background:#182030;">
                <td style="padding:10px 14px;font-size:.78rem;color:#6b7e93;border-bottom:1px solid #1e2a38;">Fonctionnalité</td>
                <td style="padding:10px 14px;font-size:.78rem;color:#6b7e93;text-align:center;border-bottom:1px solid #1e2a38;">Starter</td>
                <td style="padding:10px 14px;font-size:.78rem;color:#00c896;text-align:center;border-bottom:1px solid #1e2a38;font-weight:700;">Pro</td>
              </tr>
              <tr>
                <td style="padding:10px 14px;font-size:.82rem;color:#8fa5bc;border-bottom:1px solid #1e2a38;">Tunnels de vente</td>
                <td style="padding:10px 14px;font-size:.82rem;color:#6b7e93;text-align:center;border-bottom:1px solid #1e2a38;">1</td>
                <td style="padding:10px 14px;font-size:.82rem;color:#00c896;text-align:center;font-weight:700;border-bottom:1px solid #1e2a38;">Illimité</td>
              </tr>
              <tr style="background:#182030;">
                <td style="padding:10px 14px;font-size:.82rem;color:#8fa5bc;border-bottom:1px solid #1e2a38;">Email marketing</td>
                <td style="padding:10px 14px;font-size:.82rem;color:#ff4d6d;text-align:center;border-bottom:1px solid #1e2a38;">✕</td>
                <td style="padding:10px 14px;font-size:.82rem;color:#00c896;text-align:center;font-weight:700;border-bottom:1px solid #1e2a38;">✓</td>
              </tr>
              <tr>
                <td style="padding:10px 14px;font-size:.82rem;color:#8fa5bc;border-bottom:1px solid #1e2a38;">Contacts</td>
                <td style="padding:10px 14px;font-size:.82rem;color:#6b7e93;text-align:center;border-bottom:1px solid #1e2a38;">500</td>
                <td style="padding:10px 14px;font-size:.82rem;color:#00c896;text-align:center;font-weight:700;border-bottom:1px solid #1e2a38;">5 000</td>
              </tr>
              <tr style="background:#182030;">
                <td style="padding:10px 14px;font-size:.82rem;color:#8fa5bc;">Support WhatsApp</td>
                <td style="padding:10px 14px;font-size:.82rem;color:#6b7e93;text-align:center;">Standard</td>
                <td style="padding:10px 14px;font-size:.82rem;color:#00c896;text-align:center;font-weight:700;">Prioritaire</td>
              </tr>
            </table>

            <!-- PRIX -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
              <tr><td style="background:#182030;border:2px solid #00c896;border-radius:12px;padding:20px;text-align:center;">
                <div style="font-size:.78rem;color:#6b7e93;margin-bottom:6px;text-transform:uppercase;letter-spacing:.1em;">PLAN PRO</div>
                <div style="font-size:2rem;font-weight:800;color:#00c896;line-height:1;">9 900</div>
                <div style="font-size:.8rem;color:#6b7e93;margin-bottom:14px;">FCFA / mois · Sans engagement</div>
                <a href="${APP_URL}/abonnement.html"
                   style="display:inline-block;background:#00c896;color:#0a0f14;font-weight:800;font-size:.9rem;padding:14px 28px;border-radius:10px;text-decoration:none;">
                  ⚡ Passer au plan Pro →
                </a>
              </td></tr>
            </table>

            <p style="font-size:.78rem;color:#6b7e93;text-align:center;line-height:1.6;">
              Paiement sécurisé via MTN MoMo, Moov Money, Wave<br>
              Annulable à tout moment · Support WhatsApp inclus
            </p>

          </td></tr>
        </table>
      </td></tr>

      <tr><td style="padding:20px;text-align:center;">
        <p style="font-size:.72rem;color:#3a4f65;margin:0;">© 2026 FunnelAfrica · <a href="#" style="color:#3a4f65;">Se désabonner</a></p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
    }

    else {
      return res.status(400).json({ error: 'Type invalide. Valeurs: welcome | relance | upgrade' });
    }

    // ── Envoyer via Brevo ──
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': process.env.BREVO_API_KEY
      },
      body: JSON.stringify({
        sender:      { name: FROM_NAME, email: FROM_EMAIL },
        to:          [{ email: to_email, name: to_name }],
        subject:     subject,
        htmlContent: htmlContent
      })
    });

    if (!response.ok) {
      const err = await response.json();
      console.error('Brevo error:', err);
      return res.status(500).json({ error: 'Erreur envoi email', details: err });
    }

    console.log(`📧 Email [${type}] envoyé à ${to_email}`);
    return res.status(200).json({ success: true, type, to: to_email });

  } catch (err) {
    console.error('Sequence email error:', err);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
}
