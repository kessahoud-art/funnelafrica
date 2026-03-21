// ============================================================
//  INTÉGRATION FEDAPAY dans funnelafrica-checkout.html
//  Remplace la fonction processPayment() existante
// ============================================================

async function processPayment() {

  if (!validateForm() || !tunnelData) return;

  const firstName = document.getElementById('firstName').value.trim();
  const lastName  = document.getElementById('lastName').value.trim();
  const email     = document.getElementById('email').value.trim();
  const phone     = document.getElementById('countryCode').value
                  + document.getElementById('phone').value.trim();

  // Générer un order_id unique
  const orderId = 'FA-' + Date.now() + '-' +
    Math.random().toString(36).substring(2, 6).toUpperCase();

  setLoadingState(true);

  try {
    // ── Étape 1 : Créer la commande dans Supabase ──
    const { error: orderError } = await sb.from('orders').insert({
      tunnel_id:      tunnelData.id,
      user_id:        tunnelData.user_id,
      buyer_name:     `${firstName} ${lastName}`,
      buyer_email:    email,
      buyer_phone:    phone,
      buyer_country:  'BJ',
      amount:         tunnelData.price,
      currency:       tunnelData.currency || 'XOF',
      payment_method: 'fedapay',
      payment_status: 'pending',
      payment_ref:    orderId
    });

    if (orderError) throw new Error('Erreur création commande');

    // ── Étape 2 : Initier le paiement FedaPay ──
    const response = await fetch('/api/payment/initiate', {
      method:  'POST',
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

    const data = await response.json();

    if (!data.success) throw new Error(data.error || 'Erreur paiement');

    // ── Étape 3 : Rediriger vers FedaPay ──
    window.location.href = data.payment_url;

  } catch (err) {
    console.error('Payment error:', err);
    showError(err.message || 'Une erreur est survenue. Réessayez.');
    setLoadingState(false);
  }
}

function setLoadingState(loading) {
  const btn     = document.getElementById('submitBtn');
  const text    = document.getElementById('btnText');
  const spinner = document.getElementById('spinner');
  btn.disabled          = loading;
  spinner.style.display = loading ? 'block' : 'none';
  text.textContent      = loading
    ? '⏳ Redirection vers le paiement...'
    : '🔒 Payer maintenant';
}

function showError(msg) {
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
