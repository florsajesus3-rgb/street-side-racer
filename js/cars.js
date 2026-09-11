/** Street Side Racer — free roster, factory engines, earnable upgrades (no IAP). */
(function (global) {
  'use strict';

  const STORAGE_KEY = 'ssr-progress-v2';

  /**
   * Engine mods stack on factory engine:
   * powerMul, torqueFeel (launch punch), launchGripMul, redline, perfectLo/Hi, weightMul, nitroMul
   */
  const ENGINES = {
    mustang: [
      { id: 'eco23', name: '2.3L EcoBoost', hp: 310, tq: 350, powerMul: 0.86, launchGripMul: 1.06, redline: 6800, perfectLo: 5400, perfectHi: 6400, weightMul: 0.96, nitroMul: 0.95 },
      { id: 'coyote50', name: '5.0L Coyote V8', hp: 450, tq: 410, powerMul: 1.0, launchGripMul: 1.0, redline: 7500, perfectLo: 6200, perfectHi: 7200, weightMul: 1.0, nitroMul: 1.0 },
      { id: 'darkhorse', name: '5.0L Dark Horse', hp: 500, tq: 410, powerMul: 1.08, launchGripMul: 0.96, redline: 7600, perfectLo: 6400, perfectHi: 7400, weightMul: 1.01, nitroMul: 1.02 },
    ],
    supra: [
      { id: 'b48', name: '2.0L B48', hp: 255, tq: 295, powerMul: 0.82, launchGripMul: 1.08, redline: 7000, perfectLo: 5600, perfectHi: 6600, weightMul: 0.94, nitroMul: 0.92 },
      { id: 'b58', name: '3.0L B58', hp: 382, tq: 368, powerMul: 1.0, launchGripMul: 1.0, redline: 8700, perfectLo: 7400, perfectHi: 8400, weightMul: 1.0, nitroMul: 1.0 },
    ],
    camaro: [
      { id: 'lTG', name: '2.0L Turbo', hp: 275, tq: 295, powerMul: 0.8, launchGripMul: 1.1, redline: 6500, perfectLo: 5200, perfectHi: 6200, weightMul: 0.92, nitroMul: 0.9 },
      { id: 'lgx', name: '3.6L V6', hp: 335, tq: 284, powerMul: 0.9, launchGripMul: 1.04, redline: 7000, perfectLo: 5800, perfectHi: 6800, weightMul: 0.97, nitroMul: 0.95 },
      { id: 'lt1', name: '6.2L LT1 V8', hp: 455, tq: 455, powerMul: 1.0, launchGripMul: 1.0, redline: 7200, perfectLo: 5900, perfectHi: 6900, weightMul: 1.0, nitroMul: 1.0 },
      { id: 'lt4', name: '6.2L LT4 ZL1', hp: 650, tq: 650, powerMul: 1.22, launchGripMul: 0.82, redline: 6400, perfectLo: 5200, perfectHi: 6100, weightMul: 1.06, nitroMul: 1.08 },
    ],
    challenger: [
      { id: 'pentastar', name: '3.6L Pentastar', hp: 305, tq: 268, powerMul: 0.78, launchGripMul: 1.08, redline: 6400, perfectLo: 5000, perfectHi: 6000, weightMul: 0.95, nitroMul: 0.9 },
      { id: 'hemi57', name: '5.7L HEMI', hp: 375, tq: 410, powerMul: 0.94, launchGripMul: 0.98, redline: 5800, perfectLo: 4600, perfectHi: 5500, weightMul: 1.0, nitroMul: 1.0 },
      { id: '392', name: '6.4L 392', hp: 485, tq: 475, powerMul: 1.06, launchGripMul: 0.9, redline: 6400, perfectLo: 5200, perfectHi: 6100, weightMul: 1.04, nitroMul: 1.05 },
      { id: 'hellcat', name: '6.2L Hellcat SC', hp: 717, tq: 656, powerMul: 1.32, launchGripMul: 0.72, redline: 6250, perfectLo: 5000, perfectHi: 5900, weightMul: 1.1, nitroMul: 1.12 },
    ],
    charger: [
      { id: 'hemi57', name: '5.7L HEMI', hp: 370, tq: 395, powerMul: 0.95, launchGripMul: 0.98, redline: 5800, perfectLo: 4600, perfectHi: 5500, weightMul: 1.0, nitroMul: 1.0 },
      { id: '392', name: '6.4L 392 Scat Pack', hp: 485, tq: 475, powerMul: 1.08, launchGripMul: 0.88, redline: 6400, perfectLo: 5200, perfectHi: 6100, weightMul: 1.04, nitroMul: 1.05 },
      { id: 'hellcat', name: '6.2L Hellcat SC', hp: 707, tq: 650, powerMul: 1.34, launchGripMul: 0.7, redline: 6250, perfectLo: 5000, perfectHi: 5900, weightMul: 1.12, nitroMul: 1.15 },
    ],
    skyline: [
      { id: 'rb20', name: 'RB20DET', hp: 215, tq: 195, powerMul: 0.78, launchGripMul: 1.12, redline: 8000, perfectLo: 6600, perfectHi: 7600, weightMul: 0.92, nitroMul: 0.9 },
      { id: 'rb26', name: 'RB26DETT', hp: 276, tq: 271, powerMul: 1.0, launchGripMul: 1.08, redline: 9000, perfectLo: 7600, perfectHi: 8700, weightMul: 1.0, nitroMul: 1.0 },
      { id: 'rb26n1', name: 'RB26 N1 Spec', hp: 330, tq: 290, powerMul: 1.1, launchGripMul: 1.02, redline: 9200, perfectLo: 7800, perfectHi: 8900, weightMul: 0.99, nitroMul: 1.05 },
    ],
  };

  const CARS = [
    {
      id: 'mustang',
      name: 'Ford Mustang (S550/S650)',
      short: 'MUSTANG',
      color: '#c41230',
      accent: '#f0e6d2',
      defaultEngine: 'coyote50',
      power: 1.02,
      redline: 7500,
      perfectLo: 6200,
      perfectHi: 7200,
      ratios: [0, 3.66, 2.43, 1.69, 1.32, 1.0, 0.79],
      finalDrive: 3.55,
      nitroMax: 1,
      tireCirc: 7.0,
      launchGrip: 0.92,
      weight: 1.05,
      rivalPower: 0.97,
    },
    {
      id: 'supra',
      name: 'Toyota GR Supra (A90)',
      short: 'SUPRA',
      color: '#d4d4d4',
      accent: '#e10600',
      defaultEngine: 'b58',
      power: 1.0,
      redline: 8700,
      perfectLo: 7400,
      perfectHi: 8400,
      ratios: [0, 3.5, 2.2, 1.55, 1.18, 0.95, 0.8],
      finalDrive: 3.15,
      nitroMax: 1.05,
      tireCirc: 6.7,
      launchGrip: 1.0,
      weight: 0.95,
      rivalPower: 0.98,
    },
    {
      id: 'camaro',
      name: 'Chevy Camaro (6th gen)',
      short: 'CAMARO',
      color: '#1a5cff',
      accent: '#ffd200',
      defaultEngine: 'lt1',
      power: 1.04,
      redline: 7200,
      perfectLo: 5900,
      perfectHi: 6900,
      ratios: [0, 3.75, 2.5, 1.75, 1.35, 1.05, 0.84],
      finalDrive: 3.73,
      nitroMax: 1,
      tireCirc: 7.05,
      launchGrip: 0.9,
      weight: 1.08,
      rivalPower: 0.96,
    },
    {
      id: 'challenger',
      name: 'Dodge Challenger',
      short: 'CHALLENGER',
      color: '#1a1a1a',
      accent: '#ff6600',
      defaultEngine: 'hemi57',
      power: 1.06,
      redline: 6400,
      perfectLo: 5200,
      perfectHi: 6100,
      ratios: [0, 3.9, 2.55, 1.8, 1.4, 1.1, 0.9],
      finalDrive: 3.09,
      nitroMax: 1.1,
      tireCirc: 7.15,
      launchGrip: 0.88,
      weight: 1.12,
      rivalPower: 0.95,
    },
    {
      id: 'charger',
      name: 'Dodge Charger (2015–23)',
      short: 'CHARGER',
      color: '#6e0b14',
      accent: '#c0c0c0',
      defaultEngine: 'hemi57',
      power: 1.05,
      redline: 5800,
      perfectLo: 4600,
      perfectHi: 5500,
      ratios: [0, 3.9, 2.55, 1.8, 1.41, 1.0, 0.84],
      finalDrive: 3.09,
      nitroMax: 1.08,
      tireCirc: 7.2,
      launchGrip: 0.9,
      weight: 1.14,
      rivalPower: 0.94,
    },
    {
      id: 'skyline',
      name: 'Nissan Skyline GT-R',
      short: 'SKYLINE',
      color: '#2f5f9e',
      accent: '#c0c8d0',
      defaultEngine: 'rb26',
      power: 0.99,
      redline: 9000,
      perfectLo: 7600,
      perfectHi: 8700,
      ratios: [0, 3.3, 2.05, 1.45, 1.1, 0.9, 0.76],
      finalDrive: 3.54,
      nitroMax: 1.08,
      tireCirc: 6.65,
      launchGrip: 1.08,
      weight: 0.93,
      rivalPower: 0.99,
    },
  ];

  // "engine" upgrade id = bolt-on built power (not factory engine swap)
  const UPGRADE_DEFS = [
    { id: 'engine', name: 'Built power', max: 5, cost: [0, 400, 900, 1600, 2800, 4200], desc: 'Headwork / boost / tune on top of factory mill' },
    { id: 'tires', name: 'Tires', max: 5, cost: [0, 300, 700, 1300, 2200, 3400], desc: 'Launch grip' },
    { id: 'nitro', name: 'Nitrous', max: 5, cost: [0, 350, 800, 1500, 2500, 3800], desc: 'Boost tank' },
    { id: 'ecu', name: 'ECU tune', max: 5, cost: [0, 450, 1000, 1800, 3000, 4500], desc: 'Shift window' },
    { id: 'body', name: 'Body kit', max: 3, cost: [0, 500, 1200, 2200], desc: 'Cosmetic widebody' },
  ];

  const RIM_STYLES = ['spoke5', 'mesh', 'star', 'deepdish', 'turbine'];
  const UNDERGLOW_OPTS = ['off', 'blue', 'purple', 'red', 'green', 'cyan'];

  const COSMETIC_COLORS = {
    mustang: ['#c41230', '#111111', '#f5f5f5', '#0033a0'],
    supra: ['#d4d4d4', '#e10600', '#222222', '#1b4d3e'],
    camaro: ['#1a5cff', '#ffd200', '#111111', '#c41230'],
    challenger: ['#1a1a1a', '#ff6600', '#7a0000', '#f0f0f0'],
    charger: ['#6e0b14', '#0a0a0a', '#c0c0c0', '#1a3a6e', '#f5f5f5'],
    skyline: ['#2f5f9e', '#b0b8c0', '#111111', '#6b2d5c'],
  };

  function enginesFor(carId) {
    return ENGINES[carId] || [];
  }

  function getEngine(carId, engineId) {
    const list = enginesFor(carId);
    return list.find((e) => e.id === engineId) || list[0] || null;
  }

  function defaultProgress() {
    const upgrades = {};
    const colors = {};
    const engines = {};
    const rims = {};
    const underglow = {};
    for (const c of CARS) {
      upgrades[c.id] = { engine: 0, tires: 0, nitro: 0, ecu: 0, body: 0 };
      colors[c.id] = 0;
      engines[c.id] = c.defaultEngine;
      rims[c.id] = 0;
      underglow[c.id] = 'off';
    }
    return {
      cash: 500,
      selected: 'charger',
      unlocked: CARS.map((c) => c.id),
      upgrades,
      colors,
      engines,
      rims,
      underglow,
      wins: 0,
      races: 0,
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem('ssr-progress-v1');
      if (!raw) return defaultProgress();
      const p = { ...defaultProgress(), ...JSON.parse(raw) };
      p.unlocked = CARS.map((c) => c.id);
      p.engines = p.engines || {};
      p.rims = p.rims || {};
      p.underglow = p.underglow || {};
      for (const c of CARS) {
        p.upgrades[c.id] = { engine: 0, tires: 0, nitro: 0, ecu: 0, body: 0, ...(p.upgrades[c.id] || {}) };
        if (p.colors[c.id] == null) p.colors[c.id] = 0;
        if (p.rims[c.id] == null) p.rims[c.id] = 0;
        if (!p.underglow[c.id]) p.underglow[c.id] = 'off';
        if (!p.engines[c.id] || !getEngine(c.id, p.engines[c.id])) {
          p.engines[c.id] = c.defaultEngine;
        }
      }
      if (!p.unlocked.includes(p.selected)) p.selected = 'charger';
      return p;
    } catch {
      return defaultProgress();
    }
  }

  function save(p) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  }

  function getCar(id) {
    return CARS.find((c) => c.id === id) || CARS[0];
  }

  function appliedStats(carId, progress) {
    const base = getCar(carId);
    const u = progress.upgrades[carId] || {};
    const eng = getEngine(carId, (progress.engines || {})[carId] || base.defaultEngine);
    const built = u.engine || 0;
    const tires = u.tires || 0;
    const nitro = u.nitro || 0;
    const ecu = u.ecu || 0;
    const body = u.body || 0;
    const colorIdx = progress.colors[carId] || 0;
    const palette = COSMETIC_COLORS[carId] || [base.color];
    const widen = 1 + body * 0.04;

    const redline = (eng ? eng.redline : base.redline) + ecu * 50;
    const perfectLo = (eng ? eng.perfectLo : base.perfectLo) - ecu * 32;
    const perfectHi = Math.min(redline - 80, (eng ? eng.perfectHi : base.perfectHi) + ecu * 48);

    const weight = base.weight * (eng ? eng.weightMul : 1);
    const power =
      base.power *
      (eng ? eng.powerMul : 1) *
      (1 + built * 0.055) /
      (weight * (1 - tires * 0.01));

    // Hellcat / big SC mills: tires help a lot, but base grip stays mean
    let launchGrip = base.launchGrip * (eng ? eng.launchGripMul : 1) * (1 + tires * 0.05);
    if (eng && eng.id === 'hellcat') {
      launchGrip *= 0.95; // still tricksy even with sticky tires
    }

    return {
      ...base,
      color: palette[colorIdx % palette.length],
      power,
      launchGrip,
      nitroMax: base.nitroMax * (eng ? eng.nitroMul : 1) * (1 + nitro * 0.08),
      perfectLo,
      perfectHi,
      redline,
      bodyLevel: body,
      scaleX: widen,
      label: base.short,
      engineId: eng ? eng.id : null,
      engineName: eng ? eng.name : 'Stock',
      hp: eng ? eng.hp : null,
      tq: eng ? eng.tq : null,
      trickyLaunch: !!(eng && eng.launchGripMul < 0.85),
      rimIndex: (progress.rims && progress.rims[carId]) || 0,
      rimStyle: RIM_STYLES[((progress.rims && progress.rims[carId]) || 0) % RIM_STYLES.length],
      underglow: (progress.underglow && progress.underglow[carId]) || 'off',
    };
  }

  function cycleRim(carId) {
    const p = load();
    p.rims = p.rims || {};
    p.rims[carId] = ((p.rims[carId] || 0) + 1) % RIM_STYLES.length;
    save(p);
    return p;
  }

  function cycleUnderglow(carId) {
    const p = load();
    p.underglow = p.underglow || {};
    const cur = p.underglow[carId] || 'off';
    const i = UNDERGLOW_OPTS.indexOf(cur);
    p.underglow[carId] = UNDERGLOW_OPTS[(i + 1) % UNDERGLOW_OPTS.length];
    save(p);
    return p;
  }

  function upgradeCost(carId, upgradeId, progress) {
    const def = UPGRADE_DEFS.find((d) => d.id === upgradeId);
    if (!def) return null;
    const level = (progress.upgrades[carId] || {})[upgradeId] || 0;
    if (level >= def.max) return null;
    return def.cost[level + 1];
  }

  function buyUpgrade(carId, upgradeId) {
    const p = load();
    const cost = upgradeCost(carId, upgradeId, p);
    if (cost == null || p.cash < cost) return { ok: false, progress: p, reason: 'cant' };
    p.cash -= cost;
    p.upgrades[carId][upgradeId] = (p.upgrades[carId][upgradeId] || 0) + 1;
    save(p);
    return { ok: true, progress: p };
  }

  function selectEngine(carId, engineId) {
    const p = load();
    if (!getEngine(carId, engineId)) return p;
    p.engines[carId] = engineId;
    save(p);
    return p;
  }

  function cycleColor(carId) {
    const p = load();
    const palette = COSMETIC_COLORS[carId] || [];
    p.colors[carId] = ((p.colors[carId] || 0) + 1) % Math.max(1, palette.length);
    save(p);
    return p;
  }

  function selectCar(carId) {
    const p = load();
    if (!p.unlocked.includes(carId)) return p;
    p.selected = carId;
    save(p);
    return p;
  }

  function rewardRace({ won, perfectShifts, reactionMs }) {
    const p = load();
    p.races += 1;
    let cash = 120 + perfectShifts * 40;
    if (won) {
      p.wins += 1;
      cash += 280;
    } else {
      cash += 80;
    }
    if (reactionMs != null && reactionMs < 220) cash += 60;
    p.cash += cash;
    save(p);
    return { progress: p, earned: cash };
  }

  /**
   * Pick an AI rival car/engine near the player's applied power.
   * Returns a lightweight appliedStats-like object for seeding the rival.
   */
  function pickRival(playerStats) {
    const target = (playerStats && playerStats.power) || 1;
    const candidates = [];
    for (const c of CARS) {
      const engines = enginesFor(c.id);
      for (const eng of engines) {
        // factory mill only (no upgrades) so rival stays fair vs tuned player
        const weight = c.weight * (eng.weightMul || 1);
        const power = (c.power * (eng.powerMul || 1)) / weight;
        const launchGrip = c.launchGrip * (eng.launchGripMul || 1);
        candidates.push({
          id: c.id,
          color: c.color,
          accent: c.accent,
          short: c.short,
          name: c.short,
          ratios: c.ratios,
          finalDrive: c.finalDrive,
          tireCirc: c.tireCirc,
          power,
          launchGrip,
          nitroMax: c.nitroMax * (eng.nitroMul || 1),
          redline: eng.redline,
          perfectLo: eng.perfectLo,
          perfectHi: eng.perfectHi,
          engineId: eng.id,
          engineName: eng.name,
          hp: eng.hp,
          tq: eng.tq,
          trickyLaunch: !!(eng.launchGripMul < 0.85),
          scaleX: 1,
          bodyLevel: 0,
          rimIndex: 0,
          rimStyle: 'spoke5',
          underglow: 'off',
          _delta: Math.abs(power - target * (0.92 + Math.random() * 0.1)),
        });
      }
    }
    candidates.sort((a, b) => a._delta - b._delta);
    // take one of the closest few for variety
    const pool = candidates.slice(0, Math.min(5, candidates.length));
    const pick = pool[Math.floor(Math.random() * pool.length)] || candidates[0];
    // slight random jitter so races stay close
    pick.power *= 0.96 + Math.random() * 0.08;
    delete pick._delta;
    return pick;
  }


  /** Class letter E–S + 3-digit rating from applied feel (original PCR-like tags). */
  function classRating(stats) {
    const power = (stats && stats.power) || 1;
    const hp = (stats && stats.hp) || 300;
    const grip = (stats && stats.launchGrip) || 1;
    // Original rating: factory HP + feel power + grip (not ripped PCR tables)
    const score = Math.round(clamp(hp * 0.35 + power * 90 + grip * 25, 90, 999));
    let letter = 'E';
    if (score >= 380) letter = 'S';
    else if (score >= 320) letter = 'A';
    else if (score >= 270) letter = 'B';
    else if (score >= 220) letter = 'C';
    else if (score >= 170) letter = 'D';
    else letter = 'E';
    return { letter, rating: score, label: letter + String(score).padStart(3, '0') };
  }

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  /** Dyno curves vs RPM for selected engine + upgrades (original math, not ripped). */
  function dynoCurves(carId, progress) {
    const s = appliedStats(carId, progress);
    const eng = getEngine(carId, (progress.engines || {})[carId] || s.defaultEngine);
    const redline = s.redline || 7000;
    const peakHp = (eng && eng.hp) || 350;
    const peakTq = (eng && eng.tq) || 350;
    const built = ((progress.upgrades[carId] || {}).engine || 0);
    const hpMul = 1 + built * 0.055;
    const tqMul = 1 + built * 0.045;
    const points = [];
    const steps = 48;
    for (let i = 0; i <= steps; i++) {
      const rpm = Math.round((redline * i) / steps);
      const n = rpm / redline;
      // torque hump early-mid; power rises later
      const tShape = Math.sin(Math.PI * Math.min(1, Math.max(0, (n - 0.08) / 0.72))) * 0.85 + 0.15 * Math.max(0, 1 - Math.abs(n - 0.45) * 2);
      const tq = Math.max(0, peakTq * tqMul * tShape * (0.55 + 0.45 * Math.min(1, n / 0.35)));
      const hp = Math.max(0, (tq * rpm) / 5252);
      const hpCap = peakHp * hpMul * (0.2 + 0.8 * Math.pow(Math.min(1, n / 0.85), 1.15));
      points.push({ rpm, hp: Math.min(hp * 1.05, hpCap * 1.15), tq });
    }
    return { points, redline, peakHp: peakHp * hpMul, peakTq: peakTq * tqMul, classInfo: classRating(s) };
  }

  global.SSRCars = {
    CARS,
    ENGINES,
    UPGRADE_DEFS,
    COSMETIC_COLORS,
    RIM_STYLES,
    UNDERGLOW_OPTS,
    CLASSES: ['E', 'D', 'C', 'B', 'A', 'S'],
    load,
    save,
    getCar,
    getEngine,
    enginesFor,
    appliedStats,
    upgradeCost,
    buyUpgrade,
    selectEngine,
    cycleColor,
    cycleRim,
    cycleUnderglow,
    selectCar,
    rewardRace,
    pickRival,
    classRating,
    dynoCurves,
  };
})(window);
