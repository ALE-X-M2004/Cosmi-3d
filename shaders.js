/* =========================================================================
 * shaders.js — High-Detail Crash-Proof GLSL Shaders (v20.2 — Fixed Signed Gaussian safePow Bug on Earth Night Side, Auroras, Sunset Terminators, Saturn Rings & Fluid Feed)
 * Optimized for Integrated Laptop GPUs (ANGLE/D3D11) & Mobile GPUs (FP16)
 * Upgrades in v17:
 *  - Added 6th Filter Mode (uSpecMode = 5.0: Dark Matter / Lensing) across galaxy
 *    stars, dust, field galaxies, Laniakea, Cosmic Web & black holes!
 *  - Added createDarkMatterHaloMaterial(): Volumetric 3D Navarro-Frenk-White (NFW)
 *    dark matter halo shader with caustic filaments & weak-lensing Fresnel rim!
 *  - Added createGravWaveMaterial(): Expanding 3D quadrupole spiral gravitational
 *    wave spacetime ripples radiating from OJ 287's binary SMBH!
 *  - Upgraded createBatchedStarMaterial() & createBatchedDustMaterial():
 *    * Zero-jump dual-clock rotation (uTimeFlat + uTimeKep) for live Vera Rubin
 *      Dark Matter Gravity ON/OFF rotation curve toggling!
 *    * uSolarDim uniform to gracefully fade bright Milky Way background stars
 *      ONLY when flying inside the Solar System or TRAPPIST-1!
 *  - Upgraded Orbital Earth (createEarthOrbitalMaterial / Cloud / Atmosphere):
 *    * Real satellite cloud texture + cloud drop-shadows on Earth's surface
 *    * Vivid gamma-lifted NASA Black Marble golden city lights on Earth's night side
 *    * Richer multi-layer sapphire Rayleigh atmosphere & fiery sunset terminator!
 *  - Retains 100% of v16/v15/v14.1/v14/v13 shaders (23 crash-proof GLSL shaders)
 * ========================================================================= */

window.CosmosShaders = (function () {
  'use strict';

  const GLSL_PREC = `
    #ifdef GL_FRAGMENT_PRECISION_HIGH
      precision highp float;
    #else
      precision mediump float;
    #endif

    float safePow(float base, float expVal) {
      return pow(max(base, 0.0001), expVal);
    }

    float sq(float x) {
      return x * x;
    }
  `;

  // Manually unrolled 3-octave 2D FBM (instant compile on ANGLE/D3D11 & mobile)
  const GLSL_NOISE_2D_FAST = `
    float hash21(vec2 p) {
      p = fract(p * vec2(123.34, 456.21));
      p += dot(p, p + 45.32);
      return fract(p.x * p.y);
    }

    float noise2D(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      float a = hash21(i);
      float b = hash21(i + vec2(1.0, 0.0));
      float c = hash21(i + vec2(0.0, 1.0));
      float d = hash21(i + vec2(1.0, 1.0));
      return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
    }

    float fbm2D(vec2 p) {
      mat2 rot = mat2(0.80, -0.60, 0.60, 0.80);
      float v = 0.54 * noise2D(p);
      p = rot * p * 2.04 + vec2(13.7, 29.3);
      v += 0.30 * noise2D(p);
      p = rot * p * 2.06 + vec2(7.1, 19.8);
      v += 0.16 * noise2D(p);
      return v;
    }
  `;

  // Manually unrolled 3-octave 3D FBM for Fermi bubbles & CMB dome
  const GLSL_NOISE_3D_FAST = `
    float hash31(vec3 p) {
      p = fract(p * 0.1031);
      p += dot(p, p.yzx + 33.33);
      return fract((p.x + p.y) * p.z);
    }

    float noise3D(vec3 x) {
      vec3 i = floor(x);
      vec3 f = fract(x);
      f = f * f * (3.0 - 2.0 * f);

      float n000 = hash31(i);
      float n100 = hash31(i + vec3(1.0, 0.0, 0.0));
      float n010 = hash31(i + vec3(0.0, 1.0, 0.0));
      float n110 = hash31(i + vec3(1.0, 1.0, 0.0));
      float n001 = hash31(i + vec3(0.0, 0.0, 1.0));
      float n101 = hash31(i + vec3(1.0, 0.0, 1.0));
      float n011 = hash31(i + vec3(0.0, 1.0, 1.0));
      float n111 = hash31(i + vec3(1.0, 1.0, 1.0));

      float nx00 = mix(n000, n100, f.x);
      float nx10 = mix(n010, n110, f.x);
      float nx01 = mix(n001, n101, f.x);
      float nx11 = mix(n011, n111, f.x);

      return mix(mix(nx00, nx10, f.y), mix(nx01, nx11, f.y), f.z);
    }

    float fbm3D(vec3 p) {
      float v = 0.54 * noise3D(p);
      p = p * 2.03 + vec3(17.1, 31.7, 11.3);
      v += 0.30 * noise3D(p);
      p = p * 2.05 + vec3(9.4, 23.2, 5.7);
      v += 0.16 * noise3D(p);
      return v;
    }
  `;

  // =========================================================================
  // 1. HYPER-REALISTIC KERR BLACK HOLE SHADER (v20.0 — Hybrid GPU Navier-Stokes
  //    Fluid Accretion Disk + Real Milky Way Lensing + Distinct Sgr A* / Quasar Regimes!)
  //    54-step pure-math geodesic ray-marcher -> 3 crossings (n=0/1/2 rings),
  //    live Navier-Stokes macro eddies + infinite-res micro-filaments!
  // =========================================================================
  function createGargantuaMaterial(options) {
    const opts = options || {};
    const diskTint = opts.diskTint ? new THREE.Color(opts.diskTint) : new THREE.Color(0xffb463);
    const placeholderTex = opts.placeholderTex || null;

    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0.0 },
        uCamLocal: { value: new THREE.Vector3(0.0, 0.3, 1.8) },
        uSpin: { value: opts.spin !== undefined ? opts.spin : 0.85 },
        uSpecMode: { value: 0.0 }, // 0=Optical, 1=NIRCam, 2=MIRI, 3=X-Ray, 4=Radio/EHT, 5=DarkMatter
        uAccretionRegime: { value: opts.regime !== undefined ? opts.regime : 0.0 }, // 0=AGN, 1=SgrA* MAD/RIAF, 2=UV Quasar
        uFluidMap: { value: placeholderTex },
        uFluidVelMap: { value: placeholderTex },
        uFluidStrength: { value: 0.0 },
        uGalPlaneLocal: { value: new THREE.Vector3(0.18, 0.94, 0.28).normalize() },
        uDiskTint: { value: diskTint },
        uBrightness: { value: opts.brightness !== undefined ? opts.brightness : 1.32 }
      },
      vertexShader: `
        varying vec3 vLocalPos;
        void main() {
          vLocalPos = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        ${GLSL_PREC}

        uniform float uTime;
        uniform vec3 uCamLocal;
        uniform float uSpin;
        uniform float uSpecMode;
        uniform float uAccretionRegime;
        uniform sampler2D uFluidMap;
        uniform sampler2D uFluidVelMap;
        uniform float uFluidStrength;
        uniform vec3 uGalPlaneLocal;
        uniform vec3 uDiskTint;
        uniform float uBrightness;

        varying vec3 vLocalPos;

        ${GLSL_NOISE_2D_FAST}

        vec3 plasmaBlackbody(float temp) {
          float t = clamp(temp, 0.0, 1.85);
          if (uSpecMode > 4.5) {
            vec3 c0 = vec3(0.03, 0.01, 0.12);
            vec3 c1 = vec3(0.32, 0.14, 0.88);
            vec3 c2 = vec3(0.76, 0.42, 1.00);
            vec3 c3 = vec3(0.96, 0.94, 1.00);
            if (t < 0.34) return mix(c0, c1, t / 0.34);
            if (t < 0.80) return mix(c1, c2, (t - 0.34) / 0.46);
            return mix(c2, c3, clamp((t - 0.80) / 0.72, 0.0, 1.0));
          } else if (uSpecMode > 3.5) {
            // Event Horizon Telescope (EHT) 230/345 GHz synchrotron false-color palette
            vec3 c0 = vec3(0.04, 0.003, 0.00);
            vec3 c1 = vec3(0.76, 0.12, 0.01);
            vec3 c2 = vec3(1.00, 0.52, 0.05);
            vec3 c3 = vec3(1.00, 0.96, 0.72);
            if (t < 0.34) return mix(c0, c1, t / 0.34);
            if (t < 0.80) return mix(c1, c2, (t - 0.34) / 0.46);
            return mix(c2, c3, clamp((t - 0.80) / 0.72, 0.0, 1.0));
          } else if (uSpecMode > 2.5) {
            vec3 c1 = vec3(0.14, 0.04, 0.46);
            vec3 c2 = vec3(0.22, 0.64, 1.00);
            vec3 c3 = vec3(0.95, 0.99, 1.00);
            return t < 0.58 ? mix(c1, c2, t / 0.58) : mix(c2, c3, clamp((t - 0.58) / 0.82, 0.0, 1.0));
          } else if (uSpecMode > 1.5) {
            vec3 c1 = vec3(0.38, 0.03, 0.14);
            vec3 c2 = vec3(1.00, 0.34, 0.10);
            vec3 c3 = vec3(1.00, 0.88, 0.66);
            return t < 0.58 ? mix(c1, c2, t / 0.58) : mix(c2, c3, clamp((t - 0.58) / 0.82, 0.0, 1.0));
          } else if (uSpecMode > 0.5) {
            vec3 c1 = vec3(0.54, 0.16, 0.04);
            vec3 c2 = vec3(1.00, 0.72, 0.34);
            vec3 c3 = vec3(0.88, 0.96, 1.00);
            return t < 0.58 ? mix(c1, c2, t / 0.58) : mix(c2, c3, clamp((t - 0.58) / 0.82, 0.0, 1.0));
          } else if (uAccretionRegime > 1.5) {
            // REGIME 2: Hyperluminous UV / Electric Blue-White Quasar (TON 618, QSO J0529-4351, J1602, J0410!)
            vec3 q0 = vec3(0.22, 0.06, 0.16);
            vec3 q1 = vec3(0.84, 0.42, 0.24) * (0.55 + 0.45 * uDiskTint);
            vec3 q2 = vec3(0.58, 0.82, 1.00);
            vec3 q3 = vec3(0.95, 0.98, 1.00);
            if (t < 0.28) return mix(q0, q1, t / 0.28);
            if (t < 0.68) return mix(q1, q2, (t - 0.28) / 0.40);
            return mix(q2, q3, clamp((t - 0.68) / 0.72, 0.0, 1.0));
          } else if (uAccretionRegime > 0.5) {
            // REGIME 1: Sgr A* Optically-Thin MAD / RIAF Synchrotron Plasma (deep burnt crimson -> molten orange -> white-hot flare!)
            vec3 s0 = vec3(0.14, 0.012, 0.002);
            vec3 s1 = vec3(0.88, 0.22, 0.03);
            vec3 s2 = vec3(1.00, 0.64, 0.24);
            vec3 s3 = vec3(1.00, 0.96, 0.88);
            if (t < 0.32) return mix(s0, s1, t / 0.32);
            if (t < 0.76) return mix(s1, s2, (t - 0.32) / 0.44);
            return mix(s2, s3, clamp((t - 0.76) / 0.72, 0.0, 1.0));
          } else {
            // REGIME 0: Classic Kerr AGN Accretion Disk (Planck blackbody crimson -> amber -> gold -> white!)
            vec3 c0 = vec3(0.16, 0.018, 0.003);
            vec3 c1 = vec3(0.94, 0.25, 0.04) * (0.62 + 0.38 * uDiskTint);
            vec3 c2 = vec3(1.00, 0.74, 0.34);
            vec3 c3 = vec3(0.98, 0.98, 1.00);
            if (t < 0.30) return mix(c0, c1, t / 0.30);
            if (t < 0.74) return mix(c1, c2, (t - 0.30) / 0.44);
            return mix(c2, c3, clamp((t - 0.74) / 0.68, 0.0, 1.0));
          }
        }

        vec4 shadeAccretionHit(vec3 p, vec3 rayDir, float rIn, float rOut, float rs, float orderBoost) {
          float r = length(p.xz);
          if (r < rs * 1.04 || r > rOut) return vec4(0.0);

          // Live 2D Cartesian GPU Navier-Stokes Accretion Fluid lookup (ZERO polar seam, ZERO close-up blur!)
          float fluidDens = 0.5;
          float fluidHeat = 0.0;
          vec2 fluidAdvWarp = vec2(0.0);
          if (uFluidStrength > 0.01) {
            vec2 fUv = clamp(p.xz / (rOut * 2.02) + 0.5, 0.01, 0.99);
            vec3 fSample = texture2D(uFluidMap, fUv).rgb;
            vec2 fVel = texture2D(uFluidVelMap, fUv).rg;
            fluidDens = clamp(fSample.r, 0.0, 1.6);
            fluidHeat = clamp(fSample.g, 0.0, 1.4);
            // Gently shear high-res procedural micro-filaments along live Navier-Stokes velocity!
            fluidAdvWarp = clamp(fVel, vec2(-1.5), vec2(1.5)) * (0.045 * uFluidStrength);
          }

          // Keplerian differential shear + logarithmic magneto-rotational spiral winding
          float omega = 1.38 / safePow(r + 0.11, 1.42);
          float twist = uTime * omega * 0.56 - 7.4 * log(r + 0.068);
          float ct = cos(twist);
          float st = sin(twist);
          vec2 rotXZ = mat2(ct, -st, st, ct) * (p.xz + fluidAdvWarp);

          // Hybrid Turbulence: Live Navier-Stokes drives macro eddies; infinite-res fbm2D keeps micro-strands razor-sharp!
          float f1Proc = fbm2D(rotXZ * 8.2 + vec2(uTime * 0.032, -uTime * 0.025));
          float f1 = mix(f1Proc, clamp(fluidDens * 0.72 + f1Proc * 0.34, 0.0, 1.25), uFluidStrength * 0.78);
          float f2 = fbm2D(rotXZ * 22.0 + vec2(f1 * 1.65, -uTime * 0.048));

          // Orbiting magnetic reconnection flare hotspot near the ISCO (brighter in Sgr A* MAD regime!)
          float flareAng = uTime * 0.92;
          vec2 flarePos = vec2(cos(flareAng), sin(flareAng)) * (rIn + 0.055);
          float flareDist = length(p.xz - flarePos);
          float madFlareMult = (uAccretionRegime > 0.5 && uAccretionRegime < 1.5) ? 1.55 : 1.0;
          float magFlare = exp(-flareDist * flareDist * 190.0) * (0.65 + 0.35 * sin(uTime * 3.4)) * madFlareMult;

          // Relativistic velocity (Keplerian outside ISCO, rapid plunging infall inside ISCO)
          vec3 tangDir = normalize(vec3(-p.z, 0.0, p.x) + vec3(1e-5, 0.0, 0.0));
          vec3 radInDir = -normalize(vec3(p.x, 0.0, p.z) + vec3(1e-5, 0.0, 0.0));
          float plungeFrac = 1.0 - smoothstep(rIn * 0.85, rIn * 1.06, r);
          vec3 velDir = normalize(mix(tangDir, normalize(tangDir * 0.65 + radInDir * 0.76), plungeFrac));

          float beta = clamp(sqrt(0.62 * rs / max(r, rs * 1.03)), 0.0, 0.68);
          float cosTheta = dot(velDir, -normalize(rayDir));
          float gamma = inversesqrt(max(1.0 - beta * beta, 0.14));
          float doppler = 1.0 / max(gamma * (1.0 - beta * cosTheta), 0.24);
          float gravShift = sqrt(clamp(1.0 - (rs * 0.93) / max(r, rs * 1.02), 0.10, 1.0));
          float gTotal = clamp(doppler * gravShift, 0.18, 2.75);

          float beaming = mix(1.0, clamp(safePow(gTotal, 3.65), 0.14, 4.6), uSpin * 0.92);
          float colorShift = mix(0.0, (gTotal - 1.0) * 0.78, uSpin);

          // Inside ISCO: Plunging region (redshifted inward spiral streamers!)
          if (r < rIn) {
            float pEdge = smoothstep(rs * 1.04, rIn, r);
            float plungeStream = smoothstep(0.40, 0.86, f1 * 0.65 + f2 * 0.35) * pEdge * 0.48;
            float pTemp = 0.42 * pEdge + colorShift * 0.55;
            vec3 pCol = plasmaBlackbody(pTemp);
            float pAlpha = clamp(plungeStream * 0.85, 0.0, 0.62);
            return vec4(pCol * plungeStream * beaming * uBrightness * 0.92, pAlpha);
          }

          float rNorm = clamp((r - rIn) / max(rOut - rIn, 0.001), 0.0, 0.999);
          float innerEdge = smoothstep(rIn * 0.96, rIn + 0.026, r);

          // Regime-specific radial profile:
          //  - Radio / EHT 230 GHz: compact bright inner ring
          //  - Sgr A* MAD/RIAF (Regime 1): optically thinner outer torus, concentrated hot inner plasma ring!
          //  - UV Quasar (Regime 2): luminous wide optically thick radiation-dominated disk!
          float outerCutoff = (uSpecMode > 3.5) ? 0.46 : ((uAccretionRegime > 0.5 && uAccretionRegime < 1.5) ? 0.76 : 1.0);
          float outerEdge = safePow(1.0 - smoothstep(0.16 * outerCutoff, outerCutoff, rNorm), (uAccretionRegime > 0.5 && uAccretionRegime < 1.5) ? 2.05 : 1.60);

          float rings = 0.36 + 0.64 * sin(r * 86.0 - uTime * 2.2 + f1 * 6.8);
          float fineStreaks = 0.42 + 0.58 * sin(r * 210.0 + f2 * 9.5);
          float gapMod = 0.58 + 0.42 * cos(r * 38.0 + f1 * 4.4);

          float filament = safePow(clamp(0.14 + 0.86 * f1, 0.0, 1.0), 1.18) * (0.48 + 0.52 * f2);
          float density = innerEdge * outerEdge * filament * (0.34 + 0.66 * rings) * (0.58 + 0.42 * fineStreaks) * gapMod;

          float iscoGlow = exp(-rNorm * ((uSpecMode > 3.5) ? 4.6 : 7.4)) * innerEdge * ((uSpecMode > 3.5) ? 1.95 : 1.38);
          density += (magFlare + fluidHeat * 0.38 * uFluidStrength) * innerEdge * 0.82;

          float quasarTempBoost = (uAccretionRegime > 1.5) ? 0.24 : 0.0;
          float temp = (1.22 * safePow(1.0 - rNorm, 1.20) + iscoGlow * 0.58 + magFlare * 0.55 + fluidHeat * 0.34 * uFluidStrength + (f2 - 0.5) * 0.34 + quasarTempBoost) + colorShift;
          vec3 col = plasmaBlackbody(temp);

          // True Relativistic Doppler Blackbody Color Shift:
          //  - Approaching prograde side shifts hotter electric blue-white!
          //  - Receding side shifts cooler deep brick-crimson!
          if (uSpecMode < 0.5) {
            if (gTotal > 1.05) {
              col = mix(col, vec3(0.76, 0.90, 1.00), clamp((gTotal - 1.05) * 0.92 * uSpin, 0.0, 0.82));
            } else if (gTotal < 0.88) {
              col = mix(col, col * vec3(1.18, 0.44, 0.24), clamp((0.88 - gTotal) * 1.45 * uSpin, 0.0, 0.78));
            }
          }

          float radioGain = (uSpecMode > 3.5) ? 1.32 : 1.0;
          float thinAlphaScale = (uAccretionRegime > 0.5 && uAccretionRegime < 1.5 && uSpecMode < 3.5) ? 0.78 : 1.0;
          float intensity = (density * 2.05 + iscoGlow * 0.96) * beaming * uBrightness * radioGain * orderBoost;
          float alpha = clamp((density * 1.52 + iscoGlow * 0.55) * thinAlphaScale, 0.0, 0.97);
          return vec4(col * intensity, alpha);
        }

        // REAL MILKY WAY GALACTIC PLANE + GREAT RIFT DUST LENSING BEHIND THE BLACK HOLE!
        // As geodesics bend around the event horizon, the silver-gold river of the Milky Way
        // stretches and wraps smoothly into a continuous glowing Einstein ring!
        vec3 sampleLensedStars(vec3 d) {
          if (uSpecMode > 3.5) return vec3(0.0);
          vec3 nd = normalize(d);

          // 1. Analytical Lensed Milky Way Skyband (Galactic equator, golden bulge & dark Great Rift!)
          vec3 gN = normalize(uGalPlaneLocal);
          float bLat = dot(nd, gN);
          vec3 refAxis = abs(gN.y) > 0.9 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0);
          vec3 gU = normalize(cross(refAxis, gN));
          vec3 gV = cross(gN, gU);
          float gLon = atan(dot(nd, gV), dot(nd, gU));

          float bandProfile = exp(-bLat * bLat * 26.0);
          float bulgeProfile = exp(-bLat * bLat * 9.5) * exp(-gLon * gLon * 1.65);
          float mwCloud = fbm2D(vec2(gLon * 2.4, bLat * 9.0) + vec2(3.1, 1.7));
          float dustRift = smoothstep(0.36, 0.72, fbm2D(vec2(gLon * 4.2 + 1.4, bLat * 16.0))) * exp(-bLat * bLat * 88.0);

          vec3 mwSilver = mix(vec3(0.42, 0.58, 0.92), vec3(0.88, 0.84, 0.78), mwCloud);
          vec3 mwBulge = vec3(1.00, 0.80, 0.52) * bulgeProfile * 0.52;
          vec3 mwBand = (mwSilver * bandProfile * (0.20 + 0.36 * mwCloud) + mwBulge) * (1.0 - dustRift * 0.78);
          if (uSpecMode > 2.5) mwBand *= vec3(0.25, 0.65, 1.25) * 0.45;
          else if (uSpecMode > 1.5) mwBand = vec3(0.95, 0.42, 0.22) * (bandProfile * 0.25 + dustRift * 0.55);

          // 2. Crisp Background Field Stars (higher density along the Milky Way river!)
          vec3 p1 = nd * 58.0;
          vec3 c1 = floor(p1);
          vec3 f1 = fract(p1) - 0.5;
          float h1 = hash21(c1.xy + c1.z * 37.13);
          float cut1 = mix(0.962, 0.935, bandProfile);
          vec3 s1 = vec3(0.0);
          if (h1 > cut1) {
            float st1 = exp(-dot(f1, f1) * 56.0) * smoothstep(cut1, 1.0, h1);
            vec3 t1 = mix(vec3(0.72, 0.88, 1.0), vec3(1.0, 0.84, 0.62), fract(h1 * 91.7));
            s1 = t1 * st1 * 1.40;
          }

          vec3 p2 = nd * 124.0;
          vec3 c2 = floor(p2);
          vec3 f2 = fract(p2) - 0.5;
          float h2 = hash21(c2.yz + c2.x * 53.71);
          float cut2 = mix(0.968, 0.942, bandProfile);
          vec3 s2 = vec3(0.0);
          if (h2 > cut2) {
            float st2 = exp(-dot(f2, f2) * 44.0) * smoothstep(cut2, 1.0, h2);
            vec3 t2 = mix(vec3(0.82, 0.92, 1.0), vec3(1.0, 0.90, 0.76), fract(h2 * 67.3));
            s2 = t2 * st2 * 0.85;
          }
          return mwBand + s1 + s2;
        }

        void main() {
          const float RS = 0.095;
          // Spinning Kerr black hole pulls ISCO dramatically closer to the event horizon!
          float rIn = mix(2.65 * RS, 1.48 * RS, uSpin);
          const float rOut = 0.89;

          vec3 ro = uCamLocal;
          vec3 rd = normalize(vLocalPos - uCamLocal);

          float b = dot(ro, rd);
          float c = dot(ro, ro) - 1.0;
          float disc = b * b - c;
          if (disc < 0.0) discard;

          float tNear = max(0.0, -b - sqrt(max(disc, 0.0)));
          vec3 pos = ro + rd * tNear;
          vec3 dir = rd;

          bool captured = false;
          float minR = 10.0;
          vec3 minRPos = vec3(1.0, 0.0, 0.0);
          vec3 minRDir = rd;

          bool hasHit1 = false;
          vec3 hitPos1 = vec3(0.0);
          vec3 hitDir1 = vec3(0.0, 0.0, -1.0);

          bool hasHit2 = false;
          vec3 hitPos2 = vec3(0.0);
          vec3 hitDir2 = vec3(0.0, 0.0, -1.0);

          bool hasHit3 = false;
          vec3 hitPos3 = vec3(0.0);
          vec3 hitDir3 = vec3(0.0, 0.0, -1.0);

          float coronaGlow = 0.0;
          float coronaTempAcc = 0.0;

          // 54-step pure-math Kerr geodesic integrator (zero noise calls inside loop -> mobile safe!)
          const int MAX_STEPS = 54;
          for (int i = 0; i < MAX_STEPS; i++) {
            float r2 = dot(pos, pos);
            float r = sqrt(max(r2, 1e-6));
            if (r < minR) {
              minR = r;
              minRPos = pos;
              minRDir = dir;
            }

            if (r < RS * 1.03) {
              captured = true;
              break;
            }
            if (r > 1.06 && dot(pos, dir) > 0.0) {
              break;
            }

            float planeProx = clamp(abs(pos.y) * 2.8 + 0.36, 0.36, 1.0);
            float dt = clamp(r * 0.122 * planeProx, 0.014, 0.076);

            vec3 hVec = cross(pos, dir);
            float h2 = dot(hVec, hVec);
            vec3 accel = -1.5 * RS * h2 * pos / max(r2 * r2 * r, 1e-5);
            vec3 spinAxis = vec3(0.0, 1.0, 0.0);
            vec3 drag = cross(spinAxis, pos) * (uSpin * 0.24 * RS * RS / max(r2 * r, 1e-5));

            vec3 prevPos = pos;
            dir = normalize(dir + (accel + drag) * dt);
            pos += dir * dt;

            if ((prevPos.y > 0.0 && pos.y <= 0.0) || (prevPos.y < 0.0 && pos.y >= 0.0)) {
              float frac = abs(prevPos.y) / max(abs(prevPos.y) + abs(pos.y), 1e-6);
              vec3 hit = mix(prevPos, pos, frac);
              float hr = length(hit.xz);
              if (hr > RS * 1.04 && hr < rOut) {
                if (!hasHit1) {
                  hasHit1 = true;
                  hitPos1 = hit;
                  hitDir1 = dir;
                } else if (!hasHit2) {
                  hasHit2 = true;
                  hitPos2 = hit;
                  hitDir2 = dir;
                } else if (!hasHit3) {
                  hasHit3 = true;
                  hitPos3 = hit;
                  hitDir3 = dir;
                }
              }
            }

            float rXZ = length(pos.xz);
            float slabH = (uAccretionRegime > 0.5 && uAccretionRegime < 1.5)
              ? (0.036 + 0.088 * clamp((rXZ - rIn) / max(rOut - rIn, 0.01), 0.0, 1.0)) // Thicker Sgr A* RIAF torus!
              : (0.022 + 0.058 * clamp((rXZ - rIn) / max(rOut - rIn, 0.01), 0.0, 1.0));
            if (abs(pos.y) < slabH * 1.6 && rXZ > rIn * 0.85 && rXZ < rOut * 0.94) {
              float vf = exp(-(pos.y * pos.y) / max(slabH * slabH * 0.35, 1e-5));
              float rf = smoothstep(rIn * 0.85, rIn + 0.05, rXZ) * (1.0 - smoothstep(rOut * 0.42, rOut * 0.94, rXZ));
              float dStep = vf * rf * dt * 1.55;
              coronaGlow += dStep;
              coronaTempAcc += dStep * clamp(1.1 - (rXZ - rIn) / max(rOut - rIn, 0.01), 0.15, 1.15);
            }
          }

          vec3 accumColor = vec3(0.0);
          float transmittance = 1.0;

          if (hasHit1) {
            vec4 s1 = shadeAccretionHit(hitPos1, hitDir1, rIn, rOut, RS, 1.0);
            accumColor += transmittance * s1.rgb * s1.a;
            transmittance *= (1.0 - s1.a * 0.86);
          }

          if (hasHit2 && transmittance > 0.025) {
            vec4 s2 = shadeAccretionHit(hitPos2, hitDir2, rIn, rOut, RS, 1.24);
            accumColor += transmittance * s2.rgb * s2.a;
            transmittance *= (1.0 - s2.a * 0.86);
          }

          if (hasHit3 && transmittance > 0.02) {
            vec4 s3 = shadeAccretionHit(hitPos3, hitDir3, rIn, rOut, RS, 1.42);
            accumColor += transmittance * s3.rgb * s3.a;
            transmittance *= (1.0 - s3.a * 0.86);
          }

          if (coronaGlow > 0.002) {
            float avgT = clamp(coronaTempAcc / max(coronaGlow, 0.001), 0.25, 1.25);
            vec3 cCol = plasmaBlackbody(avgT * 0.82);
            accumColor += transmittance * cCol * min(coronaGlow, 0.95) * uBrightness * 0.58;
          }

          // Doppler-Asymmetric Multi-Order Photon Sub-Ring (n=1 razor sharp + n=0 EHT crescent!)
          if (!captured) {
            float ringDist = abs(minR - RS * 1.485);
            vec3 pVel = normalize(vec3(-minRPos.z, 0.0, minRPos.x) + vec3(1e-5, 0.0, 0.0));
            float pCos = dot(pVel, -normalize(minRDir));
            float ringDoppler = mix(1.0, clamp(1.0 + pCos * 0.68, 0.38, 1.95), uSpin * 0.88);

            float ehtBoost = (uSpecMode > 3.5) ? 2.05 : ((uAccretionRegime > 0.5 && uAccretionRegime < 1.5) ? 1.28 : 1.0);
            float sharpSubRing = exp(-ringDist * 115.0) * 1.95;
            float softHaloRing = exp(-ringDist * 20.0) * 0.36 * ehtBoost;
            float photonRing = (sharpSubRing + softHaloRing) * ringDoppler * ehtBoost;

            vec3 ringCol = plasmaBlackbody((uSpecMode > 3.5 ? 1.44 : 1.32) + (ringDoppler - 1.0) * 0.28);
            accumColor += transmittance * ringCol * photonRing * uBrightness;
            transmittance *= clamp(1.0 - photonRing * 0.52, 0.0, 1.0);

            // Real Lensed Milky Way Skyband + Einstein Ring magnification arc!
            float bendAmt = clamp(1.0 - dot(dir, rd), 0.0, 1.0);
            if (bendAmt > 0.012) {
              vec3 lensedSky = sampleLensedStars(dir) * smoothstep(0.012, 0.13, bendAmt);
              float eRingGlow = exp(-abs(minR - RS * 2.15) * 18.0) * smoothstep(0.20, 0.72, bendAmt) * (uSpecMode > 3.5 ? 0.0 : 0.18);
              accumColor += transmittance * (lensedSky + vec3(0.84, 0.90, 1.0) * eRingGlow);
            }
          }

          accumColor = clamp(accumColor, vec3(0.0), vec3(3.6));
          float alpha = captured ? 1.0 : clamp(1.0 - transmittance + length(accumColor) * 0.24, 0.0, 1.0);

          float outerEdgeFade = smoothstep(0.0, 0.18, sqrt(max(disc, 0.0)));
          float viewEdge = mix(1.0, outerEdgeFade, smoothstep(0.86, 1.04, length(ro)));
          if (!captured) {
            alpha *= viewEdge;
            accumColor *= viewEdge;
          }

          if (alpha < 0.004) discard;
          gl_FragColor = vec4(accumColor, alpha);
        }
      `,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending
    });
  }

  // =========================================================================
  // 2. GPU-BATCHED GALAXY STARS SHADER WITH SMART VERTEX-SHADER DISTANCE LOD
  //    Supports 5 Spectral Bands (incl. 21 cm HI & Radio Synchrotron Mode!)
  // =========================================================================
  function createBatchedStarMaterial() {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0.0 },
        uTimeFlat: { value: 0.0 },
        uTimeKep: { value: 0.0 },
        uSolarDim: { value: 1.0 },
        uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 1.25) },
        uSpecMode: { value: 0.0 },
        uLodDensity: { value: 0.68 }
      },
      vertexShader: `
        attribute vec3 aGalCenter;
        attribute vec4 aGalQuat;
        attribute vec4 aStarData; // x=omega, y=size, z=spectral, w=kind(0=star,1=HII,2=spikeStar,3=globular)

        uniform float uTime;
        uniform float uTimeFlat;
        uniform float uTimeKep;
        uniform float uPixelRatio;
        uniform float uSpecMode;
        uniform float uLodDensity;

        varying vec3 vColor;
        varying float vKind;
        varying float vSpectral;
        varying float vDistFade;

        vec3 applyQuat(vec3 v, vec4 q) {
          vec3 t = 2.0 * cross(q.xyz, v);
          return v + q.w * t + cross(q.xyz, t);
        }

        void main() {
          // Seamless Vera Rubin Flat (with DM) vs. Keplerian falloff (without DM) rotation integral!
          float rDisk = length(position.xz);
          float kepFactor = inversesqrt(1.0 + rDisk * 0.095);
          float ang = aStarData.x * (uTimeFlat + uTimeKep * kepFactor);
          float ca = cos(ang);
          float sa = sin(ang);
          vec3 localPos = vec3(
            position.x * ca - position.z * sa,
            position.y,
            position.x * sa + position.z * ca
          );

          vec3 worldPos = aGalCenter + applyQuat(localPos, aGalQuat);
          vec4 mvPosition = modelViewMatrix * vec4(worldPos, 1.0);
          float dist = max(-mvPosition.z, 1.0);

          float starIdHash = fract(sin(position.x * 12.9898 + position.z * 78.233 + position.y * 37.719) * 43758.5453);
          float distFactor = mix(1.0, 0.34, smoothstep(320.0, 2200.0, dist));
          float keepProb = clamp(uLodDensity * distFactor + (aStarData.w > 0.5 ? 0.35 : 0.0), 0.16, 1.0);

          if (starIdHash > keepProb) {
            gl_PointSize = 0.0;
            gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
            vColor = vec3(0.0);
            vKind = 0.0;
            vSpectral = 0.5;
            vDistFade = 0.0;
            return;
          }

          float lumComp = mix(1.0, 1.38, smoothstep(320.0, 2200.0, dist) * (1.0 - keepProb));

          vColor = color * lumComp;
          vKind = aStarData.w;
          vSpectral = aStarData.z;

          float sizeBoost = 1.0;
          if (uSpecMode > 3.5) {
            // Radio / 21 cm HI: HII star-forming radio knots puff up, ordinary stars stay subtle
            sizeBoost = (vKind > 0.5 && vKind < 1.5) ? 1.85 : 1.15;
          } else if (uSpecMode > 0.5 && uSpecMode < 1.5 && vKind > 1.5 && vKind < 2.5) {
            sizeBoost = 1.95;
          } else if (uSpecMode > 1.5 && uSpecMode < 2.5 && vKind > 0.5 && vKind < 1.5) {
            sizeBoost = 1.45;
          } else if (vKind > 2.5) {
            sizeBoost = 1.35;
          }

          float rawSize = aStarData.y * sizeBoost * uPixelRatio * (255.0 / dist);
          float maxSz = (vKind > 0.5) ? 30.0 : 14.0;
          gl_PointSize = clamp(rawSize, 1.05, maxSz);

          vDistFade = clamp(rawSize / 1.4, 0.34, 0.95) * smoothstep(0.6, 3.2, dist);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        ${GLSL_PREC}

        uniform float uSpecMode;
        uniform float uSolarDim;

        varying vec3 vColor;
        varying float vKind;
        varying float vSpectral;
        varying float vDistFade;

        void main() {
          if (vDistFade < 0.005) discard;

          vec2 uv = gl_PointCoord - 0.5;
          float r = length(uv);
          if (r > 0.5) discard;

          float core = exp(-r * r * 28.0);
          float halo = exp(-r * 6.5) * 0.36;
          float shape = core + halo;

          if (vKind > 0.5 && vKind < 1.5) {
            shape = exp(-r * r * 10.0) * 0.48;
          } else if (vKind > 2.5) {
            shape = exp(-r * r * 18.0) * 0.82 + exp(-r * 4.5) * 0.38;
          }

          if (uSpecMode > 0.5 && uSpecMode < 1.5 && vKind > 1.5 && vKind < 2.5) {
            float s1 = exp(-abs(uv.y) * 56.0) * exp(-abs(uv.x) * 4.5);
            vec2 r60 = vec2(uv.x * 0.5 - uv.y * 0.866, uv.x * 0.866 + uv.y * 0.5);
            vec2 r120 = vec2(uv.x * 0.5 + uv.y * 0.866, -uv.x * 0.866 + uv.y * 0.5);
            float s2 = exp(-abs(r60.y) * 60.0) * exp(-abs(r60.x) * 5.0);
            float s3 = exp(-abs(r120.y) * 60.0) * exp(-abs(r120.x) * 5.0);
            float s4 = exp(-abs(uv.x) * 72.0) * exp(-abs(uv.y) * 10.0) * 0.42;
            shape += (s1 + s2 + s3 + s4) * 0.70;
          }

          vec3 col = vColor;
          float alpha = shape * vDistFade;

          if (uSpecMode > 4.5) {
            // Dark Matter / Lensing Mode: Ordinary stars dim into subtle pale ghosts so DM halos shine!
            col = mix(vec3(0.42, 0.56, 0.92), vec3(0.76, 0.72, 1.00), vSpectral);
            alpha *= (vKind > 2.5 ? 0.55 : 0.22);
          } else if (uSpecMode > 3.5) {
            // Radio / EHT 230 GHz + 21 cm Neutral Hydrogen (HI)
            if (vKind > 0.5 && vKind < 1.5) {
              // HII free-free & supernova remnant radio beacons
              col = vec3(1.0, 0.48, 0.10) * 1.35;
              alpha *= 0.92;
            } else if (vKind > 2.5) {
              // Globular clusters (dim in radio except millisecond pulsars)
              col = vec3(0.85, 0.32, 0.08);
              alpha *= 0.20;
            } else {
              // Outer young spiral disk traces 21 cm HI gas; old stars fade deep
              float hiGas = mix(0.46, 0.10, vSpectral);
              col = mix(vec3(1.0, 0.52, 0.14), vec3(0.62, 0.14, 0.04), vSpectral);
              alpha *= hiGas;
            }
          } else if (uSpecMode > 2.5) {
            float hotFactor = mix(0.60, 0.14, vSpectral);
            col = mix(vec3(0.45, 0.72, 1.0), vec3(0.62, 0.35, 1.0), vSpectral);
            alpha *= hotFactor;
          } else if (uSpecMode > 1.5) {
            if (vKind > 0.5 && vKind < 1.5) {
              col = vec3(1.0, 0.25, 0.62) * 1.18;
              alpha *= 0.84;
            } else {
              col = mix(vec3(0.35, 0.55, 0.95), vec3(1.0, 0.65, 0.28), vSpectral);
              alpha *= mix(0.24, 0.70, vSpectral);
            }
          } else if (uSpecMode > 0.5) {
            col = mix(col, col * vec3(1.10, 1.02, 0.88), 0.35);
            alpha *= 1.0;
          }

          // Gracefully dim glaring background Milky Way stars ONLY when inside the Solar System!
          alpha *= uSolarDim;
          col *= mix(0.42, 1.0, uSolarDim);

          if (alpha < 0.008) discard;
          gl_FragColor = vec4(clamp(col * 0.95, vec3(0.0), vec3(1.6)), clamp(alpha, 0.0, 0.92));
        }
      `,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
  }

  // =========================================================================
  // 3. 2x2 TEXTURE-ATLAS GPU-BATCHED DUST LANES SHADER (Incl. ALMA Sub-mm!)
  // =========================================================================
  function createBatchedDustMaterial(dustAtlasTexture) {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0.0 },
        uTimeFlat: { value: 0.0 },
        uTimeKep: { value: 0.0 },
        uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 1.25) },
        uSpecMode: { value: 0.0 },
        uDustOpacity: { value: 1.0 },
        uDustAtlas: { value: dustAtlasTexture }
      },
      vertexShader: `
        attribute vec3 aGalCenter;
        attribute vec4 aGalQuat;
        attribute vec4 aDustData;

        uniform float uTime;
        uniform float uTimeFlat;
        uniform float uTimeKep;
        uniform float uPixelRatio;

        varying vec3 vColor;
        varying float vSeed;
        varying float vOpacity;

        vec3 applyQuat(vec3 v, vec4 q) {
          vec3 t = 2.0 * cross(q.xyz, v);
          return v + q.w * t + cross(q.xyz, t);
        }

        void main() {
          float rDisk = length(position.xz);
          float kepFactor = inversesqrt(1.0 + rDisk * 0.095);
          float ang = aDustData.x * (uTimeFlat + uTimeKep * kepFactor);
          float ca = cos(ang);
          float sa = sin(ang);
          vec3 localPos = vec3(
            position.x * ca - position.z * sa,
            position.y,
            position.x * sa + position.z * ca
          );

          vec3 worldPos = aGalCenter + applyQuat(localPos, aGalQuat);
          vec4 mvPosition = modelViewMatrix * vec4(worldPos, 1.0);
          float dist = max(-mvPosition.z, 1.0);

          vColor = color;
          vSeed = aDustData.z;
          vOpacity = aDustData.w * smoothstep(2.5, 11.5, dist);

          gl_PointSize = clamp(aDustData.y * uPixelRatio * (245.0 / dist), 1.5, 46.0);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        ${GLSL_PREC}

        uniform float uSpecMode;
        uniform float uDustOpacity;
        uniform sampler2D uDustAtlas;

        varying vec3 vColor;
        varying float vSeed;
        varying float vOpacity;

        void main() {
          if (vOpacity < 0.01) discard;

          vec2 uv = gl_PointCoord - 0.5;
          if (dot(uv, uv) > 0.24) discard;

          float a = vSeed * 6.28318;
          float ca = cos(a);
          float sa = sin(a);
          vec2 localUV = clamp(mat2(ca, -sa, sa, ca) * uv + 0.5, 0.03, 0.97);

          float tileIdx = floor(fract(vSeed * 17.31) * 4.0);
          vec2 tileOrigin = vec2(mod(tileIdx, 2.0) * 0.5, floor(tileIdx * 0.5) * 0.5);
          vec2 atlasUV = tileOrigin + localUV * 0.5;

          vec4 tex = texture2D(uDustAtlas, atlasUV);
          float cloud = tex.a;
          if (cloud < 0.03) discard;

          if (uSpecMode > 4.5) {
            // Dark Matter Mode: Baryonic dust fades out completely
            discard;
          } else if (uSpecMode > 3.5) {
            // ALMA 230 GHz / Sub-mm Cold Molecular Dust Glow
            vec3 almaCol = mix(vec3(0.72, 0.16, 0.03), vec3(1.0, 0.56, 0.12), tex.r);
            gl_FragColor = vec4(almaCol, cloud * vOpacity * 0.42 * uDustOpacity);
          } else if (uSpecMode > 2.5) {
            gl_FragColor = vec4(0.06, 0.08, 0.14, cloud * vOpacity * 0.04 * uDustOpacity);
          } else if (uSpecMode > 1.5) {
            vec3 pahCol = mix(vec3(1.0, 0.44, 0.10), vec3(1.0, 0.16, 0.62), fract(vSeed * 3.7 + tex.r * 0.5));
            gl_FragColor = vec4(pahCol * (0.85 + 0.50 * tex.r), cloud * vOpacity * 0.68 * uDustOpacity);
          } else if (uSpecMode > 0.5) {
            gl_FragColor = vec4(0.40, 0.16, 0.08, cloud * vOpacity * 0.25 * uDustOpacity);
          } else {
            vec3 darkDust = vColor * (0.11 + 0.15 * tex.r);
            gl_FragColor = vec4(darkDust, cloud * vOpacity * 0.88 * uDustOpacity);
          }
        }
      `,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending
    });
  }

  // =========================================================================
  // 4. MILKY WAY FERMI (GAMMA), eROSITA (X-RAY) & PLANCK MICROWAVE HAZE
  // =========================================================================
  function createFermiBubbleMaterial(isErosita) {
    const innerCol = isErosita ? new THREE.Color(0x18a6ff) : new THREE.Color(0xd946ef);
    const rimCol = isErosita ? new THREE.Color(0x7dd3fc) : new THREE.Color(0xff52b8);

    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0.0 },
        uSpecMode: { value: 0.0 },
        uColorCore: { value: innerCol },
        uColorRim: { value: rimCol },
        uIsErosita: { value: isErosita ? 1.0 : 0.0 }
      },
      vertexShader: `
        varying vec3 vNormalWorld;
        varying vec3 vWorldPos;
        varying vec3 vLocalPos;

        void main() {
          vLocalPos = position;
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          vNormalWorld = normalize(mat3(modelMatrix) * normal);
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        ${GLSL_PREC}

        uniform float uTime;
        uniform float uSpecMode;
        uniform vec3 uColorCore;
        uniform vec3 uColorRim;
        uniform float uIsErosita;

        varying vec3 vNormalWorld;
        varying vec3 vWorldPos;
        varying vec3 vLocalPos;

        ${GLSL_NOISE_3D_FAST}

        void main() {
          vec3 toCam = cameraPosition - vWorldPos;
          float camLen = length(toCam);
          if (camLen < 0.001) discard;

          vec3 V = toCam / camLen;
          vec3 N = normalize(vNormalWorld);

          float ndotv = clamp(abs(dot(N, V)), 0.0, 0.9995);
          float fresnel = safePow(1.0 - ndotv, uIsErosita > 0.5 ? 2.4 : 1.9);

          float flowSign = vLocalPos.y >= 0.0 ? -1.0 : 1.0;
          vec3 sampleP = vLocalPos * 0.045 + vec3(0.0, flowSign * uTime * 0.14, 0.0);
          float n = fbm3D(sampleP);

          float baseFade = smoothstep(1.5, 16.0, abs(vLocalPos.y));
          float coreClear = smoothstep(14.0, 34.0, length(cameraPosition));

          float modeGain = (uSpecMode > 4.5)
            ? 0.08 // Dim baryonic gamma/X-ray bubbles in Dark Matter mode so NFW halo dominates!
            : ((uSpecMode > 3.5)
              ? (uIsErosita > 0.5 ? 0.18 : 0.92) // Inner Fermi lobes glow as Planck Microwave Haze!
              : ((uSpecMode > 2.5) ? 1.35 : (uSpecMode > 1.5 ? 0.25 : 0.20)));

          vec3 baseCol = (uSpecMode > 4.5)
            ? mix(vec3(0.28, 0.18, 0.78), vec3(0.68, 0.48, 1.0), fresnel * 0.8 + n * 0.3)
            : ((uSpecMode > 3.5)
              ? mix(vec3(0.86, 0.28, 0.04), vec3(1.0, 0.72, 0.22), fresnel * 0.8 + n * 0.3)
              : mix(uColorCore, uColorRim, fresnel * 0.8 + n * 0.35));

          float alpha = (fresnel * 0.70 + 0.12) * (0.45 + 0.55 * n) * baseFade * coreClear * modeGain;

          if (alpha < 0.008) discard;
          gl_FragColor = vec4(clamp(baseCol * (0.85 + 0.55 * fresnel), vec3(0.0), vec3(1.9)), clamp(alpha, 0.0, 0.78));
        }
      `,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending
    });
  }

  // =========================================================================
  // 5. GLARE-FREE PLANCK CMB COSMIC HORIZON DOME (Boosted in Radio/Microwave!)
  // =========================================================================
  function createCMBDomeMaterial() {
    return new THREE.ShaderMaterial({
      uniforms: {
        uOpacity: { value: 0.0 },
        uSpecMode: { value: 0.0 }
      },
      vertexShader: `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        ${GLSL_PREC}

        uniform float uOpacity;
        uniform float uSpecMode;

        varying vec3 vDir;

        ${GLSL_NOISE_3D_FAST}

        void main() {
          if (uOpacity < 0.005) discard;

          vec3 d = normalize(vDir);
          float n1 = fbm3D(d * 6.5);
          float n2 = fbm3D(d * 18.0 + vec3(4.2, -3.1, 7.8));
          float aniso = clamp(n1 * 0.62 + n2 * 0.38, 0.0, 1.0);

          vec3 coldSpot = vec3(0.02, 0.05, 0.16);
          vec3 midCool  = vec3(0.04, 0.16, 0.22);
          vec3 midWarm  = vec3(0.20, 0.16, 0.08);
          vec3 hotSpot  = vec3(0.32, 0.13, 0.06);

          vec3 col;
          if (aniso < 0.36) {
            col = mix(coldSpot, midCool, aniso / 0.36);
          } else if (aniso < 0.66) {
            col = mix(midCool, midWarm, (aniso - 0.36) / 0.30);
          } else {
            col = mix(midWarm, hotSpot, (aniso - 0.66) / 0.34);
          }

          float band = exp(-abs(d.y) * 5.0) * 0.04;
          col += vec3(band * 0.9, band * 0.6, band * 0.3);

          // CMB peaks in the microwave/radio band (160 GHz) — boost gently in Radio mode!
          float radioBoost = (uSpecMode > 3.5 && uSpecMode < 4.5) ? 1.42 : 1.0;
          col = clamp(col * radioBoost, vec3(0.0), vec3(0.46));
          gl_FragColor = vec4(col, clamp(uOpacity, 0.0, 0.88));
        }
      `,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending
    });
  }

  // =========================================================================
  // 6. ESA EUCLID NGC 6505 COMPLETE EINSTEIN RING SHADER (Zero Loops!)
  // =========================================================================
  function createEinsteinRingMaterial() {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0.0 },
        uSpecMode: { value: 0.0 }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        ${GLSL_PREC}

        uniform float uTime;
        uniform float uSpecMode;
        varying vec2 vUv;

        void main() {
          // vUv.x wraps around the 360° ring, vUv.y wraps across the torus tube profile
          float ang = vUv.x * 6.2831853;
          // 4 asymmetric Einstein-cross magnification knots (matches Euclid's NGC 6505 ring!)
          float knots = 0.56
            + 0.24 * cos(ang * 2.0 - 0.6)
            + 0.22 * cos(ang * 4.0 + 1.1)
            + 0.10 * sin(ang * 7.0 + uTime * 0.22);

          // Soft bright inner ridge fading cleanly at tube edges
          float tubeCenter = abs(fract(vUv.y) - 0.5) * 2.0;
          float radial = exp(-tubeCenter * tubeCenter * 4.8);

          vec3 col;
          if (uSpecMode > 4.5) {
            // Dark Matter / Lensing: Electric violet-white Einstein lensing magnification ring!
            col = mix(vec3(0.46, 0.24, 1.00), vec3(0.96, 0.88, 1.00), knots);
          } else if (uSpecMode > 3.5) {
            col = mix(vec3(0.95, 0.36, 0.06), vec3(1.0, 0.85, 0.40), knots);
          } else if (uSpecMode > 2.5) {
            col = mix(vec3(0.22, 0.65, 1.0), vec3(0.88, 0.96, 1.0), knots);
          } else if (uSpecMode > 1.5) {
            col = mix(vec3(1.0, 0.32, 0.52), vec3(1.0, 0.78, 0.36), knots);
          } else {
            // Iconic Euclid blue-white lensed background galaxy ring with golden-cyan knots
            col = mix(vec3(0.48, 0.74, 1.0), vec3(1.0, 0.92, 0.76), clamp(knots, 0.0, 1.0));
          }

          float alpha = clamp(radial * (0.45 + 0.62 * knots), 0.0, 0.96);
          if (alpha < 0.02) discard;
          gl_FragColor = vec4(clamp(col * (0.95 + 0.55 * knots), vec3(0.0), vec3(2.2)), alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending
    });
  }

  // =========================================================================
  // 6B. ADAPTIVE OPTICAL-TO-JWST DEEP FIELD MINI-GALAXY SHADER (1 Draw Call!)
  //     Uses 2x2 procedural mini-galaxy sprite atlas (Spiral, Edge-On, Ellip, Irr)
  // =========================================================================
  function createFieldGalaxyMaterial(galaxyAtlasTexture) {
    return new THREE.ShaderMaterial({
      uniforms: {
        uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 1.25) },
        uSpecMode: { value: 0.0 },    // 0=Optical, 1=NIRCam, 2=MIRI, 3=X-Ray, 4=Radio
        uLodDensity: { value: 0.68 }, // 0.38=Perf, 0.68=Balanced, 1.0=Ultra
        uFieldOpacity: { value: 0.0 },
        uGalAtlas: { value: galaxyAtlasTexture }
      },
      vertexShader: `
        attribute vec4 aFieldData; // x=worldSize, y=redshift(0..1), z=seed(0..1), w=tileIdx(0..3)

        uniform float uPixelRatio;
        uniform float uSpecMode;
        uniform float uLodDensity;

        varying vec3 vColor;
        varying float vRedshift;
        varying float vSeed;
        varying float vTile;
        varying float vFade;

        void main() {
          float seed = aFieldData.z;
          float zShift = aFieldData.y;

          // Spectral-mode adaptive visibility & LOD density:
          //  - Optical HDR: Crisp & natural, gently thinning ultra-distant high-z tail
          //  - JWST NIRCam: Full Ultra Deep Field density (reveals hidden redshifted galaxies!)
          //  - JWST MIRI:   Warm infrared dusty population
          //  - X-Ray/Radio: Only rare active AGN / starburst beacons remain visible
          float keepProb = uLodDensity;
          float modeSize = 1.0;

          if (uSpecMode > 4.5) {
            // Dark Matter / Lensing Mode: Faint background galaxies act as weak-lensing tracers
            keepProb = 0.35 * uLodDensity;
            modeSize = 0.82;
          } else if (uSpecMode > 3.5) {
            keepProb = 0.085 * uLodDensity;
            modeSize = 0.92;
          } else if (uSpecMode > 2.5) {
            keepProb = 0.13 * uLodDensity;
            modeSize = 0.95;
          } else if (uSpecMode > 1.5) {
            keepProb = clamp(uLodDensity * 0.88 + 0.12, 0.28, 1.0);
            modeSize = 1.24;
          } else if (uSpecMode > 0.5) {
            // JWST NIRCam Deep Field: Unlock full ~30k galaxies with larger crisp silhouettes!
            keepProb = clamp(uLodDensity * 1.15 + 0.20, 0.45, 1.0);
            modeSize = 1.48;
          } else {
            // Optical HDR: Subtle & clean against jet-black space
            float zThin = mix(1.0, 0.60, smoothstep(0.42, 0.95, zShift));
            keepProb = clamp(uLodDensity * zThin, 0.22, 1.0);
            modeSize = 1.0;
          }

          if (seed > keepProb) {
            gl_PointSize = 0.0;
            gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
            vColor = vec3(0.0);
            vRedshift = 0.0;
            vSeed = 0.0;
            vTile = 0.0;
            vFade = 0.0;
            return;
          }

          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          float dist = max(-mvPosition.z, 1.0);

          float rawSize = aFieldData.x * modeSize * uPixelRatio * (520.0 / dist);
          float minSz = (uSpecMode > 0.5 && uSpecMode < 1.5) ? 2.6 : 1.75;
          float maxSz = (uSpecMode > 0.5 && uSpecMode < 1.5) ? 44.0 : 34.0;
          gl_PointSize = clamp(rawSize, minSz, maxSz);

          // Prevent pop-in right against the camera lens & fade gently at extreme distance
          float nearFade = smoothstep(22.0, 95.0, dist);
          float sizeFade = clamp(rawSize / 2.2, 0.42, 1.0);

          vColor = color;
          vRedshift = zShift;
          vSeed = seed;
          vTile = aFieldData.w;
          vFade = nearFade * sizeFade;

          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        ${GLSL_PREC}

        uniform float uSpecMode;
        uniform float uFieldOpacity;
        uniform sampler2D uGalAtlas;

        varying vec3 vColor;
        varying float vRedshift;
        varying float vSeed;
        varying float vTile;
        varying float vFade;

        void main() {
          if (vFade < 0.005 || uFieldOpacity < 0.004) discard;

          vec2 uv = gl_PointCoord - 0.5;
          if (dot(uv, uv) > 0.238) discard;

          // Random 2D orientation per galaxy (strictly padded inside its 2x2 quadrant)
          float ang = vSeed * 6.2831853;
          float ca = cos(ang);
          float sa = sin(ang);
          vec2 localUV = clamp(mat2(ca, -sa, sa, ca) * uv + 0.5, 0.04, 0.96);

          float tileIdx = floor(clamp(vTile, 0.0, 3.0) + 0.01);
          vec2 tileOrigin = vec2(mod(tileIdx, 2.0) * 0.5, floor(tileIdx * 0.5) * 0.5);
          vec2 atlasUV = tileOrigin + localUV * 0.5;

          vec4 tex = texture2D(uGalAtlas, atlasUV);
          float mask = tex.a;
          if (mask < 0.025) discard;

          vec3 col;
          float alpha;

          if (uSpecMode > 4.5) {
            // Dark Matter / Lensing: Subtle lavender-violet lensed galaxy tracers
            col = mix(vec3(0.32, 0.24, 0.78), vec3(0.74, 0.62, 1.00), tex.r);
            alpha = mask * vFade * uFieldOpacity * 0.30;
          } else if (uSpecMode > 3.5) {
            // Radio / EHT: Compact orange-gold radio-loud AGN cores
            col = mix(vec3(0.92, 0.28, 0.04), vec3(1.0, 0.82, 0.36), tex.r);
            alpha = mask * vFade * uFieldOpacity * 0.86;
          } else if (uSpecMode > 2.5) {
            // Chandra X-Ray: Active AGN / starburst X-ray point sources
            col = mix(vec3(0.32, 0.62, 1.0), vec3(0.86, 0.94, 1.0), tex.r);
            alpha = mask * vFade * uFieldOpacity * 0.80;
          } else if (uSpecMode > 1.5) {
            // JWST MIRI: Glowing dusty amber-magenta infrared galaxies
            vec3 miriBase = mix(vec3(1.0, 0.38, 0.14), vec3(1.0, 0.18, 0.58), fract(vSeed * 7.3));
            col = miriBase * (0.65 + 0.65 * tex.rgb);
            alpha = mask * vFade * uFieldOpacity * 0.72;
          } else if (uSpecMode > 0.5) {
            // JWST NIRCam Ultra Deep Field: Bright, rich spirals & ruby-amber high-z galaxies!
            vec3 zRed = mix(vec3(1.0, 0.76, 0.42), vec3(1.0, 0.30, 0.24), vRedshift);
            vec3 base = tex.rgb * mix(vColor * 1.15, zRed, vRedshift * 0.78);
            col = base * (1.12 + 0.35 * vRedshift);
            alpha = mask * vFade * uFieldOpacity * (0.78 + 0.22 * vRedshift);
          } else {
            // Optical HDR: Jewel-like NASA Hubble + JWST palette (sapphire, gold, teal, ruby) below bloom!
            vec3 zWarm = mix(vec3(1.0, 0.80, 0.52), vec3(1.0, 0.44, 0.28), vRedshift);
            vec3 nasaTint = mix(vColor * vec3(1.08, 1.02, 1.14), zWarm, vRedshift * 0.68);
            vec3 base = tex.rgb * nasaTint;
            col = clamp(base * 0.80, vec3(0.0), vec3(0.80));
            alpha = mask * vFade * uFieldOpacity * mix(0.68, 0.42, vRedshift);
          }

          if (alpha < 0.01) discard;
          gl_FragColor = vec4(clamp(col, vec3(0.0), vec3(1.65)), clamp(alpha, 0.0, 0.95));
        }
      `,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
  }

  // =========================================================================
  // 6C. VOLUMETRIC RELATIVISTIC QUASAR JET SHADER (Fresnel + Helical Plasma +
  //     Travelling Recollimation Shock Knots | ZERO loops, Mobile & Laptop Safe!)
  // =========================================================================
  function createRelativisticJetMaterial(options) {
    const opts = options || {};
    const jetCol = new THREE.Color(opts.color !== undefined ? opts.color : 0x60a5fa);

    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0.0 },
        uSpecMode: { value: 0.0 },
        uJetColor: { value: jetCol },
        uIsSpine: { value: opts.isSpine ? 1.0 : 0.0 },
        uIsCounterJet: { value: opts.isCounterJet ? 1.0 : 0.0 },
        uFlowSpeed: { value: opts.flowSpeed !== undefined ? opts.flowSpeed : 1.45 },
        uIntensity: { value: opts.intensity !== undefined ? opts.intensity : 1.0 }
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vNormalWorld;
        varying vec3 vWorldPos;

        void main() {
          vUv = uv;
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          vNormalWorld = normalize(mat3(modelMatrix) * normal);
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        ${GLSL_PREC}

        uniform float uTime;
        uniform float uSpecMode;
        uniform vec3 uJetColor;
        uniform float uIsSpine;
        uniform float uIsCounterJet;
        uniform float uFlowSpeed;
        uniform float uIntensity;

        varying vec2 vUv;
        varying vec3 vNormalWorld;
        varying vec3 vWorldPos;

        ${GLSL_NOISE_2D_FAST}

        void main() {
          // vUv.y = 0 at magnetic nozzle base, 1 at distant jet tip
          float y = clamp(vUv.y, 0.0, 1.0);

          // Soft volumetric silhouette edge falloff (eliminates hard geometric cone borders!)
          vec3 toCam = cameraPosition - vWorldPos;
          float camLen = length(toCam);
          if (camLen < 0.0005) discard;
          vec3 V = toCam / camLen;
          vec3 N = normalize(vNormalWorld);
          float ndotv = clamp(abs(dot(N, V)), 0.0, 1.0);
          float edgeSoft = safePow(ndotv, uIsSpine > 0.5 ? 1.45 : 1.85);

          // Smooth launch-base fade-in & gradual downstream dissipation
          float baseFade = smoothstep(0.0, 0.065, y);
          float tipFade = safePow(1.0 - smoothstep(0.18, 1.0, y), uIsSpine > 0.5 ? 1.75 : 1.35);

          // Helical magnetized plasma coordinates (double-helix twist + outward flow)
          float flow = uTime * uFlowSpeed * (uIsSpine > 0.5 ? 1.45 : 0.95);
          float theta = vUv.x * 6.2831853;
          float helixPhase = theta * 2.0 - y * 13.5 + flow * 2.2;
          float doubleHelix = 0.50 + 0.50 * sin(helixPhase);

          // Seam-free cylindrical 2D FBM plasma turbulence streaming outward
          vec2 cylCoord = vec2(cos(theta), sin(theta)) * (1.8 + y * 2.2);
          float n1 = fbm2D(vec2(cylCoord.x + y * 1.4, y * 7.5 - flow * 0.85));
          float n2 = fbm2D(vec2(cylCoord.y - y * 1.1, y * 15.0 - flow * 1.55));
          float wisps = (0.32 + 0.68 * n1) * (0.48 + 0.52 * n2);

          // Travelling superluminal recollimation shock knots (like M87 HST-1 & 3C 273 knots!)
          float k1 = fract(y * 3.2 - flow * 0.24);
          float knot1 = exp(-sq((k1 - 0.5) * 8.5)) * smoothstep(0.05, 0.22, y) * (1.0 - smoothstep(0.75, 0.98, y));
          float k2 = fract(y * 5.8 - flow * 0.42 + 0.37);
          float knot2 = exp(-sq((k2 - 0.5) * 10.5)) * 0.65 * (1.0 - y);
          float shockKnots = (knot1 + knot2) * (0.45 + 0.55 * n1);

          // Blazing hot magnetic nozzle core at the launch base
          float nozzleCore = exp(-y * 9.5) * (uIsSpine > 0.5 ? 1.65 : 0.85);

          // Combine spine & sheath plasma structure
          float helicalBoost = mix(0.62 + 0.62 * doubleHelix, 0.82 + 0.36 * doubleHelix, uIsSpine);
          float density = baseFade * tipFade * edgeSoft * (wisps * helicalBoost + shockKnots * 1.35 + nozzleCore);

          // Relativistic Doppler beaming: approaching jet blazes, receding counter-jet dims & reddens
          float dopplerGain = (uIsCounterJet > 0.5) ? 0.36 : 1.0;

          // Spectral-band physical color response
          vec3 hotCore;
          vec3 midCol;
          vec3 outerCol;
          float specGain = 1.0;

          if (uSpecMode > 4.5) {
            // Dark Matter / Lensing: Subtle indigo-violet jet so surrounding DM halo dominates
            hotCore = vec3(0.88, 0.82, 1.00);
            midCol  = vec3(0.44, 0.28, 0.94);
            outerCol = vec3(0.18, 0.10, 0.56);
            specGain = 0.42;
          } else if (uSpecMode > 3.5) {
            // Radio / EHT 230 GHz: Intense orange-gold synchrotron sheath & plasma knots!
            hotCore = vec3(1.00, 0.94, 0.68);
            midCol  = vec3(1.00, 0.52, 0.10);
            outerCol = vec3(0.76, 0.14, 0.02);
            specGain = 1.55;
          } else if (uSpecMode > 2.5) {
            // Chandra X-Ray: Razor-sharp electric cyan-white shock spine
            hotCore = vec3(0.95, 0.99, 1.00);
            midCol  = vec3(0.28, 0.72, 1.00);
            outerCol = vec3(0.24, 0.16, 0.78);
            specGain = 1.35;
          } else if (uSpecMode > 1.5) {
            // JWST MIRI: Warm crimson-amber synchrotron outflow
            hotCore = vec3(1.00, 0.86, 0.62);
            midCol  = vec3(1.00, 0.36, 0.24);
            outerCol = vec3(0.58, 0.08, 0.34);
            specGain = 0.95;
          } else if (uSpecMode > 0.5) {
            // JWST NIRCam: Luminous golden-white & soft blue-white synchrotron jet
            hotCore = vec3(1.00, 0.96, 0.88);
            midCol  = mix(uJetColor, vec3(1.00, 0.82, 0.54), 0.42);
            outerCol = mix(uJetColor, vec3(0.76, 0.42, 0.24), 0.35);
            specGain = 1.12;
          } else {
            // Optical HDR: White-hot synchrotron spine -> electric blue/tint sheath -> deep violet tail
            hotCore = vec3(0.96, 0.98, 1.00);
            midCol  = mix(vec3(0.45, 0.78, 1.00), uJetColor, 0.68);
            outerCol = mix(vec3(0.32, 0.24, 0.88), uJetColor * 0.65, 0.45);
            specGain = 1.05;
          }

          if (uIsCounterJet > 0.5 && uSpecMode < 2.5) {
            midCol = mix(midCol, vec3(0.95, 0.42, 0.28), 0.38);
          }

          float heat = clamp((1.0 - y * 0.82) * 0.65 + uIsSpine * 0.32 + shockKnots * 0.55 + nozzleCore * 0.4, 0.0, 1.0);
          vec3 col = heat < 0.52
            ? mix(outerCol, midCol, heat / 0.52)
            : mix(midCol, hotCore, (heat - 0.52) / 0.48);

          float finalGain = uIntensity * dopplerGain * specGain * (uIsSpine > 0.5 ? 1.45 : 0.95);
          vec3 rgb = clamp(col * (0.75 + 1.15 * density) * finalGain, vec3(0.0), vec3(2.6));
          float alpha = clamp(density * finalGain * (uIsSpine > 0.5 ? 0.92 : 0.62), 0.0, 0.95);

          if (alpha < 0.008) discard;
          gl_FragColor = vec4(rgb, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending
    });
  }

  // =========================================================================
  // 6D. VOLUMETRIC QUASAR OUTFLOW / LYMAN-ALPHA WIND SHADER (Replaces Wireframe!)
  //     Expanding super-Eddington gas clouds & broad-line region nebula
  // =========================================================================
  function createQuasarOutflowMaterial(options) {
    const opts = options || {};
    const cInner = new THREE.Color(opts.innerColor !== undefined ? opts.innerColor : 0xfff3c4);
    const cOuter = new THREE.Color(opts.outerColor !== undefined ? opts.outerColor : 0xf59e0b);

    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0.0 },
        uSpecMode: { value: 0.0 },
        uColorInner: { value: cInner },
        uColorOuter: { value: cOuter },
        uOpacity: { value: opts.opacity !== undefined ? opts.opacity : 0.55 }
      },
      vertexShader: `
        varying vec3 vLocalPos;
        varying vec3 vNormalWorld;
        varying vec3 vWorldPos;

        void main() {
          vLocalPos = position;
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          vNormalWorld = normalize(mat3(modelMatrix) * normal);
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        ${GLSL_PREC}

        uniform float uTime;
        uniform float uSpecMode;
        uniform vec3 uColorInner;
        uniform vec3 uColorOuter;
        uniform float uOpacity;

        varying vec3 vLocalPos;
        varying vec3 vNormalWorld;
        varying vec3 vWorldPos;

        ${GLSL_NOISE_3D_FAST}

        void main() {
          vec3 toCam = cameraPosition - vWorldPos;
          float camLen = length(toCam);
          if (camLen < 0.001) discard;
          vec3 V = toCam / camLen;
          vec3 N = normalize(vNormalWorld);

          float ndotv = clamp(abs(dot(N, V)), 0.0, 0.999);
          // Soft translucent shell: limb-brightened expanding wind + soft center veil
          float rim = safePow(1.0 - ndotv, 1.65);
          float softEdge = smoothstep(0.0, 0.24, ndotv);

          // Radially expanding non-rotating super-Eddington gas billows
          vec3 dir = normalize(vLocalPos + vec3(1e-5));
          float n1 = fbm3D(dir * 3.8 - dir * (uTime * 0.26));
          float n2 = fbm3D(dir * 9.5 + vec3(uTime * 0.12, -uTime * 0.18, uTime * 0.09));
          float clouds = smoothstep(0.26, 0.84, n1 * 0.65 + n2 * 0.35);

          vec3 c1 = uColorInner;
          vec3 c2 = uColorOuter;
          if (uSpecMode > 4.5) {
            c1 = vec3(0.86, 0.74, 1.00);
            c2 = vec3(0.32, 0.16, 0.78);
          } else if (uSpecMode > 3.5) {
            c1 = vec3(1.0, 0.82, 0.36);
            c2 = vec3(0.86, 0.24, 0.04);
          } else if (uSpecMode > 2.5) {
            c1 = vec3(0.88, 0.97, 1.0);
            c2 = vec3(0.24, 0.58, 1.0);
          } else if (uSpecMode > 1.5) {
            c1 = vec3(1.0, 0.72, 0.34);
            c2 = vec3(0.92, 0.18, 0.48);
          }

          vec3 col = mix(c2, c1, clouds * 0.72 + rim * 0.28);
          float alpha = (rim * 0.62 + 0.16) * softEdge * (0.28 + 0.72 * clouds) * uOpacity;

          if (alpha < 0.008) discard;
          gl_FragColor = vec4(clamp(col * (0.95 + 0.55 * clouds), vec3(0.0), vec3(2.1)), clamp(alpha, 0.0, 0.82));
        }
      `,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending
    });
  }

  // =========================================================================
  // 6E. ENVELOPING 3-ZONE BLACK-HOLE DUST COCOON SHADER (Front Silhouette +
  //     Molten Forward-Scattered Rim Backlighting + Smart Fly-Through Clearing)
  // =========================================================================
  function createBHDustTorusMaterial(dustAtlasTexture, options) {
    const opts = options || {};
    const rimCol = new THREE.Color(opts.rimColor !== undefined ? opts.rimColor : 0xff8c38);

    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0.0 },
        uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 1.25) },
        uSpecMode: { value: 0.0 },
        uDustOpacity: { value: 1.0 },
        uClearNear: { value: opts.clearNear !== undefined ? opts.clearNear : 0.6 },
        uClearFar: { value: opts.clearFar !== undefined ? opts.clearFar : 2.6 },
        uRimColor: { value: rimCol },
        uDustAtlas: { value: dustAtlasTexture }
      },
      vertexShader: `
        attribute vec4 aTorusData;  // x=omega, y=worldSize, z=innerRimWeight(0..1), w=seed
        attribute vec2 aTorusExtra; // x=layerKind(0=innerStream,1=thickTorus,2=outerCocoon), y=densityMult

        uniform float uTime;
        uniform float uPixelRatio;
        uniform float uClearNear;
        uniform float uClearFar;

        varying float vInner;
        varying float vSeed;
        varying float vClearFade;
        varying float vDistFade;
        varying float vFrontFactor; // 1.0 = in front of BH (dark backlit silhouette), 0.0 = behind BH (warm lit!)
        varying float vLayerKind;
        varying float vDensity;

        void main() {
          float ang = aTorusData.x * uTime;
          float ca = cos(ang);
          float sa = sin(ang);
          vec3 localP = vec3(
            position.x * ca - position.z * sa,
            position.y + sin(uTime * 0.35 + aTorusData.w * 6.2831) * (aTorusData.y * 0.05),
            position.x * sa + position.z * ca
          );

          vec4 mvPosition = modelViewMatrix * vec4(localP, 1.0);
          vec4 bhCenterMV = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);

          float dist = max(-mvPosition.z, 0.02);
          float bhDist = max(-bhCenterMV.z, 0.02);

          // Real 3D depth comparison relative to the black hole core!
          // Negative relZ => cloud sits BETWEEN camera and black hole => dark backlit silhouette!
          float relZ = (dist - bhDist) / max(aTorusData.y * 1.4, 0.25);
          vFrontFactor = 1.0 - smoothstep(-0.75, 0.85, relZ);

          // Smart Fly-Through Tunnel Clearing: foreground clouds right against camera lens dissolve smoothly
          vClearFade = smoothstep(uClearNear, uClearFar, dist);
          vInner = aTorusData.z;
          vSeed = aTorusData.w;
          vDistFade = smoothstep(0.04, 0.32, dist);
          vLayerKind = aTorusExtra.x;
          vDensity = aTorusExtra.y;

          float rawSize = aTorusData.y * uPixelRatio * (350.0 / dist);
          gl_PointSize = clamp(rawSize, 2.5, 175.0 * uPixelRatio);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        ${GLSL_PREC}

        uniform float uSpecMode;
        uniform float uDustOpacity;
        uniform vec3 uRimColor;
        uniform sampler2D uDustAtlas;

        varying float vInner;
        varying float vSeed;
        varying float vClearFade;
        varying float vDistFade;
        varying float vFrontFactor;
        varying float vLayerKind;
        varying float vDensity;

        void main() {
          float vis = vClearFade * vDistFade * uDustOpacity;
          if (vis < 0.01) discard;

          vec2 uv = gl_PointCoord - 0.5;
          if (dot(uv, uv) > 0.24) discard;

          // Random puff rotation inside 2x2 dust atlas
          float a = vSeed * 6.2831853;
          float ca = cos(a);
          float sa = sin(a);
          vec2 localUV = clamp(mat2(ca, -sa, sa, ca) * uv + 0.5, 0.04, 0.96);

          float tileIdx = floor(fract(vSeed * 19.73) * 4.0);
          vec2 tileOrigin = vec2(mod(tileIdx, 2.0) * 0.5, floor(tileIdx * 0.5) * 0.5);
          vec2 atlasUV = tileOrigin + localUV * 0.5;

          vec4 tex = texture2D(uDustAtlas, atlasUV);
          float cloud = tex.a;
          if (cloud < 0.028) discard;

          // Silver-lining translucent cloud edge factor (peaks at thin edges of backlit clouds!)
          float edgeMask = smoothstep(0.03, 0.38, cloud) * (1.0 - smoothstep(0.42, 0.88, cloud));

          if (uSpecMode > 4.5) {
            // Dark Matter / Lensing: Baryonic dust cocoon disappears cleanly
            discard;
          } else if (uSpecMode > 3.5) {
            // Radio / EHT 230 GHz: Obscuring optical clouds vanish completely; only outer ALMA cold sub-mm torus glows softly!
            float outerRing = smoothstep(0.18, 0.85, 1.0 - vInner) * (vLayerKind > 0.5 ? 1.0 : 0.25);
            vec3 almaCol = mix(vec3(0.68, 0.14, 0.02), vec3(1.0, 0.56, 0.14), tex.r);
            float alpha = cloud * vis * outerRing * 0.24 * vDensity;
            if (alpha < 0.008) discard;
            gl_FragColor = vec4(almaCol, alpha);
          } else if (uSpecMode > 2.5) {
            // Chandra X-Ray: High-energy X-rays punch right through neutral interstellar dust!
            float alpha = cloud * vis * 0.038 * vDensity;
            if (alpha < 0.008) discard;
            gl_FragColor = vec4(0.10, 0.18, 0.38, alpha);
          } else if (uSpecMode > 1.5) {
            // JWST MIRI (Mid-IR): Entire enveloping cocoon blazes in glowing amber, molten gold & magenta PAH dust!
            vec3 miriOuter = mix(vec3(0.92, 0.20, 0.44), vec3(1.00, 0.44, 0.10), fract(vSeed * 4.7));
            vec3 miriInner = vec3(1.00, 0.88, 0.46);
            vec3 col = mix(miriOuter, miriInner, vInner * 0.78 + tex.r * 0.22);
            float alpha = cloud * vis * (0.42 + 0.44 * vInner) * vDensity;
            gl_FragColor = vec4(clamp(col * (0.92 + 0.62 * vInner), vec3(0.0), vec3(1.95)), clamp(alpha, 0.0, 0.88));
          } else if (uSpecMode > 0.5) {
            // JWST NIRCam: Pierces the thick dark shroud into translucent warm sepia-amber haze!
            vec3 nirCol = mix(vec3(0.28, 0.10, 0.05), uRimColor * 0.95, vInner * 0.68 + edgeMask * 0.25);
            float alpha = cloud * vis * 0.28 * vDensity;
            gl_FragColor = vec4(nirCol, clamp(alpha, 0.0, 0.48));
          } else {
            // Optical HDR: Thick, ominous real-world dust cocoon shrouding the black hole!
            //  - Foreground clouds: pitch-dark charcoal/soot cores with molten backlit orange silver-lining edges!
            //  - Inner Minispiral & sublimation wall: warmly lit amber-orange dust filaments
            //  - Background torus clouds: dimly lit reddish-brown interstellar dust
            vec3 sootCore = vec3(0.022, 0.011, 0.008) * (0.55 + 0.85 * tex.r);
            vec3 farLitDust = vec3(0.14, 0.062, 0.036) * (0.55 + 0.75 * tex.r);
            vec3 baseDust = mix(farLitDust, sootCore, vFrontFactor);

            vec3 moltenGlow = uRimColor * (0.65 + 0.78 * tex.r);
            float backlitAmt = clamp(
              safePow(vInner, 1.15) * 0.78 +
              edgeMask * vFrontFactor * (0.35 + 0.65 * vInner) * 0.95,
              0.0, 1.0
            );

            vec3 col = mix(baseDust, moltenGlow, backlitAmt);
            // Heavier obscuring density in the equatorial & front shroud, slightly wispier in outer cocoon
            float layerOp = (vLayerKind < 0.5) ? 0.76 : ((vLayerKind < 1.5) ? 0.92 : 0.74);
            float heavyAlpha = cloud * vis * layerOp * vDensity * mix(0.84, 1.0, vFrontFactor);
            gl_FragColor = vec4(clamp(col, vec3(0.0), vec3(1.55)), clamp(heavyAlpha, 0.0, 0.95));
          }
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending
    });
  }
  // =========================================================================
  // 6F. PROCEDURAL 3D BOILING STAR SURFACE SHADER (v19.0 — True-Color White Sun,
  //     Lumpy Boiling Red Supergiants & von Zeipel Gravity-Darkened Rotators!)
  // =========================================================================
  function createStarSurfaceMaterial(options) {
    const opts = options || {};
    const baseCol = new THREE.Color(opts.baseColor !== undefined ? opts.baseColor : 0xffb84d);
    const hotCol = new THREE.Color(opts.hotColor !== undefined ? opts.hotColor : 0xfff8e7);
    const spotCol = new THREE.Color(opts.spotColor !== undefined ? opts.spotColor : 0x9a2c0c);

    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0.0 },
        uSpecMode: { value: 0.0 },
        uBaseColor: { value: baseCol },
        uHotColor: { value: hotCol },
        uSpotColor: { value: spotCol },
        uCellScale: { value: opts.cellScale !== undefined ? opts.cellScale : 5.2 },
        uPulseSpeed: { value: opts.pulseSpeed !== undefined ? opts.pulseSpeed : 0.45 },
        uIsSun: { value: opts.isSun ? 1.0 : 0.0 },
        uConvectionDisplace: { value: opts.convectionDisplace !== undefined ? opts.convectionDisplace : 0.0 },
        uGravityDarken: { value: opts.gravityDarken !== undefined ? opts.gravityDarken : 0.0 }
      },
      vertexShader: `
        uniform float uTime;
        uniform float uPulseSpeed;
        uniform float uConvectionDisplace;

        varying vec3 vLocalPos;
        varying vec3 vNormalWorld;
        varying vec3 vWorldPos;
        varying float vLump;

        void main() {
          vec3 pUnit = normalize(position);
          vec3 displaced = position;
          float lump = 0.0;

          // Real VLTI/ALMA giant boiling convection lobes on Red Supergiants (Betelgeuse, Antares, VY CMa, Stephenson 2-18!)
          if (uConvectionDisplace > 0.001) {
            float t = uTime * uPulseSpeed * 0.65;
            float w1 = sin(pUnit.x * 3.4 + t) * cos(pUnit.y * 3.1 - t * 0.8) * sin(pUnit.z * 3.6 + t * 0.6);
            float w2 = cos(pUnit.x * 5.8 - t * 1.1 + pUnit.z * 4.2) * sin(pUnit.y * 5.2 + t * 0.7);
            lump = w1 * 0.65 + w2 * 0.35;
            displaced += normal * (lump * uConvectionDisplace);
          }

          vLocalPos = pUnit;
          vLump = lump;
          vec4 wp = modelMatrix * vec4(displaced, 1.0);
          vWorldPos = wp.xyz;
          vNormalWorld = normalize(mat3(modelMatrix) * normal);
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        ${GLSL_PREC}

        uniform float uTime;
        uniform float uSpecMode;
        uniform vec3 uBaseColor;
        uniform vec3 uHotColor;
        uniform vec3 uSpotColor;
        uniform float uCellScale;
        uniform float uPulseSpeed;
        uniform float uIsSun;
        uniform float uConvectionDisplace;
        uniform float uGravityDarken;

        varying vec3 vLocalPos;
        varying vec3 vNormalWorld;
        varying vec3 vWorldPos;
        varying float vLump;

        ${GLSL_NOISE_3D_FAST}

        void main() {
          vec3 V = normalize(cameraPosition - vWorldPos);
          vec3 N = normalize(vNormalWorld);
          float ndotv = clamp(dot(N, V), 0.0, 1.0);

          float t = uTime * uPulseSpeed;
          vec3 p = vLocalPos * uCellScale;
          float n1 = fbm3D(p + vec3(t * 0.38, -t * 0.24, t * 0.32));
          float n2 = fbm3D(p * 2.45 + vec3(n1 * 1.35 - t * 0.48, t * 0.42, n1 * 1.05));
          float granules = clamp(n1 * 0.56 + n2 * 0.44 + vLump * 0.22, 0.0, 1.0);

          vec3 surf;
          float rimGlow = safePow(1.0 - ndotv, 2.9);

          if (uIsSun > 0.5 && uSpecMode < 0.5) {
            // TRUE-COLOR SPACE PHOTOSPHERE OF SOL (SDO / ISS Eye-True White Disk + Amber Limb Darkening + Sunspots!)
            float fineGran = fbm3D(vLocalPos * 26.0 + vec3(t * 0.6, -t * 0.4, t * 0.5));
            float granMix = granules * 0.58 + fineGran * 0.42;

            // Realistic small dark magnetic sunspot umbra/penumbra groups in active mid-latitude belts (±10°..±32°)
            float activeBelt = exp(-sq((abs(vLocalPos.y) - 0.32) * 5.2));
            float spotNoise = fbm3D(vLocalPos * 7.8 + vec3(0.4, 2.1, -1.7));
            float penumbra = smoothstep(0.75, 0.83, spotNoise) * activeBelt;
            float umbra = smoothstep(0.81, 0.87, spotNoise) * activeBelt;
            float faculae = smoothstep(0.68, 0.80, spotNoise) * (1.0 - penumbra) * activeBelt * (1.0 - ndotv);

            // Physical Eddington solar limb darkening: blinding pure white center -> warm golden-amber limb!
            float mu = safePow(ndotv, 0.54);
            vec3 centerWhite = vec3(1.00, 0.99, 0.96);
            vec3 midCream = vec3(1.00, 0.92, 0.76);
            vec3 edgeAmber = vec3(0.98, 0.56, 0.16);
            vec3 limbCol = mu > 0.48
              ? mix(midCream, centerWhite, (mu - 0.48) / 0.52)
              : mix(edgeAmber, midCream, mu / 0.48);

            // Subtle granulation contrast (real Sun looks blindingly bright, NOT dark lava!)
            surf = limbCol * (0.90 + 0.24 * granMix + faculae * 0.35);
            surf = mix(surf, vec3(0.48, 0.24, 0.08), penumbra * 0.72);
            surf = mix(surf, vec3(0.08, 0.03, 0.01), umbra * 0.90);
            // Blazing chromospheric rim
            surf += vec3(1.00, 0.86, 0.58) * rimGlow * 0.72;
            surf *= 1.18;
          } else {
            float spots = smoothstep(0.24, 0.44, granules);
            float flares = smoothstep(0.66, 0.94, granules);
            float limb = safePow(ndotv, 0.50);

            vec3 cSpot = uSpotColor;
            vec3 cBase = uBaseColor;
            vec3 cHot  = uHotColor;

            if (uSpecMode > 4.5) {
              cSpot = vec3(0.10, 0.08, 0.28);
              cBase = vec3(0.46, 0.38, 0.88);
              cHot  = vec3(0.90, 0.86, 1.00);
            } else if (uSpecMode > 3.5) {
              cSpot = vec3(0.32, 0.05, 0.01);
              cBase = vec3(0.95, 0.36, 0.05);
              cHot  = vec3(1.00, 0.88, 0.46);
            } else if (uSpecMode > 2.5) {
              cSpot = vec3(0.10, 0.06, 0.32);
              cBase = vec3(0.24, 0.62, 1.00);
              cHot  = vec3(0.94, 0.99, 1.00);
            } else if (uSpecMode > 1.5) {
              cSpot = vec3(0.38, 0.04, 0.14);
              cBase = vec3(1.00, 0.40, 0.14);
              cHot  = vec3(1.00, 0.84, 0.56);
            }

            surf = mix(cSpot, cBase, spots);
            surf = mix(surf, cHot, flares * 0.88);

            // von Zeipel Gravity Darkening on Rapidly Rotating Oblate Stars (e.g. Vega 12.5-hr spin!):
            // Hot, brilliant blue-white poles (~10,150 K) vs dimmer, slightly warmer cooler equator (~7,900 K)!
            if (uGravityDarken > 0.01 && uSpecMode < 0.5) {
              float poleFactor = smoothstep(0.12, 0.92, abs(vLocalPos.y));
              vec3 eqTint = mix(vec3(0.76, 0.80, 0.92), vec3(0.94, 0.97, 1.00), poleFactor);
              float gravLum = mix(1.0 - 0.44 * uGravityDarken, 1.0 + 0.38 * uGravityDarken, poleFactor);
              surf *= eqTint * gravLum;
            }

            // Extra bright upwelling convective plumes on Red Supergiants
            if (uConvectionDisplace > 0.01 && uSpecMode < 0.5) {
              float plumeHot = smoothstep(0.15, 0.72, vLump);
              surf = mix(surf, cHot * 1.15, plumeHot * 0.42);
            }

            surf *= (0.45 + 0.82 * limb);
            surf += mix(cBase, cHot, 0.55) * rimGlow * 0.95;
          }

          gl_FragColor = vec4(clamp(surf, vec3(0.0), vec3(2.35)), 1.0);
        }
      `,
      transparent: false,
      depthWrite: true
    });
  }

  // =========================================================================
  // 6F2. DYNAMIC 3D SOLAR CORONA STREAMERS & H-ALPHA MAGNETIC PROMINENCES (v19.0)
  //      Billboarded radial solar-eclipse coronal plumes + crimson plasma loops!
  // =========================================================================
  function createSolarCoronaMaterial() {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0.0 },
        uSpecMode: { value: 0.0 }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        ${GLSL_PREC}

        uniform float uTime;
        uniform float uSpecMode;
        varying vec2 vUv;

        ${GLSL_NOISE_2D_FAST}

        void main() {
          vec2 p = (vUv - 0.5) * 2.0;
          float r = length(p);
          if (r > 1.0 || r < 0.16) discard;

          float ang = atan(p.y, p.x);
          // Photosphere sits around r ≈ 0.215 on the corona billboard quad
          float distFromLimb = max(r - 0.215, 0.0);

          // Radial coronal helmet streamers & polar magnetic plumes (like a real Total Solar Eclipse!)
          float s1 = fbm2D(vec2(cos(ang) * 2.6 + uTime * 0.03, sin(ang) * 2.6 - uTime * 0.025));
          float s2 = fbm2D(vec2(cos(ang * 2.0) * 4.0 - uTime * 0.05, r * 3.2 - uTime * 0.22));
          float helmet = 0.52 + 0.48 * cos(ang * 2.0 - 0.35); // Stronger equatorial helmet streamers
          float rays = (0.35 + 0.65 * s1) * (0.48 + 0.52 * s2) * (0.65 + 0.55 * helmet);

          // Smooth inverse-power coronal falloff
          float innerCorona = exp(-distFromLimb * 10.5) * 0.95;
          float midStreamers = exp(-distFromLimb * 3.4) * rays * 0.62;
          float outerFaint = safePow(clamp(1.0 - r, 0.0, 1.0), 2.4) * rays * 0.26;
          float limbMask = smoothstep(0.18, 0.235, r);

          // Glowing ruby-peach H-alpha magnetic prominence arches hugging the solar limb!
          float promBand = exp(-sq((r - 0.242) * 34.0));
          float promArcs = smoothstep(0.62, 0.90, sin(ang * 7.0 + 0.9) * 0.5 + 0.5 + (s1 - 0.5) * 0.65)
                         * smoothstep(0.54, 0.85, sin(ang * 3.0 - uTime * 0.14) * 0.5 + 0.5);
          float promGlow = promBand * promArcs * 0.95;

          vec3 colCorona = mix(vec3(0.84, 0.92, 1.00), vec3(1.00, 0.94, 0.80), exp(-distFromLimb * 5.0));
          vec3 colProm = vec3(1.00, 0.34, 0.24);

          if (uSpecMode > 4.5) {
            colCorona = vec3(0.48, 0.34, 1.00);
            colProm = vec3(0.86, 0.62, 1.00);
          } else if (uSpecMode > 3.5) {
            colCorona = vec3(1.00, 0.52, 0.12);
            colProm = vec3(1.00, 0.84, 0.32);
          } else if (uSpecMode > 2.5) {
            colCorona = vec3(0.32, 0.82, 1.00);
            colProm = vec3(0.86, 0.96, 1.00);
          } else if (uSpecMode > 1.5) {
            colCorona = vec3(1.00, 0.44, 0.24);
            colProm = vec3(1.00, 0.22, 0.48);
          }

          vec3 col = colCorona * (innerCorona + midStreamers + outerFaint) + colProm * promGlow;
          float alpha = clamp((innerCorona * 0.82 + midStreamers * 0.68 + outerFaint + promGlow * 0.85) * limbMask, 0.0, 0.92);
          if (alpha < 0.008) discard;
          gl_FragColor = vec4(clamp(col, vec3(0.0), vec3(1.85)), alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending
    });
  }

  // =========================================================================
  // 6G. PROCEDURAL 3D SOLAR SYSTEM PLANET SHADER (v19.0 — 3D Crater/Mountain
  //     Bump Mapping, Lunar & Galilean Transit Eclipses, Mars Blue Terminator,
  //     True-Color 2024 Neptune & Saturn Real-Time Ring Shadows!)
  // =========================================================================
  function createPlanetMaterial(options) {
    const fallbackTex = (options && options.placeholderTex) ? options.placeholderTex : null;
    const opts = options || {};
    const c1 = new THREE.Color(opts.colorA !== undefined ? opts.colorA : 0x3b82f6);
    const c2 = new THREE.Color(opts.colorB !== undefined ? opts.colorB : 0x22c55e);
    const cAtm = new THREE.Color(opts.atmoColor !== undefined ? opts.atmoColor : 0x60a5fa);

    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0.0 },
        uSpecMode: { value: 0.0 },
        uSunPos: { value: new THREE.Vector3(26.0, 0.35, 3.2) },
        uPlanetType: { value: opts.planetType !== undefined ? opts.planetType : 0.0 },
        uColorA: { value: c1 },
        uColorB: { value: c2 },
        uAtmoColor: { value: cAtm },
        uAtmoStrength: { value: opts.atmoStrength !== undefined ? opts.atmoStrength : 0.45 },
        uBumpStrength: { value: opts.bumpStrength !== undefined ? opts.bumpStrength : 0.0 },
        uNeptuneTrueColor: { value: opts.neptuneTrueColor ? 1.0 : 0.0 },
        uOccluderPos: { value: new THREE.Vector3(0.0, 0.0, 0.0) },
        uOccluderRadius: { value: 0.0 },
        uEclipseRed: { value: opts.eclipseRed ? 1.0 : 0.0 },
        uHasMoonShadows: { value: opts.hasMoonShadows ? 1.0 : 0.0 },
        uShadowMoon0: { value: new THREE.Vector4(0, 0, 0, 0) },
        uShadowMoon1: { value: new THREE.Vector4(0, 0, 0, 0) },
        uShadowMoon2: { value: new THREE.Vector4(0, 0, 0, 0) },
        uShadowMoon3: { value: new THREE.Vector4(0, 0, 0, 0) },
        uSurfaceMap: { value: fallbackTex },
        uHasMap: { value: 0.0 }
      },
      vertexShader: `
        uniform vec3 uSunPos;

        varying vec2 vUv;
        varying vec3 vLocalPos;
        varying vec3 vNormalWorld;
        varying vec3 vTangentWorld;
        varying vec3 vBitangentWorld;
        varying vec3 vWorldPos;
        varying vec3 vLocalSunDir;
        varying float vPolarScale;

        void main() {
          vUv = uv;
          vec3 localN = normalize(position);
          vLocalPos = localN;
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;

          // Exact orthonormal planet frame + inverse-transpose normal for oblate gas giants (Saturn 0.902, Jupiter 0.935)!
          float sx = max(length(modelMatrix[0].xyz), 1e-6);
          float sy = max(length(modelMatrix[1].xyz), 1e-6);
          float sz = max(length(modelMatrix[2].xyz), 1e-6);
          vec3 ax0 = modelMatrix[0].xyz / sx;
          vec3 ax1 = modelMatrix[1].xyz / sy;
          vec3 ax2 = modelMatrix[2].xyz / sz;
          vPolarScale = sy / sx;

          vec3 nInv = normalize(vec3(normal.x / sx, normal.y / sy, normal.z / sz));
          vNormalWorld = normalize(ax0 * nInv.x + ax1 * nInv.y + ax2 * nInv.z);

          // Planet-local equirectangular tangent basis (aligned to actual tilted North Pole!)
          vec3 locRef = abs(localN.y) > 0.96 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0);
          vec3 locT = normalize(cross(locRef, localN));
          vec3 locB = cross(localN, locT);
          vTangentWorld = normalize(ax0 * locT.x + ax1 * locT.y + ax2 * locT.z);
          vBitangentWorld = normalize(ax0 * locB.x + ax1 * locB.y + ax2 * locB.z);

          // Exact orthonormal sun direction in planet spinGroup space (fixes oblate Saturn ring shadow!)
          vec3 toSunW = uSunPos - wp.xyz;
          vLocalSunDir = normalize(vec3(dot(toSunW, ax0), dot(toSunW, ax1), dot(toSunW, ax2)));
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        ${GLSL_PREC}

        uniform float uTime;
        uniform float uSpecMode;
        uniform vec3 uSunPos;
        uniform float uPlanetType; // 0=Mercury/Moon, 1=Venus, 2=Earth, 3=Mars, 4=Jupiter, 5=Saturn, 6=IceGiant
        uniform vec3 uColorA;
        uniform vec3 uColorB;
        uniform vec3 uAtmoColor;
        uniform float uAtmoStrength;
        uniform float uBumpStrength;
        uniform float uNeptuneTrueColor;
        uniform vec3 uOccluderPos;
        uniform float uOccluderRadius;
        uniform float uEclipseRed;
        uniform float uHasMoonShadows;
        uniform vec4 uShadowMoon0;
        uniform vec4 uShadowMoon1;
        uniform vec4 uShadowMoon2;
        uniform vec4 uShadowMoon3;
        uniform sampler2D uSurfaceMap;
        uniform float uHasMap;

        varying vec2 vUv;
        varying vec3 vLocalPos;
        varying vec3 vNormalWorld;
        varying vec3 vTangentWorld;
        varying vec3 vBitangentWorld;
        varying vec3 vWorldPos;
        varying vec3 vLocalSunDir;
        varying float vPolarScale;

        ${GLSL_NOISE_3D_FAST}

        // Ray-sphere soft eclipse / moon-transit shadow factor (returns 1.0 lit -> 0.0 in umbra)
        float sphereShadowFactor(vec3 fragPos, vec3 sunDir, vec3 occPos, float occRad, float penumbraScale) {
          if (occRad <= 0.00001) return 1.0;
          vec3 toOcc = occPos - fragPos;
          float proj = dot(toOcc, sunDir);
          if (proj <= 0.0) return 1.0;
          float d2 = dot(toOcc, toOcc) - proj * proj;
          float d = sqrt(max(d2, 0.0));
          float innerR = occRad * (1.0 - penumbraScale);
          float outerR = occRad * (1.0 + penumbraScale);
          return smoothstep(innerR, outerR, d);
        }

        void main() {
          vec3 N = normalize(vNormalWorld);
          vec3 L = normalize(uSunPos - vWorldPos);
          vec3 V = normalize(cameraPosition - vWorldPos);

          float ndotlSmooth = dot(N, L);
          float ambient = (uPlanetType < 0.5) ? 0.095 : 0.072;
          float ndotv = clamp(dot(N, V), 0.0, 1.0);
          float fresnel = safePow(1.0 - ndotv, 2.8);

          vec3 p = vLocalPos;
          vec3 albedo = uColorA;
          float specMask = 0.0;
          vec3 nightLights = vec3(0.0);

          // Tangent-space 3D Crater & Mountain Bump Relief (zero extra textures, 100% WebGL1/2 safe!)
          vec3 N_bump = N;
          if (uHasMap > 0.5) {
            albedo = texture2D(uSurfaceMap, vUv).rgb;

            // 2024 Hubble / Oxford True-Color Recalibration for Neptune (pale greenish-cyan, not hyper-blue!)
            if (uNeptuneTrueColor > 0.5) {
              float nLum = dot(albedo, vec3(0.299, 0.587, 0.114));
              vec3 trueCyan = mix(vec3(0.30, 0.66, 0.80), vec3(0.68, 0.91, 0.96), clamp(nLum * 1.45, 0.0, 1.0));
              albedo = mix(albedo, trueCyan, 0.66);
            }

            if (uBumpStrength > 0.01) {
              vec2 eps = vec2(0.0014, 0.0028);
              float hR = dot(texture2D(uSurfaceMap, vec2(fract(vUv.x + eps.x), vUv.y)).rgb, vec3(0.299, 0.587, 0.114));
              float hL = dot(texture2D(uSurfaceMap, vec2(fract(vUv.x - eps.x), vUv.y)).rgb, vec3(0.299, 0.587, 0.114));
              float hU = dot(texture2D(uSurfaceMap, vec2(vUv.x, clamp(vUv.y + eps.y, 0.002, 0.998))).rgb, vec3(0.299, 0.587, 0.114));
              float hD = dot(texture2D(uSurfaceMap, vec2(vUv.x, clamp(vUv.y - eps.y, 0.002, 0.998))).rgb, vec3(0.299, 0.587, 0.114));
              vec3 T = normalize(vTangentWorld);
              vec3 B = normalize(vBitangentWorld);
              float polarFade = smoothstep(0.99, 0.82, abs(p.y));
              N_bump = normalize(N + (T * (hL - hR) + B * (hD - hU)) * uBumpStrength * 4.2 * polarFade);
            }
          } else if (uPlanetType < 0.5) {
            // 0: Mercury / Earth's Moon / Pluto / Moons — Cratered rocky regolith + procedural 3D crater relief
            float n = fbm3D(p * 6.5);
            float cr = fbm3D(p * 18.0 + vec3(3.1, 1.7, 5.4));
            albedo = mix(uColorA, uColorB, smoothstep(0.32, 0.74, n * 0.7 + cr * 0.3));
            if (uBumpStrength > 0.01) {
              float cDx = fbm3D((p + vec3(0.025, 0.0, 0.0)) * 18.0 + vec3(3.1, 1.7, 5.4)) - cr;
              float cDy = fbm3D((p + vec3(0.0, 0.025, 0.0)) * 18.0 + vec3(3.1, 1.7, 5.4)) - cr;
              float cDz = fbm3D((p + vec3(0.0, 0.0, 0.025)) * 18.0 + vec3(3.1, 1.7, 5.4)) - cr;
              N_bump = normalize(N - vec3(cDx, cDy, cDz) * uBumpStrength * 2.2);
            }
          } else if (uPlanetType < 1.5) {
            // 1: Venus / Titan — Thick swirling golden-cream atmospheric cloud deck
            float swirl = fbm3D(vec3(p.x * 3.0, p.y * 5.2, p.z * 3.0) + vec3(uTime * 0.08, 0.0, -uTime * 0.06));
            float bands = 0.5 + 0.5 * sin(p.y * 9.0 + swirl * 4.5);
            albedo = mix(uColorA, uColorB, bands * 0.65 + swirl * 0.35);
          } else if (uPlanetType < 2.5) {
            // 2: Earth / Habitable Exoplanets
            float cont = fbm3D(p * 3.3 + vec3(1.2, 0.4, -0.8));
            float detail = fbm3D(p * 9.5);
            float isLand = smoothstep(0.51, 0.57, cont + (detail - 0.5) * 0.14);
            float polar = smoothstep(0.76, 0.90, abs(p.y) + (detail - 0.5) * 0.08);
            vec3 oceanCol = mix(vec3(0.04, 0.18, 0.46), vec3(0.09, 0.36, 0.68), detail);
            vec3 landCol  = mix(vec3(0.14, 0.42, 0.18), vec3(0.68, 0.56, 0.34), smoothstep(0.45, 0.78, detail));
            albedo = mix(oceanCol, landCol, isLand);
            albedo = mix(albedo, vec3(0.94, 0.97, 1.0), polar);
            float clouds = fbm3D(p * 4.8 + vec3(uTime * 0.06, 0.0, -uTime * 0.04));
            float cloudMask = smoothstep(0.52, 0.76, clouds);
            albedo = mix(albedo, vec3(0.96, 0.98, 1.0), cloudMask * 0.78);
            specMask = (1.0 - isLand) * (1.0 - cloudMask) * (1.0 - polar);
          } else if (uPlanetType < 3.5) {
            // 3: Mars — Rusty iron-oxide deserts, canyons & polar ice caps
            float n = fbm3D(p * 4.5);
            float fine = fbm3D(p * 14.0);
            albedo = mix(uColorA, uColorB, smoothstep(0.35, 0.74, n * 0.7 + fine * 0.3));
            float polar = smoothstep(0.83, 0.94, abs(p.y) + (fine - 0.5) * 0.06);
            albedo = mix(albedo, vec3(0.95, 0.94, 0.96), polar);
          } else if (uPlanetType < 4.5) {
            // 4: Jupiter — Turbulent zonal cloud bands + Great Red Spot
            float turb = fbm3D(vec3(p.x * 4.0, p.y * 9.0, p.z * 4.0) + vec3(uTime * 0.05, 0.0, 0.0));
            float lat = p.y * 16.0 + (turb - 0.5) * 2.4;
            float band = 0.5 + 0.5 * sin(lat);
            float band2 = 0.5 + 0.5 * cos(lat * 2.1 + turb * 3.0);
            albedo = mix(uColorA, uColorB, band * 0.65 + band2 * 0.35);
            float spotD = length(vec2((p.x - 0.78) * 1.1, (p.y + 0.34) * 2.2));
            if (p.x > 0.0) {
              float grs = 1.0 - smoothstep(0.14, 0.30, spotD);
              albedo = mix(albedo, vec3(0.82, 0.30, 0.16), grs * 0.85);
            }
          } else if (uPlanetType < 5.5) {
            // 5: Saturn — Silky golden-cream banded gas giant
            float turb = fbm3D(vec3(p.x * 3.0, p.y * 8.0, p.z * 3.0));
            float band = 0.5 + 0.5 * sin(p.y * 14.0 + turb * 1.3);
            albedo = mix(uColorA, uColorB, band * 0.72 + turb * 0.28);
          } else {
            // 6: Uranus / Neptune — True-color pale greenish-cyan methane ice giants
            float turb = fbm3D(vec3(p.x * 3.5, p.y * 7.0, p.z * 3.5) + vec3(uTime * 0.04, 0.0, 0.0));
            float band = 0.5 + 0.5 * sin(p.y * 10.0 + turb * 1.8);
            albedo = mix(uColorA, uColorB, band * 0.6 + turb * 0.4);
          }

          // Combine smooth terminator envelope with raking 3D bumped crater/mountain lighting!
          float ndotlBump = dot(N_bump, L);
          float termMask = smoothstep(-0.10, 0.26, ndotlSmooth);
          float dayLight = termMask * (0.14 + 0.90 * max(ndotlBump, 0.0));

          // Real-Time Ray-Plane Ring Shadow cast onto Saturn's cloud bands (with Cassini Division gap!)
          float shadowFactor = 1.0;
          if (uPlanetType > 4.5 && uPlanetType < 5.5 && ndotlSmooth > -0.05) {
            vec3 lDir = normalize(vLocalSunDir);
            float pYSpin = p.y * vPolarScale;
            if (pYSpin * lDir.y < -0.0001) {
              float tHit = -pYSpin / lDir.y;
              if (tHit > 0.0) {
                float hr = length(p.xz + lDir.xz * tHit);
                if (hr > 1.28 && hr < 2.42) {
                  float uRing = (hr - 1.28) / (2.42 - 1.28);
                  float bandOp = smoothstep(0.0, 0.14, uRing) * (1.0 - smoothstep(0.92, 1.0, uRing));
                  float cassiniGap = 1.0 - 0.86 * exp(-sq((uRing - 0.625) * 26.0));
                  float enckeGap = 1.0 - 0.55 * exp(-sq((uRing - 0.915) * 48.0));
                  float bRingDense = mix(0.62, 0.92, smoothstep(0.18, 0.54, uRing) * (1.0 - smoothstep(0.56, 0.61, uRing)));
                  shadowFactor *= 1.0 - clamp(bandOp * cassiniGap * enckeGap * bRingDense, 0.0, 0.86);
                }
              }
            }
          }

          // Real-Time Planetary Eclipse Shadow (e.g., Earth eclipsing Moon into a copper-red Blood Moon!)
          float eclipseFactor = 1.0;
          if (uOccluderRadius > 0.00001 && ndotlSmooth > -0.08) {
            eclipseFactor = sphereShadowFactor(vWorldPos, L, uOccluderPos, uOccluderRadius, 0.18);
            shadowFactor *= mix(0.04, 1.0, eclipseFactor);
          }

          // Real-Time Galilean Moon Transit Shadows gliding across Jupiter's cloud bands!
          if (uHasMoonShadows > 0.5 && ndotlSmooth > -0.05) {
            float ms = 1.0;
            ms = min(ms, sphereShadowFactor(vWorldPos, L, uShadowMoon0.xyz, uShadowMoon0.w, 0.16));
            ms = min(ms, sphereShadowFactor(vWorldPos, L, uShadowMoon1.xyz, uShadowMoon1.w, 0.16));
            ms = min(ms, sphereShadowFactor(vWorldPos, L, uShadowMoon2.xyz, uShadowMoon2.w, 0.16));
            ms = min(ms, sphereShadowFactor(vWorldPos, L, uShadowMoon3.xyz, uShadowMoon3.w, 0.16));
            shadowFactor *= mix(0.06, 1.0, ms);
          }

          vec3 H = normalize(L + V);
          float spec = safePow(max(dot(N_bump, H), 0.0), 36.0) * specMask * 0.55 * max(ndotlBump, 0.0) * shadowFactor;

          vec3 col = albedo * (ambient + dayLight * shadowFactor) + vec3(0.95, 0.98, 1.0) * spec + nightLights;

          // Copper-red Earth-atmosphere refraction glow during total Lunar Eclipse (Blood Moon!)
          if (uEclipseRed > 0.5 && eclipseFactor < 0.98 && ndotlSmooth > -0.05) {
            float umbraDepth = (1.0 - eclipseFactor) * smoothstep(-0.05, 0.25, ndotlSmooth);
            col += albedo * vec3(0.76, 0.16, 0.05) * umbraDepth * 0.55;
          }

          // Sunlit atmospheric limb scatter (with authentic Mars butterscotch dust + pale blue sunset terminator!)
          float atmoLight = smoothstep(-0.22, 0.42, ndotlSmooth);
          if (uPlanetType > 2.5 && uPlanetType < 3.5) {
            float marsTerm = exp(-sq((ndotlSmooth + 0.02) * 8.5));
            vec3 marsDayHaze = vec3(0.88, 0.56, 0.34) * fresnel * 0.46 * atmoLight;
            vec3 marsBlueSunset = vec3(0.42, 0.72, 1.00) * marsTerm * (0.14 + 0.55 * fresnel);
            col += marsDayHaze + marsBlueSunset;
          } else {
            col += uAtmoColor * fresnel * uAtmoStrength * (0.22 + 0.78 * atmoLight);
          }

          // Multi-wavelength physical spectral response (NIRCam / MIRI / Chandra X-Ray / Radio / Dark Matter)
          float lum = dot(albedo, vec3(0.299, 0.587, 0.114));
          if (uSpecMode > 4.5) {
            col = mix(vec3(0.06, 0.04, 0.20), vec3(0.48, 0.38, 0.94), clamp(lum * 0.45 + fresnel * 0.55, 0.0, 1.0)) * (0.55 + 0.45 * shadowFactor);
          } else if (uSpecMode > 3.5) {
            float syncBelt = (uPlanetType > 3.5 && uPlanetType < 5.5) ? exp(-p.y * p.y * 8.0) * 0.55 : 0.0;
            col = mix(vec3(0.14, 0.03, 0.01), vec3(1.0, 0.56, 0.14), clamp(lum * 0.6 + syncBelt + fresnel * 0.45, 0.0, 1.0));
            col *= (0.45 + 0.55 * shadowFactor);
          } else if (uSpecMode > 2.5) {
            float aurora = (uPlanetType > 3.5) ? smoothstep(0.78, 0.95, abs(p.y)) * 1.15 : 0.0;
            col = mix(vec3(0.05, 0.04, 0.18), vec3(0.26, 0.76, 1.0), clamp(dayLight * 0.48 * shadowFactor + aurora + fresnel * 0.35, 0.0, 1.0));
          } else if (uSpecMode > 1.5) {
            float thermal = clamp(lum * 0.72 + (uPlanetType > 0.5 && uPlanetType < 1.5 ? 0.35 : 0.12) + dayLight * 0.25, 0.0, 1.0);
            col = mix(vec3(0.32, 0.04, 0.18), vec3(1.0, 0.72, 0.22), thermal) * (0.65 + 0.35 * shadowFactor);
          } else if (uSpecMode > 0.5) {
            col = mix(col, col * vec3(1.12, 0.96, 0.84) + vec3(0.06, 0.10, 0.14) * fresnel, 0.55);
          }

          gl_FragColor = vec4(clamp(col, vec3(0.0), vec3(1.65)), 1.0);
        }
      `,
      transparent: false,
      depthWrite: true
    });
  }

  // =========================================================================
  // 6H. SINGLE-DRAW-CALL BATCHED NASA MULTI-WAVELENGTH EMISSION NEBULA SHADER
  //     Reuses 2x2 dustAtlas (0 loops!) -> Teal [O III], Ruby Ha, Gold [S II]
  // =========================================================================
  function createBatchedNebulaMaterial(dustAtlasTexture) {
    return new THREE.ShaderMaterial({
      uniforms: {
        uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 1.25) },
        uSpecMode: { value: 0.0 },
        uLodDensity: { value: 0.68 },
        uNebOpacity: { value: 1.0 },
        uActiveVolNeb: { value: new THREE.Vector4(0.0, 0.0, 0.0, 0.0) },
        uActiveVolFade: { value: 0.0 },
        uDustAtlas: { value: dustAtlasTexture }
      },
      vertexShader: `
        attribute vec4 aNebData; // x=worldSize, y=opacity, z=kind(0=gas,1=pillarDust,2=xrayShock), w=seed

        uniform float uPixelRatio;
        uniform float uLodDensity;
        uniform vec4 uActiveVolNeb;
        uniform float uActiveVolFade;

        varying vec3 vColor;
        varying float vOpacity;
        varying float vKind;
        varying float vSeed;

        void main() {
          float seed = aNebData.w;
          float keep = clamp(uLodDensity + 0.20, 0.40, 1.0);
          if (seed > keep) {
            gl_PointSize = 0.0;
            gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
            vColor = vec3(0.0);
            vOpacity = 0.0;
            vKind = 0.0;
            vSeed = 0.0;
            return;
          }

          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          float dist = max(-mvPosition.z, 0.25);

          float rawSize = aNebData.x * uPixelRatio * (275.0 / dist);
          gl_PointSize = clamp(rawSize, 2.5, 96.0 * uPixelRatio);

          // Soft fade right against camera lens so flying through nebulae stays smooth
          float nearFade = smoothstep(0.35, 2.2, dist);
          float farFade = 1.0 - smoothstep(140.0, 520.0, dist);

          vColor = color;
          float volCrossFade = 1.0;
          if (uActiveVolFade > 0.01 && uActiveVolNeb.w > 0.01) {
            float dVol = distance(position, uActiveVolNeb.xyz);
            volCrossFade = 1.0 - uActiveVolFade * (1.0 - smoothstep(uActiveVolNeb.w * 0.65, uActiveVolNeb.w * 1.25, dVol));
          }
          vOpacity = aNebData.y * nearFade * farFade * mix(1.25, 1.0, keep) * volCrossFade;
          vKind = aNebData.z;
          vSeed = seed;
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        ${GLSL_PREC}

        uniform float uSpecMode;
        uniform float uNebOpacity;
        uniform sampler2D uDustAtlas;

        varying vec3 vColor;
        varying float vOpacity;
        varying float vKind;
        varying float vSeed;

        void main() {
          if (vOpacity < 0.008 || uNebOpacity < 0.01) discard;

          vec2 uv = gl_PointCoord - 0.5;
          if (dot(uv, uv) > 0.24) discard;

          float a = vSeed * 6.2831853;
          float ca = cos(a);
          float sa = sin(a);
          vec2 localUV = clamp(mat2(ca, -sa, sa, ca) * uv + 0.5, 0.04, 0.96);

          float tileIdx = floor(fract(vSeed * 13.71) * 4.0);
          vec2 tileOrigin = vec2(mod(tileIdx, 2.0) * 0.5, floor(tileIdx * 0.5) * 0.5);
          vec2 atlasUV = tileOrigin + localUV * 0.5;

          vec4 tex = texture2D(uDustAtlas, atlasUV);
          float cloud = tex.a;
          if (cloud < 0.025) discard;

          vec3 col = vColor;
          float alpha = cloud * vOpacity * uNebOpacity;

          if (uSpecMode > 4.5) {
            // Dark Matter / Lensing: Baryonic emission nebulae dim into subtle indigo ghosts
            col = mix(vec3(0.22, 0.14, 0.68), vec3(0.62, 0.48, 0.96), tex.r);
            alpha *= 0.16;
          } else if (uSpecMode > 3.5) {
            // Radio / EHT: Warm orange-gold synchrotron supernova shells & HII free-free gas
            col = mix(vec3(0.86, 0.24, 0.04), vec3(1.0, 0.72, 0.24), tex.r);
            alpha *= (vKind > 1.5 ? 1.25 : 0.62);
          } else if (uSpecMode > 2.5) {
            // Chandra X-Ray: Hot electric-cyan & violet supernova shocks (Crab, Carina, Veil!)
            col = mix(vec3(0.32, 0.24, 0.96), vec3(0.38, 0.88, 1.0), tex.r);
            alpha *= (vKind > 1.5 ? 1.45 : 0.38);
          } else if (uSpecMode > 1.5) {
            // JWST MIRI: Glowing warm dusty golden-amber & ruby-magenta pillars
            col = mix(vec3(1.0, 0.24, 0.52), vec3(1.0, 0.68, 0.22), fract(vSeed * 3.9));
            alpha *= (vKind > 0.5 && vKind < 1.5 ? 1.35 : 0.92);
          } else if (uSpecMode > 0.5) {
            // JWST NIRCam: Crisp Hubble+Webb translucent pillars & turquoise-gold ionization fronts
            col = mix(vColor, vec3(1.0, 0.78, 0.42), vKind > 0.5 ? 0.45 : 0.15);
            alpha *= 0.85;
          } else {
            // Optical HDR: Vibrant NASA Hubble/Webb composite (teal [O III], ruby Ha, golden dust!)
            col = vColor * (0.82 + 0.42 * tex.r);
          }

          if (alpha < 0.008) discard;
          gl_FragColor = vec4(clamp(col, vec3(0.0), vec3(1.35)), clamp(alpha, 0.0, 0.68));
        }
      `,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
  }

  // =========================================================================
  // 6I. VOLUMETRIC LANIAKEA SUPERCLUSTER DENSITY HAZE SHADER (Tully / Cosmicflows-4)
  //     Replaces wireframe egg with soft organic gravitational basin clouds
  // =========================================================================
  function createLaniakeaMistMaterial(nebulaPuffTexture) {
    return new THREE.ShaderMaterial({
      uniforms: {
        uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 1.25) },
        uSpecMode: { value: 0.0 },
        uOpacity: { value: 0.0 },
        uPuffMap: { value: nebulaPuffTexture }
      },
      vertexShader: `
        attribute vec4 aLanData; // x=worldSize, y=density(0..1), z=isCoreAttractor(0..1), w=seed

        uniform float uPixelRatio;

        varying vec3 vColor;
        varying float vDens;
        varying float vCore;
        varying float vSeed;

        void main() {
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          float dist = max(-mvPosition.z, 250.0);

          float rawSize = aLanData.x * uPixelRatio * (1350.0 / dist);
          gl_PointSize = clamp(rawSize, 4.0, 74.0 * uPixelRatio);

          vColor = color;
          vDens = aLanData.y;
          vCore = aLanData.z;
          vSeed = aLanData.w;
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        ${GLSL_PREC}

        uniform float uSpecMode;
        uniform float uOpacity;
        uniform sampler2D uPuffMap;

        varying vec3 vColor;
        varying float vDens;
        varying float vCore;
        varying float vSeed;

        void main() {
          if (uOpacity < 0.004) discard;
          vec4 tex = texture2D(uPuffMap, gl_PointCoord);
          float cloud = tex.a;
          if (cloud < 0.015) discard;

          vec3 col = vColor;
          float alpha = cloud * (0.045 + 0.095 * vDens) * uOpacity;

          if (uSpecMode > 4.5) {
            // Dark Matter / Lensing: Laniakea's massive invisible dark-matter gravitational basin!
            col = mix(vec3(0.24, 0.12, 0.86), vec3(0.84, 0.54, 1.00), vCore * 0.75 + vDens * 0.25);
            alpha *= 1.65;
          } else if (uSpecMode > 3.5) {
            col = mix(vec3(0.84, 0.24, 0.04), vec3(1.00, 0.78, 0.28), vCore * 0.7 + vDens * 0.3);
            alpha *= 1.15;
          } else if (uSpecMode > 2.5) {
            // Chandra X-Ray: Hot intracluster WHIM plasma across Norma, Centaurus & Virgo
            col = mix(vec3(0.10, 0.56, 0.98), vec3(0.82, 0.97, 1.00), vCore * 0.65 + vDens * 0.35);
            alpha *= 1.35;
          } else if (uSpecMode > 1.5) {
            col = mix(vec3(0.76, 0.18, 0.48), vec3(1.00, 0.62, 0.22), vCore * 0.6 + vDens * 0.4);
          } else if (uSpecMode > 0.5) {
            col = mix(vec3(0.32, 0.58, 0.96), vec3(1.00, 0.82, 0.46), vCore * 0.7 + vDens * 0.3);
            alpha *= 0.85;
          } else {
            // Optical HDR: Iconic Nature / Pomarède & Tully Laniakea teal-cyan basin -> golden-white Great Attractor!
            col = mix(vColor, vec3(1.00, 0.90, 0.66), vCore * 0.75);
          }

          if (alpha < 0.004) discard;
          gl_FragColor = vec4(clamp(col, vec3(0.0), vec3(1.25)), clamp(alpha, 0.0, 0.34));
        }
      `,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
  }

  // =========================================================================
  // 6J. ULTRA-REALISTIC ORBITAL EARTH SHADERS (v19.0 — 3D Mountain Bump Relief,
  //     Real Solar Eclipse Umbra, Sun-Aligned Cloud Parallax & Black Marble!)
  // =========================================================================
  function createEarthOrbitalMaterial(placeholderTex) {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0.0 },
        uSpecMode: { value: 0.0 },
        uSunPos: { value: new THREE.Vector3(26.0, 0.35, 3.2) },
        uMoonPos: { value: new THREE.Vector3(0.0, 0.0, 0.0) },
        uMoonRadius: { value: 0.0 },
        uDayMap: { value: placeholderTex },
        uNightMap: { value: placeholderTex },
        uWaterMap: { value: placeholderTex },
        uCloudMap: { value: placeholderTex },
        uHasDayMap: { value: 0.0 },
        uHasNightMap: { value: 0.0 },
        uHasWaterMap: { value: 0.0 },
        uHasCloudMap: { value: 0.0 }
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vLocalPos;
        varying vec3 vNormalWorld;
        varying vec3 vTangentWorld;
        varying vec3 vBitangentWorld;
        varying vec3 vWorldPos;

        void main() {
          vUv = uv;
          vec3 localN = normalize(position);
          vLocalPos = localN;
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;

          float sx = max(length(modelMatrix[0].xyz), 1e-6);
          float sy = max(length(modelMatrix[1].xyz), 1e-6);
          float sz = max(length(modelMatrix[2].xyz), 1e-6);
          vec3 ax0 = modelMatrix[0].xyz / sx;
          vec3 ax1 = modelMatrix[1].xyz / sy;
          vec3 ax2 = modelMatrix[2].xyz / sz;

          vec3 nInv = normalize(vec3(normal.x / sx, normal.y / sy, normal.z / sz));
          vNormalWorld = normalize(ax0 * nInv.x + ax1 * nInv.y + ax2 * nInv.z);

          vec3 locRef = abs(localN.y) > 0.96 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0);
          vec3 locT = normalize(cross(locRef, localN));
          vec3 locB = cross(localN, locT);
          vTangentWorld = normalize(ax0 * locT.x + ax1 * locT.y + ax2 * locT.z);
          vBitangentWorld = normalize(ax0 * locB.x + ax1 * locB.y + ax2 * locB.z);

          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        ${GLSL_PREC}

        uniform float uTime;
        uniform float uSpecMode;
        uniform vec3 uSunPos;
        uniform vec3 uMoonPos;
        uniform float uMoonRadius;
        uniform sampler2D uDayMap;
        uniform sampler2D uNightMap;
        uniform sampler2D uWaterMap;
        uniform sampler2D uCloudMap;
        uniform float uHasDayMap;
        uniform float uHasNightMap;
        uniform float uHasWaterMap;
        uniform float uHasCloudMap;

        varying vec2 vUv;
        varying vec3 vLocalPos;
        varying vec3 vNormalWorld;
        varying vec3 vTangentWorld;
        varying vec3 vBitangentWorld;
        varying vec3 vWorldPos;

        ${GLSL_NOISE_3D_FAST}

        void main() {
          vec3 N = normalize(vNormalWorld);
          vec3 L = normalize(uSunPos - vWorldPos);
          vec3 V = normalize(cameraPosition - vWorldPos);

          float ndotl = dot(N, L);
          float nightFactor = smoothstep(0.08, -0.14, ndotl);
          float twilight = exp(-sq((ndotl + 0.01) * 14.5));
          float ndotv = clamp(dot(N, V), 0.0, 1.0);
          float fresnel = safePow(1.0 - ndotv, 2.85);

          vec3 T = normalize(vTangentWorld);
          vec3 B = normalize(vBitangentWorld);

          vec3 dayAlbedo;
          vec3 nightLights;
          float waterMask = 0.0;
          vec3 N_bump = N;

          if (uHasDayMap > 0.5) {
            dayAlbedo = texture2D(uDayMap, vUv).rgb;
            if (uHasWaterMap > 0.5) {
              waterMask = texture2D(uWaterMap, vUv).r;
            } else {
              waterMask = smoothstep(0.04, 0.20, dayAlbedo.b - max(dayAlbedo.r, dayAlbedo.g) * 0.92);
            }
            // Subtle 3D Mountain Relief strictly on continents (Himalayas, Andes, Rockies!) -> oceans stay mirror-smooth!
            float landMask = 1.0 - waterMask;
            if (landMask > 0.05 && ndotl > -0.12) {
              vec2 eps = vec2(0.0014, 0.0028);
              float hR = dot(texture2D(uDayMap, vec2(fract(vUv.x + eps.x), vUv.y)).rgb, vec3(0.299, 0.587, 0.114));
              float hL = dot(texture2D(uDayMap, vec2(fract(vUv.x - eps.x), vUv.y)).rgb, vec3(0.299, 0.587, 0.114));
              float hU = dot(texture2D(uDayMap, vec2(vUv.x, clamp(vUv.y + eps.y, 0.002, 0.998))).rgb, vec3(0.299, 0.587, 0.114));
              float hD = dot(texture2D(uDayMap, vec2(vUv.x, clamp(vUv.y - eps.y, 0.002, 0.998))).rgb, vec3(0.299, 0.587, 0.114));
              float polarFade = smoothstep(0.98, 0.80, abs(vLocalPos.y));
              N_bump = normalize(N + (T * (hL - hR) + B * (hD - hU)) * (2.6 * landMask * polarFade));
            }
            vec3 richOcean = dayAlbedo * vec3(0.72, 0.88, 1.18);
            vec3 richLand  = dayAlbedo * vec3(0.96, 1.02, 0.94);
            dayAlbedo = mix(richLand, richOcean, waterMask);
          } else {
            vec3 p = vLocalPos;
            float cont = fbm3D(p * 3.3 + vec3(1.2, 0.4, -0.8));
            float detail = fbm3D(p * 9.5);
            float isLand = smoothstep(0.51, 0.57, cont + (detail - 0.5) * 0.14);
            float polar = smoothstep(0.76, 0.90, abs(p.y) + (detail - 0.5) * 0.08);
            vec3 oceanCol = mix(vec3(0.02, 0.12, 0.36), vec3(0.05, 0.26, 0.56), detail);
            vec3 landCol = mix(vec3(0.10, 0.36, 0.14), vec3(0.58, 0.46, 0.28), smoothstep(0.45, 0.78, detail));
            dayAlbedo = mix(oceanCol, landCol, isLand);
            dayAlbedo = mix(dayAlbedo, vec3(0.92, 0.96, 1.0), polar);
            waterMask = (1.0 - isLand) * (1.0 - polar);
          }

          float ndotlBump = dot(N_bump, L);
          float dayLight = smoothstep(-0.07, 0.22, ndotl) * (0.06 + 0.90 * max(ndotlBump, 0.0));

          // Sun-direction-aligned cloud altitude drop-shadows cast onto sunlit oceans & continents!
          float cloudShadow = 1.0;
          if (uHasCloudMap > 0.5 && ndotl > -0.04) {
            vec2 sunTang = vec2(dot(L, T), dot(L, B)) * 0.0052;
            vec2 shUv = vec2(fract(vUv.x - uTime * 0.0038 + sunTang.x), clamp(vUv.y + sunTang.y, 0.002, 0.998));
            vec4 cTexSh = texture2D(uCloudMap, shUv);
            float cValSh = cTexSh.r * cTexSh.a;
            cloudShadow = 1.0 - smoothstep(0.30, 0.86, cValSh) * 0.36 * smoothstep(-0.04, 0.24, ndotl);
          }

          // Real-Time Solar Eclipse Shadow Cone cast by Earth's Moon onto Earth's surface!
          float solarEclipse = 1.0;
          if (uMoonRadius > 0.00001 && ndotl > -0.05) {
            vec3 toMoon = uMoonPos - vWorldPos;
            float proj = dot(toMoon, L);
            if (proj > 0.0) {
              float d = sqrt(max(dot(toMoon, toMoon) - proj * proj, 0.0));
              // Crisp dark umbra core + wide soft penumbra ring
              float penumbra = smoothstep(uMoonRadius * 0.45, uMoonRadius * 1.45, d);
              solarEclipse = mix(0.07, 1.0, penumbra);
            }
          }

          // CRISP PINPOINT NASA BLACK MARBLE GOLDEN CITY LIGHTS (Zero Dark-Ocean Glow Leak!)
          if (uHasNightMap > 0.5) {
            vec3 nTex = texture2D(uNightMap, vUv).rgb;
            float warmness = clamp((nTex.r * 1.15 + nTex.g * 0.45) - nTex.b * 1.12, 0.0, 1.0);
            float brightCity = smoothstep(0.18, 0.62, max(nTex.r, nTex.g)) * smoothstep(0.06, 0.26, warmness);
            float lifted = safePow(brightCity, 0.86);
            vec3 cityCol = mix(vec3(1.00, 0.54, 0.12), vec3(1.00, 0.92, 0.66), smoothstep(0.24, 0.88, lifted));
            nightLights = cityCol * lifted * nightFactor * 2.25;
          } else {
            float c1 = fbm3D(vLocalPos * 24.0);
            float c2 = fbm3D(vLocalPos * 58.0 + vec3(4.1, 2.3, 1.7));
            float cities = smoothstep(0.62, 0.80, c1 * 0.55 + c2 * 0.45) * (1.0 - waterMask) * (1.0 - smoothstep(0.70, 0.84, abs(vLocalPos.y)));
            nightLights = vec3(1.0, 0.74, 0.28) * cities * nightFactor * 1.65;
          }

          // Tight solar glint off Earth's oceans (vanishes inside Solar Eclipse umbra!)
          vec3 H = normalize(L + V);
          float spec = safePow(max(dot(N, H), 0.0), 68.0) * waterMask * 0.42 * max(ndotl, 0.0) * cloudShadow * solarEclipse;

          // Subtle emerald-cyan polar Aurora Borealis / Australis ovals on Earth's dark hemisphere
          float aurBand = exp(-sq((abs(vLocalPos.y) - 0.876) * 26.0));
          float aurCurtain = 0.55 + 0.45 * sin(atan(vLocalPos.z, vLocalPos.x) * 7.0 + uTime * 1.4);
          vec3 auroraGlow = mix(vec3(0.08, 0.92, 0.48), vec3(0.24, 0.64, 1.0), aurCurtain)
            * aurBand * aurCurtain * nightFactor * 0.36;

          float atmoSun = smoothstep(-0.14, 0.36, ndotl) * (0.35 + 0.65 * solarEclipse);
          vec3 dayScatter = mix(vec3(0.12, 0.48, 1.00), vec3(0.46, 0.82, 1.00), fresnel) * fresnel * 0.64 * atmoSun;
          vec3 nightAtmoRim = vec3(0.04, 0.14, 0.38) * fresnel * 0.16 * nightFactor;
          vec3 sunsetRim = vec3(1.00, 0.40, 0.12) * twilight * (0.07 + 0.26 * fresnel);

          vec3 nightBase = vec3(0.008, 0.014, 0.032) * nightFactor;
          vec3 dayLit = clamp(dayAlbedo * (dayLight * cloudShadow * solarEclipse) + vec3(0.92, 0.96, 1.00) * spec + dayScatter, vec3(0.0), vec3(0.94));

          vec3 col = dayLit
            + nightBase
            + nightLights
            + auroraGlow
            + nightAtmoRim
            + sunsetRim;

          float eLum = dot(dayAlbedo, vec3(0.299, 0.587, 0.114));
          if (uSpecMode > 4.5) {
            col = mix(vec3(0.06, 0.04, 0.20), vec3(0.46, 0.36, 0.92), clamp(eLum * 0.45 + fresnel * 0.55, 0.0, 1.0)) + nightLights * 0.35;
          } else if (uSpecMode > 3.5) {
            col = mix(vec3(0.16, 0.04, 0.01), vec3(1.0, 0.54, 0.12), clamp(eLum * 0.55 + (1.0 - waterMask) * 0.30, 0.0, 1.0)) + nightLights * 1.15;
          } else if (uSpecMode > 2.5) {
            float aurora = exp(-sq((abs(vLocalPos.y) - 0.86) * 14.0)) * 1.35;
            col = mix(vec3(0.03, 0.04, 0.16), vec3(0.24, 0.80, 1.0), clamp(dayLight * 0.32 + aurora + fresnel * 0.45, 0.0, 1.0));
          } else if (uSpecMode > 1.5) {
            float therm = clamp(0.28 + (1.0 - waterMask) * 0.34 + dayLight * 0.32, 0.0, 1.0);
            col = mix(vec3(0.28, 0.05, 0.22), vec3(1.0, 0.68, 0.20), therm) + nightLights * 0.45;
          } else if (uSpecMode > 0.5) {
            col = mix(col, col * vec3(1.10, 1.02, 0.90) + nightLights * 0.45, 0.48);
          }

          gl_FragColor = vec4(clamp(col, vec3(0.0), vec3(1.85)), 1.0);
        }
      `,
      transparent: false,
      depthWrite: true
    });
  }

  function createEarthCloudMaterial(placeholderTex) {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0.0 },
        uSpecMode: { value: 0.0 },
        uSunPos: { value: new THREE.Vector3(26.0, 0.35, 3.2) },
        uMoonPos: { value: new THREE.Vector3(0.0, 0.0, 0.0) },
        uMoonRadius: { value: 0.0 },
        uCloudMap: { value: placeholderTex || null },
        uHasCloudMap: { value: 0.0 }
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vLocalPos;
        varying vec3 vNormalWorld;
        varying vec3 vWorldPos;

        void main() {
          vUv = uv;
          vLocalPos = normalize(position);
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          vNormalWorld = normalize(mat3(modelMatrix) * normal);
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        ${GLSL_PREC}

        uniform float uTime;
        uniform float uSpecMode;
        uniform vec3 uSunPos;
        uniform vec3 uMoonPos;
        uniform float uMoonRadius;
        uniform sampler2D uCloudMap;
        uniform float uHasCloudMap;

        varying vec2 vUv;
        varying vec3 vLocalPos;
        varying vec3 vNormalWorld;
        varying vec3 vWorldPos;

        ${GLSL_NOISE_3D_FAST}

        void main() {
          vec3 N = normalize(vNormalWorld);
          vec3 L = normalize(uSunPos - vWorldPos);
          float ndotl = dot(N, L);

          float cloudMask = 0.0;
          if (uHasCloudMap > 0.5) {
            vec2 cUv = vec2(fract(vUv.x - uTime * 0.0038), vUv.y);
            vec4 cTex = texture2D(uCloudMap, cUv);
            float cVal = cTex.r * cTex.a;
            cloudMask = smoothstep(0.18, 0.84, cVal);
          } else {
            vec3 p = vLocalPos;
            float swirl = fbm3D(p * 3.4 + vec3(uTime * 0.024, 0.0, -uTime * 0.018));
            vec3 warped = vec3(
              p.x * 4.8 + (swirl - 0.5) * 1.6,
              p.y * 6.2 + sin(p.x * 3.5 + swirl * 3.4) * 0.28,
              p.z * 4.8 - (swirl - 0.5) * 1.6
            );
            float c1 = fbm3D(warped + vec3(uTime * 0.030, 0.0, -uTime * 0.022));
            cloudMask = smoothstep(0.48, 0.78, c1 * 0.72 + swirl * 0.28);
          }

          if (cloudMask < 0.025) discard;

          // Real Solar Eclipse shadow darkening Earth's cloud deck too!
          float solarEclipse = 1.0;
          if (uMoonRadius > 0.00001 && ndotl > -0.05) {
            vec3 toMoon = uMoonPos - vWorldPos;
            float proj = dot(toMoon, L);
            if (proj > 0.0) {
              float d = sqrt(max(dot(toMoon, toMoon) - proj * proj, 0.0));
              solarEclipse = mix(0.08, 1.0, smoothstep(uMoonRadius * 0.45, uMoonRadius * 1.45, d));
            }
          }

          float dayLight = smoothstep(-0.08, 0.22, ndotl) * (0.08 + 0.84 * max(ndotl, 0.0)) * solarEclipse;
          float twilight = exp(-sq((ndotl + 0.01) * 14.0));
          vec3 cloudCol = mix(vec3(0.02, 0.04, 0.09), vec3(0.84, 0.88, 0.94), dayLight);
          cloudCol += vec3(0.95, 0.44, 0.16) * twilight * 0.20;

          float alpha = cloudMask * mix(0.07, 0.78, dayLight);
          if (uSpecMode > 4.5) {
            alpha *= 0.12;
            cloudCol = vec3(0.54, 0.42, 0.96);
          } else if (uSpecMode > 3.5) {
            alpha *= 0.14;
            cloudCol = vec3(1.0, 0.52, 0.16);
          } else if (uSpecMode > 2.5) {
            alpha *= 0.18;
            cloudCol = vec3(0.32, 0.72, 1.0);
          } else if (uSpecMode > 1.5) {
            cloudCol = mix(vec3(0.28, 0.10, 0.34), vec3(0.95, 0.48, 0.24), dayLight * 0.65);
            alpha *= 0.78;
          }
          gl_FragColor = vec4(cloudCol, clamp(alpha, 0.0, 0.82));
        }
      `,
      transparent: true,
      depthWrite: false
    });
  }

  function createEarthAtmosphereMaterial() {
    return new THREE.ShaderMaterial({
      uniforms: {
        uSpecMode: { value: 0.0 },
        uSunPos: { value: new THREE.Vector3(26.0, 0.35, 3.2) }
      },
      vertexShader: `
        varying vec3 vNormalWorld;
        varying vec3 vWorldPos;

        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          vNormalWorld = normalize(mat3(modelMatrix) * normal);
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        ${GLSL_PREC}

        uniform float uSpecMode;
        uniform vec3 uSunPos;

        varying vec3 vNormalWorld;
        varying vec3 vWorldPos;

        void main() {
          vec3 N = normalize(vNormalWorld);
          vec3 V = normalize(cameraPosition - vWorldPos);
          vec3 L = normalize(uSunPos - vWorldPos);

          float ndotv = clamp(abs(dot(N, V)), 0.0, 1.0);
          float limb = clamp(ndotv * 2.95, 0.0, 1.0);
          float innerGlow = safePow(limb, 3.2);
          float outerHaze = safePow(limb, 1.55) * 0.28;
          float halo = innerGlow + outerHaze;

          float ndotl = dot(N, L);
          float sunSide = smoothstep(-0.18, 0.38, ndotl);
          float sunset = exp(-sq((ndotl + 0.02) * 9.5));

          vec3 rayleigh = mix(vec3(0.08, 0.40, 0.98), vec3(0.42, 0.78, 1.00), innerGlow);
          vec3 skyCol = mix(rayleigh, vec3(0.95, 0.44, 0.16), sunset * 0.36);
          float alpha = halo * (0.06 + 0.94 * sunSide) * 0.78;

          if (uSpecMode > 4.5) {
            skyCol = vec3(0.48, 0.34, 1.00);
            alpha *= 0.45;
          } else if (uSpecMode > 3.5) {
            skyCol = vec3(1.0, 0.46, 0.10);
            alpha *= 0.45;
          } else if (uSpecMode > 2.5) {
            skyCol = vec3(0.32, 0.82, 1.0);
            alpha *= 0.85;
          } else if (uSpecMode > 1.5) {
            skyCol = vec3(1.0, 0.34, 0.42);
            alpha *= 0.62;
          }
          if (alpha < 0.008) discard;
          gl_FragColor = vec4(skyCol * 0.92, clamp(alpha, 0.0, 0.82));
        }
      `,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
  }

  // =========================================================================
  // 6K. REAL-TIME SATURN RING SHADER (Planet-Cast Curved Umbra/Penumbra + 5-Band)
  // =========================================================================
  function createSaturnRingMaterial(ringTexture, planetRadius) {
    return new THREE.ShaderMaterial({
      uniforms: {
        uSpecMode: { value: 0.0 },
        uSunPos: { value: new THREE.Vector3(26.0, 0.35, 3.2) },
        uRingMap: { value: ringTexture },
        uPlanetRadius: { value: planetRadius !== undefined ? planetRadius : 0.092 }
      },
      vertexShader: `
        uniform vec3 uSunPos;
        uniform float uPlanetRadius;

        varying vec2 vUv;
        varying vec3 vRingPosNorm;
        varying vec3 vLocalSunDir;

        void main() {
          vUv = uv;
          // Normalize ring local position by Saturn's radius so Saturn = unit sphere (r = 1.0)
          vRingPosNorm = position / max(uPlanetRadius, 0.0001);
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vec3 toSunW = uSunPos - wp.xyz;
          vLocalSunDir = normalize(vec3(
            dot(toSunW, modelMatrix[0].xyz),
            dot(toSunW, modelMatrix[1].xyz),
            dot(toSunW, modelMatrix[2].xyz)
          ));
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        ${GLSL_PREC}

        uniform float uSpecMode;
        uniform sampler2D uRingMap;

        varying vec2 vUv;
        varying vec3 vRingPosNorm;
        varying vec3 vLocalSunDir;

        void main() {
          vec4 tex = texture2D(uRingMap, vUv);
          if (tex.a < 0.02) discard;

          // Real-time ray-ellipsoid intersection against oblate Saturn (polarScale = 0.902) for true curved shadow!
          vec3 lDir = normalize(vec3(vLocalSunDir.x, vLocalSunDir.y / 0.902, vLocalSunDir.z));
          vec3 pEllip = vec3(vRingPosNorm.x, vRingPosNorm.y / 0.902, vRingPosNorm.z);
          float proj = dot(-pEllip, lDir);
          float shadow = 1.0;
          if (proj > 0.0) {
            float d2 = dot(pEllip, pEllip) - proj * proj;
            shadow = mix(0.07, 1.0, smoothstep(0.955, 1.045, sqrt(max(d2, 0.0))));
          }

          vec3 col = tex.rgb * shadow;
          float alpha = tex.a * 0.92;

          if (uSpecMode > 4.5) {
            col = vec3(0.54, 0.44, 0.96) * (0.28 + 0.72 * shadow);
            alpha *= 0.45;
          } else if (uSpecMode > 3.5) {
            col = vec3(0.95, 0.44, 0.10) * (0.28 + 0.72 * shadow);
            alpha *= 0.65;
          } else if (uSpecMode > 2.5) {
            col = vec3(0.28, 0.72, 1.0) * (0.22 + 0.78 * shadow);
            alpha *= 0.55;
          } else if (uSpecMode > 1.5) {
            col = vec3(1.0, 0.52, 0.34) * (0.35 + 0.65 * shadow);
          } else if (uSpecMode > 0.5) {
            // JWST NIRCam: Saturn's icy rings blaze brilliant silvery-white!
            col = mix(tex.rgb, vec3(1.0, 0.98, 0.94), 0.55) * 1.25 * shadow;
          }

          gl_FragColor = vec4(clamp(col, vec3(0.0), vec3(1.65)), clamp(alpha, 0.0, 0.95));
        }
      `,
      side: THREE.DoubleSide,
      transparent: true,
      depthWrite: false
    });
  }

  // =========================================================================
  // 6L. 3D VOLUMETRIC RAY-MARCHED COSMIC WEB FOAM SHADER (IllustrisTNG Style)
  //     16-step pure-math domain-warped dual-gyroid cellular filament field
  //     (20x faster than 3x3x3 Worley -> silky smooth on mobile & laptop GPUs!)
  // =========================================================================
  function createCosmicWebVolumeMaterial() {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0.0 },
        uCamLocal: { value: new THREE.Vector3(0.2, 0.15, 0.35) },
        uSpecMode: { value: 0.0 },
        uOpacity: { value: 0.0 },
        uLodDensity: { value: 0.68 }
      },
      vertexShader: `
        varying vec3 vLocalPos;
        void main() {
          vLocalPos = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        ${GLSL_PREC}

        uniform float uTime;
        uniform vec3 uCamLocal;
        uniform float uSpecMode;
        uniform float uOpacity;
        uniform float uLodDensity;

        varying vec3 vLocalPos;

        ${GLSL_NOISE_2D_FAST}

        // Fast analytic 3D cellular foam sample -> returns vec3(filamentDensity, nodeDensity, heatField)
        vec3 sampleCosmicFoam(vec3 p) {
          // Multi-scale organic domain warp breaks any periodic grid symmetry!
          vec3 q = p * 5.8;
          vec3 warp = 0.58 * sin(q.yzx * 0.88 + vec3(1.15, 2.45, 3.85))
                    + 0.28 * cos(q.zxy * 1.72 + vec3(-1.4, 0.8, 2.2));
          vec3 w = q + warp;

          // Intersecting dual gyroid surfaces:
          //  - g1 ≈ 0 traces cosmic bubble walls (sheets surrounding dark voids)
          //  - g1 ≈ 0 AND g2 ≈ 0 traces continuous 1D glowing cosmic filaments!
          float g1 = dot(sin(w), cos(w.yzx));
          float g2 = dot(sin(w * 1.46 + vec3(2.15, -1.35, 0.72)), cos(w.zxy * 1.46));

          // Secondary finer sub-filament network woven inside cosmic walls
          vec3 wFine = q * 2.15 - warp * 0.65;
          float gf = dot(sin(wFine), cos(wFine.yzx));

          float sheetWall = exp(-g1 * g1 * 9.5) * 0.18;
          float mainFil = exp(-(g1 * g1 + g2 * g2) * 11.5);
          float fineWeb = exp(-(g1 * g1 * 6.0 + gf * gf * 10.5)) * 0.42;

          // Incandescent 0D convergence nodes where filaments intersect (subtle breathing glow!)
          float nodePulse = 0.50 + 0.50 * sin(w.x * 1.65 + w.y * 1.25 - w.z * 1.85 + uTime * 0.25);
          float nodeCore = exp(-(g1 * g1 + g2 * g2) * 28.0) * smoothstep(0.32, 0.96, nodePulse);

          // Large-scale coherent Fire vs. Ice shock-temperature field aligned to main.js!
          float regionWave = sin(p.x * 6.4 + p.z * 5.3) * cos(p.y * 7.2 - 0.6);
          float heat = smoothstep(-0.22, 0.64, regionWave + nodeCore * 0.65);

          float filDens = sheetWall + mainFil * 0.92 + fineWeb;
          return vec3(filDens, nodeCore, heat);
        }

        void main() {
          if (uOpacity < 0.005 || uLodDensity < 0.05) discard;

          vec3 ro = uCamLocal;
          vec3 rd = normalize(vLocalPos - uCamLocal);

          float b = dot(ro, rd);
          float c = dot(ro, ro) - 1.0;
          float disc = b * b - c;
          if (disc < 0.0) discard;

          float sq = sqrt(max(disc, 0.0));
          float tNear = max(0.0, -b - sq);
          float tFar = -b + sq;
          if (tFar <= tNear) discard;

          // Keep ray span bounded for crisp local depth & zero over-accumulation
          float span = min(tFar - tNear, 1.55);
          const int STEPS = 16;
          float dt = span / float(STEPS);

          // Static screen-space dithering removes slice banding cleanly without flicker!
          float jitter = hash21(gl_FragCoord.xy);
          float t = tNear + dt * (0.20 + 0.80 * jitter);

          vec3 accumCol = vec3(0.0);
          float accumAlpha = 0.0;

          for (int i = 0; i < STEPS; i++) {
            vec3 pos = ro + rd * t;
            float r = length(pos);

            // Carve out inner Local Group / Laniakea cavity (r < 0.075) & soften outer horizon (r > 0.82)
            float innerMask = smoothstep(0.055, 0.135, r);
            float outerMask = 1.0 - smoothstep(0.76, 0.99, r);
            // Soft near-camera clearance so flying inside filaments never flashes
            float camMask = smoothstep(0.025, 0.12, t - tNear);
            float mask = innerMask * outerMask * camMask;

            if (mask > 0.01) {
              vec3 fm = sampleCosmicFoam(pos);
              float fil = fm.x;
              float nd = fm.y;
              float heat = fm.z;

              vec3 stepCol;
              float modeGain = 1.0;

              if (uSpecMode > 4.5) {
                // Dark Matter / Lensing (Euclid / IllustrisTNG): Indigo-violet dark matter skeleton!
                stepCol = mix(vec3(0.16, 0.08, 0.68), vec3(0.86, 0.56, 1.00), clamp(fil * 0.65 + nd * 0.95, 0.0, 1.0));
                modeGain = 1.62;
              } else if (uSpecMode > 3.5) {
                // Radio / EHT: Warm orange-gold synchrotron shock ribbons
                stepCol = mix(vec3(0.72, 0.14, 0.02), vec3(1.00, 0.78, 0.26), clamp(heat * 0.65 + nd * 0.75, 0.0, 1.0));
                modeGain = 1.15;
              } else if (uSpecMode > 2.5) {
                // Chandra X-Ray: Intense electric-cyan WHIM intergalactic plasma!
                stepCol = mix(vec3(0.05, 0.44, 0.96), vec3(0.84, 0.98, 1.00), clamp(heat * 0.55 + nd * 0.85, 0.0, 1.0));
                modeGain = 1.32;
              } else if (uSpecMode > 1.5) {
                // JWST MIRI: Crimson-magenta & molten amber infrared web
                stepCol = mix(vec3(0.56, 0.10, 0.38), vec3(1.00, 0.58, 0.18), clamp(heat * 0.72 + nd * 0.55, 0.0, 1.0));
                modeGain = 0.95;
              } else if (uSpecMode > 0.5) {
                // JWST NIRCam: Delicate background dark-matter haze so galaxies shine
                stepCol = mix(vec3(0.22, 0.44, 0.88), vec3(1.00, 0.72, 0.34), heat);
                modeGain = 0.48;
              } else {
                // Optical HDR: IllustrisTNG Fire & Ice plasma foam!
                vec3 iceCol = mix(vec3(0.10, 0.32, 0.88), vec3(0.52, 0.78, 1.00), clamp(fil * 0.85, 0.0, 1.0));
                vec3 fireCol = mix(vec3(0.96, 0.34, 0.05), vec3(1.00, 0.88, 0.48), clamp(nd * 1.15 + heat * 0.35, 0.0, 1.0));
                stepCol = mix(iceCol, fireCol, smoothstep(0.26, 0.76, heat));
                modeGain = 1.0;
              }

              // Subtle depth attenuation so nearer filaments stand out cleanly in 3D parallax
              float depthAtten = mix(1.15, 0.52, clamp((t - tNear) / 1.45, 0.0, 1.0));
              float stepDens = (fil * 0.145 + nd * 0.34) * mask * dt * modeGain * depthAtten;
              accumCol += stepCol * stepDens;
              accumAlpha += stepDens * 0.82;
            }

            t += dt;
            if (accumAlpha > 0.62) break;
          }

          float lodGain = mix(0.45, 1.0, clamp(uLodDensity, 0.0, 1.0));
          vec3 finalCol = clamp(accumCol * uOpacity * lodGain * 1.45, vec3(0.0), vec3(0.92));
          float finalAlpha = clamp(accumAlpha * uOpacity * lodGain * 1.25, 0.0, 0.48);

          if (finalAlpha < 0.004) discard;
          gl_FragColor = vec4(finalCol, finalAlpha);
        }
      `,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
  }

  // =========================================================================
  // 6M. GPU-DRIVEN LIVE COSMIC INFLOW STREAMS (Zero CPU Loop Overhead!)
  //     Drains matter out of 36 supervoids & accelerates along curved filaments
  //     straight into incandescent supercluster merger fireballs!
  // =========================================================================
  function createCosmicWebFlowMaterial() {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0.0 },
        uSpecMode: { value: 0.0 },
        uOpacity: { value: 0.0 },
        uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 1.25) },
        uLodDensity: { value: 0.68 }
      },
      vertexShader: `
        attribute vec3 aCtrl;
        attribute vec3 aEnd;
        attribute vec4 aFlowData; // x=speed, y=phase, z=heat, w=seed

        uniform float uTime;
        uniform float uPixelRatio;
        uniform float uLodDensity;

        varying float vProg;
        varying float vHeat;
        varying float vSeed;
        varying float vAlpha;

        void main() {
          float seed = aFlowData.w;
          float keep = clamp(uLodDensity * 1.05, 0.25, 1.0);
          if (seed > keep) {
            gl_PointSize = 0.0;
            gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
            vProg = 0.0;
            vHeat = 0.0;
            vSeed = 0.0;
            vAlpha = 0.0;
            return;
          }

          // Continuous loop with gravitational infall acceleration (slow out of void -> fast into hub!)
          float rawT = fract(aFlowData.y + uTime * aFlowData.x);
          float t = rawT * rawT * (1.55 - 0.55 * rawT);
          float inv = 1.0 - t;
          vec3 worldPos = inv * inv * position + 2.0 * inv * t * aCtrl + t * t * aEnd;

          vec4 mvPosition = modelViewMatrix * vec4(worldPos, 1.0);
          float dist = max(-mvPosition.z, 300.0);

          float rawSize = (1.65 + 1.35 * t) * uPixelRatio * (380000.0 / dist);
          gl_PointSize = clamp(rawSize, 1.5, 11.5 * uPixelRatio);

          vProg = t;
          vHeat = aFlowData.z;
          vSeed = seed;
          vAlpha = sin(rawT * 3.14159265);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        ${GLSL_PREC}

        uniform float uSpecMode;
        uniform float uOpacity;

        varying float vProg;
        varying float vHeat;
        varying float vSeed;
        varying float vAlpha;

        void main() {
          if (uOpacity < 0.005 || vAlpha < 0.02) discard;
          vec2 uv = gl_PointCoord - 0.5;
          float r = length(uv);
          if (r > 0.5) discard;

          float spark = exp(-r * r * 26.0) + exp(-r * 5.2) * 0.35;
          float hotBoost = clamp(vHeat * 0.55 + vProg * 0.65, 0.0, 1.0);
          vec3 col;

          if (uSpecMode > 4.5) {
            // Dark Matter / Lensing: Luminous violet-white dark matter infall streams!
            col = mix(vec3(0.36, 0.22, 0.96), vec3(0.94, 0.84, 1.00), hotBoost);
          } else if (uSpecMode > 3.5) {
            col = mix(vec3(0.92, 0.28, 0.05), vec3(1.00, 0.90, 0.44), hotBoost);
          } else if (uSpecMode > 2.5) {
            col = mix(vec3(0.16, 0.68, 1.00), vec3(0.94, 0.99, 1.00), hotBoost);
          } else if (uSpecMode > 1.5) {
            col = mix(vec3(0.95, 0.28, 0.55), vec3(1.00, 0.80, 0.32), hotBoost);
          } else if (uSpecMode > 0.5) {
            col = mix(vec3(0.56, 0.82, 1.00), vec3(1.00, 0.86, 0.54), hotBoost);
          } else {
            // Optical HDR: Cool cyan-sapphire void outflow heating to incandescent gold-white at hub!
            vec3 coldVoid = vec3(0.32, 0.76, 1.00);
            vec3 midFlow = vec3(0.88, 0.94, 1.00);
            vec3 hotHub = vec3(1.00, 0.72, 0.24);
            col = hotBoost < 0.52
              ? mix(coldVoid, midFlow, hotBoost / 0.52)
              : mix(midFlow, hotHub, (hotBoost - 0.52) / 0.48);
          }

          float alpha = spark * vAlpha * uOpacity * (0.45 + 0.50 * vProg);
          if (alpha < 0.01) discard;
          gl_FragColor = vec4(clamp(col * 1.15, vec3(0.0), vec3(1.85)), clamp(alpha, 0.0, 0.92));
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
  }

  // =========================================================================
  // 6N. TRANSLUCENT SOLAR-WIND HELIOPAUSE BOW-SHOCK SHELL SHADER (v16)
  //     Encloses the outer Solar System (~120 AU) where Voyager 1 & 2 cross!
  // =========================================================================
  function createHeliopauseMaterial() {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0.0 },
        uSpecMode: { value: 0.0 },
        uOpacity: { value: 0.35 }
      },
      vertexShader: `
        varying vec3 vLocalPos;
        varying vec3 vNormalWorld;
        varying vec3 vWorldPos;

        void main() {
          vLocalPos = normalize(position);
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          vNormalWorld = normalize(mat3(modelMatrix) * normal);
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        ${GLSL_PREC}

        uniform float uTime;
        uniform float uSpecMode;
        uniform float uOpacity;

        varying vec3 vLocalPos;
        varying vec3 vNormalWorld;
        varying vec3 vWorldPos;

        ${GLSL_NOISE_3D_FAST}

        void main() {
          if (uOpacity < 0.005) discard;
          vec3 V = normalize(cameraPosition - vWorldPos);
          vec3 N = normalize(vNormalWorld);

          float ndotv = clamp(abs(dot(N, V)), 0.0, 0.999);
          float rim = safePow(1.0 - ndotv, 2.25);

          // Asymmetric interstellar-wind compression nose (+X) vs trailing heliotail (-X)
          float bowNose = smoothstep(-0.45, 0.92, vLocalPos.x);
          float ripple = fbm3D(vLocalPos * 4.2 - vec3(uTime * 0.14, 0.0, uTime * 0.08));

          vec3 col;
          if (uSpecMode > 4.5) {
            col = mix(vec3(0.24, 0.14, 0.82), vec3(0.76, 0.56, 1.0), bowNose * 0.7 + ripple * 0.3);
          } else if (uSpecMode > 3.5) {
            col = mix(vec3(0.86, 0.28, 0.05), vec3(1.0, 0.78, 0.26), bowNose * 0.7 + ripple * 0.3);
          } else if (uSpecMode > 2.5) {
            col = mix(vec3(0.14, 0.56, 1.0), vec3(0.82, 0.96, 1.0), bowNose * 0.7 + ripple * 0.3);
          } else if (uSpecMode > 1.5) {
            col = mix(vec3(0.85, 0.24, 0.48), vec3(1.0, 0.68, 0.24), bowNose);
          } else {
            // Iconic NASA IBEX / Voyager Heliopause: sapphire-cyan flank -> warm golden nose bow shock!
            col = mix(vec3(0.14, 0.56, 0.96), vec3(1.0, 0.72, 0.26), bowNose * 0.78);
          }

          float alpha = (rim * 0.68 + 0.06) * (0.48 + 0.52 * ripple) * (0.45 + 0.65 * bowNose) * uOpacity;
          if (alpha < 0.006) discard;
          gl_FragColor = vec4(clamp(col * 1.15, vec3(0.0), vec3(1.5)), clamp(alpha, 0.0, 0.52));
        }
      `,
      side: THREE.DoubleSide,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
  }

  // =========================================================================
  // 6O. VOLUMETRIC 3D NAVARRO-FRENK-WHITE (NFW) DARK MATTER HALO SHADER (v17)
  //     Renders invisible dark matter potential wells around galaxies & clusters
  //     with NFW radial density profile, 3D caustic filaments & lensing limb!
  // =========================================================================
  function createDarkMatterHaloMaterial(options) {
    const opts = options || {};
    const cInner = new THREE.Color(opts.innerColor !== undefined ? opts.innerColor : 0xc084fc);
    const cOuter = new THREE.Color(opts.outerColor !== undefined ? opts.outerColor : 0x3730a3);

    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0.0 },
        uOpacity: { value: 0.0 },
        uColorInner: { value: cInner },
        uColorOuter: { value: cOuter },
        uSeed: { value: opts.seed !== undefined ? opts.seed : 1.0 }
      },
      vertexShader: `
        varying vec3 vLocalPos;
        varying vec3 vNormalWorld;
        varying vec3 vWorldPos;

        void main() {
          vLocalPos = normalize(position);
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          vNormalWorld = normalize(mat3(modelMatrix) * normal);
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        ${GLSL_PREC}

        uniform float uTime;
        uniform float uOpacity;
        uniform vec3 uColorInner;
        uniform vec3 uColorOuter;
        uniform float uSeed;

        varying vec3 vLocalPos;
        varying vec3 vNormalWorld;
        varying vec3 vWorldPos;

        ${GLSL_NOISE_3D_FAST}

        void main() {
          if (uOpacity < 0.004) discard;

          vec3 toCam = cameraPosition - vWorldPos;
          float camLen = length(toCam);
          if (camLen < 0.001) discard;
          vec3 V = toCam / camLen;
          vec3 N = normalize(vNormalWorld);

          // For a BackSide bounding sphere: ndotv = 1 at center (deep NFW cusp!), 0 at virial radius edge!
          float ndotv = clamp(abs(dot(N, V)), 0.0, 1.0);
          float rProj = sqrt(max(1.0 - ndotv * ndotv, 0.0));

          // Physically inspired NFW projected density profile + soft outer virial taper
          float nfwCore = 1.0 / (0.24 + rProj * 1.95);
          float virialFade = safePow(1.0 - smoothstep(0.55, 1.0, rProj), 1.65);

          // Subtle 3D dark-matter subhalo caustic web & weak gravitational lensing ring!
          vec3 p = vLocalPos * 3.8 + vec3(uSeed * 3.1, uTime * 0.04, -uSeed * 2.3);
          float caustic1 = fbm3D(p);
          float caustic2 = fbm3D(p * 2.15 + vec3(caustic1 * 1.2));
          float web = smoothstep(0.28, 0.85, caustic1 * 0.6 + caustic2 * 0.4);

          // Delicate gravitational lensing ring accent near the Einstein/scale radius
          float lensRim = exp(-sq((rProj - 0.62) * 5.2)) * 0.42;

          float density = (nfwCore * 0.34 * virialFade + lensRim) * (0.58 + 0.56 * web);
          vec3 col = mix(uColorOuter, uColorInner, clamp(nfwCore * 0.32 + web * 0.38, 0.0, 1.0));
          // Hot lavender-white central dark matter cusp
          col += vec3(0.92, 0.84, 1.00) * safePow(ndotv, 4.2) * 0.45;

          float alpha = clamp(density * uOpacity, 0.0, 0.72);
          if (alpha < 0.005) discard;
          gl_FragColor = vec4(clamp(col * 1.15, vec3(0.0), vec3(1.85)), alpha);
        }
      `,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
  }

  // =========================================================================
  // 6P. 3D QUADRUPOLE GRAVITATIONAL WAVE SPACETIME RIPPLES SHADER (v17)
  //     Expanding twin-arm spiral h+ / hx metric ripples from OJ 287 Binary SMBH!
  // =========================================================================
  function createGravWaveMaterial() {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0.0 },
        uSpecMode: { value: 0.0 },
        uOpacity: { value: 0.45 }
      },
      vertexShader: `
        varying vec2 vPos;
        void main() {
          vPos = position.xy;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        ${GLSL_PREC}

        uniform float uTime;
        uniform float uSpecMode;
        uniform float uOpacity;

        varying vec2 vPos;

        void main() {
          if (uOpacity < 0.005) discard;
          float r = length(vPos);
          if (r < 0.08 || r > 1.0) discard;

          float theta = atan(vPos.y, vPos.x);
          // True General Relativity quadrupole (m = 2) outward-propagating spiral gravitational waves!
          float phase = 2.0 * theta - r * 30.0 + uTime * 3.8;
          float crest = smoothstep(0.22, 0.98, 0.5 + 0.5 * cos(phase));
          float fineLine = safePow(crest, 3.2);

          // Physical 1/r strain decay + smooth inner horizon & outer boundary fade
          float innerMask = smoothstep(0.11, 0.24, r);
          float outerMask = safePow(1.0 - smoothstep(0.32, 1.0, r), 1.45);
          float strain = (fineLine * 0.78 + crest * 0.22) * innerMask * outerMask;

          vec3 col;
          float modeBoost = 1.0;
          if (uSpecMode > 4.5) {
            // Dark Matter / Lensing: Intense electric-violet & white spacetime strain waves!
            col = mix(vec3(0.46, 0.22, 1.00), vec3(0.92, 0.82, 1.00), fineLine);
            modeBoost = 1.75;
          } else if (uSpecMode > 3.5) {
            col = mix(vec3(0.92, 0.34, 0.08), vec3(1.00, 0.84, 0.42), fineLine);
          } else {
            col = mix(vec3(0.18, 0.58, 1.00), vec3(0.74, 0.48, 1.00), fineLine);
          }

          float alpha = strain * uOpacity * modeBoost;
          if (alpha < 0.008) discard;
          gl_FragColor = vec4(clamp(col * 1.25, vec3(0.0), vec3(1.9)), clamp(alpha, 0.0, 0.78));
        }
      `,
      side: THREE.DoubleSide,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
  }










  // =========================================================================
  // 6Q. 2D CARTESIAN GPU NAVIER-STOKES STABLE FLUIDS ACCRETION SOLVER (v20.0)
  //     Seamless Cartesian grid (zero polar seam / ISCO pinch!) with Keplerian
  //     differential shear, vorticity confinement, Jacobi pressure projection &
  //     continuous spiral plasma replenishment (mobile HalfFloat safe!)
  // =========================================================================
  function createNavierStokesMaterials(texelSize) {
    const ts = new THREE.Vector2(texelSize, texelSize);
    const baseVert = `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }
    `;

    // 1. Velocity Advection + Keplerian Differential Shear Forcing + MRI Eddy Injectors
    const advectVelMat = new THREE.ShaderMaterial({
      uniforms: {
        uVelocity: { value: null },
        uTexelSize: { value: ts.clone() },
        uDt: { value: 0.016 },
        uTime: { value: 0.0 },
        uSpin: { value: 0.85 }
      },
      vertexShader: baseVert,
      fragmentShader: `
        ${GLSL_PREC}
        uniform sampler2D uVelocity;
        uniform vec2 uTexelSize;
        uniform float uDt;
        uniform float uTime;
        uniform float uSpin;
        varying vec2 vUv;

        void main() {
          vec2 p = (vUv - 0.5) * 2.0; // -1..1 Cartesian disk plane
          float r = length(p);
          vec2 oldVel = texture2D(uVelocity, vUv).xy;

          // Semi-Lagrangian backtrace
          vec2 prevUv = clamp(vUv - oldVel * uDt * 0.24, vec2(0.005), vec2(0.995));
          vec2 vel = texture2D(uVelocity, prevUv).xy * 0.992;

          // Circular Keplerian differential shear + gentle inward radial accretion spiral!
          if (r > 0.10 && r < 0.96) {
            vec2 tang = vec2(-p.y, p.x) / max(r, 0.001);
            vec2 radIn = -p / max(r, 0.001);
            float vKep = clamp(0.68 / sqrt(r + 0.08), 0.35, 1.85) * (0.65 + 0.55 * uSpin);
            vec2 targetVel = tang * vKep + radIn * (0.095 / (r + 0.20));

            // Smooth relaxation toward Keplerian flow + oscillating MRI shear vortices!
            vel = mix(vel, targetVel, clamp(uDt * 2.4, 0.02, 0.22));

            // 4 rotating MRI turbulence injectors stirring real eddies across the accretion disk
            float ang = atan(p.y, p.x);
            float mriWave = sin(ang * 4.0 - r * 14.0 + uTime * 2.1) * cos(ang * 3.0 + r * 9.0 - uTime * 1.5);
            vec2 perturb = (radIn * mriWave + tang * sin(ang * 5.0 + uTime * 1.7) * 0.45) * 0.58 * uDt;
            float ringEnv = smoothstep(0.14, 0.28, r) * (1.0 - smoothstep(0.72, 0.94, r));
            vel += perturb * ringEnv;
          } else {
            // Sponge damping inside event horizon & outside outer disk rim
            vel *= 0.85;
          }

          gl_FragColor = vec4(clamp(vel, vec2(-2.6), vec2(2.6)), 0.0, 1.0);
        }
      `,
      depthTest: false,
      depthWrite: false
    });

    // 2. Vorticity (Curl) Computation
    const curlMat = new THREE.ShaderMaterial({
      uniforms: {
        uVelocity: { value: null },
        uTexelSize: { value: ts.clone() }
      },
      vertexShader: baseVert,
      fragmentShader: `
        ${GLSL_PREC}
        uniform sampler2D uVelocity;
        uniform vec2 uTexelSize;
        varying vec2 vUv;

        void main() {
          float vR = texture2D(uVelocity, vUv + vec2(uTexelSize.x, 0.0)).y;
          float vL = texture2D(uVelocity, vUv - vec2(uTexelSize.x, 0.0)).y;
          float uU = texture2D(uVelocity, vUv + vec2(0.0, uTexelSize.y)).x;
          float uD = texture2D(uVelocity, vUv - vec2(0.0, uTexelSize.y)).x;
          float curl = clamp(0.5 * ((vR - vL) - (uU - uD)), -16.0, 16.0);
          gl_FragColor = vec4(curl, 0.0, 0.0, 1.0);
        }
      `,
      depthTest: false,
      depthWrite: false
    });

    // 3. Vorticity Confinement (Keeps swirling spiral plasma eddies razor-sharp forever!)
    const vorticityMat = new THREE.ShaderMaterial({
      uniforms: {
        uVelocity: { value: null },
        uCurl: { value: null },
        uTexelSize: { value: ts.clone() },
        uDt: { value: 0.016 },
        uCurlStrength: { value: 2.8 }
      },
      vertexShader: baseVert,
      fragmentShader: `
        ${GLSL_PREC}
        uniform sampler2D uVelocity;
        uniform sampler2D uCurl;
        uniform vec2 uTexelSize;
        uniform float uDt;
        uniform float uCurlStrength;
        varying vec2 vUv;

        void main() {
          float cL = abs(texture2D(uCurl, vUv - vec2(uTexelSize.x, 0.0)).x);
          float cR = abs(texture2D(uCurl, vUv + vec2(uTexelSize.x, 0.0)).x);
          float cD = abs(texture2D(uCurl, vUv - vec2(0.0, uTexelSize.y)).x);
          float cU = abs(texture2D(uCurl, vUv + vec2(0.0, uTexelSize.y)).x);
          float cC = texture2D(uCurl, vUv).x;

          vec2 force = 0.5 * vec2(cU - cD, cL - cR);
          force /= (length(force) + 0.0002);
          force *= uCurlStrength * cC;

          vec2 vel = texture2D(uVelocity, vUv).xy + force * uDt;
          gl_FragColor = vec4(clamp(vel, vec2(-2.6), vec2(2.6)), 0.0, 1.0);
        }
      `,
      depthTest: false,
      depthWrite: false
    });

    // 4. Divergence Computation
    const divergenceMat = new THREE.ShaderMaterial({
      uniforms: {
        uVelocity: { value: null },
        uTexelSize: { value: ts.clone() }
      },
      vertexShader: baseVert,
      fragmentShader: `
        ${GLSL_PREC}
        uniform sampler2D uVelocity;
        uniform vec2 uTexelSize;
        varying vec2 vUv;

        void main() {
          float uR = texture2D(uVelocity, vUv + vec2(uTexelSize.x, 0.0)).x;
          float uL = texture2D(uVelocity, vUv - vec2(uTexelSize.x, 0.0)).x;
          float vU = texture2D(uVelocity, vUv + vec2(0.0, uTexelSize.y)).y;
          float vD = texture2D(uVelocity, vUv - vec2(0.0, uTexelSize.y)).y;
          float div = clamp(0.5 * ((uR - uL) + (vU - vD)), -16.0, 16.0);
          gl_FragColor = vec4(div, 0.0, 0.0, 1.0);
        }
      `,
      depthTest: false,
      depthWrite: false
    });

    // 5. Jacobi Pressure Iteration
    const pressureMat = new THREE.ShaderMaterial({
      uniforms: {
        uPressure: { value: null },
        uDivergence: { value: null },
        uTexelSize: { value: ts.clone() }
      },
      vertexShader: baseVert,
      fragmentShader: `
        ${GLSL_PREC}
        uniform sampler2D uPressure;
        uniform sampler2D uDivergence;
        uniform vec2 uTexelSize;
        varying vec2 vUv;

        void main() {
          float pL = texture2D(uPressure, vUv - vec2(uTexelSize.x, 0.0)).x;
          float pR = texture2D(uPressure, vUv + vec2(uTexelSize.x, 0.0)).x;
          float pD = texture2D(uPressure, vUv - vec2(0.0, uTexelSize.y)).x;
          float pU = texture2D(uPressure, vUv + vec2(0.0, uTexelSize.y)).x;
          float div = texture2D(uDivergence, vUv).x;
          // Gentle relaxation damping (0.242 < 0.25) prevents monotonic pressure drift / FP16 overflow!
          float p = clamp((pL + pR + pD + pU - div) * 0.242, -16.0, 16.0);
          gl_FragColor = vec4(p, 0.0, 0.0, 1.0);
        }
      `,
      depthTest: false,
      depthWrite: false
    });

    // 6. Pressure Gradient Subtraction (Incompressible Projection)
    const gradSubMat = new THREE.ShaderMaterial({
      uniforms: {
        uPressure: { value: null },
        uVelocity: { value: null },
        uTexelSize: { value: ts.clone() }
      },
      vertexShader: baseVert,
      fragmentShader: `
        ${GLSL_PREC}
        uniform sampler2D uPressure;
        uniform sampler2D uVelocity;
        uniform vec2 uTexelSize;
        varying vec2 vUv;

        void main() {
          float pL = texture2D(uPressure, vUv - vec2(uTexelSize.x, 0.0)).x;
          float pR = texture2D(uPressure, vUv + vec2(uTexelSize.x, 0.0)).x;
          float pD = texture2D(uPressure, vUv - vec2(0.0, uTexelSize.y)).x;
          float pU = texture2D(uPressure, vUv + vec2(0.0, uTexelSize.y)).x;
          vec2 vel = texture2D(uVelocity, vUv).xy - 0.5 * vec2(pR - pL, pU - pD);
          gl_FragColor = vec4(clamp(vel, vec2(-2.6), vec2(2.6)), 0.0, 1.0);
        }
      `,
      depthTest: false,
      depthWrite: false
    });

    // 7. Plasma Density & Magnetic Flare Heat Advection (with continuous spiral feeding!)
    const advectDyeMat = new THREE.ShaderMaterial({
      uniforms: {
        uVelocity: { value: null },
        uDye: { value: null },
        uCurl: { value: null },
        uDt: { value: 0.016 },
        uTime: { value: 0.0 }
      },
      vertexShader: baseVert,
      fragmentShader: `
        ${GLSL_PREC}
        uniform sampler2D uVelocity;
        uniform sampler2D uDye;
        uniform sampler2D uCurl;
        uniform float uDt;
        uniform float uTime;
        varying vec2 vUv;

        void main() {
          vec2 p = (vUv - 0.5) * 2.0;
          float r = length(p);
          vec2 vel = texture2D(uVelocity, vUv).xy;
          vec2 prevUv = clamp(vUv - vel * uDt * 0.24, vec2(0.005), vec2(0.995));

          vec3 dye = texture2D(uDye, prevUv).rgb * (1.0 - uDt * 0.34);
          float curlMag = abs(texture2D(uCurl, vUv).x);

          // Continuous clumpy plasma stream injection along mid/outer disk so fluid stays crisp forever!
          float ang = atan(p.y, p.x);
          float feedRing = exp(-sq((r - 0.62) * 5.2));
          float clumps = 0.50 + 0.50 * sin(ang * 5.0 - uTime * 1.15) * cos(ang * 3.0 + uTime * 0.72);
          float innerFeed = exp(-sq((r - 0.30) * 6.5)) * (0.50 + 0.50 * cos(ang * 4.0 + uTime * 2.2));

          dye.r += (feedRing * (0.30 + 0.85 * clumps) + innerFeed * 0.55) * uDt * 1.45;
          // Viscous shear & high vorticity heat up plasma into glowing golden magnetic flare knots!
          float flareSpot = exp(-sq((r - 0.28) * 7.5)) * smoothstep(0.62, 0.96, sin(ang * 2.0 - uTime * 1.85) * 0.5 + 0.5);
          dye.g += (clamp(curlMag * 1.8, 0.0, 1.0) * 0.65 + flareSpot * 0.95) * uDt * 1.35;
          dye.b = clamp(curlMag * 1.5, 0.0, 1.0);

          // Event horizon sink & outer rim fade
          float mask = smoothstep(0.11, 0.21, r) * (1.0 - smoothstep(0.84, 0.98, r));
          dye *= mask;

          gl_FragColor = vec4(clamp(dye, vec3(0.0), vec3(1.5)), 1.0);
        }
      `,
      depthTest: false,
      depthWrite: false
    });

    return {
      advectVel: advectVelMat,
      curl: curlMat,
      vorticity: vorticityMat,
      divergence: divergenceMat,
      pressure: pressureMat,
      gradSub: gradSubMat,
      advectDye: advectDyeMat
    };
  }

  // =========================================================================
  // 6R. STAR-BLOCKING DARK MOLECULAR DUST ABSORPTION NEBULA SHADER (v20.0)
  //     Uses NormalBlending so Pillars of Creation, Orion Bar & Carina Cliffs
  //     genuinely occlude Milky Way stars behind them with glowing ionized rims!
  // =========================================================================
  function createNebulaDarkDustMaterial(dustAtlasTexture) {
    return new THREE.ShaderMaterial({
      uniforms: {
        uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 1.25) },
        uSpecMode: { value: 0.0 },
        uLodDensity: { value: 0.68 },
        uNebOpacity: { value: 1.0 },
        uActiveVolNeb: { value: new THREE.Vector4(0.0, 0.0, 0.0, 0.0) },
        uActiveVolFade: { value: 0.0 },
        uDustAtlas: { value: dustAtlasTexture }
      },
      vertexShader: `
        attribute vec4 aDarkData; // x=worldSize, y=opacity, z=rimWarmth(0=cyan..1=gold), w=seed

        uniform float uPixelRatio;
        uniform float uLodDensity;
        uniform vec4 uActiveVolNeb;
        uniform float uActiveVolFade;

        varying vec3 vRimColor;
        varying float vOpacity;
        varying float vSeed;

        void main() {
          float seed = aDarkData.w;
          float keep = clamp(uLodDensity + 0.24, 0.42, 1.0);
          if (seed > keep) {
            gl_PointSize = 0.0;
            gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
            vRimColor = vec3(0.0);
            vOpacity = 0.0;
            vSeed = 0.0;
            return;
          }

          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          float dist = max(-mvPosition.z, 0.22);

          float rawSize = aDarkData.x * uPixelRatio * (265.0 / dist);
          gl_PointSize = clamp(rawSize, 2.5, 92.0 * uPixelRatio);

          float nearFade = smoothstep(0.32, 1.85, dist);
          float farFade = 1.0 - smoothstep(130.0, 460.0, dist);

          vRimColor = color;
          float volCrossFade = 1.0;
          if (uActiveVolFade > 0.01 && uActiveVolNeb.w > 0.01) {
            float dVol = distance(position, uActiveVolNeb.xyz);
            volCrossFade = 1.0 - uActiveVolFade * (1.0 - smoothstep(uActiveVolNeb.w * 0.65, uActiveVolNeb.w * 1.25, dVol));
          }
          vOpacity = aDarkData.y * nearFade * farFade * volCrossFade;
          vSeed = seed;
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        ${GLSL_PREC}

        uniform float uSpecMode;
        uniform float uNebOpacity;
        uniform sampler2D uDustAtlas;

        varying vec3 vRimColor;
        varying float vOpacity;
        varying float vSeed;

        void main() {
          if (vOpacity < 0.008 || uNebOpacity < 0.01) discard;
          // X-Ray & Dark Matter pass right through cold neutral molecular dust!
          if (uSpecMode > 2.5) discard;

          vec2 uv = gl_PointCoord - 0.5;
          if (dot(uv, uv) > 0.24) discard;

          float a = vSeed * 6.2831853;
          float ca = cos(a);
          float sa = sin(a);
          vec2 localUV = clamp(mat2(ca, -sa, sa, ca) * uv + 0.5, 0.04, 0.96);

          float tileIdx = floor(fract(vSeed * 15.17) * 4.0);
          vec2 tileOrigin = vec2(mod(tileIdx, 2.0) * 0.5, floor(tileIdx * 0.5) * 0.5);
          vec2 atlasUV = tileOrigin + localUV * 0.5;

          vec4 tex = texture2D(uDustAtlas, atlasUV);
          float cloud = tex.a;
          if (cloud < 0.03) discard;

          // Thin photo-evaporation rim glow around dense dark charcoal Bok-globule core!
          float rimBand = smoothstep(0.04, 0.34, cloud) * (1.0 - smoothstep(0.38, 0.82, cloud));

          if (uSpecMode > 1.5) {
            // JWST MIRI: Cold dark optical pillars glow warm amber-magenta in mid-infrared!
            vec3 miriCol = mix(vec3(0.45, 0.12, 0.26), vec3(1.00, 0.62, 0.24), rimBand * 0.75 + tex.r * 0.25);
            gl_FragColor = vec4(miriCol, clamp(cloud * vOpacity * uNebOpacity * 0.72, 0.0, 0.78));
          } else if (uSpecMode > 0.5) {
            // JWST NIRCam: Near-IR penetrates ~55% of the optical dust extinction!
            vec3 nirDust = mix(vec3(0.08, 0.04, 0.03), vRimColor * 0.75, rimBand * 0.68);
            gl_FragColor = vec4(nirDust, clamp(cloud * vOpacity * uNebOpacity * 0.44, 0.0, 0.58));
          } else {
            // Optical HDR: Opaque dark-brown/charcoal dust core blocking stars behind it + crisp ionized rim!
            vec3 darkCore = vec3(0.032, 0.018, 0.014) * (0.65 + 0.70 * tex.r);
            vec3 col = mix(darkCore, vRimColor * 0.92, rimBand * 0.72);
            gl_FragColor = vec4(col, clamp(cloud * vOpacity * uNebOpacity * 0.92, 0.0, 0.92));
          }
        }
      `,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending
    });
  }

  // =========================================================================
  // 6S. DISTANCE-CULLED 3D VOLUMETRIC RAY-MARCHED HERO NEBULA SHADER (v20.0)
  //     20-step pure-math 3D volume ray-marcher for Orion (M42), Pillars of
  //     Creation (M16) & Helix/Ring Planetary Nebulae -> True 3D Parallax!
  // =========================================================================
  function createVolumetricNebulaMaterial(options) {
    const opts = options || {};
    const cPrimary = new THREE.Color(opts.primaryColor !== undefined ? opts.primaryColor : 0x38bdf8);
    const cSecondary = new THREE.Color(opts.secondaryColor !== undefined ? opts.secondaryColor : 0xf43f5e);
    const cRim = new THREE.Color(opts.rimColor !== undefined ? opts.rimColor : 0xfbbf24);

    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0.0 },
        uCamLocal: { value: new THREE.Vector3(0.0, 0.0, 2.0) },
        uSpecMode: { value: 0.0 },
        uOpacity: { value: 0.0 },
        uNebKind: { value: opts.nebKind !== undefined ? opts.nebKind : 0.0 }, // 0=Orion Cavity, 1=Pillars of Creation, 2=Ring/Helix Barrel
        uColPrimary: { value: cPrimary },
        uColSecondary: { value: cSecondary },
        uColRim: { value: cRim }
      },
      vertexShader: `
        varying vec3 vLocalPos;
        void main() {
          vLocalPos = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        ${GLSL_PREC}

        uniform float uTime;
        uniform vec3 uCamLocal;
        uniform float uSpecMode;
        uniform float uOpacity;
        uniform float uNebKind;
        uniform vec3 uColPrimary;
        uniform vec3 uColSecondary;
        uniform vec3 uColRim;

        varying vec3 vLocalPos;

        ${GLSL_NOISE_2D_FAST}

        // Fast 2-octave trig-warped 3D nebula density field (instant compile & smooth mobile FPS!)
        float fastNebNoise(vec3 p) {
          vec3 q = p * 2.8;
          vec3 w = q + 0.55 * sin(q.yzx * 1.15 + vec3(1.2, 2.5, 3.7));
          float n1 = 0.5 + 0.5 * dot(sin(w), cos(w.yzx)) * 0.58;
          vec3 w2 = w * 2.15 + vec3(2.4, -1.7, 0.9);
          float n2 = 0.5 + 0.5 * dot(sin(w2), cos(w2.zxy)) * 0.58;
          return clamp(n1 * 0.65 + n2 * 0.35, 0.0, 1.0);
        }

        // Returns vec3(emissiveGas, darkAbsorptionDust, colorMix)
        vec3 evalNebulaVolume(vec3 p) {
          float r = length(p);
          float env = smoothstep(1.0, 0.52, r);
          if (env <= 0.001) return vec3(0.0);

          float n = fastNebNoise(p * 1.45 + vec3(0.0, uTime * 0.015, 0.0));

          if (uNebKind < 0.5) {
            // 0: ORION NEBULA (M42) — Blister HII cavity around Trapezium + sweeping ruby curtains + dark Orion Bar!
            float cavity = smoothstep(0.14, 0.42, r) * exp(-sq((r - 0.52) * 2.4));
            float wing = exp(-sq((p.y + 0.18 * sin(p.x * 3.2)) * 2.6)) * env;
            float gas = (cavity * 0.95 + wing * 0.65) * smoothstep(0.28, 0.82, n) * env;
            // Dark foreground Orion Bar molecular dust ridge cutting diagonally across the lower cavity!
            float barDist = abs(p.y + 0.24 - p.x * 0.42 + (n - 0.5) * 0.26);
            float dust = exp(-barDist * barDist * 32.0) * smoothstep(0.15, 0.75, p.z + 0.45) * smoothstep(0.35, 0.85, n) * env * 1.45;
            float colMix = smoothstep(0.24, 0.72, r);
            return vec3(gas, dust, colMix);
          } else if (uNebKind < 1.5) {
            // 1: PILLARS OF CREATION (EAGLE / M16) — Three 3D sculpted dusty elephant trunks in a glowing teal sea!
            float tWarp = (n - 0.5) * 0.19;
            // Pillar 1 (tall left), Pillar 2 (mid center), Pillar 3 (short right)
            float d1 = length(p.xz - vec2(-0.34 + p.y * 0.08 + tWarp,  0.08 + tWarp * 0.6));
            float h1 = smoothstep( 0.68,  0.50, p.y) * smoothstep(-0.82, -0.52, p.y);
            float p1 = smoothstep(0.175 - p.y * 0.04, 0.075, d1) * h1;

            float d2 = length(p.xz - vec2( 0.03 + p.y * 0.06 - tWarp * 0.8, -0.06 + tWarp * 0.5));
            float h2 = smoothstep( 0.46,  0.28, p.y) * smoothstep(-0.82, -0.52, p.y);
            float p2 = smoothstep(0.165 - p.y * 0.04, 0.070, d2) * h2;

            float d3 = length(p.xz - vec2( 0.36 + p.y * 0.04 + tWarp * 0.7,  0.10 - tWarp * 0.6));
            float h3 = smoothstep( 0.22,  0.04, p.y) * smoothstep(-0.82, -0.52, p.y);
            float p3 = smoothstep(0.150 - p.y * 0.03, 0.065, d3) * h3;

            float pillarCore = clamp(p1 + p2 + p3, 0.0, 1.0);
            float dust = pillarCore * (0.72 + 0.55 * n) * 2.15;

            // Glowing photo-evaporating ionization rim right along the surface of the 3 pillars + ambient teal backdrop!
            float pillarRim = smoothstep(0.06, 0.42, pillarCore) * (1.0 - smoothstep(0.55, 0.95, pillarCore));
            float bgSea = smoothstep(0.32, 0.85, n) * env * 0.34 * smoothstep(-0.7, 0.5, p.y);
            float gas = bgSea + pillarRim * 1.45;
            float colMix = clamp(pillarRim * 1.15 + smoothstep(0.1, 0.65, p.y) * 0.35, 0.0, 1.0);
            return vec3(gas, dust, colMix);
          } else {
            // 2: HELIX / RING NEBULA — 3D hollow ionized barrel torus with emerald inner eye & crimson outer shell!
            float rXY = length(p.xy);
            float torusDist = length(vec2(rXY - 0.56, p.z * 0.72));
            float ringShell = exp(-torusDist * torusDist * 19.0) * (0.45 + 0.75 * n);
            float innerEye = exp(-r * r * 7.5) * (0.35 + 0.55 * n);
            float gas = (ringShell * 1.15 + innerEye * 0.65) * env;
            float dust = exp(-sq((rXY - 0.64) * 9.0)) * smoothstep(0.50, 0.88, n) * 0.42 * env;
            float colMix = smoothstep(0.30, 0.68, rXY);
            return vec3(gas, dust, colMix);
          }
        }

        void main() {
          if (uOpacity < 0.006) discard;

          vec3 ro = uCamLocal;
          vec3 rd = normalize(vLocalPos - uCamLocal);

          float b = dot(ro, rd);
          float c = dot(ro, ro) - 1.0;
          float disc = b * b - c;
          if (disc < 0.0) discard;

          float sq = sqrt(max(disc, 0.0));
          float tNear = max(0.0, -b - sq);
          float tFar = -b + sq;
          if (tFar <= tNear) discard;

          const int STEPS = 20;
          float dt = (tFar - tNear) / float(STEPS);
          float jitter = hash21(gl_FragCoord.xy);
          float t = tNear + dt * (0.25 + 0.75 * jitter);

          vec3 accumCol = vec3(0.0);
          float trans = 1.0;

          // Dust opacity drops naturally in NIRCam/MIRI/X-Ray just like real NASA multi-wavelength observations!
          float dustAbsorbScale = (uSpecMode > 2.5) ? 0.05 : ((uSpecMode > 1.5) ? 0.18 : ((uSpecMode > 0.5) ? 0.42 : 1.0));

          for (int i = 0; i < STEPS; i++) {
            vec3 pos = ro + rd * t;
            vec3 v = evalNebulaVolume(pos);
            float gas = v.x;
            float dust = v.y;
            float cm = v.z;

            if (gas > 0.004 || dust > 0.004) {
              vec3 c1 = uColPrimary;
              vec3 c2 = uColSecondary;
              vec3 c3 = uColRim;

              if (uSpecMode > 4.5) {
                c1 = vec3(0.32, 0.20, 0.88);
                c2 = vec3(0.68, 0.46, 1.00);
                c3 = vec3(0.92, 0.82, 1.00);
                gas *= 0.25;
              } else if (uSpecMode > 3.5) {
                c1 = vec3(0.88, 0.26, 0.05);
                c2 = vec3(1.00, 0.68, 0.20);
                c3 = vec3(1.00, 0.90, 0.48);
              } else if (uSpecMode > 2.5) {
                c1 = vec3(0.24, 0.76, 1.00);
                c2 = vec3(0.46, 0.32, 0.98);
                c3 = vec3(0.90, 0.98, 1.00);
                gas *= 0.68;
              } else if (uSpecMode > 1.5) {
                // JWST MIRI: Dark dust trunks glow warm amber-rose!
                c1 = vec3(1.00, 0.28, 0.54);
                c2 = vec3(1.00, 0.64, 0.18);
                c3 = vec3(1.00, 0.90, 0.52);
                gas += dust * 0.62;
              }

              vec3 emitCol = cm < 0.55
                ? mix(c1, c2, cm / 0.55)
                : mix(c2, c3, (cm - 0.55) / 0.45);

              // Subtle warm dark-brown dust self-glow so silhouettes look rich & 3D, never flat black
              vec3 dustTint = vec3(0.055, 0.028, 0.020);
              float stepEmit = gas * dt * 1.55;
              float stepAbsorb = (dust * 2.85 * dustAbsorbScale + gas * 0.42) * dt;

              accumCol += trans * (emitCol * stepEmit + dustTint * dust * dt * 0.35 * dustAbsorbScale);
              trans *= exp(-stepAbsorb);
              if (trans < 0.03) break;
            }
            t += dt;
          }

          float alpha = clamp((1.0 - trans) * uOpacity, 0.0, 0.94);
          if (alpha < 0.006) discard;
          gl_FragColor = vec4(clamp(accumCol * uOpacity * 1.25, vec3(0.0), vec3(1.95)), alpha);
        }
      `,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending
    });
  }

  // =========================================================================
  // 7. PROCEDURAL CANVAS TEXTURES (2x2 Dust Atlas + Photographic Galaxy Glow!)
  // =========================================================================
  function createTextures() {
    const starCanvas = document.createElement('canvas');
    starCanvas.width = 64;
    starCanvas.height = 64;
    const sCtx = starCanvas.getContext('2d');
    const sGrad = sCtx.createRadialGradient(32, 32, 0, 32, 32, 32);
    sGrad.addColorStop(0.0, 'rgba(255,255,255,1.0)');
    sGrad.addColorStop(0.22, 'rgba(240,248,255,0.88)');
    sGrad.addColorStop(0.55, 'rgba(140,190,255,0.26)');
    sGrad.addColorStop(1.0, 'rgba(0,0,0,0.0)');
    sCtx.fillStyle = sGrad;
    sCtx.fillRect(0, 0, 64, 64);

    const nebCanvas = document.createElement('canvas');
    nebCanvas.width = 128;
    nebCanvas.height = 128;
    const nCtx = nebCanvas.getContext('2d');
    const nGrad = nCtx.createRadialGradient(64, 64, 2, 64, 64, 64);
    nGrad.addColorStop(0.0, 'rgba(255,255,255,0.62)');
    nGrad.addColorStop(0.38, 'rgba(210,230,255,0.26)');
    nGrad.addColorStop(0.74, 'rgba(110,160,255,0.07)');
    nGrad.addColorStop(1.0, 'rgba(0,0,0,0.0)');
    nCtx.fillStyle = nGrad;
    nCtx.fillRect(0, 0, 128, 128);

    const atlasCanvas = document.createElement('canvas');
    atlasCanvas.width = 192;
    atlasCanvas.height = 192;
    const aCtx = atlasCanvas.getContext('2d');

    function paintTile(ox, oy, blobs) {
      aCtx.save();
      aCtx.beginPath();
      aCtx.rect(ox, oy, 96, 96);
      aCtx.clip();
      blobs.forEach(function (b) {
        const g = aCtx.createRadialGradient(ox + b[0], oy + b[1], 1, ox + b[0], oy + b[1], b[2]);
        g.addColorStop(0.0, 'rgba(255,255,255,' + b[3] + ')');
        g.addColorStop(0.55, 'rgba(205,205,205,' + (b[3] * 0.42) + ')');
        g.addColorStop(1.0, 'rgba(0,0,0,0.0)');
        aCtx.fillStyle = g;
        aCtx.fillRect(ox, oy, 96, 96);
      });
      aCtx.restore();
    }

    paintTile(0, 0, [
      [28, 48, 22, 0.46], [42, 44, 26, 0.56], [58, 48, 24, 0.50],
      [72, 54, 18, 0.36], [48, 36, 16, 0.30], [52, 58, 16, 0.28]
    ]);
    paintTile(96, 0, [
      [48, 48, 30, 0.68], [38, 42, 18, 0.45], [58, 52, 18, 0.44],
      [46, 60, 15, 0.32], [50, 34, 15, 0.34]
    ]);
    paintTile(0, 96, [
      [34, 62, 22, 0.52], [46, 50, 24, 0.58], [58, 38, 20, 0.48],
      [64, 30, 14, 0.34], [30, 52, 15, 0.30], [56, 56, 15, 0.26]
    ]);
    paintTile(96, 96, [
      [48, 48, 38, 0.42], [34, 38, 22, 0.28], [62, 58, 22, 0.28],
      [62, 36, 18, 0.24], [34, 60, 18, 0.24]
    ]);

    const dustAtlas = new THREE.CanvasTexture(atlasCanvas);
    dustAtlas.minFilter = THREE.LinearFilter;
    dustAtlas.magFilter = THREE.LinearFilter;

    const galCanvas = document.createElement('canvas');
    galCanvas.width = 256;
    galCanvas.height = 256;
    const gCtx = galCanvas.getContext('2d');
    const gGrad = gCtx.createRadialGradient(128, 128, 2, 128, 128, 126);
    gGrad.addColorStop(0.0, 'rgba(255,245,222,0.72)');
    gGrad.addColorStop(0.14, 'rgba(255,224,175,0.44)');
    gGrad.addColorStop(0.36, 'rgba(175,205,255,0.18)');
    gGrad.addColorStop(0.68, 'rgba(110,165,255,0.06)');
    gGrad.addColorStop(1.0, 'rgba(0,0,0,0.0)');
    gCtx.fillStyle = gGrad;
    gCtx.fillRect(0, 0, 256, 256);

    const jwstCanvas = document.createElement('canvas');
    jwstCanvas.width = 128;
    jwstCanvas.height = 128;
    const jCtx = jwstCanvas.getContext('2d');
    const jGrad = jCtx.createRadialGradient(64, 64, 0, 64, 64, 26);
    jGrad.addColorStop(0.0, 'rgba(255,255,255,1.0)');
    jGrad.addColorStop(0.35, 'rgba(255,240,215,0.65)');
    jGrad.addColorStop(1.0, 'rgba(0,0,0,0.0)');
    jCtx.fillStyle = jGrad;
    jCtx.fillRect(0, 0, 128, 128);

    jCtx.save();
    jCtx.translate(64, 64);
    const spikeAngles = [0, Math.PI / 3, (2 * Math.PI) / 3, Math.PI / 2];
    spikeAngles.forEach(function (ang, idx) {
      jCtx.save();
      jCtx.rotate(ang);
      const len = idx === 3 ? 34 : 58;
      const g = jCtx.createLinearGradient(-len, 0, len, 0);
      g.addColorStop(0.0, 'rgba(255,255,255,0.0)');
      g.addColorStop(0.5, idx === 3 ? 'rgba(255,235,205,0.55)' : 'rgba(255,250,240,0.92)');
      g.addColorStop(1.0, 'rgba(255,255,255,0.0)');
      jCtx.fillStyle = g;
      jCtx.fillRect(-len, -1.2, len * 2, 2.4);
      jCtx.restore();
    });
    jCtx.restore();


    // 6. 2x2 Procedural Mini-Galaxy Sprite Atlas (256x256 -> 4 crisp 128x128 galaxy types!)
    //    Tile 0 (TL): Face-on Spiral   | Tile 1 (TR): Tilted Edge-On Disk
    //    Tile 2 (BL): Golden Elliptical| Tile 3 (BR): Blue-Pink Dwarf Irregular
    const galAtlasCanvas = document.createElement('canvas');
    galAtlasCanvas.width = 256;
    galAtlasCanvas.height = 256;
    const gaCtx = galAtlasCanvas.getContext('2d');

    // Tile 0 (Top-Left: 0,0 -> 128,128): Face-on 2-Arm Grand-Design Spiral
    gaCtx.save();
    gaCtx.beginPath();
    gaCtx.rect(0, 0, 128, 128);
    gaCtx.clip();
    gaCtx.translate(64, 64);
    // Soft outer blue disk glow
    const spHalo = gaCtx.createRadialGradient(0, 0, 2, 0, 0, 48);
    spHalo.addColorStop(0.0, 'rgba(255,244,218,0.95)');
    spHalo.addColorStop(0.20, 'rgba(255,222,170,0.62)');
    spHalo.addColorStop(0.48, 'rgba(145,192,255,0.22)');
    spHalo.addColorStop(1.0, 'rgba(0,0,0,0.0)');
    gaCtx.fillStyle = spHalo;
    gaCtx.fillRect(-56, -56, 112, 112);
    // Two logarithmic spiral arms painted with soft overlapping blue-white & pink HII knots
    for (let arm = 0; arm < 2; arm++) {
      const a0 = arm * Math.PI;
      for (let k = 0; k < 28; k++) {
        const t = k / 27;
        const r = 6 + t * 38;
        const th = a0 + t * 3.1;
        const px = Math.cos(th) * r;
        const py = Math.sin(th) * r * 0.86;
        const rad = 5.5 + (1.0 - t) * 4.5;
        const g = gaCtx.createRadialGradient(px, py, 0.5, px, py, rad);
        const isHII = (k % 7 === 4);
        g.addColorStop(0.0, isHII ? 'rgba(255,145,205,0.68)' : 'rgba(205,230,255,0.62)');
        g.addColorStop(1.0, 'rgba(0,0,0,0.0)');
        gaCtx.fillStyle = g;
        gaCtx.fillRect(px - rad, py - rad, rad * 2, rad * 2);
      }
    }
    // Crisp warm central core
    const spCore = gaCtx.createRadialGradient(0, 0, 0, 0, 0, 14);
    spCore.addColorStop(0.0, 'rgba(255,252,240,1.0)');
    spCore.addColorStop(0.5, 'rgba(255,225,175,0.65)');
    spCore.addColorStop(1.0, 'rgba(0,0,0,0.0)');
    gaCtx.fillStyle = spCore;
    gaCtx.fillRect(-16, -16, 32, 32);
    gaCtx.restore();

    // Tile 1 (Top-Right: 128,0 -> 256,128): Tilted Edge-On Disk Galaxy
    gaCtx.save();
    gaCtx.beginPath();
    gaCtx.rect(128, 0, 128, 128);
    gaCtx.clip();
    gaCtx.translate(192, 64);
    // Elongated stellar disk
    gaCtx.save();
    gaCtx.scale(1.0, 0.24);
    const edgeDisk = gaCtx.createRadialGradient(0, 0, 2, 0, 0, 50);
    edgeDisk.addColorStop(0.0, 'rgba(255,244,220,0.95)');
    edgeDisk.addColorStop(0.32, 'rgba(215,228,255,0.68)');
    edgeDisk.addColorStop(0.68, 'rgba(130,178,255,0.28)');
    edgeDisk.addColorStop(1.0, 'rgba(0,0,0,0.0)');
    gaCtx.fillStyle = edgeDisk;
    gaCtx.fillRect(-54, -54, 108, 108);
    gaCtx.restore();
    // Luminous central spheroid bulge
    gaCtx.save();
    gaCtx.scale(1.0, 0.62);
    const edgeBulge = gaCtx.createRadialGradient(0, 0, 0, 0, 0, 20);
    edgeBulge.addColorStop(0.0, 'rgba(255,250,234,1.0)');
    edgeBulge.addColorStop(0.45, 'rgba(255,216,158,0.62)');
    edgeBulge.addColorStop(1.0, 'rgba(0,0,0,0.0)');
    gaCtx.fillStyle = edgeBulge;
    gaCtx.fillRect(-24, -24, 48, 48);
    gaCtx.restore();
    // Subtle dark equatorial dust silhouette along inner edge-on disk
    gaCtx.fillStyle = 'rgba(25,12,6,0.26)';
    gaCtx.fillRect(-34, -1.4, 68, 2.8);
    gaCtx.restore();

    // Tile 2 (Bottom-Left: 0,128 -> 128,256): Golden-Amber Elliptical Spheroid
    gaCtx.save();
    gaCtx.beginPath();
    gaCtx.rect(0, 128, 128, 128);
    gaCtx.clip();
    gaCtx.translate(64, 192);
    gaCtx.scale(1.0, 0.78);
    const ellipGrad = gaCtx.createRadialGradient(0, 0, 1, 0, 0, 44);
    ellipGrad.addColorStop(0.0, 'rgba(255,250,232,1.0)');
    ellipGrad.addColorStop(0.22, 'rgba(255,228,176,0.78)');
    ellipGrad.addColorStop(0.52, 'rgba(255,196,125,0.30)');
    ellipGrad.addColorStop(0.82, 'rgba(220,155,95,0.08)');
    ellipGrad.addColorStop(1.0, 'rgba(0,0,0,0.0)');
    gaCtx.fillStyle = ellipGrad;
    gaCtx.fillRect(-48, -48, 96, 96);
    gaCtx.restore();

    // Tile 3 (Bottom-Right: 128,128 -> 256,256): Clumpy Blue-Pink Dwarf Irregular
    gaCtx.save();
    gaCtx.beginPath();
    gaCtx.rect(128, 128, 128, 128);
    gaCtx.clip();
    gaCtx.translate(192, 192);
    const irrBlobs = [
      [0, 0, 26, 'rgba(180,215,255,0.62)'],
      [-12, -5, 16, 'rgba(210,235,255,0.72)'],
      [13, 6, 15, 'rgba(165,205,255,0.64)'],
      [-6, 10, 12, 'rgba(255,135,195,0.62)'],
      [9, -9, 11, 'rgba(255,228,185,0.68)'],
      [-20, 4, 11, 'rgba(140,185,255,0.42)'],
      [21, -2, 10, 'rgba(140,185,255,0.38)']
    ];
    irrBlobs.forEach(function (b) {
      const g = gaCtx.createRadialGradient(b[0], b[1], 0.5, b[0], b[1], b[2]);
      g.addColorStop(0.0, b[3]);
      g.addColorStop(1.0, 'rgba(0,0,0,0.0)');
      gaCtx.fillStyle = g;
      gaCtx.fillRect(b[0] - b[2], b[1] - b[2], b[2] * 2, b[2] * 2);
    });
    gaCtx.restore();

    const galaxyAtlas = new THREE.CanvasTexture(galAtlasCanvas);
    galaxyAtlas.minFilter = THREE.LinearFilter;
    galaxyAtlas.magFilter = THREE.LinearFilter;


    // 7. 512x512 NASA/JPL Robert Hurt & ESA Gaia Style Photographic Milky Way Disk!
    //    27°-angled peanut bar, 4 logarithmic arms (Scutum-Centaurus, Perseus,
    //    Sagittarius-Carina, Norma-Outer), Orion-Cygnus Spur, HII knots & dust rifts
    const mwCanvas = document.createElement('canvas');
    mwCanvas.width = 512;
    mwCanvas.height = 512;
    const mCtx = mwCanvas.getContext('2d');
    mCtx.translate(256, 256);

    // Seeded RNG for repeatable crisp photographic painting
    let mwSeed = 13372026;
    function mwRng() {
      mwSeed = (mwSeed * 16807) % 2147483647;
      return (mwSeed - 1) / 2147483646;
    }

    // Soft outer stellar halo & unresolved disk mist
    const mwHalo = mCtx.createRadialGradient(0, 0, 10, 0, 0, 248);
    mwHalo.addColorStop(0.00, 'rgba(255,244,218,0.88)');
    mwHalo.addColorStop(0.14, 'rgba(255,222,168,0.58)');
    mwHalo.addColorStop(0.32, 'rgba(182,206,255,0.22)');
    mwHalo.addColorStop(0.64, 'rgba(105,152,235,0.08)');
    mwHalo.addColorStop(1.00, 'rgba(0,0,0,0.0)');
    mCtx.fillStyle = mwHalo;
    mCtx.fillRect(-256, -256, 512, 512);

    // 27°-angled Central Galactic Bar + Warm Peanut/X-Shaped Bulge!
    const BAR_ANG = 0.47; // ~27° to the Sun-Galactic Center line
    mCtx.save();
    mCtx.rotate(BAR_ANG);
    mCtx.scale(1.0, 0.36);
    const barGrad = mCtx.createRadialGradient(0, 0, 4, 0, 0, 92);
    barGrad.addColorStop(0.00, 'rgba(255,252,236,0.96)');
    barGrad.addColorStop(0.28, 'rgba(255,224,162,0.78)');
    barGrad.addColorStop(0.62, 'rgba(235,172,102,0.34)');
    barGrad.addColorStop(1.00, 'rgba(0,0,0,0.0)');
    mCtx.fillStyle = barGrad;
    mCtx.fillRect(-105, -105, 210, 210);
    mCtx.restore();

    // 4 Authentic Milky Way Logarithmic Spiral Arms (aligned to main-v13.js!)
    // [baseAngle, pitchTwist, isMajor, widthScale]
    const mwArms = [
      { a0: BAR_ANG + 0.00,           twist: 4.15, major: true,  w: 1.08 }, // Scutum-Centaurus (Major)
      { a0: BAR_ANG + Math.PI,        twist: 4.15, major: true,  w: 1.08 }, // Perseus (Major)
      { a0: BAR_ANG + Math.PI * 0.52, twist: 4.25, major: false, w: 0.78 }, // Sagittarius-Carina (Minor)
      { a0: BAR_ANG + Math.PI * 1.52, twist: 4.25, major: false, w: 0.78 }  // Norma-Outer (Minor)
    ];

    // Pass A: Luminous blue-white & golden spiral arm ribbons + feathery outer spurs
    mwArms.forEach(function (arm) {
      const steps = arm.major ? 90 : 72;
      for (let k = 0; k < steps; k++) {
        const t = k / (steps - 1);
        const rNorm = 0.16 + t * 0.80;
        const rPx = rNorm * 238;
        const ang = arm.a0 + arm.twist * Math.log(1.0 + rNorm * 3.45);
        const px = Math.cos(ang) * rPx;
        const py = Math.sin(ang) * rPx;

        const rad = (11 + t * 22) * arm.w;
        const alpha = (arm.major ? 0.30 : 0.19) * (1.0 - t * 0.52);
        const g = mCtx.createRadialGradient(px, py, 1, px, py, rad);
        if (t < 0.28) {
          g.addColorStop(0.0, 'rgba(255,228,184,' + alpha.toFixed(3) + ')');
          g.addColorStop(0.55, 'rgba(180,210,255,' + (alpha * 0.45).toFixed(3) + ')');
        } else {
          g.addColorStop(0.0, 'rgba(170,212,255,' + alpha.toFixed(3) + ')');
          g.addColorStop(0.52, 'rgba(110,166,255,' + (alpha * 0.42).toFixed(3) + ')');
        }
        g.addColorStop(1.0, 'rgba(0,0,0,0.0)');
        mCtx.fillStyle = g;
        mCtx.fillRect(px - rad, py - rad, rad * 2, rad * 2);

        // Occasional ruby-pink HII star-forming nursery beads hugging major ridges
        if (k % 5 === 2 && t > 0.12 && t < 0.88) {
          const hr = 4.5 + mwRng() * 5.5;
          const ox = (mwRng() - 0.5) * rad * 0.5;
          const oy = (mwRng() - 0.5) * rad * 0.5;
          const hg = mCtx.createRadialGradient(px + ox, py + oy, 0.5, px + ox, py + oy, hr);
          hg.addColorStop(0.0, 'rgba(255,95,168,' + (arm.major ? 0.44 : 0.28) + ')');
          hg.addColorStop(1.0, 'rgba(0,0,0,0.0)');
          mCtx.fillStyle = hg;
          mCtx.fillRect(px + ox - hr, py + oy - hr, hr * 2, hr * 2);
        }

        // Feathery secondary spiral spurs branching gently outward
        if (arm.major && k % 11 === 5 && t > 0.22 && t < 0.78) {
          for (let sp = 1; sp <= 8; sp++) {
            const sf = sp / 8;
            const sr = rPx + sf * 32;
            const sa = ang + sf * 0.42;
            const sx = Math.cos(sa) * sr;
            const sy = Math.sin(sa) * sr;
            const sRad = 9 + sf * 7;
            const sg = mCtx.createRadialGradient(sx, sy, 0.5, sx, sy, sRad);
            sg.addColorStop(0.0, 'rgba(155,200,255,' + (0.14 * (1.0 - sf * 0.65)).toFixed(3) + ')');
            sg.addColorStop(1.0, 'rgba(0,0,0,0.0)');
            mCtx.fillStyle = sg;
            mCtx.fillRect(sx - sRad, sy - sRad, sRad * 2, sRad * 2);
          }
        }
      }
    });

    // Pass B: Dedicated Orion-Cygnus Local Spur passing right through Sol's region!
    for (let os = 0; os < 28; os++) {
      const f = os / 27;
      const rPx = (0.38 + f * 0.24) * 238;
      const ang = -0.32 + f * 0.92;
      const px = Math.cos(ang) * rPx;
      const py = Math.sin(ang) * rPx;
      const rad = 11 + Math.sin(f * Math.PI) * 6;
      const og = mCtx.createRadialGradient(px, py, 1, px, py, rad);
      og.addColorStop(0.0, 'rgba(182,222,255,0.22)');
      og.addColorStop(0.6, 'rgba(130,185,255,0.08)');
      og.addColorStop(1.0, 'rgba(0,0,0,0.0)');
      mCtx.fillStyle = og;
      mCtx.fillRect(px - rad, py - rad, rad * 2, rad * 2);
    }

    // Pass C: Dark Inner-Edge Molecular Dust Rifts (carves crisp NASA/Spitzer dark lanes!)
    mCtx.save();
    mCtx.globalCompositeOperation = 'source-atop';
    mwArms.forEach(function (arm) {
      const steps = arm.major ? 78 : 56;
      for (let k = 0; k < steps; k++) {
        const t = k / (steps - 1);
        const rNorm = 0.16 + t * 0.74;
        const rPx = rNorm * 234;
        // Concave inner shock edge sits slightly trailing (-0.14 rad) of the bright star ridge!
        const ang = arm.a0 + arm.twist * Math.log(1.0 + rNorm * 3.45) - 0.14;
        const px = Math.cos(ang) * rPx + (mwRng() - 0.5) * 4;
        const py = Math.sin(ang) * rPx + (mwRng() - 0.5) * 4;
        const dRad = (5.5 + t * 9.5) * arm.w;
        const dg = mCtx.createRadialGradient(px, py, 0.5, px, py, dRad);
        const dOp = (arm.major ? 0.42 : 0.26) * (1.0 - t * 0.45);
        dg.addColorStop(0.0, 'rgba(14,7,4,' + dOp.toFixed(3) + ')');
        dg.addColorStop(0.6, 'rgba(26,13,8,' + (dOp * 0.45).toFixed(3) + ')');
        dg.addColorStop(1.0, 'rgba(0,0,0,0.0)');
        mCtx.fillStyle = dg;
        mCtx.fillRect(px - dRad, py - dRad, dRad * 2, dRad * 2);
      }
    });
    mCtx.restore();

    // Soft central cutout so Sgr A* ray-marched core stays crisp when zoomed near the core
    mCtx.save();
    mCtx.globalCompositeOperation = 'destination-out';
    const coreCut = mCtx.createRadialGradient(0, 0, 2, 0, 0, 16);
    coreCut.addColorStop(0.0, 'rgba(0,0,0,0.92)');
    coreCut.addColorStop(0.6, 'rgba(0,0,0,0.35)');
    coreCut.addColorStop(1.0, 'rgba(0,0,0,0.0)');
    mCtx.fillStyle = coreCut;
    mCtx.fillRect(-18, -18, 36, 36);
    mCtx.restore();

    const milkyWayDisk = new THREE.CanvasTexture(mwCanvas);
    milkyWayDisk.minFilter = THREE.LinearFilter;
    milkyWayDisk.magFilter = THREE.LinearFilter;

    return {
      starGlow: new THREE.CanvasTexture(starCanvas),
      nebulaPuff: new THREE.CanvasTexture(nebCanvas),
      dustAtlas: dustAtlas,
      dustCloud: dustAtlas,
      galaxyGlow: new THREE.CanvasTexture(galCanvas),
      milkyWayDisk: milkyWayDisk,
      galaxyAtlas: galaxyAtlas,
      jwstSpike: new THREE.CanvasTexture(jwstCanvas)
    };
  }

  return {
    createGargantuaMaterial: createGargantuaMaterial,
    createBatchedStarMaterial: createBatchedStarMaterial,
    createBatchedDustMaterial: createBatchedDustMaterial,
    createFermiBubbleMaterial: createFermiBubbleMaterial,
    createCMBDomeMaterial: createCMBDomeMaterial,
    createEinsteinRingMaterial: createEinsteinRingMaterial,
    createFieldGalaxyMaterial: createFieldGalaxyMaterial,
    createRelativisticJetMaterial: createRelativisticJetMaterial,
    createQuasarOutflowMaterial: createQuasarOutflowMaterial,
    createBHDustTorusMaterial: createBHDustTorusMaterial,
    createStarSurfaceMaterial: createStarSurfaceMaterial,
    createSolarCoronaMaterial: createSolarCoronaMaterial,
    createPlanetMaterial: createPlanetMaterial,
    createNavierStokesMaterials: createNavierStokesMaterials,
    createBatchedNebulaMaterial: createBatchedNebulaMaterial,
    createNebulaDarkDustMaterial: createNebulaDarkDustMaterial,
    createVolumetricNebulaMaterial: createVolumetricNebulaMaterial,
    createLaniakeaMistMaterial: createLaniakeaMistMaterial,
    createEarthOrbitalMaterial: createEarthOrbitalMaterial,
    createEarthCloudMaterial: createEarthCloudMaterial,
    createEarthAtmosphereMaterial: createEarthAtmosphereMaterial,
    createSaturnRingMaterial: createSaturnRingMaterial,
    createCosmicWebVolumeMaterial: createCosmicWebVolumeMaterial,
    createCosmicWebFlowMaterial: createCosmicWebFlowMaterial,
    createHeliopauseMaterial: createHeliopauseMaterial,
    createDarkMatterHaloMaterial: createDarkMatterHaloMaterial,
    createGravWaveMaterial: createGravWaveMaterial,
    createTextures: createTextures
  };
})();
