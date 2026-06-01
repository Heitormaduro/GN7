(() => {
  'use strict';

  const BG   = '#050e1c';
  const GOLD = '#C2A46F';
  const G    = a => `rgba(194,164,111,${a})`;
  const AMB  = a => `rgba(210,140,30,${a})`;
  const WHT  = a => `rgba(255,248,220,${a})`;
  const SCRAM = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#&?<>[]{}';

  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  window.scrollTo(0, 0);

  const PHRASES = [
    { big: 'AUTOMATIZE.',  sub: 'Inteligência que trabalha por você.' },
    { big: 'ESCALE.',       sub: 'Do clique ao resultado real.' },
    { big: 'DOMINE.',       sub: 'GN7 — O futuro do seu negócio.' },
  ];

  const T_START  = 280;
  const T_ENTER  = 580;
  const T_HOLD   = 920;
  const T_EXIT   = 420;
  const T_GAP    = 130;
  const T_PHRASE = T_ENTER + T_HOLD + T_EXIT + T_GAP;
  const T_FADE   = 620;

  const lerp    = (a, b, t) => a + (b - a) * t;
  const clamp   = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const easeOut = t => 1 - (1 - t) ** 3;
  const easeIn  = t => t ** 3;
  const easeIO  = t => t < .5 ? 4*t**3 : 1 - (-2*t+2)**3/2;

  let canvas, ctx, W, H, overlayEl, raf, startTs;

  // Pool de partículas do beam
  let sparks = [];

  document.addEventListener('DOMContentLoaded', () => {
    document.body.classList.add('intro-active');
    overlayEl = document.getElementById('introOverlay');
    canvas    = document.getElementById('introCanvas');
    ctx       = canvas.getContext('2d');
    resize();
    window.addEventListener('resize', resize);
    startTs = performance.now();
    raf = requestAnimationFrame(tick);
  });

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }

  // ── Estado: qual frase, qual fase, t 0→1 ─────────────────────────────────
  function getState(elapsed) {
    if (elapsed < T_START) return { type: 'pre' };
    const t   = elapsed - T_START;
    const idx = Math.floor(t / T_PHRASE);
    const loc = t - idx * T_PHRASE;
    if (idx >= PHRASES.length)
      return { type: 'done', t: clamp((t - PHRASES.length * T_PHRASE) / T_FADE, 0, 1) };
    if (loc < T_ENTER)
      return { type: 'enter', idx, t: loc / T_ENTER };
    if (loc < T_ENTER + T_HOLD)
      return { type: 'hold',  idx, t: (loc - T_ENTER) / T_HOLD };
    if (loc < T_ENTER + T_HOLD + T_EXIT)
      return { type: 'exit',  idx, t: (loc - T_ENTER - T_HOLD) / T_EXIT };
    return { type: 'gap', idx, t: (loc - T_ENTER - T_HOLD - T_EXIT) / T_GAP };
  }

  // ── Decode: chars aleatórios → texto real ─────────────────────────────────
  function scramble(text, progress) {
    return text.split('').map((char, i) => {
      if (' .—,'.includes(char)) return char;
      const start = i / (text.length * 1.1);
      if (progress >= 1 || progress - start >= 0.22) return char;
      if (progress < start) return SCRAM[Math.floor(Math.random() * SCRAM.length)];
      const p = (progress - start) / 0.22;
      return Math.random() < easeOut(p) ? char : SCRAM[Math.floor(Math.random() * SCRAM.length)];
    }).join('');
  }

  // ── Loop principal ────────────────────────────────────────────────────────
  function tick(ts) {
    const elapsed = ts - startTs;
    const st      = getState(elapsed);

    // Fundo
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, W, H);
    drawScanlines();

    if (st.type === 'done') {
      overlayEl.style.opacity = String(1 - easeOut(st.t));
      if (st.t >= 1) {
        cancelAnimationFrame(raf);
        document.body.classList.remove('intro-active');
        overlayEl.remove();
        return;
      }
    } else if (st.type === 'enter' || st.type === 'hold' || st.type === 'exit') {
      drawPhrase(st);
    }

    raf = requestAnimationFrame(tick);
  }

  // ── Scanlines CRT sutis ───────────────────────────────────────────────────
  function drawScanlines() {
    ctx.fillStyle = 'rgba(0,0,0,0.035)';
    for (let y = 0; y < H; y += 4) {
      ctx.fillRect(0, y, W, 1);
    }
  }

  // ── Desenha a frase com todos os efeitos ─────────────────────────────────
  function drawPhrase(st) {
    const { type, idx, t } = st;
    const phrase = PHRASES[idx];

    // Auto-scale: mede o texto e encolhe se não couber na tela
    const rawSz = Math.min(W * 0.115, H * 0.21, 138);
    ctx.font = `900 ${rawSz}px Montserrat, sans-serif`;
    const measured = ctx.measureText(phrase.big).width;
    const bigSz  = measured > W * 0.88 ? Math.floor(rawSz * (W * 0.88) / measured) : rawSz;

    const subSz  = Math.max(13, Math.round(15 * Math.min(W / 1000, 1.3)));
    const cx = W / 2, cy = H / 2;

    // Variáveis de animação por fase
    let alpha    = 1;
    let decodeT  = 1;
    let glitch   = 0;
    let scanX    = W + 300;
    let subAlpha = 0;
    let offsetY  = 0;

    if (type === 'enter') {
      alpha    = easeOut(Math.min(t * 2.2, 1));
      decodeT  = easeIO(Math.min(t * 1.25, 1));
      scanX    = lerp(-220, W + 220, easeIO(t));
      offsetY  = lerp(28, 0, easeOut(t));
      // Spawn sparks perto do beam
      if (Math.random() < 0.55) spawnSparks(scanX, cy, bigSz);
    } else if (type === 'hold') {
      decodeT  = 1;
      subAlpha = easeOut(clamp(t * 2.8, 0, 1));
      glitch   = Math.random() < 0.014 ? 0.14 : 0;
    } else { // exit
      decodeT  = 1;
      alpha    = 1 - easeOut(t);
      subAlpha = 1 - easeOut(clamp(t * 3, 0, 1));
      glitch   = t < 0.68 ? Math.sin(t / 0.68 * Math.PI) * 0.95 : 0;
      offsetY  = lerp(0, -22, easeIn(t));
    }

    // ── Aberração cromática + slices de glitch ────────────────────────────
    if (glitch > 0.04) {
      const gx = (Math.random() - 0.5) * 32 * glitch;

      ctx.save();
      ctx.globalAlpha = alpha * glitch * 0.70;
      ctx.font = `900 ${bigSz}px Montserrat, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(255,30,30,0.9)';
      ctx.fillText(phrase.big, cx - gx, cy + offsetY);
      ctx.restore();

      ctx.save();
      ctx.globalAlpha = alpha * glitch * 0.70;
      ctx.font = `900 ${bigSz}px Montserrat, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(0,210,255,0.9)';
      ctx.fillText(phrase.big, cx + gx, cy + offsetY);
      ctx.restore();

      // Fatias deslocadas horizontalmente
      if (glitch > 0.28) {
        const n = Math.floor(1 + Math.random() * 3);
        for (let i = 0; i < n; i++) {
          const sy  = cy + (Math.random() - 0.5) * bigSz * 1.5;
          const sh  = 3 + Math.random() * bigSz * 0.15;
          const sdx = (Math.random() - 0.5) * 58 * glitch;
          ctx.save();
          ctx.beginPath(); ctx.rect(0, sy - sh/2, W, sh); ctx.clip();
          ctx.globalAlpha = alpha * 0.90;
          ctx.font = `900 ${bigSz}px Montserrat, sans-serif`;
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillStyle = WHT(0.95);
          ctx.shadowColor = AMB(1); ctx.shadowBlur = 20;
          ctx.fillText(phrase.big, cx + sdx, cy + offsetY);
          ctx.restore();
        }
      }
    }

    // ── Texto principal (3 camadas de glow) ───────────────────────────────
    const displayText = type === 'enter' ? scramble(phrase.big, decodeT) : phrase.big;

    // Camada 1 — halo âmbar largo
    ctx.save();
    ctx.globalAlpha = alpha * 0.42;
    ctx.font = `900 ${bigSz}px Montserrat, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = AMB(0.55);
    ctx.shadowColor = AMB(1); ctx.shadowBlur = 85;
    ctx.fillText(displayText, cx, cy + offsetY);
    ctx.restore();

    // Camada 2 — glow dourado
    ctx.save();
    ctx.globalAlpha = alpha * 0.82;
    ctx.font = `900 ${bigSz}px Montserrat, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = G(0.92);
    ctx.shadowColor = GOLD; ctx.shadowBlur = 30;
    ctx.fillText(displayText, cx, cy + offsetY);
    ctx.restore();

    // Camada 3 — texto branco nítido
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = `900 ${bigSz}px Montserrat, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = WHT(0.97);
    ctx.shadowColor = AMB(1); ctx.shadowBlur = 10;
    ctx.fillText(displayText, cx, cy + offsetY);
    ctx.restore();

    // ── Beam de scan (entrada) ────────────────────────────────────────────
    if (type === 'enter') {
      const bw = 130;
      const gr = ctx.createLinearGradient(scanX - bw, 0, scanX + bw, 0);
      gr.addColorStop(0,    WHT(0));
      gr.addColorStop(0.30, AMB(0.40));
      gr.addColorStop(0.50, WHT(0.80));
      gr.addColorStop(0.70, AMB(0.40));
      gr.addColorStop(1,    WHT(0));
      ctx.save();
      ctx.globalAlpha = alpha * (1 - t * 0.65);
      ctx.fillStyle = gr;
      ctx.fillRect(scanX - bw, cy - bigSz * 0.9, bw * 2, bigSz * 1.8);
      ctx.restore();

      // Linha de scan fina (borda do beam)
      ctx.save();
      ctx.globalAlpha = alpha * (1 - t) * 0.85;
      ctx.strokeStyle = WHT(0.9);
      ctx.lineWidth = 1.5;
      ctx.shadowColor = AMB(1); ctx.shadowBlur = 20;
      ctx.beginPath(); ctx.moveTo(scanX, cy - bigSz * 0.9); ctx.lineTo(scanX, cy + bigSz * 0.9);
      ctx.stroke();
      ctx.restore();
    }

    // ── Partículas de spark ───────────────────────────────────────────────
    drawSparks();

    // ── Subtítulo ─────────────────────────────────────────────────────────
    if (subAlpha > 0) {
      ctx.save();
      ctx.globalAlpha = subAlpha;
      ctx.font = `400 ${subSz}px "JetBrains Mono", monospace`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.fillStyle = G(0.55);
      ctx.shadowColor = GOLD; ctx.shadowBlur = 8;
      ctx.fillText(phrase.sub, cx, cy + bigSz * 0.62 + offsetY);
      ctx.restore();
    }

    // ── Status tag no canto ────────────────────────────────────────────────
    const sc = Math.min(W / 1000, 1.3);
    ctx.save();
    ctx.globalAlpha = alpha * 0.28;
    ctx.font = `400 ${Math.round(10 * sc)}px "JetBrains Mono", monospace`;
    ctx.fillStyle = AMB(0.85);
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText(`GN7 // SYS.INIT // ${String(idx + 1).padStart(2, '0')} / 03`, Math.round(24 * sc), Math.round(24 * sc));
    ctx.restore();
  }

  // ── Sparks ───────────────────────────────────────────────────────────────
  function spawnSparks(x, cy, bigSz) {
    const n = Math.floor(2 + Math.random() * 4);
    for (let i = 0; i < n; i++) {
      sparks.push({
        x, y: cy + (Math.random() - 0.5) * bigSz * 1.3,
        vx: (Math.random() - 0.5) * 5,
        vy: (Math.random() - 0.5) * 3,
        r: 0.8 + Math.random() * 1.8,
        life: 1,
        decay: 0.06 + Math.random() * 0.08,
      });
    }
  }

  function drawSparks() {
    sparks = sparks.filter(sp => sp.life > 0);
    sparks.forEach(sp => {
      sp.x    += sp.vx;
      sp.y    += sp.vy;
      sp.life -= sp.decay;
      ctx.save();
      ctx.globalAlpha = sp.life * 0.85;
      ctx.beginPath(); ctx.arc(sp.x, sp.y, sp.r, 0, Math.PI * 2);
      ctx.fillStyle   = WHT(1);
      ctx.shadowColor = AMB(1); ctx.shadowBlur = 10;
      ctx.fill();
      ctx.restore();
    });
  }

})();
