// ============================================================
//  chat-widget.js — Chat support intégré FunnelAfrica
//  À inclure dans toutes les pages vendeur :
//  <script src="/chat-widget.js"></script>
//  Utilise Groq IA pour réponses automatiques
// ============================================================
(function() {
  if (document.getElementById('fa-chat-widget')) return;

  var CSS = `
    #fa-chat-btn{position:fixed;bottom:80px;right:20px;z-index:1000;width:48px;height:48px;border-radius:50%;background:linear-gradient(135deg,#00c896,#00a87a);color:#0a0f14;border:none;cursor:pointer;font-size:1.3rem;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 16px #00c89640;transition:all .2s;touch-action:manipulation;}
    #fa-chat-btn:hover{transform:scale(1.08);}
    #fa-chat-box{position:fixed;bottom:140px;right:16px;z-index:1001;width:320px;max-width:calc(100vw - 32px);background:#111820;border:1px solid #1e2a38;border-radius:16px;box-shadow:0 16px 48px #00000080;display:none;flex-direction:column;overflow:hidden;max-height:480px;}
    #fa-chat-box.open{display:flex;}
    .fa-chat-header{background:linear-gradient(135deg,#0d2010,#0a1a18);padding:14px 16px;display:flex;align-items:center;gap:10px;border-bottom:1px solid #1e2a38;}
    .fa-chat-avatar{width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#00c896,#00a87a);color:#0a0f14;font-weight:800;font-size:.8rem;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
    .fa-chat-info{flex:1;}
    .fa-chat-name{font-family:Syne,sans-serif;font-weight:700;font-size:.85rem;color:#e8f0f8;}
    .fa-chat-status{font-size:.68rem;color:#00c896;}
    .fa-chat-close{background:none;border:none;color:#6b7e93;cursor:pointer;font-size:1.1rem;padding:2px;touch-action:manipulation;}
    .fa-chat-messages{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px;}
    .fa-msg{max-width:80%;padding:10px 13px;border-radius:12px;font-size:.82rem;line-height:1.5;}
    .fa-msg.bot{background:#182030;border:1px solid #1e2a38;color:#e8f0f8;align-self:flex-start;border-bottom-left-radius:4px;}
    .fa-msg.user{background:linear-gradient(135deg,#00c896,#00a87a);color:#0a0f14;align-self:flex-end;font-weight:500;border-bottom-right-radius:4px;}
    .fa-msg.typing{background:#182030;border:1px solid #1e2a38;color:#6b7e93;align-self:flex-start;}
    .fa-chat-input{display:flex;gap:8px;padding:12px;border-top:1px solid #1e2a38;}
    .fa-chat-input input{flex:1;background:#182030;border:1px solid #1e2a38;border-radius:8px;padding:9px 12px;color:#e8f0f8;font-size:.82rem;outline:none;font-family:DM Sans,sans-serif;}
    .fa-chat-input input:focus{border-color:#00c896;}
    .fa-chat-send{background:#00c896;color:#0a0f14;border:none;border-radius:8px;width:36px;height:36px;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:1rem;flex-shrink:0;touch-action:manipulation;}
    .fa-quick-btns{display:flex;gap:6px;flex-wrap:wrap;padding:0 14px 10px;}
    .fa-quick{background:#182030;border:1px solid #1e2a38;color:#6b7e93;font-size:.68rem;padding:5px 10px;border-radius:20px;cursor:pointer;touch-action:manipulation;transition:all .2s;}
    .fa-quick:hover{border-color:#00c896;color:#00c896;}
  `;

  var style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  var html = `
    <div id="fa-chat-widget">
      <button id="fa-chat-btn" onclick="faChat.toggle()" title="Support FunnelAfrica">💬</button>
      <div id="fa-chat-box">
        <div class="fa-chat-header">
          <div class="fa-chat-avatar">FA</div>
          <div class="fa-chat-info">
            <div class="fa-chat-name">Support FunnelAfrica</div>
            <div class="fa-chat-status">● En ligne · Réponse rapide</div>
          </div>
          <button class="fa-chat-close" onclick="faChat.toggle()">✕</button>
        </div>
        <div class="fa-chat-messages" id="faChatMessages">
          <div class="fa-msg bot">👋 Bonjour ! Je suis l'assistant FunnelAfrica. Comment puis-je t'aider ?</div>
        </div>
        <div class="fa-quick-btns" id="faQuickBtns">
          <button class="fa-quick" onclick="faChat.quick('Comment créer un tunnel ?')">Créer un tunnel</button>
          <button class="fa-quick" onclick="faChat.quick('Comment recevoir un paiement ?')">Paiements</button>
          <button class="fa-quick" onclick="faChat.quick('Comment retirer mon argent ?')">Retrait</button>
          <button class="fa-quick" onclick="faChat.quick('Comment partager mon tunnel ?')">Partager</button>
        </div>
        <div class="fa-chat-input">
          <input id="faChatInput" placeholder="Pose ta question..." onkeydown="if(event.key==='Enter')faChat.send()">
          <button class="fa-chat-send" onclick="faChat.send()">➤</button>
        </div>
      </div>
    </div>
  `;

  var div = document.createElement('div');
  div.innerHTML = html;
  document.body.appendChild(div);

  var GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
  var SYSTEM_PROMPT = `Tu es l'assistant support de FunnelAfrica, une plateforme africaine de vente en ligne. 
Réponds en français simple et concis (2-3 phrases max). 
Sois utile, amical et adapté au contexte africain.
Points clés: Gratuit pour les vendeurs · 15% commission sur les ventes · Wave/MTN/Orange Money · Retrait dès 5000 FCFA.
Si la question dépasse ton niveau, redirige vers: WhatsApp +22996830775 ou kessahoud@gmail.com`;

  window.faChat = {
    open: false,
    history: [],

    toggle: function() {
      this.open = !this.open;
      var box = document.getElementById('fa-chat-box');
      this.open ? box.classList.add('open') : box.classList.remove('open');
      if (this.open) document.getElementById('faChatInput').focus();
    },

    quick: function(msg) {
      document.getElementById('faQuickBtns').style.display = 'none';
      this.sendMessage(msg);
    },

    send: function() {
      var input = document.getElementById('faChatInput');
      var msg = input.value.trim();
      if (!msg) return;
      input.value = '';
      this.sendMessage(msg);
    },

    sendMessage: function(msg) {
      this.addMessage(msg, 'user');
      this.history.push({ role: 'user', content: msg });
      this.showTyping();

      // Appel Groq via l'API FunnelAfrica (pour ne pas exposer la clé)
      var APP_URL = window.location.origin;
      fetch(APP_URL + '/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: msg,
          history: this.history.slice(-6)
        })
      })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        faChat.removeTyping();
        var reply = data.reply || data.error || 'Je n\'ai pas pu répondre. Contacte-nous sur WhatsApp: +22996830775';
        faChat.addMessage(reply, 'bot');
        faChat.history.push({ role: 'assistant', content: reply });
      })
      .catch(function() {
        faChat.removeTyping();
        faChat.addMessage('Une erreur est survenue. Contacte-nous sur WhatsApp: +22996830775 ou par email: kessahoud@gmail.com', 'bot');
      });
    },

    addMessage: function(text, type) {
      var msgs = document.getElementById('faChatMessages');
      var div = document.createElement('div');
      div.className = 'fa-msg ' + type;
      div.textContent = text;
      msgs.appendChild(div);
      msgs.scrollTop = msgs.scrollHeight;
    },

    showTyping: function() {
      var msgs = document.getElementById('faChatMessages');
      var div = document.createElement('div');
      div.className = 'fa-msg typing';
      div.id = 'faChatTyping';
      div.textContent = '...';
      msgs.appendChild(div);
      msgs.scrollTop = msgs.scrollHeight;
    },

    removeTyping: function() {
      var t = document.getElementById('faChatTyping');
      if (t) t.remove();
    }
  };
})();
