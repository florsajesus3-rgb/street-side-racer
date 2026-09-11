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

  /** Per-engine voice (deepened — obvious differences between mills). */
  let voice = null;
  let scOsc = null;
  let scGain = null;
  let screamOsc = null;
  let screamGain = null;
  let subOsc = null;
  let subGain = null;
  let lopeLfo = null;
  let lopeGain = null;

  /**
   * cylMul: pitch vs RPM
   * osc1/osc2: waveform character
   * subAmt: low thump (big V8)
   * lope: cam idle unevenness
   * whine/whineBase/whineSpan: SC or turbo whistle
   * highRev: I6 scream at redline
   * rough: exhaust rasp / noise
   * bright: open filter more
   * bark: shift overrun
   */
  const VOICES = {
    // —— Charger / Challenger HEMIs (must be obviously different) ——
    hemi57: {
      id: 'hemi57', label: '5.7 HEMI',
      cylMul: 1.72, harm2: 2.0, harmGain: 0.12,
      osc1: 'sawtooth', osc2: 'triangle',
      noiseAmt: 1.15, rough: 0.55,
      filterBase: 320, filterSpan: 2100, bright: 0.35,
      subAmt: 0.22, lope: 0.35,
      whine: 0, whineBase: 0, whineSpan: 0,
      highRev: 0, bark: 0.65,
    },
    '392': {
      id: '392', label: '6.4 392',
      cylMul: 1.82, harm2: 2.03, harmGain: 0.14,
      osc1: 'sawtooth', osc2: 'square',
      noiseAmt: 1.25, rough: 0.7,
      filterBase: 380, filterSpan: 2500, bright: 0.5,
      subAmt: 0.28, lope: 0.45,
      whine: 0, whineBase: 0, whineSpan: 0,
      highRev: 0.05, bark: 0.8,
    },
    hellcat: {
      id: 'hellcat', label: '6.2 Hellcat SC',
      cylMul: 1.55, harm2: 2.08, harmGain: 0.1,
      osc1: 'sawtooth', osc2: 'sawtooth',
      noiseAmt: 1.45, rough: 0.85,
      filterBase: 420, filterSpan: 3400, bright: 0.75,
      subAmt: 0.32, lope: 0.55,
      whine: 1.0, whineBase: 1400, whineSpan: 5200,
      highRev: 0.2, bark: 0.95,
    },
    // —— Mustang ——
    eco23: {
      id: 'eco23', label: '2.3 EcoBoost',
      cylMul: 2.55, harm2: 3.05, harmGain: 0.05,
      osc1: 'triangle', osc2: 'sine',
      noiseAmt: 0.7, rough: 0.25,
      filterBase: 650, filterSpan: 3000, bright: 0.7,
      subAmt: 0.06, lope: 0.05,
      whine: 0.55, whineBase: 1800, whineSpan: 4500,
      highRev: 0.15, bark: 0.3,
    },
    coyote50: {
      id: 'coyote50', label: '5.0 Coyote',
      cylMul: 2.15, harm2: 2.01, harmGain: 0.11,
      osc1: 'sawtooth', osc2: 'triangle',
      noiseAmt: 0.95, rough: 0.4,
      filterBase: 480, filterSpan: 2900, bright: 0.65,
      subAmt: 0.14, lope: 0.15,
      whine: 0, whineBase: 0, whineSpan: 0,
      highRev: 0.25, bark: 0.55,
    },
    darkhorse: {
      id: 'darkhorse', label: 'Dark Horse',
      cylMul: 2.25, harm2: 2.04, harmGain: 0.12,
      osc1: 'sawtooth', osc2: 'square',
      noiseAmt: 1.05, rough: 0.5,
      filterBase: 520, filterSpan: 3200, bright: 0.8,
      subAmt: 0.16, lope: 0.2,
      whine: 0, whineBase: 0, whineSpan: 0,
      highRev: 0.4, bark: 0.6,
    },
    // —— Supra ——
    b48: {
      id: 'b48', label: '2.0 B48',
      cylMul: 2.7, harm2: 3.0, harmGain: 0.06,
      osc1: 'triangle', osc2: 'sine',
      noiseAmt: 0.65, rough: 0.2,
      filterBase: 700, filterSpan: 3200, bright: 0.75,
      subAmt: 0.05, lope: 0.05,
      whine: 0.65, whineBase: 2000, whineSpan: 4800,
      highRev: 0.3, bark: 0.25,
    },
    b58: {
      id: 'b58', label: '3.0 B58',
      cylMul: 2.45, harm2: 3.02, harmGain: 0.09,
      osc1: 'sawtooth', osc2: 'triangle',
      noiseAmt: 0.8, rough: 0.3,
      filterBase: 600, filterSpan: 3800, bright: 0.85,
      subAmt: 0.1, lope: 0.08,
      whine: 0.5, whineBase: 1600, whineSpan: 4200,
      highRev: 0.45, bark: 0.35,
    },
    // —— Camaro ——
    lTG: {
      id: 'lTG', label: '2.0T',
      cylMul: 2.5, harm2: 3.0, harmGain: 0.05,
      osc1: 'triangle', osc2: 'sine',
      noiseAmt: 0.7, rough: 0.22,
      filterBase: 620, filterSpan: 3000, bright: 0.7,
      subAmt: 0.05, lope: 0.05,
      whine: 0.6, whineBase: 1900, whineSpan: 4600,
      highRev: 0.2, bark: 0.28,
    },
    lgx: {
      id: 'lgx', label: '3.6 V6',
      cylMul: 2.3, harm2: 2.55, harmGain: 0.08,
      osc1: 'sawtooth', osc2: 'triangle',
      noiseAmt: 0.85, rough: 0.35,
      filterBase: 540, filterSpan: 2700, bright: 0.55,
      subAmt: 0.08, lope: 0.1,
      whine: 0, whineBase: 0, whineSpan: 0,
      highRev: 0.2, bark: 0.4,
    },
    lt1: {
      id: 'lt1', label: '6.2 LT1',
      cylMul: 1.9, harm2: 2.02, harmGain: 0.12,
      osc1: 'sawtooth', osc2: 'square',
      noiseAmt: 1.1, rough: 0.55,
      filterBase: 400, filterSpan: 2600, bright: 0.55,
      subAmt: 0.2, lope: 0.25,
      whine: 0, whineBase: 0, whineSpan: 0,
      highRev: 0.15, bark: 0.7,
    },
    lt4: {
      id: 'lt4', label: 'LT4 ZL1',
      cylMul: 1.65, harm2: 2.06, harmGain: 0.1,
      osc1: 'sawtooth', osc2: 'sawtooth',
      noiseAmt: 1.35, rough: 0.8,
      filterBase: 450, filterSpan: 3300, bright: 0.7,
      subAmt: 0.26, lope: 0.4,
      whine: 0.9, whineBase: 1500, whineSpan: 5000,
      highRev: 0.25, bark: 0.9,
    },
    pentastar: {
      id: 'pentastar', label: '3.6 Pentastar',
      cylMul: 2.2, harm2: 2.45, harmGain: 0.07,
      osc1: 'triangle', osc2: 'sine',
      noiseAmt: 0.8, rough: 0.3,
      filterBase: 500, filterSpan: 2400, bright: 0.45,
      subAmt: 0.07, lope: 0.08,
      whine: 0, whineBase: 0, whineSpan: 0,
      highRev: 0.12, bark: 0.35,
    },
    // —— Skyline ——
    rb20: {
      id: 'rb20', label: 'RB20DET',
      cylMul: 2.85, harm2: 3.1, harmGain: 0.07,
      osc1: 'triangle', osc2: 'sawtooth',
      noiseAmt: 0.7, rough: 0.28,
      filterBase: 750, filterSpan: 4000, bright: 0.9,
      subAmt: 0.05, lope: 0.05,
      whine: 0.5, whineBase: 2100, whineSpan: 5000,
      highRev: 0.7, bark: 0.25,
    },
    rb26: {
      id: 'rb26', label: 'RB26DETT',
      cylMul: 2.75, harm2: 3.15, harmGain: 0.09,
      osc1: 'sawtooth', osc2: 'triangle',
      noiseAmt: 0.85, rough: 0.35,
      filterBase: 780, filterSpan: 4600, bright: 1.0,
      subAmt: 0.08, lope: 0.06,
      whine: 0.7, whineBase: 2200, whineSpan: 5600,
      highRev: 1.0, bark: 0.3,
    },
    rb26n1: {
      id: 'rb26n1', label: 'RB26 N1',
      cylMul: 2.9, harm2: 3.2, harmGain: 0.1,
      osc1: 'sawtooth', osc2: 'sawtooth',
      noiseAmt: 0.95, rough: 0.4,
      filterBase: 820, filterSpan: 5000, bright: 1.1,
      subAmt: 0.09, lope: 0.08,
      whine: 0.8, whineBase: 2400, whineSpan: 6000,
      highRev: 1.15, bark: 0.35,
    },
  };

  voice = Object.assign({}, VOICES.hemi57);

  function setVoice(engineId) {
    const base = VOICES[engineId] || VOICES.hemi57;
    voice = Object.assign({}, base, { id: engineId || base.id });
    ensureExtraLayers();
    applyVoiceWaveforms();
  }

  function applyVoiceWaveforms() {
    if (!engineOsc) return;
    try {
      engineOsc.type = voice.osc1 || 'sawtooth';
      engineOsc2.type = voice.osc2 || 'square';
    } catch (_) {}
  }

  function ensureExtraLayers() {
    if (!ctx || !started || !engineGain) return;
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
      f.frequency.value = 2400;
      f.Q.value = 5;
      screamOsc.connect(f);
      f.connect(screamGain);
      screamGain.connect(engineGain);
      screamOsc.start();
      screamOsc._f = f;
    }
    if (!subOsc) {
      subOsc = ctx.createOscillator();
      subOsc.type = 'sine';
      subGain = ctx.createGain();
      subGain.gain.value = 0;
      subOsc.connect(subGain);
      subGain.connect(engineGain);
      subOsc.start();
    }
    if (!lopeLfo) {
      lopeLfo = ctx.createOscillator();
      lopeLfo.type = 'sine';
      lopeLfo.frequency.value = 6;
      lopeGain = ctx.createGain();
      lopeGain.gain.value = 0;
      lopeLfo.connect(lopeGain);
      // modulate master engine gain slightly via engineLfo path when available
      lopeLfo.start();
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
    ensureExtraLayers();
    applyVoiceWaveforms();
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
    ensureExtraLayers();
    applyVoiceWaveforms();

    const rpm = Math.max(700, p.rpm || 900);
    const rl = Math.max(4000, p.redline || 7000);
    const n = Math.max(0, Math.min(1.2, rpm / rl));
    const load = Math.max(0, Math.min(1, p.load == null ? 0.6 : p.load));
    const nitro = !!p.nitro;
    const idle = !!p.idle;
    const baseHz = (rpm / 60) * (voice.cylMul || 2);
    const t = ctx.currentTime;

    engineOsc.frequency.setTargetAtTime(baseHz, t, 0.03);
    engineOsc2.frequency.setTargetAtTime(baseHz * (voice.harm2 || 2), t, 0.03);

    if (engineFilter) {
      const bright = voice.bright || 0.5;
      engineFilter.frequency.setTargetAtTime(
        (voice.filterBase || 500) + n * (voice.filterSpan || 2800) * (0.7 + bright * 0.5) + (nitro ? 800 : 0),
        t, 0.05
      );
      engineFilter.Q.setTargetAtTime(0.6 + (voice.rough || 0) * 0.5, t, 0.08);
    }

    if (engineNoise && engineNoise.nFilter) {
      engineNoise.nFilter.frequency.setTargetAtTime(350 + n * 2000 + (voice.rough || 0) * 400, t, 0.05);
      engineNoise.nFilter.Q.setTargetAtTime(0.5 + (voice.rough || 0) * 1.2, t, 0.08);
      const nVol = (0.05 + n * 0.14 + load * 0.07) * (voice.noiseAmt || 1) * (0.5 + (voice.rough || 0));
      engineNoise.nGain.gain.setTargetAtTime(nVol, t, 0.05);
    }

    const engVol = (settingsRef.muted ? 0 : 1) * (settingsRef.engineVol || 0) *
      (idle ? 0.16 + (voice.lope || 0) * 0.04 : (0.2 + load * 0.55 + n * 0.28)) *
      (nitro ? 1.2 : 1);
    engineGain.gain.setTargetAtTime(engVol, t, 0.035);

    if (engineLfo) {
      engineLfo.oscGain.gain.setTargetAtTime(0.14 + load * 0.14 + (voice.subAmt || 0) * 0.05, t, 0.05);
      engineLfo.osc2Gain.gain.setTargetAtTime((voice.harmGain || 0.08) + n * 0.12, t, 0.05);
    }

    // Sub thump — big displacement V8s
    if (subOsc && subGain) {
      subOsc.frequency.setTargetAtTime(Math.max(35, baseHz * 0.5), t, 0.04);
      const sub = (settingsRef.muted ? 0 : 1) * (settingsRef.engineVol || 0) *
        (voice.subAmt || 0) * (idle ? 0.35 : (0.45 + load * 0.4));
      subGain.gain.setTargetAtTime(sub * 0.35, t, 0.05);
    }

    // Cam lope (idle unevenness) — speed up LFO a bit with RPM
    if (lopeLfo && lopeGain) {
      lopeLfo.frequency.setTargetAtTime(5 + (voice.lope || 0) * 4 + n * 2, t, 0.1);
      lopeGain.gain.setTargetAtTime(idle ? (voice.lope || 0) * 0.08 : (voice.lope || 0) * 0.03, t, 0.1);
    }

    // Supercharger / turbo whistle
    if (scOsc && scGain) {
      const w = voice.whine || 0;
      const wb = voice.whineBase || 1200;
      const ws = voice.whineSpan || 4000;
      scOsc.frequency.setTargetAtTime(wb + n * ws + (nitro ? 600 : 0), t, 0.045);
      const whAmt = w * (idle ? 0.12 : (0.2 + n * 0.95 + (nitro ? 0.4 : 0) + load * 0.15));
      scGain.gain.setTargetAtTime(
        settingsRef.muted ? 0 : whAmt * 0.11 * (settingsRef.engineVol || 0), t, 0.05
      );
    }

    // High-rev I6 scream
    if (screamOsc && screamGain) {
      const hr = (voice.highRev || 0) * Math.max(0, (n - 0.5) / 0.5);
      screamOsc.frequency.setTargetAtTime(baseHz * (3.8 + (voice.highRev || 0) * 0.6), t, 0.04);
      if (screamOsc._f) {
        screamOsc._f.frequency.setTargetAtTime(1600 + n * 2800, t, 0.05);
        screamOsc._f.Q.setTargetAtTime(3 + hr * 4, t, 0.08);
      }
      screamGain.gain.setTargetAtTime(
        settingsRef.muted ? 0 : hr * 0.085 * (settingsRef.engineVol || 0) * (idle ? 0 : 1), t, 0.05
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
