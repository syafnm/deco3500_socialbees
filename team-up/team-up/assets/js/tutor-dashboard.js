/* Tutor — live dashboard */
(async function () {
  const { ui, logic } = TU;
  const { $, $$, esc } = ui;
  await Store.ready();

  const code = (ui.param('s') || '').toUpperCase();
  const first = code && await Store.get(code);
  if (!first) {
    $('#dash').hidden = true;
    $('.stepper').hidden = true;
    $('#missing').hidden = false;
    return;
  }

  const STEPS = [
    { key: 'lobby', label: 'Join' },
    { key: 'questions', label: 'Questions' },
    { key: 'matching', label: 'Matching' },
    { key: 'talking', label: 'Conversations' },
    { key: 'roundEnd', label: 'Wrap-up' }
  ];
  const stepIndex = phase => phase === 'finished' ? 5 : STEPS.findIndex(s => s.key === phase);
  const CHOICE = { yes: 'Keen', maybe: 'Maybe', no: 'Not this time' };

  let S = first;
  let ctlMinutes = S.settings.roundMinutes;
  let peopleFilter = 'all';
  let groupRound = S.round;
  let ending = false;
  const sig = {};   // last render signature per region, so inputs/focus aren't wiped by live updates

  const act = async (fn, okMsg) => {
    try { await Store.update(code, fn); if (okMsg) ui.toast(okMsg, 'ok'); }
    catch (e) { ui.toast(e.message || 'Something went wrong.', 'error'); }
  };

  /* ---------- static bits ---------- */
  const joinUrl = ui.joinUrl(code);
  ui.qr($('#qr'), joinUrl, 200);
  $('#joinCode').textContent = code;
  $('#joinUrl').textContent = joinUrl.replace(/^https?:\/\//, '');
  $('#openStudent').href = joinUrl;
  $('#copyLink').addEventListener('click', () => ui.copy(joinUrl));
  $('#syncNote').innerHTML = ui.syncNotice();
  Store.rememberSession({ code, course: S.course, title: S.title, createdAt: S.createdAt });

  /* ---------- tabs ---------- */
  const showTab = tab => {
    $$('.tab').forEach(t => t.setAttribute('aria-selected', String(t === tab)));
    $$('.tabpanel').forEach(p => { p.hidden = p.id !== tab.getAttribute('aria-controls'); });
  };
  $$('.tab').forEach(tab => tab.addEventListener('click', () => showTab(tab)));

  /* ---------- render ---------- */
  function render() {
    renderHeader();
    renderStepper();
    renderControl();
    renderStats();
    renderPeople();
    renderGroups();
    renderResponses();
    renderTeams();
    if ($('#projector').open) renderProjector();
  }

  function once(region, signature, fn) {
    if (sig[region] === signature) return;
    sig[region] = signature;
    fn();
  }

  function renderHeader() {
    once('header', S.course + S.title, () => {
      $('#sessionTitle').innerHTML = `<strong>${esc(S.course)}</strong><span>${esc(S.title)}</span>`;
      document.title = `${S.course} ${S.title} · Team Up`;
    });
  }

  function renderStepper() {
    const idx = stepIndex(S.phase);
    once('stepper', S.phase + S.round, () => {
      $('#stepper').innerHTML = STEPS.map((s, i) => `
        <li class="${i < idx ? 'is-done' : i === idx ? 'is-current' : ''}" ${i === idx ? 'aria-current="step"' : ''}>
          <span class="stepper__dot">${i + 1}</span>${s.label}
        </li>`).join('');
      $('#roundLabel').textContent = S.phase === 'finished' ? 'Finished' : `Round ${S.round}`;
    });
  }

  function renderControl() {
    const st = logic.stats(S);
    const fbGiven = Object.values(S.feedback).filter(f => f.round === S.round).length;
    const fbExpected = Object.values(S.groups).filter(g => g.round === S.round)
      .reduce((n, g) => n + g.members.length * (g.members.length - 1), 0);

    once('control', JSON.stringify([S.phase, S.round, st, ctlMinutes, fbGiven, fbExpected, !!S.teamsConfirmedAt]), () => {
      const el = $('#control');
      const bar = (n, d) => `<div class="meter" role="img" aria-label="${n} of ${d}"><span style="width:${d ? (n / d) * 100 : 0}%"></span></div>`;
      let html = '';

      switch (S.phase) {
        case 'lobby':
          html = `
            <h2>Waiting for students</h2>
            <p><strong class="big-num">${st.joined}</strong> joined so far.</p>
            <p class="muted small">Open the questions once most of the class has scanned in. Late arrivals can still join and answer.</p>
            <button class="btn btn--primary btn--block" data-act="openQuestions" ${st.joined ? '' : 'disabled'}>Open questions</button>
            ${st.joined ? '' : '<p class="muted small">The button unlocks when the first student joins.</p>'}`;
          break;

        case 'questions':
          html = `
            <h2>${S.round === 1 ? 'Students are answering' : `Round ${S.round}: picking a working style`}</h2>
            <p><strong class="big-num">${st.answered}</strong> of ${st.joined} have a card.</p>
            ${bar(st.answered, st.joined)}
            <p class="muted small">${S.round === 1 ? 'Interest sets the colour, working style sets the icon.' : 'They keep their colour from round 1 and only re-pick their icon.'}</p>
            <button class="btn btn--primary btn--block" data-act="startMatching" ${st.answered >= 2 ? '' : 'disabled'}>Start matching</button>
            ${st.answered >= 2 ? '' : '<p class="muted small">Needs at least two students with a card.</p>'}`;
          break;

        case 'matching':
          html = `
            <h2>Students are finding partners</h2>
            <p><strong class="big-num">${st.paired}</strong> of ${st.answered} paired.${st.unpaired ? ` <span class="pill pill--warn">${st.unpaired} still looking</span>` : ''}</p>
            ${bar(st.paired, st.answered)}
            <div class="field">
              <span class="field__label" id="lenLabel">Conversation length</span>
              <div class="stepper-input" role="group" aria-labelledby="lenLabel">
                <button class="btn btn--ghost btn--sm" data-min="-1" aria-label="One minute less" ${ctlMinutes <= TU.DEFAULTS.minMinutes ? 'disabled' : ''}>−</button>
                <output>${ctlMinutes} min</output>
                <button class="btn btn--ghost btn--sm" data-min="1" aria-label="One minute more" ${ctlMinutes >= TU.DEFAULTS.maxMinutes ? 'disabled' : ''}>+</button>
              </div>
            </div>
            <button class="btn btn--primary btn--block" data-act="startTalking" ${st.paired ? '' : 'disabled'}>Start ${ctlMinutes}-minute conversations</button>
            <p class="muted small">Pairs see their prompts as soon as they match. Anyone still looking can pair after you start.</p>`;
          break;

        case 'talking':
          html = `
            <h2>Conversations running</h2>
            <p class="timer" data-timer>${ui.fmtTime(logic.timeLeft(S))}</p>
            <p class="muted small">${st.paired} paired${st.unpaired ? `, ${st.unpaired} still looking` : ''}.</p>
            <div class="control__row">
              <button class="btn btn--ghost" data-act="addMinute">Add 1 minute</button>
              <button class="btn btn--danger" data-act="endRound">End round now</button>
            </div>`;
          break;

        case 'roundEnd':
          html = `
            <h2>Round ${S.round} finished</h2>
            <p><strong class="big-num">${fbGiven}</strong> of ${fbExpected} team-up answers in.</p>
            ${bar(fbGiven, fbExpected)}
            <p class="muted small">Students are telling you who they'd team up with. Start the next round when most are done.</p>
            <button class="btn btn--primary btn--block" data-act="nextRound">Start round ${S.round + 1}</button>
            <button class="btn btn--ghost btn--block" data-act="finish">Finish session</button>
            <button class="btn btn--quiet btn--sm control__end" data-act="gotoTeams">Form teams</button>`;
          break;

        case 'finished':
          html = `
            <h2>Session finished</h2>
            <p class="muted">${S.round} round${S.round > 1 ? 's' : ''}, ${st.joined} students. ${S.teamsConfirmedAt ? 'Teams are confirmed and students can see them.' : 'Build teams from the mutual matches, then confirm them.'}</p>
            <button class="btn btn--primary btn--block" data-act="gotoTeams">${S.teamsConfirmedAt ? 'View teams' : 'Form teams'}</button>
            <button class="btn btn--ghost btn--block" data-act="csv">Download results (CSV)</button>
            <button class="btn btn--ghost btn--block" data-act="reopen">Run another round</button>`;
          break;
      }
      if (['questions', 'matching', 'talking'].includes(S.phase)) {
        html += `<button class="btn btn--quiet btn--sm control__end" data-act="finish">Finish session early</button>`;
      }
      el.innerHTML = html;
    });
  }

  function renderStats() {
    const st = logic.stats(S);
    once('stats', JSON.stringify(st), () => {
      const items = [
        ['Joined', st.joined],
        ['Have a card', st.answered],
        ['Paired', st.paired],
        ['Still looking', Math.max(0, st.unpaired)]
      ];
      $('#stats').innerHTML = items.map(([l, n]) => `<div class="stat"><span class="stat__n">${n}</span><span class="stat__l">${l}</span></div>`).join('');
    });
  }

  function renderPeople() {
    once('people', JSON.stringify([S.participants, S.groups, S.round, S.phase, peopleFilter]), () => {
      const ps = Object.values(S.participants);
      const order = { ready: 0, q2: 1, q1: 2, paired: 3 };
      const rows = ps.map(p => ({ p, status: logic.statusOf(S, p) }))
        .filter(r => peopleFilter === 'all' || r.status.key === peopleFilter ||
          (peopleFilter === 'answering' && (r.status.key === 'q1' || r.status.key === 'q2')))
        .sort((a, b) => order[a.status.key] - order[b.status.key] || a.p.name.localeCompare(b.p.name));

      const count = k => ps.filter(p => {
        const s = logic.statusOf(S, p).key;
        return k === 'answering' ? (s === 'q1' || s === 'q2') : s === k;
      }).length;
      const filters = [['all', 'Everyone', ps.length], ['ready', 'Looking', count('ready')],
        ['paired', 'Paired', count('paired')], ['answering', 'Answering', count('answering')]];

      const looking = ps.filter(p => logic.statusOf(S, p).key === 'ready');
      const suggest = p => looking.filter(o => o.id !== p.id &&
        (S.settings.allowRepeats || !logic.pastPartnerIds(S, p.id).has(o.id))).map(o => o.name);

      const el = $('#panel-people');
      if (!ps.length) {
        el.innerHTML = `<div class="empty"><h3>No one yet</h3><p class="muted">Put the QR code up on the projector so students can scan in.</p></div>`;
        return;
      }
      el.innerHTML = `
        <div class="chips" role="group" aria-label="Filter people">
          ${filters.map(([k, l, n]) => `<button class="chip" data-filter="${k}" aria-pressed="${peopleFilter === k}">${l} <span>${n}</span></button>`).join('')}
        </div>
        <ul class="people">
          ${rows.map(({ p, status }) => {
            const partners = logic.partnersOf(S, p.id).map(x => x.name).join(', ');
            const sug = status.key === 'ready' ? suggest(p) : [];
            return `
            <li class="person">
              ${ui.badge(S, p)}
              <div class="person__main">
                <strong>${esc(p.name)}</strong>
                <span class="muted small">${esc(p.studentId)}</span>
                ${partners ? `<span class="small">With ${esc(partners)}</span>` : ''}
                ${status.key === 'ready' ? `<span class="small muted">${sug.length ? 'Could pair with ' + esc(sug.slice(0, 3).join(', ')) : 'No free match right now'}</span>` : ''}
              </div>
              <span class="person__pin" title="PIN">${esc(p.pin)}</span>
              <span class="pill pill--${status.key}">${status.label}</span>
              <button class="btn btn--quiet btn--sm" data-remove="${p.id}" aria-label="Remove ${esc(p.name)}">Remove</button>
            </li>`;
          }).join('') || '<li class="empty small muted">No one in this filter.</li>'}
        </ul>`;
    });
  }

  function renderGroups() {
    if (groupRound > S.round) groupRound = S.round;
    once('groups', JSON.stringify([S.groups, S.participants, groupRound, S.round]), () => {
      const el = $('#panel-groups');
      const groups = Object.values(S.groups).filter(g => g.round === groupRound)
        .sort((a, b) => b.createdAt - a.createdAt);
      const rounds = Array.from({ length: S.round }, (_, i) => i + 1);
      el.innerHTML = `
        ${S.round > 1 ? `<div class="chips" role="group" aria-label="Choose round">
          ${rounds.map(r => `<button class="chip" data-round="${r}" aria-pressed="${r === groupRound}">Round ${r}</button>`).join('')}
        </div>` : ''}
        ${groups.length ? `<div class="groups">${groups.map(g => {
          const members = g.members.map(id => S.participants[id]).filter(Boolean);
          return `
            <article class="group">
              <header class="group__head">
                <span class="pill pill--match">${logic.matchLabel(g.matchType)}</span>
                ${members.length > 2 ? '<span class="pill">Trio</span>' : ''}
                ${g.round === S.round && S.phase !== 'finished' ? `<button class="btn btn--quiet btn--sm" data-split="${g.id}">Split</button>` : ''}
              </header>
              <ul class="group__members">
                ${members.map(m => `<li>${ui.badge(S, m, g.round)}<span>${esc(m.name)}</span></li>`).join('')}
              </ul>
              <details>
                <summary>Their prompts</summary>
                <ol class="prompts-mini">${g.prompts.map(p => `<li>${esc(p)}</li>`).join('')}</ol>
              </details>
            </article>`;
        }).join('')}</div>`
          : `<div class="empty"><h3>No pairs ${groupRound === S.round ? 'yet' : 'in this round'}</h3><p class="muted">Pairs show up here the moment one student enters another's PIN.</p></div>`}`;
    });
  }

  function renderResponses() {
    once('responses', JSON.stringify([S.feedback, S.groups, S.participants]), () => {
      const el = $('#panel-responses');
      const rows = logic.responses(S);
      const answered = rows.filter(r => r.ab || r.ba);
      const mutual = rows.filter(r => r.mutual);
      if (!answered.length) {
        el.innerHTML = `<div class="empty"><h3>No answers yet</h3><p class="muted">After each round, students say whether they'd team up with the person they talked to. Only you see this.</p></div>`;
        return;
      }
      const cell = c => c ? `<span class="pill pill--${c}">${CHOICE[c]}</span>` : '<span class="muted small">No answer</span>';
      el.innerHTML = `
        <div class="responses__head">
          <p><strong>${mutual.length}</strong> mutual match${mutual.length === 1 ? '' : 'es'} so far.</p>
          <button class="btn btn--ghost btn--sm" data-act="csv">Download CSV</button>
        </div>
        <div class="table-wrap">
          <table class="rtable">
            <thead><tr><th>Pair</th><th>Round</th><th>Would they team up?</th></tr></thead>
            <tbody>
              ${rows.map(r => `
                <tr class="${r.mutual ? 'is-mutual' : r.vetoed ? 'is-vetoed' : ''}">
                  <td><span class="rtable__pair">${ui.badge(S, r.a, r.round)} ${esc(r.a.name)} <span class="muted">and</span> ${ui.badge(S, r.b, r.round)} ${esc(r.b.name)}</span>
                    ${r.mutual ? '<span class="pill pill--yes">Mutual</span>' : ''}</td>
                  <td data-label="Round">${r.round}</td>
                  <td>
                    <div class="says"><span>${esc(r.a.name)}</span>${cell(r.ab)}</div>
                    <div class="says"><span>${esc(r.b.name)}</span>${cell(r.ba)}</div>
                  </td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>`;
    });
  }

  function renderTeams() {
    const T = logic.teams;
    once('teams', JSON.stringify([S.teams, S.teamsConfirmedAt, S.feedback, S.participants, S.settings.teamSize, S.groups]), () => {
      const el = $('#panel-teams');
      const teams = T.list(S);
      const pool = T.unassigned(S);
      const mutual = T.mutualPairs(S);
      const locked = T.confirmed(S);
      const N = S.settings.teamSize;
      const nStudents = Object.keys(S.participants).length;
      const approx = Math.max(1, Math.round(nStudents / N));
      const name = id => esc(S.participants[id]?.name || '');

      const countEl = $('#teamsCount');
      countEl.hidden = !mutual.length && !teams.length;
      countEl.textContent = locked ? 'Confirmed' : mutual.length ? `${mutual.length} mutual` : '';

      const moveSelect = (pid, current) => locked ? '' : `
        <select class="select" data-move="${pid}" aria-label="Move ${name(pid)}">
          <option value="">${current ? 'Move to…' : 'Add to…'}</option>
          ${teams.filter(t => t.id !== current).map(t => `<option value="${t.id}">${esc(t.name)} (${t.members.length})</option>`).join('')}
          ${current ? '<option value="__pool">Not in a team</option>' : ''}
        </select>`;

      const memberRow = (pid, teamId) => {
        const p = S.participants[pid];
        if (!p) return '';
        return `<li class="member">${ui.badge(S, p)}<span class="member__name">${esc(p.name)}<span class="muted small">${esc(p.studentId)}</span></span>${moveSelect(pid, teamId)}</li>`;
      };

      const pairState = r => {
        const ta = T.teamOf(S, r.a.id), tb = T.teamOf(S, r.b.id);
        if (ta && tb && ta.id === tb.id) return `<span class="pill pill--yes">Together in ${esc(ta.name)}</span>`;
        if (ta && tb) return `<span class="pill pill--warn">Split up</span>`;
        return `<span class="pill">Not in a team yet</span>`;
      };

      el.innerHTML = `
        <div class="teams-bar">
          <div class="teams-bar__size">
            <span class="field__label" id="sizeLabel">Students per team</span>
            <div class="numfield" role="group" aria-labelledby="sizeLabel">
              <button class="btn btn--ghost btn--sm" data-teamsize="-1" aria-label="One fewer per team" ${locked || N <= TU.DEFAULTS.minTeamSize ? 'disabled' : ''}>−</button>
              <output class="numfield__out">${N}</output>
              <button class="btn btn--ghost btn--sm" data-teamsize="1" aria-label="One more per team" ${locked || N >= TU.DEFAULTS.maxTeamSize ? 'disabled' : ''}>+</button>
            </div>
            <span class="muted small">${nStudents} students makes about ${approx} team${approx === 1 ? '' : 's'}</span>
          </div>
          <div class="teams-bar__actions">
            ${locked ? `<button class="btn btn--ghost" data-act="unlockTeams">Unlock to edit</button>` : `
              <button class="btn btn--ghost" data-act="buildTeams" ${nStudents < 2 ? 'disabled' : ''}>${teams.length ? 'Rebuild from matches' : 'Build teams from matches'}</button>
              <button class="btn btn--primary" data-act="confirmTeams" ${teams.some(t => t.members.length) ? '' : 'disabled'}>Confirm all teams</button>`}
          </div>
        </div>

        ${locked ? `<p class="banner banner--ok"><strong>Teams confirmed</strong> at ${new Date(S.teamsConfirmedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}. Every student can now see their team on their phone.</p>` : ''}

        <section class="mutuals">
          <h3>Mutual matches <span class="muted small">Both said "Keen to team up"</span></h3>
          ${mutual.length ? `<ul class="mutuals__list">${mutual.map(r => `
            <li>${ui.badge(S, r.a)}<strong>${esc(r.a.name)}</strong><span class="muted">and</span>${ui.badge(S, r.b)}<strong>${esc(r.b.name)}</strong>${pairState(r)}</li>`).join('')}</ul>`
          : `<p class="muted small">None yet. When two students both say they're keen after a round, they show up here.</p>`}
        </section>

        ${teams.length ? `
          <div class="teams-grid">
            ${teams.map(t => {
              const notes = T.notes(S, t);
              const n = t.members.length;
              const sizeCls = n === N ? 'yes' : n > N ? 'no' : 'maybe';
              return `
              <article class="team">
                <header class="team__head">
                  <h3>${esc(t.name)}</h3>
                  <span class="pill pill--${sizeCls}">${n} of ${N}</span>
                  ${locked ? '' : `<button class="btn btn--quiet btn--sm" data-delteam="${t.id}" aria-label="Delete ${esc(t.name)}">Delete</button>`}
                </header>
                <ul class="team__members">${t.members.map(pid => memberRow(pid, t.id)).join('') || '<li class="muted small">Empty. Add people from the list below.</li>'}</ul>
                ${notes.keen.length || notes.vetoes.length ? `<ul class="team__notes">
                  ${notes.keen.map(([a, b]) => `<li class="team__note team__note--ok">${name(a)} and ${name(b)} both keen</li>`).join('')}
                  ${notes.vetoes.map(([a, b]) => `<li class="team__note team__note--bad">${name(a)} said "Not this time" to ${name(b)}</li>`).join('')}
                </ul>` : ''}
              </article>`;
            }).join('')}
            ${locked ? '' : `<button class="team team--add" data-act="addTeam"><span>+ New team</span></button>`}
          </div>

          <section class="pool">
            <h3>Not in a team <span class="muted small">${pool.length}</span></h3>
            ${pool.length ? `<ul class="team__members pool__list">${pool.map(p => memberRow(p.id, null)).join('')}</ul>`
              : '<p class="muted small">Everyone has a team.</p>'}
          </section>`
        : `<div class="empty">
            <h3>No teams yet</h3>
            <p class="muted">Press "Build teams from matches" to draft teams of ${N}. Mutual matches are kept together, anyone who said "Not this time" is kept apart, and everyone else is placed where they fit. You can move people around before you confirm.</p>
          </div>`}`;
    });
  }

  function renderProjector() {
    const t = logic.timeLeft(S);
    const st = logic.stats(S);
    const phaseMsg = {
      lobby: 'Scan the code to join',
      questions: S.round === 1 ? 'Answer the two questions on your phone' : 'Pick your working style for this round',
      matching: 'Pair up with anyone. Enter each other\'s PIN to start talking.',
      talking: 'Talk with your partner. Prompts are on your phone.',
      roundEnd: `Round ${S.round} done. Tell us who you'd team up with.`,
      finished: 'Thanks for taking part'
    }[S.phase];

    once('projector', JSON.stringify([S.phase, S.round, st.joined, $('#projector').open]), () => {
      $('#projectorBody').innerHTML = `
        <div class="projector__join">
          <div class="projector__qr" id="projQr"></div>
          <p class="projector__code">${esc(code)}</p>
          <p class="muted">${esc(joinUrl.replace(/^https?:\/\//, ''))}</p>
        </div>
        <div class="projector__info">
          <p class="projector__course">${esc(S.course)} ${esc(S.title)}</p>
          <h2 class="projector__msg">${esc(phaseMsg)}</h2>
          <p class="projector__timer" data-timer ${t == null ? 'hidden' : ''}>${t == null ? '' : ui.fmtTime(t)}</p>
          <div class="legend">
            <div>
              <h3>Colour is your interest</h3>
              <ul>${TU.INTERESTS.map(i => `<li><span class="swatch" style="background:${i.color}"></span>${esc(i.label)}</li>`).join('')}</ul>
            </div>
            <div>
              <h3>Icon is how you work</h3>
              <ul>${TU.STYLES.map(s => `<li><span class="legend__icon">${ui.icon(s.id)}</span>${esc(s.label)}</li>`).join('')}</ul>
            </div>
          </div>
          <p class="muted">${st.joined} joined</p>
        </div>`;
      ui.qr($('#projQr'), joinUrl, 300);
    });
  }

  /* ---------- events (delegated) ---------- */
  document.addEventListener('click', async e => {
    const a = e.target.closest('[data-act]');
    if (a) {
      const T = logic.tutor;
      switch (a.dataset.act) {
        case 'openQuestions': return act(T.openQuestions, 'Questions are open');
        case 'startMatching': return act(T.startMatching, 'Matching started');
        case 'startTalking': return act(s => T.startTalking(s, ctlMinutes), `${ctlMinutes}-minute timer started`);
        case 'addMinute': return act(T.addMinute, 'Added 1 minute');
        case 'endRound': if (await ui.confirm('End this round for everyone now?', 'End round')) return act(T.endRound);
          return;
        case 'nextRound': ctlMinutes = S.settings.roundMinutes; return act(T.nextRound, `Round ${S.round + 1} started`);
        case 'finish': if (await ui.confirm('Finish the session? Students will see a wrap-up screen.', 'Finish session')) return act(T.finish);
          return;
        case 'reopen': return act(T.nextRound, `Round ${S.round + 1} started`);
        case 'csv': return ui.download(`teamup-${S.course}-${code}.csv`, logic.toCSV(S));
        case 'gotoTeams': showTab($('#tab-teams')); return $('#panel-teams').scrollIntoView({ behavior: 'smooth', block: 'start' });
        case 'buildTeams':
          if (Object.keys(S.teams).length && !(await ui.confirm('Rebuild teams? This replaces the current draft, including any changes you made.', 'Rebuild'))) return;
          return act(s => logic.teams.build(s), 'Draft teams ready. Check them, then confirm.');
        case 'addTeam': return act(s => logic.teams.add(s));
        case 'confirmTeams': {
          const left = logic.teams.unassigned(S).length;
          const vetoes = logic.teams.list(S).reduce((n, t) => n + logic.teams.notes(S, t).vetoes.length, 0);
          const issues = [
            left ? `${left} student${left === 1 ? " isn't" : "s aren't"} in a team yet.` : '',
            vetoes ? `${vetoes} team member${vetoes === 1 ? '' : 's'} said "Not this time" to someone in their team.` : ''
          ].filter(Boolean).join(' ');
          const msg = issues ? `${issues} Confirm the teams anyway?` : 'Confirm all teams? Every student will see their team on their phone.';
          if (await ui.confirm(msg, 'Confirm teams')) return act(s => logic.teams.confirm(s), 'Teams confirmed');
          return;
        }
        case 'unlockTeams': return act(s => logic.teams.unlock(s), 'Teams unlocked for editing');
      }
    }
    const m = e.target.closest('[data-min]');
    if (m) {
      ctlMinutes = Math.min(TU.DEFAULTS.maxMinutes, Math.max(TU.DEFAULTS.minMinutes, ctlMinutes + Number(m.dataset.min)));
      return renderControl();
    }
    const f = e.target.closest('[data-filter]');
    if (f) { peopleFilter = f.dataset.filter; return renderPeople(); }
    const r = e.target.closest('[data-round]');
    if (r) { groupRound = Number(r.dataset.round); return renderGroups(); }
    const rm = e.target.closest('[data-remove]');
    if (rm) {
      const p = S.participants[rm.dataset.remove];
      if (p && await ui.confirm(`Remove ${p.name} from this session?`, 'Remove')) act(s => logic.tutor.removeParticipant(s, p.id), `${p.name} removed`);
      return;
    }
    const ts = e.target.closest('[data-teamsize]');
    if (ts) return act(s => logic.teams.setSize(s, s.settings.teamSize + Number(ts.dataset.teamsize)));
    const dt = e.target.closest('[data-delteam]');
    if (dt) {
      const t = S.teams[dt.dataset.delteam];
      if (t && (!t.members.length || await ui.confirm(`Delete ${t.name}? Its members go back to "Not in a team".`, 'Delete team')))
        act(s => logic.teams.remove(s, t.id));
      return;
    }
    const sp = e.target.closest('[data-split]');
    if (sp && await ui.confirm('Split this pair so they can find new partners?', 'Split pair')) act(s => logic.tutor.splitGroup(s, sp.dataset.split), 'Pair split');
  });

  document.addEventListener('change', e => {
    const sel = e.target.closest('select[data-move]');
    if (!sel || !sel.value) return;
    const pid = sel.dataset.move, to = sel.value === '__pool' ? null : sel.value;
    act(s => logic.teams.move(s, pid, to));
  });

  $('#openProjector').addEventListener('click', () => { $('#projector').showModal(); sig.projector = null; renderProjector(); });
  $('#closeProjector').addEventListener('click', () => $('#projector').close());

  /* ---------- live data + timer ---------- */
  Store.subscribe(code, s => { if (s) { S = s; render(); } });

  setInterval(() => {
    if (!S || S.phase !== 'talking') return;
    const left = logic.timeLeft(S);
    $$('[data-timer]').forEach(el => { el.textContent = ui.fmtTime(left); el.hidden = false; });
    if (left <= 0 && !ending) {
      ending = true;
      act(s => { if (s.phase === 'talking') logic.tutor.endRound(s); }, "Time's up. Round finished.").finally(() => { ending = false; });
    }
  }, 250);
})();
