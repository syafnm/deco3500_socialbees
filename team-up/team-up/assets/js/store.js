/* ==========================================================
   Team Up — data store
   One small API used by every page:
     await Store.ready()
     await Store.get(code)            → session | null
     await Store.create(session)
     await Store.update(code, mutate) → whatever mutate returns
                                       (mutate edits the session in place,
                                        throw TU.UserError to cancel)
     Store.subscribe(code, cb)        → unsubscribe()
   Two adapters: localStorage (default) and Firebase Realtime DB.
   ========================================================== */
(function () {
  const TU = window.TU;

  class UserError extends Error {}
  TU.UserError = UserError;

  /* Firebase drops empty objects, so restore the shape every time */
  function normalise(s) {
    if (!s) return null;
    s.participants = s.participants || {};
    s.groups = s.groups || {};
    s.feedback = s.feedback || {};
    s.requests = s.requests || {};
    s.teams = s.teams || {};
    Object.values(s.teams).forEach(t => { t.members = t.members || []; });
    s.settings = Object.assign({}, TU.DEFAULTS, s.settings || {});
    Object.values(s.participants).forEach(p => { p.styles = p.styles || {}; });
    Object.values(s.groups).forEach(g => { g.members = g.members || []; g.prompts = g.prompts || []; });
    return s;
  }

  /* ---------------- localStorage adapter ---------------- */
  const LS_KEY = 'teamup:v1:sessions';
  const localSubs = new Set();

  const localAdapter = {
    name: 'local',
    _all() {
      try { return JSON.parse(localStorage.getItem(LS_KEY)) || {}; }
      catch (e) { return {}; }
    },
    _save(all) {
      localStorage.setItem(LS_KEY, JSON.stringify(all));
      localSubs.forEach(fn => fn());
    },
    async get(code) {
      const s = this._all()[code];
      return s ? normalise(s) : null;
    },
    async create(session) {
      const all = this._all();
      if (all[session.code]) throw new UserError('That session code is already in use.');
      all[session.code] = session;
      this._save(all);
      return session;
    },
    async update(code, mutate) {
      const all = this._all();
      if (!all[code]) throw new UserError('This session no longer exists.');
      const s = normalise(all[code]);
      const out = mutate(s);           // throws → nothing saved
      all[code] = s;
      this._save(all);
      return out;
    },
    subscribe(code, cb) {
      let last;
      const check = () => {
        const raw = JSON.stringify(this._all()[code] || null);
        if (raw !== last) { last = raw; cb(normalise(JSON.parse(raw))); }
      };
      const onStorage = e => { if (e.key === LS_KEY) check(); };
      window.addEventListener('storage', onStorage);   // other tabs
      localSubs.add(check);                            // this tab
      const poll = setInterval(check, 1500);           // safety net
      check();
      return () => {
        window.removeEventListener('storage', onStorage);
        localSubs.delete(check);
        clearInterval(poll);
      };
    }
  };

  /* ---------------- Firebase adapter ---------------- */
  function firebaseAdapter(db) {
    const ref = code => db.ref('sessions/' + code);
    return {
      name: 'firebase',
      async get(code) {
        const snap = await ref(code).get();
        return snap.exists() ? normalise(snap.val()) : null;
      },
      async create(session) {
        const res = await ref(session.code).transaction(cur => (cur ? undefined : session));
        if (!res.committed) throw new UserError('That session code is already in use.');
        return session;
      },
      async update(code, mutate) {
        let err = null, out;
        const res = await ref(code).transaction(cur => {
          if (cur === null) return null;   // Firebase retries with the server value
          err = null;
          try {
            const s = normalise(cur);
            out = mutate(s);
            return s;
          } catch (e) { err = e; return undefined; }  // abort
        });
        if (err) throw err;
        if (!res.snapshot.exists()) throw new UserError('This session no longer exists.');
        return out;
      },
      subscribe(code, cb) {
        const handler = snap => cb(normalise(snap.val()));
        ref(code).on('value', handler);
        return () => ref(code).off('value', handler);
      }
    };
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const el = document.createElement('script');
      el.src = src; el.onload = resolve; el.onerror = reject;
      document.head.appendChild(el);
    });
  }

  let adapter = localAdapter;
  const readyPromise = (async () => {
    const cfg = TU.FIREBASE_CONFIG;
    if (!cfg) return adapter;
    try {
      const v = '10.12.2';
      await loadScript(`https://www.gstatic.com/firebasejs/${v}/firebase-app-compat.js`);
      await loadScript(`https://www.gstatic.com/firebasejs/${v}/firebase-database-compat.js`);
      if (!firebase.apps.length) firebase.initializeApp(cfg);
      adapter = firebaseAdapter(firebase.database());
    } catch (e) {
      console.warn('Team Up: Firebase failed to load, using this browser only.', e);
    }
    return adapter;
  })();

  window.Store = {
    ready: () => readyPromise,
    mode: () => adapter.name,
    get: code => adapter.get(code),
    create: s => adapter.create(s),
    update: (code, fn) => adapter.update(code, fn),
    subscribe: (code, cb) => adapter.subscribe(code, cb),

    /* sessions this tutor created on this device */
    mySessions() {
      try { return JSON.parse(localStorage.getItem('teamup:v1:mine')) || []; }
      catch (e) { return []; }
    },
    rememberSession(meta) {
      const list = this.mySessions().filter(m => m.code !== meta.code);
      list.unshift(meta);
      localStorage.setItem('teamup:v1:mine', JSON.stringify(list.slice(0, 20)));
    },
    forgetSession(code) {
      const list = this.mySessions().filter(m => m.code !== code);
      localStorage.setItem('teamup:v1:mine', JSON.stringify(list));
    }
  };
})();
