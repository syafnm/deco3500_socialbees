/* Student — join page */
(async function () {
  const { ui, logic } = TU;
  const { $ } = ui;
  await Store.ready();

  const show = id => ['#codeForm', '#joinForm', '#loading'].forEach(s => { $(s).hidden = s !== id; });
  const meKey = c => 'teamup:me:' + c;

  async function load(code) {
    show('#loading');
    const s = code && await Store.get(code);
    if (!s) {
      show('#codeForm');
      if (code) $('#codeError').textContent = `No session with the code ${code}. Check the screen and try again.`;
      $('#code').value = code || '';
      return;
    }
    // already joined on this device → straight to the app
    const me = sessionStorage.getItem(meKey(code));
    if (me && s.participants[me]) { location.replace('app.html?s=' + code); return; }

    if (s.phase === 'finished') {
      show('#codeForm');
      $('#codeError').textContent = 'That session has finished.';
      return;
    }
    $('#sessionTag').innerHTML = `<strong>${ui.esc(s.course)}</strong> ${ui.esc(s.title)}<span class="muted">with ${ui.esc(s.tutor)}</span>`;
    $('#syncNote').innerHTML = ui.syncNotice();
    show('#joinForm');
    $('#joinForm').dataset.code = code;
    $('#name').focus();
  }

  $('#code').addEventListener('input', e => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); });
  $('#codeForm').addEventListener('submit', e => {
    e.preventDefault();
    const code = $('#code').value.trim();
    if (code.length !== 6) { $('#codeError').textContent = 'Session codes are 6 characters.'; return; }
    history.replaceState(null, '', '?s=' + code);
    load(code);
  });

  $('#joinForm').addEventListener('submit', async e => {
    e.preventDefault();
    const code = e.target.dataset.code;
    const name = $('#name').value.trim();
    const sid = $('#sid').value.trim().replace(/\s+/g, '');
    const err = $('#joinError');
    $('#name').classList.toggle('is-invalid', !name);
    $('#sid').classList.toggle('is-invalid', !/^[A-Za-z0-9]{5,10}$/.test(sid));
    if (!name) { err.textContent = 'Add your name.'; return; }
    if (!/^[A-Za-z0-9]{5,10}$/.test(sid)) { err.textContent = 'Student IDs are 5 to 10 letters or numbers.'; return; }

    const btn = e.target.querySelector('button');
    btn.disabled = true;
    try {
      const pid = await Store.update(code, s => logic.joinStudent(s, { name, studentId: sid }));
      sessionStorage.setItem(meKey(code), pid);
      location.href = 'app.html?s=' + code;
    } catch (ex) {
      err.textContent = ex.message || 'Could not join. Try again.';
      btn.disabled = false;
    }
  });

  load((ui.param('s') || '').toUpperCase());
})();
