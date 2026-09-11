(() => {
  'use strict';

  // —— Constants ——
  const TRACK_FEET = 1320;
  const PX_PER_FOOT = 2.2;
  const TRACK_PX = TRACK_FEET * PX_PER_FOOT;
  const REDLINE = 8500;
  const IDLE = 900;
  const PERFECT_LO = 7200;
  const PERFECT_HI = 8200;
  const GEAR_RATIOS = [0, 3.6, 2.4, 1.7, 1.3, 1.05, 0.88];
  const FINAL_DRIVE = 3.7;
  const TIRE_CIRC_FT = 6.8;
  const MAX_NITRO = 1;
  const SETTINGS_KEY = 'ssr-settings-v1';

  // Progress / selected car (SSRCars from cars.js — do not alter engine tables)
  let progress = window.SSRCars ? SSRCars.load() : null;
  let active = window.SSRCars && progress
    ? SSRCars.appliedStats(progress.selected, progress)
    : null;

  function refreshActive() {
    if (!window.SSRCars) return;
    progress = SSRCars.load();
    active = SSRCars.appliedStats(progress.selected, progress);
  }

  function liveRedline() { return active ? active.redline : REDLINE; }
  function livePerfectLo() { return active ? active.perfectLo : PERFECT_LO; }
  function livePerfectHi() { return active ? active.perfectHi : PERFECT_HI; }
  function liveRatios() { return active ? active.ratios : GEAR_RATIOS; }
  function liveFinal() { return active ? active.finalDrive : FINAL_DRIVE; }
  function liveTire() { return active ? active.tireCirc : TIRE_CIRC_FT; }
  function liveNitroMax() { return active ? active.nitroMax : MAX_NITRO; }

  // —— Settings ——
  const PRESET_VALUES = {
    Low:    { resolution: 720,  tireSmoke: false, motionBlur: false, reflections: false, crowdDensity: false, heatShimmer: false },
    Medium: { resolution: 1080, tireSmoke: true,  motionBlur: false, reflections: true,  crowdDensity: true,  heatShimmer: false },
    High:   { resolution: 1080, tireSmoke: true,  motionBlur: true,  reflections: true,  crowdDensity: true,  heatShimmer: true },
    Ultra:  { resolution: 2160, tireSmoke: true,  motionBlur: true,  reflections: true,  crowdDensity: true,  heatShimmer: true },
  };

  function defaultSettings() {
    return {
      preset: 'High',
      resolution: 1080,
      tireSmoke: true,
      motionBlur: true,
      reflections: true,
      crowdDensity: true,
      heatShimmer: true,
      showFps: false,
      masterVol: 0.75,
      engineVol: 0.7,
      sfxVol: 0.7,
      muted: false,
      crowdBed: true,
    };
  }

  function loadSettings() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (!raw) return defaultSettings();
      return Object.assign(defaultSettings(), JSON.parse(raw));
    } catch {
      return defaultSettings();
    }
  }

  function saveSettings() {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    if (window.SSRAudio) SSRAudio.setSettings(settings);
    applyFpsVisibility();
    resize();
  }

  let settings = loadSettings();

  const $ = (id) => document.getElementById(id);
  const canvas = $('game');
  const ctx = canvas.getContext('2d', { alpha: false });
  const tachCanvas = $('tach-canvas');
  const tctx = tachCanvas.getContext('2d');
  const fpsEl = $('fps-counter');

  // —— DOM ——
  const hud = $('hud');
  const menu = $('menu');
  const howto = $('howto');
  const pauseEl = $('pause');
  const resultEl = $('result');
  const settingsEl = $('settings');
  const timerEl = $('timer');
  const banner = $('banner');
  const gearLabel = $('gear-label');
  const speedLabel = $('speed-label');
  const nitroBtn = $('btn-nitro');
  const nitroRing = nitroBtn.querySelector('.nitro-ring circle');
  const resultTitle = $('result-title');
  const resultStats = $('result-stats');

  // —— State ——
  let W = 1280, H = 720;
  let bufferScale = 1;
  let state = 'menu';
  let lastTs = 0;
  let raceTime = 0;
  let bannerTimer = 0;
  let cameraX = 0;
  let cameraVel = 0;
  let lightsPhase = 0;
  let lightsTimer = 0;
  let pausedFrom = 'racing';
  let perfectShifts = 0;
  let reactionMs = null;
  let greenAt = 0;
  let launchRated = false;
  let wasNitro = false;
  let smoke = [];
  let fpsFrames = 0;
  let fpsLast = performance.now();
  let fpsValue = 0;
  let garageTab = 'eng';

  const player = makeCar(true);
  const rival = makeCar(false);

  function makeCar(isPlayer) {
    refreshActive();
    const a = active;
    const rivalColor = '#1e6fd9';
    return {
      isPlayer,
      x: 40,
      speed: 0,
      mph: 0,
      rpm: IDLE,
      gear: 1,
      nitro: isPlayer && a ? a.nitroMax : MAX_NITRO,
      nitroMax: isPlayer && a ? a.nitroMax : MAX_NITRO,
      nitroActive: false,
      finished: false,
      finishTime: null,
      bogTimer: 0,
      shiftFlash: 0,
      wheelRot: 0,
      color: isPlayer && a ? a.color : (isPlayer ? '#d62828' : rivalColor),
      accent: isPlayer && a ? a.accent : (isPlayer ? '#ffcc00' : '#a8c8ff'),
      name: isPlayer && a ? a.short : (isPlayer ? 'YOU' : 'RIVAL'),
      scaleX: isPlayer && a ? a.scaleX : 1,
      launchGrip: isPlayer && a ? a.launchGrip : 1,
      trickyLaunch: !!(isPlayer && a && a.trickyLaunch),
      engineId: isPlayer && a ? a.engineId : null,
      redline: isPlayer && a ? a.redline : REDLINE,
      perfectLo: isPlayer && a ? a.perfectLo : PERFECT_LO,
      perfectHi: isPlayer && a ? a.perfectHi : PERFECT_HI,
      ratios: isPlayer && a ? a.ratios : GEAR_RATIOS,
      finalDrive: isPlayer && a ? a.finalDrive : FINAL_DRIVE,
      tireCirc: isPlayer && a ? a.tireCirc : TIRE_CIRC_FT,
      aiShiftAt: 7600,
      aiNitroAt: 0.35,
      aiReaction: 0.18 + Math.random() * 0.12,
      aiLaunched: false,
      power: isPlayer ? (a ? a.power : 1.0) : (a ? a.rivalPower : 0.96),
      prevScreenX: null,
    };
  }

  function resetRace() {
    Object.assign(player, makeCar(true));
    Object.assign(rival, makeCar(false));
    rival.aiShiftAt = 7400 + Math.random() * 900;
    rival.aiReaction = 0.12 + Math.random() * 0.22;
    rival.aiNitroAt = 0.28 + Math.random() * 0.25;
    raceTime = 0;
    cameraX = 0;
    cameraVel = 0;
    lightsPhase = 0;
    lightsTimer = 0.9;
    bannerTimer = 0;
    banner.classList.remove('show');
    perfectShifts = 0;
    reactionMs = null;
    greenAt = 0;
    launchRated = false;
    wasNitro = false;
    smoke.length = 0;
    timerEl.textContent = '0.00';
    updateNitroUI();
    updateReadouts();
    if (window.SSRAudio) {
      SSRAudio.resume();
      SSRAudio.setSettings(settings);
      if (active && active.engineId) SSRAudio.setVoice(active.engineId);
    }
  }

  // —— Resize / resolution scale ——
  function resize() {
    const rect = canvas.getBoundingClientRect();
    const cssW = Math.max(640, Math.floor(rect.width) || window.innerWidth);
    const cssH = Math.max(360, Math.floor(rect.height) || window.innerHeight);
    W = cssW;
    H = cssH;
    const dpr = window.devicePixelRatio || 1;
    const targetH = settings.resolution || 1080;
    const maxH = Math.max(1, Math.floor(cssH * dpr));
    const bufferH = Math.min(targetH, maxH);
    bufferScale = bufferH / cssH;
    canvas.width = Math.max(1, Math.floor(cssW * bufferScale));
    canvas.height = Math.max(1, Math.floor(cssH * bufferScale));
    ctx.setTransform(bufferScale, 0, 0, bufferScale, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = settings.preset === 'Low' ? 'low' : 'high';
  }
  window.addEventListener('resize', resize);

  function applyFpsVisibility() {
    if (!fpsEl) return;
    fpsEl.classList.toggle('hidden', !settings.showFps);
  }

  function openSettings(fromPause) {
    settingsEl.dataset.fromPause = fromPause ? '1' : '0';
    syncSettingsUI();
    settingsEl.classList.remove('hidden');
    if (window.SSRAudio) SSRAudio.resume();
  }

  function closeSettings() {
    settingsEl.classList.add('hidden');
    if (settingsEl.dataset.fromPause === '1') {
      // stay paused
    }
  }

  function syncSettingsUI() {
    document.querySelectorAll('#gfx-presets .preset-btn').forEach((b) => {
      b.classList.toggle('active', b.dataset.preset === settings.preset);
    });
    document.querySelectorAll('#res-presets .preset-btn').forEach((b) => {
      b.classList.toggle('active', Number(b.dataset.res) === settings.resolution);
    });
    $('opt-smoke').checked = !!settings.tireSmoke;
    $('opt-blur').checked = !!settings.motionBlur;
    $('opt-reflect').checked = !!settings.reflections;
    $('opt-crowd').checked = !!settings.crowdDensity;
    $('opt-fps').checked = !!settings.showFps;
    $('opt-mute').checked = !!settings.muted;
    $('opt-crowd-bed').checked = !!settings.crowdBed;
    $('vol-master').value = Math.round((settings.masterVol || 0) * 100);
    $('vol-engine').value = Math.round((settings.engineVol || 0) * 100);
    $('vol-sfx').value = Math.round((settings.sfxVol || 0) * 100);
  }

  function applyPreset(name) {
    const p = PRESET_VALUES[name];
    if (!p) return;
    settings.preset = name;
    Object.assign(settings, p);
    saveSettings();
    syncSettingsUI();
  }

  // Settings wiring
  document.querySelectorAll('#gfx-presets .preset-btn').forEach((b) => {
    b.addEventListener('click', () => applyPreset(b.dataset.preset));
  });
  document.querySelectorAll('#res-presets .preset-btn').forEach((b) => {
    b.addEventListener('click', () => {
      settings.resolution = Number(b.dataset.res);
      // custom res leaves preset label but keeps other toggles
      saveSettings();
      syncSettingsUI();
    });
  });
  [['opt-smoke', 'tireSmoke'], ['opt-blur', 'motionBlur'], ['opt-reflect', 'reflections'],
   ['opt-crowd', 'crowdDensity'], ['opt-fps', 'showFps'], ['opt-mute', 'muted'],
   ['opt-crowd-bed', 'crowdBed']].forEach(([id, key]) => {
    $(id).addEventListener('change', (e) => {
      settings[key] = e.target.checked;
      if (key === 'crowdDensity') settings.heatShimmer = settings.preset === 'High' || settings.preset === 'Ultra';
      saveSettings();
    });
  });
  [['vol-master', 'masterVol'], ['vol-engine', 'engineVol'], ['vol-sfx', 'sfxVol']].forEach(([id, key]) => {
    $(id).addEventListener('input', (e) => {
      settings[key] = Number(e.target.value) / 100;
      saveSettings();
    });
  });

  $('btn-settings').addEventListener('click', () => {
    menu.classList.add('hidden');
    openSettings(false);
  });
  $('btn-settings-back').addEventListener('click', () => {
    closeSettings();
    if (settingsEl.dataset.fromPause === '1') {
      // return to pause overlay (already visible)
    } else if (state === 'menu' || menu.classList.contains('hidden') === false) {
      menu.classList.remove('hidden');
    } else if (state === 'paused') {
      // keep pause
    } else {
      menu.classList.remove('hidden');
      state = 'menu';
    }
  });
  if ($('btn-pause-settings')) {
    $('btn-pause-settings').addEventListener('click', () => openSettings(true));
  }

  // —— UI wiring ——
  $('btn-howto').addEventListener('click', () => {
    menu.classList.add('hidden');
    howto.classList.remove('hidden');
  });
  $('btn-howto-back').addEventListener('click', () => {
    howto.classList.add('hidden');
    menu.classList.remove('hidden');
  });
  $('btn-pause').addEventListener('click', () => {
    if (state !== 'racing' && state !== 'countdown') return;
    pausedFrom = state;
    state = 'paused';
    pauseEl.classList.remove('hidden');
    if (window.SSRAudio) SSRAudio.updateEngine({ rpm: IDLE, redline: liveRedline(), load: 0, idle: true });
  });
  $('btn-resume').addEventListener('click', () => {
    pauseEl.classList.add('hidden');
    settingsEl.classList.add('hidden');
    state = pausedFrom;
    lastTs = performance.now();
    if (window.SSRAudio) SSRAudio.resume();
  });
  $('btn-quit').addEventListener('click', () => {
    pauseEl.classList.add('hidden');
    settingsEl.classList.add('hidden');
    hud.classList.add('hidden');
    resultEl.classList.add('hidden');
    menu.classList.remove('hidden');
    state = 'menu';
    if (window.SSRAudio) SSRAudio.stopAll();
  });
  $('btn-again').addEventListener('click', startRace);
  $('btn-menu').addEventListener('click', () => {
    resultEl.classList.add('hidden');
    hud.classList.add('hidden');
    menu.classList.remove('hidden');
    state = 'menu';
  });
  if ($('btn-result-garage')) {
    $('btn-result-garage').addEventListener('click', () => {
      resultEl.classList.add('hidden');
      hud.classList.add('hidden');
      garageEl.classList.remove('hidden');
      state = 'menu';
      renderGarage();
    });
  }

  function bindHold(el, onDown, onUp) {
    const down = (e) => { e.preventDefault(); el.classList.add('pressed'); onDown && onDown(); };
    const up = (e) => { e.preventDefault(); el.classList.remove('pressed'); onUp && onUp(); };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointerleave', up);
    el.addEventListener('pointercancel', up);
  }

  function bindTap(el, fn) {
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      el.classList.add('pressed');
      fn();
    });
    const clear = (e) => { e.preventDefault(); el.classList.remove('pressed'); };
    el.addEventListener('pointerup', clear);
    el.addEventListener('pointerleave', clear);
    el.addEventListener('pointercancel', clear);
  }
  bindTap($('btn-up'), () => shiftCar(player, 1));
  bindTap($('btn-down'), () => shiftCar(player, -1));
  bindHold(nitroBtn, () => {
    if (state === 'countdown' && lightsPhase >= 4) beginRacing(false);
    if (state !== 'racing') return;
    rateLaunchIfNeeded();
    if (player.nitro <= 0) return;
    player.nitroActive = true;
    nitroBtn.classList.add('active');
  }, () => {
    player.nitroActive = false;
    nitroBtn.classList.remove('active');
  });

  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    if (e.code === 'ArrowUp' || e.code === 'KeyE' || e.code === 'ShiftRight') shiftCar(player, 1);
    if (e.code === 'ArrowDown' || e.code === 'KeyQ') shiftCar(player, -1);
    if (e.code === 'Space' || e.code === 'KeyN') {
      if (state === 'racing' && player.nitro > 0) {
        player.nitroActive = true;
        nitroBtn.classList.add('active');
      }
    }
    if (e.code === 'Escape' && (state === 'racing' || state === 'countdown')) {
      $('btn-pause').click();
    }
    if (e.code === 'Enter' && state === 'menu' && !garageEl.classList.contains('hidden') === false) {
      /* ignore */
    }
  });
  window.addEventListener('keyup', (e) => {
    if (e.code === 'Space' || e.code === 'KeyN') {
      player.nitroActive = false;
      nitroBtn.classList.remove('active');
    }
  });

  // Unlock audio on first gesture
  const unlockAudio = () => {
    if (window.SSRAudio) {
      SSRAudio.resume();
      SSRAudio.setSettings(settings);
    }
  };
  window.addEventListener('pointerdown', unlockAudio, { once: false });
  window.addEventListener('keydown', unlockAudio, { once: false });

  function startRace() {
    menu.classList.add('hidden');
    howto.classList.add('hidden');
    resultEl.classList.add('hidden');
    pauseEl.classList.add('hidden');
    settingsEl.classList.add('hidden');
    if (garageEl) garageEl.classList.add('hidden');
    hud.classList.remove('hidden');
    resetRace();
    state = 'countdown';
    lastTs = performance.now();
    showBanner('<span class="go" style="font-size:0.55em;color:#fff">READY</span>', 0.8);
  }

  function showBanner(html, dur) {
    banner.innerHTML = html;
    banner.classList.add('show');
    bannerTimer = dur;
  }

  function rateLaunchIfNeeded() {
    if (launchRated || lightsPhase < 4 || greenAt <= 0) return;
    launchRated = true;
    reactionMs = Math.max(0, performance.now() - greenAt);
    if (reactionMs < 160) {
      showBanner('<span class="go">GO</span><div class="sub ok perfect-glow">PERFECT START</div>', 1.15);
      if (window.SSRAudio) SSRAudio.playLaunchFeedback('perfect');
      if (navigator.vibrate) navigator.vibrate([10, 20, 10, 20, 10]);
    } else if (reactionMs < 220) {
      showBanner('<span class="go">GO</span><div class="sub ok good-glow">GOOD START</div>', 1.1);
      if (window.SSRAudio) SSRAudio.playLaunchFeedback('good');
      if (navigator.vibrate) navigator.vibrate([12, 30, 12]);
    } else if (reactionMs < 450) {
      showBanner('<span class="go">GO</span><div class="sub">OK START</div>', 0.9);
      if (window.SSRAudio) SSRAudio.playLaunchFeedback('ok');
    } else {
      showBanner('<span class="go">GO</span><div class="sub warn">SLOW START</div>', 0.9);
      if (window.SSRAudio) SSRAudio.playLaunchFeedback('slow');
    }
    if (window.SSRAudio) SSRAudio.playTireChirp(reactionMs < 250);
  }

  function shiftCar(car, dir) {
    if (state === 'countdown' && car.isPlayer && lightsPhase < 4) {
      showBanner('<span class="go warn">JUMP</span><div class="sub warn">FALSE START</div>', 1.2);
      car.bogTimer = 0.9;
      if (window.SSRAudio) SSRAudio.playLaunchFeedback('jump');
      return;
    }
    if (state !== 'racing' && !(state === 'countdown' && lightsPhase >= 4)) return;
    if (state === 'countdown' && lightsPhase >= 4) {
      beginRacing(false);
    }
    if (state !== 'racing') return;
    if (car.isPlayer) rateLaunchIfNeeded();

    const newGear = car.gear + dir;
    if (newGear < 1 || newGear > 6) return;

    if (dir > 0) {
      const rpm = car.rpm;
      if (rpm >= (car.perfectLo || livePerfectLo()) && rpm <= (car.perfectHi || livePerfectHi())) {
        car.shiftFlash = 0.35;
        if (car.isPlayer) {
          perfectShifts++;
          showBanner('<span class="go ok" style="font-size:0.45em">PERFECT</span><div class="sub ok perfect-glow">SHIFT</div>', 0.55);
          if (navigator.vibrate) navigator.vibrate(18);
        }
        car.speed *= 1.02;
      } else if (rpm < (car.perfectLo || livePerfectLo()) - 800) {
        car.bogTimer = 0.55;
        if (car.isPlayer) showBanner('<span class="go warn" style="font-size:0.4em">BOG</span>', 0.5);
      } else if (rpm > (car.perfectHi || livePerfectHi()) + 200) {
        car.bogTimer = 0.25;
        if (car.isPlayer) showBanner('<span class="go warn" style="font-size:0.4em">LATE</span>', 0.45);
      }
    }

    car.gear = newGear;
    const ratios = car.ratios || liveRatios();
    const rl = car.redline || liveRedline();
    const oldR = ratios[car.gear - dir] || ratios[1];
    const newR = ratios[car.gear];
    car.rpm = clamp(car.rpm * (newR / oldR), IDLE, rl + 200);
    updateReadouts();
    if (car.isPlayer && window.SSRAudio) SSRAudio.playShift(dir > 0);
  }

  function beginRacing(_fromPlayer) {
    if (state === 'racing') return;
    state = 'racing';
    if (!launchRated) {
      showBanner('<span class="go">GO</span>', 0.75);
    }
  }

  // —— Physics (preserved feel; uses appliedStats / trickyLaunch) ——
  function rpmFromSpeed(speedFps, gear, car) {
    const ratios = (car && car.ratios) || liveRatios();
    const fd = (car && car.finalDrive) || liveFinal();
    const tire = (car && car.tireCirc) || liveTire();
    const rl = (car && car.redline) || liveRedline();
    const r = ratios[gear] * fd;
    const wheelRps = speedFps / tire;
    return clamp(wheelRps * r * 60, IDLE, rl + 400);
  }

  function speedFromRpm(rpm, gear, car) {
    const ratios = (car && car.ratios) || liveRatios();
    const fd = (car && car.finalDrive) || liveFinal();
    const tire = (car && car.tireCirc) || liveTire();
    const r = ratios[gear] * fd;
    const wheelRps = rpm / (r * 60);
    return wheelRps * tire;
  }

  function powerFactor(rpm, car) {
    const n = rpm / ((car && car.redline) || liveRedline());
    const curve = Math.sin(Math.PI * Math.min(1, Math.max(0, n * 1.05))) ** 1.1;
    return 0.25 + 0.75 * curve;
  }

  function spawnSmoke(car, lane, amount) {
    if (!settings.tireSmoke || amount <= 0) return;
    const roadTop = H * 0.55;
    const roadBot = H;
    const yBase = lane === 0
      ? roadTop + (roadBot - roadTop) * 0.62
      : roadTop + (roadBot - roadTop) * 0.22;
    const screenX = car.x - cameraX + (lane === 0 ? W * 0.28 : W * 0.22);
    const n = Math.min(4, Math.ceil(amount));
    for (let i = 0; i < n; i++) {
      smoke.push({
        x: screenX - 40 + Math.random() * 20,
        y: yBase - 2,
        vx: -40 - Math.random() * 60,
        vy: -10 - Math.random() * 30,
        life: 0.4 + Math.random() * 0.5,
        max: 0.9,
        r: 8 + Math.random() * 14,
      });
    }
    if (smoke.length > 120) smoke.splice(0, smoke.length - 120);
  }

  function updateCar(car, dt, racing) {
    if (car.finished) return;

    if (car.shiftFlash > 0) car.shiftFlash -= dt;
    if (car.bogTimer > 0) car.bogTimer -= dt;

    if (!racing) {
      car.rpm = IDLE + Math.sin(performance.now() / 180) * 40;
      car.speed = 0;
      car.mph = 0;
      return;
    }

    let throttle = 1;
    if (car.bogTimer > 0) throttle *= 0.35;

    let nitroMul = 1;
    if (car.nitroActive && car.nitro > 0) {
      nitroMul = 1.35;
      car.nitro = Math.max(0, car.nitro - dt * 0.45);
      if (car.nitro <= 0) {
        car.nitroActive = false;
        if (car.isPlayer) {
          nitroBtn.classList.remove('active');
          nitroBtn.classList.add('empty');
        }
      }
    }

    const pf = powerFactor(car.rpm, car) * car.power * throttle * nitroMul;
    const ratios = car.ratios || liveRatios();
    const grip = car.launchGrip || 1;
    const baseAccel = 38 * pf * grip * (ratios[car.gear] / ratios[1]);
    const drag = 0.00035 * car.speed * car.speed;
    const accel = baseAccel - drag - car.speed * 0.02;

    car.speed = Math.max(0, car.speed + accel * dt);
    car.x += car.speed * dt * PX_PER_FOOT;

    const rl = car.redline || liveRedline();
    const tied = rpmFromSpeed(car.speed, car.gear, car);
    const climb = 5200 * pf * dt;
    if (tied < rl) {
      car.rpm = clamp(Math.max(tied, car.rpm * 0.15 + tied * 0.85) + (car.speed < 5 ? climb : 0), IDLE, rl + 150);
    } else {
      car.rpm = rl + Math.sin(performance.now() / 40) * 80;
    }

    let wheelspin = false;
    if (car.speed < 8 && car.gear === 1) {
      let launchMul = car.launchGrip || 1;
      if (car.trickyLaunch && car.nitroActive && car.rpm > rl * 0.55) {
        launchMul *= 0.55;
        wheelspin = true;
        if (car.isPlayer && Math.random() < 0.08) {
          car.bogTimer = Math.max(car.bogTimer, 0.2);
        }
      }
      car.rpm = clamp(car.rpm + 6500 * throttle * nitroMul * dt * launchMul, IDLE, rl);
      car.speed = speedFromRpm(car.rpm * 0.92, 1, car) * (car.bogTimer > 0 ? 0.45 : 1) * Math.min(1, launchMul + 0.15);
      car.x += car.speed * dt * PX_PER_FOOT * 0.35;
      if (car.isPlayer && (wheelspin || car.bogTimer > 0)) spawnSmoke(car, 0, 2);
    } else if (car.isPlayer && car.nitroActive && settings.tireSmoke) {
      spawnSmoke(car, 0, 0.4);
    }

    car.mph = car.speed * 3600 / 5280;
    car.wheelRot += car.speed * dt * 2.5;

    if (car.x >= TRACK_PX) {
      car.x = TRACK_PX;
      car.finished = true;
      car.finishTime = raceTime;
      car.speed *= 0.3;
    }
  }

  function updateAI(dt) {
    if (state === 'countdown' && lightsPhase >= 4 && !rival.aiLaunched) {
      rival.aiReaction -= dt;
      if (rival.aiReaction <= 0) {
        rival.aiLaunched = true;
        beginRacing(false);
      }
    }
    if (state !== 'racing') return;

    if (rival.gear < 6 && rival.rpm >= rival.aiShiftAt) {
      shiftCar(rival, 1);
      rival.aiShiftAt = 7300 + Math.random() * 1000;
    }
    const prog = rival.x / TRACK_PX;
    if (!rival.nitroActive && rival.nitro > 0.05 && prog > rival.aiNitroAt && prog < 0.85) {
      rival.nitroActive = true;
    }
    if (rival.nitro <= 0) rival.nitroActive = false;
  }

  function updateSmoke(dt) {
    for (let i = smoke.length - 1; i >= 0; i--) {
      const p = smoke[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.96;
      p.r += 20 * dt;
      if (p.life <= 0) smoke.splice(i, 1);
    }
  }

  function updateAudio() {
    if (!window.SSRAudio) return;
    const racing = state === 'racing';
    const load = racing ? (player.nitroActive ? 1 : 0.55 + Math.min(0.4, player.speed / 200)) : 0.15;
    SSRAudio.updateEngine({
      rpm: player.rpm,
      redline: player.redline || liveRedline(),
      load,
      nitro: !!(player.nitroActive && player.nitro > 0),
      idle: !racing,
      engineId: player.engineId || (active && active.engineId) || null,
    });
    if (player.nitroActive && player.nitro > 0 && !wasNitro) {
      SSRAudio.playNitro(true);
      wasNitro = true;
    } else if ((!player.nitroActive || player.nitro <= 0) && wasNitro) {
      SSRAudio.playNitro(false);
      wasNitro = false;
    }
  }

  // —— Drawing ——
  function drawBackground(cam) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#152038');
    g.addColorStop(0.4, '#3a4e6a');
    g.addColorStop(0.68, '#6e7f92');
    g.addColorStop(1, '#2a3038');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // soft sun glow
    const sg = ctx.createRadialGradient(W * 0.78, H * 0.18, 10, W * 0.78, H * 0.18, H * 0.35);
    sg.addColorStop(0, 'rgba(255,210,140,0.35)');
    sg.addColorStop(1, 'rgba(255,210,140,0)');
    ctx.fillStyle = sg;
    ctx.fillRect(0, 0, W, H * 0.55);

    const horizon = H * 0.42;
    const roadTop = H * 0.55;
    const roadBot = H;
    const density = settings.crowdDensity ? 1 : 0.45;

    drawCityLayer(cam * 0.25, horizon - 20, 0.55, '#1c2438', density);
    drawCityLayer(cam * 0.45, horizon + 10, 0.75, '#243048', density);
    drawCityLayer(cam * 0.7, roadTop - 8, 1.0, '#2c3850', density);

    if (settings.crowdDensity) drawCrowd(cam, roadTop);

    // road base
    ctx.fillStyle = '#2a2e34';
    ctx.beginPath();
    ctx.moveTo(0, roadTop);
    ctx.lineTo(W, roadTop);
    ctx.lineTo(W, roadBot);
    ctx.lineTo(0, roadBot);
    ctx.closePath();
    ctx.fill();

    // asphalt sheen / reflection strip
    if (settings.reflections) {
      const rg = ctx.createLinearGradient(0, roadTop, 0, roadBot);
      rg.addColorStop(0, 'rgba(180,200,230,0.08)');
      rg.addColorStop(0.35, 'rgba(255,255,255,0.03)');
      rg.addColorStop(1, 'rgba(0,0,0,0.25)');
      ctx.fillStyle = rg;
      ctx.fillRect(0, roadTop, W, roadBot - roadTop);
    }

    ctx.fillStyle = '#32363e';
    ctx.fillRect(0, roadTop + (roadBot - roadTop) * 0.42, W, (roadBot - roadTop) * 0.58);

    const laneY = roadTop + (roadBot - roadTop) * 0.38;
    ctx.strokeStyle = 'rgba(255,220,80,0.75)';
    ctx.lineWidth = 3;
    ctx.setLineDash([40, 28]);
    ctx.lineDashOffset = -cam * 0.9;
    ctx.beginPath();
    ctx.moveTo(0, laneY);
    ctx.lineTo(W, laneY);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#c45c4a';
    ctx.fillRect(0, roadTop - 6, W, 6);
    ctx.fillStyle = '#e8e8e8';
    for (let i = -((cam * 0.9) % 60); i < W; i += 60) {
      ctx.fillRect(i, roadTop - 6, 30, 6);
    }

    const finX = TRACK_PX - cam;
    if (finX > -40 && finX < W + 40) {
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      for (let y = roadTop; y < roadBot; y += 16) {
        ctx.fillRect(finX, y, 14, 8);
        ctx.fillStyle = y % 32 < 16 ? '#111' : 'rgba(255,255,255,0.9)';
      }
      ctx.fillStyle = '#7CFF3A';
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText('FINISH', finX - 10, roadTop - 12);
    }

    drawLights(120 - cam * 0.15, roadTop - 90);
  }

  function drawCrowd(cam, roadTop) {
    const spacing = 90;
    const seed = Math.floor(cam / spacing);
    for (let i = -1; i < Math.ceil(W / spacing) + 2; i++) {
      const idx = seed + i;
      if (hash(idx + 99) < 0.55) continue;
      const x = idx * spacing - (cam % spacing) + 20;
      const y = roadTop - 8;
      ctx.fillStyle = hash(idx) > 0.5 ? '#3a3a48' : '#2a3348';
      ctx.fillRect(x, y - 22, 6, 14);
      ctx.beginPath();
      ctx.arc(x + 3, y - 26, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,200,160,0.35)';
      ctx.fillRect(x - 2, y - 8, 4, 3);
    }
  }

  function drawCityLayer(cam, baseY, scale, color, density) {
    const blockW = 120 * scale;
    const seed = Math.floor(cam / blockW);
    const step = density < 0.5 ? 2 : 1;
    for (let i = -1; i < Math.ceil(W / blockW) + 2; i += step) {
      const idx = seed + i;
      const x = idx * blockW - (cam % blockW);
      const h = (40 + hash(idx) * 120) * scale;
      ctx.fillStyle = color;
      ctx.fillRect(x, baseY - h, blockW - 6 * scale, h);

      ctx.fillStyle = `rgba(255,210,120,${0.15 + hash(idx + 3) * 0.35})`;
      const cols = Math.floor(3 + hash(idx + 1) * 4);
      const rows = Math.floor(2 + hash(idx + 2) * 5);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (hash(idx * 17 + r * 9 + c) > 0.35) {
            ctx.fillRect(
              x + 8 * scale + c * (blockW / (cols + 1)),
              baseY - h + 10 * scale + r * 14 * scale,
              6 * scale, 8 * scale
            );
          }
        }
      }

      if (density > 0.5 && hash(idx + 7) > 0.78 && scale > 0.8) {
        ctx.fillStyle = '#8a3030';
        ctx.fillRect(x + 10, baseY - 36, blockW - 26, 22);
        ctx.fillStyle = '#f0d080';
        ctx.font = `${11 * scale}px sans-serif`;
        ctx.fillText(hash(idx) > 0.5 ? 'AUTO REPAIR' : 'CITY DINER', x + 14, baseY - 20);
      }

      if (density > 0.5 && hash(idx + 11) > 0.6) {
        ctx.strokeStyle = '#889';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x + blockW - 12, baseY);
        ctx.lineTo(x + blockW - 12, baseY - 50 * scale);
        ctx.lineTo(x + blockW - 28, baseY - 56 * scale);
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,230,150,0.35)';
        ctx.beginPath();
        ctx.arc(x + blockW - 28, baseY - 56 * scale, 8, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function hash(n) {
    const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return s - Math.floor(s);
  }

  function drawLights(x, y) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = '#222';
    ctx.fillRect(-18, -70, 36, 90);
    ctx.fillStyle = '#444';
    ctx.fillRect(-6, 20, 12, 40);
    for (let i = 0; i < 3; i++) {
      let c = '#551111';
      if (lightsPhase > i) c = '#ff3030';
      if (lightsPhase >= 4) c = i === 2 ? '#30ff40' : '#551111';
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(0, -52 + i * 28, 10, 0, Math.PI * 2);
      ctx.fill();
      if (lightsPhase > i && lightsPhase < 4) {
        ctx.fillStyle = 'rgba(255,60,60,0.35)';
        ctx.beginPath();
        ctx.arc(0, -52 + i * 28, 16, 0, Math.PI * 2);
        ctx.fill();
      }
      if (lightsPhase >= 4 && i === 2) {
        ctx.fillStyle = 'rgba(80,255,100,0.4)';
        ctx.beginPath();
        ctx.arc(0, -52 + i * 28, 16, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  function drawSmoke() {
    for (const p of smoke) {
      const a = Math.max(0, p.life / p.max) * 0.35;
      ctx.fillStyle = `rgba(200,200,210,${a})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawCar(car, lane) {
    const roadTop = H * 0.55;
    const roadBot = H;
    const yBase = lane === 0
      ? roadTop + (roadBot - roadTop) * 0.62
      : roadTop + (roadBot - roadTop) * 0.22;

    const screenX = car.x - cameraX + (lane === 0 ? W * 0.28 : W * 0.22);
    const scale = lane === 0 ? 1 : 0.82;
    const y = yBase;

    // motion blur trail
    if (settings.motionBlur && car.prevScreenX != null && Math.abs(screenX - car.prevScreenX) > 2 && state === 'racing') {
      const steps = 3;
      for (let i = steps; i >= 1; i--) {
        const t = i / (steps + 1);
        const bx = screenX + (car.prevScreenX - screenX) * t;
        ctx.globalAlpha = 0.12 * (1 - t);
        drawCarBody(car, bx, y, scale, false);
      }
      ctx.globalAlpha = 1;
    }

    // road reflection
    if (settings.reflections) {
      ctx.save();
      ctx.translate(screenX, y + 14);
      ctx.scale(scale * (car.scaleX || 1), -scale * 0.55);
      ctx.globalAlpha = 0.22;
      drawCarBody(car, 0, 0, 1, true);
      ctx.restore();
      ctx.globalAlpha = 1;
    }

    drawCarBody(car, screenX, y, scale, false);

    // Hellcat heat shimmer (High+)
    if (settings.heatShimmer && car.trickyLaunch && car.isPlayer && (state === 'racing' || state === 'countdown')) {
      const t = performance.now() / 90;
      ctx.save();
      ctx.globalAlpha = 0.15;
      for (let i = 0; i < 5; i++) {
        ctx.fillStyle = 'rgba(255,180,100,0.35)';
        const hx = screenX - 70 + Math.sin(t + i) * 6;
        const hy = y - 40 - i * 8 + Math.cos(t * 1.3 + i) * 3;
        ctx.beginPath();
        ctx.ellipse(hx, hy, 10 + i, 4, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    car.prevScreenX = screenX;
  }

  function drawCarBody(car, screenX, y, scale, reflectionPass) {
    ctx.save();
    ctx.translate(screenX, y);
    ctx.scale(scale * (car.scaleX || 1), scale);

    if (!reflectionPass) {
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.beginPath();
      ctx.ellipse(0, 8, 90, 12, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    if (car.nitroActive && car.nitro > 0) {
      const flick = 0.7 + Math.random() * 0.3;
      ctx.fillStyle = `rgba(80,180,255,${0.55 * flick})`;
      ctx.beginPath();
      ctx.moveTo(-88, -18);
      ctx.lineTo(-88 - 40 * flick, -8);
      ctx.lineTo(-88, 2);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = `rgba(200,240,255,${0.7 * flick})`;
      ctx.beginPath();
      ctx.moveTo(-88, -14);
      ctx.lineTo(-88 - 22 * flick, -8);
      ctx.lineTo(-88, -2);
      ctx.closePath();
      ctx.fill();
    }

    // lighting: darker rocker, lit top
    const body = car.color;
    const lit = shadeColor(body, 18);
    const shade = shadeColor(body, -28);

    ctx.fillStyle = shade;
    roundRect(ctx, -94, -24, 188, 24, 5);
    ctx.fill();

    ctx.fillStyle = body;
    roundRect(ctx, -90, -36, 180, 24, 4);
    ctx.fill();

    // roof highlight
    const hg = ctx.createLinearGradient(0, -58, 0, -34);
    hg.addColorStop(0, lit);
    hg.addColorStop(1, body);
    ctx.fillStyle = hg;
    ctx.beginPath();
    ctx.moveTo(-30, -34);
    ctx.lineTo(-10, -60);
    ctx.lineTo(50, -60);
    ctx.lineTo(76, -34);
    ctx.closePath();
    ctx.fill();

    // sharper silhouette edge
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-90, -12);
    ctx.lineTo(-90, -34);
    ctx.lineTo(-30, -34);
    ctx.lineTo(-10, -60);
    ctx.lineTo(50, -60);
    ctx.lineTo(76, -34);
    ctx.lineTo(92, -34);
    ctx.lineTo(94, -12);
    ctx.stroke();

    ctx.fillStyle = '#111';
    ctx.fillRect(80, -18, 16, 10);
    ctx.fillRect(-100, -18, 12, 10);

    // glass with specular
    const glass = ctx.createLinearGradient(-20, -56, 60, -36);
    glass.addColorStop(0, 'rgba(190,220,245,0.7)');
    glass.addColorStop(0.5, 'rgba(120,160,200,0.45)');
    glass.addColorStop(1, 'rgba(220,240,255,0.65)');
    ctx.fillStyle = glass;
    ctx.beginPath();
    ctx.moveTo(-22, -36);
    ctx.lineTo(-6, -56);
    ctx.lineTo(46, -56);
    ctx.lineTo(66, -36);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(18, -56, 4, 20);

    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-10, -34); ctx.lineTo(-10, -8);
    ctx.stroke();
    ctx.fillStyle = car.accent;
    ctx.fillRect(-60, -22, 56, 4);
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.font = 'bold 7px sans-serif';
    ctx.fillText('WORK', -55, -12);
    ctx.fillText('ACCUAIR', 8, -12);

    // headlights glow
    ctx.fillStyle = '#fff6e8';
    ctx.fillRect(88, -30, 10, 13);
    ctx.fillStyle = 'rgba(255,240,200,0.35)';
    ctx.fillRect(96, -28, 14, 9);
    ctx.fillStyle = '#ff2a2a';
    ctx.fillRect(-98, -30, 8, 13);

    if (!reflectionPass) {
      drawWheel(-54, 4, car.wheelRot);
      drawWheel(58, 4, car.wheelRot);
    }

    if (car.shiftFlash > 0) {
      ctx.strokeStyle = `rgba(124,255,58,${car.shiftFlash})`;
      ctx.lineWidth = 3;
      roundRect(ctx, -86, -58, 172, 66, 10);
      ctx.stroke();
    }

    if (!reflectionPass) {
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText(car.name, -20, -68);
    }

    ctx.restore();
  }

  function shadeColor(hex, amt) {
    try {
      let h = hex.replace('#', '');
      if (h.length === 3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
      const n = parseInt(h, 16);
      let r = (n >> 16) + amt;
      let g = ((n >> 8) & 0xff) + amt;
      let b = (n & 0xff) + amt;
      r = Math.max(0, Math.min(255, r));
      g = Math.max(0, Math.min(255, g));
      b = Math.max(0, Math.min(255, b));
      return `rgb(${r},${g},${b})`;
    } catch {
      return hex;
    }
  }

  function drawWheel(x, y, rot) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.fillStyle = '#0a0a0a';
    ctx.beginPath();
    ctx.arc(0, 0, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 15, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#a8b0b8';
    ctx.beginPath();
    ctx.arc(0, 0, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#f2f2f2';
    ctx.lineWidth = 2;
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 3, Math.sin(a) * 3);
      ctx.lineTo(Math.cos(a) * 12, Math.sin(a) * 12);
      ctx.stroke();
    }
    ctx.restore();
  }

  function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  function drawTach() {
    const s = tachCanvas.width;
    tctx.clearRect(0, 0, s, s);
    const cx = s / 2, cy = s / 2, R = s * 0.42;

    tctx.beginPath();
    tctx.arc(cx, cy, R + 8, 0, Math.PI * 2);
    tctx.fillStyle = 'rgba(0,0,0,0.45)';
    tctx.fill();
    tctx.strokeStyle = 'rgba(255,255,255,0.35)';
    tctx.lineWidth = 3;
    tctx.stroke();

    const start = Math.PI * 0.75;
    const end = Math.PI * 2.25;
    tctx.strokeStyle = 'rgba(255,255,255,0.15)';
    tctx.lineWidth = 14;
    tctx.beginPath();
    tctx.arc(cx, cy, R - 10, start, end);
    tctx.stroke();

    const plo = player.perfectLo || livePerfectLo();
    const phi = player.perfectHi || livePerfectHi();
    const prl = player.redline || liveRedline();
    const g0 = start + (end - start) * (plo / prl);
    const g1 = start + (end - start) * (phi / prl);
    tctx.strokeStyle = '#7CFF3A';
    tctx.lineWidth = 14;
    tctx.beginPath();
    tctx.arc(cx, cy, R - 10, g0, g1);
    tctx.stroke();

    const r0 = start + (end - start) * 0.92;
    tctx.strokeStyle = '#ff3a3a';
    tctx.beginPath();
    tctx.arc(cx, cy, R - 10, r0, end);
    tctx.stroke();

    tctx.strokeStyle = '#fff';
    for (let i = 0; i <= 8; i++) {
      const a = start + (end - start) * (i / 8);
      const cos = Math.cos(a), sin = Math.sin(a);
      tctx.lineWidth = i % 2 === 0 ? 3 : 1.5;
      tctx.beginPath();
      tctx.moveTo(cx + cos * (R - 22), cy + sin * (R - 22));
      tctx.lineTo(cx + cos * (R - 4), cy + sin * (R - 4));
      tctx.stroke();
    }

    const rpmN = clamp(player.rpm / (player.redline || liveRedline()), 0, 1.05);
    const ang = start + (end - start) * Math.min(1, rpmN);
    tctx.strokeStyle = '#ff4a4a';
    tctx.fillStyle = '#ff4a4a';
    tctx.lineWidth = 4;
    tctx.lineCap = 'round';
    tctx.beginPath();
    tctx.moveTo(cx - Math.cos(ang) * 12, cy - Math.sin(ang) * 12);
    tctx.lineTo(cx + Math.cos(ang) * (R - 28), cy + Math.sin(ang) * (R - 28));
    tctx.stroke();
    tctx.beginPath();
    tctx.arc(cx, cy, 8, 0, Math.PI * 2);
    tctx.fill();
  }

  function updateReadouts() {
    const ord = ['', 'ST', 'ND', 'RD', 'TH', 'TH', 'TH'];
    gearLabel.innerHTML = `${player.gear}<span>${ord[player.gear] || 'TH'}</span>`;
    speedLabel.innerHTML = `${Math.round(player.mph)}<span>MPH</span>`;
  }

  function updateNitroUI() {
    const pct = (player.nitro / (player.nitroMax || liveNitroMax() || MAX_NITRO)) * 100;
    nitroRing.style.strokeDashoffset = String(100 - pct);
    nitroBtn.classList.toggle('empty', player.nitro <= 0.01);
  }

  // —— Main loop (uncapped rAF) ——
  function frame(ts) {
    const dt = Math.min(0.05, (ts - lastTs) / 1000 || 0);
    lastTs = ts;

    fpsFrames++;
    if (ts - fpsLast >= 500) {
      fpsValue = Math.round((fpsFrames * 1000) / (ts - fpsLast));
      fpsFrames = 0;
      fpsLast = ts;
      if (settings.showFps && fpsEl) fpsEl.textContent = `${fpsValue} FPS`;
    }

    if (state === 'countdown' || state === 'racing') {
      update(dt);
    } else if (state === 'menu') {
      if (window.SSRAudio) {
        SSRAudio.updateEngine({ rpm: IDLE + 30, redline: liveRedline(), load: 0.1, idle: true });
      }
    }

    render();
    requestAnimationFrame(frame);
  }

  function update(dt) {
    if (bannerTimer > 0) {
      bannerTimer -= dt;
      if (bannerTimer <= 0) banner.classList.remove('show');
    }

    if (state === 'countdown') {
      lightsTimer -= dt;
      if (lightsTimer <= 0) {
        lightsPhase++;
        if (lightsPhase < 4) {
          lightsTimer = 0.55 + Math.random() * 0.25;
          if (window.SSRAudio) SSRAudio.playTree(lightsPhase);
        } else if (lightsPhase === 4) {
          lightsTimer = 999;
          greenAt = performance.now();
          if (window.SSRAudio) SSRAudio.playTree(4);
          showBanner('<span class="go">GO</span>', 0.8);
          setTimeout(() => {
            if (state === 'countdown' && lightsPhase >= 4) beginRacing(false);
          }, 80);
        }
      }
      updateCar(player, dt, false);
      updateCar(rival, dt, false);
      updateAI(dt);
    }

    if (state === 'racing') {
      raceTime += dt;
      timerEl.textContent = raceTime.toFixed(2);
      updateCar(player, dt, true);
      updateCar(rival, dt, true);
      updateAI(dt);
      updateSmoke(dt);
      updateNitroUI();
      updateReadouts();

      // smoother critically-damped-ish camera follow
      const lookAhead = Math.min(180, player.speed * 0.35);
      const target = player.x - W * 0.28 + lookAhead;
      const stiff = 10;
      const damp = 8;
      const ax = (target - cameraX) * stiff - cameraVel * damp;
      cameraVel += ax * dt;
      cameraX += cameraVel * dt;

      if (player.finished && rival.finished) {
        endRace();
      } else if (player.finished && !rival.finished) {
        if (raceTime - player.finishTime > 2.5) {
          rival.finished = true;
          rival.finishTime = raceTime;
          endRace();
        }
      } else if (rival.finished && !player.finished) {
        if (raceTime - rival.finishTime > 2.5) {
          player.finished = true;
          player.finishTime = raceTime;
          endRace();
        }
      }
    }

    updateAudio();
  }

  function endRace() {
    state = 'finished';
    const win = player.finishTime <= rival.finishTime;
    resultTitle.textContent = win ? 'YOU WIN!' : 'YOU LOSE';
    resultTitle.style.color = win ? '#7CFF3A' : '#ff6a6a';
    const rt = reactionMs != null ? `${Math.round(reactionMs)} ms` : '—';
    let earnedLine = '';
    if (window.SSRCars) {
      const reward = SSRCars.rewardRace({ won: win, perfectShifts, reactionMs });
      progress = reward.progress;
      earnedLine = `<br/>Earned: <b style="color:#7CFF3A">$${reward.earned}</b> · Cash: <b>$${progress.cash}</b>`;
      syncCashUI();
    }
    resultStats.innerHTML =
      `Your time: <b>${(player.finishTime || raceTime).toFixed(3)}s</b><br/>` +
      `Rival time: <b>${(rival.finishTime || raceTime).toFixed(3)}s</b><br/>` +
      `Reaction: <b>${rt}</b> · Perfect shifts: <b>${perfectShifts}</b><br/>` +
      `Top speed: <b>${Math.round(player.mph)} MPH</b>` + earnedLine;
    resultEl.classList.remove('hidden');
    if (window.SSRAudio) SSRAudio.updateEngine({ rpm: IDLE, redline: liveRedline(), load: 0, idle: true });
  }

  function render() {
    ctx.clearRect(0, 0, W, H);
    if (state === 'menu') {
      cameraX += 0.4;
      drawBackground(cameraX);
      drawCar({ ...rival, x: cameraX + W * 0.15, wheelRot: cameraX * 0.05, nitroActive: false, prevScreenX: null }, 1);
      drawCar({ ...player, x: cameraX + W * 0.2, wheelRot: cameraX * 0.05, nitroActive: false, prevScreenX: null }, 0);
    } else {
      drawBackground(cameraX);
      drawSmoke();
      drawCar(rival, 1);
      drawCar(player, 0);
      if (state !== 'finished' || hud && !hud.classList.contains('hidden')) drawTach();
    }
  }

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  // —— Garage (matches HTML tabs / canvas) ——
  const garageEl = $('garage');
  const menuCash = $('menu-cash');
  const garageCash = $('garage-cash');
  const garageCanvas = $('garage-canvas');
  const gctx = garageCanvas ? garageCanvas.getContext('2d') : null;

  function syncCashUI() {
    if (!progress && window.SSRCars) progress = SSRCars.load();
    if (!progress) return;
    if (menuCash) menuCash.textContent = `$${progress.cash}`;
    if (garageCash) garageCash.textContent = `$${progress.cash}`;
  }

  function carIndex() {
    if (!window.SSRCars || !progress) return 0;
    const i = SSRCars.CARS.findIndex((c) => c.id === progress.selected);
    return i < 0 ? 0 : i;
  }

  function selectCarByDelta(d) {
    if (!window.SSRCars) return;
    const cars = SSRCars.CARS;
    const next = (carIndex() + d + cars.length) % cars.length;
    progress = SSRCars.selectCar(cars[next].id);
    refreshActive();
    renderGarage();
  }

  function drawGaragePreview() {
    if (!gctx || !garageCanvas || !window.SSRCars) return;
    const w = garageCanvas.width, h = garageCanvas.height;
    gctx.clearRect(0, 0, w, h);
    const bg = gctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#1a2438');
    bg.addColorStop(0.55, '#2a3348');
    bg.addColorStop(0.55, '#1c222e');
    bg.addColorStop(1, '#252b36');
    gctx.fillStyle = bg;
    gctx.fillRect(0, 0, w, h);
    gctx.fillStyle = '#2a2e34';
    gctx.fillRect(0, h * 0.62, w, h * 0.38);

    refreshActive();
    const a = active;
    if (!a) return;
    // reuse simple side profile
    gctx.save();
    gctx.translate(w * 0.5, h * 0.72);
    gctx.scale(1.55 * (a.scaleX || 1), 1.55);
    const car = {
      color: a.color, accent: a.accent, name: a.short,
      nitroActive: false, nitro: 0, shiftFlash: 0, wheelRot: performance.now() / 400,
      scaleX: 1, trickyLaunch: a.trickyLaunch,
    };
    // inline mini draw without world camera
    const old = { drawCarBody };
    // manual mini
    gctx.fillStyle = 'rgba(0,0,0,0.4)';
    gctx.beginPath(); gctx.ellipse(0, 8, 90, 12, 0, 0, Math.PI * 2); gctx.fill();
    gctx.fillStyle = shadeColor(a.color, -24);
    roundRect(gctx, -94, -24, 188, 24, 5); gctx.fill();
    gctx.fillStyle = a.color;
    roundRect(gctx, -90, -36, 180, 24, 4); gctx.fill();
    gctx.fillStyle = shadeColor(a.color, 16);
    gctx.beginPath();
    gctx.moveTo(-30, -34); gctx.lineTo(-10, -60); gctx.lineTo(50, -60); gctx.lineTo(76, -34); gctx.closePath(); gctx.fill();
    gctx.fillStyle = 'rgba(190,220,245,0.65)';
    gctx.beginPath();
    gctx.moveTo(-22, -36); gctx.lineTo(-6, -56); gctx.lineTo(46, -56); gctx.lineTo(66, -36); gctx.closePath(); gctx.fill();
    gctx.fillStyle = a.accent; gctx.fillRect(-60, -22, 56, 4);
    gctx.fillStyle = '#fff6e8'; gctx.fillRect(88, -30, 10, 13);
    gctx.fillStyle = '#ff2a2a'; gctx.fillRect(-98, -30, 8, 13);
    // wheels
    const wr = performance.now() / 400;
    [-54, 58].forEach((wx) => {
      gctx.save(); gctx.translate(wx, 4); gctx.rotate(wr);
      gctx.fillStyle = '#0a0a0a'; gctx.beginPath(); gctx.arc(0, 0, 18, 0, Math.PI * 2); gctx.fill();
      gctx.strokeStyle = '#ddd'; gctx.lineWidth = 3; gctx.beginPath(); gctx.arc(0, 0, 15, 0, Math.PI * 2); gctx.stroke();
      gctx.restore();
    });
    if (a.trickyLaunch) {
      gctx.fillStyle = 'rgba(255,120,60,0.85)';
      gctx.font = 'bold 10px sans-serif';
      gctx.fillText('HELLCAT LAUNCH', -48, -72);
    }
    gctx.restore();
  }

  function renderGarage() {
    if (!window.SSRCars || !garageEl) return;
    refreshActive();
    syncCashUI();
    const cars = SSRCars.CARS;
    const idx = carIndex();
    const car = cars[idx];
    const stats = SSRCars.appliedStats(car.id, progress);
    const nameEl = $('garage-car-name');
    const statsEl = $('garage-car-stats');
    if (nameEl) nameEl.textContent = car.name;
    if (statsEl) {
      statsEl.textContent = `${stats.engineName || 'Stock'} · ${stats.hp || '?'} hp / ${stats.tq || '?'} tq · feel ${stats.power.toFixed(2)}`;
    }
    const dots = $('car-dots');
    if (dots) {
      dots.innerHTML = cars.map((_, i) => `<span class="${i === idx ? 'on' : ''}"></span>`).join('');
    }
    drawGaragePreview();

    // tabs panels
    const panelEng = $('panel-eng');
    const panelPerf = $('panel-perf');
    const panelCos = $('panel-cos');
    if (!panelEng || !panelPerf || !panelCos) return;

    panelEng.innerHTML = '';
    for (const eng of SSRCars.enginesFor(car.id)) {
      const selected = progress.engines[car.id] === eng.id;
      const row = document.createElement('div');
      row.className = 'up-row';
      row.innerHTML = `<div class="up-info"><div class="up-name">${eng.name}${eng.launchGripMul < 0.85 ? ' ⚠' : ''}</div>
        <div class="up-desc">${eng.hp} hp · ${eng.tq} lb-ft${eng.launchGripMul < 0.85 ? ' · hard launch' : ''} · FREE</div></div>`;
      const b = document.createElement('button');
      b.className = 'up-buy' + (selected ? ' maxed' : '');
      b.textContent = selected ? 'ACTIVE' : 'SELECT';
      b.disabled = selected;
      b.addEventListener('click', () => {
        progress = SSRCars.selectEngine(car.id, eng.id);
        renderGarage();
      });
      row.appendChild(b);
      panelEng.appendChild(row);
    }

    panelPerf.innerHTML = '';
    for (const def of SSRCars.UPGRADE_DEFS) {
      if (def.id === 'body') continue;
      const level = progress.upgrades[car.id][def.id] || 0;
      const cost = SSRCars.upgradeCost(car.id, def.id, progress);
      const maxed = level >= def.max;
      const row = document.createElement('div');
      row.className = 'up-row';
      row.innerHTML = `<div class="up-info"><div class="up-name">${def.name}</div>
        <div class="up-desc">${def.desc}</div></div>
        <div class="up-lvl">Lv ${level}/${def.max}</div>`;
      const b = document.createElement('button');
      b.className = 'up-buy' + (maxed ? ' maxed' : '');
      b.textContent = maxed ? 'MAX' : `$${cost}`;
      b.disabled = maxed || cost == null || progress.cash < cost;
      b.addEventListener('click', () => {
        const res = SSRCars.buyUpgrade(car.id, def.id);
        progress = res.progress;
        refreshActive();
        renderGarage();
      });
      row.appendChild(b);
      panelPerf.appendChild(row);
    }

    panelCos.innerHTML = '';
    const title = document.createElement('div');
    title.className = 'cos-section-title';
    title.textContent = 'PAINT (FREE)';
    panelCos.appendChild(title);
    const grid = document.createElement('div');
    grid.className = 'cos-grid';
    const palette = SSRCars.COSMETIC_COLORS[car.id] || [car.color];
    palette.forEach((col, i) => {
      const sw = document.createElement('button');
      sw.type = 'button';
      sw.className = 'cos-swatch' + ((progress.colors[car.id] || 0) === i ? ' selected' : '');
      sw.style.background = col;
      sw.innerHTML = `<span class="cos-price">FREE</span>`;
      sw.addEventListener('click', () => {
        progress = SSRCars.load();
        progress.colors[car.id] = i;
        SSRCars.save(progress);
        refreshActive();
        renderGarage();
      });
      grid.appendChild(sw);
    });
    panelCos.appendChild(grid);

    const bodyDef = SSRCars.UPGRADE_DEFS.find((d) => d.id === 'body');
    if (bodyDef) {
      const t2 = document.createElement('div');
      t2.className = 'cos-section-title';
      t2.textContent = 'BODY KIT';
      panelCos.appendChild(t2);
      const level = progress.upgrades[car.id].body || 0;
      const cost = SSRCars.upgradeCost(car.id, 'body', progress);
      const maxed = level >= bodyDef.max;
      const row = document.createElement('div');
      row.className = 'up-row';
      row.innerHTML = `<div class="up-info"><div class="up-name">${bodyDef.name}</div>
        <div class="up-desc">${bodyDef.desc}</div></div>
        <div class="up-lvl">Lv ${level}/${bodyDef.max}</div>`;
      const b = document.createElement('button');
      b.className = 'up-buy' + (maxed ? ' maxed' : '');
      b.textContent = maxed ? 'MAX' : `$${cost}`;
      b.disabled = maxed || cost == null || progress.cash < cost;
      b.addEventListener('click', () => {
        const res = SSRCars.buyUpgrade(car.id, 'body');
        progress = res.progress;
        refreshActive();
        renderGarage();
      });
      row.appendChild(b);
      panelCos.appendChild(row);
    }

    // tab visibility
    panelEng.classList.toggle('hidden', garageTab !== 'eng');
    panelPerf.classList.toggle('hidden', garageTab !== 'perf');
    panelCos.classList.toggle('hidden', garageTab !== 'cos');
    document.querySelectorAll('.garage-tabs .tab').forEach((t) => {
      t.classList.toggle('active', t.dataset.tab === garageTab);
    });
  }

  document.querySelectorAll('.garage-tabs .tab').forEach((t) => {
    t.addEventListener('click', () => {
      garageTab = t.dataset.tab;
      renderGarage();
    });
  });
  if ($('btn-car-prev')) $('btn-car-prev').addEventListener('click', () => selectCarByDelta(-1));
  if ($('btn-car-next')) $('btn-car-next').addEventListener('click', () => selectCarByDelta(1));

  if ($('btn-garage')) {
    $('btn-garage').addEventListener('click', () => {
      menu.classList.add('hidden');
      garageEl.classList.remove('hidden');
      if (window.SSRAudio) SSRAudio.resume();
      renderGarage();
    });
  }
  if ($('btn-garage-back')) {
    $('btn-garage-back').addEventListener('click', () => {
      garageEl.classList.add('hidden');
      menu.classList.remove('hidden');
      syncCashUI();
    });
  }
  if ($('btn-garage-race')) {
    $('btn-garage-race').addEventListener('click', () => {
      garageEl.classList.add('hidden');
      startRace();
    });
  }

  // —— Boot ——
  if (window.SSRAudio) SSRAudio.setSettings(settings);
  resize();
  applyFpsVisibility();
  syncCashUI();
  syncSettingsUI();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  requestAnimationFrame(frame);
})();
