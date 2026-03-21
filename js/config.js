// ============================================================
//  js/config.js — Configuration globale FunnelAfrica
//  Importé dans TOUTES les pages HTML
//  <script type="module" src="/js/config.js"></script>
// ============================================================

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// ── SUPABASE ──
export const SUPABASE_URL      = 'https://crfmdpvxiabwlhgrwcro.supabase.';
export const SUPABASE_ANON_KEY = 'VOTRE_ANON_KEY';
export const supabase          = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── APP CONFIG ──
export const APP_URL            = 'https://funnelafrica.vercel.app';
export const WHATSAPP_SUPPORT   = 'https://wa.me/VOTRE_NUMERO';
export const WHATSAPP_GROUP     = 'https://chat.whatsapp.com/VOTRE_LIEN_GROUPE';

// ── PAGES ──
export const PAGES = {
  dashboard : '/funnelafrica-dashboard.html',
  auth      : '/funnelafrica-auth.html',
  editor    : '/funnelafrica-editor.html',
  checkout  : '/funnelafrica-checkout.html',
  merci     : '/merci.html',
  membre    : '/espace-membre.html'
};

// ── AUTH HELPERS ──

// Récupérer l'utilisateur connecté
export async function getUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

// Protéger une page vendeur — redirige si non connecté
export async function requireAuth() {
  const user = await getUser();
  if (!user) {
    window.location.href = PAGES.auth;
    return null;
  }
  return user;
}

// Récupérer le profil complet du vendeur
export async function getProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (error) throw error;
  return data;
}

// ── UTILS ──

// Formater un montant FCFA
export function formatAmount(amount, currency = 'FCFA') {
  return (amount || 0).toLocaleString('fr') + ' ' + currency;
}

// Formater une date
export function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'short', year: 'numeric'
  });
}

// Générer un slug depuis un texte
export function slugify(text) {
  return text
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    + '-' + Date.now().toString(36);
}

// Afficher une alerte toast
export function showToast(msg, type = 'success') {
  const colors = {
    success: { bg: '#00c89618', border: '#00c89640', color: '#00c896' },
    error:   { bg: '#ff4d6d18', border: '#ff4d6d40', color: '#ff4d6d' },
    info:    { bg: '#4da6ff18', border: '#4da6ff40', color: '#4da6ff' }
  };
  const c = colors[type] || colors.info;

  let toast = document.getElementById('__toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = '__toast';
    toast.style.cssText = `
      position:fixed;bottom:24px;right:24px;z-index:9999;
      padding:12px 18px;border-radius:10px;font-size:.83rem;
      font-family:'DM Sans',sans-serif;font-weight:500;
      max-width:320px;box-shadow:0 8px 24px #00000040;
      transition:all .3s;opacity:0;transform:translateY(10px);
    `;
    document.body.appendChild(toast);
  }

  toast.style.background = c.bg;
  toast.style.border      = `1px solid ${c.border}`;
  toast.style.color       = c.color;
  toast.textContent       = msg;

  setTimeout(() => { toast.style.opacity = '1'; toast.style.transform = 'translateY(0)'; }, 10);
  setTimeout(() => { toast.style.opacity = '0'; toast.style.transform = 'translateY(10px)'; }, 3500);
}
