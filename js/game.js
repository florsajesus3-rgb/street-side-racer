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
  const throttleBtn = $('btn-throttle');
  const brakeBtn = $('btn-brake');
  const gapYouEt = $('gap-you-et');
  const gapYouMph = $('gap-you-mph');
  const gapRivalEt = $('gap-rival-et');
  const gapRivalMph = $('gap-rival-mph');
  const gapBar = $('gap-bar');
  const gapDelta = $('gap-delta');

  // Hold-throttle / brake input (Apex-like loop)
  const input = { throttle: false, brake: false, nitro: false };

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
  let wasWheelspin = false;
  let spinChirpCool = 0;
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
    let r = null;
    if (!isPlayer && window.SSRCars && a) {
      r = SSRCars.pickRival(a);
    }
    const rivalColor = (r && r.color) || '#1e6fd9';
    const src = isPlayer ? a : r;
    return {
      isPlayer,
      x: 40,
      speed: 0,
      mph: 0,
      rpm: IDLE,
      gear: 1,
      nitro: src ? src.nitroMax : MAX_NITRO,
      nitroMax: src ? src.nitroMax : MAX_NITRO,
      nitroActive: false,
      finished: false,
      finishTime: null,
      bogTimer: 0,
      shiftFlash: 0,
      wheelRot: 0,
      bodyPitch: 0,
      squatY: 0,
      wheelspin: 0,
      exhaustFlame: 0,
      id: src ? src.id : (isPlayer ? 'charger' : 'camaro'),
      color: src ? src.color : (isPlayer ? '#d62828' : rivalColor),
      accent: src ? src.accent : (isPlayer ? '#ffcc00' : '#a8c8ff'),
      name: isPlayer ? (src ? src.short : 'YOU') : ('RIVAL'),
      scaleX: src ? (src.scaleX || 1) : 1,
      bodyLevel: src ? (src.bodyLevel || 0) : 0,
      rimIndex: src ? (src.rimIndex || 0) : 0,
      rimStyle: src ? (src.rimStyle || 'spoke5') : 'spoke5',
      underglow: src ? (src.underglow || 'off') : 'off',
      launchGrip: src ? src.launchGrip : 1,
      trickyLaunch: !!(src && src.trickyLaunch),
      engineId: src ? src.engineId : null,
      redline: src ? src.redline : REDLINE,
      perfectLo: src ? src.perfectLo : PERFECT_LO,
      perfectHi: src ? src.perfectHi : PERFECT_HI,
      ratios: src ? src.ratios : GEAR_RATIOS,
      finalDrive: src ? src.finalDrive : FINAL_DRIVE,
      tireCirc: src ? src.tireCirc : TIRE_CIRC_FT,
      aiShiftAt: 7600,
      aiNitroAt: 0.35,
      aiReaction: 0.14 + Math.random() * 0.16,
      aiLaunched: false,
      aiThrottle: 1,
      power: src ? src.power : (isPlayer ? 1.0 : 0.96),
      prevScreenX: null,
    };
  }

  function resetRace() {
    Object.assign(player, makeCar(true));
    Object.assign(rival, makeCar(false));
    // AI aims near its perfect window with human-like miss
    const mid = ((rival.perfectLo || 7200) + (rival.perfectHi || 8200)) / 2;
    rival.aiShiftAt = mid + (Math.random() * 700 - 280);
    rival.aiReaction = 0.10 + Math.random() * 0.20;
    rival.aiNitroAt = 0.22 + Math.random() * 0.35;
    rival.aiThrottle = 1;
    input.throttle = false;
    input.brake = false;
    input.nitro = false;
    if (throttleBtn) throttleBtn.classList.remove('pressed');
    if (brakeBtn) brakeBtn.classList.remove('pressed');
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
    updateGapHUD();
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
    input.nitro = true;
    if (state === 'countdown' && lightsPhase >= 4 && !input.brake) beginRacing(false);
    if (state !== 'racing' && !(state === 'countdown' && lightsPhase >= 4)) return;
    rateLaunchIfNeeded();
    if (player.nitro <= 0) return;
    player.nitroActive = true;
    nitroBtn.classList.add('active');
  }, () => {
    input.nitro = false;
    player.nitroActive = false;
    nitroBtn.classList.remove('active');
  });

  if (throttleBtn) {
    bindHold(throttleBtn, () => {
      input.throttle = true;
      if (state === 'countdown' && lightsPhase >= 4 && !input.brake) beginRacing(false);
      if (state === 'racing') rateLaunchIfNeeded();
    }, () => { input.throttle = false; });
  }
  if (brakeBtn) {
    bindHold(brakeBtn, () => { input.brake = true; }, () => {
      input.brake = false;
      if (state === 'countdown' && lightsPhase >= 4) beginRacing(false);
    });
  }

  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    if (e.code === 'ArrowUp' || e.code === 'KeyE' || e.code === 'ShiftRight') shiftCar(player, 1);
    if (e.code === 'ArrowDown' || e.code === 'KeyQ') shiftCar(player, -1);
    if (e.code === 'KeyW' || e.code === 'KeyA') {
      input.throttle = true;
      if (throttleBtn) throttleBtn.classList.add('pressed');
      if (state === 'countdown' && lightsPhase >= 4 && !input.brake) beginRacing(false);
      if (state === 'racing') rateLaunchIfNeeded();
    }
    if (e.code === 'KeyS' || e.code === 'KeyD' || e.code === 'ControlLeft') {
      input.brake = true;
      if (brakeBtn) brakeBtn.classList.add('pressed');
    }
    if (e.code === 'Space' || e.code === 'KeyN') {
      input.nitro = true;
      if ((state === 'racing' || (state === 'countdown' && lightsPhase >= 4)) && player.nitro > 0) {
        player.nitroActive = true;
        nitroBtn.classList.add('active');
        if (state === 'countdown' && !input.brake) beginRacing(false);
        rateLaunchIfNeeded();
      }
    }
    if (e.code === 'Escape' && (state === 'racing' || state === 'countdown')) {
      $('btn-pause').click();
    }
  });
  window.addEventListener('keyup', (e) => {
    if (e.code === 'Space' || e.code === 'KeyN') {
      input.nitro = false;
      player.nitroActive = false;
      nitroBtn.classList.remove('active');
    }
    if (e.code === 'KeyW' || e.code === 'KeyA') {
      input.throttle = false;
      if (throttleBtn) throttleBtn.classList.remove('pressed');
    }
    if (e.code === 'KeyS' || e.code === 'KeyD' || e.code === 'ControlLeft') {
      input.brake = false;
      if (brakeBtn) brakeBtn.classList.remove('pressed');
      if (state === 'countdown' && lightsPhase >= 4) beginRacing(false);
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
      const plo = car.perfectLo || livePerfectLo();
      const phi = car.perfectHi || livePerfectHi();
      if (rpm >= plo && rpm <= phi) {
        car.shiftFlash = 0.35;
        if (car.isPlayer) {
          perfectShifts++;
          showBanner('<span class="go ok" style="font-size:0.45em">PERFECT</span><div class="sub ok perfect-glow">SHIFT</div>', 0.55);
          if (navigator.vibrate) navigator.vibrate(18);
        }
        car.speed *= 1.02;
      } else if (rpm >= plo - 700 && rpm < plo) {
        // Orange early — good but not perfect
        car.shiftFlash = 0.2;
        car.speed *= 1.008;
        if (car.isPlayer) showBanner('<span class="go" style="font-size:0.38em;color:#ff9a2a">GOOD</span>', 0.4);
      } else if (rpm > phi && rpm <= phi + 450) {
        car.shiftFlash = 0.18;
        car.speed *= 1.005;
        if (car.isPlayer) showBanner('<span class="go" style="font-size:0.38em;color:#ff9a2a">GOOD</span>', 0.4);
      } else if (rpm < plo - 700) {
        car.bogTimer = 0.55;
        if (car.isPlayer) showBanner('<span class="go warn" style="font-size:0.4em">BOG</span>', 0.5);
      } else if (rpm > phi + 450) {
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
    // Body squat / dive on upshift (visual + tiny ET feel via existing flash)
    if (dir > 0) {
      car.bodyPitch = -0.07;
      car.squatY = 6;
    }
    updateReadouts();
    if (car.isPlayer && window.SSRAudio) SSRAudio.playShift(dir > 0);
  }

  function beginRacing(_fromPlayer) {
    if (state === 'racing') return;
    state = 'racing';
    // Brake does not block race clock — it only holds the player car (see updateCar)
    if (!launchRated && !input.brake) {
      showBanner('<span class="go">GO</span>', 0.75);
    } else if (!launchRated && input.brake) {
      showBanner('<span class="go" style="font-size:0.4em;color:#fff">STAGED</span><div class="sub">RELEASE BRAKE</div>', 1.0);
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
      ? roadTop + (roadBot - roadTop) * 0.68
      : roadTop + (roadBot - roadTop) * 0.28;
    const screenX = car.x - cameraX + W * 0.26;
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

    const rl = car.redline || liveRedline();
    const grip = Math.max(0.35, car.launchGrip || 1);
    const powerGrip = (car.power || 1) / grip;

    // Staging / countdown: rev on throttle, brake holds line
    if (!racing) {
      let th = car.isPlayer ? (input.throttle ? 1 : 0) : (car.aiThrottle || 0);
      if (car.isPlayer && input.brake) th *= 0.15;
      if (th > 0.2) {
        car.rpm = clamp(car.rpm + 5200 * th * dt, IDLE, rl);
        // pre-stage burnout smoke if dumping throttle with low grip
        if (powerGrip > 1.15 && th > 0.7 && car.rpm > rl * 0.5) {
          car.wheelspin = Math.min(1, (car.wheelspin || 0) + dt * 1.2);
          spawnSmoke(car, car.isPlayer ? 0 : 1, 1.5);
        }
      } else {
        car.rpm = clamp(car.rpm - 2800 * dt, IDLE + Math.sin(performance.now() / 180) * 40, rl);
        car.wheelspin = Math.max(0, (car.wheelspin || 0) - dt);
      }
      car.speed = 0;
      car.mph = 0;
      // ease pitch back
      car.bodyPitch = (car.bodyPitch || 0) * Math.max(0, 1 - 6 * dt);
      car.squatY = (car.squatY || 0) * Math.max(0, 1 - 6 * dt);
      return;
    }

    // Player: hold GAS; AI: always on (with slight lift on shifts)
    let throttle = car.isPlayer ? (input.throttle ? 1 : 0.08) : (car.aiThrottle != null ? car.aiThrottle : 1);
    if (car.isPlayer && input.brake) throttle = 0;
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
    const baseAccel = 38 * pf * grip * (ratios[car.gear] / ratios[1]);
    const drag = 0.00035 * car.speed * car.speed;
    let accel = baseAccel - drag - car.speed * 0.02;
    if (car.isPlayer && input.brake) accel = -55 - car.speed * 0.8;

    car.speed = Math.max(0, car.speed + accel * dt);
    car.x += car.speed * dt * PX_PER_FOOT;

    const tied = rpmFromSpeed(car.speed, car.gear, car);
    const climb = 5200 * pf * dt;
    if (tied < rl) {
      car.rpm = clamp(Math.max(tied, car.rpm * 0.15 + tied * 0.85) + (car.speed < 5 ? climb : 0), IDLE, rl + 150);
    } else {
      car.rpm = rl + Math.sin(performance.now() / 40) * 80;
    }

    // Generalized wheelspin: power >> grip on launch (Hellcat + any hot mill)
    let spinning = false;
    if (car.speed < 14 && car.gear === 1 && throttle > 0.25) {
      let launchMul = grip;
      const rpmRatio = car.rpm / rl;
      // dump throttle / nitro while grip-starved → spin
      const spinThreat = powerGrip * (0.55 + 0.45 * rpmRatio) * (car.nitroActive ? 1.25 : 1) * throttle;
      if (spinThreat > 1.05 || (car.trickyLaunch && car.nitroActive && rpmRatio > 0.5) || (car.trickyLaunch && rpmRatio > 0.72 && throttle > 0.85)) {
        const excess = Math.min(1.5, spinThreat - 0.8 + (car.trickyLaunch ? 0.15 : 0));
        launchMul *= Math.max(0.28, 1 - excess * 0.6);
        spinning = true;
        car.wheelspin = Math.min(1, (car.wheelspin || 0) + dt * (2.2 + (car.trickyLaunch ? 0.6 : 0)));
        if (Math.random() < 0.1 * excess) {
          car.bogTimer = Math.max(car.bogTimer, 0.15 + excess * 0.15);
        }
      } else {
        car.wheelspin = Math.max(0, (car.wheelspin || 0) - dt * 1.5);
      }
      car.rpm = clamp(car.rpm + 6500 * throttle * nitroMul * dt * Math.max(0.4, launchMul), IDLE, rl);
      const drive = speedFromRpm(car.rpm * 0.92, 1, car) * (car.bogTimer > 0 ? 0.45 : 1) * Math.min(1, launchMul + 0.12);
      car.speed = drive;
      car.x += car.speed * dt * PX_PER_FOOT * 0.35;
      if (spinning || car.bogTimer > 0) spawnSmoke(car, car.isPlayer ? 0 : 1, 2 + (car.wheelspin || 0) * 3);
      // light wheelie for high power / light rear (low launchGrip often = heavy torque)
      if (powerGrip > 1.25 && throttle > 0.7 && car.speed > 2 && car.speed < 28 && !spinning) {
        car.bodyPitch = Math.min(0.22, (car.bodyPitch || 0) + dt * 0.55 * (powerGrip - 1.1));
        car.squatY = -Math.min(16, Math.abs(car.bodyPitch) * 70);
      }
    } else if (car.nitroActive && settings.tireSmoke) {
      spawnSmoke(car, car.isPlayer ? 0 : 1, 0.35);
      car.wheelspin = Math.max(0, (car.wheelspin || 0) - dt);
    } else {
      car.wheelspin = Math.max(0, (car.wheelspin || 0) - dt * 1.2);
    }

    // Body squat on accel / dive settle after shift flash
    if (car.shiftFlash > 0.15) {
      car.bodyPitch = Math.min(0.02, (car.bodyPitch || 0) * 0.9 - 0.06);
      car.squatY = Math.min(8, 4 + (0.35 - car.shiftFlash) * 10);
    } else if (throttle > 0.5 && car.speed > 20) {
      // mild squat under power
      const targetSquat = 3 * throttle;
      car.squatY = (car.squatY || 0) + (targetSquat - (car.squatY || 0)) * Math.min(1, 8 * dt);
      car.bodyPitch = (car.bodyPitch || 0) * Math.max(0, 1 - 4 * dt);
    } else {
      car.bodyPitch = (car.bodyPitch || 0) * Math.max(0, 1 - 5 * dt);
      car.squatY = (car.squatY || 0) * Math.max(0, 1 - 5 * dt);
    }

    car.mph = car.speed * 3600 / 5280;
    car.wheelRot += (car.speed + (car.wheelspin || 0) * 40) * dt * 2.5;
    // exhaust flame pops on hard launch / nitro / wheelspin recovery
    const wantFlame = (car.nitroActive && car.nitro > 0) || ((car.wheelspin || 0) > 0.5 && throttle > 0.5) || (car.shiftFlash > 0.05);
    car.exhaustFlame = Math.max(0, (car.exhaustFlame || 0) + (wantFlame ? dt * 4 : -dt * 3));
    if (car.exhaustFlame > 1) car.exhaustFlame = 1;

    if (car.x >= TRACK_PX) {
      car.x = TRACK_PX;
      car.finished = true;
      car.finishTime = raceTime;
      car.speed *= 0.3;
    }
  }

  function updateAI(dt) {
    if (state === 'countdown') {
      // AI stages with light throttle, launches after reaction on green
      rival.aiThrottle = 0.35 + Math.sin(performance.now() / 220) * 0.08;
      if (lightsPhase >= 4 && !rival.aiLaunched) {
        rival.aiReaction -= dt;
        if (rival.aiReaction <= 0) {
          rival.aiLaunched = true;
          rival.aiThrottle = 1;
          beginRacing(false);
        }
      }
    }
    if (state !== 'racing') return;

    rival.aiThrottle = 1;
    // Shift near perfect window with intentional miss (early/late)
    if (rival.gear < 6 && rival.rpm >= rival.aiShiftAt) {
      shiftCar(rival, 1);
      const lo = rival.perfectLo || 7200;
      const hi = rival.perfectHi || 8200;
      const mid = (lo + hi) / 2;
      // ~55% in green, rest orange/late/early
      const roll = Math.random();
      if (roll < 0.55) rival.aiShiftAt = lo + Math.random() * (hi - lo);
      else if (roll < 0.8) rival.aiShiftAt = hi + 80 + Math.random() * 350;
      else rival.aiShiftAt = lo - 200 - Math.random() * 500;
      // brief lift on shift
      rival.aiThrottle = 0.7;
      setTimeout(() => { if (!rival.finished) rival.aiThrottle = 1; }, 90);
    }
    const prog = rival.x / TRACK_PX;
    // Use nitro in mid-track bursts; sometimes hold for top-end
    if (!rival.nitroActive && rival.nitro > 0.05) {
      if (prog > rival.aiNitroAt && prog < 0.9) {
        rival.nitroActive = true;
      }
    }
    if (rival.nitro <= 0) rival.nitroActive = false;
    // Drop nitro briefly if spinning badly
    if (rival.wheelspin > 0.7 && rival.nitroActive && rival.speed < 12) {
      rival.nitroActive = false;
    }
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
    const spin = player.wheelspin || 0;
    const load = racing
      ? (player.nitroActive ? 1 : 0.55 + Math.min(0.4, player.speed / 200)) + spin * 0.35
      : (0.15 + spin * 0.55);
    SSRAudio.updateEngine({
      rpm: player.rpm,
      redline: player.redline || liveRedline(),
      load: Math.min(1.2, load),
      nitro: !!(player.nitroActive && player.nitro > 0),
      idle: !racing && spin < 0.2,
      engineId: player.engineId || (active && active.engineId) || null,
      wheelspin: spin,
    });
    if (player.nitroActive && player.nitro > 0 && !wasNitro) {
      SSRAudio.playNitro(true);
      wasNitro = true;
    } else if ((!player.nitroActive || player.nitro <= 0) && wasNitro) {
      SSRAudio.playNitro(false);
      wasNitro = false;
    }
    // Tire chirp when wheelspin crosses into real slip
    if (spinChirpCool > 0) spinChirpCool -= 1 / 60;
    if (spin > 0.45 && !wasWheelspin && spinChirpCool <= 0) {
      SSRAudio.playTireChirp(spin > 0.75);
      spinChirpCool = 0.35;
      wasWheelspin = true;
    } else if (spin < 0.2) {
      wasWheelspin = false;
    } else if (spin > 0.85 && spinChirpCool <= 0) {
      SSRAudio.playTireChirp(true);
      spinChirpCool = 0.5;
    }
  }

  // —— Drawing ——
  function drawBackground(cam) {
    // Pixel drag-strip sky
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#2a3340');
    g.addColorStop(0.35, '#5a6a5a');
    g.addColorStop(0.55, '#6e7a62');
    g.addColorStop(1, '#2a2e34');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    const horizon = H * 0.40;
    const roadTop = H * 0.52;
    const roadBot = H;
    const density = settings.crowdDensity ? 1 : 0.45;

    // grandstand lite (pixel bleachers)
    ctx.fillStyle = '#2e342c';
    ctx.fillRect(0, horizon - 52, W, 38);
    for (let row = 0; row < 3; row++) {
      ctx.fillStyle = row % 2 ? '#3a4038' : '#32382e';
      ctx.fillRect(0, horizon - 50 + row * 10, W, 9);
      for (let x = -((cam * 0.18) % 16); x < W; x += 16) {
        ctx.fillStyle = hash(Math.floor(x + cam + row * 9)) > 0.55 ? '#5a4a3a' : '#2a3348';
        ctx.fillRect(x + 2, horizon - 48 + row * 10, 5, 7);
      }
    }
    ctx.fillStyle = '#1a1e18';
    ctx.fillRect(0, horizon - 16, W, 6);

    // stacked tire wall
    const tireY = roadTop - 18;
    for (let stack = 0; stack < 2; stack++) {
      for (let x = -((cam * 0.85) % 20); x < W + 20; x += 20) {
        ctx.fillStyle = stack ? '#151515' : '#1c1c1c';
        ctx.beginPath();
        ctx.ellipse(x + 9, tireY + 6 - stack * 9, 9, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(x + 9, tireY + 6 - stack * 9, 5, 3, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // green runoff
    ctx.fillStyle = '#3d5a34';
    ctx.fillRect(0, horizon + 4, W, roadTop - horizon - 20);
    ctx.fillStyle = '#4a6a3c';
    for (let x = -((cam * 0.3) % 40); x < W; x += 40) ctx.fillRect(x, horizon + 8, 18, 3);

    if (settings.crowdDensity) drawCrowd(cam, roadTop);

    // dual-lane asphalt with seam
    ctx.fillStyle = '#3a3e44';
    ctx.fillRect(0, roadTop, W, roadBot - roadTop);
    ctx.fillStyle = '#32363c';
    ctx.fillRect(0, roadTop + (roadBot - roadTop) * 0.48, W, (roadBot - roadTop) * 0.52);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(0, roadTop + (roadBot - roadTop) * 0.47, W, 3);

    if (settings.reflections) {
      const rg = ctx.createLinearGradient(0, roadTop, 0, roadBot);
      rg.addColorStop(0, 'rgba(180,200,230,0.06)');
      rg.addColorStop(1, 'rgba(0,0,0,0.2)');
      ctx.fillStyle = rg;
      ctx.fillRect(0, roadTop, W, roadBot - roadTop);
    }

    // lane divider
    const laneY = roadTop + (roadBot - roadTop) * 0.38;
    ctx.fillStyle = '#e8e8e8';
    for (let i = -((cam * 0.9) % 48); i < W; i += 48) {
      ctx.fillRect(i, laneY - 1, 26, 3);
    }

    // yellow/blue striped curbing
    for (let i = -((cam * 0.9) % 32); i < W; i += 32) {
      ctx.fillStyle = (Math.floor((i + cam * 0.9) / 16) % 2 === 0) ? '#ffe14a' : '#2a6cff';
      ctx.fillRect(i, roadTop - 5, 16, 5);
      ctx.fillRect(i, roadBot - 8, 16, 5);
    }

    // cones — lane edges + center
    for (let i = -2; i < Math.ceil(W / 70) + 2; i++) {
      const cx = i * 70 - ((cam * 0.9) % 70) + 20;
      drawCone(cx, roadTop + 8);
      drawCone(cx + 35, laneY - 8);
      drawCone(cx + 18, roadBot - 22);
    }

    const finX = TRACK_PX - cam;
    if (finX > -40 && finX < W + 40) {
      for (let y = roadTop; y < roadBot; y += 14) {
        ctx.fillStyle = (Math.floor((y - roadTop) / 14) % 2 === 0) ? '#fff' : '#111';
        ctx.fillRect(finX, y, 12, 14);
      }
      ctx.fillStyle = '#ffe14a';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText('FINISH', finX - 8, roadTop - 16);
    }

    drawLights(120 - cam * 0.15, roadTop - 100);
  }

  function drawCone(x, y) {
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(x - 5, y, 10, 3);
    ctx.fillStyle = '#ff7a1a';
    ctx.beginPath();
    ctx.moveTo(x, y - 14);
    ctx.lineTo(x + 5, y);
    ctx.lineTo(x - 5, y);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillRect(x - 3, y - 8, 6, 3);
    ctx.fillStyle = '#ff7a1a';
    ctx.fillRect(x - 2, y - 12, 4, 2);
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
    // True dual-lane: both cars fully visible, similar size
    const yBase = lane === 0
      ? roadTop + (roadBot - roadTop) * 0.68
      : roadTop + (roadBot - roadTop) * 0.28;

    const screenX = car.x - cameraX + W * 0.26;
    const scale = lane === 0 ? 1.0 : 0.96;
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
    const quality = (settings && settings.preset) || 'High';
    const opts = {
      quality,
      reflectionPass: !!reflectionPass,
      time: performance.now(),
      showLabel: !reflectionPass,
      // High/Ultra: vector silhouettes; Low/Med: pixel sprites (both original art)
      mode: (quality === 'High' || quality === 'Ultra') ? 'vector' : 'pixel',
    };
    if (window.SSRCarsDraw) {
      SSRCarsDraw.drawAt(ctx, car, screenX, y, scale, opts);
      return;
    }
    // fallback minimal if draw module missing
    ctx.save();
    ctx.translate(screenX, y);
    ctx.scale(scale * (car.scaleX || 1), scale);
    ctx.fillStyle = car.color || '#888';
    roundRect(ctx, -90, -36, 180, 30, 4);
    ctx.fill();
    ctx.restore();
  }

  function shadeColor(hex, amt) {
    if (window.SSRCarsDraw && SSRCarsDraw.shadeColor) return SSRCarsDraw.shadeColor(hex, amt);
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
    if (window.SSRCarsDraw) {
      SSRCarsDraw.drawWheel(ctx, x, y, rot, {
        quality: (settings && settings.preset) || 'High',
        rimStyle: 'spoke5',
      });
      return;
    }
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.fillStyle = '#0a0a0a';
    ctx.beginPath();
    ctx.arc(0, 0, 18, 0, Math.PI * 2);
    ctx.fill();
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
    const start = Math.PI * 0.75;
    const end = Math.PI * 2.25;

    // analog bezel
    const bezel = tctx.createRadialGradient(cx - R * 0.2, cy - R * 0.25, R * 0.1, cx, cy, R + 10);
    bezel.addColorStop(0, '#3a3e46');
    bezel.addColorStop(0.55, '#1a1c20');
    bezel.addColorStop(1, '#0a0a0c');
    tctx.beginPath();
    tctx.arc(cx, cy, R + 10, 0, Math.PI * 2);
    tctx.fillStyle = bezel;
    tctx.fill();
    tctx.strokeStyle = '#8a9098';
    tctx.lineWidth = 3;
    tctx.stroke();
    tctx.beginPath();
    tctx.arc(cx, cy, R + 6, 0, Math.PI * 2);
    tctx.strokeStyle = '#2a2e34';
    tctx.lineWidth = 5;
    tctx.stroke();

    // face
    tctx.beginPath();
    tctx.arc(cx, cy, R - 2, 0, Math.PI * 2);
    tctx.fillStyle = '#0e1014';
    tctx.fill();

    // track arc
    tctx.strokeStyle = '#2a2e38';
    tctx.lineWidth = 12;
    tctx.beginPath();
    tctx.arc(cx, cy, R - 14, start, end);
    tctx.stroke();

    const plo = player.perfectLo || livePerfectLo();
    const phi = player.perfectHi || livePerfectHi();
    const prl = player.redline || liveRedline();
    const o0 = start + (end - start) * (Math.max(0, plo - 700) / prl);
    const o1 = start + (end - start) * (Math.min(prl, phi + 450) / prl);
    tctx.strokeStyle = '#ff9a2a';
    tctx.lineWidth = 12;
    tctx.beginPath();
    tctx.arc(cx, cy, R - 14, o0, o1);
    tctx.stroke();
    const g0 = start + (end - start) * (plo / prl);
    const g1 = start + (end - start) * (phi / prl);
    tctx.strokeStyle = '#7CFF3A';
    tctx.beginPath();
    tctx.arc(cx, cy, R - 14, g0, g1);
    tctx.stroke();
    const r0 = start + (end - start) * 0.90;
    tctx.strokeStyle = '#ff2a2a';
    tctx.beginPath();
    tctx.arc(cx, cy, R - 14, r0, end);
    tctx.stroke();

    // major/minor ticks + numerals
    tctx.fillStyle = '#d0d4da';
    tctx.font = 'bold ' + Math.round(s * 0.055) + 'px sans-serif';
    tctx.textAlign = 'center';
    tctx.textBaseline = 'middle';
    for (let i = 0; i <= 8; i++) {
      const a = start + (end - start) * (i / 8);
      const cos = Math.cos(a), sin = Math.sin(a);
      const major = i % 2 === 0;
      tctx.strokeStyle = major ? '#f0f2f5' : '#8a9098';
      tctx.lineWidth = major ? 3 : 1.5;
      tctx.beginPath();
      tctx.moveTo(cx + cos * (R - (major ? 28 : 22)), cy + sin * (R - (major ? 28 : 22)));
      tctx.lineTo(cx + cos * (R - 6), cy + sin * (R - 6));
      tctx.stroke();
      if (major) {
        const k = Math.round((i / 8) * (prl / 1000));
        tctx.fillStyle = i >= 7 ? '#ff4a4a' : '#e8ecf0';
        tctx.fillText(String(k), cx + cos * (R - 38), cy + sin * (R - 38));
      }
    }
    tctx.fillStyle = '#6a7388';
    tctx.font = 'bold ' + Math.round(s * 0.04) + 'px sans-serif';
    tctx.fillText('RPM x1000', cx, cy + R * 0.42);

    // needle with hub
    const rpmN = clamp(player.rpm / prl, 0, 1.05);
    const ang = start + (end - start) * Math.min(1, rpmN);
    tctx.save();
    tctx.translate(cx, cy);
    tctx.rotate(ang);
    tctx.fillStyle = '#ff3030';
    tctx.beginPath();
    tctx.moveTo(-14, -3);
    tctx.lineTo(R - 26, -1.5);
    tctx.lineTo(R - 26, 1.5);
    tctx.lineTo(-14, 3);
    tctx.closePath();
    tctx.fill();
    tctx.fillStyle = '#fff0f0';
    tctx.fillRect(R - 40, -1, 12, 2);
    tctx.restore();
    const hub = tctx.createRadialGradient(cx - 2, cy - 2, 1, cx, cy, 12);
    hub.addColorStop(0, '#e8ecf0');
    hub.addColorStop(1, '#4a5058');
    tctx.beginPath();
    tctx.arc(cx, cy, 10, 0, Math.PI * 2);
    tctx.fillStyle = hub;
    tctx.fill();
    tctx.beginPath();
    tctx.arc(cx, cy, 4, 0, Math.PI * 2);
    tctx.fillStyle = '#1a1c20';
    tctx.fill();
  }

  function updateGapHUD() {
    if (!gapYouEt) return;
    const pEt = player.finished && player.finishTime != null
      ? player.finishTime.toFixed(3)
      : (state === 'racing' ? raceTime.toFixed(2) : '—.——');
    const rEt = rival.finished && rival.finishTime != null
      ? rival.finishTime.toFixed(3)
      : (state === 'racing' ? raceTime.toFixed(2) : '—.——');
    gapYouEt.textContent = pEt;
    gapRivalEt.textContent = rEt;
    if (gapYouMph) gapYouMph.textContent = `${Math.round(player.mph)} mph`;
    if (gapRivalMph) gapRivalMph.textContent = `${Math.round(rival.mph)} mph`;

    // Live gap in feet (positive = player ahead)
    const gapFt = (player.x - rival.x) / PX_PER_FOOT;
    const ahead = gapFt >= 0;
    const absFt = Math.abs(gapFt);
    let label = 'EVEN';
    if (absFt < 1.5) label = 'EVEN';
    else if (absFt < 5280) label = (ahead ? '+' : '−') + (absFt < 100 ? absFt.toFixed(1) + ' ft' : (absFt / 3).toFixed(1) + ' yd');
    if (gapDelta) {
      gapDelta.textContent = label;
      gapDelta.style.color = absFt < 1.5 ? '#fff' : (ahead ? '#7CFF3A' : '#ff8a8a');
    }
    if (gapBar) {
      // Map ±80 ft to bar position
      const n = clamp(gapFt / 80, -1, 1);
      const left = 50 + n * 42;
      gapBar.style.left = left + '%';
      gapBar.style.width = '10%';
      gapBar.style.background = ahead
        ? 'linear-gradient(90deg, #7CFF3A, #b8ff6a)'
        : 'linear-gradient(90deg, #ff6a6a, #ff9a5a)';
    }
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
            // Race auto-rolls after Christmas tree; brake only stages the player
            if (state === 'countdown' && lightsPhase >= 4) beginRacing(false);
          }, 80);
        }
      }
      updateCar(player, dt, false);
      updateCar(rival, dt, false);
      updateAI(dt);
      updateGapHUD();
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

      // Dual-lane camera: keep BOTH cars framed side-by-side
      const lead = Math.max(player.x, rival.x);
      const trail = Math.min(player.x, rival.x);
      const mid = (player.x + rival.x) * 0.5;
      const sep = lead - trail;
      // Bias slightly toward mid so both stay on screen; look ahead with lead car
      const lookAhead = Math.min(160, Math.max(player.speed, rival.speed) * 0.3);
      let target = mid - W * 0.32 + lookAhead;
      // If separation grows, pull camera so neither leaves the frame
      const maxSep = W * 0.55;
      if (sep > maxSep) {
        target = trail - W * 0.12;
      }
      // Also ensure lead isn't past ~78% of screen
      const leadScreen = lead - target;
      if (leadScreen > W * 0.78) target = lead - W * 0.78;
      const trailScreen = trail - target;
      if (trailScreen < W * 0.05) target = trail - W * 0.05;
      const stiff = 9;
      const damp = 7.5;
      const ax = (target - cameraX) * stiff - cameraVel * damp;
      cameraVel += ax * dt;
      cameraX += cameraVel * dt;

      updateGapHUD();

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
    const pT = player.finishTime || raceTime;
    const rT = rival.finishTime || raceTime;
    const margin = (rT - pT);
    const marginStr = win
      ? `Won by <b style="color:#7CFF3A">${Math.abs(margin).toFixed(3)}s</b>`
      : `Lost by <b style="color:#ff6a6a">${Math.abs(margin).toFixed(3)}s</b>`;
    resultStats.innerHTML =
      `You: <b>${pT.toFixed(3)}s</b> · ${Math.round(player.mph)} mph<br/>` +
      `Rival: <b>${rT.toFixed(3)}s</b> · ${Math.round(rival.mph)} mph<br/>` +
      `${marginStr}<br/>` +
      `Reaction: <b>${rt}</b> · Perfect shifts: <b>${perfectShifts}</b>` + earnedLine;
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

  // —— Garage (pixel grid + class filter + dyno) ——
  const garageEl = $('garage');
  const menuCash = $('menu-cash');
  const garageCash = $('garage-cash');
  const garageCanvas = $('garage-canvas');
  const gctx = garageCanvas ? garageCanvas.getContext('2d') : null;
  const dynoCanvas = $('dyno-canvas');
  const dctx = dynoCanvas ? dynoCanvas.getContext('2d') : null;
  let classFilter = 'ALL';

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

  function drawGaragePreview() {
    if (!gctx || !garageCanvas || !window.SSRCars) return;
    const w = garageCanvas.width, h = garageCanvas.height;
    gctx.imageSmoothingEnabled = false;
    gctx.clearRect(0, 0, w, h);
    // garage bay
    gctx.fillStyle = '#2a2e34';
    gctx.fillRect(0, 0, w, h);
    gctx.fillStyle = '#3a3e44';
    gctx.fillRect(0, 0, w, h * 0.55);
    // wall details
    gctx.fillStyle = '#4a4040';
    gctx.fillRect(w * 0.82, h * 0.1, 8, h * 0.4);
    gctx.fillStyle = '#ffe14a';
    for (let i = 0; i < 5; i++) gctx.fillRect(w * 0.78, h * 0.12 + i * 14, 18, 3);
    gctx.fillStyle = '#1a1c20';
    gctx.fillRect(0, h * 0.62, w, h * 0.38);
    gctx.strokeStyle = '#2a2e34';
    gctx.lineWidth = 2;
    for (let i = 0; i < 8; i++) {
      gctx.beginPath();
      gctx.moveTo(0, h * 0.62 + i * 10);
      gctx.lineTo(w, h * 0.72 + i * 12);
      gctx.stroke();
    }

    refreshActive();
    const a = active;
    if (!a) return;
    const car = {
      id: a.id,
      color: a.color,
      accent: a.accent,
      name: a.short,
      nitroActive: false,
      nitro: 0,
      shiftFlash: 0,
      wheelRot: performance.now() / 400,
      scaleX: a.scaleX || 1,
      bodyLevel: a.bodyLevel || 0,
      rimIndex: a.rimIndex || 0,
      rimStyle: a.rimStyle || 'spoke5',
      underglow: a.underglow || 'off',
      trickyLaunch: a.trickyLaunch,
    };
    if (window.SSRCarsDraw) {
      const q = (settings && settings.preset) || 'High';
      SSRCarsDraw.drawAt(gctx, car, w * 0.5, h * 0.82, 2.65, {
        quality: q,
        reflectionPass: false,
        time: performance.now(),
        showLabel: false,
        mode: (q === 'High' || q === 'Ultra') ? 'vector' : 'pixel',
      });
    }
    if (a.trickyLaunch) {
      gctx.fillStyle = '#ff7a3a';
      gctx.font = 'bold 11px sans-serif';
      gctx.fillText('HELLCAT LAUNCH', w * 0.5 - 48, 18);
    }
  }

  function drawDyno() {
    if (!dctx || !dynoCanvas || !window.SSRCars || !progress) return;
    const w = dynoCanvas.width, h = dynoCanvas.height;
    const carId = progress.selected;
    const dyno = SSRCars.dynoCurves(carId, progress);
    dctx.imageSmoothingEnabled = true;
    dctx.fillStyle = '#0a0c10';
    dctx.fillRect(0, 0, w, h);
    // readable grid + axis frame
    dctx.strokeStyle = '#1e2430';
    dctx.lineWidth = 1;
    for (let i = 0; i <= 8; i++) {
      const x = 44 + ((w - 56) * i) / 8;
      dctx.beginPath(); dctx.moveTo(x, 12); dctx.lineTo(x, h - 28); dctx.stroke();
    }
    for (let i = 0; i <= 5; i++) {
      const y = 12 + ((h - 40) * i) / 5;
      dctx.beginPath(); dctx.moveTo(44, y); dctx.lineTo(w - 12, y); dctx.stroke();
    }
    dctx.strokeStyle = '#3a4458';
    dctx.lineWidth = 2;
    dctx.strokeRect(44, 12, w - 56, h - 40);
    const maxHp = Math.max(100, ...dyno.points.map((p) => p.hp), dyno.peakHp);
    const maxTq = Math.max(100, ...dyno.points.map((p) => p.tq), dyno.peakTq);
    const maxY = Math.max(maxHp, maxTq) * 1.08;
    const plotW = w - 56, plotH = h - 40;
    function xy(p, val) {
      const x = 44 + (p.rpm / dyno.redline) * plotW;
      const y = 12 + plotH - (val / maxY) * plotH;
      return [x, y];
    }
    // torque dashed blue
    dctx.strokeStyle = '#4aa8ff';
    dctx.lineWidth = 3;
    dctx.setLineDash([7, 4]);
    dctx.beginPath();
    dyno.points.forEach((p, i) => {
      const [x, y] = xy(p, p.tq);
      if (i === 0) dctx.moveTo(x, y); else dctx.lineTo(x, y);
    });
    dctx.stroke();
    dctx.setLineDash([]);
    // power solid orange
    dctx.strokeStyle = '#ff8a2a';
    dctx.lineWidth = 3.5;
    dctx.beginPath();
    dyno.points.forEach((p, i) => {
      const [x, y] = xy(p, p.hp);
      if (i === 0) dctx.moveTo(x, y); else dctx.lineTo(x, y);
    });
    dctx.stroke();
    // peak markers
    const peakHp = dyno.points.reduce((b, p) => p.hp > b.hp ? p : b, dyno.points[0]);
    const peakTq = dyno.points.reduce((b, p) => p.tq > b.tq ? p : b, dyno.points[0]);
    if (peakHp) {
      const [hx, hy] = xy(peakHp, peakHp.hp);
      dctx.fillStyle = '#ff8a2a';
      dctx.beginPath(); dctx.arc(hx, hy, 4, 0, Math.PI * 2); dctx.fill();
      dctx.font = 'bold 11px sans-serif';
      dctx.fillText(Math.round(peakHp.hp) + ' hp', hx + 6, hy - 4);
    }
    if (peakTq) {
      const [tx, ty] = xy(peakTq, peakTq.tq);
      dctx.fillStyle = '#4aa8ff';
      dctx.beginPath(); dctx.arc(tx, ty, 4, 0, Math.PI * 2); dctx.fill();
      dctx.font = 'bold 11px sans-serif';
      dctx.fillText(Math.round(peakTq.tq) + ' tq', tx + 6, ty + 12);
    }
    dctx.fillStyle = '#9aa3b8';
    dctx.font = 'bold 11px sans-serif';
    dctx.fillText('RPM', w / 2 - 12, h - 8);
    dctx.fillText(String(Math.round(maxY)), 4, 22);
    dctx.fillText('0', 30, h - 30);
    dctx.fillText(String(dyno.redline), w - 48, h - 30);
  }

  function renderCarGrid() {
    const grid = $('car-grid');
    if (!grid || !window.SSRCars) return;
    grid.innerHTML = '';
    for (const car of SSRCars.CARS) {
      const stats = SSRCars.appliedStats(car.id, progress);
      const cr = SSRCars.classRating(stats);
      if (classFilter !== 'ALL' && cr.letter !== classFilter) continue;
      const tile = document.createElement('button');
      tile.type = 'button';
      tile.className = 'car-tile' + (progress.selected === car.id ? ' selected' : '');
      tile.innerHTML = `<span class="class-tag"><span class="cls ${cr.letter}">${cr.letter}</span><span class="rtg">${cr.rating}</span></span>
        <canvas width="168" height="72"></canvas>
        <div class="tile-name">${car.short}</div>
        <div class="tile-hp">${stats.hp || '?'} HP</div>`;
      const cv = tile.querySelector('canvas');
      const tctx = cv.getContext('2d');
      tctx.imageSmoothingEnabled = false;
      tctx.fillStyle = '#0c0e12';
      tctx.fillRect(0, 0, 168, 72);
      // bay floor stripe
      tctx.fillStyle = '#1a1e26';
      tctx.fillRect(0, 52, 168, 20);
      if (window.SSRCarsDraw) {
        const q = (settings && settings.preset) || 'High';
        SSRCarsDraw.drawAt(tctx, {
          id: car.id, color: stats.color, accent: stats.accent,
          bodyLevel: stats.bodyLevel, rimStyle: stats.rimStyle, underglow: stats.underglow,
          nitroActive: false, nitro: 0, wheelRot: 0.4, scaleX: 1,
        }, 84, 58, 1.15, { mode: (q === 'High' || q === 'Ultra') ? 'vector' : 'pixel', showLabel: false, quality: q });
      }
      tile.addEventListener('click', () => {
        progress = SSRCars.selectCar(car.id);
        refreshActive();
        renderGarage();
      });
      grid.appendChild(tile);
    }
  }

  function renderGarage() {
    if (!window.SSRCars || !garageEl) return;
    refreshActive();
    syncCashUI();
    const cars = SSRCars.CARS;
    const idx = carIndex();
    const car = cars[idx];
    const stats = SSRCars.appliedStats(car.id, progress);
    const cr = SSRCars.classRating(stats);
    const nameEl = $('garage-car-name');
    const statsEl = $('garage-car-stats');
    if (nameEl) nameEl.textContent = car.name;
    if (statsEl) {
      statsEl.textContent = `${stats.engineName || 'Stock'} · ${stats.hp || '?'} hp / ${stats.tq || '?'} tq · feel ${stats.power.toFixed(2)}`;
    }
    const tag = $('garage-class-tag');
    if (tag) tag.innerHTML = `<span class="cls ${cr.letter}">${cr.letter}</span><span class="rtg">${cr.rating}</span>`;

    document.querySelectorAll('#class-filter .class-chip').forEach((b) => {
      b.classList.toggle('active', b.dataset.class === classFilter);
    });

    renderCarGrid();
    drawGaragePreview();
    drawDyno();

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

    const tRim = document.createElement('div');
    tRim.className = 'cos-section-title';
    tRim.textContent = 'RIMS (FREE)';
    panelCos.appendChild(tRim);
    const rimRow = document.createElement('div');
    rimRow.className = 'up-row';
    const rimName = (SSRCars.RIM_STYLES && SSRCars.RIM_STYLES[(progress.rims && progress.rims[car.id]) || 0]) || 'spoke5';
    rimRow.innerHTML = `<div class="up-info"><div class="up-name">${rimName}</div>
      <div class="up-desc">Wheel face style</div></div>`;
    const rimBtn = document.createElement('button');
    rimBtn.className = 'up-buy';
    rimBtn.textContent = 'CYCLE';
    rimBtn.addEventListener('click', () => {
      progress = SSRCars.cycleRim(car.id);
      refreshActive();
      renderGarage();
    });
    rimRow.appendChild(rimBtn);
    panelCos.appendChild(rimRow);

    const tGlow = document.createElement('div');
    tGlow.className = 'cos-section-title';
    tGlow.textContent = 'UNDERGLOW (FREE)';
    panelCos.appendChild(tGlow);
    const glowRow = document.createElement('div');
    glowRow.className = 'up-row';
    const glowName = (progress.underglow && progress.underglow[car.id]) || 'off';
    glowRow.innerHTML = `<div class="up-info"><div class="up-name">${glowName}</div>
      <div class="up-desc">Neon underbody light</div></div>`;
    const glowBtn = document.createElement('button');
    glowBtn.className = 'up-buy';
    glowBtn.textContent = 'CYCLE';
    glowBtn.addEventListener('click', () => {
      progress = SSRCars.cycleUnderglow(car.id);
      refreshActive();
      renderGarage();
    });
    glowRow.appendChild(glowBtn);
    panelCos.appendChild(glowRow);

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
  document.querySelectorAll('#class-filter .class-chip').forEach((b) => {
    b.addEventListener('click', () => {
      classFilter = b.dataset.class;
      renderGarage();
    });
  });

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
