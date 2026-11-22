/* =========================================================================
 * main.js — Crash-Proof WebGL / HDR GPU Engine (500k Stars Edition)
 * Optimized for Integrated Laptop GPUs (ANGLE/D3D11) & Mobile GPUs:
 *  - Full ~500k GPU-batched stars (STAR_SCALE = 1.0) & texture-backed dust
 *  - Distance-culled Gargantua SMBHs (max 1 ray-marched BH active at once)
 *  - Scale-tier visibility culling (eliminates Laniakea origin white-out!)
 *  - Half-res HDR Unreal Bloom + WebGL context-loss guard
 * ========================================================================= */

(function () {
  'use strict';

  const CAT = window.CosmosCatalog;
  const SHADERS = window.CosmosShaders;

  if (!CAT || !SHADERS) {
    console.error('Cosmos 3D: catalog.js and shaders.js must load before main.js');
    return;
  }

  // -------------------------------------------------------------------------
  // 1. GLOBAL STATE & DEVICE PERFORMANCE PROFILE
  // -------------------------------------------------------------------------
  const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || window.innerWidth < 768;
  const STAR_SCALE = 1.0; // Full ~500k stars enabled (lower to 0.5 on mobile if you want higher FPS)
  const DUST_SCALE = isMobile ? 0.25 : 0.35;
  const TARGET_PR = isMobile
    ? Math.min(window.devicePixelRatio || 1, 1.0)
    : Math.min(window.devicePixelRatio || 1, 1.25);

  const state = {
    time: 0,
    speed: 1.0,
    spin: 0.85,
    bloomStrength: 0.62,
    bloomEnabled: true,
    cmbSliderOpacity: 0.55,
    specMode: 'optical',
    specModeNum: 0.0,
    showLabels: true,
    showArms: true,
    showOrbits: true,
    showDust: true,
    showFermi: true,
    showLaniakea: true,
    showQuipu: true,
    showCMB: true,
    showHaloGrid: false,
    contextLost: false
  };

  window.currentSelectedId = 'sgra';

  function makeRng(seed) {
    let s = seed % 2147483647;
    if (s <= 0) s += 2147483646;
    return function () {
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646;
    };
  }

  function randGauss(rng) {
    return (rng() + rng() + rng() - 1.5) * 1.15;
  }

  // -------------------------------------------------------------------------
  // 2. RENDERER, SCENE, CAMERA, CONTROLS & HALF-RES HDR BLOOM
  // -------------------------------------------------------------------------
  const container = document.getElementById('canvas-container');
  const labelsContainer = document.getElementById('labels-container');

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x020309);

  const camera = new THREE.PerspectiveCamera(
    50,
    window.innerWidth / window.innerHeight,
    0.1,
    450000
  );
  camera.position.set(0.0, 0.72, 3.95);

  const renderer = new THREE.WebGLRenderer({
    antialias: !isMobile,
    alpha: false,
    powerPreference: 'default'
  });
  renderer.setPixelRatio(TARGET_PR);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x020309, 1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  container.insertBefore(renderer.domElement, labelsContainer);

  // Guard against GPU driver resets / WebGL Context Lost
  renderer.domElement.addEventListener('webglcontextlost', function (e) {
    e.preventDefault();
    state.contextLost = true;
    state.bloomEnabled = false;
    const cb = document.getElementById('toggleBloom');
    if (cb) cb.checked = false;
    console.warn('Cosmos 3D: WebGL context lost — waiting for restore.');
  }, false);

  renderer.domElement.addEventListener('webglcontextrestored', function () {
    state.contextLost = false;
    console.info('Cosmos 3D: WebGL context restored.');
  }, false);

  const controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.065;
  controls.rotateSpeed = 0.65;
  controls.zoomSpeed = 1.05;
  controls.panSpeed = 0.85;
  controls.minDistance = 0.75;
  controls.maxDistance = 132000;
  controls.target.set(0, 0, 0);

  // Half-Resolution HDR Unreal Bloom (4x less fill-rate, safe on Intel UHD & mobile!)
  let composer = null;
  let bloomPass = null;
  try {
    if (
      typeof THREE.EffectComposer === 'function' &&
      typeof THREE.RenderPass === 'function' &&
      typeof THREE.UnrealBloomPass === 'function'
    ) {
      composer = new THREE.EffectComposer(renderer);
      const renderPass = new THREE.RenderPass(scene, camera);
      composer.addPass(renderPass);

      const bloomW = Math.max(256, Math.floor(window.innerWidth * 0.5));
      const bloomH = Math.max(256, Math.floor(window.innerHeight * 0.5));
      bloomPass = new THREE.UnrealBloomPass(
        new THREE.Vector2(bloomW, bloomH),
        state.bloomStrength,
        0.52,
        0.85
      );
      composer.addPass(bloomPass);
    }
  } catch (err) {
    console.warn('UnrealBloomPass fallback to direct WebGL renderer:', err);
    composer = null;
    bloomPass = null;
  }

  const textures = SHADERS.createTextures();

  // -------------------------------------------------------------------------
  // 3. RAY-MARCHED GARGANTUA BLACK HOLES (Distance-Culled: Max 1 Active!)
  // -------------------------------------------------------------------------
  const blackHoleEntries = [];
  const bhGroup = new THREE.Group();
  scene.add(bhGroup);

  function buildBlackHoles() {
    const unitSphereGeo = new THREE.SphereGeometry(1.0, 36, 24);

    CAT.BLACK_HOLES.forEach(function (bh) {
      const mat = SHADERS.createGargantuaMaterial({
        spin: bh.spin,
        diskTint: bh.diskTint,
        brightness: bh.brightness
      });

      const mesh = new THREE.Mesh(unitSphereGeo, mat);
      mesh.position.set(bh.pos[0], bh.pos[1], bh.pos[2]);
      mesh.rotation.set(bh.tilt[0], bh.tilt[1], bh.tilt[2]);
      mesh.scale.setScalar(bh.sphereRadius);
      mesh.renderOrder = 5;
      bhGroup.add(mesh);

      if (bh.hasJet) {
        const jetGroup = createRelativisticJet(bh.jetLength || 80, bh.jetColor || 0x60a5fa);
        jetGroup.position.set(bh.pos[0], bh.pos[1], bh.pos[2]);
        jetGroup.rotation.set(bh.tilt[0], bh.tilt[1], bh.tilt[2]);
        bhGroup.add(jetGroup);
      }

      blackHoleEntries.push({
        data: bh,
        worldPos: new THREE.Vector3(bh.pos[0], bh.pos[1], bh.pos[2]),
        maxActiveDist: bh.sphereRadius * 48,
        mesh: mesh,
        mat: mat
      });
    });
  }

  function createRelativisticJet(length, colorHex) {
    const g = new THREE.Group();
    const coneGeo = new THREE.ConeGeometry(length * 0.045, length, 14, 1, true);
    coneGeo.translate(0, length * 0.5, 0);

    const mat1 = new THREE.MeshBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: 0.42,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    g.add(new THREE.Mesh(coneGeo, mat1));

    const southJet = new THREE.Mesh(coneGeo, mat1.clone());
    southJet.material.opacity = 0.24;
    southJet.rotation.x = Math.PI;
    g.add(southJet);

    const coreGeo = new THREE.CylinderGeometry(0.18, length * 0.015, length * 0.92, 10, 1, true);
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0xe0f2fe,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    g.add(new THREE.Mesh(coreGeo, coreMat));
    return g;
  }

  // -------------------------------------------------------------------------
  // 4. GPU-BATCHED MERGED BUFFERS FOR ALL 229 GALAXIES (~500k Stars!)
  // -------------------------------------------------------------------------
  const allGalaxies = CAT.NAMED_GALAXIES.concat(CAT.generateClusterMemberGalaxies());
  let starPoints = null;
  let dustPoints = null;
  let batchedStarMat = null;
  let batchedDustMat = null;
  let totalBatchedStars = 0;
  const jetExtrasGroup = new THREE.Group();
  scene.add(jetExtrasGroup);

  function scaledStarCount(g) {
    const minS = g.isClusterMember ? 70 : 420;
    return Math.max(minS, Math.round(g.stars * STAR_SCALE));
  }

  function scaledDustCount(g) {
    if (!g.dust || g.dust <= 0) return 0;
    return Math.max(g.isClusterMember ? 6 : 24, Math.round(g.dust * DUST_SCALE));
  }

  function buildBatchedGalaxies() {
    const rng = makeRng(20261122);

    let totalStars = 0;
    let totalDust = 0;
    allGalaxies.forEach(function (g) {
      totalStars += scaledStarCount(g);
      totalDust += scaledDustCount(g);
    });
    const bridgeCount = 900;
    totalStars += bridgeCount;
    totalBatchedStars = totalStars;

    const sPos = new Float32Array(totalStars * 3);
    const sCol = new Float32Array(totalStars * 3);
    const sCenter = new Float32Array(totalStars * 3);
    const sQuat = new Float32Array(totalStars * 4);
    const sData = new Float32Array(totalStars * 4);

    const dPos = new Float32Array(totalDust * 3);
    const dCol = new Float32Array(totalDust * 3);
    const dCenter = new Float32Array(totalDust * 3);
    const dQuat = new Float32Array(totalDust * 4);
    const dData = new Float32Array(totalDust * 4);

    const tmpEuler = new THREE.Euler();
    const tmpQuat = new THREE.Quaternion();
    const cBulge = new THREE.Color();
    const cArm = new THREE.Color();
    const cStar = new THREE.Color();
    const cHII = new THREE.Color(0xff4f9a);
    const cWarm = new THREE.Color(0xffaa66);
    const cBlue = new THREE.Color(0x9bb8ff);

    let si = 0;
    let di = 0;

    allGalaxies.forEach(function (g) {
      tmpEuler.set(g.rot[0], g.rot[1], g.rot[2], 'XYZ');
      tmpQuat.setFromEuler(tmpEuler);

      cBulge.setHex(g.bulgeCol || 0xffe0b0);
      cArm.setHex(g.armCol || 0x8cc2ff);

      const cx = g.pos[0];
      const cy = g.pos[1];
      const cz = g.pos[2];
      const qx = tmpQuat.x;
      const qy = tmpQuat.y;
      const qz = tmpQuat.z;
      const qw = tmpQuat.w;
      const R = g.radius;
      const isMW = g.id === 'milkyway';
      const isHero = !g.isClusterMember;
      const gStars = scaledStarCount(g);
      const gDust = scaledDustCount(g);

      if (g.hasJet) {
        const jg = createRelativisticJet(g.jetLength || 65, g.jetColor || 0x7dd3fc);
        jg.position.set(cx, cy, cz);
        jg.quaternion.copy(tmpQuat);
        jetExtrasGroup.add(jg);
      }
      if (g.hasStarburst) {
        const sb = createRelativisticJet(R * 1.35, 0xff4560);
        sb.position.set(cx, cy, cz);
        sb.quaternion.copy(tmpQuat);
        jetExtrasGroup.add(sb);
      }

      // --- Populate Stars (fine-tuned sizes for full 500k density so cores stay crisp!) ---
      for (let i = 0; i < gStars; i++) {
        let lx = 0, ly = 0, lz = 0;
        let spectral = 0.5;
        let kind = 0.0;
        let size = isHero ? 0.50 + rng() * 0.85 : 0.70 + rng() * 1.05;
        let localOmega = g.omega || 0.08;
        const u = rng();

        if (g.type === 'elliptical') {
          const r = R * Math.pow(rng(), 1.9);
          const theta = rng() * Math.PI * 2;
          const phi = Math.acos(2 * rng() - 1);
          lx = r * Math.sin(phi) * Math.cos(theta);
          ly = r * Math.cos(phi) * 0.72;
          lz = r * Math.sin(phi) * Math.sin(theta) * 0.88;
          const rN = r / R;
          cStar.copy(cBulge).lerp(cArm, rN * 0.7);
          spectral = 0.65 + rng() * 0.35;
          localOmega *= 0.4;
          if (rN < 0.14) size *= 1.35;
        } else if (g.type === 'lenticular') {
          if (u < 0.48) {
            const r = R * 0.45 * Math.pow(rng(), 1.75);
            const theta = rng() * Math.PI * 2;
            const phi = Math.acos(2 * rng() - 1);
            lx = r * Math.sin(phi) * Math.cos(theta);
            ly = r * Math.cos(phi) * 0.62;
            lz = r * Math.sin(phi) * Math.sin(theta);
            cStar.copy(cBulge);
            spectral = 0.65 + rng() * 0.3;
          } else {
            const r = R * (0.28 + 0.72 * Math.sqrt(rng()));
            const a = rng() * Math.PI * 2;
            lx = Math.cos(a) * r;
            lz = Math.sin(a) * r;
            ly = randGauss(rng) * R * 0.032;
            cStar.copy(cBulge).lerp(cArm, r / R);
            spectral = 0.45 + rng() * 0.4;
          }
        } else if (g.type === 'ring') {
          if (u < 0.28) {
            const r = R * 0.22 * Math.pow(rng(), 1.5);
            const theta = rng() * Math.PI * 2;
            const phi = Math.acos(2 * rng() - 1);
            lx = r * Math.sin(phi) * Math.cos(theta);
            ly = r * Math.cos(phi) * 0.75;
            lz = r * Math.sin(phi) * Math.sin(theta);
            cStar.copy(cBulge);
            spectral = 0.75 + rng() * 0.25;
          } else if (g.arms > 0 && u < 0.45) {
            const armIdx = Math.floor(rng() * g.arms);
            const r = R * (0.24 + rng() * 0.64);
            const a = (armIdx / g.arms) * Math.PI * 2 + (r / R) * g.twist + randGauss(rng) * 0.16;
            lx = Math.cos(a) * r;
            lz = Math.sin(a) * r;
            ly = randGauss(rng) * R * 0.025;
            cStar.copy(cBulge).lerp(cArm, 0.55);
            spectral = 0.4;
          } else {
            const r = R * (0.82 + randGauss(rng) * 0.075);
            const a = rng() * Math.PI * 2;
            lx = Math.cos(a) * r;
            lz = Math.sin(a) * r;
            ly = randGauss(rng) * R * 0.025;
            cStar.copy(cArm).lerp(cBlue, rng() * 0.4);
            if (rng() < 0.09) {
              cStar.copy(cHII);
              kind = 1.0;
              size *= 2.0;
            }
            spectral = 0.1 + rng() * 0.3;
          }
        } else if (g.type === 'irregular') {
          const r = R * Math.pow(rng(), 0.78);
          const a = rng() * Math.PI * 2;
          const barStretch = rng() < 0.55 ? 1.45 : 0.85;
          lx = Math.cos(a) * r * barStretch + randGauss(rng) * R * 0.14;
          lz = Math.sin(a) * r * 0.72 + randGauss(rng) * R * 0.14;
          ly = randGauss(rng) * R * 0.16;
          cStar.copy(cBulge).lerp(cArm, Math.min(1, r / R + 0.25));
          if (rng() < 0.10) {
            cStar.copy(cHII);
            kind = 1.0;
            size *= 2.0;
          }
          spectral = 0.15 + rng() * 0.55;
        } else if (g.type === 'merger') {
          if (u < 0.34) {
            const r = R * 0.36 * Math.pow(rng(), 1.25);
            const a = rng() * Math.PI * 2 + (r / R) * 3.0;
            lx = -R * 0.22 + Math.cos(a) * r;
            lz = -R * 0.08 + Math.sin(a) * r;
            ly = randGauss(rng) * R * 0.07;
            cStar.copy(cBulge).lerp(cArm, r / (R * 0.4));
          } else if (u < 0.66) {
            const r = R * 0.34 * Math.pow(rng(), 1.25);
            const a = rng() * Math.PI * 2 - (r / R) * 2.6;
            lx = R * 0.24 + Math.cos(a) * r;
            lz = R * 0.12 + Math.sin(a) * r;
            ly = randGauss(rng) * R * 0.08 + R * 0.04;
            cStar.copy(cBulge).lerp(cArm, r / (R * 0.4));
          } else {
            const tailSide = rng() < 0.5 ? -1 : 1;
            const t = rng();
            const rad = R * (0.28 + t * 1.15);
            const ang = (tailSide > 0 ? 0.3 : Math.PI + 0.3) + t * 2.35;
            lx = Math.cos(ang) * rad + randGauss(rng) * R * 0.06;
            lz = Math.sin(ang) * rad + randGauss(rng) * R * 0.06;
            ly = Math.sin(t * Math.PI) * tailSide * R * 0.18 + randGauss(rng) * R * 0.04;
            cStar.copy(cArm).lerp(cBlue, 0.35);
            if (rng() < 0.11) {
              cStar.copy(cHII);
              kind = 1.0;
              size *= 2.1;
            }
          }
          spectral = 0.15 + rng() * 0.55;
        } else {
          const isBarred = g.type === 'barred';
          const numArms = Math.max(g.arms || 2, 2);

          if (u < (isBarred ? 0.24 : 0.19)) {
            const r = R * (isBarred ? 0.26 : 0.22) * Math.pow(rng(), 1.55);
            const theta = rng() * Math.PI * 2;
            const phi = Math.acos(2 * rng() - 1);
            lx = r * Math.sin(phi) * Math.cos(theta) * (isBarred ? 1.55 : 1.0);
            ly = r * Math.cos(phi) * (isMW ? 0.36 : 0.44);
            lz = r * Math.sin(phi) * Math.sin(theta) * (isBarred ? 0.62 : 1.0);
            // Keep Sgr A* immediate zone clear so Gargantua shines cleanly
            if (isMW) {
              const d0 = Math.sqrt(lx * lx + ly * ly + lz * lz);
              if (d0 < 5.5) {
                const push = 5.5 / Math.max(d0, 0.01);
                lx *= push;
                lz *= push;
              }
            }
            cStar.copy(cBulge).lerp(cWarm, rng() * 0.35);
            spectral = 0.65 + rng() * 0.35;
            size *= 1.1;
          } else {
            const armIdx = Math.floor(rng() * numArms);
            const isDiskScatter = rng() < 0.18;
            const rNorm = Math.pow(rng(), isDiskScatter ? 0.72 : 0.85);
            const r = R * (isBarred ? 0.18 + 0.82 * rNorm : 0.08 + 0.92 * rNorm);

            const baseAngle = (armIdx / numArms) * Math.PI * 2;
            const spiralAngle = (g.twist || 4.4) * Math.log(1.0 + rNorm * 3.8);
            const spread = isDiskScatter ? Math.PI * 2 : (0.24 + 0.46 * rNorm);
            const angle = baseAngle + spiralAngle + randGauss(rng) * spread;

            lx = Math.cos(angle) * r;
            lz = Math.sin(angle) * r;
            ly = randGauss(rng) * R * (0.022 + 0.035 * Math.exp(-rNorm * 3.2));

            cStar.copy(cBulge).lerp(cArm, Math.min(1, rNorm * 1.18));
            if (rng() < 0.22) cStar.lerp(cBlue, 0.55);
            else if (rng() < 0.18) cStar.lerp(cWarm, 0.45);

            if (!isDiskScatter && rng() < 0.055) {
              cStar.copy(cHII);
              kind = 1.0;
              size *= 2.1;
              spectral = 0.15;
            } else {
              spectral = Math.max(0.0, Math.min(1.0, (1.0 - rNorm) * 0.65 + rng() * 0.35));
            }
          }

          const rHoriz = Math.sqrt(lx * lx + lz * lz);
          localOmega = (g.omega || 0.1) * (R * 0.38) / (rHoriz + R * 0.18);
        }

        if (kind < 0.5 && isHero && rng() < 0.012) {
          kind = 2.0;
          size *= 1.75;
        }

        const i3 = si * 3;
        const i4 = si * 4;
        sPos[i3] = lx;
        sPos[i3 + 1] = ly;
        sPos[i3 + 2] = lz;

        sCol[i3] = cStar.r;
        sCol[i3 + 1] = cStar.g;
        sCol[i3 + 2] = cStar.b;

        sCenter[i3] = cx;
        sCenter[i3 + 1] = cy;
        sCenter[i3 + 2] = cz;

        sQuat[i4] = qx;
        sQuat[i4 + 1] = qy;
        sQuat[i4 + 2] = qz;
        sQuat[i4 + 3] = qw;

        sData[i4] = localOmega;
        sData[i4 + 1] = size * (isMW ? 1.05 : 1.0);
        sData[i4 + 2] = spectral;
        sData[i4 + 3] = kind;
        si++;
      }

      // --- Populate Interstellar Dust Lanes ---
      for (let d = 0; d < gDust; d++) {
        let lx = 0, ly = 0, lz = 0;
        let puffSize = isHero ? R * (0.055 + rng() * 0.065) : R * (0.09 + rng() * 0.08);
        let opacity = isHero ? 0.58 + rng() * 0.30 : 0.44 + rng() * 0.24;
        let localOmega = g.omega || 0.08;

        if (g.type === 'lenticular') {
          const r = R * (0.58 + rng() * 0.38);
          const a = rng() * Math.PI * 2;
          lx = Math.cos(a) * r;
          lz = Math.sin(a) * r;
          const warp = g.id === 'cena' ? Math.sin(a * 2.0) * R * 0.14 : 0.0;
          ly = warp + randGauss(rng) * R * 0.022;
          opacity = 0.78;
        } else if (g.type === 'ring') {
          const r = R * (0.76 + randGauss(rng) * 0.07);
          const a = rng() * Math.PI * 2;
          lx = Math.cos(a) * r;
          lz = Math.sin(a) * r;
          ly = randGauss(rng) * R * 0.02;
        } else if (g.type === 'irregular' || g.type === 'merger') {
          const r = R * Math.pow(rng(), 0.72) * 0.9;
          const a = rng() * Math.PI * 2;
          lx = Math.cos(a) * r;
          lz = Math.sin(a) * r;
          ly = randGauss(rng) * R * 0.08;
        } else {
          const numArms = Math.max(g.arms || 2, 2);
          const armIdx = Math.floor(rng() * numArms);
          const rNorm = 0.16 + Math.pow(rng(), 0.88) * 0.80;
          const r = R * rNorm;
          const baseAngle = (armIdx / numArms) * Math.PI * 2;
          const spiralAngle = (g.twist || 4.4) * Math.log(1.0 + rNorm * 3.8) - 0.14;
          const angle = baseAngle + spiralAngle + randGauss(rng) * (0.14 + 0.18 * rNorm);
          lx = Math.cos(angle) * r;
          lz = Math.sin(angle) * r;
          ly = randGauss(rng) * R * 0.015;
          localOmega = (g.omega || 0.1) * (R * 0.38) / (r + R * 0.18);
        }

        const j3 = di * 3;
        const j4 = di * 4;
        dPos[j3] = lx;
        dPos[j3 + 1] = ly;
        dPos[j3 + 2] = lz;

        dCol[j3] = 0.24 + rng() * 0.14;
        dCol[j3 + 1] = 0.14 + rng() * 0.09;
        dCol[j3 + 2] = 0.09 + rng() * 0.06;

        dCenter[j3] = cx;
        dCenter[j3 + 1] = cy;
        dCenter[j3 + 2] = cz;

        dQuat[j4] = qx;
        dQuat[j4 + 1] = qy;
        dQuat[j4 + 2] = qz;
        dQuat[j4 + 3] = qw;

        dData[j4] = localOmega;
        dData[j4 + 1] = puffSize;
        dData[j4 + 2] = rng();
        dData[j4 + 3] = opacity;
        di++;
      }
    });

    // Magellanic Stellar Bridge
    const lmcPos = new THREE.Vector3(-115, -96, 88);
    const smcPos = new THREE.Vector3(-148, -116, 118);
    for (let b = 0; b < bridgeCount; b++) {
      const t = rng();
      const i3 = si * 3;
      const i4 = si * 4;
      sPos[i3] = THREE.MathUtils.lerp(lmcPos.x, smcPos.x, t) + randGauss(rng) * 6.0;
      sPos[i3 + 1] = THREE.MathUtils.lerp(lmcPos.y, smcPos.y, t) + Math.sin(t * Math.PI) * 5.0 + randGauss(rng) * 4.0;
      sPos[i3 + 2] = THREE.MathUtils.lerp(lmcPos.z, smcPos.z, t) + randGauss(rng) * 6.0;
      sCol[i3] = 0.62;
      sCol[i3 + 1] = 0.80;
      sCol[i3 + 2] = 1.0;
      sCenter[i3] = 0;
      sCenter[i3 + 1] = 0;
      sCenter[i3 + 2] = 0;
      sQuat[i4] = 0;
      sQuat[i4 + 1] = 0;
      sQuat[i4 + 2] = 0;
      sQuat[i4 + 3] = 1;
      sData[i4] = 0.0;
      sData[i4 + 1] = 0.75 + rng() * 0.60;
      sData[i4 + 2] = 0.2;
      sData[i4 + 3] = 0.0;
      si++;
    }

    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
    starGeo.setAttribute('color', new THREE.BufferAttribute(sCol, 3));
    starGeo.setAttribute('aGalCenter', new THREE.BufferAttribute(sCenter, 3));
    starGeo.setAttribute('aGalQuat', new THREE.BufferAttribute(sQuat, 4));
    starGeo.setAttribute('aStarData', new THREE.BufferAttribute(sData, 4));

    batchedStarMat = SHADERS.createBatchedStarMaterial();
    batchedStarMat.uniforms.uPixelRatio.value = TARGET_PR;
    starPoints = new THREE.Points(starGeo, batchedStarMat);
    starPoints.frustumCulled = false;
    starPoints.renderOrder = 2;
    scene.add(starPoints);

    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dPos, 3));
    dustGeo.setAttribute('color', new THREE.BufferAttribute(dCol, 3));
    dustGeo.setAttribute('aGalCenter', new THREE.BufferAttribute(dCenter, 3));
    dustGeo.setAttribute('aGalQuat', new THREE.BufferAttribute(dQuat, 4));
    dustGeo.setAttribute('aDustData', new THREE.BufferAttribute(dData, 4));

    batchedDustMat = SHADERS.createBatchedDustMaterial(textures.dustCloud);
    batchedDustMat.uniforms.uPixelRatio.value = TARGET_PR;
    dustPoints = new THREE.Points(dustGeo, batchedDustMat);
    dustPoints.frustumCulled = false;
    dustPoints.renderOrder = 3;
    scene.add(dustPoints);
  }

  // -------------------------------------------------------------------------
  // 5. EXTREME INNER S-STARS (Kepler Solver + Live Rosette Precession Trails)
  // -------------------------------------------------------------------------
  const orbitsGroup = new THREE.Group();
  scene.add(orbitsGroup);
  const sStarRuntime = [];
  const TRAIL_POINTS = 160;

  function solveKepler(M, e) {
    let E = M;
    for (let k = 0; k < 5; k++) {
      E = E - (E - e * Math.sin(E) - M) / (1.0 - e * Math.cos(E));
    }
    return E;
  }

  function computeSStarPosition(star, meanAnomaly, omegaArg, outVec) {
    const E = solveKepler(meanAnomaly, star.e);
    const xOrb = star.a * (Math.cos(E) - star.e);
    const yOrb = star.a * Math.sqrt(1.0 - star.e * star.e) * Math.sin(E);

    const cw = Math.cos(omegaArg), sw = Math.sin(omegaArg);
    const ci = Math.cos(star.inc), si = Math.sin(star.inc);
    const cO = Math.cos(star.Omega), sO = Math.sin(star.Omega);

    const x1 = xOrb * cw - yOrb * sw;
    const y1 = xOrb * sw + yOrb * cw;
    const y2 = y1 * ci;
    const z2 = y1 * si;

    outVec.set(x1 * cO - z2 * sO, y2, x1 * sO + z2 * cO);
    return outVec;
  }

  function buildSStars() {
    CAT.S_STARS.forEach(function (s, idx) {
      const spMat = new THREE.SpriteMaterial({
        map: textures.starGlow,
        color: s.color,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      const sprite = new THREE.Sprite(spMat);
      sprite.scale.setScalar(s.size * 3.6);
      orbitsGroup.add(sprite);

      const trailPositions = new Float32Array(TRAIL_POINTS * 3);
      const trailGeo = new THREE.BufferGeometry();
      trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));
      const trailLine = new THREE.Line(
        trailGeo,
        new THREE.LineBasicMaterial({
          color: s.color,
          transparent: true,
          opacity: 0.62,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        })
      );
      trailLine.frustumCulled = false;
      orbitsGroup.add(trailLine);

      sStarRuntime.push({
        data: s,
        phaseOffset: idx * 2.1,
        sprite: sprite,
        trailGeo: trailGeo,
        trailPos: trailPositions,
        curPos: new THREE.Vector3()
      });
    });

    const solOrbitPts = [];
    const solR = Math.sqrt(26.0 * 26.0 + 3.2 * 3.2);
    for (let i = 0; i <= 128; i++) {
      const a = (i / 128) * Math.PI * 2;
      solOrbitPts.push(new THREE.Vector3(Math.cos(a) * solR, 0.35, Math.sin(a) * solR));
    }
    orbitsGroup.add(
      new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(solOrbitPts),
        new THREE.LineBasicMaterial({
          color: 0xfacc15,
          transparent: true,
          opacity: 0.22,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        })
      )
    );
  }

  function updateSStars(simTime) {
    const tmp = new THREE.Vector3();
    sStarRuntime.forEach(function (entry) {
      const s = entry.data;
      const tCycles = (simTime * 1.15) / s.period + entry.phaseOffset;
      const M = tCycles * Math.PI * 2;
      const omegaNow = s.omega0 + tCycles * s.precessionRate * Math.PI * 2;

      computeSStarPosition(s, M, omegaNow, entry.curPos);
      entry.sprite.position.copy(entry.curPos);

      const spanCycles = 2.4;
      for (let i = 0; i < TRAIL_POINTS; i++) {
        const frac = i / (TRAIL_POINTS - 1);
        const pastCycle = tCycles - (1.0 - frac) * spanCycles;
        const pastM = pastCycle * Math.PI * 2;
        const pastOmega = s.omega0 + pastCycle * s.precessionRate * Math.PI * 2;
        computeSStarPosition(s, pastM, pastOmega, tmp);
        entry.trailPos[i * 3] = tmp.x;
        entry.trailPos[i * 3 + 1] = tmp.y;
        entry.trailPos[i * 3 + 2] = tmp.z;
      }
      entry.trailGeo.attributes.position.needsUpdate = true;
    });
  }

  // -------------------------------------------------------------------------
  // 6. MILKY WAY FERMI (GAMMA) & eROSITA (SOFT X-RAY) BIPOLAR BUBBLES
  // -------------------------------------------------------------------------
  const fermiGroup = new THREE.Group();
  scene.add(fermiGroup);
  let fermiMat = null;
  let erositaMat = null;

  function buildFermiBubbles() {
    fermiMat = SHADERS.createFermiBubbleMaterial(false);
    erositaMat = SHADERS.createFermiBubbleMaterial(true);

    function createLobeMesh(rx, ry, yOffset, mat) {
      const geo = new THREE.SphereGeometry(1.0, 28, 20);
      geo.scale(rx, ry, rx);
      geo.translate(0, yOffset, 0);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.renderOrder = 4;
      return mesh;
    }

    fermiGroup.add(createLobeMesh(14.5, 16.5, 15.5, fermiMat));
    fermiGroup.add(createLobeMesh(14.5, 16.5, -15.5, fermiMat));
    fermiGroup.add(createLobeMesh(26.0, 29.0, 26.5, erositaMat));
    fermiGroup.add(createLobeMesh(26.0, 29.0, -26.5, erositaMat));
  }

  // -------------------------------------------------------------------------
  // 7. 23 LANDMARK STARS & 4 VOLUMETRIC 3D NEBULAE
  // -------------------------------------------------------------------------
  const landmarksGroup = new THREE.Group();
  scene.add(landmarksGroup);
  const pulsarSprites = [];

  function buildLandmarksAndNebulae() {
    const rng = makeRng(88421);

    CAT.LANDMARK_STARS.forEach(function (st) {
      const spMat = new THREE.SpriteMaterial({
        map: st.isSol ? textures.jwstSpike : textures.starGlow,
        color: st.color,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      const sprite = new THREE.Sprite(spMat);
      sprite.position.set(st.pos[0], st.pos[1], st.pos[2]);
      sprite.scale.setScalar(st.size * 2.2);
      landmarksGroup.add(sprite);

      if (st.isPulsar) {
        pulsarSprites.push({ sprite: sprite, baseScale: st.size * 2.2, freq: 14.0 });
      }

      if (st.isMicroBH) {
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(0.32, 1.05, 32),
          new THREE.MeshBasicMaterial({
            color: 0x38bdf8,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.78,
            blending: THREE.AdditiveBlending,
            depthWrite: false
          })
        );
        ring.position.set(st.pos[0], st.pos[1], st.pos[2]);
        ring.rotation.x = Math.PI * 0.35;
        landmarksGroup.add(ring);
      }

      if (st.isSol) {
        [0.45, 0.78, 1.15, 1.6].forEach(function (rr, idx) {
          const ring = new THREE.Mesh(
            new THREE.RingGeometry(rr - 0.015, rr + 0.015, 48),
            new THREE.MeshBasicMaterial({
              color: idx === 1 ? 0x38bdf8 : 0xfef08a,
              side: THREE.DoubleSide,
              transparent: true,
              opacity: 0.45,
              blending: THREE.AdditiveBlending,
              depthWrite: false
            })
          );
          ring.position.set(st.pos[0], st.pos[1], st.pos[2]);
          ring.rotation.x = Math.PI * 0.42;
          orbitsGroup.add(ring);
        });
      }
    });

    CAT.NEBULAE.forEach(function (neb) {
      const nGroup = new THREE.Group();
      nGroup.position.set(neb.pos[0], neb.pos[1], neb.pos[2]);
      landmarksGroup.add(nGroup);

      const puffCount = neb.isPillars ? 22 : 16;
      for (let i = 0; i < puffCount; i++) {
        const col = neb.colors[i % neb.colors.length];
        const sp = new THREE.Sprite(
          new THREE.SpriteMaterial({
            map: textures.nebulaPuff,
            color: col,
            transparent: true,
            opacity: 0.34 + rng() * 0.22,
            blending: THREE.AdditiveBlending,
            depthWrite: false
          })
        );

        if (neb.isPillars && i < 12) {
          const colIdx = i % 3;
          const hFrac = Math.floor(i / 3) / 3;
          sp.position.set(
            (colIdx - 1) * neb.radius * 0.36 + (rng() - 0.5) * 0.3,
            (hFrac - 0.5) * neb.radius * 1.15,
            (colIdx - 1) * 0.25 + (rng() - 0.5) * 0.3
          );
          sp.scale.setScalar(neb.radius * (0.48 - hFrac * 0.12));
        } else {
          const r = neb.radius * Math.pow(rng(), 0.7);
          const th = rng() * Math.PI * 2;
          const ph = Math.acos(2 * rng() - 1);
          sp.position.set(
            r * Math.sin(ph) * Math.cos(th),
            r * Math.cos(ph) * 0.75,
            r * Math.sin(ph) * Math.sin(th)
          );
          sp.scale.setScalar(neb.radius * (0.55 + rng() * 0.70));
        }
        nGroup.add(sp);
      }

      if (neb.isPulsar) {
        const pSp = new THREE.Sprite(
          new THREE.SpriteMaterial({
            map: textures.starGlow,
            color: 0xe0f2fe,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false
          })
        );
        pSp.scale.setScalar(1.5);
        nGroup.add(pSp);
        pulsarSprites.push({ sprite: pSp, baseScale: 1.5, freq: 24.0 });
      }
    });
  }

  // -------------------------------------------------------------------------
  // 8. 8 GALAXY CLUSTERS (ICM X-Ray Gas, Bullet Dark Matter, SMACS Arcs)
  // -------------------------------------------------------------------------
  const clusterEffectsGroup = new THREE.Group();
  scene.add(clusterEffectsGroup);
  const icmMaterials = [];

  function buildClusterEffects() {
    CAT.CLUSTERS.forEach(function (cl) {
      const g = new THREE.Group();
      g.position.set(cl.pos[0], cl.pos[1], cl.pos[2]);
      clusterEffectsGroup.add(g);

      if (cl.isBullet) {
        const shockMat = new THREE.SpriteMaterial({
          map: textures.nebulaPuff,
          color: 0xff3b9a,
          transparent: true,
          opacity: 0.14,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        });
        const shockSp = new THREE.Sprite(shockMat);
        shockSp.scale.set(cl.radius * 1.15, cl.radius * 0.9, 1);
        g.add(shockSp);
        icmMaterials.push({ mat: shockMat, opt: 0.12, xray: 0.90 });

        [-220, 220].forEach(function (offsetX) {
          const dmMat = new THREE.SpriteMaterial({
            map: textures.nebulaPuff,
            color: 0x3b82f6,
            transparent: true,
            opacity: 0.14,
            blending: THREE.AdditiveBlending,
            depthWrite: false
          });
          const dmSp = new THREE.Sprite(dmMat);
          dmSp.position.set(offsetX, 0, 0);
          dmSp.scale.setScalar(cl.radius * 1.25);
          g.add(dmSp);
          icmMaterials.push({ mat: dmMat, opt: 0.12, xray: 0.78 });
        });
      } else {
        const icmMat = new THREE.SpriteMaterial({
          map: textures.nebulaPuff,
          color: cl.icmColor,
          transparent: true,
          opacity: 0.08,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        });
        const icmSp = new THREE.Sprite(icmMat);
        icmSp.scale.setScalar(cl.radius * 2.1);
        g.add(icmSp);
        icmMaterials.push({ mat: icmMat, opt: 0.07, xray: 0.76 });
      }

      if (cl.hasLensingArcs) {
        [
          { r: cl.radius * 0.52, start: 0.2, len: 1.05, tiltX: 0.4, tiltY: 0.2 },
          { r: cl.radius * 0.64, start: 2.1, len: 0.92, tiltX: -0.35, tiltY: 0.6 },
          { r: cl.radius * 0.72, start: 4.0, len: 1.15, tiltX: 0.55, tiltY: -0.3 },
          { r: cl.radius * 0.46, start: 5.2, len: 0.75, tiltX: -0.25, tiltY: -0.5 }
        ].forEach(function (ac) {
          const arcMesh = new THREE.Mesh(
            new THREE.TorusGeometry(ac.r, 4.5, 8, 32, ac.len),
            new THREE.MeshBasicMaterial({
              color: 0xfbbf24,
              transparent: true,
              opacity: 0.78,
              blending: THREE.AdditiveBlending,
              depthWrite: false
            })
          );
          arcMesh.rotation.set(ac.tiltX, ac.tiltY, ac.start);
          g.add(arcMesh);
        });
      }
    });
  }

  // -------------------------------------------------------------------------
  // 9. LANIAKEA SUPERCLUSTER (Offset Shell + 50 Merged Streamlines + Pulses)
  // -------------------------------------------------------------------------
  const laniakeaGroup = new THREE.Group();
  laniakeaGroup.visible = false;
  scene.add(laniakeaGroup);
  const streamlineCurves = [];
  let flowPulsePoints = null;
  let flowPulseData = [];

  function buildLaniakea() {
    const L = CAT.LANIAKEA;
    const rng = makeRng(520520);

    const shellGeo = new THREE.SphereGeometry(1.0, 24, 18);
    shellGeo.scale(L.radii[0], L.radii[1], L.radii[2]);
    const shellMesh = new THREE.Mesh(
      shellGeo,
      new THREE.MeshBasicMaterial({
        color: 0x10b981,
        wireframe: true,
        transparent: true,
        opacity: 0.085,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    shellMesh.position.set(L.center[0], L.center[1], L.center[2]);
    laniakeaGroup.add(shellMesh);

    const voidRing = new THREE.Mesh(
      new THREE.RingGeometry(620, 660, 48),
      new THREE.MeshBasicMaterial({
        color: 0x64748b,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.25,
        depthWrite: false
      })
    );
    voidRing.position.set(L.localVoid[0], L.localVoid[1], L.localVoid[2]);
    voidRing.lookAt(0, 0, 0);
    laniakeaGroup.add(voidRing);

    const attractor = new THREE.Vector3(L.attractor[0], L.attractor[1], L.attractor[2]);
    const virgoPt = new THREE.Vector3(-680, 110, -1550);
    const segVerts = [];
    const segCols = [];

    const cStart = new THREE.Color(0x38bdf8);
    const cEnd = new THREE.Color(0xf472b6);
    const cMW = new THREE.Color(0xfde047);

    for (let s = 0; s < 50; s++) {
      let curve;
      const isPrimaryMW = s === 0;

      if (isPrimaryMW) {
        curve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(0, 0, 0),
          new THREE.Vector3(-340, 80, -780),
          virgoPt.clone(),
          new THREE.Vector3(-1260, -80, -2380),
          attractor.clone()
        ]);
      } else {
        const theta = rng() * Math.PI * 2;
        const phi = Math.acos(2 * rng() - 1);
        const startPt = new THREE.Vector3(
          L.center[0] + L.radii[0] * 0.94 * Math.sin(phi) * Math.cos(theta),
          L.center[1] + L.radii[1] * 0.92 * Math.cos(phi),
          L.center[2] + L.radii[2] * 0.94 * Math.sin(phi) * Math.sin(theta)
        );
        const mid1 = startPt.clone().lerp(attractor, 0.36);
        mid1.x += (rng() - 0.5) * 950;
        mid1.y += (rng() - 0.5) * 650;
        mid1.z += (rng() - 0.5) * 950;

        const mid2 = startPt.clone().lerp(attractor, 0.72);
        mid2.x += (rng() - 0.5) * 520;
        mid2.y += (rng() - 0.5) * 380;
        mid2.z += (rng() - 0.5) * 520;

        curve = new THREE.CatmullRomCurve3([startPt, mid1, mid2, attractor.clone()]);
      }

      streamlineCurves.push(curve);
      const pts = curve.getPoints(22);
      for (let k = 0; k < pts.length - 1; k++) {
        const t = k / (pts.length - 1);
        const col = isPrimaryMW ? cMW.clone().lerp(cEnd, t) : cStart.clone().lerp(cEnd, t);
        segVerts.push(pts[k].x, pts[k].y, pts[k].z, pts[k + 1].x, pts[k + 1].y, pts[k + 1].z);
        segCols.push(col.r, col.g, col.b, col.r, col.g, col.b);
      }
    }

    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(segVerts, 3));
    lineGeo.setAttribute('color', new THREE.Float32BufferAttribute(segCols, 3));
    laniakeaGroup.add(
      new THREE.LineSegments(
        lineGeo,
        new THREE.LineBasicMaterial({
          vertexColors: true,
          transparent: true,
          opacity: 0.36,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        })
      )
    );

    const pulseCount = 260;
    const pulsePos = new Float32Array(pulseCount * 3);
    const pulseCol = new Float32Array(pulseCount * 3);
    for (let p = 0; p < pulseCount; p++) {
      const cIdx = p % streamlineCurves.length;
      const t0 = rng();
      flowPulseData.push({ curveIdx: cIdx, t: t0, speed: 0.045 + rng() * 0.055 });
      const col = cIdx === 0 ? cMW : cStart.clone().lerp(cEnd, t0);
      pulseCol[p * 3] = col.r;
      pulseCol[p * 3 + 1] = col.g;
      pulseCol[p * 3 + 2] = col.b;
    }

    const pulseGeo = new THREE.BufferGeometry();
    pulseGeo.setAttribute('position', new THREE.BufferAttribute(pulsePos, 3));
    pulseGeo.setAttribute('color', new THREE.BufferAttribute(pulseCol, 3));
    flowPulsePoints = new THREE.Points(
      pulseGeo,
      new THREE.PointsMaterial({
        size: 56,
        map: textures.starGlow,
        vertexColors: true,
        transparent: true,
        opacity: 0.82,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    flowPulsePoints.frustumCulled = false;
    laniakeaGroup.add(flowPulsePoints);
  }

  function updateLaniakeaFlows(dt) {
    if (!flowPulsePoints || !laniakeaGroup.visible) return;
    const posArr = flowPulsePoints.geometry.attributes.position.array;
    const tmp = new THREE.Vector3();
    for (let i = 0; i < flowPulseData.length; i++) {
      const item = flowPulseData[i];
      item.t = (item.t + dt * item.speed * Math.max(state.speed, 0.15)) % 1.0;
      streamlineCurves[item.curveIdx].getPoint(item.t, tmp);
      posArr[i * 3] = tmp.x;
      posArr[i * 3 + 1] = tmp.y;
      posArr[i * 3 + 2] = tmp.z;
    }
    flowPulsePoints.geometry.attributes.position.needsUpdate = true;
  }

  // -------------------------------------------------------------------------
  // 10. QUIPU & 4 COMPANION SUPERSTRUCTURES (2 GPU Draw Calls, Distance-Culled)
  // -------------------------------------------------------------------------
  const quipuGroup = new THREE.Group();
  quipuGroup.visible = false;
  scene.add(quipuGroup);

  function buildSuperstructures() {
    const rng = makeRng(202568);
    const segVerts = [];
    const segCols = [];
    const knotVerts = [];
    const knotCols = [];

    CAT.SUPERSTRUCTURES.forEach(function (sup) {
      const colMain = new THREE.Color(sup.color);
      const colAccent = new THREE.Color(sup.accent);

      const spineVecs = sup.spine.map(function (p) {
        return new THREE.Vector3(p[0], p[1], p[2]);
      });
      const spineCurve = new THREE.CatmullRomCurve3(spineVecs);
      const spinePts = spineCurve.getPoints(44);

      for (let i = 0; i < spinePts.length - 1; i++) {
        segVerts.push(
          spinePts[i].x, spinePts[i].y, spinePts[i].z,
          spinePts[i + 1].x, spinePts[i + 1].y, spinePts[i + 1].z
        );
        segCols.push(colMain.r, colMain.g, colMain.b, colMain.r, colMain.g, colMain.b);
      }

      (sup.branches || []).forEach(function (br) {
        segVerts.push(br[0][0], br[0][1], br[0][2], br[1][0], br[1][1], br[1][2]);
        segCols.push(colAccent.r, colAccent.g, colAccent.b, colMain.r, colMain.g, colMain.b);
      });

      const tmp = new THREE.Vector3();
      for (let k = 0; k < sup.knots; k++) {
        const useBranch = sup.branches && sup.branches.length > 0 && k % 4 === 0;
        if (useBranch) {
          const br = sup.branches[k % sup.branches.length];
          const t = 0.2 + rng() * 0.8;
          tmp.set(
            THREE.MathUtils.lerp(br[0][0], br[1][0], t),
            THREE.MathUtils.lerp(br[0][1], br[1][1], t),
            THREE.MathUtils.lerp(br[0][2], br[1][2], t)
          );
        } else {
          spineCurve.getPoint(rng(), tmp);
        }
        tmp.x += randGauss(rng) * 480;
        tmp.y += randGauss(rng) * 420;
        tmp.z += randGauss(rng) * 480;

        knotVerts.push(tmp.x, tmp.y, tmp.z);
        const kc = colMain.clone().lerp(colAccent, rng());
        knotCols.push(kc.r, kc.g, kc.b);
      }
    });

    const fGeo = new THREE.BufferGeometry();
    fGeo.setAttribute('position', new THREE.Float32BufferAttribute(segVerts, 3));
    fGeo.setAttribute('color', new THREE.Float32BufferAttribute(segCols, 3));
    quipuGroup.add(
      new THREE.LineSegments(
        fGeo,
        new THREE.LineBasicMaterial({
          vertexColors: true,
          transparent: true,
          opacity: 0.55,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        })
      )
    );

    const kGeo = new THREE.BufferGeometry();
    kGeo.setAttribute('position', new THREE.Float32BufferAttribute(knotVerts, 3));
    kGeo.setAttribute('color', new THREE.Float32BufferAttribute(knotCols, 3));
    quipuGroup.add(
      new THREE.Points(
        kGeo,
        new THREE.PointsMaterial({
          size: 460,
          map: textures.starGlow,
          vertexColors: true,
          transparent: true,
          opacity: 0.92,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        })
      )
    );
  }

  // -------------------------------------------------------------------------
  // 11. COSMIC DAWN (MoM-z14, 28 Little Red Dots), JWST SKY & PLANCK CMB DOME
  // -------------------------------------------------------------------------
  let cmbDomeMesh = null;
  let cmbMat = null;
  let deepFieldMat = null;
  let lrdMat = null;
  let lrdPoints = null;
  let haloGrid = null;

  function buildCosmicHorizonAndSky() {
    const rng = makeRng(144400);

    cmbMat = SHADERS.createCMBDomeMaterial();
    cmbDomeMesh = new THREE.Mesh(new THREE.SphereGeometry(145000, 48, 32), cmbMat);
    cmbDomeMesh.renderOrder = -50;
    cmbDomeMesh.visible = false;
    scene.add(cmbDomeMesh);

    const skyCount = 2000;
    const skyPos = new Float32Array(skyCount * 3);
    const skyCol = new Float32Array(skyCount * 3);
    const palette = [
      new THREE.Color(0x9bb8ff),
      new THREE.Color(0xffffff),
      new THREE.Color(0xffdfa8),
      new THREE.Color(0xff9b6a),
      new THREE.Color(0xf472b6)
    ];

    for (let i = 0; i < skyCount; i++) {
      const r = 115000 + rng() * 13000;
      const th = rng() * Math.PI * 2;
      const ph = Math.acos(2 * rng() - 1);
      skyPos[i * 3] = r * Math.sin(ph) * Math.cos(th);
      skyPos[i * 3 + 1] = r * Math.cos(ph);
      skyPos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);

      const c = palette[Math.floor(rng() * palette.length)];
      const dim = 0.42 + rng() * 0.50;
      skyCol[i * 3] = c.r * dim;
      skyCol[i * 3 + 1] = c.g * dim;
      skyCol[i * 3 + 2] = c.b * dim;
    }

    const skyGeo = new THREE.BufferGeometry();
    skyGeo.setAttribute('position', new THREE.BufferAttribute(skyPos, 3));
    skyGeo.setAttribute('color', new THREE.BufferAttribute(skyCol, 3));
    deepFieldMat = new THREE.PointsMaterial({
      size: 560,
      map: textures.starGlow,
      vertexColors: true,
      transparent: true,
      opacity: 0.72,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const deepFieldPoints = new THREE.Points(skyGeo, deepFieldMat);
    deepFieldPoints.renderOrder = -20;
    scene.add(deepFieldPoints);

    const lrdCount = 28 + CAT.COSMIC_DAWN.length;
    const lrdPos = new Float32Array(lrdCount * 3);
    const lrdCol = new Float32Array(lrdCount * 3);

    CAT.COSMIC_DAWN.forEach(function (cd, idx) {
      lrdPos[idx * 3] = cd.pos[0];
      lrdPos[idx * 3 + 1] = cd.pos[1];
      lrdPos[idx * 3 + 2] = cd.pos[2];
      lrdCol[idx * 3] = 1.0;
      lrdCol[idx * 3 + 1] = 0.32;
      lrdCol[idx * 3 + 2] = 0.45;
    });

    for (let i = CAT.COSMIC_DAWN.length; i < lrdCount; i++) {
      const r = 78000 + rng() * 18000;
      const th = rng() * Math.PI * 2;
      const ph = Math.acos(2 * rng() - 1);
      lrdPos[i * 3] = r * Math.sin(ph) * Math.cos(th);
      lrdPos[i * 3 + 1] = r * Math.cos(ph);
      lrdPos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
      lrdCol[i * 3] = 1.0;
      lrdCol[i * 3 + 1] = 0.18 + rng() * 0.14;
      lrdCol[i * 3 + 2] = 0.25 + rng() * 0.15;
    }

    const lrdGeo = new THREE.BufferGeometry();
    lrdGeo.setAttribute('position', new THREE.BufferAttribute(lrdPos, 3));
    lrdGeo.setAttribute('color', new THREE.BufferAttribute(lrdCol, 3));
    lrdMat = new THREE.PointsMaterial({
      size: 2200,
      map: textures.jwstSpike,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    lrdPoints = new THREE.Points(lrdGeo, lrdMat);
    lrdPoints.visible = false;
    scene.add(lrdPoints);

    haloGrid = new THREE.PolarGridHelper(70, 12, 7, 64, 0x3b82f6, 0x1e293b);
    haloGrid.position.y = -0.25;
    haloGrid.visible = state.showHaloGrid;
    scene.add(haloGrid);
  }

  // -------------------------------------------------------------------------
  // 12. SCALE-AWARE FLOATING 3D SPACE LABELS
  // -------------------------------------------------------------------------
  const spaceLabels = [];

  function registerLabel(opts) {
    const el = document.createElement('div');
    el.className = 'space-label ' + (opts.cssClass || '');
    el.innerHTML = opts.text + (opts.meta ? '<span class="meta">' + opts.meta + '</span>' : '');
    if (opts.id) {
      el.addEventListener('click', function (e) {
        e.stopPropagation();
        window.focusTarget(opts.id);
      });
    }
    labelsContainer.appendChild(el);
    spaceLabels.push({
      el: el,
      pos: new THREE.Vector3(opts.pos[0], opts.pos[1], opts.pos[2]),
      minDist: opts.minDist || 0,
      maxDist: opts.maxDist || 999999,
      minCamOrigin: opts.minCamOrigin || 0,
      isArm: !!opts.isArm,
      dynamicSStar: opts.dynamicSStar || null
    });
  }

  function buildLabels() {
    CAT.BLACK_HOLES.forEach(function (bh) {
      registerLabel({
        id: bh.id,
        text: bh.shortName,
        meta: bh.cls,
        pos: [bh.pos[0], bh.pos[1] + bh.sphereRadius * 1.15, bh.pos[2]],
        cssClass: 'label-bh',
        minDist: 0,
        maxDist: bh.id === 'sgra' ? 42 : 420
      });
    });

    sStarRuntime.forEach(function (entry) {
      registerLabel({
        id: entry.data.id,
        text: entry.data.name,
        pos: [0, 0, 0],
        cssClass: 'label-star',
        minDist: 0.8,
        maxDist: 26,
        dynamicSStar: entry
      });
    });

    CAT.LANDMARK_STARS.forEach(function (st) {
      registerLabel({
        id: st.id,
        text: st.name.split(' (')[0],
        meta: st.isSol ? 'Home • 8.18 kpc' : null,
        pos: [st.pos[0], st.pos[1] + 1.1, st.pos[2]],
        cssClass: st.isSol ? 'label-sun' : 'label-star',
        minDist: st.isSol ? 0 : 2,
        maxDist: st.isSol ? 240 : 120
      });
    });

    CAT.NEBULAE.forEach(function (n) {
      registerLabel({
        id: n.id,
        text: n.name.split(' (')[0],
        pos: [n.pos[0], n.pos[1] + n.radius * 0.75, n.pos[2]],
        cssClass: 'label-nebula',
        minDist: 2,
        maxDist: 165
      });
    });

    CAT.SPIRAL_ARMS.forEach(function (arm) {
      registerLabel({
        text: arm.name,
        pos: arm.pos,
        cssClass: 'label-arm',
        minDist: 38,
        maxDist: 260,
        isArm: true
      });
    });

    CAT.NAMED_GALAXIES.forEach(function (g) {
      const isMajor = ['milkyway', 'm31', 'm33', 'lmc', 'smc', 'm81', 'm82', 'cena', 'm104', 'm51', 'm101', 'm74', 'm87', 'antennae', 'cartwheel', 'hoags', 'stephans', 'ic1101', 'alcyoneus'].indexOf(g.id) !== -1;
      registerLabel({
        id: g.id,
        text: g.shortName,
        meta: g.id === 'milkyway' ? 'Home • Laniakea Rim' : null,
        pos: [g.pos[0], g.pos[1] + g.radius * 0.65, g.pos[2]],
        cssClass: 'label-galaxy',
        minDist: g.id === 'milkyway' ? 115 : 35,
        maxDist: g.id === 'milkyway' ? 18000 : (isMajor ? 6200 : 1600),
        minCamOrigin: g.id === 'milkyway' ? 110 : 85
      });
    });

    CAT.CLUSTERS.forEach(function (cl) {
      registerLabel({
        id: cl.id,
        text: cl.shortName + ' Cluster',
        meta: cl.radiusTxt,
        pos: [cl.pos[0], cl.pos[1] + cl.radius * 0.85, cl.pos[2]],
        cssClass: 'label-cluster',
        minDist: 450,
        maxDist: 24000,
        minCamOrigin: 420
      });
    });

    CAT.LANIAKEA.lobes.forEach(function (lb) {
      registerLabel({
        id: 'laniakea',
        text: lb.name,
        pos: [lb.pos[0], lb.pos[1] + 420, lb.pos[2]],
        cssClass: 'label-cosmic',
        minDist: 2200,
        maxDist: 22000,
        minCamOrigin: 1600
      });
    });

    CAT.SUPERSTRUCTURES.forEach(function (sup) {
      registerLabel({
        id: sup.id,
        text: sup.name,
        meta: sup.knots + ' Clusters',
        pos: sup.labelPos,
        cssClass: 'label-cosmic',
        minDist: 4500,
        maxDist: 98000,
        minCamOrigin: 4200
      });
    });

    CAT.COSMIC_DAWN.forEach(function (cd) {
      registerLabel({
        id: cd.id,
        text: cd.shortName,
        meta: cd.cls,
        pos: cd.pos,
        cssClass: 'label-cosmic',
        minDist: 14000,
        maxDist: 160000,
        minCamOrigin: 15000
      });
    });
  }

  const projVec = new THREE.Vector3();
  function updateLabels(camOriginDist) {
    if (!state.showLabels) {
      labelsContainer.style.display = 'none';
      return;
    }
    labelsContainer.style.display = 'block';

    const w = window.innerWidth;
    const h = window.innerHeight;
    const camPos = camera.position;

    for (let i = 0; i < spaceLabels.length; i++) {
      const lb = spaceLabels[i];

      if ((lb.isArm && !state.showArms) || camOriginDist < lb.minCamOrigin) {
        lb.el.style.display = 'none';
        continue;
      }

      if (lb.dynamicSStar) {
        if (!state.showOrbits) {
          lb.el.style.display = 'none';
          continue;
        }
        lb.pos.copy(lb.dynamicSStar.curPos);
        lb.pos.y += 0.28;
      }

      const dist = camPos.distanceTo(lb.pos);
      if (dist < lb.minDist || dist > lb.maxDist) {
        lb.el.style.display = 'none';
        continue;
      }

      projVec.copy(lb.pos).project(camera);
      if (projVec.z > 1.0 || projVec.x < -1.05 || projVec.x > 1.05 || projVec.y < -1.05 || projVec.y > 1.05) {
        lb.el.style.display = 'none';
        continue;
      }

      const sx = (projVec.x * 0.5 + 0.5) * w;
      const sy = (-projVec.y * 0.5 + 0.5) * h;
      lb.el.style.display = 'block';
      lb.el.style.left = sx.toFixed(1) + 'px';
      lb.el.style.top = sy.toFixed(1) + 'px';
    }
  }

  // -------------------------------------------------------------------------
  // 13. SMOOTH CAMERA FLIGHT & TELEMETRY INSPECTOR
  // -------------------------------------------------------------------------
  const flight = {
    active: false,
    progress: 0,
    duration: 1.35,
    fromCam: new THREE.Vector3(),
    toCam: new THREE.Vector3(),
    fromTarget: new THREE.Vector3(),
    toTarget: new THREE.Vector3()
  };

  controls.addEventListener('start', function () {
    flight.active = false;
  });

  function updateInspectorCard(item) {
    if (!item) return;
    document.getElementById('insp-badge').textContent = item.badge || 'Astrophysical Object';
    document.getElementById('insp-title').textContent = item.title || item.label || item.id;
    document.getElementById('insp-class').textContent = item.cls || '--';
    document.getElementById('insp-radius').textContent = item.radius || '--';
    document.getElementById('insp-vel').textContent = item.vel || '--';
    document.getElementById('insp-sector').textContent = item.sector || '--';
    document.getElementById('insp-desc').textContent = item.desc || '';
    document.getElementById('activeViewBadge').textContent = item.label || item.title;
  }

  window.focusTarget = function (id, btnEl) {
    const item = CAT.INSPECTOR_LOOKUP[id];
    if (!item) return;

    window.currentSelectedId = id;
    updateInspectorCard(item);

    if (btnEl && btnEl.classList.contains('preset-btn')) {
      document.querySelectorAll('.preset-btn').forEach(function (b) {
        b.classList.remove('active');
      });
      btnEl.classList.add('active');
    }

    flight.fromCam.copy(camera.position);
    flight.fromTarget.copy(controls.target);
    flight.toCam.set(item.camPos[0], item.camPos[1], item.camPos[2]);
    flight.toTarget.set(item.target[0], item.target[1], item.target[2]);
    flight.progress = 0;
    flight.active = true;
  };

  // -------------------------------------------------------------------------
  // 14. SPECTRAL MODE SWITCHER (Optical / NIRCam / MIRI / X-Ray)
  // -------------------------------------------------------------------------
  const SPEC_BADGES = {
    optical: { num: 0.0, label: 'Optical HDR', exposure: 1.08 },
    nircam:  { num: 1.0, label: 'JWST NIRCam', exposure: 1.14 },
    miri:    { num: 2.0, label: 'JWST MIRI',   exposure: 1.12 },
    xray:    { num: 3.0, label: 'Chandra X-Ray', exposure: 1.18 }
  };

  function setSpectralMode(modeKey) {
    const cfg = SPEC_BADGES[modeKey] || SPEC_BADGES.optical;
    state.specMode = modeKey;
    state.specModeNum = cfg.num;

    document.getElementById('activeSpecBadge').textContent = cfg.label;
    renderer.toneMappingExposure = cfg.exposure;

    if (batchedStarMat) batchedStarMat.uniforms.uSpecMode.value = cfg.num;
    if (batchedDustMat) {
      batchedDustMat.uniforms.uSpecMode.value = cfg.num;
      const targetBlend = modeKey === 'miri' ? THREE.AdditiveBlending : THREE.NormalBlending;
      if (batchedDustMat.blending !== targetBlend) {
        batchedDustMat.blending = targetBlend;
        batchedDustMat.needsUpdate = true;
      }
    }
    if (fermiMat) fermiMat.uniforms.uSpecMode.value = cfg.num;
    if (erositaMat) erositaMat.uniforms.uSpecMode.value = cfg.num;
    if (cmbMat) cmbMat.uniforms.uSpecMode.value = cfg.num;

    blackHoleEntries.forEach(function (bh) {
      bh.mat.uniforms.uSpecMode.value = cfg.num;
    });

    icmMaterials.forEach(function (entry) {
      entry.mat.opacity = modeKey === 'xray' ? entry.xray : entry.opt;
    });

    if (deepFieldMat) {
      deepFieldMat.opacity = modeKey === 'nircam' ? 0.92 : (modeKey === 'xray' ? 0.25 : 0.70);
      deepFieldMat.size = modeKey === 'nircam' ? 760 : 560;
    }
    if (lrdMat) {
      lrdMat.opacity = modeKey === 'nircam' ? 1.0 : (modeKey === 'miri' ? 0.88 : 0.65);
    }
  }

  // -------------------------------------------------------------------------
  // 15. HUD & DIRECTORY EVENT WIRING
  // -------------------------------------------------------------------------
  function populateDirectoryTab(tabKey) {
    const listEl = document.getElementById('dir-list');
    listEl.innerHTML = '';
    const items = CAT.DIRECTORY_TABS[tabKey] || [];

    items.forEach(function (it) {
      const btn = document.createElement('button');
      btn.className = 'dir-chip';
      btn.textContent = it.label;
      btn.addEventListener('click', function () {
        window.focusTarget(it.id);
      });
      listEl.appendChild(btn);
    });
  }

  function wireUI() {
    document.querySelectorAll('.spec-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.querySelectorAll('.spec-btn').forEach(function (b) {
          b.classList.remove('active');
        });
        btn.classList.add('active');
        setSpectralMode(btn.getAttribute('data-mode'));
      });
    });

    document.querySelectorAll('.dir-tab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        document.querySelectorAll('.dir-tab').forEach(function (t) {
          t.classList.remove('active');
        });
        tab.classList.add('active');
        populateDirectoryTab(tab.getAttribute('data-tab'));
      });
    });
    populateDirectoryTab('stars');

    const hudBody = document.getElementById('hud-body');
    const collapseBtn = document.getElementById('collapseHudBtn');
    if (isMobile) {
      hudBody.style.display = 'none';
      collapseBtn.textContent = 'Show';
    }
    collapseBtn.addEventListener('click', function () {
      const hidden = hudBody.style.display === 'none';
      hudBody.style.display = hidden ? 'block' : 'none';
      collapseBtn.textContent = hidden ? 'Hide' : 'Show';
    });

    const inspBody = document.getElementById('insp-body');
    const toggleInspBtn = document.getElementById('toggleInspectorBtn');
    if (isMobile) {
      inspBody.style.display = 'none';
      toggleInspBtn.textContent = '+';
    }
    toggleInspBtn.addEventListener('click', function () {
      const hidden = inspBody.style.display === 'none';
      inspBody.style.display = hidden ? 'block' : 'none';
      toggleInspBtn.textContent = hidden ? '−' : '+';
    });

    const speedSlider = document.getElementById('speedSlider');
    const speedReadout = document.getElementById('speedReadout');
    speedSlider.addEventListener('input', function () {
      state.speed = parseFloat(speedSlider.value);
      speedReadout.textContent = state.speed.toFixed(1) + 'x';
    });

    const spinSlider = document.getElementById('gargantuaSpinSlider');
    const spinReadout = document.getElementById('gargantuaSpinReadout');
    spinSlider.addEventListener('input', function () {
      state.spin = parseFloat(spinSlider.value);
      spinReadout.textContent = state.spin.toFixed(2);
      blackHoleEntries.forEach(function (bh) {
        bh.mat.uniforms.uSpin.value = state.spin;
      });
    });

    const bloomSlider = document.getElementById('bloomSlider');
    const bloomReadout = document.getElementById('bloomReadout');
    bloomSlider.value = state.bloomStrength.toFixed(2);
    bloomReadout.textContent = state.bloomStrength.toFixed(2);
    bloomSlider.addEventListener('input', function () {
      state.bloomStrength = parseFloat(bloomSlider.value);
      bloomReadout.textContent = state.bloomStrength.toFixed(2);
      if (bloomPass) bloomPass.strength = state.bloomStrength;
    });

    const cmbSlider = document.getElementById('cmbOpacitySlider');
    const cmbReadout = document.getElementById('cmbOpacityReadout');
    cmbSlider.addEventListener('input', function () {
      state.cmbSliderOpacity = parseFloat(cmbSlider.value);
      cmbReadout.textContent = state.cmbSliderOpacity.toFixed(2);
    });

    document.getElementById('toggleBloom').addEventListener('change', function (e) {
      state.bloomEnabled = e.target.checked;
    });
    document.getElementById('toggleDust').addEventListener('change', function (e) {
      state.showDust = e.target.checked;
      if (dustPoints) dustPoints.visible = state.showDust;
    });
    document.getElementById('toggleLabels').addEventListener('change', function (e) {
      state.showLabels = e.target.checked;
    });
    document.getElementById('toggleArms').addEventListener('change', function (e) {
      state.showArms = e.target.checked;
    });
    document.getElementById('toggleOrbits').addEventListener('change', function (e) {
      state.showOrbits = e.target.checked;
      orbitsGroup.visible = state.showOrbits;
    });
    document.getElementById('toggleFermi').addEventListener('change', function (e) {
      state.showFermi = e.target.checked;
    });
    document.getElementById('toggleLaniakea').addEventListener('change', function (e) {
      state.showLaniakea = e.target.checked;
    });
    document.getElementById('toggleQuipu').addEventListener('change', function (e) {
      state.showQuipu = e.target.checked;
    });
    document.getElementById('toggleCMB').addEventListener('change', function (e) {
      state.showCMB = e.target.checked;
    });
    document.getElementById('toggleHaloGrid').addEventListener('change', function (e) {
      state.showHaloGrid = e.target.checked;
      if (haloGrid) haloGrid.visible = state.showHaloGrid;
    });

    document.getElementById('stat-galaxies').textContent = allGalaxies.length;
    document.getElementById('stat-stars').textContent = (totalBatchedStars / 1000).toFixed(0) + 'k';
  }

  // -------------------------------------------------------------------------
  // 16. INITIALIZE WORLD & START ANIMATION LOOP
  // -------------------------------------------------------------------------
  buildBlackHoles();
  buildBatchedGalaxies();
  buildSStars();
  buildFermiBubbles();
  buildLandmarksAndNebulae();
  buildClusterEffects();
  buildLaniakea();
  buildSuperstructures();
  buildCosmicHorizonAndSky();
  buildLabels();
  wireUI();
  updateInspectorCard(CAT.PRESETS.sgra);

  window.addEventListener('resize', function () {
    const w = window.innerWidth;
    const h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    if (composer) composer.setSize(w, h);
    if (bloomPass) {
      bloomPass.setSize(Math.max(256, Math.floor(w * 0.5)), Math.max(256, Math.floor(h * 0.5)));
    }
  });

  const clock = new THREE.Clock();
  const localCamTmp = new THREE.Vector3();
  let fpsFrames = 0;
  let fpsTimer = 0;
  let lastNear = camera.near;

  const statFpsEl = document.getElementById('stat-fps');
  const statCallsEl = document.getElementById('stat-calls');

  function animate() {
    requestAnimationFrame(animate);
    if (state.contextLost) return;

    const dt = Math.min(clock.getDelta(), 0.05);
    state.time += dt * state.speed;

    // 1. Smooth Camera Flight
    if (flight.active) {
      flight.progress += dt / flight.duration;
      if (flight.progress >= 1.0) {
        flight.progress = 1.0;
        flight.active = false;
      }
      const ease = 1.0 - Math.pow(1.0 - flight.progress, 3);
      camera.position.lerpVectors(flight.fromCam, flight.toCam, ease);
      controls.target.lerpVectors(flight.fromTarget, flight.toTarget, ease);
    }

    controls.update();

    // 2. Dynamic near-plane adjustment
    const camOriginDist = camera.position.length();
    const desiredNear = THREE.MathUtils.clamp(camOriginDist * 0.0015, 0.1, 45.0);
    if (Math.abs(desiredNear - lastNear) / lastNear > 0.15) {
      camera.near = desiredNear;
      camera.updateProjectionMatrix();
      lastNear = desiredNear;
    }

    // 3. Scale-Tier Visibility Culling (Massive FPS boost + ZERO origin white-out!)
    fermiGroup.visible = state.showFermi && camOriginDist > 12 && camOriginDist < 950;
    clusterEffectsGroup.visible = camOriginDist > 260;
    laniakeaGroup.visible = state.showLaniakea && camOriginDist > 520;
    quipuGroup.visible = state.showQuipu && camOriginDist > 2200;
    if (lrdPoints) lrdPoints.visible = camOriginDist > 12000;

    // 4. Distance-Culled Gargantua Ray-Marched Black Holes (Max 1 Active!)
    for (let i = 0; i < blackHoleEntries.length; i++) {
      const entry = blackHoleEntries[i];
      const bhDist = camera.position.distanceTo(entry.worldPos);
      const isActive = bhDist < entry.maxActiveDist;
      entry.mesh.visible = isActive;
      if (isActive) {
        entry.mat.uniforms.uTime.value = state.time;
        entry.mesh.updateMatrixWorld();
        localCamTmp.copy(camera.position);
        entry.mesh.worldToLocal(localCamTmp);
        entry.mat.uniforms.uCamLocal.value.copy(localCamTmp);
      }
    }

    // 5. Update Batched Galaxies, Dust & Fermi Bubbles
    if (batchedStarMat) batchedStarMat.uniforms.uTime.value = state.time;
    if (batchedDustMat && state.showDust) batchedDustMat.uniforms.uTime.value = state.time;
    if (fermiGroup.visible) {
      if (fermiMat) fermiMat.uniforms.uTime.value = state.time;
      if (erositaMat) erositaMat.uniforms.uTime.value = state.time;
    }

    // 6. Update S-Stars, Laniakea Pulses & Pulsars
    if (state.showOrbits && camOriginDist < 120) updateSStars(state.time);
    updateLaniakeaFlows(dt);

    if (camOriginDist < 220) {
      for (let p = 0; p < pulsarSprites.length; p++) {
        const ps = pulsarSprites[p];
        const pulse = 0.85 + 0.35 * Math.sin(state.time * ps.freq);
        ps.sprite.scale.setScalar(ps.baseScale * pulse);
      }
    }

    // 7. Distance-Adaptive Glare-Free Planck CMB Horizon
    if (cmbMat && cmbDomeMesh) {
      const distRamp = THREE.MathUtils.smoothstep(camOriginDist, 38000, 105000);
      const op = state.showCMB ? distRamp * state.cmbSliderOpacity : 0.0;
      cmbMat.uniforms.uOpacity.value = op;
      cmbDomeMesh.visible = op > 0.005;
    }

    // 8. Render
    if (composer && state.bloomEnabled && state.bloomStrength > 0.005) {
      composer.render();
    } else {
      renderer.render(scene, camera);
    }

    // 9. Project Floating 3D Labels
    updateLabels(camOriginDist);

    // 10. Live GPU Telemetry Bar
    fpsFrames++;
    fpsTimer += dt;
    if (fpsTimer >= 0.5) {
      const fps = Math.round(fpsFrames / fpsTimer);
      if (statFpsEl) statFpsEl.textContent = fps;
      if (statCallsEl) statCallsEl.textContent = renderer.info.render.calls;
      fpsFrames = 0;
      fpsTimer = 0;
    }
  }

  animate();
})();
