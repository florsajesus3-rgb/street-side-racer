/** Street Side Racer — procedural Web Audio (no copyrighted samples). */
(function (global) {
  'use strict';

  let ctx = null;
  let master = null;
  let engineGain = null;
  let sfxGain = null;
  let engineOsc = null;
  let engineOsc2 = null;
  let engineNoise = null;
  let engineFilter = null;
  let engineLfo = null;
  let crowdGain = null;
  let crowdNodes = null;
  let started = false;
  let nitroWhoosh = null;
  let settingsRef = {
    masterVol: 0.75,
    engineVol: 0.7,
    sfxVol: 0.7,
    muted: false,
    crowdBed: true,
  };

  /** Per-engine voice (Pebble feel pass). */
  let voice = {
    id: 'v8',
    cylMul: 2.0,       // pitch vs RPM
    harm2: 2.01,
    harmGain: 0.08,
    noiseAmt: 1.0,
    filterBase: 500,
    filterSpan: 2800,
    whine: 0,          // SC / turbo whistle amount 0..1
    highRev: 0,        // skyline scream
    bark: 0.5,         // shift overrun bark
  };
  let scOsc = null;
  let scGain = null;
  let screamOsc = null;
  let screamGain = null;

  const VOICES = {
    // NA V8 muscle
    hemi57:   { id: 'hemi57', cylMul: 1.85, harm2: 2.0, harmGain: 0.1, noiseAmt: 1.05, filterBase: 420, filterSpan: 2400, whine: 0, highRev: 0, bark: 0.7 },
    '392':    { id: '392', cylMul: 1.9, harm2: 2.02, harmGain: 0.11, noiseAmt: 1.1, filterBase: 450, filterSpan: 2600, whine: 0, highRev: 0, bark: 0.75 },
    hellcat:  { id: 'hellcat', cylMul: 1.75, harm2: 2.05, harmGain: 0.09, noiseAmt: 1.25, filterBase: 480, filterSpan: 3000, whine: 0.85, highRev: 0.15, bark: 0.9 },
    coyote50: { id: 'coyote50', cylMul: 2.05, harm2: 2.01, harmGain: 0.09, noiseAmt: 0.95, filterBase: 520, filterSpan: 2700, whine: 0, highRev: 0.1, bark: 0.6 },
    darkhorse:{ id: 'darkhorse', cylMul: 2.1, harm2: 2.03, harmGain: 0.1, noiseAmt: 1.0, filterBase: 540, filterSpan: 2900, whine: 0, highRev: 0.2, bark: 0.65 },
    eco23:    { id: 'eco23', cylMul: 2.4, harm2: 3.01, harmGain: 0.06, noiseAmt: 0.85, filterBase: 600, filterSpan: 3200, whine: 0.45, highRev: 0.1, bark: 0.4 },
    // I6 turbo
    b48:      { id: 'b48', cylMul: 2.6, harm2: 3.0, harmGain: 0.07, noiseAmt: 0.8, filterBase: 650, filterSpan: 3400, whine: 0.55, highRev: 0.25, bark: 0.35 },
    b58:      { id: 'b58', cylMul: 2.55, harm2: 3.02, harmGain: 0.08, noiseAmt: 0.85, filterBase: 620, filterSpan: 3600, whine: 0.5, highRev: 0.35, bark: 0.4 },
    // Camaro
    lTG:      { id: 'lTG', cylMul: 2.5, harm2: 3.0, harmGain: 0.06, noiseAmt: 0.85, filterBase: 600, filterSpan: 3200, whine: 0.5, highRev: 0.15, bark: 0.35 },
    lgx:      { id: 'lgx', cylMul: 2.2, harm2: 2.5, harmGain: 0.07, noiseAmt: 0.9, filterBase: 550, filterSpan: 2800, whine: 0, highRev: 0.15, bark: 0.45 },
    lt1:      { id: 'lt1', cylMul: 1.95, harm2: 2.02, harmGain: 0.1, noiseAmt: 1.05, filterBase: 480, filterSpan: 2700, whine: 0, highRev: 0.1, bark: 0.7 },
    lt4:      { id: 'lt4', cylMul: 1.8, harm2: 2.04, harmGain: 0.09, noiseAmt: 1.2, filterBase: 500, filterSpan: 3100, whine: 0.75, highRev: 0.2, bark: 0.85 },
    pentastar:{ id: 'pentastar', cylMul: 2.15, harm2: 2.4, harmGain: 0.07, noiseAmt: 0.9, filterBase: 520, filterSpan: 2600, whine: 0, highRev: 0.1, bark: 0.4 },
    // Skyline I6
    rb20:     { id: 'rb20', cylMul: 2.7, harm2: 3.05, harmGain: 0.07, noiseAmt: 0.75, filterBase: 700, filterSpan: 3800, whine: 0.4, highRev: 0.55, bark: 0.3 },
    rb26:     { id: 'rb26', cylMul: 2.65, harm2: 3.08, harmGain: 0.08, noiseAmt: 0.8, filterBase: 720, filterSpan: 4200, whine: 0.55, highRev: 0.85, bark: 0.35 },
    rb26n1:   { id: 'rb26n1', cylMul: 2.7, harm2: 3.1, harmGain: 0.09, noiseAmt: 0.85, filterBase: 750, filterSpan: 4500, whine: 0.6, highRev: 1.0, bark: 0.4 },
  };

  function setVoice(engineId) {
    voice = Object.assign({}, VOICES[engineId] || {
      id: engineId || 'v8', cylMul: 2.0, harm2: 2.01, harmGain: 0.08, noiseAmt: 1.0,
      filterBase: 500, filterSpan: 2800, whine: 0, highRev: 0, bark: 0.5,
    });
    ensureScLayer();
  }

  function ensureScLayer() {
    if (!ctx || !started) return;
    if (!scOsc) {
      scOsc = ctx.createOscillator();
      scOsc.type = 'sine';
      scGain = ctx.createGain();
      scGain.gain.value = 0;
      scOsc.connect(scGain);
      scGain.connect(engineGain);
      scOsc.start();
    }
    if (!screamOsc) {
      screamOsc = ctx.createOscillator();
      screamOsc.type = 'sawtooth';
      screamGain = ctx.createGain();
      screamGain.gain.value = 0;
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = 2200;
      f.Q.value = 4;
      screamOsc.connect(f);
      f.connect(screamGain);
      screamGain.connect(engineGain);
      screamOsc.start();
      screamOsc._f = f;
    }
  }

  function ensure() {
    if (ctx) return true;
    const AC = global.AudioContext || global.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);

    engineGain = ctx.createGain();
    engineGain.gain.value = 0;
    engineGain.connect(master);

    sfxGain = ctx.createGain();
    sfxGain.gain.value = 0.7;
    sfxGain.connect(master);

    crowdGain = ctx.createGain();
    crowdGain.gain.value = 0;
    crowdGain.connect(master);

    applyVolumes();
    return true;
  }

  function applyVolumes() {
    if (!master) return;
    const m = settingsRef.muted ? 0 : (settingsRef.masterVol || 0);
    master.gain.setTargetAtTime(m, ctx.currentTime, 0.05);
    if (engineGain) engineGain.gain.setTargetAtTime(0, ctx.currentTime, 0.05); // updated each frame
    if (sfxGain) sfxGain.gain.setTargetAtTime(settingsRef.sfxVol || 0, ctx.currentTime, 0.05);
    if (crowdGain) {
      const c = settingsRef.crowdBed && !settingsRef.muted ? 0.045 * (settingsRef.masterVol || 0) : 0;
      crowdGain.gain.setTargetAtTime(c, ctx.currentTime, 0.2);
    }
  }

  function setSettings(s) {
    settingsRef = Object.assign(settingsRef, s || {});
    applyVolumes();
  }

  function resume() {
    if (!ensure()) return;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    if (!started) startEngine();
    if (settingsRef.crowdBed) startCrowd();
  }

  function noiseBuffer(seconds) {
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  function startEngine() {
    if (started || !ctx) return;
    started = true;

    engineFilter = ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 800;
    engineFilter.Q.value = 0.8;
    engineFilter.connect(engineGain);

    engineOsc = ctx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 40;
    const oscGain = ctx.createGain();
    oscGain.gain.value = 0.22;
    engineOsc.connect(oscGain);
    oscGain.connect(engineFilter);

    engineOsc2 = ctx.createOscillator();
    engineOsc2.type = 'square';
    engineOsc2.frequency.value = 80;
    const osc2Gain = ctx.createGain();
    osc2Gain.gain.value = 0.08;
    engineOsc2.connect(osc2Gain);
    osc2Gain.connect(engineFilter);

    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(1.5);
    src.loop = true;
    const nFilter = ctx.createBiquadFilter();
    nFilter.type = 'bandpass';
    nFilter.frequency.value = 600;
    nFilter.Q.value = 0.6;
    const nGain = ctx.createGain();
    nGain.gain.value = 0.12;
    src.connect(nFilter);
    nFilter.connect(nGain);
    nGain.connect(engineFilter);
    engineNoise = { src, nFilter, nGain };

    engineLfo = { oscGain, osc2Gain };

    engineOsc.start();
    engineOsc2.start();
    src.start();
  }

  function startCrowd() {
    if (crowdNodes || !ctx) return;
    const sources = [];
    for (let i = 0; i < 3; i++) {
      const src = ctx.createBufferSource();
      src.buffer = noiseBuffer(2 + i * 0.4);
      src.loop = true;
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 280 + i * 60;
      const g = ctx.createGain();
      g.gain.value = 0.35 - i * 0.08;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.07 + i * 0.04;
      const lfoG = ctx.createGain();
      lfoG.gain.value = 0.12;
      lfo.connect(lfoG);
      lfoG.connect(g.gain);
      src.connect(f);
      f.connect(g);
      g.connect(crowdGain);
      src.start();
      lfo.start();
      sources.push({ src, lfo });
    }
    crowdNodes = sources;
  }

  /**
   * @param {{rpm:number, redline:number, load:number, nitro:boolean, idle?:boolean}} p
   */
  function updateEngine(p) {
    if (!started || !ctx || !engineOsc) return;
    if (p.engineId && p.engineId !== voice.id) setVoice(p.engineId);
    ensureScLayer();
    const rpm = Math.max(700, p.rpm || 900);
    const rl = Math.max(4000, p.redline || 7000);
    const n = Math.max(0, Math.min(1.15, rpm / rl));
    const baseHz = (rpm / 60) * voice.cylMul;
    const t = ctx.currentTime;
    engineOsc.frequency.setTargetAtTime(baseHz, t, 0.035);
    engineOsc2.frequency.setTargetAtTime(baseHz * voice.harm2, t, 0.035);
    if (engineFilter) {
      engineFilter.frequency.setTargetAtTime(
        voice.filterBase + n * voice.filterSpan + (p.nitro ? 700 : 0), t, 0.05
      );
    }
    if (engineNoise && engineNoise.nFilter) {
      engineNoise.nFilter.frequency.setTargetAtTime(400 + n * 1800, t, 0.05);
      engineNoise.nGain.gain.setTargetAtTime(
        (0.07 + n * 0.12 + (p.load || 0) * 0.06) * voice.noiseAmt, t, 0.05
      );
    }
    const load = Math.max(0, Math.min(1, p.load == null ? 0.6 : p.load));
    const engVol = (settingsRef.muted ? 0 : 1) * (settingsRef.engineVol || 0) *
      (p.idle ? 0.18 : (0.22 + load * 0.55 + n * 0.25)) *
      (p.nitro ? 1.18 : 1);
    engineGain.gain.setTargetAtTime(engVol, t, 0.04);
    if (engineLfo) {
      engineLfo.oscGain.gain.setTargetAtTime(0.16 + load * 0.12, t, 0.05);
      engineLfo.osc2Gain.gain.setTargetAtTime(voice.harmGain + n * 0.1, t, 0.05);
    }

    // Supercharger / turbo whine (Hellcat, ZL1, EcoBoost, RB)
    if (scOsc && scGain) {
      const wh = voice.whine * (p.idle ? 0.15 : (0.25 + n * 0.9 + (p.nitro ? 0.35 : 0)));
      scOsc.frequency.setTargetAtTime(900 + n * 4200 + (p.nitro ? 500 : 0), t, 0.05);
      scGain.gain.setTargetAtTime(settingsRef.muted ? 0 : wh * 0.09 * (settingsRef.engineVol || 0), t, 0.05);
    }
    // High-rev scream (Skyline)
    if (screamOsc && screamGain) {
      const hr = voice.highRev * Math.max(0, (n - 0.55) / 0.45);
      screamOsc.frequency.setTargetAtTime(baseHz * 4.2, t, 0.04);
      if (screamOsc._f) screamOsc._f.frequency.setTargetAtTime(1800 + n * 2200, t, 0.05);
      screamGain.gain.setTargetAtTime(
        settingsRef.muted ? 0 : hr * 0.07 * (settingsRef.engineVol || 0) * (p.idle ? 0 : 1), t, 0.05
      );
    }
  }

  function beep(freq, dur, type, vol, dest) {
    if (!ensure() || settingsRef.muted) return;
    resume();
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = type || 'triangle';
    o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol || 0.3, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(dest || sfxGain);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  function noiseBurst(dur, freq, q, vol) {
    if (!ensure() || settingsRef.muted) return;
    resume();
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(Math.max(0.05, dur + 0.05));
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq;
    f.Q.value = q || 1;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol || 0.4, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(sfxGain);
    src.start(t);
    src.stop(t + dur + 0.05);
    return { f, g, t };
  }

  function playShift(up) {
    if (!ensure() || settingsRef.muted) return;
    resume();
    // mechanical thunk
    beep(up ? 180 : 140, 0.06, 'square', 0.22);
    beep(up ? 90 : 70, 0.09, 'triangle', 0.28);
    noiseBurst(0.05, 220, 2, 0.18);
    // throttle blip / overrun bark (stronger on muscle / Hellcat)
    const bark = 0.12 + voice.bark * 0.2;
    if (up) {
      beep(220 + voice.bark * 80, 0.05, 'sawtooth', bark * 0.6);
      beep(140, 0.08, 'triangle', bark);
    } else {
      beep(160, 0.07, 'sawtooth', bark * 0.5);
    }
    setTimeout(() => {
      if (!ctx || settingsRef.muted) return;
      beep(up ? 120 : 100, 0.04, 'sine', 0.12);
    }, 40);
  }

  function playNitro(on) {
    if (!ensure() || settingsRef.muted) return;
    resume();
    if (on) {
      const nb = noiseBurst(0.55, 900, 0.7, 0.45);
      if (nb) {
        nb.f.frequency.setValueAtTime(1200, nb.t);
        nb.f.frequency.exponentialRampToValueAtTime(400, nb.t + 0.5);
      }
      beep(220, 0.2, 'sawtooth', 0.08);
      nitroWhoosh = true;
    } else {
      nitroWhoosh = false;
      noiseBurst(0.15, 500, 1, 0.15);
    }
  }

  function playTireChirp(intense) {
    if (!ensure() || settingsRef.muted) return;
    resume();
    const nb = noiseBurst(intense ? 0.35 : 0.18, intense ? 1400 : 1100, 3.5, intense ? 0.5 : 0.32);
    if (nb) {
      nb.f.frequency.linearRampToValueAtTime(700, nb.t + (intense ? 0.3 : 0.15));
    }
    beep(160, 0.08, 'square', 0.1);
  }

  function playLaunchFeedback(kind) {
    if (kind === 'perfect' || kind === 'good') {
      beep(660, 0.08, 'sine', 0.2);
      beep(990, 0.12, 'sine', 0.15);
    } else if (kind === 'ok') {
      beep(440, 0.1, 'triangle', 0.15);
    } else if (kind === 'slow' || kind === 'jump') {
      beep(180, 0.15, 'sawtooth', 0.2);
    }
  }

  function playTree(phase) {
    if (phase < 4) beep(420, 0.07, 'square', 0.12);
    else {
      beep(880, 0.12, 'sine', 0.22);
      beep(1320, 0.18, 'sine', 0.12);
    }
  }

  function stopAll() {
    if (!ctx) return;
    if (engineGain) engineGain.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
  }

  global.SSRAudio = {
    resume,
    setSettings,
    setVoice,
    updateEngine,
    playShift,
    playNitro,
    playTireChirp,
    playLaunchFeedback,
    playTree,
    stopAll,
    ensure,
  };
})(window);
