/* =========================================================================
 * main.js — Safe-Ultra WebGL / HDR GPU Engine (v10 — Solar System, 3D Stars & Fire-Ice Cosmic Web)
 * Upgrades in v10:
 *  - Full 3D Solar System replacing Sol: Boiling 3D Sun + all 8 orbiting procedural
 *    3D planets (Mercury..Neptune), Earth's Moon, Jupiter's 4 Galilean moons,
 *    Saturn's Cassini rings, Uranus's 97.8° ring, Asteroid & Kuiper Belts (distance-culled!)
 *  - 3D Boiling Plasma Bodies for all 23 Named Stars & Inner S-Stars (distance-culled;
 *    pulsars with twin rotating beams, micro-BHs with swirling disks)
 *  - Heavier Clumpy 3D Black-Hole Dusty Tori around Sgr A* & all AGN/Quasars with
 *    backlit sublimation rims, polar jet funnels & smart camera fly-through clearing
 *  - Single-Draw-Call Batched NASA Emission Nebulae (Orion, Pillars, Carina, Crab +
 *    Tarantula 30 Dor, Helix, Lagoon, Veil & Ring Nebula) in Hubble/JWST/Chandra colors
 *  - Fiery-Gold & Sapphire-Blue Soap-Bubble Cosmic Web: Pressed void-rim arcs,
 *    dual-temperature Fire vs. Ice filaments & multi-strand gossamer cobwebs!
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
    showEhtBFields: true,
    showNebulae: true,
    showQuasars: true,
    showReionization: true,
    photoMode: false,
    paused: false,
    savedSpeed: 1.0,
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
    950000
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
  controls.minDistance = 0.14;
  controls.maxDistance = 325000;
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
        const jetGroup = createRelativisticJet(bh.jetLength || 80, bh.jetColor || 0x60a5fa, { hasLobes: true, intensity: 1.15 });
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

  const volumetricJetMaterials = [];
  const quasarOutflowMaterials = [];

  // Shared unit parabolic-to-conical Acceleration-Collimation Zone (ACZ) LatheGeometries
  let jetSheathUnitGeo = null;
  let jetSpineUnitGeo = null;

  function ensureJetUnitGeometries() {
    if (jetSheathUnitGeo && jetSpineUnitGeo) return;
    const sheathPts = [];
    const spinePts = [];
    const steps = 20;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      // Parabolic magnetic nozzle collimation near base (t^0.52) -> conical flare downstream (t^1.55)
      const rSheath = 0.008 + 0.030 * Math.pow(t, 0.52) + 0.048 * Math.pow(t, 1.55);
      const rSpine  = 0.004 + 0.011 * Math.pow(t, 0.55) + 0.014 * Math.pow(t, 1.40);
      sheathPts.push(new THREE.Vector2(rSheath, t));
      spinePts.push(new THREE.Vector2(rSpine, t));
    }
    jetSheathUnitGeo = new THREE.LatheGeometry(sheathPts, 24);
    jetSpineUnitGeo = new THREE.LatheGeometry(spinePts, 18);
  }

  function createRelativisticJet(length, colorHex, opts) {
    const cfg = opts || {};
    const g = new THREE.Group();
    const intensity = cfg.intensity !== undefined ? cfg.intensity : 1.0;
    const flowSpeed = cfg.flowSpeed !== undefined ? cfg.flowSpeed : 1.45;
    const hasVolShader = typeof SHADERS.createRelativisticJetMaterial === 'function';

    if (hasVolShader) {
      ensureJetUnitGeometries();

      // 1. Approaching Relativistic Fast Spine (White-hot core + streaming shock knots)
      const northSpineMat = SHADERS.createRelativisticJetMaterial({
        color: colorHex,
        isSpine: true,
        isCounterJet: false,
        flowSpeed: flowSpeed,
        intensity: intensity
      });
      volumetricJetMaterials.push(northSpineMat);
      const northSpine = new THREE.Mesh(jetSpineUnitGeo, northSpineMat);
      northSpine.scale.set(length, length, length);
      northSpine.renderOrder = 4;
      g.add(northSpine);

      // 2. Approaching Helical Magnetized Outer Sheath (Fresnel-softened turbulent plasma)
      const northSheathMat = SHADERS.createRelativisticJetMaterial({
        color: colorHex,
        isSpine: false,
        isCounterJet: false,
        flowSpeed: flowSpeed,
        intensity: intensity
      });
      volumetricJetMaterials.push(northSheathMat);
      const northSheath = new THREE.Mesh(jetSheathUnitGeo, northSheathMat);
      northSheath.scale.set(length, length, length);
      northSheath.renderOrder = 4;
      g.add(northSheath);

      // 3. Receding Counter-Jet (Relativistic Doppler de-boosted dimmer southern jet)
      const southSpineMat = SHADERS.createRelativisticJetMaterial({
        color: colorHex,
        isSpine: true,
        isCounterJet: true,
        flowSpeed: flowSpeed,
        intensity: intensity
      });
      volumetricJetMaterials.push(southSpineMat);
      const southSpine = new THREE.Mesh(jetSpineUnitGeo, southSpineMat);
      southSpine.scale.set(length, length * 0.88, length);
      southSpine.rotation.x = Math.PI;
      southSpine.renderOrder = 4;
      g.add(southSpine);

      const southSheathMat = SHADERS.createRelativisticJetMaterial({
        color: colorHex,
        isSpine: false,
        isCounterJet: true,
        flowSpeed: flowSpeed,
        intensity: intensity
      });
      volumetricJetMaterials.push(southSheathMat);
      const southSheath = new THREE.Mesh(jetSheathUnitGeo, southSheathMat);
      southSheath.scale.set(length, length * 0.88, length);
      southSheath.rotation.x = Math.PI;
      southSheath.renderOrder = 4;
      g.add(southSheath);

      // 4. Magnetic Nozzle Synchrotron Launch Glow at Jet Base
      const baseGlowMat = registerJetMaterial(
        new THREE.SpriteMaterial({
          map: textures.starGlow,
          color: 0xf0f9ff,
          transparent: true,
          opacity: 0.62,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        }),
        0xf0f9ff, 0.62, 0.96, 0xffd166
      );
      const baseGlow = new THREE.Sprite(baseGlowMat);
      baseGlow.scale.setScalar(length * 0.14);
      g.add(baseGlow);

      // 5. Optional Terminal Radio Bow-Shock Lobes (prevents abrupt jet cutoffs!)
      if (cfg.hasLobes) {
        [1, -1].forEach(function (signY) {
          const lobeOp = signY > 0 ? 0.24 : 0.14;
          const lobeMat = registerJetMaterial(
            new THREE.SpriteMaterial({
              map: textures.nebulaPuff,
              color: colorHex,
              transparent: true,
              opacity: lobeOp,
              blending: THREE.AdditiveBlending,
              depthWrite: false
            }),
            colorHex, lobeOp, Math.min(0.82, lobeOp * 2.8), 0xff6b1a
          );
          const lobe = new THREE.Sprite(lobeMat);
          lobe.position.set(0, signY * length * (signY > 0 ? 0.94 : 0.82), 0);
          lobe.scale.set(length * 0.30, length * 0.22, 1);
          lobe.renderOrder = 3;
          g.add(lobe);
        });
      }
      return g;
    }

    // Fallback if older shaders.js is loaded
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
    const mat2 = registerJetMaterial(mat1.clone(), colorHex, 0.24, 0.66, 0xff5214);
    mat2.opacity = 0.24;
    const southJet = new THREE.Mesh(coneGeo, mat2);
    southJet.rotation.x = Math.PI;
    g.add(southJet);
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
    const cHII = new THREE.Color(0xff3898);
    const cWarm = new THREE.Color(0xffa452);
    const cBlue = new THREE.Color(0x7cb3ff);
    const cOB = new THREE.Color(0x7dd3fc);
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
        const jg = createRelativisticJet(g.jetLength || 65, g.jetColor || 0x7dd3fc, { hasLobes: true, intensity: 1.05 });
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
  const star3DMaterials = [];
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

      let bodyMesh = null;
      let bodyMat = null;
      if (typeof SHADERS.createStarSurfaceMaterial === 'function') {
        const sColObj = new THREE.Color(s.color || 0x93c5fd);
        bodyMat = SHADERS.createStarSurfaceMaterial({
          baseColor: sColObj.getHex(),
          hotColor: 0xffffff,
          spotColor: sColObj.clone().multiplyScalar(0.35).getHex(),
          cellScale: 6.5,
          pulseSpeed: 0.75
        });
        bodyMesh = new THREE.Mesh(new THREE.SphereGeometry(Math.max(0.085, s.size * 0.42), 18, 14), bodyMat);
        bodyMesh.visible = false;
        bodyMesh.renderOrder = 4;
        orbitsGroup.add(bodyMesh);
        star3DMaterials.push(bodyMat);
      }

      sStarRuntime.push({
        data: s,
        phaseOffset: idx * 2.1,
        sprite: sprite,
        baseSpriteScale: s.size * 3.6,
        bodyMesh: bodyMesh,
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
      if (entry.bodyMesh) {
        const dS = camera.position.distanceTo(entry.curPos);
        const show3D = dS < 13.5;
        entry.bodyMesh.visible = show3D;
        if (show3D) {
          entry.bodyMesh.position.copy(entry.curPos);
          entry.bodyMesh.rotation.y = simTime * 0.55;
        }
        entry.sprite.scale.setScalar(entry.baseSpriteScale * (show3D ? 0.55 : 1.0));
      }

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
  // 7. 3D NAMED LANDMARK STARS, FULL 3D SOLAR SYSTEM (AT SOL) &
  //    SINGLE-DRAW-CALL BATCHED NASA MULTI-WAVELENGTH EMISSION NEBULAE
  // -------------------------------------------------------------------------
  const landmarksGroup = new THREE.Group();
  scene.add(landmarksGroup);
  const pulsarSprites = [];
  const namedStar3DEntries = [];
  const pulsarBeamEntries = [];

  // Full 3D Solar System State (strictly distance-culled within 28 units of Sol!)
  const solarSystemGroup = new THREE.Group();
  solarSystemGroup.visible = false;
  scene.add(solarSystemGroup);
  const solarTiltGroup = new THREE.Group();
  solarTiltGroup.rotation.set(0.66, 0.25, -0.18); // ~38° ecliptic inclination to Milky Way disk
  solarSystemGroup.add(solarTiltGroup);

  const SOL_POS = new THREE.Vector3(26.0, 0.35, 3.2);
  let solFarSprite = null;
  let solFarSpriteBase = 2.6;
  const solarPlanetEntries = [];
  const solarPlanetMap = {};
  const planetShaderMaterials = [];
  let activeFollowPlanet = null;

  // Batched NASA Multi-Wavelength Nebulae (1 GPU Draw Call, distance-culled!)
  const batchedNebulaGroup = new THREE.Group();
  scene.add(batchedNebulaGroup);
  let batchedNebulaMat = null;

  const EXTRA_NASA_NEBULAE = [
    {
      id: 'tarantula',
      name: 'Tarantula Nebula (30 Doradus)',
      pos: [-112, -94, 86], // Embedded right inside the Large Magellanic Cloud!
      radius: 11.5,
      colors: [0xff3b9a, 0x22d3ee, 0xfbbf24, 0x818cf8],
      kind: 'starburst',
      badge: 'JWST / Hubble • Giant HII Region (LMC)',
      cls: '~1,000 ly Wide • R136 Super Star Cluster',
      radiusTxt: '161,000 ly (Large Magellanic Cloud)',
      vel: 'Most Active Local Group Nursery',
      sector: 'Large Magellanic Cloud',
      desc: 'Colossal 1,000-light-year star-forming powerhouse inside the Large Magellanic Cloud—bright enough that if it lay as close as the Orion Nebula, it would cast shadows on Earth.'
    },
    {
      id: 'helix',
      name: 'Helix Nebula (NGC 7293)',
      pos: [24.2, -1.6, 4.8],
      radius: 2.3,
      colors: [0x22d3ee, 0x38bdf8, 0xf97316, 0xef4444],
      kind: 'ring',
      badge: 'Hubble / JWST • Eye of God',
      cls: 'Planetary Nebula • White Dwarf Core',
      radiusTxt: '~655 ly from Sol',
      vel: 'Expanding at 31 km/s',
      sector: 'Orion Spur • Aquarius',
      desc: 'One of the closest luminous planetary nebulae to Earth—a dying Sun-like star shedding an electric-cyan ionized eye framed by a glowing crimson-orange cometary ring.'
    },
    {
      id: 'lagoon',
      name: 'Lagoon Nebula (Messier 8)',
      pos: [20.5, 0.1, 2.2],
      radius: 3.4,
      colors: [0xff4f9a, 0xf43f5e, 0x38bdf8, 0xfbbf24],
      kind: 'cloud',
      badge: 'Hubble • Giant Interstellar Cloud',
      cls: 'Emission Nebula • NGC 6530 Cluster',
      radiusTxt: '~4,100 ly toward Galactic Core',
      vel: 'Active O-Star Ionization Front',
      sector: 'Sagittarius Arm',
      desc: 'Turbulent magenta-and-teal interstellar cloud in the Sagittarius Arm sculpted by fierce ultraviolet winds from newborn massive stars.'
    },
    {
      id: 'veil',
      name: 'Veil Nebula (Cygnus Loop)',
      pos: [27.4, 1.4, 5.1],
      radius: 3.1,
      colors: [0x38bdf8, 0x22d3ee, 0xf43f5e, 0xa855f7],
      kind: 'shock',
      badge: 'Hubble / Chandra • Supernova Remnant',
      cls: '~130 ly Blast Wave Shell',
      radiusTxt: '~2,400 ly from Sol',
      vel: '10,000–20,000 yr old Shockwave',
      sector: 'Orion Spur • Cygnus',
      desc: 'Delicate glowing ribbons of doubly ionized cyan oxygen and ruby hydrogen shock-heated by a supernova blast wave that exploded 10,000–20,000 years ago.'
    },
    {
      id: 'ringneb',
      name: 'Ring Nebula (Messier 57)',
      pos: [26.8, 1.9, 1.4],
      radius: 2.0,
      colors: [0x2dd4bf, 0x38bdf8, 0xf59e0b, 0xf43f5e],
      kind: 'ring',
      badge: 'JWST NIRCam / MIRI • Planetary Ring',
      cls: 'Bipolar Barrel Nebula • 20,000 Knots',
      radiusTxt: '~2,567 ly from Sol',
      vel: 'Expanding at 20–30 km/s',
      sector: 'Orion Spur • Lyra',
      desc: 'Iconic JWST emerald-teal and fiery amber-magenta barrel of glowing gas expelled by a dying star, laced with ~20,000 dense molecular hydrogen globules.'
    }
  ];

  const SOLAR_PLANETS_DEF = [
    {
      id: 'mercury', name: 'Mercury', orbitR: 0.44, radius: 0.026, period: 0.241, rotSpd: 0.35, tilt: 0.001, inc: 0.12, phase: 0.4,
      pType: 0.0, colA: 0x6b6762, colB: 0xb8b2a8, atmoCol: 0x94a3b8, atmoStr: 0.06, orbitCol: 0x94a3b8,
      badge: 'Inner Terrestrial Planet • 0 Moons', cls: '4,879 km Diameter • Silicate/Iron',
      radiusTxt: '0.39 AU (57.9M km)', vel: '47.4 km/s • 88.0 d Orbit',
      desc: 'Smallest and innermost planet of the Solar System—heavily cratered, airless rocky world whipping around the Sun in just 88 Earth days.'
    },
    {
      id: 'venus', name: 'Venus', orbitR: 0.64, radius: 0.042, period: 0.615, rotSpd: -0.18, tilt: 3.09, inc: 0.06, phase: 1.9,
      pType: 1.0, colA: 0xc28a3e, colB: 0xfde6b2, atmoCol: 0xfcd34d, atmoStr: 0.58, orbitCol: 0xfbbf24,
      badge: 'Terrestrial Planet • Runaway Greenhouse', cls: '12,104 km Diameter • 0 Moons',
      radiusTxt: '0.72 AU (108.2M km)', vel: '35.0 km/s • 224.7 d Orbit',
      desc: 'Shrouded in golden-cream sulfuric acid clouds above a 464 °C surface, spinning slowly backward (retrograde) compared to most planets.'
    },
    {
      id: 'earth', name: 'Earth', orbitR: 0.88, radius: 0.046, period: 1.000, rotSpd: 1.45, tilt: 0.409, inc: 0.0, phase: 3.1,
      pType: 2.0, colA: 0x1d4ed8, colB: 0x22c55e, atmoCol: 0x38bdf8, atmoStr: 0.72, orbitCol: 0x38bdf8, hasMoon: true,
      badge: 'Home World • 1 Moon (Luna)', cls: '12,756 km Diameter • Ocean World',
      radiusTxt: '1.00 AU (149.6M km)', vel: '29.8 km/s • 365.25 d Orbit',
      desc: 'Our pale blue dot—liquid sapphire oceans, living continents, dynamic white cloud decks, a protective nitrogen-oxygen sky, and the orbiting Moon.'
    },
    {
      id: 'mars', name: 'Mars', orbitR: 1.14, radius: 0.034, period: 1.881, rotSpd: 1.40, tilt: 0.44, inc: 0.03, phase: 4.8,
      pType: 3.0, colA: 0x8f331c, colB: 0xe67e4d, atmoCol: 0xfb923c, atmoStr: 0.34, orbitCol: 0xf87171,
      badge: 'Red Planet • 2 Moons (Phobos, Deimos)', cls: '6,792 km Diameter • Iron-Oxide',
      radiusTxt: '1.52 AU (228.0M km)', vel: '24.1 km/s • 687.0 d Orbit',
      desc: 'Rust-red desert world crowned by bright polar ice caps, home to Olympus Mons and Valles Marineris.'
    },
    {
      id: 'jupiter', name: 'Jupiter', orbitR: 1.88, radius: 0.108, period: 11.862, rotSpd: 2.6, tilt: 0.054, inc: 0.02, phase: 0.9,
      pType: 4.0, colA: 0xc27b48, colB: 0xf5e2c4, atmoCol: 0xfdba74, atmoStr: 0.38, orbitCol: 0xf59e0b, hasGalileans: true,
      badge: 'Gas Giant • 95 Known Moons', cls: '142,984 km Diameter • 318 M⊕',
      radiusTxt: '5.20 AU (778.5M km)', vel: '13.1 km/s • 11.86 yr Orbit',
      desc: 'King of the Solar System—striped by turbulent ammonia cloud belts, the anticyclonic Great Red Spot, and orbited by Io, Europa, Ganymede, and Callisto.'
    },
    {
      id: 'saturn', name: 'Saturn', orbitR: 2.48, radius: 0.092, period: 29.457, rotSpd: 2.35, tilt: 0.466, inc: 0.04, phase: 2.5,
      pType: 5.0, colA: 0xc9a86a, colB: 0xfef0c7, atmoCol: 0xfde68a, atmoStr: 0.34, orbitCol: 0xfde047, hasRings: 'saturn',
      badge: 'Ringed Gas Giant • 274 Known Moons', cls: '120,536 km Diameter • Icy Rings',
      radiusTxt: '9.58 AU (1.43B km)', vel: '9.7 km/s • 29.46 yr Orbit',
      desc: 'Adorned by dazzling water-ice rings split by the Cassini Division, leading the Solar System with 274 confirmed moons including haze-shrouded Titan and Enceladus.'
    },
    {
      id: 'uranus', name: 'Uranus', orbitR: 3.04, radius: 0.064, period: 84.02, rotSpd: -1.6, tilt: 1.706, inc: 0.014, phase: 4.1,
      pType: 6.0, colA: 0x4fb8c9, colB: 0xbef2fa, atmoCol: 0x67e8f9, atmoStr: 0.52, orbitCol: 0x67e8f9, hasRings: 'uranus',
      badge: 'Ice Giant • 28 Moons • 97.8° Axial Tilt', cls: '51,118 km Diameter • Methane Ice',
      radiusTxt: '19.2 AU (2.87B km)', vel: '6.8 km/s • 84.0 yr Orbit',
      desc: 'Pale cyan ice giant rolling sideways on its orbit at a dramatic 97.8° axial tilt, encircled by faint vertical dark rings.'
    },
    {
      id: 'neptune', name: 'Neptune', orbitR: 3.56, radius: 0.062, period: 164.8, rotSpd: 1.75, tilt: 0.494, inc: 0.03, phase: 5.5,
      pType: 6.0, colA: 0x1d4ed8, colB: 0x60a5fa, atmoCol: 0x3b82f6, atmoStr: 0.62, orbitCol: 0x60a5fa,
      badge: 'Outermost Ice Giant • 16 Moons', cls: '49,528 km Diameter • Supersonic Winds',
      radiusTxt: '30.1 AU (4.52B km)', vel: '5.4 km/s • 164.8 yr Orbit',
      desc: 'Deep azure ice giant swept by the fastest winds in the Solar System (>2,000 km/h), patrolling the inner edge of the icy Kuiper Belt.'
    }
  ];

  function createSaturnRingTexture() {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 16;
    const ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 256, 0);
    g.addColorStop(0.00, 'rgba(180,155,120,0.0)');
    g.addColorStop(0.10, 'rgba(190,165,130,0.28)'); // C Ring
    g.addColorStop(0.24, 'rgba(245,228,194,0.88)'); // B Ring inner
    g.addColorStop(0.56, 'rgba(255,244,216,0.95)'); // B Ring bright
    g.addColorStop(0.60, 'rgba(25,22,18,0.12)');    // Cassini Division!
    g.addColorStop(0.66, 'rgba(25,22,18,0.15)');
    g.addColorStop(0.69, 'rgba(232,216,184,0.72)'); // A Ring
    g.addColorStop(0.88, 'rgba(218,200,170,0.58)');
    g.addColorStop(0.92, 'rgba(25,22,18,0.16)');    // Encke Gap
    g.addColorStop(0.96, 'rgba(225,212,188,0.45)'); // F Ring
    g.addColorStop(1.00, 'rgba(200,185,160,0.0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 16);
    const tex = new THREE.CanvasTexture(c);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    return tex;
  }

  function makeRadialRingGeo(innerR, outerR, segs) {
    const geo = new THREE.RingGeometry(innerR, outerR, segs, 1);
    const pos = geo.attributes.position;
    const uv = geo.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const r = Math.sqrt(x * x + y * y);
      const u = (r - innerR) / Math.max(outerR - innerR, 0.0001);
      uv.setXY(i, u, 0.5);
    }
    geo.rotateX(-Math.PI * 0.5);
    return geo;
  }

  function buildSolarSystem(solPosArr) {
    SOL_POS.set(solPosArr[0], solPosArr[1], solPosArr[2]);
    solarSystemGroup.position.copy(SOL_POS);

    const rng = makeRng(20260808);
    const sharedUnitSphere = new THREE.SphereGeometry(1.0, 28, 20);
    const saturnRingTex = createSaturnRingTexture();

    // 1. The Sun (G2V 3D Boiling Plasma Core + Chromospheric Halo)
    if (typeof SHADERS.createStarSurfaceMaterial === 'function') {
      const sunMat = SHADERS.createStarSurfaceMaterial({
        baseColor: 0xffa834,
        hotColor: 0xfffef2,
        spotColor: 0xb8360b,
        cellScale: 6.2,
        pulseSpeed: 0.55
      });
      star3DMaterials.push(sunMat);
      const sunMesh = new THREE.Mesh(sharedUnitSphere, sunMat);
      sunMesh.scale.setScalar(0.23);
      sunMesh.renderOrder = 4;
      solarTiltGroup.add(sunMesh);
    }

    const sunCorona = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: textures.starGlow,
        color: 0xffd27d,
        transparent: true,
        opacity: 0.72,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    sunCorona.scale.setScalar(0.95);
    solarTiltGroup.add(sunCorona);

    // 2. All 8 Orbiting Procedural 3D Planets + Rings + Moons
    SOLAR_PLANETS_DEF.forEach(function (pl) {
      // Crisp planetary orbit ellipse
      const oPts = [];
      for (let i = 0; i <= 96; i++) {
        const a = (i / 96) * Math.PI * 2;
        oPts.push(new THREE.Vector3(Math.cos(a) * pl.orbitR, Math.sin(a) * Math.sin(pl.inc) * pl.orbitR * 0.25, Math.sin(a) * pl.orbitR));
      }
      solarTiltGroup.add(
        new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(oPts),
          new THREE.LineBasicMaterial({
            color: pl.orbitCol,
            transparent: true,
            opacity: pl.id === 'earth' ? 0.42 : 0.22,
            blending: THREE.AdditiveBlending,
            depthWrite: false
          })
        )
      );

      const pivot = new THREE.Group();
      solarTiltGroup.add(pivot);

      const spinGroup = new THREE.Group();
      spinGroup.rotation.z = pl.tilt;
      pivot.add(spinGroup);

      let pMat;
      if (typeof SHADERS.createPlanetMaterial === 'function') {
        pMat = SHADERS.createPlanetMaterial({
          planetType: pl.pType,
          colorA: pl.colA,
          colorB: pl.colB,
          atmoColor: pl.atmoCol,
          atmoStrength: pl.atmoStr
        });
        pMat.uniforms.uSunPos.value.copy(SOL_POS);
        planetShaderMaterials.push(pMat);
      } else {
        pMat = new THREE.MeshBasicMaterial({ color: pl.colA });
      }

      const pMesh = new THREE.Mesh(sharedUnitSphere, pMat);
      pMesh.scale.setScalar(pl.radius);
      pMesh.renderOrder = 4;
      spinGroup.add(pMesh);

      // Saturn's Multi-Band Cassini Rings / Uranus's Faint Vertical Rings
      if (pl.hasRings === 'saturn') {
        const ringMesh = new THREE.Mesh(
          makeRadialRingGeo(pl.radius * 1.28, pl.radius * 2.42, 64),
          new THREE.MeshBasicMaterial({
            map: saturnRingTex,
            transparent: true,
            opacity: 0.92,
            side: THREE.DoubleSide,
            depthWrite: false
          })
        );
        ringMesh.renderOrder = 5;
        spinGroup.add(ringMesh);
      } else if (pl.hasRings === 'uranus') {
        const uRing = new THREE.Mesh(
          makeRadialRingGeo(pl.radius * 1.48, pl.radius * 1.88, 48),
          new THREE.MeshBasicMaterial({
            color: 0xa5f3fc,
            transparent: true,
            opacity: 0.34,
            side: THREE.DoubleSide,
            depthWrite: false
          })
        );
        uRing.renderOrder = 5;
        spinGroup.add(uRing);
      }

      // Earth's Moon (Luna)
      let moonPivot = null;
      if (pl.hasMoon) {
        moonPivot = new THREE.Group();
        pivot.add(moonPivot);
        const moonMat = typeof SHADERS.createPlanetMaterial === 'function'
          ? SHADERS.createPlanetMaterial({ planetType: 0.0, colorA: 0x808080, colorB: 0xd4d4d8, atmoColor: 0x94a3b8, atmoStrength: 0.04 })
          : new THREE.MeshBasicMaterial({ color: 0xd4d4d8 });
        if (moonMat.uniforms) {
          moonMat.uniforms.uSunPos.value.copy(SOL_POS);
          planetShaderMaterials.push(moonMat);
        }
        const moonMesh = new THREE.Mesh(sharedUnitSphere, moonMat);
        moonMesh.scale.setScalar(0.013);
        moonMesh.position.set(0.095, 0.008, 0);
        moonPivot.add(moonMesh);
      }

      // Jupiter's 4 Galilean Moons (Io, Europa, Ganymede, Callisto)
      const galMoons = [];
      if (pl.hasGalileans) {
        [
          { r: 0.15, sz: 0.010, col: 0xfde047, spd: 3.4, ph: 0.2 },
          { r: 0.19, sz: 0.009, col: 0xe0f2fe, spd: 2.2, ph: 1.7 },
          { r: 0.24, sz: 0.013, col: 0xd6d3d1, spd: 1.4, ph: 3.5 },
          { r: 0.29, sz: 0.011, col: 0xa8a29e, spd: 0.9, ph: 5.1 }
        ].forEach(function (gm) {
          const mm = new THREE.Mesh(sharedUnitSphere, new THREE.MeshBasicMaterial({ color: gm.col }));
          mm.scale.setScalar(gm.sz);
          pivot.add(mm);
          galMoons.push({ mesh: mm, r: gm.r, spd: gm.spd, ph: gm.ph });
        });
      }

      const entry = {
        def: pl,
        pivot: pivot,
        pMesh: pMesh,
        moonPivot: moonPivot,
        galMoons: galMoons,
        worldPos: new THREE.Vector3()
      };
      solarPlanetEntries.push(entry);
      solarPlanetMap[pl.id] = entry;

      // Register each planet in Inspector Lookup so Search Bar & Clickable Labels fly right to it!
      CAT.INSPECTOR_LOOKUP[pl.id] = {
        id: pl.id,
        label: pl.name,
        title: pl.name + ' (Solar System)',
        badge: pl.badge,
        cls: pl.cls,
        radius: pl.radiusTxt,
        vel: pl.vel,
        sector: 'Solar System • Orion Spur',
        target: [SOL_POS.x, SOL_POS.y, SOL_POS.z],
        camPos: [SOL_POS.x + 1.2, SOL_POS.y + 0.8, SOL_POS.z + 1.6],
        isSolarPlanet: true,
        desc: pl.desc
      };
    });

    // 3. Main Asteroid Belt (420 rocky particles between Mars & Jupiter)
    const astCount = 420;
    const astPos = new Float32Array(astCount * 3);
    const astCol = new Float32Array(astCount * 3);
    for (let i = 0; i < astCount; i++) {
      const r = 1.32 + rng() * 0.28;
      const a = rng() * Math.PI * 2;
      astPos[i * 3] = Math.cos(a) * r;
      astPos[i * 3 + 1] = randGauss(rng) * 0.032;
      astPos[i * 3 + 2] = Math.sin(a) * r;
      const tone = 0.52 + rng() * 0.30;
      astCol[i * 3] = tone;
      astCol[i * 3 + 1] = tone * 0.92;
      astCol[i * 3 + 2] = tone * 0.82;
    }
    const astGeo = new THREE.BufferGeometry();
    astGeo.setAttribute('position', new THREE.BufferAttribute(astPos, 3));
    astGeo.setAttribute('color', new THREE.BufferAttribute(astCol, 3));
    solarTiltGroup.add(
      new THREE.Points(
        astGeo,
        new THREE.PointsMaterial({
          size: 0.022,
          vertexColors: true,
          transparent: true,
          opacity: 0.65,
          depthWrite: false
        })
      )
    );

    // 4. Icy Kuiper Belt beyond Neptune (550 icy blue-white bodies)
    const kbCount = 550;
    const kbPos = new Float32Array(kbCount * 3);
    const kbCol = new Float32Array(kbCount * 3);
    for (let i = 0; i < kbCount; i++) {
      const r = 3.78 + rng() * 0.65;
      const a = rng() * Math.PI * 2;
      kbPos[i * 3] = Math.cos(a) * r;
      kbPos[i * 3 + 1] = randGauss(rng) * 0.11;
      kbPos[i * 3 + 2] = Math.sin(a) * r;
      kbCol[i * 3] = 0.58 + rng() * 0.25;
      kbCol[i * 3 + 1] = 0.78 + rng() * 0.20;
      kbCol[i * 3 + 2] = 0.96;
    }
    const kbGeo = new THREE.BufferGeometry();
    kbGeo.setAttribute('position', new THREE.BufferAttribute(kbPos, 3));
    kbGeo.setAttribute('color', new THREE.BufferAttribute(kbCol, 3));
    solarTiltGroup.add(
      new THREE.Points(
        kbGeo,
        new THREE.PointsMaterial({
          size: 0.028,
          vertexColors: true,
          transparent: true,
          opacity: 0.52,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        })
      )
    );

    // Upgrade Sol's Inspector entry & Preset button to "Solar System"
    if (CAT.INSPECTOR_LOOKUP.sol) {
      CAT.INSPECTOR_LOOKUP.sol.label = 'Solar System';
      CAT.INSPECTOR_LOOKUP.sol.title = 'Our Solar System (Sun & 8 Planets)';
      CAT.INSPECTOR_LOOKUP.sol.badge = 'Home Planetary System • Orion Spur';
      CAT.INSPECTOR_LOOKUP.sol.cls = 'G2V Star • 8 Planets • 5 Dwarf Planets';
      CAT.INSPECTOR_LOOKUP.sol.radius = '8.18 kpc from Sgr A* (~26.7 kyr)';
      CAT.INSPECTOR_LOOKUP.sol.vel = '230 km/s • 230 Myr Galactic Year';
      CAT.INSPECTOR_LOOKUP.sol.target = [SOL_POS.x, SOL_POS.y, SOL_POS.z];
      CAT.INSPECTOR_LOOKUP.sol.camPos = [SOL_POS.x + 2.35, SOL_POS.y + 1.75, SOL_POS.z + 3.25];
      CAT.INSPECTOR_LOOKUP.sol.desc = 'Our home system orbiting the Milky Way’s Orion Spur—featuring the boiling G2V Sun, all 8 orbiting 3D planets, Earth’s Moon, Jupiter’s Galilean moons, Saturn’s icy rings, the Asteroid Belt, and the Kuiper Belt. Tap any planet label to fly right to it!';
    }
    if (CAT.DIRECTORY_TABS.stars) {
      CAT.DIRECTORY_TABS.stars.forEach(function (it) {
        if (it.id === 'sol') it.label = 'Solar System';
      });
    }
  }

  function updateSolarSystem(simTime) {
    const dSol = camera.position.distanceTo(SOL_POS);
    const active = dSol < 28.0;
    solarSystemGroup.visible = active;

    if (solFarSprite) {
      const farBlend = THREE.MathUtils.smoothstep(dSol, 2.6, 12.0);
      solFarSprite.material.opacity = 0.14 + 0.86 * farBlend;
      solFarSprite.scale.setScalar(solFarSpriteBase * (0.45 + 0.55 * farBlend));
    }
    if (!active) return;

    // Gentle scaled Keplerian orbital motion (outer planets boosted slightly so everything glides visibly!)
    for (let i = 0; i < solarPlanetEntries.length; i++) {
      const pe = solarPlanetEntries[i];
      const pl = pe.def;
      const angSpeed = 0.65 / Math.pow(pl.period, 0.56);
      const ang = pl.phase + simTime * angSpeed;
      const yOff = Math.sin(ang) * Math.sin(pl.inc) * pl.orbitR * 0.25;
      pe.pivot.position.set(Math.cos(ang) * pl.orbitR, yOff, Math.sin(ang) * pl.orbitR);
      pe.pMesh.rotation.y = simTime * pl.rotSpd;

      if (pe.moonPivot) {
        pe.moonPivot.rotation.y = simTime * 2.8;
      }
      for (let m = 0; m < pe.galMoons.length; m++) {
        const gm = pe.galMoons[m];
        const ga = gm.ph + simTime * gm.spd;
        gm.mesh.position.set(Math.cos(ga) * gm.r, 0, Math.sin(ga) * gm.r);
      }
    }

    solarSystemGroup.updateMatrixWorld(true);
    for (let i = 0; i < solarPlanetEntries.length; i++) {
      solarPlanetEntries[i].pivot.getWorldPosition(solarPlanetEntries[i].worldPos);
    }

    for (let m = 0; m < planetShaderMaterials.length; m++) {
      planetShaderMaterials[m].uniforms.uTime.value = simTime;
    }
  }

  function buildLandmarksAndNebulae() {
    const rng = makeRng(88421);
    const starSphereGeo = new THREE.SphereGeometry(1.0, 22, 16);
    const beamConeGeo = new THREE.ConeGeometry(0.14, 2.2, 10, 1, true);
    beamConeGeo.translate(0, 1.1, 0);

    CAT.LANDMARK_STARS.forEach(function (st) {
      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: st.isSol ? textures.jwstSpike : textures.starGlow,
          color: st.color,
          transparent: true,
          opacity: 1.0,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        })
      );
      sprite.position.set(st.pos[0], st.pos[1], st.pos[2]);
      sprite.scale.setScalar(st.size * 2.2);
      landmarksGroup.add(sprite);

      if (st.isSol) {
        solFarSprite = sprite;
        solFarSpriteBase = st.size * 2.2;
        buildSolarSystem(st.pos);
        return;
      }

      if (st.isPulsar) {
        pulsarSprites.push({ sprite: sprite, baseScale: st.size * 2.2, freq: 14.0 });
      }

      // Build Distance-Culled 3D Boiling Plasma Body / Pulsar Lighthouse / Micro-BH!
      const bodyGroup = new THREE.Group();
      bodyGroup.position.set(st.pos[0], st.pos[1], st.pos[2]);
      bodyGroup.visible = false;
      landmarksGroup.add(bodyGroup);

      const starCol = new THREE.Color(st.color || 0xffdfa8);
      const isRedGiant = starCol.r > 0.78 && starCol.b < 0.48;
      const isHotBlue = starCol.b > 0.85 && starCol.r < 0.75;
      const visualR = st.isMicroBH
        ? 0.19
        : (st.isPulsar ? 0.14 : THREE.MathUtils.clamp(st.size * (isRedGiant ? 0.42 : 0.28), 0.17, 0.56));

      if (st.isMicroBH) {
        // Pitch-black stellar-mass event horizon + swirling cyan-gold accretion disk
        const bhCoreMesh = new THREE.Mesh(starSphereGeo, new THREE.MeshBasicMaterial({ color: 0x000000 }));
        bhCoreMesh.scale.setScalar(visualR);
        bodyGroup.add(bhCoreMesh);
        const disk = new THREE.Mesh(
          new THREE.RingGeometry(visualR * 1.55, visualR * 5.2, 40),
          new THREE.MeshBasicMaterial({
            color: 0x38bdf8,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.82,
            blending: THREE.AdditiveBlending,
            depthWrite: false
          })
        );
        disk.rotation.x = Math.PI * 0.36;
        bodyGroup.add(disk);
        const innerDisk = new THREE.Mesh(
          new THREE.RingGeometry(visualR * 1.25, visualR * 2.2, 32),
          new THREE.MeshBasicMaterial({
            color: 0xfef08a,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.90,
            blending: THREE.AdditiveBlending,
            depthWrite: false
          })
        );
        innerDisk.rotation.x = Math.PI * 0.36;
        bodyGroup.add(innerDisk);
      } else if (typeof SHADERS.createStarSurfaceMaterial === 'function') {
        const sMat = SHADERS.createStarSurfaceMaterial({
          baseColor: starCol.getHex(),
          hotColor: isRedGiant ? 0xffe4b5 : 0xffffff,
          spotColor: starCol.clone().multiplyScalar(isRedGiant ? 0.28 : 0.42).getHex(),
          cellScale: isRedGiant ? 3.2 : (isHotBlue ? 7.8 : 5.4),
          pulseSpeed: isRedGiant ? 0.28 : (st.isPulsar ? 1.8 : 0.52)
        });
        star3DMaterials.push(sMat);
        const mesh = new THREE.Mesh(starSphereGeo, sMat);
        mesh.scale.setScalar(visualR);
        mesh.renderOrder = 4;
        bodyGroup.add(mesh);

        // Soft outer atmospheric/dusty envelope for massive red supergiants
        if (isRedGiant) {
          const envSp = new THREE.Sprite(
            new THREE.SpriteMaterial({
              map: textures.nebulaPuff,
              color: 0xff6b2b,
              transparent: true,
              opacity: 0.38,
              blending: THREE.AdditiveBlending,
              depthWrite: false
            })
          );
          envSp.scale.setScalar(visualR * 4.8);
          bodyGroup.add(envSp);
        }

        // Spinning Twin Relativistic Lighthouse Beams for Pulsars!
        if (st.isPulsar) {
          const beamPivot = new THREE.Group();
          beamPivot.rotation.z = 0.52;
          bodyGroup.add(beamPivot);
          const bMat = registerJetMaterial(
            new THREE.MeshBasicMaterial({
              color: 0x38bdf8,
              transparent: true,
              opacity: 0.58,
              blending: THREE.AdditiveBlending,
              depthWrite: false,
              side: THREE.DoubleSide
            }),
            0x38bdf8, 0.58, 0.96, 0xff9f1c
          );
          beamPivot.add(new THREE.Mesh(beamConeGeo, bMat));
          const bSouth = new THREE.Mesh(beamConeGeo, bMat);
          bSouth.rotation.x = Math.PI;
          beamPivot.add(bSouth);
          pulsarBeamEntries.push({ pivot: beamPivot, speed: 6.5 });
        }
      }

      // Bring landmark star preset cameras slightly closer so clicking a star reveals its 3D surface!
      const lk = CAT.INSPECTOR_LOOKUP[st.id];
      if (lk && !st.isSol) {
        const pull = Math.max(1.55, visualR * 5.2);
        lk.camPos = [st.pos[0] + pull * 0.72, st.pos[1] + pull * 0.45, st.pos[2] + pull];
      }

      namedStar3DEntries.push({
        group: bodyGroup,
        sprite: sprite,
        baseScale: st.size * 2.2,
        worldPos: new THREE.Vector3(st.pos[0], st.pos[1], st.pos[2]),
        maxDist: 18.0,
        spinSpeed: st.isPulsar ? 5.0 : (isRedGiant ? 0.14 : 0.38)
      });
    });

    // --- Single-Draw-Call Batched NASA Multi-Wavelength Emission Nebulae ---
    // Register 5 new iconic NASA nebulae into catalog & Stars directory tab
    EXTRA_NASA_NEBULAE.forEach(function (en) {
      CAT.INSPECTOR_LOOKUP[en.id] = {
        id: en.id,
        label: en.name.split(' (')[0],
        title: en.name,
        badge: en.badge,
        cls: en.cls,
        radius: en.radiusTxt,
        vel: en.vel,
        sector: en.sector,
        target: en.pos,
        camPos: [en.pos[0] + en.radius * 1.65, en.pos[1] + en.radius * 0.95, en.pos[2] + en.radius * 2.1],
        desc: en.desc
      };
      if (CAT.DIRECTORY_TABS.stars && !CAT.DIRECTORY_TABS.stars.some(function (it) { return it.id === en.id; })) {
        CAT.DIRECTORY_TABS.stars.push({ id: en.id, label: en.name.split(' (')[0] });
      }
    });

    const allNebulae = CAT.NEBULAE.concat(EXTRA_NASA_NEBULAE);
    const nebVerts = [];
    const nebCols = [];
    const nebData = []; // vec4(worldSize, opacity, kind(0=gas,1=pillarDust,2=xrayShock), seed)
    const cTmp = new THREE.Color();

    allNebulae.forEach(function (neb) {
      const basePuffs = neb.isPillars ? 190 : (neb.kind === 'starburst' ? 240 : 145);
      const nx = neb.pos[0];
      const ny = neb.pos[1];
      const nz = neb.pos[2];
      const R = neb.radius;
      const isShock = !!(neb.isPulsar || neb.kind === 'shock');
      const isRing = neb.kind === 'ring';

      for (let i = 0; i < basePuffs; i++) {
        let px = 0, py = 0, pz = 0;
        let sz = R * (0.34 + rng() * 0.48);
        let op = 0.16 + rng() * 0.18;
        let kind = isShock ? 2.0 : 0.0;

        const palHex = neb.colors[i % neb.colors.length];
        cTmp.setHex(palHex);

        if (neb.isPillars && i < 95) {
          // 3 sculpted Pillars of Creation columns with glowing cyan-gold ionized rims!
          const colIdx = i % 3;
          const hFrac = rng();
          px = (colIdx - 1) * R * 0.34 + randGauss(rng) * R * (0.14 - hFrac * 0.05);
          py = (hFrac - 0.46) * R * 1.32;
          pz = (colIdx - 1) * 0.22 + randGauss(rng) * R * 0.12;
          sz = R * (0.32 - hFrac * 0.10 + rng() * 0.12);
          kind = 1.0;
          if (hFrac > 0.72) cTmp.lerp(new THREE.Color(0x38bdf8), 0.55);
          else cTmp.lerp(new THREE.Color(0xf59e0b), 0.42);
        } else if (isRing) {
          // Planetary Nebula Ring (Helix / M57): Cyan-emerald interior eye + crimson-amber outer ring!
          const isEye = i < basePuffs * 0.36;
          const a = rng() * Math.PI * 2;
          const rr = isEye ? R * rng() * 0.58 : R * (0.68 + randGauss(rng) * 0.12);
          px = Math.cos(a) * rr;
          py = Math.sin(a) * rr * 0.88;
          pz = randGauss(rng) * R * 0.22;
          cTmp.setHex(isEye ? neb.colors[0] : neb.colors[2 + (i % 2)]);
          sz = R * (isEye ? 0.38 : 0.28 + rng() * 0.22);
        } else if (isShock) {
          // Supernova Remnant Filament Shell (Crab / Veil): Electric cyan & ruby shock shell
          const th = rng() * Math.PI * 2;
          const ph = Math.acos(2 * rng() - 1);
          const rr = R * (0.55 + Math.pow(rng(), 0.45) * 0.52);
          px = rr * Math.sin(ph) * Math.cos(th);
          py = rr * Math.cos(ph) * 0.82;
          pz = rr * Math.sin(ph) * Math.sin(th);
          sz = R * (0.26 + rng() * 0.32);
        } else {
          // Organic multi-layered emission cloud (Orion, Carina, Tarantula, Lagoon)
          const r = R * Math.pow(rng(), 0.72);
          const th = rng() * Math.PI * 2;
          const ph = Math.acos(2 * rng() - 1);
          px = r * Math.sin(ph) * Math.cos(th);
          py = r * Math.cos(ph) * 0.72;
          pz = r * Math.sin(ph) * Math.sin(th);
          // Enhance NASA Hubble/JWST contrast: cyan-teal inner cavity, ruby-gold outer rims
          if (r < R * 0.42) cTmp.lerp(new THREE.Color(0x38bdf8), 0.45);
        }

        nebVerts.push(nx + px, ny + py, nz + pz);
        nebCols.push(cTmp.r, cTmp.g, cTmp.b);
        nebData.push(sz, op, kind, rng());
      }

      // Embedded newborn O/B Trapezium star clusters inside major nurseries
      if (neb.id === 'orion' || neb.id === 'carina' || neb.id === 'tarantula' || neb.id === 'lagoon') {
        const starCount = neb.id === 'tarantula' ? 9 : 6;
        for (let k = 0; k < starCount; k++) {
          const obSp = new THREE.Sprite(
            new THREE.SpriteMaterial({
              map: textures.jwstSpike,
              color: 0xdbeafe,
              transparent: true,
              opacity: 0.90,
              blending: THREE.AdditiveBlending,
              depthWrite: false
            })
          );
          obSp.position.set(
            nx + (rng() - 0.5) * R * 0.42,
            ny + (rng() - 0.5) * R * 0.32,
            nz + (rng() - 0.5) * R * 0.42
          );
          obSp.scale.setScalar((neb.id === 'tarantula' ? 1.8 : 0.8) + rng() * 0.55);
          landmarksGroup.add(obSp);
        }
      }

      // Crab Nebula central spinning pulsar lighthouse!
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
        pSp.position.set(nx, ny, nz);
        pSp.scale.setScalar(1.55);
        landmarksGroup.add(pSp);
        pulsarSprites.push({ sprite: pSp, baseScale: 1.55, freq: 24.0 });
      }
    });

    if (typeof SHADERS.createBatchedNebulaMaterial === 'function') {
      const nGeo = new THREE.BufferGeometry();
      nGeo.setAttribute('position', new THREE.Float32BufferAttribute(nebVerts, 3));
      nGeo.setAttribute('color', new THREE.Float32BufferAttribute(nebCols, 3));
      nGeo.setAttribute('aNebData', new THREE.Float32BufferAttribute(nebData, 4));

      batchedNebulaMat = SHADERS.createBatchedNebulaMaterial(textures.dustAtlas || textures.dustCloud);
      batchedNebulaMat.uniforms.uPixelRatio.value = currentPR;
      batchedNebulaMat.uniforms.uLodDensity.value = state.lodDensity;

      const nebPts = new THREE.Points(nGeo, batchedNebulaMat);
      nebPts.frustumCulled = false;
      nebPts.renderOrder = 3;
      batchedNebulaGroup.add(nebPts);
    }
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
  // 10B. FIERY-GOLD & SAPPHIRE-BLUE "SOAP-BUBBLE" 3D COSMIC WEB (13k – 305k)
  //      Pressed Void-Rim Bubble Arcs + Dual-Temperature Fire/Ice Filaments +
  //      Gossamer Cobwebs & Cosmic Sheets | Still Only 3 GPU Draw Calls!
  // -------------------------------------------------------------------------
  const cosmicWebGroup = new THREE.Group();
  cosmicWebGroup.visible = false;
  scene.add(cosmicWebGroup);

  let cosmicWebLineMat = null;
  let cosmicWebMistMat = null;
  let cosmicWebPointMat = null;
  let cosmicWebVoids = [];

  const COSMIC_WEB_LANDMARKS = [
    {
      id: 'cosmicweb',
      label: 'Cosmic Web 3D',
      title: 'Universe-Wide 3D Cosmic Web & Voids',
      badge: 'IllustrisTNG / NASA SVS • Fire & Ice Foam',
      cls: '480+ Nodes • Soap-Bubble Void Rims',
      radius: '0.4 – 40+ Bly Full Observable Volume',
      vel: 'Sapphire Dark Matter & Fiery Shocked Gas',
      sector: 'Large-Scale Cosmic Sponge',
      target: [0, 0, 0],
      camPos: [72000, 56000, 118000],
      desc: 'Cellular 3D cosmic foam spanning the observable universe: icy sapphire-blue dark-matter cobwebs weaving around 36 pitch-black void pockets, lit by fiery amber-gold shock-heated supercluster ridges and merger fireballs.'
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
      target: [-38000, 74000, -92000],
      camPos: [-12000, 48000, -34000],
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

    // 1. Named & 34 Procedural Carved Pitch-Black Cosmic Voids (36 Total)
    const voids = [
      { id: 'bootesvoid', pos: new THREE.Vector3(-23500, 18500, 22500), r: 11500, named: true, hotRim: 0.72 },
      { id: 'eridanusvoid', pos: new THREE.Vector3(29500, -21000, -24500), r: 14000, named: true, hotRim: 0.25 }
    ];

    // 2. Landmark Great Walls (high-temperature fiery amber-gold spines!)
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
          new THREE.Vector3(-96000, 52000, -38000),
          new THREE.Vector3(-72000, 68000, -68000),
          new THREE.Vector3(-38000, 74000, -92000),
          new THREE.Vector3(8000, 64000, -102000),
          new THREE.Vector3(48000, 44000, -94000)
        ]
      }
    ];

    const quasarAnchors = [
      new THREE.Vector3(92000, 58000, -78000),
      new THREE.Vector3(-118000, -64000, -92000),
      new THREE.Vector3(138000, 102000, 126000),
      new THREE.Vector3(-145000, 96000, 148000)
    ];

    let vAtt = 0;
    while (voids.length < 36 && vAtt < 3000) {
      vAtt++;
      const r = 28000 + Math.pow(rng(), 0.85) * 245000;
      const th = rng() * Math.PI * 2;
      const ph = Math.acos(2 * rng() - 1);
      const vp = new THREE.Vector3(
        r * Math.sin(ph) * Math.cos(th),
        r * Math.cos(ph),
        r * Math.sin(ph) * Math.sin(th)
      );
      const vr = 11500 + (r / 270000) * 24000 + rng() * 7500;

      let ok = true;
      for (let w = 0; w < walls.length && ok; w++) {
        for (let k = 0; k < walls[w].pts.length; k++) {
          if (vp.distanceTo(walls[w].pts[k]) < vr + 6500) { ok = false; break; }
        }
      }
      for (let q = 0; q < quasarAnchors.length && ok; q++) {
        if (vp.distanceTo(quasarAnchors[q]) < vr + 10000) ok = false;
      }
      for (let v = 0; v < voids.length && ok; v++) {
        if (vp.distanceTo(voids[v].pos) < (vr + voids[v].r) * 0.82) ok = false;
      }
      // Assign some void rims as fiery orange shock ridges & others as cool sapphire ice shells!
      if (ok) voids.push({ id: 'void_' + voids.length, pos: vp, r: vr, named: false, hotRim: rng() < 0.44 ? (0.65 + rng() * 0.35) : (rng() * 0.25) });
    }
    cosmicWebVoids = voids;

    function inAnyVoid(pt, pad) {
      for (let i = 0; i < voids.length; i++) {
        if (pt.distanceTo(voids[i].pos) < voids[i].r * pad) return true;
      }
      return false;
    }

    // 3. Assemble ~484 Stratified Supercluster Nodes across 3 Seamless Shells (13k -> 305k!)
    const nodes = [];
    const edges = [];
    const edgeSet = {};

    function addEdge(a, b, heatBoost) {
      const key = a < b ? a + '_' + b : b + '_' + a;
      if (edgeSet[key]) return false;
      edgeSet[key] = true;
      edges.push({ a: a, b: b, heat: heatBoost });
      return true;
    }

    walls.forEach(function (w) {
      const baseIdx = nodes.length;
      w.pts.forEach(function (p, k) {
        nodes.push({ pos: p.clone(), heat: 1.0, hub: 1.0 });
        if (k > 0) addEdge(baseIdx + k - 1, baseIdx + k, 0.96);
      });
    });

    CAT.SUPERSTRUCTURES.forEach(function (sup) {
      nodes.push({
        pos: new THREE.Vector3(sup.labelPos[0], sup.labelPos[1], sup.labelPos[2]),
        heat: 0.90,
        hub: 0.95
      });
    });

    quasarAnchors.forEach(function (qp) {
      nodes.push({ pos: qp.clone(), heat: 1.0, hub: 1.0 });
    });

    const shells = [
      { count: 110, rMin: 13000,  rMax: 58000,  minSp: 9500 },
      { count: 175, rMin: 55000,  rMax: 165000, minSp: 21000 },
      { count: 175, rMin: 160000, rMax: 305000, minSp: 36000 }
    ];

    shells.forEach(function (sh) {
      let made = 0;
      let att = 0;
      while (made < sh.count && att < sh.count * 35) {
        att++;
        const r = sh.rMin + Math.pow(rng(), 0.85) * (sh.rMax - sh.rMin);
        const th = rng() * Math.PI * 2;
        const ph = Math.acos(2 * rng() - 1);
        const p = new THREE.Vector3(
          r * Math.sin(ph) * Math.cos(th),
          r * Math.cos(ph),
          r * Math.sin(ph) * Math.sin(th)
        );
        if (inAnyVoid(p, 1.0)) continue;

        let tooClose = false;
        for (let i = 0; i < nodes.length; i++) {
          if (p.distanceTo(nodes[i].pos) < sh.minSp) { tooClose = true; break; }
        }
        if (!tooClose) {
          // Spatially coherent Fire vs. Ice regions (clusters of fiery orange ridges vs sapphire blue webs!)
          const regionWave = Math.sin(p.x * 0.000022 + p.z * 0.000018) * Math.cos(p.y * 0.000025 - 0.6);
          const isHot = (regionWave > 0.14 || rng() < 0.24);
          nodes.push({
            pos: p,
            heat: isHot ? (0.68 + rng() * 0.32) : (0.04 + rng() * 0.28),
            hub: isHot ? (0.72 + rng() * 0.28) : (0.45 + rng() * 0.42)
          });
          made++;
        }
      }
    });

    const tmpMid = new THREE.Vector3();
    const tmpQ1 = new THREE.Vector3();
    const tmpQ3 = new THREE.Vector3();
    const adj = new Array(nodes.length);
    for (let i = 0; i < nodes.length; i++) adj[i] = [];

    for (let i = 0; i < nodes.length; i++) {
      const rNode = nodes[i].pos.length();
      const maxLinkDist = rNode < 58000 ? 34000 : (rNode < 165000 ? 66000 : 108000);
      const neighbors = [];
      for (let j = 0; j < nodes.length; j++) {
        if (i === j) continue;
        const d = nodes[i].pos.distanceTo(nodes[j].pos);
        if (d < maxLinkDist) neighbors.push({ d: d, j: j });
      }
      neighbors.sort(function (u, v) { return u.d - v.d; });

      let linked = 0;
      for (let k = 0; k < neighbors.length && linked < 4; k++) {
        const j = neighbors[k].j;
        const p1 = nodes[i].pos;
        const p2 = nodes[j].pos;
        tmpMid.addVectors(p1, p2).multiplyScalar(0.5);
        tmpQ1.lerpVectors(p1, p2, 0.25);
        tmpQ3.lerpVectors(p1, p2, 0.75);

        if (inAnyVoid(tmpMid, 0.90) || inAnyVoid(tmpQ1, 0.86) || inAnyVoid(tmpQ3, 0.86)) {
          continue;
        }
        const key = i < j ? i + '_' + j : j + '_' + i;
        if (edgeSet[key]) {
          linked++;
        } else {
          const edgeHeat = (nodes[i].heat + nodes[j].heat) * 0.5;
          if (addEdge(i, j, edgeHeat)) linked++;
        }
      }
    }

    for (let e = 0; e < edges.length; e++) {
      adj[edges[e].a].push(edges[e].b);
      adj[edges[e].b].push(edges[e].a);
    }

    const cosmicSheets = [];
    for (let i = 0; i < nodes.length && cosmicSheets.length < 200; i++) {
      const ni = adj[i];
      for (let a = 0; a < ni.length && cosmicSheets.length < 200; a++) {
        const j = ni[a];
        if (j <= i) continue;
        const nj = adj[j];
        for (let b = 0; b < nj.length && cosmicSheets.length < 200; b++) {
          const k = nj[b];
          if (k <= j) continue;
          if (ni.indexOf(k) !== -1) {
            tmpMid.copy(nodes[i].pos).add(nodes[j].pos).add(nodes[k].pos).multiplyScalar(1 / 3);
            if (!inAnyVoid(tmpMid, 0.88)) {
              cosmicSheets.push([i, j, k]);
            }
          }
        }
      }
    }

    // 4. Populate 3 GPU Buffers:
    //    (1) Braided Tendrils + Pressed Soap-Bubble Void Rims + Gossamer Cobwebs
    //    (2) Volumetric Fire-and-Ice Mist along Filaments, Bubble Rims, Sheets & Fireball Hubs
    //    (3) Crisp Supercluster Fireball Cores & Sapphire/Gold Filament Galaxies
    const lineVerts = [];
    const lineData = []; // vec3(hubWeight, heat(0=sapphire..1=fieryOrange), zDepth)

    const mistVerts = [];
    const mistData = []; // vec4(size, heat, zDepth, seed)

    const ptVerts = [];
    const ptData = [];   // vec4(size, heatOrHub, zDepth, seed)

    const bendOffset = new THREE.Vector3();
    const altOffset = new THREE.Vector3();
    const perpAxis = new THREE.Vector3();
    const tangentVec = new THREE.Vector3();
    const ptTmp = new THREE.Vector3();

    edges.forEach(function (e) {
      const pA = nodes[e.a].pos;
      const pB = nodes[e.b].pos;
      const span = pA.distanceTo(pB);
      const midDist = tmpMid.addVectors(pA, pB).multiplyScalar(0.5).length();
      const zDepth = THREE.MathUtils.clamp((midDist - 15000) / 290000, 0.0, 1.0);
      const hA = nodes[e.a].heat;
      const hB = nodes[e.b].heat;

      bendOffset.set(randGauss(rng), randGauss(rng), randGauss(rng)).multiplyScalar(span * 0.14);
      const ctrl1 = new THREE.Vector3().addVectors(pA, pB).multiplyScalar(0.5).add(bendOffset);
      if (inAnyVoid(ctrl1, 0.94)) ctrl1.addVectors(pA, pB).multiplyScalar(0.5);
      const curve1 = new THREE.QuadraticBezierCurve3(pA, ctrl1, pB);

      // Two braided organic companion tendrils (creates fibrous gossamer cobweb look!)
      tangentVec.subVectors(pB, pA).normalize();
      perpAxis.set(randGauss(rng), randGauss(rng), randGauss(rng)).cross(tangentVec);
      if (perpAxis.lengthSq() < 1e-4) perpAxis.set(0, 1, 0);
      perpAxis.normalize();

      altOffset.copy(perpAxis).multiplyScalar(span * (0.048 + rng() * 0.045));
      const curve2 = new THREE.QuadraticBezierCurve3(pA, ctrl1.clone().add(altOffset), pB);

      const segs = 8;
      const pts1 = curve1.getPoints(segs);
      const pts2 = curve2.getPoints(segs);

      for (let s = 0; s < segs; s++) {
        const t0 = s / segs;
        const t1 = (s + 1) / segs;
        const w0 = Math.pow(Math.abs(t0 * 2.0 - 1.0), 1.45);
        const w1 = Math.pow(Math.abs(t1 * 2.0 - 1.0), 1.45);
        const ht0 = THREE.MathUtils.lerp(hA, hB, t0);
        const ht1 = THREE.MathUtils.lerp(hA, hB, t1);

        // Primary fiery/sapphire core strand
        lineVerts.push(pts1[s].x, pts1[s].y, pts1[s].z, pts1[s + 1].x, pts1[s + 1].y, pts1[s + 1].z);
        lineData.push(w0, ht0, zDepth, w1, ht1, zDepth);

        // Braided gossamer silver-blue outer thread
        lineVerts.push(pts2[s].x, pts2[s].y, pts2[s].z, pts2[s + 1].x, pts2[s + 1].y, pts2[s + 1].z);
        lineData.push(w0 * 0.65, ht0 * 0.72, zDepth, w1 * 0.65, ht1 * 0.72, zDepth);
      }

      // Gossamer spiderweb micro-fork branching off mid-filament
      if (rng() < 0.58) {
        const forkStart = curve1.getPoint(0.28 + rng() * 0.44, new THREE.Vector3());
        const forkEnd = forkStart.clone().add(
          new THREE.Vector3(randGauss(rng), randGauss(rng), randGauss(rng)).multiplyScalar(span * 0.24)
        );
        if (!inAnyVoid(forkEnd, 0.94)) {
          lineVerts.push(forkStart.x, forkStart.y, forkStart.z, forkEnd.x, forkEnd.y, forkEnd.z);
          lineData.push(0.45, e.heat * 0.65, zDepth, 0.08, e.heat * 0.35, zDepth);
        }
      }

      // Volumetric Fire & Ice Mist Puffs along each braided filament
      const mistCount = e.heat > 0.7 ? 18 : 11;
      for (let m = 0; m < mistCount; m++) {
        const t = (m + 0.15 + rng() * 0.70) / mistCount;
        (m % 3 === 0 ? curve2 : curve1).getPoint(t, ptTmp);
        const endProx = Math.abs(t * 2.0 - 1.0);
        const puffSpread = span * (0.020 + 0.036 * endProx);
        ptTmp.x += randGauss(rng) * puffSpread;
        ptTmp.y += randGauss(rng) * puffSpread;
        ptTmp.z += randGauss(rng) * puffSpread;

        const shellScale = THREE.MathUtils.lerp(1.0, 1.55, zDepth);
        const puffSz = (e.heat > 0.7 ? 1.50 : 1.05) * (0.68 + 0.72 * endProx) * shellScale;
        const localHeat = THREE.MathUtils.clamp(THREE.MathUtils.lerp(hA, hB, t) * (0.65 + 0.45 * endProx), 0.0, 1.0);
        mistVerts.push(ptTmp.x, ptTmp.y, ptTmp.z);
        mistData.push(puffSz, localHeat, zDepth, rng());
      }

      // Crisp Filament Galaxies tracing the strands
      const galCount = e.heat > 0.7 ? 44 : 22;
      for (let g = 0; g < galCount; g++) {
        let t = rng();
        if (rng() < 0.45) {
          t = t < 0.5 ? Math.pow(t * 2.0, 1.75) * 0.5 : 1.0 - Math.pow((1.0 - t) * 2.0, 1.75) * 0.5;
        }
        (g % 3 === 0 ? curve2 : curve1).getPoint(t, ptTmp);

        const endProx = Math.abs(t * 2.0 - 1.0);
        const spread = span * (0.022 + 0.042 * endProx);
        ptTmp.x += randGauss(rng) * spread;
        ptTmp.y += randGauss(rng) * spread;
        ptTmp.z += randGauss(rng) * spread;

        const localHeat = THREE.MathUtils.lerp(hA, hB, t);
        ptVerts.push(ptTmp.x, ptTmp.y, ptTmp.z);
        ptData.push((0.75 + rng() * 0.95) * (e.heat > 0.7 ? 1.18 : 0.92), localHeat * 0.75 + endProx * 0.25, zDepth, rng());
      }
    });

    // --- PRESSED SOAP-BUBBLE VOID RIM ARCS (Creates Iconic Circular Pockets!) ---
    const uVec = new THREE.Vector3();
    const vVec = new THREE.Vector3();
    const wVec = new THREE.Vector3();
    const arcPt = new THREE.Vector3();
    const prevArcPt = new THREE.Vector3();

    voids.forEach(function (vd) {
      const zDepth = THREE.MathUtils.clamp((vd.pos.length() - 15000) / 290000, 0.0, 1.0);
      const rimR = vd.r * 1.03;
      const numArcs = vd.named ? 7 : 5;

      for (let a = 0; a < numArcs; a++) {
        // Random great-circle orientation tangent to this void sphere
        wVec.set(randGauss(rng), randGauss(rng), randGauss(rng)).normalize();
        uVec.set(1, 0, 0);
        if (Math.abs(wVec.dot(uVec)) > 0.85) uVec.set(0, 1, 0);
        uVec.cross(wVec).normalize();
        vVec.crossVectors(wVec, uVec).normalize();

        const startAng = rng() * Math.PI * 2;
        const arcSpan = Math.PI * (0.75 + rng() * 0.95);
        const arcSegs = 12;
        const arcHeat = THREE.MathUtils.clamp(vd.hotRim + (rng() - 0.45) * 0.35, 0.0, 1.0);

        for (let s = 0; s <= arcSegs; s++) {
          const f = s / arcSegs;
          const ang = startAng + f * arcSpan;
          const wobble = 1.0 + 0.055 * Math.sin(f * Math.PI * 3.0 + a);
          const rr = rimR * wobble;
          arcPt.copy(vd.pos)
            .addScaledVector(uVec, Math.cos(ang) * rr)
            .addScaledVector(vVec, Math.sin(ang) * rr)
            .addScaledVector(wVec, Math.sin(f * Math.PI * 2.0) * rimR * 0.04);

          if (s > 0) {
            const edgeFade0 = Math.sin(((s - 1) / arcSegs) * Math.PI);
            const edgeFade1 = Math.sin(f * Math.PI);
            lineVerts.push(prevArcPt.x, prevArcPt.y, prevArcPt.z, arcPt.x, arcPt.y, arcPt.z);
            lineData.push(0.25 + 0.72 * edgeFade0, arcHeat, zDepth, 0.25 + 0.72 * edgeFade1, arcHeat, zDepth);
          }

          // Mist puffs hugging the circular soap-bubble rim!
          if (s > 0 && s < arcSegs && (s % 2 === 0)) {
            mistVerts.push(
              arcPt.x + randGauss(rng) * rimR * 0.05,
              arcPt.y + randGauss(rng) * rimR * 0.05,
              arcPt.z + randGauss(rng) * rimR * 0.05
            );
            mistData.push(1.38 * THREE.MathUtils.lerp(0.95, 1.45, zDepth), arcHeat, zDepth, rng());
          }
          prevArcPt.copy(arcPt);
        }
      }
    });

    // Populate Translucent Cosmic Sheets (200 filament triangles)
    const pSheet = new THREE.Vector3();
    cosmicSheets.forEach(function (tri) {
      const A = nodes[tri[0]].pos;
      const B = nodes[tri[1]].pos;
      const C = nodes[tri[2]].pos;
      const cDist = tmpMid.copy(A).add(B).add(C).multiplyScalar(1 / 3).length();
      const zDepth = THREE.MathUtils.clamp((cDist - 15000) / 290000, 0.0, 1.0);
      const sheetHeat = (nodes[tri[0]].heat + nodes[tri[1]].heat + nodes[tri[2]].heat) / 3.0;

      for (let sm = 0; sm < 6; sm++) {
        let u = rng(), v = rng();
        if (u + v > 1.0) { u = 1.0 - u; v = 1.0 - v; }
        const w = 1.0 - u - v;
        pSheet.set(
          A.x * u + B.x * v + C.x * w + randGauss(rng) * 1600,
          A.y * u + B.y * v + C.y * w + randGauss(rng) * 1600,
          A.z * u + B.z * v + C.z * w + randGauss(rng) * 1600
        );
        mistVerts.push(pSheet.x, pSheet.y, pSheet.z);
        mistData.push(1.35 * THREE.MathUtils.lerp(0.95, 1.40, zDepth), sheetHeat * 0.65, zDepth, rng());
      }
    });

    // Populate Incandescent Supercluster Convergence Fireballs & Sapphire Nodes!
    nodes.forEach(function (nd) {
      const zDepth = THREE.MathUtils.clamp((nd.pos.length() - 15000) / 290000, 0.0, 1.0);
      const hubSpread = THREE.MathUtils.lerp(1800, 4400, zDepth);

      // Multi-layered fireball convergence glow at hot supercluster hubs!
      const isFireball = nd.heat > 0.78;
      mistVerts.push(nd.pos.x, nd.pos.y, nd.pos.z);
      mistData.push((isFireball ? 2.85 : 1.75) * THREE.MathUtils.lerp(1.0, 1.45, zDepth), Math.min(1.0, nd.heat + 0.18), zDepth, rng());

      ptVerts.push(nd.pos.x, nd.pos.y, nd.pos.z);
      ptData.push(isFireball ? 4.4 : 2.8, isFireball ? 1.0 : (0.35 + nd.heat * 0.55), zDepth, rng());

      const haloCnt = isFireball ? 16 : 8;
      for (let h = 0; h < haloCnt; h++) {
        const rr = hubSpread * Math.pow(rng(), 0.78);
        const th = rng() * Math.PI * 2;
        const ph = Math.acos(2 * rng() - 1);
        ptVerts.push(
          nd.pos.x + rr * Math.sin(ph) * Math.cos(th),
          nd.pos.y + rr * Math.cos(ph),
          nd.pos.z + rr * Math.sin(ph) * Math.sin(th)
        );
        ptData.push(1.15 + rng() * 1.15, Math.min(1.0, nd.heat * 0.85 + 0.15), zDepth, rng());
      }
    });

    // --- DRAW CALL 1: Dual-Temperature Fire & Ice Braided Tendrils + Soap-Bubble Rims ---
    const webLineGeo = new THREE.BufferGeometry();
    webLineGeo.setAttribute('position', new THREE.Float32BufferAttribute(lineVerts, 3));
    webLineGeo.setAttribute('aWebData', new THREE.Float32BufferAttribute(lineData, 3));

    cosmicWebLineMat = new THREE.ShaderMaterial({
      uniforms: {
        uSpecMode: { value: 0.0 },
        uOpacity: { value: 0.0 }
      },
      vertexShader: `
        attribute vec3 aWebData; // x=hubWeight, y=heat(0=iceBlue..1=fieryGold), z=zDepth
        varying float vHub;
        varying float vHeat;
        varying float vZ;
        void main() {
          vHub = aWebData.x;
          vHeat = aWebData.y;
          vZ = aWebData.z;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        precision mediump float;
        uniform float uSpecMode;
        uniform float uOpacity;
        varying float vHub;
        varying float vHeat;
        varying float vZ;
        void main() {
          if (uOpacity < 0.004) discard;
          float zFade = mix(1.0, 0.46, smoothstep(0.38, 1.0, vZ));
          vec3 col;
          float alpha;
          if (uSpecMode > 3.5) {
            // Radio / EHT 230 GHz: Intense burnt-orange & gold synchrotron shock bridges
            col = mix(vec3(0.75, 0.14, 0.03), vec3(1.0, 0.80, 0.28), vHub * 0.65 + vHeat * 0.35);
            alpha = (0.18 + 0.28 * vHub + 0.16 * vHeat) * uOpacity * zFade;
          } else if (uSpecMode > 2.5) {
            // Chandra X-Ray: Electric cyan-blue WHIM intergalactic gas filaments
            col = mix(vec3(0.08, 0.56, 0.98), vec3(0.88, 0.98, 1.0), vHub * 0.72 + vHeat * 0.28);
            alpha = (0.22 + 0.30 * vHub + 0.16 * vHeat) * uOpacity * zFade;
          } else if (uSpecMode > 1.5) {
            // JWST MIRI: Crimson-magenta & molten amber infrared web
            col = mix(vec3(0.62, 0.12, 0.42), vec3(1.0, 0.62, 0.18), vHeat * 0.7 + vHub * 0.3);
            alpha = (0.14 + 0.22 * vHub + 0.16 * vHeat) * uOpacity * zFade;
          } else if (uSpecMode > 0.5) {
            // JWST NIRCam: Crisp faint survey threads so galaxies dominate
            col = mix(vec3(0.32, 0.52, 0.86), vec3(1.0, 0.72, 0.36), vHeat);
            alpha = (0.06 + 0.11 * vHub + 0.08 * vHeat) * uOpacity * zFade;
          } else {
            // Optical HDR: NASA / IllustrisTNG Fire & Ice Soap-Bubble Foam!
            // Cool sapphire-blue & silver-white gossamer cobwebs vs fiery burnt-orange -> white-gold ridges!
            vec3 iceBlue = mix(vec3(0.18, 0.44, 0.96), vec3(0.76, 0.88, 1.00), smoothstep(0.15, 0.92, vHub));
            vec3 fireCore = mix(vec3(0.95, 0.34, 0.05), vec3(1.00, 0.86, 0.46), smoothstep(0.15, 0.92, vHub));
            col = mix(iceBlue, fireCore, smoothstep(0.28, 0.76, vHeat));
            alpha = (0.16 + 0.26 * vHub + 0.14 * vHeat) * uOpacity * zFade;
          }
          gl_FragColor = vec4(col, clamp(alpha, 0.0, 0.72));
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    const webLines = new THREE.LineSegments(webLineGeo, cosmicWebLineMat);
    webLines.frustumCulled = false;
    webLines.renderOrder = -14;
    cosmicWebGroup.add(webLines);

    // --- DRAW CALL 2: Volumetric Fireball & Sapphire Mist along Rims, Filaments & Hubs ---
    const webMistGeo = new THREE.BufferGeometry();
    webMistGeo.setAttribute('position', new THREE.Float32BufferAttribute(mistVerts, 3));
    webMistGeo.setAttribute('aMistData', new THREE.Float32BufferAttribute(mistData, 4));

    cosmicWebMistMat = new THREE.ShaderMaterial({
      uniforms: {
        uSpecMode: { value: 0.0 },
        uOpacity: { value: 0.0 },
        uPixelRatio: { value: currentPR },
        uLodDensity: { value: state.lodDensity },
        uMistMap: { value: textures.nebulaPuff }
      },
      vertexShader: `
        attribute vec4 aMistData; // x=size, y=heat, z=zDepth, w=seed
        uniform float uPixelRatio;
        uniform float uLodDensity;
        varying float vHeat;
        varying float vZ;
        varying float vSeed;
        varying float vLodComp;
        void main() {
          vHeat = aMistData.y;
          vZ = aMistData.z;
          vSeed = aMistData.w;

          float keep = clamp(uLodDensity * 0.92 + (vHeat > 0.78 ? 0.55 : 0.08), 0.24, 1.0);
          if (vSeed > keep) {
            gl_PointSize = 0.0;
            gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
            vLodComp = 0.0;
            return;
          }
          vLodComp = mix(1.30, 1.0, keep);

          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          float dist = max(-mvPosition.z, 800.0);
          float rawSize = aMistData.x * uPixelRatio * (1180000.0 / dist);
          float maxSz = (vHeat > 0.85 ? 64.0 : 48.0) * uPixelRatio;
          gl_PointSize = clamp(rawSize, 4.0, maxSz);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        precision mediump float;
        uniform float uSpecMode;
        uniform float uOpacity;
        uniform sampler2D uMistMap;
        varying float vHeat;
        varying float vZ;
        varying float vSeed;
        varying float vLodComp;
        void main() {
          if (uOpacity < 0.004 || vLodComp < 0.01) discard;
          vec4 tex = texture2D(uMistMap, gl_PointCoord);
          float cloud = tex.a;
          if (cloud < 0.015) discard;

          float zFade = mix(1.0, 0.48, smoothstep(0.34, 1.0, vZ));
          vec3 col;
          float alpha;

          if (uSpecMode > 3.5) {
            col = mix(vec3(0.76, 0.16, 0.03), vec3(1.0, 0.74, 0.20), vHeat);
            alpha = cloud * (0.055 + 0.10 * vHeat) * uOpacity * zFade * vLodComp;
          } else if (uSpecMode > 2.5) {
            col = mix(vec3(0.06, 0.46, 0.96), vec3(0.74, 0.95, 1.0), vHeat);
            alpha = cloud * (0.072 + 0.12 * vHeat) * uOpacity * zFade * vLodComp;
          } else if (uSpecMode > 1.5) {
            col = mix(vec3(0.58, 0.12, 0.38), vec3(1.0, 0.56, 0.18), vHeat);
            alpha = cloud * (0.048 + 0.08 * vHeat) * uOpacity * zFade * vLodComp;
          } else if (uSpecMode > 0.5) {
            col = mix(vec3(0.22, 0.42, 0.82), vec3(1.0, 0.68, 0.32), vHeat);
            alpha = cloud * (0.028 + 0.052 * vHeat) * uOpacity * zFade * vLodComp;
          } else {
            // Optical HDR: Deep sapphire blue mist vs molten amber-orange shock fireballs!
            vec3 sapphCol = vec3(0.14, 0.36, 0.88);
            vec3 amberCol = vec3(0.96, 0.42, 0.06);
            vec3 whiteGold = vec3(1.00, 0.86, 0.48);
            col = vHeat < 0.58
              ? mix(sapphCol, amberCol, smoothstep(0.24, 0.58, vHeat))
              : mix(amberCol, whiteGold, smoothstep(0.58, 0.98, vHeat));
            alpha = cloud * (0.052 + 0.105 * vHeat) * uOpacity * zFade * vLodComp;
          }

          if (alpha < 0.004) discard;
          gl_FragColor = vec4(clamp(col, vec3(0.0), vec3(1.25)), clamp(alpha, 0.0, 0.36));
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    const webMist = new THREE.Points(webMistGeo, cosmicWebMistMat);
    webMist.frustumCulled = false;
    webMist.renderOrder = -13;
    cosmicWebGroup.add(webMist);

    // --- DRAW CALL 3: Crisp Fireball Convergence Knots & Sapphire/Amber Web Galaxies ---
    const webPtGeo = new THREE.BufferGeometry();
    webPtGeo.setAttribute('position', new THREE.Float32BufferAttribute(ptVerts, 3));
    webPtGeo.setAttribute('aPointData', new THREE.Float32BufferAttribute(ptData, 4));

    cosmicWebPointMat = new THREE.ShaderMaterial({
      uniforms: {
        uSpecMode: { value: 0.0 },
        uOpacity: { value: 0.0 },
        uPixelRatio: { value: currentPR },
        uLodDensity: { value: state.lodDensity }
      },
      vertexShader: `
        attribute vec4 aPointData; // x=size, y=heatOrHub, z=zDepth, w=seed
        uniform float uPixelRatio;
        uniform float uLodDensity;
        varying float vHeat;
        varying float vZ;
        varying float vSeed;
        void main() {
          vHeat = aPointData.y;
          vZ = aPointData.z;
          vSeed = aPointData.w;

          float keep = clamp(uLodDensity + (vHeat > 0.72 ? 0.60 : 0.14), 0.24, 1.0);
          if (vSeed > keep) {
            gl_PointSize = 0.0;
            gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
            return;
          }

          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          float dist = max(-mvPosition.z, 120.0);
          float rawSize = aPointData.x * uPixelRatio * (114000.0 / dist);
          float maxSz = (vHeat > 0.92) ? 30.0 : 12.0;
          gl_PointSize = clamp(rawSize, 1.25, maxSz);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        precision mediump float;
        uniform float uSpecMode;
        uniform float uOpacity;
        varying float vHeat;
        varying float vZ;
        varying float vSeed;
        void main() {
          if (uOpacity < 0.004) discard;
          vec2 uv = gl_PointCoord - 0.5;
          float r = length(uv);
          if (r > 0.5) discard;

          float glow = exp(-r * r * 24.0) + exp(-r * 5.0) * 0.38;
          float zFade = mix(1.0, 0.58, smoothstep(0.45, 1.0, vZ));
          vec3 col;
          float gain = 1.0;

          if (uSpecMode > 3.5) {
            col = mix(vec3(0.88, 0.24, 0.05), vec3(1.0, 0.88, 0.42), vHeat);
            gain = 0.85 + 0.65 * vHeat;
          } else if (uSpecMode > 2.5) {
            col = mix(vec3(0.18, 0.72, 1.0), vec3(0.94, 0.99, 1.0), vHeat);
            gain = 0.85 + 0.55 * vHeat;
          } else if (uSpecMode > 1.5) {
            col = mix(vec3(1.0, 0.34, 0.52), vec3(1.0, 0.76, 0.28), vHeat * 0.7 + vSeed * 0.3);
            gain = 0.95 + 0.38 * vHeat;
          } else if (uSpecMode > 0.5) {
            vec3 nearG = mix(vec3(0.68, 0.88, 1.0), vec3(1.0, 0.84, 0.48), fract(vSeed * 4.7) * 0.55 + vHeat * 0.45);
            vec3 farG = vec3(1.0, 0.44, 0.26);
            col = mix(nearG, farG, vZ * 0.65);
            gain = 1.20 + 0.34 * vHeat;
          } else {
            // Optical HDR: Crisp sapphire-white stars/galaxies vs incandescent white-gold & orange supercluster fireballs!
            vec3 iceStar = mix(vec3(0.46, 0.74, 1.00), vec3(0.92, 0.96, 1.00), vSeed);
            vec3 fireStar = mix(vec3(1.00, 0.52, 0.14), vec3(1.00, 0.94, 0.72), smoothstep(0.55, 0.98, vHeat));
            col = mix(iceStar, fireStar, smoothstep(0.28, 0.80, vHeat));
            gain = 0.84 + 0.62 * vHeat;
          }

          float alpha = glow * (0.42 + 0.54 * vHeat) * uOpacity * zFade;
          if (alpha < 0.01) discard;
          gl_FragColor = vec4(clamp(col * gain, vec3(0.0), vec3(1.95)), clamp(alpha, 0.0, 0.94));
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
    const primCone = createRelativisticJet(96, 0xff5e3a, { hasLobes: true, intensity: 1.12, flowSpeed: 1.75 });
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
    const SHEET_COUNT = 12000;
    const DEEP_COUNT = 37850;
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
    const cSpiralBlue = new THREE.Color(0x7ab8ff);
    const cSpiralWhite = new THREE.Color(0xeef4ff);
    const cEdgeWarm = new THREE.Color(0xffcf8a);
    const cEllipGold = new THREE.Color(0xffba63);
    const cDwarfCyan = new THREE.Color(0x38e2d8);
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

    // --- LAYER C: 37,850 Deep-Field Universe Galaxies (20,000 – 295,000 units) ---
    // Pre-generate 44 deep-field sheet attractors across the 3x observable volume!
    const deepClumps = [];
    for (let c = 0; c < 44; c++) {
      const r = 32000 + rng() * 235000;
      const th = rng() * Math.PI * 2;
      const ph = Math.acos(2 * rng() - 1);
      const cp = new THREE.Vector3(r * Math.sin(ph) * Math.cos(th), r * Math.cos(ph), r * Math.sin(ph) * Math.sin(th));
      if (!inCosmicVoid(cp, 1.05)) deepClumps.push(cp);
    }

    let deepMade = 0;
    let deepAtt = 0;
    while (deepMade < DEEP_COUNT && deepAtt < DEEP_COUNT * 4) {
      deepAtt++;
      if (rng() < 0.44 && deepClumps.length > 0) {
        const cp = deepClumps[Math.floor(rng() * deepClumps.length)];
        const spread = 9500 + rng() * 28000;
        tmpVec.set(
          cp.x + randGauss(rng) * spread,
          cp.y + randGauss(rng) * spread,
          cp.z + randGauss(rng) * spread
        );
      } else {
        const r = 20000 + Math.pow(rng(), 0.80) * 275000;
        const th = rng() * Math.PI * 2;
        const ph = Math.acos(2 * rng() - 1);
        tmpVec.set(r * Math.sin(ph) * Math.cos(th), r * Math.cos(ph), r * Math.sin(ph) * Math.sin(th));
      }

      const dOrigin = tmpVec.length();
      if (dOrigin < 19500 || dOrigin > 296000) continue;
      // Carve out all 24 Cosmic Web supervoids (Boötes Void, Eridanus Supervoid, etc.)!
      if (inCosmicVoid(tmpVec, 0.96)) continue;

      const zShift = THREE.MathUtils.clamp((dOrigin - 18000) / 275000, 0.14, 1.0);
      const tile = pickTileAndColor('field', zShift);
      const sizeScale = 260.0 + Math.pow((dOrigin - 18000) / 275000, 0.95) * 3400.0;
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
  // 10E. v7 DEEP-UNIVERSE EPOCHS (115k–285k) + EHT POLARIZED B-FIELD SWIRLS
  //      * Cosmic Noon: TON 618 (z=2.22), QSO J0529-4351 (z=3.96) & 180 Quasars
  //      * Early Reionization: Nāpōwawāʻenakaulua (J1602+4228AB, z=6.08, Nov 2026)
  //        & Blazar J0410-0139 (z=7.0) + UV/Cyan Reionization Bubbles
  //      * EHT Polarized B-Field Swirls on Sagittarius A* & M87*
  // -------------------------------------------------------------------------
  const v7DeepGroup = new THREE.Group();
  v7DeepGroup.visible = false;
  scene.add(v7DeepGroup);

  const reionGroup = new THREE.Group();
  reionGroup.visible = false;
  scene.add(reionGroup);

  const quasarFieldGroup = new THREE.Group();
  quasarFieldGroup.visible = false;
  scene.add(quasarFieldGroup);

  const ehtBFieldEntries = [];

  const TON618_POS = new THREE.Vector3(92000, 58000, -78000);
  const J0529_POS = new THREE.Vector3(-118000, -64000, -92000);
  const NAPO_POS = new THREE.Vector3(138000, 102000, 126000);
  const J0410_POS = new THREE.Vector3(-145000, 96000, 148000);

  let ton618Group = null;
  let j0529Group = null;
  let napoGroup = null;
  let j0410Group = null;
  let quasarFieldMat = null;
  const reionMaterials = [];

  const V7_LANDMARKS = [
    {
      id: 'ton618',
      label: 'TON 618',
      title: 'TON 618 (Hyperluminous Quasar)',
      badge: 'Cosmic Noon • Ultramassive BH',
      cls: '40.7 – 66 Billion M☉ • z = 2.219',
      radius: '10.8 Bly Light-Travel (18.2 Bly Comoving)',
      vel: '140 Trillion L☉ • 100 kpc Lyα Halo',
      sector: 'Canes Venatici • Cosmic Noon',
      target: [92000, 58000, -78000],
      camPos: [92150, 58095, -77740],
      desc: 'One of the most massive black holes ever measured—powering a hyperluminous quasar inside an enormous 100-kiloparsec glowing Lyman-alpha gas cloud during Cosmic Noon.'
    },
    {
      id: 'j0529',
      label: 'QSO J0529-4351',
      title: 'QSO J0529−4351 (Most Luminous Object)',
      badge: 'Cosmic Noon • 500 Trillion L☉',
      cls: 'z = 3.962 • 7-ly Accretion Disk',
      radius: '~12.0 Bly Light-Travel (~23.8 Bly Comoving)',
      vel: 'Rapid Outflow • Revised ~1B M☉ (2025)',
      sector: 'Pictor • Deep Cosmic Noon',
      target: [-118000, -64000, -92000],
      camPos: [-117790, -63890, -91730],
      desc: 'The most luminous single object ever observed at ~500 trillion times the Sun’s brightness. September 2025 follow-up revealed ~1 billion M☉ driving blistering, non-rotating super-Eddington gas outflows.'
    },
    {
      id: 'napowawa',
      label: 'Nāpōwawāʻenakaulua',
      title: 'Nāpōwawāʻenakaulua (J1602+4228AB)',
      badge: 'JWST + Gemini North • Nov 2026 Record',
      cls: 'Oldest Compact Quasar Pair • z ≈ 6.08',
      radius: '18,100 ly Separation (~900 Myr post-BB)',
      vel: 'Twin Active SMBHs at Cosmic Dawn',
      sector: 'Epoch of Reionization',
      target: [138000, 102000, 126000],
      camPos: [138110, 102068, 126145],
      desc: 'Announced November 2026 via JWST and Gemini North: the most distant compact quasar pair ever identified—two monster feeding black holes separated by just one-fifth the Milky Way’s width inside a shared reionization bubble.'
    },
    {
      id: 'j0410',
      label: 'Blazar J0410−0139',
      title: 'VLASS J0410−0139 (Most Distant Blazar)',
      badge: 'Cosmic Dawn Blazar • z = 7.0',
      cls: '700 Million M☉ • Earth-Aimed Jet',
      radius: '< 800 Myr After the Big Bang',
      vel: 'Relativistic Jet Pointed at Milky Way',
      sector: 'Epoch of Reionization',
      target: [-145000, 96000, 148000],
      camPos: [-144845, 96075, 147815],
      desc: 'The earliest and most distant blazar ever discovered (redshift z = 7.0)—a 700-million-solar-mass black hole firing a relativistic jet aimed straight toward our galaxy less than 800 million years after the Big Bang.'
    }
  ];

  function registerV7CatalogAndRescaleDawn() {
    // Rescale existing Cosmic Dawn objects (MoM-z14, JADES-GS-z14-0) into the 3x 235k–275k frontier!
    const DAWN_SCALE = 2.85;
    if (Array.isArray(CAT.COSMIC_DAWN)) {
      CAT.COSMIC_DAWN.forEach(function (cd) {
        if (!cd._v7Scaled) {
          cd.pos = [cd.pos[0] * DAWN_SCALE, cd.pos[1] * DAWN_SCALE, cd.pos[2] * DAWN_SCALE];
          cd._v7Scaled = true;
        }
        const lk = CAT.INSPECTOR_LOOKUP[cd.id];
        if (lk) {
          lk.target = [cd.pos[0], cd.pos[1], cd.pos[2]];
          lk.camPos = [cd.pos[0] * 0.90, cd.pos[1] * 0.90 + 1800, cd.pos[2] * 0.90];
        }
      });
    }

    // Update Planck CMB Horizon preset camera for the expanded 350,000-unit Observable Universe!
    if (CAT.INSPECTOR_LOOKUP.horizon) {
      CAT.INSPECTOR_LOOKUP.horizon.camPos = [-135000, 112000, 245000];
      CAT.INSPECTOR_LOOKUP.horizon.target = [0, 0, 0];
      CAT.INSPECTOR_LOOKUP.horizon.radius = '93 Billion ly Diameter (350k Scene Radius)';
    }

    V7_LANDMARKS.forEach(function (lm) {
      CAT.INSPECTOR_LOOKUP[lm.id] = lm;
      if (CAT.DIRECTORY_TABS.cosmic && !CAT.DIRECTORY_TABS.cosmic.some(function (it) { return it.id === lm.id; })) {
        const hIdx = CAT.DIRECTORY_TABS.cosmic.findIndex(function (it) { return it.id === 'horizon'; });
        const entry = { id: lm.id, label: lm.label };
        if (hIdx >= 0) {
          CAT.DIRECTORY_TABS.cosmic.splice(hIdx, 0, entry);
        } else {
          CAT.DIRECTORY_TABS.cosmic.push(entry);
        }
      }
    });
  }

  // 1. EHT Polarized Magnetic Field (B-Field) Swirls around Sagittarius A* & M87*
  function buildEhtBFields() {
    CAT.BLACK_HOLES.forEach(function (bh) {
      const isM87 = bh.id.toLowerCase().indexOf('m87') !== -1;
      if (bh.id !== 'sgra' && !isM87) return;


      const swGroup = new THREE.Group();
      swGroup.position.set(bh.pos[0], bh.pos[1], bh.pos[2]);
      swGroup.rotation.set(bh.tilt[0], bh.tilt[1], bh.tilt[2]);
      scene.add(swGroup);

      const R = bh.sphereRadius;
      const numArms = 24;
      const steps = 18;
      const verts = [];
      const cols = [];
      const cInner = new THREE.Color(0xfff4c2);
      const cOuter = new THREE.Color(isM87 ? 0x60a5fa : 0xf59e0b);
      const dirSign = isM87 ? -1.0 : 1.0;

      // Spiraling polarization tick curves matching EHT 2021/2024/2025 polarized ring maps
      for (let a = 0; a < numArms; a++) {
        const baseTheta = (a / numArms) * Math.PI * 2;
        const elevBias = ((a % 3) - 1) * 0.045 * R;
        for (let s = 0; s < steps; s++) {
          const t0 = s / steps;
          const t1 = (s + 1) / steps;
          const r0 = R * (0.17 + 0.68 * t0);
          const r1 = R * (0.17 + 0.68 * t1);
          const th0 = baseTheta + dirSign * (1.85 * Math.log(1.0 + t0 * 3.2));
          const th1 = baseTheta + dirSign * (1.85 * Math.log(1.0 + t1 * 3.2));

          const y0 = Math.sin(t0 * Math.PI) * elevBias;
          const y1 = Math.sin(t1 * Math.PI) * elevBias;

          verts.push(
            Math.cos(th0) * r0, y0, Math.sin(th0) * r0,
            Math.cos(th1) * r1, y1, Math.sin(th1) * r1
          );
          const c0 = cInner.clone().lerp(cOuter, t0);
          const c1 = cInner.clone().lerp(cOuter, t1);
          cols.push(c0.r, c0.g, c0.b, c1.r, c1.g, c1.b);
        }
      }

      // Helical poloidal field lines rising along the black hole spin axis
      for (let h = 0; h < 6; h++) {
        const hPhase = (h / 6) * Math.PI * 2;
        for (let signY = -1; signY <= 1; signY += 2) {
          for (let s = 0; s < 14; s++) {
            const t0 = s / 14;
            const t1 = (s + 1) / 14;
            const rad0 = R * (0.16 + 0.24 * t0);
            const rad1 = R * (0.16 + 0.24 * t1);
            const ang0 = hPhase + dirSign * t0 * Math.PI * 2.2;
            const ang1 = hPhase + dirSign * t1 * Math.PI * 2.2;
            const y0 = signY * R * (0.14 + t0 * (isM87 ? 1.85 : 0.95));
            const y1 = signY * R * (0.14 + t1 * (isM87 ? 1.85 : 0.95));
            verts.push(
              Math.cos(ang0) * rad0, y0, Math.sin(ang0) * rad0,
              Math.cos(ang1) * rad1, y1, Math.sin(ang1) * rad1
            );
            const cc = cOuter.clone().lerp(cInner, 0.35);
            cols.push(cc.r, cc.g, cc.b, cc.r, cc.g, cc.b);
          }
        }
      }

      const bGeo = new THREE.BufferGeometry();
      bGeo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
      bGeo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
      const bMat = new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.26,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      const bLines = new THREE.LineSegments(bGeo, bMat);
      bLines.renderOrder = 6;
      swGroup.add(bLines);

      ehtBFieldEntries.push({
        id: bh.id,
        group: swGroup,
        lines: bLines,
        mat: bMat,
        worldPos: new THREE.Vector3(bh.pos[0], bh.pos[1], bh.pos[2]),
        maxDist: R * 38,
        dirSign: dirSign
      });
    });
  }

  // 2. Cosmic Noon & Early Reionization Showpieces (TON 618, J0529, Nāpōwawāʻenakaulua, J0410)
  function buildV7DeepUniverse() {
    const rng = makeRng(20261112);
    const unitSphereGeo = new THREE.SphereGeometry(1.0, 32, 22);

    // --- A. TON 618 (Ultramassive BH + Relativistic Jet + 100 kpc Lyman-alpha Halo) ---
    ton618Group = new THREE.Group();
    ton618Group.position.copy(TON618_POS);
    v7DeepGroup.add(ton618Group);

    const tonMat = SHADERS.createGargantuaMaterial({
      spin: 0.88,
      diskTint: 0x93c5fd,
      brightness: 1.45
    });
    const tonMesh = new THREE.Mesh(unitSphereGeo, tonMat);
    tonMesh.position.copy(TON618_POS);
    tonMesh.rotation.set(0.28, 0.4, -0.18);
    tonMesh.scale.setScalar(62);
    tonMesh.renderOrder = 5;
    bhGroup.add(tonMesh);
    blackHoleEntries.push({
      data: { id: 'ton618', shortName: 'TON 618', sphereRadius: 62 },
      worldPos: TON618_POS.clone(),
      maxActiveDist: 62 * 48,
      mesh: tonMesh,
      mat: tonMat
    });

    const tonJet = createRelativisticJet(390, 0x60a5fa, { hasLobes: true, intensity: 1.25, flowSpeed: 1.55 });
    tonJet.rotation.set(0.28, 0.4, -0.18);
    ton618Group.add(tonJet);

    // Volumetric GLSL 100 kpc Lyman-alpha nebula halo surrounding TON 618
    if (typeof SHADERS.createQuasarOutflowMaterial === 'function') {
      const lyaMat = SHADERS.createQuasarOutflowMaterial({
        innerColor: 0xbae6fd,
        outerColor: 0x6366f1,
        opacity: 0.46
      });
      quasarOutflowMaterials.push(lyaMat);
      const lyaMesh = new THREE.Mesh(new THREE.SphereGeometry(185, 28, 20), lyaMat);
      lyaMesh.renderOrder = 3;
      ton618Group.add(lyaMesh);
    }

    // Subtle dusty equatorial molecular torus glow around TON 618
    const tonTorus = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: textures.galaxyGlow || textures.nebulaPuff,
        color: 0xf59e0b,
        transparent: true,
        opacity: 0.32,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    tonTorus.scale.set(220, 120, 1);
    ton618Group.add(tonTorus);

    // --- B. QSO J0529-4351 (Most Luminous Object: 500T L☉ + Volumetric Super-Eddington Wind) ---
    j0529Group = new THREE.Group();
    j0529Group.position.copy(J0529_POS);
    v7DeepGroup.add(j0529Group);

    const j0529Mat = SHADERS.createGargantuaMaterial({
      spin: 0.94,
      diskTint: 0xffe4b5,
      brightness: 1.55
    });
    const j0529Mesh = new THREE.Mesh(unitSphereGeo, j0529Mat);
    j0529Mesh.position.copy(J0529_POS);
    j0529Mesh.rotation.set(-0.22, 0.3, 0.24);
    j0529Mesh.scale.setScalar(70);
    j0529Mesh.renderOrder = 5;
    bhGroup.add(j0529Mesh);
    blackHoleEntries.push({
      data: { id: 'j0529', shortName: 'J0529-4351', sphereRadius: 70 },
      worldPos: J0529_POS.clone(),
      maxActiveDist: 70 * 48,
      mesh: j0529Mesh,
      mat: j0529Mat
    });

    // Subtle blazing radiation corona (no harsh wireframe!)
    const j0529CoreSp = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: textures.jwstSpike,
        color: 0xfffbeb,
        transparent: true,
        opacity: 0.55,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    j0529CoreSp.scale.setScalar(210);
    j0529Group.add(j0529CoreSp);

    // Volumetric GLSL Super-Eddington Rapid Non-Rotating Outflow Wind (Sept 2025 VLT observations!)
    if (typeof SHADERS.createQuasarOutflowMaterial === 'function') {
      const windMat1 = SHADERS.createQuasarOutflowMaterial({
        innerColor: 0xfffbeb,
        outerColor: 0xf59e0b,
        opacity: 0.62
      });
      quasarOutflowMaterials.push(windMat1);
      const windInner = new THREE.Mesh(new THREE.SphereGeometry(132, 30, 22), windMat1);
      windInner.renderOrder = 3;
      j0529Group.add(windInner);

      const windMat2 = SHADERS.createQuasarOutflowMaterial({
        innerColor: 0xfde68a,
        outerColor: 0xea580c,
        opacity: 0.34
      });
      quasarOutflowMaterials.push(windMat2);
      const windOuter = new THREE.Mesh(new THREE.SphereGeometry(195, 28, 20), windMat2);
      windOuter.renderOrder = 2;
      j0529Group.add(windOuter);
    }

    // Soft bipolar radiation-pressure outflow cones (quasar wind, gentler than a radio-loud jet)
    const j0529WindJet = createRelativisticJet(245, 0xfbbf24, { hasLobes: false, intensity: 0.58, flowSpeed: 2.1 });
    j0529WindJet.rotation.set(-0.22, 0.3, 0.24);
    j0529Group.add(j0529WindJet);

    // --- C. Nāpōwawāʻenakaulua (J1602+4228AB — Twin Ray-Marched Gargantua Quasars!) ---
    napoGroup = new THREE.Group();
    napoGroup.position.copy(NAPO_POS);
    v7DeepGroup.add(napoGroup);

    // Twin supermassive black hole quasars separated by ~18,100 ly (~56 scene units)
    [
      { id: 'napoA', off: [-28, 6, -12], rBH: 24, tilt: [0.45, 0.2, 0.35], col: 0x93c5fd, jetLen: 185 },
      { id: 'napoB', off: [28, -6, 12],  rBH: 17, tilt: [-0.55, 0.2, -0.4], col: 0xfbbf24, jetLen: 140 }
    ].forEach(function (q, idx) {
      const worldQ = new THREE.Vector3(NAPO_POS.x + q.off[0], NAPO_POS.y + q.off[1], NAPO_POS.z + q.off[2]);

      // Real distance-culled Gargantua ray-marched accretion core for each twin quasar!
      const qMat = SHADERS.createGargantuaMaterial({
        spin: idx === 0 ? 0.90 : 0.84,
        diskTint: q.col,
        brightness: 1.42
      });
      const qMesh = new THREE.Mesh(unitSphereGeo, qMat);
      qMesh.position.copy(worldQ);
      qMesh.rotation.set(q.tilt[0], q.tilt[1], q.tilt[2]);
      qMesh.scale.setScalar(q.rBH);
      qMesh.renderOrder = 5;
      bhGroup.add(qMesh);
      blackHoleEntries.push({
        data: { id: q.id, shortName: q.id, sphereRadius: q.rBH },
        worldPos: worldQ,
        maxActiveDist: q.rBH * 48,
        mesh: qMesh,
        mat: qMat
      });

      const qHalo = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: textures.nebulaPuff,
          color: idx === 0 ? 0x38bdf8 : 0xf472b6,
          transparent: true,
          opacity: 0.36,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        })
      );
      qHalo.position.set(q.off[0], q.off[1], q.off[2]);
      qHalo.scale.setScalar(q.rBH * 4.8);
      napoGroup.add(qHalo);

      const qJet = createRelativisticJet(q.jetLen, q.col, { hasLobes: true, intensity: 1.15, flowSpeed: 1.6 });
      qJet.position.set(q.off[0], q.off[1], q.off[2]);
      qJet.rotation.set(q.tilt[0], q.tilt[1], q.tilt[2]);
      napoGroup.add(qJet);
    });

    // 650-particle luminous ionized tidal gas & star bridge connecting the merging host galaxies!
    const bridgeCountN = 650;
    const bPos = new Float32Array(bridgeCountN * 3);
    const bCol = new Float32Array(bridgeCountN * 3);
    const bCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-28, 6, -12),
      new THREE.Vector3(-8, 13, 3),
      new THREE.Vector3(10, 4, 8),
      new THREE.Vector3(28, -6, 12)
    ]);
    const bTmp = new THREE.Vector3();
    const cN1 = new THREE.Color(0x93c5fd);
    const cN2 = new THREE.Color(0xfde68a);
    for (let bi = 0; bi < bridgeCountN; bi++) {
      const t = rng();
      bCurve.getPoint(t, bTmp);
      const sp = 5.5 + Math.sin(t * Math.PI) * 8.5;
      bPos[bi * 3] = bTmp.x + randGauss(rng) * sp;
      bPos[bi * 3 + 1] = bTmp.y + randGauss(rng) * sp * 0.7;
      bPos[bi * 3 + 2] = bTmp.z + randGauss(rng) * sp;
      const cc = cN1.clone().lerp(cN2, t);
      bCol[bi * 3] = cc.r;
      bCol[bi * 3 + 1] = cc.g;
      bCol[bi * 3 + 2] = cc.b;
    }
    const bGeo = new THREE.BufferGeometry();
    bGeo.setAttribute('position', new THREE.BufferAttribute(bPos, 3));
    bGeo.setAttribute('color', new THREE.BufferAttribute(bCol, 3));
    napoGroup.add(
      new THREE.Points(
        bGeo,
        new THREE.PointsMaterial({
          size: 3.4,
          map: textures.starGlow,
          vertexColors: true,
          transparent: true,
          opacity: 0.78,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        })
      )
    );

    // --- D. Blazar J0410−0139 (z = 7.0 Real Gargantua Core + Earth-Aimed Volumetric Blazar Jet!) ---
    j0410Group = new THREE.Group();
    j0410Group.position.copy(J0410_POS);
    v7DeepGroup.add(j0410Group);

    const j0410Mat = SHADERS.createGargantuaMaterial({
      spin: 0.95,
      diskTint: 0xfb923c,
      brightness: 1.50
    });
    const j0410Mesh = new THREE.Mesh(unitSphereGeo, j0410Mat);
    j0410Mesh.position.copy(J0410_POS);
    j0410Mesh.scale.setScalar(42);
    j0410Mesh.renderOrder = 5;
    bhGroup.add(j0410Mesh);
    blackHoleEntries.push({
      data: { id: 'j0410', shortName: 'J0410-0139', sphereRadius: 42 },
      worldPos: J0410_POS.clone(),
      maxActiveDist: 42 * 48,
      mesh: j0410Mesh,
      mat: j0410Mat
    });

    // Aim both the black hole spin axis & relativistic blazar jet straight toward our Milky Way at (0, 0, 0)!
    const aimPivot = new THREE.Group();
    j0410Group.add(aimPivot);
    j0410Group.updateMatrixWorld(true);
    aimPivot.lookAt(0, 0, 0);
    // Align Gargantua accretion disk perpendicular to the Earth-aimed blazar jet
    j0410Mesh.quaternion.copy(aimPivot.quaternion);
    j0410Mesh.rotateX(Math.PI * 0.5);

    const blazarJet = createRelativisticJet(540, 0xf97316, { hasLobes: true, intensity: 1.38, flowSpeed: 2.0 });
    blazarJet.rotation.x = Math.PI * 0.5; // Align jet +Y axis along aimPivot +Z (toward origin)
    aimPivot.add(blazarJet);

    // Blazing Doppler-beamed blazar synchrotron core halo
    const bCore = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: textures.jwstSpike,
        color: 0xfef3c7,
        transparent: true,
        opacity: 0.65,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    bCore.scale.setScalar(155);
    j0410Group.add(bCore);

    // --- E. ~180 Cosmic Noon Background Quasars (115k – 195k units, 1 Draw Call) ---
    const qCount = 180;
    const qPos = new Float32Array(qCount * 3);
    const qCol = new Float32Array(qCount * 3);
    const qPalette = [
      new THREE.Color(0x93c5fd),
      new THREE.Color(0xe0f2fe),
      new THREE.Color(0xfde68a),
      new THREE.Color(0xc4b5fd)
    ];

    for (let i = 0; i < qCount; i++) {
      const r = 115000 + rng() * 82000;
      const th = rng() * Math.PI * 2;
      const ph = Math.acos(2 * rng() - 1);
      qPos[i * 3] = r * Math.sin(ph) * Math.cos(th);
      qPos[i * 3 + 1] = r * Math.cos(ph);
      qPos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
      const cc = qPalette[Math.floor(rng() * qPalette.length)];
      qCol[i * 3] = cc.r;
      qCol[i * 3 + 1] = cc.g;
      qCol[i * 3 + 2] = cc.b;
    }

    const qGeo = new THREE.BufferGeometry();
    qGeo.setAttribute('position', new THREE.BufferAttribute(qPos, 3));
    qGeo.setAttribute('color', new THREE.BufferAttribute(qCol, 3));
    quasarFieldMat = new THREE.PointsMaterial({
      size: 2600,
      map: textures.jwstSpike,
      vertexColors: true,
      transparent: true,
      opacity: 0.78,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const qPts = new THREE.Points(qGeo, quasarFieldMat);
    qPts.frustumCulled = false;
    quasarFieldGroup.add(qPts);

    // --- F. Epoch of Reionization Ionized UV/Cyan Bubbles (around MoM-z14, Nāpōwawāʻenakaulua, J0410 & Dawn) ---
    const bubbleAnchors = [
      { pos: NAPO_POS, rad: 16500 },
      { pos: J0410_POS, rad: 15000 }
    ];
    if (Array.isArray(CAT.COSMIC_DAWN)) {
      CAT.COSMIC_DAWN.forEach(function (cd) {
        bubbleAnchors.push({ pos: new THREE.Vector3(cd.pos[0], cd.pos[1], cd.pos[2]), rad: 19500 });
      });
    }
    for (let b = 0; b < 10; b++) {
      const r = 235000 + rng() * 48000;
      const th = rng() * Math.PI * 2;
      const ph = Math.acos(2 * rng() - 1);
      bubbleAnchors.push({
        pos: new THREE.Vector3(r * Math.sin(ph) * Math.cos(th), r * Math.cos(ph), r * Math.sin(ph) * Math.sin(th)),
        rad: 13500 + rng() * 11000
      });
    }

    const bubbleGeo = new THREE.SphereGeometry(1.0, 20, 14);
    bubbleAnchors.forEach(function (ba) {
      const bMat = new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.065,
        wireframe: false,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide
      });
      const bMesh = new THREE.Mesh(bubbleGeo, bMat);
      bMesh.position.copy(ba.pos);
      bMesh.scale.setScalar(ba.rad);
      bMesh.renderOrder = -18;
      reionGroup.add(bMesh);
      reionMaterials.push(bMat);

      const rimMat = new THREE.MeshBasicMaterial({
        color: 0x7dd3fc,
        wireframe: true,
        transparent: true,
        opacity: 0.055,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      const rimMesh = new THREE.Mesh(bubbleGeo, rimMat);
      rimMesh.position.copy(ba.pos);
      rimMesh.scale.setScalar(ba.rad * 1.02);
      rimMesh.renderOrder = -17;
      reionGroup.add(rimMesh);
      reionMaterials.push(rimMat);
    });
  }

  // -------------------------------------------------------------------------
  // 10F. HEAVIER CLUMPY 3D BLACK-HOLE DUSTY TORI (Distance-Culled: Max 1 Active!)
  //      Sublimation cavity + polar jet funnels + camera fly-through clearing
  // -------------------------------------------------------------------------
  const bhDustTorusEntries = [];

  function buildBHDustToruses() {
    if (typeof SHADERS.createBHDustTorusMaterial !== 'function') return;
    const rng = makeRng(20269911);

    blackHoleEntries.forEach(function (entry) {
      const R = (entry.data && entry.data.sphereRadius) ? entry.data.sphereRadius : 2.35;
      const isSgrA = entry.data && entry.data.id === 'sgra';
      const count = isSgrA ? 240 : 185;

      const pos = new Float32Array(count * 3);
      const tData = new Float32Array(count * 4); // x=omega, y=size, z=innerRimWeight, w=seed

      // Sublimation cavity leaves accretion disk & photon ring clear while surrounding it heavily!
      const rIn = R * (isSgrA ? 1.12 : 1.18);
      const rOut = R * (isSgrA ? 3.25 : 3.45);

      for (let i = 0; i < count; i++) {
        const u = Math.pow(rng(), 0.78);
        const rad = THREE.MathUtils.lerp(rIn, rOut, u);
        // Leave slight organic clumpy gaps around azimuth so glowing arches peek through dramatically!
        const clumpAngle = Math.floor(rng() * 6) * (Math.PI / 3) + randGauss(rng) * 0.42;
        const az = rng() < 0.62 ? clumpAngle : rng() * Math.PI * 2;

        // Flared equatorial torus: thin near sublimation edge, thicker outward, polar funnels open for jets!
        const maxH = rad * (0.24 + 0.28 * u);
        const y = randGauss(rng) * maxH * 0.55;

        pos[i * 3] = Math.cos(az) * rad;
        pos[i * 3 + 1] = y;
        pos[i * 3 + 2] = Math.sin(az) * rad;

        const innerWeight = 1.0 - THREE.MathUtils.smoothstep(u, 0.0, 0.52);
        const omega = (0.14 + rng() * 0.08) / Math.pow(rad / R, 0.85);
        const puffSize = R * (0.42 + u * 0.65 + rng() * 0.35);

        tData[i * 4] = omega;
        tData[i * 4 + 1] = puffSize;
        tData[i * 4 + 2] = innerWeight;
        tData[i * 4 + 3] = rng();
      }

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('aTorusData', new THREE.BufferAttribute(tData, 4));

      const mat = SHADERS.createBHDustTorusMaterial(textures.dustAtlas || textures.dustCloud, {
        rimColor: isSgrA ? 0xff943d : 0xff7b29,
        clearNear: R * 0.35,
        clearFar: R * 1.45
      });
      mat.uniforms.uPixelRatio.value = currentPR;

      const pts = new THREE.Points(geo, mat);
      pts.position.copy(entry.worldPos);
      pts.quaternion.copy(entry.mesh.quaternion);
      pts.frustumCulled = false;
      pts.visible = false;
      pts.renderOrder = 6; // Draws over Gargantua back-side sphere to realistically veil it!
      bhGroup.add(pts);

      bhDustTorusEntries.push({
        bhEntry: entry,
        points: pts,
        mat: mat,
        maxActiveDist: R * 38
      });
    });
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
    cmbDomeMesh = new THREE.Mesh(new THREE.SphereGeometry(350000, 56, 36), cmbMat);
    cmbDomeMesh.renderOrder = -50;
    cmbDomeMesh.visible = false;
    scene.add(cmbDomeMesh);

    const skyCount = 2600;
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
      const r = 310000 + rng() * 28000;
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
      size: 1350,
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

    const lrdCount = 48 + CAT.COSMIC_DAWN.length;
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
      const r = 235000 + rng() * 52000;
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
      size: 4600,
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
      dynamicSStar: opts.dynamicSStar || null,
      dynamicPlanet: opts.dynamicPlanet || null
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
        text: st.isSol ? 'Solar System' : st.name.split(' (')[0],
        meta: st.isSol ? 'Home • 8 Planets • 8.18 kpc' : null,
        pos: [st.pos[0], st.pos[1] + (st.isSol ? 0.55 : 0.75), st.pos[2]],
        cssClass: st.isSol ? 'label-sun' : 'label-star',
        minDist: st.isSol ? 2.4 : 0.9,
        maxDist: st.isSol ? 240 : 120
      });
    });

    // Live clickable labels for all 8 Solar System planets (visible when zoomed into Solar System!)
    solarPlanetEntries.forEach(function (pe) {
      registerLabel({
        id: pe.def.id,
        text: pe.def.name,
        meta: pe.def.radiusTxt.split(' (')[0],
        pos: [SOL_POS.x, SOL_POS.y, SOL_POS.z],
        cssClass: pe.def.id === 'earth' ? 'label-sun' : 'label-star',
        minDist: 0.08,
        maxDist: 14.5,
        dynamicPlanet: pe
      });
    });

    // Labels for the 5 new NASA Emission Nebulae
    EXTRA_NASA_NEBULAE.forEach(function (en) {
      registerLabel({
        id: en.id,
        text: en.name.split(' (')[0],
        meta: en.badge.split(' • ')[1] || null,
        pos: [en.pos[0], en.pos[1] + en.radius * 0.72, en.pos[2]],
        cssClass: 'label-nebula',
        minDist: 1.5,
        maxDist: en.id === 'tarantula' ? 320 : 150
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
        minDist: 1000,
        maxDist: 380000,
        minCamOrigin: 45000
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
        maxDist: 340000,
        minCamOrigin: 9500
      });
    });

    // v7 Cosmic Noon & Early Reionization Landmarks
    V7_LANDMARKS.forEach(function (lm) {
      registerLabel({
        id: lm.id,
        text: lm.label,
        meta: lm.cls.split(' • ')[0],
        pos: [lm.target[0], lm.target[1] + 220, lm.target[2]],
        cssClass: lm.id === 'ton618' || lm.id === 'j0529' ? 'label-bh' : 'label-cosmic',
        minDist: 0,
        maxDist: 380000,
        minCamOrigin: 28000
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
    if (!state.showLabels || state.photoMode) {
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
      if (lb.dynamicPlanet) {
        if (!solarSystemGroup.visible) {
          lb.el.style.display = 'none';
          continue;
        }
        lb.pos.copy(lb.dynamicPlanet.worldPos);
        lb.pos.y += lb.dynamicPlanet.def.radius * 1.9 + 0.04;
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

    activeFollowPlanet = null;
    flight.fromCam.copy(camera.position);
    flight.fromTarget.copy(controls.target);
    if (item.isSolarPlanet && solarPlanetMap[id]) {
      const pe = solarPlanetMap[id];
      solarSystemGroup.visible = true;
      updateSolarSystem(state.time);
      const offDist = Math.max(0.24, pe.def.radius * 5.4);
      flight.toTarget.copy(pe.worldPos);
      flight.toCam.set(pe.worldPos.x + offDist * 0.72, pe.worldPos.y + offDist * 0.45, pe.worldPos.z + offDist);
      activeFollowPlanet = pe;
    } else {
      flight.toCam.set(item.camPos[0], item.camPos[1], item.camPos[2]);
      flight.toTarget.set(item.target[0], item.target[1], item.target[2]);
    }
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
    if (cosmicWebMistMat) {
      cosmicWebMistMat.uniforms.uPixelRatio.value = currentPR;
      cosmicWebMistMat.uniforms.uLodDensity.value = cfg.lod;
    }
    if (batchedNebulaMat) {
      batchedNebulaMat.uniforms.uPixelRatio.value = currentPR;
      batchedNebulaMat.uniforms.uLodDensity.value = cfg.lod;
    }
    for (let bt = 0; bt < bhDustTorusEntries.length; bt++) {
      bhDustTorusEntries[bt].mat.uniforms.uPixelRatio.value = currentPR;
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
    if (cosmicWebMistMat) cosmicWebMistMat.uniforms.uSpecMode.value = cfg.num;
    if (cosmicWebPointMat) cosmicWebPointMat.uniforms.uSpecMode.value = cfg.num;
    if (einsteinRingMat) einsteinRingMat.uniforms.uSpecMode.value = cfg.num;
    if (fieldGalaxyMat) fieldGalaxyMat.uniforms.uSpecMode.value = cfg.num;
    if (batchedNebulaMat) batchedNebulaMat.uniforms.uSpecMode.value = cfg.num;
    for (let sm = 0; sm < star3DMaterials.length; sm++) {
      star3DMaterials[sm].uniforms.uSpecMode.value = cfg.num;
    }
    const torusBlend = (modeKey === 'miri' || modeKey === 'radio') ? THREE.AdditiveBlending : THREE.NormalBlending;
    for (let bt = 0; bt < bhDustTorusEntries.length; bt++) {
      const bm = bhDustTorusEntries[bt].mat;
      bm.uniforms.uSpecMode.value = cfg.num;
      if (bm.blending !== torusBlend) {
        bm.blending = torusBlend;
        bm.needsUpdate = true;
      }
    }

    // Brighten relativistic synchrotron jets & radio lobes in Radio / EHT 230 GHz mode!
    const isRadio = modeKey === 'radio';
    for (let j = 0; j < jetRadioMaterials.length; j++) {
      const jm = jetRadioMaterials[j];
      jm.mat.opacity = isRadio ? jm.radioOp : jm.optOp;
      if (jm.mat.color) {
        jm.mat.color.copy(isRadio ? jm.radioColor : jm.baseColor);
      }
    }
    for (let vj = 0; vj < volumetricJetMaterials.length; vj++) {
      volumetricJetMaterials[vj].uniforms.uSpecMode.value = cfg.num;
    }
    for (let qo = 0; qo < quasarOutflowMaterials.length; qo++) {
      quasarOutflowMaterials[qo].uniforms.uSpecMode.value = cfg.num;
    }

    blackHoleEntries.forEach(function (bh) {
      bh.mat.uniforms.uSpecMode.value = cfg.num;
    });

    icmMaterials.forEach(function (entry) {
      entry.mat.opacity = modeKey === 'xray' ? entry.xray : entry.opt;
    });

    if (deepFieldMat) {
      deepFieldMat.opacity = modeKey === 'nircam' ? 0.92 : (modeKey === 'xray' || modeKey === 'radio' ? 0.22 : 0.70);
      deepFieldMat.size = modeKey === 'nircam' ? 1850 : 1350;
    }
    if (quasarFieldMat) {
      quasarFieldMat.opacity = (modeKey === 'xray' || modeKey === 'radio' || modeKey === 'nircam') ? 0.98 : 0.72;
      quasarFieldMat.size = (modeKey === 'xray' || modeKey === 'radio') ? 3400 : 2600;
    }
    for (let eb = 0; eb < ehtBFieldEntries.length; eb++) {
      ehtBFieldEntries[eb].mat.opacity = modeKey === 'radio' ? 0.85 : (modeKey === 'xray' ? 0.35 : 0.26);
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


  // -------------------------------------------------------------------------
  // 15B. v7 ZERO-LAG EXPLORATION UX (Scale/Redshift Pill, Grand Tour, Search,
  //      Photo Mode + PNG Snapshot, EHT B-Fields Toggle & Keyboard Shortcuts)
  // -------------------------------------------------------------------------
  let scalePillEl = null;
  let scaleDistEl = null;
  let scaleLookbackEl = null;
  let scaleZEl = null;
  let photoExitBarEl = null;

  const firstDawnId = (Array.isArray(CAT.COSMIC_DAWN) && CAT.COSMIC_DAWN.length > 0) ? CAT.COSMIC_DAWN[0].id : 'momz14';
  const GRAND_TOUR_STOPS = [
    'sgra', 'sol', 'milkyway', 'm31', 'm87', 'laniakea', 'quipu',
    'cosmicweb', 'ton618', 'j0529', 'napowawa', 'j0410', firstDawnId, 'horizon'
  ];

  const tour = {
    active: false,
    stopIdx: 0,
    holdTimer: 0,
    holdDuration: 5.5
  };

  function setTourActive(on) {
    tour.active = !!on;
    const btn = document.getElementById('grandTourBtn');
    if (btn) {
      btn.textContent = tour.active ? '⏹ Stop Tour' : '▶ Grand Tour';
      btn.classList.toggle('active', tour.active);
    }
    if (tour.active) {
      tour.stopIdx = 0;
      tour.holdTimer = 0;
      const firstId = GRAND_TOUR_STOPS[0];
      if (CAT.INSPECTOR_LOOKUP[firstId]) window.focusTarget(firstId);
    }
  }

  // Cancel Grand Tour immediately whenever user touches/drags the canvas
  controls.addEventListener('start', function () {
    if (tour.active) setTourActive(false);
  });

  function updateGrandTour(dt) {
    if (!tour.active) return;
    if (flight.active) {
      tour.holdTimer = 0;
      return;
    }
    // Gentle cinematic orbit drift while pausing at each stop
    const offset = camera.position.clone().sub(controls.target);
    offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), dt * 0.14);
    camera.position.copy(controls.target).add(offset);

    tour.holdTimer += dt;
    if (tour.holdTimer >= tour.holdDuration) {
      tour.holdTimer = 0;
      tour.stopIdx = (tour.stopIdx + 1) % GRAND_TOUR_STOPS.length;
      let tries = 0;
      while (tries < GRAND_TOUR_STOPS.length && !CAT.INSPECTOR_LOOKUP[GRAND_TOUR_STOPS[tour.stopIdx]]) {
        tour.stopIdx = (tour.stopIdx + 1) % GRAND_TOUR_STOPS.length;
        tries++;
      }
      const nextId = GRAND_TOUR_STOPS[tour.stopIdx];
      if (CAT.INSPECTOR_LOOKUP[nextId]) {
        window.focusTarget(nextId);
      }
    }
  }

  function formatCosmicTelemetry(d) {
    // Piece-wise astrophysical scale mapping aligned to scene coordinates:
    //  0..5: Sgr A* AU/mpc | 5..65: MW kpc (26 = 8.18 kpc) | 65..2000: Local Group/Virgo Mly
    //  2000..25000: Laniakea/Quipu Mly-Bly | 25000..350000: Deep Universe Bly -> z=1100 CMB
    let distTxt = '';
    let lbTxt = 'Now';
    let zTxt = '0.000';

    if (d < 5.0) {
      const au = Math.max(12, Math.round(d * 650));
      distTxt = au.toLocaleString() + ' AU';
      lbTxt = '26.7 kyr';
      zTxt = '0.000';
    } else if (d < 85.0) {
      const kpc = (d / 26.2) * 8.18;
      distTxt = kpc.toFixed(1) + ' kpc';
      lbTxt = (kpc * 3.26).toFixed(0) + ' kyr';
      zTxt = '0.000';
    } else if (d < 550.0) {
      const mly = ((d - 85) / 465) * 2.54 + 0.08;
      distTxt = mly.toFixed(2) + ' Mly';
      lbTxt = mly.toFixed(2) + ' Myr';
      zTxt = '0.000';
    } else if (d < 16000.0) {
      const mly = 2.54 + Math.pow((d - 550) / 15450, 1.15) * 650;
      distTxt = mly < 1000 ? Math.round(mly) + ' Mly' : (mly / 1000).toFixed(2) + ' Bly';
      lbTxt = mly < 1000 ? Math.round(mly) + ' Myr' : (mly / 1000).toFixed(2) + ' Gyr';
      zTxt = (mly / 13800).toFixed(3);
    } else {
      // Deep cosmological scale (16k -> 350k CMB = 46.5 Bly comoving radius, z -> 1100)
      const f = THREE.MathUtils.clamp((d - 16000) / (350000 - 16000), 0.0, 1.0);
      const comovingBly = 0.65 + Math.pow(f, 1.08) * 45.85;
      distTxt = comovingBly.toFixed(1) + ' Bly';
      const lookbackGyr = 0.62 + Math.pow(f, 0.56) * 13.18;
      if (f > 0.90) {
        lbTxt = '380 kyr post-BB';
        zTxt = '1100';
      } else if (f > 0.66) {
        const ageMyr = Math.max(240, Math.round((13.8 - lookbackGyr) * 1000));
        lbTxt = ageMyr + ' Myr post-BB';
        const zVal = 6.0 + Math.pow((f - 0.66) / 0.24, 1.4) * 10.5;
        zTxt = zVal.toFixed(1);
      } else {
        lbTxt = lookbackGyr.toFixed(1) + ' Gyr ago';
        const zVal = 0.05 + Math.pow(f / 0.66, 1.9) * 5.95;
        zTxt = zVal.toFixed(2);
      }
    }
    return { dist: distTxt, lb: lbTxt, z: zTxt };
  }

  let scaleUpdateTimer = 0;
  function updateScalePill(camOriginDist, dt) {
    if (!scalePillEl || state.photoMode) return;
    scaleUpdateTimer += dt;
    if (scaleUpdateTimer < 0.12) return;
    scaleUpdateTimer = 0;
    const info = formatCosmicTelemetry(camOriginDist);
    if (scaleDistEl) scaleDistEl.textContent = info.dist;
    if (scaleLookbackEl) scaleLookbackEl.textContent = info.lb;
    if (scaleZEl) scaleZEl.textContent = 'z = ' + info.z;
  }

  function setPhotoMode(on) {
    state.photoMode = !!on;
    const hudPanel = document.getElementById('hud-body') ? document.getElementById('hud-body').parentElement : null;
    const inspPanel = document.getElementById('insp-body') ? document.getElementById('insp-body').parentElement : null;
    if (hudPanel) hudPanel.style.display = state.photoMode ? 'none' : '';
    if (inspPanel) inspPanel.style.display = state.photoMode ? 'none' : '';
    if (scalePillEl) scalePillEl.style.display = state.photoMode ? 'none' : 'flex';
    if (photoExitBarEl) photoExitBarEl.style.display = state.photoMode ? 'flex' : 'none';
  }

  function saveCanvasSnapshot() {
    // Render one clean frame right before reading pixels (works with preserveDrawingBuffer: false!)
    if (composer && state.bloomEnabled && state.bloomStrength > 0.005) {
      composer.render();
    } else {
      renderer.render(scene, camera);
    }
    try {
      const url = renderer.domElement.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = 'cosmos-3d-' + (window.currentSelectedId || 'view') + '.png';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      console.warn('Cosmos 3D snapshot error:', err);
    }
  }

  function injectV7Controls() {
    // 1. Live Cosmic Scale, Lookback Time & Redshift (z) Floating Pill
    if (!document.getElementById('cosmic-scale-pill')) {
      scalePillEl = document.createElement('div');
      scalePillEl.id = 'cosmic-scale-pill';
      scalePillEl.style.cssText =
        'position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:30;' +
        'display:flex;align-items:center;gap:10px;padding:5px 12px;border-radius:999px;' +
        'background:rgba(7,11,22,0.72);border:1px solid rgba(148,163,184,0.22);' +
        'backdrop-filter:blur(10px);color:#e2e8f0;font-size:11px;font-family:monospace;' +
        'pointer-events:none;white-space:nowrap;box-shadow:0 4px 18px rgba(0,0,0,0.45);';
      scalePillEl.innerHTML =
        '<span style="color:#38bdf8;font-weight:600;" id="scale-dist-val">--</span>' +
        '<span style="opacity:0.35;">|</span>' +
        '<span style="color:#cbd5e1;" id="scale-lb-val">--</span>' +
        '<span style="opacity:0.35;">|</span>' +
        '<span style="color:#fbbf24;" id="scale-z-val">z = 0.000</span>';
      document.body.appendChild(scalePillEl);
      scaleDistEl = document.getElementById('scale-dist-val');
      scaleLookbackEl = document.getElementById('scale-lb-val');
      scaleZEl = document.getElementById('scale-z-val');
    }

    // 2. Floating Photo Mode Exit + PNG Save Bar (hidden until Photo Mode is active)
    if (!document.getElementById('photo-exit-bar')) {
      photoExitBarEl = document.createElement('div');
      photoExitBarEl.id = 'photo-exit-bar';
      photoExitBarEl.style.cssText =
        'position:fixed;bottom:16px;right:16px;z-index:50;display:none;gap:8px;' +
        'padding:6px 10px;border-radius:999px;background:rgba(7,11,22,0.78);' +
        'border:1px solid rgba(148,163,184,0.28);backdrop-filter:blur(10px);';
      const saveBtn = document.createElement('button');
      saveBtn.className = 'spec-btn';
      saveBtn.textContent = 'Save PNG';
      saveBtn.addEventListener('click', saveCanvasSnapshot);
      const exitBtn = document.createElement('button');
      exitBtn.className = 'spec-btn active';
      exitBtn.textContent = 'Exit Photo';
      exitBtn.addEventListener('click', function () { setPhotoMode(false); });
      photoExitBarEl.appendChild(saveBtn);
      photoExitBarEl.appendChild(exitBtn);
      document.body.appendChild(photoExitBarEl);
    }

    // 3. Grand Tour + Photo Mode Action Bar injected right below Quality Bar
    const qualBar = document.getElementById('quality-bar');
    if (qualBar && !document.getElementById('v7-action-bar')) {
      const actBar = document.createElement('div');
      actBar.id = 'v7-action-bar';
      actBar.style.marginTop = '8px';
      actBar.innerHTML =
        '<div class="grid grid-cols-2 gap-1">' +
          '<button id="grandTourBtn" class="spec-btn">▶ Grand Tour</button>' +
          '<button id="photoModeBtn" class="spec-btn">📷 Photo Mode</button>' +
        '</div>';
      qualBar.parentElement.insertBefore(actBar, qualBar.nextSibling);
      document.getElementById('grandTourBtn').addEventListener('click', function () {
        setTourActive(!tour.active);
      });
      document.getElementById('photoModeBtn').addEventListener('click', function () {
        setPhotoMode(true);
      });
    }

    // 4. Instant Landmark Search Bar injected right above the Directory list
    const dirList = document.getElementById('dir-list');
    if (dirList && !document.getElementById('landmarkSearchInput')) {
      const searchWrap = document.createElement('div');
      searchWrap.style.marginBottom = '6px';
      const inp = document.createElement('input');
      inp.id = 'landmarkSearchInput';
      inp.type = 'text';
      inp.placeholder = 'Search 130+ objects (Earth, Saturn, TON 618, Helix...)';
      // Rename existing Sol preset button to 'Solar System' if present
      document.querySelectorAll('.preset-btn').forEach(function (pb) {
        if (pb.textContent.trim().toLowerCase().indexOf('sol') === 0 || pb.textContent.trim() === 'Solar System / Sol') {
          pb.textContent = 'Solar System';
        }
      });
      inp.style.cssText =
        'width:100%;padding:5px 8px;border-radius:6px;font-size:11px;' +
        'background:rgba(15,23,42,0.85);color:#f1f5f9;' +
        'border:1px solid rgba(148,163,184,0.28);outline:none;';
      searchWrap.appendChild(inp);
      dirList.parentElement.insertBefore(searchWrap, dirList);

      inp.addEventListener('input', function () {
        const q = inp.value.trim().toLowerCase();
        if (!q) {
          const activeTab = document.querySelector('.dir-tab.active');
          populateDirectoryTab(activeTab ? activeTab.getAttribute('data-tab') : 'stars');
          return;
        }
        dirList.innerHTML = '';
        const matches = [];
        Object.keys(CAT.INSPECTOR_LOOKUP).forEach(function (key) {
          const it = CAT.INSPECTOR_LOOKUP[key];
          const hay = ((it.label || '') + ' ' + (it.title || '') + ' ' + (it.badge || '') + ' ' + key).toLowerCase();
          if (hay.indexOf(q) !== -1) matches.push(it);
        });
        if (matches.length === 0) {
          const empty = document.createElement('div');
          empty.style.cssText = 'font-size:10px;color:#94a3b8;padding:4px;';
          empty.textContent = 'No matching cosmic objects.';
          dirList.appendChild(empty);
          return;
        }
        matches.slice(0, 24).forEach(function (it) {
          const btn = document.createElement('button');
          btn.className = 'dir-chip';
          btn.textContent = it.label || it.title || it.id;
          btn.addEventListener('click', function () {
            window.focusTarget(it.id);
          });
          dirList.appendChild(btn);
        });
      });

      inp.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          const firstChip = dirList.querySelector('.dir-chip');
          if (firstChip) firstChip.click();
        }
      });
    }

    // 5. Inject 'TON 618' & 'Nāpōwawāʻenakaulua' Quick-Fly Presets before 'Cosmic Horizon'
    const allPresets = document.querySelectorAll('.preset-btn');
    if (allPresets.length > 0 && !document.getElementById('presetTon618Btn')) {
      const lastBtn = allPresets[allPresets.length - 1];
      [
        { id: 'ton618', domId: 'presetTon618Btn', text: 'TON 618 Quasar' },
        { id: 'napowawa', domId: 'presetNapoBtn', text: 'J1602 Pair (z=6)' }
      ].forEach(function (cfg) {
        const b = document.createElement('button');
        b.id = cfg.domId;
        b.className = 'preset-btn';
        b.textContent = cfg.text;
        b.addEventListener('click', function () {
          window.focusTarget(cfg.id, b);
        });
        lastBtn.parentElement.insertBefore(b, lastBtn);
      });
    }

    // 6. Inject 'EHT B-Fields' Visibility Toggle next to 'Orbits' (or 'Field Galaxies')
    const orbCb = document.getElementById('toggleOrbits') || document.getElementById('toggleFieldGalaxies');
    if (orbCb && !document.getElementById('toggleEhtBFields')) {
      const orbLabel = orbCb.closest('label');
      if (orbLabel && orbLabel.parentElement) {
        const bfLabel = document.createElement('label');
        bfLabel.className = orbLabel.className;
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.id = 'toggleEhtBFields';
        cb.checked = state.showEhtBFields;
        cb.className = orbCb.className;
        cb.addEventListener('change', function (e) {
          state.showEhtBFields = e.target.checked;
        });
        bfLabel.appendChild(cb);
        const span = document.createElement('span');
        span.textContent = ' EHT B-Fields';
        bfLabel.appendChild(span);
        orbLabel.parentElement.insertBefore(bfLabel, orbLabel.nextSibling);
      }
    }

    // 7. Laptop Keyboard Shortcuts (Space = Pause, H = Photo Mode, R = Sgr A*)
    window.addEventListener('keydown', function (e) {
      const tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : '';
      if (tag === 'input' || tag === 'textarea') return;
      if (e.code === 'Space') {
        e.preventDefault();
        state.paused = !state.paused;
        if (state.paused) {
          state.savedSpeed = state.speed > 0 ? state.speed : 1.0;
          state.speed = 0.0;
        } else {
          state.speed = state.savedSpeed || 1.0;
        }
        const sl = document.getElementById('speedSlider');
        const rd = document.getElementById('speedReadout');
        if (sl) sl.value = state.speed.toFixed(1);
        if (rd) rd.textContent = state.speed.toFixed(1) + 'x';
      } else if (e.key === 'h' || e.key === 'H') {
        setPhotoMode(!state.photoMode);
      } else if (e.key === 'r' || e.key === 'R') {
        setTourActive(false);
        window.focusTarget('sgra');
      }
    });
  }

  function wireUI() {
    injectQualityControls();
    injectCosmicWebControls();
    injectV5Controls();
    injectV6Controls();
    injectV7Controls();

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
  registerV7CatalogAndRescaleDawn();
  buildEhtBFields();
  buildSagittariusStream();
  buildOJ287();
  buildNGC6505();
  buildLaniakea();
  buildSuperstructures();
  buildCosmicWeb();
  buildFieldGalaxies();
  buildV7DeepUniverse();
  buildBHDustToruses();
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

    // 1B. Live Planet Tracking & Solar System Update
    if (activeFollowPlanet) {
      const prevPlanetPos = activeFollowPlanet.worldPos.clone();
      updateSolarSystem(state.time);
      const deltaMove = activeFollowPlanet.worldPos.clone().sub(prevPlanetPos);
      if (flight.active) {
        flight.toTarget.add(deltaMove);
        flight.toCam.add(deltaMove);
      } else {
        camera.position.add(deltaMove);
        controls.target.add(deltaMove);
        if (camera.position.distanceTo(activeFollowPlanet.worldPos) > 4.5) {
          activeFollowPlanet = null;
        }
      }
    } else {
      updateSolarSystem(state.time);
    }

    // 2. Focus-Aware Dynamic Near-Plane Adjustment (razor-sharp on planets & 350k CMB!)
    const camOriginDist = camera.position.length();
    const focusDist = camera.position.distanceTo(controls.target);
    const desiredNear = focusDist < 10.0
      ? THREE.MathUtils.clamp(focusDist * 0.032, 0.012, 0.1)
      : THREE.MathUtils.clamp(camOriginDist * 0.0016, 0.1, 140.0);
    if (Math.abs(desiredNear - lastNear) / Math.max(lastNear, 0.001) > 0.15) {
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
    const webFade = THREE.MathUtils.smoothstep(camOriginDist, 4600, 14500);
    cosmicWebGroup.visible = state.showCosmicWeb && webFade > 0.005;
    if (cosmicWebGroup.visible) {
      if (cosmicWebLineMat) cosmicWebLineMat.uniforms.uOpacity.value = webFade;
      if (cosmicWebMistMat) cosmicWebMistMat.uniforms.uOpacity.value = webFade;
      if (cosmicWebPointMat) cosmicWebPointMat.uniforms.uOpacity.value = webFade;
    }
    const fieldFade = THREE.MathUtils.smoothstep(camOriginDist, 65, 240);
    fieldGalaxyGroup.visible = state.showFieldGalaxies && fieldFade > 0.004;
    if (fieldGalaxyGroup.visible && fieldGalaxyMat) {
      fieldGalaxyMat.uniforms.uFieldOpacity.value = fieldFade;
    }
    if (lrdPoints) lrdPoints.visible = camOriginDist > 42000;
    v7DeepGroup.visible = camOriginDist > 26000;
    quasarFieldGroup.visible = state.showQuasars && camOriginDist > 35000;
    reionGroup.visible = state.showReionization && camOriginDist > 80000;

    // Distance-culled EHT Polarized B-Field Swirls on Sgr A* & M87*
    for (let eb = 0; eb < ehtBFieldEntries.length; eb++) {
      const bf = ehtBFieldEntries[eb];
      const active = state.showEhtBFields && camera.position.distanceTo(bf.worldPos) < bf.maxDist;
      bf.group.visible = active;
      if (active) {
        bf.lines.rotation.y = state.time * 0.22 * bf.dirSign;
      }
    }

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

    // 4B. Distance-Culled Heavy 3D Black-Hole Dusty Tori (Max 1 Active, links to Dust toggle!)
    for (let bt = 0; bt < bhDustTorusEntries.length; bt++) {
      const td = bhDustTorusEntries[bt];
      const bhD = camera.position.distanceTo(td.bhEntry.worldPos);
      const active = state.showDust && bhD < td.maxActiveDist;
      td.points.visible = active;
      if (active) {
        td.mat.uniforms.uTime.value = state.time;
      }
    }

    // 4C. Distance-Culled 3D Named Landmark Stars, Pulsar Beams & Batched NASA Nebulae
    const nebVisible = state.showNebulae && camOriginDist > 3.2 && camOriginDist < 620;
    batchedNebulaGroup.visible = nebVisible;

    if (camOriginDist < 240) {
      for (let sm = 0; sm < star3DMaterials.length; sm++) {
        star3DMaterials[sm].uniforms.uTime.value = state.time;
      }
      for (let ns = 0; ns < namedStar3DEntries.length; ns++) {
        const entry = namedStar3DEntries[ns];
        const dStar = camera.position.distanceTo(entry.worldPos);
        const show3D = dStar < entry.maxDist;
        entry.group.visible = show3D;
        if (show3D) {
          entry.group.rotation.y = state.time * entry.spinSpeed;
          const farFade = THREE.MathUtils.smoothstep(dStar, 1.8, 9.0);
          entry.sprite.material.opacity = 0.22 + 0.78 * farFade;
          entry.sprite.scale.setScalar(entry.baseScale * (0.48 + 0.52 * farFade));
        } else {
          entry.sprite.material.opacity = 1.0;
          entry.sprite.scale.setScalar(entry.baseScale);
        }
      }
      for (let pb = 0; pb < pulsarBeamEntries.length; pb++) {
        pulsarBeamEntries[pb].pivot.rotation.y = state.time * pulsarBeamEntries[pb].speed;
      }
    } else {
      for (let ns = 0; ns < namedStar3DEntries.length; ns++) {
        namedStar3DEntries[ns].group.visible = false;
      }
    }

    // 5. Update Batched Galaxies, Dust, Fermi Bubbles & Volumetric Quasar Jets/Outflows
    if (batchedStarMat) batchedStarMat.uniforms.uTime.value = state.time;
    for (let vj = 0; vj < volumetricJetMaterials.length; vj++) {
      volumetricJetMaterials[vj].uniforms.uTime.value = state.time;
    }
    if (v7DeepGroup.visible) {
      for (let qo = 0; qo < quasarOutflowMaterials.length; qo++) {
        quasarOutflowMaterials[qo].uniforms.uTime.value = state.time;
      }
    }
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

    // 7. Distance-Adaptive Glare-Free 350k Planck CMB Horizon
    if (cmbMat && cmbDomeMesh) {
      const distRamp = THREE.MathUtils.smoothstep(camOriginDist, 105000, 275000);
      const op = state.showCMB ? distRamp * state.cmbSliderOpacity : 0.0;
      cmbMat.uniforms.uOpacity.value = op;
      cmbDomeMesh.visible = op > 0.005;
    }

    // 7B. Live Grand Tour & Cosmic Scale / Redshift Telemetry Pill
    updateGrandTour(dt);
    updateScalePill(camOriginDist, dt);

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
