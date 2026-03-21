// ============================================================
//  FUNNELAFRICA — REQUÊTES SUPABASE JS
//  Copie ce fichier dans ton projet : /js/supabase-queries.js
//  Importe-le dans chaque page HTML avec :
//  <script src="/js/supabase-queries.js"></script>
// ============================================================

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL     = 'https://VOTRE_PROJECT_ID.supabase.co';
const SUPABASE_ANON_KEY = 'VOTRE_ANON_KEY';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);


// ══════════════════════════════════════════════
//  AUTH
// ══════════════════════════════════════════════

// Inscription
export async function signUp(email, password, fullName, plan = 'starter') {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName, plan } }
  });
  if (error) throw error;
  return data;
}

// Connexion
export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

// Déconnexion
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

// Récupérer l'utilisateur connecté
export async function getUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

// Écouter les changements d'auth
export function onAuthChange(callback) {
  return supabase.auth.onAuthStateChange((_event, session) => {
    callback(session?.user ?? null);
  });
}

// Mot de passe oublié
export async function resetPassword(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password.html`
  });
  if (error) throw error;
}

// Protéger une page — redirige si non connecté
export async function requireAuth(redirectTo = '/funnelafrica-auth.html') {
  const user = await getUser();
  if (!user) window.location.href = redirectTo;
  return user;
}


// ══════════════════════════════════════════════
//  PROFIL VENDEUR
// ══════════════════════════════════════════════

export async function getProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (error) throw error;
  return data;
}

export async function updateProfile(userId, updates) {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select()
    .single();
  if (error) throw error;
  return data;
}


// ══════════════════════════════════════════════
//  TUNNELS
// ══════════════════════════════════════════════

// Créer un tunnel
export async function createTunnel(userId, { name, template = 'formation', price = 0, currency = 'FCFA' }) {
  // Générer un slug unique depuis le nom
  const slug = name
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    + '-' + Date.now().toString(36);

  const { data, error } = await supabase
    .from('tunnels')
    .insert({ user_id: userId, name, slug, template, price, currency })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Récupérer tous les tunnels du vendeur
export async function getTunnels(userId) {
  const { data, error } = await supabase
    .from('tunnels')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

// Récupérer un tunnel par ID
export async function getTunnel(tunnelId) {
  const { data, error } = await supabase
    .from('tunnels')
    .select('*')
    .eq('id', tunnelId)
    .single();
  if (error) throw error;
  return data;
}

// Récupérer un tunnel public par slug (page acheteur)
export async function getTunnelBySlug(slug) {
  const { data, error } = await supabase
    .from('tunnels')
    .select('*')
    .eq('slug', slug)
    .eq('status', 'live')
    .single();
  if (error) throw error;
  return data;
}

// Mettre à jour un tunnel
export async function updateTunnel(tunnelId, updates) {
  const { data, error } = await supabase
    .from('tunnels')
    .update(updates)
    .eq('id', tunnelId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Publier un tunnel
export async function publishTunnel(tunnelId) {
  return updateTunnel(tunnelId, { status: 'live' });
}

// Mettre en pause un tunnel
export async function pauseTunnel(tunnelId) {
  return updateTunnel(tunnelId, { status: 'paused' });
}

// Supprimer un tunnel
export async function deleteTunnel(tunnelId) {
  const { error } = await supabase
    .from('tunnels')
    .delete()
    .eq('id', tunnelId);
  if (error) throw error;
}

// Incrémenter les vues (appelé côté page publique)
export async function incrementViews(tunnelId) {
  const { error } = await supabase.rpc('increment_tunnel_views', { tunnel_id: tunnelId });
  // Si la fonction RPC n'existe pas, fallback :
  if (error) {
    const tunnel = await getTunnel(tunnelId);
    await updateTunnel(tunnelId, { views: (tunnel.views || 0) + 1 });
  }
}


// ══════════════════════════════════════════════
//  COMMANDES
// ══════════════════════════════════════════════

// Créer une commande (depuis la page checkout)
export async function createOrder({
  tunnelId, userId = null,
  buyerName, buyerEmail, buyerPhone, buyerCountry = 'CI',
  amount, currency = 'FCFA', paymentMethod
}) {
  const paymentRef = 'FA-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7).toUpperCase();

  const { data, error } = await supabase
    .from('orders')
    .insert({
      tunnel_id: tunnelId,
      user_id: userId,
      buyer_name: buyerName,
      buyer_email: buyerEmail,
      buyer_phone: buyerPhone,
      buyer_country: buyerCountry,
      amount,
      currency,
      payment_method: paymentMethod,
      payment_status: 'pending',
      payment_ref: paymentRef
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Confirmer le paiement (appelé par webhook ou après confirmation manuelle)
export async function confirmPayment(orderId) {
  const { data, error } = await supabase
    .from('orders')
    .update({ payment_status: 'paid', paid_at: new Date().toISOString() })
    .eq('id', orderId)
    .select()
    .single();
  if (error) throw error;

  // Mettre à jour les stats du tunnel
  if (data.tunnel_id) {
    const tunnel = await getTunnel(data.tunnel_id);
    await updateTunnel(data.tunnel_id, {
      orders:  (tunnel.orders  || 0) + 1,
      revenue: (tunnel.revenue || 0) + data.amount
    });
  }

  return data;
}

// Récupérer les commandes d'un vendeur
export async function getOrders(userId, limit = 50) {
  const { data, error } = await supabase
    .from('orders')
    .select(`
      *,
      tunnels ( name, slug )
    `)
    .eq('user_id', userId)
    .eq('payment_status', 'paid')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

// Stats revenus ce mois
export async function getMonthlyRevenue(userId) {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from('orders')
    .select('amount')
    .eq('user_id', userId)
    .eq('payment_status', 'paid')
    .gte('created_at', startOfMonth.toISOString());

  if (error) throw error;
  return data.reduce((sum, o) => sum + (o.amount || 0), 0);
}


// ══════════════════════════════════════════════
//  CONTACTS
// ══════════════════════════════════════════════

// Ajouter un contact (depuis formulaire tunnel)
export async function addContact({ userId, tunnelId, name, email, phone, country = 'CI' }) {
  const { data, error } = await supabase
    .from('contacts')
    .upsert(
      { user_id: userId, tunnel_id: tunnelId, name, email, phone, country },
      { onConflict: 'user_id,email', ignoreDuplicates: false }
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Récupérer tous les contacts d'un vendeur
export async function getContacts(userId, limit = 100) {
  const { data, error } = await supabase
    .from('contacts')
    .select('*')
    .eq('user_id', userId)
    .eq('subscribed', true)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

// Désabonner un contact
export async function unsubscribeContact(contactId) {
  const { error } = await supabase
    .from('contacts')
    .update({ subscribed: false })
    .eq('id', contactId);
  if (error) throw error;
}


// ══════════════════════════════════════════════
//  DASHBOARD STATS
// ══════════════════════════════════════════════

export async function getDashboardStats(userId) {
  // Stats globales via la vue
  const { data: stats, error: statsError } = await supabase
    .from('dashboard_stats')
    .select('*')
    .eq('user_id', userId)
    .single();

  // Revenus du mois en cours
  const monthlyRevenue = await getMonthlyRevenue(userId);

  // Dernières commandes
  const { data: recentOrders } = await supabase
    .from('orders')
    .select('*, tunnels(name)')
    .eq('user_id', userId)
    .eq('payment_status', 'paid')
    .order('created_at', { ascending: false })
    .limit(5);

  return {
    ...stats,
    monthly_revenue: monthlyRevenue,
    recent_orders: recentOrders || []
  };
}


// ══════════════════════════════════════════════
//  EXEMPLES D'UTILISATION DANS LES PAGES HTML
// ══════════════════════════════════════════════

/*

── DASHBOARD (funnelafrica-dashboard.html) ──

  const user = await requireAuth();
  const stats = await getDashboardStats(user.id);
  const tunnels = await getTunnels(user.id);

  document.querySelector('.stat-revenue').textContent =
    stats.monthly_revenue.toLocaleString('fr') + ' FCFA';


── PAGE PUBLIQUE (funnelafrica-tunnel-public.html) ──

  const slug = window.location.pathname.split('/').pop();
  const tunnel = await getTunnelBySlug(slug);
  await incrementViews(tunnel.id);

  document.querySelector('.price-main').textContent =
    tunnel.price.toLocaleString('fr');


── CHECKOUT (funnelafrica-checkout.html) ──

  const order = await createOrder({
    tunnelId: tunnel.id,
    buyerName: 'Moussa Koné',
    buyerEmail: 'moussa@gmail.com',
    buyerPhone: '+22507000000',
    amount: tunnel.price,
    currency: tunnel.currency,
    paymentMethod: 'wave'
  });

  // Après confirmation paiement :
  await confirmPayment(order.id);
  await addContact({
    userId: tunnel.user_id,
    tunnelId: tunnel.id,
    name: order.buyer_name,
    email: order.buyer_email,
    phone: order.buyer_phone
  });


── AUTH (funnelafrica-auth.html) ──

  // Inscription
  await signUp(email, password, fullName, selectedPlan);

  // Connexion
  await signIn(email, password);

  // Après connexion → rediriger
  window.location.href = '/funnelafrica-dashboard.html';


── ÉDITEUR (funnelafrica-editor.html) ──

  // Sauvegarder la config des blocs
  await updateTunnel(tunnelId, {
    name: document.getElementById('tunnelName').value,
    price: parseInt(document.getElementById('inp-price').value),
    page_config: {
      hero: {
        title: document.getElementById('inp-h1').value,
        subtitle: document.getElementById('inp-subtitle').value,
        cta: document.getElementById('inp-cta').value,
      }
    }
  });

  // Publier
  await publishTunnel(tunnelId);

*/
