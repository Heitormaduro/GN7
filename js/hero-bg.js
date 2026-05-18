/* ============================================================
   GN7 — Hero Background v3
   Rede de partículas conectadas (tech / automação)
   - Nodes dourados drifting em 3D
   - Lines auto-formam entre nodes próximos
   - Cursor atrai nodes + desenha linhas brilhantes ativas
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
    antialias: true
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

  /* ---------- Passive lines (entre nodes próximos) ---------- */
  const linesGeo = new THREE.BufferGeometry();
  const linesMat = new THREE.LineBasicMaterial({
    color: 0xc4a050,
    transparent: true,
    opacity: 0.14,
    depthWrite: false
  });
  const lines = new THREE.LineSegments(linesGeo, linesMat);
  scene.add(lines);

  /* ---------- Active lines (cursor → nodes próximos) ---------- */
  const activeLinesGeo = new THREE.BufferGeometry();
  const activeLinesMat = new THREE.LineBasicMaterial({
    color: 0xe8d4a4,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  const activeLines = new THREE.LineSegments(activeLinesGeo, activeLinesMat);
  scene.add(activeLines);

  /* ---------- Cursor tracking (com unproject pra coord world) ---------- */
  let cursorWorld = new THREE.Vector3(0, 0, 0);
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
  const MAX_ACTIVE_LINES = 8;

  function animate() {
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

    // Build passive lines (par a par — N=90 dá ~4k checks, ok)
    const linePos = [];
    for (let i = 0; i < NODE_COUNT; i++) {
      const i3 = i * 3;
      for (let j = i + 1; j < NODE_COUNT; j++) {
        const j3 = j * 3;
        const dx = pos[i3] - pos[j3];
        const dy = pos[i3 + 1] - pos[j3 + 1];
        const distSq = dx * dx + dy * dy;
        if (distSq < MAX_LINE_DIST_SQ) {
          linePos.push(pos[i3], pos[i3 + 1], pos[i3 + 2]);
          linePos.push(pos[j3], pos[j3 + 1], pos[j3 + 2]);
        }
      }
    }
    linesGeo.setAttribute('position', new THREE.Float32BufferAttribute(linePos, 3));

    // Build active lines (cursor → N nearest)
    const activePos = [];
    if (cursorActive) {
      const dists = [];
      for (let i = 0; i < NODE_COUNT; i++) {
        const i3 = i * 3;
        const dx = cursorWorld.x - pos[i3];
        const dy = cursorWorld.y - pos[i3 + 1];
        dists.push({ i3, d: dx * dx + dy * dy });
      }
      dists.sort((a, b) => a.d - b.d);
      const max = Math.min(MAX_ACTIVE_LINES, dists.length);
      for (let k = 0; k < max; k++) {
        const n = dists[k];
        if (n.d < CURSOR_RADIUS_SQ * 2) {
          activePos.push(cursorWorld.x, cursorWorld.y, 0);
          activePos.push(pos[n.i3], pos[n.i3 + 1], pos[n.i3 + 2]);
        }
      }
    }
    activeLinesGeo.setAttribute('position', new THREE.Float32BufferAttribute(activePos, 3));

    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }

  animate();

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

  console.log('[GN7] hero-bg.js v3 — rede de partículas (tech/automação)');
})();
