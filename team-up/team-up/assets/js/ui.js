/* ==========================================================
   Team Up — UI helpers shared by every page
   ========================================================== */
(function () {
  const TU = window.TU;

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const icon = (styleId, cls = '') => {
    const st = TU.STYLES.find(s => s.id === styleId);
    if (!st) return '';
    return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
      stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${st.icon}</svg>`;
  };

  const ui = {
    esc,
    icon,
    $: (sel, root = document) => root.querySelector(sel),
    $$: (sel, root = document) => Array.from(root.querySelectorAll(sel)),
    param: name => new URLSearchParams(location.search).get(name),

    /* The identity card: colour from interest, icon from working style */
    card({ interest, style, name = '', pin = '', size = 'lg', round }) {
      const i = TU.logic.interest(interest);
      const s = TU.logic.style(style);
      if (!i) return '';
      return `
        <article class="idcard idcard--${size}" style="--card:${i.color};--card-ink:${i.ink}"
          aria-label="${esc(i.label)} card${s ? ' with ' + esc(s.iconName) + ' icon' : ''}">
          <div class="idcard__icon">${s ? icon(s.id) : ''}</div>
          ${pin ? `<div class="idcard__pin" aria-label="PIN ${esc(pin)}">${esc(pin)}</div>` : ''}
          <div class="idcard__foot">
            ${name ? `<strong class="idcard__name">${esc(name)}</strong>` : ''}
            <span>${esc(i.label)}${s ? ' / ' + esc(s.label) : ''}</span>
            ${round ? `<span class="idcard__round">Round ${round}</span>` : ''}
          </div>
        </article>`;
    },

    /* compact badge used in lists */
    badge(s, p, round) {
      const i = TU.logic.interest(p.interest);
      const st = TU.logic.styleOf(s, p, round);
      if (!i) return `<span class="badge badge--empty" aria-label="No card yet"></span>`;
      return `<span class="badge" style="--card:${i.color};--card-ink:${i.ink}"
        title="${esc(i.label)}${st ? ' / ' + esc(TU.logic.style(st).label) : ''}">${st ? icon(st) : ''}</span>`;
    },

    fmtTime(ms) {
      const t = Math.ceil(ms / 1000);
      return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
    },

    toast(msg, kind = 'info') {
      let host = document.getElementById('toasts');
      if (!host) {
        host = document.createElement('div');
        host.id = 'toasts';
        host.setAttribute('role', 'status');
        host.setAttribute('aria-live', 'polite');
        document.body.appendChild(host);
      }
      const el = document.createElement('div');
      el.className = `toast toast--${kind}`;
      el.textContent = msg;
      host.appendChild(el);
      setTimeout(() => { el.classList.add('is-leaving'); setTimeout(() => el.remove(), 300); }, 3200);
    },

    joinUrl(code) {
      return new URL(`../student/join.html?s=${encodeURIComponent(code)}`, location.href).href;
    },

    /* QR via the bundled qrcode-generator (assets/vendor), drawn as crisp SVG */
    qr(el, text, size = 220) {
      if (!window.qrcode) {
        el.innerHTML = `<p class="muted small">QR code couldn't load. Share the link instead.</p>`;
        return;
      }
      const q = qrcode(0, 'M');
      q.addData(text);
      q.make();
      const n = q.getModuleCount();
      let d = '';
      for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
      el.innerHTML = `<svg viewBox="-2 -2 ${n + 4} ${n + 4}" width="${size}" height="${size}" role="img"
        aria-label="QR code to join" shape-rendering="crispEdges"><rect x="-2" y="-2" width="${n + 4}" height="${n + 4}" fill="#fff"/>
        <path d="${d}" fill="#2A1520"/></svg>`;
    },

    /* in-page confirm (browser confirm() is blocked in some embeds and looks rough on phones) */
    confirm(message, okLabel = 'Confirm') {
      return new Promise(resolve => {
        const d = document.createElement('dialog');
        d.className = 'confirm';
        d.innerHTML = `<p>${esc(message)}</p>
          <div class="confirm__btns">
            <button class="btn btn--ghost" value="no" type="button">Cancel</button>
            <button class="btn btn--primary" value="yes" type="button">${esc(okLabel)}</button>
          </div>`;
        document.body.appendChild(d);
        const done = v => { d.close(); d.remove(); resolve(v); };
        d.addEventListener('click', e => {
          const b = e.target.closest('button');
          if (b) done(b.value === 'yes');
          else if (e.target === d) done(false);
        });
        d.addEventListener('cancel', e => { e.preventDefault(); done(false); });
        d.showModal();
        d.querySelector('[value=yes]').focus();
      });
    },

    async copy(text) {
      try { await navigator.clipboard.writeText(text); ui.toast('Copied'); }
      catch (e) { ui.toast('Copy didn\'t work here. Select the link text instead.'); }
    },

    download(filename, text, type = 'text/csv') {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([text], { type }));
      a.download = filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    },

    syncNotice() {
      if (Store.mode() === 'local') {
        return `<p class="sync-note">Demo mode: data stays in this browser. Open students in other tabs, or connect Firebase for phones (see README).</p>`;
      }
      return '';
    }
  };

  TU.ui = ui;
})();
