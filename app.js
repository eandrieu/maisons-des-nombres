/* Les maisons des nombres
 * Application d'entraînement aux décompositions additives (maisons du 3, 4, 5, 6, 7 et 10).
 * Tout est stocké localement sur l'appareil (localStorage). Aucune donnée n'est envoyée.
 */
(() => {
  'use strict';

  // ---------------------------------------------------------------------------
  // Constantes
  // ---------------------------------------------------------------------------
  const HOUSES = [3, 4, 5, 6, 7, 10];
  const COLORS = { 3: '#E2574C', 4: '#2A9D8F', 5: '#E39B2D', 6: '#8B6AD1', 7: '#3BA864', 10: '#D94F92' };
  const ROOFS = { 3: '#A3352E', 4: '#1B6C63', 5: '#A86A12', 6: '#5C43A0', 7: '#23764A', 10: '#9B2E66' };
  const DOORS = { 3: '#7E2621', 4: '#134F48', 5: '#7A4D0C', 6: '#43307A', 7: '#195636', 10: '#73214B' };
  const NEUTRAL = { body: '#6C68A8', roof: '#47437F' };
  const TOTAL_FACTS = HOUSES.reduce((s, n) => s + n + 1, 0); // 41
  const STORE_KEY = 'maisons-des-nombres.v1';
  const MAX_HIST = 6;
  const BONUS_FULL_MS = 1500;   // bonus de rapidité maximal en dessous
  const BONUS_ZERO_MS = 6000;   // plus de bonus au-delà
  const FLASH_MS = 2000;        // « Éclair ! »
  const DEFI_START_MS = 8000;
  const DEFI_MIN_MS = 2500;
  const DEFI_FACTOR = 0.93;

  const PRAISE = ['Bravo !', 'Super !', 'Oui !', 'Génial !', 'Bien joué !', 'Parfait !', 'Exact !'];

  // ---------------------------------------------------------------------------
  // Stockage
  // ---------------------------------------------------------------------------
  const defaults = () => ({
    name: '',
    sound: true,
    roundLength: 12,
    fastMs: 3000,
    helpers: true,
    rueHouses: HOUSES.slice(),
    facts: {},
    records: {},
    starsTotal: 0,
    log: [],
    pendingLit: []
  });

  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return defaults();
      return Object.assign(defaults(), JSON.parse(raw));
    } catch (e) {
      return defaults();
    }
  }
  let S = load();
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(S)); } catch (e) { /* stockage indisponible */ }
  }

  // ---------------------------------------------------------------------------
  // Faits (une maison n, un étage a : a + (n - a) = n)
  // ---------------------------------------------------------------------------
  const fkey = (n, a) => n + ':' + a;
  function factData(n, a) { return S.facts[fkey(n, a)] || null; }

  /** 'off' (jamais vu ou dernière réponse fausse), 'warm' (dernière réponse juste), 'lit' (maîtrisé) */
  function status(n, a) {
    const f = factData(n, a);
    if (!f || !f.hist.length) return 'off';
    const h = f.hist;
    if (!h[h.length - 1].c) return 'off';
    const last3 = h.slice(-3);
    if (last3.length === 3 && last3.every(x => x.c && x.t <= S.fastMs)) return 'lit';
    return 'warm';
  }

  function recordAttempt(n, a, correct, ms) {
    const k = fkey(n, a);
    const f = S.facts[k] || (S.facts[k] = { tries: 0, ok: 0, hist: [] });
    f.tries++;
    if (correct) f.ok++;
    f.hist.push({ c: correct ? 1 : 0, t: Math.round(ms) });
    if (f.hist.length > MAX_HIST) f.hist.shift();
  }

  function litCount(n) {
    let c = 0;
    for (let a = 0; a <= n; a++) if (status(n, a) === 'lit') c++;
    return c;
  }
  function totalLit() { return HOUSES.reduce((s, n) => s + litCount(n), 0); }

  function weight(n, a) {
    const st = status(n, a);
    if (st === 'lit') return 1;
    if (st === 'warm') return 2.5;
    return factData(n, a) ? 4 : 3; // déjà raté : prioritaire
  }

  // ---------------------------------------------------------------------------
  // Outils
  // ---------------------------------------------------------------------------
  const $ = sel => document.querySelector(sel);
  const rand = arr => arr[Math.floor(Math.random() * arr.length)];
  const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
  const sameFact = (x, y) => x && y && x[0] === y[0] && x[1] === y[1];
  const fmtSec = ms => (ms / 1000).toFixed(1).replace('.', ',') + ' s';
  const fmtInt = x => Math.round(x).toLocaleString('fr-FR');
  const median = arr => {
    if (!arr.length) return null;
    const s = arr.slice().sort((p, q) => p - q);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  };
  const reducedMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function weightedSample(items, k, wfn) {
    const pool = items.slice();
    const out = [];
    while (out.length < k && pool.length) {
      const ws = pool.map(wfn);
      const tot = ws.reduce((s, x) => s + x, 0);
      let r = Math.random() * tot;
      let i = 0;
      for (; i < pool.length - 1; i++) { r -= ws[i]; if (r <= 0) break; }
      out.push(pool.splice(i, 1)[0]);
    }
    return out;
  }

  /** Évite qu'une même question tombe deux fois de suite. */
  function spreadOut(arr) {
    for (let i = 1; i < arr.length; i++) {
      if (!sameFact(arr[i], arr[i - 1])) continue;
      for (let j = i + 1; j < arr.length; j++) {
        if (!sameFact(arr[j], arr[i - 1]) && !sameFact(arr[i], arr[j - 1]) && !sameFact(arr[i], arr[j + 1])) {
          [arr[i], arr[j]] = [arr[j], arr[i]];
          break;
        }
      }
    }
    return arr;
  }

  // ---------------------------------------------------------------------------
  // Questions
  // ---------------------------------------------------------------------------
  // type 'right' : a | ?   type 'left' : ? | b   type 'house' : a | b, toit ?
  function makeQ(n, a, allowHouse) {
    let type;
    if (allowHouse && Math.random() < 0.25) type = 'house';
    else type = Math.random() < 0.5 ? 'right' : 'left';
    const b = n - a;
    const answer = type === 'house' ? n : type === 'right' ? b : a;
    return { n, a, b, type, answer, retry: false };
  }

  function rueHouses() { return S.rueHouses && S.rueHouses.length ? S.rueHouses : HOUSES; }

  function buildRound(mode) {
    const L = S.roundLength;
    let facts;
    const all = [];
    const houses = mode.kind === 'house' ? [mode.n] : rueHouses();
    houses.forEach(n => { for (let a = 0; a <= n; a++) all.push([n, a]); });
    const w = f => weight(f[0], f[1]);
    if (all.length >= L) {
      facts = weightedSample(all, L, w);
    } else {
      facts = shuffle(all.slice());
      while (facts.length < L) facts.push(weightedSample(all, 1, w)[0]);
    }
    shuffle(facts);
    spreadOut(facts);
    const allowHouse = mode.kind === 'rue' && houses.length > 1;
    return facts.map(([n, a]) => makeQ(n, a, allowHouse));
  }

  function pickDefi(recent) {
    const all = [];
    const houses = rueHouses();
    houses.forEach(n => { for (let a = 0; a <= n; a++) all.push([n, a]); });
    let pool = all.filter(f => !recent.some(r => sameFact(r, f)));
    if (!pool.length) pool = all;
    const [n, a] = weightedSample(pool, 1, f => weight(f[0], f[1]))[0];
    return makeQ(n, a, houses.length > 1);
  }

  function speedBonus(ms) {
    return Math.round(10 * clamp((BONUS_ZERO_MS - ms) / (BONUS_ZERO_MS - BONUS_FULL_MS), 0, 1));
  }
  function multiplier(streak) { return streak >= 10 ? 3 : streak >= 5 ? 2 : 1; }

  // ---------------------------------------------------------------------------
  // Sons (synthétisés, aucun fichier)
  // ---------------------------------------------------------------------------
  let AC = null;
  function audio() {
    if (!S.sound) return null;
    if (!AC) {
      try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; }
    }
    if (AC.state === 'suspended') AC.resume();
    return AC;
  }
  function tone(freq, start, dur, opt = {}) {
    const c = audio();
    if (!c) return;
    const { type = 'sine', gain = 0.18, glideTo = null } = opt;
    const t0 = c.currentTime + start;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(c.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }
  const note = s => 523.25 * Math.pow(2, s / 12);
  const SFX = {
    good(streak, fast) {
      const b = Math.min(streak, 12);
      tone(note(b), 0, 0.14, { type: 'triangle', gain: 0.2 });
      tone(note(b + 7), 0.08, 0.24, { gain: 0.16 });
      if (fast) { tone(note(b + 19), 0.17, 0.12, { gain: 0.08 }); tone(note(b + 24), 0.24, 0.18, { gain: 0.07 }); }
    },
    bad() { tone(260, 0, 0.3, { type: 'triangle', gain: 0.18, glideTo: 165 }); },
    lit() { [0, 4, 7, 12, 16].forEach((s, i) => tone(note(s + 12), i * 0.07, 0.28, { gain: 0.09 })); },
    tick() { tone(note(7), 0, 0.09, { type: 'triangle', gain: 0.12 }); },
    go() { tone(note(12), 0, 0.3, { type: 'triangle', gain: 0.18 }); tone(note(19), 0.05, 0.3, { gain: 0.1 }); },
    star(i) { tone(note(7 + i * 5), 0, 0.32, { type: 'triangle', gain: 0.15 }); },
    fanfare() {
      [0, 4, 7, 12].forEach((s, i) => tone(note(s), i * 0.12, 0.3, { type: 'triangle', gain: 0.15 }));
      tone(note(16), 0.5, 0.7, { type: 'triangle', gain: 0.15 });
    },
    heart() { tone(330, 0, 0.4, { type: 'sawtooth', gain: 0.05, glideTo: 190 }); }
  };

  // ---------------------------------------------------------------------------
  // Luciole (mascotte)
  // ---------------------------------------------------------------------------
  const FIREFLY = `
  <svg viewBox="0 0 120 120" aria-hidden="true"><g class="ff-float">
    <circle cx="60" cy="82" r="36" fill="url(#ffGlow)"/>
    <g class="ff-wl"><ellipse class="wing" cx="36" cy="54" rx="22" ry="12" transform="rotate(-28 36 54)"/></g>
    <g class="ff-wr"><ellipse class="wing" cx="84" cy="54" rx="22" ry="12" transform="rotate(28 84 54)"/></g>
    <path d="M52 28 Q46 13 36 11" stroke="#4B4A93" stroke-width="3.5" fill="none" stroke-linecap="round"/>
    <path d="M68 28 Q74 13 84 11" stroke="#4B4A93" stroke-width="3.5" fill="none" stroke-linecap="round"/>
    <circle cx="36" cy="11" r="5" fill="#FFD34E"/><circle cx="84" cy="11" r="5" fill="#FFD34E"/>
    <ellipse cx="60" cy="83" rx="17" ry="15" fill="#FFE27A"/>
    <ellipse cx="60" cy="64" rx="18" ry="14" fill="#47468C"/>
    <circle cx="60" cy="41" r="18" fill="#5D5CB0"/>
    <circle cx="52.5" cy="39" r="6.5" fill="#fff"/><circle cx="67.5" cy="39" r="6.5" fill="#fff"/>
    <circle cx="53.5" cy="40" r="3.3" fill="#1E2157"/><circle cx="68.5" cy="40" r="3.3" fill="#1E2157"/>
    <circle cx="54.6" cy="38.6" r="1.1" fill="#fff"/><circle cx="69.6" cy="38.6" r="1.1" fill="#fff"/>
    <circle cx="46" cy="47" r="3.5" fill="#FF8FB1" opacity=".55"/><circle cx="74" cy="47" r="3.5" fill="#FF8FB1" opacity=".55"/>
    <path d="M54 48 Q60 53.5 66 48" stroke="#1E2157" stroke-width="2.6" fill="none" stroke-linecap="round"/>
  </g></svg>`;
  document.querySelectorAll('[data-firefly]').forEach(el => { el.innerHTML = FIREFLY; });

  function flyReact(cls) {
    const el = $('#gameFly');
    el.classList.remove('hop', 'sad', 'loop');
    void el.offsetWidth;
    el.classList.add(cls);
  }

  // ---------------------------------------------------------------------------
  // Ciel étoilé
  // ---------------------------------------------------------------------------
  (function makeStars() {
    const box = $('#stars');
    let html = '';
    for (let i = 0; i < 38; i++) {
      const x = Math.random() * 100;
      const y = Math.random() * 52;
      const s = Math.random() < 0.2 ? 4 : 2 + Math.random() * 1.5;
      html += `<span style="left:${x}%;top:${y}%;width:${s}px;height:${s}px;animation-delay:${(Math.random() * 4).toFixed(2)}s"></span>`;
    }
    box.innerHTML = html;
  })();

  // ---------------------------------------------------------------------------
  // Navigation entre écrans
  // ---------------------------------------------------------------------------
  function show(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.toggle('active', s.id === id));
  }

  const overlay = $('#overlay');
  const panel = $('#panel');
  function openPanel(html, roofColor, roofExtra = '') {
    panel.innerHTML = `
      <svg class="roof" viewBox="0 0 620 118" preserveAspectRatio="none" aria-hidden="true">
        <polygon points="6,116 310,6 614,116" fill="${roofColor}" stroke="${roofColor}" stroke-width="10" stroke-linejoin="round"/>
      </svg>
      ${roofExtra}
      ${html}`;
    overlay.classList.add('show');
  }
  function closePanel() { overlay.classList.remove('show'); panel.innerHTML = ''; }

  // ---------------------------------------------------------------------------
  // Accueil : la rue
  // ---------------------------------------------------------------------------
  function renderStreet() {
    const svg = $('#street');
    const W = 150, GAP = 40, ROOF_H = 88, OVER = 14, BASE = 700;
    // En portrait, la rue a plus de hauteur : les étages s'agrandissent pour occuper l'espace.
    const wrap = svg.parentElement;
    const aspect = wrap.clientWidth ? wrap.clientHeight / wrap.clientWidth : 0.6;
    const R = Math.round(clamp((1200 * aspect - 170) / 12, 44, 66));
    const topMin = BASE - (12 * R + 14) - ROOF_H - 22;
    svg.setAttribute('viewBox', `0 ${topMin} 1200 ${BASE + 70 - topMin}`);
    const x0 = (1200 - (HOUSES.length * W + (HOUSES.length - 1) * GAP)) / 2;
    const pending = new Set(S.pendingLit || []);
    let order = 0;
    let html = `
      <rect x="-400" y="${BASE}" width="2000" height="900" fill="#1A1840"/>
      <rect x="-400" y="${BASE}" width="2000" height="9" fill="#353070"/>
      <rect x="-400" y="${BASE + 34}" width="2000" height="5" fill="#2A2760" opacity=".8"/>`;

    HOUSES.forEach((n, i) => {
      const x = x0 + i * (W + GAP);
      const rows = n + 2; // n + 1 étages + rez-de-chaussée
      const h = rows * R + 14;
      const top = BASE - h;
      const cx = x + W / 2;
      const complete = litCount(n) === n + 1;
      html += `<g class="house${complete ? ' complete' : ''}" data-n="${n}" role="listitem" aria-label="Maison du ${n}, ${litCount(n)} fenêtres allumées sur ${n + 1}">
        <g class="lift">
        <rect x="${x - OVER}" y="${top - ROOF_H}" width="${W + 2 * OVER}" height="${h + ROOF_H}" fill="transparent"/>
        <rect x="${x}" y="${top}" width="${W}" height="${h}" rx="6" fill="${COLORS[n]}"/>
        <polygon class="roof" points="${x - OVER},${top + 4} ${cx},${top - ROOF_H} ${x + W + OVER},${top + 4}" fill="${ROOFS[n]}" stroke="${ROOFS[n]}" stroke-width="7" stroke-linejoin="round"/>
        <text class="svgt roof-num" x="${cx}" y="${top - 30}">${n}</text>`;
      for (let a = 0; a <= n; a++) {
        const y = top + 12 + a * R;
        const st = status(n, a);
        const just = pending.has(fkey(n, a));
        const cls = just ? 'lit just-lit' : st;
        const delay = just ? `style="--d:${(0.5 + order++ * 0.35).toFixed(2)}s"` : '';
        const wl = cx - 8 - 54, wr = cx + 8;
        html += `<rect class="win ${cls}" ${delay} x="${wl}" y="${y}" width="54" height="${R - 12}" rx="7"/>
                 <rect class="win ${cls}" ${delay} x="${wr}" y="${y}" width="54" height="${R - 12}" rx="7"/>`;
        if (st !== 'off' || just) {
          const tcls = just ? 'just-lit' : (st === 'warm' ? 'warm' : '');
          const fs = `style="font-size:${Math.round(clamp(R * 0.55, 23, 32))}px${delay ? ';--d:' + delay.match(/--d:([^"]+)/)[1] : ''}"`;
          html += `<text class="svgt wtxt ${tcls}" ${fs} x="${wl + 27}" y="${y + (R - 12) / 2 + 1}">${a}</text>
                   <text class="svgt wtxt ${tcls}" ${fs} x="${wr + 27}" y="${y + (R - 12) / 2 + 1}">${n - a}</text>`;
        }
      }
      const dy = top + 12 + (n + 1) * R;
      html += `<rect x="${cx - 21}" y="${dy}" width="42" height="${BASE - dy}" rx="7" fill="${DOORS[n]}"/>
               <circle cx="${cx + 11}" cy="${dy + (BASE - dy) / 2 + 3}" r="3.2" fill="${COLORS[n]}"/>
        </g></g>`;
    });
    svg.innerHTML = html;

    if (pending.size) {
      const delays = (0.5 + (pending.size - 1) * 0.35) * 1000;
      setTimeout(() => SFX.lit(), 500);
      if (pending.size > 1) setTimeout(() => SFX.lit(), delays);
      S.pendingLit = [];
      save();
    }
  }

  function renderHome() {
    const h = new Date().getHours();
    const hello = h >= 5 && h < 18 ? 'Bonjour' : 'Bonsoir';
    $('#greeting').textContent = S.name ? `${hello} ${S.name} !` : `${hello} !`;
    const lit = totalLit();
    let line;
    const tried = Object.keys(S.facts).length > 0;
    if (!tried) line = 'Touche une maison pour allumer ses fenêtres.';
    else if (lit === TOTAL_FACTS) line = 'Toute la rue brille ! Essaie de battre ton record au défi éclair.';
    else {
      const next = HOUSES.find(n => litCount(n) < n + 1);
      const word = lit <= 1 ? 'fenêtre allumée' : 'fenêtres allumées';
      line = `${lit} ${word} sur ${TOTAL_FACTS}. La maison du ${next} t'attend !`;
    }
    $('#guideLine').textContent = line;
    $('#starTotal').textContent = '⭐ ' + fmtInt(S.starsTotal);
    $('#defiRecord').textContent = S.records.defi ? `Record : ${S.records.defi}` : '';
    show('home');
    renderStreet();
  }

  let resizeT = 0;
  window.addEventListener('resize', () => {
    clearTimeout(resizeT);
    resizeT = setTimeout(() => { if ($('#home').classList.contains('active')) renderStreet(); }, 150);
  });

  $('#street').addEventListener('click', e => {
    const g = e.target.closest('.house');
    if (!g) return;
    audio();
    startRound({ kind: 'house', n: Number(g.dataset.n) });
  });
  $('#btnRue').addEventListener('click', () => { audio(); startRound({ kind: 'rue' }); });
  $('#btnDefi').addEventListener('click', () => { audio(); defiIntro(); });
  $('#btnParents').addEventListener('click', parentGate);

  // ---------------------------------------------------------------------------
  // Grande maison (la question)
  // ---------------------------------------------------------------------------
  function dotsSVG(cx, top, count) {
    // cadre à dix : 2 lignes de 5
    let out = '';
    for (let i = 0; i < count; i++) {
      const row = Math.floor(i / 5), col = i % 5;
      out += `<circle cx="${cx - 38 + col * 19}" cy="${top + row * 19}" r="7" fill="#1E2157"/>`;
    }
    return out;
  }

  function renderBigHouse(q, phase) {
    const isHouse = q.type === 'house';
    const body = isHouse ? NEUTRAL.body : COLORS[q.n];
    const roof = isHouse ? NEUTRAL.roof : ROOFS[q.n];
    const missing = isHouse ? 'roof' : q.type === 'right' ? 'right' : 'left';
    const helpers = phase === 'bad' && S.helpers;
    const LW = { x: 76, cx: 131 }, RW = { x: 214, cx: 269 };
    const WY = 162, WS = 110;

    const windowSVG = (w, value, isMissing) => {
      let fill = 'var(--lamp)', cls = 'bh-lit', stroke = 'none', extra = '', txtCls = 'bh-num';
      if (isMissing && phase === 'ask') { fill = '#1B1A45'; cls = 'bh-missing'; stroke = 'var(--lamp)'; txtCls = 'bh-num bh-q'; }
      if (isMissing && phase === 'good') cls = 'bh-lit bh-pop';
      if (isMissing && phase === 'bad') { fill = '#FFE1DB'; cls = 'bh-pop'; stroke = 'var(--coral)'; }
      const label = isMissing && phase === 'ask' ? '?' : value;
      if (helpers) {
        extra = dotsSVG(w.cx, WY + 72, value);
        return `<rect class="${cls}" x="${w.x}" y="${WY}" width="${WS}" height="${WS}" rx="16" fill="${fill}" stroke="${stroke}" stroke-width="5" ${isMissing && phase === 'ask' ? 'stroke-dasharray="12 9"' : ''}/>
          <text class="svgt bh-num bh-small" x="${w.cx}" y="${WY + 33}">${label}</text>${extra}`;
      }
      return `<rect class="${cls}" x="${w.x}" y="${WY}" width="${WS}" height="${WS}" rx="16" fill="${fill}" stroke="${stroke}" stroke-width="5" ${isMissing && phase === 'ask' ? 'stroke-dasharray="12 9"' : ''}/>
        <text class="svgt ${txtCls}" x="${w.cx}" y="${WY + WS / 2 + 3}">${label}</text>`;
    };

    let roofTxt;
    if (missing === 'roof' && phase === 'ask') {
      roofTxt = `<rect class="bh-missing" x="160" y="58" width="80" height="80" rx="14" fill="#2A275F" stroke="var(--lamp)" stroke-width="5" stroke-dasharray="12 9"/>
                 <text class="svgt bh-roof-num bh-q" x="200" y="100">?</text>`;
    } else if (missing === 'roof' && phase === 'bad') {
      roofTxt = `<rect class="bh-pop" x="160" y="58" width="80" height="80" rx="14" fill="#FFE1DB" stroke="var(--coral)" stroke-width="5"/>
                 <text class="svgt bh-roof-num" style="fill:#1E2157" x="200" y="100">${q.n}</text>`;
    } else {
      const glow = missing === 'roof' && phase === 'good' ? 'bh-lit bh-pop' : '';
      roofTxt = `<text class="svgt bh-roof-num ${glow}" ${glow ? 'style="fill:var(--lamp)"' : ''} x="200" y="100">${q.n}</text>`;
    }

    $('#bigHouse').innerHTML = `
      <rect x="54" y="136" width="292" height="186" rx="12" fill="${body}"/>
      <polygon points="22,142 200,20 378,142" fill="${roof}" stroke="${roof}" stroke-width="12" stroke-linejoin="round"/>
      ${roofTxt}
      ${windowSVG(LW, q.a, missing === 'left')}
      ${windowSVG(RW, q.b, missing === 'right')}
      <rect x="54" y="292" width="292" height="30" rx="0" fill="rgba(0,0,0,.12)"/>`;
  }

  function renderEquation(q, phase) {
    const hole = v => {
      const cls = phase === 'ask' ? 'hole' : phase === 'good' ? 'hole ok' : 'hole ko';
      return `<span class="${cls}">${phase === 'ask' ? '?' : v}</span>`;
    };
    let html;
    if (q.type === 'right') html = `<span>${q.a}</span><span>+</span>${hole(q.b)}<span>=</span><span>${q.n}</span>`;
    else if (q.type === 'left') html = `${hole(q.a)}<span>+</span><span>${q.b}</span><span>=</span><span>${q.n}</span>`;
    else html = `<span>${q.a}</span><span>+</span><span>${q.b}</span><span>=</span>${hole(q.n)}`;
    $('#equation').innerHTML = html;
  }

  // ---------------------------------------------------------------------------
  // Pavé numérique
  // ---------------------------------------------------------------------------
  const keypad = $('#keypad');
  (function buildKeypad() {
    const order = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0, 10];
    keypad.innerHTML = order.map(v =>
      `<button class="key${v === 10 ? ' wide' : ''}" type="button" data-v="${v}" aria-label="${v}">${v}</button>`).join('');
  })();
  keypad.addEventListener('pointerdown', e => {
    const k = e.target.closest('.key');
    if (!k) return;
    e.preventDefault();
    k.classList.add('pressed');
    setTimeout(() => k.classList.remove('pressed'), 140);
    onAnswer(Number(k.dataset.v), k);
  });
  function resetKeys() { keypad.querySelectorAll('.key').forEach(k => k.classList.remove('good', 'bad', 'pressed')); }
  function keyEl(v) { return keypad.querySelector(`.key[data-v="${v}"]`); }

  // Clavier physique (pratique sur ordinateur) : chiffres 0 à 9, « d » pour 10
  document.addEventListener('keydown', e => {
    if (!$('#game').classList.contains('active') || overlay.classList.contains('show')) return;
    if (/^[0-9]$/.test(e.key)) onAnswer(Number(e.key), keyEl(Number(e.key)));
    else if (e.key === 'd' || e.key === 'D') onAnswer(10, keyEl(10));
    else if (e.key === 'Escape') pauseGame();
  });

  // ---------------------------------------------------------------------------
  // Barre de vitesse
  // ---------------------------------------------------------------------------
  const speedFill = $('#speedFill');
  function startBar(ms, danger) {
    speedFill.classList.toggle('danger', !!danger);
    speedFill.style.transition = 'none';
    speedFill.style.transform = 'scaleX(1)';
    void speedFill.offsetWidth;
    speedFill.style.transition = `transform ${ms}ms linear`;
    speedFill.style.transform = 'scaleX(0)';
  }
  function resetBar() {
    speedFill.classList.remove('danger');
    speedFill.style.transition = 'none';
    speedFill.style.transform = 'scaleX(1)';
  }
  function freezeBar() {
    const t = getComputedStyle(speedFill).transform;
    speedFill.style.transition = 'none';
    speedFill.style.transform = t === 'none' ? 'scaleX(1)' : t;
  }

  // ---------------------------------------------------------------------------
  // Partie
  // ---------------------------------------------------------------------------
  let G = null;
  const timers = new Set();
  function later(fn, ms) {
    const id = setTimeout(() => { timers.delete(id); fn(); }, ms);
    timers.add(id);
    return id;
  }
  function clearTimers() { timers.forEach(id => clearTimeout(id)); timers.clear(); }

  function modeTitle(mode) {
    if (mode.kind === 'house') return `Maison du ${mode.n}`;
    if (mode.kind === 'rue') return 'Toute la rue';
    return 'Défi éclair';
  }

  function newGame(mode) {
    return {
      mode, queue: [], idx: 0, q: null,
      score: 0, streak: 0, bestStreak: 0,
      firstOk: 0, base: 0, errors: 0, times: [], fast: 0,
      retries: {}, results: [], newlyLit: [],
      hearts: 3, limit: DEFI_START_MS, recent: [],
      locked: true, paused: false, pendingAdvance: false, qStart: 0
    };
  }

  function startRound(mode) {
    clearTimers();
    closePanel();
    G = newGame(mode);
    G.queue = buildRound(mode);
    G.base = G.queue.length;
    prepareStage();
    countdown(modeTitle(mode), presentQuestion);
  }

  function startDefi() {
    clearTimers();
    closePanel();
    G = newGame({ kind: 'defi' });
    prepareStage();
    countdown('Défi éclair', presentQuestion);
  }

  function prepareStage() {
    show('game');
    $('#score').textContent = '0';
    $('#feedback').textContent = '';
    $('#feedback').className = 'feedback';
    $('#equation').innerHTML = '';
    $('#bigHouse').innerHTML = '';
    updateStreak(false);
    renderLamps();
    resetKeys();
    keypad.classList.add('locked');
    resetBar();
  }

  function countdown(title, then) {
    const box = $('#countdown');
    const steps = ['3', '2', '1'];
    let i = 0;
    box.classList.add('show');
    const step = () => {
      if (i < steps.length) {
        box.innerHTML = `<div class="cd-title">${title}</div><div class="cd-num">${steps[i]}</div>`;
        SFX.tick();
        i++;
        later(step, 560);
      } else {
        box.classList.remove('show');
        box.innerHTML = '';
        SFX.go();
        then();
      }
    };
    step();
  }

  function renderLamps() {
    const box = $('#lamps');
    if (!G) return;
    if (G.mode.kind === 'defi') {
      box.innerHTML = [0, 1, 2].map(i => `<span class="heart${i >= G.hearts ? ' lost' : ''}" data-i="${i}">❤️</span>`).join('');
      return;
    }
    box.innerHTML = G.queue.map((_, i) => {
      const r = G.results[i];
      const cls = r === 'ok' ? 'ok' : r === 'ko' ? 'ko' : (i === G.idx ? 'now' : '');
      return `<span class="lamp ${cls}"></span>`;
    }).join('');
  }

  function updateStreak(bump) {
    const el = $('#streak');
    if (!G || G.streak < 2) { el.classList.remove('on'); return; }
    const m = G.mode.kind === 'defi' ? 1 : multiplier(G.streak);
    el.textContent = `🔥 ${G.streak}${m > 1 ? '  ×' + m : ''}`;
    el.classList.add('on');
    if (bump) { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
  }

  function animateScore(from, to) {
    const el = $('#score');
    const t0 = performance.now();
    const dur = 380;
    const tick = t => {
      const p = clamp((t - t0) / dur, 0, 1);
      el.textContent = fmtInt(from + (to - from) * p);
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  function floater(text) {
    const el = document.createElement('div');
    el.className = 'floater';
    el.textContent = text;
    $('#floatLayer').appendChild(el);
    setTimeout(() => el.remove(), 1100);
  }

  function setFeedback(text, cls) {
    const el = $('#feedback');
    el.textContent = text;
    el.className = 'feedback ' + (cls || '');
  }

  function presentQuestion() {
    if (!G) return;
    G.pendingAdvance = false;
    if (G.mode.kind === 'defi') {
      if (G.hearts <= 0) return endDefi();
      if (!G.q || G.qDone) {
        G.q = pickDefi(G.recent);
        G.recent.push([G.q.n, G.q.a]);
        if (G.recent.length > 2) G.recent.shift();
      }
    } else {
      if (G.idx >= G.queue.length) return endRound();
      G.q = G.queue[G.idx];
    }
    G.qDone = false;
    skipFn = null;
    const q = G.q;
    renderLamps();
    renderBigHouse(q, 'ask');
    renderEquation(q, 'ask');
    setFeedback('', '');
    resetKeys();
    keypad.classList.add('locked');
    later(() => {
      if (!G || G.paused) return;
      G.locked = false;
      keypad.classList.remove('locked');
      G.qStart = performance.now();
      if (G.mode.kind === 'defi') {
        startBar(G.limit, true);
        later(onTimeout, G.limit);
      } else {
        startBar(BONUS_ZERO_MS, false);
      }
    }, 150);
  }

  function onAnswer(v, keyNode) {
    if (!G || G.locked || G.paused) return;
    G.locked = true;
    keypad.classList.add('locked');
    clearTimers();
    freezeBar();
    const ms = performance.now() - G.qStart;
    const q = G.q;
    const correct = v === q.answer;
    const k = fkey(q.n, q.a);
    const before = status(q.n, q.a);
    recordAttempt(q.n, q.a, correct, ms);
    const after = status(q.n, q.a);
    let newlyLit = false;
    if (after === 'lit' && before !== 'lit' && !G.newlyLit.includes(k)) { G.newlyLit.push(k); newlyLit = true; }
    if (after !== 'lit') G.newlyLit = G.newlyLit.filter(x => x !== k);
    save();
    if (keyNode) keyNode.classList.add(correct ? 'good' : 'bad');
    G.qDone = true;

    if (correct) onCorrect(q, ms, newlyLit);
    else onWrong(q, v);
  }

  function onCorrect(q, ms, newlyLit) {
    G.streak++;
    G.bestStreak = Math.max(G.bestStreak, G.streak);
    G.times.push(ms);
    const fast = ms <= FLASH_MS;
    if (fast) G.fast++;
    renderBigHouse(q, 'good');
    renderEquation(q, 'good');
    flyReact(G.streak > 0 && G.streak % 5 === 0 ? 'loop' : 'hop');
    SFX.good(G.streak, fast);

    if (G.mode.kind === 'defi') {
      G.score++;
      G.limit = Math.max(DEFI_MIN_MS, G.limit * DEFI_FACTOR);
      $('#score').textContent = fmtInt(G.score);
      setFeedback(fast ? '⚡ Éclair !' : rand(PRAISE), fast ? 'fast' : 'good');
      updateStreak(true);
      G.pendingAdvance = true;
      later(presentQuestion, newlyLit ? 900 : 600);
      if (newlyLit) later(() => SFX.lit(), 250);
      return;
    }

    if (!q.retry) G.firstOk++;
    G.results[G.idx] = 'ok';
    const mult = multiplier(G.streak);
    const pts = (10 + speedBonus(ms)) * mult;
    const from = G.score;
    G.score += pts;
    animateScore(from, G.score);
    floater('+' + pts);
    let msg = fast ? '⚡ Éclair !' : rand(PRAISE);
    let cls = fast ? 'fast' : 'good';
    if (G.streak === 5) { msg = '🔥 Série de 5 ! Points ×2'; cls = 'fast'; }
    else if (G.streak === 10) { msg = '🔥 Série de 10 ! Points ×3'; cls = 'fast'; }
    else if (newlyLit) { msg = '✨ Une fenêtre s\'allume !'; cls = 'fast'; }
    setFeedback(msg, cls);
    if (newlyLit) later(() => SFX.lit(), 250);
    updateStreak(true);
    renderLamps();
    G.pendingAdvance = true;
    later(advance, newlyLit || G.streak === 5 || G.streak === 10 ? 1100 : 700);
  }

  function onWrong(q, v) {
    G.streak = 0;
    G.errors++;
    updateStreak(false);
    renderBigHouse(q, 'bad');
    renderEquation(q, 'bad');
    flyReact('sad');
    SFX.bad();
    setFeedback(`Presque ! C'est ${q.answer}.`, 'bad');

    if (G.mode.kind === 'defi') {
      loseHeart();
      G.pendingAdvance = true;
      later(presentQuestion, 2000);
      armSkip(700, presentQuestion);
      return;
    }

    G.results[G.idx] = 'ko';
    const k = fkey(q.n, q.a);
    const count = G.retries[k] || 0;
    if (count < 2) {
      G.retries[k] = count + 1;
      const again = Object.assign({}, q, { retry: true });
      const pos = Math.min(G.idx + 3, G.queue.length);
      G.queue.splice(pos, 0, again);
    }
    renderLamps();
    G.pendingAdvance = true;
    later(advance, 2300);
    armSkip(800, advance);
  }

  /** Après une erreur, un toucher sur l'écran passe à la suite (après un court délai). */
  let skipFn = null, skipAt = 0;
  function armSkip(afterMs, fn) { skipFn = fn; skipAt = performance.now() + afterMs; }
  $('#stage').addEventListener('pointerdown', e => {
    if (!skipFn || !G || G.paused || !G.pendingAdvance) return;
    if (performance.now() < skipAt || e.target.closest('.key:not([disabled])') && !keypad.classList.contains('locked')) return;
    const f = skipFn;
    skipFn = null;
    clearTimers();
    f();
  });

  function onTimeout() {
    if (!G || G.locked || G.paused) return;
    G.locked = true;
    keypad.classList.add('locked');
    G.qDone = true;
    G.streak = 0;
    updateStreak(false);
    const q = G.q;
    renderBigHouse(q, 'bad');
    renderEquation(q, 'bad');
    flyReact('sad');
    SFX.bad();
    setFeedback(`La lumière s'est éteinte. C'était ${q.answer}.`, 'bad');
    loseHeart();
    G.pendingAdvance = true;
    later(presentQuestion, 2000);
    armSkip(700, presentQuestion);
  }

  function loseHeart() {
    G.hearts--;
    G.errors++;
    renderLamps();
    const h = $(`#lamps .heart[data-i="${G.hearts}"]`);
    if (h) h.classList.add('breaking');
    later(() => SFX.heart(), 250);
  }

  function advance() {
    if (!G) return;
    G.idx++;
    presentQuestion();
  }

  // Pause
  function pauseGame() {
    if (!G || G.paused || !$('#game').classList.contains('active')) return;
    if ($('#countdown').classList.contains('show')) return;
    G.paused = true;
    clearTimers();
    freezeBar();
    keypad.classList.add('locked');
    openPanel(`
      <h2>Pause</h2>
      <p>On continue ?</p>
      <div class="actions">
        <button class="btn-mid primary" data-act="resume" type="button">Continuer</button>
        <button class="btn-mid quiet" data-act="quit" type="button">Quitter la partie</button>
      </div>`, '#47437F');
  }
  function resumeGame() {
    if (!G) return;
    closePanel();
    G.paused = false;
    if (G.pendingAdvance) {
      if (G.mode.kind === 'defi') presentQuestion(); else advance();
    } else {
      G.qDone = false;
      presentQuestion();
    }
  }
  $('#btnPause').addEventListener('click', pauseGame);
  document.addEventListener('visibilitychange', () => { if (document.hidden) pauseGame(); });

  // ---------------------------------------------------------------------------
  // Fins de partie
  // ---------------------------------------------------------------------------
  function starsRoof(count, color) {
    const pts = (cx, cy, r) => {
      const p = [];
      for (let i = 0; i < 10; i++) {
        const ang = -Math.PI / 2 + i * Math.PI / 5;
        const rr = i % 2 ? r * 0.45 : r;
        p.push((cx + rr * Math.cos(ang)).toFixed(1) + ',' + (cy + rr * Math.sin(ang)).toFixed(1));
      }
      return p.join(' ');
    };
    const pos = [[230, 80, 24], [310, 56, 32], [390, 80, 24]];
    return `<svg class="roof" viewBox="0 0 620 118" preserveAspectRatio="xMidYMax meet" aria-label="${count} étoile${count > 1 ? 's' : ''} sur 3">
      ${pos.map((p, i) => `<polygon class="star-shape" data-i="${i}" points="${pts(p[0], p[1], p[2])}"/>`).join('')}
    </svg>`;
  }
  function lightStars(count) {
    for (let i = 0; i < count; i++) {
      later(() => {
        const s = panel.querySelector(`.star-shape[data-i="${i}"]`);
        if (s) s.classList.add('on');
        SFX.star(i);
      }, 450 + i * 380);
    }
  }

  /** Fenêtres à faire s'allumer au prochain retour dans la rue (cumulées si on rejoue d'affilée). */
  function queueLit() {
    const set = new Set((S.pendingLit || []).concat(G.newlyLit));
    S.pendingLit = [...set].filter(k => { const [n, a] = k.split(':').map(Number); return status(n, a) === 'lit'; });
  }

  function endRound() {
    clearTimers();
    keypad.classList.add('locked');
    const avg = G.times.length ? G.times.reduce((s, x) => s + x, 0) / G.times.length : 0;
    const stars = G.errors === 0 && avg <= S.fastMs + 1000 ? 3 : G.errors <= 1 ? 2 : 1;
    const recKey = G.mode.kind === 'house' ? 'h' + G.mode.n : 'rue';
    const prev = S.records[recKey] || 0;
    const isRecord = G.score > prev;
    if (isRecord) S.records[recKey] = G.score;
    S.starsTotal += stars;
    S.log.unshift({ d: Date.now(), m: recKey, s: G.score, ok: G.firstOk, n: G.base, e: G.errors, t: Math.round(avg) });
    S.log = S.log.slice(0, 30);
    queueLit();
    save();

    const title = stars === 3 ? 'Incroyable !' : stars === 2 ? 'Très bien !' : 'Bien joué !';
    const color = G.mode.kind === 'house' ? ROOFS[G.mode.n] : '#47437F';
    const litN = G.newlyLit.length;
    openPanel(`
      <h2>${title}</h2>
      <div class="big-score" id="endScore">0</div>
      <div class="big-label">points</div>
      ${isRecord ? `<div class="badge">${prev ? 'Nouveau record !' : 'Premier record !'}</div>` : `<p>Record : ${fmtInt(prev)}</p>`}
      <dl class="stats">
        <dt>Justes du premier coup</dt><dd>${G.firstOk} sur ${G.base}</dd>
        <dt>Temps moyen</dt><dd>${avg ? fmtSec(avg) : '-'}</dd>
        <dt>Éclairs ⚡</dt><dd>${G.fast}</dd>
        <dt>Meilleure série 🔥</dt><dd>${G.bestStreak}</dd>
        ${litN ? `<dt>Fenêtres allumées ✨</dt><dd>+${litN}</dd>` : ''}
      </dl>
      <div class="actions">
        <button class="btn-mid primary" data-act="again" type="button">Rejouer</button>
        <button class="btn-mid" data-act="street" type="button">Retour à la rue</button>
      </div>`, color, starsRoof(stars, color));
    countUp($('#endScore'), G.score, 900);
    lightStars(stars);
    later(() => SFX.fanfare(), 450 + stars * 380);
    if (stars === 3 || isRecord) later(confetti, 450 + stars * 380);
  }

  function endDefi() {
    clearTimers();
    keypad.classList.add('locked');
    const avg = G.times.length ? G.times.reduce((s, x) => s + x, 0) / G.times.length : 0;
    const prev = S.records.defi || 0;
    const isRecord = G.score > prev;
    if (isRecord) S.records.defi = G.score;
    S.log.unshift({ d: Date.now(), m: 'defi', s: G.score, ok: G.score, n: G.score + G.errors, e: G.errors, t: Math.round(avg) });
    S.log = S.log.slice(0, 30);
    queueLit();
    save();
    openPanel(`
      <h2>Défi terminé !</h2>
      <div class="big-score" id="endScore">0</div>
      <div class="big-label">${G.score > 1 ? 'bonnes réponses' : 'bonne réponse'}</div>
      ${isRecord && G.score > 0 ? `<div class="badge">${prev ? 'Nouveau record !' : 'Premier record !'}</div>` : `<p>Record : ${prev}</p>`}
      <dl class="stats">
        <dt>Meilleure série 🔥</dt><dd>${G.bestStreak}</dd>
        <dt>Temps moyen</dt><dd>${avg ? fmtSec(avg) : '-'}</dd>
        <dt>Éclairs ⚡</dt><dd>${G.fast}</dd>
      </dl>
      <div class="actions">
        <button class="btn-mid primary" data-act="defi" type="button">Rejouer</button>
        <button class="btn-mid" data-act="street" type="button">Retour à la rue</button>
      </div>`, '#C2921B');
    countUp($('#endScore'), G.score, 700);
    later(() => SFX.fanfare(), 400);
    if (isRecord && G.score > 0) later(confetti, 400);
  }

  function countUp(el, to, dur) {
    const t0 = performance.now() + 250;
    const tick = t => {
      const p = clamp((t - t0) / dur, 0, 1);
      el.textContent = fmtInt(to * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  function defiIntro() {
    const rec = S.records.defi;
    openPanel(`
      <h2>⚡ Défi éclair</h2>
      <p>Réponds avant que la lumière s'éteigne. Ça va de plus en plus vite !</p>
      <p>Tu as 3 cœurs ❤️❤️❤️ : une erreur ou une lumière éteinte, et tu perds un cœur.</p>
      ${rec ? `<p>Ton record : <strong>${rec}</strong></p>` : ''}
      <div class="actions">
        <button class="btn-mid primary" data-act="defi" type="button">C'est parti !</button>
        <button class="btn-mid quiet" data-act="close" type="button">Retour</button>
      </div>`, '#C2921B');
  }

  overlay.addEventListener('click', e => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const act = b.dataset.act;
    audio();
    if (act === 'resume') resumeGame();
    else if (act === 'quit' || act === 'street') { clearTimers(); G = null; closePanel(); renderHome(); }
    else if (act === 'again') { const m = G.mode; startRound(m); }
    else if (act === 'defi') startDefi();
    else if (act === 'close') closePanel();
    else if (act === 'gate') checkGate();
  });

  // ---------------------------------------------------------------------------
  // Confettis
  // ---------------------------------------------------------------------------
  function confetti() {
    if (reducedMotion()) return;
    const cv = $('#confetti');
    const ctx = cv.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const W = window.innerWidth, H = window.innerHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const colors = Object.values(COLORS).concat(['#FFD34E', '#FFF6E6', '#4FE0A0']);
    const parts = Array.from({ length: 150 }, () => ({
      x: W / 2 + (Math.random() - 0.5) * 240, y: H * 0.32,
      vx: (Math.random() - 0.5) * 14, vy: -Math.random() * 13 - 4,
      r: 4 + Math.random() * 5, c: rand(colors), rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.3
    }));
    const t0 = performance.now();
    const frame = t => {
      ctx.clearRect(0, 0, W, H);
      parts.forEach(p => {
        p.vy += 0.33; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.rot += p.vr;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.fillStyle = p.c; ctx.fillRect(-p.r, -p.r / 2, p.r * 2, p.r);
        ctx.restore();
      });
      if (t - t0 < 3000) requestAnimationFrame(frame); else ctx.clearRect(0, 0, W, H);
    };
    requestAnimationFrame(frame);
  }

  // ---------------------------------------------------------------------------
  // Espace parents
  // ---------------------------------------------------------------------------
  let gateAnswer = 0;
  function parentGate() {
    const x = 6 + Math.floor(Math.random() * 4), y = 6 + Math.floor(Math.random() * 4);
    gateAnswer = x * y;
    openPanel(`
      <h2>Espace parents</h2>
      <p>Pour entrer, combien font ${x} × ${y} ?</p>
      <input class="gate-input" id="gateInput" type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="off" maxlength="3">
      <p class="gate-error" id="gateError"></p>
      <div class="actions">
        <button class="btn-mid primary" data-act="gate" type="button">Entrer</button>
        <button class="btn-mid quiet" data-act="close" type="button">Retour</button>
      </div>`, '#47437F');
    const inp = $('#gateInput');
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') checkGate(); });
    setTimeout(() => inp.focus(), 50);
  }
  function checkGate() {
    const v = Number(($('#gateInput') || {}).value);
    if (v === gateAnswer) { closePanel(); renderParents(); }
    else { $('#gateError').textContent = 'Ce n\'est pas la bonne réponse.'; }
  }

  const MODE_LABEL = m => m === 'rue' ? 'Toute la rue' : m === 'defi' ? 'Défi éclair' : 'Maison du ' + m.slice(1);

  function renderParents() {
    const seg = (key, options, fmt) => `<div class="seg" data-key="${key}">${options.map(o =>
      `<button type="button" data-val="${o}" class="${String(S[key]) === String(o) ? 'on' : ''}">${fmt ? fmt(o) : o}</button>`).join('')}</div>`;
    const lit = totalLit();

    const houseBlocks = HOUSES.map(n => {
      const cells = [];
      for (let a = 0; a <= n; a++) {
        const f = factData(n, a);
        const st = status(n, a);
        let line1 = 'pas encore vu', line2 = '';
        let weak = false;
        if (f) {
          const okTimes = f.hist.filter(h => h.c).map(h => h.t);
          const med = median(okTimes);
          line1 = `${f.ok} juste${f.ok > 1 ? 's' : ''} sur ${f.tries}`;
          line2 = med ? `médiane ${fmtSec(med)}` : '';
          weak = f.tries >= 2 && f.ok / f.tries < 0.6;
        }
        cells.push(`<div class="fact ${st}${weak ? ' weak' : ''}"><div class="eq">${a} + ${n - a}</div><div class="st">${line1}${line2 ? '<br>' + line2 : ''}</div></div>`);
      }
      return `<h3><span class="swatch" style="background:${COLORS[n]}"></span>Maison du ${n} : ${litCount(n)} sur ${n + 1} allumées${S.records['h' + n] ? `, record ${fmtInt(S.records['h' + n])} points` : ''}</h3>
        <div class="facts">${cells.join('')}</div>`;
    }).join('');

    const rows = S.log.slice(0, 12).map(r => {
      const d = new Date(r.d);
      const date = d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) + ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      const score = r.m === 'defi' ? `${r.s} réponses` : `${fmtInt(r.s)} pts`;
      const justes = r.m === 'defi' ? `${r.e} erreur${r.e > 1 ? 's' : ''}` : `${r.ok} / ${r.n}`;
      return `<tr><td>${date}</td><td>${MODE_LABEL(r.m)}</td><td>${score}</td><td>${justes}</td><td>${r.t ? fmtSec(r.t) : '-'}</td></tr>`;
    }).join('');

    const fastLabel = ms => fmtSec(ms).replace(',0', '');
    $('#parents').innerHTML = `
      <div class="p-inner">
        <header class="p-head">
          <h1>Espace parents</h1>
          <button class="btn-mid primary" id="pBack" type="button">Retour au jeu</button>
        </header>

        <h2>Réglages</h2>
        <div class="p-row"><label for="pName">Prénom affiché</label><input type="text" id="pName" maxlength="20" value="${escapeHtml(S.name)}" placeholder="Facultatif" autocomplete="off"></div>
        <div class="p-row"><span class="lbl">Son</span>${seg('sound', [true, false], v => v ? 'Activé' : 'Coupé')}</div>
        <div class="p-row"><span class="lbl">Questions par partie</span>${seg('roundLength', [8, 12, 16])}</div>
        <div class="p-row"><span class="lbl">Seuil « rapide » pour allumer une fenêtre</span>${seg('fastMs', [2500, 3000, 4000, 5000], fastLabel)}</div>
        <div class="p-row"><span class="lbl">Aide visuelle (points) après une erreur</span>${seg('helpers', [true, false], v => v ? 'Oui' : 'Non')}</div>
        <div class="p-row"><span class="lbl">Maisons de « Toute la rue » et du défi</span>
          <div class="seg" id="pHouses">${HOUSES.map(n => `<button type="button" data-n="${n}" class="${rueHouses().includes(n) ? 'on' : ''}">${n}</button>`).join('')}</div></div>

        <h2>Progression</h2>
        <p>${lit} fenêtre${lit > 1 ? 's' : ''} allumée${lit > 1 ? 's' : ''} sur ${TOTAL_FACTS}. ${S.starsTotal} étoile${S.starsTotal > 1 ? 's' : ''} gagnée${S.starsTotal > 1 ? 's' : ''}.</p>
        <div class="legend">
          <span><i style="background:var(--lamp)"></i>Maîtrisé (3 justes de suite, sous ${fastLabel(S.fastMs)})</span>
          <span><i style="background:rgba(255,211,78,.3)"></i>Dernière réponse juste</span>
          <span><i style="background:rgba(255,255,255,.1)"></i>Pas vu ou dernière réponse fausse</span>
          <span><i style="box-shadow:inset 0 0 0 2px var(--coral)"></i>Moins de 60 % de réussite</span>
        </div>
        ${houseBlocks}

        <h2>Dernières parties</h2>
        ${rows ? `<table class="log"><thead><tr><th>Date</th><th>Mode</th><th>Score</th><th>Justes</th><th>Temps moyen</th></tr></thead><tbody>${rows}</tbody></table>` : '<p>Aucune partie jouée pour l\'instant.</p>'}

        <h2>Comment ça marche</h2>
        <p>Chaque maison correspond à un nombre, chaque étage à une façon de l'obtenir (pour 7 : 0 + 7, 1 + 6, … jusqu'à 7 + 0, soit 8 étages). L'enfant complète la case manquante, ou retrouve la maison à partir des deux nombres dans le mode « Toute la rue ».</p>
        <p>Une fenêtre s'allume quand l'étage a été réussi 3 fois de suite, à chaque fois en moins de ${fastLabel(S.fastMs)}. Le but est la mémorisation : en dessous de ce seuil, l'enfant ne recompte plus. Une erreur éteint la fenêtre.</p>
        <p>Points : 10 par bonne réponse, plus un bonus de rapidité de 0 à 10 (maximum sous 1,5 s, nul au-delà de 6 s). Une série de bonnes réponses multiplie les points (×2 dès 5, ×3 dès 10) et une erreur remet la série à zéro : être juste rapporte toujours plus qu'être rapide. Une erreur n'enlève jamais de points, la bonne réponse s'affiche (avec les points si l'aide visuelle est activée) et la question revient un peu plus loin dans la partie.</p>
        <p>Étoiles : 3 si aucune erreur et temps moyen sous ${fastLabel(S.fastMs + 1000)}, 2 avec au plus une erreur, 1 sinon. Les questions qui ne sont pas encore maîtrisées sortent plus souvent.</p>

        <h2>Installer sur l'iPad</h2>
        <p>Dans Safari, touchez le bouton Partager puis « Sur l'écran d'accueil ». L'application s'ouvre alors en plein écran, fonctionne hors connexion et conserve mieux sa progression.</p>
        <p>La progression est enregistrée uniquement sur cet appareil. Sur iPad, Safari et l'icône de l'écran d'accueil ont chacun leur propre mémoire : utilisez toujours la même entrée. Si aucun son ne sort, vérifiez que l'iPad n'est pas en mode silencieux.</p>

        <h2>Remise à zéro</h2>
        <p>Efface les fenêtres allumées, les records, les étoiles et l'historique. Les réglages sont conservés.</p>
        <div class="p-row" style="border:0"><button class="btn-danger" id="pReset" type="button">Effacer toute la progression</button></div>
      </div>`;

    show('parents');
    $('#parents').scrollTop = 0;

    $('#pBack').addEventListener('click', renderHome);
    $('#pName').addEventListener('input', e => { S.name = e.target.value.trim().slice(0, 20); save(); });
    $('#parents').querySelectorAll('.seg[data-key]').forEach(group => {
      group.addEventListener('click', e => {
        const b = e.target.closest('button');
        if (!b) return;
        const key = group.dataset.key;
        const raw = b.dataset.val;
        S[key] = raw === 'true' ? true : raw === 'false' ? false : Number(raw);
        save();
        const top = $('#parents').scrollTop;
        renderParents();
        $('#parents').scrollTop = top;
      });
    });
    $('#pHouses').addEventListener('click', e => {
      const b = e.target.closest('button');
      if (!b) return;
      const n = Number(b.dataset.n);
      let set = rueHouses().slice();
      if (set.includes(n)) { if (set.length > 1) set = set.filter(x => x !== n); }
      else set.push(n);
      S.rueHouses = HOUSES.filter(x => set.includes(x));
      save();
      b.parentElement.querySelectorAll('button').forEach(x => x.classList.toggle('on', S.rueHouses.includes(Number(x.dataset.n))));
    });
    const reset = $('#pReset');
    reset.addEventListener('click', () => {
      if (!reset.classList.contains('armed')) {
        reset.classList.add('armed');
        reset.textContent = 'Toucher encore pour confirmer';
        setTimeout(() => { if (reset.isConnected) { reset.classList.remove('armed'); reset.textContent = 'Effacer toute la progression'; } }, 4000);
        return;
      }
      Object.assign(S, { facts: {}, records: {}, starsTotal: 0, log: [], pendingLit: [] });
      save();
      renderParents();
    });
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // ---------------------------------------------------------------------------
  // Démarrage
  // ---------------------------------------------------------------------------
  document.addEventListener('pointerdown', () => audio(), { once: true });
  document.addEventListener('touchstart', () => {}, { passive: true }); // active les états :active sur iOS
  renderHome();

  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  // Accès pour les tests automatisés
  window.__maisons = { state: () => S, game: () => G, status, buildRound, speedBonus, multiplier };
})();
