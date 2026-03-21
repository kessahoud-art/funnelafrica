// ============================================================
//  js/pages.js
//  Code Supabase à coller dans chaque page HTML
//  Ajoute <script type="module" src="/js/pages.js"></script>
//  OU colle le bloc correspondant directement dans la page
// ============================================================


// ════════════════════════════════════════════════════════════
//  1. funnelafrica-auth.html
//  Colle ce bloc dans le <script> de auth.html
// ════════════════════════════════════════════════════════════
/*

import { supabase, PAGES, showToast } from '/js/config.js';

// ── INSCRIPTION ──
async function handleRegister() {
  const name  = document.getElementById('regName').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const pass  = document.getElementById('regPassword').value;

  if (!name || !email || pass.length < 8) {
    showToast('Remplissez tous les champs correctement', 'error');
    return;
  }

  setLoading('regBtn', 'regSpinner', 'regBtnText', true);

  const { error } = await supabase.auth.signUp({
    email, password: pass,
    options: { data: { full_name: name, plan: selectedPlan } }
  });

  if (error) {
    showToast(error.message === 'User already registered'
      ? 'Un compte existe déjà avec cet email.'
      : error.message, 'error');
  } else {
    showToast('✓ Compte créé ! Vérifiez votre email.', 'success');
  }

  setLoading('regBtn', 'regSpinner', 'regBtnText', false, 'Créer mon compte');
}

// ── CONNEXION ──
async function handleLogin() {
  const email = document.getElementById('loginEmail').value.trim();
  const pass  = document.getElementById('loginPassword').value;

  if (!email || !pass) {
    showToast('Email et mot de passe requis', 'error');
    return;
  }

  setLoading('loginBtn', 'loginSpinner', 'loginBtnText', true);

  const { error } = await supabase.auth.signInWithPassword({ email, password: pass });

  if (error) {
    showToast('Email ou mot de passe incorrect', 'error');
    setLoading('loginBtn', 'loginSpinner', 'loginBtnText', false, 'Se connecter');
  } else {
    showToast('✓ Connexion réussie !', 'success');
    setTimeout(() => window.location.href = PAGES.dashboard, 1000);
  }
}

// ── GOOGLE AUTH ──
async function handleGoogle() {
  await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin + PAGES.dashboard }
  });
}

// ── MOT DE PASSE OUBLIÉ ──
async function handleForgot() {
  const email = document.getElementById('forgotEmail').value.trim();
  if (!email) return;

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + '/reset-password.html'
  });

  showToast(error
    ? 'Erreur, vérifiez votre email'
    : `Lien envoyé à ${email}`,
    error ? 'error' : 'success'
  );
}

// Si déjà connecté → rediriger vers dashboard
supabase.auth.getUser().then(({ data: { user } }) => {
  if (user) window.location.href = PAGES.dashboard;
});

*/


// ════════════════════════════════════════════════════════════
//  2. funnelafrica-dashboard.html
//  Colle ce bloc dans le <script> de dashboard.html
// ════════════════════════════════════════════════════════════
/*

import { supabase, requireAuth, getProfile, formatAmount, formatDate, showToast, PAGES } from '/js/config.js';

let currentUser = null;

document.addEventListener('DOMContentLoaded', async () => {
  currentUser = await requireAuth();
  if (!currentUser) return;

  await Promise.all([
    loadProfile(),
    loadStats(),
    loadTunnels(),
    loadRecentOrders()
  ]);
});

// Charger le profil vendeur
async function loadProfile() {
  const profile = await getProfile(currentUser.id);
  document.querySelector('.user-name').textContent = profile.full_name || 'Vendeur';
  document.querySelector('.user-plan').textContent = `Plan ${profile.plan} · Actif`;

  // Initiales avatar
  const initials = (profile.full_name || 'U')
    .split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
  document.querySelector('.avatar').textContent = initials;
}

// Charger les stats
async function loadStats() {
  // Revenus ce mois
  const startOfMonth = new Date();
  startOfMonth.setDate(1); startOfMonth.setHours(0,0,0,0);

  const { data: orders } = await supabase
    .from('orders')
    .select('amount')
    .eq('user_id', currentUser.id)
    .eq('payment_status', 'paid')
    .gte('created_at', startOfMonth.toISOString());

  const revenue = (orders || []).reduce((s, o) => s + o.amount, 0);
  document.querySelector('.stat-revenue').textContent = formatAmount(revenue);

  // Commandes ce mois
  document.querySelector('.stat-orders').textContent = (orders || []).length;

  // Total vues tunnels
  const { data: tunnels } = await supabase
    .from('tunnels')
    .select('views, orders')
    .eq('user_id', currentUser.id);

  const totalViews = (tunnels || []).reduce((s, t) => s + (t.views || 0), 0);
  document.querySelector('.stat-views').textContent =
    totalViews > 999 ? (totalViews/1000).toFixed(1) + 'K' : totalViews;

  // Taux de conversion moyen
  const totalOrders = (tunnels || []).reduce((s, t) => s + (t.orders || 0), 0);
  const conv = totalViews > 0 ? ((totalOrders / totalViews) * 100).toFixed(1) : '0';
  document.querySelector('.stat-conv').textContent = conv + '%';
}

// Charger les tunnels
async function loadTunnels() {
  const { data: tunnels, error } = await supabase
    .from('tunnels')
    .select('*')
    .eq('user_id', currentUser.id)
    .order('created_at', { ascending: false })
    .limit(5);

  if (error || !tunnels?.length) return;

  const list = document.querySelector('.tunnels-list');
  if (!list) return;

  list.innerHTML = tunnels.map(t => `
    <div class="tunnel-item" onclick="openEditor('${t.id}')">
      <div class="tunnel-icon">📘</div>
      <div class="tunnel-info">
        <div class="tunnel-name">${t.name}</div>
        <div class="tunnel-meta">
          <span><span class="status-dot ${t.status === 'live' ? '' : 'off'}"></span>${t.status === 'live' ? 'Actif' : 'Brouillon'}</span>
          <span>${t.views || 0} vues</span>
        </div>
      </div>
      <div class="tunnel-stats">
        <div class="tunnel-revenue">${formatAmount(t.revenue || 0)}</div>
        <div class="tunnel-conv">Conv. ${t.views > 0 ? ((t.orders/t.views)*100).toFixed(1) : '0'}%</div>
      </div>
    </div>
  `).join('');
}

// Charger les dernières commandes
async function loadRecentOrders() {
  const { data: orders } = await supabase
    .from('orders')
    .select('*, tunnels(name)')
    .eq('user_id', currentUser.id)
    .eq('payment_status', 'paid')
    .order('created_at', { ascending: false })
    .limit(5);

  if (!orders?.length) return;

  const methods = {
    wave: '📱 Wave', orange: '📱 Orange Money',
    mtn: '📱 MTN MoMo', cinetpay: '💳 CinetPay', card: '💳 Carte'
  };

  const feed = document.querySelector('.orders-feed');
  if (!feed) return;

  feed.innerHTML = orders.map(o => {
    const initials = o.buyer_name.split(' ').map(n=>n[0]).join('').toUpperCase().substring(0,2);
    return `
      <div class="order-item">
        <div class="order-avatar">${initials}</div>
        <div class="order-info">
          <div class="order-name">${o.buyer_name}</div>
          <div class="order-product">${o.tunnels?.name || '—'} · ${formatDate(o.created_at)}</div>
        </div>
        <div>
          <div class="order-amount">${formatAmount(o.amount, o.currency)}</div>
          <div class="order-method">${methods[o.payment_method] || o.payment_method}</div>
        </div>
      </div>
    `;
  }).join('');
}

// Ouvrir l'éditeur d'un tunnel
function openEditor(tunnelId) {
  window.location.href = `${PAGES.editor}?tunnel=${tunnelId}`;
}

// Créer un nouveau tunnel
async function createNewTunnel(name, template, price) {
  const slug = name.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,'')
    + '-' + Date.now().toString(36);

  const { data, error } = await supabase
    .from('tunnels')
    .insert({
      user_id: currentUser.id,
      name, slug, template,
      price: parseInt(price) || 0
    })
    .select().single();

  if (error) { showToast('Erreur création tunnel', 'error'); return; }

  showToast('✓ Tunnel créé !', 'success');
  setTimeout(() => openEditor(data.id), 800);
}

// Déconnexion
async function logout() {
  await supabase.auth.signOut();
  window.location.href = PAGES.auth;
}

*/


// ════════════════════════════════════════════════════════════
//  3. funnelafrica-editor.html
//  Colle ce bloc dans le <script> de editor.html
// ════════════════════════════════════════════════════════════
/*

import { supabase, requireAuth, showToast, PAGES } from '/js/config.js';

let currentUser = null;
let currentTunnel = null;
const tunnelId = new URLSearchParams(window.location.search).get('tunnel');

document.addEventListener('DOMContentLoaded', async () => {
  currentUser = await requireAuth();
  if (!currentUser || !tunnelId) return;
  await loadTunnel();
});

async function loadTunnel() {
  const { data, error } = await supabase
    .from('tunnels')
    .select('*')
    .eq('id', tunnelId)
    .eq('user_id', currentUser.id)  // sécurité : seul le propriétaire
    .single();

  if (error) {
    showToast('Tunnel introuvable', 'error');
    setTimeout(() => window.location.href = PAGES.dashboard, 1500);
    return;
  }

  currentTunnel = data;

  // Remplir l'éditeur
  document.getElementById('tunnelName').value          = data.name;
  document.getElementById('inp-price').value           = data.price;
  document.getElementById('inp-h1').value              = data.page_config?.hero?.title || '';
  document.getElementById('inp-subtitle').value        = data.page_config?.hero?.subtitle || '';
  document.getElementById('inp-cta').value             = data.page_config?.hero?.cta || '';

  // Statut
  const pill = document.getElementById('statusPill');
  if (data.status === 'live') {
    pill.className = 'status-pill live';
    pill.innerHTML = '<div class="status-dot"></div> En ligne';
  }
}

async function saveDraft() {
  const { error } = await supabase
    .from('tunnels')
    .update({
      name:  document.getElementById('tunnelName').value,
      price: parseInt(document.getElementById('inp-price').value) || 0,
      page_config: {
        hero: {
          title:    document.getElementById('inp-h1').value,
          subtitle: document.getElementById('inp-subtitle').value,
          cta:      document.getElementById('inp-cta').value,
          badge:    document.getElementById('inp-badge').value
        }
      }
    })
    .eq('id', tunnelId);

  if (error) {
    showToast('Erreur sauvegarde', 'error');
  } else {
    showToast('✓ Sauvegardé', 'success');
  }
}

async function confirmPublish() {
  const { error } = await supabase
    .from('tunnels')
    .update({ status: 'live' })
    .eq('id', tunnelId);

  if (error) { showToast('Erreur publication', 'error'); return; }

  showToast('🚀 Tunnel publié !', 'success');
  document.getElementById('statusPill').className = 'status-pill live';
  document.getElementById('statusPill').innerHTML = '<div class="status-dot"></div> En ligne';
  closePublish();
}

*/


// ════════════════════════════════════════════════════════════
//  4. funnelafrica-tunnel-public.html
//  Colle ce bloc dans le <script> de tunnel-public.html
// ════════════════════════════════════════════════════════════
/*

import { supabase, formatAmount } from '/js/config.js';

let tunnelData = null;

document.addEventListener('DOMContentLoaded', async () => {
  // Récupérer le slug depuis l'URL : /t/formation-excel
  const slug = window.location.pathname.split('/').pop()
    || new URLSearchParams(window.location.search).get('t');

  if (!slug) return;

  const { data, error } = await supabase
    .from('tunnels')
    .select('*')
    .eq('slug', slug)
    .eq('status', 'live')
    .single();

  if (error || !data) {
    document.body.innerHTML = '<div style="text-align:center;padding:80px;color:#6b7e93;">Tunnel introuvable ou hors ligne.</div>';
    return;
  }

  tunnelData = data;

  // Remplir la page depuis la config
  const config = data.page_config?.hero || {};
  if (config.title)    document.querySelector('.hero-title').textContent   = config.title;
  if (config.subtitle) document.querySelector('.hero-sub').textContent     = config.subtitle;
  if (config.badge)    document.querySelector('.badge').textContent        = config.badge;
  if (config.cta)      document.querySelectorAll('.cta-btn, .preview-cta')
                         .forEach(el => el.textContent = config.cta);

  // Prix
  document.querySelectorAll('.price-main').forEach(el => {
    el.textContent = data.price.toLocaleString('fr');
  });

  // Incrémenter les vues
  await supabase.from('tunnels')
    .update({ views: (data.views || 0) + 1 })
    .eq('id', data.id);
});

// Rediriger vers checkout avec le slug du tunnel
function goToCheckout() {
  if (!tunnelData) return;
  window.location.href = `/funnelafrica-checkout.html?tunnel=${tunnelData.slug}`;
}

*/


// ════════════════════════════════════════════════════════════
//  5. funnelafrica-checkout.html
//  Colle ce bloc dans le <script> de checkout.html
// ════════════════════════════════════════════════════════════
/*

import { supabase, formatAmount, showToast } from '/js/config.js';

let tunnelData = null;

document.addEventListener('DOMContentLoaded', async () => {
  const slug = new URLSearchParams(window.location.search).get('tunnel');
  if (!slug) return;

  const { data } = await supabase
    .from('tunnels')
    .select('*')
    .eq('slug', slug)
    .eq('status', 'live')
    .single();

  if (!data) {
    showToast('Tunnel introuvable', 'error');
    return;
  }

  tunnelData = data;

  // Afficher le prix dans le résumé
  document.getElementById('submitBtn').querySelector('#btnText').textContent =
    `🔒 Payer ${formatAmount(data.price, data.currency)} maintenant`;

  document.querySelector('.price-total .value').textContent =
    formatAmount(data.price, data.currency);

  document.querySelector('.product-name').textContent = data.name;
});

async function processPayment() {
  if (!validateForm() || !tunnelData) return;

  const firstName = document.getElementById('firstName').value.trim();
  const lastName  = document.getElementById('lastName').value.trim();
  const email     = document.getElementById('email').value.trim();
  const phone     = document.getElementById('countryCode').value
                  + document.getElementById('phone').value.trim();
  const orderId   = 'FA-' + Date.now() + '-' + Math.random().toString(36).substring(2,6).toUpperCase();

  setLoadingState(true);

  try {
    // 1. Créer la commande dans Supabase
    await supabase.from('orders').insert({
      tunnel_id:      tunnelData.id,
      user_id:        tunnelData.user_id,
      buyer_name:     `${firstName} ${lastName}`,
      buyer_email:    email,
      buyer_phone:    phone,
      amount:         tunnelData.price,
      currency:       tunnelData.currency || 'FCFA',
      payment_method: 'cinetpay',
      payment_status: 'pending',
      payment_ref:    orderId
    });

    // 2. Initier le paiement CinetPay
    const res = await fetch('/api/payment/initiate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount:      tunnelData.price,
        currency:    'XOF',
        buyer_name:  `${firstName} ${lastName}`,
        buyer_email: email,
        buyer_phone: phone,
        order_id:    orderId,
        tunnel_slug: tunnelData.slug,
        description: tunnelData.name
      })
    });

    const data = await res.json();
    if (!data.success) throw new Error(data.error);

    // 3. Rediriger vers CinetPay
    window.location.href = data.payment_url;

  } catch (err) {
    showToast(err.message || 'Erreur paiement', 'error');
    setLoadingState(false);
  }
}

*/
