/** Street Side Racer — original canvas side-view car art (no ripped sprites). */
(function (global) {
  'use strict';


  const RIM_STYLES = ['spoke5', 'mesh', 'star', 'deepdish', 'turbine'];

  /** Real-world side-view (inches). Single scale for all cars. */
  const PX_PER_IN = 2.2;
  const DIMENSIONS = {
    charger:    { len: 198.4, wb: 120.2, h: 58.2, doors: 4 },
    challenger: { len: 198.0, wb: 116.0, h: 57.0, doors: 2 },
    mustang:    { len: 189.4, wb: 107.0, h: 55.0, doors: 2 },
    camaro:     { len: 188.3, wb: 110.7, h: 53.1, doors: 2 },
    skyline:    { len: 181.1, wb: 104.9, h: 53.5, doors: 2 },
    supra:      { len: 172.5, wb:  97.2, h: 50.9, doors: 2 },
  };

  function carDims(id) {
    return DIMENSIONS[id] || DIMENSIONS.charger;
  }

  /** Local units: nose +X, ground y≈0. Scale locked to PX_PER_IN. */
  function layoutOf(id) {
    const d = carDims(id);
    const half = d.len * PX_PER_IN * 0.5;
    const H = d.h * PX_PER_IN * 0.42;
    const wb = d.wb * PX_PER_IN;
    const front = wb * 0.48;
    const rear = -wb * 0.52;
    return {
      half: half, H: H, wb: wb,
      nose: half, tail: -half,
      frontAxle: front, rearAxle: rear,
      roofY: -H, beltY: -H * 0.55,
      doors: d.doors,
      lenIn: d.len, wbIn: d.wb, hIn: d.h,
    };
  }


  function shadeColor(hex, amt) {
    try {
      let h = String(hex || '#888').replace('#', '');
      if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
      const n = parseInt(h, 16);
      if (Number.isNaN(n)) return hex;
      let r = Math.max(0, Math.min(255, (n >> 16) + amt));
      let g = Math.max(0, Math.min(255, ((n >> 8) & 0xff) + amt));
      let b = Math.max(0, Math.min(255, (n & 0xff) + amt));
      return 'rgb(' + r + ',' + g + ',' + b + ')';
    } catch (e) {
      return hex;
    }
  }

  function paintGradient(ctx, y0, y1, color, q) {
    const g = ctx.createLinearGradient(0, y0, 0, y1);
    g.addColorStop(0, shadeColor(color, q === 'Low' ? 12 : 22));
    g.addColorStop(0.35, color);
    g.addColorStop(0.72, shadeColor(color, q === 'Low' ? -18 : -32));
    g.addColorStop(1, shadeColor(color, -42));
    return g;
  }

  function qualityOf(opts) {
    return (opts && opts.quality) || 'High';
  }

  function detail(opts) {
    const q = qualityOf(opts);
    return { low: q === 'Low', med: q !== 'Low', high: q === 'High' || q === 'Ultra', ultra: q === 'Ultra', q: q };
  }

  function roundRectPath(ctx, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  function pathPoly(ctx, pts) {
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    ctx.closePath();
  }

  function specularStripe(ctx, pathFn, q) {
    if (q === 'Low') return;
    ctx.save();
    pathFn();
    ctx.clip();
    const g = ctx.createLinearGradient(-40, -70, 90, 10);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.45, 'rgba(255,255,255,0)');
    g.addColorStop(0.52, (q === 'High' || q === 'Ultra') ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.16)');
    g.addColorStop(0.6, 'rgba(255,255,255,0)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(-120, -80, 240, 120);
    if (q !== 'Medium') {
      const g2 = ctx.createLinearGradient(0, -62, 0, -20);
      g2.addColorStop(0, 'rgba(255,255,255,0.14)');
      g2.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g2;
      ctx.fillRect(-100, -70, 200, 50);
    }
    ctx.restore();
  }

  function drawShadow(ctx, opts) {
    if (opts.reflectionPass) return;
    const d = detail(opts);
    ctx.fillStyle = d.low ? 'rgba(0,0,0,0.35)' : 'rgba(0,0,0,0.48)';
    ctx.beginPath();
    ctx.ellipse(2, 10, d.low ? 86 : 96, d.low ? 9 : 13, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawUnderglow(ctx, opts, glow) {
    if (opts.reflectionPass || !glow || glow === 'off' || glow === 'none') return;
    if (detail(opts).low) return;
    const colors = { blue: '80,160,255', purple: '180,80,255', red: '255,60,80', green: '60,255,140', cyan: '40,230,255', white: '220,230,255' };
    const rgb = colors[glow] || colors.blue;
    const pulse = 0.55 + Math.sin((opts.time || 0) * 0.004) * 0.15;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(0, 6, 10, 0, 8, 110);
    g.addColorStop(0, 'rgba(' + rgb + ',' + (0.45 * pulse) + ')');
    g.addColorStop(0.45, 'rgba(' + rgb + ',' + (0.18 * pulse) + ')');
    g.addColorStop(1, 'rgba(' + rgb + ',0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(0, 12, 108, 18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(' + rgb + ',' + (0.35 * pulse) + ')';
    ctx.fillRect(-78, 0, 156, 3);
    ctx.restore();
  }

  function drawNitroFlame(ctx, car, opts) {
    if (!(car.nitroActive && car.nitro > 0) || opts.reflectionPass) return;
    const flick = 0.7 + Math.random() * 0.3;
    ctx.fillStyle = 'rgba(80,180,255,' + (0.55 * flick) + ')';
    ctx.beginPath();
    ctx.moveTo(-92, -16);
    ctx.lineTo(-92 - 42 * flick, -6);
    ctx.lineTo(-92, 4);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(200,240,255,' + (0.75 * flick) + ')';
    ctx.beginPath();
    ctx.moveTo(-92, -12);
    ctx.lineTo(-92 - 24 * flick, -6);
    ctx.lineTo(-92, 0);
    ctx.closePath();
    ctx.fill();
  }

  function drawGlass(ctx, pts, opts, tint) {
    const d = detail(opts);
    if (d.low) {
      ctx.fillStyle = tint || 'rgba(40,60,90,0.72)';
      pathPoly(ctx, pts);
      ctx.fill();
      return;
    }
    const g = ctx.createLinearGradient(pts[0], pts[1], pts[pts.length - 2], pts[pts.length - 1]);
    g.addColorStop(0, 'rgba(30,45,70,0.82)');
    g.addColorStop(0.35, tint || 'rgba(55,85,120,0.55)');
    g.addColorStop(0.7, 'rgba(160,195,230,0.35)');
    g.addColorStop(1, 'rgba(220,240,255,0.55)');
    ctx.fillStyle = g;
    pathPoly(ctx, pts);
    ctx.fill();
    ctx.strokeStyle = 'rgba(10,20,35,0.55)';
    ctx.lineWidth = 1;
    ctx.stroke();
    if (d.high) {
      ctx.strokeStyle = 'rgba(255,255,255,0.22)';
      ctx.beginPath();
      ctx.moveTo(pts[0] + 4, pts[1] + 3);
      ctx.lineTo(pts[2] + 2, pts[3] + 2);
      ctx.stroke();
    }
  }

  function strokeBodyEdge(ctx, pathFn, opts) {
    ctx.save();
    pathFn();
    ctx.strokeStyle = detail(opts).low ? 'rgba(0,0,0,0.45)' : 'rgba(0,0,0,0.65)';
    ctx.lineWidth = detail(opts).low ? 1.2 : 1.6;
    ctx.stroke();
    ctx.restore();
  }

  function panelLine(ctx, x0, y0, x1, y1, opts) {
    if (detail(opts).low) return;
    ctx.strokeStyle = 'rgba(0,0,0,0.28)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.beginPath();
    ctx.moveTo(x0 + 0.6, y0);
    ctx.lineTo(x1 + 0.6, y1);
    ctx.stroke();
  }

  function doorHandle(ctx, x, y, opts) {
    if (detail(opts).low) return;
    ctx.fillStyle = 'rgba(20,20,24,0.85)';
    roundRectPath(ctx, x, y, 9, 3.2, 1);
    ctx.fill();
    ctx.fillStyle = 'rgba(220,220,230,0.35)';
    ctx.fillRect(x + 1, y + 0.4, 6, 1);
  }

  function sideMirror(ctx, x, y, opts, color) {
    if (detail(opts).low) return;
    ctx.fillStyle = shadeColor(color, -10);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 11, y - 2);
    ctx.lineTo(x + 12, y + 5);
    ctx.lineTo(x + 1, y + 6);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(180,210,240,0.55)';
    ctx.fillRect(x + 3, y, 7, 3.5);
  }

  function exhaustTips(ctx, xs, y, opts) {
    if (detail(opts).low) return;
    for (let i = 0; i < xs.length; i++) {
      const x = xs[i];
      ctx.fillStyle = '#1a1a1c';
      roundRectPath(ctx, x, y, 8, 5, 1.5);
      ctx.fill();
      ctx.fillStyle = '#3a3a40';
      ctx.beginPath();
      ctx.ellipse(x + 4, y + 2.5, 2.2, 1.6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0a0a0a';
      ctx.beginPath();
      ctx.ellipse(x + 4, y + 2.5, 1.3, 0.9, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawRimFace(ctx, style, lit, dark, d) {
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.arc(0, 0, 12.2, 0, Math.PI * 2);
    ctx.fill();
    if (style === 'mesh') {
      ctx.strokeStyle = lit;
      ctx.lineWidth = 1.1;
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * 3, Math.sin(a) * 3);
        ctx.lineTo(Math.cos(a) * 11.5, Math.sin(a) * 11.5);
        ctx.stroke();
      }
      for (let r = 5; r <= 10; r += 2.5) {
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else if (style === 'star') {
      ctx.fillStyle = lit;
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(a - 0.18) * 4, Math.sin(a - 0.18) * 4);
        ctx.lineTo(Math.cos(a) * 11.5, Math.sin(a) * 11.5);
        ctx.lineTo(Math.cos(a + 0.18) * 4, Math.sin(a + 0.18) * 4);
        ctx.closePath();
        ctx.fill();
      }
    } else if (style === 'deepdish') {
      ctx.strokeStyle = lit;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 10, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#3a4048';
      ctx.beginPath();
      ctx.arc(0, 0, 7.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = lit;
      ctx.lineWidth = 1.4;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * 3, Math.sin(a) * 3);
        ctx.lineTo(Math.cos(a) * 7, Math.sin(a) * 7);
        ctx.stroke();
      }
    } else if (style === 'turbine') {
      ctx.fillStyle = lit;
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * 2.5, Math.sin(a) * 2.5);
        ctx.quadraticCurveTo(Math.cos(a + 0.35) * 7, Math.sin(a + 0.35) * 7, Math.cos(a + 0.15) * 11.5, Math.sin(a + 0.15) * 11.5);
        ctx.quadraticCurveTo(Math.cos(a + 0.55) * 6, Math.sin(a + 0.55) * 6, Math.cos(a + 0.45) * 2.5, Math.sin(a + 0.45) * 2.5);
        ctx.closePath();
        ctx.fill();
      }
    } else {
      ctx.fillStyle = lit;
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
        ctx.save();
        ctx.rotate(a);
        ctx.beginPath();
        ctx.moveTo(-2.2, 2);
        ctx.lineTo(2.2, 2);
        ctx.lineTo(1.4, 11.5);
        ctx.lineTo(-1.4, 11.5);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }
    const hub = ctx.createRadialGradient(-1, -1, 0.5, 0, 0, 4.5);
    hub.addColorStop(0, '#f0f2f5');
    hub.addColorStop(1, '#7a8088');
    ctx.fillStyle = hub;
    ctx.beginPath();
    ctx.arc(0, 0, 4.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.arc(0, 0, 1.4, 0, Math.PI * 2);
    ctx.fill();
    if (d.high) {
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(-1, -2, 10, -1, 0.2);
      ctx.stroke();
    }
  }

  function drawWheel(ctx, x, y, rot, opts) {
    const d = detail(opts);
    const rim = opts.rimStyle || 'spoke5';
    const R = 18;
    ctx.save();
    ctx.translate(x, y);
    if (!opts.reflectionPass && d.med) {
      ctx.fillStyle = '#6a6e74';
      ctx.beginPath();
      ctx.arc(0, 0, 11.5, 0, Math.PI * 2);
      ctx.fill();
      if (d.high) {
        ctx.strokeStyle = '#8a9098';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(0, 0, 9.5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = opts.caliperColor || '#c41230';
        ctx.beginPath();
        ctx.ellipse(-8, 0, 4.5, 3.2, 0.3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    const tireG = ctx.createRadialGradient(-3, -3, 4, 0, 0, R);
    tireG.addColorStop(0, '#2a2a2e');
    tireG.addColorStop(0.7, '#0c0c0e');
    tireG.addColorStop(1, '#050506');
    ctx.fillStyle = d.low ? '#0a0a0a' : tireG;
    ctx.beginPath();
    ctx.arc(0, 0, R, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = d.low ? '#222' : '#1a1a1c';
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.arc(0, 0, R - 1.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.save();
    ctx.rotate(rot || 0);
    const rimLit = '#d8dce2';
    const rimDark = '#6a7078';
    ctx.strokeStyle = rimLit;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(0, 0, 13.2, 0, Math.PI * 2);
    ctx.stroke();
    if (d.low) {
      ctx.fillStyle = rimDark;
      ctx.beginPath();
      ctx.arc(0, 0, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = rimLit;
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * 2, Math.sin(a) * 2);
        ctx.lineTo(Math.cos(a) * 11, Math.sin(a) * 11);
        ctx.stroke();
      }
    } else {
      drawRimFace(ctx, rim, rimLit, rimDark, d);
    }
    ctx.restore();
    if (d.high) {
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(-2, -4, R - 3, -0.9, 0.4);
      ctx.stroke();
    }
    ctx.restore();
  }

  function fillBody(ctx, pathFn, color, opts) {
    const d = detail(opts);
    ctx.fillStyle = paintGradient(ctx, -64, 4, color, d.q);
    pathFn();
    ctx.fill();
    specularStripe(ctx, pathFn, d.q);
    strokeBodyEdge(ctx, pathFn, opts);
  }

  function rocker(ctx, color, x, w) {
    ctx.fillStyle = shadeColor(color, -38);
    roundRectPath(ctx, x, -4, w, 8, 2);
    ctx.fill();
  }

  /** Dodge Charger 2015–23 — long hood, crosseyed lights, muscular rear. */
  function bodyCharger(ctx, car, opts) {
    const color = car.color;
    const d = detail(opts);
    const bodyPath = function () {
      ctx.beginPath();
      ctx.moveTo(-98, -6);
      ctx.lineTo(-100, -18);
      ctx.lineTo(-96, -28);
      ctx.lineTo(-70, -34);
      ctx.lineTo(-18, -36);
      ctx.lineTo(-8, -58);
      ctx.lineTo(42, -60);
      ctx.lineTo(62, -56);
      ctx.lineTo(78, -38);
      ctx.lineTo(96, -34);
      ctx.lineTo(102, -22);
      ctx.lineTo(100, -6);
      ctx.lineTo(96, 2);
      ctx.lineTo(-94, 2);
      ctx.closePath();
    };
    fillBody(ctx, bodyPath, color, opts);
    if (d.med) {
      ctx.fillStyle = shadeColor(color, -18);
      ctx.globalAlpha = 0.35;
      ctx.beginPath();
      ctx.moveTo(55, -34);
      ctx.quadraticCurveTo(78, -42, 96, -30);
      ctx.lineTo(96, -12);
      ctx.lineTo(55, -14);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    rocker(ctx, color, -92, 188);
    drawGlass(ctx, [-14, -36, -2, -55, 38, -56, 52, -36], opts, 'rgba(25,40,60,0.75)');
    if (d.med) {
      drawGlass(ctx, [54, -36, 60, -52, 74, -38], opts, 'rgba(20,35,55,0.7)');
      ctx.fillStyle = 'rgba(8,8,10,0.75)';
      ctx.beginPath();
      ctx.moveTo(22, -56); ctx.lineTo(26, -56); ctx.lineTo(30, -36); ctx.lineTo(24, -36);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = shadeColor(color, -8);
      ctx.beginPath();
      ctx.moveTo(42, -58); ctx.lineTo(60, -54); ctx.lineTo(74, -38); ctx.lineTo(52, -36);
      ctx.closePath();
      ctx.fill();
    }
    panelLine(ctx, -8, -34, -8, -2, opts);
    panelLine(ctx, 24, -34, 28, -2, opts);
    panelLine(ctx, 54, -34, 56, -2, opts);
    panelLine(ctx, -70, -34, -70, -6, opts);
    doorHandle(ctx, 0, -20, opts);
    doorHandle(ctx, 34, -20, opts);
    sideMirror(ctx, -6, -40, opts, color);
    ctx.fillStyle = '#0a0a0c';
    roundRectPath(ctx, 94, -30, 10, 18, 2);
    ctx.fill();
    ctx.fillStyle = '#fff8e8';
    ctx.beginPath();
    ctx.ellipse(99, -26, 3.2, 2.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffe8c8';
    ctx.beginPath();
    ctx.ellipse(97.5, -18, 3.6, 2.6, 0, 0, Math.PI * 2);
    ctx.fill();
    if (d.high) {
      ctx.fillStyle = 'rgba(255,240,200,0.35)';
      ctx.fillRect(104, -28, 16, 10);
      // crosseyed twin stacks more readable
      ctx.fillStyle = '#fff6d0';
      ctx.beginPath(); ctx.ellipse(99, -26, 2.2, 1.6, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(97.5, -18, 2.4, 1.8, 0, 0, Math.PI * 2); ctx.fill();
    }
    // decklid lip spoiler
    if (d.med) {
      ctx.fillStyle = shadeColor(color, -22);
      roundRectPath(ctx, -102, -34, 18, 4, 1);
      ctx.fill();
      if ((car.bodyLevel || 0) > 0) {
        ctx.fillStyle = shadeColor(color, -30);
        roundRectPath(ctx, -104, -40, 22, 5, 1);
        ctx.fill();
      }
    }
    ctx.fillStyle = '#1a0508';
    roundRectPath(ctx, -102, -28, 10, 16, 2);
    ctx.fill();
    ctx.fillStyle = '#ff1a2a';
    ctx.fillRect(-100, -26, 6, 4);
    ctx.fillStyle = '#ff3344';
    ctx.fillRect(-100, -20, 6, 6);
    if (d.med) {
      ctx.fillStyle = 'rgba(255,40,50,0.45)';
      ctx.fillRect(-98, -24, 3, 10);
    }
    exhaustTips(ctx, car.trickyLaunch ? [-94, -84] : [-90], 0, opts);
    if (car.accent) {
      ctx.fillStyle = car.accent;
      ctx.globalAlpha = 0.85;
      ctx.fillRect(-55, -24, 48, 3);
      ctx.globalAlpha = 1;
    }
    if (d.med) {
      ctx.fillStyle = shadeColor(color, -12);
      ctx.beginPath();
      ctx.moveTo(-68, -34); ctx.lineTo(-40, -37); ctx.lineTo(-20, -36); ctx.lineTo(-20, -34);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.moveTo(88, 0); ctx.lineTo(104, 0); ctx.lineTo(100, 4); ctx.lineTo(86, 4);
    ctx.closePath();
    ctx.fill();
  }

  function bodyMustang(ctx, car, opts) {
    const color = car.color;
    const d = detail(opts);
    const bodyPath = function () {
      ctx.beginPath();
      ctx.moveTo(-96, -4);
      ctx.lineTo(-98, -16);
      ctx.lineTo(-92, -30);
      ctx.lineTo(-55, -36);
      ctx.lineTo(-12, -38);
      ctx.lineTo(2, -62);
      ctx.lineTo(48, -64);
      ctx.lineTo(78, -42);
      ctx.lineTo(98, -34);
      ctx.lineTo(102, -18);
      ctx.lineTo(98, 2);
      ctx.lineTo(-92, 2);
      ctx.closePath();
    };
    fillBody(ctx, bodyPath, color, opts);
    rocker(ctx, color, -90, 184);
    drawGlass(ctx, [-6, -38, 6, -58, 44, -60, 68, -40], opts, 'rgba(30,50,75,0.7)');
    if (d.med) {
      drawGlass(ctx, [48, -58, 70, -42, 54, -40], opts, 'rgba(25,40,65,0.65)');
      ctx.fillStyle = 'rgba(8,8,10,0.7)';
      ctx.fillRect(28, -60, 4, 22);
    }
    panelLine(ctx, 2, -36, 2, -2, opts);
    panelLine(ctx, -55, -36, -55, -6, opts);
    doorHandle(ctx, 10, -22, opts);
    sideMirror(ctx, 4, -42, opts, color);
    ctx.fillStyle = '#120408';
    roundRectPath(ctx, -100, -28, 10, 16, 2);
    ctx.fill();
    ctx.fillStyle = '#ff2030';
    for (let i = 0; i < 3; i++) ctx.fillRect(-98, -26 + i * 5, 6, 3);
    ctx.fillStyle = '#0a0a0c';
    roundRectPath(ctx, 94, -28, 10, 14, 2);
    ctx.fill();
    ctx.fillStyle = '#fff6e0';
    ctx.beginPath();
    ctx.ellipse(99, -22, 3.5, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    if (d.high) {
      ctx.fillStyle = 'rgba(255,240,200,0.3)';
      ctx.fillRect(104, -26, 14, 8);
    }
    if (car.accent && d.med) {
      ctx.fillStyle = car.accent;
      ctx.fillRect(-48, -36, 8, 4);
      ctx.fillRect(-36, -36, 8, 4);
    }
    exhaustTips(ctx, [-92, -82], 0, opts);
    ctx.fillStyle = '#111';
    ctx.fillRect(90, 1, 14, 3);
  }

  function bodySupra(ctx, car, opts) {
    const color = car.color;
    const d = detail(opts);
    const bodyPath = function () {
      ctx.beginPath();
      ctx.moveTo(-90, -2);
      ctx.lineTo(-94, -14);
      ctx.lineTo(-88, -28);
      ctx.lineTo(-50, -34);
      ctx.lineTo(-16, -36);
      ctx.lineTo(-2, -58);
      ctx.lineTo(18, -62);
      ctx.lineTo(38, -60);
      ctx.lineTo(58, -48);
      ctx.lineTo(78, -36);
      ctx.lineTo(92, -30);
      ctx.lineTo(96, -14);
      ctx.lineTo(92, 2);
      ctx.lineTo(-86, 2);
      ctx.closePath();
    };
    fillBody(ctx, bodyPath, color, opts);
    rocker(ctx, color, -86, 176);
    drawGlass(ctx, [-10, -36, 2, -55, 34, -58, 52, -40], opts, 'rgba(20,35,55,0.78)');
    if (d.med) {
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath();
      ctx.moveTo(18, -60);
      ctx.quadraticCurveTo(28, -64, 38, -58);
      ctx.stroke();
      ctx.fillStyle = 'rgba(8,8,10,0.65)';
      ctx.fillRect(20, -56, 3, 18);
      ctx.fillStyle = shadeColor(color, -20);
      ctx.beginPath();
      ctx.moveTo(-92, -28); ctx.lineTo(-100, -34); ctx.lineTo(-88, -34); ctx.lineTo(-84, -28);
      ctx.closePath();
      ctx.fill();
    }
    panelLine(ctx, -2, -34, -2, -2, opts);
    panelLine(ctx, -50, -34, -50, -6, opts);
    doorHandle(ctx, 6, -20, opts);
    sideMirror(ctx, 0, -40, opts, color);
    ctx.fillStyle = '#0a0a0c';
    roundRectPath(ctx, 88, -28, 10, 12, 2);
    ctx.fill();
    ctx.fillStyle = '#e8f4ff';
    ctx.beginPath();
    ctx.ellipse(93, -22, 3.5, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ff1020';
    roundRectPath(ctx, -96, -26, 8, 12, 2);
    ctx.fill();
    if (car.accent) {
      ctx.fillStyle = car.accent;
      ctx.fillRect(-40, -22, 36, 2.5);
    }
    exhaustTips(ctx, [-88], 0, opts);
  }

  function bodyCamaro(ctx, car, opts) {
    const color = car.color;
    const d = detail(opts);
    const bodyPath = function () {
      ctx.beginPath();
      ctx.moveTo(-94, -4);
      ctx.lineTo(-98, -16);
      ctx.lineTo(-94, -28);
      ctx.lineTo(-40, -36);
      ctx.lineTo(0, -38);
      ctx.lineTo(14, -64);
      ctx.lineTo(50, -66);
      ctx.lineTo(72, -48);
      ctx.lineTo(88, -36);
      ctx.lineTo(100, -30);
      ctx.lineTo(104, -16);
      ctx.lineTo(100, 2);
      ctx.lineTo(-90, 2);
      ctx.closePath();
    };
    fillBody(ctx, bodyPath, color, opts);
    rocker(ctx, color, -90, 186);
    drawGlass(ctx, [4, -38, 16, -60, 46, -62, 64, -42], opts, 'rgba(15,25,40,0.82)');
    if (d.med) {
      ctx.fillStyle = shadeColor(color, -5);
      ctx.beginPath();
      ctx.moveTo(50, -64); ctx.lineTo(70, -48); ctx.lineTo(84, -36); ctx.lineTo(64, -36);
      ctx.closePath();
      ctx.fill();
    }
    panelLine(ctx, 14, -36, 14, -2, opts);
    panelLine(ctx, -40, -36, -40, -6, opts);
    doorHandle(ctx, 22, -22, opts);
    sideMirror(ctx, 16, -42, opts, color);
    ctx.fillStyle = '#0a0a0c';
    roundRectPath(ctx, 96, -28, 10, 14, 2);
    ctx.fill();
    ctx.fillStyle = '#fff4d8';
    ctx.fillRect(98, -26, 6, 10);
    ctx.fillStyle = '#ff1a28';
    roundRectPath(ctx, -100, -26, 10, 12, 2);
    ctx.fill();
    if (car.accent && d.med) {
      ctx.fillStyle = car.accent;
      ctx.fillRect(-30, -24, 40, 3);
    }
    exhaustTips(ctx, [-92, -82], 0, opts);
    ctx.fillStyle = '#0d0d0f';
    ctx.beginPath();
    ctx.moveTo(88, -8); ctx.lineTo(104, -8); ctx.lineTo(102, 4); ctx.lineTo(86, 4);
    ctx.closePath();
    ctx.fill();
  }

  function bodyChallenger(ctx, car, opts) {
    const color = car.color;
    const d = detail(opts);
    const bodyPath = function () {
      ctx.beginPath();
      ctx.moveTo(-98, -4);
      ctx.lineTo(-100, -18);
      ctx.lineTo(-96, -30);
      ctx.lineTo(-58, -36);
      ctx.lineTo(-14, -38);
      ctx.lineTo(-2, -58);
      ctx.lineTo(40, -60);
      ctx.lineTo(58, -52);
      ctx.lineTo(78, -38);
      ctx.lineTo(98, -34);
      ctx.lineTo(102, -18);
      ctx.lineTo(98, 2);
      ctx.lineTo(-94, 2);
      ctx.closePath();
    };
    fillBody(ctx, bodyPath, color, opts);
    rocker(ctx, color, -92, 186);
    drawGlass(ctx, [-10, -38, 2, -54, 36, -56, 52, -38], opts, 'rgba(25,40,60,0.72)');
    if (d.med) {
      drawGlass(ctx, [40, -54, 54, -50, 70, -38, 52, -36], opts, 'rgba(20,35,55,0.7)');
      ctx.fillStyle = 'rgba(8,8,10,0.7)';
      ctx.fillRect(24, -54, 4, 18);
    }
    panelLine(ctx, -2, -36, -2, -2, opts);
    panelLine(ctx, -58, -36, -58, -6, opts);
    doorHandle(ctx, 8, -22, opts);
    sideMirror(ctx, 0, -42, opts, color);
    ctx.fillStyle = '#0a0a0c';
    ctx.beginPath();
    ctx.ellipse(98, -22, 6, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff6e8';
    ctx.beginPath();
    ctx.ellipse(98, -22, 3.5, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ff2028';
    ctx.beginPath();
    ctx.ellipse(-96, -22, 5, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    if (car.accent) {
      ctx.fillStyle = car.accent;
      ctx.fillRect(-50, -24, 44, 3);
    }
    exhaustTips(ctx, [-92, -82], 0, opts);
  }

  function bodySkyline(ctx, car, opts) {
    const color = car.color;
    const d = detail(opts);
    const bodyPath = function () {
      ctx.beginPath();
      ctx.moveTo(-92, -4);
      ctx.lineTo(-96, -16);
      ctx.lineTo(-90, -30);
      ctx.lineTo(-52, -36);
      ctx.lineTo(-18, -38);
      ctx.lineTo(-6, -56);
      ctx.lineTo(36, -58);
      ctx.lineTo(52, -52);
      ctx.lineTo(70, -38);
      ctx.lineTo(90, -32);
      ctx.lineTo(94, -16);
      ctx.lineTo(90, 2);
      ctx.lineTo(-88, 2);
      ctx.closePath();
    };
    fillBody(ctx, bodyPath, color, opts);
    rocker(ctx, color, -86, 172);
    drawGlass(ctx, [-12, -38, 0, -52, 32, -54, 48, -38], opts, 'rgba(30,50,80,0.7)');
    if (d.med) {
      drawGlass(ctx, [36, -52, 48, -48, 64, -38, 48, -36], opts, 'rgba(25,45,70,0.68)');
      ctx.fillStyle = 'rgba(8,8,10,0.7)';
      ctx.fillRect(18, -52, 4, 16);
    }
    panelLine(ctx, -6, -36, -6, -2, opts);
    panelLine(ctx, -52, -36, -52, -6, opts);
    doorHandle(ctx, 4, -22, opts);
    sideMirror(ctx, -2, -40, opts, color);
    ctx.fillStyle = shadeColor(color, -25);
    ctx.beginPath();
    ctx.moveTo(-88, -30);
    ctx.lineTo(-108, -48);
    ctx.lineTo(-70, -48);
    ctx.lineTo(-64, -30);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = shadeColor(color, -40);
    ctx.fillRect(-106, -48, 34, 3);
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-100, -45); ctx.lineTo(-92, -30);
    ctx.moveTo(-78, -45); ctx.lineTo(-72, -30);
    ctx.stroke();
    ctx.fillStyle = '#0a0a0c';
    ctx.beginPath();
    ctx.arc(92, -22, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f0f6ff';
    ctx.beginPath();
    ctx.arc(92, -22, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ff2030';
    roundRectPath(ctx, -96, -26, 8, 12, 2);
    ctx.fill();
    if (car.accent) {
      ctx.fillStyle = car.accent;
      ctx.fillRect(-40, -22, 30, 2.5);
    }
    exhaustTips(ctx, [-86, -76], 0, opts);
  }


  function drawWheelWells(ctx, positions, opts) {
    const d = detail(opts);
    if (d.low) return;
    for (const x of positions) {
      ctx.fillStyle = '#0a0a0c';
      ctx.beginPath();
      ctx.ellipse(x, 2, 22, 16, 0, Math.PI, Math.PI * 2);
      ctx.fill();
      if (d.high) {
        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.ellipse(x, 2, 20, 14, 0, Math.PI * 1.05, Math.PI * 1.95);
        ctx.stroke();
      }
    }
  }

  function drawExhaustPop(ctx, car, opts) {
    if (opts.reflectionPass) return;
    const flame = car.exhaustFlame || 0;
    const spin = car.wheelspin || 0;
    if (flame < 0.15 && spin < 0.45 && !(car.nitroActive && car.nitro > 0)) return;
    const d = detail(opts);
    const flick = 0.65 + Math.random() * 0.35;
    const str = Math.max(flame, spin * 0.6, (car.nitroActive ? 0.8 : 0));
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(255,110,30,' + (0.55 * str * flick) + ')';
    ctx.beginPath();
    ctx.moveTo(-92, -2);
    ctx.lineTo(-92 - 28 * str * flick, 2);
    ctx.lineTo(-92, 8);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,230,120,' + (0.7 * str * flick) + ')';
    ctx.beginPath();
    ctx.moveTo(-92, 0);
    ctx.lineTo(-92 - 14 * str * flick, 3);
    ctx.lineTo(-92, 6);
    ctx.closePath();
    ctx.fill();
    if (d.high) {
      ctx.fillStyle = 'rgba(255,255,220,' + (0.5 * str) + ')';
      ctx.fillRect(-96 - 8 * str, 2, 6, 2);
    }
    ctx.restore();
  }

  const BODIES = {
    charger: bodyCharger,
    mustang: bodyMustang,
    supra: bodySupra,
    camaro: bodyCamaro,
    challenger: bodyChallenger,
    skyline: bodySkyline,
  };

  function wheelPositions(carId, bodyLevel) {
    const lay = layoutOf(carId);
    const widen = (bodyLevel || 0) * 2;
    return [lay.rearAxle - widen * 0.15, lay.frontAxle + widen * 0.15];
  }

  function drawCarBody(ctx, car, opts) {
    opts = opts || {};
    const id = car.id || car.carId || 'charger';
    const d = detail(opts);
    const bodyFn = BODIES[id] || bodyCharger;
    drawShadow(ctx, opts);
    drawUnderglow(ctx, opts, car.underglow);
    drawNitroFlame(ctx, car, opts);
    if ((car.bodyLevel || 0) > 0 && !opts.reflectionPass && d.med) {
      const bl = car.bodyLevel;
      ctx.fillStyle = shadeColor(car.color, -25);
      ctx.globalAlpha = 0.55;
      roundRectPath(ctx, -72 - bl * 2, -8, 28 + bl * 2, 14, 4);
      ctx.fill();
      roundRectPath(ctx, 40, -8, 28 + bl * 2, 14, 4);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    bodyFn(ctx, car, opts);
    if (!opts.reflectionPass) {
      const wp = wheelPositions(id, car.bodyLevel);
      drawWheelWells(ctx, wp, opts);
      const rimOpts = {
        quality: opts.quality,
        reflectionPass: false,
        rimStyle: car.rimStyle || RIM_STYLES[(car.rimIndex || 0) % RIM_STYLES.length],
        caliperColor: car.accent || '#c41230',
      };
      const spinBoost = (car.wheelspin || 0) > 0.3 ? (car.wheelRot || 0) * 1.8 : (car.wheelRot || 0);
      drawWheel(ctx, wp[0], 4, spinBoost, rimOpts);
      drawWheel(ctx, wp[1], 4, spinBoost, rimOpts);
      drawExhaustPop(ctx, car, opts);
    }
    if (car.shiftFlash > 0 && !opts.reflectionPass) {
      ctx.strokeStyle = 'rgba(124,255,58,' + car.shiftFlash + ')';
      ctx.lineWidth = 3;
      roundRectPath(ctx, -96, -68, 196, 78, 12);
      ctx.stroke();
    }
    if (!opts.reflectionPass && opts.showLabel !== false && car.name) {
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText(car.name, -20, -72);
    }
  }


  /* —— Pixel silhouettes locked to DIMENSIONS (same px/in; Charger = full width) —— */
  const PIXEL_REF_LEN = DIMENSIONS.charger.len;
  const PIXEL_W = 128;
  const PIXEL_H = 56;
  const pixelCache = {};

  function pxShade(hex, amt) { return shadeColor(hex, amt); }

  function pxLayout(id) {
    const d = carDims(id);
    const scale = PIXEL_W / PIXEL_REF_LEN;
    const lenPx = d.len * scale;
    const hPx = d.h * scale * 0.72;
    const wbPx = d.wb * scale;
    const x0 = (PIXEL_W - lenPx) * 0.5;
    const ground = PIXEL_H - 8;
    const bodyBot = ground - 6;
    const bodyTop = bodyBot - hPx * 0.52;
    const roof = bodyBot - hPx;
    const rearOH = (d.len - d.wb) * 0.42 * scale;
    const rearA = x0 + rearOH;
    const frontA = rearA + wbPx;
    return {
      x0: x0, x1: x0 + lenPx, lenPx: lenPx, hPx: hPx, wbPx: wbPx,
      ground: ground, bodyBot: bodyBot, bodyTop: bodyTop, roof: roof,
      rearA: rearA, frontA: frontA, doors: d.doors, id: id, d: d
    };
  }

  function paintPixelBody(pctx, car, quality) {
    const id = car.id || 'charger';
    const c = car.color || '#888';
    const a = car.accent || '#ccc';
    const dark = pxShade(c, -42);
    const mid = pxShade(c, -18);
    const lit = pxShade(c, 30);
    const glass = 'rgba(35,65,105,0.95)';
    const glassHi = 'rgba(160,200,240,0.5)';
    const q = quality || 'High';
    const hi = q === 'High' || q === 'Ultra';
    const ultra = q === 'Ultra';
    const L = pxLayout(id);
    pctx.clearRect(0, 0, PIXEL_W, PIXEL_H);

    function rect(x, y, w, h, col) {
      pctx.fillStyle = col;
      pctx.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
    }
    function wheel(cx, spinning) {
      const wr = hi ? 7 : 6;
      const x = cx - wr, y = L.ground - wr * 2 + 1;
      rect(x, y, wr * 2, wr * 2, '#050506');
      rect(x + 1, y + 1, wr * 2 - 2, wr * 2 - 2, '#141416');
      rect(x + 2, y + 2, wr * 2 - 4, wr * 2 - 4, '#2a2e34');
      if (hi) {
        rect(x + 3, y + 3, wr * 2 - 6, wr * 2 - 6, '#a8b0b8');
        if (spinning) {
          rect(x + 2, y + wr - 1, wr * 2 - 4, 2, '#9aa0a8');
          rect(cx - 1, y + 3, 2, wr * 2 - 6, '#9aa0a8');
        } else {
          rect(cx - 1, y + 3, 2, wr * 2 - 6, '#d0d4da');
          rect(x + 3, y + wr - 1, wr * 2 - 6, 2, '#d0d4da');
        }
        rect(cx - 1, y + wr - 1, 2, 2, '#eee');
        if (ultra) rect(x, y + wr - 2, 1, 4, '#c41230');
      } else {
        rect(cx - 2, y + wr - 2, 4, 4, '#888');
      }
    }
    function well(cx) {
      const wr = 9;
      rect(cx - wr, L.bodyBot - 4, wr * 2, 10, '#0a0a0c');
      if (hi) rect(cx - wr + 1, L.bodyBot - 3, wr * 2 - 2, 2, '#1a1a20');
    }

    rect(L.x0 + 4, L.ground + 1, L.lenPx - 8, 4, 'rgba(0,0,0,0.5)');

    const glow = car.underglow;
    if (glow && glow !== 'off' && glow !== 'none' && hi) {
      const map = { blue: '#5090ff', purple: '#b450ff', red: '#ff4050', green: '#3cff8c', cyan: '#28e6ff', white: '#dce6ff' };
      pctx.globalAlpha = 0.5;
      rect(L.x0 + 8, L.ground - 2, L.lenPx - 16, 3, map[glow] || map.blue);
      pctx.globalAlpha = 1;
    }

    well(L.rearA);
    well(L.frontA);

    // Cabin: 4-door Charger = long cabin; coupes shorter; Supra/Mustang more fastback
    let cabinStart = 0.40, cabinEnd = 0.76;
    if (L.doors === 4) { cabinStart = 0.34; cabinEnd = 0.86; } // long sedan greenhouse
    else if (id === 'challenger') { cabinStart = 0.40; cabinEnd = 0.74; }
    else if (id === 'mustang') { cabinStart = 0.42; cabinEnd = 0.78; }
    else if (id === 'camaro') { cabinStart = 0.40; cabinEnd = 0.76; }
    else if (id === 'skyline') { cabinStart = 0.38; cabinEnd = 0.78; }
    else if (id === 'supra') { cabinStart = 0.40; cabinEnd = 0.76; }

    const cx0 = L.x0 + L.lenPx * cabinStart;
    const cx1 = L.x0 + L.lenPx * cabinEnd;

    // body
    rect(L.x0 + 2, L.bodyTop, L.lenPx - 4, L.bodyBot - L.bodyTop, c);
    // long hood highlight (nose = right = front)
    rect(cx1 - 2, L.bodyTop - 2, L.x1 - cx1, 5, lit);
    // rear deck / haunch (left)
    rect(L.x0 + 2, L.bodyTop, Math.max(6, cx0 - L.x0), 5, mid);
    // roof / cabin
    rect(cx0, L.roof + 2, cx1 - cx0, L.bodyTop - L.roof, c);
    if (hi) rect(cx0 + 2, L.roof + 2, cx1 - cx0 - 4, 2, mid);

    // glass
    const gw = (cx1 - cx0) * (L.doors === 4 ? 0.28 : 0.40);
    rect(cx0 + 3, L.roof + 4, gw, L.bodyTop - L.roof - 5, glass);
    rect(cx0 + 5 + gw, L.roof + 4, gw * 0.9, L.bodyTop - L.roof - 5, glass);
    if (L.doors === 4) {
      rect(cx0 + 5 + gw * 1.9, L.roof + 5, gw * 0.85, L.bodyTop - L.roof - 7, glass);
    }
    if (hi) {
      rect(cx0 + 4, L.roof + 5, 5, 2, glassHi);
      rect(cx0 + gw + 2, L.roof + 3, 2, L.bodyTop - L.roof - 3, 'rgba(8,8,10,0.85)');
      if (L.doors === 4) {
        rect(cx0 + gw * 1.85, L.roof + 3, 2, L.bodyTop - L.roof - 3, 'rgba(8,8,10,0.75)');
        rect(cx0 + gw * 2.7, L.roof + 3, 2, L.bodyTop - L.roof - 3, 'rgba(8,8,10,0.7)');
      }
      // panel lines
      rect(cx0, L.bodyTop, 1, L.bodyBot - L.bodyTop, 'rgba(0,0,0,0.35)');
      if (L.doors === 4) rect(cx0 + (cx1 - cx0) * 0.55, L.bodyTop, 1, L.bodyBot - L.bodyTop, 'rgba(0,0,0,0.28)');
    }

    // Car-specific nose / tail / wing
    if (id === 'charger') {
      // crosseyed stacked headlights at nose (right)
      rect(L.x1 - 6, L.bodyTop + 2, 4, 4, '#1a1810');
      rect(L.x1 - 5, L.bodyTop + 3, 2, 2, '#fff6c8');
      rect(L.x1 - 6, L.bodyTop + 7, 4, 4, '#1a1810');
      rect(L.x1 - 5, L.bodyTop + 8, 2, 2, '#ffe8a0');
      if (hi) rect(L.x1 - 2, L.bodyTop + 4, 3, 6, 'rgba(255,240,180,0.3)');
      // short deck taillights
      rect(L.x0 + 2, L.bodyTop + 2, 4, 10, '#2a0508');
      rect(L.x0 + 3, L.bodyTop + 3, 2, 3, '#ff1a2a');
      rect(L.x0 + 3, L.bodyTop + 7, 2, 4, '#ff3344');
      // dual exhaust
      rect(L.x0 + 6, L.bodyBot - 1, 5, 3, '#1a1a1c');
      rect(L.x0 + 13, L.bodyBot - 1, 5, 3, '#1a1a1c');
      // short decklid lip
      rect(L.x0 + 2, L.bodyTop - 2, 14, 3, dark);
      if (a) { pctx.globalAlpha = 0.9; rect(cx0 - 10, L.bodyTop + 6, 18, 2, a); pctx.globalAlpha = 1; }
      if (ultra) {
        rect(L.x1 - 8, L.bodyBot - 6, 5, 4, '#111');
        rect(L.x1 - 7, L.bodyBot - 5, 3, 1, '#333');
      }
    } else if (id === 'challenger') {
      rect(L.x1 - 6, L.bodyTop + 3, 5, 6, '#ffe8a0');
      rect(L.x0 + 2, L.bodyTop + 2, 4, 10, '#2a0508');
      rect(L.x0 + 3, L.bodyTop + 3, 2, 8, '#ff2030');
      rect(L.x0 + 4, L.bodyTop - 1, 16, 3, dark);
      if (a) rect(cx0 - 8, L.bodyTop + 6, 24, 2, a);
    } else if (id === 'mustang') {
      // fastback slope cue
      rect(cx1 - 8, L.roof + 2, 12, 6, dark);
      rect(L.x1 - 6, L.bodyTop + 3, 5, 6, '#ffe8a0');
      rect(L.x0 + 2, L.bodyTop + 2, 4, 9, '#2a0508');
      if (hi) {
        rect(L.x0 + 3, L.bodyTop + 3, 2, 2, '#ff2030');
        rect(L.x0 + 3, L.bodyTop + 6, 2, 2, '#ff2030');
        rect(L.x0 + 3, L.bodyTop + 9, 2, 2, '#ff2030');
      }
    } else if (id === 'camaro') {
      rect(L.x1 - 6, L.bodyTop + 3, 5, 5, '#ffe8a0');
      rect(L.x0 + 2, L.bodyTop + 3, 4, 8, '#ff2030');
      rect(cx0 + 8, L.bodyTop + 2, 16, 2, dark); // SS stripe cue
      if ((car.bodyLevel || 0) > 0) rect(L.x0 + 4, L.roof + 4, 14, 3, dark);
    } else if (id === 'skyline') {
      // big wing
      rect(L.x0 + 4, L.roof - 4, 22, 3, dark);
      rect(L.x0 + 6, L.roof - 1, 3, 5, dark);
      rect(L.x0 + 20, L.roof - 1, 3, 5, dark);
      if (hi) rect(L.x0 + 5, L.roof - 3, 20, 1, lit);
      rect(L.x1 - 6, L.bodyTop + 3, 5, 5, '#ffe8a0');
      rect(L.x0 + 2, L.bodyTop + 3, 4, 8, '#ff2030');
      if (a) rect(cx0 + 10, L.bodyTop + 4, 5, 2, a);
    } else if (id === 'supra') {
      rect(L.x0 + 4, L.roof - 2, 20, 3, dark);
      rect(L.x0 + 6, L.roof + 1, 3, 4, dark);
      rect(L.x0 + 18, L.roof + 1, 3, 4, dark);
      rect(L.x1 - 6, L.bodyTop + 3, 5, 5, '#ffe8a0');
      rect(L.x0 + 2, L.bodyTop + 3, 4, 7, a || '#ff3030');
      // wedge nose drop
      if (hi) rect(cx1, L.bodyTop - 1, L.x1 - cx1 - 2, 3, lit);
    }

    // rocker
    rect(L.x0 + 4, L.bodyBot - 2, L.lenPx - 8, 3, dark);

    // body kit flares
    if ((car.bodyLevel || 0) > 0) {
      rect(L.rearA - 10, L.bodyBot - 8, 8, 8, dark);
      rect(L.frontA + 2, L.bodyBot - 8, 8, 8, dark);
    }

    // door handle / mirror
    if (hi) {
      rect(cx0 + 8, L.bodyTop + 5, 4, 2, '#1a1a1c');
      rect(cx1 - 6, L.roof + 6, 5, 3, mid);
      rect(cx1 - 5, L.roof + 7, 3, 1, glassHi);
    }

    const spinning = (car.wheelspin || 0) > 0.35;
    wheel(L.rearA, spinning);
    wheel(L.frontA, spinning);

    // exhaust flame / nitro (tail = left)
    function flame(big) {
      const flick = big ? 1 : 0.7;
      rect(L.x0 - Math.floor(8 * flick), L.bodyBot - 4, Math.floor(10 * flick), 3, '#ff6a18');
      rect(L.x0 - Math.floor(5 * flick), L.bodyBot - 3, Math.floor(6 * flick), 1, '#ffe060');
      if (hi) rect(L.x0 - Math.floor(12 * flick), L.bodyBot - 5, Math.floor(5 * flick), 5, 'rgba(255,100,20,0.4)');
    }
    if ((car.nitroActive && car.nitro > 0) || (car.exhaustFlame && car.exhaustFlame > 0.2)) {
      flame(!!(car.nitroActive && car.nitro > 0));
      if (id === 'charger' || id === 'challenger') flame(false);
    }
    if (car.nitroActive && car.nitro > 0) {
      rect(L.x0 - 6, L.bodyTop + 4, 10, 5, '#5ad0ff');
      rect(L.x0 - 8, L.bodyTop + 5, 6, 3, '#e0f8ff');
    }
  }

  function getPixelSprite(car, quality) {
    const q = quality || 'High';
    const key = [
      car.id, car.color, car.accent, car.bodyLevel || 0,
      car.rimStyle || '', car.underglow || '',
      (car.nitroActive && car.nitro > 0) ? 'n' : '',
      (car.wheelspin || 0) > 0.35 ? 's' : '',
      (car.exhaustFlame || 0) > 0.2 ? 'f' : '',
      q
    ].join('|');
    let entry = pixelCache[key];
    if (entry) return entry;
    const c = document.createElement('canvas');
    c.width = PIXEL_W;
    c.height = PIXEL_H;
    paintPixelBody(c.getContext('2d'), car, q);
    pixelCache[key] = c;
    const keys = Object.keys(pixelCache);
    if (keys.length > 120) delete pixelCache[keys[0]];
    return c;
  }

  function drawPixelAt(ctx, car, screenX, y, scale, opts) {
    opts = opts || {};
    const spr = getPixelSprite(car, opts.quality || qualityOf(opts));
    const sx = scale * (car.scaleX || 1);
    // Scale so Charger ~198.4*2.2 local ≈ matches prior visual size
    const w = PIXEL_W * sx * 1.72;
    const h = PIXEL_H * scale * 1.72;
    ctx.save();
    const pitch = car.bodyPitch || 0;
    const squatY = car.squatY || 0;
    ctx.translate(screenX, y + squatY);
    if (pitch) ctx.rotate(pitch);
    ctx.imageSmoothingEnabled = false;
    if (opts.reflectionPass) {
      ctx.scale(1, -0.55);
      ctx.globalAlpha = 0.25;
    }
    ctx.drawImage(spr, -w / 2, -h + 10, w, h);
    if (!opts.reflectionPass && (car.wheelspin || 0) > 0.25) {
      const spin = car.wheelspin;
      ctx.globalAlpha = 0.25 + spin * 0.4;
      ctx.fillStyle = '#d8d8e0';
      for (let i = 0; i < 3 + Math.floor(spin * 3); i++) {
        ctx.fillRect(-w * 0.32 - i * 6 - spin * 8, 2 + (i % 2) * 3, 10 + spin * 8, 4);
      }
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }


  function drawAt(ctx, car, screenX, y, scale, opts) {
    opts = opts || {};
    const mode = (opts.mode || opts.drawMode || 'pixel');
    if (mode === 'pixel') {
      drawPixelAt(ctx, car, screenX, y, scale, opts);
      return;
    }
    ctx.save();
    const pitch = car.bodyPitch || 0;
    const squatY = car.squatY || 0;
    ctx.translate(screenX, y + squatY);
    if (pitch) ctx.rotate(pitch);
    const lay = layoutOf(car.id || car.carId || 'charger');
    // Bodies authored ~±100 x / ~60 tall — scale to real inches via PX_PER_IN
    const sx = scale * (car.scaleX || 1) * (lay.half / 100);
    const sy = scale * (lay.H / 58);
    ctx.scale(sx, sy);
    drawCarBody(ctx, car, opts);
    ctx.restore();
  }

  global.SSRCarsDraw = {
    drawCarBody: drawCarBody,
    drawAt: drawAt,
    drawPixelAt: drawPixelAt,
    drawWheel: drawWheel,
    shadeColor: shadeColor,
    RIM_STYLES: RIM_STYLES,
    DIMENSIONS: DIMENSIONS,
    PX_PER_IN: PX_PER_IN,
    layoutOf: layoutOf,
    BODIES: Object.keys(BODIES),
    PIXEL_W: PIXEL_W,
    PIXEL_H: PIXEL_H,
  };
})(window);
