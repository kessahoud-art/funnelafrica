// ============================================================
//  api/ai/generate.js — Génération contenu tunnel via Groq
//  POST /api/ai/generate
//  Body: { type, product_name, target, price, user_id }
//  Types: title | benefits | faq | testimonial | full_page
// ============================================================
const { createClient } = require('@supabase/supabase-js');

const sb = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL   = 'llama-3.3-70b-versatile';

const PROMPTS = {
  title: (d) => `Tu es un copywriter expert pour le marché africain francophone.
Génère 3 titres de page de vente accrocheurs pour ce produit :
- Nom : ${d.product_name}
- Type : ${d.type}
- Cible : ${d.target}
- Prix : ${d.price} FCFA
Réponds UNIQUEMENT en JSON : {"titles":["titre1","titre2","titre3"]}`,

  benefits: (d) => `Tu es un copywriter expert pour le marché africain francophone.
Génère 6 bénéfices concrets pour ce produit :
- Nom : ${d.product_name}
- Type : ${d.type}
- Cible : ${d.target}
Chaque bénéfice = 1 phrase courte et percutante.
Réponds UNIQUEMENT en JSON : {"benefits":["b1","b2","b3","b4","b5","b6"]}`,

  faq: (d) => `Tu es un expert marketing pour le marché africain francophone.
Génère 3 questions/réponses FAQ pour ce produit :
- Nom : ${d.product_name}
- Prix : ${d.price} FCFA
- Cible : ${d.target}
Réponds UNIQUEMENT en JSON : {"faq":[{"q":"question","a":"réponse"},{"q":"...","a":"..."},{"q":"...","a":"..."}]}`,

  testimonial: (d) => `Tu es un copywriter pour le marché africain francophone.
Génère 2 témoignages clients réalistes pour ce produit :
- Nom : ${d.product_name}
- Cible : ${d.target}
Utilise des prénoms et villes africains (Abidjan, Dakar, Cotonou, Bamako, Lomé...)
Réponds UNIQUEMENT en JSON : {"testimonials":[{"text":"témoignage...","name":"Prénom NOM","city":"Ville"},{"text":"...","name":"...","city":"..."}]}`,

  full_page: (d) => `Tu es un copywriter expert pour le marché africain francophone.
Génère le contenu complet d'une page de vente pour :
- Nom : ${d.product_name}
- Type : ${d.type}
- Cible : ${d.target}
- Prix : ${d.price} FCFA
Réponds UNIQUEMENT en JSON :
{
  "title": "titre principal accrocheur",
  "subtitle": "sous-titre avec la promesse principale",
  "desc": "description 2-3 phrases",
  "badge": "Formation · Accès immédiat",
  "btn_text": "texte bouton d'achat",
  "guarantee": "texte garantie",
  "benefits": ["b1","b2","b3","b4","b5","b6"],
  "faq": [{"q":"q1","a":"r1"},{"q":"q2","a":"r2"},{"q":"q3","a":"r3"}],
  "testimonials": [{"text":"t1","name":"Nom1","city":"Ville1"},{"text":"t2","name":"Nom2","city":"Ville2"}],
  "includes": ["inclus1","inclus2","inclus3","inclus4"]
}`,

  // TYPE 6 — Objets d'email A/B (3 variantes)
  email_subject: (d) => `Tu es un expert en email marketing pour l'Afrique francophone.
Génère 3 objets d'email différents pour relancer des clients qui n'ont pas encore acheté ce produit :
- Produit : ${d.product_name}
- Prix : ${d.price} FCFA
- Cible : ${d.target}
Utilise des émojis percutants. Chaque objet < 60 caractères.
Réponds UNIQUEMENT en JSON : {"subjects":[{"text":"objet 1","angle":"urgence"},{"text":"objet 2","angle":"curiosité"},{"text":"objet 3","angle":"bénéfice"}]}`,

  // TYPE 7 — Texte pub Facebook Ads
  ad_copy: (d) => `Tu es un expert en publicité Facebook pour l'Afrique francophone.
Génère 3 textes de publicité Facebook Ads pour ce produit :
- Produit : ${d.product_name}
- Type : ${d.type}
- Prix : ${d.price} FCFA
- Cible : ${d.target}
Format : Accroche 1 ligne + Corps 2-3 lignes + CTA fort. Utilise le contexte africain.
Réponds UNIQUEMENT en JSON : {"ads":[{"hook":"accroche","body":"corps","cta":"bouton"},{"hook":"...","body":"...","cta":"..."},{"hook":"...","body":"...","cta":"..."}]}`,

  // TYPE 8 — Message WhatsApp de vente
  whatsapp_msg: (d) => `Tu es un expert en vente par WhatsApp pour l'Afrique francophone.
Génère 2 messages WhatsApp différents pour vendre ce produit :
- Produit : ${d.product_name}
- Prix : ${d.price} FCFA
- Lien : ${d.url||'[LIEN]'}
- Cible : ${d.target}
Messages courts, conversationnels, avec émojis africains, finissant par le lien.
Réponds UNIQUEMENT en JSON : {"messages":["message complet 1","message complet 2"]}`,

  // TYPE 9 — Suggestion de prix
  price_suggestion: (d) => `Tu es un expert en pricing pour le marché africain francophone.
Suggère 3 stratégies de prix pour ce produit :
- Produit : ${d.product_name}
- Type : ${d.type}
- Cible : ${d.target}
- Prix actuel : ${d.price||'non défini'} FCFA
Prends en compte le pouvoir d'achat africain et les prix habituels du marché.
Réponds UNIQUEMENT en JSON : {"suggestions":[{"price":9900,"strategy":"Entrée de gamme","justification":"..."},{"price":19900,"strategy":"Prix principal","justification":"..."},{"price":49900,"strategy":"Premium","justification":"..."}]}`,

  // TYPE 10 — Séquence email complète (5 emails)
  email_sequence: (d) => `Tu es un expert en email marketing pour l'Afrique francophone.
Génère une séquence de 5 emails automatiques pour ce produit/formation :
- Produit : ${d.product_name}
- Prix : ${d.price} FCFA
- Cible : ${d.target}
Séquence : J+0 (bienvenue) · J+1 (tip utile) · J+3 (témoignage) · J+5 (offre spéciale) · J+7 (dernière chance)
Réponds UNIQUEMENT en JSON : {"emails":[{"day":"J+0","subject":"...","preview":"...","key_message":"..."},{"day":"J+1",...},{"day":"J+3",...},{"day":"J+5",...},{"day":"J+7",...}]}`,

  // TYPE 11 — Bio vendeur pour page de vente
  vendor_bio: (d) => `Tu es un copywriter pour l'Afrique francophone.
Rédige une bio professionnelle et inspirante pour un vendeur africain :
- Nom : ${d.product_name}
- Domaine : ${d.type}
- Pays : ${d.target||'Afrique de l\'Ouest'}
La bio doit être à la 3ème personne, 3-4 phrases, crédible et proche du lecteur africain.
Réponds UNIQUEMENT en JSON : {"bio":"texte de la bio...","tagline":"slogan court"}`,
};

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST requis' });

  const { type, product_name, target, price, product_type, user_id, url } = req.body;

  if (!type || !product_name || !user_id) {
    return res.status(400).json({ error: 'type, product_name et user_id requis' });
  }

  // Vérifier auth
  const { data: profile } = await sb
    .from('profiles').select('plan, ai_credits').eq('id', user_id).single();
  if (!profile) return res.status(401).json({ error: 'Utilisateur introuvable' });

  // Vérifier crédits IA
  const credits = profile.ai_credits || 0;
  if (credits <= 0) {
    return res.status(402).json({ error: 'Crédits IA épuisés. Contactez le support pour en obtenir plus.', credits: 0 });
  }

  const promptFn = PROMPTS[type];
  if (!promptFn) return res.status(400).json({ error: `Type invalide. Valeurs : ${Object.keys(PROMPTS).join(', ')}` });

  const prompt = promptFn({
    product_name,
    target:  target || 'entrepreneurs africains',
    price:   price  || '9900',
    type:    product_type || 'formation',
    url:     url    || ''
  });

  try {
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1500,
        temperature: 0.7
      })
    });

    if (!groqRes.ok) {
      const err = await groqRes.text();
      console.error('Groq error:', err);
      return res.status(502).json({ error: 'Erreur IA - réessayez' });
    }

    const groqData = await groqRes.json();
    const raw = groqData.choices?.[0]?.message?.content || '{}';

    // Nettoyer et parser le JSON
    const clean = raw.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);

    // Déduire 1 crédit IA
    await sb.from('profiles').update({ ai_credits: credits - 1 }).eq('id', user_id);

    // Logger la génération
    await sb.from('ai_generations').insert({
      user_id, type,
      prompt_summary: `${type}:${product_name.slice(0,50)}`,
      result: parsed,
      tokens_used: groqData.usage?.total_tokens || 0
    }).catch(() => {});

    return res.status(200).json({
      success: true,
      type,
      data: parsed,
      model: GROQ_MODEL,
      credits_remaining: credits - 1
    });

  } catch (err) {
    console.error('AI generate error:', err);
    return res.status(500).json({ error: 'Erreur de génération - vérifiez la clé Groq' });
  }
};
