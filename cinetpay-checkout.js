// ============================================================
//  INTÉGRATION CINETPAY DANS funnelafrica-checkout.html
//  Remplace la fonction processPayment() existante par celle-ci
// ============================================================


// ── FONCTION PRINCIPALE ──
async function processPayment() {

  // 1. Valider le formulaire
  if (!validateForm()) {
    document.querySelector('.card').scrollIntoView({ behavior: 'smooth' });
    return;
  }

  // 2. Récupérer les données du formulaire
  const firstName  = document.getElementById('firstName').value.trim();
  const lastName   = document.getElementById('lastName').value.trim();
  const email      = document.getElementById('email').value.trim();
  const phone      = document.getElementById('countryCode').value + document.getElementById('phone').value.trim();
  const methodEl   = document.querySelector('.method-option.selected');
  const method     = methodEl?.dataset.method || 'cinetpay';

  // 3. Récupérer les infos du tunnel depuis l'URL
  //    Ex: checkout.html?tunnel=formation-excel
  const params     = new URLSearchParams(window.location.search);
  const tunnelSlug = params.get('tunnel') || 'demo';

  // 4. Générer un order_id unique
  const orderId = 'FA-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();

  // 5. Afficher le spinner
  setLoadingState(true);

  try {

    // ── ÉTAPE A : Créer la commande dans Supabase ──
    // (importe supabase-queries.js dans ton HTML)
    /*
    const order = await createOrder({
      tunnelId:     tunnelData.id,
      buyerName:    `${firstName} ${lastName}`,
      buyerEmail:   email,
      buyerPhone:   phone,
      amount:       tunnelData.price,
      currency:     tunnelData.currency,
      paymentMethod: method
    });
    const orderId = order.payment_ref;
    */

    // ── ÉTAPE B : Initier le paiement CinetPay ──
    const response = await fetch('/api/payment/initiate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount:      9900,              // ← remplace par tunnelData.price
        currency:    'XOF',            // XOF = FCFA
        buyer_name:  `${firstName} ${lastName}`,
        buyer_email: email,
        buyer_phone: phone,
        order_id:    orderId,
        tunnel_slug: tunnelSlug,
        description: 'Accès Formation Excel Avancé' // ← remplace par tunnelData.name
      })
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Erreur lors de l\'initialisation du paiement');
    }

    // ── ÉTAPE C : Rediriger vers la page de paiement CinetPay ──
    // CinetPay gère Wave, Orange Money, MTN MoMo, carte bancaire
    // L'acheteur est redirigé automatiquement vers return_url après paiement
    window.location.href = data.payment_url;

  } catch (err) {
    console.error('Payment error:', err);
    showError(err.message || 'Une erreur est survenue. Réessayez.');
    setLoadingState(false);
  }
}


// ── HELPERS UI ──

function setLoadingState(loading) {
  const btn     = document.getElementById('submitBtn');
  const text    = document.getElementById('btnText');
  const spinner = document.getElementById('spinner');

  btn.disabled          = loading;
  spinner.style.display = loading ? 'block' : 'none';
  text.textContent      = loading
    ? 'Redirection vers le paiement...'
    : '🔒 Payer maintenant';
}

function showError(msg) {
  // Crée ou met à jour un bloc d'erreur visible
  let el = document.getElementById('paymentError');
  if (!el) {
    el = document.createElement('div');
    el.id = 'paymentError';
    el.style.cssText = `
      background:#ff4d6d18;border:1px solid #ff4d6d40;color:#ff4d6d;
      padding:12px 16px;border-radius:10px;font-size:.82rem;
      margin-top:14px;display:flex;gap:8px;align-items:center;
    `;
    document.getElementById('submitBtn').after(el);
  }
  el.innerHTML = `<span>✕</span> ${msg}`;
  el.style.display = 'flex';
  setTimeout(() => { el.style.display = 'none'; }, 6000);
}


// ── PAGE MERCI (merci.html) ──
// À mettre dans merci.html pour vérifier le paiement après retour CinetPay

async function checkReturnFromCinetPay() {
  const params  = new URLSearchParams(window.location.search);
  const orderId = params.get('order');

  if (!orderId) return;

  // Le webhook a déjà confirmé le paiement côté serveur
  // Ici on affiche juste la confirmation à l'acheteur
  document.getElementById('orderRef').textContent  = orderId;
  document.getElementById('successModal').style.display = 'flex';

  // (Optionnel) vérifier le statut dans Supabase
  /*
  const { data } = await supabase
    .from('orders')
    .select('payment_status, buyer_name, amount, currency')
    .eq('payment_ref', orderId)
    .single();

  if (data?.payment_status === 'paid') {
    showSuccess(data);
  }
  */
}

// Appeler au chargement de merci.html :
// document.addEventListener('DOMContentLoaded', checkReturnFromCinetPay);
