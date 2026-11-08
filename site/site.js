// Clipvault site: small working pieces of the real product. Nothing here talks to a network,
// and the voice demo plays a recorded sample: the microphone is never used.
// The installer is attached to the latest GitHub release under this fixed name, so this link keeps working across versions.
const RELEASE_URL = 'https://github.com/santhankrishna8/clipboard/releases/latest/download/Clipvault-Setup.exe';

(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const onScreen = (el, fn) => {
    if (!('IntersectionObserver' in window)) return fn(true);
    new IntersectionObserver(([e]) => fn(e.isIntersecting), { threshold: 0.2 }).observe(el);
  };

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

  // ---- the ID tile: an Aadhaar number in comb boxes -----------------------------------------------------------------------------------------
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

  // ---- waveforms: bars that move like a voice ---------------------------------------------------------------------
  function wave(el, n) {
    el.innerHTML = '<i></i>'.repeat(n);
    const bars = [...el.children];
    let on = false, t = 0, raf = 0;
    const draw = () => {
      t += 0.09;
      bars.forEach((b, i) => {
        const mid = 1 - Math.abs(i - (n - 1) / 2) / (n / 2);
        const v = on ? 0.18 + mid * 0.7 * Math.abs(Math.sin(t * 1.7 + i * 0.9) * Math.cos(t * 0.6 + i * 0.35)) + Math.random() * 0.12 : 0.15;
        b.style.transform = `scaleY(${Math.min(1, v).toFixed(3)})`;
      });
      raf = requestAnimationFrame(draw);
    };
    return {
      set(v) {
        on = v;
        if (calm) return bars.forEach((b, i) => (b.style.transform = `scaleY(${v ? 0.3 + ((i * 7) % 5) / 8 : 0.15})`));
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(draw);
      },
      stop() { cancelAnimationFrame(raf); },
    };
  }

  // ---- hero: the history fills itself ---------------------------------------------------------------------------------
  const FEED = [
    ['T', '', 'Flight 6E 2145 · Hyderabad → Bengaluru · 14 Nov, 06:40', 'WhatsApp · just now', ''],
    ['', 'img', 'Screenshot 1920×1080', 'Snipping Tool · just now', ''],
    ['<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 17v5"/></svg>', 'voice', 'Hi Priya, I will bring the rent agreement on Friday.', 'Dictation · just now', 'Voice'],
    ['•', 'lock', 'One-time code ••••10', 'Messages · removed in 10 min', 'Hidden'],
    ['T', '', 'git push origin main', 'Windows Terminal · just now', ''],
    ['F', '', 'Rent agreement.pdf', 'Explorer · just now', ''],
    ['T', '', 'asha.rao@okexample', 'Chrome · just now', ''],
  ];
  const feed = $('#feed');
  const item = ([ico, cls, t, s, tag], fresh) => `<div class="it${fresh ? ' new' : ''}"><span class="ico ${cls}">${ico}</span><span class="tx"><b>${t}</b><i>${s}</i></span>${tag ? `<span class="tag">${tag}</span>` : ''}</div>`;
  let fi = 3;
  feed.innerHTML = FEED.slice(0, 3).reverse().map((x) => item(x)).join('');
  const heroWave = wave($('#hero-wave'), 16);
  heroWave.set(true);
  if (!calm) {
    let live = true;
    onScreen(feed, (v) => { live = v; heroWave.set(v); });
    setInterval(() => {
      if (!live || document.hidden) return;
      feed.insertAdjacentHTML('afterbegin', item(FEED[fi++ % FEED.length], true));
      while (feed.children.length > 6) feed.lastElementChild.remove();
    }, 2600);
  }

  // ---- bento: the light follows the pointer; the search tile types ---------------------------------------------------
  $$('.tile').forEach((t) => t.addEventListener('pointermove', (e) => {
    const r = t.getBoundingClientRect();
    t.style.setProperty('--mx', `${e.clientX - r.left}px`);
    t.style.setProperty('--my', `${e.clientY - r.top}px`);
  }));
  const typedEl = $('#ms-typed'), hit = $('.ms-hit');
  const QUERIES = ['when does my plane leave for Bangalore', 'the landlord\'s UPI ID', 'that screenshot of the error'];
  const HITS = ['Flight 6E 2145 · 14 Nov, 06:40', 'Rent for November · asha.rao@okexample', 'Screenshot 1920×1080 · Snipping Tool'];
  (async () => {
    if (calm) { typedEl.textContent = QUERIES[0]; hit.classList.add('show'); return; }
    for (let n = 0; ; n = (n + 1) % QUERIES.length) {
      hit.classList.remove('show');
      typedEl.textContent = '';
      for (const ch of QUERIES[n]) { typedEl.textContent += ch; await sleep(45 + Math.random() * 50); }
      await sleep(350);
      hit.firstElementChild.textContent = HITS[n];
      hit.classList.add('show');
      await sleep(2800);
    }
  })();

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

  // ---- voice typing demo ---------------------------------------------------------------------------------------------
  // [what was said, with fillers in {braces}] -> what Clipvault types. The same clean-up rules as electron/text.ts.
  const SAMPLES = [
    'Hi Priya, {um,} just checking we are still on for Friday. {Uh,} new line I will bring the rent agreement and the {uh} PAN copy.',
    'Quick note for the team: {um} the release is moving to Monday, {uh,} so please finish your reviews by Friday evening.',
    'Can you send me the invoice for October? new paragraph Thanks, {um,} Asha',
  ];
  const tidy = (s) => s.replace(/\{[^}]*\}\s*/g, '').replace(/\s*new paragraph\s*/gi, '\n\n').replace(/\s*new line\s*/gi, '\n').replace(/ +/g, ' ').replace(/(^|\n)([a-z])/g, (_m, a, b) => a + b.toUpperCase()).trim();
  const showSaid = (s) => esc(s).replace(/\{([^}]*)\}/g, '<s>$1</s>');
  const hold = $('#hold'), vPill = $('#v-pill'), vState = $('#v-state'), vOut = $('#v-out'), vRaw = $('#v-raw'), vSaid = $('#v-said');
  const vWave = wave($('#v-wave'), 18);
  vWave.set(false);
  let sample = 0, down = 0, typing = 0, busy = false;
  const start = () => {
    if (down || busy) return;
    down = Date.now();
    hold.classList.add('on');
    vPill.className = 'v-pill on';
    vState.textContent = 'Listening';
    vWave.set(true);
  };
  const end = async () => {
    if (!down) return;
    const held = Date.now() - down;
    down = 0;
    hold.classList.remove('on');
    vWave.set(false);
    if (held < 500) {
      vPill.className = 'v-pill';
      vState.textContent = 'Hold a little longer';
      return;
    }
    busy = true;
    vPill.className = 'v-pill busy';
    vState.textContent = 'Writing…';
    const said = SAMPLES[sample++ % SAMPLES.length], text = tidy(said);
    await sleep(calm ? 0 : 450);
    vSaid.innerHTML = showSaid(said);
    vRaw.hidden = false;
    const mine = ++typing;
    vOut.textContent = '';
    const caret = document.createElement('span');
    caret.className = 'caret';
    const out = document.createTextNode('');
    vOut.append(out, caret);
    if (calm) out.textContent = text;
    else for (const w of text.split(/(?<=\s)/)) { if (mine !== typing) return; out.textContent += w; await sleep(38); }
    vPill.className = 'v-pill';
    vState.textContent = 'Pasted ✓';
    busy = false;
  };
  hold.addEventListener('pointerdown', (e) => { e.preventDefault(); hold.setPointerCapture(e.pointerId); start(); });
  hold.addEventListener('pointerup', end);
  hold.addEventListener('pointercancel', end);
  hold.addEventListener('keydown', (e) => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); start(); } });
  hold.addEventListener('keyup', (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); void end(); } });
  hold.addEventListener('click', (e) => e.preventDefault());
  // The space bar works anywhere in the voice section, as the shortcut does in the app.
  const voiceSec = $('#voice');
  let inVoice = false;
  onScreen(voiceSec, (v) => (inVoice = v));
  const typingTarget = (t) => t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT|BUTTON|SUMMARY|A)$/.test(t.tagName));
  addEventListener('keydown', (e) => { if (e.key === ' ' && inVoice && !e.repeat && !typingTarget(e.target)) { e.preventDefault(); start(); } });
  addEventListener('keyup', (e) => { if (e.key === ' ' && down && !typingTarget(e.target)) void end(); });

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
    $('#dl-note').textContent = 'Download the installer (about 250 MB), or build it yourself from source.';
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

  // ---- numbers count up when they come into view ---------------------------------------------------------------------
  $$('[data-count]').forEach((el) => {
    const to = +el.dataset.count;
    if (calm || !to) return void (el.textContent = String(to));
    let done = false;
    onScreen(el, (v) => {
      if (!v || done) return;
      done = true;
      const t0 = performance.now();
      const step = (t) => {
        const p = Math.min(1, (t - t0) / 1400), e = 1 - Math.pow(1 - p, 3);
        el.textContent = String(Math.round(to * e));
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  });

  // ---- entrances -------------------------------------------------------------------------------------------------------
  const rise = $$('.rise');
  if ('IntersectionObserver' in window && !calm) {
    const io = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add('in');
      io.unobserve(e.target);
    }), { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    rise.forEach((el, i) => { el.style.setProperty('--d', `${(i % 3) * 80}ms`); io.observe(el); });
  } else rise.forEach((el) => el.classList.add('in'));
})();
