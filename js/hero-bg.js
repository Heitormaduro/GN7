/* ============================================================
   GN7 — Hero Background v4 (otimizado)
   Rede de partículas conectadas (tech / automação)
   - Nodes dourados drifting em 3D
   - Lines auto-formam entre nodes próximos
   - Cursor atrai nodes + desenha linhas brilhantes ativas

   v4: buffers pré-alocados (zero alocação por frame), loop pausa
   quando o hero sai de vista ou a aba fica oculta.
   ============================================================ */

(() => {
  'use strict';

  const canvas = document.getElementById('hero-bg');
  if (!canvas || !window.THREE) {
    console.warn('[GN7 hero-bg] canvas ou Three.js não encontrado — abortando');
    return;
  }

  const hero = canvas.parentElement;

  /* ---------- Scene + Camera + Renderer ---------- */
  const FOV = 65;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    FOV,
    hero.clientWidth / hero.clientHeight,
    0.1,
    100
  );
  camera.position.z = 7;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    powerPreference: 'high-performance'
  });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(hero.clientWidth, hero.clientHeight);

  /* ---------- World dimensions (calculados a partir da câmera) ---------- */
  const calcWorld = () => {
    const h = 2 * camera.position.z * Math.tan((FOV * Math.PI / 180) / 2);
    const w = h * (hero.clientWidth / hero.clientHeight);
    return { w, h };
  };
  let world = calcWorld();

  /* ---------- Particles ---------- */
  const NODE_COUNT = 90;
  const positions = new Float32Array(NODE_COUNT * 3);
  const velocities = new Float32Array(NODE_COUNT * 3);

  for (let i = 0; i < NODE_COUNT; i++) {
    positions[i * 3]     = (Math.random() - 0.5) * world.w * 1.1;
    positions[i * 3 + 1] = (Math.random() - 0.5) * world.h * 1.1;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 8;
    velocities[i * 3]     = (Math.random() - 0.5) * 0.008;
    velocities[i * 3 + 1] = (Math.random() - 0.5) * 0.008;
    velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.004;
  }

  const pointsGeo = new THREE.BufferGeometry();
  pointsGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const pointsMat = new THREE.PointsMaterial({
    color: 0xd4b886,
    size: 0.075,
    transparent: true,
    opacity: 0.9,
    sizeAttenuation: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });

  const points = new THREE.Points(pointsGeo, pointsMat);
  scene.add(points);

  /* ---------- Passive lines (entre nodes próximos) ----------
     Buffer pré-alocado pro pior caso (todos os pares conectados).
     A cada frame só atualizamos os valores + setDrawRange — sem
     recriar geometria nem alocar arrays. */
  const MAX_PAIRS = (NODE_COUNT * (NODE_COUNT - 1)) / 2;
  const linePositions = new Float32Array(MAX_PAIRS * 6); // 2 vértices * 3 coords por par
  const linesGeo = new THREE.BufferGeometry();
  const lineAttr = new THREE.BufferAttribute(linePositions, 3);
  lineAttr.setUsage(THREE.DynamicDrawUsage);
  linesGeo.setAttribute('position', lineAttr);
  const linesMat = new THREE.LineBasicMaterial({
    color: 0xc4a050,
    transparent: true,
    opacity: 0.14,
    depthWrite: false
  });
  const lines = new THREE.LineSegments(linesGeo, linesMat);
  lines.frustumCulled = false;
  scene.add(lines);

  /* ---------- Active lines (cursor → nodes próximos) ---------- */
  const MAX_ACTIVE_LINES = 8;
  const activeLinePositions = new Float32Array(MAX_ACTIVE_LINES * 6);
  const activeLinesGeo = new THREE.BufferGeometry();
  const activeAttr = new THREE.BufferAttribute(activeLinePositions, 3);
  activeAttr.setUsage(THREE.DynamicDrawUsage);
  activeLinesGeo.setAttribute('position', activeAttr);
  const activeLinesMat = new THREE.LineBasicMaterial({
    color: 0xe8d4a4,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  const activeLines = new THREE.LineSegments(activeLinesGeo, activeLinesMat);
  activeLines.frustumCulled = false;
  scene.add(activeLines);

  /* ---------- Buffer reutilizável pra seleção dos nodes mais próximos ----------
     Objetos pré-criados — preenchidos in-place a cada frame, zero GC. */
  const distBuf = new Array(NODE_COUNT);
  for (let i = 0; i < NODE_COUNT; i++) distBuf[i] = { i3: 0, d: 0 };

  /* ---------- Cursor tracking (com unproject pra coord world) ---------- */
  const cursorWorld = new THREE.Vector3(0, 0, 0);
  let cursorActive = false;
  const projectVec = new THREE.Vector3();

  document.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    if (e.clientX < rect.left || e.clientX > rect.right ||
        e.clientY < rect.top || e.clientY > rect.bottom) {
      cursorActive = false;
      return;
    }
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    projectVec.set(x, y, 0.5);
    projectVec.unproject(camera);
    projectVec.sub(camera.position).normalize();
    const distance = -camera.position.z / projectVec.z;
    cursorWorld.copy(camera.position).add(projectVec.multiplyScalar(distance));
    cursorActive = true;
  }, { passive: true });

  document.addEventListener('mouseleave', () => { cursorActive = false; });

  /* ---------- Animation loop ---------- */
  const MAX_LINE_DIST = 1.6;       // limite pra desenhar linha entre nodes
  const MAX_LINE_DIST_SQ = MAX_LINE_DIST * MAX_LINE_DIST;
  const CURSOR_RADIUS = 2.6;
  const CURSOR_RADIUS_SQ = CURSOR_RADIUS * CURSOR_RADIUS;
  const CURSOR_PULL = 0.0035;

  function frame() {
    const pos = pointsGeo.attributes.position.array;
    const hw = world.w * 0.55;
    const hh = world.h * 0.55;

    // Update positions + bounce + cursor attraction
    for (let i = 0; i < NODE_COUNT; i++) {
      const i3 = i * 3;

      pos[i3]     += velocities[i3];
      pos[i3 + 1] += velocities[i3 + 1];
      pos[i3 + 2] += velocities[i3 + 2];

      // bounce nas bordas
      if (pos[i3] > hw || pos[i3] < -hw)         velocities[i3]     *= -1;
      if (pos[i3 + 1] > hh || pos[i3 + 1] < -hh) velocities[i3 + 1] *= -1;
      if (pos[i3 + 2] > 4 || pos[i3 + 2] < -4)   velocities[i3 + 2] *= -1;

      // cursor attraction
      if (cursorActive) {
        const dx = cursorWorld.x - pos[i3];
        const dy = cursorWorld.y - pos[i3 + 1];
        const distSq = dx * dx + dy * dy;
        if (distSq < CURSOR_RADIUS_SQ) {
          const dist = Math.sqrt(distSq);
          const force = (CURSOR_RADIUS - dist) / CURSOR_RADIUS * CURSOR_PULL;
          pos[i3]     += dx * force;
          pos[i3 + 1] += dy * force;
        }
      }
    }
    pointsGeo.attributes.position.needsUpdate = true;

    // Build passive lines — escreve direto no buffer pré-alocado
    let lp = 0;
    for (let i = 0; i < NODE_COUNT; i++) {
      const i3 = i * 3;
      for (let j = i + 1; j < NODE_COUNT; j++) {
        const j3 = j * 3;
        const dx = pos[i3] - pos[j3];
        const dy = pos[i3 + 1] - pos[j3 + 1];
        const distSq = dx * dx + dy * dy;
        if (distSq < MAX_LINE_DIST_SQ) {
          linePositions[lp++] = pos[i3];
          linePositions[lp++] = pos[i3 + 1];
          linePositions[lp++] = pos[i3 + 2];
          linePositions[lp++] = pos[j3];
          linePositions[lp++] = pos[j3 + 1];
          linePositions[lp++] = pos[j3 + 2];
        }
      }
    }
    linesGeo.setDrawRange(0, lp / 3);
    lineAttr.updateRange.offset = 0;
    lineAttr.updateRange.count = lp;
    lineAttr.needsUpdate = true;

    // Build active lines (cursor → N nearest) — sem alocação
    let ap = 0;
    if (cursorActive) {
      for (let i = 0; i < NODE_COUNT; i++) {
        const i3 = i * 3;
        const dx = cursorWorld.x - pos[i3];
        const dy = cursorWorld.y - pos[i3 + 1];
        const slot = distBuf[i];
        slot.i3 = i3;
        slot.d = dx * dx + dy * dy;
      }
      distBuf.sort((a, b) => a.d - b.d);
      for (let k = 0; k < MAX_ACTIVE_LINES; k++) {
        const n = distBuf[k];
        if (n.d < CURSOR_RADIUS_SQ * 2) {
          activeLinePositions[ap++] = cursorWorld.x;
          activeLinePositions[ap++] = cursorWorld.y;
          activeLinePositions[ap++] = 0;
          activeLinePositions[ap++] = pos[n.i3];
          activeLinePositions[ap++] = pos[n.i3 + 1];
          activeLinePositions[ap++] = pos[n.i3 + 2];
        }
      }
    }
    activeLinesGeo.setDrawRange(0, ap / 3);
    activeAttr.updateRange.offset = 0;
    activeAttr.updateRange.count = ap;
    activeAttr.needsUpdate = true;

    renderer.render(scene, camera);
  }

  /* ---------- Loop controlado: pausa fora de vista / aba oculta ---------- */
  let rafId = null;
  let running = false;
  let heroVisible = true;

  function tick() {
    frame();
    rafId = requestAnimationFrame(tick);
  }

  function start() {
    if (running || !heroVisible || document.hidden) return;
    running = true;
    rafId = requestAnimationFrame(tick);
  }

  function stop() {
    running = false;
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  // Pausa quando o hero rola pra fora da tela (nada visível pra renderizar)
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      heroVisible = entries[0].isIntersecting;
      if (heroVisible) start();
      else stop();
    }, { threshold: 0 });
    io.observe(hero);
  }

  // Pausa quando a aba fica em background
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
    else start();
  });

  start();

  /* ---------- Resize ---------- */
  let resizeTimeout;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      const w = hero.clientWidth;
      const h = hero.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      world = calcWorld();
    }, 100);
  }, { passive: true });

  console.log('[GN7] hero-bg.js v4 — rede de partículas (otimizado: buffers fixos + pausa fora de vista)');
})();
