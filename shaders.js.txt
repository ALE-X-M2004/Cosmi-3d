/* =========================================================================
 * shaders.js — Custom GLSL Shaders & Procedural Textures for Cosmos 3D
 * Mobile-Safe Edition: highp precision + NaN-proof safePow() + HDR clamps
 * Compatible with Three.js r128 (WebGL 1 / GLSL ES 1.00 — Mobile & Desktop)
 * ========================================================================= */

window.CosmosShaders = (function () {
  'use strict';

  // Precision header: forces FP32 on mobile GPUs (Mali/Adreno) to prevent FP16 NaN bloom blowouts
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

  // Shared 3D Value Noise & FBM chunk (seam-free, GLSL ES 1.00 safe)
  const GLSL_NOISE_3D = `
    float hash31(vec3 p) {
      p = fract(p * 0.1031);
      p += dot(p, p.yzx + 33.33);
      return fract((p.x + p.y) * p.z);
    }

    float noise3D(vec3 x) {
      vec3 i = floor(x);
      vec3 f = fract(x);
      f = f * f * (3.0 - 2.0 * f);

      float n000 = hash31(i + vec3(0.0, 0.0, 0.0));
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

      float nxy0 = mix(nx00, nx10, f.y);
      float nxy1 = mix(nx01, nx11, f.y);

      return mix(nxy0, nxy1, f.z);
    }

    float fbm3D(vec3 p) {
      float v = 0.0;
      float amp = 0.5;
      for (int i = 0; i < 4; i++) {
        v += amp * noise3D(p);
        p = p * 2.03 + vec3(17.1, 31.7, 11.3);
        amp *= 0.5;
      }
      return v;
    }
  `;

  // 2D Noise for point sprites & accretion disk filaments
  const GLSL_NOISE_2D = `
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
      float v = 0.0;
      float amp = 0.5;
      mat2 rot = mat2(0.80, -0.60, 0.60, 0.80);
      for (int i = 0; i < 4; i++) {
        v += amp * noise2D(p);
        p = rot * p * 2.05 + vec2(13.7, 29.3);
        amp *= 0.5;
      }
      return v;
    }
  `;

  // =========================================================================
  // 1. GARGANTUA (INTERSTELLAR-GRADE) RAY-MARCHED RELATIVISTIC BLACK HOLE
  //    NaN-safe, curved null geodesics, Doppler beaming, photon ring & lensed stars
  // =========================================================================
  function createGargantuaMaterial(options) {
    const opts = options || {};
    const diskTint = opts.diskTint ? new THREE.Color(opts.diskTint) : new THREE.Color(0xffb463);

    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0.0 },
        uCamLocal: { value: new THREE.Vector3(0.0, 0.3, 1.8) },
        uSpin: { value: opts.spin !== undefined ? opts.spin : 0.85 },
        uSpecMode: { value: 0.0 }, // 0=Optical, 1=NIRCam, 2=MIRI, 3=X-Ray
        uDiskTint: { value: diskTint },
        uBrightness: { value: opts.brightness !== undefined ? opts.brightness : 1.25 }
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

        ${GLSL_NOISE_2D}

        // Blackbody-inspired plasma color ramp (temp in 0..1.5)
        vec3 plasmaBlackbody(float temp) {
          float t = clamp(temp, 0.0, 1.5);
          if (uSpecMode > 2.5) {
            vec3 c1 = vec3(0.18, 0.06, 0.48);
            vec3 c2 = vec3(0.28, 0.62, 1.00);
            vec3 c3 = vec3(0.92, 0.98, 1.00);
            return t < 0.6 ? mix(c1, c2, t / 0.6) : mix(c2, c3, clamp((t - 0.6) / 0.7, 0.0, 1.0));
          } else if (uSpecMode > 1.5) {
            vec3 c1 = vec3(0.45, 0.05, 0.18);
            vec3 c2 = vec3(1.00, 0.38, 0.14);
            vec3 c3 = vec3(1.00, 0.84, 0.62);
            return t < 0.6 ? mix(c1, c2, t / 0.6) : mix(c2, c3, clamp((t - 0.6) / 0.7, 0.0, 1.0));
          } else if (uSpecMode > 0.5) {
            vec3 c1 = vec3(0.65, 0.22, 0.06);
            vec3 c2 = vec3(1.00, 0.72, 0.36);
            vec3 c3 = vec3(0.84, 0.94, 1.00);
            return t < 0.6 ? mix(c1, c2, t / 0.6) : mix(c2, c3, clamp((t - 0.6) / 0.7, 0.0, 1.0));
          } else {
            // Interstellar / Stargaze warm fiery orange -> blazing gold -> white-hot approaching core
            vec3 c0 = vec3(0.28, 0.04, 0.008);
            vec3 c1 = vec3(0.96, 0.35, 0.06) * (0.65 + 0.35 * uDiskTint);
            vec3 c2 = vec3(1.00, 0.82, 0.46);
            vec3 c3 = vec3(0.95, 0.98, 1.00);
            if (t < 0.35) return mix(c0, c1, t / 0.35);
            if (t < 0.80) return mix(c1, c2, (t - 0.35) / 0.45);
            return mix(c2, c3, clamp((t - 0.80) / 0.55, 0.0, 1.0));
          }
        }

        // Sample swirling differentially-rotating accretion disk at equatorial point p
        vec4 sampleAccretionDisk(vec3 p, vec3 rayDir, float rIn, float rOut, float rs) {
          float r = length(p.xz);
          if (r < rIn * 0.92 || r > rOut) return vec4(0.0);

          float rNorm = clamp((r - rIn) / max(rOut - rIn, 0.001), 0.0, 0.999);

          float innerEdge = smoothstep(rIn * 0.94, rIn + 0.038, r);
          float outerEdge = safePow(1.0 - smoothstep(0.42, 1.0, rNorm), 1.65);

          // Seam-free spiral Keplerian shear in rotated Cartesian coords
          float omega = 1.25 / safePow(r + 0.14, 1.35);
          float twist = uTime * omega * 0.62 + 5.6 * log(r + 0.08);
          float ct = cos(twist);
          float st = sin(twist);
          vec2 rotXZ = mat2(ct, -st, st, ct) * p.xz;

          // Concentric Saturn-like plasma lanes + turbulent FBM wisps
          float f1 = fbm2D(rotXZ * 7.5 + vec2(uTime * 0.04, -uTime * 0.03));
          float f2 = fbm2D(rotXZ * 17.0 - vec2(uTime * 0.09, uTime * 0.06));
          float rings = 0.48 + 0.52 * sin(r * 64.0 - uTime * 2.0 + f1 * 5.2);
          float fineStreaks = 0.52 + 0.48 * sin(r * 145.0 + f2 * 7.0);

          float density = innerEdge * outerEdge * (0.25 + 0.75 * f1) * (0.42 + 0.58 * rings) * (0.68 + 0.32 * fineStreaks);
          float iscoGlow = exp(-rNorm * 6.8) * innerEdge * 1.15;

          // Relativistic Doppler Beaming (prograde rotation in XZ plane)
          vec3 velDir = normalize(vec3(-p.z, 0.0, p.x) + vec3(1e-5, 0.0, 0.0));
          float beta = clamp(sqrt(0.55 * rs / max(r, rs * 1.05)), 0.0, 0.62);
          float cosTheta = dot(velDir, -normalize(rayDir));
          float gamma = inversesqrt(max(1.0 - beta * beta, 0.15));
          float doppler = 1.0 / max(gamma * (1.0 - beta * cosTheta), 0.28);

          // Gravitational redshift sqrt(1 - rs / r)
          float gravShift = sqrt(clamp(1.0 - (rs * 0.90) / max(r, rs * 1.02), 0.16, 1.0));
          float gTotal = clamp(doppler * gravShift, 0.25, 2.4);

          float beaming = mix(1.0, clamp(safePow(gTotal, 3.3), 0.20, 3.8), uSpin * 0.88);
          float colorShift = mix(0.0, (gTotal - 1.0) * 0.52, uSpin);

          float temp = (1.16 * safePow(1.0 - rNorm, 1.35) + iscoGlow * 0.55 + (f2 - 0.5) * 0.24) + colorShift;
          vec3 col = plasmaBlackbody(temp);

          if (gTotal > 1.06 && uSpecMode < 0.5) {
            col = mix(col, vec3(0.88, 0.95, 1.0), clamp((gTotal - 1.06) * 0.72 * uSpin, 0.0, 0.62));
          }

          float intensity = (density * 1.65 + iscoGlow * 0.85) * beaming * uBrightness;
          float alpha = clamp(density * 1.25 + iscoGlow * 0.42, 0.0, 0.94);

          return vec4(col * intensity, alpha);
        }

        // Gravitationally lensed subtle Einstein-ring background stars along deflected exit ray
        vec3 sampleLensedStars(vec3 d) {
          vec3 p = normalize(d) * 58.0;
          vec3 cell = floor(p);
          vec3 f = fract(p) - 0.5;
          float h = hash21(cell.xy + cell.z * 37.13);
          if (h < 0.972) return vec3(0.0);
          float dist2 = dot(f, f);
          float star = exp(-dist2 * 52.0) * smoothstep(0.972, 1.0, h);
          vec3 tint = mix(vec3(0.75, 0.88, 1.0), vec3(1.0, 0.85, 0.68), fract(h * 91.7));
          return tint * star * 1.1;
        }

        void main() {
          const float RS = 0.095;
          float rIn = mix(2.55 * RS, 1.58 * RS, uSpin);
          const float rOut = 0.85;

          vec3 ro = uCamLocal;
          vec3 rd = normalize(vLocalPos - uCamLocal);

          float b = dot(ro, rd);
          float c = dot(ro, ro) - 1.0;
          float disc = b * b - c;
          if (disc < 0.0) discard;

          float tNear = max(0.0, -b - sqrt(max(disc, 0.0)));
          vec3 pos = ro + rd * tNear;
          vec3 dir = rd;

          vec3 accumColor = vec3(0.0);
          float transmittance = 1.0;
          bool captured = false;
          float minR = 10.0;
          int diskCrossings = 0;

          const int MAX_STEPS = 78;
          for (int i = 0; i < MAX_STEPS; i++) {
            float r2 = dot(pos, pos);
            float r = sqrt(max(r2, 1e-6));
            minR = min(minR, r);

            if (r < RS * 1.03) {
              captured = true;
              break;
            }

            if (r > 1.04 && dot(pos, dir) > 0.0) {
              break;
            }

            float planeProx = clamp(abs(pos.y) * 2.8 + 0.35, 0.35, 1.0);
            float dt = clamp(r * 0.092 * planeProx, 0.012, 0.056);

            vec3 hVec = cross(pos, dir);
            float h2 = dot(hVec, hVec);
            vec3 accel = -1.5 * RS * h2 * pos / max(r2 * r2 * r, 1e-5);

            vec3 drag = cross(vec3(0.0, 1.0, 0.0), pos) * (uSpin * 0.16 * RS * RS / max(r2 * r, 1e-5));

            vec3 prevPos = pos;
            dir = normalize(dir + (accel + drag) * dt);
            pos += dir * dt;

            // Analytic Equatorial Plane Crossing (Primary + Warped Secondary Arches)
            if ((prevPos.y > 0.0 && pos.y <= 0.0) || (prevPos.y < 0.0 && pos.y >= 0.0)) {
              float frac = abs(prevPos.y) / max(abs(prevPos.y) + abs(pos.y), 1e-6);
              vec3 hit = mix(prevPos, pos, frac);
              vec4 dSample = sampleAccretionDisk(hit, dir, rIn, rOut, RS);
              if (dSample.a > 0.002) {
                float orderBoost = (diskCrossings > 0) ? 1.15 : 1.0;
                accumColor += transmittance * dSample.rgb * dSample.a * orderBoost;
                transmittance *= (1.0 - dSample.a * 0.82);
                diskCrossings++;
                if (transmittance < 0.02) break;
              }
            }

            // Volumetric Edge-On Disk Corona
            float rXZ = length(pos.xz);
            float diskThickness = 0.015 + 0.038 * clamp((rXZ - rIn) / max(rOut - rIn, 0.01), 0.0, 1.0);
            if (abs(pos.y) < diskThickness && rXZ > rIn * 0.88 && rXZ < rOut * 0.96) {
              float vRatio = pos.y / max(diskThickness, 0.001);
              float vFalloff = exp(-vRatio * vRatio * 3.2);
              float rFalloff = smoothstep(rIn * 0.88, rIn + 0.05, rXZ) * (1.0 - smoothstep(rOut * 0.55, rOut * 0.96, rXZ));
              vec3 coronaCol = plasmaBlackbody(0.86 * (1.0 - (rXZ - rIn) / rOut) + 0.14);
              float stepEmit = vFalloff * rFalloff * dt * 1.9 * uBrightness;
              accumColor += transmittance * coronaCol * stepEmit;
              transmittance *= clamp(1.0 - stepEmit * 0.35, 0.0, 1.0);
            }
          }

          // Razor-Sharp Photon Ring & Einstein-Lensed Star Sparkles around the Shadow
          if (!captured) {
            float ringDist = abs(minR - RS * 1.48);
            float photonRing = exp(-ringDist * 62.0) * 1.35 + exp(-ringDist * 19.0) * 0.24;
            vec3 ringCol = plasmaBlackbody(1.20);
            accumColor += transmittance * ringCol * photonRing * uBrightness;
            transmittance *= clamp(1.0 - photonRing * 0.45, 0.0, 1.0);

            // Subtle gravitationally bent background stars near Einstein ring
            float bendAmt = clamp(1.0 - dot(dir, rd), 0.0, 1.0);
            if (bendAmt > 0.025) {
              vec3 lensedStar = sampleLensedStars(dir) * smoothstep(0.025, 0.22, bendAmt);
              accumColor += transmittance * lensedStar;
            }
          }

          // Strict HDR safety clamp prevents mobile bloom blowout
          accumColor = clamp(accumColor, vec3(0.0), vec3(3.8));

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
  // 2. GPU-BATCHED GALAXY STARS SHADER (1 Draw Call for 229 Galaxies)
  // =========================================================================
  function createBatchedStarMaterial() {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0.0 },
        uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 1.5) },
        uSpecMode: { value: 0.0 }
      },
      vertexShader: `
        attribute vec3 aGalCenter;
        attribute vec4 aGalQuat;
        attribute vec4 aStarData; // x=omega, y=size, z=spectral(0=O/B..1=M), w=kind(0=star,1=HII,2=spikeStar)

        uniform float uTime;
        uniform float uPixelRatio;
        uniform float uSpecMode;

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

          vColor = color;
          vKind = aStarData.w;
          vSpectral = aStarData.z;

          float sizeBoost = 1.0;
          if (uSpecMode > 0.5 && uSpecMode < 1.5 && vKind > 1.5) {
            sizeBoost = 2.1;
          } else if (uSpecMode > 1.5 && uSpecMode < 2.5 && vKind > 0.5 && vKind < 1.5) {
            sizeBoost = 1.45;
          }

          float rawSize = aStarData.y * sizeBoost * uPixelRatio * (285.0 / dist);
          float maxSz = (vKind > 0.5) ? 48.0 : 24.0;
          gl_PointSize = clamp(rawSize, 1.15, maxSz);

          vDistFade = clamp(rawSize / 1.35, 0.38, 1.0);
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
          vec2 uv = gl_PointCoord - 0.5;
          float r = length(uv);
          if (r > 0.5) discard;

          float core = exp(-r * r * 26.0);
          float halo = exp(-r * 6.2) * 0.42;
          float shape = core + halo;

          if (vKind > 0.5 && vKind < 1.5) {
            shape = exp(-r * r * 10.5) * 0.52;
          }

          if (uSpecMode > 0.5 && uSpecMode < 1.5 && vKind > 1.5) {
            float s1 = exp(-abs(uv.y) * 58.0) * exp(-abs(uv.x) * 4.5);
            vec2 r60 = vec2(uv.x * 0.5 - uv.y * 0.866, uv.x * 0.866 + uv.y * 0.5);
            vec2 r120 = vec2(uv.x * 0.5 + uv.y * 0.866, -uv.x * 0.866 + uv.y * 0.5);
            float s2 = exp(-abs(r60.y) * 62.0) * exp(-abs(r60.x) * 5.0);
            float s3 = exp(-abs(r120.y) * 62.0) * exp(-abs(r120.x) * 5.0);
            float s4 = exp(-abs(uv.x) * 75.0) * exp(-abs(uv.y) * 10.0) * 0.45;
            shape += (s1 + s2 + s3 + s4) * 0.72;
          }

          vec3 col = vColor;
          float alpha = shape * vDistFade;

          if (uSpecMode > 2.5) {
            float hotFactor = mix(0.62, 0.14, vSpectral);
            col = mix(vec3(0.45, 0.72, 1.0), vec3(0.62, 0.35, 1.0), vSpectral);
            alpha *= hotFactor;
          } else if (uSpecMode > 1.5) {
            if (vKind > 0.5 && vKind < 1.5) {
              col = vec3(1.0, 0.25, 0.62) * 1.25;
              alpha *= 0.85;
            } else {
              col = mix(vec3(0.35, 0.55, 0.95), vec3(1.0, 0.65, 0.28), vSpectral);
              alpha *= mix(0.24, 0.75, vSpectral);
            }
          } else if (uSpecMode > 0.5) {
            col = mix(col, col * vec3(1.12, 1.02, 0.88), 0.38);
            alpha *= 1.05;
          }

          if (alpha < 0.01) discard;
          gl_FragColor = vec4(clamp(col * 1.12, vec3(0.0), vec3(2.2)), clamp(alpha, 0.0, 1.0));
        }
      `,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
  }

  // =========================================================================
  // 3. GPU-BATCHED INTERSTELLAR DUST LANES SHADER (1 Draw Call)
  // =========================================================================
  function createBatchedDustMaterial() {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0.0 },
        uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 1.5) },
        uSpecMode: { value: 0.0 },
        uDustOpacity: { value: 1.0 }
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
          vOpacity = aDustData.w;

          gl_PointSize = clamp(aDustData.y * uPixelRatio * (275.0 / dist), 1.5, 92.0);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        ${GLSL_PREC}

        uniform float uSpecMode;
        uniform float uDustOpacity;

        varying vec3 vColor;
        varying float vSeed;
        varying float vOpacity;

        ${GLSL_NOISE_2D}

        void main() {
          vec2 uv = gl_PointCoord - 0.5;
          float r = length(uv);
          if (r > 0.5) discard;

          float a = vSeed * 6.28318;
          float ca = cos(a);
          float sa = sin(a);
          vec2 ruv = mat2(ca, -sa, sa, ca) * uv;

          float n = fbm2D(ruv * 5.2 + vec2(vSeed * 19.3, vSeed * 7.1));
          float radial = smoothstep(0.5, 0.08, r);
          float cloud = radial * smoothstep(0.24, 0.78, n);

          if (cloud < 0.02) discard;

          if (uSpecMode > 2.5) {
            gl_FragColor = vec4(0.06, 0.08, 0.14, cloud * vOpacity * 0.04 * uDustOpacity);
          } else if (uSpecMode > 1.5) {
            float ridge = smoothstep(0.32, 0.72, n);
            vec3 pahCol = mix(vec3(1.0, 0.44, 0.10), vec3(1.0, 0.16, 0.60), fract(vSeed * 3.7 + n * 0.5));
            gl_FragColor = vec4(pahCol * (0.95 + 0.55 * ridge), cloud * vOpacity * 0.70 * uDustOpacity);
          } else if (uSpecMode > 0.5) {
            vec3 irCol = vec3(0.42, 0.17, 0.08);
            gl_FragColor = vec4(irCol, cloud * vOpacity * 0.28 * uDustOpacity);
          } else {
            vec3 darkDust = vColor * (0.14 + 0.12 * n);
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
  //    NaN-proof Fresnel (fixes FP16 dot(N,V) > 1.0 white-screen bug on Mali!)
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

        ${GLSL_NOISE_3D}

        void main() {
          vec3 toCam = cameraPosition - vWorldPos;
          float camLen = length(toCam);
          if (camLen < 0.001) discard;

          vec3 V = toCam / camLen;
          vec3 N = normalize(vNormalWorld);

          // Strict clamp prevents 1.0 - dot > 0 underflow / NaN on mobile FP16 GPUs
          float ndotv = clamp(abs(dot(N, V)), 0.0, 0.9995);
          float fresnel = safePow(1.0 - ndotv, uIsErosita > 0.5 ? 2.4 : 1.9);

          float flowSign = vLocalPos.y >= 0.0 ? -1.0 : 1.0;
          vec3 sampleP = vLocalPos * 0.045 + vec3(0.0, flowSign * uTime * 0.14, 0.0);
          float n = fbm3D(sampleP);

          float baseFade = smoothstep(1.5, 16.0, abs(vLocalPos.y));

          // Fade out smoothly when camera is deep inside Galactic Core observing Sgr A*
          float coreClear = smoothstep(8.0, 28.0, length(cameraPosition));

          float modeGain = (uSpecMode > 2.5) ? 1.40 : (uSpecMode > 1.5 ? 0.26 : 0.22);
          vec3 col = mix(uColorCore, uColorRim, fresnel * 0.8 + n * 0.35);
          float alpha = (fresnel * 0.72 + 0.14) * (0.45 + 0.55 * n) * baseFade * coreClear * modeGain;

          if (alpha < 0.008) discard;
          gl_FragColor = vec4(clamp(col * (0.85 + 0.60 * fresnel), vec3(0.0), vec3(2.2)), clamp(alpha, 0.0, 0.80));
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

        ${GLSL_NOISE_3D}

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
  // 6. PROCEDURAL CANVAS SPRITE TEXTURES (Zero External Assets)
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
