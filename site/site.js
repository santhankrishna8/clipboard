// Clipvault site: small working pieces of the real product. Nothing here talks to a network.
// The installer is attached to the latest GitHub release under this fixed name, so this link keeps working across versions.
const RELEASE_URL = 'https://github.com/santhankrishna8/clipboard/releases/latest/download/Clipvault-Setup.exe';

(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---- the same checks the app runs (src/app/validate.ts) --------------------------------------------------------
  const D = ['0123456789', '1234067895', '2340178956', '3401289567', '4012395678', '5987604321', '6598710432', '7659821043', '8765932104', '9876543210'];
  const P = ['0123456789', '1576283094', '5803796142', '8916043527', '9453126870', '4286573901', '2793806415', '7046913258'];
  const verhoeff = (s) => { let c = 0; [...s].reverse().forEach((ch, i) => (c = +D[c][+P[i % 8][+ch]])); return c === 0; };
  const digitsOf = (s) => s.replace(/\D/g, '');
  const aadhaarOk = (s) => /^[2-9]\d{11}$/.test(s) && verhoeff(s);
  const luhn = (s) => { let t = 0; [...s].reverse().forEach((ch, i) => { let n = +ch; if (i % 2) n = n * 2 > 9 ? n * 2 - 9 : n * 2; t += n; }); return t % 10 === 0; };
  const PAN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
  const mask = (v, keep = 4) => { let seen = 0; return [...v].reverse().map((ch) => (/[\s-]/.test(ch) ? ch : seen++ < keep ? ch : '•')).reverse().join(''); };
  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

  // ---- comb boxes ----------------------------------------------------------------------------------------------------
  function comb(el, value, hidden) {
    const shown = hidden ? mask(value) : value;
    let i = 0;
    el.innerHTML = shown.split(/\s+/).filter(Boolean).map((g) => `<span class="grp" aria-hidden="true">${[...g].map((ch) => `<span class="cell${ch === '•' ? ' dot' : ''}" style="--i:${i++}">${ch === '•' ? '' : esc(ch)}</span>`).join('')}</span>`).join('');
    el.setAttribute('aria-label', hidden ? `Aadhaar number, hidden, ends in ${value.replace(/\s/g, '').slice(-4)}` : `Aadhaar number: ${[...value.replace(/\s/g, '')].join(' ')}`);
  }
  function write(el) {
    el.classList.remove('written');
    void el.offsetWidth;
    el.classList.add('written');
    setTimeout(() => el.classList.remove('written'), 1500);
  }

  // ---- hero: the Aadhaar card -----------------------------------------------------------------------------------------
  const DEMO = '2345 6789 0124'; // a synthetic number that passes the checksum
  let value = DEMO, hidden = true, timer;
  const digits = $('#digits'), show = $('#show'), note = $('#hero-note');
  comb(digits, value, hidden);
  show.addEventListener('click', () => {
    hidden = !hidden;
    show.textContent = hidden ? 'Show' : 'Hide';
    show.setAttribute('aria-pressed', String(!hidden));
    comb(digits, value, hidden);
  });
  $('#copy').addEventListener('click', () => {
    write(digits);
    let left = 30;
    clearInterval(timer);
    const tick = () => (note.textContent = left > 0 ? `Copied. In the app, this clears from your clipboard in ${left} seconds. (This demo never touches your real clipboard.)` : 'In the app, the clipboard has been cleared by now.');
    tick();
    timer = setInterval(() => { left -= 1; tick(); if (left < 0) clearInterval(timer); }, 1000);
  });
  $('[data-copy-plain]').addEventListener('click', () => { note.textContent = 'Copied. Names are plain text, so they are not hidden or cleared.'; });

  const tryIn = $('#try'), tryNote = $('#try-note');
  tryIn.addEventListener('input', () => {
    const raw = tryIn.value.trim();
    tryNote.className = '';
    if (!raw) { value = DEMO; comb(digits, value, hidden); tryNote.textContent = 'Nothing you type here leaves this page.'; return; }
    const d = digitsOf(raw);
    value = d.length === 12 ? d.replace(/(\d{4})(?=\d)/g, '$1 ') : raw.slice(0, 22);
    comb(digits, value, hidden);
    if (d.length === 12 && aadhaarOk(d)) { tryNote.textContent = 'That passes the Aadhaar checksum.'; tryNote.className = 'ok'; }
    else if (d.length === 12) { tryNote.textContent = 'This does not look like a valid Aadhaar number. Clipvault would still save it, with a gentle warning.'; tryNote.className = 'bad'; }
    else tryNote.textContent = `${d.length} of 12 digits. Clipvault checks the last digit for you.`;
  });

  // ---- step two: find it ---------------------------------------------------------------------------------------------------
  const ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h8"/></svg>';
  const row = (title, sub, tag, on = true) => `<div class="u-row${on ? ' on' : ''}"><span class="u-ico">${ICON}</span><span class="u-txt"><b>${title}</b><i>${sub}</i></span>${tag ? `<span class="slip${tag === 'Similar meaning' ? ' blue' : ''}">${tag}</span>` : ''}</div>`;
  const RESULTS = [
    row('Flight 6E 2145 · Hyderabad → Bengaluru · 14 Nov, 0…', 'Text · WhatsApp · just now', 'Similar meaning'),
    row('Flight 6E 2145 · Hyderabad → Bengaluru · 14 Nov, 06:40 · PNR <mark>K4X9QZ</mark>', 'Text · WhatsApp · just now', 'Exact text'),
    row('Rent for November — UPI ID asha.rao@okexample — ₹18,500', 'Text · Notepad · 41 minutes ago', 'Similar meaning'),
  ];
  const results = $('#results'), qIn = $('#q'), chips = $$('.chip');
  const setQ = (n) => { results.innerHTML = RESULTS[n]; qIn.value = chips[n].textContent; chips.forEach((c, i) => c.setAttribute('aria-pressed', String(i === n))); };
  chips.forEach((c, i) => c.addEventListener('click', () => setQ(i)));
  setQ(0);

  // ---- step three: the popup -------------------------------------------------------------------------------------------------
  const IDS = [
    ['Aadhaar', '0124'], ['PAN card', '234F'], ['Driving licence', '3456'], ['Passport', '4567'], ['Voter ID', '4567'], ['Sample Bank · savings', '5678'],
  ];
  const plist = $('#p-list'), pq = $('#pq'), echo = $('#pq-echo');
  const KEYS = { aadhaar: 'Aadhaar', pan: 'PAN card', licence: 'Driving licence', dl: 'Driving licence', passport: 'Passport', voter: 'Voter ID', bank: 'Sample Bank · savings', account: 'Sample Bank · savings' };
  function popup() {
    const q = pq.value.trim().toLowerCase();
    echo.textContent = pq.value || ' ';
    const hits = IDS.filter(([t]) => !q || t.toLowerCase().includes(q) || Object.entries(KEYS).some(([k, v]) => v === t && (k.startsWith(q) || q.startsWith(k))));
    plist.innerHTML = hits.length
      ? hits.map(([t, tail], i) => `<li class="u-row${i === 0 ? ' on' : ''}"><span class="u-ico">${ICON}</span><span class="u-txt"><b>${t}</b><i>Pastes the full number</i></span><span class="mini" aria-hidden="true">${[...tail].map((c) => `<i>${c}</i>`).join('')}</span></li>`).join('')
      : '<li class="p-empty">Nothing matches. Try pan, aadhaar, bank or licence.</li>';
  }
  pq.addEventListener('input', popup);
  popup();

  // ---- switches ------------------------------------------------------------------------------------------------------------
  $$('.band').forEach((b) => {
    const sw = $('.sw', b);
    const set = (on) => { b.classList.toggle('on', on); sw.setAttribute('aria-checked', String(on)); };
    set(b.dataset.on === '1');
    sw.addEventListener('click', () => set(sw.getAttribute('aria-checked') !== 'true'));
  });

  // ---- what it hides --------------------------------------------------------------------------------------------------------
  const note2 = $('#note'), dList = $('#d-list'), dTitle = $('#d-title');
  const RULES = [
    ['Secret key', /\b(?:sk-[\w-]{16,}|gh[pousr]_\w{20,}|AKIA[0-9A-Z]{16})\b/g, () => true, 60],
    ['Card number', /\b(?:\d[ -]?){13,19}\b/g, (v) => luhn(digitsOf(v)) && digitsOf(v).length >= 13, 60],
    ['Aadhaar number', /\b\d{4}[ -]?\d{4}[ -]?\d{4}\b/g, (v) => aadhaarOk(digitsOf(v)), 60],
    ['PAN', /\b[A-Za-z]{5}\d{4}[A-Za-z]\b/g, (v) => PAN.test(v.toUpperCase()), 60],
    ['One-time code', /\b\d{4,8}\b/g, () => true, 10],
  ];
  function detect() {
    let text = note2.value;
    const found = [];
    for (const [kind, re, ok, mins] of RULES) {
      text = text.replace(re, (m) => { if (!ok(m)) return m; found.push([kind, m.trim(), mins]); return ' '.repeat(m.length); });
    }
    dTitle.textContent = found.length ? `${found.length} ${found.length === 1 ? 'thing' : 'things'} hidden from your history` : 'Nothing looks private in this note.';
    dList.innerHTML = found.map(([kind, m, mins]) => `<li class="u-row on"><span class="u-ico">${ICON}</span><span class="u-txt"><b>${esc(mask(m))}</b><i>${kind} · removed after ${mins} minutes</i></span><span class="slip">Hidden</span></li>`).join('');
  }
  note2.addEventListener('input', detect);
  detect();

  const dl = $('#dl');
  if (RELEASE_URL) {
    dl.href = RELEASE_URL;
    dl.hidden = false;
    $('#dl-warn').hidden = false;
    $('#dl-note').textContent = 'Download the installer (about 176 MB), or build it yourself from source.';
  }

  // ---- install command ------------------------------------------------------------------------------------------------------
  $('#cmd-copy').addEventListener('click', async (e) => {
    const b = e.currentTarget;
    try { await navigator.clipboard.writeText($('#cmd').textContent); b.textContent = 'Copied'; } catch { b.textContent = 'Select and copy'; }
    setTimeout(() => (b.textContent = 'Copy'), 1600);
  });

  // ---- a live detail: your own time ------------------------------------------------------------------------------------------
  const clock = $('#clock'), fmt = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
  const tickClock = () => (clock.textContent = fmt.format(new Date()));
  tickClock();
  setInterval(tickClock, 20000);

  // ---- the clip plays only while it is on screen, and never for people who asked for less motion ------------------------------
  const clip = $('#clip');
  if (clip && !calm && 'IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => (e.isIntersecting ? clip.play().catch(() => {}) : clip.pause()), { threshold: 0.4 }).observe(clip);
  }

  // ---- entrances ---------------------------------------------------------------------------------------------------------------
  const rise = $$('.rise');
  const bars = $('.bars');
  $$('.bar').forEach((b, n) => b.style.setProperty('--n', n));
  if ('IntersectionObserver' in window && !calm) {
    const io = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add('in');
      io.unobserve(e.target);
    }), { threshold: 0.18, rootMargin: '0px 0px -6% 0px' });
    rise.forEach((el, i) => { el.style.setProperty('--d', `${(i % 3) * 80}ms`); io.observe(el); });
    io.observe(bars);
  } else {
    rise.forEach((el) => el.classList.add('in'));
    bars.classList.add('in');
  }
})();
