// api/ab/track.js — Tracker une vue ou conversion A/B test
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();
  const { test_id, variant, event } = req.body; // variant: 'a'|'b', event: 'view'|'conversion'
  if (!test_id || !variant || !event) return res.status(400).json({ error: 'Paramètres manquants' });
  const field = event === 'view'
    ? (variant === 'a' ? 'views_a' : 'views_b')
    : (variant === 'a' ? 'conversions_a' : 'conversions_b');
  await sb.rpc('increment_ab_stat', { test_id, field_name: field });

  // Vérifier si on a un gagnant (>100 conversions + diff > 20%)
  const { data: test } = await sb.from('ab_tests').select('*').eq('id', test_id).single();
  if (test && test.conversions_a + test.conversions_b > 100) {
    const rateA = test.views_a > 0 ? test.conversions_a / test.views_a : 0;
    const rateB = test.views_b > 0 ? test.conversions_b / test.views_b : 0;
    const diff = Math.abs(rateA - rateB) / Math.max(rateA, rateB);
    if (diff > 0.2) {
      const winner = rateA > rateB ? 'a' : 'b';
      await sb.from('ab_tests').update({ status: `winner_${winner}`, winner, ended_at: new Date().toISOString() }).eq('id', test_id);
    }
  }
  return res.status(200).json({ ok: true });
};
