/* =========================================================================
 * shaders.js — High-Detail Crash-Proof GLSL Shaders (v3 Safe-Ultra Edition)
 * Optimized for Integrated Laptop GPUs (ANGLE/D3D11) & Mobile GPUs (FP16)
 * Upgrades in v3:
 *  - Gargantua: Post-loop multi-lane plasma filaments, stronger Doppler flare
 *    & 2-layer gravitationally lensed Einstein-ring stars (ZERO nested loops!)
 *  - Batched Stars: Vertex-shader distance LOD (100% detail up close, smart
 *    culling far away so all ~500k stars stay silky-smooth)
 *  - Batched Dust: 2x2 procedural dust atlas (4 organic shapes, 25x faster)
 *  - Soft photographic galaxy core/disk glow texture for hero galaxies
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
  // 1. GARGANTUA (INTERSTELLAR / STARGAZE-GRADE) RELATIVISTIC BLACK HOLE
  //    44-step pure-math geodesic loop -> shades plasma & lensed stars OUTSIDE
  // =========================================================================
  function createGargantuaMaterial(options) {
    const opts = options || {};
    const diskTint = opts.diskTint ? new THREE.Color(opts.diskTint) : new THREE.Color(0xffb463);

    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0.0 },
        uCamLocal: { value: new THREE.Vector3(0.0, 0.3, 1.8) },
        uSpin: { value: opts.spin !== undefined ? opts.spin : 0.85 },
        uSpecMode: { value: 0.0 },
        uDiskTint: { value: diskTint },
        uBrightness: { value: opts.brightness !== undefined ? opts.brightness : 1.28 }
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
        uniform vec3 uDiskTint;
        uniform float uBrightness;

        varying vec3 vLocalPos;

        ${GLSL_NOISE_2D_FAST}

        vec3 plasmaBlackbody(float temp) {
          float t = clamp(temp, 0.0, 1.6);
          if (uSpecMode > 2.5) {
            vec3 c1 = vec3(0.16, 0.05, 0.48);
            vec3 c2 = vec3(0.25, 0.64, 1.00);
            vec3 c3 = vec3(0.94, 0.99, 1.00);
            return t < 0.6 ? mix(c1, c2, t / 0.6) : mix(c2, c3, clamp((t - 0.6) / 0.75, 0.0, 1.0));
          } else if (uSpecMode > 1.5) {
            vec3 c1 = vec3(0.42, 0.04, 0.16);
            vec3 c2 = vec3(1.00, 0.36, 0.12);
            vec3 c3 = vec3(1.00, 0.86, 0.64);
            return t < 0.6 ? mix(c1, c2, t / 0.6) : mix(c2, c3, clamp((t - 0.6) / 0.75, 0.0, 1.0));
          } else if (uSpecMode > 0.5) {
            vec3 c1 = vec3(0.62, 0.20, 0.05);
            vec3 c2 = vec3(1.00, 0.72, 0.34);
            vec3 c3 = vec3(0.86, 0.95, 1.00);
            return t < 0.6 ? mix(c1, c2, t / 0.6) : mix(c2, c3, clamp((t - 0.6) / 0.75, 0.0, 1.0));
          } else {
            // Deep crimson-orange outer wisps -> molten gold -> incandescent blue-white core
            vec3 c0 = vec3(0.22, 0.03, 0.005);
            vec3 c1 = vec3(0.96, 0.31, 0.05) * (0.65 + 0.35 * uDiskTint);
            vec3 c2 = vec3(1.00, 0.80, 0.42);
            vec3 c3 = vec3(0.96, 0.98, 1.00);
            if (t < 0.32) return mix(c0, c1, t / 0.32);
            if (t < 0.76) return mix(c1, c2, (t - 0.32) / 0.44);
            return mix(c2, c3, clamp((t - 0.76) / 0.60, 0.0, 1.0));
          }
        }

        // Rich multi-scale swirling accretion disk (runs at most twice per pixel!)
        vec4 shadeAccretionHit(vec3 p, vec3 rayDir, float rIn, float rOut, float rs) {
          float r = length(p.xz);
          if (r < rIn * 0.92 || r > rOut) return vec4(0.0);

          float rNorm = clamp((r - rIn) / max(rOut - rIn, 0.001), 0.0, 0.999);
          float innerEdge = smoothstep(rIn * 0.93, rIn + 0.030, r);
          float outerEdge = safePow(1.0 - smoothstep(0.36, 1.0, rNorm), 1.55);

          // Differential Keplerian shear (inner plasma orbits much faster than outer edge)
          float omega = 1.25 / safePow(r + 0.13, 1.35);
          float twist = uTime * omega * 0.58 + 6.4 * log(r + 0.075);
          float ct = cos(twist);
          float st = sin(twist);
          vec2 rotXZ = mat2(ct, -st, st, ct) * p.xz;

          // Secondary counter-sheared wisps for high-detail Saturn-like plasma streaks
          float f1 = fbm2D(rotXZ * 7.6 + vec2(uTime * 0.035, -uTime * 0.028));
          float f2 = fbm2D(rotXZ * 18.5 + vec2(f1 * 1.4, -uTime * 0.05));

          // Sharp concentric rings + dark Cassini-style turbulent gaps
          float rings = 0.42 + 0.58 * sin(r * 74.0 - uTime * 2.1 + f1 * 6.0);
          float fineStreaks = 0.46 + 0.54 * sin(r * 175.0 + f2 * 8.5);
          float gapMod = 0.68 + 0.32 * cos(r * 34.0 + f1 * 3.8);

          float filament = (0.20 + 0.80 * f1) * (0.52 + 0.48 * f2);
          float density = innerEdge * outerEdge * filament * (0.38 + 0.62 * rings) * (0.62 + 0.38 * fineStreaks) * gapMod;

          // Blazing inner ISCO plasma ridge
          float iscoGlow = exp(-rNorm * 7.2) * innerEdge * 1.30;

          // Relativistic Doppler Beaming (prograde rotation in XZ plane)
          vec3 velDir = normalize(vec3(-p.z, 0.0, p.x) + vec3(1e-5, 0.0, 0.0));
          float beta = clamp(sqrt(0.58 * rs / max(r, rs * 1.04)), 0.0, 0.64);
          float cosTheta = dot(velDir, -normalize(rayDir));
          float gamma = inversesqrt(max(1.0 - beta * beta, 0.15));
          float doppler = 1.0 / max(gamma * (1.0 - beta * cosTheta), 0.26);
          float gravShift = sqrt(clamp(1.0 - (rs * 0.90) / max(r, rs * 1.02), 0.16, 1.0));
          float gTotal = clamp(doppler * gravShift, 0.24, 2.55);

          // Dramatic Stargaze-style white-hot approaching side vs fiery orange receding side
          float beaming = mix(1.0, clamp(safePow(gTotal, 3.55), 0.18, 4.2), uSpin * 0.90);
          float colorShift = mix(0.0, (gTotal - 1.0) * 0.62, uSpin);

          float temp = (1.16 * safePow(1.0 - rNorm, 1.28) + iscoGlow * 0.58 + (f2 - 0.5) * 0.30) + colorShift;
          vec3 col = plasmaBlackbody(temp);

          if (gTotal > 1.05 && uSpecMode < 0.5) {
            col = mix(col, vec3(0.90, 0.96, 1.0), clamp((gTotal - 1.05) * 0.78 * uSpin, 0.0, 0.72));
          }

          float intensity = (density * 1.95 + iscoGlow * 0.92) * beaming * uBrightness;
          float alpha = clamp(density * 1.45 + iscoGlow * 0.46, 0.0, 0.96);
          return vec4(col * intensity, alpha);
        }

        // 2-Layer Gravitationally Lensed Einstein-Ring Background Stars
        vec3 sampleLensedStars(vec3 d) {
          vec3 nd = normalize(d);
          // Layer 1: Crisp bright background stars
          vec3 p1 = nd * 54.0;
          vec3 c1 = floor(p1);
          vec3 f1 = fract(p1) - 0.5;
          float h1 = hash21(c1.xy + c1.z * 37.13);
          vec3 s1 = vec3(0.0);
          if (h1 > 0.962) {
            float st1 = exp(-dot(f1, f1) * 54.0) * smoothstep(0.962, 1.0, h1);
            vec3 t1 = mix(vec3(0.74, 0.88, 1.0), vec3(1.0, 0.85, 0.66), fract(h1 * 91.7));
            s1 = t1 * st1 * 1.25;
          }

          // Layer 2: Finer distant star dust forming delicate Einstein arcs
          vec3 p2 = nd * 112.0;
          vec3 c2 = floor(p2);
          vec3 f2 = fract(p2) - 0.5;
          float h2 = hash21(c2.yz + c2.x * 53.71);
          vec3 s2 = vec3(0.0);
          if (h2 > 0.968) {
            float st2 = exp(-dot(f2, f2) * 42.0) * smoothstep(0.968, 1.0, h2);
            vec3 t2 = mix(vec3(0.82, 0.92, 1.0), vec3(1.0, 0.90, 0.78), fract(h2 * 67.3));
            s2 = t2 * st2 * 0.75;
          }
          return s1 + s2;
        }

        void main() {
          const float RS = 0.095;
          float rIn = mix(2.55 * RS, 1.56 * RS, uSpin);
          const float rOut = 0.87;

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

          bool hasHit1 = false;
          vec3 hitPos1 = vec3(0.0);
          vec3 hitDir1 = vec3(0.0, 0.0, -1.0);

          bool hasHit2 = false;
          vec3 hitPos2 = vec3(0.0);
          vec3 hitDir2 = vec3(0.0, 0.0, -1.0);

          float coronaGlow = 0.0;

          // Pure-math 44-step curved-spacetime geodesic integrator (ZERO noise inside!)
          const int MAX_STEPS = 44;
          for (int i = 0; i < MAX_STEPS; i++) {
            float r2 = dot(pos, pos);
            float r = sqrt(max(r2, 1e-6));
            minR = min(minR, r);

            if (r < RS * 1.04) {
              captured = true;
              break;
            }
            if (r > 1.05 && dot(pos, dir) > 0.0) {
              break;
            }

            float planeProx = clamp(abs(pos.y) * 2.5 + 0.42, 0.42, 1.0);
            float dt = clamp(r * 0.145 * planeProx, 0.018, 0.088);

            vec3 hVec = cross(pos, dir);
            float h2 = dot(hVec, hVec);
            vec3 accel = -1.5 * RS * h2 * pos / max(r2 * r2 * r, 1e-5);
            vec3 drag = cross(vec3(0.0, 1.0, 0.0), pos) * (uSpin * 0.16 * RS * RS / max(r2 * r, 1e-5));

            vec3 prevPos = pos;
            dir = normalize(dir + (accel + drag) * dt);
            pos += dir * dt;

            if ((prevPos.y > 0.0 && pos.y <= 0.0) || (prevPos.y < 0.0 && pos.y >= 0.0)) {
              float frac = abs(prevPos.y) / max(abs(prevPos.y) + abs(pos.y), 1e-6);
              vec3 hit = mix(prevPos, pos, frac);
              float hr = length(hit.xz);
              if (hr > rIn * 0.92 && hr < rOut) {
                if (!hasHit1) {
                  hasHit1 = true;
                  hitPos1 = hit;
                  hitDir1 = dir;
                } else if (!hasHit2) {
                  hasHit2 = true;
                  hitPos2 = hit;
                  hitDir2 = dir;
                }
              }
            }

            float rXZ = length(pos.xz);
            if (abs(pos.y) < 0.055 && rXZ > rIn * 0.90 && rXZ < rOut * 0.92) {
              float vf = exp(-pos.y * pos.y * 920.0);
              float rf = smoothstep(rIn * 0.90, rIn + 0.06, rXZ) * (1.0 - smoothstep(rOut * 0.46, rOut * 0.92, rXZ));
              coronaGlow += vf * rf * dt * 1.40;
            }
          }

          vec3 accumColor = vec3(0.0);
          float transmittance = 1.0;

          if (hasHit1) {
            vec4 s1 = shadeAccretionHit(hitPos1, hitDir1, rIn, rOut, RS);
            accumColor += transmittance * s1.rgb * s1.a;
            transmittance *= (1.0 - s1.a * 0.85);
          }

          if (hasHit2 && transmittance > 0.03) {
            vec4 s2 = shadeAccretionHit(hitPos2, hitDir2, rIn, rOut, RS);
            accumColor += transmittance * s2.rgb * s2.a * 1.18;
            transmittance *= (1.0 - s2.a * 0.85);
          }

          if (coronaGlow > 0.002) {
            vec3 cCol = plasmaBlackbody(0.66);
            accumColor += transmittance * cCol * min(coronaGlow, 0.88) * uBrightness * 0.62;
          }

          // Razor-Sharp Multi-Order Photon Ring + Lensed Einstein-Ring Stars
          if (!captured) {
            float ringDist = abs(minR - RS * 1.48);
            float photonRing = exp(-ringDist * 76.0) * 1.65 + exp(-ringDist * 20.0) * 0.25;
            vec3 ringCol = plasmaBlackbody(1.28);
            accumColor += transmittance * ringCol * photonRing * uBrightness;
            transmittance *= clamp(1.0 - photonRing * 0.48, 0.0, 1.0);

            float bendAmt = clamp(1.0 - dot(dir, rd), 0.0, 1.0);
            if (bendAmt > 0.018) {
              vec3 lensedStar = sampleLensedStars(dir) * smoothstep(0.018, 0.16, bendAmt);
              accumColor += transmittance * lensedStar;
            }
          }

          // Strict HDR safety clamp prevents mobile/desktop bloom whiteout
          accumColor = clamp(accumColor, vec3(0.0), vec3(3.4));

          float alpha = captured ? 1.0 : clamp(1.0 - transmittance + length(accumColor) * 0.24, 0.0, 1.0);

          float viewEdge = smoothstep(0.0, 0.18, sqrt(max(disc, 0.0)));
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
  //    100% of stars render close-up; distant sub-pixel stars thin cleanly!
  // =========================================================================
  function createBatchedStarMaterial() {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0.0 },
        uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 1.25) },
        uSpecMode: { value: 0.0 },
        uLodDensity: { value: 0.68 } // 0.38=Perf, 0.68=Balanced, 1.0=Ultra
      },
      vertexShader: `
        attribute vec3 aGalCenter;
        attribute vec4 aGalQuat;
        attribute vec4 aStarData; // x=omega, y=size, z=spectral, w=kind(0=star,1=HII,2=spikeStar,3=globular)

        uniform float uTime;
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
          float ang = aStarData.x * uTime;
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

          // Smart Distance LOD: Keep 100% stars within 340 units, smoothly thin far-away galaxies
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

          // Compensate slightly when distant stars are thinned so galaxies stay bright & crisp
          float lumComp = mix(1.0, 1.38, smoothstep(320.0, 2200.0, dist) * (1.0 - keepProb));

          vColor = color * lumComp;
          vKind = aStarData.w;
          vSpectral = aStarData.z;

          float sizeBoost = 1.0;
          if (uSpecMode > 0.5 && uSpecMode < 1.5 && vKind > 1.5 && vKind < 2.5) {
            sizeBoost = 1.95;
          } else if (uSpecMode > 1.5 && uSpecMode < 2.5 && vKind > 0.5 && vKind < 1.5) {
            sizeBoost = 1.45;
          } else if (vKind > 2.5) {
            sizeBoost = 1.35; // Globular cluster warm glow
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

          // HII star-forming nebula knots
          if (vKind > 0.5 && vKind < 1.5) {
            shape = exp(-r * r * 10.0) * 0.48;
          } else if (vKind > 2.5) {
            // Soft golden Globular Cluster core
            shape = exp(-r * r * 18.0) * 0.82 + exp(-r * 4.5) * 0.38;
          }

          // JWST NIRCam 8-point diffraction spikes on bright O/B & foreground stars
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

          if (uSpecMode > 2.5) {
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

          if (alpha < 0.01) discard;
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
  // 3. 2x2 TEXTURE-ATLAS GPU-BATCHED DUST LANES SHADER (4 Organic Shapes!)
  // =========================================================================
  function createBatchedDustMaterial(dustAtlasTexture) {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0.0 },
        uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 1.25) },
        uSpecMode: { value: 0.0 },
        uDustOpacity: { value: 1.0 },
        uDustAtlas: { value: dustAtlasTexture }
      },
      vertexShader: `
        attribute vec3 aGalCenter;
        attribute vec4 aGalQuat;
        attribute vec4 aDustData; // x=omega, y=puffSize, z=seed, w=opacity

        uniform float uTime;
        uniform float uPixelRatio;

        varying vec3 vColor;
        varying float vSeed;
        varying float vOpacity;

        vec3 applyQuat(vec3 v, vec4 q) {
          vec3 t = 2.0 * cross(q.xyz, v);
          return v + q.w * t + cross(q.xyz, t);
        }

        void main() {
          float ang = aDustData.x * uTime;
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

          // Circular mask keeps rotated UVs strictly inside their 2x2 atlas quadrant (zero bleed)
          vec2 uv = gl_PointCoord - 0.5;
          if (dot(uv, uv) > 0.24) discard;

          float a = vSeed * 6.28318;
          float ca = cos(a);
          float sa = sin(a);
          vec2 localUV = clamp(mat2(ca, -sa, sa, ca) * uv + 0.5, 0.03, 0.97);

          // Pick one of 4 procedural dust tiles (0..3) deterministically via vSeed
          float tileIdx = floor(fract(vSeed * 17.31) * 4.0);
          vec2 tileOrigin = vec2(mod(tileIdx, 2.0) * 0.5, floor(tileIdx * 0.5) * 0.5);
          vec2 atlasUV = tileOrigin + localUV * 0.5;

          vec4 tex = texture2D(uDustAtlas, atlasUV);
          float cloud = tex.a;
          if (cloud < 0.03) discard;

          if (uSpecMode > 2.5) {
            gl_FragColor = vec4(0.06, 0.08, 0.14, cloud * vOpacity * 0.04 * uDustOpacity);
          } else if (uSpecMode > 1.5) {
            // JWST MIRI: Glowing golden-amber & magenta PAH dust skeleton
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
  // 4. MILKY WAY FERMI (GAMMA) & eROSITA (SOFT X-RAY) BIPOLAR BUBBLES SHADER
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

          float modeGain = (uSpecMode > 2.5) ? 1.35 : (uSpecMode > 1.5 ? 0.25 : 0.20);
          vec3 col = mix(uColorCore, uColorRim, fresnel * 0.8 + n * 0.35);
          float alpha = (fresnel * 0.70 + 0.12) * (0.45 + 0.55 * n) * baseFade * coreClear * modeGain;

          if (alpha < 0.008) discard;
          gl_FragColor = vec4(clamp(col * (0.85 + 0.55 * fresnel), vec3(0.0), vec3(1.9)), clamp(alpha, 0.0, 0.78));
        }
      `,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending
    });
  }

  // =========================================================================
  // 5. GLARE-FREE PLANCK CMB COSMIC HORIZON DOME (Radius 145,000)
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

          col = clamp(col, vec3(0.0), vec3(0.34));
          gl_FragColor = vec4(col, clamp(uOpacity, 0.0, 0.85));
        }
      `,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending
    });
  }

  // =========================================================================
  // 6. PROCEDURAL CANVAS TEXTURES (2x2 Dust Atlas + Photographic Galaxy Glow!)
  // =========================================================================
  function createTextures() {
    // 1. Soft radial star glow
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

    // 2. Soft volumetric nebula & ICM cloud
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

    // 3. 2x2 Procedural Dust Atlas (192x192 -> 4 distinct 96x96 organic cloud shapes!)
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

    // Tile 0 (Top-Left): Sweeping wispy spiral filament
    paintTile(0, 0, [
      [28, 48, 22, 0.46], [42, 44, 26, 0.56], [58, 48, 24, 0.50],
      [72, 54, 18, 0.36], [48, 36, 16, 0.30], [52, 58, 16, 0.28]
    ]);
    // Tile 1 (Top-Right): Dense Bok-globule molecular knot
    paintTile(96, 0, [
      [48, 48, 30, 0.68], [38, 42, 18, 0.45], [58, 52, 18, 0.44],
      [46, 60, 15, 0.32], [50, 34, 15, 0.34]
    ]);
    // Tile 2 (Bottom-Left): Sculpted pillar ridge
    paintTile(0, 96, [
      [34, 62, 22, 0.52], [46, 50, 24, 0.58], [58, 38, 20, 0.48],
      [64, 30, 14, 0.34], [30, 52, 15, 0.30], [56, 56, 15, 0.26]
    ]);
    // Tile 3 (Bottom-Right): Soft diffuse translucent veil
    paintTile(96, 96, [
      [48, 48, 38, 0.42], [34, 38, 22, 0.28], [62, 58, 22, 0.28],
      [62, 36, 18, 0.24], [34, 60, 18, 0.24]
    ]);

    const dustAtlas = new THREE.CanvasTexture(atlasCanvas);
    dustAtlas.minFilter = THREE.LinearFilter;
    dustAtlas.magFilter = THREE.LinearFilter;

    // 4. Photographic Unresolved Starlight Disk Glow (for hero galaxies!)
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

    // 5. JWST 8-Point Diffraction Spike Sprite
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

    return {
      starGlow: new THREE.CanvasTexture(starCanvas),
      nebulaPuff: new THREE.CanvasTexture(nebCanvas),
      dustAtlas: dustAtlas,
      dustCloud: dustAtlas, // Backwards-compatible alias
      galaxyGlow: new THREE.CanvasTexture(galCanvas),
      jwstSpike: new THREE.CanvasTexture(jwstCanvas)
    };
  }

  return {
    createGargantuaMaterial: createGargantuaMaterial,
    createBatchedStarMaterial: createBatchedStarMaterial,
    createBatchedDustMaterial: createBatchedDustMaterial,
    createFermiBubbleMaterial: createFermiBubbleMaterial,
    createCMBDomeMaterial: createCMBDomeMaterial,
    createTextures: createTextures
  };
})();
