/* =========================================================================
 * shaders.js — High-Detail Crash-Proof GLSL Shaders (v8 — Volumetric Quasar Jets)
 * Optimized for Integrated Laptop GPUs (ANGLE/D3D11) & Mobile GPUs (FP16)
 * Upgrades in v8:
 *  - New createRelativisticJetMaterial(): Volumetric Fresnel-softened parabolic
 *    plasma jet shader with helical magnetic filaments, travelling recollimation
 *    shock knots, Doppler counter-jet dimming & 5-band spectral modes (0 loops!)
 *  - New createQuasarOutflowMaterial(): Expanding volumetric 3D super-Eddington
 *    quasar wind & Lyman-alpha halo shader (replaces wireframe outflow shells!)
 *  - Retains all v6 upgrades (Gargantua, EHT Radio, 2x2 Dust & Galaxy Atlases)
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
  // 1. GARGANTUA (INTERSTELLAR / EHT 230 GHz) RELATIVISTIC BLACK HOLE SHADER
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
        uSpecMode: { value: 0.0 }, // 0=Optical, 1=NIRCam, 2=MIRI, 3=X-Ray, 4=Radio/EHT
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
          if (uSpecMode > 3.5) {
            // Event Horizon Telescope (EHT) 230 GHz / 1.3 mm synchrotron false-color palette
            vec3 c0 = vec3(0.06, 0.005, 0.00);
            vec3 c1 = vec3(0.78, 0.14, 0.01);
            vec3 c2 = vec3(1.00, 0.56, 0.06);
            vec3 c3 = vec3(1.00, 0.94, 0.62);
            if (t < 0.35) return mix(c0, c1, t / 0.35);
            if (t < 0.82) return mix(c1, c2, (t - 0.35) / 0.47);
            return mix(c2, c3, clamp((t - 0.82) / 0.62, 0.0, 1.0));
          } else if (uSpecMode > 2.5) {
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
            vec3 c0 = vec3(0.22, 0.03, 0.005);
            vec3 c1 = vec3(0.96, 0.31, 0.05) * (0.65 + 0.35 * uDiskTint);
            vec3 c2 = vec3(1.00, 0.80, 0.42);
            vec3 c3 = vec3(0.96, 0.98, 1.00);
            if (t < 0.32) return mix(c0, c1, t / 0.32);
            if (t < 0.76) return mix(c1, c2, (t - 0.32) / 0.44);
            return mix(c2, c3, clamp((t - 0.76) / 0.60, 0.0, 1.0));
          }
        }

        vec4 shadeAccretionHit(vec3 p, vec3 rayDir, float rIn, float rOut, float rs) {
          float r = length(p.xz);
          if (r < rIn * 0.92 || r > rOut) return vec4(0.0);

          float rNorm = clamp((r - rIn) / max(rOut - rIn, 0.001), 0.0, 0.999);
          float innerEdge = smoothstep(rIn * 0.93, rIn + 0.030, r);
          // In Radio/EHT mode, synchrotron emission concentrates tightly near the inner ring!
          float outerCutoff = (uSpecMode > 3.5) ? 0.52 : 1.0;
          float outerEdge = safePow(1.0 - smoothstep(0.20 * outerCutoff, outerCutoff, rNorm), 1.55);

          float omega = 1.25 / safePow(r + 0.13, 1.35);
          float twist = uTime * omega * 0.58 + 6.4 * log(r + 0.075);
          float ct = cos(twist);
          float st = sin(twist);
          vec2 rotXZ = mat2(ct, -st, st, ct) * p.xz;

          float f1 = fbm2D(rotXZ * 7.6 + vec2(uTime * 0.035, -uTime * 0.028));
          float f2 = fbm2D(rotXZ * 18.5 + vec2(f1 * 1.4, -uTime * 0.05));

          float rings = 0.42 + 0.58 * sin(r * 74.0 - uTime * 2.1 + f1 * 6.0);
          float fineStreaks = 0.46 + 0.54 * sin(r * 175.0 + f2 * 8.5);
          float gapMod = 0.68 + 0.32 * cos(r * 34.0 + f1 * 3.8);

          float filament = (0.20 + 0.80 * f1) * (0.52 + 0.48 * f2);
          float density = innerEdge * outerEdge * filament * (0.38 + 0.62 * rings) * (0.62 + 0.38 * fineStreaks) * gapMod;

          float iscoGlow = exp(-rNorm * ((uSpecMode > 3.5) ? 5.0 : 7.2)) * innerEdge * ((uSpecMode > 3.5) ? 1.85 : 1.30);

          vec3 velDir = normalize(vec3(-p.z, 0.0, p.x) + vec3(1e-5, 0.0, 0.0));
          float beta = clamp(sqrt(0.58 * rs / max(r, rs * 1.04)), 0.0, 0.64);
          float cosTheta = dot(velDir, -normalize(rayDir));
          float gamma = inversesqrt(max(1.0 - beta * beta, 0.15));
          float doppler = 1.0 / max(gamma * (1.0 - beta * cosTheta), 0.26);
          float gravShift = sqrt(clamp(1.0 - (rs * 0.90) / max(r, rs * 1.02), 0.16, 1.0));
          float gTotal = clamp(doppler * gravShift, 0.24, 2.55);

          float beaming = mix(1.0, clamp(safePow(gTotal, 3.55), 0.18, 4.2), uSpin * 0.90);
          float colorShift = mix(0.0, (gTotal - 1.0) * 0.62, uSpin);

          float temp = (1.16 * safePow(1.0 - rNorm, 1.28) + iscoGlow * 0.58 + (f2 - 0.5) * 0.30) + colorShift;
          vec3 col = plasmaBlackbody(temp);

          if (gTotal > 1.05 && uSpecMode < 0.5) {
            col = mix(col, vec3(0.90, 0.96, 1.0), clamp((gTotal - 1.05) * 0.78 * uSpin, 0.0, 0.72));
          }

          float radioGain = (uSpecMode > 3.5) ? 1.28 : 1.0;
          float intensity = (density * 1.95 + iscoGlow * 0.92) * beaming * uBrightness * radioGain;
          float alpha = clamp(density * 1.45 + iscoGlow * 0.52, 0.0, 0.96);
          return vec4(col * intensity, alpha);
        }

        vec3 sampleLensedStars(vec3 d) {
          if (uSpecMode > 3.5) return vec3(0.0); // Radio interferometers don't see optical stars
          vec3 nd = normalize(d);
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

          // Multi-Order Photon Ring (boosted into blazing EHT donut in Radio 230 GHz mode!)
          if (!captured) {
            float ringDist = abs(minR - RS * 1.48);
            float ehtRingBoost = (uSpecMode > 3.5) ? 1.85 : 1.0;
            float photonRing = (exp(-ringDist * 76.0) * 1.65 + exp(-ringDist * 16.0) * 0.34 * ehtRingBoost) * ehtRingBoost;
            vec3 ringCol = plasmaBlackbody((uSpecMode > 3.5) ? 1.38 : 1.28);
            accumColor += transmittance * ringCol * photonRing * uBrightness;
            transmittance *= clamp(1.0 - photonRing * 0.48, 0.0, 1.0);

            float bendAmt = clamp(1.0 - dot(dir, rd), 0.0, 1.0);
            if (bendAmt > 0.018) {
              vec3 lensedStar = sampleLensedStars(dir) * smoothstep(0.018, 0.16, bendAmt);
              accumColor += transmittance * lensedStar;
            }
          }

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
  //    Supports 5 Spectral Bands (incl. 21 cm HI & Radio Synchrotron Mode!)
  // =========================================================================
  function createBatchedStarMaterial() {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0.0 },
        uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 1.25) },
        uSpecMode: { value: 0.0 },
        uLodDensity: { value: 0.68 }
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

          if (uSpecMode > 3.5) {
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
  // 3. 2x2 TEXTURE-ATLAS GPU-BATCHED DUST LANES SHADER (Incl. ALMA Sub-mm!)
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
        attribute vec4 aDustData;

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

          if (uSpecMode > 3.5) {
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

          float modeGain = (uSpecMode > 3.5)
            ? (uIsErosita > 0.5 ? 0.18 : 0.92) // Inner Fermi lobes glow as Planck Microwave Haze!
            : ((uSpecMode > 2.5) ? 1.35 : (uSpecMode > 1.5 ? 0.25 : 0.20));

          vec3 baseCol = (uSpecMode > 3.5)
            ? mix(vec3(0.86, 0.28, 0.04), vec3(1.0, 0.72, 0.22), fresnel * 0.8 + n * 0.3)
            : mix(uColorCore, uColorRim, fresnel * 0.8 + n * 0.35);

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
          float radioBoost = (uSpecMode > 3.5) ? 1.42 : 1.0;
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
          if (uSpecMode > 3.5) {
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

          if (uSpecMode > 3.5) {
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

          if (uSpecMode > 3.5) {
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
            // Optical HDR: Crisp & subtle against pitch-black space (stays strictly below bloom!)
            vec3 zWarm = mix(vec3(1.0, 0.84, 0.66), vec3(0.95, 0.56, 0.36), vRedshift);
            vec3 base = tex.rgb * mix(vColor, zWarm, vRedshift * 0.64);
            col = clamp(base * 0.76, vec3(0.0), vec3(0.76));
            alpha = mask * vFade * uFieldOpacity * mix(0.62, 0.36, vRedshift);
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
          float knot1 = exp(-safePow((k1 - 0.5) * 8.5, 2.0)) * smoothstep(0.05, 0.22, y) * (1.0 - smoothstep(0.75, 0.98, y));
          float k2 = fract(y * 5.8 - flow * 0.42 + 0.37);
          float knot2 = exp(-safePow((k2 - 0.5) * 10.5, 2.0)) * 0.65 * (1.0 - y);
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

          if (uSpecMode > 3.5) {
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
          if (uSpecMode > 3.5) {
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

    return {
      starGlow: new THREE.CanvasTexture(starCanvas),
      nebulaPuff: new THREE.CanvasTexture(nebCanvas),
      dustAtlas: dustAtlas,
      dustCloud: dustAtlas,
      galaxyGlow: new THREE.CanvasTexture(galCanvas),
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
    createTextures: createTextures
  };
})();
