/* Student — main app (one page, views change with the session phase) */
(async function () {
  const { ui, logic } = TU;
  const { $, $$, esc } = ui;
  await Store.ready();

  const code = (ui.param('s') || '').toUpperCase();
  const me = sessionStorage.getItem('teamup:me:' + code);
  if (!code || !me) { location.replace('join.html' + (code ? '?s=' + code : '')); return; }

  let S = null;
  let lastSig = '';
  let lastView = '';
  const local = { pickInterest: null, pickStyle: null, editing: null, fb: {}, busy: false };

  const view = $('#view');
  const CHOICES = [
    { id: 'yes', label: 'Keen to team up' },
    { id: 'maybe', label: 'Maybe' },
    { id: 'no', label: 'Not this time' }
  ];

  /* ---------- which screen? ---------- */
  function currentView() {
    if (!S) return 'missing';
    const p = S.participants[me];
    if (!p) return 'removed';
    const phase = logic.effectivePhase(S);
    const myTeam = S.teamsConfirmedAt && logic.teams.teamOf(S, me);
    if (phase === 'finished') return myTeam ? 'team' : 'finished';
    if (phase === 'lobby') return 'lobby';
    if (phase === 'roundEnd') {
      if (logic.groupOf(S, me) && !logic.feedbackDone(S, me)) return 'feedback';
      return myTeam ? 'team' : 'roundwait';
    }
    if (!p.interest || local.editing === 'q1') return 'q1';
    if (!logic.styleOf(S, p) || local.editing === 'q2') return 'q2';
    if (phase === 'questions') return 'ready';
    return logic.groupOf(S, me) ? 'talk' : 'match';
  }

  function signature(v) {
    const p = S && S.participants[me];
    const g = S && logic.groupOf(S, me);
    const partners = g ? g.members.map(id => { const x = S.participants[id]; return x && [x.id, x.name, x.interest, logic.styleOf(S, x)]; }) : null;
    const base = [v, S && S.round, p && p.interest, p && logic.styleOf(S, p), p && p.name];
    const extra = {
      q1: [local.pickInterest],
      q2: [local.pickStyle],
      match: [S && logic.effectivePhase(S)],
      talk: [partners, g && g.prompts, S && S.phase, S && S.roundEndsAt,
        S && logic.incomingFor(S, me).length > 0],
      feedback: [partners, local.fb, local.busy],
      roundwait: [!!g],
      finished: [S && S.groups],
      team: [S && S.teams, S && S.teamsConfirmedAt, S && S.participants]
    }[v] || [];
    return JSON.stringify(base.concat(extra));
  }

  /* ---------- render ---------- */
  function render() {
    renderTop();
    const v = currentView();
    const sig = signature(v);
    if (sig === lastSig) { renderPairStatus(); return; }
    lastSig = sig;
    const p = S && S.participants[me];
    view.innerHTML = VIEWS[v](p);
    view.dataset.view = v;

    if (v === 'talk' && (lastView === 'match' || lastView === 'ready')) {
      view.classList.add('is-matched');
      if (navigator.vibrate) navigator.vibrate(80);
      setTimeout(() => view.classList.remove('is-matched'), 900);
    }
    if (v !== lastView) window.scrollTo({ top: 0 });
    lastView = v;
    renderPairStatus(true);
    tick();
    if (v === 'match') $('#pin')?.focus({ preventScroll: true });
  }

  function renderTop() {
    const p = S && S.participants[me];
    $('#topSession').innerHTML = S
      ? `<strong>${esc(S.course)}</strong><span>${S.phase === 'finished' ? 'Finished' : 'Round ' + S.round}</span>`
      : '';
    $('#topPin').hidden = !p;
    if (p) $('#topPinValue').textContent = p.pin;
  }

  const cardFor = (p, size = 'lg', opts = {}) =>
    ui.card({ interest: p.interest, style: logic.styleOf(S, p, opts.round), name: opts.noName ? '' : p.name, pin: opts.pin ? p.pin : '', size });

  /* ---------- pair box: shown on every screen before you're paired ----------
     mode: 'locked' (visible but not usable yet), 'open', or 'join' (let a third person in) */
  function pairBox(mode, lockedMsg = '') {
    const p = S.participants[me];
    const locked = mode === 'locked';
    const title = mode === 'join' ? 'Someone wants to join you' : 'Pair up with someone';
    const help = locked ? lockedMsg
      : mode === 'join' ? 'Enter their PIN to let them into your conversation.'
      : "Type their PIN, and they type yours. Once you've both done it, your conversation starts.";
    return `
      <section class="pairbox${locked ? ' is-locked' : ''}" aria-labelledby="pairTitle">
        <h2 id="pairTitle"><label for="pin">${title}</label></h2>
        <p class="small muted">${help}</p>
        <div id="pairStatus" aria-live="polite"></div>
        <form class="pinform" id="pinForm" novalidate>
          <input class="pin-input" id="pin" inputmode="numeric" pattern="[0-9]*" maxlength="4" autocomplete="off"
            placeholder="0000" aria-describedby="pinError" ${locked ? 'disabled' : ''}>
          <p class="error" id="pinError" role="alert"></p>
          <button class="btn btn--primary btn--block" type="submit" ${locked ? 'disabled' : ''}>${mode === 'join' ? 'Let them in' : 'Enter PIN'}</button>
        </form>
        <p class="pairbox__mine">Your PIN for them to enter <strong>${esc(p.pin)}</strong></p>
      </section>`;
  }

  let lastPairSig = null;
  function renderPairStatus(force) {
    const el = $('#pairStatus');
    if (!el || !S) return;
    const out = logic.requestOf(S, me);
    const inc = logic.incomingFor(S, me);
    const outGroup = out && logic.groupOf(S, out.to);
    const sig = JSON.stringify([out && out.to, !!outGroup, inc.map(r => r.from)]);
    if (!force && sig === lastPairSig) return;
    lastPairSig = sig;
    const name = id => esc(S.participants[id].name);
    let html = '';
    if (out) {
      html += `
        <div class="pairnote pairnote--out">
          <p><strong>You entered ${name(out.to)}'s PIN.</strong> Waiting for ${name(out.to)} to enter yours.</p>
          ${outGroup ? `<p class="small">${name(out.to)} is talking with someone now. They can still add you, or you can try someone else.</p>` : ''}
          <button type="button" class="btn btn--quiet btn--sm" data-act="cancelReq">Cancel</button>
        </div>`;
    }
    inc.filter(r => !out || r.from !== out.to).forEach(r => {
      html += `
        <div class="pairnote pairnote--in">
          ${ui.badge(S, S.participants[r.from])}
          <p><strong>${name(r.from)} entered your PIN.</strong> Enter ${name(r.from)}'s PIN ${logic.groupOf(S, me) ? 'to add them' : 'to start talking'}.</p>
        </div>`;
    });
    el.innerHTML = html;
  }

  /* ---------- views ---------- */
  const VIEWS = {
    missing: () => `
      <section class="s-view s-center stack">
        <h1>This session has closed</h1>
        <p class="muted">Ask your tutor for the current QR code.</p>
        <a class="btn btn--primary" href="../index.html">Enter a code</a>
      </section>`,

    removed: () => `
      <section class="s-view s-center stack">
        <h1>You're not in this session anymore</h1>
        <p class="muted">Your tutor may have removed you by mistake. Join again with your student ID.</p>
        <a class="btn btn--primary" href="join.html?s=${esc(code)}">Join again</a>
      </section>`,

    lobby: p => `
      <section class="s-view stack">
        <h1>You're in, ${esc(p.name)}.</h1>
        <p class="muted">Waiting for ${esc(S.tutor)} to open the questions. Keep this page open.</p>
        <div class="pin-hero" aria-label="Your PIN is ${esc(p.pin)}">
          <span class="muted">Your PIN</span>
          <strong>${esc(p.pin)}</strong>
          <span class="small muted">You keep this for the whole session. Show it to the person you want to pair with.</span>
        </div>
        <p class="waiting"><span class="waiting__dot"></span>Waiting for the questions</p>
        ${pairBox('locked', `This opens once you've made your card and ${esc(S.tutor)} starts matching.`)}
      </section>`,

    q1: p => {
      const sel = local.pickInterest || p.interest;
      return `
      <section class="s-view stack">
        <p class="qstep">Question 1 of 2</p>
        <h1>${esc(TU.QUESTIONS.q1.title)}</h1>
        <p class="muted">${esc(TU.QUESTIONS.q1.hint)}</p>
        <div class="choices" role="radiogroup" aria-label="Interest">
          ${TU.INTERESTS.map(i => `
            <button type="button" class="choice" role="radio" aria-checked="${sel === i.id}" data-interest="${i.id}"
              style="--card:${i.color};--card-ink:${i.ink}">
              <span class="choice__swatch" aria-hidden="true"></span>
              <span class="choice__text"><strong>${esc(i.label)}</strong><span>${esc(i.blurb)}</span></span>
            </button>`).join('')}
        </div>
        <div class="s-actions">
          <button class="btn btn--primary btn--block" data-act="saveInterest" ${sel ? '' : 'disabled'}>Next</button>
        </div>
      </section>`;
    },

    q2: p => {
      const sel = local.pickStyle || logic.styleOf(S, p);
      const i = logic.interest(p.interest);
      const later = S.round > 1;
      return `
      <section class="s-view stack">
        <p class="qstep">${later ? `Round ${S.round}` : 'Question 2 of 2'}</p>
        <h1>${later ? 'How do you want to work this round?' : esc(TU.QUESTIONS.q2.title)}</h1>
        <p class="muted">${later ? `You keep your ${esc(i.colorName.toLowerCase())} ${esc(i.label)} colour. Pick an icon for this round.` : esc(TU.QUESTIONS.q2.hint)}</p>
        <div class="choices choices--icons" role="radiogroup" aria-label="Working style" style="--card:${i.color};--card-ink:${i.ink}">
          ${TU.STYLES.map(s => `
            <button type="button" class="choice" role="radio" aria-checked="${sel === s.id}" data-style="${s.id}">
              <span class="choice__icon" aria-hidden="true">${ui.icon(s.id)}</span>
              <span class="choice__text"><strong>${esc(s.label)}</strong><span>${esc(s.blurb)}</span></span>
            </button>`).join('')}
        </div>
        <div class="s-actions">
          ${!later && !local.editing ? `<button class="btn btn--ghost" data-act="backToQ1">Back</button>` : ''}
          <button class="btn btn--primary btn--grow" data-act="saveStyle" ${sel ? '' : 'disabled'}>Make my card</button>
        </div>
      </section>`;
    },

    ready: p => `
      <section class="s-view stack s-reveal">
        <h1>Here's your card</h1>
        <div class="card-wrap">${cardFor(p, 'lg', { pin: true })}</div>
        <p>When matching starts, pair up with anyone. Your cards tell you what you have in common, and you'll get questions to get to know each other.</p>
        <p class="waiting"><span class="waiting__dot"></span>Waiting for ${esc(S.tutor)} to start matching</p>
        ${pairBox('locked', `This opens when ${esc(S.tutor)} starts matching. You can start looking for your colour or icon now.`)}
        <button class="btn btn--quiet" data-act="edit">Change my answers</button>
      </section>`,

    match: p => {
      const i = logic.interest(p.interest);
      const st = logic.style(logic.styleOf(S, p));
      return `
      <section class="s-view stack">
        <div class="card-wrap card-wrap--hold">${cardFor(p, 'lg', { pin: true })}</div>
        <p class="hold-hint">Hold your phone up so others can see your card.</p>

        <div class="lookfor">
          <h2>Anyone can be your partner. Their card tells you:</h2>
          <ul>
            <li><span class="lookfor__swatch" style="background:${i.color}"></span><span>A ${esc(i.colorName.toLowerCase())} card means they're also into ${esc(i.label)}</span></li>
            <li><span class="lookfor__icon">${ui.icon(st.id)}</span><span>A ${esc(st.iconName.toLowerCase())} icon means they're also ${/^[AEIOU]/.test(st.label) ? 'an' : 'a'} ${esc(st.label)}</span></li>
            <li><span class="lookfor__swatch lookfor__swatch--mixed" aria-hidden="true"></span><span>Anything different gives you more to learn about each other</span></li>
          </ul>
        </div>

        ${pairBox('open')}
      </section>`;
    },

    talk: p => {
      const g = logic.groupOf(S, me);
      const partners = logic.partnersOf(S, me);
      const names = partners.map(x => esc(x.name));
      const nameList = names.length > 1 ? names.slice(0, -1).join(', ') + ' and ' + names.slice(-1) : names[0];
      const myType = partners.map(x => logic.matchType(S, p, x)).find(Boolean) || g.matchType;
      const timing = S.phase === 'talking'
        ? `<div class="s-timer"><span class="s-timer__value" data-timer>${ui.fmtTime(logic.timeLeft(S))}</span><span class="muted">left this round</span></div>`
        : `<p class="waiting"><span class="waiting__dot"></span>The timer starts when ${esc(S.tutor)} starts the round. You can start talking now.</p>`;
      return `
      <section class="s-view stack">
        <div class="matched">
          <span class="pill pill--match">${esc(logic.matchLabel(myType))}</span>
          <h1>You're with ${nameList}</h1>
        </div>
        <div class="pair-cards pair-cards--${partners.length + 1}">
          ${cardFor(p, 'sm', { noName: false })}
          ${partners.map(x => cardFor(x, 'sm')).join('')}
        </div>
        ${timing}
        <div class="prompts-wrap">
          <h2>Things to talk about</h2>
          <ol class="prompts">${g.prompts.map(t => `<li>${esc(t)}</li>`).join('')}</ol>
          <p class="small muted">These are optional. Follow the conversation wherever it goes.</p>
        </div>
        ${logic.incomingFor(S, me).length && g.members.length < S.settings.maxGroupSize ? pairBox('join') : ''}
      </section>`;
    },

    feedback: () => {
      const partners = logic.partnersOf(S, me);
      const allSet = partners.every(x => local.fb[x.id]);
      return `
      <section class="s-view stack">
        <h1>Would you team up?</h1>
        <p class="muted">Only your tutor sees this. It helps them put teams together.</p>
        ${partners.map(x => `
          <fieldset class="fb">
            <legend>${ui.badge(S, x)} <span>${esc(x.name)}</span></legend>
            <div class="fb__opts">
              ${CHOICES.map(c => `<button type="button" class="fb__opt fb__opt--${c.id}" aria-pressed="${local.fb[x.id] === c.id}"
                data-fb="${x.id}" data-choice="${c.id}">${c.label}</button>`).join('')}
            </div>
          </fieldset>`).join('')}
        <button class="btn btn--primary btn--block" data-act="sendFeedback" ${allSet && !local.busy ? '' : 'disabled'}>Send</button>
      </section>`;
    },

    roundwait: p => {
      const g = logic.groupOf(S, me);
      const i = logic.interest(p.interest);
      return `
      <section class="s-view stack s-center">
        <h1>Round ${S.round} done</h1>
        <p class="muted">${g ? 'Thanks for answering.' : "You didn't pair up this round. You'll get another go next round."}</p>
        <div class="card-wrap card-wrap--small">${cardFor(p, 'md')}</div>
        <p>When ${esc(S.tutor)} starts round ${S.round + 1}, you'll keep your ${esc(i.colorName.toLowerCase())} colour and pick a working style again.</p>
        <p class="waiting"><span class="waiting__dot"></span>Waiting for the next round</p>
      </section>`;
    },

    team: p => {
      const t = logic.teams.teamOf(S, me);
      const mates = t.members.filter(id => id !== me).map(id => S.participants[id]).filter(Boolean);
      const met = new Set([].concat(...Array.from({ length: S.round }, (_, k) => logic.partnersOf(S, me, k + 1).map(x => x.id))));
      return `
      <section class="s-view stack s-reveal">
        <p class="qstep">${esc(S.course)} project team</p>
        <h1>You're in ${esc(t.name)}</h1>
        <p class="muted">${esc(S.tutor)} has confirmed the teams. Find your teammates and say hi.</p>
        <ul class="teamlist">
          <li class="teamlist__me">${ui.badge(S, p)}<span><strong>${esc(p.name)}</strong><span class="muted small">You</span></span></li>
          ${mates.map(m => `
            <li>${ui.badge(S, m)}<span><strong>${esc(m.name)}</strong>
              <span class="muted small">${esc(logic.interest(m.interest)?.label || '')}${met.has(m.id) ? ', you talked in a round' : ''}</span></span></li>`).join('')}
        </ul>
      </section>`;
    },

    finished: p => {
      const rounds = Array.from({ length: S.round }, (_, k) => k + 1)
        .map(r => ({ r, people: logic.partnersOf(S, me, r) }))
        .filter(x => x.people.length);
      return `
      <section class="s-view stack">
        <h1>That's a wrap, ${esc(p.name)}</h1>
        <p class="muted">${esc(S.tutor)} will use everyone's answers to help form teams.</p>
        ${rounds.length ? `
          <div class="met">
            <h2>People you met</h2>
            <ul>${rounds.map(x => x.people.map(o => `
              <li>${ui.badge(S, o, x.r)}<span><strong>${esc(o.name)}</strong><span class="muted small">Round ${x.r}</span></span></li>`).join('')).join('')}
            </ul>
          </div>` : '<p>You didn\'t pair up with anyone this time.</p>'}
      </section>`;
    }
  };

  /* ---------- actions ---------- */
  async function run(fn, okMsg) {
    try {
      const out = await Store.update(code, fn);
      if (okMsg) ui.toast(typeof okMsg === 'function' ? okMsg(out) : okMsg, 'ok');
      return true;
    } catch (e) {
      ui.toast(e.message || 'Something went wrong. Try again.', 'error');
      return false;
    }
  }

  view.addEventListener('click', async e => {
    const t = e.target.closest('button');
    if (!t) return;

    if (t.dataset.interest) { local.pickInterest = t.dataset.interest; return render(); }
    if (t.dataset.style) { local.pickStyle = t.dataset.style; return render(); }
    if (t.dataset.fb) { local.fb[t.dataset.fb] = t.dataset.choice; return render(); }

    switch (t.dataset.act) {
      case 'saveInterest': {
        const pick = local.pickInterest || S.participants[me].interest;
        if (await run(s => logic.setInterest(s, me, pick))) {
          local.pickInterest = null;
          local.editing = local.editing ? 'q2' : null;
          render();
        }
        break;
      }
      case 'backToQ1':
        local.editing = 'q1';
        render();
        break;
      case 'saveStyle': {
        const pick = local.pickStyle || logic.styleOf(S, S.participants[me]);
        if (await run(s => logic.setStyle(s, me, pick))) {
          local.pickStyle = null;
          local.editing = null;
          render();
        }
        break;
      }
      case 'cancelReq':
        await run(s => logic.cancelRequest(s, me), 'Cancelled');
        break;
      case 'edit':
        local.editing = S.round === 1 ? 'q1' : 'q2';
        render();
        break;
      case 'sendFeedback':
        local.busy = true; render();
        await run(s => logic.giveFeedback(s, me, local.fb), 'Sent. Thanks!');
        local.busy = false; local.fb = {};
        render();
        break;
    }
  });

  view.addEventListener('input', e => {
    if (e.target.id === 'pin') {
      e.target.value = e.target.value.replace(/\D/g, '').slice(0, 4);
      $('#pinError').textContent = '';
    }
  });

  view.addEventListener('submit', async e => {
    if (e.target.id !== 'pinForm') return;
    e.preventDefault();
    const input = $('#pin');
    const btn = e.target.querySelector('button');
    btn.disabled = true;
    try {
      const res = await Store.update(code, s => logic.pairWithPin(s, me, input.value));
      if (res.status === 'waiting') {
        input.value = '';
        btn.disabled = false;
        ui.toast(`Sent. Now ${res.name} needs to enter your PIN.`, 'ok');
      } else if (res.status === 'joined') {
        ui.toast(`${res.name} joined your conversation`, 'ok');
      } else {
        ui.toast(`Paired with ${res.name}`, 'ok');
      }
    } catch (ex) {
      $('#pinError').textContent = ex.message;
      input.select();
      btn.disabled = false;
    }
  });

  /* ---------- timer ---------- */
  function tick() {
    if (!S) return;
    if (S.phase === 'talking') {
      const left = logic.timeLeft(S);
      $$('[data-timer]').forEach(el => {
        el.textContent = ui.fmtTime(left);
        el.classList.toggle('is-low', left < 60000);
      });
      if (left <= 0) render();   // flips to the round-end screens
    }
  }
  setInterval(tick, 500);

  Store.subscribe(code, s => {
    S = s;
    // a fresh round clears any half-made choices
    if (s && local.round !== s.round) { local.round = s.round; local.pickStyle = null; local.editing = null; local.fb = {}; }
    render();
  });
})();
