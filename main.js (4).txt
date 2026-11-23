/* =========================================================================
 * main.js — Safe-Ultra WebGL / HDR GPU Engine (v20.4 — Realistic Cosmicflows-4 Laniakea Basin: Velocity Watersheds, Exterior Peeling Flows, Sub-Basin Landmarks & Zone of Avoidance)
 * Upgrades in v17:
 *  - 6th Filter Mode: Dark Matter / Lensing (Euclid / IllustrisTNG indigo-violet
 *    invisible mass skeleton, dimmed baryonic stars & full cosmic lensing map!)
 *  - 3D Volumetric NFW Dark Matter Halos + 1,800 Orbiting Subhalos + MW-M31 DM
 *    Bridge + Upgraded Bullet Cluster Offset DM Lobes + Weak-Lensing Shear Arcs!
 *  - Live "DM Gravity" Toggle (Vera Rubin Flat vs. Keplerian galaxy rotation curve
 *    via seamless zero-jump dual-clock phase integration!)
 *  - TRAPPIST-1 Exoplanet System (Ultra-cool M8V red dwarf + 7 orbiting Earth-sized
 *    worlds b-h + glowing emerald Habitable Zone ring!)
 *  - OJ 287 3D Quadrupole Gravitational Wave Spacetime Ripples!
 *  - Smart Solar System Background Star Auto-Fade (dims glaring Milky Way stars
 *    ONLY inside the Solar System & TRAPPIST-1 so planets pop like NASA photos!)
 *  - Ultra-Realistic Orbital Earth (real satellite clouds + aligned surface cloud
 *    drop-shadows, vivid gamma-lifted NASA Black Marble city night lights, taller
 *    Rayleigh blue atmosphere halo & dramatic crescent-terminator arrival angle!)
 *  - Retains 100% of v16/v15/v14.1/v14/v13 (HD Earth 3D Portal + 7 landmarks,
 *    expanded Solar System + 3I/ATLAS + Voyagers, Volumetric Cosmic Web & 1M stars)
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
  const STAR_SCALE = 2.0; // ~1,000,000 batched galaxy stars; vertex-shader LOD keeps FPS smooth!
  const DUST_SCALE = isMobile ? 0.28 : 0.38;
  const EXT_SCALE = 2.85;   // Option A: ~2.85x extragalactic/cosmological radius (~23-27x 3D volume!)
  const SOLAR_SCALE = 0.17; // ~6x more compact Solar System so planets never crowd nearby nebulae

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
    showConstellations: true,
    showDarkMatter: false,
    darkMatterGravity: true,
    fluidDiskEnabled: true,
    dmTimeFlat: 0.0,
    dmTimeKep: 0.0,
    baseDeepFieldOp: 0.72,
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
    0.06,
    2800000
  );
  camera.position.set(0.0, 1.15, 5.45);

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
    accretionFluid.initialized = false;
    initOrResizeAccretionFluid(state.quality);
    console.info('Cosmos 3D: WebGL context restored.');
  }, false);

  const controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.065;
  controls.rotateSpeed = 0.65;
  controls.zoomSpeed = 1.05;
  controls.panSpeed = 0.85;
  controls.minDistance = 0.014;
  controls.maxDistance = 940000;
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
  // 3. RAY-MARCHED GARGANTUA BLACK HOLES + HYBRID 2D GPU NAVIER-STOKES FLUID!
  //    * Distance-Culled: Max 1 BH & 1 Fluid Solver active (0 ms elsewhere!)
  //    * Seamless Cartesian ping-pong HalfFloat solver (auto-falls back if unsupported)
  //    * Distinct real-world regimes: Sgr A* MAD/RIAF (1), UV Quasars (2), AGN (0)
  // -------------------------------------------------------------------------
  const blackHoleEntries = [];
  const bhGroup = new THREE.Group();
  scene.add(bhGroup);

  const accretionFluid = {
    supported: false,
    initialized: false,
    size: 0,
    jacobiPasses: 6,
    frameSkip: 2,
    frameCounter: 0,
    scene: null,
    camera: null,
    quad: null,
    mats: null,
    velA: null, velB: null,
    presA: null, presB: null,
    dyeA: null, dyeB: null,
    curlRT: null,
    divRT: null
  };

  function disposeFluidTargets() {
    ['velA', 'velB', 'presA', 'presB', 'dyeA', 'dyeB', 'curlRT', 'divRT'].forEach(function (k) {
      if (accretionFluid[k]) {
        accretionFluid[k].dispose();
        accretionFluid[k] = null;
      }
    });
  }

  function initOrResizeAccretionFluid(qKey) {
    if (typeof SHADERS.createNavierStokesMaterials !== 'function') return;
    if (qKey === 'perf') {
      accretionFluid.supported = false;
      return;
    }

    const desiredSize = (qKey === 'ultra') ? 256 : 192;
    accretionFluid.jacobiPasses = (qKey === 'ultra') ? 8 : 6;
    accretionFluid.frameSkip = (qKey === 'ultra') ? 1 : 2;

    if (accretionFluid.initialized && accretionFluid.size === desiredSize && accretionFluid.supported) {
      return;
    }

    // Check WebGL HalfFloat FBO compatibility safely (works on WebGL2 + WebGL1 mobile/laptop!)
    const gl = renderer.getContext();
    const isWebGL2 = (typeof WebGL2RenderingContext !== 'undefined') && (gl instanceof WebGL2RenderingContext);
    let canHalfFloat = false;
    if (isWebGL2) {
      canHalfFloat = !!gl.getExtension('EXT_color_buffer_float') || !!gl.getExtension('EXT_color_buffer_half_float');
    } else {
      canHalfFloat = !!gl.getExtension('OES_texture_half_float') && !!gl.getExtension('OES_texture_half_float_linear');
    }

    const rtType = canHalfFloat && THREE.HalfFloatType ? THREE.HalfFloatType : THREE.UnsignedByteType;
    if (rtType !== THREE.HalfFloatType) {
      // HalfFloat is required for signed negative velocities in Stable Fluids -> graceful procedural fallback!
      accretionFluid.supported = false;
      return;
    }

    try {
      disposeFluidTargets();
      const rtOpts = {
        type: THREE.HalfFloatType,
        format: THREE.RGBAFormat,
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        wrapS: THREE.ClampToEdgeWrapping,
        wrapT: THREE.ClampToEdgeWrapping,
        depthBuffer: false,
        stencilBuffer: false
      };

      accretionFluid.velA   = new THREE.WebGLRenderTarget(desiredSize, desiredSize, rtOpts);
      accretionFluid.velB   = new THREE.WebGLRenderTarget(desiredSize, desiredSize, rtOpts);
      accretionFluid.presA  = new THREE.WebGLRenderTarget(desiredSize, desiredSize, rtOpts);
      accretionFluid.presB  = new THREE.WebGLRenderTarget(desiredSize, desiredSize, rtOpts);
      accretionFluid.dyeA   = new THREE.WebGLRenderTarget(desiredSize, desiredSize, rtOpts);
      accretionFluid.dyeB   = new THREE.WebGLRenderTarget(desiredSize, desiredSize, rtOpts);
      accretionFluid.curlRT = new THREE.WebGLRenderTarget(desiredSize, desiredSize, rtOpts);
      accretionFluid.divRT  = new THREE.WebGLRenderTarget(desiredSize, desiredSize, rtOpts);

      if (!accretionFluid.scene) {
        accretionFluid.scene = new THREE.Scene();
        accretionFluid.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        accretionFluid.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), null);
        accretionFluid.scene.add(accretionFluid.quad);
      }
      const texelStep = 1.0 / desiredSize;
      if (!accretionFluid.mats) {
        accretionFluid.mats = SHADERS.createNavierStokesMaterials(texelStep);
      } else {
        Object.keys(accretionFluid.mats).forEach(function (mk) {
          const matObj = accretionFluid.mats[mk];
          if (matObj && matObj.uniforms && matObj.uniforms.uTexelSize) {
            matObj.uniforms.uTexelSize.value.set(texelStep, texelStep);
          }
        });
      }
      accretionFluid.size = desiredSize;

      // Verify framebuffer completeness on this specific mobile/laptop GPU before enabling!
      const prevTarget = renderer.getRenderTarget();
      const prevClearCol = new THREE.Color();
      renderer.getClearColor(prevClearCol);
      const prevClearAlpha = renderer.getClearAlpha();
      renderer.setClearColor(0x000000, 1.0);
      renderer.setRenderTarget(accretionFluid.velA);
      const fbStatus = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
      renderer.clearColor();
      renderer.setRenderTarget(accretionFluid.velB); renderer.clearColor();
      renderer.setRenderTarget(accretionFluid.presA); renderer.clearColor();
      renderer.setRenderTarget(accretionFluid.presB); renderer.clearColor();
      renderer.setRenderTarget(accretionFluid.dyeA); renderer.clearColor();
      renderer.setRenderTarget(accretionFluid.dyeB); renderer.clearColor();
      renderer.setRenderTarget(accretionFluid.curlRT); renderer.clearColor();
      renderer.setRenderTarget(accretionFluid.divRT); renderer.clearColor();
      renderer.setClearColor(prevClearCol, prevClearAlpha);
      renderer.setRenderTarget(prevTarget);

      if (fbStatus !== gl.FRAMEBUFFER_COMPLETE) {
        disposeFluidTargets();
        accretionFluid.supported = false;
        return;
      }

      accretionFluid.supported = true;
      accretionFluid.initialized = true;

      // Warm-start 14 quick fluid steps so swirling Keplerian spiral plasma is immediately visible on Frame 1!
      for (let w = 0; w < 14; w++) {
        stepAccretionFluid(0.024, w * 0.024, state.spin, true);
      }
    } catch (err) {
      console.warn('Cosmos 3D: Navier-Stokes HalfFloat fallback to procedural disk:', err);
      disposeFluidTargets();
      accretionFluid.supported = false;
    }
  }

  function stepAccretionFluid(dt, simTime, spinVal, forceStep) {
    if (!accretionFluid.supported) return;
    if (!forceStep) {
      if (!state.fluidDiskEnabled || state.quality === 'perf' || dt <= 0.00001) return;
      accretionFluid.frameCounter++;
      if ((accretionFluid.frameCounter % accretionFluid.frameSkip) !== 0) return;
    }

    const stepDt = Math.min(Math.max(dt * (forceStep ? 1.0 : accretionFluid.frameSkip), 0.004), 0.036);
    const mats = accretionFluid.mats;
    const prevTarget = renderer.getRenderTarget();
    const prevAutoClear = renderer.autoClear;
    renderer.autoClear = false;

    function runPass(mat, outRT) {
      accretionFluid.quad.material = mat;
      renderer.setRenderTarget(outRT);
      renderer.render(accretionFluid.scene, accretionFluid.camera);
    }

    // 1. Velocity Advection + Keplerian Differential Shear + MRI Turbulence
    mats.advectVel.uniforms.uVelocity.value = accretionFluid.velA.texture;
    mats.advectVel.uniforms.uDt.value = stepDt;
    mats.advectVel.uniforms.uTime.value = simTime;
    mats.advectVel.uniforms.uSpin.value = spinVal;
    runPass(mats.advectVel, accretionFluid.velB);
    let tmp = accretionFluid.velA; accretionFluid.velA = accretionFluid.velB; accretionFluid.velB = tmp;

    // 2. Vorticity (Curl) + Vorticity Confinement
    mats.curl.uniforms.uVelocity.value = accretionFluid.velA.texture;
    runPass(mats.curl, accretionFluid.curlRT);

    mats.vorticity.uniforms.uVelocity.value = accretionFluid.velA.texture;
    mats.vorticity.uniforms.uCurl.value = accretionFluid.curlRT.texture;
    mats.vorticity.uniforms.uDt.value = stepDt;
    runPass(mats.vorticity, accretionFluid.velB);
    tmp = accretionFluid.velA; accretionFluid.velA = accretionFluid.velB; accretionFluid.velB = tmp;

    // 3. Divergence + Iterative Jacobi Pressure Projection (6-8 passes)
    mats.divergence.uniforms.uVelocity.value = accretionFluid.velA.texture;
    runPass(mats.divergence, accretionFluid.divRT);

    mats.pressure.uniforms.uDivergence.value = accretionFluid.divRT.texture;
    for (let p = 0; p < accretionFluid.jacobiPasses; p++) {
      mats.pressure.uniforms.uPressure.value = accretionFluid.presA.texture;
      runPass(mats.pressure, accretionFluid.presB);
      tmp = accretionFluid.presA; accretionFluid.presA = accretionFluid.presB; accretionFluid.presB = tmp;
    }

    // 4. Subtract Pressure Gradient (Projection onto Divergence-Free Flow)
    mats.gradSub.uniforms.uPressure.value = accretionFluid.presA.texture;
    mats.gradSub.uniforms.uVelocity.value = accretionFluid.velA.texture;
    runPass(mats.gradSub, accretionFluid.velB);
    tmp = accretionFluid.velA; accretionFluid.velA = accretionFluid.velB; accretionFluid.velB = tmp;

    // 5. Advect Plasma Density & Flare Heat
    mats.advectDye.uniforms.uVelocity.value = accretionFluid.velA.texture;
    mats.advectDye.uniforms.uDye.value = accretionFluid.dyeA.texture;
    mats.advectDye.uniforms.uCurl.value = accretionFluid.curlRT.texture;
    mats.advectDye.uniforms.uDt.value = stepDt;
    mats.advectDye.uniforms.uTime.value = simTime;
    runPass(mats.advectDye, accretionFluid.dyeB);
    tmp = accretionFluid.dyeA; accretionFluid.dyeA = accretionFluid.dyeB; accretionFluid.dyeB = tmp;

    renderer.setRenderTarget(prevTarget);
    renderer.autoClear = prevAutoClear;
  }

  function buildBlackHoles() {
    const unitSphereGeo = new THREE.SphereGeometry(1.0, 36, 24);

    CAT.BLACK_HOLES.forEach(function (bh) {
      const isSgrA = bh.id === 'sgra';
      const mat = SHADERS.createGargantuaMaterial({
        spin: bh.spin,
        diskTint: bh.diskTint,
        brightness: bh.brightness,
        regime: isSgrA ? 1.0 : 0.0,
        placeholderTex: textures.starGlow
      });

      const mesh = new THREE.Mesh(unitSphereGeo, mat);
      mesh.position.set(bh.pos[0], bh.pos[1], bh.pos[2]);
      mesh.rotation.set(bh.tilt[0], bh.tilt[1], bh.tilt[2]);
      mesh.scale.setScalar(bh.sphereRadius);
      mesh.frustumCulled = false;
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
        maxActiveDist: bh.sphereRadius * 75,
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

  // -------------------------------------------------------------------------
  // 4A. v11 OPTION A UNIVERSE RESCALER (Zero changes required to catalog.js!)
  //     Expands all extragalactic/cosmological distances by EXT_SCALE (2.85x)
  //     and clears an authentic interstellar gap around our Solar System!
  // -------------------------------------------------------------------------
  function applyV11UniverseRescale() {
    if (CAT._v11Rescaled) return;
    CAT._v11Rescaled = true;

    const clusterIds = {};
    const superIds = {};
    CAT.CLUSTERS.forEach(function (c) { clusterIds[c.id] = true; });
    CAT.SUPERSTRUCTURES.forEach(function (s) { superIds[s.id] = true; });

    // 1. Rescale all extragalactic galaxies (named + cluster members)
    allGalaxies.forEach(function (g) {
      if (g.id === 'milkyway') return;
      const d = Math.hypot(g.pos[0], g.pos[1], g.pos[2]);
      if (d > 15) {
        g.pos = [g.pos[0] * EXT_SCALE, g.pos[1] * EXT_SCALE, g.pos[2] * EXT_SCALE];
        g.radius = g.radius * 1.24;
        if (g.jetLength) g.jetLength = g.jetLength * 1.28;
      }
    });

    // 2. Rescale extragalactic black holes (M31*, M87*, M104*, etc.)
    CAT.BLACK_HOLES.forEach(function (bh) {
      if (bh.id === 'sgra') return;
      const d = Math.hypot(bh.pos[0], bh.pos[1], bh.pos[2]);
      if (d > 15) {
        bh.pos = [bh.pos[0] * EXT_SCALE, bh.pos[1] * EXT_SCALE, bh.pos[2] * EXT_SCALE];
        bh.sphereRadius = bh.sphereRadius * 1.24;
        if (bh.jetLength) bh.jetLength = bh.jetLength * 1.28;
      }
    });

    // 3. Rescale galaxy clusters & intracluster gas halos
    CAT.CLUSTERS.forEach(function (cl) {
      cl.pos = [cl.pos[0] * EXT_SCALE, cl.pos[1] * EXT_SCALE, cl.pos[2] * EXT_SCALE];
      cl.radius = cl.radius * EXT_SCALE;
    });

    // 4. Rescale Laniakea Supercluster geometry
    const L = CAT.LANIAKEA;
    L.center = [L.center[0] * EXT_SCALE, L.center[1] * EXT_SCALE, L.center[2] * EXT_SCALE];
    L.attractor = [L.attractor[0] * EXT_SCALE, L.attractor[1] * EXT_SCALE, L.attractor[2] * EXT_SCALE];
    L.localVoid = [L.localVoid[0] * EXT_SCALE, L.localVoid[1] * EXT_SCALE, L.localVoid[2] * EXT_SCALE];
    L.radii = [L.radii[0] * EXT_SCALE, L.radii[1] * EXT_SCALE, L.radii[2] * EXT_SCALE];
    L.lobes.forEach(function (lb) {
      lb.pos = [lb.pos[0] * EXT_SCALE, lb.pos[1] * EXT_SCALE, lb.pos[2] * EXT_SCALE];
    });

    // 5. Rescale Quipu & 4 companion superstructures
    CAT.SUPERSTRUCTURES.forEach(function (sup) {
      sup.spine = sup.spine.map(function (p) { return [p[0] * EXT_SCALE, p[1] * EXT_SCALE, p[2] * EXT_SCALE]; });
      if (Array.isArray(sup.branches)) {
        sup.branches = sup.branches.map(function (br) {
          return [
            [br[0][0] * EXT_SCALE, br[0][1] * EXT_SCALE, br[0][2] * EXT_SCALE],
            [br[1][0] * EXT_SCALE, br[1][1] * EXT_SCALE, br[1][2] * EXT_SCALE]
          ];
        });
      }
      sup.labelPos = [sup.labelPos[0] * EXT_SCALE, sup.labelPos[1] * EXT_SCALE, sup.labelPos[2] * EXT_SCALE];
    });

    // 6. Push nearby landmark stars & nebulae gently out of Sol's immediate neighborhood!
    let solRef = [26.0, 0.35, 3.2];
    CAT.LANDMARK_STARS.forEach(function (st) {
      if (st.isSol) solRef = [st.pos[0], st.pos[1], st.pos[2]];
    });

    CAT.LANDMARK_STARS.forEach(function (st) {
      if (st.isSol) return;
      const dx = st.pos[0] - solRef[0];
      const dy = st.pos[1] - solRef[1];
      const dz = st.pos[2] - solRef[2];
      const d = Math.hypot(dx, dy, dz);
      if (d < 5.4) {
        const push = (5.4 + d * 0.65) / Math.max(d, 0.05);
        st.pos = [solRef[0] + dx * push, solRef[1] + dy * push, solRef[2] + dz * push];
        const lk = CAT.INSPECTOR_LOOKUP[st.id];
        if (lk) lk.target = [st.pos[0], st.pos[1], st.pos[2]];
      }
    });

    CAT.NEBULAE.forEach(function (neb) {
      const dx = neb.pos[0] - solRef[0];
      const dy = neb.pos[1] - solRef[1];
      const dz = neb.pos[2] - solRef[2];
      const d = Math.hypot(dx, dy, dz);
      if (d < 8.5) {
        const push = (8.5 + d * 0.85) / Math.max(d, 0.05);
        const nx = solRef[0] + dx * push;
        const ny = solRef[1] + dy * push;
        const nz = solRef[2] + dz * push;
        const shiftX = nx - neb.pos[0];
        const shiftY = ny - neb.pos[1];
        const shiftZ = nz - neb.pos[2];
        neb.pos = [nx, ny, nz];
        const lk = CAT.INSPECTOR_LOOKUP[neb.id];
        if (lk) {
          lk.target = [nx, ny, nz];
          lk.camPos = [lk.camPos[0] + shiftX, lk.camPos[1] + shiftY, lk.camPos[2] + shiftZ];
        }
      }
    });

    // 7. Rescale all extragalactic Inspector/Preset camera flights cleanly!
    const seen = new Set();
    function rescaleItem(it) {
      if (!it || seen.has(it) || !it.target || !it.camPos) return;
      seen.add(it);
      if (it.id === 'sgra') {
        it.camPos = [0.0, 1.15, 5.45];
        return;
      }
      const tLen = Math.hypot(it.target[0], it.target[1], it.target[2]);
      const cLen = Math.hypot(it.camPos[0], it.camPos[1], it.camPos[2]);
      if (tLen > 85) {
        const ox = it.camPos[0] - it.target[0];
        const oy = it.camPos[1] - it.target[1];
        const oz = it.camPos[2] - it.target[2];
        const isLarge = !!(clusterIds[it.id] || superIds[it.id] || it.id === 'laniakea');
        const offMult = isLarge ? EXT_SCALE : 1.28;
        it.target = [it.target[0] * EXT_SCALE, it.target[1] * EXT_SCALE, it.target[2] * EXT_SCALE];
        it.camPos = [it.target[0] + ox * offMult, it.target[1] + oy * offMult, it.target[2] + oz * offMult];
      } else if (tLen <= 1.0 && cLen > 400) {
        it.camPos = [it.camPos[0] * EXT_SCALE, it.camPos[1] * EXT_SCALE, it.camPos[2] * EXT_SCALE];
      }
    }

    Object.keys(CAT.INSPECTOR_LOOKUP).forEach(function (k) { rescaleItem(CAT.INSPECTOR_LOOKUP[k]); });
    if (CAT.PRESETS) {
      Object.keys(CAT.PRESETS).forEach(function (k) { rescaleItem(CAT.PRESETS[k]); });
    }
  }
  let starPoints = null;
  let dustPoints = null;
  let batchedStarMat = null;
  let batchedDustMat = null;
  let totalBatchedStars = 0;
  let maxBatchedStarDist = 95000;
  let maxBatchedDustDist = 45000;

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
      const gOuterDist = Math.hypot(cx, cy, cz) + R * 1.4;
      if (gOuterDist > maxBatchedStarDist) maxBatchedStarDist = gOuterDist;
      if (gDust > 0 && gOuterDist > maxBatchedDustDist) maxBatchedDustDist = gOuterDist;

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

      // Photographic Unresolved Starlight Disk Glow (Custom 512x512 NASA/ESA Map for Milky Way!)
      if (HERO_GLOW_IDS[g.id] && (textures.milkyWayDisk || textures.galaxyGlow)) {
        const useMWMap = isMW && textures.milkyWayDisk;
        const baseOp = useMWMap ? 0.62 : (g.type === 'elliptical' ? 0.34 : 0.24);
        const gMat = new THREE.MeshBasicMaterial({
          map: useMWMap ? textures.milkyWayDisk : textures.galaxyGlow,
          color: useMWMap ? new THREE.Color(0xffffff) : (g.type === 'elliptical' ? cBulge.clone() : cBulge.clone().lerp(cArm, 0.32)),
          transparent: true,
          opacity: baseOp,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide
        });
        const gMesh = new THREE.Mesh(glowPlaneGeo, gMat);
        gMesh.position.set(cx, cy, cz);
        gMesh.quaternion.copy(tmpQuat);
        gMesh.scale.setScalar(R * (useMWMap ? 2.12 : 2.15));
        gMesh.renderOrder = 1;
        heroGlowGroup.add(gMesh);
        heroGlowEntries.push({ mesh: gMesh, mat: gMat, baseOp: baseOp, isMW: isMW, omega: g.omega || 0.08 });
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
        } else if (isMW) {
          // --- DEDICATED NASA / ESA GAIA MILKY WAY SBbc ARCHITECTURE ---
          // 27°-angled peanut/X-shaped central bar + 4 real logarithmic arms +
          // Orion-Cygnus Local Spur through Sol + subtle Gaia outer disk S-warp!
          const BAR_ANG = 0.47; // ~27° to the Sun-Galactic Center line
          const cBar = Math.cos(BAR_ANG);
          const sBar = Math.sin(BAR_ANG);

          if (u < 0.24) {
            if (rng() < 0.56) {
              // 27°-tilted luminous central Galactic Bar + boxy/peanut bulge flare
              const barT = (rng() * 2.0 - 1.0) * R * 0.285;
              const bx = barT;
              const bz = randGauss(rng) * R * 0.056 * (1.0 - Math.abs(barT) / (R * 0.38));
              const peanut = 1.0 + 0.48 * Math.min(1.0, Math.abs(barT) / (R * 0.16));
              lx = bx * cBar - bz * sBar;
              lz = bx * sBar + bz * cBar;
              ly = randGauss(rng) * R * 0.028 * peanut;
            } else {
              // Warm golden central spheroidal bulge + 3-kpc inner molecular ring
              const r = R * (0.08 + 0.19 * Math.pow(rng(), 1.45));
              const theta = rng() * Math.PI * 2;
              const phi = Math.acos(2 * rng() - 1);
              lx = r * Math.sin(phi) * Math.cos(theta);
              ly = r * Math.cos(phi) * 0.34;
              lz = r * Math.sin(phi) * Math.sin(theta);
            }
            const d0 = Math.sqrt(lx * lx + ly * ly + lz * lz);
            if (d0 < 5.2) {
              const push = 5.2 / Math.max(d0, 0.01);
              lx *= push;
              lz *= push;
            }
            cStar.copy(cBulge).lerp(cWarm, rng() * 0.42);
            spectral = 0.70 + rng() * 0.30;
            size *= 1.08;
          } else if (u < 0.305) {
            // Dedicated Orion-Cygnus Local Spur right around our Solar System (26.0, 0.35, 3.2)!
            const f = rng();
            const rNorm = 0.37 + f * 0.25;
            const r = R * rNorm;
            const ang = -0.32 + f * 0.92 + randGauss(rng) * 0.085;
            lx = Math.cos(ang) * r;
            lz = Math.sin(ang) * r;
            ly = randGauss(rng) * R * 0.018;
            cStar.copy(cArm).lerp(cOB, rng() * 0.45);
            if (rng() < 0.075) {
              cStar.copy(cHII);
              kind = 1.0;
              size *= 2.1;
              spectral = 0.10;
            } else {
              spectral = 0.12 + rng() * 0.35;
            }
          } else {
            // 4 Authentic Logarithmic Spiral Arms (2 Major: Scutum-Centaurus & Perseus,
            // 2 Minor: Sagittarius-Carina & Norma-Outer) + feathery inter-arm spurs!
            const armRoll = rng();
            let a0 = BAR_ANG;
            let twist = 4.15;
            let isMajorArm = true;
            if (armRoll < 0.34) {
              a0 = BAR_ANG + 0.00;           twist = 4.15; isMajorArm = true;  // Scutum-Centaurus
            } else if (armRoll < 0.68) {
              a0 = BAR_ANG + Math.PI;        twist = 4.15; isMajorArm = true;  // Perseus
            } else if (armRoll < 0.84) {
              a0 = BAR_ANG + Math.PI * 0.52; twist = 4.25; isMajorArm = false; // Sagittarius-Carina
            } else {
              a0 = BAR_ANG + Math.PI * 1.52; twist = 4.25; isMajorArm = false; // Norma-Outer
            }

            const isDiskScatter = rng() < 0.15;
            const isFeatherSpur = !isDiskScatter && isMajorArm && rng() < 0.14;
            const rNorm = Math.pow(rng(), isDiskScatter ? 0.72 : 0.84);
            const r = R * (0.16 + 0.84 * rNorm);
            const baseSpiral = a0 + twist * Math.log(1.0 + rNorm * 3.45);
            const spread = isDiskScatter
              ? Math.PI * 2
              : (isFeatherSpur ? 0.30 : (isMajorArm ? 0.16 + 0.30 * rNorm : 0.14 + 0.26 * rNorm));
            const angle = baseSpiral + (isFeatherSpur ? 0.24 : 0.0) + randGauss(rng) * spread;

            // Authentic ESA Gaia S-shaped outer galactic disk warp (rNorm > 0.58)!
            const warpFactor = rNorm > 0.58 ? Math.pow((rNorm - 0.58) / 0.42, 1.55) : 0.0;
            const yWarp = Math.sin(angle - 0.75) * warpFactor * R * 0.085;

            lx = Math.cos(angle) * r;
            lz = Math.sin(angle) * r;
            ly = yWarp + randGauss(rng) * R * (0.017 + 0.032 * Math.exp(-rNorm * 3.0));

            cStar.copy(cBulge).lerp(cArm, Math.min(1, rNorm * 1.25));
            const knotRoll = rng();
            if (!isDiskScatter && knotRoll < (isMajorArm ? 0.068 : 0.042)) {
              cStar.copy(cHII);
              kind = 1.0;
              size *= 2.2;
              spectral = 0.10;
            } else if (!isDiskScatter && knotRoll < (isMajorArm ? 0.18 : 0.11)) {
              cStar.copy(cOB).lerp(cBlue, rng() * 0.45);
              size *= 1.32;
              spectral = 0.05;
            } else {
              if (rng() < 0.24) cStar.lerp(cBlue, 0.58);
              else if (rng() < 0.18) cStar.lerp(cWarm, 0.42);
              spectral = Math.max(0.0, Math.min(1.0, (1.0 - rNorm) * 0.65 + rng() * 0.35));
            }
          }

          const rHoriz = Math.sqrt(lx * lx + lz * lz);
          localOmega = (g.omega || 0.08) * (R * 0.38) / (rHoriz + R * 0.18);
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
        } else if (isMW) {
          // Concave inner-edge molecular dust filaments hugging Scutum-Centaurus, Perseus, Sagittarius & Norma!
          const BAR_ANG = 0.47;
          const armPick = rng();
          const a0 = armPick < 0.36 ? BAR_ANG
            : (armPick < 0.72 ? BAR_ANG + Math.PI
            : (armPick < 0.86 ? BAR_ANG + Math.PI * 0.52 : BAR_ANG + Math.PI * 1.52));
          const twist = (armPick < 0.72) ? 4.15 : 4.25;
          const rNorm = 0.14 + Math.pow(rng(), 0.86) * 0.78;
          const r = R * rNorm;
          const angle = a0 + twist * Math.log(1.0 + rNorm * 3.45) - 0.14 + randGauss(rng) * (0.09 + 0.12 * rNorm);
          const warpF = rNorm > 0.58 ? Math.pow((rNorm - 0.58) / 0.42, 1.55) : 0.0;
          lx = Math.cos(angle) * r;
          lz = Math.sin(angle) * r;
          ly = Math.sin(angle - 0.75) * warpF * R * 0.085 + randGauss(rng) * R * 0.012;
          opacity = 0.72 + rng() * 0.24;
          puffSize = R * (0.048 + rng() * 0.056);
          localOmega = (g.omega || 0.08) * (R * 0.38) / (r + R * 0.18);
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

    // Magellanic Stellar Bridge (tracks rescaled LMC & SMC!)
    const lmcPos = new THREE.Vector3(-115 * EXT_SCALE, -96 * EXT_SCALE, 88 * EXT_SCALE);
    const smcPos = new THREE.Vector3(-148 * EXT_SCALE, -116 * EXT_SCALE, 118 * EXT_SCALE);
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

  const _sStarTmp = new THREE.Vector3();
  function updateSStars(simTime) {
    const tmp = _sStarTmp;
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
  solarTiltGroup.scale.setScalar(SOLAR_SCALE);    // 6x more compact so Solar System sits in vast interstellar space!
  solarSystemGroup.add(solarTiltGroup);

  const SOL_POS = new THREE.Vector3(26.0, 0.35, 3.2);
  let solFarSprite = null;
  let solFarSpriteBase = 2.6;
  const solarPlanetEntries = [];
  const solarPlanetMap = {};
  const planetShaderMaterials = [];
  let activeFollowPlanet = null;
  let earthOrbitalMat = null;
  let earthCloudMesh = null;
  let earthCloudMat = null;
  let earthAtmoMat = null;
  let saturnRingMat = null;
  let solarCoronaMat = null;
  let solarCoronaMesh = null;
  let earthMoonMesh = null;
  let earthMoonMat = null;
  let jupiterMat = null;
  let heliopauseMat = null;
  let heliopauseMesh = null;
  let earthTexturesRequested = false;
  const planetTextureTargets = {}; // id -> { mat, file }
  const solarExtraEntries = [];    // Dwarf planets, 3I/ATLAS comet, Voyager 1/2, JWST
  const solarExtraMap = {};

  function loadRealEarthTexturesOnce() {
    if (earthTexturesRequested || !earthOrbitalMat) return;
    earthTexturesRequested = true;
    const loader = new THREE.TextureLoader();
    if (typeof loader.setCrossOrigin === 'function') loader.setCrossOrigin('anonymous');
    const base = 'https://cdn.jsdelivr.net/npm/three-globe/example/img/';

    loader.load(base + 'earth-blue-marble.jpg', function (tex) {
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.magFilter = THREE.LinearFilter;
      earthOrbitalMat.uniforms.uDayMap.value = tex;
      earthOrbitalMat.uniforms.uHasDayMap.value = 1.0;
    }, undefined, function () { /* graceful offline procedural fallback */ });

    const cdnPrimary = 'https://cdn.jsdelivr.net/gh/Pana-g/flutter_earth_globe@master/example/assets/';
    const cdnBackup = 'https://cdn.jsdelivr.net/gh/rajpatel5/Solar-System@master/';

    function applyNightTex(tex) {
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.magFilter = THREE.LinearFilter;
      earthOrbitalMat.uniforms.uNightMap.value = tex;
      earthOrbitalMat.uniforms.uHasNightMap.value = 1.0;
    }
    loader.load(base + 'earth-night.jpg', applyNightTex, undefined, function () {
      loader.load(cdnPrimary + '2k_earth_nightmap.jpg', applyNightTex, undefined, function () { /* procedural fallback */ });
    });

    loader.load(base + 'earth-water.png', function (tex) {
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.magFilter = THREE.LinearFilter;
      earthOrbitalMat.uniforms.uWaterMap.value = tex;
      earthOrbitalMat.uniforms.uHasWaterMap.value = 1.0;
    }, undefined, function () { /* optional specular mask */ });

    // Real NASA / NOAA Global Swirling Cloud Deck (feeds BOTH cloud sphere & surface drop-shadows!)
    function applyCloudTex(tex) {
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.wrapS = THREE.RepeatWrapping;
      if (earthCloudMat && earthCloudMat.uniforms && earthCloudMat.uniforms.uCloudMap) {
        earthCloudMat.uniforms.uCloudMap.value = tex;
        earthCloudMat.uniforms.uHasCloudMap.value = 1.0;
      }
      if (earthOrbitalMat && earthOrbitalMat.uniforms && earthOrbitalMat.uniforms.uCloudMap) {
        earthOrbitalMat.uniforms.uCloudMap.value = tex;
        earthOrbitalMat.uniforms.uHasCloudMap.value = 1.0;
      }
    }
    loader.load(cdnPrimary + '2k_earth_clouds.jpg', applyCloudTex, undefined, function () {
      loader.load('https://cdn.jsdelivr.net/npm/three-globe/example/clouds/clouds.png', applyCloudTex, undefined, function () {
        loader.load(cdnBackup + '2k_earth_clouds.jpg', applyCloudTex, undefined, function () { /* procedural cloud fallback */ });
      });
    });

    // Lazy-load Real 2K NASA / Solar System Scope Surface Maps for All Other Planets & Moon!
    Object.keys(planetTextureTargets).forEach(function (k) {
      const target = planetTextureTargets[k];
      if (!target || !target.mat || !target.mat.uniforms || !target.mat.uniforms.uSurfaceMap) return;
      function applyTex(tex) {
        tex.minFilter = THREE.LinearMipmapLinearFilter;
        tex.magFilter = THREE.LinearFilter;
        target.mat.uniforms.uSurfaceMap.value = tex;
        target.mat.uniforms.uHasMap.value = 1.0;
      }
      loader.load(cdnPrimary + target.file, applyTex, undefined, function () {
        loader.load(cdnBackup + target.file, applyTex, undefined, function () { /* keeps procedural shader! */ });
      });
    });
  }

  // Batched NASA Multi-Wavelength Nebulae + Star-Blocking Dark Dust Pass + 3D Volumetric Hero Nebulae!
  const batchedNebulaGroup = new THREE.Group();
  scene.add(batchedNebulaGroup);
  let batchedNebulaMat = null;
  let batchedNebulaDarkMat = null;
  const volumetricNebulaEntries = [];

  const EXTRA_NASA_NEBULAE = [
    {
      id: 'tarantula',
      name: 'Tarantula Nebula (30 Doradus)',
      pos: [-112 * EXT_SCALE, -94 * EXT_SCALE, 86 * EXT_SCALE], // Embedded right inside rescaled LMC!
      radius: 14.5,
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
      pos: [17.4, -3.2, 9.6],
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
      pos: [14.6, 0.5, -2.8],
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
      pos: [33.8, 2.9, 10.8],
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
      pos: [31.5, 4.4, -5.2],
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
      id: 'mercury', name: 'Mercury', orbitR: 0.44, radius: 0.026, polarScale: 1.0, bump: 1.35, period: 0.241, rotSpd: 0.35, tilt: 0.001, inc: 0.12, phase: 0.4,
      pType: 0.0, colA: 0x6b6762, colB: 0xb8b2a8, atmoCol: 0x94a3b8, atmoStr: 0.04, orbitCol: 0x94a3b8,
      badge: 'Inner Terrestrial Planet • 0 Moons', cls: '4,879 km Diameter • Silicate/Iron',
      radiusTxt: '0.39 AU (57.9M km)', vel: '47.4 km/s • 88.0 d Orbit',
      desc: 'Smallest and innermost planet of the Solar System—heavily cratered, airless rocky world whipping around the Sun in just 88 Earth days.'
    },
    {
      id: 'venus', name: 'Venus', orbitR: 0.64, radius: 0.042, polarScale: 1.0, bump: 0.0, period: 0.615, rotSpd: -0.18, tilt: 3.09, inc: 0.06, phase: 1.9,
      pType: 1.0, colA: 0xc28a3e, colB: 0xfde6b2, atmoCol: 0xfcd34d, atmoStr: 0.58, orbitCol: 0xfbbf24,
      badge: 'Terrestrial Planet • Runaway Greenhouse', cls: '12,104 km Diameter • 0 Moons',
      radiusTxt: '0.72 AU (108.2M km)', vel: '35.0 km/s • 224.7 d Orbit',
      desc: 'Shrouded in golden-cream sulfuric acid clouds above a 464 °C surface, spinning slowly backward (retrograde) compared to most planets.'
    },
    {
      id: 'earth', name: 'Earth', orbitR: 0.88, radius: 0.046, polarScale: 0.9966, bump: 0.72, period: 1.000, rotSpd: 1.45, tilt: 0.409, inc: 0.0, phase: 3.1,
      pType: 2.0, colA: 0x1d4ed8, colB: 0x22c55e, atmoCol: 0x38bdf8, atmoStr: 0.72, orbitCol: 0x38bdf8, hasMoon: true,
      badge: 'Home World • 1 Moon (Luna)', cls: '12,756 km Diameter • Ocean World',
      radiusTxt: '1.00 AU (149.6M km)', vel: '29.8 km/s • 365.25 d Orbit',
      desc: 'Our pale blue dot—liquid sapphire oceans, 3D mountain relief along the terminator, real-time seasonal axial tilt, Moon eclipses, dynamic clouds, and NASA Black Marble city lights.'
    },
    {
      id: 'mars', name: 'Mars', orbitR: 1.14, radius: 0.034, polarScale: 0.994, bump: 1.05, period: 1.881, rotSpd: 1.40, tilt: 0.44, inc: 0.03, phase: 4.8,
      pType: 3.0, colA: 0x8f331c, colB: 0xe67e4d, atmoCol: 0xe89a66, atmoStr: 0.36, orbitCol: 0xf87171,
      badge: 'Red Planet • 2 Moons (Phobos, Deimos)', cls: '6,792 km Diameter • Iron-Oxide',
      radiusTxt: '1.52 AU (228.0M km)', vel: '24.1 km/s • 687.0 d Orbit',
      desc: 'Rust-red desert world with 3D canyon & crater relief, dusty butterscotch limb haze shifting to a pale blue Mie-scattered sunset glow along the terminator.'
    },
    {
      id: 'jupiter', name: 'Jupiter', orbitR: 1.88, radius: 0.108, polarScale: 0.935, bump: 0.0, period: 11.862, rotSpd: 2.6, tilt: 0.054, inc: 0.02, phase: 0.9,
      pType: 4.0, colA: 0xc27b48, colB: 0xf5e2c4, atmoCol: 0xfdba74, atmoStr: 0.34, orbitCol: 0xf59e0b, hasGalileans: true,
      badge: 'Gas Giant • 95 Known Moons • Oblate', cls: '142,984 km Diameter • 6.5% Polar Flattening',
      radiusTxt: '5.20 AU (778.5M km)', vel: '13.1 km/s • 11.86 yr Orbit',
      desc: 'Noticeably oblate gas giant flattened by rapid 9.9-hour rotation—striped by turbulent ammonia cloud belts, the Great Red Spot, and live black transit shadows cast by Io, Europa, Ganymede, and Callisto.'
    },
    {
      id: 'saturn', name: 'Saturn', orbitR: 2.48, radius: 0.092, polarScale: 0.902, bump: 0.0, period: 29.457, rotSpd: 2.35, tilt: 0.466, inc: 0.04, phase: 2.5,
      pType: 5.0, colA: 0xc9a86a, colB: 0xfef0c7, atmoCol: 0xfde68a, atmoStr: 0.30, orbitCol: 0xfde047, hasRings: 'saturn',
      badge: 'Ringed Gas Giant • 274 Moons • Oblate', cls: '120,536 km Diameter • 9.8% Polar Flattening',
      radiusTxt: '9.58 AU (1.43B km)', vel: '9.7 km/s • 29.46 yr Orbit',
      desc: 'Strongly oblate gas giant flattened nearly 10% at the poles, encircled by water-ice rings with real-time ring shadows, the Cassini Division, Enceladus, and haze-shrouded Titan.'
    },
    {
      id: 'uranus', name: 'Uranus', orbitR: 3.04, radius: 0.064, polarScale: 0.977, bump: 0.0, period: 84.02, rotSpd: -1.6, tilt: 1.706, inc: 0.014, phase: 4.1,
      pType: 6.0, colA: 0x6ccad4, colB: 0xcff5fa, atmoCol: 0x7dd3fc, atmoStr: 0.48, orbitCol: 0x67e8f9, hasRings: 'uranus',
      badge: 'Ice Giant • 28 Moons • 97.8° Axial Tilt', cls: '51,118 km Diameter • Methane Ice',
      radiusTxt: '19.2 AU (2.87B km)', vel: '6.8 km/s • 84.0 yr Orbit',
      desc: 'Pale greenish-cyan ice giant rolling sideways on its orbit at a dramatic 97.8° axial tilt, encircled by faint vertical dark rings.'
    },
    {
      id: 'neptune', name: 'Neptune', orbitR: 3.56, radius: 0.062, polarScale: 0.983, bump: 0.0, period: 164.8, rotSpd: 1.75, tilt: 0.494, inc: 0.03, phase: 5.5,
      pType: 6.0, colA: 0x3b96b0, colB: 0x9be2f2, atmoCol: 0x67e8f9, atmoStr: 0.56, orbitCol: 0x38bdf8, neptuneTrueColor: true,
      badge: 'Outermost Ice Giant • True-Color 2024', cls: '49,528 km Diameter • Pale Greenish-Cyan',
      radiusTxt: '30.1 AU (4.52B km)', vel: '5.4 km/s • 164.8 yr Orbit',
      desc: 'Recalibrated to its true human-eye pale greenish-cyan hue (Hubble/Oxford 2024)—swept by the fastest winds in the Solar System (>2,000 km/h) and orbited by retrograde icy moon Triton.'
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

    // 1. The Sun (True-Color Space White G2V Photosphere + Amber Limb + Sunspots + 3D Coronal Streamers!)
    if (typeof SHADERS.createStarSurfaceMaterial === 'function') {
      const sunMat = SHADERS.createStarSurfaceMaterial({
        baseColor: 0xfff7e6,
        hotColor: 0xffffff,
        spotColor: 0x6b2f0b,
        cellScale: 6.4,
        pulseSpeed: 0.45,
        isSun: true
      });
      star3DMaterials.push(sunMat);
      const sunMesh = new THREE.Mesh(sharedUnitSphere, sunMat);
      sunMesh.scale.setScalar(0.23);
      sunMesh.renderOrder = 4;
      solarTiltGroup.add(sunMesh);
    }

    // Dynamic 3D Solar Corona Helmet Streamers & H-Alpha Magnetic Prominence Arches!
    if (typeof SHADERS.createSolarCoronaMaterial === 'function') {
      solarCoronaMat = SHADERS.createSolarCoronaMaterial();
      solarCoronaMesh = new THREE.Mesh(new THREE.PlaneGeometry(2.14, 2.14), solarCoronaMat);
      solarCoronaMesh.renderOrder = 5;
      solarTiltGroup.add(solarCoronaMesh);
    }

    const sunCorona = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: textures.starGlow,
        color: 0xfff6e5,
        transparent: true,
        opacity: 0.52,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    sunCorona.scale.setScalar(1.08);
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
      if (pl.id === 'earth') {
        // Real-Time Seasonal Axial Tilt Axis oriented to today's actual calendar date!
        const nowD = new Date();
        const startYr = new Date(nowD.getFullYear(), 0, 0);
        const dayOfYr = Math.floor((nowD - startYr) / 86400000);
        const seasonAngle = ((dayOfYr - 172) / 365.25) * Math.PI * 2; // 0 = June Solstice
        spinGroup.rotation.order = 'YXZ';
        spinGroup.rotation.y = pl.phase + seasonAngle;
        spinGroup.rotation.z = pl.tilt;
      } else {
        spinGroup.rotation.z = pl.tilt;
      }
      pivot.add(spinGroup);

      let pMat;
      if (pl.id === 'earth' && typeof SHADERS.createEarthOrbitalMaterial === 'function') {
        pMat = SHADERS.createEarthOrbitalMaterial(textures.starGlow);
        pMat.uniforms.uSunPos.value.copy(SOL_POS);
        earthOrbitalMat = pMat;
        planetShaderMaterials.push(pMat);
      } else if (typeof SHADERS.createPlanetMaterial === 'function') {
        pMat = SHADERS.createPlanetMaterial({
          planetType: pl.pType,
          colorA: pl.colA,
          colorB: pl.colB,
          atmoColor: pl.atmoCol,
          atmoStrength: pl.atmoStr,
          bumpStrength: pl.bump || 0.0,
          neptuneTrueColor: !!pl.neptuneTrueColor,
          hasMoonShadows: pl.id === 'jupiter',
          placeholderTex: textures.starGlow
        });
        pMat.uniforms.uSunPos.value.copy(SOL_POS);
        if (pl.id === 'jupiter') jupiterMat = pMat;
        planetShaderMaterials.push(pMat);
        const texFileMap = {
          mercury: '2k_mercury.jpg',
          venus: '2k_venus_surface.jpg',
          mars: '2k_mars.jpg',
          jupiter: '2k_jupiter.jpg',
          saturn: '2k_saturn.jpg',
          uranus: '2k_uranus.jpg',
          neptune: '2k_neptune.jpg'
        };
        if (texFileMap[pl.id]) {
          planetTextureTargets[pl.id] = { mat: pMat, file: texFileMap[pl.id] };
        }
      } else {
        pMat = new THREE.MeshBasicMaterial({ color: pl.colA });
      }

      const pScaleY = pl.polarScale || 1.0;
      const pMesh = new THREE.Mesh(sharedUnitSphere, pMat);
      pMesh.scale.set(pl.radius, pl.radius * pScaleY, pl.radius);
      pMesh.renderOrder = 4;
      spinGroup.add(pMesh);

      // Dedicated Drifting 3D Cloud Shell + Multi-Layer Rayleigh Atmosphere Glow Halo on Earth!
      if (pl.id === 'earth') {
        if (typeof SHADERS.createEarthCloudMaterial === 'function') {
          earthCloudMat = SHADERS.createEarthCloudMaterial(textures.starGlow);
          earthCloudMat.uniforms.uSunPos.value.copy(SOL_POS);
          planetShaderMaterials.push(earthCloudMat);
          earthCloudMesh = new THREE.Mesh(sharedUnitSphere, earthCloudMat);
          earthCloudMesh.scale.set(pl.radius * 1.018, pl.radius * 1.018 * pScaleY, pl.radius * 1.018);
          earthCloudMesh.renderOrder = 5;
          spinGroup.add(earthCloudMesh);
        }
        if (typeof SHADERS.createEarthAtmosphereMaterial === 'function') {
          earthAtmoMat = SHADERS.createEarthAtmosphereMaterial();
          earthAtmoMat.uniforms.uSunPos.value.copy(SOL_POS);
          const atmoMesh = new THREE.Mesh(sharedUnitSphere, earthAtmoMat);
          atmoMesh.scale.set(pl.radius * 1.062, pl.radius * 1.062 * pScaleY, pl.radius * 1.062);
          atmoMesh.renderOrder = 6;
          spinGroup.add(atmoMesh);
        }
      }

      // Saturn's Multi-Band Cassini Rings (with real-time planet-cast curved shadow!) / Uranus's Rings
      if (pl.hasRings === 'saturn') {
        let sRingMat;
        if (typeof SHADERS.createSaturnRingMaterial === 'function') {
          sRingMat = SHADERS.createSaturnRingMaterial(saturnRingTex, pl.radius);
          sRingMat.uniforms.uSunPos.value.copy(SOL_POS);
          saturnRingMat = sRingMat;
        } else {
          sRingMat = new THREE.MeshBasicMaterial({
            map: saturnRingTex,
            transparent: true,
            opacity: 0.92,
            side: THREE.DoubleSide,
            depthWrite: false
          });
        }
        const ringMesh = new THREE.Mesh(
          makeRadialRingGeo(pl.radius * 1.28, pl.radius * 2.42, 64),
          sRingMat
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

      // Earth's Moon (Luna — 3D Crater Bump Relief + Copper-Red Lunar Eclipse + Solar Eclipse Caster!)
      let moonPivot = null;
      if (pl.hasMoon) {
        moonPivot = new THREE.Group();
        pivot.add(moonPivot);
        const moonMat = typeof SHADERS.createPlanetMaterial === 'function'
          ? SHADERS.createPlanetMaterial({
              planetType: 0.0,
              colorA: 0x7a7a7e,
              colorB: 0xd4d4d8,
              atmoColor: 0x94a3b8,
              atmoStrength: 0.02,
              bumpStrength: 1.45,
              eclipseRed: true,
              placeholderTex: textures.starGlow
            })
          : new THREE.MeshBasicMaterial({ color: 0xd4d4d8 });
        if (moonMat.uniforms) {
          moonMat.uniforms.uSunPos.value.copy(SOL_POS);
          planetShaderMaterials.push(moonMat);
          planetTextureTargets.moon = { mat: moonMat, file: '2k_moon.jpg' };
        }
        const moonMesh = new THREE.Mesh(sharedUnitSphere, moonMat);
        moonMesh.scale.setScalar(0.013);
        moonMesh.position.set(0.095, 0.004, 0);
        moonPivot.add(moonMesh);
        earthMoonMesh = moonMesh;
        earthMoonMat = moonMat;
      }

      // Helper to create realistically Sun-lit 3D moons with crater bump relief
      function makeLitMoonMesh(colA, colB, sz) {
        const mMat = typeof SHADERS.createPlanetMaterial === 'function'
          ? SHADERS.createPlanetMaterial({
              planetType: 0.0,
              colorA: colA,
              colorB: colB,
              atmoColor: colB,
              atmoStrength: 0.03,
              bumpStrength: 0.95,
              placeholderTex: textures.starGlow
            })
          : new THREE.MeshBasicMaterial({ color: colB });
        if (mMat.uniforms) {
          mMat.uniforms.uSunPos.value.copy(SOL_POS);
          planetShaderMaterials.push(mMat);
        }
        const mm = new THREE.Mesh(sharedUnitSphere, mMat);
        mm.scale.setScalar(sz);
        return mm;
      }

      // Major Planetary Moons (Jupiter Galileans cast real transit shadows onto Jupiter's clouds!)
      const galMoons = [];
      if (pl.hasGalileans) {
        [
          { r: 0.15, sz: 0.010, colA: 0xb8860b, colB: 0xfde047, spd: 3.4, ph: 0.2, yAmp: 0.0 }, // Io (sulfur volcanoes)
          { r: 0.19, sz: 0.009, colA: 0x94a3b8, colB: 0xe0f2fe, spd: 2.2, ph: 1.7, yAmp: 0.0 }, // Europa (icy crust)
          { r: 0.24, sz: 0.013, colA: 0x78716c, colB: 0xd6d3d1, spd: 1.4, ph: 3.5, yAmp: 0.0 }, // Ganymede
          { r: 0.29, sz: 0.011, colA: 0x57534e, colB: 0xa8a29e, spd: 0.9, ph: 5.1, yAmp: 0.0 }  // Callisto
        ].forEach(function (gm) {
          const mm = makeLitMoonMesh(gm.colA, gm.colB, gm.sz);
          pivot.add(mm);
          galMoons.push({ mesh: mm, r: gm.r, sz: gm.sz, spd: gm.spd, ph: gm.ph, yAmp: gm.yAmp });
        });
      } else if (pl.id === 'mars') {
        [
          { r: 0.056, sz: 0.0052, colA: 0x6b6560, colB: 0xa8a29e, spd: 5.4, ph: 0.6, yAmp: 0.004 }, // Phobos
          { r: 0.082, sz: 0.0040, colA: 0x64625e, colB: 0x9ca3af, spd: 2.4, ph: 3.1, yAmp: 0.006 }  // Deimos
        ].forEach(function (gm) {
          const mm = makeLitMoonMesh(gm.colA, gm.colB, gm.sz);
          pivot.add(mm);
          galMoons.push({ mesh: mm, r: gm.r, sz: gm.sz, spd: gm.spd, ph: gm.ph, yAmp: gm.yAmp });
        });
      } else if (pl.id === 'saturn') {
        // Enceladus (icy bright plume moon) + Titan (thick golden-orange nitrogen-methane haze!)
        const encMesh = makeLitMoonMesh(0xcbd5e1, 0xf8fafc, 0.0078);
        pivot.add(encMesh);
        galMoons.push({ mesh: encMesh, r: 0.245, sz: 0.0078, spd: 2.8, ph: 1.2, yAmp: 0.005 });

        const titanGrp = new THREE.Group();
        const titanMat = typeof SHADERS.createPlanetMaterial === 'function'
          ? SHADERS.createPlanetMaterial({ planetType: 1.0, colorA: 0xc2781a, colorB: 0xf6c563, atmoColor: 0xf59e0b, atmoStrength: 0.72, placeholderTex: textures.starGlow })
          : new THREE.MeshBasicMaterial({ color: 0xf59e0b });
        if (titanMat.uniforms) {
          titanMat.uniforms.uSunPos.value.copy(SOL_POS);
          planetShaderMaterials.push(titanMat);
        }
        const titanMesh = new THREE.Mesh(sharedUnitSphere, titanMat);
        titanMesh.scale.setScalar(0.0155);
        titanGrp.add(titanMesh);
        pivot.add(titanGrp);
        galMoons.push({ mesh: titanGrp, r: 0.315, spd: 1.15, ph: 4.1, yAmp: 0.012 });
      } else if (pl.id === 'neptune') {
        // Triton (retrograde tilted icy moon!)
        const tritonMesh = new THREE.Mesh(sharedUnitSphere, new THREE.MeshBasicMaterial({ color: 0xddd6fe }));
        tritonMesh.scale.setScalar(0.011);
        pivot.add(tritonMesh);
        galMoons.push({ mesh: tritonMesh, r: 0.135, spd: -1.85, ph: 2.3, yAmp: 0.036 });
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
          size: 0.008,
          map: textures.starGlow,
          vertexColors: true,
          transparent: true,
          opacity: 0.55,
          blending: THREE.AdditiveBlending,
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
          size: 0.010,
          map: textures.starGlow,
          vertexColors: true,
          transparent: true,
          opacity: 0.45,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        })
      )
    );

    // -----------------------------------------------------------------------
    // 5. v16 OUTER SOLAR SYSTEM FRONTIER: DWARF PLANETS, COMET 3I/ATLAS,
    //    JWST (EARTH L2), VOYAGER 1 & 2 & TRANSLUCENT HELIOPAUSE BOW SHOCK!
    // -----------------------------------------------------------------------
    function registerSolarExtra(cfg) {
      solarExtraEntries.push(cfg);
      solarExtraMap[cfg.id] = cfg;
      CAT.INSPECTOR_LOOKUP[cfg.id] = {
        id: cfg.id,
        label: cfg.label,
        title: cfg.title,
        badge: cfg.badge,
        cls: cfg.cls,
        radius: cfg.radiusTxt,
        vel: cfg.vel,
        sector: 'Outer Solar System • Heliosphere',
        target: [SOL_POS.x, SOL_POS.y, SOL_POS.z],
        camPos: [SOL_POS.x + 0.6, SOL_POS.y + 0.4, SOL_POS.z + 0.8],
        isSolarExtra: true,
        desc: cfg.desc
      };
      if (CAT.DIRECTORY_TABS.stars && !CAT.DIRECTORY_TABS.stars.some(function (it) { return it.id === cfg.id; })) {
        CAT.DIRECTORY_TABS.stars.push({ id: cfg.id, label: cfg.label });
      }
    }

    // Helper for inclined eccentric Kepler orbits inside solarTiltGroup
    function makeTiltedEllipsePoints(a, e, inc, ascNode, argPeri, segs) {
      const pts = [];
      const b = a * Math.sqrt(Math.max(0.02, 1.0 - e * e));
      const cInc = Math.cos(inc), sInc = Math.sin(inc);
      const cOm = Math.cos(ascNode), sOm = Math.sin(ascNode);
      const cW = Math.cos(argPeri), sW = Math.sin(argPeri);
      for (let i = 0; i <= segs; i++) {
        const E = (i / segs) * Math.PI * 2;
        const ox = a * (Math.cos(E) - e);
        const oz = b * Math.sin(E);
        const x1 = ox * cW - oz * sW;
        const z1 = ox * sW + oz * cW;
        const y2 = z1 * sInc;
        const z2 = z1 * cInc;
        pts.push(new THREE.Vector3(x1 * cOm - z2 * sOm, y2, x1 * sOm + z2 * cOm));
      }
      return pts;
    }

    // A. Dwarf Planets & 2026 Rubin/Hubble Frontier (Pluto & Charon, 2026 ED138, 2017 OF201)
    const DWARF_DEFS = [
      {
        id: 'pluto', label: 'Pluto & Charon', title: 'Pluto & Charon (Binary Dwarf Planet)',
        a: 4.18, e: 0.249, inc: 0.299, ascNode: 1.92, argPeri: 1.98, period: 247.9, phase: 0.85,
        radius: 0.024, colA: 0x9c7b65, colB: 0xe6d5c3, orbitCol: 0xc084fc, hasCharon: true,
        badge: 'Kuiper Belt Binary • 5 Moons', cls: '2,377 km Diameter • Nitrogen Ice',
        radiusTxt: '39.5 AU (29.7–49.3 AU)', vel: '4.7 km/s • 248 yr Tilted Orbit',
        desc: 'Iconic icy world crowned by Tombaugh Regio’s bright nitrogen-ice heart, locked in a mutual binary dance with its giant moon Charon on a tilted 17.1° Kuiper Belt orbit.'
      },
      {
        id: 'ed138', label: '2026 ED138', title: '2026 ED138 (Vera Rubin Dwarf Planet Candidate)',
        a: 4.55, e: 0.14, inc: 0.44, ascNode: 3.45, argPeri: 1.15, period: 305.0, phase: 2.35,
        radius: 0.020, colA: 0x8a3b2c, colB: 0xd97757, orbitCol: 0x2dd4bf,
        badge: 'Vera C. Rubin Obs. • Oct 2026 Discovery', cls: '~600–1,500 km Est. • Reddish TNO',
        radiusTxt: '~46 AU (Beyond Pluto)', vel: 'Classical TNO • Tholin-Red Surface',
        desc: 'First dwarf planet candidate discovered in NSF–DOE Vera C. Rubin Observatory data (Oct 2026)—a large, bright reddish icy world hiding near the crowded Galactic plane beyond Pluto.'
      },
      {
        id: 'of201', label: '2017 OF201', title: '2017 OF201 (Extreme Wide-Orbit Dwarf Planet)',
        a: 5.15, e: 0.62, inc: 0.283, ascNode: 5.73, argPeri: 5.90, period: 420.0, phase: 0.42,
        radius: 0.019, colA: 0x924034, colB: 0xe08d6d, orbitCol: 0xf472b6,
        badge: 'Hubble Oct 2026 • Extreme TNO', cls: '~700 km Est. • 24,000-yr Orbit',
        radiusTxt: '~90.5 AU Now (44.9 – 1,612 AU)', vel: 'Sweeps Toward Inner Oort Cloud',
        desc: 'Detached trans-Neptunian dwarf planet candidate imaged by Hubble in October 2026—traveling an astonishingly elongated orbit stretching from 44.9 AU out past 1,600 AU.'
      }
    ];

    DWARF_DEFS.forEach(function (dw) {
      const oPts = makeTiltedEllipsePoints(dw.a, dw.e, dw.inc, dw.ascNode, dw.argPeri, 128);
      solarTiltGroup.add(
        new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(oPts),
          new THREE.LineBasicMaterial({
            color: dw.orbitCol,
            transparent: true,
            opacity: 0.34,
            blending: THREE.AdditiveBlending,
            depthWrite: false
          })
        )
      );

      const pivot = new THREE.Group();
      solarTiltGroup.add(pivot);

      const dMat = typeof SHADERS.createPlanetMaterial === 'function'
        ? SHADERS.createPlanetMaterial({ planetType: 0.0, colorA: dw.colA, colorB: dw.colB, atmoColor: dw.orbitCol, atmoStrength: 0.16, bumpStrength: 1.15, placeholderTex: textures.starGlow })
        : new THREE.MeshBasicMaterial({ color: dw.colB });
      if (dMat.uniforms) {
        dMat.uniforms.uSunPos.value.copy(SOL_POS);
        planetShaderMaterials.push(dMat);
      }
      const dMesh = new THREE.Mesh(sharedUnitSphere, dMat);
      dMesh.scale.setScalar(dw.radius);
      dMesh.renderOrder = 4;
      pivot.add(dMesh);

      let charonPivot = null;
      if (dw.hasCharon) {
        charonPivot = new THREE.Group();
        pivot.add(charonPivot);
        const chMesh = new THREE.Mesh(sharedUnitSphere, new THREE.MeshBasicMaterial({ color: 0xb8b2a8 }));
        chMesh.scale.setScalar(0.0115);
        chMesh.position.set(0.052, 0.004, 0);
        charonPivot.add(chMesh);
      }

      registerSolarExtra({
        id: dw.id,
        kind: 'dwarf',
        def: dw,
        pivot: pivot,
        mesh: dMesh,
        charonPivot: charonPivot,
        label: dw.label,
        title: dw.title,
        badge: dw.badge,
        cls: dw.cls,
        radiusTxt: dw.radiusTxt,
        vel: dw.vel,
        desc: dw.desc,
        followOffset: 0.046,
        worldPos: new THREE.Vector3()
      });
    });

    // B. Interstellar Comet 3I/ATLAS (C/2025 N1 — Hyperbolic Trajectory + CO2 Coma + Dual Tails!)
    const atlasCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-4.6,  1.25, -3.2),  // Incoming from interstellar Sagittarius direction
      new THREE.Vector3(-1.8,  0.42, -1.45),
      new THREE.Vector3( 0.45, -0.05, -1.02), // Perihelion (1.356 AU, Oct 29, 2025)
      new THREE.Vector3( 1.95, -0.18,  0.65), // Jupiter flyby (0.358 AU, Mar 16, 2026)
      new THREE.Vector3( 3.45, -0.45,  2.35), // Outbound past Jupiter (late 2026+)
      new THREE.Vector3( 5.40, -0.88,  4.35)  // Escaping toward Gemini & interstellar space!
    ]);
    solarTiltGroup.add(
      new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(atlasCurve.getPoints(96)),
        new THREE.LineBasicMaterial({
          color: 0x38bdf8,
          transparent: true,
          opacity: 0.56,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        })
      )
    );

    const atlasPivot = new THREE.Group();
    solarTiltGroup.add(atlasPivot);

    const atlasNucleus = new THREE.Mesh(sharedUnitSphere, new THREE.MeshBasicMaterial({ color: 0xe0f2fe }));
    atlasNucleus.scale.setScalar(0.014);
    atlasPivot.add(atlasNucleus);

    const atlasComa = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: textures.starGlow,
        color: 0x67e8f9,
        transparent: true,
        opacity: 0.92,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    atlasComa.scale.setScalar(0.18);
    atlasPivot.add(atlasComa);

    // Ion Tail (points strictly radially away from Sun!) & Curved Golden Dust Tail
    const ionTailGeo = new THREE.ConeGeometry(0.038, 0.72, 12, 1, true);
    ionTailGeo.translate(0, 0.36, 0);
    ionTailGeo.rotateX(Math.PI * 0.5); // Tip at origin, flares along +Z so lookAt aims tail away from Sun!
    const atlasIonTail = new THREE.Mesh(
      ionTailGeo,
      new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.52,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide
      })
    );
    atlasPivot.add(atlasIonTail);

    const dustTailGeo = new THREE.ConeGeometry(0.068, 0.54, 12, 1, true);
    dustTailGeo.translate(0, 0.27, 0);
    dustTailGeo.rotateX(Math.PI * 0.5);
    const atlasDustTail = new THREE.Mesh(
      dustTailGeo,
      new THREE.MeshBasicMaterial({
        color: 0xfde68a,
        transparent: true,
        opacity: 0.36,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide
      })
    );
    atlasPivot.add(atlasDustTail);

    registerSolarExtra({
      id: '3iatlas',
      kind: 'comet',
      curve: atlasCurve,
      pivot: atlasPivot,
      ionTail: atlasIonTail,
      dustTail: atlasDustTail,
      label: 'Comet 3I/ATLAS',
      title: '3I/ATLAS (3rd Confirmed Interstellar Visitor)',
      badge: 'ATLAS / JWST / ESA JUICE • Hyperbolic',
      cls: 'Interstellar Comet • e ≈ 6.14 • CO₂-Rich',
      radiusTxt: 'Outbound Past Jupiter (~5.5 AU)',
      vel: '~60 km/s Escape Velocity',
      desc: 'Discovered July 2025—only the third confirmed interstellar object ever seen crossing our Solar System. Passed perihelion Oct 2025 and Jupiter Mar 2026 with a CO₂-rich cyan coma and dual ion & dust tails.',
      followOffset: 0.065,
      worldPos: new THREE.Vector3()
    });

    // C. Deep-Space Probes: JWST (at Earth Sun-Earth L2) + Voyager 1 & Voyager 2
    function buildProbeVisual(colorHex, dishScale) {
      const grp = new THREE.Group();
      const dish = new THREE.Mesh(
        new THREE.ConeGeometry(dishScale, dishScale * 0.55, 14, 1, true),
        new THREE.MeshBasicMaterial({ color: colorHex, side: THREE.DoubleSide })
      );
      dish.rotation.x = Math.PI * 0.5;
      grp.add(dish);
      const beacon = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: textures.starGlow,
          color: colorHex,
          transparent: true,
          opacity: 0.88,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        })
      );
      beacon.scale.setScalar(dishScale * 5.2);
      grp.add(beacon);
      return grp;
    }

    // JWST parked just behind Earth's night side (Sun–Earth L2!)
    const jwstPivot = new THREE.Group();
    solarTiltGroup.add(jwstPivot);
    const jwstVis = buildProbeVisual(0xfacc15, 0.011);
    const jwstShield = new THREE.Mesh(
      new THREE.PlaneGeometry(0.026, 0.015),
      new THREE.MeshBasicMaterial({ color: 0xe2e8f0, side: THREE.DoubleSide })
    );
    jwstShield.rotation.x = Math.PI * 0.35;
    jwstVis.add(jwstShield);
    jwstPivot.add(jwstVis);
    registerSolarExtra({
      id: 'jwst',
      kind: 'jwst',
      pivot: jwstPivot,
      label: 'JWST (L2)',
      title: 'James Webb Space Telescope (Sun–Earth L2)',
      badge: 'NASA / ESA / CSA • Infrared Observatory',
      cls: '6.5 m Gold Mirror • 5-Layer Sunshield',
      radiusTxt: '1.5M km Beyond Earth (L2)',
      vel: 'Co-Orbiting Earth • Deep Space',
      desc: 'Humanity’s premier infrared space telescope orbiting the Sun–Earth L2 Lagrange point—shielded from Solar heat as it images Cosmic Dawn galaxies, exoplanet atmospheres, and 3I/ATLAS.',
      followOffset: 0.036,
      worldPos: new THREE.Vector3()
    });

    // Voyager 1 & Voyager 2 piercing the Heliopause Bow Shock into Interstellar Space!
    [
      {
        id: 'voyager1', label: 'Voyager 1', title: 'Voyager 1 (Interstellar Space)',
        dir: new THREE.Vector3(0.74, 0.44, -0.51).normalize(), dist: 5.55, col: 0xfbbf24,
        badge: 'NASA JPL • Launched 1977 • Golden Record',
        cls: 'Farthest Human-Made Object', radiusTxt: '~166+ AU (~23 Light-Hours)',
        vel: '16.9 km/s • Beyond Heliopause',
        desc: 'Humanity’s farthest emissary—having crossed the Heliopause into interstellar space in 2012, still transmitting plasma and cosmic-ray data from over 23 light-hours away.'
      },
      {
        id: 'voyager2', label: 'Voyager 2', title: 'Voyager 2 (Interstellar Space)',
        dir: new THREE.Vector3(0.68, -0.56, 0.47).normalize(), dist: 5.20, col: 0x38bdf8,
        badge: 'NASA JPL • Grand Tour Probe (1977)',
        cls: 'Visited All 4 Giant Planets', radiusTxt: '~139+ AU (~19 Light-Hours)',
        vel: '15.3 km/s • Southern Heliopause',
        desc: 'The only spacecraft to fly past Jupiter, Saturn, Uranus, and Neptune—now cruising south of the ecliptic beyond the Solar System’s Heliopause.'
      }
    ].forEach(function (vp) {
      const pEnd = vp.dir.clone().multiplyScalar(vp.dist);
      const trajPts = [
        new THREE.Vector3(0, 0, 0),
        vp.dir.clone().multiplyScalar(vp.dist * 0.42).add(new THREE.Vector3(0, 0.15, 0.35)),
        pEnd
      ];
      const tCurve = new THREE.CatmullRomCurve3(trajPts);
      solarTiltGroup.add(
        new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(tCurve.getPoints(40)),
          new THREE.LineBasicMaterial({
            color: vp.col,
            transparent: true,
            opacity: 0.42,
            blending: THREE.AdditiveBlending,
            depthWrite: false
          })
        )
      );

      const pivot = new THREE.Group();
      pivot.position.copy(pEnd);
      pivot.add(buildProbeVisual(vp.col, 0.018));
      solarTiltGroup.add(pivot);

      registerSolarExtra({
        id: vp.id,
        kind: 'probe',
        pivot: pivot,
        label: vp.label,
        title: vp.title,
        badge: vp.badge,
        cls: vp.cls,
        radiusTxt: vp.radiusTxt,
        vel: vp.vel,
        desc: vp.desc,
        followOffset: 0.055,
        worldPos: new THREE.Vector3()
      });
    });

    // D. Translucent Golden-Cyan Heliopause Bow-Shock Shell (~120 AU scaled boundary!)
    if (typeof SHADERS.createHeliopauseMaterial === 'function') {
      heliopauseMat = SHADERS.createHeliopauseMaterial();
      const helioGeo = new THREE.SphereGeometry(1.0, 32, 22);
      heliopauseMesh = new THREE.Mesh(helioGeo, heliopauseMat);
      // Elongated slightly toward the trailing heliotail (-X) with compressed bow nose (+X)
      heliopauseMesh.scale.set(5.45, 4.95, 5.10);
      heliopauseMesh.position.set(-0.45, 0, 0);
      heliopauseMesh.renderOrder = 2;
      solarTiltGroup.add(heliopauseMesh);
    }

    // Upgrade Sol's Inspector entry & Preset button to "Solar System"
    if (CAT.INSPECTOR_LOOKUP.sol) {
      CAT.INSPECTOR_LOOKUP.sol.label = 'Solar System';
      CAT.INSPECTOR_LOOKUP.sol.title = 'Our Solar System (Sun & 8 Planets)';
      CAT.INSPECTOR_LOOKUP.sol.badge = 'Home Planetary System • Orion Spur';
      CAT.INSPECTOR_LOOKUP.sol.cls = 'G2V Star • 8 Planets • 5 Dwarf Planets';
      CAT.INSPECTOR_LOOKUP.sol.radius = '8.18 kpc from Sgr A* (~26.7 kyr)';
      CAT.INSPECTOR_LOOKUP.sol.vel = '230 km/s • 230 Myr Galactic Year';
      CAT.INSPECTOR_LOOKUP.sol.target = [SOL_POS.x, SOL_POS.y, SOL_POS.z];
      CAT.INSPECTOR_LOOKUP.sol.camPos = [SOL_POS.x + 0.44, SOL_POS.y + 0.34, SOL_POS.z + 0.62];
      CAT.INSPECTOR_LOOKUP.sol.desc = 'Our home system orbiting the Milky Way’s Orion Spur—featuring the boiling G2V Sun, all 8 real-textured 3D planets, major moons (Luna, Galileans, Titan, Enceladus, Triton), Pluto & Charon, 2026 ED138, 2017 OF201, interstellar comet 3I/ATLAS, JWST, and Voyager 1 & 2 piercing the Heliopause!';
    }
    if (CAT.DIRECTORY_TABS.stars) {
      CAT.DIRECTORY_TABS.stars.forEach(function (it) {
        if (it.id === 'sol') it.label = 'Solar System';
      });
    }
  }

  const _solAwayTmp = new THREE.Vector3();
  const _solTargetTmp = new THREE.Vector3();
  const _solTangTmp = new THREE.Vector3();
  const _solDustDirTmp = new THREE.Vector3();
  const _solMoonWTmp = new THREE.Vector3();

  function updateSolarSystem(simTime) {
    const dSol = camera.position.distanceTo(SOL_POS);
    const active = dSol < 9.5;
    solarSystemGroup.visible = active;

    if (solFarSprite) {
      const farBlend = THREE.MathUtils.smoothstep(dSol, 0.55, 3.6);
      solFarSprite.material.opacity = 0.06 + 0.94 * farBlend;
      solFarSprite.scale.setScalar(solFarSpriteBase * (0.28 + 0.72 * farBlend));
    }
    if (!active) return;
    loadRealEarthTexturesOnce();
    if (earthCloudMesh && solarPlanetMap.earth) earthCloudMesh.rotation.y = simTime * solarPlanetMap.earth.def.rotSpd;

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
        const yOffM = gm.yAmp ? Math.sin(ga) * gm.yAmp : 0;
        gm.mesh.position.set(Math.cos(ga) * gm.r, yOffM, Math.sin(ga) * gm.r);
      }
    }

    // Update v16 Dwarf Planets (Pluto/Charon, 2026 ED138, 2017 OF201), Comet 3I/ATLAS, JWST & Heliopause!
    for (let e = 0; e < solarExtraEntries.length; e++) {
      const ex = solarExtraEntries[e];
      if (ex.kind === 'dwarf') {
        const dw = ex.def;
        const M = dw.phase + simTime * (0.65 / Math.pow(dw.period, 0.56));
        const E = solveKepler(M, dw.e);
        const b = dw.a * Math.sqrt(Math.max(0.02, 1.0 - dw.e * dw.e));
        const ox = dw.a * (Math.cos(E) - dw.e);
        const oz = b * Math.sin(E);
        const cInc = Math.cos(dw.inc), sInc = Math.sin(dw.inc);
        const cOm = Math.cos(dw.ascNode), sOm = Math.sin(dw.ascNode);
        const cW = Math.cos(dw.argPeri), sW = Math.sin(dw.argPeri);
        const x1 = ox * cW - oz * sW;
        const z1 = ox * sW + oz * cW;
        const y2 = z1 * sInc;
        const z2 = z1 * cInc;
        ex.pivot.position.set(x1 * cOm - z2 * sOm, y2, x1 * sOm + z2 * cOm);
        if (ex.mesh) ex.mesh.rotation.y = simTime * 0.85;
        if (ex.charonPivot) ex.charonPivot.rotation.y = simTime * 1.45;
      } else if (ex.kind === 'comet' && ex.curve) {
        // Glides smoothly along 3I/ATLAS's hyperbolic outbound escape trajectory!
        const t = (0.58 + simTime * 0.016) % 1.0;
        const cPos = ex.curve.getPoint(t);
        ex.pivot.position.copy(cPos);
        ex._cometLocalPos = cPos;
        ex._cometT = t;
      } else if (ex.kind === 'jwst' && solarPlanetMap.earth) {
        // Park JWST just past Earth on the anti-solar (Sun-Earth L2) vector!
        ex.pivot.position.copy(solarPlanetMap.earth.pivot.position).multiplyScalar(1.14);
      }
    }

    // Refresh world matrices BEFORE world-space lookAt() so comet tails & JWST aim accurately relative to Sol!
    solarSystemGroup.updateMatrixWorld(true);
    for (let e = 0; e < solarExtraEntries.length; e++) {
      const ex = solarExtraEntries[e];
      if (ex.kind === 'comet' && ex.curve && ex._cometLocalPos) {
        const cPos = ex._cometLocalPos;
        _solAwayTmp.copy(cPos).normalize();
        if (ex.ionTail) {
          _solTargetTmp.copy(cPos).add(_solAwayTmp);
          solarTiltGroup.localToWorld(_solTargetTmp);
          ex.ionTail.lookAt(_solTargetTmp);
        }
        if (ex.dustTail) {
          ex.curve.getTangent(ex._cometT, _solTangTmp);
          _solDustDirTmp.copy(_solAwayTmp).multiplyScalar(0.78).addScaledVector(_solTangTmp, -0.35).normalize();
          _solTargetTmp.copy(cPos).add(_solDustDirTmp);
          solarTiltGroup.localToWorld(_solTargetTmp);
          ex.dustTail.lookAt(_solTargetTmp);
        }
      } else if (ex.kind === 'jwst') {
        ex.pivot.lookAt(SOL_POS);
      }
    }

    if (heliopauseMat && heliopauseMesh) {
      heliopauseMat.uniforms.uTime.value = simTime;
      // Smoothly reveals the golden-cyan Heliopause shell when viewing the outer Solar System!
      const hFade = THREE.MathUtils.smoothstep(dSol, 0.55, 1.35) * (1.0 - THREE.MathUtils.smoothstep(dSol, 4.5, 8.8));
      heliopauseMat.uniforms.uOpacity.value = 0.42 * hFade;
      heliopauseMesh.visible = hFade > 0.01;
    }

    if (solarCoronaMesh && solarCoronaMat) {
      solarCoronaMesh.lookAt(camera.position);
      solarCoronaMat.uniforms.uTime.value = simTime;
    }

    solarSystemGroup.updateMatrixWorld(true);
    for (let i = 0; i < solarPlanetEntries.length; i++) {
      solarPlanetEntries[i].pivot.getWorldPosition(solarPlanetEntries[i].worldPos);
    }
    for (let e = 0; e < solarExtraEntries.length; e++) {
      solarExtraEntries[e].pivot.getWorldPosition(solarExtraEntries[e].worldPos);
    }

    // Live Earth <-> Moon Real Eclipse Shadow Coupling (Solar Eclipse Umbra & Copper-Red Blood Moon!)
    if (earthMoonMesh && solarPlanetMap.earth) {
      earthMoonMesh.getWorldPosition(_solMoonWTmp);
      const moonRWorld = 0.013 * SOLAR_SCALE;
      const earthRWorld = 0.046 * SOLAR_SCALE;
      if (earthOrbitalMat && earthOrbitalMat.uniforms.uMoonPos) {
        earthOrbitalMat.uniforms.uMoonPos.value.copy(_solMoonWTmp);
        earthOrbitalMat.uniforms.uMoonRadius.value = moonRWorld;
      }
      if (earthCloudMat && earthCloudMat.uniforms.uMoonPos) {
        earthCloudMat.uniforms.uMoonPos.value.copy(_solMoonWTmp);
        earthCloudMat.uniforms.uMoonRadius.value = moonRWorld;
      }
      if (earthMoonMat && earthMoonMat.uniforms && earthMoonMat.uniforms.uOccluderPos) {
        earthMoonMat.uniforms.uOccluderPos.value.copy(solarPlanetMap.earth.worldPos);
        earthMoonMat.uniforms.uOccluderRadius.value = earthRWorld;
      }
    }

    // Live Jupiter Galilean Moon Transit Shadow Coupling (Io, Europa, Ganymede, Callisto!)
    if (jupiterMat && jupiterMat.uniforms && solarPlanetMap.jupiter) {
      const gMoons = solarPlanetMap.jupiter.galMoons;
      const gTmp = _solMoonWTmp;
      for (let gi = 0; gi < Math.min(4, gMoons.length); gi++) {
        gMoons[gi].mesh.getWorldPosition(gTmp);
        const uKey = 'uShadowMoon' + gi;
        if (jupiterMat.uniforms[uKey]) {
          jupiterMat.uniforms[uKey].value.set(gTmp.x, gTmp.y, gTmp.z, (gMoons[gi].sz || 0.010) * SOLAR_SCALE * 1.15);
        }
      }
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
        const isRapidRot = (st.id === 'rigel' || st.id === 'altair' || st.id === 'sirius');
        const sMat = SHADERS.createStarSurfaceMaterial({
          baseColor: starCol.getHex(),
          hotColor: isRedGiant ? 0xffe4b5 : 0xffffff,
          spotColor: starCol.clone().multiplyScalar(isRedGiant ? 0.28 : 0.42).getHex(),
          cellScale: isRedGiant ? 3.2 : (isHotBlue ? 7.8 : 5.4),
          pulseSpeed: isRedGiant ? 0.28 : (st.isPulsar ? 1.8 : 0.52),
          convectionDisplace: isRedGiant ? 0.115 : 0.0,
          gravityDarken: isRapidRot ? 0.35 : 0.0
        });
        star3DMaterials.push(sMat);
        const sGeo = isRedGiant ? new THREE.SphereGeometry(1.0, 32, 24) : starSphereGeo;
        const mesh = new THREE.Mesh(sGeo, sMat);
        if (isRapidRot) {
          mesh.scale.set(visualR * 1.10, visualR * 0.94, visualR * 1.10);
        } else {
          mesh.scale.setScalar(visualR);
        }
        mesh.renderOrder = 4;
        bodyGroup.add(mesh);

        // Asymmetric dusty mass-loss shell for boiling Red Supergiants (Betelgeuse VLTI/ALMA ejecta!)
        if (isRedGiant) {
          const envSp = new THREE.Sprite(
            new THREE.SpriteMaterial({
              map: textures.nebulaPuff,
              color: 0xff6b2b,
              transparent: true,
              opacity: 0.36,
              blending: THREE.AdditiveBlending,
              depthWrite: false
            })
          );
          envSp.scale.setScalar(visualR * 4.8);
          bodyGroup.add(envSp);

          const plumeSp = new THREE.Sprite(
            new THREE.SpriteMaterial({
              map: textures.nebulaPuff,
              color: 0xd9532f,
              transparent: true,
              opacity: 0.26,
              blending: THREE.AdditiveBlending,
              depthWrite: false
            })
          );
          plumeSp.position.set(visualR * 0.65, visualR * 0.42, -visualR * 0.35);
          plumeSp.scale.set(visualR * 3.8, visualR * 2.6, 1);
          bodyGroup.add(plumeSp);
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
    const darkVerts = [];
    const darkCols = [];
    const darkData = []; // vec4(worldSize, opacity, rimWarmth, seed)
    const cTmp = new THREE.Color();
    const volNebGeo = new THREE.SphereGeometry(1.0, 26, 18);

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
      // Star-Blocking Dark Molecular Dust Pass (Pillars of Creation, Orion Bar, Carina Cliffs, Lagoon, Tarantula!)
      if (neb.isPillars || neb.id === 'orion' || neb.id === 'carina' || neb.id === 'lagoon' || neb.id === 'tarantula') {
        const dCount = neb.isPillars ? 72 : 42;
        const cRimDust = new THREE.Color(neb.isPillars ? 0xf59e0b : 0x38bdf8);
        for (let dk = 0; dk < dCount; dk++) {
          let dx = 0, dy = 0, dz = 0;
          let dSz = R * (0.28 + rng() * 0.30);
          if (neb.isPillars) {
            const colIdx = dk % 3;
            const hF = rng();
            dx = (colIdx - 1) * R * 0.34 + randGauss(rng) * R * (0.09 - hF * 0.03);
            dy = (hF - 0.48) * R * 1.24;
            dz = (colIdx - 1) * 0.18 + randGauss(rng) * R * 0.08;
            dSz = R * (0.28 - hF * 0.08 + rng() * 0.10);
          } else {
            // Sweeping foreground Bok-globule molecular dust ridge (like the Orion Bar & Carina Cliffs!)
            const tBar = rng() * 2.0 - 1.0;
            dx = tBar * R * 0.62 + randGauss(rng) * R * 0.14;
            dy = -R * 0.18 + tBar * R * 0.24 + randGauss(rng) * R * 0.12;
            dz = R * 0.26 + randGauss(rng) * R * 0.18;
          }
          darkVerts.push(nx + dx, ny + dy, nz + dz);
          darkCols.push(cRimDust.r, cRimDust.g, cRimDust.b);
          darkData.push(dSz, neb.isPillars ? 0.86 : 0.72, neb.isPillars ? 0.85 : 0.25, rng());
        }
      }

      // Distance-Culled 3D Volumetric Ray-Marched Hero Nebulae (Orion, Pillars of Creation, Helix & Ring!)
      if (typeof SHADERS.createVolumetricNebulaMaterial === 'function' && (neb.id === 'orion' || neb.isPillars || neb.id === 'helix' || neb.id === 'ringneb')) {
        const vKind = neb.isPillars ? 1.0 : (neb.id === 'orion' ? 0.0 : 2.0);
        const vMat = SHADERS.createVolumetricNebulaMaterial({
          nebKind: vKind,
          primaryColor: neb.colors[0] || 0x38bdf8,
          secondaryColor: neb.colors[1] || 0xf43f5e,
          rimColor: neb.colors[2] || 0xfbbf24
        });
        const vMesh = new THREE.Mesh(volNebGeo, vMat);
        vMesh.position.set(nx, ny, nz);
        const volR = R * 1.38;
        vMesh.scale.setScalar(volR);
        vMesh.frustumCulled = false;
        vMesh.visible = false;
        vMesh.renderOrder = 4;
        batchedNebulaGroup.add(vMesh);
        volumetricNebulaEntries.push({
          id: neb.id,
          mesh: vMesh,
          mat: vMat,
          worldPos: new THREE.Vector3(nx, ny, nz),
          radius: volR,
          maxDist: volR * 9.5
        });
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
        pSp.position.set(nx, ny, nz);
        pSp.scale.setScalar(1.55);
        landmarksGroup.add(pSp);
        pulsarSprites.push({ sprite: pSp, baseScale: 1.55, freq: 24.0 });
      }
    });

    // Draw Call A: Star-Blocking Dark Molecular Dust Absorption Pass (NormalBlending -> occludes background stars!)
    if (typeof SHADERS.createNebulaDarkDustMaterial === 'function' && darkVerts.length > 0) {
      const dGeo = new THREE.BufferGeometry();
      dGeo.setAttribute('position', new THREE.Float32BufferAttribute(darkVerts, 3));
      dGeo.setAttribute('color', new THREE.Float32BufferAttribute(darkCols, 3));
      dGeo.setAttribute('aDarkData', new THREE.Float32BufferAttribute(darkData, 4));

      batchedNebulaDarkMat = SHADERS.createNebulaDarkDustMaterial(textures.dustAtlas || textures.dustCloud);
      batchedNebulaDarkMat.uniforms.uPixelRatio.value = currentPR;
      batchedNebulaDarkMat.uniforms.uLodDensity.value = state.lodDensity;

      const darkPts = new THREE.Points(dGeo, batchedNebulaDarkMat);
      darkPts.frustumCulled = false;
      darkPts.renderOrder = 2; // Draws right over Milky Way stars before additive nebula glow!
      batchedNebulaGroup.add(darkPts);
    }

    // Draw Call B: Luminous Multi-Wavelength Ionized Emission Nebulae
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

  const EXTRA_3D_STARS = [
    {
      id: 'proximacen',
      name: 'Proxima Centauri (M5.5Ve Red Dwarf)',
      pos: [29.2, -0.65, 5.1],
      color: 0xff6a3d,
      size: 0.58,
      isDwarf: true,
      hotColor: 0xffb482,
      spotColor: 0x5c1408,
      cellScale: 4.4,
      pulseSpeed: 0.85,
      badge: 'Nearest Known Star • Alpha Centauri Triple',
      cls: 'Red Dwarf (M5.5Ve) • ~0.122 M☉',
      radiusTxt: '4.2465 ly from Sol (~1.30 pc)',
      vel: 'Flare Star • Proxima b/c Exoplanets',
      desc: 'Closest star to the Sun in the Alpha Centauri triple system—a turbulent red dwarf prone to energetic magnetic flares with rocky exoplanet Proxima b in its habitable zone.'
    },
    {
      id: 'vega',
      name: 'Vega (Alpha Lyrae A0V Blue-White Star)',
      pos: [22.4, 2.8, 0.6],
      color: 0x93c5fd,
      size: 1.25,
      hotColor: 0xf8fafc,
      spotColor: 0x1e3a8a,
      cellScale: 6.8,
      pulseSpeed: 0.62,
      badge: 'A0V Main-Sequence Star • Rapid Rotator',
      cls: 'Blue-White A0V • ~2.1 M☉ • Debris Disk',
      radiusTxt: '25.04 ly from Sol',
      vel: 'Rapid 12.5-hr Rotation (Oblate)',
      desc: 'Dazzling blue-white A0V star spinning rapidly once every 12.5 hours, giving it an oblate equatorial bulge and a wide cold dust debris disk.'
    },
    {
      id: 'antares',
      name: 'Antares (Alpha Scorpii Red Supergiant)',
      pos: [19.8, -1.85, -1.6],
      color: 0xff5424,
      size: 1.85,
      hotColor: 0xffd29d,
      spotColor: 0x6b1406,
      cellScale: 3.1,
      pulseSpeed: 0.26,
      badge: 'Red Supergiant • Scorpius–Centaurus',
      cls: 'M1.5Iab Supergiant • ~12 M☉',
      radiusTxt: '~550 ly from Sol (~680 R☉)',
      vel: 'Pulsating Supergiant • Pre-Supernova',
      desc: 'Crimson-orange supergiant rivaling the heart of Scorpius—bloated to roughly 680 times the Sun’s radius with giant churning convection cells.'
    },
    {
      id: 'vycma',
      name: 'VY Canis Majoris (Red Hypergiant)',
      pos: [32.4, -2.4, -2.1],
      color: 0xff451a,
      size: 2.05,
      hotColor: 0xffc278,
      spotColor: 0x590e04,
      cellScale: 2.9,
      pulseSpeed: 0.22,
      badge: 'Extreme Red Hypergiant • Asymmetric Ejecta',
      cls: 'M3–M4.5 Ia+ Hypergiant • ~15–17 M☉',
      radiusTxt: '~3,900 ly from Sol (~1,420 R☉)',
      vel: 'Episodic Mass-Loss Arcs & Clumps',
      desc: 'One of the largest known stars by volume, shedding massive asymmetric arcs of gas and dust in dramatic pre-collapse mass-loss episodes.'
    },
    {
      id: 'stephenson218',
      name: 'Stephenson 2-18 (RSGC1 Red Supergiant)',
      pos: [15.2, 0.9, 5.8],
      color: 0xff4b1e,
      size: 2.25,
      hotColor: 0xffc882,
      spotColor: 0x4d0b03,
      cellScale: 2.8,
      pulseSpeed: 0.20,
      badge: 'Scutum Red Supergiant Cluster (RSGC1)',
      cls: 'Extreme Red Supergiant • ~2,150 R☉ Est.',
      radiusTxt: '~19,000 ly in Scutum Arm',
      vel: 'Massive Inner-Galaxy Supergiant',
      desc: 'Member of the Stephenson 2 young cluster in Scutum, frequently cited among the most spatially expansive red supergiants known (~2,150 solar radii).'
    },
    {
      id: 'r136a1',
      name: 'R136a1 (Tarantula Wolf-Rayet / WNh Star)',
      pos: [-112 * EXT_SCALE + 2.2, -94 * EXT_SCALE + 1.4, 86 * EXT_SCALE + 1.8],
      color: 0x60a5fa,
      size: 1.95,
      hotColor: 0xe0f2fe,
      spotColor: 0x172554,
      cellScale: 8.2,
      pulseSpeed: 1.05,
      badge: '30 Doradus • Most Massive Known Star',
      cls: 'WNh Supermassive Star • ~170–230 M☉',
      radiusTxt: '161,000 ly (LMC Tarantula Core)',
      vel: 'Blistering Radiation-Driven Wind',
      desc: 'Anchor of the R136 super star cluster inside the Tarantula Nebula—one of the most luminous and massive stars known, driving fierce ultraviolet winds into the surrounding 30 Doradus nursery.'
    },
    {
      id: 'pistolstar',
      name: 'Pistol Star (Galactic Center LBV)',
      pos: [5.8, 0.45, -4.6],
      color: 0x7dd3fc,
      size: 1.65,
      hotColor: 0xf0f9ff,
      spotColor: 0x1e3a8a,
      cellScale: 7.4,
      pulseSpeed: 0.95,
      badge: 'Quintuplet Cluster • Luminous Blue Variable',
      cls: 'LBV Hypergiant • ~10M L☉ Bolometric',
      radiusTxt: '~25,000 ly near Galactic Center',
      vel: 'Ejected Pistol Nebula Shell',
      desc: 'Luminous blue variable star near the Galactic Center shining with roughly ten million times the Sun’s bolometric luminosity inside its surrounding Pistol Nebula.'
    }
  ];

  function buildExtraLandmarkStars() {
    const starSphereGeo = new THREE.SphereGeometry(1.0, 22, 16);
    EXTRA_3D_STARS.forEach(function (st) {
      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: textures.starGlow,
          color: st.color,
          transparent: true,
          opacity: 1.0,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        })
      );
      sprite.position.set(st.pos[0], st.pos[1], st.pos[2]);
      sprite.scale.setScalar(st.size * 2.1);
      landmarksGroup.add(sprite);

      const bodyGroup = new THREE.Group();
      bodyGroup.position.set(st.pos[0], st.pos[1], st.pos[2]);
      bodyGroup.visible = false;
      landmarksGroup.add(bodyGroup);

      const isRedGiant = st.cellScale < 4.6 && !st.isDwarf;
      const visualR = st.isDwarf
        ? 0.11
        : THREE.MathUtils.clamp(st.size * (isRedGiant ? 0.36 : 0.24), 0.16, 0.62);

      if (typeof SHADERS.createStarSurfaceMaterial === 'function') {
        const isVega = st.id === 'vega';
        const sMat = SHADERS.createStarSurfaceMaterial({
          baseColor: st.color,
          hotColor: st.hotColor,
          spotColor: st.spotColor,
          cellScale: st.cellScale,
          pulseSpeed: st.pulseSpeed,
          convectionDisplace: isRedGiant ? 0.125 : 0.0,
          gravityDarken: isVega ? 0.72 : 0.0
        });
        star3DMaterials.push(sMat);
        const sGeo = isRedGiant ? new THREE.SphereGeometry(1.0, 32, 24) : starSphereGeo;
        const mesh = new THREE.Mesh(sGeo, sMat);
        if (isVega) {
          // Vega: Rapid 12.5-hr rotator (~20% equatorial bulge + bright hot poles!)
          mesh.scale.set(visualR * 1.20, visualR * 0.90, visualR * 1.20);
        } else {
          mesh.scale.setScalar(visualR);
        }
        mesh.renderOrder = 4;
        bodyGroup.add(mesh);

        if (isVega) {
          // Subtle cold dusty debris disk around Vega!
          const vRingGeo = new THREE.RingGeometry(visualR * 2.1, visualR * 3.8, 48);
          vRingGeo.rotateX(-Math.PI * 0.5);
          const vRing = new THREE.Mesh(
            vRingGeo,
            new THREE.MeshBasicMaterial({
              color: 0x93c5fd,
              transparent: true,
              opacity: 0.18,
              side: THREE.DoubleSide,
              blending: THREE.AdditiveBlending,
              depthWrite: false
            })
          );
          vRing.rotation.set(0.24, 0, -0.16);
          bodyGroup.add(vRing);
        }

        if (isRedGiant) {
          const envSp = new THREE.Sprite(
            new THREE.SpriteMaterial({
              map: textures.nebulaPuff,
              color: st.color,
              transparent: true,
              opacity: 0.36,
              blending: THREE.AdditiveBlending,
              depthWrite: false
            })
          );
          envSp.scale.setScalar(visualR * 4.8);
          bodyGroup.add(envSp);

          // Asymmetric mass-loss ejecta plume (like VY CMa & Antares arcs!)
          const ejSp = new THREE.Sprite(
            new THREE.SpriteMaterial({
              map: textures.nebulaPuff,
              color: 0xd94826,
              transparent: true,
              opacity: 0.28,
              blending: THREE.AdditiveBlending,
              depthWrite: false
            })
          );
          ejSp.position.set(-visualR * 0.72, visualR * 0.45, visualR * 0.38);
          ejSp.scale.set(visualR * 4.2, visualR * 2.8, 1);
          bodyGroup.add(ejSp);
        }
      }

      const shortName = st.name.split(' (')[0];
      const pull = Math.max(1.45, visualR * 5.0);
      CAT.INSPECTOR_LOOKUP[st.id] = {
        id: st.id,
        label: shortName,
        title: st.name,
        badge: st.badge,
        cls: st.cls,
        radius: st.radiusTxt,
        vel: st.vel,
        sector: st.id === 'r136a1' ? 'Large Magellanic Cloud' : 'Milky Way Disk',
        target: st.pos,
        camPos: [st.pos[0] + pull * 0.72, st.pos[1] + pull * 0.45, st.pos[2] + pull],
        desc: st.desc
      };

      if (CAT.DIRECTORY_TABS.stars && !CAT.DIRECTORY_TABS.stars.some(function (it) { return it.id === st.id; })) {
        CAT.DIRECTORY_TABS.stars.push({ id: st.id, label: shortName });
      }

      registerLabel({
        id: st.id,
        text: shortName,
        meta: st.cls.split(' • ')[0],
        pos: [st.pos[0], st.pos[1] + visualR * 1.4 + 0.25, st.pos[2]],
        cssClass: 'label-star',
        minDist: 0.5,
        maxDist: st.id === 'r136a1' ? 320 * EXT_SCALE : 140
      });

      namedStar3DEntries.push({
        group: bodyGroup,
        sprite: sprite,
        baseScale: st.size * 2.1,
        worldPos: new THREE.Vector3(st.pos[0], st.pos[1], st.pos[2]),
        maxDist: 18.0,
        spinSpeed: isRedGiant ? 0.14 : 0.42
      });
    });
  }



  // -------------------------------------------------------------------------
  // 7B. REAL 3D ESA GAIA / HIPPARCOS CONSTELLATIONS AROUND SOL & EARTH (v14.1)
  //     Exact J2000 (RA, Dec, d_ly) -> Galactic (l, b) -> 3D Scene coordinates
  //     12 Iconic Constellations + Bright Navigational Stars | Only 2 Draw Calls!
  // -------------------------------------------------------------------------
  const gaiaGroup = new THREE.Group();
  gaiaGroup.visible = false;
  scene.add(gaiaGroup);
  let gaiaLineMat = null;
  let gaiaStarMat = null;
  const gaiaConstellationCentroids = [];

  // Real Hipparcos / Gaia DR3 J2000 Star Table: [key, raHours, decDeg, distLy, vMag, bvColor]
  const GAIA_BRIGHT_STARS = [
    // Orion
    ['betelgeuse', 5.9195,   7.4071,  548.0,  0.42,  1.85],
    ['rigel',      5.2423,  -8.2016,  863.0,  0.13, -0.03],
    ['bellatrix',  5.4189,   6.3497,  250.0,  1.64, -0.22],
    ['saiph',      5.7959,  -9.6696,  650.0,  2.09, -0.17],
    ['alnitak',    5.6793,  -1.9426, 1260.0,  1.77, -0.21],
    ['alnilam',    5.6036,  -1.2019, 1340.0,  1.69, -0.18],
    ['mintaka',    5.5334,  -0.2991, 1200.0,  2.23, -0.22],
    ['meissa',     5.5856,   9.9342, 1100.0,  3.39, -0.18],
    // Ursa Major (Big Dipper)
    ['dubhe',     11.0621,  61.7510,  123.0,  1.79,  1.07],
    ['merak',     11.0307,  56.3824,   79.7,  2.37, -0.02],
    ['phecda',    11.8972,  53.6948,   83.2,  2.44,  0.00],
    ['megrez',    12.2570,  57.0326,   80.5,  3.31,  0.08],
    ['alioth',    12.9005,  55.9598,   82.6,  1.77, -0.02],
    ['mizar',     13.3988,  54.9254,   82.9,  2.23,  0.02],
    ['alkaid',    13.7923,  49.3133,  103.9,  1.86, -0.19],
    // Cassiopeia
    ['caph',       0.1529,  59.1498,   54.7,  2.27,  0.34],
    ['schedar',    0.6751,  56.5373,  228.0,  2.23,  1.17],
    ['gammacas',   0.9451,  60.7167,  550.0,  2.47, -0.15],
    ['ruchbah',    1.4303,  60.2353,   99.4,  2.68,  0.13],
    ['segin',      1.9066,  63.6701,  440.0,  3.38, -0.15],
    // Scorpius
    ['antares',   16.4901, -26.4320,  550.0,  0.96,  1.83],
    ['graffias',  16.0906, -19.8055,  404.0,  2.62, -0.07],
    ['dschubba',  16.0055, -22.6217,  444.0,  2.32, -0.12],
    ['pisco',     15.9809, -26.1141,  590.0,  2.89, -0.19],
    ['tausco',    16.5981, -28.2160,  474.0,  2.82, -0.25],
    ['epssco',    16.8361, -34.2932,   63.7,  2.29,  1.15],
    ['zetasco',   16.9098, -42.3620,  150.0,  3.62,  1.35],
    ['sargas',    17.6219, -42.9978,  300.0,  1.87,  0.40],
    ['shaula',    17.5601, -37.1038,  570.0,  1.63, -0.22],
    ['lesath',    17.5127, -37.2958,  580.0,  2.69, -0.22],
    // Crux (Southern Cross)
    ['acrux',     12.4433, -63.0991,  321.0,  0.76, -0.24],
    ['mimosa',    12.7953, -59.6888,  280.0,  1.25, -0.23],
    ['gacrux',    12.5194, -57.1132,   88.6,  1.64,  1.59],
    ['imai',      12.2524, -58.7489,  345.0,  2.79, -0.23],
    // Canis Major
    ['sirius',     6.7525, -16.7161,    8.6, -1.46,  0.00],
    ['mirzam',     6.3783, -17.9559,  490.0,  1.98, -0.23],
    ['muliphein',  7.0626, -15.6333,  440.0,  4.11, -0.11],
    ['wezen',      7.1398, -26.3932, 1600.0,  1.83,  0.67],
    ['adhara',     6.9771, -28.9721,  430.0,  1.50, -0.21],
    ['aludra',     7.4016, -29.3031, 2000.0,  2.45, -0.08],
    ['furud',      6.3385, -30.0634,  362.0,  3.02, -0.19],
    // Leo
    ['regulus',   10.1395,  11.9672,   79.3,  1.35, -0.11],
    ['etaleo',    10.1222,  16.7627, 1270.0,  3.52, -0.03],
    ['algieba',   10.3329,  19.8415,  130.0,  2.08,  1.15],
    ['adhafera',  10.2782,  23.4173,  274.0,  3.44,  0.31],
    ['rasalas',    9.8794,  26.0070,  124.0,  3.88,  1.22],
    ['zosma',     11.2351,  20.5237,   58.4,  2.56,  0.12],
    ['chertan',   11.2373,  15.4296,  165.0,  3.33, -0.01],
    ['denebola',  11.8177,  14.5721,   35.9,  2.14,  0.09],
    // Cygnus (Northern Cross)
    ['deneb',     20.6905,  45.2803, 1425.0,  1.25,  0.09],
    ['sadr',      20.3705,  40.2567, 1800.0,  2.23,  0.67],
    ['albireo',   19.5120,  27.9597,  430.0,  3.08,  1.13],
    ['gienahcyg', 20.7702,  33.9703,   72.7,  2.48,  1.03],
    ['fawaris',   19.7496,  45.1308,  165.0,  2.87, -0.03],
    // Lyra
    ['vega',      18.6156,  38.7837,   25.0,  0.03,  0.00],
    ['epslyr',    18.7389,  39.6703,  162.0,  4.67,  0.18],
    ['zetalyr',   18.7462,  37.6051,  156.0,  4.36,  0.19],
    ['sheliak',   18.8347,  33.3627,  960.0,  3.52,  0.00],
    ['sulafat',   18.9824,  32.6896,  620.0,  3.25, -0.05],
    // Taurus
    ['aldebaran',  4.5987,  16.5093,   65.3,  0.86,  1.54],
    ['elnath',     5.4382,  28.6075,  134.0,  1.65, -0.13],
    ['zetatau',    5.6274,  21.1425,  440.0,  3.00, -0.18],
    ['ain',        4.4769,  19.1804,  147.0,  3.53,  1.01],
    ['hyadum1',    4.3299,  15.6276,  154.0,  3.65,  0.99],
    ['alcyone',    3.7914,  24.1051,  440.0,  2.87, -0.09],
    // Gemini
    ['castor',     7.5767,  31.8883,   51.0,  1.58,  0.03],
    ['pollux',     7.7553,  28.0262,   33.8,  1.14,  1.00],
    ['alhena',     6.6285,  16.3993,  109.0,  1.93,  0.00],
    ['wasat',      7.3355,  21.9823,   60.5,  3.53,  0.34],
    ['mebsuta',    6.7322,  25.1311,  840.0,  3.06,  1.40],
    ['tejat',      6.3827,  22.5136,  230.0,  2.87,  1.64],
    // Centaurus
    ['rigilkent', 14.6601, -60.8340,    4.34, -0.01,  0.71],
    ['hadar',     14.0637, -60.3730,  390.0,  0.61, -0.23],
    ['menkent',   14.1114, -36.3700,   58.8,  2.06,  1.01],
    ['muhlifain', 12.6919, -48.9599,  130.0,  2.17, -0.01],
    // Bright Navigational Anchors across the Full Sky
    ['polaris',    2.5303,  89.2641,  433.0,  1.98,  0.60],
    ['arcturus',  14.2610,  19.1824,   36.7, -0.05,  1.23],
    ['capella',    5.2782,  45.9980,   42.9,  0.08,  0.80],
    ['procyon',    7.6550,   5.2250,   11.5,  0.37,  0.42],
    ['altair',    19.8464,   8.8683,   16.7,  0.76,  0.22],
    ['spica',     13.4199, -11.1613,  250.0,  0.97, -0.23],
    ['fomalhaut', 22.9608, -29.6222,   25.1,  1.16,  0.09],
    ['canopus',    6.3992, -52.6957,  310.0, -0.74,  0.15],
    ['achernar',   1.6286, -57.2367,  139.0,  0.46, -0.16]
  ];

  const GAIA_CONSTELLATIONS = [
    { name: 'Orion',       edges: [['meissa','betelgeuse'],['meissa','bellatrix'],['betelgeuse','bellatrix'],['betelgeuse','alnitak'],['bellatrix','mintaka'],['mintaka','alnilam'],['alnilam','alnitak'],['alnitak','saiph'],['mintaka','rigel'],['rigel','saiph']] },
    { name: 'Ursa Major',  edges: [['dubhe','merak'],['merak','phecda'],['phecda','megrez'],['megrez','dubhe'],['megrez','alioth'],['alioth','mizar'],['mizar','alkaid']] },
    { name: 'Cassiopeia',  edges: [['caph','schedar'],['schedar','gammacas'],['gammacas','ruchbah'],['ruchbah','segin']] },
    { name: 'Scorpius',    edges: [['graffias','dschubba'],['dschubba','pisco'],['dschubba','antares'],['antares','tausco'],['tausco','epssco'],['epssco','zetasco'],['zetasco','sargas'],['sargas','shaula'],['shaula','lesath']] },
    { name: 'Crux',        edges: [['acrux','gacrux'],['mimosa','imai']] },
    { name: 'Canis Major', edges: [['mirzam','sirius'],['sirius','muliphein'],['sirius','wezen'],['wezen','adhara'],['wezen','aludra'],['adhara','furud']] },
    { name: 'Leo',         edges: [['rasalas','adhafera'],['adhafera','algieba'],['algieba','etaleo'],['etaleo','regulus'],['regulus','chertan'],['chertan','denebola'],['denebola','zosma'],['zosma','algieba'],['zosma','chertan']] },
    { name: 'Cygnus',      edges: [['deneb','sadr'],['sadr','albireo'],['gienahcyg','sadr'],['sadr','fawaris']] },
    { name: 'Lyra',        edges: [['vega','epslyr'],['vega','zetalyr'],['epslyr','zetalyr'],['zetalyr','sheliak'],['sheliak','sulafat'],['sulafat','zetalyr']] },
    { name: 'Taurus',      edges: [['elnath','ain'],['ain','hyadum1'],['hyadum1','aldebaran'],['aldebaran','zetatau'],['ain','alcyone']] },
    { name: 'Gemini',      edges: [['castor','pollux'],['castor','mebsuta'],['mebsuta','tejat'],['pollux','wasat'],['wasat','alhena']] },
    { name: 'Centaurus',   edges: [['rigilkent','hadar'],['hadar','muhlifain'],['muhlifain','menkent']] }
  ];

  function bvToColor(bv) {
    // Ballesteros blackbody approximation for real Hipparcos/Gaia B-V color index
    const c = new THREE.Color();
    if (bv < -0.10) c.setHex(0x9bbcff);      // O / B hot blue-white
    else if (bv < 0.15) c.setHex(0xdfeaff);  // A crisp blue-white
    else if (bv < 0.45) c.setHex(0xfff7e8);  // F ivory white
    else if (bv < 0.85) c.setHex(0xffe4a8);  // G solar yellow-white
    else if (bv < 1.35) c.setHex(0xffbe73);  // K warm orange
    else c.setHex(0xff844b);                 // M crimson-orange supergiant
    return c;
  }

  function buildGaiaConstellations() {
    // Orthonormal right-handed Galactic basis aligned to Milky Way (Sgr A* at origin, Sol at SOL_POS)
    const gcDir = new THREE.Vector3(-SOL_POS.x, 0, -SOL_POS.z).normalize();
    const northDir = new THREE.Vector3(0, 1, 0);
    const eastDir = new THREE.Vector3().crossVectors(northDir, gcDir).normalize();

    // Exact IAU J2000 Equatorial -> Galactic transformation constants
    const DEG = Math.PI / 180;
    const raNGP = 192.85948 * DEG;
    const decNGP = 27.12825 * DEG;
    const lNCP = 122.93192 * DEG;
    const sinDecNGP = Math.sin(decNGP);
    const cosDecNGP = Math.cos(decNGP);

    const starPosMap = {};
    const ptPos = new Float32Array(GAIA_BRIGHT_STARS.length * 3);
    const ptCol = new Float32Array(GAIA_BRIGHT_STARS.length * 3);

    GAIA_BRIGHT_STARS.forEach(function (row, idx) {
      const key = row[0];
      const ra = row[1] * 15.0 * DEG;
      const dec = row[2] * DEG;
      const distLy = row[3];
      const vMag = row[4];
      const bv = row[5];

      const sinDec = Math.sin(dec);
      const cosDec = Math.cos(dec);
      const dRa = ra - raNGP;

      const sinB = sinDecNGP * sinDec + cosDecNGP * cosDec * Math.cos(dRa);
      const b = Math.asin(THREE.MathUtils.clamp(sinB, -1.0, 1.0));
      const yG = cosDec * Math.sin(dRa);
      const xG = cosDecNGP * sinDec - sinDecNGP * cosDec * Math.cos(dRa);
      const l = lNCP - Math.atan2(yG, xG);

      const cosB = Math.cos(b);
      const gx = cosB * Math.cos(l);
      const gy = cosB * Math.sin(l);
      const gz = Math.sin(b);

      // Logarithmic 3D depth shell outside the 0.75-unit Kuiper Belt -> true 3D parallax!
      const rScene = 1.85 + Math.log10(1.0 + distLy * 0.45) * 4.4;
      const wp = new THREE.Vector3()
        .copy(SOL_POS)
        .addScaledVector(gcDir, gx * rScene)
        .addScaledVector(eastDir, gy * rScene)
        .addScaledVector(northDir, gz * rScene);

      starPosMap[key] = wp;
      ptPos[idx * 3] = wp.x;
      ptPos[idx * 3 + 1] = wp.y;
      ptPos[idx * 3 + 2] = wp.z;

      const col = bvToColor(bv);
      // Brighter Vmag stars glow slightly more intensely
      const lum = THREE.MathUtils.clamp(1.18 - vMag * 0.14, 0.52, 1.25);
      ptCol[idx * 3] = Math.min(1.0, col.r * lum);
      ptCol[idx * 3 + 1] = Math.min(1.0, col.g * lum);
      ptCol[idx * 3 + 2] = Math.min(1.0, col.b * lum);
    });

    // Draw Call 1: All 84 Real Gaia/Hipparcos Bright Stars in True 3D!
    const sGeo = new THREE.BufferGeometry();
    sGeo.setAttribute('position', new THREE.BufferAttribute(ptPos, 3));
    sGeo.setAttribute('color', new THREE.BufferAttribute(ptCol, 3));
    gaiaStarMat = new THREE.PointsMaterial({
      size: 0.095,
      map: textures.starGlow,
      vertexColors: true,
      transparent: true,
      opacity: 0.92,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const gaiaPts = new THREE.Points(sGeo, gaiaStarMat);
    gaiaPts.frustumCulled = false;
    gaiaPts.renderOrder = 3;
    gaiaGroup.add(gaiaPts);

    // Draw Call 2: Delicate 3D Constellation Stick-Lines connecting real stars!
    const lineVerts = [];
    const lineCols = [];
    const cLine = new THREE.Color(0x60a5fa);

    GAIA_CONSTELLATIONS.forEach(function (con) {
      const centroid = new THREE.Vector3();
      const seenKeys = {};
      let cCount = 0;

      con.edges.forEach(function (pair) {
        const p1 = starPosMap[pair[0]];
        const p2 = starPosMap[pair[1]];
        if (!p1 || !p2) return;
        lineVerts.push(p1.x, p1.y, p1.z, p2.x, p2.y, p2.z);
        lineCols.push(cLine.r, cLine.g, cLine.b, cLine.r, cLine.g, cLine.b);
        if (!seenKeys[pair[0]]) { seenKeys[pair[0]] = true; centroid.add(p1); cCount++; }
        if (!seenKeys[pair[1]]) { seenKeys[pair[1]] = true; centroid.add(p2); cCount++; }
      });

      if (cCount > 0) {
        centroid.divideScalar(cCount);
        gaiaConstellationCentroids.push({ name: con.name, pos: [centroid.x, centroid.y, centroid.z] });
      }
    });

    const lGeo = new THREE.BufferGeometry();
    lGeo.setAttribute('position', new THREE.Float32BufferAttribute(lineVerts, 3));
    lGeo.setAttribute('color', new THREE.Float32BufferAttribute(lineCols, 3));
    gaiaLineMat = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.28,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const gaiaLines = new THREE.LineSegments(lGeo, gaiaLineMat);
    gaiaLines.frustumCulled = false;
    gaiaLines.renderOrder = 2;
    gaiaGroup.add(gaiaLines);
  }


  // -------------------------------------------------------------------------
  // 7C. TRAPPIST-1 EXOPLANET SYSTEM (v17 — 40 ly from Sol, 7 Earth-Sized Worlds!)
  //     Ultra-cool M8V red dwarf + translucent emerald Habitable Zone ring
  //     + all 7 transiting rocky/oceanic exoplanets (b, c, d, e, f, g, h)!
  // -------------------------------------------------------------------------
  const TRAPPIST_POS = new THREE.Vector3(24.1, -1.65, 6.4);
  const trappistGroup = new THREE.Group();
  trappistGroup.visible = false;
  scene.add(trappistGroup);
  const trappistTiltGroup = new THREE.Group();
  trappistTiltGroup.rotation.set(0.32, -0.45, 0.24);
  trappistTiltGroup.scale.setScalar(0.14);
  trappistGroup.add(trappistTiltGroup);

  const trappistPlanetEntries = [];
  const trappistPlanetMap = {};
  let trappistFarSprite = null;

  const TRAPPIST_PLANETS_DEF = [
    { id: 'trappist1b', name: 'TRAPPIST-1b', orbitR: 0.42, radius: 0.038, period: 1.51, phase: 0.4,  pType: 0.0, colA: 0x5c2c24, colB: 0xa84a32, atmoCol: 0xf97316, atmoStr: 0.08, hz: false, desc: 'Innermost scorched rocky world orbiting TRAPPIST-1 in 1.51 days; JWST MIRI observations suggest a bare dark-rock surface with little or no atmosphere.' },
    { id: 'trappist1c', name: 'TRAPPIST-1c', orbitR: 0.58, radius: 0.037, period: 2.42, phase: 1.8,  pType: 0.0, colA: 0x6e3a28, colB: 0xc27b52, atmoCol: 0xfb923c, atmoStr: 0.14, hz: false, desc: 'Warm rocky world (~1.10 R⊕) completing an orbit every 2.42 days; JWST ruled out a thick Venus-like CO₂ atmosphere.' },
    { id: 'trappist1d', name: 'TRAPPIST-1d', orbitR: 0.78, radius: 0.029, period: 4.05, phase: 3.1,  pType: 3.0, colA: 0x7c4632, colB: 0xd99b66, atmoCol: 0xfbbf24, atmoStr: 0.26, hz: false, desc: 'Sub-Earth world (0.79 R⊕) sitting near the warm inner edge of TRAPPIST-1’s habitable zone.' },
    { id: 'trappist1e', name: 'TRAPPIST-1e', orbitR: 1.02, radius: 0.035, period: 6.10, phase: 4.4,  pType: 2.0, colA: 0x1d4ed8, colB: 0x10b981, atmoCol: 0x38bdf8, atmoStr: 0.65, hz: true,  desc: 'Prime habitable-zone Earth-sized candidate (0.92 R⊕, 6.1-day orbit) capable of sustaining liquid surface oceans under a secondary atmosphere.' },
    { id: 'trappist1f', name: 'TRAPPIST-1f', orbitR: 1.28, radius: 0.039, period: 9.21, phase: 5.5,  pType: 2.0, colA: 0x1e3a8a, colB: 0x7dd3fc, atmoCol: 0x60a5fa, atmoStr: 0.56, hz: true,  desc: 'Super-Earth (1.05 R⊕) orbiting squarely in TRAPPIST-1’s conservative habitable zone—potentially an icy water world.' },
    { id: 'trappist1g', name: 'TRAPPIST-1g', orbitR: 1.56, radius: 0.042, period: 12.35, phase: 0.9, pType: 6.0, colA: 0x1e40af, colB: 0x93c5fd, atmoCol: 0x38bdf8, atmoStr: 0.52, hz: true,  desc: 'Largest planet in the system (1.13 R⊕, 1.32 M⊕) patrolling the cool outer edge of TRAPPIST-1’s habitable zone.' },
    { id: 'trappist1h', name: 'TRAPPIST-1h', orbitR: 1.92, radius: 0.028, period: 18.77, phase: 2.6, pType: 0.0, colA: 0x475569, colB: 0xcbd5e1, atmoCol: 0x94a3b8, atmoStr: 0.22, hz: false, desc: 'Outermost frozen sub-Earth world (0.76 R⊕) locked in orbital resonance beyond the snow line.' }
  ];

  function buildTrappist1System() {
    trappistGroup.position.copy(TRAPPIST_POS);
    const sphereGeo = new THREE.SphereGeometry(1.0, 24, 18);

    // Distant red-dwarf star marker visible when exploring the Orion Spur
    trappistFarSprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: textures.starGlow,
        color: 0xff4b2b,
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    trappistFarSprite.position.copy(TRAPPIST_POS);
    trappistFarSprite.scale.setScalar(1.35);
    landmarksGroup.add(trappistFarSprite);

    // 1. Ultra-Cool M8V Red Dwarf Host Star TRAPPIST-1 (slightly larger than Jupiter!)
    if (typeof SHADERS.createStarSurfaceMaterial === 'function') {
      const tStarMat = SHADERS.createStarSurfaceMaterial({
        baseColor: 0xd92b1a,
        hotColor: 0xffa86b,
        spotColor: 0x3b0704,
        cellScale: 4.5,
        pulseSpeed: 0.92
      });
      star3DMaterials.push(tStarMat);
      const tStarMesh = new THREE.Mesh(sphereGeo, tStarMat);
      tStarMesh.scale.setScalar(0.18);
      tStarMesh.renderOrder = 4;
      trappistTiltGroup.add(tStarMesh);
    }

    const tCorona = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: textures.starGlow,
        color: 0xff5a36,
        transparent: true,
        opacity: 0.78,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    tCorona.scale.setScalar(0.75);
    trappistTiltGroup.add(tCorona);

    // 2. Translucent Emerald Habitable Zone Ring (spanning planets e, f, g!)
    const hzGeo = new THREE.RingGeometry(0.92, 1.66, 64);
    hzGeo.rotateX(-Math.PI * 0.5);
    const hzMesh = new THREE.Mesh(
      hzGeo,
      new THREE.MeshBasicMaterial({
        color: 0x10b981,
        transparent: true,
        opacity: 0.16,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    hzMesh.renderOrder = 2;
    trappistTiltGroup.add(hzMesh);

    // 3. All 7 Orbiting Earth-Sized Exoplanets
    TRAPPIST_PLANETS_DEF.forEach(function (pl) {
      const oPts = [];
      for (let i = 0; i <= 72; i++) {
        const a = (i / 72) * Math.PI * 2;
        oPts.push(new THREE.Vector3(Math.cos(a) * pl.orbitR, 0, Math.sin(a) * pl.orbitR));
      }
      trappistTiltGroup.add(
        new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(oPts),
          new THREE.LineBasicMaterial({
            color: pl.hz ? 0x34d399 : 0xf97316,
            transparent: true,
            opacity: pl.hz ? 0.36 : 0.22,
            blending: THREE.AdditiveBlending,
            depthWrite: false
          })
        )
      );

      const pivot = new THREE.Group();
      trappistTiltGroup.add(pivot);

      const pMat = typeof SHADERS.createPlanetMaterial === 'function'
        ? SHADERS.createPlanetMaterial({
            planetType: pl.pType,
            colorA: pl.colA,
            colorB: pl.colB,
            atmoColor: pl.atmoCol,
            atmoStrength: pl.atmoStr,
            placeholderTex: textures.starGlow
          })
        : new THREE.MeshBasicMaterial({ color: pl.colB });
      if (pMat.uniforms) {
        pMat.uniforms.uSunPos.value.copy(TRAPPIST_POS);
        planetShaderMaterials.push(pMat);
      }
      const pMesh = new THREE.Mesh(sphereGeo, pMat);
      pMesh.scale.setScalar(pl.radius);
      pMesh.renderOrder = 4;
      pivot.add(pMesh);

      const entry = { def: pl, pivot: pivot, pMesh: pMesh, followOffset: 0.038, worldPos: new THREE.Vector3() };
      trappistPlanetEntries.push(entry);
      trappistPlanetMap[pl.id] = entry;

      CAT.INSPECTOR_LOOKUP[pl.id] = {
        id: pl.id,
        label: pl.name,
        title: pl.name + (pl.hz ? ' (Habitable Zone Exoplanet)' : ' (Exoplanet)'),
        badge: 'JWST / Spitzer • 40.7 ly (Aquarius)',
        cls: pl.hz ? 'Habitable Zone Terrestrial' : 'Compact Resonant Exoplanet',
        radius: pl.period.toFixed(2) + ' d Orbital Period',
        vel: 'Tidally Locked to Red Dwarf',
        sector: 'TRAPPIST-1 System • Orion Spur',
        target: [TRAPPIST_POS.x, TRAPPIST_POS.y, TRAPPIST_POS.z],
        camPos: [TRAPPIST_POS.x + 0.35, TRAPPIST_POS.y + 0.25, TRAPPIST_POS.z + 0.45],
        isTrappistPlanet: true,
        desc: pl.desc
      };
    });

    // Register TRAPPIST-1 System in Inspector & Stars Directory Tab!
    CAT.INSPECTOR_LOOKUP.trappist1 = {
      id: 'trappist1',
      label: 'TRAPPIST-1',
      title: 'TRAPPIST-1 System (7 Earth-Sized Exoplanets)',
      badge: 'NASA JWST • 40.7 ly • 3 Habitable Zone Worlds',
      cls: 'M8V Ultra-Cool Red Dwarf • 7 Planets',
      radius: '40.66 ly from Sol (Aquarius)',
      vel: 'Orbits 1.5–18.8 d (All Inside Mercury)',
      sector: 'Local Neighborhood • Orion Spur',
      target: [TRAPPIST_POS.x, TRAPPIST_POS.y, TRAPPIST_POS.z],
      camPos: [TRAPPIST_POS.x + 0.26, TRAPPIST_POS.y + 0.22, TRAPPIST_POS.z + 0.36],
      desc: 'Remarkable compact exoplanet system 40.7 light-years from Earth: seven Earth-sized rocky worlds tightly packed around an ultra-cool red dwarf star, with planets e, f, and g orbiting inside the emerald Habitable Zone.'
    };
    if (CAT.DIRECTORY_TABS.stars && !CAT.DIRECTORY_TABS.stars.some(function (it) { return it.id === 'trappist1'; })) {
      CAT.DIRECTORY_TABS.stars.splice(1, 0, { id: 'trappist1', label: 'TRAPPIST-1 (7 Worlds)' });
    }
  }

  function updateTrappist1System(simTime) {
    const dT = camera.position.distanceTo(TRAPPIST_POS);
    const active = dT < 6.8;
    trappistGroup.visible = active;
    if (trappistFarSprite) {
      const farBlend = THREE.MathUtils.smoothstep(dT, 0.38, 2.4);
      trappistFarSprite.material.opacity = 0.08 + 0.88 * farBlend;
      trappistFarSprite.scale.setScalar(1.35 * (0.28 + 0.72 * farBlend));
    }
    if (!active) return;

    for (let i = 0; i < trappistPlanetEntries.length; i++) {
      const pe = trappistPlanetEntries[i];
      const pl = pe.def;
      const ang = pl.phase + simTime * (1.8 / Math.pow(pl.period, 0.72));
      pe.pivot.position.set(Math.cos(ang) * pl.orbitR, 0, Math.sin(ang) * pl.orbitR);
      pe.pMesh.rotation.y = -ang; // Tidally locked face toward TRAPPIST-1!
    }
    trappistGroup.updateMatrixWorld(true);
    for (let i = 0; i < trappistPlanetEntries.length; i++) {
      trappistPlanetEntries[i].pivot.getWorldPosition(trappistPlanetEntries[i].worldPos);
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
  // 8B. v17 3D VOLUMETRIC DARK MATTER HALOS (NFW), 1,800 ORBITING SUBHALOS,
  //     MW–M31 DARK MATTER BRIDGE & WEAK GRAVITATIONAL LENSING SHEAR ARCS!
  // -------------------------------------------------------------------------
  const darkMatterGroup = new THREE.Group();
  darkMatterGroup.visible = false;
  scene.add(darkMatterGroup);

  const dmHaloEntries = []; // { mesh, mat, worldPos, radius, maxDist }
  let dmSubhaloMat = null;
  let dmLensingArcMat = null;

  function buildDarkMatterSystem() {
    if (typeof SHADERS.createDarkMatterHaloMaterial !== 'function') return;
    const rng = makeRng(20268500);
    const unitSphere = new THREE.SphereGeometry(1.0, 28, 20);

    function addNFWHalo(posArr, radius, innerHex, outerHex, seedVal) {
      const mat = SHADERS.createDarkMatterHaloMaterial({
        innerColor: innerHex || 0xc084fc,
        outerColor: outerHex || 0x3730a3,
        seed: seedVal || rng() * 10.0
      });
      const mesh = new THREE.Mesh(unitSphere, mat);
      mesh.position.set(posArr[0], posArr[1], posArr[2]);
      mesh.scale.setScalar(radius);
      mesh.frustumCulled = false;
      mesh.renderOrder = -8;
      darkMatterGroup.add(mesh);

      dmHaloEntries.push({
        mesh: mesh,
        mat: mat,
        worldPos: new THREE.Vector3(posArr[0], posArr[1], posArr[2]),
        radius: radius,
        maxDist: radius * 42.0
      });
    }

    // 1. Major Galaxy NFW Dark Matter Halos (3.4x–4.5x wider than their visible stellar disks!)
    const DM_HERO_MULT = {
      milkyway: 3.6,
      m31: 3.8,
      m33: 3.4,
      m87: 4.5,
      m104: 3.4,
      ic1101: 4.2,
      alcyoneus: 3.8
    };
    const subVerts = [];
    const subCols = [];
    const cSub1 = new THREE.Color(0xa78bfa);
    const cSub2 = new THREE.Color(0x6366f1);
    const cSubHot = new THREE.Color(0xf0abfc);

    let mwPosVec = new THREE.Vector3(0, 0, 0);
    let m31PosVec = new THREE.Vector3(340 * EXT_SCALE, 68 * EXT_SCALE, -420 * EXT_SCALE);

    CAT.NAMED_GALAXIES.forEach(function (g, idx) {
      const mult = DM_HERO_MULT[g.id];
      if (!mult) return;
      const haloR = g.radius * mult;
      addNFWHalo(g.pos, haloR, 0xc084fc, 0x312e81, idx * 1.37 + 0.5);
      if (g.id === 'milkyway') mwPosVec.set(g.pos[0], g.pos[1], g.pos[2]);
      if (g.id === 'm31') m31PosVec.set(g.pos[0], g.pos[1], g.pos[2]);

      // Orbiting dark-matter subhalos (host dark halos for satellite dwarfs & stellar streams!)
      const subCnt = (g.id === 'milkyway' || g.id === 'm31') ? 190 : 85;
      for (let s = 0; s < subCnt; s++) {
        const rr = haloR * (0.24 + Math.pow(rng(), 0.72) * 0.78);
        const th = rng() * Math.PI * 2;
        const ph = Math.acos(2 * rng() - 1);
        subVerts.push(
          g.pos[0] + rr * Math.sin(ph) * Math.cos(th),
          g.pos[1] + rr * Math.cos(ph) * 0.90,
          g.pos[2] + rr * Math.sin(ph) * Math.sin(th)
        );
        const cc = rng() < 0.25 ? cSubHot : cSub1.clone().lerp(cSub2, rng());
        subCols.push(cc.r, cc.g, cc.b);
      }
    });

    // 2. Milky Way – Andromeda (M31) Dark Matter Tidal Bridge!
    for (let b = 0; b < 240; b++) {
      const t = rng();
      const px = THREE.MathUtils.lerp(mwPosVec.x, m31PosVec.x, t) + randGauss(rng) * 95 * EXT_SCALE;
      const py = THREE.MathUtils.lerp(mwPosVec.y, m31PosVec.y, t) + randGauss(rng) * 75 * EXT_SCALE;
      const pz = THREE.MathUtils.lerp(mwPosVec.z, m31PosVec.z, t) + randGauss(rng) * 95 * EXT_SCALE;
      subVerts.push(px, py, pz);
      const cc = cSub2.clone().lerp(cSub1, Math.sin(t * Math.PI));
      subCols.push(cc.r, cc.g, cc.b);
    }

    // 3. All 8 Galaxy Cluster NFW Dark Matter Wells + Upgraded Bullet Cluster Offset DM Lobes
    //    + Tangential Weak Gravitational Lensing Shear Arcs!
    const shearVerts = [];
    const shearCols = [];
    const cShear = new THREE.Color(0xc4b5fd);
    const uV = new THREE.Vector3();
    const vV = new THREE.Vector3();
    const nV = new THREE.Vector3();

    CAT.CLUSTERS.forEach(function (cl, idx) {
      if (cl.isBullet) {
        // Bullet Cluster: TWO massive offset collisionless dark-matter halos flanking the pink X-ray shock!
        const offX = cl.radius * 0.52;
        addNFWHalo([cl.pos[0] - offX, cl.pos[1], cl.pos[2]], cl.radius * 0.96, 0x818cf8, 0x1e3a8a, 11.2);
        addNFWHalo([cl.pos[0] + offX, cl.pos[1], cl.pos[2]], cl.radius * 0.88, 0x60a5fa, 0x1e3a8a, 14.8);
      } else {
        addNFWHalo(cl.pos, cl.radius * 1.55, 0xa855f7, 0x312e81, 20.0 + idx * 2.1);
      }

      // Cluster subhalos
      for (let s = 0; s < 95; s++) {
        const rr = cl.radius * (0.28 + Math.pow(rng(), 0.76) * 1.25);
        const th = rng() * Math.PI * 2;
        const ph = Math.acos(2 * rng() - 1);
        subVerts.push(
          cl.pos[0] + rr * Math.sin(ph) * Math.cos(th),
          cl.pos[1] + rr * Math.cos(ph) * 0.88,
          cl.pos[2] + rr * Math.sin(ph) * Math.sin(th)
        );
        const cc = cSub1.clone().lerp(cSubHot, rng() * 0.45);
        subCols.push(cc.r, cc.g, cc.b);
      }

      // Tangential Weak Gravitational Lensing Shear Arcs around each cluster's mass peak!
      nV.set(cl.pos[0], cl.pos[1], cl.pos[2]).normalize();
      uV.set(0, 1, 0);
      if (Math.abs(nV.dot(uV)) > 0.85) uV.set(1, 0, 0);
      uV.cross(nV).normalize();
      vV.crossVectors(nV, uV).normalize();

      const numRings = 2;
      for (let rg = 0; rg < numRings; rg++) {
        const ringR = cl.radius * (0.85 + rg * 0.48);
        const ticks = 28;
        for (let t = 0; t < ticks; t++) {
          const a0 = (t / ticks) * Math.PI * 2 + rg * 0.14;
          const a1 = a0 + 0.13;
          const x0 = cl.pos[0] + (uV.x * Math.cos(a0) + vV.x * Math.sin(a0)) * ringR;
          const y0 = cl.pos[1] + (uV.y * Math.cos(a0) + vV.y * Math.sin(a0)) * ringR;
          const z0 = cl.pos[2] + (uV.z * Math.cos(a0) + vV.z * Math.sin(a0)) * ringR;
          const x1 = cl.pos[0] + (uV.x * Math.cos(a1) + vV.x * Math.sin(a1)) * ringR;
          const y1 = cl.pos[1] + (uV.y * Math.cos(a1) + vV.y * Math.sin(a1)) * ringR;
          const z1 = cl.pos[2] + (uV.z * Math.cos(a1) + vV.z * Math.sin(a1)) * ringR;
          shearVerts.push(x0, y0, z0, x1, y1, z1);
          shearCols.push(cShear.r, cShear.g, cShear.b, cShear.r, cShear.g, cShear.b);
        }
      }
    });

    // Batched Subhalos (1 GPU Draw Call!)
    const subGeo = new THREE.BufferGeometry();
    subGeo.setAttribute('position', new THREE.Float32BufferAttribute(subVerts, 3));
    subGeo.setAttribute('color', new THREE.Float32BufferAttribute(subCols, 3));
    dmSubhaloMat = new THREE.PointsMaterial({
      size: 8.0,
      map: textures.nebulaPuff,
      vertexColors: true,
      transparent: true,
      opacity: 0.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const subPts = new THREE.Points(subGeo, dmSubhaloMat);
    subPts.frustumCulled = false;
    subPts.renderOrder = -7;
    darkMatterGroup.add(subPts);

    // Batched Weak-Lensing Tangential Shear Arcs (1 GPU Draw Call!)
    const shGeo = new THREE.BufferGeometry();
    shGeo.setAttribute('position', new THREE.Float32BufferAttribute(shearVerts, 3));
    shGeo.setAttribute('color', new THREE.Float32BufferAttribute(shearCols, 3));
    dmLensingArcMat = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const shLines = new THREE.LineSegments(shGeo, dmLensingArcMat);
    shLines.frustumCulled = false;
    shLines.renderOrder = -6;
    darkMatterGroup.add(shLines);
  }

  // -------------------------------------------------------------------------
  // 9. REALISTIC LANIAKEA SUPERCLUSTER (Tully, Pomarède & Cosmicflows-4)
  //    * 260 Interior Feathery Flow Streamlines converging into Great Attractor
  //    * 64 Exterior Diverging Watershed Streamlines peeling away toward
  //      Perseus–Pisces, Coma & Shapley (shows dynamical watershed divide!)
  //    * Distinct Sub-Basins: Virgo, Hydra–Centaurus, Norma Wall / GA,
  //      Pavo–Indus, Vela Supercluster & Zone of Avoidance Dust Plane
  //    * Peculiar-Velocity Acceleration Pulses (slow at watershed -> fast in core)
  // -------------------------------------------------------------------------
  const laniakeaGroup = new THREE.Group();
  laniakeaGroup.visible = false;
  scene.add(laniakeaGroup);
  const streamlineCurves = [];
  let flowPulsePoints = null;
  let flowPulseData = [];
  let laniakeaMistMat = null;
  let laniakeaLineMat = null;
  let laniakeaGalMat = null;
  let laniakeaContourMat = null;
  let laniakeaPulseMat = null;
  let laniakeaZoaMat = null;
  let laniakeaSubLandmarks = [];

  function buildLaniakea() {
    const L = CAT.LANIAKEA;
    const rng = makeRng(520520);

    const center = new THREE.Vector3(L.center[0], L.center[1], L.center[2]);
    const attractor = new THREE.Vector3(L.attractor[0], L.attractor[1], L.attractor[2]);
    const localVoid = new THREE.Vector3(L.localVoid[0], L.localVoid[1], L.localVoid[2]);
    const virgoPt = new THREE.Vector3(-680 * EXT_SCALE, 110 * EXT_SCALE, -1550 * EXT_SCALE);

    // Key anatomical Laniakea & Cosmicflows-4 sub-basins
    const hydraCentPt = attractor.clone().lerp(virgoPt, 0.38).add(new THREE.Vector3(-420 * EXT_SCALE, -180 * EXT_SCALE, 260 * EXT_SCALE));
    const pavoIndusPt = attractor.clone().add(new THREE.Vector3(1450 * EXT_SCALE, -780 * EXT_SCALE, 1320 * EXT_SCALE));
    const antliaWallPt = attractor.clone().add(new THREE.Vector3(-1580 * EXT_SCALE, 640 * EXT_SCALE, -920 * EXT_SCALE));
    const velaPt = attractor.clone().add(new THREE.Vector3(1120 * EXT_SCALE, 140 * EXT_SCALE, -1380 * EXT_SCALE));
    const ophiuchusPt = attractor.clone().add(new THREE.Vector3(-1350 * EXT_SCALE, -620 * EXT_SCALE, -1680 * EXT_SCALE));
    const shapleyPt = ophiuchusPt.clone().add(new THREE.Vector3(-1450 * EXT_SCALE, -520 * EXT_SCALE, -1650 * EXT_SCALE));
    const perseusPiscesPt = new THREE.Vector3(2450 * EXT_SCALE, 420 * EXT_SCALE, 2380 * EXT_SCALE);
    const comaWallPt = new THREE.Vector3(-2380 * EXT_SCALE, 1280 * EXT_SCALE, -1950 * EXT_SCALE);

    laniakeaSubLandmarks = [
      { id: 'laniakea', text: 'Great Attractor (Norma)', meta: 'Peculiar Velocity Sink • ~600 km/s', pos: [attractor.x, attractor.y + 340 * EXT_SCALE, attractor.z], css: 'label-bh' },
      { id: 'laniakea', text: 'Hydra–Centaurus', meta: 'Primary Infall Trunk', pos: [hydraCentPt.x, hydraCentPt.y + 280 * EXT_SCALE, hydraCentPt.z], css: 'label-cosmic' },
      { id: 'laniakea', text: 'Pavo–Indus Strand', meta: 'Southern Laniakea Lobe', pos: [pavoIndusPt.x, pavoIndusPt.y + 280 * EXT_SCALE, pavoIndusPt.z], css: 'label-cosmic' },
      { id: 'laniakea', text: 'Vela Supercluster', meta: 'Zone of Avoidance • 21cm HI', pos: [velaPt.x, velaPt.y + 280 * EXT_SCALE, velaPt.z], css: 'label-cosmic' },
      { id: 'laniakea', text: 'Local Void', meta: 'Empty Expansion Repeller', pos: [localVoid.x, localVoid.y + 260 * EXT_SCALE, localVoid.z], css: 'label-arm' },
      { id: 'laniakea', text: 'Shapley Flow →', meta: 'Cosmicflows-4 Bulk Stream', pos: [shapleyPt.x, shapleyPt.y + 320 * EXT_SCALE, shapleyPt.z], css: 'label-cosmic' },
      { id: 'laniakea', text: '← Perseus–Pisces Watershed', meta: 'Diverging Exterior Basin', pos: [perseusPiscesPt.x, perseusPiscesPt.y + 300 * EXT_SCALE, perseusPiscesPt.z], css: 'label-arm' }
    ];

    const rx = L.radii[0], ry = L.radii[1], rz = L.radii[2];

    // 1. Organic Velocity-Divergence Watershed Contours (Amber-Gold Ridge Dividing Infall vs Outflow!)
    const contourVerts = [];
    const contourCols = [];
    const cOrange = new THREE.Color(0xf59e0b);
    const cOrangeDim = new THREE.Color(0x9a3412);
    const contourPlanes = [
      { tiltX: 0.18, tiltY: 0.0,  tiltZ: 0.14, scale: 1.02 },
      { tiltX: 1.32, tiltY: 0.55, tiltZ: -0.25, scale: 0.98 },
      { tiltX: -0.95, tiltY: 1.10, tiltZ: 0.42, scale: 0.96 }
    ];
    const cQuat = new THREE.Quaternion();
    const cEuler = new THREE.Euler();
    const pA = new THREE.Vector3();
    const pB = new THREE.Vector3();

    contourPlanes.forEach(function (cp) {
      cEuler.set(cp.tiltX, cp.tiltY, cp.tiltZ);
      cQuat.setFromEuler(cEuler);
      const segs = 96;
      for (let s = 0; s < segs; s++) {
        if (s % 5 === 4) continue;
        const a0 = (s / segs) * Math.PI * 2;
        const a1 = ((s + 1) / segs) * Math.PI * 2;
        const w0 = 1.0 + 0.11 * Math.sin(a0 * 3.0 + cp.tiltY) + 0.06 * Math.cos(a0 * 5.0);
        const w1 = 1.0 + 0.11 * Math.sin(a1 * 3.0 + cp.tiltY) + 0.06 * Math.cos(a1 * 5.0);
        pA.set(Math.cos(a0) * rx * cp.scale * w0, Math.sin(a0) * ry * 0.42 * w0, Math.sin(a0) * rz * cp.scale * w0).applyQuaternion(cQuat).add(center);
        pB.set(Math.cos(a1) * rx * cp.scale * w1, Math.sin(a1) * ry * 0.42 * w1, Math.sin(a1) * rz * cp.scale * w1).applyQuaternion(cQuat).add(center);
        contourVerts.push(pA.x, pA.y, pA.z, pB.x, pB.y, pB.z);
        const col = (s % 2 === 0) ? cOrange : cOrangeDim;
        contourCols.push(col.r, col.g, col.b, col.r, col.g, col.b);
      }
    });

    const contourGeo = new THREE.BufferGeometry();
    contourGeo.setAttribute('position', new THREE.Float32BufferAttribute(contourVerts, 3));
    contourGeo.setAttribute('color', new THREE.Float32BufferAttribute(contourCols, 3));
    laniakeaContourMat = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.26,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    laniakeaGroup.add(new THREE.LineSegments(contourGeo, laniakeaContourMat));

    // 2. Feathery Peculiar-Velocity Streamlines:
    //    * 260 Interior Laniakea Streams converging into the Great Attractor
    //    * 64 Exterior Diverging Streams peeling away across the watershed toward
    //      Perseus–Pisces, Coma & Shapley (visually proves Laniakea is a flow basin!)
    const segVerts = [];
    const segCols = [];

    const cRimIce = new THREE.Color(0x5eead4);      // Slow watershed divide (~150-250 km/s)
    const cFeather = new THREE.Color(0xe2f1ff);     // Mid-filament peculiar stream (~350-450 km/s)
    const cAttractor = new THREE.Color(0xffb84d);   // Fast Great Attractor / Norma convergence (~600 km/s)
    const cMWGold = new THREE.Color(0xfde047);      // Milky Way -> Virgo -> Hydra-Centaurus -> GA highway
    const cShapley = new THREE.Color(0xf472b6);     // Cosmicflows-4 bulk flow toward Shapley
    const cExterior = new THREE.Color(0x38bdf8);    // Diverging exterior Perseus-Pisces / Coma flows

    const tributaryAnchors = [
      { pt: virgoPt,      weight: 0.25, spread: 400 * EXT_SCALE },
      { pt: pavoIndusPt,  weight: 0.23, spread: 540 * EXT_SCALE },
      { pt: antliaWallPt, weight: 0.20, spread: 500 * EXT_SCALE },
      { pt: velaPt,       weight: 0.16, spread: 460 * EXT_SCALE },
      { pt: ophiuchusPt,  weight: 0.16, spread: 520 * EXT_SCALE }
    ];

    const exteriorTargets = [perseusPiscesPt, comaWallPt, shapleyPt];
    const NUM_INTERIOR = 260;
    const NUM_EXTERIOR = 64;
    const TOTAL_STREAMS = NUM_INTERIOR + NUM_EXTERIOR;

    for (let s = 0; s < TOTAL_STREAMS; s++) {
      let curve;
      const isPrimaryMW = (s === 0);
      const isShapleyBridge = (s >= 1 && s <= 18);
      const isExterior = (s >= NUM_INTERIOR);

      if (isPrimaryMW) {
        // Milky Way -> Local Sheet -> Virgo Cluster -> Hydra-Centaurus -> Great Attractor
        curve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(0, 0, 0),
          new THREE.Vector3(-340 * EXT_SCALE, 80 * EXT_SCALE, -780 * EXT_SCALE),
          virgoPt.clone(),
          hydraCentPt.clone(),
          attractor.clone()
        ]);
      } else if (isShapleyBridge) {
        // Cosmicflows-4 onward bulk stream: Great Attractor -> Ophiuchus -> Shapley Concentration
        const off1 = new THREE.Vector3(randGauss(rng) * 320 * EXT_SCALE, randGauss(rng) * 260 * EXT_SCALE, randGauss(rng) * 320 * EXT_SCALE);
        const off2 = new THREE.Vector3(randGauss(rng) * 580 * EXT_SCALE, randGauss(rng) * 440 * EXT_SCALE, randGauss(rng) * 580 * EXT_SCALE);
        curve = new THREE.CatmullRomCurve3([
          attractor.clone().add(off1.clone().multiplyScalar(0.35)),
          attractor.clone().lerp(ophiuchusPt, 0.55).add(off1),
          ophiuchusPt.clone().add(off2.clone().multiplyScalar(0.45)),
          shapleyPt.clone().add(off2)
        ]);
      } else if (isExterior) {
        // Exterior Diverging Watershed Streamlines peeling AWAY from Laniakea toward neighboring basins!
        const extTarget = exteriorTargets[(s - NUM_INTERIOR) % exteriorTargets.length];
        const outDir = extTarget.clone().sub(center).normalize();
        const jitter = new THREE.Vector3(randGauss(rng) * 0.42, randGauss(rng) * 0.36, randGauss(rng) * 0.42);
        const rimDir = outDir.clone().add(jitter).normalize();
        const startRim = new THREE.Vector3(
          center.x + rimDir.x * rx * 1.03,
          center.y + rimDir.y * ry * 0.90,
          center.z + rimDir.z * rz * 1.03
        );
        const midOut = startRim.clone().lerp(extTarget, 0.48).add(new THREE.Vector3(
          randGauss(rng) * 460 * EXT_SCALE,
          randGauss(rng) * 360 * EXT_SCALE,
          randGauss(rng) * 460 * EXT_SCALE
        ));
        const endOut = extTarget.clone().add(new THREE.Vector3(
          randGauss(rng) * 680 * EXT_SCALE,
          randGauss(rng) * 520 * EXT_SCALE,
          randGauss(rng) * 680 * EXT_SCALE
        ));
        curve = new THREE.CatmullRomCurve3([startRim, midOut, endOut]);
      } else {
        // Interior Laniakea tributary filaments converging into Great Attractor
        let rPick = rng();
        let trib = tributaryAnchors[0];
        for (let tIdx = 0; tIdx < tributaryAnchors.length; tIdx++) {
          if (rPick <= tributaryAnchors[tIdx].weight) { trib = tributaryAnchors[tIdx]; break; }
          rPick -= tributaryAnchors[tIdx].weight;
        }

        const dirFromCenter = trib.pt.clone().sub(center).normalize();
        const jitter = new THREE.Vector3(randGauss(rng) * 0.72, randGauss(rng) * 0.58, randGauss(rng) * 0.72);
        const launchDir = dirFromCenter.add(jitter).normalize();
        const rFrac = 0.76 + rng() * 0.26;
        const startPt = new THREE.Vector3(
          center.x + launchDir.x * rx * rFrac,
          center.y + launchDir.y * ry * rFrac * 0.86,
          center.z + launchDir.z * rz * rFrac
        );

        // Push streamlines out of the empty Local Void repeller cavity
        const vDiff = startPt.clone().sub(localVoid);
        if (vDiff.length() < 920 * EXT_SCALE) {
          startPt.add(vDiff.normalize().multiplyScalar(920 * EXT_SCALE - vDiff.length()));
        }

        const wp1 = startPt.clone().lerp(trib.pt, 0.55).add(new THREE.Vector3(
          randGauss(rng) * trib.spread * 0.65,
          randGauss(rng) * trib.spread * 0.45,
          randGauss(rng) * trib.spread * 0.65
        ));
        const wp2 = trib.pt.clone().lerp(attractor, 0.52).add(new THREE.Vector3(
          randGauss(rng) * trib.spread * 0.34,
          randGauss(rng) * trib.spread * 0.26,
          randGauss(rng) * trib.spread * 0.34
        ));
        const endPt = attractor.clone().add(new THREE.Vector3(
          randGauss(rng) * 165 * EXT_SCALE,
          randGauss(rng) * 130 * EXT_SCALE,
          randGauss(rng) * 165 * EXT_SCALE
        ));

        curve = new THREE.CatmullRomCurve3([startPt, wp1, wp2, endPt]);
      }

      streamlineCurves.push({ curve: curve, isExterior: isExterior, isShapley: isShapleyBridge });
      const pts = curve.getPoints(24);
      for (let k = 0; k < pts.length - 1; k++) {
        const t0 = k / (pts.length - 1);
        const t1 = (k + 1) / (pts.length - 1);
        let col0, col1;
        if (isPrimaryMW) {
          col0 = cMWGold.clone().lerp(cAttractor, t0);
          col1 = cMWGold.clone().lerp(cAttractor, t1);
        } else if (isShapleyBridge) {
          col0 = cAttractor.clone().lerp(cShapley, t0);
          col1 = cAttractor.clone().lerp(cShapley, t1);
        } else if (isExterior) {
          // Exterior diverging streams: warm amber watershed divide -> cool sapphire-cyan exterior pull!
          col0 = cOrange.clone().lerp(cExterior, t0).multiplyScalar(0.65 * (1.0 - t0 * 0.55));
          col1 = cOrange.clone().lerp(cExterior, t1).multiplyScalar(0.65 * (1.0 - t1 * 0.55));
        } else {
          col0 = t0 < 0.55
            ? cRimIce.clone().lerp(cFeather, t0 / 0.55)
            : cFeather.clone().lerp(cAttractor, (t0 - 0.55) / 0.45);
          col1 = t1 < 0.55
            ? cRimIce.clone().lerp(cFeather, t1 / 0.55)
            : cFeather.clone().lerp(cAttractor, (t1 - 0.55) / 0.45);
          const fade0 = 0.25 + 0.75 * Math.pow(t0, 0.55);
          const fade1 = 0.25 + 0.75 * Math.pow(t1, 0.55);
          col0.multiplyScalar(fade0);
          col1.multiplyScalar(fade1);
        }
        segVerts.push(pts[k].x, pts[k].y, pts[k].z, pts[k + 1].x, pts[k + 1].y, pts[k + 1].z);
        segCols.push(col0.r, col0.g, col0.b, col1.r, col1.g, col1.b);
      }
    }

    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(segVerts, 3));
    lineGeo.setAttribute('color', new THREE.Float32BufferAttribute(segCols, 3));
    laniakeaLineMat = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.26,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    laniakeaGroup.add(new THREE.LineSegments(lineGeo, laniakeaLineMat));

    // 3. Volumetric Density Isosurface Clouds along Dense Supercluster Ridges (1 Draw Call!)
    if (typeof SHADERS.createLaniakeaMistMaterial === 'function') {
      const mistCount = 1050;
      const mPos = new Float32Array(mistCount * 3);
      const mCol = new Float32Array(mistCount * 3);
      const mData = new Float32Array(mistCount * 4);
      const mTmp = new THREE.Vector3();
      const cMistTeal = new THREE.Color(0x14b8a6);
      const cMistBlue = new THREE.Color(0x38bdf8);
      const cMistGold = new THREE.Color(0xfbbf24);

      for (let m = 0; m < mistCount; m++) {
        const cIdx = Math.floor(rng() * NUM_INTERIOR);
        const t = 0.25 + Math.pow(rng(), 0.65) * 0.75;
        streamlineCurves[cIdx].curve.getPoint(t, mTmp);
        const sp = (260 + (1.0 - t) * 480) * EXT_SCALE;
        mTmp.x += randGauss(rng) * sp;
        mTmp.y += randGauss(rng) * sp * 0.72;
        mTmp.z += randGauss(rng) * sp;

        const dGA = mTmp.distanceTo(attractor);
        const coreWeight = 1.0 - THREE.MathUtils.smoothstep(dGA, 200 * EXT_SCALE, 1650 * EXT_SCALE);
        const cc = coreWeight > 0.35
          ? cMistTeal.clone().lerp(cMistGold, coreWeight)
          : cMistTeal.clone().lerp(cMistBlue, rng() * 0.55);

        mPos[m * 3] = mTmp.x;
        mPos[m * 3 + 1] = mTmp.y;
        mPos[m * 3 + 2] = mTmp.z;
        mCol[m * 3] = cc.r;
        mCol[m * 3 + 1] = cc.g;
        mCol[m * 3 + 2] = cc.b;
        mData[m * 4] = (240 + rng() * 280 + coreWeight * 220) * EXT_SCALE;
        mData[m * 4 + 1] = 0.35 + t * 0.55 + coreWeight * 0.35;
        mData[m * 4 + 2] = coreWeight;
        mData[m * 4 + 3] = rng();
      }

      const mGeo = new THREE.BufferGeometry();
      mGeo.setAttribute('position', new THREE.BufferAttribute(mPos, 3));
      mGeo.setAttribute('color', new THREE.BufferAttribute(mCol, 3));
      mGeo.setAttribute('aLanData', new THREE.BufferAttribute(mData, 4));
      laniakeaMistMat = SHADERS.createLaniakeaMistMaterial(textures.nebulaPuff);
      laniakeaMistMat.uniforms.uPixelRatio.value = currentPR;
      const mPts = new THREE.Points(mGeo, laniakeaMistMat);
      mPts.frustumCulled = false;
      mPts.renderOrder = -12;
      laniakeaGroup.add(mPts);
    }

    // 4. 12,000 Embedded Laniakea Galaxies Clustering Along the Feathery Filaments (1 Draw Call!)
    const galCount = 12000;
    const gPos = new Float32Array(galCount * 3);
    const gCol = new Float32Array(galCount * 3);
    const gTmp = new THREE.Vector3();
    const cGalWhite = new THREE.Color(0xf8fafc);
    const cGalBlue = new THREE.Color(0x93c5fd);
    const cGalGold = new THREE.Color(0xfde68a);
    let gMade = 0;
    let gAtt = 0;

    while (gMade < galCount && gAtt < galCount * 3) {
      gAtt++;
      const cIdx = Math.floor(rng() * NUM_INTERIOR);
      const t = Math.pow(rng(), 0.72);
      streamlineCurves[cIdx].curve.getPoint(t, gTmp);
      const sp = (110 + (1.0 - t) * 320) * EXT_SCALE;
      gTmp.x += randGauss(rng) * sp;
      gTmp.y += randGauss(rng) * sp * 0.75;
      gTmp.z += randGauss(rng) * sp;

      if (gTmp.distanceTo(localVoid) < 820 * EXT_SCALE) continue;
      if (gTmp.length() < 320 * EXT_SCALE) continue;

      const dGA = gTmp.distanceTo(attractor);
      const nearGA = 1.0 - THREE.MathUtils.smoothstep(dGA, 180 * EXT_SCALE, 1500 * EXT_SCALE);
      const col = nearGA > 0.3
        ? cGalWhite.clone().lerp(cGalGold, 0.35 + nearGA * 0.55)
        : (rng() < 0.55 ? cGalWhite.clone().lerp(cGalBlue, rng() * 0.55) : cGalWhite.clone().lerp(cGalGold, rng() * 0.45));
      const dim = 0.52 + rng() * 0.48;

      gPos[gMade * 3] = gTmp.x;
      gPos[gMade * 3 + 1] = gTmp.y;
      gPos[gMade * 3 + 2] = gTmp.z;
      gCol[gMade * 3] = col.r * dim;
      gCol[gMade * 3 + 1] = col.g * dim;
      gCol[gMade * 3 + 2] = col.b * dim;
      gMade++;
    }

    const gGeo = new THREE.BufferGeometry();
    gGeo.setAttribute('position', new THREE.BufferAttribute(gPos.subarray(0, gMade * 3), 3));
    gGeo.setAttribute('color', new THREE.BufferAttribute(gCol.subarray(0, gMade * 3), 3));
    laniakeaGalMat = new THREE.PointsMaterial({
      size: 26 * EXT_SCALE,
      map: textures.starGlow,
      vertexColors: true,
      transparent: true,
      opacity: 0.78,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const lanGals = new THREE.Points(gGeo, laniakeaGalMat);
    lanGals.frustumCulled = false;
    lanGals.renderOrder = -11;
    laniakeaGroup.add(lanGals);

    // 4B. Zone of Avoidance (Milky Way Galactic Dust Plane obscuring Great Attractor & Vela in optical!)
    const zoaGeo = new THREE.RingGeometry(420 * EXT_SCALE, 4600 * EXT_SCALE, 64, 1);
    zoaGeo.rotateX(-Math.PI * 0.5);
    laniakeaZoaMat = new THREE.MeshBasicMaterial({
      color: 0x7c2d12,
      transparent: true,
      opacity: 0.08,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    const zoaMesh = new THREE.Mesh(zoaGeo, laniakeaZoaMat);
    zoaMesh.rotation.set(0.18, 0.42, -0.22);
    zoaMesh.renderOrder = -10;
    laniakeaGroup.add(zoaMesh);

    // 5. 640 Peculiar-Velocity Flow Pulses (Accelerate smoothly from slow watershed -> fast Great Attractor!)
    const pulseCount = 640;
    const pulsePos = new Float32Array(pulseCount * 3);
    const pulseCol = new Float32Array(pulseCount * 3);
    for (let p = 0; p < pulseCount; p++) {
      const cIdx = p % streamlineCurves.length;
      const stInfo = streamlineCurves[cIdx];
      const t0 = rng();
      flowPulseData.push({ curveIdx: cIdx, t: t0, baseSpeed: 0.024 + rng() * 0.036 });
      const col = cIdx === 0
        ? cMWGold
        : (stInfo.isShapley
          ? cAttractor.clone().lerp(cShapley, t0)
          : (stInfo.isExterior
            ? cOrange.clone().lerp(cExterior, t0)
            : cRimIce.clone().lerp(cAttractor, t0)));
      pulseCol[p * 3] = col.r;
      pulseCol[p * 3 + 1] = col.g;
      pulseCol[p * 3 + 2] = col.b;
    }

    const pulseGeo = new THREE.BufferGeometry();
    pulseGeo.setAttribute('position', new THREE.BufferAttribute(pulsePos, 3));
    pulseGeo.setAttribute('color', new THREE.BufferAttribute(pulseCol, 3));
    laniakeaPulseMat = new THREE.PointsMaterial({
      size: 46 * EXT_SCALE,
      map: textures.starGlow,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    flowPulsePoints = new THREE.Points(pulseGeo, laniakeaPulseMat);
    flowPulsePoints.frustumCulled = false;
    laniakeaGroup.add(flowPulsePoints);
  }

  const _lanFlowTmp = new THREE.Vector3();
  function updateLaniakeaFlows(dt) {
    if (!flowPulsePoints || !laniakeaGroup.visible) return;
    const posArr = flowPulsePoints.geometry.attributes.position.array;
    const tmp = _lanFlowTmp;
    for (let i = 0; i < flowPulseData.length; i++) {
      const item = flowPulseData[i];
      // Peculiar velocity increases deeper inside the gravitational potential well (0.55x at rim -> 1.55x near GA)
      const accelMult = 0.55 + item.t * 1.05;
      item.t = (item.t + dt * item.baseSpeed * accelMult * Math.max(state.speed, 0.15)) % 1.0;
      streamlineCurves[item.curveIdx].curve.getPoint(item.t, tmp);
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
        tmp.x += randGauss(rng) * 480 * EXT_SCALE;
        tmp.y += randGauss(rng) * 420 * EXT_SCALE;
        tmp.z += randGauss(rng) * 480 * EXT_SCALE;

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
          size: 460 * EXT_SCALE,
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
  // 10B. v15 VOLUMETRIC 3D COSMIC WEB OVERHAUL (13k – 315k * EXT_SCALE)
  //      * 3D Ray-Marched IllustrisTNG Cellular Foam Volume (True 3D Parallax!)
  //      * ~920+ Hierarchical Primary & Sub-Cluster Nodes + Spiderweb Tendrils
  //      * ~4,200 GPU-Driven Live Matter Inflow Streams draining from 36 Voids
  //      * Still Only 5 Ultra-Light GPU Draw Calls (Scales with Perf/Bal/Ultra!)
  // -------------------------------------------------------------------------
  const cosmicWebGroup = new THREE.Group();
  cosmicWebGroup.visible = false;
  scene.add(cosmicWebGroup);

  let cosmicWebLineMat = null;
  let cosmicWebMistMat = null;
  let cosmicWebPointMat = null;
  let cosmicWebVolumeMat = null;
  let cosmicWebVolumeMesh = null;
  let cosmicWebFlowMat = null;
  let cosmicWebVoids = [];
  const COSMIC_WEB_VOL_RADIUS = 315000 * EXT_SCALE;

  const COSMIC_WEB_LANDMARKS = [
    {
      id: 'cosmicweb',
      label: 'Cosmic Web 3D',
      title: 'Universe-Wide Volumetric 3D Cosmic Web',
      badge: 'IllustrisTNG / NASA SVS • 3D Volumetric Foam',
      cls: '920+ Hierarchical Nodes • Live Matter Flows',
      radius: '0.4 – 40+ Bly Full Observable Volume',
      vel: 'Ray-Marched WHIM Plasma & Void Outflows',
      sector: 'Large-Scale Cosmic Sponge',
      target: [0, 0, 0],
      camPos: [72000 * EXT_SCALE, 56000 * EXT_SCALE, 118000 * EXT_SCALE],
      desc: 'Full 3D volumetric cosmic sponge spanning the observable universe: ray-marched IllustrisTNG plasma ribbons, 920+ hierarchical supercluster & sub-filament nodes, 36 carved supervoids, and 4,200 live matter streams draining from empty voids into glowing merger fireballs.'
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
      target: [29500 * EXT_SCALE, 11200 * EXT_SCALE, -3500 * EXT_SCALE],
      camPos: [14500 * EXT_SCALE, 19500 * EXT_SCALE, 18500 * EXT_SCALE],
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
      target: [-11500 * EXT_SCALE, -15000 * EXT_SCALE, 41500 * EXT_SCALE],
      camPos: [-22000 * EXT_SCALE, -2500 * EXT_SCALE, 18500 * EXT_SCALE],
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
      target: [-38000 * EXT_SCALE, 74000 * EXT_SCALE, -92000 * EXT_SCALE],
      camPos: [-12000 * EXT_SCALE, 48000 * EXT_SCALE, -34000 * EXT_SCALE],
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
      target: [-23500 * EXT_SCALE, 18500 * EXT_SCALE, 22500 * EXT_SCALE],
      camPos: [-8500 * EXT_SCALE, 26000 * EXT_SCALE, 39500 * EXT_SCALE],
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
      target: [29500 * EXT_SCALE, -21000 * EXT_SCALE, -24500 * EXT_SCALE],
      camPos: [14500 * EXT_SCALE, -9500 * EXT_SCALE, -6500 * EXT_SCALE],
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
      { id: 'bootesvoid', pos: new THREE.Vector3(-23500 * EXT_SCALE, 18500 * EXT_SCALE, 22500 * EXT_SCALE), r: 11500 * EXT_SCALE, named: true, hotRim: 0.72 },
      { id: 'eridanusvoid', pos: new THREE.Vector3(29500 * EXT_SCALE, -21000 * EXT_SCALE, -24500 * EXT_SCALE), r: 14000 * EXT_SCALE, named: true, hotRim: 0.25 }
    ];

    // 2. Landmark Great Walls (high-temperature fiery amber-gold spines!)
    const walls = [
      {
        id: 'sloanwall',
        pts: [
          new THREE.Vector3(24500 * EXT_SCALE, 11500 * EXT_SCALE, -18000 * EXT_SCALE),
          new THREE.Vector3(29500 * EXT_SCALE, 13800 * EXT_SCALE, -8500 * EXT_SCALE),
          new THREE.Vector3(31500 * EXT_SCALE, 11200 * EXT_SCALE, 3500 * EXT_SCALE),
          new THREE.Vector3(28000 * EXT_SCALE, 6800 * EXT_SCALE, 14500 * EXT_SCALE),
          new THREE.Vector3(21500 * EXT_SCALE, 2200 * EXT_SCALE, 22500 * EXT_SCALE)
        ]
      },
      {
        id: 'bosswall',
        pts: [
          new THREE.Vector3(-34000 * EXT_SCALE, -12000 * EXT_SCALE, 26000 * EXT_SCALE),
          new THREE.Vector3(-24000 * EXT_SCALE, -16500 * EXT_SCALE, 35500 * EXT_SCALE),
          new THREE.Vector3(-11500 * EXT_SCALE, -15000 * EXT_SCALE, 41500 * EXT_SCALE),
          new THREE.Vector3(2500 * EXT_SCALE, -11000 * EXT_SCALE, 42500 * EXT_SCALE),
          new THREE.Vector3(15500 * EXT_SCALE, -6500 * EXT_SCALE, 38500 * EXT_SCALE)
        ]
      },
      {
        id: 'hcbwall',
        pts: [
          new THREE.Vector3(-96000 * EXT_SCALE, 52000 * EXT_SCALE, -38000 * EXT_SCALE),
          new THREE.Vector3(-72000 * EXT_SCALE, 68000 * EXT_SCALE, -68000 * EXT_SCALE),
          new THREE.Vector3(-38000 * EXT_SCALE, 74000 * EXT_SCALE, -92000 * EXT_SCALE),
          new THREE.Vector3(8000 * EXT_SCALE, 64000 * EXT_SCALE, -102000 * EXT_SCALE),
          new THREE.Vector3(48000 * EXT_SCALE, 44000 * EXT_SCALE, -94000 * EXT_SCALE)
        ]
      }
    ];

    const quasarAnchors = [
      TON618_POS.clone(),
      J0529_POS.clone(),
      NAPO_POS.clone(),
      J0410_POS.clone()
    ];

    let vAtt = 0;
    while (voids.length < 36 && vAtt < 3000) {
      vAtt++;
      const r = (28000 + Math.pow(rng(), 0.85) * 245000) * EXT_SCALE;
      const th = rng() * Math.PI * 2;
      const ph = Math.acos(2 * rng() - 1);
      const vp = new THREE.Vector3(
        r * Math.sin(ph) * Math.cos(th),
        r * Math.cos(ph),
        r * Math.sin(ph) * Math.sin(th)
      );
      const vr = (11500 + (r / (270000 * EXT_SCALE)) * 24000 + rng() * 7500) * EXT_SCALE;

      let ok = true;
      for (let w = 0; w < walls.length && ok; w++) {
        for (let k = 0; k < walls[w].pts.length; k++) {
          if (vp.distanceTo(walls[w].pts[k]) < vr + 6500 * EXT_SCALE) { ok = false; break; }
        }
      }
      for (let q = 0; q < quasarAnchors.length && ok; q++) {
        if (vp.distanceTo(quasarAnchors[q]) < vr + 10000 * EXT_SCALE) ok = false;
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
      { count: 145, rMin: 13000 * EXT_SCALE,  rMax: 58000 * EXT_SCALE,  minSp: 8200 * EXT_SCALE,  tier: 0 },
      { count: 230, rMin: 55000 * EXT_SCALE,  rMax: 165000 * EXT_SCALE, minSp: 18500 * EXT_SCALE, tier: 0 },
      { count: 230, rMin: 160000 * EXT_SCALE, rMax: 305000 * EXT_SCALE, minSp: 31500 * EXT_SCALE, tier: 0 },
      // Tier 1: Hierarchical sub-cluster & dwarf-filament nodes weaving finer spiderweb bridges!
      { count: 120, rMin: 16000 * EXT_SCALE,  rMax: 95000 * EXT_SCALE,  minSp: 5800 * EXT_SCALE,  tier: 1 },
      { count: 175, rMin: 90000 * EXT_SCALE,  rMax: 275000 * EXT_SCALE, minSp: 13500 * EXT_SCALE, tier: 1 }
    ];

    shells.forEach(function (sh) {
      let made = 0;
      let att = 0;
      while (made < sh.count && att < sh.count * 32) {
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
          const regionWave = Math.sin((p.x / EXT_SCALE) * 0.000022 + (p.z / EXT_SCALE) * 0.000018) * Math.cos((p.y / EXT_SCALE) * 0.000025 - 0.6);
          const isHot = (regionWave > 0.14 || rng() < 0.24);
          const subScale = sh.tier === 1 ? 0.72 : 1.0;
          nodes.push({
            pos: p,
            heat: (isHot ? (0.68 + rng() * 0.32) : (0.04 + rng() * 0.28)) * subScale,
            hub: (isHot ? (0.72 + rng() * 0.28) : (0.45 + rng() * 0.42)) * subScale,
            tier: sh.tier
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
      const isSub = nodes[i].tier === 1;
      const rNode = nodes[i].pos.length();
      const baseLink = (rNode < 58000 * EXT_SCALE ? 31000 : (rNode < 165000 * EXT_SCALE ? 62000 : 102000)) * EXT_SCALE;
      const maxLinkDist = isSub ? baseLink * 0.72 : baseLink;
      const maxLinks = isSub ? 3 : 4;
      const neighbors = [];
      for (let j = 0; j < nodes.length; j++) {
        if (i === j) continue;
        // Primary hubs link mainly to other primaries for strong main walls; sub-nodes bridge to all!
        if (!isSub && nodes[j].tier === 1 && rng() < 0.65) continue;
        const d = nodes[i].pos.distanceTo(nodes[j].pos);
        if (d < maxLinkDist) neighbors.push({ d: d, j: j });
      }
      neighbors.sort(function (u, v) { return u.d - v.d; });

      let linked = 0;
      for (let k = 0; k < neighbors.length && linked < maxLinks; k++) {
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
          if (addEdge(i, j, edgeHeat)) {
            edges[edges.length - 1].isSub = isSub || (nodes[j].tier === 1);
            linked++;
          }
        }
      }
    }

    for (let e = 0; e < edges.length; e++) {
      adj[edges[e].a].push(edges[e].b);
      adj[edges[e].b].push(edges[e].a);
    }

    const cosmicSheets = [];
    for (let i = 0; i < nodes.length && cosmicSheets.length < 260; i++) {
      const ni = adj[i];
      for (let a = 0; a < ni.length && cosmicSheets.length < 260; a++) {
        const j = ni[a];
        if (j <= i) continue;
        const nj = adj[j];
        for (let b = 0; b < nj.length && cosmicSheets.length < 260; b++) {
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

    // 4. Populate 5 GPU Buffers:
    //    (1) Hierarchical Braided Tendrils + Sub-Filaments + Soap-Bubble Void Rims (LOD-Aware!)
    //    (2) Volumetric Fire-and-Ice Mist along Filaments, Bubble Rims, Sheets & Fireball Hubs
    //    (3) Crisp Supercluster Fireball Cores & Sapphire/Gold Filament Galaxies
    //    (4) ~4,200 GPU-Driven Live Cosmic Inflow Streams (Void Outflows + Filament Convergence!)
    //    (5) 3D Volumetric Ray-Marched Cosmic Foam Shell (IllustrisTNG True 3D Parallax!)
    const lineVerts = [];
    const lineData = []; // vec4(hubWeight, heat(0=sapphire..1=fieryOrange), zDepth, lodSeed)

    const mistVerts = [];
    const mistData = []; // vec4(size, heat, zDepth, seed)

    const ptVerts = [];
    const ptData = [];   // vec4(size, heatOrHub, zDepth, seed)

    const flowStarts = [];
    const flowCtrls = [];
    const flowEnds = [];
    const flowData = []; // vec4(speed, phase, heat, seed)

    const bendOffset = new THREE.Vector3();
    const altOffset = new THREE.Vector3();
    const perpAxis = new THREE.Vector3();
    const tangentVec = new THREE.Vector3();
    const ptTmp = new THREE.Vector3();

    edges.forEach(function (e) {
      const nA = nodes[e.a];
      const nB = nodes[e.b];
      const pA = nA.pos;
      const pB = nB.pos;
      const isSub = !!e.isSub;
      const span = pA.distanceTo(pB);
      const midDist = tmpMid.addVectors(pA, pB).multiplyScalar(0.5).length();
      const zDepth = THREE.MathUtils.clamp((midDist - 15000 * EXT_SCALE) / (290000 * EXT_SCALE), 0.0, 1.0);
      const hA = nA.heat;
      const hB = nB.heat;

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
      const ctrl2 = ctrl1.clone().add(altOffset);
      const curve2 = new THREE.QuadraticBezierCurve3(pA, ctrl2, pB);

      const segs = isSub ? 5 : 8;
      const pts1 = curve1.getPoints(segs);
      const pts2 = isSub ? null : curve2.getPoints(segs);

      // Identical lodSeed for both vertices of every segment (prevents stray clipped lines!)
      const edgeLod = isSub ? (0.34 + rng() * 0.64) : 0.0;
      const braidLod = 0.28 + rng() * 0.62;

      for (let s = 0; s < segs; s++) {
        const t0 = s / segs;
        const t1 = (s + 1) / segs;
        const w0 = Math.pow(Math.abs(t0 * 2.0 - 1.0), 1.45) * (isSub ? 0.68 : 1.0);
        const w1 = Math.pow(Math.abs(t1 * 2.0 - 1.0), 1.45) * (isSub ? 0.68 : 1.0);
        const ht0 = THREE.MathUtils.lerp(hA, hB, t0);
        const ht1 = THREE.MathUtils.lerp(hA, hB, t1);

        // Primary fiery/sapphire core strand (or finer hierarchical sub-filament!)
        lineVerts.push(pts1[s].x, pts1[s].y, pts1[s].z, pts1[s + 1].x, pts1[s + 1].y, pts1[s + 1].z);
        lineData.push(w0, ht0, zDepth, edgeLod, w1, ht1, zDepth, edgeLod);

        if (pts2) {
          // Braided gossamer silver-blue outer thread
          lineVerts.push(pts2[s].x, pts2[s].y, pts2[s].z, pts2[s + 1].x, pts2[s + 1].y, pts2[s + 1].z);
          lineData.push(w0 * 0.65, ht0 * 0.72, zDepth, braidLod, w1 * 0.65, ht1 * 0.72, zDepth, braidLod);
        }
      }

      // Gossamer spiderweb micro-forks branching off mid-filament (reveals in Balanced & Ultra!)
      const forkChance = isSub ? 0.36 : 0.72;
      if (rng() < forkChance) {
        const forkStart = curve1.getPoint(0.26 + rng() * 0.48, new THREE.Vector3());
        const forkEnd = forkStart.clone().add(
          new THREE.Vector3(randGauss(rng), randGauss(rng), randGauss(rng)).multiplyScalar(span * 0.26)
        );
        if (!inAnyVoid(forkEnd, 0.94)) {
          const fLod = 0.36 + rng() * 0.62;
          lineVerts.push(forkStart.x, forkStart.y, forkStart.z, forkEnd.x, forkEnd.y, forkEnd.z);
          lineData.push(0.45, e.heat * 0.65, zDepth, fLod, 0.08, e.heat * 0.35, zDepth, fLod);
        }
      }

      // Live GPU Matter Inflow Streams accelerating from lighter/cooler node -> hotter supercluster hub!
      const flowStreams = isSub ? (rng() < 0.65 ? 1 : 0) : (e.heat > 0.7 ? 3 : 2);
      const goAtoB = (nB.hub + nB.heat) >= (nA.hub + nA.heat);
      const fFrom = goAtoB ? pA : pB;
      const fTo = goAtoB ? pB : pA;
      for (let fl = 0; fl < flowStreams; fl++) {
        const useBraid = (fl % 2 === 1) && !isSub;
        const cPt = useBraid ? ctrl2 : ctrl1;
        flowStarts.push(fFrom.x, fFrom.y, fFrom.z);
        flowCtrls.push(
          cPt.x + randGauss(rng) * span * 0.03,
          cPt.y + randGauss(rng) * span * 0.03,
          cPt.z + randGauss(rng) * span * 0.03
        );
        flowEnds.push(fTo.x, fTo.y, fTo.z);
        flowData.push(0.038 + rng() * 0.045, rng(), Math.max(hA, hB), rng());
      }

      // Volumetric Fire & Ice Mist Puffs along each braided filament
      const mistCount = isSub ? 4 : (e.heat > 0.7 ? 15 : 9);
      for (let m = 0; m < mistCount; m++) {
        const t = (m + 0.15 + rng() * 0.70) / mistCount;
        ((m % 3 === 0 && !isSub) ? curve2 : curve1).getPoint(t, ptTmp);
        const endProx = Math.abs(t * 2.0 - 1.0);
        const puffSpread = span * (0.020 + 0.036 * endProx);
        ptTmp.x += randGauss(rng) * puffSpread;
        ptTmp.y += randGauss(rng) * puffSpread;
        ptTmp.z += randGauss(rng) * puffSpread;

        const shellScale = THREE.MathUtils.lerp(1.0, 1.55, zDepth) * (isSub ? 0.72 : 1.0);
        const puffSz = (e.heat > 0.7 ? 1.42 : 0.98) * (0.68 + 0.72 * endProx) * shellScale;
        const localHeat = THREE.MathUtils.clamp(THREE.MathUtils.lerp(hA, hB, t) * (0.65 + 0.45 * endProx), 0.0, 1.0);
        mistVerts.push(ptTmp.x, ptTmp.y, ptTmp.z);
        mistData.push(puffSz, localHeat, zDepth, rng());
      }

      // Crisp Filament Galaxies tracing primary & hierarchical sub-strands
      const galCount = isSub ? 10 : (e.heat > 0.7 ? 38 : 19);
      for (let g = 0; g < galCount; g++) {
        let t = rng();
        if (rng() < 0.45) {
          t = t < 0.5 ? Math.pow(t * 2.0, 1.75) * 0.5 : 1.0 - Math.pow((1.0 - t) * 2.0, 1.75) * 0.5;
        }
        ((g % 3 === 0 && !isSub) ? curve2 : curve1).getPoint(t, ptTmp);

        const endProx = Math.abs(t * 2.0 - 1.0);
        const spread = span * (0.020 + 0.040 * endProx);
        ptTmp.x += randGauss(rng) * spread;
        ptTmp.y += randGauss(rng) * spread;
        ptTmp.z += randGauss(rng) * spread;

        const localHeat = THREE.MathUtils.lerp(hA, hB, t);
        ptVerts.push(ptTmp.x, ptTmp.y, ptTmp.z);
        ptData.push((0.72 + rng() * 0.92) * (isSub ? 0.78 : (e.heat > 0.7 ? 1.18 : 0.92)), localHeat * 0.75 + endProx * 0.25, zDepth, rng());
      }
    });

    // --- PRESSED SOAP-BUBBLE VOID RIM ARCS + LIVE VOID-EVACUATION INFLOW STREAMS ---
    const uVec = new THREE.Vector3();
    const vVec = new THREE.Vector3();
    const wVec = new THREE.Vector3();
    const arcPt = new THREE.Vector3();
    const prevArcPt = new THREE.Vector3();
    const voidStartPt = new THREE.Vector3();
    const voidCtrlPt = new THREE.Vector3();

    voids.forEach(function (vd) {
      const zDepth = THREE.MathUtils.clamp((vd.pos.length() - 15000 * EXT_SCALE) / (290000 * EXT_SCALE), 0.0, 1.0);
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
        const arcLod = a < 3 ? 0.0 : (0.30 + rng() * 0.55);

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
            lineData.push(0.25 + 0.72 * edgeFade0, arcHeat, zDepth, arcLod, 0.25 + 0.72 * edgeFade1, arcHeat, zDepth, arcLod);
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

      // Live Void-Drainage Matter Streams flowing radially out of each supervoid onto its bubble wall!
      const voidFlows = vd.named ? 52 : 34;
      for (let vf = 0; vf < voidFlows; vf++) {
        const th = rng() * Math.PI * 2;
        const ph = Math.acos(2 * rng() - 1);
        const dirX = Math.sin(ph) * Math.cos(th);
        const dirY = Math.cos(ph);
        const dirZ = Math.sin(ph) * Math.sin(th);
        const rStart = vd.r * (0.28 + rng() * 0.34);
        const rEnd = vd.r * (1.02 + rng() * 0.14);

        voidStartPt.set(vd.pos.x + dirX * rStart, vd.pos.y + dirY * rStart, vd.pos.z + dirZ * rStart);
        arcPt.set(vd.pos.x + dirX * rEnd, vd.pos.y + dirY * rEnd, vd.pos.z + dirZ * rEnd);
        voidCtrlPt.lerpVectors(voidStartPt, arcPt, 0.52);
        voidCtrlPt.x += randGauss(rng) * vd.r * 0.12;
        voidCtrlPt.y += randGauss(rng) * vd.r * 0.12;
        voidCtrlPt.z += randGauss(rng) * vd.r * 0.12;

        flowStarts.push(voidStartPt.x, voidStartPt.y, voidStartPt.z);
        flowCtrls.push(voidCtrlPt.x, voidCtrlPt.y, voidCtrlPt.z);
        flowEnds.push(arcPt.x, arcPt.y, arcPt.z);
        flowData.push(0.026 + rng() * 0.034, rng(), vd.hotRim * 0.72, rng());
      }
    });

    // Populate Translucent Cosmic Sheets (260 filament triangles)
    const pSheet = new THREE.Vector3();
    cosmicSheets.forEach(function (tri) {
      const A = nodes[tri[0]].pos;
      const B = nodes[tri[1]].pos;
      const C = nodes[tri[2]].pos;
      const cDist = tmpMid.copy(A).add(B).add(C).multiplyScalar(1 / 3).length();
      const zDepth = THREE.MathUtils.clamp((cDist - 15000 * EXT_SCALE) / (290000 * EXT_SCALE), 0.0, 1.0);
      const sheetHeat = (nodes[tri[0]].heat + nodes[tri[1]].heat + nodes[tri[2]].heat) / 3.0;

      for (let sm = 0; sm < 5; sm++) {
        let u = rng(), v = rng();
        if (u + v > 1.0) { u = 1.0 - u; v = 1.0 - v; }
        const w = 1.0 - u - v;
        pSheet.set(
          A.x * u + B.x * v + C.x * w + randGauss(rng) * 1600 * EXT_SCALE,
          A.y * u + B.y * v + C.y * w + randGauss(rng) * 1600 * EXT_SCALE,
          A.z * u + B.z * v + C.z * w + randGauss(rng) * 1600 * EXT_SCALE
        );
        mistVerts.push(pSheet.x, pSheet.y, pSheet.z);
        mistData.push(1.30 * THREE.MathUtils.lerp(0.95, 1.40, zDepth), sheetHeat * 0.65, zDepth, rng());
      }
    });

    // Populate Incandescent Supercluster Convergence Fireballs & Sapphire Nodes!
    nodes.forEach(function (nd) {
      const isSub = nd.tier === 1;
      const zDepth = THREE.MathUtils.clamp((nd.pos.length() - 15000 * EXT_SCALE) / (290000 * EXT_SCALE), 0.0, 1.0);
      const hubSpread = THREE.MathUtils.lerp(1800 * EXT_SCALE, 4400 * EXT_SCALE, zDepth) * (isSub ? 0.68 : 1.0);

      // Multi-layered fireball convergence glow at hot supercluster hubs!
      const isFireball = !isSub && nd.heat > 0.78;
      if (!isSub || rng() < 0.55) {
        mistVerts.push(nd.pos.x, nd.pos.y, nd.pos.z);
        mistData.push((isFireball ? 2.85 : (isSub ? 1.15 : 1.75)) * THREE.MathUtils.lerp(1.0, 1.45, zDepth), Math.min(1.0, nd.heat + 0.18), zDepth, rng());
      }

      ptVerts.push(nd.pos.x, nd.pos.y, nd.pos.z);
      ptData.push(isFireball ? 4.4 : (isSub ? 1.85 : 2.8), isFireball ? 1.0 : (0.35 + nd.heat * 0.55), zDepth, rng());

      const haloCnt = isSub ? 4 : (isFireball ? 14 : 7);
      for (let h = 0; h < haloCnt; h++) {
        const rr = hubSpread * Math.pow(rng(), 0.78);
        const th = rng() * Math.PI * 2;
        const ph = Math.acos(2 * rng() - 1);
        ptVerts.push(
          nd.pos.x + rr * Math.sin(ph) * Math.cos(th),
          nd.pos.y + rr * Math.cos(ph),
          nd.pos.z + rr * Math.sin(ph) * Math.sin(th)
        );
        ptData.push((1.10 + rng() * 1.10) * (isSub ? 0.80 : 1.0), Math.min(1.0, nd.heat * 0.85 + 0.15), zDepth, rng());
      }
    });

    // --- DRAW CALL 1: Dual-Temperature Fire & Ice Hierarchical Tendrils + Soap-Bubble Rims ---
    const webLineGeo = new THREE.BufferGeometry();
    webLineGeo.setAttribute('position', new THREE.Float32BufferAttribute(lineVerts, 3));
    webLineGeo.setAttribute('aWebData', new THREE.Float32BufferAttribute(lineData, 4));

    cosmicWebLineMat = new THREE.ShaderMaterial({
      uniforms: {
        uSpecMode: { value: 0.0 },
        uOpacity: { value: 0.0 },
        uLodDensity: { value: state.lodDensity }
      },
      vertexShader: `
        attribute vec4 aWebData; // x=hubWeight, y=heat(0=iceBlue..1=fieryGold), z=zDepth, w=lodSeed
        uniform float uLodDensity;
        varying float vHub;
        varying float vHeat;
        varying float vZ;
        varying float vDrop;
        void main() {
          vHub = aWebData.x;
          vHeat = aWebData.y;
          vZ = aWebData.z;
          // Both vertices of any sub-filament share identical aWebData.w -> collapses cleanly if culled!
          if (aWebData.w > uLodDensity + 0.02) {
            vDrop = 1.0;
            gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
            return;
          }
          vDrop = 0.0;
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
        varying float vDrop;
        void main() {
          if (uOpacity < 0.004 || vDrop > 0.5) discard;
          float zFade = mix(1.0, 0.46, smoothstep(0.38, 1.0, vZ));
          vec3 col;
          float alpha;
          if (uSpecMode > 4.5) {
            // Dark Matter / Lensing (Euclid): Electric indigo-violet dark matter filaments!
            col = mix(vec3(0.24, 0.14, 0.88), vec3(0.88, 0.62, 1.00), vHub * 0.65 + vHeat * 0.35);
            alpha = (0.22 + 0.32 * vHub + 0.16 * vHeat) * uOpacity * zFade;
          } else if (uSpecMode > 3.5) {
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
            alpha = (0.14 + 0.25 * vHub + 0.14 * vHeat) * uOpacity * zFade;
          }
          gl_FragColor = vec4(col, clamp(alpha, 0.0, 0.70));
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
          float rawSize = aMistData.x * uPixelRatio * (3360000.0 / dist);
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

          if (uSpecMode > 4.5) {
            col = mix(vec3(0.22, 0.10, 0.76), vec3(0.86, 0.56, 1.00), vHeat);
            alpha = cloud * (0.078 + 0.13 * vHeat) * uOpacity * zFade * vLodComp;
          } else if (uSpecMode > 3.5) {
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
            alpha = cloud * (0.048 + 0.098 * vHeat) * uOpacity * zFade * vLodComp;
          }

          if (alpha < 0.004) discard;
          gl_FragColor = vec4(clamp(col, vec3(0.0), vec3(1.25)), clamp(alpha, 0.0, 0.34));
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
          float rawSize = aPointData.x * uPixelRatio * (325000.0 / dist);
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

          if (uSpecMode > 4.5) {
            col = mix(vec3(0.46, 0.28, 1.00), vec3(0.96, 0.88, 1.00), vHeat);
            gain = 1.05 + 0.65 * vHeat;
          } else if (uSpecMode > 3.5) {
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

    // --- DRAW CALL 4: GPU-Driven Live Cosmic Inflow Streams (Void Outflows + Filament Infall!) ---
    if (typeof SHADERS.createCosmicWebFlowMaterial === 'function' && flowStarts.length > 0) {
      const flowGeo = new THREE.BufferGeometry();
      flowGeo.setAttribute('position', new THREE.Float32BufferAttribute(flowStarts, 3));
      flowGeo.setAttribute('aCtrl', new THREE.Float32BufferAttribute(flowCtrls, 3));
      flowGeo.setAttribute('aEnd', new THREE.Float32BufferAttribute(flowEnds, 3));
      flowGeo.setAttribute('aFlowData', new THREE.Float32BufferAttribute(flowData, 4));

      cosmicWebFlowMat = SHADERS.createCosmicWebFlowMaterial();
      cosmicWebFlowMat.uniforms.uPixelRatio.value = currentPR;
      cosmicWebFlowMat.uniforms.uLodDensity.value = state.lodDensity;

      const webFlows = new THREE.Points(flowGeo, cosmicWebFlowMat);
      webFlows.frustumCulled = false;
      webFlows.renderOrder = -10;
      cosmicWebGroup.add(webFlows);
    }

    // --- DRAW CALL 5: 3D Volumetric Ray-Marched Cosmic Foam Shell (IllustrisTNG True 3D Parallax!) ---
    if (typeof SHADERS.createCosmicWebVolumeMaterial === 'function') {
      cosmicWebVolumeMat = SHADERS.createCosmicWebVolumeMaterial();
      cosmicWebVolumeMat.uniforms.uLodDensity.value = state.lodDensity;
      cosmicWebVolumeMesh = new THREE.Mesh(new THREE.SphereGeometry(1.0, 32, 22), cosmicWebVolumeMat);
      cosmicWebVolumeMesh.scale.setScalar(COSMIC_WEB_VOL_RADIUS);
      cosmicWebVolumeMesh.frustumCulled = false;
      cosmicWebVolumeMesh.renderOrder = -16;
      cosmicWebGroup.add(cosmicWebVolumeMesh);
    }
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

  const OJ287_POS = new THREE.Vector3(-4600 * EXT_SCALE, -1750 * EXT_SCALE, 3950 * EXT_SCALE);
  const NGC6505_POS = new THREE.Vector3(2850 * EXT_SCALE, 1650 * EXT_SCALE, -2450 * EXT_SCALE);

  let einsteinRingMat = null;
  let ojSecondaryGroup = null;
  let ojFlareSprite = null;
  let ojFlareIntensity = 0.0;
  let ojPrevSide = 1;
  const ojShockKnots = [];
  let ojHelixCurveNorth = null;
  let ojHelixCurveSouth = null;
  let ojGravWaveMat = null;

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
      target: [-4600 * EXT_SCALE, -1750 * EXT_SCALE, 3950 * EXT_SCALE],
      camPos: [-4600 * EXT_SCALE + 38, -1750 * EXT_SCALE + 16, 3950 * EXT_SCALE + 52],
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
      target: [2850 * EXT_SCALE, 1650 * EXT_SCALE, -2450 * EXT_SCALE],
      camPos: [2850 * EXT_SCALE + 58, 1650 * EXT_SCALE + 24, -2450 * EXT_SCALE + 114],
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
      brightness: 1.38,
      regime: 0.0,
      placeholderTex: textures.starGlow
    });
    const primMesh = new THREE.Mesh(unitSphereGeo, primMat);
    primMesh.position.copy(OJ287_POS);
    primMesh.rotation.set(0.18, 0.0, 0.12);
    primMesh.scale.setScalar(12.0);
    primMesh.frustumCulled = false;
    primMesh.renderOrder = 5;
    bhGroup.add(primMesh);

    blackHoleEntries.push({
      data: { id: 'oj287', shortName: 'OJ 287', sphereRadius: 12.0 },
      worldPos: OJ287_POS.clone(),
      maxActiveDist: 12.0 * 75,
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

    // v17: Expanding 3D Quadrupole Gravitational Wave Spacetime Ripples in OJ 287's Orbital Plane!
    if (typeof SHADERS.createGravWaveMaterial === 'function') {
      ojGravWaveMat = SHADERS.createGravWaveMaterial();
      const gwGeo = new THREE.PlaneGeometry(2.0, 2.0);
      const gwMesh = new THREE.Mesh(gwGeo, ojGravWaveMat);
      gwMesh.rotation.x = -Math.PI * 0.5;
      gwMesh.scale.setScalar(84.0);
      gwMesh.renderOrder = 2;
      jetTilt.add(gwMesh);
    }
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
    if (ojGravWaveMat) ojGravWaveMat.uniforms.uTime.value = simTime;

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
    const m31Pos = new THREE.Vector3(340 * EXT_SCALE, 68 * EXT_SCALE, -420 * EXT_SCALE);

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
        const r = 210 + Math.pow(rng(), 0.85) * 680;
        const th = rng() * Math.PI * 2;
        const ph = Math.acos(2 * rng() - 1);
        tmpVec.set(r * Math.sin(ph) * Math.cos(th), r * Math.cos(ph) * 0.85, r * Math.sin(ph) * Math.sin(th));
      } else if (hostRoll < 0.82) {
        // Andromeda (M31) dwarf satellite swarm
        const r = 160 + Math.pow(rng(), 0.85) * 580;
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
        tmpVec.x += randGauss(rng) * 380;
        tmpVec.y += randGauss(rng) * 300;
        tmpVec.z += randGauss(rng) * 380;
      }
      if (tmpVec.length() < 195) tmpVec.normalize().multiplyScalar(210);

      const tile = pickTileAndColor('dwarf', 0.0);
      writeGalaxy(tmpVec.x, tmpVec.y, tmpVec.z, 18.0 + rng() * 20.0, 0.0, tile);
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
        const r = (680 + Math.pow(rng(), 0.78) * 18800) * EXT_SCALE;
        const th = rng() * Math.PI * 2;
        const warp = Math.sin(th * 2.0 + 0.6) * r * 0.09;
        const thickness = 520 * EXT_SCALE + r * 0.14;
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
          const spread = (1400 + rng() * 3400) * EXT_SCALE;
          tmpVec.set(
            anchor[0] + randGauss(rng) * spread,
            anchor[1] + randGauss(rng) * spread * 0.85,
            anchor[2] + randGauss(rng) * spread
          );
        }
      } else {
        // Sparse 3D intergalactic field scatter
        const r = (750 + Math.pow(rng(), 0.72) * 19200) * EXT_SCALE;
        const th = rng() * Math.PI * 2;
        const ph = Math.acos(2 * rng() - 1);
        tmpVec.set(r * Math.sin(ph) * Math.cos(th), r * Math.cos(ph), r * Math.sin(ph) * Math.sin(th));
      }

      const dOrigin = tmpVec.length();
      // Keep Local Group core clean & carve out the Local Void!
      if (dOrigin < 580 * EXT_SCALE || dOrigin > 21500 * EXT_SCALE) continue;
      if (tmpVec.distanceTo(localVoidPos) < 760 * EXT_SCALE) continue;

      const zShift = THREE.MathUtils.clamp((dOrigin - 650 * EXT_SCALE) / (105000 * EXT_SCALE), 0.0, 0.25);
      const tile = pickTileAndColor(envType, zShift);
      // Scale smoothly with distance shell so nearby field galaxies look crisp and distant ones stay delicate
      const sizeScale = (22.0 + Math.pow(dOrigin / (20000 * EXT_SCALE), 0.85) * 260.0) * 1.95;
      const worldSize = sizeScale * (0.55 + rng() * 0.95);
      writeGalaxy(tmpVec.x, tmpVec.y, tmpVec.z, worldSize, zShift, tile);
      sheetMade++;
    }

    // --- LAYER C: 37,850 Deep-Field Universe Galaxies (20,000 – 295,000 units) ---
    // Pre-generate 44 deep-field sheet attractors across the 3x observable volume!
    const deepClumps = [];
    for (let c = 0; c < 44; c++) {
      const r = (32000 + rng() * 235000) * EXT_SCALE;
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
        const spread = (9500 + rng() * 28000) * EXT_SCALE;
        tmpVec.set(
          cp.x + randGauss(rng) * spread,
          cp.y + randGauss(rng) * spread,
          cp.z + randGauss(rng) * spread
        );
      } else {
        const r = (20000 + Math.pow(rng(), 0.80) * 275000) * EXT_SCALE;
        const th = rng() * Math.PI * 2;
        const ph = Math.acos(2 * rng() - 1);
        tmpVec.set(r * Math.sin(ph) * Math.cos(th), r * Math.cos(ph), r * Math.sin(ph) * Math.sin(th));
      }

      const dOrigin = tmpVec.length();
      if (dOrigin < 19500 * EXT_SCALE || dOrigin > 296000 * EXT_SCALE) continue;
      // Carve out all 24 Cosmic Web supervoids (Boötes Void, Eridanus Supervoid, etc.)!
      if (inCosmicVoid(tmpVec, 0.96)) continue;

      const zShift = THREE.MathUtils.clamp((dOrigin - 18000 * EXT_SCALE) / (275000 * EXT_SCALE), 0.14, 1.0);
      const tile = pickTileAndColor('field', zShift);
      const sizeScale = (260.0 + Math.pow((dOrigin - 18000 * EXT_SCALE) / (275000 * EXT_SCALE), 0.95) * 3400.0) * 2.45;
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

  const TON618_POS = new THREE.Vector3(92000 * EXT_SCALE, 58000 * EXT_SCALE, -78000 * EXT_SCALE);
  const J0529_POS = new THREE.Vector3(-118000 * EXT_SCALE, -64000 * EXT_SCALE, -92000 * EXT_SCALE);
  const NAPO_POS = new THREE.Vector3(138000 * EXT_SCALE, 102000 * EXT_SCALE, 126000 * EXT_SCALE);
  const J0410_POS = new THREE.Vector3(-145000 * EXT_SCALE, 96000 * EXT_SCALE, 148000 * EXT_SCALE);

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
      target: [92000 * EXT_SCALE, 58000 * EXT_SCALE, -78000 * EXT_SCALE],
      camPos: [92000 * EXT_SCALE + 225, 58000 * EXT_SCALE + 145, -78000 * EXT_SCALE + 380],
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
      target: [-118000 * EXT_SCALE, -64000 * EXT_SCALE, -92000 * EXT_SCALE],
      camPos: [-118000 * EXT_SCALE + 290, -64000 * EXT_SCALE + 160, -92000 * EXT_SCALE + 390],
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
      target: [138000 * EXT_SCALE, 102000 * EXT_SCALE, 126000 * EXT_SCALE],
      camPos: [138000 * EXT_SCALE + 150, 102000 * EXT_SCALE + 92, 126000 * EXT_SCALE + 195],
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
      target: [-145000 * EXT_SCALE, 96000 * EXT_SCALE, 148000 * EXT_SCALE],
      camPos: [-145000 * EXT_SCALE + 210, 96000 * EXT_SCALE + 105, 148000 * EXT_SCALE - 255],
      desc: 'The earliest and most distant blazar ever discovered (redshift z = 7.0)—a 700-million-solar-mass black hole firing a relativistic jet aimed straight toward our galaxy less than 800 million years after the Big Bang.'
    }
  ];

  function registerV7CatalogAndRescaleDawn() {
    if (CAT.INSPECTOR_LOOKUP.laniakea) {
      CAT.INSPECTOR_LOOKUP.laniakea.badge = 'Cosmicflows-4 Basin of Attraction • ~100,000 Galaxies';
      CAT.INSPECTOR_LOOKUP.laniakea.cls = 'Dynamical Velocity Watershed (~10¹⁷ M☉, Unbound)';
      CAT.INSPECTOR_LOOKUP.laniakea.radius = '~520 Million ly Span (z ≈ 0.00 – 0.04)';
      CAT.INSPECTOR_LOOKUP.laniakea.vel = '~600 km/s Infall to Great Attractor -> Shapley';
      CAT.INSPECTOR_LOOKUP.laniakea.desc = 'Our home peculiar-velocity basin defined by converging galaxy flows (after subtracting cosmic expansion): streams from Virgo, Hydra–Centaurus, Pavo–Indus, and Vela (hidden behind the Milky Way’s Zone of Avoidance) converge toward the Great Attractor while exterior flows peel across the watershed toward Perseus–Pisces and Shapley.';
    }
    // Rescale existing Cosmic Dawn objects (MoM-z14, JADES-GS-z14-0) into the 3x 235k–275k frontier!
    const DAWN_SCALE = 2.85 * EXT_SCALE;
    if (Array.isArray(CAT.COSMIC_DAWN)) {
      CAT.COSMIC_DAWN.forEach(function (cd) {
        if (!cd._v7Scaled) {
          cd.pos = [cd.pos[0] * DAWN_SCALE, cd.pos[1] * DAWN_SCALE, cd.pos[2] * DAWN_SCALE];
          cd._v7Scaled = true;
        }
        const lk = CAT.INSPECTOR_LOOKUP[cd.id];
        if (lk) {
          lk.target = [cd.pos[0], cd.pos[1], cd.pos[2]];
          lk.camPos = [cd.pos[0] * 0.90, cd.pos[1] * 0.90 + 1800 * EXT_SCALE, cd.pos[2] * 0.90];
        }
      });
    }

    // Update Planck CMB Horizon preset camera for the expanded 350,000-unit Observable Universe!
    if (CAT.INSPECTOR_LOOKUP.horizon) {
      CAT.INSPECTOR_LOOKUP.horizon.camPos = [-135000 * EXT_SCALE, 112000 * EXT_SCALE, 245000 * EXT_SCALE];
      CAT.INSPECTOR_LOOKUP.horizon.target = [0, 0, 0];
      CAT.INSPECTOR_LOOKUP.horizon.radius = '93 Billion ly Diameter (1,000k Scene Radius)';
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
      brightness: 1.48,
      regime: 2.0,
      placeholderTex: textures.starGlow
    });
    const tonMesh = new THREE.Mesh(unitSphereGeo, tonMat);
    tonMesh.position.copy(TON618_POS);
    tonMesh.rotation.set(0.28, 0.4, -0.18);
    tonMesh.scale.setScalar(62);
    tonMesh.frustumCulled = false;
    tonMesh.renderOrder = 5;
    bhGroup.add(tonMesh);
    blackHoleEntries.push({
      data: { id: 'ton618', shortName: 'TON 618', sphereRadius: 62 },
      worldPos: TON618_POS.clone(),
      maxActiveDist: 62 * 75,
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
      diskTint: 0xbae6fd,
      brightness: 1.58,
      regime: 2.0,
      placeholderTex: textures.starGlow
    });
    const j0529Mesh = new THREE.Mesh(unitSphereGeo, j0529Mat);
    j0529Mesh.position.copy(J0529_POS);
    j0529Mesh.rotation.set(-0.22, 0.3, 0.24);
    j0529Mesh.scale.setScalar(70);
    j0529Mesh.frustumCulled = false;
    j0529Mesh.renderOrder = 5;
    bhGroup.add(j0529Mesh);
    blackHoleEntries.push({
      data: { id: 'j0529', shortName: 'J0529-4351', sphereRadius: 70 },
      worldPos: J0529_POS.clone(),
      maxActiveDist: 70 * 75,
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
        brightness: 1.46,
        regime: 2.0,
        placeholderTex: textures.starGlow
      });
      const qMesh = new THREE.Mesh(unitSphereGeo, qMat);
      qMesh.position.copy(worldQ);
      qMesh.rotation.set(q.tilt[0], q.tilt[1], q.tilt[2]);
      qMesh.scale.setScalar(q.rBH);
      qMesh.frustumCulled = false;
    qMesh.renderOrder = 5;
      bhGroup.add(qMesh);
      blackHoleEntries.push({
        data: { id: q.id, shortName: q.id, sphereRadius: q.rBH },
        worldPos: worldQ,
        maxActiveDist: q.rBH * 75,
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
      diskTint: 0x93c5fd,
      brightness: 1.52,
      regime: 2.0,
      placeholderTex: textures.starGlow
    });
    const j0410Mesh = new THREE.Mesh(unitSphereGeo, j0410Mat);
    j0410Mesh.position.copy(J0410_POS);
    j0410Mesh.scale.setScalar(42);
    j0410Mesh.frustumCulled = false;
    j0410Mesh.renderOrder = 5;
    bhGroup.add(j0410Mesh);
    blackHoleEntries.push({
      data: { id: 'j0410', shortName: 'J0410-0139', sphereRadius: 42 },
      worldPos: J0410_POS.clone(),
      maxActiveDist: 42 * 75,
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
      const r = (115000 + rng() * 82000) * EXT_SCALE;
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
      size: 2600 * EXT_SCALE,
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
      { pos: NAPO_POS, rad: 16500 * EXT_SCALE },
      { pos: J0410_POS, rad: 15000 * EXT_SCALE }
    ];
    if (Array.isArray(CAT.COSMIC_DAWN)) {
      CAT.COSMIC_DAWN.forEach(function (cd) {
        bubbleAnchors.push({ pos: new THREE.Vector3(cd.pos[0], cd.pos[1], cd.pos[2]), rad: 19500 * EXT_SCALE });
      });
    }
    for (let b = 0; b < 10; b++) {
      const r = (235000 + rng() * 48000) * EXT_SCALE;
      const th = rng() * Math.PI * 2;
      const ph = Math.acos(2 * rng() - 1);
      bubbleAnchors.push({
        pos: new THREE.Vector3(r * Math.sin(ph) * Math.cos(th), r * Math.cos(ph), r * Math.sin(ph) * Math.sin(th)),
        rad: (13500 + rng() * 11000) * EXT_SCALE
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
  // 10F. HEAVY ENVELOPING 3-ZONE BLACK-HOLE DUST COCOONS (Max 1 Active!)
  //      Zone A: Inner Hot Sublimation Wall & Minispiral Infall Streamers
  //      Zone B: Dense Clumpy Equatorial Molecular Torus (Dark Backlit Cracks)
  //      Zone C: Enveloping Outer Circumnuclear Shroud (Covers BH Like Actual!)
  // -------------------------------------------------------------------------
  const bhDustTorusEntries = [];

  function buildBHDustToruses() {
    if (typeof SHADERS.createBHDustTorusMaterial !== 'function') return;
    const rng = makeRng(20269911);

    blackHoleEntries.forEach(function (entry) {
      const R = (entry.data && entry.data.sphereRadius) ? entry.data.sphereRadius : 2.35;
      const bhId = (entry.data && entry.data.id) ? entry.data.id : '';
      const isSgrA = bhId === 'sgra';
      const hasJet = !!(entry.data && entry.data.hasJet) || bhId === 'ton618' || bhId === 'oj287' || bhId === 'j0410' || bhId === 'napoA' || bhId === 'napoB';

      // Richer 3-zone dust cloud coverage (only 1 BH active at a time -> smooth mobile FPS!)
      const count = isSgrA ? 440 : 320;
      const nInner = Math.floor(count * 0.22);
      const nTorus = Math.floor(count * 0.44);

      const pos = new Float32Array(count * 3);
      const tData = new Float32Array(count * 4);  // x=omega, y=worldSize, z=innerRimWeight, w=seed
      const tExtra = new Float32Array(count * 2); // x=layerKind(0=stream,1=torus,2=cocoon), y=densityMult

      for (let i = 0; i < count; i++) {
        let px = 0, py = 0, pz = 0;
        let innerWeight = 0.0;
        let puffSize = R * 0.7;
        let omega = 0.10;
        let layerKind = 1.0;
        let densityMult = 1.0;

        if (i < nInner) {
          // ZONE A: Inner Sublimation Cavity & Minispiral Dusty Infall Streamers (1.06R – 1.85R)
          layerKind = 0.0;
          const armIdx = i % 3;
          const u = rng();
          const rad = R * (1.06 + u * 0.82);
          const spiralAz = (armIdx / 3) * Math.PI * 2 + u * 2.65 + randGauss(rng) * 0.28;
          const elev = randGauss(rng) * rad * (0.18 + 0.14 * u);
          px = Math.cos(spiralAz) * rad;
          py = elev;
          pz = Math.sin(spiralAz) * rad;
          innerWeight = 0.72 + (1.0 - u) * 0.28;
          puffSize = R * (0.34 + u * 0.32 + rng() * 0.18);
          omega = (0.18 + rng() * 0.08) / Math.pow(rad / R, 0.85);
          densityMult = 0.92;
        } else if (i < nInner + nTorus) {
          // ZONE B: Thick Clumpy Equatorial Molecular Torus (1.38R – 3.95R, heavy obscuration!)
          layerKind = 1.0;
          const u = Math.pow(rng(), 0.76);
          const rad = R * (1.38 + u * 2.60);
          // 5 thick organic molecular clouds with narrow glowing cracks peeking through!
          const clumpCenter = Math.floor(rng() * 5) * ((Math.PI * 2) / 5) + 0.35;
          const az = rng() < 0.72 ? (clumpCenter + randGauss(rng) * 0.44) : rng() * Math.PI * 2;
          const latMax = hasJet ? 0.68 : 0.92; // Open polar jet funnels on jetted AGN; thicker on Sgr A*!
          const lat = randGauss(rng) * latMax * (0.42 + 0.58 * u);
          const cLat = Math.cos(lat);
          px = Math.cos(az) * cLat * rad;
          py = Math.sin(lat) * rad;
          pz = Math.sin(az) * cLat * rad;
          innerWeight = Math.max(0.0, 1.0 - u * 1.45);
          puffSize = R * (0.62 + u * 0.78 + rng() * 0.38);
          omega = (0.11 + rng() * 0.05) / Math.pow(rad / R, 0.85);
          densityMult = 1.15;
        } else {
          // ZONE C: Enveloping Outer Circumnuclear Dust Cocoon (2.1R – 5.9R, shrouds the entire core!)
          layerKind = 2.0;
          const u = Math.pow(rng(), 0.85);
          const rad = R * (2.10 + u * 3.80);
          const az = rng() * Math.PI * 2;
          // Wrap high over the poles on Sgr A* (±78°), leave polar chimneys open on jetted AGN (±58°)
          const maxSinLat = hasJet ? 0.82 : 0.96;
          const sinLat = (rng() * 2.0 - 1.0) * maxSinLat;
          const cosLat = Math.sqrt(Math.max(0.02, 1.0 - sinLat * sinLat));
          px = Math.cos(az) * cosLat * rad;
          py = sinLat * rad;
          pz = Math.sin(az) * cosLat * rad;
          innerWeight = Math.max(0.0, 0.32 - u * 0.32);
          puffSize = R * (0.95 + u * 1.15 + rng() * 0.55);
          omega = (0.055 + rng() * 0.03) / Math.pow(rad / R, 0.8);
          densityMult = 0.88;
        }

        pos[i * 3] = px;
        pos[i * 3 + 1] = py;
        pos[i * 3 + 2] = pz;

        tData[i * 4] = omega;
        tData[i * 4 + 1] = puffSize;
        tData[i * 4 + 2] = innerWeight;
        tData[i * 4 + 3] = rng();

        tExtra[i * 2] = layerKind;
        tExtra[i * 2 + 1] = densityMult;
      }

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('aTorusData', new THREE.BufferAttribute(tData, 4));
      geo.setAttribute('aTorusExtra', new THREE.BufferAttribute(tExtra, 2));

      const mat = SHADERS.createBHDustTorusMaterial(textures.dustAtlas || textures.dustCloud, {
        rimColor: isSgrA ? 0xff943d : 0xff7b29,
        clearNear: R * 0.30,
        clearFar: R * 1.15
      });
      mat.uniforms.uPixelRatio.value = currentPR;

      const pts = new THREE.Points(geo, mat);
      pts.position.copy(entry.worldPos);
      pts.quaternion.copy(entry.mesh.quaternion);
      pts.frustumCulled = false;
      pts.visible = false;
      pts.renderOrder = 6; // Draws over Gargantua back-side sphere to realistically shroud it!
      bhGroup.add(pts);

      bhDustTorusEntries.push({
        bhEntry: entry,
        points: pts,
        mat: mat,
        maxActiveDist: R * 54
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
    cmbDomeMesh = new THREE.Mesh(new THREE.SphereGeometry(1000000, 56, 36), cmbMat);
    cmbDomeMesh.renderOrder = -50;
    cmbDomeMesh.visible = false;
    scene.add(cmbDomeMesh);

    const skyCount = 10000;
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
      const r = 885000 + rng() * 80000;
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
      size: 3800,
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
      const r = (235000 + rng() * 52000) * EXT_SCALE;
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
      size: 4600 * EXT_SCALE,
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
      isConstellation: !!opts.isConstellation,
      dynamicSStar: opts.dynamicSStar || null,
      dynamicPlanet: opts.dynamicPlanet || null,
      dynamicSolarExtra: opts.dynamicSolarExtra || null,
      dynamicTrappist: opts.dynamicTrappist || null
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
        maxDist: bh.id === 'sgra' ? 42 : 420 * EXT_SCALE
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
        minDist: st.isSol ? 0.65 : 0.9,
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
        minDist: 0.012,
        maxDist: 3.4,
        dynamicPlanet: pe
      });
    });

    // Live clickable labels for v16 Dwarf Planets, Comet 3I/ATLAS, JWST & Voyagers!
    solarExtraEntries.forEach(function (ex) {
      registerLabel({
        id: ex.id,
        text: ex.label,
        meta: ex.radiusTxt.split(' (')[0],
        pos: [SOL_POS.x, SOL_POS.y, SOL_POS.z],
        cssClass: ex.kind === 'comet' || ex.kind === 'probe' || ex.kind === 'jwst' ? 'label-sun' : 'label-nebula',
        minDist: 0.012,
        maxDist: ex.kind === 'jwst' ? 0.55 : 4.2,
        dynamicSolarExtra: ex
      });
    });

    // TRAPPIST-1 Exoplanet System Label & 7 Orbiting Exoplanet Labels
    registerLabel({
      id: 'trappist1',
      text: 'TRAPPIST-1',
      meta: '7 Earth-Sized Worlds • 40.7 ly',
      pos: [TRAPPIST_POS.x, TRAPPIST_POS.y + 0.42, TRAPPIST_POS.z],
      cssClass: 'label-sun',
      minDist: 0.45,
      maxDist: 165
    });
    trappistPlanetEntries.forEach(function (pe) {
      registerLabel({
        id: pe.def.id,
        text: pe.def.name,
        meta: pe.def.hz ? 'Habitable Zone' : pe.def.period.toFixed(1) + ' d',
        pos: [TRAPPIST_POS.x, TRAPPIST_POS.y, TRAPPIST_POS.z],
        cssClass: pe.def.hz ? 'label-sun' : 'label-star',
        minDist: 0.012,
        maxDist: 2.2,
        dynamicTrappist: pe
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
        maxDist: en.id === 'tarantula' ? 320 * EXT_SCALE : 150
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

    // Subtle 3D Gaia/Hipparcos Constellation Labels (visible near Solar System!)
    gaiaConstellationCentroids.forEach(function (con) {
      registerLabel({
        text: con.name,
        pos: con.pos,
        cssClass: 'label-arm',
        minDist: 1.5,
        maxDist: 18.5,
        isConstellation: true
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
        maxDist: g.id === 'milkyway' ? 18000 * EXT_SCALE : (isMajor ? 6200 * EXT_SCALE : 1600 * EXT_SCALE),
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
        minDist: 450 * EXT_SCALE,
        maxDist: 24000 * EXT_SCALE,
        minCamOrigin: 420 * EXT_SCALE
      });
    });

    CAT.LANIAKEA.lobes.forEach(function (lb) {
      registerLabel({
        id: 'laniakea',
        text: lb.name,
        pos: [lb.pos[0], lb.pos[1] + 420 * EXT_SCALE, lb.pos[2]],
        cssClass: 'label-cosmic',
        minDist: 2200 * EXT_SCALE,
        maxDist: 22000 * EXT_SCALE,
        minCamOrigin: 1600 * EXT_SCALE
      });
    });
    laniakeaSubLandmarks.forEach(function (sl) {
      registerLabel({
        id: sl.id,
        text: sl.text,
        meta: sl.meta,
        pos: sl.pos,
        cssClass: sl.css || 'label-cosmic',
        minDist: 1600 * EXT_SCALE,
        maxDist: 24000 * EXT_SCALE,
        minCamOrigin: 1350 * EXT_SCALE
      });
    });

    CAT.SUPERSTRUCTURES.forEach(function (sup) {
      registerLabel({
        id: sup.id,
        text: sup.name,
        meta: sup.knots + ' Clusters',
        pos: sup.labelPos,
        cssClass: 'label-cosmic',
        minDist: 4500 * EXT_SCALE,
        maxDist: 98000 * EXT_SCALE,
        minCamOrigin: 4200 * EXT_SCALE
      });
    });

    CAT.COSMIC_DAWN.forEach(function (cd) {
      registerLabel({
        id: cd.id,
        text: cd.shortName,
        meta: cd.cls,
        pos: cd.pos,
        cssClass: 'label-cosmic',
        minDist: 1000 * EXT_SCALE,
        maxDist: 1100000,
        minCamOrigin: 45000 * EXT_SCALE
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
        minDist: 9000 * EXT_SCALE,
        maxDist: 1000000,
        minCamOrigin: 9500 * EXT_SCALE
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
        maxDist: 1100000,
        minCamOrigin: 28000 * EXT_SCALE
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
      maxDist: 6500 * EXT_SCALE,
      minCamOrigin: 400 * EXT_SCALE
    });

    registerLabel({
      id: 'ngc6505',
      text: 'NGC 6505',
      meta: 'Euclid Complete Einstein Ring',
      pos: [NGC6505_POS.x, NGC6505_POS.y + 34, NGC6505_POS.z],
      cssClass: 'label-galaxy',
      minDist: 0,
      maxDist: 6500 * EXT_SCALE,
      minCamOrigin: 400 * EXT_SCALE
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
    const inSolarClose = camPos.distanceTo(SOL_POS) < 2.4;
    const inTrapClose = camPos.distanceTo(TRAPPIST_POS) < 1.8;
    const planetTightFocus = !!(activeFollowPlanet && camPos.distanceTo(controls.target) < 0.16);

    for (let i = 0; i < spaceLabels.length; i++) {
      const lb = spaceLabels[i];

      // Inside the Solar System or TRAPPIST-1: hide all distant Milky Way / Galactic Center labels (Sgr A*, S4714, Pistol Star, Constellations)!
      if (inSolarClose && !lb.dynamicPlanet && !lb.dynamicSolarExtra) {
        lb.el.style.display = 'none';
        continue;
      }
      if (inTrapClose && !lb.dynamicTrappist) {
        lb.el.style.display = 'none';
        continue;
      }
      // When tightly focused on a single planet (e.g. Earth), hide unrelated background dwarf-planet/outer labels!
      if (planetTightFocus && lb.dynamicSolarExtra && lb.dynamicSolarExtra !== activeFollowPlanet) {
        lb.el.style.display = 'none';
        continue;
      }
      if (planetTightFocus && lb.dynamicPlanet && lb.dynamicPlanet !== activeFollowPlanet) {
        lb.el.style.display = 'none';
        continue;
      }

      if ((lb.isArm && !state.showArms) || (lb.isSgrStream && !state.showSgrStream) || (lb.isConstellation && (!state.showConstellations || !gaiaGroup.visible)) || camOriginDist < lb.minCamOrigin) {
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
        lb.pos.y += lb.dynamicPlanet.def.radius * SOLAR_SCALE * 2.15 + 0.008;
      }
      if (lb.dynamicSolarExtra) {
        if (!solarSystemGroup.visible) {
          lb.el.style.display = 'none';
          continue;
        }
        lb.pos.copy(lb.dynamicSolarExtra.worldPos);
        lb.pos.y += 0.014;
      }
      if (lb.dynamicTrappist) {
        if (!trappistGroup.visible) {
          lb.el.style.display = 'none';
          continue;
        }
        lb.pos.copy(lb.dynamicTrappist.worldPos);
        lb.pos.y += 0.012;
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
      const offDist = Math.max(0.040, pe.def.radius * SOLAR_SCALE * (id === 'earth' ? 4.9 : 5.6));
      flight.toTarget.copy(pe.worldPos);
      if (id === 'earth') {
        // Dramatic orbital crescent angle (~64° off Sun-Earth line) -> shows sunlit continents/clouds,
        // glowing Rayleigh atmosphere, sunset terminator & vivid golden Black Marble city night lights!
        const toSun = SOL_POS.clone().sub(pe.worldPos).normalize();
        const upAxis = new THREE.Vector3(0, 1, 0);
        const sideDir = new THREE.Vector3().crossVectors(upAxis, toSun).normalize();
        const viewDir = toSun.clone().multiplyScalar(0.32).addScaledVector(sideDir, 0.90).addScaledVector(upAxis, 0.24).normalize();
        flight.toCam.copy(pe.worldPos).addScaledVector(viewDir, offDist);
      } else {
        flight.toCam.set(pe.worldPos.x + offDist * 0.72, pe.worldPos.y + offDist * 0.45, pe.worldPos.z + offDist);
      }
      activeFollowPlanet = pe;
    } else if (item.isTrappistPlanet && trappistPlanetMap[id]) {
      const pe = trappistPlanetMap[id];
      trappistGroup.visible = true;
      updateTrappist1System(state.time);
      const offDist = pe.followOffset || 0.038;
      flight.toTarget.copy(pe.worldPos);
      flight.toCam.set(pe.worldPos.x + offDist * 0.72, pe.worldPos.y + offDist * 0.45, pe.worldPos.z + offDist);
      activeFollowPlanet = pe;
    } else if (item.isSolarExtra && solarExtraMap[id]) {
      const ex = solarExtraMap[id];
      solarSystemGroup.visible = true;
      updateSolarSystem(state.time);
      const offDist = ex.followOffset || 0.055;
      flight.toTarget.copy(ex.worldPos);
      flight.toCam.set(ex.worldPos.x + offDist * 0.72, ex.worldPos.y + offDist * 0.45, ex.worldPos.z + offDist);
      activeFollowPlanet = ex;
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
    if (cosmicWebLineMat && cosmicWebLineMat.uniforms.uLodDensity) {
      cosmicWebLineMat.uniforms.uLodDensity.value = cfg.lod;
    }
    if (cosmicWebFlowMat) {
      cosmicWebFlowMat.uniforms.uPixelRatio.value = currentPR;
      cosmicWebFlowMat.uniforms.uLodDensity.value = cfg.lod;
    }
    if (cosmicWebVolumeMat) {
      cosmicWebVolumeMat.uniforms.uLodDensity.value = cfg.lod;
    }
    if (batchedNebulaMat) {
      batchedNebulaMat.uniforms.uPixelRatio.value = currentPR;
      batchedNebulaMat.uniforms.uLodDensity.value = cfg.lod;
    }
    if (batchedNebulaDarkMat) {
      batchedNebulaDarkMat.uniforms.uPixelRatio.value = currentPR;
      batchedNebulaDarkMat.uniforms.uLodDensity.value = cfg.lod;
    }
    initOrResizeAccretionFluid(qKey);
    if (laniakeaMistMat) {
      laniakeaMistMat.uniforms.uPixelRatio.value = currentPR;
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
    optical:    { num: 0.0, label: 'Optical HDR',          exposure: 1.08 },
    nircam:     { num: 1.0, label: 'JWST NIRCam',          exposure: 1.14 },
    miri:       { num: 2.0, label: 'JWST MIRI',            exposure: 1.12 },
    xray:       { num: 3.0, label: 'Chandra X-Ray',        exposure: 1.18 },
    radio:      { num: 4.0, label: 'Radio / EHT 230 GHz',  exposure: 1.22 },
    darkmatter: { num: 5.0, label: 'Dark Matter / Lensing', exposure: 1.18 }
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
    if (cosmicWebFlowMat) cosmicWebFlowMat.uniforms.uSpecMode.value = cfg.num;
    if (cosmicWebVolumeMat) cosmicWebVolumeMat.uniforms.uSpecMode.value = cfg.num;
    if (einsteinRingMat) einsteinRingMat.uniforms.uSpecMode.value = cfg.num;
    if (fieldGalaxyMat) fieldGalaxyMat.uniforms.uSpecMode.value = cfg.num;
    if (batchedNebulaMat) batchedNebulaMat.uniforms.uSpecMode.value = cfg.num;
    if (batchedNebulaDarkMat) batchedNebulaDarkMat.uniforms.uSpecMode.value = cfg.num;
    for (let vn = 0; vn < volumetricNebulaEntries.length; vn++) {
      volumetricNebulaEntries[vn].mat.uniforms.uSpecMode.value = cfg.num;
    }
    if (laniakeaMistMat) laniakeaMistMat.uniforms.uSpecMode.value = cfg.num;
    for (let sm = 0; sm < star3DMaterials.length; sm++) {
      star3DMaterials[sm].uniforms.uSpecMode.value = cfg.num;
    }
    for (let pm = 0; pm < planetShaderMaterials.length; pm++) {
      if (planetShaderMaterials[pm].uniforms && planetShaderMaterials[pm].uniforms.uSpecMode) {
        planetShaderMaterials[pm].uniforms.uSpecMode.value = cfg.num;
      }
    }
    if (earthAtmoMat && earthAtmoMat.uniforms && earthAtmoMat.uniforms.uSpecMode) {
      earthAtmoMat.uniforms.uSpecMode.value = cfg.num;
    }
    if (saturnRingMat && saturnRingMat.uniforms && saturnRingMat.uniforms.uSpecMode) {
      saturnRingMat.uniforms.uSpecMode.value = cfg.num;
    }
    if (solarCoronaMat && solarCoronaMat.uniforms && solarCoronaMat.uniforms.uSpecMode) {
      solarCoronaMat.uniforms.uSpecMode.value = cfg.num;
    }
    if (heliopauseMat && heliopauseMat.uniforms && heliopauseMat.uniforms.uSpecMode) {
      heliopauseMat.uniforms.uSpecMode.value = cfg.num;
    }
    if (ojGravWaveMat && ojGravWaveMat.uniforms && ojGravWaveMat.uniforms.uSpecMode) {
      ojGravWaveMat.uniforms.uSpecMode.value = cfg.num;
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

    state.baseDeepFieldOp = modeKey === 'nircam' ? 0.92 : (modeKey === 'xray' || modeKey === 'radio' || modeKey === 'darkmatter' ? 0.18 : 0.70);
    if (deepFieldMat) {
      deepFieldMat.opacity = state.baseDeepFieldOp;
      deepFieldMat.size = modeKey === 'nircam' ? 5200 : 3800;
    }
    if (quasarFieldMat) {
      quasarFieldMat.opacity = (modeKey === 'xray' || modeKey === 'radio' || modeKey === 'nircam') ? 0.98 : 0.72;
      quasarFieldMat.size = ((modeKey === 'xray' || modeKey === 'radio') ? 3400 : 2600) * EXT_SCALE;
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
        '<button data-quality="ultra" class="spec-btn qual-btn">Ultra 1M</button>' +
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
        specParent.appendChild(radioBtn);

        const dmBtn = document.createElement('button');
        dmBtn.setAttribute('data-mode', 'darkmatter');
        dmBtn.className = 'spec-btn';
        dmBtn.textContent = 'Dark Matter';
        specParent.appendChild(dmBtn);
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

  const _tourOffTmp = new THREE.Vector3();
  const _yAxisUpTmp = new THREE.Vector3(0, 1, 0);
  function updateGrandTour(dt) {
    if (!tour.active) return;
    if (flight.active) {
      tour.holdTimer = 0;
      return;
    }
    // Gentle cinematic orbit drift while pausing at each stop
    _tourOffTmp.copy(camera.position).sub(controls.target);
    _tourOffTmp.applyAxisAngle(_yAxisUpTmp, dt * 0.14);
    camera.position.copy(controls.target).add(_tourOffTmp);

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
    // Show live Solar System AU distance whenever exploring inside the Solar System!
    const dSol = camera.position.distanceTo(SOL_POS);
    if (dSol < 1.25) {
      const au = dSol / (0.88 * SOLAR_SCALE);
      return {
        dist: au < 0.25 ? Math.round(au * 149.6) + ' Mkm (Sol)' : au.toFixed(2) + ' AU (Sol)',
        lb: au < 1.0 ? Math.round(au * 8.3) + ' min' : (au * 8.3 / 60).toFixed(1) + ' hr',
        z: '0.000'
      };
    }

    // Piece-wise astrophysical scale mapping aligned to v11 Option A coordinates (1,000k CMB):
    let distTxt = '';
    let lbTxt = 'Now';
    let zTxt = '0.000';

    if (d < 8.0) {
      const au = Math.max(12, Math.round(d * 650));
      distTxt = au.toLocaleString() + ' AU';
      lbTxt = '26.7 kyr';
      zTxt = '0.000';
    } else if (d < 95.0) {
      const kpc = (d / 26.2) * 8.18;
      distTxt = kpc.toFixed(1) + ' kpc';
      lbTxt = (kpc * 3.26).toFixed(0) + ' kyr';
      zTxt = '0.000';
    } else if (d < 1560.0) {
      const mly = ((d - 95) / 1465) * 2.54 + 0.08;
      distTxt = mly.toFixed(2) + ' Mly';
      lbTxt = mly.toFixed(2) + ' Myr';
      zTxt = '0.000';
    } else if (d < 46000.0) {
      const mly = 2.54 + Math.pow((d - 1560) / 44440, 1.15) * 650;
      distTxt = mly < 1000 ? Math.round(mly) + ' Mly' : (mly / 1000).toFixed(2) + ' Bly';
      lbTxt = mly < 1000 ? Math.round(mly) + ' Myr' : (mly / 1000).toFixed(2) + ' Gyr';
      zTxt = (mly / 13800).toFixed(3);
    } else {
      // Deep cosmological scale (46k -> 1,000k CMB = 46.5 Bly comoving radius, z -> 1100)
      const f = THREE.MathUtils.clamp((d - 46000) / (1000000 - 46000), 0.0, 1.0);
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
  function syncMobileFloatingUILayout() {
    // Keep top Scale Pill cleanly below the top HUD header on mobile portrait screens!
    if (scalePillEl && !state.photoMode) {
      const narrow = window.innerWidth < 860;
      if (narrow) {
        const hudPanel = document.getElementById('hud-body') ? document.getElementById('hud-body').parentElement : null;
        const hudRect = hudPanel ? hudPanel.getBoundingClientRect() : null;
        const topOffset = (hudRect && hudRect.height > 10 && hudRect.bottom < 160) ? Math.round(hudRect.bottom + 8) : 92;
        scalePillEl.style.top = topOffset + 'px';
      } else {
        scalePillEl.style.top = '12px';
      }
    }
    // Keep bottom "Explore Earth Surface" CTA cleanly ABOVE the bottom Inspector card!
    if (earthSurface.enterBtnEl && earthSurface.enterBtnEl.style.display !== 'none') {
      const inspPanel = document.getElementById('insp-body') ? document.getElementById('insp-body').parentElement : null;
      const inspRect = inspPanel ? inspPanel.getBoundingClientRect() : null;
      const narrow = window.innerWidth < 860;
      if (narrow && inspRect && inspRect.height > 10) {
        const bottomSpace = Math.max(88, Math.round(window.innerHeight - inspRect.top + 10));
        earthSurface.enterBtnEl.style.bottom = Math.min(bottomSpace, 240) + 'px';
      } else {
        earthSurface.enterBtnEl.style.bottom = '22px';
      }
    }
  }

  function updateScalePill(camOriginDist, dt) {
    if (!scalePillEl || state.photoMode) return;
    scaleUpdateTimer += dt;
    if (scaleUpdateTimer < 0.12) return;
    scaleUpdateTimer = 0;
    const info = formatCosmicTelemetry(camOriginDist);
    if (scaleDistEl) scaleDistEl.textContent = info.dist;
    if (scaleLookbackEl) scaleLookbackEl.textContent = info.lb;
    if (scaleZEl) scaleZEl.textContent = 'z = ' + info.z;
    syncMobileFloatingUILayout();
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
      inp.placeholder = 'Search 150+ objects (Earth, TRAPPIST-1e, 3I/ATLAS, Bullet, TON 618...)';
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

    // 6B. Inject 'Constellations' Toggle (Real 3D Gaia/Hipparcos Sky around Sol)
    const ehtCb = document.getElementById('toggleEhtBFields');
    if (ehtCb && !document.getElementById('toggleConstellations')) {
      const ehtLabel = ehtCb.closest('label');
      if (ehtLabel && ehtLabel.parentElement) {
        const conLabel = document.createElement('label');
        conLabel.className = ehtLabel.className;
        const ccb = document.createElement('input');
        ccb.type = 'checkbox';
        ccb.id = 'toggleConstellations';
        ccb.checked = state.showConstellations;
        ccb.className = ehtCb.className;
        ccb.addEventListener('change', function (e) {
          state.showConstellations = e.target.checked;
        });
        conLabel.appendChild(ccb);
        const cspan = document.createElement('span');
        cspan.textContent = ' Constellations';
        conLabel.appendChild(cspan);
        ehtLabel.parentElement.insertBefore(conLabel, ehtLabel.nextSibling);

        // 6C. Inject 'Dark Matter' 3D NFW Halos Toggle + Live 'DM Gravity' Rotation Curve Toggle!
        const dmLabel = document.createElement('label');
        dmLabel.className = ehtLabel.className;
        const dmcb = document.createElement('input');
        dmcb.type = 'checkbox';
        dmcb.id = 'toggleDarkMatter';
        dmcb.checked = state.showDarkMatter;
        dmcb.className = ehtCb.className;
        dmcb.addEventListener('change', function (e) {
          state.showDarkMatter = e.target.checked;
        });
        dmLabel.appendChild(dmcb);
        const dmspan = document.createElement('span');
        dmspan.textContent = ' Dark Matter';
        dmLabel.appendChild(dmspan);
        conLabel.parentElement.insertBefore(dmLabel, conLabel.nextSibling);

        const dmgLabel = document.createElement('label');
        dmgLabel.className = ehtLabel.className;
        dmgLabel.title = 'Toggle Vera Rubin Flat Rotation Curve (ON = With Dark Matter, OFF = Slow Keplerian Falloff)';
        const dmgcb = document.createElement('input');
        dmgcb.type = 'checkbox';
        dmgcb.id = 'toggleDMGravity';
        dmgcb.checked = state.darkMatterGravity;
        dmgcb.className = ehtCb.className;
        dmgcb.addEventListener('change', function (e) {
          state.darkMatterGravity = e.target.checked;
        });
        dmgLabel.appendChild(dmgcb);
        const dmgspan = document.createElement('span');
        dmgspan.textContent = ' DM Gravity';
        dmgLabel.appendChild(dmgspan);
        dmLabel.parentElement.insertBefore(dmgLabel, dmLabel.nextSibling);

        // 6D. Inject 'Fluid Disk' Toggle (Live 2D GPU Navier-Stokes Accretion Plasma vs Procedural!)
        const flLabel = document.createElement('label');
        flLabel.className = ehtLabel.className;
        flLabel.title = 'Live 2D GPU Navier-Stokes Fluid Turbulence on Black Hole Accretion Disks';
        const flcb = document.createElement('input');
        flcb.type = 'checkbox';
        flcb.id = 'toggleFluidDisk';
        flcb.checked = state.fluidDiskEnabled;
        flcb.className = ehtCb.className;
        flcb.addEventListener('change', function (e) {
          state.fluidDiskEnabled = e.target.checked;
        });
        flLabel.appendChild(flcb);
        const flspan = document.createElement('span');
        flspan.textContent = ' Fluid Disk';
        flLabel.appendChild(flspan);
        dmgLabel.parentElement.insertBefore(flLabel, dmgLabel.nextSibling);
      }
    }

    // 7. Laptop Keyboard Shortcuts (Space = Pause, H = Photo Mode, R = Sgr A*)
    window.addEventListener('keydown', function (e) {
      if (earthSurface.active) return;
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


  // -------------------------------------------------------------------------
  // 15C. v18.1 "ENTER EARTH" PHOTOREALISTIC 3D SURFACE PORTAL (CesiumJS 1.147)
  //      * Fixes createGooglePhotorealistic3DTileset({ onlyUsingWithGoogleGeocoder: true })
  //        with automatic Cesium ion Asset 2275207 fallback!
  //      * Uses official Cesium CDN first (syncs CSS on fallback)
  //      * Uses flyToBoundingSphere + HeadingPitchRange -> frames every landmark DEAD-CENTER!
  //      * Prevents duplicate tileset loads & keeps globe visible until 3D tiles arrive!
  // -------------------------------------------------------------------------
  const CESIUM_ION_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJub25jZSI6Ii1seDd5TWlwM1EwVmpMcVEiLCJqdGkiOiIxOWNkZWMyNS02OWE0LTQ4NDQtODg2YS01MzcxNTFmMGYyMGQiLCJpZCI6NTU1MjQyLCJzdWIiOiJBbGV4MDQiLCJpc3MiOiJodHRwczovL2FwaS5jZXNpdW0uY29tIiwiYXVkIjoiQ29zbW9zM2QiLCJpYXQiOjE3OTU0MzQ0ODZ9.SkGpYPT255NgOqTaMt6ECcp9pBbPKKDF11qMse60qOE';

  const earthSurface = {
    active: false,
    loading: false,
    autoDiveArmed: true,
    cooldown: 0.0,
    Cesium: null,
    viewer: null,
    googleTileset: null,
    googleLoading: false,
    osmBuildings: null,
    osmLoading: false,
    mode: 'photoreal3d', // 'photoreal3d' | 'worldterrain'
    portalEl: null,
    flashEl: null,
    enterBtnEl: null,
    statusEl: null
  };

  // Exact target coordinates + ground elevation (m) + orbit viewing range (m) for dead-center framing!
  const EARTH_SURFACE_PRESETS = [
    { label: 'Bhubaneswar',   lon: 85.8338,  lat: 20.2382, elev: 45,   range: 950,   head: 20,  pitch: -34 },
    { label: 'Taj Mahal',     lon: 78.0421,  lat: 27.1751, elev: 170,  range: 520,   head: 15,  pitch: -30 },
    { label: 'Mt. Everest',   lon: 86.9250,  lat: 27.9881, elev: 8849, range: 6500,  head: -25, pitch: -22 },
    { label: 'Tokyo Tower',   lon: 139.7454, lat: 35.6586, elev: 20,   range: 680,   head: -30, pitch: -28 },
    { label: 'Burj Khalifa',  lon: 55.2744,  lat: 25.1972, elev: 5,    range: 1150,  head: 25,  pitch: -26 },
    { label: 'Eiffel Tower',  lon: 2.2945,   lat: 48.8584, elev: 35,   range: 640,   head: 35,  pitch: -28 },
    { label: 'Giza Pyramid',  lon: 31.1342,  lat: 29.9792, elev: 65,   range: 720,   head: -35, pitch: -30 },
    { label: 'New York 3D',   lon: -74.0134, lat: 40.7127, elev: 10,   range: 1100,  head: 18,  pitch: -28 },
    { label: 'Grand Canyon',  lon: -112.1129,lat: 36.1069, elev: 1150, range: 5200,  head: 25,  pitch: -26 }
  ];

  function loadCesiumOnce() {
    if (earthSurface.Cesium) return Promise.resolve(earthSurface.Cesium);
    if (window.Cesium) {
      earthSurface.Cesium = window.Cesium;
      return Promise.resolve(window.Cesium);
    }

    const PRIMARY_CDN = 'https://cesium.com/downloads/cesiumjs/releases/1.147/Build/Cesium/';
    const BACKUP_CDN  = 'https://cdn.jsdelivr.net/npm/cesium@1.147.0/Build/Cesium/';

    function ensureCesiumCSS(baseUrl) {
      let link = document.getElementById('cesium-widgets-css');
      if (!link) {
        link = document.createElement('link');
        link.id = 'cesium-widgets-css';
        link.rel = 'stylesheet';
        document.head.appendChild(link);
      }
      link.href = baseUrl + 'Widgets/widgets.css';
    }

    function loadFromBase(baseUrl) {
      return new Promise(function (resolve, reject) {
        window.CESIUM_BASE_URL = baseUrl;
        ensureCesiumCSS(baseUrl);
        const script = document.createElement('script');
        script.src = baseUrl + 'Cesium.js';
        script.async = true;
        script.onload = function () {
          if (window.Cesium) {
            earthSurface.Cesium = window.Cesium;
            resolve(window.Cesium);
          } else {
            reject(new Error('Cesium global missing after load'));
          }
        };
        script.onerror = function () {
          reject(new Error('Failed loading Cesium from ' + baseUrl));
        };
        document.head.appendChild(script);
      });
    }

    return loadFromBase(PRIMARY_CDN).catch(function () {
      return loadFromBase(BACKUP_CDN);
    });
  }

  function setCesiumMode(mode) {
    earthSurface.mode = mode;
    const viewer = earthSurface.viewer;
    const Cesium = earthSurface.Cesium;
    if (!viewer || !Cesium) return;

    const btnPhoto = document.getElementById('earthModePhotoBtn');
    const btnOsm = document.getElementById('earthModeOsmBtn');
    if (btnPhoto) btnPhoto.classList.toggle('active', mode === 'photoreal3d');
    if (btnOsm) btnOsm.classList.toggle('active', mode === 'worldterrain');

    if (mode === 'photoreal3d') {
      if (earthSurface.osmBuildings) earthSurface.osmBuildings.show = false;

      if (earthSurface.googleTileset) {
        if (viewer.scene.globe) viewer.scene.globe.show = false;
        earthSurface.googleTileset.show = true;
        if (earthSurface.statusEl) earthSurface.statusEl.style.display = 'none';
      } else if (!earthSurface.googleLoading) {
        earthSurface.googleLoading = true;
        // Keep base globe visible while Google 3D Tiles stream in (no black-screen flash!)
        if (viewer.scene.globe) viewer.scene.globe.show = true;
        if (earthSurface.statusEl) {
          earthSurface.statusEl.textContent = 'Streaming Google Photorealistic 3D Tiles…';
          earthSurface.statusEl.style.display = 'block';
        }

        // Required option { onlyUsingWithGoogleGeocoder: true } in CesiumJS 1.124+;
        // automatically falls back to Cesium ion Asset 2275207 if direct helper rejects!
        const loadGoogleTiles = (typeof Cesium.createGooglePhotorealistic3DTileset === 'function')
          ? Cesium.createGooglePhotorealistic3DTileset({ onlyUsingWithGoogleGeocoder: true }).catch(function () {
              return Cesium.Cesium3DTileset.fromIonAssetId(2275207);
            })
          : Cesium.Cesium3DTileset.fromIonAssetId(2275207);

        loadGoogleTiles.then(function (tileset) {
          earthSurface.googleLoading = false;
          if (!earthSurface.viewer) return;
          tileset.maximumScreenSpaceError = isMobile ? 16 : 10;
          viewer.scene.primitives.add(tileset);
          earthSurface.googleTileset = tileset;
          const isPhotoNow = (earthSurface.mode === 'photoreal3d');
          tileset.show = isPhotoNow;
          if (viewer.scene.globe) viewer.scene.globe.show = !isPhotoNow;
          if (earthSurface.statusEl) earthSurface.statusEl.style.display = 'none';
        }).catch(function (err) {
          earthSurface.googleLoading = false;
          console.warn('Google Photorealistic 3D Tiles unavailable -> switching to Satellite + OSM 3D:', err);
          if (earthSurface.statusEl) earthSurface.statusEl.style.display = 'none';
          setCesiumMode('worldterrain');
        });
      }
    } else {
      if (earthSurface.googleTileset) earthSurface.googleTileset.show = false;
      if (viewer.scene.globe) viewer.scene.globe.show = true;
      if (earthSurface.statusEl) earthSurface.statusEl.style.display = 'none';

      if (earthSurface.osmBuildings) {
        earthSurface.osmBuildings.show = true;
      } else if (!earthSurface.osmLoading && typeof Cesium.createOsmBuildingsAsync === 'function') {
        earthSurface.osmLoading = true;
        Cesium.createOsmBuildingsAsync().then(function (bldg) {
          earthSurface.osmLoading = false;
          if (!earthSurface.viewer) return;
          viewer.scene.primitives.add(bldg);
          earthSurface.osmBuildings = bldg;
          bldg.show = (earthSurface.mode === 'worldterrain');
        }).catch(function () {
          earthSurface.osmLoading = false;
        });
      }
    }
  }

  function flyCesiumToTarget(lon, lat, elevM, rangeM, headDeg, pitchDeg, durationSec) {
    const viewer = earthSurface.viewer;
    const Cesium = earthSurface.Cesium;
    if (!viewer || !Cesium) return;
    const center = Cesium.Cartesian3.fromDegrees(lon, lat, elevM || 0);
    const sphere = new Cesium.BoundingSphere(center, 45);
    viewer.camera.flyToBoundingSphere(sphere, {
      offset: new Cesium.HeadingPitchRange(
        Cesium.Math.toRadians(headDeg || 0),
        Cesium.Math.toRadians(pitchDeg !== undefined ? pitchDeg : -30),
        rangeM || 1000
      ),
      duration: durationSec !== undefined ? durationSec : 2.2
    });
  }

  function ensureEarthPortalDOM() {
    if (earthSurface.portalEl) return;

    // 1. Atmospheric Blue Entry Flash Overlay
    earthSurface.flashEl = document.createElement('div');
    earthSurface.flashEl.style.cssText =
      'position:fixed;inset:0;z-index:95;pointer-events:none;opacity:0;' +
      'background:radial-gradient(circle, rgba(125,211,252,0.55) 0%, rgba(14,116,144,0.35) 55%, rgba(2,6,23,0.92) 100%);' +
      'transition:opacity 0.45s ease;';
    document.body.appendChild(earthSurface.flashEl);

    // 2. Floating "Explore Earth Surface" CTA Button (shown when zoomed near Earth!)
    earthSurface.enterBtnEl = document.createElement('button');
    earthSurface.enterBtnEl.id = 'earth-enter-btn';
    earthSurface.enterBtnEl.innerHTML = '🌍 Explore Earth Surface (Google 3D Tiles)';
    earthSurface.enterBtnEl.style.cssText =
      'position:fixed;bottom:22px;left:50%;transform:translateX(-50%);z-index:45;display:none;' +
      'padding:9px 18px;border-radius:999px;font-size:12px;font-weight:600;letter-spacing:0.02em;' +
      'color:#f0f9ff;background:linear-gradient(135deg, rgba(14,165,233,0.88), rgba(37,99,235,0.88));' +
      'border:1px solid rgba(186,230,253,0.55);backdrop-filter:blur(10px);cursor:pointer;' +
      'box-shadow:0 6px 24px rgba(14,165,233,0.45);transition:transform 0.15s ease;';
    earthSurface.enterBtnEl.addEventListener('click', function () {
      enterEarthSurface('button');
    });
    document.body.appendChild(earthSurface.enterBtnEl);

    // 3. Full-Screen CesiumJS Photorealistic 3D Earth Portal Container
    const portal = document.createElement('div');
    portal.id = 'earth-surface-portal';
    portal.style.cssText =
      'position:fixed;inset:0;z-index:90;display:none;opacity:0;background:#020612;' +
      'transition:opacity 0.45s ease;font-family:system-ui,-apple-system,sans-serif;';

    portal.innerHTML =
      '<div id="earth-cesium-canvas" style="position:absolute;inset:0;width:100%;height:100%;"></div>' +
      '<div id="earth-portal-status" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);' +
        'z-index:5;padding:10px 16px;border-radius:12px;background:rgba(7,11,22,0.86);color:#bae6fd;' +
        'border:1px solid rgba(56,189,248,0.35);font-size:12px;display:none;">Entering Earth Atmosphere…</div>' +
      '<div style="position:fixed;top:12px;left:12px;right:12px;z-index:10;display:flex;flex-wrap:wrap;align-items:center;gap:6px;pointer-events:none;">' +
        '<button id="earthReturnSpaceBtn" style="pointer-events:auto;padding:7px 13px;border-radius:999px;font-size:12px;font-weight:600;' +
          'color:#f8fafc;background:rgba(15,23,42,0.88);border:1px solid rgba(56,189,248,0.55);backdrop-filter:blur(10px);cursor:pointer;">← Return to Space</button>' +
        '<form id="earthSearchForm" style="pointer-events:auto;display:flex;gap:4px;flex:1;min-width:170px;max-width:300px;">' +
          '<input id="earthSearchInput" type="text" placeholder="Fly anywhere on Earth (city, peak...)" ' +
            'style="flex:1;padding:6px 10px;border-radius:999px;font-size:11px;color:#f1f5f9;background:rgba(7,11,22,0.86);' +
            'border:1px solid rgba(148,163,184,0.38);outline:none;backdrop-filter:blur(10px);" />' +
          '<button type="submit" style="padding:6px 11px;border-radius:999px;font-size:11px;font-weight:600;color:#e0f2fe;' +
            'background:rgba(14,165,233,0.82);border:1px solid rgba(125,211,252,0.45);cursor:pointer;">Go</button>' +
        '</form>' +
        '<div style="pointer-events:auto;display:flex;gap:4px;background:rgba(7,11,22,0.82);padding:3px;border-radius:999px;border:1px solid rgba(148,163,184,0.28);backdrop-filter:blur(10px);">' +
          '<button id="earthModePhotoBtn" class="spec-btn active" style="border-radius:999px;padding:4px 10px;font-size:10px;">Google 3D</button>' +
          '<button id="earthModeOsmBtn" class="spec-btn" style="border-radius:999px;padding:4px 10px;font-size:10px;">Satellite + OSM 3D</button>' +
        '</div>' +
      '</div>' +
      '<div id="earthPresetsBar" style="position:fixed;bottom:30px;left:12px;right:12px;z-index:10;display:flex;flex-wrap:wrap;justify-content:center;gap:6px;pointer-events:none;"></div>';

    document.body.appendChild(portal);
    earthSurface.portalEl = portal;
    earthSurface.statusEl = document.getElementById('earth-portal-status');

    // Quick-fly presets bar (frames every landmark dead-center!)
    const pBar = document.getElementById('earthPresetsBar');
    EARTH_SURFACE_PRESETS.forEach(function (pr) {
      const btn = document.createElement('button');
      btn.textContent = pr.label;
      btn.style.cssText =
        'pointer-events:auto;padding:5px 10px;border-radius:999px;font-size:10.5px;font-weight:500;' +
        'color:#e2e8f0;background:rgba(7,11,22,0.82);border:1px solid rgba(148,163,184,0.32);' +
        'backdrop-filter:blur(8px);cursor:pointer;';
      btn.addEventListener('click', function () {
        flyCesiumToTarget(pr.lon, pr.lat, pr.elev, pr.range, pr.head, pr.pitch, 2.2);
      });
      pBar.appendChild(btn);
    });

    // Return to Space
    document.getElementById('earthReturnSpaceBtn').addEventListener('click', exitEarthSurface);

    // Mode Toggles (Google Photorealistic 3D vs Satellite + World Terrain + OSM 3D)
    document.getElementById('earthModePhotoBtn').addEventListener('click', function () {
      setCesiumMode('photoreal3d');
    });
    document.getElementById('earthModeOsmBtn').addEventListener('click', function () {
      setCesiumMode('worldterrain');
    });

    // Global Place Search via OpenStreetMap Nominatim (dead-center framing!)
    document.getElementById('earthSearchForm').addEventListener('submit', function (ev) {
      ev.preventDefault();
      const inp = document.getElementById('earthSearchInput');
      const q = (inp.value || '').trim();
      if (!q || !earthSurface.viewer) return;
      const oldPh = inp.placeholder;
      inp.blur();
      if (earthSurface.statusEl) {
        earthSurface.statusEl.textContent = 'Locating "' + q + '"…';
        earthSurface.statusEl.style.display = 'block';
      }
      fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&q=' + encodeURIComponent(q))
        .then(function (r) { return r.json(); })
        .then(function (rows) {
          if (earthSurface.statusEl) earthSurface.statusEl.style.display = 'none';
          if (rows && rows.length > 0) {
            const lon = parseFloat(rows[0].lon);
            const lat = parseFloat(rows[0].lat);
            flyCesiumToTarget(lon, lat, 120, 1400, 15, -32, 2.2);
          } else {
            inp.value = '';
            inp.placeholder = 'Location not found — try another name';
            setTimeout(function () { inp.placeholder = oldPh; }, 2200);
          }
        })
        .catch(function () {
          if (earthSurface.statusEl) earthSurface.statusEl.style.display = 'none';
        });
    });

    // Escape key exits Earth portal cleanly
    window.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && earthSurface.active) {
        exitEarthSurface();
      }
    });
  }

  function enterEarthSurface(trigger) {
    if (earthSurface.active || earthSurface.loading) return;
    ensureEarthPortalDOM();

    earthSurface.active = true;
    earthSurface.loading = true;
    earthSurface.autoDiveArmed = false;
    flight.active = false;
    if (tour.active) setTourActive(false);

    if (earthSurface.enterBtnEl) earthSurface.enterBtnEl.style.display = 'none';
    labelsContainer.style.display = 'none';

    if (earthSurface.flashEl) {
      earthSurface.flashEl.style.opacity = '1';
      setTimeout(function () {
        if (earthSurface.flashEl) earthSurface.flashEl.style.opacity = '0';
      }, 420);
    }

    earthSurface.portalEl.style.display = 'block';
    if (earthSurface.statusEl) {
      earthSurface.statusEl.textContent = 'Entering Earth Atmosphere — Loading Cesium Google 3D Globe…';
      earthSurface.statusEl.style.display = 'block';
    }
    requestAnimationFrame(function () {
      earthSurface.portalEl.style.opacity = '1';
    });

    loadCesiumOnce().then(function (Cesium) {
      earthSurface.loading = false;
      if (!earthSurface.active) return;

      if (!earthSurface.viewer) {
        try {
          Cesium.Ion.defaultAccessToken = CESIUM_ION_TOKEN;
          let terrainProvider;
          try {
            terrainProvider = Cesium.Terrain.fromWorldTerrain();
          } catch (tErr) {
            terrainProvider = new Cesium.EllipsoidTerrainProvider();
          }
          const viewer = new Cesium.Viewer('earth-cesium-canvas', {
            terrain: terrainProvider,
            animation: false,
            timeline: false,
            baseLayerPicker: false,
            geocoder: false,
            homeButton: false,
            sceneModePicker: false,
            navigationHelpButton: false,
            fullscreenButton: false,
            infoBox: false,
            selectionIndicator: false,
            msaaSamples: isMobile ? 1 : 2
          });
          if (viewer.scene && viewer.scene.renderError && typeof viewer.scene.renderError.addEventListener === 'function') {
            viewer.scene.renderError.addEventListener(function (_sc, rErr) {
              if (earthSurface.statusEl) {
                earthSurface.statusEl.textContent = 'Cesium render notice: ' + (rErr && rErr.message ? rErr.message : 'Retrying…');
                earthSurface.statusEl.style.display = 'block';
              }
            });
          }

          if (viewer.scene.skyAtmosphere) viewer.scene.skyAtmosphere.show = true;
          if (viewer.scene.globe) viewer.scene.globe.enableLighting = false;
          viewer.resolutionScale = isMobile ? 0.9 : Math.min(window.devicePixelRatio || 1, 1.25);

          earthSurface.viewer = viewer;
          setCesiumMode('photoreal3d');

          // Smooth orbital descent over India!
          viewer.camera.setView({
            destination: Cesium.Cartesian3.fromDegrees(82.0, 22.0, 14500000)
          });
          setTimeout(function () {
            if (earthSurface.active && earthSurface.viewer) {
              flyCesiumToTarget(85.8338, 20.2382, 45, 950000, 0, -78, 2.2);
            }
          }, 350);
        } catch (gpuErr) {
          console.error('CesiumJS init error:', gpuErr);
          if (earthSurface.statusEl) {
            earthSurface.statusEl.textContent = 'WebGL error loading CesiumJS. Tap Return to Space.';
            earthSurface.statusEl.style.display = 'block';
          }
        }
      } else {
        earthSurface.viewer.useDefaultRenderLoop = true;
        earthSurface.viewer.resize();
        if (earthSurface.statusEl) earthSurface.statusEl.style.display = 'none';
      }
    }).catch(function (err) {
      earthSurface.loading = false;
      console.error('CesiumJS load error:', err);
      if (earthSurface.statusEl) {
        earthSurface.statusEl.textContent = 'Could not load CesiumJS (check internet connection). Tap Return to Space.';
        earthSurface.statusEl.style.display = 'block';
      }
    });
  }

  function exitEarthSurface() {
    if (!earthSurface.active) return;
    earthSurface.active = false;
    earthSurface.loading = false;
    earthSurface.cooldown = 2.6;
    earthSurface.autoDiveArmed = false;

    if (earthSurface.viewer) {
      earthSurface.viewer.useDefaultRenderLoop = false;
    }
    if (earthSurface.statusEl) {
      earthSurface.statusEl.style.display = 'none';
    }

    if (earthSurface.portalEl) {
      earthSurface.portalEl.style.opacity = '0';
      setTimeout(function () {
        if (!earthSurface.active && earthSurface.portalEl) {
          earthSurface.portalEl.style.display = 'none';
        }
      }, 450);
    }

    const earthEntry = solarPlanetMap.earth;
    if (earthEntry) {
      solarSystemGroup.visible = true;
      updateSolarSystem(state.time);
      const dir = camera.position.clone().sub(earthEntry.worldPos);
      if (dir.lengthSq() < 1e-8) dir.set(0.72, 0.45, 1.0);
      dir.normalize();
      camera.position.copy(earthEntry.worldPos).addScaledVector(dir, 0.056);
      controls.target.copy(earthEntry.worldPos);
      activeFollowPlanet = earthEntry;
    }

    clock.getDelta();
  }

  function updateEarthPortalProximity(dt) {
    if (earthSurface.cooldown > 0) {
      earthSurface.cooldown = Math.max(0, earthSurface.cooldown - dt);
    }
    const earthEntry = solarPlanetMap.earth;
    if (!earthEntry || !solarSystemGroup.visible || earthSurface.active) {
      if (earthSurface.enterBtnEl) earthSurface.enterBtnEl.style.display = 'none';
      return;
    }

    const dEarth = camera.position.distanceTo(earthEntry.worldPos);

    if (!earthSurface.autoDiveArmed && dEarth > 0.032) {
      earthSurface.autoDiveArmed = true;
    }

    const showCTA = !state.photoMode && (dEarth < 0.095 || (window.currentSelectedId === 'earth' && dEarth < 0.35));
    if (earthSurface.enterBtnEl) {
      earthSurface.enterBtnEl.style.display = showCTA ? 'block' : 'none';
      if (showCTA) syncMobileFloatingUILayout();
    }

    if (earthSurface.autoDiveArmed && earthSurface.cooldown <= 0 && !flight.active && dEarth < 0.022) {
      enterEarthSurface('auto');
    }
  }

  function wireUI() {
    injectQualityControls();
    injectCosmicWebControls();
    injectV5Controls();
    injectV6Controls();
    injectV7Controls();
    ensureEarthPortalDOM();

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
      syncMobileFloatingUILayout();
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
      syncMobileFloatingUILayout();
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
    document.getElementById('stat-stars').textContent = totalBatchedStars >= 1000000
      ? (totalBatchedStars / 1000000).toFixed(2) + 'M'
      : (totalBatchedStars / 1000).toFixed(0) + 'k';
  }

  // -------------------------------------------------------------------------
  // 16. INITIALIZE WORLD & START ANIMATION LOOP
  // -------------------------------------------------------------------------
  applyV11UniverseRescale();
  buildBlackHoles();
  buildBatchedGalaxies();
  buildSStars();
  buildFermiBubbles();
  buildLandmarksAndNebulae();
  buildExtraLandmarkStars();
  buildGaiaConstellations();
  buildTrappist1System();
  buildClusterEffects();
  buildDarkMatterSystem();
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
    if (earthSurface.active && earthSurface.viewer) {
      earthSurface.viewer.resize();
    }
  });

  const clock = new THREE.Clock();
  const localCamTmp = new THREE.Vector3();
  const invQuatTmp = new THREE.Quaternion();
  const _followPrevTmp = new THREE.Vector3();
  const _followDeltaTmp = new THREE.Vector3();
  let fpsFrames = 0;
  let fpsTimer = 0;
  let lastNear = camera.near;

  const statFpsEl = document.getElementById('stat-fps');
  const statCallsEl = document.getElementById('stat-calls');

  function animate() {
    requestAnimationFrame(animate);
    if (state.contextLost || earthSurface.active) return;

    const dt = Math.min(clock.getDelta(), 0.05);
    const dtSim = dt * state.speed;
    state.time += dtSim;
    if (state.darkMatterGravity) {
      state.dmTimeFlat += dtSim;
    } else {
      state.dmTimeKep += dtSim;
    }

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

    // 1B. Live Planet Tracking, Solar System & TRAPPIST-1 Exoplanet Update
    if (activeFollowPlanet) {
      _followPrevTmp.copy(activeFollowPlanet.worldPos);
      updateSolarSystem(state.time);
      updateTrappist1System(state.time);
      _followDeltaTmp.copy(activeFollowPlanet.worldPos).sub(_followPrevTmp);
      if (flight.active) {
        flight.toTarget.add(_followDeltaTmp);
        flight.toCam.add(_followDeltaTmp);
      } else {
        camera.position.add(_followDeltaTmp);
        controls.target.add(_followDeltaTmp);
        if (camera.position.distanceTo(activeFollowPlanet.worldPos) > 1.25) {
          activeFollowPlanet = null;
        }
      }
    } else {
      updateSolarSystem(state.time);
      updateTrappist1System(state.time);
    }

    // 2. Focus- & Black-Hole-Aware Dynamic Near-Plane Adjustment
    //    Uses closest target / active black hole distance so TON 618, J0529, J1602,
    //    J0410, OJ 287, M87* & Sgr A* NEVER clip or disappear when zoomed in!
    const camOriginDist = camera.position.length();
    const focusDist = camera.position.distanceTo(controls.target);
    let closestActiveBHDist = focusDist;
    for (let bi = 0; bi < blackHoleEntries.length; bi++) {
      const be = blackHoleEntries[bi];
      const bd = camera.position.distanceTo(be.worldPos);
      if (bd < be.maxActiveDist && bd < closestActiveBHDist) {
        closestActiveBHDist = bd;
      }
    }
    const nearRef = Math.min(focusDist, closestActiveBHDist);
    const desiredNear = THREE.MathUtils.clamp(nearRef * 0.022, 0.0025, 420.0);
    if (Math.abs(desiredNear - lastNear) / Math.max(lastNear, 0.0005) > 0.12) {
      camera.near = desiredNear;
      camera.updateProjectionMatrix();
      lastNear = desiredNear;
    }

    // 3. Scale-Tier Visibility Culling (Aligned to v11 Option A 1,000k Universe!)
    //    Dynamically culls 1M batched galaxy stars & dust strictly beyond the farthest cluster!
    if (starPoints) starPoints.visible = camOriginDist < Math.max(95000, maxBatchedStarDist * 1.45);
    if (dustPoints) dustPoints.visible = state.showDust && camOriginDist < Math.max(45000, maxBatchedDustDist * 1.25);

    //    Smart Background Sky Auto-Fade ONLY when inside the Solar System (or TRAPPIST-1)!
    //    Completely hides Sgr A*'s orange dust cocoon, Fermi bubbles, Milky Way dust & glaring stars
    //    so Earth's sapphire oceans, clouds, atmosphere & golden night lights pop against pure space!
    const dSolGaia = camera.position.distanceTo(SOL_POS);
    const dTrapBg = camera.position.distanceTo(TRAPPIST_POS);
    const solStarFade = THREE.MathUtils.smoothstep(dSolGaia, 1.35, 5.2);
    const trapStarFade = THREE.MathUtils.smoothstep(dTrapBg, 0.65, 3.2);
    const bgStarDim = Math.min(solStarFade, trapStarFade);
    const insidePlanetarySys = bgStarDim < 0.04;

    if (batchedStarMat && batchedStarMat.uniforms.uSolarDim) {
      batchedStarMat.uniforms.uSolarDim.value = 0.028 + 0.972 * bgStarDim;
    }
    if (batchedDustMat && batchedDustMat.uniforms.uDustOpacity) {
      batchedDustMat.uniforms.uDustOpacity.value = bgStarDim;
    }
    if (dustPoints && insidePlanetarySys) dustPoints.visible = false;
    if (batchedNebulaMat && batchedNebulaMat.uniforms.uNebOpacity) {
      batchedNebulaMat.uniforms.uNebOpacity.value = bgStarDim;
    }
    if (batchedNebulaDarkMat && batchedNebulaDarkMat.uniforms.uNebOpacity) {
      batchedNebulaDarkMat.uniforms.uNebOpacity.value = bgStarDim;
    }
    if (deepFieldMat) {
      deepFieldMat.opacity = state.baseDeepFieldOp * (0.12 + 0.88 * bgStarDim);
    }

    //    Real 3D Gaia/Hipparcos Constellations around Sol & Earth (dims cleanly inside Solar System!)
    const gaiaFade = 1.0 - THREE.MathUtils.smoothstep(dSolGaia, 6.0, 16.5);
    const solInnerSoft = THREE.MathUtils.smoothstep(dSolGaia, 0.45, 2.4);
    const planetCloseSoft = THREE.MathUtils.smoothstep(focusDist, 0.04, 0.22);
    const gaiaSoft = Math.min(solInnerSoft, planetCloseSoft);
    gaiaGroup.visible = state.showConstellations && gaiaFade > 0.008;
    if (gaiaGroup.visible) {
      if (gaiaLineMat) gaiaLineMat.opacity = 0.22 * gaiaFade * (0.14 + 0.86 * gaiaSoft);
      if (gaiaStarMat) gaiaStarMat.opacity = 0.82 * gaiaFade * (0.18 + 0.82 * gaiaSoft);
    }

    //    v17 3D Volumetric NFW Dark Matter Halos, Orbiting Subhalos & Weak-Lensing Shear Arcs!
    const isDMMode = state.specMode === 'darkmatter';
    const dmActive = (isDMMode || state.showDarkMatter) && dSolGaia > 4.5 && camOriginDist > 16.0 && camOriginDist < 220000;
    darkMatterGroup.visible = dmActive;
    if (dmActive) {
      const dmStrength = isDMMode ? 1.0 : 0.42;
      const distGain = THREE.MathUtils.smoothstep(camOriginDist, 18.0, 95.0);
      for (let dh = 0; dh < dmHaloEntries.length; dh++) {
        const he = dmHaloEntries[dh];
        const dH = camera.position.distanceTo(he.worldPos);
        const vis = dH < he.maxDist && dH > he.radius * 0.12;
        he.mesh.visible = vis;
        if (vis) {
          he.mat.uniforms.uTime.value = state.time;
          he.mat.uniforms.uOpacity.value = 0.72 * dmStrength * distGain;
        }
      }
      if (dmSubhaloMat) {
        dmSubhaloMat.opacity = 0.62 * dmStrength * distGain;
        dmSubhaloMat.size = THREE.MathUtils.clamp(camOriginDist * 0.022, 5.5, 95.0);
      }
      if (dmLensingArcMat) dmLensingArcMat.opacity = (isDMMode ? 0.58 : 0.28) * THREE.MathUtils.smoothstep(camOriginDist, 320 * EXT_SCALE, 1200 * EXT_SCALE);
    }

    fermiGroup.visible = state.showFermi && !insidePlanetarySys && camOriginDist > 12 && camOriginDist < 1200;
    sgrStreamGroup.visible = state.showSgrStream && camOriginDist > 28 && camOriginDist < 2200;
    oj287Group.visible = camera.position.distanceTo(OJ287_POS) < 2200 * EXT_SCALE;
    ngc6505Group.visible = camera.position.distanceTo(NGC6505_POS) < 3600 * EXT_SCALE;
    clusterEffectsGroup.visible = camOriginDist > 260 * EXT_SCALE;
    const lanFade = THREE.MathUtils.smoothstep(camOriginDist, 480 * EXT_SCALE, 1450 * EXT_SCALE)
      * (1.0 - THREE.MathUtils.smoothstep(camOriginDist, 22000 * EXT_SCALE, 55000 * EXT_SCALE));
    laniakeaGroup.visible = state.showLaniakea && lanFade > 0.005;
    if (laniakeaGroup.visible) {
      if (laniakeaMistMat) laniakeaMistMat.uniforms.uOpacity.value = lanFade;
      if (laniakeaLineMat) laniakeaLineMat.opacity = 0.28 * lanFade;
      if (laniakeaGalMat) laniakeaGalMat.opacity = 0.80 * lanFade;
      if (laniakeaContourMat) laniakeaContourMat.opacity = 0.26 * lanFade;
      if (laniakeaPulseMat) laniakeaPulseMat.opacity = 0.85 * lanFade;
      if (laniakeaZoaMat) {
        // Zone of Avoidance dust obscures optical light, vanishes in Radio/21cm HI & X-Ray!
        const zoaSpec = (state.specMode === 'radio' || state.specMode === 'xray' || state.specMode === 'darkmatter') ? 0.0 : (state.specMode === 'nircam' ? 0.35 : 1.0);
        laniakeaZoaMat.opacity = 0.08 * lanFade * zoaSpec;
      }
    }
    quipuGroup.visible = state.showQuipu && camOriginDist > 2200 * EXT_SCALE;
    const webFade = THREE.MathUtils.smoothstep(camOriginDist, 4600 * EXT_SCALE, 14500 * EXT_SCALE);
    cosmicWebGroup.visible = state.showCosmicWeb && webFade > 0.005;
    if (cosmicWebGroup.visible) {
      if (cosmicWebLineMat) cosmicWebLineMat.uniforms.uOpacity.value = webFade;
      if (cosmicWebMistMat) cosmicWebMistMat.uniforms.uOpacity.value = webFade;
      if (cosmicWebPointMat) cosmicWebPointMat.uniforms.uOpacity.value = webFade;
      if (cosmicWebFlowMat) {
        cosmicWebFlowMat.uniforms.uOpacity.value = webFade;
        cosmicWebFlowMat.uniforms.uTime.value = state.time;
      }
      if (cosmicWebVolumeMat) {
        cosmicWebVolumeMat.uniforms.uOpacity.value = webFade;
        cosmicWebVolumeMat.uniforms.uTime.value = state.time;
        cosmicWebVolumeMat.uniforms.uCamLocal.value.copy(camera.position).divideScalar(COSMIC_WEB_VOL_RADIUS);
      }
    }
    const fieldFade = THREE.MathUtils.smoothstep(camOriginDist, 110, 460);
    fieldGalaxyGroup.visible = state.showFieldGalaxies && fieldFade > 0.004;
    if (fieldGalaxyGroup.visible && fieldGalaxyMat) {
      fieldGalaxyMat.uniforms.uFieldOpacity.value = fieldFade;
    }
    if (lrdPoints) lrdPoints.visible = camOriginDist > 42000 * EXT_SCALE;
    v7DeepGroup.visible = camOriginDist > 26000 * EXT_SCALE;
    quasarFieldGroup.visible = state.showQuasars && camOriginDist > 35000 * EXT_SCALE;
    reionGroup.visible = state.showReionization && camOriginDist > 80000 * EXT_SCALE;

    // Distance-culled EHT Polarized B-Field Swirls on Sgr A* & M87*
    for (let eb = 0; eb < ehtBFieldEntries.length; eb++) {
      const bf = ehtBFieldEntries[eb];
      const active = state.showEhtBFields && !insidePlanetarySys && camera.position.distanceTo(bf.worldPos) < bf.maxDist;
      bf.group.visible = active;
      if (active) {
        bf.lines.rotation.y = state.time * 0.22 * bf.dirSign;
      }
    }

    // Smoothly fade photographic hero galaxy glows in/out (keeps Sgr A* core & Solar System crisp!)
    heroGlowGroup.visible = state.showHeroGlows && state.specMode !== 'xray' && state.specMode !== 'radio' && state.specMode !== 'darkmatter';
    if (heroGlowGroup.visible) {
      const mwFade = THREE.MathUtils.smoothstep(camOriginDist, 26, 78);
      for (let h = 0; h < heroGlowEntries.length; h++) {
        const he = heroGlowEntries[h];
        const modeScale = state.specMode === 'miri' ? 0.55 : 1.0;
        he.mat.opacity = he.baseOp * modeScale * (he.isMW ? mwFade : 1.0);
        if (he.isMW) {
          he.mesh.rotation.y = -state.time * (he.omega || 0.08) * 0.42;
        }
      }
    }

    // 4. Distance-Culled Gargantua Ray-Marched Black Holes + Live Hybrid GPU Navier-Stokes Fluid!
    let anyBHActive = false;
    for (let i = 0; i < blackHoleEntries.length; i++) {
      const entry = blackHoleEntries[i];
      const bhDist = camera.position.distanceTo(entry.worldPos);
      const isActive = !insidePlanetarySys && bhDist < entry.maxActiveDist;
      entry.mesh.visible = isActive;
      if (isActive) {
        anyBHActive = true;
        entry.mat.uniforms.uTime.value = state.time;
        entry.mesh.updateMatrixWorld();
        localCamTmp.copy(camera.position);
        entry.mesh.worldToLocal(localCamTmp);
        entry.mat.uniforms.uCamLocal.value.copy(localCamTmp);

        // Align the lensed Milky Way Galactic Plane directly to world Y-up in each BH's local frame!
        if (entry.mat.uniforms.uGalPlaneLocal) {
          invQuatTmp.copy(entry.mesh.quaternion).conjugate();
          entry.mat.uniforms.uGalPlaneLocal.value.set(0, 1, 0).applyQuaternion(invQuatTmp).normalize();
        }
      }
    }

    // Step 2D GPU Navier-Stokes Accretion Fluid ONLY when a Black Hole is visible (0 ms everywhere else!)
    const useFluidNow = anyBHActive && accretionFluid.supported && state.fluidDiskEnabled && state.quality !== 'perf';
    if (useFluidNow) {
      stepAccretionFluid(dtSim, state.time, state.spin, false);
    }
    for (let i = 0; i < blackHoleEntries.length; i++) {
      const entry = blackHoleEntries[i];
      if (!entry.mesh.visible || !entry.mat.uniforms.uFluidStrength) continue;
      if (useFluidNow && accretionFluid.dyeA && accretionFluid.velA) {
        entry.mat.uniforms.uFluidMap.value = accretionFluid.dyeA.texture;
        entry.mat.uniforms.uFluidVelMap.value = accretionFluid.velA.texture;
        entry.mat.uniforms.uFluidStrength.value = 1.0;
      } else {
        entry.mat.uniforms.uFluidStrength.value = 0.0;
      }
    }

    // 4B. Distance-Culled Heavy 3D Black-Hole Dusty Tori (Max 1 Active, links to Dust toggle!)
    for (let bt = 0; bt < bhDustTorusEntries.length; bt++) {
      const td = bhDustTorusEntries[bt];
      const bhD = camera.position.distanceTo(td.bhEntry.worldPos);
      const active = state.showDust && !insidePlanetarySys && bhD < td.maxActiveDist;
      td.points.visible = active;
      if (active) {
        td.mat.uniforms.uTime.value = state.time;
        td.mat.uniforms.uDustOpacity.value = bgStarDim;
      }
    }

    // 4C. Distance-Culled 3D Named Landmark Stars, Pulsar Beams, Batched & 3D Volumetric Hero Nebulae
    const nebVisible = state.showNebulae && !insidePlanetarySys && camOriginDist > 3.2 && camOriginDist < 1650;
    batchedNebulaGroup.visible = nebVisible;
    let bestVolNeb = null;
    let bestVolFade = 0.0;
    if (nebVisible && volumetricNebulaEntries.length > 0) {
      for (let vn = 0; vn < volumetricNebulaEntries.length; vn++) {
        const ve = volumetricNebulaEntries[vn];
        const dNeb = camera.position.distanceTo(ve.worldPos);
        const showVol = dNeb < ve.maxDist;
        ve.mesh.visible = showVol;
        if (showVol) {
          const volFade = (1.0 - THREE.MathUtils.smoothstep(dNeb, ve.radius * 3.8, ve.maxDist)) * bgStarDim;
          ve.mat.uniforms.uTime.value = state.time;
          ve.mat.uniforms.uOpacity.value = volFade;
          ve.mesh.updateMatrixWorld();
          localCamTmp.copy(camera.position);
          ve.mesh.worldToLocal(localCamTmp);
          ve.mat.uniforms.uCamLocal.value.copy(localCamTmp);
          if (volFade > bestVolFade) {
            bestVolFade = volFade;
            bestVolNeb = ve;
          }
        }
      }
    }
    if (batchedNebulaMat && batchedNebulaMat.uniforms.uActiveVolFade) {
      batchedNebulaMat.uniforms.uActiveVolFade.value = bestVolFade;
      if (bestVolNeb) {
        batchedNebulaMat.uniforms.uActiveVolNeb.value.set(
          bestVolNeb.worldPos.x, bestVolNeb.worldPos.y, bestVolNeb.worldPos.z, bestVolNeb.radius
        );
      }
    }
    if (batchedNebulaDarkMat && batchedNebulaDarkMat.uniforms.uActiveVolFade) {
      batchedNebulaDarkMat.uniforms.uActiveVolFade.value = bestVolFade;
      if (bestVolNeb) {
        batchedNebulaDarkMat.uniforms.uActiveVolNeb.value.set(
          bestVolNeb.worldPos.x, bestVolNeb.worldPos.y, bestVolNeb.worldPos.z, bestVolNeb.radius
        );
      }
    }

    if (camOriginDist < 720) {
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
          entry.sprite.material.opacity = 0.08 + 0.92 * bgStarDim;
          entry.sprite.scale.setScalar(entry.baseScale * (0.35 + 0.65 * bgStarDim));
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
    if (batchedStarMat) {
      batchedStarMat.uniforms.uTime.value = state.time;
      if (batchedStarMat.uniforms.uTimeFlat) batchedStarMat.uniforms.uTimeFlat.value = state.dmTimeFlat;
      if (batchedStarMat.uniforms.uTimeKep) batchedStarMat.uniforms.uTimeKep.value = state.dmTimeKep;
    }
    for (let vj = 0; vj < volumetricJetMaterials.length; vj++) {
      volumetricJetMaterials[vj].uniforms.uTime.value = state.time;
    }
    if (v7DeepGroup.visible) {
      for (let qo = 0; qo < quasarOutflowMaterials.length; qo++) {
        quasarOutflowMaterials[qo].uniforms.uTime.value = state.time;
      }
    }
    if (batchedDustMat && state.showDust) {
      batchedDustMat.uniforms.uTime.value = state.time;
      if (batchedDustMat.uniforms.uTimeFlat) batchedDustMat.uniforms.uTimeFlat.value = state.dmTimeFlat;
      if (batchedDustMat.uniforms.uTimeKep) batchedDustMat.uniforms.uTimeKep.value = state.dmTimeKep;
    }
    if (fermiGroup.visible) {
      if (fermiMat) fermiMat.uniforms.uTime.value = state.time;
      if (erositaMat) erositaMat.uniforms.uTime.value = state.time;
    }

    // 6. Update S-Stars, OJ 287 Binary, NGC 6505 Ring, Laniakea Pulses & Radio Pulsars
    orbitsGroup.visible = state.showOrbits && !insidePlanetarySys;
    if (orbitsGroup.visible && camOriginDist < 120) updateSStars(state.time);
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
      const distRamp = THREE.MathUtils.smoothstep(camOriginDist, 300000, 780000);
      const op = state.showCMB ? distRamp * state.cmbSliderOpacity : 0.0;
      cmbMat.uniforms.uOpacity.value = op;
      cmbDomeMesh.visible = op > 0.005;
    }

    // 7B. Live Grand Tour, Cosmic Scale Pill & Earth 3D Surface Portal Proximity/Auto-Dive
    updateGrandTour(dt);
    updateScalePill(camOriginDist, dt);
    updateEarthPortalProximity(dt);

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
