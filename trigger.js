// ============================================================
//  api/email/trigger.js
//  Déclenche automatiquement les séquences email
//  Appelé depuis :
//  - webhook Supabase Auth (à la création de compte)
//  - webhook FedaPay (après paiement)
//  - cron Vercel (J+3 et J+7)
// ============================================================

const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée' });

  try {
    const { event, user_id, email, name } = req.body;
    const APP_URL = process.env.APP_URL || 'https://funnelafrica.vercel.app';

    // ── Supabase service pour lire les données ──
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    // ══════════════════════════════════════════
    //  ÉVÉNEMENT : nouvelle inscription
    //  → Envoyer email de bienvenue (J+0)
    // ══════════════════════════════════════════
    if (event === 'signup') {
      await sendSequenceEmail({
        type:     'welcome',
        to_email: email,
        to_name:  name || email.split('@')[0],
        APP_URL
      });

      return res.status(200).json({ success: true, sent: 'welcome' });
    }

    // ══════════════════════════════════════════
    //  ÉVÉNEMENT : vérification J+3
    //  → Relance si tunnel non publié
    // ══════════════════════════════════════════
    if (event === 'check_j3') {
      const supaUsers = await supabase
        .from('profiles')
        .select('id, full_name, email, created_at')
        .gte('created_at', new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString())
        .lte('created_at', new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString());

      const users = supaUsers.data || [];
      let sent = 0;

      for (const user of users) {
        // Vérifier si l'utilisateur a un tunnel publié
        const { data: liveTunnels } = await supabase
          .from('tunnels')
          .select('id')
          .eq('user_id', user.id)
          .eq('status', 'live')
          .limit(1);

        // Si pas de tunnel live → envoyer email de relance
        if (!liveTunnels || liveTunnels.length === 0) {
          // Récupérer le premier tunnel brouillon
          const { data: draftTunnel } = await supabase
            .from('tunnels')
            .select('name, slug')
            .eq('user_id', user.id)
            .eq('status', 'draft')
            .limit(1)
            .single();

          await sendSequenceEmail({
            type:         'relance',
            to_email:     user.email,
            to_name:      user.full_name || user.email.split('@')[0],
            tunnel_name:  draftTunnel?.name,
            tunnel_url:   draftTunnel?.slug ? `${APP_URL}/t/${draftTunnel.slug}` : null,
            APP_URL
          });

          sent++;
        }
      }

      return res.status(200).json({ success: true, sent: `relance x${sent}` });
    }

    // ══════════════════════════════════════════
    //  ÉVÉNEMENT : vérification J+7
    //  → Email upgrade si toujours sur Starter
    // ══════════════════════════════════════════
    if (event === 'check_j7') {
      const { data: users } = await supabase
        .from('profiles')
        .select('id, full_name, email, plan, created_at')
        .eq('plan', 'starter')
        .gte('created_at', new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString())
        .lte('created_at', new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString());

      let sent = 0;

      for (const user of (users || [])) {
        await sendSequenceEmail({
          type:     'upgrade',
          to_email: user.email,
          to_name:  user.full_name || user.email.split('@')[0],
          APP_URL
        });
        sent++;
      }

      return res.status(200).json({ success: true, sent: `upgrade x${sent}` });
    }

    // ══════════════════════════════════════════
    //  ÉVÉNEMENT : manuel — envoyer à 1 user
    // ══════════════════════════════════════════
    if (event === 'manual' && user_id) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user_id)
        .single();

      if (!profile) return res.status(404).json({ error: 'User non trouvé' });

      const type = req.body.type || 'welcome';

      await sendSequenceEmail({
        type,
        to_email: profile.email,
        to_name:  profile.full_name || profile.email.split('@')[0],
        APP_URL
      });

      return res.status(200).json({ success: true, sent: type, to: profile.email });
    }

    return res.status(400).json({ error: 'Événement non reconnu' });

  } catch (err) {
    console.error('Trigger error:', err);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
}

// ── Appeler l'API sequence.js ──
async function sendSequenceEmail(params) {
  const APP_URL = params.APP_URL;
  const response = await fetch(`${APP_URL}/api/email/sequence`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(params)
  });
  return response.json();
}
