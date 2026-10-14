/* Tutor — session setup page */
(async function () {
  const { ui, logic } = TU;
  await Store.ready();

  const form = ui.$('#setupForm');
  const minutes = ui.$('#minutes');
  const out = ui.$('#minutesOut');
  const err = ui.$('#formError');

  // remember tutor name between sessions
  const savedName = localStorage.getItem('teamup:v1:tutorName');
  if (savedName) ui.$('#tutor').value = savedName;

  minutes.addEventListener('input', () => { out.textContent = minutes.value + ' min'; });

  const teamSize = ui.$('#teamSize');
  const clampTeam = v => Math.min(TU.DEFAULTS.maxTeamSize, Math.max(TU.DEFAULTS.minTeamSize, Math.round(Number(v) || TU.DEFAULTS.teamSize)));
  ui.$$('[data-step]').forEach(b => b.addEventListener('click', () => {
    teamSize.value = clampTeam(Number(teamSize.value) + Number(b.dataset.step));
  }));
  teamSize.addEventListener('change', () => { teamSize.value = clampTeam(teamSize.value); });

  form.addEventListener('submit', async e => {
    e.preventDefault();
    err.textContent = '';
    const fields = ['course', 'title', 'tutor'].map(id => ui.$('#' + id));
    let ok = true;
    fields.forEach(f => {
      const bad = !f.value.trim();
      f.classList.toggle('is-invalid', bad);
      if (bad) ok = false;
    });
    if (!ok) { err.textContent = 'Fill in the course code, session name and your name.'; return; }

    const btn = form.querySelector('button[type=submit]');
    btn.disabled = true;
    try {
      let session, tries = 0;
      while (true) {
        session = logic.newSession({
          course: ui.$('#course').value.toUpperCase(),
          title: ui.$('#title').value,
          tutor: ui.$('#tutor').value,
          roundMinutes: Number(minutes.value),
          allowRepeats: ui.$('#repeats').checked,
          teamSize: clampTeam(teamSize.value)
        });
        try { await Store.create(session); break; }
        catch (e) { if (++tries > 5) throw e; }   // code collision, roll another
      }
      localStorage.setItem('teamup:v1:tutorName', session.tutor);
      Store.rememberSession({ code: session.code, course: session.course, title: session.title, createdAt: session.createdAt });
      location.href = 'dashboard.html?s=' + session.code;
    } catch (e) {
      err.textContent = e.message || 'Could not create the session. Try again.';
      btn.disabled = false;
    }
  });

  // recent sessions
  const mine = Store.mySessions();
  if (mine.length) {
    ui.$('#recentWrap').hidden = false;
    ui.$('#recent').innerHTML = mine.map(m => `
      <li>
        <a href="dashboard.html?s=${ui.esc(m.code)}">
          <strong>${ui.esc(m.course)}</strong> ${ui.esc(m.title)}
          <span class="muted small">${new Date(m.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</span>
        </a>
        <code>${ui.esc(m.code)}</code>
      </li>`).join('');
  }
})();
