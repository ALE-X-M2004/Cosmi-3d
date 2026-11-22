/* =========================================================================
 * catalog.js — Astrophysical Data Catalog for Cosmos 3D (HDR GPU Edition)
 * Scale: Milky Way disk radius ~62 units (~52,000 ly); compressed log-tier
 *        spacing for Local Group, Galaxy Clusters, Laniakea, Quipu & CMB.
 * ========================================================================= */

window.CosmosCatalog = (function () {
  'use strict';

  // -------------------------------------------------------------------------
  // 1. RAY-MARCHED RELATIVISTIC SUPERMASSIVE BLACK HOLES (Gargantua Engine)
  // -------------------------------------------------------------------------
  const BLACK_HOLES = [
    {
      id: 'sgra',
      name: 'Sagittarius A*',
      shortName: 'Sgr A*',
      pos: [0, 0, 0],
      sphereRadius: 2.35,
      tilt: [0.24, 0.0, 0.14], // Slight inclination for cinematic Interstellar arches
      spin: 0.85,
      diskTint: 0xffb463,
      brightness: 1.32,
      hasJet: false,
      camOffset: [0.0, 0.65, 3.85],
      badge: 'Kerr SMBH • Gargantua Engine',
      cls: '4.154 × 10⁶ M☉',
      radius: '0.00 kpc (Origin)',
      vel: 'ISCO ≈ 0.5c',
      sector: 'Galactic Core',
      desc: 'Milky Way central supermassive black hole rendered via curved-spacetime geodesic ray-marching, bending the far accretion disk over and under the shadow.'
    },
    {
      id: 'm31bh',
      name: 'M31* (Andromeda Core)',
      shortName: 'M31*',
      pos: [340, 68, -420],
      sphereRadius: 3.1,
      tilt: [0.58, 0.25, -0.35],
      spin: 0.78,
      diskTint: 0x9ec5ff,
      brightness: 1.15,
      hasJet: false,
      camOffset: [0.0, 1.1, 5.2],
      badge: 'Ultra-Massive BH • Double Nucleus',
      cls: '1.4 × 10⁸ M☉',
      radius: '2.54 Mly',
      vel: '-301 km/s (Approaching)',
      sector: 'Local Group',
      desc: 'Andromeda’s central black hole—over 30× more massive than Sgr A*—embedded inside an eccentric double-peaked nuclear star disk (P1/P2).'
    },
    {
      id: 'm87bh',
      name: 'M87* (Powehi)',
      shortName: 'M87*',
      pos: [-680, 110, -1550],
      sphereRadius: 5.8,
      tilt: [0.32, 0.0, -0.42],
      spin: 0.92,
      diskTint: 0xff8b3d,
      brightness: 1.45,
      hasJet: true,
      jetLength: 92,
      jetColor: 0x60a5fa,
      camOffset: [0.0, 2.2, 10.5],
      badge: 'EHT Imaged SMBH • Relativistic Jet',
      cls: '6.5 × 10⁹ M☉',
      radius: '53.5 Mly',
      vel: 'Jet ≈ 0.99c',
      sector: 'Virgo Cluster Core',
      desc: 'First black hole ever directly imaged by the Event Horizon Telescope, launching a 5,000-light-year collimated synchrotron plasma jet.'
    },
    {
      id: 'm104bh',
      name: 'M104* (Sombrero SMBH)',
      shortName: 'M104*',
      pos: [520, -180, -860],
      sphereRadius: 3.6,
      tilt: [0.16, 0.0, 0.08],
      spin: 0.80,
      diskTint: 0xffc478,
      brightness: 1.20,
      hasJet: false,
      camOffset: [0.0, 1.0, 6.2],
      badge: 'Billion-Solar-Mass SMBH',
      cls: '1.0 × 10⁹ M☉',
      radius: '31.1 Mly',
      vel: '1,024 km/s',
      sector: 'Virgo II Groups',
      desc: 'One of the most massive black holes in the nearby universe, residing inside the luminous golden bulge of the Sombrero Galaxy.'
    }
  ];

  // -------------------------------------------------------------------------
  // 2. EXTREME INNER S-STARS (Live Relativistic Rosette Precession)
  // -------------------------------------------------------------------------
  const S_STARS = [
    {
      id: 's2',
      name: 'S2 (S0-2)',
      a: 4.9,
      e: 0.884,
      inc: 0.62,
      Omega: 0.4,
      omega0: 0.25,
      period: 16.05,
      precessionRate: 0.095,
      color: 0x93c5fd,
      size: 0.17,
      badge: 'B0V Star • Schwarzschild Precession',
      cls: '13.6 M☉ • B0V',
      radius: '120 AU (Pericenter)',
      vel: '7,650 km/s (2.55% c)',
      sector: 'Sgr A* Nuclear Cluster',
      desc: 'Flagship S-star whose 16-year orbit confirmed Einstein’s gravitational redshift and general-relativistic Schwarzschild rosette precession.'
    },
    {
      id: 's4716',
      name: 'S4716',
      a: 3.35,
      e: 0.756,
      inc: -0.95,
      Omega: 1.85,
      omega0: 1.1,
      period: 4.02,
      precessionRate: 0.16,
      color: 0x67e8f9,
      size: 0.14,
      badge: 'Record Short-Period S-Star',
      cls: '~4 M☉ • B-type',
      radius: '98 AU (Pericenter)',
      vel: '8,000 km/s (2.7% c)',
      sector: 'Sgr A* Nuclear Cluster',
      desc: 'Fastest known stable orbit around Sagittarius A*, completing a full revolution in just 4.0 years while grazing within 100 AU of the event horizon.'
    },
    {
      id: 's4714',
      name: 'S4714',
      a: 5.7,
      e: 0.965, // Slightly softened visually from 0.985 so periapsis stays cleanly outside RS
      inc: 1.12,
      Omega: 3.4,
      omega0: -0.6,
      period: 12.0,
      precessionRate: 0.22,
      color: 0xfde047,
      size: 0.14,
      badge: 'Extreme Eccentricity S-Star',
      cls: '~2 M☉ • Squeezar',
      radius: '12.6 AU (Pericenter)',
      vel: '24,000 km/s (8% c)',
      sector: 'Sgr A* Nuclear Cluster',
      desc: 'Plunges on a razor-thin e ≈ 0.985 trajectory reaching ~8% the speed of light at periapsis, experiencing intense relativistic tidal heating.'
    }
  ];

  // -------------------------------------------------------------------------
  // 3. MILKY WAY & LMC LANDMARK STARS (23 Iconic Stars)
  // -------------------------------------------------------------------------
  const LANDMARK_STARS = [
    {
      id: 'sol', name: 'Sol (Solar System)', pos: [26.0, 0.35, 3.2], color: 0xfff3a8, size: 1.15, isSol: true,
      badge: 'G2V Main Sequence • Home', cls: '1.00 M☉ • G2V', radius: '8.18 kpc (26,670 ly)', vel: '230 km/s (Galactic)', sector: 'Orion-Cygnus Spur',
      desc: 'Our Sun, orbiting the Milky Way center once every ~230 million years along the inner edge of the Orion Spur.'
    },
    {
      id: 'alphacen', name: 'Alpha & Proxima Centauri', pos: [25.6, 0.28, 3.6], color: 0xffe4a0, size: 0.72,
      badge: 'Nearest Star System', cls: 'G2V + K1V + M5.5Ve', radius: '4.24 ly from Sol', vel: '229 km/s', sector: 'Local Interstellar Cloud',
      desc: 'Triple star system closest to the Sun, home to red dwarf Proxima Centauri and temperate exoplanet Proxima b.'
    },
    {
      id: 'sirius', name: 'Sirius A & B', pos: [26.8, 0.15, 2.7], color: 0xdbeafe, size: 0.92,
      badge: 'Brightest Night-Sky Star', cls: 'A1V + DA2 White Dwarf', radius: '8.60 ly from Sol', vel: '225 km/s', sector: 'Orion Spur',
      desc: 'Binary system pairing a dazzling blue-white main-sequence star with Sirius B, a dense Earth-sized white dwarf.'
    },
    {
      id: 'barnards', name: 'Barnard’s Star', pos: [25.4, 0.55, 2.9], color: 0xff7b4a, size: 0.58,
      badge: 'High Proper-Motion Red Dwarf', cls: '0.16 M☉ • M4Ve', radius: '5.96 ly from Sol', vel: '142 km/s (Space)', sector: 'Local Bubble',
      desc: 'Ancient 10-billion-year-old red dwarf racing across Earth’s sky faster than any other known star.'
    },
    {
      id: 'vega', name: 'Vega (α Lyrae)', pos: [24.8, 0.9, 5.2], color: 0xbfdbfe, size: 0.85,
      badge: 'Rapid Rotator • Photometric Zero', cls: '2.1 M☉ • A0Va', radius: '25.0 ly from Sol', vel: '232 km/s', sector: 'Orion Spur',
      desc: 'Rapidly spinning blue-white star flattened at its poles, surrounded by a dusty debris disk and future North Star (~13,700 CE).'
    },
    {
      id: 'arcturus', name: 'Arcturus (α Boötis)', pos: [23.9, 2.1, 4.1], color: 0xffb36b, size: 0.95,
      badge: 'Thick-Disk Halo Giant', cls: '1.08 M☉ • K1.5III', radius: '36.7 ly from Sol', vel: '122 km/s (Relative)', sector: 'Arcturus Stream',
      desc: 'Brightest star in the northern celestial hemisphere—an ancient orange giant plunging steeply through the Galactic plane.'
    },
    {
      id: 'aldebaran', name: 'Aldebaran (α Tauri)', pos: [27.5, -0.35, 2.1], color: 0xff9f55, size: 0.92,
      badge: 'Red Giant • Eye of Taurus', cls: '1.16 M☉ • K5+III', radius: '65.3 ly from Sol', vel: '234 km/s', sector: 'Orion Spur',
      desc: 'Swollen 44-solar-radius orange giant lying in the foreground of the Hyades open star cluster.'
    },
    {
      id: 'canopus', name: 'Canopus (α Carinae)', pos: [27.4, -1.6, -1.2], color: 0xf0f7ff, size: 1.05,
      badge: 'Bright Supergiant', cls: '8.0 M☉ • A9II', radius: '310 ly from Sol', vel: '226 km/s', sector: 'Carina-Sagittarius Edge',
      desc: 'Second-brightest star in Earth’s night sky (~10,700 L☉), widely used as a primary attitude-reference star for deep-space probes.'
    },
    {
      id: 'polaris', name: 'Polaris (North Star)', pos: [28.4, 2.2, 6.0], color: 0xfff5cc, size: 0.95,
      badge: 'Classical Cepheid Triple', cls: '5.4 M☉ • F7Ib', radius: '433 ly from Sol', vel: '227 km/s', sector: 'Orion Spur',
      desc: 'Pulsating yellow supergiant anchoring the cosmic distance ladder and sitting less than 1° from Earth’s north rotational pole.'
    },
    {
      id: 'antares', name: 'Antares (α Scorpii)', pos: [21.6, 0.85, -1.8], color: 0xff5a36, size: 1.25,
      badge: 'Red Supergiant • Heart of Scorpius', cls: '12 M☉ • M1.5Iab', radius: '550 ly from Sol', vel: '222 km/s', sector: 'Scorpius-Centaurus Assoc.',
      desc: 'Colossal ~680 R☉ red supergiant shedding a huge dusty envelope illuminated by its hot blue companion Antares B.'
    },
    {
      id: 'betelgeuse', name: 'Betelgeuse (α Orionis)', pos: [29.2, -0.5, 1.4], color: 0xff6b3d, size: 1.32,
      badge: 'Red Supergiant • Pre-Supernova', cls: '16.5 M☉ • M1-2Ia', radius: '548 ly from Sol', vel: '30 km/s (Runaway)', sector: 'Orion Spur',
      desc: 'Boiling convective red supergiant famous for its 2019–2020 Great Dimming dust ejection; destined to explode within ~100,000 years.'
    },
    {
      id: 'rigel', name: 'Rigel (β Orionis)', pos: [30.1, -1.1, 0.4], color: 0x93c5fd, size: 1.22,
      badge: 'Blue Supergiant', cls: '21 M☉ • B8Ia', radius: '863 ly from Sol', vel: '224 km/s', sector: 'Orion OB1',
      desc: '120,000-solar-luminosity blue supergiant lighting up the nearby Witch Head reflection nebula.'
    },
    {
      id: 'vela', name: 'Vela Pulsar (PSR B0833-45)', pos: [27.9, -0.45, -3.5], color: 0x38bdf8, size: 0.88, isPulsar: true,
      badge: 'Gamma-Ray Neutron Star', cls: '1.4 M☉ • 11.2 Hz Spin', radius: '936 ly from Sol', vel: '61 km/s (Kick)', sector: 'Gum Nebula',
      desc: 'Young 11,000-year-old pulsar spinning 11 times per second, driving a glowing X-ray pulsar wind nebula.'
    },
    {
      id: 'deneb', name: 'Deneb (α Cygni)', pos: [26.4, 0.65, 12.2], color: 0xdbeafe, size: 1.18,
      badge: 'Luminous Blue-White Supergiant', cls: '19 M☉ • A2Ia', radius: '2,615 ly from Sol', vel: '231 km/s', sector: 'Cygnus OB7',
      desc: 'One of the most luminous stars visible to the naked eye (~196,000 L☉), anchoring the Northern Cross.'
    },
    {
      id: 'vycma', name: 'VY Canis Majoris', pos: [31.5, -0.75, -5.8], color: 0xff4d29, size: 1.38,
      badge: 'Extreme Red Hypergiant', cls: '17 M☉ • 1,420 R☉', radius: '3,900 ly from Sol', vel: '228 km/s', sector: 'Outer Orion Spur',
      desc: 'Enormous unstable hypergiant ejecting massive arcs and knots of dusty gas in violent convective outbursts.'
    },
    {
      id: 'uyscuti', name: 'UY Scuti', pos: [17.8, -0.4, -7.2], color: 0xff5e36, size: 1.35,
      badge: 'Red Hypergiant', cls: '~9 M☉ • ~900–1,700 R☉', radius: '5,900 ly from Sol', vel: '218 km/s', sector: 'Scutum-Centaurus Arm',
      desc: 'Pulsating red supergiant in Scutum whose photosphere would engulf the orbit of Jupiter if placed at the Sun.'
    },
    {
      id: 'cygx1', name: 'Cygnus X-1', pos: [24.2, 0.55, 16.5], color: 0x38bdf8, size: 1.05, isMicroBH: true,
      badge: 'Stellar-Mass Black Hole Binary', cls: '21.2 M☉ BH + 40.6 M☉ O9.7', radius: '7,200 ly from Sol', vel: '229 km/s', sector: 'Cygnus X Region',
      desc: 'First widely accepted black hole discovery; strips stellar wind from blue supergiant HDE 226868 into a blazing X-ray accretion disk.'
    },
    {
      id: 'etacar', name: 'Eta Carinae', pos: [23.0, -0.6, -15.4], color: 0xf472b6, size: 1.36,
      badge: 'Luminous Blue Variable Binary', cls: '100 + 30 M☉ • 5×10⁶ L☉', radius: '7,500 ly from Sol', vel: '221 km/s', sector: 'Carina Nebula',
      desc: 'Hypermassive binary wrapped inside the hourglass Homunculus Nebula blasted out during its 1843 Great Eruption.'
    },
    {
      id: 'wr104', name: 'WR 104 (Pinwheel Binary)', pos: [16.4, 0.3, -11.5], color: 0xc084fc, size: 1.05,
      badge: 'Wolf-Rayet Colliding-Wind Binary', cls: 'WC9 + OB • 220-day', radius: '8,400 ly from Sol', vel: '220 km/s', sector: 'Sagittarius Arm',
      desc: 'Carbon-rich Wolf-Rayet binary carving a sweeping 200-AU Archimedian spiral of glowing dust into space.'
    },
    {
      id: 'stephenson', name: 'Stephenson 2-18', pos: [11.2, -0.3, -14.8], color: 0xff3b1f, size: 1.48,
      badge: 'Largest Known Star Candidate', cls: '~2,150 R☉ • M6 Supergiant', radius: '18,900 ly from Sol', vel: '215 km/s', sector: 'Scutum-Centaurus Arm',
      desc: 'Colossal red hypergiant near cluster Stephenson 2 whose estimated radius reaches Saturn’s orbit—nearly 10 billion solar volumes.'
    },
    {
      id: 'pistol', name: 'Pistol Star', pos: [3.2, -0.15, -1.9], color: 0x60a5fa, size: 1.25,
      badge: 'Blue Hypergiant • Quintuplet', cls: '~27–86 M☉ • 3.3×10⁶ L☉', radius: '25,000 ly (Near Core)', vel: '185 km/s', sector: 'Quintuplet Cluster',
      desc: 'Radiates as much energy in 20 seconds as the Sun emits in an entire year; hidden in optical light behind Galactic Center dust.'
    },
    {
      id: 'r136a1', name: 'R136a1 (Tarantula Hypergiant)', pos: [-112, -98, 92], color: 0x7dd3fc, size: 1.55,
      badge: 'Most Massive Known Star', cls: '~196 M☉ • WN5h', radius: '163,000 ly (LMC)', vel: '321 km/s', sector: 'Large Magellanic Cloud',
      desc: 'Ultra-luminous Wolf-Rayet star (~4.7 million L☉) blazing inside the Tarantula Nebula of the Large Magellanic Cloud.'
    },
    {
      id: 'wohg64', name: 'WOH G64 (Behemoth Star)', pos: [-122, -94, 85], color: 0xff5533, size: 1.52,
      badge: 'Extragalactic Red Supergiant', cls: '~1,540 R☉ • Dusty Torus', radius: '163,000 ly (LMC)', vel: '294 km/s', sector: 'Large Magellanic Cloud',
      desc: 'First extragalactic star resolved in close-up by VLTI GRAVITY (2024), shedding an egg-shaped cocoon of dust before core collapse.'
    }
  ];

  // -------------------------------------------------------------------------
  // 4. VOLUMETRIC MILKY WAY NEBULAE (4 Detailed 3D Regions)
  // -------------------------------------------------------------------------
  const NEBULAE = [
    {
      id: 'orion', name: 'Orion Nebula (M42)', pos: [31.2, -1.2, 2.2], radius: 3.4,
      colors: [0xff4d8d, 0x7c3aed, 0x38bdf8], isPulsar: false,
      badge: 'Diffuse HII Stellar Nursery', cls: '24 ly across • Trapezium', radiusTxt: '1,344 ly from Sol', vel: '225 km/s', sector: 'Orion Molecular Cloud',
      desc: 'Closest region of massive star formation to Earth, sculpted by intense UV radiation from the newborn Trapezium O-type stars.'
    },
    {
      id: 'eagle', name: 'Eagle Nebula (M16 Pillars)', pos: [18.5, 0.65, -4.6], radius: 4.1,
      colors: [0xf59e0b, 0x06b6d4, 0xec4899], isPulsar: false, isPillars: true,
      badge: 'Star-Forming Pillars of Creation', cls: '70 × 55 ly • HII Region', radiusTxt: '5,700 ly from Sol', vel: '220 km/s', sector: 'Sagittarius Arm',
      desc: 'Towering 5-light-year elephants-trunk columns of cold molecular hydrogen and dust famously imaged in crisp infrared by JWST.'
    },
    {
      id: 'crab', name: 'Crab Nebula (M1 Pulsar)', pos: [36.8, -0.8, 4.9], radius: 2.9,
      colors: [0x38bdf8, 0xf97316, 0xa855f7], isPulsar: true,
      badge: 'Supernova Remnant • SN 1054', cls: '11 ly across • 30.2 Hz Pulsar', radiusTxt: '6,500 ly from Sol', vel: '1,500 km/s (Expansion)', sector: 'Perseus Arm',
      desc: 'Filamentary debris of the bright guest star recorded in 1054 CE, powered from within by a neutron star spinning 30 times per second.'
    },
    {
      id: 'carina', name: 'Carina Nebula (NGC 3372)', pos: [22.4, -0.95, -16.8], radius: 5.2,
      colors: [0xf97316, 0xec4899, 0x38bdf8], isPulsar: false,
      badge: 'Giant HII Complex • Cosmic Cliffs', cls: '300 ly across • 14,000+ Stars', radiusTxt: '8,500 ly from Sol', vel: '221 km/s', sector: 'Carina-Sagittarius Arm',
      desc: 'One of the largest diffuse star-forming complexes in the Milky Way, hosting Eta Carinae and JWST’s iconic NGC 3324 Cosmic Cliffs.'
    }
  ];

  // -------------------------------------------------------------------------
  // 5. MILKY WAY SPIRAL ARM LABELS
  // -------------------------------------------------------------------------
  const SPIRAL_ARMS = [
    { name: 'Perseus Arm', pos: [44, 1.5, 22] },
    { name: 'Scutum-Centaurus Arm', pos: [-38, 1.5, -24] },
    { name: 'Sagittarius-Carina Arm', pos: [22, 1.5, -36] },
    { name: 'Norma-Outer Arm', pos: [-45, 1.5, 18] },
    { name: 'Orion-Cygnus Spur', pos: [29, 1.8, 9] }
  ];

  // -------------------------------------------------------------------------
  // 6. 45 NAMED GALAXIES (GPU-Batched in 1 Star Buffer + 1 Dust Buffer)
  //    Types: 'barred', 'spiral', 'elliptical', 'lenticular', 'irregular', 'ring', 'merger'
  // -------------------------------------------------------------------------
  const NAMED_GALAXIES = [
    // --- LOCAL GROUP (10) ---
    {
      id: 'milkyway', name: 'Milky Way Galaxy', shortName: 'Milky Way', type: 'barred',
      pos: [0, 0, 0], rot: [0, 0, 0], radius: 62, stars: 38000, dust: 2200, arms: 4, twist: 4.3,
      bulgeCol: 0xffd7a3, armCol: 0x8cb8ff, omega: 0.12, dirTab: 'galaxies',
      badge: 'SBbc Barred Spiral • Home', cls: '1.15 × 10¹² M☉ • ~200B Stars', radiusTxt: '105,700 ly Diameter', vel: '600 km/s (CMB)', sector: 'Local Group • Laniakea Rim',
      desc: 'Our home barred spiral galaxy, sitting inside the outer Virgo-lobe rim of the Laniakea Supercluster bordering the Local Void.'
    },
    {
      id: 'm31', name: 'Andromeda Galaxy (M31)', shortName: 'Andromeda M31', type: 'spiral',
      pos: [340, 68, -420], rot: [0.68, 0.35, -0.45], radius: 88, stars: 26000, dust: 1450, arms: 2, twist: 4.9,
      bulgeCol: 0xffe0b0, armCol: 0x99c4ff, omega: 0.085, dirTab: 'galaxies',
      badge: 'SA(s)b Grand Spiral • ~1T Stars', cls: '1.5 × 10¹² M☉', radiusTxt: '2.54 Mly', vel: '-301 km/s (Merger ~4.5 Gyr)', sector: 'Local Group',
      desc: 'Largest galaxy in the Local Group (~1 trillion stars), sweeping toward the Milky Way on a gravitational merger trajectory.'
    },
    {
      id: 'm33', name: 'Triangulum Galaxy (M33)', shortName: 'Triangulum M33', type: 'spiral',
      pos: [435, 38, -345], rot: [0.42, -0.5, 0.25], radius: 34, stars: 9500, dust: 520, arms: 3, twist: 3.6,
      bulgeCol: 0xffe8c2, armCol: 0x7cb8ff, omega: 0.14, dirTab: 'galaxies',
      badge: 'SA(s)cd Unbarred Spiral', cls: '5 × 10¹⁰ M☉ • ~40B Stars', radiusTxt: '2.73 Mly', vel: '-179 km/s', sector: 'Local Group',
      desc: 'Third-largest Local Group member, packed with vigorous star formation and the giant NGC 604 HII region.'
    },
    {
      id: 'lmc', name: 'Large Magellanic Cloud', shortName: 'LMC', type: 'irregular',
      pos: [-115, -96, 88], rot: [0.45, 0.2, 0.6], radius: 22, stars: 5200, dust: 240, arms: 1, twist: 1.8,
      bulgeCol: 0xffe4bd, armCol: 0x80c8ff, omega: 0.09, dirTab: 'galaxies',
      badge: 'SB(s)m Dwarf Satellite', cls: '1.4 × 10¹¹ M☉', radiusTxt: '163,000 ly', vel: '321 km/s', sector: 'Milky Way Halo',
      desc: 'Largest Milky Way satellite galaxy, linked to the SMC by the Magellanic Bridge and hosting the Tarantula Nebula.'
    },
    {
      id: 'smc', name: 'Small Magellanic Cloud', shortName: 'SMC', type: 'irregular',
      pos: [-148, -116, 118], rot: [-0.3, 0.5, 0.4], radius: 13, stars: 2600, dust: 110, arms: 1, twist: 1.1,
      bulgeCol: 0xffe7c9, armCol: 0x99ccff, omega: 0.08, dirTab: 'galaxies',
      badge: 'dIrr Dwarf Satellite', cls: '7 × 10⁹ M☉', radiusTxt: '200,000 ly', vel: '146 km/s', sector: 'Milky Way Halo',
      desc: 'Tidally stretched dwarf irregular galaxy orbiting the Milky Way alongside the LMC.'
    },
    {
      id: 'm32', name: 'Messier 32 (M32)', shortName: 'M32', type: 'elliptical',
      pos: [316, 82, -398], rot: [0.2, 0.1, 0.1], radius: 8.5, stars: 1800, dust: 0, arms: 0, twist: 0,
      bulgeCol: 0xffd699, armCol: 0xffc880, omega: 0.03,
      badge: 'cE2 Compact Elliptical', cls: '3 × 10⁹ M☉', radiusTxt: '2.49 Mly', vel: '-200 km/s', sector: 'Andromeda Satellite',
      desc: 'Ultra-dense dwarf elliptical widely suspected to be the stripped core of a once-large spiral torn apart by Andromeda.'
    },
    {
      id: 'm110', name: 'Messier 110 (M110)', shortName: 'M110', type: 'elliptical',
      pos: [374, 48, -455], rot: [0.4, 0.7, 0.2], radius: 12.5, stars: 2100, dust: 40, arms: 0, twist: 0,
      bulgeCol: 0xffe2b8, armCol: 0xd9c2a3, omega: 0.03,
      badge: 'dE5 Dwarf Elliptical', cls: '1 × 10¹⁰ M☉', radiusTxt: '2.69 Mly', vel: '-241 km/s', sector: 'Andromeda Satellite',
      desc: 'Brightest satellite of Andromeda, unusually rich in dust clouds and young blue stars near its center.'
    },
    {
      id: 'ngc6822', name: 'Barnard’s Galaxy (NGC 6822)', shortName: 'NGC 6822', type: 'irregular',
      pos: [-195, -42, -265], rot: [0.2, 0.9, -0.3], radius: 11, stars: 1600, dust: 60, arms: 1, twist: 0.8,
      bulgeCol: 0xffe6cc, armCol: 0x7dd3fc, omega: 0.05,
      badge: 'IB(s)m Barred Irregular', cls: '1 × 10⁷ Stars', radiusTxt: '1.63 Mly', vel: '-57 km/s', sector: 'Local Group',
      desc: 'Isolated Local Group dwarf irregular similar to the early building-block galaxies of the young universe.'
    },
    {
      id: 'ic1613', name: 'IC 1613 (Caldwell 51)', shortName: 'IC 1613', type: 'irregular',
      pos: [275, -95, -245], rot: [-0.4, 0.3, 0.2], radius: 10, stars: 1400, dust: 30, arms: 1, twist: 0.6,
      bulgeCol: 0xe2e8f0, armCol: 0x93c5fd, omega: 0.04,
      badge: 'IB(s)m Dust-Poor Dwarf', cls: '1 × 10⁸ M☉', radiusTxt: '2.38 Mly', vel: '-234 km/s', sector: 'Local Group',
      desc: 'Nearly dust-free Local Group irregular galaxy crucial for calibrating Cepheid and RR Lyrae distance scales.'
    },
    {
      id: 'sgrdeg', name: 'Sagittarius Dwarf Elliptical', shortName: 'Sgr dSph', type: 'elliptical',
      pos: [-58, -24, -18], rot: [1.1, 0.2, 0.5], radius: 14, stars: 1800, dust: 0, arms: 0, twist: 0,
      bulgeCol: 0xffcf9e, armCol: 0xf4b183, omega: 0.02,
      badge: 'dSph Tidally Disrupted Satellite', cls: '4 × 10⁸ M☉', radiusTxt: '65,000 ly', vel: '140 km/s', sector: 'Milky Way Halo',
      desc: 'Repeatedly plunging through the Milky Way disk, triggering star-formation ripples—possibly including the birth of our Sun.'
    },

    // --- NEARBY & ICONIC MESSIER / NGC GALAXIES (30) ---
    {
      id: 'm81', name: 'Bode’s Galaxy (M81)', shortName: 'Bode M81', type: 'spiral',
      pos: [-360, 290, 480], rot: [0.95, 0.3, -0.25], radius: 52, stars: 9000, dust: 520, arms: 2, twist: 4.8,
      bulgeCol: 0xffe0ad, armCol: 0x93c5fd, omega: 0.09, dirTab: 'galaxies',
      badge: 'SA(s)ab Grand-Design Spiral', cls: '2.5 × 10¹¹ M☉', radiusTxt: '11.8 Mly', vel: '-34 km/s', sector: 'M81 Group',
      desc: 'Classic symmetrical grand-design spiral gravitationally interacting with its starburst neighbor Cigar Galaxy (M82).'
    },
    {
      id: 'm82', name: 'Cigar Galaxy (M82)', shortName: 'Cigar M82', type: 'irregular',
      pos: [-308, 326, 515], rot: [1.38, 0.45, 0.35], radius: 30, stars: 5200, dust: 420, arms: 1, twist: 1.5,
      bulgeCol: 0xff6b52, armCol: 0xff9e75, omega: 0.10, hasStarburst: true, dirTab: 'galaxies',
      badge: 'I0 Starburst Superwind', cls: '5 × 10¹⁰ M☉', radiusTxt: '12.0 Mly', vel: '203 km/s', sector: 'M81 Group',
      desc: 'Forming stars 10× faster than the Milky Way after a close flyby with M81, blowing crimson ionized gas superwinds off its disk.'
    },
    {
      id: 'ngc253', name: 'Sculptor Galaxy (NGC 253)', shortName: 'Sculptor NGC 253', type: 'spiral',
      pos: [410, -290, 240], rot: [1.26, -0.3, 0.42], radius: 48, stars: 7200, dust: 480, arms: 2, twist: 4.2,
      bulgeCol: 0xffcfa0, armCol: 0x8cbaff, omega: 0.09, dirTab: 'galaxies',
      badge: 'SAB(s)c Starburst Spiral', cls: '1.2 × 10¹¹ M☉', radiusTxt: '11.4 Mly', vel: '243 km/s', sector: 'Sculptor Group',
      desc: 'Dusty, nearly edge-on starburst galaxy anchoring the Sculptor Filament—one of the closest galaxy groups to the Local Group.'
    },
    {
      id: 'cena', name: 'Centaurus A (NGC 5128)', shortName: 'Centaurus A', type: 'lenticular',
      pos: [-520, -260, -490], rot: [1.18, 0.4, 0.55], radius: 56, stars: 10500, dust: 780, arms: 0, twist: 0,
      bulgeCol: 0xffd7a8, armCol: 0xffe4c4, omega: 0.05, hasJet: true, jetLength: 78, jetColor: 0x7dd3fc, dirTab: 'galaxies',
      badge: 'S0 pec Active Radio Galaxy', cls: '1 × 10¹² M☉ • 5.5×10⁷ M☉ BH', radiusTxt: '12.4 Mly', vel: '547 km/s', sector: 'Cen A / M83 Group',
      desc: 'Closest active radio galaxy to Earth—a massive elliptical sliced across the middle by a warped dust lane from a swallowed spiral.'
    },
    {
      id: 'm83', name: 'Southern Pinwheel (M83)', shortName: 'M83', type: 'barred',
      pos: [-440, -230, -580], rot: [0.35, 0.1, -0.25], radius: 46, stars: 7400, dust: 440, arms: 4, twist: 4.1,
      bulgeCol: 0xffe0ad, armCol: 0x86c5ff, omega: 0.10,
      badge: 'SAB(s)c Barred Spiral', cls: '1.2 × 10¹¹ M☉', radiusTxt: '15.2 Mly', vel: '513 km/s', sector: 'Cen A / M83 Group',
      desc: 'Face-on barred spiral speckled with hundreds of pink HII star-forming nurseries and six observed supernovae.'
    },
    {
      id: 'm64', name: 'Black Eye Galaxy (M64)', shortName: 'Black Eye M64', type: 'spiral',
      pos: [240, 420, -640], rot: [0.88, -0.2, 0.3], radius: 40, stars: 6200, dust: 580, arms: 2, twist: 4.6,
      bulgeCol: 0xffdca8, armCol: 0x9ec5ff, omega: 0.09, dirTab: 'galaxies',
      badge: 'SA(rs)ab Counter-Rotating Disk', cls: '1 × 10¹¹ M☉', radiusTxt: '17.3 Mly', vel: '408 km/s', sector: 'Coma Berenices',
      desc: 'Famous for its dark inner band of absorbing dust—its outer gas rotates backward relative to its inner stars from a past merger.'
    },
    {
      id: 'm94', name: 'Cat’s Eye Galaxy (M94)', shortName: 'M94', type: 'spiral',
      pos: [-160, 480, -490], rot: [0.32, 0.4, 0.1], radius: 36, stars: 5600, dust: 280, arms: 2, twist: 5.1,
      bulgeCol: 0xfff0cc, armCol: 0x93c5fd, omega: 0.11,
      badge: 'SA(r)ab Starburst Ring', cls: '6 × 10¹⁰ M☉', radiusTxt: '16.0 Mly', vel: '308 km/s', sector: 'Canes Venatici I',
      desc: 'Features a blazing inner starburst ring wrapped inside an unusually faint, vast outer stellar ring.'
    },
    {
      id: 'm101', name: 'Pinwheel Galaxy (M101)', shortName: 'Pinwheel M101', type: 'spiral',
      pos: [-580, 440, 290], rot: [0.22, -0.4, 0.18], radius: 66, stars: 11500, dust: 620, arms: 5, twist: 4.5,
      bulgeCol: 0xffe4b8, armCol: 0x7cb8ff, omega: 0.085, dirTab: 'galaxies',
      badge: 'SAB(rs)cd Giant Face-On Spiral', cls: '1 × 10¹² Stars • 170k ly', radiusTxt: '20.9 Mly', vel: '241 km/s', sector: 'M101 Group',
      desc: 'Sprawling, slightly lopsided face-on giant nearly twice the Milky Way’s diameter, hosting supernova SN 2023ixf.'
    },
    {
      id: 'm51', name: 'Whirlpool Galaxy (M51)', shortName: 'Whirlpool M51', type: 'spiral',
      pos: [-490, 510, -260], rot: [0.28, 0.55, -0.15], radius: 52, stars: 10500, dust: 640, arms: 2, twist: 5.2,
      bulgeCol: 0xffe0ad, armCol: 0x7dc4ff, omega: 0.10, dirTab: 'galaxies',
      badge: 'SA(s)bc Interacting Grand Spiral', cls: '1.6 × 10¹¹ M☉', radiusTxt: '23.5 Mly', vel: '463 km/s', sector: 'M51 Group',
      desc: 'Textbook two-arm grand-design spiral whose crisp density waves are amplified by tidal tugs from companion NGC 5195.'
    },
    {
      id: 'ngc5195', name: 'NGC 5195 (M51 Companion)', shortName: 'NGC 5195', type: 'lenticular',
      pos: [-436, 518, -242], rot: [0.35, 0.4, 0.2], radius: 17, stars: 2600, dust: 120, arms: 0, twist: 0,
      bulgeCol: 0xffd296, armCol: 0xf4c28c, omega: 0.05,
      badge: 'SB0 pec Dwarf Companion', cls: '4 × 10¹⁰ M☉', radiusTxt: '23.5 Mly', vel: '465 km/s', sector: 'M51 Group',
      desc: 'Yellowish dwarf lenticular galaxy tethered to the outer tip of the Whirlpool Galaxy’s eastern spiral arm.'
    },
    {
      id: 'm63', name: 'Sunflower Galaxy (M63)', shortName: 'Sunflower M63', type: 'spiral',
      pos: [-420, 540, -340], rot: [0.95, 0.25, -0.4], radius: 48, stars: 7400, dust: 480, arms: 6, twist: 5.6,
      bulgeCol: 0xffe2b0, armCol: 0x8ec5ff, omega: 0.095,
      badge: 'SA(rs)bc Flocculent Spiral', cls: '1.4 × 10¹¹ M☉', radiusTxt: '29.3 Mly', vel: '484 km/s', sector: 'M51 Group',
      desc: 'Archetypal flocculent spiral whose disk is woven from dozens of short, patchy blue star-forming arm segments.'
    },
    {
      id: 'ngc6946', name: 'Fireworks Galaxy (NGC 6946)', shortName: 'Fireworks', type: 'spiral',
      pos: [380, 320, 620], rot: [0.36, -0.2, 0.14], radius: 44, stars: 6800, dust: 420, arms: 4, twist: 4.3,
      bulgeCol: 0xffd9a0, armCol: 0x80bdff, omega: 0.09,
      badge: 'SAB(rs)cd Supernova Factory', cls: '10 Recorded Supernovae', radiusTxt: '25.2 Mly', vel: '40 km/s', sector: 'Cepheus-Cygnus',
      desc: 'Holds the modern record with 10 observed supernovae in a single century—ten times the Milky Way’s rate.'
    },
    {
      id: 'm104', name: 'Sombrero Galaxy (M104)', shortName: 'Sombrero M104', type: 'lenticular',
      pos: [520, -180, -860], rot: [1.42, 0.18, 0.08], radius: 54, stars: 11500, dust: 820, arms: 0, twist: 0,
      bulgeCol: 0xffe0ad, armCol: 0xffecc9, omega: 0.075, dirTab: 'galaxies',
      badge: 'SA(s)a Edge-On Dust Ring', cls: '8 × 10¹¹ M☉ • 2,000 GCs', radiusTxt: '31.1 Mly', vel: '1,024 km/s', sector: 'Virgo II Groups',
      desc: 'Iconic luminous golden bulge bisected by a razor-sharp symmetric dust ring and surrounded by ~2,000 globular clusters.'
    },
    {
      id: 'm74', name: 'Phantom Galaxy (M74)', shortName: 'Phantom M74', type: 'spiral',
      pos: [690, 120, 410], rot: [0.14, 0.25, -0.12], radius: 50, stars: 9800, dust: 690, arms: 2, twist: 5.0,
      bulgeCol: 0xffe4b8, armCol: 0x7cb8ff, omega: 0.095, dirTab: 'galaxies',
      badge: 'SA(s)c JWST MIRI Showcase', cls: '1 × 10¹¹ Stars', radiusTxt: '32.0 Mly', vel: '657 km/s', sector: 'M74 Group',
      desc: 'Nearly face-on grand-design spiral—switch to JWST MIRI mode to reveal its famous glowing golden-magenta PAH skeletal web!'
    },
    {
      id: 'm65', name: 'Messier 65 (Leo Triplet)', shortName: 'M65', type: 'spiral',
      pos: [165, 310, -960], rot: [1.18, -0.35, 0.42], radius: 38, stars: 5200, dust: 340, arms: 2, twist: 4.5,
      bulgeCol: 0xffd7a0, armCol: 0xa3c8ff, omega: 0.09,
      badge: 'SAB(rs)a Leo Triplet', cls: '8 × 10¹⁰ M☉', radiusTxt: '35 Mly', vel: '807 km/s', sector: 'Leo Triplet',
      desc: 'Tightly wound spiral in the Leo Triplet displaying a smooth disk and prominent lane of dark obscuring dust.'
    },
    {
      id: 'm66', name: 'Messier 66 (Leo Triplet)', shortName: 'M66', type: 'barred',
      pos: [215, 295, -995], rot: [1.02, 0.25, -0.3], radius: 42, stars: 5800, dust: 380, arms: 2, twist: 4.0,
      bulgeCol: 0xffe0b0, armCol: 0x8cc2ff, omega: 0.095,
      badge: 'SAB(s)b Asymmetric Spiral', cls: '1 × 10¹¹ M☉', radiusTxt: '31 Mly', vel: '727 km/s', sector: 'Leo Triplet',
      desc: 'Largest member of the Leo Triplet, twisted into asymmetric arms by gravitational encounters with M65 and NGC 3628.'
    },
    {
      id: 'ngc3628', name: 'Hamburger Galaxy (NGC 3628)', shortName: 'NGC 3628', type: 'spiral',
      pos: [195, 365, -985], rot: [1.50, 0.15, 0.12], radius: 46, stars: 5600, dust: 520, arms: 2, twist: 4.2,
      bulgeCol: 0xffd8a8, armCol: 0xa6c8ff, omega: 0.08,
      badge: 'Sb pec Edge-On Tidal Tail', cls: '1.2 × 10¹¹ M☉', radiusTxt: '35 Mly', vel: '843 km/s', sector: 'Leo Triplet',
      desc: 'Edge-on member of the Leo Triplet split by a puffy equatorial dust lane with a 300,000-ly tidal tail.'
    },
    {
      id: 'ngc4565', name: 'Needle Galaxy (NGC 4565)', shortName: 'Needle NGC 4565', type: 'spiral',
      pos: [-140, 580, -890], rot: [1.54, 0.22, -0.35], radius: 56, stars: 7200, dust: 620, arms: 2, twist: 4.5,
      bulgeCol: 0xffdca8, armCol: 0x9ec5ff, omega: 0.085,
      badge: 'SA(s)b Edge-On Boxy Bulge', cls: '1.5 × 10¹¹ M☉', radiusTxt: '42.7 Mly', vel: '1,230 km/s', sector: 'Coma I Group',
      desc: 'Razor-thin edge-on spiral thought to closely resemble what our own Milky Way would look like viewed from afar.'
    },
    {
      id: 'm106', name: 'Messier 106 (NGC 4258)', shortName: 'M106', type: 'spiral',
      pos: [-290, 620, -520], rot: [1.08, -0.3, 0.22], radius: 52, stars: 7600, dust: 440, arms: 2, twist: 4.4,
      bulgeCol: 0xffe2b5, armCol: 0x8cc2ff, omega: 0.09,
      badge: 'SAB(s)bc Water Megamaser AGN', cls: '3.9 × 10⁷ M☉ SMBH', radiusTxt: '23.7 Mly', vel: '448 km/s', sector: 'Canes Venatici II',
      desc: 'Active Seyfert galaxy hosting two anomalous radio/X-ray spiral arms heated by jets plowing directly through its disk.'
    },
    {
      id: 'm102', name: 'Spindle Galaxy (NGC 5866)', shortName: 'Spindle M102', type: 'lenticular',
      pos: [-640, 520, -140], rot: [1.52, -0.5, 0.25], radius: 34, stars: 4400, dust: 360, arms: 0, twist: 0,
      bulgeCol: 0xffe4bc, armCol: 0xe6d2b5, omega: 0.06,
      badge: 'S0₃ Edge-On Lenticular', cls: '6 × 10¹⁰ M☉', radiusTxt: '44.7 Mly', vel: '755 km/s', sector: 'NGC 5866 Group',
      desc: 'Clean edge-on lenticular galaxy bisected by an extraordinarily thin, sharp equatorial dust disk.'
    },
    {
      id: 'antennae', name: 'Antennae Galaxies (NGC 4038/39)', shortName: 'Antennae', type: 'merger',
      pos: [340, -340, -1180], rot: [0.65, 0.4, -0.25], radius: 54, stars: 9200, dust: 580, arms: 2, twist: 3.1,
      bulgeCol: 0xffd2a6, armCol: 0x67b8ff, omega: 0.075, dirTab: 'galaxies',
      badge: 'Active Major Galactic Merger', cls: '2 Colliding Spirals', radiusTxt: '45 Mly', vel: '1,642 km/s', sector: 'NGC 4038 Group',
      desc: 'Pair of colliding spirals flinging twin sweeping tidal tails of stars and triggering billions of newborn super star clusters.'
    },
    {
      id: 'ngc1300', name: 'NGC 1300 (Grand Barred)', shortName: 'NGC 1300', type: 'barred',
      pos: [790, -490, -1120], rot: [0.48, 0.2, 0.35], radius: 50, stars: 7600, dust: 460, arms: 2, twist: 3.9,
      bulgeCol: 0xffe2b0, armCol: 0x8cc2ff, omega: 0.09, dirTab: 'galaxies',
      badge: 'SB(rs)bc Textbook Barred Spiral', cls: '110,000 ly Diameter', radiusTxt: '61.3 Mly', vel: '1,577 km/s', sector: 'Eridanus Cluster',
      desc: 'Prototypical barred spiral featuring a dramatic grand-design nuclear spiral nested inside its straight central bar.'
    },
    {
      id: 'm87', name: 'Messier 87 (Virgo A)', shortName: 'Messier 87', type: 'elliptical',
      pos: [-680, 110, -1550], rot: [0.2, 0.1, 0.3], radius: 82, stars: 13500, dust: 0, arms: 0, twist: 0,
      bulgeCol: 0xffe1ad, armCol: 0xffd08a, omega: 0.025, dirTab: 'galaxies',
      badge: 'E+0-1 pec Supergiant Elliptical', cls: '2.4 × 10¹² M☉ • 12,000 GCs', radiusTxt: '53.5 Mly', vel: '1,284 km/s', sector: 'Virgo Cluster Core',
      desc: 'Monstrous elliptical dominating the heart of the Virgo Cluster, home to SMBH M87* and a 5,000-ly blue relativistic jet.'
    },
    {
      id: 'm49', name: 'Messier 49 (Virgo B)', shortName: 'M49', type: 'elliptical',
      pos: [-785, -15, -1620], rot: [0.3, 0.5, 0.1], radius: 64, stars: 7500, dust: 0, arms: 0, twist: 0,
      bulgeCol: 0xffe4b8, armCol: 0xffd699, omega: 0.02,
      badge: 'E2 Giant Elliptical', cls: '1.8 × 10¹² M☉', radiusTxt: '55.9 Mly', vel: '981 km/s', sector: 'Virgo Cluster South',
      desc: 'Visually the brightest galaxy in the Virgo Cluster, surrounded by nearly 6,000 ancient globular clusters.'
    },
    {
      id: 'm86', name: 'Messier 86 (Markarian’s Chain)', shortName: 'M86', type: 'lenticular',
      pos: [-625, 165, -1510], rot: [0.5, 0.3, -0.2], radius: 46, stars: 5200, dust: 80, arms: 0, twist: 0,
      bulgeCol: 0xffe4bc, armCol: 0xf5d6a8, omega: 0.03,
      badge: 'S0(3) Blueshifted Virgo Giant', cls: '5 × 10¹¹ M☉', radiusTxt: '52 Mly', vel: '-244 km/s (Infalling)', sector: 'Virgo Cluster Core',
      desc: 'Racing toward the Milky Way at 244 km/s as it plunges at supersonic speed through Virgo’s hot X-ray intracluster gas.'
    },
    {
      id: 'm100', name: 'Messier 100 (Mirror of MW)', shortName: 'M100', type: 'spiral',
      pos: [-590, 210, -1480], rot: [0.22, 0.4, 0.15], radius: 52, stars: 7200, dust: 420, arms: 2, twist: 4.7,
      bulgeCol: 0xffe2b0, armCol: 0x8cc2ff, omega: 0.09,
      badge: 'SAB(s)bc Grand-Design Spiral', cls: '107,000 ly Diameter', radiusTxt: '55 Mly', vel: '1,571 km/s', sector: 'Virgo Cluster',
      desc: 'One of the brightest spiral galaxies in the Virgo Cluster; famously tested Hubble Space Telescope’s repaired optics.'
    },
    {
      id: 'ngc1316', name: 'Fornax A (NGC 1316)', shortName: 'Fornax A', type: 'lenticular',
      pos: [850, -520, -1250], rot: [0.6, 0.25, 0.4], radius: 62, stars: 8200, dust: 320, arms: 0, twist: 0,
      bulgeCol: 0xffe0ad, armCol: 0xf2c994, omega: 0.03, hasJet: true, jetLength: 68, jetColor: 0xc084fc,
      badge: 'SAB0 Radio Giant • Merger', cls: '1.5 × 10¹¹ M☉', radiusTxt: '62 Mly', vel: '1,760 km/s', sector: 'Fornax Cluster',
      desc: 'Fourth-brightest radio source in the entire sky, scarred with ripple shells from devouring multiple smaller spiral galaxies.'
    },
    {
      id: 'stephans', name: 'Stephan’s Quintet (NGC 7318-20)', shortName: 'Stephan’s Quintet', type: 'merger',
      pos: [1220, 480, 1450], rot: [0.75, 0.3, 0.5], radius: 58, stars: 8800, dust: 480, arms: 2, twist: 3.4,
      bulgeCol: 0xffd5a6, armCol: 0x7dd3fc, omega: 0.07, dirTab: 'galaxies',
      badge: 'HCG 92 Compact Interacting Group', cls: '5 Galaxies • Shock Ridge', radiusTxt: '290 Mly', vel: '6,600 km/s', sector: 'Pegasus',
      desc: 'Iconic JWST compact group where NGC 7318b slams through intragroup gas at ~800 km/s, igniting a massive shockwave larger than the Milky Way.'
    },
    {
      id: 'mice', name: 'Mice Galaxies (NGC 4676)', shortName: 'Mice Galaxies', type: 'merger',
      pos: [-1120, 980, -2420], rot: [0.5, -0.6, 0.4], radius: 52, stars: 7200, dust: 340, arms: 2, twist: 2.8,
      bulgeCol: 0xffe0b8, armCol: 0x80c5ff, omega: 0.06,
      badge: 'Interacting Spiral Pair', cls: 'Future Giant Elliptical', radiusTxt: '290 Mly', vel: '6,613 km/s', sector: 'Coma Supercluster',
      desc: 'Two spirals nicknamed for their long, straight tidal tails stretched out by differential gravity during their first close pass.'
    },
    {
      id: 'tadpole', name: 'Tadpole Galaxy (UGC 10214)', shortName: 'Tadpole Galaxy', type: 'merger',
      pos: [-1680, 1340, 1520], rot: [0.62, 0.85, -0.35], radius: 56, stars: 7400, dust: 380, arms: 2, twist: 3.8,
      bulgeCol: 0xffe2b5, armCol: 0x7cb8ff, omega: 0.075,
      badge: 'SB(s)c pec 280k-ly Tidal Tail', cls: 'Disrupted Barred Spiral', radiusTxt: '420 Mly', vel: '9,401 km/s', sector: 'Draco',
      desc: 'Disrupted spiral trailing a dramatic 280,000-light-year tail studded with massive blue star clusters after a hit-and-run intruder.'
    },
    {
      id: 'cartwheel', name: 'Cartwheel Galaxy (ESO 350-40)', shortName: 'Cartwheel', type: 'ring',
      pos: [1640, -1180, 920], rot: [0.58, 0.25, -0.4], radius: 54, stars: 8600, dust: 340, arms: 6, twist: 1.4,
      bulgeCol: 0xffd79e, armCol: 0x60a5fa, omega: 0.08, dirTab: 'galaxies',
      badge: 'S pec Collisional Ring Galaxy', cls: '144,000 ly Diameter', radiusTxt: '500 Mly', vel: '9,050 km/s', sector: 'Sculptor',
      desc: 'Bullseye collisional ring galaxy forged ~400 Myr ago when a smaller galaxy punched straight through its core, sending out a starburst wave.'
    },
    {
      id: 'hoags', name: 'Hoag’s Object (PGC 54559)', shortName: 'Hoag’s Object', type: 'ring',
      pos: [-1940, 1120, -1480], rot: [0.22, 0.1, 0.18], radius: 48, stars: 7800, dust: 80, arms: 0, twist: 0,
      bulgeCol: 0xffcf82, armCol: 0x60b0ff, omega: 0.075, dirTab: 'galaxies',
      badge: 'SA0(r) Detached Ring Galaxy', cls: '121,000 ly Diameter', radiusTxt: '613 Mly', vel: '12,740 km/s', sector: 'Serpens Caput',
      desc: 'Nearly perfect circular ring of young hot blue stars floating cleanly around an isolated, ancient golden spheroid core.'
    },
    {
      id: 'eso137', name: 'ESO 137-001 (Jellyfish)', shortName: 'ESO 137-001', type: 'spiral',
      pos: [-1680, -210, -3040], rot: [0.75, 0.3, 0.6], radius: 34, stars: 4600, dust: 240, arms: 2, twist: 3.6,
      bulgeCol: 0xffe0b5, armCol: 0x60c5ff, omega: 0.08,
      badge: 'Ram-Pressure Jellyfish Spiral', cls: '260k-ly X-Ray Gas Tails', radiusTxt: '220 Mly', vel: '4,680 km/s', sector: 'Norma Cluster',
      desc: 'Plunging into the Norma Cluster at ~7 million km/h, stripping its interstellar gas behind it like glowing jellyfish tentacles.'
    },
    {
      id: 'ngc1275', name: 'Perseus A (NGC 1275)', shortName: 'Perseus A', type: 'elliptical',
      pos: [2450, 420, 1850], rot: [0.3, 0.2, 0.4], radius: 74, stars: 9400, dust: 260, arms: 0, twist: 0,
      bulgeCol: 0xffe0b0, armCol: 0xf472b6, omega: 0.025, hasJet: true, jetLength: 62, jetColor: 0xf472b6,
      badge: 'Type 1.5 Seyfert cD BCG', cls: '10¹² M☉ • Magnetic Filaments', radiusTxt: '235 Mly', vel: '5,264 km/s', sector: 'Perseus Cluster Core',
      desc: 'Supergiant central galaxy of the Perseus Cluster blowing colossal acoustic pressure ripples through surrounding 50-million-K X-ray gas.'
    },
    {
      id: 'ngc4874', name: 'NGC 4874 (Coma BCG West)', shortName: 'NGC 4874', type: 'elliptical',
      pos: [-1380, 1420, -3280], rot: [0.2, 0.4, 0.1], radius: 78, stars: 8800, dust: 0, arms: 0, twist: 0,
      bulgeCol: 0xffe2b2, armCol: 0xffd28a, omega: 0.02,
      badge: 'cD0 Supergiant Elliptical', cls: '30,000+ Globular Clusters', radiusTxt: '350 Mly', vel: '7,224 km/s', sector: 'Coma Cluster Core',
      desc: 'One of two colossal cD elliptical cannibal galaxies anchoring the gravitational center of the Coma Cluster.'
    },
    {
      id: 'ngc4889', name: 'NGC 4889 (Coma BCG East)', shortName: 'NGC 4889', type: 'elliptical',
      pos: [-1230, 1450, -3210], rot: [0.4, 0.2, 0.3], radius: 82, stars: 9200, dust: 0, arms: 0, twist: 0,
      bulgeCol: 0xffe4b8, armCol: 0xffd699, omega: 0.02,
      badge: 'E4 Supergiant • 21B M☉ SMBH', cls: '2.1 × 10¹⁰ M☉ Black Hole', radiusTxt: '308 Mly', vel: '6,495 km/s', sector: 'Coma Cluster Core',
      desc: 'Hosts one of the largest black holes ever measured (~21 billion solar masses), now resting in a dormant post-quasar state.'
    },
    {
      id: 'ic1101', name: 'IC 1101 (Abell 2029 BCG)', shortName: 'IC 1101', type: 'elliptical',
      pos: [-3400, 1850, -4950], rot: [0.3, 0.6, 0.2], radius: 112, stars: 12000, dust: 0, arms: 0, twist: 0,
      bulgeCol: 0xffe4b0, armCol: 0xffcf82, omega: 0.015, dirTab: 'galaxies',
      badge: 'cD Ultra-Giant Elliptical', cls: '~100 Trillion Stars • ~4M ly Halo', radiusTxt: '1.045 Bly', vel: 'z = 0.0779', sector: 'Abell 2029 Cluster',
      desc: 'One of the largest known galaxies in the universe—a sprawling golden cD supergiant spanning millions of light-years.'
    },
    {
      id: 'alcyoneus', name: 'Alcyoneus (Giant Radio Galaxy)', shortName: 'Alcyoneus', type: 'elliptical',
      pos: [3850, 2250, -4120], rot: [0.2, 0.5, 0.6], radius: 52, stars: 5200, dust: 0, arms: 0, twist: 0,
      bulgeCol: 0xffe0ad, armCol: 0x93c5fd, omega: 0.02, hasJet: true, jetLength: 210, jetColor: 0xa855f7, dirTab: 'galaxies',
      badge: 'Largest Single-Galaxy Radio Lobes', cls: '16.3 Million ly Jet Span', radiusTxt: '3.5 Bly', vel: 'z = 0.2467', sector: 'Lynx Void Filament',
      desc: 'Ordinary-sized elliptical galaxy powering twin relativistic plasma lobes stretching over 16 million light-years end to end.'
    },
    {
      id: 'm59', name: 'Messier 59', shortName: 'M59', type: 'elliptical',
      pos: [-740, 155, -1490], rot: [0.4, 0.2, 0.5], radius: 34, stars: 3600, dust: 0, arms: 0, twist: 0,
      bulgeCol: 0xffe0ad, armCol: 0xffd494, omega: 0.02,
      badge: 'E5 Elliptical • Counter-Core', cls: '2.7 × 10⁸ M☉ SMBH', radiusTxt: '50 Mly', vel: '440 km/s', sector: 'Virgo Cluster',
      desc: 'Bright elliptical in Virgo containing an inner stellar disk rotating in the opposite direction of the main galaxy.'
    },
    {
      id: 'm60', name: 'Messier 60 & NGC 4647', shortName: 'M60', type: 'elliptical',
      pos: [-765, 175, -1530], rot: [0.2, 0.3, 0.1], radius: 48, stars: 5400, dust: 0, arms: 0, twist: 0,
      bulgeCol: 0xffe3b5, armCol: 0xffd494, omega: 0.02,
      badge: 'E2 Giant • 4.5B M☉ SMBH', cls: '4.5 × 10⁹ M☉ Black Hole', radiusTxt: '54 Mly', vel: '1,117 km/s', sector: 'Virgo Cluster East',
      desc: 'Third-brightest elliptical in the Virgo Cluster, harboring a 4.5-billion-solar-mass supermassive black hole.'
    },
    {
      id: 'm90', name: 'Messier 90', shortName: 'M90', type: 'spiral',
      pos: [-655, 195, -1615], rot: [1.05, 0.25, -0.35], radius: 44, stars: 5200, dust: 280, arms: 2, twist: 4.3,
      bulgeCol: 0xffe0ad, armCol: 0x99c4ff, omega: 0.08,
      badge: 'SAB(rs)ab Gas-Stripped Spiral', cls: 'Blueshifted Virgo Member', radiusTxt: '59 Mly', vel: '-235 km/s', sector: 'Virgo Cluster',
      desc: 'High-speed spiral stripped of its outer star-forming gas by Virgo’s hot intracluster medium, leaving smooth, anemic outer arms.'
    },
    {
      id: 'ngc1365', name: 'Great Barred Spiral (NGC 1365)', shortName: 'NGC 1365', type: 'barred',
      pos: [915, -545, -1310], rot: [0.68, -0.25, 0.3], radius: 52, stars: 6800, dust: 420, arms: 2, twist: 3.9,
      bulgeCol: 0xffe0ad, armCol: 0x80c5ff, omega: 0.09,
      badge: 'SB(s)b Double-Barred Seyfert', cls: '200,000 ly Diameter', radiusTxt: '56 Mly', vel: '1,636 km/s', sector: 'Fornax Cluster',
      desc: 'Massive double-barred spiral in the Fornax Cluster whose central 2-million-M☉ black hole spins near the relativistic Kerr limit.'
    },
    {
      id: 'eso325', name: 'ESO 325-G004 (Gravitational Lens)', shortName: 'ESO 325-G004', type: 'elliptical',
      pos: [-2020, -410, -2640], rot: [0.3, 0.1, 0.4], radius: 58, stars: 5800, dust: 0, arms: 0, twist: 0,
      bulgeCol: 0xffe4b8, armCol: 0xffd08a, omega: 0.02,
      badge: 'cD Elliptical • Closest Einstein Ring', cls: '1.5 × 10¹¹ M☉', radiusTxt: '450 Mly', vel: '10,160 km/s', sector: 'Abell S0740 / Hydra-Cen',
      desc: 'Giant elliptical galaxy that provided the sharpest extragalactic test of Einstein’s General Relativity via its crisp Einstein ring.'
    },
    {
      id: 'ngc4696', name: 'NGC 4696 (Centaurus BCG)', shortName: 'NGC 4696', type: 'elliptical',
      pos: [-1940, -370, -2580], rot: [0.4, 0.5, 0.2], radius: 66, stars: 6800, dust: 220, arms: 0, twist: 0,
      bulgeCol: 0xffdfa8, armCol: 0xf4a261, omega: 0.02,
      badge: 'E+1 pec Centaurus Cluster Core', cls: 'Dust-Filament Giant', radiusTxt: '145 Mly', vel: '2,958 km/s', sector: 'Hydra-Centaurus',
      desc: 'Dominant elliptical of the Centaurus Cluster woven with curling 30,000-ly dusty magnetic filaments pulled by AGN feedback.'
    },
    {
      id: 'ngc3311', name: 'NGC 3311 (Hydra I BCG)', shortName: 'NGC 3311', type: 'elliptical',
      pos: [-2160, -290, -2380], rot: [0.2, 0.2, 0.5], radius: 60, stars: 6000, dust: 0, arms: 0, twist: 0,
      bulgeCol: 0xffe2b2, armCol: 0xffd494, omega: 0.02,
      badge: 'cD2 Hydra Cluster Core', cls: '16,000+ Globular Clusters', radiusTxt: '190 Mly', vel: '3,825 km/s', sector: 'Hydra-Centaurus',
      desc: 'Supergiant central elliptical anchoring the Hydra I Cluster inside the Laniakea Supercluster.'
    }
  ];

  // -------------------------------------------------------------------------
  // 7. 8 DEDICATED 3D GALAXY CLUSTERS (184 Procedural Member Galaxies + ICM)
  //    45 Named + 184 Cluster Members = 229 Total GPU-Batched Galaxies!
  // -------------------------------------------------------------------------
  const CLUSTERS = [
    {
      id: 'virgo', name: 'Virgo Cluster', shortName: 'Virgo',
      pos: [-680, 110, -1550], radius: 340, memberCount: 28, icmColor: 0x38bdf8,
      camOffset: [420, 260, 560],
      badge: 'Nearest Rich Cluster • ~1,300 Galaxies', cls: '1.2 × 10¹⁵ M☉', radiusTxt: '53.8 Mly', vel: '1,100 km/s', sector: 'Laniakea Virgo Lobe',
      desc: 'Gravitational anchor of the Local Supercluster dominated by M87, slowing the Local Group’s Hubble expansion via Virgocentric infall.'
    },
    {
      id: 'fornax', name: 'Fornax Cluster', shortName: 'Fornax',
      pos: [850, -520, -1250], radius: 240, memberCount: 18, icmColor: 0x60a5fa,
      camOffset: [310, 200, 420],
      badge: 'Southern Rich Cluster • ~200 Galaxies', cls: '7 × 10¹³ M☉', radiusTxt: '62 Mly', vel: '1,379 km/s', sector: 'Laniakea Southern Wall',
      desc: 'Second-richest galaxy cluster within 100 Mly, featuring Fornax A (NGC 1316) and the Great Barred Spiral NGC 1365.'
    },
    {
      id: 'norma', name: 'Norma Cluster (Great Attractor)', shortName: 'Norma / Attractor',
      pos: [-1750, -240, -3100], radius: 420, memberCount: 30, icmColor: 0xf472b6,
      camOffset: [560, 340, 720],
      badge: 'Abell 3627 • Laniakea Focal Core', cls: '~10¹⁵ M☉ (Hidden Behind MW)', radiusTxt: '220 Mly', vel: '4,871 km/s', sector: 'Laniakea Gravitational Center',
      desc: 'Massive cluster obscured by our Milky Way’s Zone of Avoidance—sits at the bottom of the Laniakea gravitational watershed.'
    },
    {
      id: 'perseus', name: 'Perseus Cluster (Abell 426)', shortName: 'Perseus',
      pos: [2450, 420, 1850], radius: 390, memberCount: 24, icmColor: 0x818cf8,
      camOffset: [520, 310, 650],
      badge: 'X-Ray Brightest Sky Cluster', cls: '6.6 × 10¹⁴ M☉', radiusTxt: '240 Mly', vel: '5,366 km/s', sector: 'Perseus-Pisces Supercluster',
      desc: 'Brightest galaxy cluster in the X-ray sky; switch to X-Ray mode to see its 50-million-K glowing intracluster plasma halo.'
    },
    {
      id: 'coma', name: 'Coma Cluster (Abell 1656)', shortName: 'Coma',
      pos: [-1310, 1435, -3245], radius: 460, memberCount: 28, icmColor: 0x38bdf8,
      camOffset: [620, 360, 760],
      badge: 'Dense Spherical Cluster • 1,000+ Galaxies', cls: '1.8 × 10¹⁵ M☉ • Dark Matter Proof', radiusTxt: '321 Mly', vel: '6,925 km/s', sector: 'Coma Wall',
      desc: 'Where Fritz Zwicky first inferred Dark Matter in 1933—anchored by twin giant ellipticals NGC 4874 and NGC 4889.'
    },
    {
      id: 'bullet', name: 'Bullet Cluster (1E 0657-56)', shortName: 'Bullet Cluster',
      pos: [3450, -1450, -4850], radius: 480, memberCount: 22, icmColor: 0xff3b9a, isBullet: true,
      camOffset: [680, 340, 820],
      badge: 'Direct Dark Matter Collision Proof', cls: '2 × 10¹⁵ M☉ • Mach 3 Shock', radiusTxt: '3.7 Bly (z = 0.296)', vel: '4,500 km/s (Impact)', sector: 'Carina Deep Field',
      desc: 'Two colliding clusters where hot pink X-ray gas lags in a bow shock while collisionless blue Dark Matter halos pass cleanly through!'
    },
    {
      id: 'pandora', name: 'Pandora’s Cluster (Abell 2744)', shortName: 'Pandora’s Cluster',
      pos: [4650, -1620, 2950], radius: 450, memberCount: 18, icmColor: 0xa855f7,
      camOffset: [640, 340, 780],
      badge: '4-Cluster Mega-Merger', cls: '4 × 10¹⁵ M☉', radiusTxt: '3.5 Bly (z = 0.308)', vel: '350 Myr Collision', sector: 'Sculptor Deep Field',
      desc: 'Chaotic pile-up of four separate galaxy clusters simultaneously colliding, producing dramatic JWST gravitational lensing magnifications.'
    },
    {
      id: 'smacs0723', name: 'SMACS 0723 (Webb’s First Deep Field)', shortName: 'SMACS 0723',
      pos: [-4250, -1850, 4650], radius: 410, memberCount: 16, icmColor: 0x38bdf8, hasLensingArcs: true,
      camOffset: [580, 290, 740],
      badge: 'JWST Deep-Field Gravitational Lens', cls: '8 × 10¹⁴ M☉ • Einstein Arcs', radiusTxt: '4.6 Bly (z = 0.39)', vel: 'Magnifies z > 8 Galaxies', sector: 'Volans Deep Field',
      desc: 'Subject of JWST’s inaugural full-color release—its huge dark-matter mass bends distant background galaxies into sweeping amber arcs.'
    }
  ];

  // -------------------------------------------------------------------------
  // 8. LANIAKEA SUPERCLUSTER (Offset so Milky Way @ (0,0,0) sits INSIDE rim)
  // -------------------------------------------------------------------------
  const LANIAKEA = {
    id: 'laniakea',
    name: 'Laniakea Supercluster',
    center: [-1750, -240, -3100],      // Normalized ellipsoid dist of (0,0,0) = 0.763 (inside rim!)
    radii: [4400, 2900, 4800],
    attractor: [-1750, -240, -3100],   // Great Attractor / Norma Cluster
    localVoid: [1650, 620, 1850],      // Empty Local Void bordering our rim
    lobes: [
      { name: 'Virgo Lobe (Local Supercluster)', pos: [-680, 110, -1550] },
      { name: 'Hydra-Centaurus Lobe', pos: [-2020, -360, -2520] },
      { name: 'Pavo-Indus Lobe', pos: [-2650, -580, -3720] },
      { name: 'Great Attractor Basin', pos: [-1750, -240, -3100] },
      { name: 'Local Void (Empty Border)', pos: [1650, 620, 1850] }
    ],
    badge: 'Immeasurable Heaven • Watershed',
    cls: '10¹⁷ M☉ • ~100,000 Galaxies',
    radiusTxt: '520 Million ly Span',
    vel: '630 km/s Dipole Flow',
    sector: 'Home Supercluster',
    desc: 'Our home gravitational basin mapped via Cosmicflows velocity streamlines—the Milky Way sits near its outer Virgo-lobe rim bordering the Local Void.'
  };

  // -------------------------------------------------------------------------
  // 9. QUIPU & 4 COMPANION SUPERSTRUCTURES (Böhringer et al. 2025 Tier)
  //    Cleanly placed at 11,500–24,500 units, well inside CMB dome (145,000)
  // -------------------------------------------------------------------------
  const SUPERSTRUCTURES = [
    {
      id: 'quipu', name: 'Quipu Superstructure (2025)', shortName: 'Quipu',
      knots: 68, color: 0xfb7185, accent: 0xfbbf24,
      spine: [
        [-14500, 2400, -11200],
        [-12800, 900, -14800],
        [-9400, -600, -17400],
        [-5200, -1500, -18900],
        [-1200, -800, -19600],
        [3400, 600, -18200],
        [7800, 1800, -15400]
      ],
      branches: [
        [[-12800, 900, -14800], [-15200, -1100, -16200]],
        [[-9400, -600, -17400], [-10400, -3200, -19600]],
        [[-5200, -1500, -18900], [-4600, 1400, -21800]],
        [[-1200, -800, -19600], [600, -3600, -21400]],
        [[3400, 600, -18200], [5200, 3100, -20100]]
      ],
      labelPos: [-4200, -100, -18800],
      camPos: [-3200, 6800, -5200],
      badge: 'Largest Known Superstructure (2025)',
      cls: '2.0 × 10¹⁷ M☉ • 68 Clusters',
      radiusTxt: '1.3 Billion ly Length',
      vel: '425–815 Mly Distance',
      sector: 'Nearby Cosmic Web',
      desc: 'Discovered in 2025 via X-ray cluster surveys and named after Incan knotted cords: one sweeping filament with hanging cluster side-branches.'
    },
    {
      id: 'shapley', name: 'Shapley Superstructure', shortName: 'Shapley',
      knots: 45, color: 0x38bdf8, accent: 0x93c5fd,
      spine: [
        [-11400, -2100, -11800],
        [-13200, -2800, -10200],
        [-14800, -2400, -8200],
        [-15900, -1600, -6100]
      ],
      branches: [
        [[-13200, -2800, -10200], [-15400, -4200, -11600]]
      ],
      labelPos: [-13600, -2200, -9600],
      camPos: [-7500, 2200, -3500],
      badge: '2nd Largest Nearby Superstructure',
      cls: '1.6 × 10¹⁷ M☉ • 45 Clusters',
      radiusTxt: '650 Mly Distance',
      vel: 'Pulls Laniakea Basin',
      sector: 'Centaurus-Hydra Behind',
      desc: 'Massive concentration of galaxy clusters directly behind the Great Attractor, providing a major gravitational pull on Laniakea.'
    },
    {
      id: 'sculptor_peg', name: 'Sculptor-Pegasus Superstructure', shortName: 'Sculptor-Pegasus',
      knots: 40, color: 0xa78bfa, accent: 0xe879f9,
      spine: [
        [11800, -4200, 6800],
        [14600, -1900, 9800],
        [16200, 1200, 12400],
        [14800, 3800, 14600]
      ],
      branches: [
        [[14600, -1900, 9800], [17400, -3600, 8200]]
      ],
      labelPos: [14800, -600, 10800],
      camPos: [6800, 3500, 4800],
      badge: 'Southern Filament Superstructure',
      cls: '1.1 × 10¹⁷ M☉ • 40 Clusters',
      radiusTxt: '520–780 Mly',
      vel: 'Cosmic Web Wall',
      sector: 'Sculptor-Pegasus',
      desc: 'Vast curving supercluster bridge spanning the southern extragalactic sky opposite the Shapley concentration.'
    },
    {
      id: 'serpens_crb', name: 'Serpens-Corona Borealis', shortName: 'Serpens-CrB',
      knots: 34, color: 0x34d399, accent: 0x6ee7b7,
      spine: [
        [-9200, 9600, -8400],
        [-7400, 11800, -6200],
        [-4800, 13400, -4100]
      ],
      branches: [],
      labelPos: [-7200, 11800, -6200],
      camPos: [-1200, 14500, 3800],
      badge: 'Northern Cosmic Wall',
      cls: '8.5 × 10¹⁶ M☉ • 34 Clusters',
      radiusTxt: '600–800 Mly',
      vel: 'Northern Hemisphere',
      sector: 'Corona Borealis',
      desc: 'Dense northern superstructure curving above the Coma Wall, mapped alongside Quipu in the 2025 ROSAT/eROSITA census.'
    },
    {
      id: 'hercules', name: 'Hercules Superstructure', shortName: 'Hercules',
      knots: 28, color: 0xfbbf24, accent: 0xfde68a,
      spine: [
        [-14200, 6200, 8400],
        [-12800, 7400, 10900],
        [-10600, 8200, 13100]
      ],
      branches: [],
      labelPos: [-12600, 7400, 10900],
      camPos: [-5200, 9200, 4200],
      badge: 'Great Wall Filament',
      cls: '6.8 × 10¹⁶ M☉ • 28 Clusters',
      radiusTxt: '500 Mly',
      vel: 'CfA2 Great Wall Link',
      sector: 'Hercules',
      desc: 'Rich spiral-heavy superstructure linking the CfA2 Great Wall into the broader 2025 local cosmic web.'
    }
  ];

  // -------------------------------------------------------------------------
  // 10. COSMIC DAWN FRONTIER & PLANCK CMB HORIZON (78k – 145k Units)
  // -------------------------------------------------------------------------
  const COSMIC_DAWN = [
    {
      id: 'momz14', name: 'MoM-z14 (Cosmic Dawn Record)', shortName: 'MoM-z14',
      pos: [52000, 26000, -62000], color: 0xff4d6d,
      camPos: [44000, 24000, -52000],
      badge: 'JWST Record High-z Galaxy', cls: 'z = 14.44 • ~280 Myr Post-BB', radiusTxt: '33.8 Bly (Comoving)', vel: '13.53 Gyr Lookback', sector: 'Cosmic Dawn Frontier',
      desc: 'Spectroscopically confirmed JWST frontier galaxy seen just ~280 million years after the Big Bang—surprisingly luminous and nitrogen-rich.'
    },
    {
      id: 'jadesz14', name: 'JADES-GS-z14-0', shortName: 'JADES-z14',
      pos: [-56000, -22000, 58000], color: 0xff6b81,
      camPos: [-47000, -18000, 49000],
      badge: 'JWST Ultra-Distant Galaxy', cls: 'z = 14.18 • 1,600 ly Wide', radiusTxt: '33.6 Bly (Comoving)', vel: '13.52 Gyr Lookback', sector: 'GOODS-South Deep Field',
      desc: 'Surprisingly bright, extended early-universe galaxy detected by JWST NIRSpec with unexpected traces of oxygen.'
    }
  ];

  // -------------------------------------------------------------------------
  // 11. DETERMINISTIC PROCEDURAL GENERATOR FOR 184 CLUSTER MEMBER GALAXIES
  // -------------------------------------------------------------------------
  function seededRandom(seed) {
    let s = seed % 2147483647;
    if (s <= 0) s += 2147483646;
    return function () {
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646;
    };
  }

  function generateClusterMemberGalaxies() {
    const rand = seededRandom(421337);
    const members = [];

    CLUSTERS.forEach(function (cl) {
      for (let i = 0; i < cl.memberCount; i++) {
        const u = rand();
        const v = rand();
        const theta = u * Math.PI * 2;
        const phi = Math.acos(2 * v - 1);
        const rFrac = Math.pow(rand(), 0.72) * 0.92 + 0.08;
        let r = cl.radius * rFrac;

        let cx = cl.pos[0];
        let cy = cl.pos[1];
        let cz = cl.pos[2];
        if (cl.isBullet) {
          const side = i % 2 === 0 ? -1 : 1;
          cx += side * 210;
          r *= 0.52;
        }

        const px = cx + r * Math.sin(phi) * Math.cos(theta);
        const py = cy + r * Math.cos(phi) * 0.78;
        const pz = cz + r * Math.sin(phi) * Math.sin(theta);

        const tRoll = rand();
        let type = 'elliptical';
        if (rFrac > 0.45 && tRoll > 0.42) {
          type = tRoll > 0.72 ? 'barred' : 'spiral';
        } else if (tRoll > 0.65) {
          type = 'lenticular';
        }

        const galRadius = 11 + rand() * 19;
        const starCount = Math.floor(240 + rand() * 340);
        const dustCount = type === 'elliptical' ? 0 : Math.floor(14 + rand() * 24);

        members.push({
          id: 'cl_' + cl.id + '_' + i,
          name: cl.shortName + ' Member #' + (i + 1),
          type: type,
          pos: [px, py, pz],
          rot: [rand() * Math.PI, rand() * Math.PI * 2, rand() * Math.PI],
          radius: galRadius,
          stars: starCount,
          dust: dustCount,
          arms: type === 'spiral' || type === 'barred' ? (rand() > 0.5 ? 2 : 3) : 0,
          twist: 3.4 + rand() * 1.8,
          bulgeCol: type === 'elliptical' ? 0xffe0ad : 0xffd79e,
          armCol: type === 'elliptical' ? 0xffcf88 : 0x8cc2ff,
          omega: type === 'elliptical' ? 0.02 : 0.08 + rand() * 0.04,
          isClusterMember: true
        });
      }
    });

    return members;
  }

  // -------------------------------------------------------------------------
  // 12. CAMERA PRESETS (Match exact IDs in index.html)
  // -------------------------------------------------------------------------
  const PRESETS = {
    sgra: {
      id: 'sgra',
      label: 'Sgr A* Gargantua',
      camPos: [0.0, 0.72, 3.85],
      target: [0, 0, 0],
      badge: 'Kerr SMBH • Gargantua Engine',
      title: 'Sagittarius A* (Sgr A*)',
      cls: '4.154 × 10⁶ M☉',
      radius: '0.00 kpc (Origin)',
      vel: 'ISCO ≈ 0.5c',
      sector: 'Galactic Core',
      desc: 'Milky Way supermassive black hole rendered via curved-spacetime geodesic ray-marching. Drag vertically to watch the rear disk warp above and below the shadow!'
    },
    sstars: {
      id: 'sstars',
      label: 'Sgr A* S-Stars',
      camPos: [4.8, 5.4, 8.8],
      target: [0, 0, 0],
      badge: 'Relativistic Rosette Orbits',
      title: 'Sgr A* Extreme S-Stars',
      cls: 'S2 • S4716 • S4714',
      radius: '12 – 1,000 AU',
      vel: 'Up to 8% Speed of Light',
      sector: 'Galactic Center',
      desc: 'Kepler-solved inner stars racing around Sagittarius A* with live rotating apsidal lines tracing multi-petal Schwarzschild rosette precession.'
    },
    sol: {
      id: 'sol',
      label: 'Solar System',
      camPos: [28.2, 2.2, 7.6],
      target: [26.0, 0.35, 3.2],
      badge: 'G2V Main Sequence • Home',
      title: 'Sol (Solar System)',
      cls: '1.00 M☉ • 8 Planets',
      radius: '8.18 kpc (26,670 ly)',
      vel: '230 km/s Galactic',
      sector: 'Orion-Cygnus Spur',
      desc: 'Our Solar System nestled along the inner edge of the Orion Spur, surrounded by nearby landmarks Alpha Centauri, Sirius, Vega, and Orion M42.'
    },
    milkyway: {
      id: 'milkyway',
      label: 'Milky Way Disk',
      camPos: [0, 74, 118],
      target: [0, 0, 0],
      badge: 'SBbc Barred Spiral • Home',
      title: 'Milky Way Galaxy',
      cls: '1.15 × 10¹² M☉ • 4 Arms',
      radius: '105,700 ly Diameter',
      vel: '230 km/s (Flat Curve)',
      sector: 'Local Group',
      desc: 'GPU-rotated barred spiral featuring four major arms, dark optical dust lanes (switch to MIRI to make them glow!), 23 landmark stars, and 4 3D nebulae.'
    },
    fermi: {
      id: 'fermi',
      label: 'Fermi / eROSITA',
      camPos: [72, 18, 96],
      target: [0, 0, 0],
      badge: 'Bipolar Galactic Outflows',
      title: 'Fermi & eROSITA Bubbles',
      cls: '25k ly Gamma • 45k ly X-Ray',
      radius: '±45,000 ly Bipolar',
      vel: '~1,000 km/s Shockwave',
      sector: 'Milky Way Halo',
      desc: 'Twin magenta Fermi gamma-ray lobes nested inside towering cyan eROSITA soft X-ray hourglass shells—switch to X-Ray mode to see them blaze!'
    },
    localgroup: {
      id: 'localgroup',
      label: 'Local Group 3D',
      camPos: [140, 310, 620],
      target: [145, 25, -180],
      badge: '10 Mly Gravitational Group',
      title: 'Local Group of Galaxies',
      cls: '~3 × 10¹² M☉ • 80+ Galaxies',
      radius: '10 Million ly Span',
      vel: 'MW–M31 Bound Pair',
      sector: 'Laniakea Outer Rim',
      desc: 'Anchored by the Milky Way and Andromeda (M31), accompanied by Triangulum (M33), the Magellanic Clouds, M32, M110, and Barnard’s Galaxy.'
    },
    clusters: {
      id: 'clusters',
      label: 'Galaxy Clusters',
      camPos: [1950, 2650, 4150],
      target: [-450, 120, -1450],
      badge: '8 Rich Clusters • 229 Galaxies',
      title: 'Nearby & Deep Galaxy Clusters',
      cls: 'Virgo • Coma • Bullet • SMACS',
      radius: '50 Mly – 4.6 Bly',
      vel: 'Switch to X-Ray for ICM Gas',
      sector: 'Local Universe',
      desc: 'Explore Virgo, Fornax, Norma, Perseus, Coma, the Bullet Cluster’s dark-matter separation, Pandora’s Cluster, and SMACS 0723’s lensing arcs.'
    },
    laniakea: {
      id: 'laniakea',
      label: 'Laniakea Basin',
      camPos: [4600, 4400, 5600],
      target: [-1750, -240, -3100],
      badge: 'Home Supercluster Watershed',
      title: 'Laniakea Supercluster',
      cls: '10¹⁷ M☉ • ~100,000 Galaxies',
      radius: '520 Million ly Span',
      vel: 'Flows → Great Attractor',
      sector: 'Cosmic Web Basin',
      desc: 'Offset gravitational watershed showing our Milky Way nestled inside its outer Virgo-lobe rim bordering the Local Void, flowing into Norma.'
    },
    quipu: {
      id: 'quipu',
      label: 'Quipu Superstr.',
      camPos: [5500, 16500, 15500],
      target: [-4500, 600, -11500],
      badge: '2025 Cosmic Web Tier',
      title: 'Quipu & 4 Superstructures',
      cls: 'Quipu • Shapley • Sculptor-Peg',
      radius: '1.3 Billion ly Filament',
      vel: '425 – 815 Mly Shell',
      sector: 'Large-Scale Structure',
      desc: 'Five colossal nearby superstructures mapped in 2025—accounting for ~45% of local galaxy clusters—viewed cleanly against deep dark space.'
    },
    horizon: {
      id: 'horizon',
      label: 'Cosmic Horizon',
      camPos: [58000, 46000, 84000],
      target: [0, 0, 0],
      badge: 'Planck CMB • z = 1100',
      title: 'Observable Universe & CMB',
      cls: '93 Billion ly Diameter',
      radius: '380,000 yr Post-Big Bang',
      vel: 'T₀ = 2.7255 K Anisotropy',
      sector: 'Cosmic Microwave Background',
      desc: 'Enlarged glare-free Planck CMB anisotropy sphere (r = 145,000) framing JWST’s Cosmic Dawn frontier (MoM-z14, JADES-GS-z14-0, and 28 Little Red Dots).'
    }
  };

  // -------------------------------------------------------------------------
  // 13. UNIFIED INSPECTOR & DIRECTORY BUILDER
  // -------------------------------------------------------------------------
  const INSPECTOR_LOOKUP = {};
  const DIRECTORY_TABS = {
    stars: [],
    galaxies: [],
    clusters: [],
    cosmic: []
  };

  Object.keys(PRESETS).forEach(function (k) {
    INSPECTOR_LOOKUP[k] = PRESETS[k];
  });

  BLACK_HOLES.forEach(function (bh) {
    INSPECTOR_LOOKUP[bh.id] = {
      id: bh.id,
      label: bh.shortName,
      title: bh.name,
      badge: bh.badge,
      cls: bh.cls,
      radius: bh.radius,
      vel: bh.vel,
      sector: bh.sector,
      desc: bh.desc,
      target: bh.pos,
      camPos: [bh.pos[0] + bh.camOffset[0], bh.pos[1] + bh.camOffset[1], bh.pos[2] + bh.camOffset[2]]
    };
  });

  S_STARS.forEach(function (s) {
    INSPECTOR_LOOKUP[s.id] = {
      id: s.id,
      label: s.name,
      title: s.name,
      badge: s.badge,
      cls: s.cls,
      radius: s.radius,
      vel: s.vel,
      sector: s.sector,
      desc: s.desc,
      target: [0, 0, 0],
      camPos: [4.2, 4.8, 7.6]
    };
    DIRECTORY_TABS.stars.push({ id: s.id, label: s.name });
  });

  LANDMARK_STARS.forEach(function (st) {
    INSPECTOR_LOOKUP[st.id] = {
      id: st.id,
      label: st.name.split(' (')[0],
      title: st.name,
      badge: st.badge,
      cls: st.cls,
      radius: st.radius,
      vel: st.vel,
      sector: st.sector,
      desc: st.desc,
      target: st.pos,
      camPos: [st.pos[0] + 3.2, st.pos[1] + 2.1, st.pos[2] + 5.2]
    };
    DIRECTORY_TABS.stars.push({ id: st.id, label: st.name.split(' (')[0] });
  });

  NEBULAE.forEach(function (n) {
    INSPECTOR_LOOKUP[n.id] = {
      id: n.id,
      label: n.name.split(' (')[0],
      title: n.name,
      badge: n.badge,
      cls: n.cls,
      radius: n.radiusTxt,
      vel: n.vel,
      sector: n.sector,
      desc: n.desc,
      target: n.pos,
      camPos: [n.pos[0] + n.radius * 1.9, n.pos[1] + n.radius * 1.1, n.pos[2] + n.radius * 2.4]
    };
    DIRECTORY_TABS.stars.push({ id: n.id, label: n.name.split(' (')[0] });
  });

  NAMED_GALAXIES.forEach(function (g) {
    if (!INSPECTOR_LOOKUP[g.id]) {
      const dist = Math.max(g.radius * 2.35, 24);
      INSPECTOR_LOOKUP[g.id] = {
        id: g.id,
        label: g.shortName,
        title: g.name,
        badge: g.badge,
        cls: g.cls,
        radius: g.radiusTxt,
        vel: g.vel,
        sector: g.sector,
        desc: g.desc,
        target: g.pos,
        camPos: [g.pos[0] + dist * 0.55, g.pos[1] + dist * 0.48, g.pos[2] + dist * 0.95]
      };
    }
    DIRECTORY_TABS.galaxies.push({ id: g.id, label: g.shortName });
  });

  CLUSTERS.forEach(function (cl) {
    INSPECTOR_LOOKUP[cl.id] = {
      id: cl.id,
      label: cl.shortName,
      title: cl.name,
      badge: cl.badge,
      cls: cl.cls,
      radius: cl.radiusTxt,
      vel: cl.vel,
      sector: cl.sector,
      desc: cl.desc,
      target: cl.pos,
      camPos: [cl.pos[0] + cl.camOffset[0], cl.pos[1] + cl.camOffset[1], cl.pos[2] + cl.camOffset[2]]
    };
    DIRECTORY_TABS.clusters.push({ id: cl.id, label: cl.shortName });
  });

  DIRECTORY_TABS.cosmic.push({ id: 'laniakea', label: 'Laniakea Basin' });
  SUPERSTRUCTURES.forEach(function (sup) {
    INSPECTOR_LOOKUP[sup.id] = {
      id: sup.id,
      label: sup.shortName,
      title: sup.name,
      badge: sup.badge,
      cls: sup.cls,
      radius: sup.radiusTxt,
      vel: sup.vel,
      sector: sup.sector,
      desc: sup.desc,
      target: sup.labelPos,
      camPos: sup.camPos
    };
    DIRECTORY_TABS.cosmic.push({ id: sup.id, label: sup.shortName });
  });

  COSMIC_DAWN.forEach(function (cd) {
    INSPECTOR_LOOKUP[cd.id] = {
      id: cd.id,
      label: cd.shortName,
      title: cd.name,
      badge: cd.badge,
      cls: cd.cls,
      radius: cd.radiusTxt,
      vel: cd.vel,
      sector: cd.sector,
      desc: cd.desc,
      target: cd.pos,
      camPos: cd.camPos
    };
    DIRECTORY_TABS.cosmic.push({ id: cd.id, label: cd.shortName });
  });
  DIRECTORY_TABS.cosmic.push({ id: 'horizon', label: 'Planck CMB' });

  return {
    BLACK_HOLES: BLACK_HOLES,
    S_STARS: S_STARS,
    LANDMARK_STARS: LANDMARK_STARS,
    NEBULAE: NEBULAE,
    SPIRAL_ARMS: SPIRAL_ARMS,
    NAMED_GALAXIES: NAMED_GALAXIES,
    CLUSTERS: CLUSTERS,
    LANIAKEA: LANIAKEA,
    SUPERSTRUCTURES: SUPERSTRUCTURES,
    COSMIC_DAWN: COSMIC_DAWN,
    PRESETS: PRESETS,
    INSPECTOR_LOOKUP: INSPECTOR_LOOKUP,
    DIRECTORY_TABS: DIRECTORY_TABS,
    generateClusterMemberGalaxies: generateClusterMemberGalaxies
  };
})();
