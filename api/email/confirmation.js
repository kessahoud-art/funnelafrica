// ============================================================
//  api/email/confirmation.js
//  Vercel Serverless Function — Email de confirmation via Brevo
//
//  Brevo (ex-Sendinblue) = gratuit jusqu'à 300 emails/jour
//  Inscription : brevo.com → gratuit
//
//  Variables d'environnement Vercel :
//  BREVO_API_KEY     = ta clé API Brevo (Settings → API Keys)
//  FROM_EMAIL        = ton email expéditeur vérifié dans Brevo
//  FROM_NAME         = nom affiché (ex: "FunnelAfrica")
// ============================================================

module.exports = async function handler(req, res) {

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Méthode non autorisée' });

  try {
    const {
      buyer_name,
      buyer_email,
      product_name,
      amount,
      currency     = 'FCFA',
      payment_method,
      order_ref,
      access_url   = 'https://funnelafrica.vercel.app/espace-membre.html',
      whatsapp_url = 'https://chat.whatsapp.com/VOTRE_LIEN'
    } = req.body;

    if (!buyer_email || !buyer_name) {
      return res.status(400).json({ error: 'buyer_email et buyer_name requis' });
    }

    const methods = {
      wave: '🌊 Wave', orange: '🟠 Orange Money',
      mtn: '💛 MTN MoMo', cinetpay: '💚 CinetPay', card: '💳 Carte bancaire'
    };

    const methodLabel = methods[payment_method] || payment_method || 'Mobile Money';
    const amountFmt   = (amount || 0).toLocaleString('fr') + ' ' + currency;
    const date        = new Date().toLocaleDateString('fr-FR', {
      day: '2-digit', month: 'long', year: 'numeric'
    });

    // ── EMAIL HTML ──
    const htmlContent = `
<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Confirmation de paiement</title>
</head>
<body style="margin:0;padding:0;background:#0a0f14;font-family:'Helvetica Neue',Arial,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0f14;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">

          <!-- LOGO -->
          <tr>
            <td align="center" style="padding-bottom:24px;">
              <span style="font-size:1.3rem;font-weight:800;color:#00c896;letter-spacing:-0.5px;">
                ⚡ FunnelAfrica
              </span>
            </td>
          </tr>

          <!-- CARD PRINCIPALE -->
          <tr>
            <td style="background:#111820;border:1px solid #1e2a38;border-radius:16px;overflow:hidden;">

              <!-- HEADER VERT -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:linear-gradient(135deg,#0d2a1a,#0a1f2e);padding:36px 32px;text-align:center;border-bottom:1px solid #1e2a38;">
                    <div style="width:72px;height:72px;background:#00c89618;border:3px solid #00c896;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:1.8rem;margin-bottom:16px;">✅</div>
                    <h1 style="margin:0 0 8px;font-size:1.6rem;font-weight:800;color:#00c896;">Paiement confirmé !</h1>
                    <p style="margin:0;font-size:.9rem;color:#8fa5bc;">
                      Bonjour <strong style="color:#e8f0f8;">${buyer_name}</strong>, merci pour votre achat 🎉
                    </p>
                  </td>
                </tr>

                <!-- DÉTAILS COMMANDE -->
                <tr>
                  <td style="padding:24px 28px;">

                    <table width="100%" cellpadding="0" cellspacing="0" style="background:#182030;border:1px solid #1e2a38;border-radius:10px;margin-bottom:20px;">
                      <tr>
                        <td style="padding:14px 16px;border-bottom:1px solid #1e2a38;">
                          <span style="font-size:.68rem;color:#6b7e93;text-transform:uppercase;letter-spacing:.1em;font-weight:700;">RÉCAPITULATIF</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:10px 16px;border-bottom:1px solid #1e2a38;">
                          <table width="100%">
                            <tr>
                              <td style="font-size:.82rem;color:#6b7e93;">Produit</td>
                              <td align="right" style="font-size:.82rem;font-weight:600;color:#e8f0f8;">${product_name || 'Votre produit'}</td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:10px 16px;border-bottom:1px solid #1e2a38;">
                          <table width="100%">
                            <tr>
                              <td style="font-size:.82rem;color:#6b7e93;">Montant</td>
                              <td align="right" style="font-size:.88rem;font-weight:800;color:#00c896;">${amountFmt}</td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:10px 16px;border-bottom:1px solid #1e2a38;">
                          <table width="100%">
                            <tr>
                              <td style="font-size:.82rem;color:#6b7e93;">Méthode</td>
                              <td align="right" style="font-size:.82rem;font-weight:600;color:#e8f0f8;">${methodLabel}</td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:10px 16px;border-bottom:1px solid #1e2a38;">
                          <table width="100%">
                            <tr>
                              <td style="font-size:.82rem;color:#6b7e93;">Date</td>
                              <td align="right" style="font-size:.82rem;color:#e8f0f8;">${date}</td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:10px 16px;">
                          <table width="100%">
                            <tr>
                              <td style="font-size:.82rem;color:#6b7e93;">Référence</td>
                              <td align="right" style="font-size:.72rem;font-family:monospace;color:#6b7e93;">${order_ref || '—'}</td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>

                    <!-- CTA ACCÈS -->
                    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:14px;">
                      <tr>
                        <td align="center">
                          <a href="${access_url}"
                             style="display:inline-block;background:#00c896;color:#0a0f14;font-weight:800;font-size:.95rem;padding:16px 36px;border-radius:12px;text-decoration:none;letter-spacing:-.2px;">
                            🚀 Accéder à ma formation maintenant
                          </a>
                        </td>
                      </tr>
                    </table>

                    <!-- CTA WHATSAPP -->
                    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
                      <tr>
                        <td align="center">
                          <a href="${whatsapp_url}"
                             style="display:inline-block;background:#25d36618;border:1px solid #25d36640;color:#25d366;font-weight:700;font-size:.85rem;padding:12px 28px;border-radius:10px;text-decoration:none;">
                            📱 Rejoindre le groupe WhatsApp
                          </a>
                        </td>
                      </tr>
                    </table>

                    <!-- MESSAGE ── -->
                    <p style="font-size:.8rem;color:#6b7e93;line-height:1.7;margin:0;text-align:center;">
                      Si vous avez des questions, répondez directement à cet email<br>
                      ou contactez-nous sur WhatsApp. Nous répondons sous 24h.
                    </p>

                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="padding:20px;text-align:center;">
              <p style="font-size:.72rem;color:#3a4f65;margin:0;line-height:1.6;">
                © 2026 FunnelAfrica · Vous recevez cet email car vous avez effectué un achat.<br>
                <a href="#" style="color:#3a4f65;">Se désabonner</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>`;

    // ── APPEL API BREVO ──
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'api-key':       process.env.BREVO_API_KEY
      },
      body: JSON.stringify({
        sender: {
          name:  process.env.FROM_NAME  || 'FunnelAfrica',
          email: process.env.FROM_EMAIL || 'noreply@funnelafrica.com'
        },
        to: [{ email: buyer_email, name: buyer_name }],
        subject: `✅ Paiement confirmé — ${product_name || 'Votre achat'}`,
        htmlContent
      })
    });

    if (!response.ok) {
      const err = await response.json();
      console.error('Brevo error:', err);
      return res.status(500).json({ error: 'Erreur envoi email', details: err });
    }

    console.log(`📧 Email envoyé à ${buyer_email}`);
    return res.status(200).json({ success: true, message: `Email envoyé à ${buyer_email}` });

  } catch (err) {
    console.error('Email error:', err);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
}
