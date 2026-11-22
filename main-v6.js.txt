/* =========================================================================
 * main.js — Safe-Ultra WebGL / HDR GPU Engine (v6 — Deep-Field Universe Edition)
 * Upgrades in v6:
 *  - 30,150 Miniature Field & Deep-Field Galaxies in 1 GPU Draw Call using the
 *    2x2 procedural galaxy atlas (Spiral, Edge-On Disk, Elliptical, Irregular):
 *    * 150 Local Group dwarf satellites (110 – 650 units)
 *    * 10,000 Supergalactic Plane / Local Sheet & Laniakea field galaxies (650 – 20k)
 *    * 20,000 Deep-Field redshifted galaxies (20k – 115k) carving out all 14 voids!
 *  - Adaptive Optical-to-JWST Look: Crisp & subtle in Optical HDR, transforms
 *    into a sparkling JWST Ultra Deep Field when you click JWST NIRCam!
 *  - Auto-injected 'Field Galaxies' HUD toggle + full Perf/Balanced/Ultra LOD
 *  - Retains all v5 features (EHT Radio, OJ 287, NGC 6505, Sgr Stream, Cosmic Web)
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
  // 1. GLOBAL STATE & QUALITY PROFILES (Auto-Tuned for Mobile & Laptop)
  // -------------------------------------------------------------------------
  const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || window.innerWidth < 768;
  const STAR_SCALE = 1.0; // All ~500k stars loaded; vertex-shader LOD keeps FPS smooth!
  const DUST_SCALE = isMobile ? 0.28 : 0.38;

  const QUALITY_PROFILES = {
    perf: {
      label: 'Perf',
      lod: 0.38,
      prCap: isMobile ? 0.85 : 1.0,
      bloomDefault: false,
      bloomStrength: 0.45,
      heroGlows: false
    },
    balanced: {
      label: 'Balanced',
      lod: 0.68,
      prCap: isMobile ? 1.0 : 1.15,
      bloomDefault: true,
      bloomStrength: 0.58,
      heroGlows: true
    },
    ultra: {
      label: 'Ultra',
      lod: 1.0,
      prCap: isMobile ? 1.25 : 1.35,
      bloomDefault: true,
      bloomStrength: 0.65,
      heroGlows: true
    }
  };

  const initialQuality = isMobile ? 'balanced' : 'ultra';
  const initCfg = QUALITY_PROFILES[initialQuality];
  let currentPR = Math.min(window.devicePixelRatio || 1, initCfg.prCap);

  const state = {
    time: 0,
    speed: 1.0,
    spin: 0.85,
    quality: initialQuality,
    lodDensity: initCfg.lod,
    bloomStrength: initCfg.bloomStrength,
    bloomEnabled: initCfg.bloomDefault,
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
    showCosmicWeb: true,
    showSgrStream: true,
    showFieldGalaxies: true,
    showCMB: true,
    showHaloGrid: false,
    showHeroGlows: initCfg.heroGlows,
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
  renderer.setPixelRatio(currentPR);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x020309, 1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  container.insertBefore(renderer.domElement, labelsContainer);

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

  // Half-Resolution HDR Unreal Bloom (4x less GPU fill-rate!)
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

  const jetRadioMaterials = [];

  function registerJetMaterial(mat, baseColorHex, optOp, radioOp, radioColorHex) {
    jetRadioMaterials.push({
      mat: mat,
      baseColor: new THREE.Color(baseColorHex),
      radioColor: new THREE.Color(radioColorHex || 0xff7b1c),
      optOp: optOp,
      radioOp: radioOp
    });
    return mat;
  }

  function createRelativisticJet(length, colorHex) {
    const g = new THREE.Group();
    const coneGeo = new THREE.ConeGeometry(length * 0.045, length, 14, 1, true);
    coneGeo.translate(0, length * 0.5, 0);

    const mat1 = registerJetMaterial(
      new THREE.MeshBasicMaterial({
        color: colorHex,
        transparent: true,
        opacity: 0.42,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide
      }),
      colorHex, 0.42, 0.88, 0xff6a1a
    );
    g.add(new THREE.Mesh(coneGeo, mat1));

    const mat2 = registerJetMaterial(
      mat1.clone(),
      colorHex, 0.24, 0.66, 0xff5214
    );
    mat2.opacity = 0.24;
    const southJet = new THREE.Mesh(coneGeo, mat2);
    southJet.rotation.x = Math.PI;
    g.add(southJet);

    const coreGeo = new THREE.CylinderGeometry(0.18, length * 0.015, length * 0.92, 10, 1, true);
    const coreMat = registerJetMaterial(
      new THREE.MeshBasicMaterial({
        color: 0xe0f2fe,
        transparent: true,
        opacity: 0.55,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      }),
      0xe0f2fe, 0.55, 0.96, 0xffd166
    );
    g.add(new THREE.Mesh(coreGeo, coreMat));
    return g;
  }

  // -------------------------------------------------------------------------
  // 4. GPU-BATCHED MERGED BUFFERS (~500k Stars + Globular Halos + Glow Planes)
  // -------------------------------------------------------------------------
  const allGalaxies = CAT.NAMED_GALAXIES.concat(CAT.generateClusterMemberGalaxies());
  let starPoints = null;
  let dustPoints = null;
  let batchedStarMat = null;
  let batchedDustMat = null;
  let totalBatchedStars = 0;

  const jetExtrasGroup = new THREE.Group();
  scene.add(jetExtrasGroup);

  const heroGlowGroup = new THREE.Group();
  scene.add(heroGlowGroup);
  const heroGlowEntries = [];

  const HERO_GLOW_IDS = {
    milkyway: 1, m31: 1, m33: 1, m81: 1, m82: 1, cena: 1, m104: 1,
    m51: 1, m101: 1, m74: 1, m64: 1, m87: 1, ngc1300: 1, cartwheel: 1,
    hoags: 1, ic1101: 1
  };

  const GLOBULAR_HALO_COUNTS = {
    milkyway: 180,
    m31: 240,
    m104: 260,
    m87: 380,
    m49: 220,
    ic1101: 320
  };

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
      totalStars += GLOBULAR_HALO_COUNTS[g.id] || 0;
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
    const cOB = new THREE.Color(0xbae6fd);
    const cGlobular = new THREE.Color(0xffdf9e);

    const glowPlaneGeo = new THREE.PlaneGeometry(1, 1);
    glowPlaneGeo.rotateX(-Math.PI * 0.5);

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

      // Photographic Unresolved Starlight Disk Glow (1 ultra-cheap quad per hero galaxy!)
      if (HERO_GLOW_IDS[g.id] && textures.galaxyGlow) {
        const baseOp = g.type === 'elliptical' ? 0.34 : 0.24;
        const gMat = new THREE.MeshBasicMaterial({
          map: textures.galaxyGlow,
          color: g.type === 'elliptical' ? cBulge.clone() : cBulge.clone().lerp(cArm, 0.32),
          transparent: true,
          opacity: baseOp,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide
        });
        const gMesh = new THREE.Mesh(glowPlaneGeo, gMat);
        gMesh.position.set(cx, cy, cz);
        gMesh.quaternion.copy(tmpQuat);
        gMesh.scale.setScalar(R * 2.15);
        gMesh.renderOrder = 1;
        heroGlowGroup.add(gMesh);
        heroGlowEntries.push({ mesh: gMesh, mat: gMat, baseOp: baseOp, isMW: isMW });
      }

      // --- Populate Stars (Rich astronomical features at startup: 0 ongoing FPS cost!) ---
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
          // Spiral & Barred Spiral (with realistic bar bridges & OB star-forming clumps!)
          const isBarred = g.type === 'barred';
          const numArms = Math.max(g.arms || 2, 2);

          if (u < (isBarred ? 0.26 : 0.19)) {
            if (isBarred && rng() < 0.35) {
              // Straight luminous central galactic bar bridging into inner spiral arm roots
              const barT = (rng() * 2.0 - 1.0) * R * 0.28;
              lx = barT;
              lz = randGauss(rng) * R * 0.048 * (1.0 - Math.abs(barT) / (R * 0.38));
              ly = randGauss(rng) * R * 0.032;
            } else {
              const r = R * (isBarred ? 0.24 : 0.22) * Math.pow(rng(), 1.55);
              const theta = rng() * Math.PI * 2;
              const phi = Math.acos(2 * rng() - 1);
              lx = r * Math.sin(phi) * Math.cos(theta) * (isBarred ? 1.45 : 1.0);
              ly = r * Math.cos(phi) * (isMW ? 0.36 : 0.44);
              lz = r * Math.sin(phi) * Math.sin(theta) * (isBarred ? 0.65 : 1.0);
            }
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
            const isDiskScatter = rng() < 0.17;
            const rNorm = Math.pow(rng(), isDiskScatter ? 0.72 : 0.85);
            const r = R * (isBarred ? 0.18 + 0.82 * rNorm : 0.08 + 0.92 * rNorm);

            const baseAngle = (armIdx / numArms) * Math.PI * 2;
            const spiralAngle = (g.twist || 4.4) * Math.log(1.0 + rNorm * 3.8);
            const spread = isDiskScatter ? Math.PI * 2 : (0.21 + 0.44 * rNorm);
            const angle = baseAngle + spiralAngle + randGauss(rng) * spread;

            lx = Math.cos(angle) * r;
            lz = Math.sin(angle) * r;
            ly = randGauss(rng) * R * (0.020 + 0.035 * Math.exp(-rNorm * 3.2));

            cStar.copy(cBulge).lerp(cArm, Math.min(1, rNorm * 1.18));
            const knotRoll = rng();

            if (!isDiskScatter && knotRoll < 0.055) {
              // Pink HII ionized star-forming nursery
              cStar.copy(cHII);
              kind = 1.0;
              size *= 2.15;
              spectral = 0.12;
            } else if (!isDiskScatter && knotRoll < 0.13) {
              // Young hot blue-white OB star association hugging spiral ridge
              cStar.copy(cOB).lerp(cBlue, rng() * 0.45);
              size *= 1.32;
              spectral = 0.06;
            } else {
              if (rng() < 0.20) cStar.lerp(cBlue, 0.55);
              else if (rng() < 0.18) cStar.lerp(cWarm, 0.45);
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

      // --- Populate Ancient Spherical Globular Cluster Halo (MW, M31, M104, M87, M49, IC 1101) ---
      const gcCount = GLOBULAR_HALO_COUNTS[g.id] || 0;
      for (let gc = 0; gc < gcCount; gc++) {
        const r = R * (0.28 + Math.pow(rng(), 1.35) * 1.12);
        const theta = rng() * Math.PI * 2;
        const phi = Math.acos(2 * rng() - 1);
        const i3 = si * 3;
        const i4 = si * 4;
        sPos[i3] = r * Math.sin(phi) * Math.cos(theta);
        sPos[i3 + 1] = r * Math.cos(phi) * 0.82;
        sPos[i3 + 2] = r * Math.sin(phi) * Math.sin(theta);

        sCol[i3] = cGlobular.r;
        sCol[i3 + 1] = cGlobular.g;
        sCol[i3 + 2] = cGlobular.b;

        sCenter[i3] = cx;
        sCenter[i3 + 1] = cy;
        sCenter[i3 + 2] = cz;

        sQuat[i4] = qx;
        sQuat[i4 + 1] = qy;
        sQuat[i4 + 2] = qz;
        sQuat[i4 + 3] = qw;

        sData[i4] = (g.omega || 0.05) * 0.22;
        sData[i4 + 1] = 1.45 + rng() * 0.85;
        sData[i4 + 2] = 0.82;
        sData[i4 + 3] = 3.0; // Kind 3 = soft golden Globular Cluster
        si++;
      }

      // --- Populate Interstellar Dust Lanes (uses 2x2 Procedural Dust Atlas!) ---
      for (let d = 0; d < gDust; d++) {
        let lx = 0, ly = 0, lz = 0;
        let puffSize = isHero ? R * (0.058 + rng() * 0.068) : R * (0.09 + rng() * 0.08);
        let opacity = isHero ? 0.60 + rng() * 0.30 : 0.44 + rng() * 0.24;
        let localOmega = g.omega || 0.08;

        if (g.type === 'lenticular') {
          const r = R * (0.58 + rng() * 0.38);
          const a = rng() * Math.PI * 2;
          lx = Math.cos(a) * r;
          lz = Math.sin(a) * r;
          const warp = g.id === 'cena' ? Math.sin(a * 2.0) * R * 0.14 : 0.0;
          ly = warp + randGauss(rng) * R * 0.022;
          opacity = 0.80;
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
          const rNorm = 0.15 + Math.pow(rng(), 0.88) * 0.81;
          const r = R * rNorm;
          const baseAngle = (armIdx / numArms) * Math.PI * 2;
          const spiralAngle = (g.twist || 4.4) * Math.log(1.0 + rNorm * 3.8) - 0.15;
          const angle = baseAngle + spiralAngle + randGauss(rng) * (0.13 + 0.18 * rNorm);
          lx = Math.cos(angle) * r;
          lz = Math.sin(angle) * r;
          ly = randGauss(rng) * R * 0.014;
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
    batchedStarMat.uniforms.uPixelRatio.value = currentPR;
    batchedStarMat.uniforms.uLodDensity.value = state.lodDensity;
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

    batchedDustMat = SHADERS.createBatchedDustMaterial(textures.dustAtlas || textures.dustCloud);
    batchedDustMat.uniforms.uPixelRatio.value = currentPR;
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
      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: textures.starGlow,
          color: s.color,
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        })
      );
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
  // 7. 23 LANDMARK STARS & 4 LAYERED 3D NEBULAE (Trapezium, Pillars, Pulsar)
  // -------------------------------------------------------------------------
  const landmarksGroup = new THREE.Group();
  scene.add(landmarksGroup);
  const pulsarSprites = [];

  function buildLandmarksAndNebulae() {
    const rng = makeRng(88421);

    CAT.LANDMARK_STARS.forEach(function (st) {
      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: st.isSol ? textures.jwstSpike : textures.starGlow,
          color: st.color,
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        })
      );
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

      const puffCount = neb.isPillars ? 26 : 18;
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

        if (neb.isPillars && i < 15) {
          // 3 sculpted Pillars of Creation columns with ionized golden-cyan tips
          const colIdx = i % 3;
          const hFrac = Math.floor(i / 3) / 4;
          sp.position.set(
            (colIdx - 1) * neb.radius * 0.36 + (rng() - 0.5) * 0.25,
            (hFrac - 0.45) * neb.radius * 1.15,
            (colIdx - 1) * 0.25 + (rng() - 0.5) * 0.25
          );
          sp.scale.setScalar(neb.radius * (0.48 - hFrac * 0.14));
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

      // Add embedded newborn Trapezium O-stars inside Orion M42 & Carina
      if (neb.id === 'orion' || neb.id === 'carina') {
        const starCount = neb.id === 'orion' ? 5 : 7;
        for (let k = 0; k < starCount; k++) {
          const obSp = new THREE.Sprite(
            new THREE.SpriteMaterial({
              map: textures.jwstSpike,
              color: 0xdbeafe,
              transparent: true,
              opacity: 0.92,
              blending: THREE.AdditiveBlending,
              depthWrite: false
            })
          );
          obSp.position.set(
            (rng() - 0.5) * neb.radius * 0.45,
            (rng() - 0.5) * neb.radius * 0.35,
            (rng() - 0.5) * neb.radius * 0.45
          );
          obSp.scale.setScalar(0.85 + rng() * 0.55);
          nGroup.add(obSp);
        }
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
        pSp.scale.setScalar(1.55);
        nGroup.add(pSp);
        pulsarSprites.push({ sprite: pSp, baseScale: 1.55, freq: 24.0 });
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
  // 10B. HYBRID 360° 3D COSMIC WEB (IllustrisTNG Filaments + DESI/Euclid Mist)
  //      Shell: 19,500 – 71,000 units | 2 GPU Draw Calls + 2 Void Markers
  // -------------------------------------------------------------------------
  const cosmicWebGroup = new THREE.Group();
  cosmicWebGroup.visible = false;
  scene.add(cosmicWebGroup);

  let cosmicWebLineMat = null;
  let cosmicWebPointMat = null;
  let cosmicWebVoids = [];

  const COSMIC_WEB_LANDMARKS = [
    {
      id: 'cosmicweb',
      label: 'Cosmic Web 3D',
      title: '3D Cosmic Web & Supervoids',
      badge: 'IllustrisTNG + DESI / Euclid Scale',
      cls: '185 Nodes • 345 Curved Filaments',
      radius: '0.7 – 10+ Bly Shell',
      vel: 'Dark Matter & WHIM Skeleton',
      sector: 'Large-Scale Structure',
      target: [0, 0, 0],
      camPos: [34000, 29000, 52000],
      desc: 'Foam-like 3D cosmic sponge connecting superclusters across billion-light-year voids. Switch to NIRCam for a DESI/Euclid galaxy map or X-Ray for electric WHIM plasma!'
    },
    {
      id: 'sloanwall',
      label: 'Sloan Great Wall',
      title: 'Sloan Great Wall (SGW)',
      badge: 'SDSS Benchmark Galaxy Wall',
      cls: '1.37 Billion ly Filament',
      radius: '~1.0 Bly Distance (z ≈ 0.07)',
      vel: 'Connected Superclusters',
      sector: 'Northern Cosmic Web',
      target: [29500, 11200, -3500],
      camPos: [14500, 19500, 18500],
      desc: 'Iconic 1.37-billion-light-year ribbon of connected galaxy superclusters mapped by the Sloan Digital Sky Survey—a classic benchmark of cosmic web morphology.'
    },
    {
      id: 'bosswall',
      label: 'BOSS Great Wall',
      title: 'BOSS Great Wall Complex',
      badge: 'Supercluster Wall • 830+ Galaxies',
      cls: '~1.0 Bly Across • 10,000× MW Mass',
      radius: 'z ≈ 0.47 (~4.5–6.8 Bly)',
      vel: '4 Linked Superclusters',
      sector: 'Deep Southern Web',
      target: [-11500, -15000, 41500],
      camPos: [-22000, -2500, 18500],
      desc: 'Colossal complex of four linked superclusters identified by SDSS-BOSS, packing roughly 10,000 times the mass of the Milky Way across a billion light-years.'
    },
    {
      id: 'hcbwall',
      label: 'HCB Great Wall',
      title: 'Hercules–Corona Borealis Great Wall',
      badge: 'Largest Candidate Superstructure',
      cls: '~10 Billion ly Span (3 Gpc)',
      radius: '9.6 – 10.5 Bly (z ≈ 1.6–2.1)',
      vel: 'GRB Clustering Frontier',
      sector: 'Deep Cosmic Web Rim',
      target: [-18000, 36000, -44000],
      camPos: [-6500, 22000, -14000],
      desc: 'Vast candidate filament traced by an extraordinary clustering of gamma-ray bursts ~10 billion light-years away—challenging the scale of cosmic homogeneity.'
    },
    {
      id: 'bootesvoid',
      label: 'Boötes Void',
      title: 'Boötes Void (The Great Nothing)',
      badge: 'Giant Spherical Supervoid',
      cls: '~330 Million ly Diameter (~100 Mpc)',
      radius: '~700 Mly Distance',
      vel: '~60 Known Galaxies Inside',
      sector: 'Beyond Hercules Wall',
      target: [-23500, 18500, 22500],
      camPos: [-8500, 26000, 39500],
      desc: 'One of the largest known cosmic voids—so empty that had the Milky Way sat at its center, humanity would not have known other galaxies existed until the 1960s.'
    },
    {
      id: 'eridanusvoid',
      label: 'Eridanus Supervoid',
      title: 'Eridanus Supervoid (CMB Cold Spot)',
      badge: 'Underdense Supervoid Region',
      cls: '500 Mly – 1.0 Bly Candidate Span',
      radius: 'Deep Southern Void',
      vel: 'Linked to Planck Cold Spot',
      sector: 'Eridanus-Sculptor Sky',
      target: [29500, -21000, -24500],
      camPos: [14500, -9500, -6500],
      desc: 'Enormous underdense cavity in the southern cosmic web aligned with the anomalous Cosmic Microwave Background Cold Spot mapped by WMAP and Planck.'
    }
  ];

  function registerCosmicWebCatalog() {
    COSMIC_WEB_LANDMARKS.forEach(function (lm) {
      CAT.INSPECTOR_LOOKUP[lm.id] = lm;
      const alreadyInTab = CAT.DIRECTORY_TABS.cosmic.some(function (it) {
        return it.id === lm.id;
      });
      if (!alreadyInTab) {
        // Insert before 'horizon' (Planck CMB) so scale order stays ascending
        const hIdx = CAT.DIRECTORY_TABS.cosmic.findIndex(function (it) {
          return it.id === 'horizon';
        });
        const entry = { id: lm.id, label: lm.label };
        if (hIdx >= 0) {
          CAT.DIRECTORY_TABS.cosmic.splice(hIdx, 0, entry);
        } else {
          CAT.DIRECTORY_TABS.cosmic.push(entry);
        }
      }
    });
  }

  function buildCosmicWeb() {
    const rng = makeRng(2026360);

    // 1. Named & Procedural Carved Cosmic Voids
    const voids = [
      { id: 'bootesvoid', pos: new THREE.Vector3(-23500, 18500, 22500), r: 10800, named: true },
      { id: 'eridanusvoid', pos: new THREE.Vector3(29500, -21000, -24500), r: 13200, named: true }
    ];

    // 2. Landmark Great Walls (high-density curved filament spines)
    const walls = [
      {
        id: 'sloanwall',
        pts: [
          new THREE.Vector3(24500, 11500, -18000),
          new THREE.Vector3(29500, 13800, -8500),
          new THREE.Vector3(31500, 11200, 3500),
          new THREE.Vector3(28000, 6800, 14500),
          new THREE.Vector3(21500, 2200, 22500)
        ]
      },
      {
        id: 'bosswall',
        pts: [
          new THREE.Vector3(-34000, -12000, 26000),
          new THREE.Vector3(-24000, -16500, 35500),
          new THREE.Vector3(-11500, -15000, 41500),
          new THREE.Vector3(2500, -11000, 42500),
          new THREE.Vector3(15500, -6500, 38500)
        ]
      },
      {
        id: 'hcbwall',
        pts: [
          new THREE.Vector3(-48000, 26000, -18000),
          new THREE.Vector3(-36000, 34000, -32000),
          new THREE.Vector3(-18000, 36000, -44000),
          new THREE.Vector3(4000, 31000, -49000),
          new THREE.Vector3(24000, 22000, -46000)
        ]
      }
    ];

    // Carve 12 additional dark cosmic voids around the 360° shell
    let vAtt = 0;
    while (voids.length < 14 && vAtt < 800) {
      vAtt++;
      const r = 28000 + rng() * 34000;
      const th = rng() * Math.PI * 2;
      const ph = Math.acos(2 * rng() - 1);
      const vp = new THREE.Vector3(
        r * Math.sin(ph) * Math.cos(th),
        r * Math.cos(ph),
        r * Math.sin(ph) * Math.sin(th)
      );
      const vr = 8800 + rng() * 4200;

      let ok = true;
      for (let w = 0; w < walls.length && ok; w++) {
        for (let k = 0; k < walls[w].pts.length; k++) {
          if (vp.distanceTo(walls[w].pts[k]) < vr + 5500) {
            ok = false;
            break;
          }
        }
      }
      for (let v = 0; v < voids.length && ok; v++) {
        if (vp.distanceTo(voids[v].pos) < (vr + voids[v].r) * 0.85) {
          ok = false;
        }
      }
      if (ok) voids.push({ id: 'void_' + voids.length, pos: vp, r: vr, named: false });
    }
    cosmicWebVoids = voids;

    function inAnyVoid(pt, pad) {
      for (let i = 0; i < voids.length; i++) {
        if (pt.distanceTo(voids[i].pos) < voids[i].r * pad) return true;
      }
      return false;
    }

    // 3. Assemble Cosmic Web Nodes (Great Walls + 2025 Superstructure Bridges + 165 Foam Nodes)
    const nodes = [];
    const edges = [];
    const edgeSet = {};

    function addEdge(a, b, wallBoost) {
      const key = a < b ? a + '_' + b : b + '_' + a;
      if (edgeSet[key]) return false;
      edgeSet[key] = true;
      edges.push({ a: a, b: b, wall: wallBoost });
      return true;
    }

    walls.forEach(function (w) {
      const baseIdx = nodes.length;
      w.pts.forEach(function (p, k) {
        nodes.push({ pos: p.clone(), wall: 1.0, hub: 1.0 });
        if (k > 0) addEdge(baseIdx + k - 1, baseIdx + k, 1.0);
      });
    });

    // Anchor nodes linking cleanly outward from Quipu & companion superstructures
    CAT.SUPERSTRUCTURES.forEach(function (sup) {
      nodes.push({
        pos: new THREE.Vector3(sup.labelPos[0], sup.labelPos[1], sup.labelPos[2]),
        wall: 0.45,
        hub: 0.92
      });
    });

    const targetNodeCount = nodes.length + 165;
    let nAtt = 0;
    while (nodes.length < targetNodeCount && nAtt < 4000) {
      nAtt++;
      const r = 19500 + Math.pow(rng(), 0.72) * 51500;
      const th = rng() * Math.PI * 2;
      const ph = Math.acos(2 * rng() - 1);
      const p = new THREE.Vector3(
        r * Math.sin(ph) * Math.cos(th),
        r * Math.cos(ph),
        r * Math.sin(ph) * Math.sin(th)
      );
      if (inAnyVoid(p, 1.02)) continue;

      let tooClose = false;
      for (let i = 0; i < nodes.length; i++) {
        if (p.distanceTo(nodes[i].pos) < 8200) {
          tooClose = true;
          break;
        }
      }
      if (!tooClose) {
        nodes.push({ pos: p, wall: 0.0, hub: 0.55 + rng() * 0.45 });
      }
    }

    // Connect nearby nodes into a 3D Voronoi-like cosmic sponge avoiding carved voids
    const tmpMid = new THREE.Vector3();
    const tmpQ1 = new THREE.Vector3();
    const tmpQ3 = new THREE.Vector3();

    for (let i = 0; i < nodes.length; i++) {
      const neighbors = [];
      for (let j = 0; j < nodes.length; j++) {
        if (i === j) continue;
        const d = nodes[i].pos.distanceTo(nodes[j].pos);
        if (d < 27500) neighbors.push({ d: d, j: j });
      }
      neighbors.sort(function (u, v) { return u.d - v.d; });

      let linked = 0;
      for (let k = 0; k < neighbors.length && linked < 3; k++) {
        const j = neighbors[k].j;
        const p1 = nodes[i].pos;
        const p2 = nodes[j].pos;
        tmpMid.addVectors(p1, p2).multiplyScalar(0.5);
        tmpQ1.lerpVectors(p1, p2, 0.25);
        tmpQ3.lerpVectors(p1, p2, 0.75);

        if (inAnyVoid(tmpMid, 0.94) || inAnyVoid(tmpQ1, 0.90) || inAnyVoid(tmpQ3, 0.90)) {
          continue;
        }
        const key = i < j ? i + '_' + j : j + '_' + i;
        if (edgeSet[key]) {
          linked++;
        } else if (addEdge(i, j, 0.0)) {
          linked++;
        }
      }
    }

    // 4. Generate Curved Filament Segments (Draw Call 1) + ~14k Filament Galaxies & Hubs (Draw Call 2)
    const lineVerts = [];
    const lineData = []; // vec2(hubWeight, wallBoost)
    const ptVerts = [];
    const ptData = [];   // vec3(size, isHub, seed)

    const bendOffset = new THREE.Vector3();
    const ptTmp = new THREE.Vector3();

    edges.forEach(function (e) {
      const pA = nodes[e.a].pos;
      const pB = nodes[e.b].pos;
      const span = pA.distanceTo(pB);

      // Gentle organic curvature along each filament strand
      bendOffset.set(randGauss(rng), randGauss(rng), randGauss(rng)).multiplyScalar(span * 0.12);
      const ctrl = new THREE.Vector3().addVectors(pA, pB).multiplyScalar(0.5).add(bendOffset);
      if (inAnyVoid(ctrl, 0.96)) ctrl.addVectors(pA, pB).multiplyScalar(0.5);

      const curve = new THREE.QuadraticBezierCurve3(pA, ctrl, pB);
      const segs = 6;
      const pts = curve.getPoints(segs);

      for (let s = 0; s < segs; s++) {
        const t0 = s / segs;
        const t1 = (s + 1) / segs;
        // Hub weight peaks at both endpoints (1.0) and dips cleanly at filament center (0.0)
        const h0 = Math.pow(Math.abs(t0 * 2.0 - 1.0), 1.6);
        const h1 = Math.pow(Math.abs(t1 * 2.0 - 1.0), 1.6);

        lineVerts.push(pts[s].x, pts[s].y, pts[s].z, pts[s + 1].x, pts[s + 1].y, pts[s + 1].z);
        lineData.push(h0, e.wall, h1, e.wall);
      }

      // Wrap unresolved DESI/Euclid filament galaxies tightly along the curved strand
      const galCount = e.wall > 0.5 ? 72 : 34;
      for (let g = 0; g < galCount; g++) {
        // Concentrate galaxies slightly more near supercluster hubs
        let t = rng();
        if (rng() < 0.42) t = t < 0.5 ? Math.pow(t * 2.0, 1.7) * 0.5 : 1.0 - Math.pow((1.0 - t) * 2.0, 1.7) * 0.5;
        curve.getPoint(t, ptTmp);

        const endProx = Math.abs(t * 2.0 - 1.0);
        const spread = (e.wall > 0.5 ? 1150 : 920) * (0.55 + 0.65 * endProx);
        ptTmp.x += randGauss(rng) * spread;
        ptTmp.y += randGauss(rng) * spread;
        ptTmp.z += randGauss(rng) * spread;

        ptVerts.push(ptTmp.x, ptTmp.y, ptTmp.z);
        const sz = (e.wall > 0.5 ? 1.25 : 0.95) * (0.65 + rng() * 0.95);
        ptData.push(sz, endProx * 0.45 + (e.wall > 0.5 ? 0.25 : 0.0), rng());
      }
    });

    // Add luminous golden supercluster intersection hubs + surrounding dense cluster halos
    nodes.forEach(function (nd) {
      // Primary blazing intersection node
      ptVerts.push(nd.pos.x, nd.pos.y, nd.pos.z);
      ptData.push(nd.wall > 0.5 ? 3.8 : 2.9, 1.0, rng());

      // Halo of member clusters around each intersection
      const haloCnt = nd.wall > 0.5 ? 18 : 8;
      for (let h = 0; h < haloCnt; h++) {
        const rr = 1450 * Math.pow(rng(), 0.75);
        const th = rng() * Math.PI * 2;
        const ph = Math.acos(2 * rng() - 1);
        ptVerts.push(
          nd.pos.x + rr * Math.sin(ph) * Math.cos(th),
          nd.pos.y + rr * Math.cos(ph),
          nd.pos.z + rr * Math.sin(ph) * Math.sin(th)
        );
        ptData.push(1.15 + rng() * 1.05, 0.72, rng());
      }
    });

    // Draw Call 1: Spectral-Reactive IllustrisTNG Curved Filament Mesh
    const webLineGeo = new THREE.BufferGeometry();
    webLineGeo.setAttribute('position', new THREE.Float32BufferAttribute(lineVerts, 3));
    webLineGeo.setAttribute('aWebData', new THREE.Float32BufferAttribute(lineData, 2));

    cosmicWebLineMat = new THREE.ShaderMaterial({
      uniforms: {
        uSpecMode: { value: 0.0 },
        uOpacity: { value: 0.0 }
      },
      vertexShader: `
        attribute vec2 aWebData;
        varying float vHub;
        varying float vWall;
        void main() {
          vHub = aWebData.x;
          vWall = aWebData.y;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        precision mediump float;
        uniform float uSpecMode;
        uniform float uOpacity;
        varying float vHub;
        varying float vWall;
        void main() {
          if (uOpacity < 0.004) discard;
          vec3 col;
          float alpha;
          if (uSpecMode > 3.5) {
            // Radio / EHT 230 GHz: Synchrotron Cosmic Web Accretion Shocks & Radio Relics
            col = mix(vec3(0.75, 0.14, 0.04), vec3(1.0, 0.72, 0.20), vHub * 0.75 + vWall * 0.25);
            alpha = (0.28 + 0.36 * vHub + 0.24 * vWall) * uOpacity;
          } else if (uSpecMode > 2.5) {
            // Chandra X-Ray: Electric cyan-blue WHIM intergalactic gas bridges
            col = mix(vec3(0.08, 0.58, 0.96), vec3(0.84, 0.97, 1.0), vHub * 0.72 + vWall * 0.28);
            alpha = (0.34 + 0.36 * vHub + 0.24 * vWall) * uOpacity;
          } else if (uSpecMode > 1.5) {
            // JWST MIRI: Warm crimson-magenta infrared web
            col = mix(vec3(0.55, 0.14, 0.42), vec3(1.0, 0.58, 0.20), vHub * 0.65 + vWall * 0.25);
            alpha = (0.20 + 0.28 * vHub + 0.22 * vWall) * uOpacity;
          } else if (uSpecMode > 0.5) {
            // JWST NIRCam: Dim dark-matter lines so real galaxy dots dominate (DESI/Euclid look)
            col = mix(vec3(0.32, 0.45, 0.72), vec3(0.95, 0.80, 0.50), vHub);
            alpha = (0.09 + 0.14 * vHub + 0.14 * vWall) * uOpacity;
          } else {
            // Optical HDR: Classic IllustrisTNG deep violet-indigo strands -> warm golden nodes
            vec3 midCol = mix(vec3(0.34, 0.22, 0.86), vec3(0.68, 0.30, 0.92), vWall);
            vec3 hubCol = vec3(1.0, 0.76, 0.34);
            col = mix(midCol, hubCol, smoothstep(0.18, 0.95, vHub));
            alpha = (0.24 + 0.32 * vHub + 0.24 * vWall) * uOpacity;
          }
          gl_FragColor = vec4(col, clamp(alpha, 0.0, 0.82));
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    const webLines = new THREE.LineSegments(webLineGeo, cosmicWebLineMat);
    webLines.frustumCulled = false;
    webLines.renderOrder = -12;
    cosmicWebGroup.add(webLines);

    // Draw Call 2: Spectral-Reactive Filament Galaxies + Golden Supercluster Hubs
    const webPtGeo = new THREE.BufferGeometry();
    webPtGeo.setAttribute('position', new THREE.Float32BufferAttribute(ptVerts, 3));
    webPtGeo.setAttribute('aPointData', new THREE.Float32BufferAttribute(ptData, 3));

    cosmicWebPointMat = new THREE.ShaderMaterial({
      uniforms: {
        uSpecMode: { value: 0.0 },
        uOpacity: { value: 0.0 },
        uPixelRatio: { value: currentPR },
        uLodDensity: { value: state.lodDensity }
      },
      vertexShader: `
        attribute vec3 aPointData; // x=size, y=isHub, z=seed
        uniform float uPixelRatio;
        uniform float uLodDensity;
        varying float vHub;
        varying float vSeed;
        void main() {
          vHub = aPointData.y;
          vSeed = aPointData.z;

          // Respect Perf / Balanced / Ultra quality setting while keeping 100% of intersection hubs
          float keep = clamp(uLodDensity + (vHub > 0.65 ? 0.6 : 0.15), 0.25, 1.0);
          if (vSeed > keep) {
            gl_PointSize = 0.0;
            gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
            return;
          }

          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          float dist = max(-mvPosition.z, 100.0);
          float rawSize = aPointData.x * uPixelRatio * (54000.0 / dist);
          float maxSz = (vHub > 0.85) ? 26.0 : 12.0;
          gl_PointSize = clamp(rawSize, 1.35, maxSz);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        precision mediump float;
        uniform float uSpecMode;
        uniform float uOpacity;
        varying float vHub;
        varying float vSeed;
        void main() {
          if (uOpacity < 0.004) discard;
          vec2 uv = gl_PointCoord - 0.5;
          float r = length(uv);
          if (r > 0.5) discard;

          float glow = exp(-r * r * 24.0) + exp(-r * 5.2) * 0.36;
          vec3 col;
          float gain = 1.0;

          if (uSpecMode > 3.5) {
            // Radio / EHT: Blazing radio-loud cluster relics & AGN beacons
            col = mix(vec3(0.88, 0.24, 0.05), vec3(1.0, 0.86, 0.38), vHub);
            gain = 0.85 + 0.65 * vHub;
          } else if (uSpecMode > 2.5) {
            // Chandra X-Ray: Hot cluster shocks & WHIM plasma knots
            col = mix(vec3(0.18, 0.72, 1.0), vec3(0.92, 0.99, 1.0), vHub);
            gain = 0.85 + 0.55 * vHub;
          } else if (uSpecMode > 1.5) {
            // JWST MIRI: Glowing amber-magenta infrared galaxies
            col = mix(vec3(1.0, 0.36, 0.52), vec3(1.0, 0.74, 0.28), vHub * 0.7 + vSeed * 0.3);
            gain = 0.95 + 0.35 * vHub;
          } else if (uSpecMode > 0.5) {
            // JWST NIRCam / DESI-Euclid Survey: Crisp cyan-white & amber galaxy web
            col = mix(vec3(0.76, 0.88, 1.0), vec3(1.0, 0.84, 0.52), fract(vSeed * 4.7) * 0.55 + vHub * 0.45);
            gain = 1.15 + 0.30 * vHub;
          } else {
            // Optical HDR: IllustrisTNG lavender-blue filament dust + golden-white hubs
            vec3 galCol = mix(vec3(0.56, 0.46, 0.98), vec3(0.86, 0.78, 1.0), vSeed);
            vec3 hubCol = vec3(1.0, 0.84, 0.46);
            col = mix(galCol, hubCol, smoothstep(0.25, 0.95, vHub));
            gain = 0.82 + 0.52 * vHub;
          }

          float alpha = glow * (0.45 + 0.50 * vHub) * uOpacity;
          if (alpha < 0.01) discard;
          gl_FragColor = vec4(clamp(col * gain, vec3(0.0), vec3(1.85)), clamp(alpha, 0.0, 0.92));
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    const webPoints = new THREE.Points(webPtGeo, cosmicWebPointMat);
    webPoints.frustumCulled = false;
    webPoints.renderOrder = -11;
    cosmicWebGroup.add(webPoints);

    // Subtle translucent boundary spheres around named supervoids (Boötes & Eridanus)
    voids.forEach(function (v) {
      if (!v.named) return;
      const vGeo = new THREE.SphereGeometry(v.r * 0.86, 20, 14);
      const vMat = new THREE.MeshBasicMaterial({
        color: 0x475569,
        wireframe: true,
        transparent: true,
        opacity: 0.075,
        depthWrite: false
      });
      const vMesh = new THREE.Mesh(vGeo, vMat);
      vMesh.position.copy(v.pos);
      vMesh.renderOrder = -13;
      cosmicWebGroup.add(vMesh);
    });
  }

  // -------------------------------------------------------------------------
  // 10C. ASTROPHYSICAL SHOWPIECES: OJ 287 BINARY SMBH, NGC 6505 EINSTEIN RING
  //      & MILKY WAY SAGITTARIUS POLAR TIDAL STREAM (Distance-Culled!)
  // -------------------------------------------------------------------------
  const sgrStreamGroup = new THREE.Group();
  sgrStreamGroup.visible = false;
  scene.add(sgrStreamGroup);

  const oj287Group = new THREE.Group();
  oj287Group.visible = false;
  scene.add(oj287Group);

  const ngc6505Group = new THREE.Group();
  ngc6505Group.visible = false;
  scene.add(ngc6505Group);

  const OJ287_POS = new THREE.Vector3(-4600, -1750, 3950);
  const NGC6505_POS = new THREE.Vector3(2850, 1650, -2450);

  let einsteinRingMat = null;
  let ojSecondaryGroup = null;
  let ojFlareSprite = null;
  let ojFlareIntensity = 0.0;
  let ojPrevSide = 1;
  const ojShockKnots = [];
  let ojHelixCurveNorth = null;
  let ojHelixCurveSouth = null;

  const V5_LANDMARKS = [
    {
      id: 'oj287',
      label: 'OJ 287 Binary',
      title: 'OJ 287 (Binary SMBH Blazar)',
      badge: 'EHT Jan 2026 • Dual-Jet Binary SMBH',
      cls: 'Primary 4–18B M☉ • Secondary ~150M M☉',
      radius: '~3.5 – 4.0 Bly (z ≈ 0.306)',
      vel: '12-yr Plunging Precessing Orbit',
      sector: 'Cancer Blazar • Southern Web',
      target: [-4600, -1750, 3950],
      camPos: [-4568, -1736, 3992],
      dirTab: 'galaxies',
      desc: 'Rare supermassive binary black hole system: a secondary SMBH (yellowish jet) plunges twice every 12 years through the primary accretion disk, triggering flares, while Jan 2026 EHT observations resolved twisting helical magnetic fields and shock waves in its relativistic jet.'
    },
    {
      id: 'ngc6505',
      label: 'NGC 6505 Ring',
      title: 'NGC 6505 (Euclid Einstein Ring)',
      badge: 'ESA Euclid 2025 • Altieri’s Lens',
      cls: 'E/S0 Elliptical • Complete 360° Ring',
      radius: '~590–608 Mly (z = 0.042)',
      vel: 'Background Source @ 4.42 Bly',
      sector: 'Draco • Northern Sky',
      target: [2850, 1650, -2450],
      camPos: [2904, 1672, -2344],
      dirTab: 'galaxies',
      desc: 'Nearby elliptical galaxy in Draco where ESA’s Euclid telescope discovered the first complete Einstein ring in an NGC galaxy (Feb 2025)—gravitationally magnifying an unnamed background galaxy 4.42 billion light-years away into a luminous circle.'
    },
    {
      id: 'sgrstream',
      label: 'Sgr Tidal Stream',
      title: 'Sagittarius Polar Tidal Stream & M54',
      badge: 'Milky Way Stellar Halo • 76° Polar Orbit',
      cls: 'Disrupted Dwarf Galaxy (Sgr dSph)',
      radius: 'Core ~25 kpc • Loops >100 kpc',
      vel: '237 km/s Polar Orbital Velocity',
      sector: 'Milky Way Outer Halo',
      target: [0, 0, 0],
      camPos: [145, 82, 178],
      dirTab: 'galaxies',
      desc: 'Giant polar ribbons of ancient stars torn off the Sagittarius Dwarf Spheroidal Galaxy (core M54) as it orbits the Milky Way at a steep 76° inclination, wrapping high over the North and South Galactic Poles.'
    }
  ];

  function registerV5Catalog() {
    V5_LANDMARKS.forEach(function (lm) {
      CAT.INSPECTOR_LOOKUP[lm.id] = lm;
      const tabArr = CAT.DIRECTORY_TABS[lm.dirTab || 'galaxies'];
      if (tabArr && !tabArr.some(function (it) { return it.id === lm.id; })) {
        tabArr.push({ id: lm.id, label: lm.label });
      }
      if (lm.id === 'oj287' && CAT.DIRECTORY_TABS.cosmic && !CAT.DIRECTORY_TABS.cosmic.some(function (it) { return it.id === 'oj287'; })) {
        CAT.DIRECTORY_TABS.cosmic.unshift({ id: 'oj287', label: 'OJ 287 Binary' });
      }
    });
  }

  // 1. Milky Way Sagittarius Polar Tidal Stream (76° Inclined Polar Loops + M54 Core)
  function buildSagittariusStream() {
    const rng = makeRng(765425);
    const streamCount = 4200;
    const pos = new Float32Array(streamCount * 3);
    const col = new Float32Array(streamCount * 3);

    // 76° inclination relative to Galactic XZ plane (rotates around X/Z into polar loop)
    const inc = (76 * Math.PI) / 180;
    const yaw = 0.42;
    const streamQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(inc, yaw, 0.18, 'YXZ'));
    const cCore = new THREE.Color(0xfff1c9);
    const cLead = new THREE.Color(0xf59e0b);
    const cTrail = new THREE.Color(0xfb7185);
    const tmp = new THREE.Vector3();

    // Build smooth polar spiral-rosette orbit curve for leading & trailing tidal tails
    const guidePts = [];
    for (let g = 0; g <= 160; g++) {
      const ang = (g / 160) * Math.PI * 3.6 - Math.PI * 1.4;
      // Eccentric precessing polar loop: pericenter ~52 units, apocenter ~148 units
      const r = 98 + 46 * Math.cos(ang * 0.88 - 0.3) + 12 * Math.sin(ang * 1.7);
      tmp.set(Math.cos(ang) * r, randGauss(rng) * 0.0, Math.sin(ang) * r);
      tmp.applyQuaternion(streamQuat);
      guidePts.push(tmp.clone());
    }

    const guideGeo = new THREE.BufferGeometry().setFromPoints(guidePts);
    sgrStreamGroup.add(
      new THREE.Line(
        guideGeo,
        new THREE.LineBasicMaterial({
          color: 0xf59e0b,
          transparent: true,
          opacity: 0.16,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        })
      )
    );

    // Populate 3,650 tidal debris stars along leading & trailing arms + 550 in Sgr Dwarf (M54) core
    const coreAngle = -0.35;
    const coreR = 56;
    const coreCenter = new THREE.Vector3(Math.cos(coreAngle) * coreR, 0, Math.sin(coreAngle) * coreR).applyQuaternion(streamQuat);

    for (let i = 0; i < streamCount; i++) {
      const c = new THREE.Color();
      if (i < 550) {
        // Dense Sgr Dwarf Spheroidal / M54 remnant core
        const rr = 8.5 * Math.pow(rng(), 1.55);
        const th = rng() * Math.PI * 2;
        const ph = Math.acos(2 * rng() - 1);
        tmp.set(
          coreCenter.x + rr * Math.sin(ph) * Math.cos(th) * 1.35,
          coreCenter.y + rr * Math.cos(ph) * 0.85,
          coreCenter.z + rr * Math.sin(ph) * Math.sin(th)
        );
        c.copy(cCore).lerp(cLead, rng() * 0.35);
      } else {
        // Leading & trailing tidal arms wrapping >360° over Galactic Poles
        const frac = rng();
        const ang = coreAngle + (frac - 0.42) * Math.PI * 3.5;
        const r = 98 + 46 * Math.cos(ang * 0.88 - 0.3) + 12 * Math.sin(ang * 1.7);
        const spread = 4.5 + Math.abs(frac - 0.42) * 16.0;
        tmp.set(
          Math.cos(ang) * r + randGauss(rng) * spread,
          randGauss(rng) * spread * 0.55,
          Math.sin(ang) * r + randGauss(rng) * spread
        );
        tmp.applyQuaternion(streamQuat);
        const fade = 1.0 - Math.min(0.65, Math.abs(frac - 0.42) * 0.9);
        c.copy(frac > 0.42 ? cLead : cTrail).lerp(cCore, fade * 0.45);
      }
      pos[i * 3] = tmp.x;
      pos[i * 3 + 1] = tmp.y;
      pos[i * 3 + 2] = tmp.z;
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
    }

    const sGeo = new THREE.BufferGeometry();
    sGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    sGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const sPts = new THREE.Points(
      sGeo,
      new THREE.PointsMaterial({
        size: 1.55,
        map: textures.starGlow,
        vertexColors: true,
        transparent: true,
        opacity: 0.72,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    sPts.renderOrder = 2;
    sgrStreamGroup.add(sPts);
  }

  // 2. OJ 287 Binary Supermassive Black Hole + EHT Jan 2026 Twisting Helical Jet
  function buildOJ287() {
    oj287Group.position.copy(OJ287_POS);

    // Primary Ultra-Massive Black Hole (Gargantua ray-marched sphere, auto distance-culled!)
    const unitSphereGeo = new THREE.SphereGeometry(1.0, 36, 24);
    const primMat = SHADERS.createGargantuaMaterial({
      spin: 0.92,
      diskTint: 0xff6b35,
      brightness: 1.38
    });
    const primMesh = new THREE.Mesh(unitSphereGeo, primMat);
    primMesh.position.copy(OJ287_POS);
    primMesh.rotation.set(0.18, 0.0, 0.12);
    primMesh.scale.setScalar(12.0);
    primMesh.renderOrder = 5;
    bhGroup.add(primMesh);

    blackHoleEntries.push({
      data: { id: 'oj287', shortName: 'OJ 287', sphereRadius: 12.0 },
      worldPos: OJ287_POS.clone(),
      maxActiveDist: 12.0 * 48,
      mesh: primMesh,
      mat: primMat
    });

    // Primary Twisting Helical Relativistic Jet (Jan 2026 EHT Kelvin-Helmholtz Shock Waves!)
    const jetTilt = new THREE.Group();
    jetTilt.rotation.set(0.18, 0.0, 0.12);
    oj287Group.add(jetTilt);

    function makeHelixCurve(signY, phase) {
      const pts = [];
      for (let i = 0; i <= 40; i++) {
        const t = i / 40;
        const y = signY * (2.0 + t * 88.0);
        const amp = 0.45 + Math.pow(t, 1.35) * 6.8;
        const twist = phase + t * Math.PI * 5.2;
        pts.push(new THREE.Vector3(Math.cos(twist) * amp, y, Math.sin(twist) * amp));
      }
      return new THREE.CatmullRomCurve3(pts);
    }

    ojHelixCurveNorth = makeHelixCurve(1, 0.0);
    ojHelixCurveSouth = makeHelixCurve(-1, Math.PI);

    // Braided dual-strand helical synchrotron jet tubes (reddish-orange primary jet)
    [
      { curve: ojHelixCurveNorth, col: 0xff5a2c, rad: 0.48, op: 0.56 },
      { curve: makeHelixCurve(1, Math.PI), col: 0xfb7185, rad: 0.34, op: 0.38 },
      { curve: ojHelixCurveSouth, col: 0xff5a2c, rad: 0.42, op: 0.40 }
    ].forEach(function (cfg) {
      const tGeo = new THREE.TubeGeometry(cfg.curve, 44, cfg.rad, 6, false);
      const tMat = registerJetMaterial(
        new THREE.MeshBasicMaterial({
          color: cfg.col,
          transparent: true,
          opacity: cfg.op,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        }),
        cfg.col, cfg.op, Math.min(0.96, cfg.op * 1.85), 0xff8c2b
      );
      jetTilt.add(new THREE.Mesh(tGeo, tMat));
    });

    // Outer synchrotron cone envelope
    const primCone = createRelativisticJet(92, 0xff5e3a);
    jetTilt.add(primCone);

    // 8 Travelling EHT Shock-Wave Knots spiraling outward along the helical jet
    for (let k = 0; k < 8; k++) {
      const isNorth = k < 5;
      const knotMat = registerJetMaterial(
        new THREE.SpriteMaterial({
          map: textures.starGlow,
          color: 0xffedd5,
          transparent: true,
          opacity: 0.78,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        }),
        0xffedd5, 0.78, 1.0, 0xffe066
      );
      const sp = new THREE.Sprite(knotMat);
      sp.scale.setScalar(isNorth ? 3.8 : 3.0);
      jetTilt.add(sp);
      ojShockKnots.push({
        sprite: sp,
        north: isNorth,
        t: (k % 5) * 0.2,
        speed: 0.14 + (k % 3) * 0.03
      });
    }

    // Binary Secondary SMBH Orbit Path (steep 60° eccentric plunge through primary disk!)
    const orbPts = [];
    for (let i = 0; i <= 120; i++) {
      const M = (i / 120) * Math.PI * 2;
      const pos = computeOJSecondaryLocal(M, 0.0, new THREE.Vector3());
      orbPts.push(pos);
    }
    const orbLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(orbPts),
      new THREE.LineBasicMaterial({
        color: 0xfde047,
        transparent: true,
        opacity: 0.34,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    jetTilt.add(orbLine);

    // Secondary SMBH (~150M M☉): Black Horizon + Golden Halo + Smaller Yellowish Jet
    ojSecondaryGroup = new THREE.Group();
    jetTilt.add(ojSecondaryGroup);

    const secHole = new THREE.Mesh(
      new THREE.SphereGeometry(0.85, 20, 14),
      new THREE.MeshBasicMaterial({ color: 0x000000 })
    );
    ojSecondaryGroup.add(secHole);

    const secHalo = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: textures.starGlow,
        color: 0xfde047,
        transparent: true,
        opacity: 0.92,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    secHalo.scale.setScalar(5.8);
    ojSecondaryGroup.add(secHalo);

    const secJet = createRelativisticJet(19, 0xfacc15);
    secJet.rotation.set(0.32, 0.0, -0.25);
    ojSecondaryGroup.add(secJet);

    // Live Disk-Impact Bremsstrahlung Flare (bursts whenever secondary punches y = 0!)
    ojFlareSprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: textures.jwstSpike,
        color: 0xe0f2fe,
        transparent: true,
        opacity: 0.0,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    ojFlareSprite.scale.setScalar(1.0);
    jetTilt.add(ojFlareSprite);
  }

  function computeOJSecondaryLocal(meanAnomaly, precession, outVec) {
    const a = 14.5;
    const e = 0.58;
    const inc = 1.04; // ~60° steep plunge through the primary accretion disk!
    const E = solveKepler(meanAnomaly, e);
    const xOrb = a * (Math.cos(E) - e);
    const yOrb = a * Math.sqrt(1.0 - e * e) * Math.sin(E);

    const cw = Math.cos(0.45 + precession);
    const sw = Math.sin(0.45 + precession);
    const x1 = xOrb * cw - yOrb * sw;
    const y1 = xOrb * sw + yOrb * cw;

    outVec.set(x1, y1 * Math.sin(inc), y1 * Math.cos(inc));
    return outVec;
  }

  const ojSecTmp = new THREE.Vector3();
  const ojKnotTmp = new THREE.Vector3();
  function updateOJ287(simTime, dt) {
    if (!oj287Group.visible || !ojSecondaryGroup) return;

    // 1. Advance Secondary SMBH along 12-year scaled plunging orbit
    const cycles = simTime * 0.14;
    const M = cycles * Math.PI * 2;
    const prec = cycles * 0.24; // General-relativistic periastron advance (~39°/orbit!)
    computeOJSecondaryLocal(M, prec, ojSecTmp);
    ojSecondaryGroup.position.copy(ojSecTmp);

    // Detect equatorial disk plunge (y crosses 0 inside primary disk radius!) -> Trigger Flare!
    const curSide = ojSecTmp.y >= 0 ? 1 : -1;
    if (curSide !== ojPrevSide && ojSecTmp.length() < 11.5) {
      ojFlareIntensity = 1.0;
      if (ojFlareSprite) {
        ojFlareSprite.position.set(ojSecTmp.x, 0.0, ojSecTmp.z);
      }
    }
    ojPrevSide = curSide;

    if (ojFlareSprite && ojFlareIntensity > 0.005) {
      ojFlareIntensity = Math.max(0.0, ojFlareIntensity - dt * 0.85);
      ojFlareSprite.material.opacity = ojFlareIntensity * 0.96;
      ojFlareSprite.scale.setScalar(6.0 + ojFlareIntensity * 14.0);
    } else if (ojFlareSprite) {
      ojFlareSprite.material.opacity = 0.0;
    }

    // 2. Advance EHT Kelvin-Helmholtz shock knots along helical jet
    for (let i = 0; i < ojShockKnots.length; i++) {
      const kn = ojShockKnots[i];
      kn.t = (kn.t + dt * kn.speed * Math.max(state.speed, 0.2)) % 1.0;
      const curve = kn.north ? ojHelixCurveNorth : ojHelixCurveSouth;
      if (curve) {
        curve.getPoint(kn.t, ojKnotTmp);
        kn.sprite.position.copy(ojKnotTmp);
        const fade = Math.sin(kn.t * Math.PI);
        kn.sprite.material.opacity = fade * (state.specMode === 'radio' ? 1.0 : 0.72);
      }
    }
  }

  // 3. NGC 6505 — ESA Euclid Complete 360° Einstein Ring (Altieri's Lens, Feb 2025)
  function buildNGC6505() {
    const rng = makeRng(65052025);
    ngc6505Group.position.copy(NGC6505_POS);

    // Golden-white E/S0 elliptical foreground lensing galaxy (2,200 stars, 1 draw call)
    const count = 2200;
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const cCore = new THREE.Color(0xfff4d6);
    const cOuter = new THREE.Color(0xffc978);

    for (let i = 0; i < count; i++) {
      const r = 46 * Math.pow(rng(), 2.15);
      const th = rng() * Math.PI * 2;
      const ph = Math.acos(2 * rng() - 1);
      pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
      pos[i * 3 + 1] = r * Math.cos(ph) * 0.86;
      pos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th) * 0.92;
      const cc = cCore.clone().lerp(cOuter, Math.min(1, r / 38));
      col[i * 3] = cc.r;
      col[i * 3 + 1] = cc.g;
      col[i * 3 + 2] = cc.b;
    }

    const gGeo = new THREE.BufferGeometry();
    gGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    gGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    ngc6505Group.add(
      new THREE.Points(
        gGeo,
        new THREE.PointsMaterial({
          size: 1.85,
          map: textures.starGlow,
          vertexColors: true,
          transparent: true,
          opacity: 0.85,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        })
      )
    );

    // Bright photographic core halo
    const coreSp = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: textures.galaxyGlow || textures.nebulaPuff,
        color: 0xffe4b5,
        transparent: true,
        opacity: 0.82,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    coreSp.scale.setScalar(56);
    ngc6505Group.add(coreSp);

    // Complete 360° Gravitationally Lensed Einstein Ring (oriented toward preset approach!)
    einsteinRingMat = SHADERS.createEinsteinRingMaterial();
    const ringPivot = new THREE.Group();
    ngc6505Group.add(ringPivot);
    ngc6505Group.updateMatrixWorld(true);
    // Face directly toward the preset camera position for the iconic Euclid bulls-eye view
    ringPivot.lookAt(NGC6505_POS.x + 54, NGC6505_POS.y + 22, NGC6505_POS.z + 106);

    const mainRing = new THREE.Mesh(
      new THREE.TorusGeometry(23.5, 2.35, 14, 96),
      einsteinRingMat
    );
    mainRing.renderOrder = 4;
    ringPivot.add(mainRing);

    // Delicate outer lensed-galaxy halo ring
    const haloRing = new THREE.Mesh(
      new THREE.TorusGeometry(23.5, 4.8, 10, 72),
      new THREE.MeshBasicMaterial({
        color: 0x7dd3fc,
        transparent: true,
        opacity: 0.22,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    ringPivot.add(haloRing);
  }

  // -------------------------------------------------------------------------
  // 10D. 30,150 FIELD & DEEP-FIELD MINIATURE GALAXIES (1 GPU Draw Call!)
  //      Real cosmological clustering: Local Dwarfs -> Supergalactic Sheet ->
  //      Deep-Field Redshifted Universe (actively carving out Local & Cosmic Voids!)
  // -------------------------------------------------------------------------
  const fieldGalaxyGroup = new THREE.Group();
  fieldGalaxyGroup.visible = false;
  scene.add(fieldGalaxyGroup);

  let fieldGalaxyMat = null;
  let totalFieldGalaxies = 0;

  function buildFieldGalaxies() {
    if (typeof SHADERS.createFieldGalaxyMaterial !== 'function' || !textures.galaxyAtlas) {
      console.warn('Cosmos 3D: shaders-v6.js required for Field Galaxies layer.');
      return;
    }

    const rng = makeRng(202630150);

    const DWARF_COUNT = 150;
    const SHEET_COUNT = 10000;
    const DEEP_COUNT = 20000;
    const totalCount = DWARF_COUNT + SHEET_COUNT + DEEP_COUNT;
    totalFieldGalaxies = totalCount;

    const fPos = new Float32Array(totalCount * 3);
    const fCol = new Float32Array(totalCount * 3);
    const fData = new Float32Array(totalCount * 4); // x=worldSize, y=redshift, z=seed, w=tileIdx

    const localVoidPos = new THREE.Vector3(
      CAT.LANIAKEA.localVoid[0],
      CAT.LANIAKEA.localVoid[1],
      CAT.LANIAKEA.localVoid[2]
    );
    const m31Pos = new THREE.Vector3(340, 68, -420);

    // Supergalactic Plane tilt quaternion (links Local Group -> Virgo -> Great Attractor -> Coma)
    const sgQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.46, -0.38, 0.24, 'YXZ'));

    // Natural galaxy spectral color palette
    const cSpiralBlue = new THREE.Color(0xa5c8ff);
    const cSpiralWhite = new THREE.Color(0xe6eeff);
    const cEdgeWarm = new THREE.Color(0xffe1b8);
    const cEllipGold = new THREE.Color(0xffd296);
    const cDwarfCyan = new THREE.Color(0x93d5ff);
    const tmpCol = new THREE.Color();
    const tmpVec = new THREE.Vector3();

    function pickTileAndColor(modeType, zShift) {
      const r = rng();
      let tile = 0.0;
      if (modeType === 'dwarf') {
        // Local Group dwarfs: mostly irregulars (3) & faint spheroidals (2)
        if (r < 0.52) {
          tile = 3.0;
          tmpCol.copy(cDwarfCyan).lerp(cSpiralWhite, rng() * 0.45);
        } else if (r < 0.88) {
          tile = 2.0;
          tmpCol.copy(cEllipGold).lerp(cEdgeWarm, rng() * 0.4);
        } else {
          tile = 1.0;
          tmpCol.copy(cSpiralBlue);
        }
      } else if (modeType === 'cluster') {
        // Dense cluster environments favor golden ellipticals & lenticulars (morphology-density relation!)
        if (r < 0.56) {
          tile = 2.0;
          tmpCol.copy(cEllipGold).lerp(cEdgeWarm, rng() * 0.35);
        } else if (r < 0.78) {
          tile = 1.0;
          tmpCol.copy(cEdgeWarm).lerp(cSpiralWhite, rng() * 0.5);
        } else {
          tile = 0.0;
          tmpCol.copy(cSpiralBlue).lerp(cSpiralWhite, rng() * 0.5);
        }
      } else {
        // General field & deep-field mix (slightly clumpier irregulars at higher z)
        const irrCut = 0.10 + zShift * 0.14;
        if (r < 0.40) {
          tile = 0.0; // Face-on Spiral
          tmpCol.copy(cSpiralBlue).lerp(cSpiralWhite, rng() * 0.55);
        } else if (r < 0.66) {
          tile = 1.0; // Tilted Edge-on Disk
          tmpCol.copy(cEdgeWarm).lerp(cSpiralBlue, rng() * 0.5);
        } else if (r < 1.0 - irrCut) {
          tile = 2.0; // Golden Elliptical
          tmpCol.copy(cEllipGold).lerp(cEdgeWarm, rng() * 0.4);
        } else {
          tile = 3.0; // Star-forming Irregular
          tmpCol.copy(cDwarfCyan).lerp(cSpiralBlue, rng() * 0.5);
        }
      }
      return tile;
    }

    function inCosmicVoid(vec, pad) {
      for (let v = 0; v < cosmicWebVoids.length; v++) {
        if (vec.distanceTo(cosmicWebVoids[v].pos) < cosmicWebVoids[v].r * pad) return true;
      }
      return false;
    }

    let idx = 0;

    function writeGalaxy(x, y, z, worldSize, zShift, tile) {
      const i3 = idx * 3;
      const i4 = idx * 4;
      fPos[i3] = x;
      fPos[i3 + 1] = y;
      fPos[i3 + 2] = z;

      fCol[i3] = tmpCol.r;
      fCol[i3 + 1] = tmpCol.g;
      fCol[i3 + 2] = tmpCol.b;

      fData[i4] = worldSize;
      fData[i4 + 1] = zShift;
      fData[i4 + 2] = rng();
      fData[i4 + 3] = tile;
      idx++;
    }

    // --- LAYER A: 150 Local Group Dwarf Satellites (110 – 650 units) ---
    for (let i = 0; i < DWARF_COUNT; i++) {
      const hostRoll = rng();
      if (hostRoll < 0.42) {
        // Milky Way satellite halo (Draco, Fornax, Sculptor, Leo I/II analog)
        const r = 115 + Math.pow(rng(), 0.85) * 260;
        const th = rng() * Math.PI * 2;
        const ph = Math.acos(2 * rng() - 1);
        tmpVec.set(r * Math.sin(ph) * Math.cos(th), r * Math.cos(ph) * 0.85, r * Math.sin(ph) * Math.sin(th));
      } else if (hostRoll < 0.82) {
        // Andromeda (M31) dwarf satellite swarm
        const r = 78 + Math.pow(rng(), 0.85) * 225;
        const th = rng() * Math.PI * 2;
        const ph = Math.acos(2 * rng() - 1);
        tmpVec.set(
          m31Pos.x + r * Math.sin(ph) * Math.cos(th),
          m31Pos.y + r * Math.cos(ph) * 0.85,
          m31Pos.z + r * Math.sin(ph) * Math.sin(th)
        );
      } else {
        // Local Group dwarf bridge
        const t = rng();
        tmpVec.lerpVectors(new THREE.Vector3(0, 0, 0), m31Pos, t);
        tmpVec.x += randGauss(rng) * 145;
        tmpVec.y += randGauss(rng) * 115;
        tmpVec.z += randGauss(rng) * 145;
      }
      if (tmpVec.length() < 110) tmpVec.normalize().multiplyScalar(115);

      const tile = pickTileAndColor('dwarf', 0.0);
      writeGalaxy(tmpVec.x, tmpVec.y, tmpVec.z, 10.5 + rng() * 11.5, 0.0, tile);
    }

    // --- LAYER B: 10,000 Local Sheet, Supergalactic Plane & Laniakea/Quipu Field (650 – 20,000 units) ---
    let sheetMade = 0;
    let sheetAtt = 0;
    while (sheetMade < SHEET_COUNT && sheetAtt < SHEET_COUNT * 4) {
      sheetAtt++;
      const roll = rng();
      let envType = 'field';

      if (roll < 0.55) {
        // Flattened, gently warped Supergalactic Plane / Local Sheet
        const r = 680 + Math.pow(rng(), 0.78) * 18800;
        const th = rng() * Math.PI * 2;
        const warp = Math.sin(th * 2.0 + 0.6) * r * 0.09;
        const thickness = 520 + r * 0.14;
        tmpVec.set(Math.cos(th) * r, warp + randGauss(rng) * thickness, Math.sin(th) * r);
        tmpVec.applyQuaternion(sgQuat);
      } else if (roll < 0.85) {
        // Loose galaxy groups & filament bridges around the 8 clusters & 5 superstructures
        if (rng() < 0.58 && CAT.CLUSTERS.length > 0) {
          const cl = CAT.CLUSTERS[Math.floor(rng() * CAT.CLUSTERS.length)];
          const rr = cl.radius * (0.45 + Math.pow(rng(), 0.75) * 3.8);
          const th = rng() * Math.PI * 2;
          const ph = Math.acos(2 * rng() - 1);
          tmpVec.set(
            cl.pos[0] + rr * Math.sin(ph) * Math.cos(th),
            cl.pos[1] + rr * Math.cos(ph) * 0.85,
            cl.pos[2] + rr * Math.sin(ph) * Math.sin(th)
          );
          if (rr < cl.radius * 1.4) envType = 'cluster';
        } else {
          const sup = CAT.SUPERSTRUCTURES[Math.floor(rng() * CAT.SUPERSTRUCTURES.length)];
          const spIdx = Math.floor(rng() * sup.spine.length);
          const anchor = sup.spine[spIdx];
          const spread = 1400 + rng() * 3400;
          tmpVec.set(
            anchor[0] + randGauss(rng) * spread,
            anchor[1] + randGauss(rng) * spread * 0.85,
            anchor[2] + randGauss(rng) * spread
          );
        }
      } else {
        // Sparse 3D intergalactic field scatter
        const r = 750 + Math.pow(rng(), 0.72) * 19200;
        const th = rng() * Math.PI * 2;
        const ph = Math.acos(2 * rng() - 1);
        tmpVec.set(r * Math.sin(ph) * Math.cos(th), r * Math.cos(ph), r * Math.sin(ph) * Math.sin(th));
      }

      const dOrigin = tmpVec.length();
      // Keep Local Group core clean & carve out the Local Void!
      if (dOrigin < 580 || dOrigin > 21500) continue;
      if (tmpVec.distanceTo(localVoidPos) < 760) continue;

      const zShift = THREE.MathUtils.clamp((dOrigin - 650) / 105000, 0.0, 0.25);
      const tile = pickTileAndColor(envType, zShift);
      // Scale smoothly with distance shell so nearby field galaxies look crisp and distant ones stay delicate
      const sizeScale = 22.0 + Math.pow(dOrigin / 20000, 0.85) * 260.0;
      const worldSize = sizeScale * (0.55 + rng() * 0.95);
      writeGalaxy(tmpVec.x, tmpVec.y, tmpVec.z, worldSize, zShift, tile);
      sheetMade++;
    }

    // --- LAYER C: 20,000 Deep-Field Universe Galaxies (20,000 – 115,000 units) ---
    // Pre-generate 28 subtle deep-field sheet attractors so space looks organically clumped (never uniform static!)
    const deepClumps = [];
    for (let c = 0; c < 28; c++) {
      const r = 26000 + rng() * 76000;
      const th = rng() * Math.PI * 2;
      const ph = Math.acos(2 * rng() - 1);
      const cp = new THREE.Vector3(r * Math.sin(ph) * Math.cos(th), r * Math.cos(ph), r * Math.sin(ph) * Math.sin(th));
      if (!inCosmicVoid(cp, 1.05)) deepClumps.push(cp);
    }

    let deepMade = 0;
    let deepAtt = 0;
    while (deepMade < DEEP_COUNT && deepAtt < DEEP_COUNT * 4) {
      deepAtt++;
      if (rng() < 0.42 && deepClumps.length > 0) {
        const cp = deepClumps[Math.floor(rng() * deepClumps.length)];
        const spread = 6500 + rng() * 14000;
        tmpVec.set(
          cp.x + randGauss(rng) * spread,
          cp.y + randGauss(rng) * spread,
          cp.z + randGauss(rng) * spread
        );
      } else {
        const r = 20000 + Math.pow(rng(), 0.78) * 95000;
        const th = rng() * Math.PI * 2;
        const ph = Math.acos(2 * rng() - 1);
        tmpVec.set(r * Math.sin(ph) * Math.cos(th), r * Math.cos(ph), r * Math.sin(ph) * Math.sin(th));
      }

      const dOrigin = tmpVec.length();
      if (dOrigin < 19500 || dOrigin > 118000) continue;
      // Carve out all 14 Cosmic Web supervoids (Boötes Void, Eridanus Supervoid, etc.)!
      if (inCosmicVoid(tmpVec, 0.96)) continue;

      const zShift = THREE.MathUtils.clamp((dOrigin - 18000) / 96000, 0.18, 1.0);
      const tile = pickTileAndColor('field', zShift);
      const sizeScale = 240.0 + Math.pow((dOrigin - 18000) / 98000, 0.92) * 1450.0;
      const worldSize = sizeScale * (0.50 + rng() * 0.95);
      writeGalaxy(tmpVec.x, tmpVec.y, tmpVec.z, worldSize, zShift, tile);
      deepMade++;
    }

    totalFieldGalaxies = idx;

    const fieldGeo = new THREE.BufferGeometry();
    fieldGeo.setAttribute('position', new THREE.BufferAttribute(fPos.subarray(0, idx * 3), 3));
    fieldGeo.setAttribute('color', new THREE.BufferAttribute(fCol.subarray(0, idx * 3), 3));
    fieldGeo.setAttribute('aFieldData', new THREE.BufferAttribute(fData.subarray(0, idx * 4), 4));

    fieldGalaxyMat = SHADERS.createFieldGalaxyMaterial(textures.galaxyAtlas);
    fieldGalaxyMat.uniforms.uPixelRatio.value = currentPR;
    fieldGalaxyMat.uniforms.uLodDensity.value = state.lodDensity;

    const fieldPts = new THREE.Points(fieldGeo, fieldGalaxyMat);
    fieldPts.frustumCulled = false;
    fieldPts.renderOrder = -15;
    fieldGalaxyGroup.add(fieldPts);
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

    const skyCount = 2200;
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
      isSgrStream: !!opts.isSgrStream,
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

    // Cosmic Web Great Walls & Supervoids
    COSMIC_WEB_LANDMARKS.forEach(function (lm) {
      if (lm.id === 'cosmicweb') return;
      registerLabel({
        id: lm.id,
        text: lm.label,
        meta: lm.cls,
        pos: lm.target,
        cssClass: 'label-cosmic',
        minDist: 9000,
        maxDist: 155000,
        minCamOrigin: 9500
      });
    });

    // v5 High-Impact Astrophysical Landmarks
    registerLabel({
      id: 'oj287',
      text: 'OJ 287 Binary SMBH',
      meta: 'EHT Helical Jet • 12-yr Orbit',
      pos: [OJ287_POS.x, OJ287_POS.y + 18, OJ287_POS.z],
      cssClass: 'label-bh',
      minDist: 0,
      maxDist: 6500,
      minCamOrigin: 400
    });

    registerLabel({
      id: 'ngc6505',
      text: 'NGC 6505',
      meta: 'Euclid Complete Einstein Ring',
      pos: [NGC6505_POS.x, NGC6505_POS.y + 34, NGC6505_POS.z],
      cssClass: 'label-galaxy',
      minDist: 0,
      maxDist: 6500,
      minCamOrigin: 400
    });

    registerLabel({
      id: 'sgrstream',
      text: 'Sagittarius Tidal Stream',
      meta: '76° Polar Halo • M54',
      pos: [18, 108, -28],
      cssClass: 'label-arm',
      minDist: 45,
      maxDist: 1200,
      minCamOrigin: 55,
      isSgrStream: true
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

      if ((lb.isArm && !state.showArms) || (lb.isSgrStream && !state.showSgrStream) || camOriginDist < lb.minCamOrigin) {
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
  // 14. LIVE QUALITY MODE & SPECTRAL FILTER SWITCHERS
  // -------------------------------------------------------------------------
  function applyQualityProfile(qKey) {
    const cfg = QUALITY_PROFILES[qKey] || QUALITY_PROFILES.balanced;
    state.quality = qKey;
    state.lodDensity = cfg.lod;
    state.bloomEnabled = cfg.bloomDefault;
    state.bloomStrength = cfg.bloomStrength;
    state.showHeroGlows = cfg.heroGlows;

    currentPR = Math.min(window.devicePixelRatio || 1, cfg.prCap);
    renderer.setPixelRatio(currentPR);
    renderer.setSize(window.innerWidth, window.innerHeight);
    if (composer) composer.setSize(window.innerWidth, window.innerHeight);

    if (batchedStarMat) {
      batchedStarMat.uniforms.uPixelRatio.value = currentPR;
      if (batchedStarMat.uniforms.uLodDensity) {
        batchedStarMat.uniforms.uLodDensity.value = cfg.lod;
      }
    }
    if (batchedDustMat) batchedDustMat.uniforms.uPixelRatio.value = currentPR;
    if (cosmicWebPointMat) {
      cosmicWebPointMat.uniforms.uPixelRatio.value = currentPR;
      cosmicWebPointMat.uniforms.uLodDensity.value = cfg.lod;
    }
    if (fieldGalaxyMat) {
      fieldGalaxyMat.uniforms.uPixelRatio.value = currentPR;
      fieldGalaxyMat.uniforms.uLodDensity.value = cfg.lod;
    }
    if (bloomPass) bloomPass.strength = cfg.bloomStrength;

    const bloomCb = document.getElementById('toggleBloom');
    if (bloomCb) bloomCb.checked = state.bloomEnabled;
    const bloomSlider = document.getElementById('bloomSlider');
    const bloomReadout = document.getElementById('bloomReadout');
    if (bloomSlider) bloomSlider.value = cfg.bloomStrength.toFixed(2);
    if (bloomReadout) bloomReadout.textContent = cfg.bloomStrength.toFixed(2);

    const qBadge = document.getElementById('activeQualityBadge');
    if (qBadge) qBadge.textContent = cfg.label + ' • ' + Math.round(cfg.lod * 100) + '% LOD';
  }

  const SPEC_BADGES = {
    optical: { num: 0.0, label: 'Optical HDR',    exposure: 1.08 },
    nircam:  { num: 1.0, label: 'JWST NIRCam',    exposure: 1.14 },
    miri:    { num: 2.0, label: 'JWST MIRI',      exposure: 1.12 },
    xray:    { num: 3.0, label: 'Chandra X-Ray',  exposure: 1.18 },
    radio:   { num: 4.0, label: 'Radio / EHT 230 GHz', exposure: 1.22 }
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
      const targetBlend = (modeKey === 'miri' || modeKey === 'radio') ? THREE.AdditiveBlending : THREE.NormalBlending;
      if (batchedDustMat.blending !== targetBlend) {
        batchedDustMat.blending = targetBlend;
        batchedDustMat.needsUpdate = true;
      }
    }
    if (fermiMat) fermiMat.uniforms.uSpecMode.value = cfg.num;
    if (erositaMat) erositaMat.uniforms.uSpecMode.value = cfg.num;
    if (cmbMat) cmbMat.uniforms.uSpecMode.value = cfg.num;
    if (cosmicWebLineMat) cosmicWebLineMat.uniforms.uSpecMode.value = cfg.num;
    if (cosmicWebPointMat) cosmicWebPointMat.uniforms.uSpecMode.value = cfg.num;
    if (einsteinRingMat) einsteinRingMat.uniforms.uSpecMode.value = cfg.num;
    if (fieldGalaxyMat) fieldGalaxyMat.uniforms.uSpecMode.value = cfg.num;

    // Brighten relativistic synchrotron jets & radio lobes in Radio / EHT 230 GHz mode!
    const isRadio = modeKey === 'radio';
    for (let j = 0; j < jetRadioMaterials.length; j++) {
      const jm = jetRadioMaterials[j];
      jm.mat.opacity = isRadio ? jm.radioOp : jm.optOp;
      if (jm.mat.color) {
        jm.mat.color.copy(isRadio ? jm.radioColor : jm.baseColor);
      }
    }

    blackHoleEntries.forEach(function (bh) {
      bh.mat.uniforms.uSpecMode.value = cfg.num;
    });

    icmMaterials.forEach(function (entry) {
      entry.mat.opacity = modeKey === 'xray' ? entry.xray : entry.opt;
    });

    if (deepFieldMat) {
      deepFieldMat.opacity = modeKey === 'nircam' ? 0.92 : (modeKey === 'xray' || modeKey === 'radio' ? 0.22 : 0.70);
      deepFieldMat.size = modeKey === 'nircam' ? 760 : 560;
    }
    if (lrdMat) {
      lrdMat.opacity = modeKey === 'nircam' ? 1.0 : (modeKey === 'miri' ? 0.88 : 0.65);
    }
  }

  // -------------------------------------------------------------------------
  // 15. HUD, AUTO-INJECTED QUALITY TOGGLE & DIRECTORY EVENT WIRING
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

  function injectQualityControls() {
    const hudBody = document.getElementById('hud-body');
    if (!hudBody || document.getElementById('quality-bar')) return;

    const wrap = document.createElement('div');
    wrap.id = 'quality-bar';
    wrap.innerHTML =
      '<div class="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center justify-between">' +
        '<span>GPU Quality / Smart LOD</span>' +
        '<span id="activeQualityBadge" class="mono text-[10px] text-emerald-300"></span>' +
      '</div>' +
      '<div class="grid grid-cols-3 gap-1">' +
        '<button data-quality="perf" class="spec-btn qual-btn">Perf</button>' +
        '<button data-quality="balanced" class="spec-btn qual-btn">Balanced</button>' +
        '<button data-quality="ultra" class="spec-btn qual-btn">Ultra 500k</button>' +
      '</div>';

    hudBody.insertBefore(wrap, hudBody.firstChild);

    const qBtns = wrap.querySelectorAll('.qual-btn');
    qBtns.forEach(function (btn) {
      if (btn.getAttribute('data-quality') === state.quality) {
        btn.classList.add('active');
      }
      btn.addEventListener('click', function () {
        qBtns.forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        applyQualityProfile(btn.getAttribute('data-quality'));
      });
    });

    applyQualityProfile(state.quality);
  }

  function injectCosmicWebControls() {
    // 1. Inject 'Cosmic Web 3D' preset button right before 'Cosmic Horizon'
    const presetBtns = document.querySelectorAll('.preset-btn');
    if (presetBtns.length > 0 && !document.getElementById('presetCosmicWebBtn')) {
      const lastBtn = presetBtns[presetBtns.length - 1];
      const webBtn = document.createElement('button');
      webBtn.id = 'presetCosmicWebBtn';
      webBtn.className = 'preset-btn';
      webBtn.textContent = 'Cosmic Web 3D';
      webBtn.addEventListener('click', function () {
        window.focusTarget('cosmicweb', webBtn);
      });
      lastBtn.parentElement.insertBefore(webBtn, lastBtn);
    }

    // 2. Inject 'Cosmic Web' visibility toggle right next to 'Quipu'
    const quipuCb = document.getElementById('toggleQuipu');
    if (quipuCb && !document.getElementById('toggleCosmicWeb')) {
      const quipuLabel = quipuCb.closest('label');
      if (quipuLabel && quipuLabel.parentElement) {
        const webLabel = document.createElement('label');
        webLabel.className = quipuLabel.className;
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.id = 'toggleCosmicWeb';
        cb.checked = state.showCosmicWeb;
        cb.className = quipuCb.className;
        cb.addEventListener('change', function (e) {
          state.showCosmicWeb = e.target.checked;
        });
        webLabel.appendChild(cb);
        const span = document.createElement('span');
        span.textContent = ' Cosmic Web';
        webLabel.appendChild(span);
        quipuLabel.parentElement.insertBefore(webLabel, quipuLabel.nextSibling);
      }
    }
  }

  function injectV5Controls() {
    // 1. Inject 5th Spectral Mode Button ('Radio / EHT') into existing spectral grid
    const firstSpecBtn = document.querySelector('.spec-btn[data-mode]');
    if (firstSpecBtn && !document.querySelector('.spec-btn[data-mode="radio"]')) {
      const specParent = firstSpecBtn.parentElement;
      if (specParent) {
        const radioBtn = document.createElement('button');
        radioBtn.setAttribute('data-mode', 'radio');
        radioBtn.className = 'spec-btn';
        radioBtn.textContent = 'Radio / EHT';
        radioBtn.style.gridColumn = '1 / -1';
        specParent.appendChild(radioBtn);
      }
    }

    // 2. Inject Quick-Fly Preset Buttons for 'OJ 287 Binary' & 'NGC 6505 Ring'
    const cosmicWebBtn = document.getElementById('presetCosmicWebBtn');
    const anchorBtn = cosmicWebBtn || (function () {
      const all = document.querySelectorAll('.preset-btn');
      return all.length ? all[all.length - 1] : null;
    })();

    if (anchorBtn && anchorBtn.parentElement) {
      [
        { id: 'oj287', domId: 'presetOJ287Btn', text: 'OJ 287 Binary' },
        { id: 'ngc6505', domId: 'presetNGC6505Btn', text: 'NGC 6505 Ring' }
      ].forEach(function (cfg) {
        if (document.getElementById(cfg.domId)) return;
        const b = document.createElement('button');
        b.id = cfg.domId;
        b.className = 'preset-btn';
        b.textContent = cfg.text;
        b.addEventListener('click', function () {
          window.focusTarget(cfg.id, b);
        });
        anchorBtn.parentElement.insertBefore(b, anchorBtn);
      });
    }

    // 3. Inject 'Sgr Stream' visibility toggle right next to 'Fermi'
    const fermiCb = document.getElementById('toggleFermi');
    if (fermiCb && !document.getElementById('toggleSgrStream')) {
      const fermiLabel = fermiCb.closest('label');
      if (fermiLabel && fermiLabel.parentElement) {
        const stLabel = document.createElement('label');
        stLabel.className = fermiLabel.className;
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.id = 'toggleSgrStream';
        cb.checked = state.showSgrStream;
        cb.className = fermiCb.className;
        cb.addEventListener('change', function (e) {
          state.showSgrStream = e.target.checked;
        });
        stLabel.appendChild(cb);
        const span = document.createElement('span');
        span.textContent = ' Sgr Stream';
        stLabel.appendChild(span);
        fermiLabel.parentElement.insertBefore(stLabel, fermiLabel.nextSibling);
      }
    }
  }

  function injectV6Controls() {
    // Inject 'Field Galaxies' visibility toggle right next to 'Cosmic Web' (or 'Quipu')
    const anchorCb = document.getElementById('toggleCosmicWeb') || document.getElementById('toggleQuipu');
    if (anchorCb && !document.getElementById('toggleFieldGalaxies')) {
      const anchorLabel = anchorCb.closest('label');
      if (anchorLabel && anchorLabel.parentElement) {
        const fgLabel = document.createElement('label');
        fgLabel.className = anchorLabel.className;
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.id = 'toggleFieldGalaxies';
        cb.checked = state.showFieldGalaxies;
        cb.className = anchorCb.className;
        cb.addEventListener('change', function (e) {
          state.showFieldGalaxies = e.target.checked;
        });
        fgLabel.appendChild(cb);
        const span = document.createElement('span');
        span.textContent = ' Field Galaxies';
        fgLabel.appendChild(span);
        anchorLabel.parentElement.insertBefore(fgLabel, anchorLabel.nextSibling);
      }
    }
  }

  function wireUI() {
    injectQualityControls();
    injectCosmicWebControls();
    injectV5Controls();
    injectV6Controls();

    document.querySelectorAll('.spec-btn[data-mode]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.querySelectorAll('.spec-btn[data-mode]').forEach(function (b) {
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

    const totalGalCount = allGalaxies.length + totalFieldGalaxies;
    document.getElementById('stat-galaxies').textContent = totalGalCount >= 1000
      ? (totalGalCount / 1000).toFixed(1) + 'k'
      : totalGalCount;
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
  registerCosmicWebCatalog();
  registerV5Catalog();
  buildSagittariusStream();
  buildOJ287();
  buildNGC6505();
  buildLaniakea();
  buildSuperstructures();
  buildCosmicWeb();
  buildFieldGalaxies();
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

    // 3. Scale-Tier Visibility Culling
    fermiGroup.visible = state.showFermi && camOriginDist > 12 && camOriginDist < 950;
    sgrStreamGroup.visible = state.showSgrStream && camOriginDist > 28 && camOriginDist < 1650;
    oj287Group.visible = camera.position.distanceTo(OJ287_POS) < 2200;
    ngc6505Group.visible = camera.position.distanceTo(NGC6505_POS) < 3600;
    clusterEffectsGroup.visible = camOriginDist > 260;
    laniakeaGroup.visible = state.showLaniakea && camOriginDist > 520;
    quipuGroup.visible = state.showQuipu && camOriginDist > 2200;
    const webFade = THREE.MathUtils.smoothstep(camOriginDist, 5200, 16500);
    cosmicWebGroup.visible = state.showCosmicWeb && webFade > 0.005;
    if (cosmicWebGroup.visible) {
      if (cosmicWebLineMat) cosmicWebLineMat.uniforms.uOpacity.value = webFade;
      if (cosmicWebPointMat) cosmicWebPointMat.uniforms.uOpacity.value = webFade;
    }
    const fieldFade = THREE.MathUtils.smoothstep(camOriginDist, 65, 240);
    fieldGalaxyGroup.visible = state.showFieldGalaxies && fieldFade > 0.004;
    if (fieldGalaxyGroup.visible && fieldGalaxyMat) {
      fieldGalaxyMat.uniforms.uFieldOpacity.value = fieldFade;
    }
    if (lrdPoints) lrdPoints.visible = camOriginDist > 12000;

    // Smoothly fade photographic hero galaxy glows in/out (keeps Sgr A* core pitch-black!)
    heroGlowGroup.visible = state.showHeroGlows && state.specMode !== 'xray' && state.specMode !== 'radio';
    if (heroGlowGroup.visible) {
      const mwFade = THREE.MathUtils.smoothstep(camOriginDist, 18, 65);
      for (let h = 0; h < heroGlowEntries.length; h++) {
        const he = heroGlowEntries[h];
        const modeScale = state.specMode === 'miri' ? 0.55 : 1.0;
        he.mat.opacity = he.baseOp * modeScale * (he.isMW ? mwFade : 1.0);
      }
    }

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

    // 6. Update S-Stars, OJ 287 Binary, NGC 6505 Ring, Laniakea Pulses & Radio Pulsars
    if (state.showOrbits && camOriginDist < 120) updateSStars(state.time);
    if (oj287Group.visible) updateOJ287(state.time, dt);
    if (einsteinRingMat && ngc6505Group.visible) einsteinRingMat.uniforms.uTime.value = state.time;
    updateLaniakeaFlows(dt);

    if (camOriginDist < 240) {
      const radioBoost = state.specMode === 'radio' ? 1.85 : 1.0;
      for (let p = 0; p < pulsarSprites.length; p++) {
        const ps = pulsarSprites[p];
        const pulse = (0.85 + 0.42 * Math.sin(state.time * ps.freq)) * radioBoost;
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
