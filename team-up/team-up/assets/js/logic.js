/* ==========================================================
   Team Up — session rules
   Pure functions that read or mutate a session object.
   Used inside Store.update(...) so changes are atomic.
   ========================================================== */
(function () {
  const TU = window.TU;
  const UserError = () => TU.UserError;

  const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O, 1/I

  const L = {
    id(len = 10) {
      const c = 'abcdefghijklmnopqrstuvwxyz0123456789';
      let s = '';
      for (let i = 0; i < len; i++) s += c[Math.floor(Math.random() * c.length)];
      return s;
    },
    joinCode() {
      let s = '';
      for (let i = 0; i < 6; i++) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
      return s;
    },
    pin(session) {
      const used = new Set(Object.values(session.participants).map(p => p.pin));
      let pin;
      do { pin = String(1000 + Math.floor(Math.random() * 9000)); }
      while (used.has(pin) || /^(\d)\1{3}$/.test(pin));
      return pin;
    },

    newSession({ course, title, tutor, roundMinutes, allowRepeats, teamSize }) {
      return {
        code: L.joinCode(),
        course: course.trim(),
        title: title.trim(),
        tutor: tutor.trim(),
        createdAt: Date.now(),
        phase: 'lobby',          // lobby → questions → matching → talking → roundEnd → (questions…) → finished
        round: 1,
        roundEndsAt: null,
        settings: Object.assign({}, TU.DEFAULTS, { roundMinutes, allowRepeats, teamSize: teamSize || TU.DEFAULTS.teamSize }),
        participants: {},
        groups: {},
        requests: {},
        feedback: {},
        teams: {},
        teamsConfirmedAt: null
      };
    },

    /* ---------- lookups ---------- */
    interest: id => TU.INTERESTS.find(i => i.id === id),
    style: id => TU.STYLES.find(s => s.id === id),
    styleOf: (s, p, round = s.round) => (p && p.styles ? p.styles[round] : null),
    answered: (s, p) => !!(p && p.interest && L.styleOf(s, p)),
    groupOf(s, pid, round = s.round) {
      return Object.values(s.groups).find(g => g.round === round && g.members.includes(pid)) || null;
    },
    partnersOf(s, pid, round = s.round) {
      const g = L.groupOf(s, pid, round);
      return g ? g.members.filter(m => m !== pid).map(m => s.participants[m]).filter(Boolean) : [];
    },
    pastPartnerIds(s, pid) {
      const ids = new Set();
      Object.values(s.groups).forEach(g => {
        if (g.round < s.round && g.members.includes(pid)) g.members.forEach(m => m !== pid && ids.add(m));
      });
      return ids;
    },
    timeLeft(s, now = Date.now()) {
      return s.phase === 'talking' && s.roundEndsAt ? Math.max(0, s.roundEndsAt - now) : null;
    },
    /* students treat an expired timer as the end of the round even if the tutor tab is closed */
    effectivePhase(s, now = Date.now()) {
      if (s.phase === 'talking' && s.roundEndsAt && now >= s.roundEndsAt) return 'roundEnd';
      return s.phase;
    },
    matchType(s, a, b) {
      const colour = a.interest === b.interest;
      const icon = L.styleOf(s, a) === L.styleOf(s, b);
      return colour && icon ? 'both' : colour ? 'color' : icon ? 'icon' : 'none';
    },
    matchLabel(type) {
      return { both: 'Same colour and icon', color: 'Same colour', icon: 'Same icon', none: 'Different colour and icon' }[type] || '';
    },

    /* ---------- student actions ---------- */
    joinStudent(s, { name, studentId }) {
      if (s.phase === 'finished') throw new (UserError())('This session has finished.');
      const sid = studentId.trim().toUpperCase();
      const existing = Object.values(s.participants).find(p => p.studentId === sid);
      if (existing) { existing.name = name.trim(); return existing.id; }
      const p = {
        id: L.id(),
        name: name.trim(),
        studentId: sid,
        pin: L.pin(s),
        joinedAt: Date.now(),
        interest: null,
        styles: {}
      };
      s.participants[p.id] = p;
      return p.id;
    },

    setInterest(s, pid, interest) {
      const p = s.participants[pid];
      if (!p) throw new (UserError())('You are no longer in this session.');
      if (p.interest && p.interest !== interest && Object.values(s.groups).some(g => g.members.includes(pid)))
        throw new (UserError())('Your interest is locked once you have paired with someone.');
      p.interest = interest;
    },

    setStyle(s, pid, style) {
      const p = s.participants[pid];
      if (!p) throw new (UserError())('You are no longer in this session.');
      if (L.groupOf(s, pid)) throw new (UserError())("You're already paired this round.");
      p.styles[s.round] = style;
    },

    /* ---------- mutual PIN pairing ----------
       A pair only forms when BOTH students have entered each other's PIN.
       Entering a PIN records a request (one per student per round, newest wins).
       When the other person enters yours back, the pair is created and the
       conversation starts. Someone already in a pair can accept a third
       person the same way (for odd numbers), up to maxGroupSize. */
    reqKey: (s, pid, round = s.round) => `${round}_${pid}`,
    requestOf(s, pid, round = s.round) {
      const r = s.requests[L.reqKey(s, pid, round)];
      return r && s.participants[r.to] ? r : null;
    },
    incomingFor(s, pid, round = s.round) {
      return Object.values(s.requests)
        .filter(r => r.round === round && r.to === pid && s.participants[r.from])
        .filter(r => !L.groupOf(s, r.from, round))
        .sort((a, b) => a.at - b.at);
    },
    cancelRequest(s, pid) { delete s.requests[L.reqKey(s, pid)]; },
    clearRequestsFrom(s, pid) { delete s.requests[L.reqKey(s, pid)]; },

    pairWithPin(s, pid, rawPin) {
      const E = UserError();
      const phase = L.effectivePhase(s);
      if (phase !== 'matching' && phase !== 'talking') throw new E("Matching hasn't started yet. Your tutor will open it soon.");
      const me = s.participants[pid];
      if (!me) throw new E('You are no longer in this session.');
      if (!L.answered(s, me)) throw new E('Answer both questions first.');

      const pin = String(rawPin || '').replace(/\D/g, '');
      if (pin.length !== 4) throw new E('PINs are 4 digits.');
      if (pin === me.pin) throw new E("That's your own PIN. Enter your partner's.");
      const other = Object.values(s.participants).find(p => p.pin === pin);
      if (!other) throw new E(`No one has the PIN ${pin}. Check the number and try again.`);
      if (!L.answered(s, other)) throw new E(`${other.name} hasn't finished the questions yet.`);

      const type = L.matchType(s, me, other);   // 'both' | 'color' | 'icon' | 'none' — anyone can pair
      if (!s.settings.allowRepeats && L.pastPartnerIds(s, pid).has(other.id))
        throw new E(`You talked with ${other.name} in an earlier round. Find someone new.`);

      const myGroup = L.groupOf(s, pid);
      const theirGroup = L.groupOf(s, other.id);
      const theyAskedMe = (L.requestOf(s, other.id) || {}).to === pid;
      const max = s.settings.maxGroupSize;

      // I'm already talking: I can only let in someone who entered my PIN
      if (myGroup) {
        if (myGroup.members.includes(other.id)) throw new E(`You're already paired with ${other.name}.`);
        if (!theyAskedMe) throw new E("You're already paired this round.");
        if (theirGroup) throw new E(`${other.name} has already paired with someone else.`);
        if (myGroup.members.length >= max) throw new E('Your group is already full.');
        myGroup.members.push(other.id);
        L.clearRequestsFrom(s, other.id);
        return { status: 'joined', name: other.name };
      }

      // they entered my PIN first → pair now
      if (theyAskedMe) {
        if (theirGroup) {
          if (theirGroup.members.length >= max) throw new E(`${other.name}'s group is already full.`);
          theirGroup.members.push(pid);
        } else {
          const g = {
            id: L.id(8), round: s.round, members: [other.id, pid], matchType: type,
            createdAt: Date.now(), prompts: L.buildPrompts(s, other, me, type)
          };
          s.groups[g.id] = g;
        }
        L.clearRequestsFrom(s, pid);
        L.clearRequestsFrom(s, other.id);
        return { status: 'paired', name: other.name };
      }

      // otherwise record my request and wait for them to enter mine
      if (theirGroup && theirGroup.members.length >= max) throw new E(`${other.name}'s group is already full.`);
      s.requests[L.reqKey(s, pid)] = { round: s.round, from: pid, to: other.id, at: Date.now() };
      return { status: 'waiting', name: other.name };
    },

    giveFeedback(s, pid, answers) {
      Object.entries(answers).forEach(([to, choice]) => {
        s.feedback[`${s.round}_${pid}_${to}`] = { round: s.round, from: pid, to, choice, at: Date.now() };
      });
    },
    feedbackDone(s, pid) {
      const partners = L.partnersOf(s, pid);
      return partners.every(p => s.feedback[`${s.round}_${pid}_${p.id}`]);
    },

    /* ---------- prompts ---------- */
    buildPrompts(s, a, b, type) {
      const P = TU.PROMPTS;
      const pick = arr => arr[Math.floor(Math.random() * arr.length)];
      const fill = (t, x, y) => t.replace(/\{a\}/g, x).replace(/\{b\}/g, y);
      const ia = L.interest(a.interest), ib = L.interest(b.interest);
      const sa = L.style(L.styleOf(s, a)), sb = L.style(L.styleOf(s, b));

      const p1 = a.interest === b.interest
        ? pick(P.interest[a.interest])
        : fill(pick(P.interestBridge), ia.label, ib.label);
      const p2 = sa.id === sb.id
        ? pick(P.style[sa.id])
        : fill(pick(P.styleContrast), sa.label, sb.label);
      const p3 = pick(P.match[type]);
      return [p1, p2, p3];
    },

    /* ---------- tutor actions ---------- */
    tutor: {
      openQuestions(s) { s.phase = 'questions'; },
      startMatching(s) { s.phase = 'matching'; },
      startTalking(s, minutes) {
        s.settings.roundMinutes = minutes;
        s.phase = 'talking';
        s.roundEndsAt = Date.now() + minutes * 60000;
      },
      addMinute(s) { if (s.phase === 'talking') s.roundEndsAt += 60000; },
      endRound(s) { s.phase = 'roundEnd'; s.roundEndsAt = Date.now(); },
      nextRound(s) { s.round += 1; s.phase = 'questions'; s.roundEndsAt = null; },
      finish(s) { s.phase = 'finished'; s.roundEndsAt = null; },
      removeParticipant(s, pid) {
        delete s.participants[pid];
        Object.values(s.teams).forEach(t => { t.members = t.members.filter(m => m !== pid); });
        Object.keys(s.requests).forEach(k => {
          if (s.requests[k].from === pid || s.requests[k].to === pid) delete s.requests[k];
        });
        Object.values(s.groups).forEach(g => {
          g.members = g.members.filter(m => m !== pid);
          if (g.members.length < 2) delete s.groups[g.id];
        });
      },
      splitGroup(s, gid) { delete s.groups[gid]; }
    },

    /* ---------- tutor views ---------- */
    stats(s) {
      const ps = Object.values(s.participants);
      const answered = ps.filter(p => L.answered(s, p)).length;
      const paired = ps.filter(p => L.groupOf(s, p.id)).length;
      return { joined: ps.length, answered, paired, unpaired: answered - paired };
    },

    statusOf(s, p) {
      if (s.phase === 'finished') return { key: 'paired', label: 'Done' };
      if (!p.interest) return { key: 'q1', label: 'Answering' };
      if (!L.styleOf(s, p)) return { key: 'q2', label: 'Answering' };
      if (L.groupOf(s, p.id)) return { key: 'paired', label: 'Paired' };
      const req = L.requestOf(s, p.id);
      if (req) return { key: 'ready', label: 'Waiting on ' + s.participants[req.to].name };
      return { key: 'ready', label: 'Looking' };
    },

    /* who would team up with whom, across all rounds */
    responses(s) {
      const fb = Object.values(s.feedback);
      const choice = (from, to) => {
        const list = fb.filter(f => f.from === from && f.to === to).sort((x, y) => y.round - x.round);
        return list[0] ? list[0].choice : null;
      };
      const pairsSeen = new Set();
      const rows = [];
      Object.values(s.groups).forEach(g => {
        for (let i = 0; i < g.members.length; i++) for (let j = i + 1; j < g.members.length; j++) {
          const [a, b] = [g.members[i], g.members[j]].sort();
          const key = a + '|' + b;
          if (pairsSeen.has(key) || !s.participants[a] || !s.participants[b]) continue;
          pairsSeen.add(key);
          const ab = choice(a, b), ba = choice(b, a);
          const score = { yes: 2, maybe: 1, no: 0 };
          rows.push({
            a: s.participants[a], b: s.participants[b], round: g.round,
            ab, ba,
            mutual: ab === 'yes' && ba === 'yes',
            score: (score[ab] ?? 0) + (score[ba] ?? 0),
            vetoed: ab === 'no' || ba === 'no'
          });
        }
      });
      return rows.sort((x, y) => (y.mutual - x.mutual) || (y.score - x.score));
    },

    toCSV(s) {
      const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
      const rounds = Array.from({ length: s.round }, (_, i) => i + 1);
      const head = ['Name', 'Student ID', 'PIN', 'Interest', 'Team',
        ...rounds.flatMap(r => [`R${r} style`, `R${r} partners`, `R${r} would team up`])];
      const lines = [head.map(esc).join(',')];
      Object.values(s.participants).forEach(p => {
        const cells = [p.name, p.studentId, p.pin, L.interest(p.interest)?.label || '', L.teams.teamOf(s, p.id)?.name || ''];
        rounds.forEach(r => {
          const partners = L.partnersOf(s, p.id, r);
          cells.push(L.style(p.styles[r])?.label || '');
          cells.push(partners.map(x => x.name).join('; '));
          cells.push(partners.map(x => {
            const f = s.feedback[`${r}_${p.id}_${x.id}`];
            return f ? `${x.name}: ${f.choice}` : '';
          }).filter(Boolean).join('; '));
        });
        lines.push(cells.map(esc).join(','));
      });
      return lines.join('\n');
    }
  };

  /* ==========================================================
     Project teams (tutor builds and confirms these at the end)
     - Mutual "Keen" answers are the strongest signal.
     - "Not this time" from either side keeps two people apart.
     ========================================================== */
  L.teams = {
    list: s => Object.values(s.teams).sort((a, b) => a.n - b.n),
    teamOf: (s, pid) => Object.values(s.teams).find(t => t.members.includes(pid)) || null,
    unassigned: s => Object.values(s.participants).filter(p => !L.teams.teamOf(s, p.id)),
    confirmed: s => !!s.teamsConfirmedAt,

    /* latest answer a gave about b, across all rounds */
    choice(s, a, b) {
      let best = null;
      Object.values(s.feedback).forEach(f => {
        if (f.from === a && f.to === b && (!best || f.round > best.round)) best = f;
      });
      return best ? best.choice : null;
    },
    score(s, a, b) {
      const ab = L.teams.choice(s, a, b), ba = L.teams.choice(s, b, a);
      if (ab === 'no' || ba === 'no') return -100;
      const v = { yes: 2, maybe: 1 };
      return (v[ab] || 0) + (v[ba] || 0);
    },
    mutualPairs(s) { return L.responses(s).filter(r => r.mutual); },

    _guard(s) {
      if (s.teamsConfirmedAt) throw new (UserError())('Teams are confirmed. Unlock them to make changes.');
    },
    _new(s, members = []) {
      const n = Object.values(s.teams).reduce((m, t) => Math.max(m, t.n), 0) + 1;
      const t = { id: L.id(8), n, name: `Team ${n}`, members };
      s.teams[t.id] = t;
      return t;
    },

    setSize(s, size) {
      s.settings.teamSize = Math.min(TU.DEFAULTS.maxTeamSize, Math.max(TU.DEFAULTS.minTeamSize, size));
    },

    /* draft teams from everyone's answers */
    build(s) {
      L.teams._guard(s);
      const ids = Object.keys(s.participants);
      if (ids.length < 2) throw new (UserError())('Need at least two students to build teams.');
      const N = s.settings.teamSize;
      const k = Math.max(1, Math.round(ids.length / N));
      const base = Math.floor(ids.length / k), extra = ids.length % k;
      const caps = Array.from({ length: k }, (_, i) => base + (i < extra ? 1 : 0));
      const teams = caps.map(() => []);
      const sc = (a, b) => L.teams.score(s, a, b);
      const fit = (members, t) => members.reduce((sum, m) => sum + t.reduce((x, o) => x + sc(m, o), 0), 0);
      const newColour = (pid, t) => {
        const c = s.participants[pid].interest;
        return c && !t.some(o => s.participants[o].interest === c) ? 0.3 : 0;
      };
      const placeGroup = members => {
        let best = -1, bestVal = -Infinity;
        teams.forEach((t, i) => {
          if (caps[i] - t.length < members.length) return;
          const v = fit(members, t) - t.length * 0.01;
          if (v > bestVal) { bestVal = v; best = i; }
        });
        if (best < 0) return false;
        teams[best].push(...members);
        return true;
      };
      const placeOne = pid => {
        let best = -1, bestVal = -Infinity;
        teams.forEach((t, i) => {
          if (t.length >= caps[i]) return;
          const v = fit([pid], t) + newColour(pid, t) - t.length * 0.01;
          if (v > bestVal) { bestVal = v; best = i; }
        });
        teams[best].push(pid);
      };

      // 1. keep mutual "keen" pairs together (chains like A-B, B-C become one cluster)
      const parent = Object.fromEntries(ids.map(i => [i, i]));
      const find = x => (parent[x] === x ? x : (parent[x] = find(parent[x])));
      L.teams.mutualPairs(s).forEach(r => { parent[find(r.a.id)] = find(r.b.id); });
      const clusters = {};
      ids.forEach(i => (clusters[find(i)] = clusters[find(i)] || []).push(i));
      const groups = Object.values(clusters).filter(c => c.length > 1).sort((a, b) => b.length - a.length);
      const placed = new Set();
      groups.forEach(c => { if (placeGroup(c)) c.forEach(i => placed.add(i)); });

      // 2. everyone else goes where they fit best (most positive answers, avoids vetoes)
      const links = pid => ids.reduce((n, o) => n + Math.max(0, sc(pid, o)), 0);
      ids.filter(i => !placed.has(i)).sort((a, b) => links(b) - links(a)).forEach(placeOne);

      s.teams = {};
      teams.filter(t => t.length).forEach(t => L.teams._new(s, t));
    },

    move(s, pid, teamId) {
      L.teams._guard(s);
      Object.values(s.teams).forEach(t => { t.members = t.members.filter(m => m !== pid); });
      if (teamId && s.teams[teamId]) s.teams[teamId].members.push(pid);
    },
    add(s) { L.teams._guard(s); return L.teams._new(s).id; },
    remove(s, id) { L.teams._guard(s); delete s.teams[id]; },
    clear(s) { L.teams._guard(s); s.teams = {}; },
    confirm(s) {
      if (!Object.values(s.teams).some(t => t.members.length)) throw new (UserError())('Build or add some teams first.');
      Object.values(s.teams).forEach(t => { if (!t.members.length) delete s.teams[t.id]; });
      s.teamsConfirmedAt = Date.now();
    },
    unlock(s) { s.teamsConfirmedAt = null; },

    /* warnings shown on each team card */
    notes(s, t) {
      const out = { keen: [], vetoes: [] };
      for (let i = 0; i < t.members.length; i++) for (let j = i + 1; j < t.members.length; j++) {
        const a = t.members[i], b = t.members[j];
        const ab = L.teams.choice(s, a, b), ba = L.teams.choice(s, b, a);
        if (ab === 'yes' && ba === 'yes') out.keen.push([a, b]);
        if (ab === 'no') out.vetoes.push([a, b]);
        if (ba === 'no') out.vetoes.push([b, a]);
      }
      return out;
    }
  };

  TU.logic = L;
})();
