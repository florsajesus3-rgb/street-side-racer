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

  /** Dodge Charger 2015–23 — long sedan, crosseyed lights, curved muscle. */
  function bodyCharger(ctx, car, opts) {
    const color = car.color;
    const d = detail(opts);
    const RA = -58, FA = 62;
    const bodyPath = function () {
      ctx.beginPath();
      ctx.moveTo(-96, 2);
      ctx.bezierCurveTo(-104, 2, -104, -8, -103, -16);
      ctx.bezierCurveTo(-102, -28, -96, -34, -78, -36);
      ctx.bezierCurveTo(-55, -38, -30, -38, -20, -40);
      ctx.bezierCurveTo(-14, -54, -6, -62, 12, -63);
      ctx.bezierCurveTo(32, -64, 48, -60, 56, -52);
      ctx.bezierCurveTo(64, -44, 72, -38, 82, -36);
      ctx.bezierCurveTo(94, -34, 102, -30, 104, -20);
      ctx.bezierCurveTo(106, -10, 104, -2, 100, 2);
      // front wheel arch
      ctx.lineTo(FA + 22, 2);
      ctx.bezierCurveTo(FA + 20, -8, FA + 14, -18, FA, -18);
      ctx.bezierCurveTo(FA - 14, -18, FA - 20, -8, FA - 22, 2);
      ctx.lineTo(RA + 22, 2);
      // rear wheel arch
      ctx.bezierCurveTo(RA + 20, -8, RA + 14, -18, RA, -18);
      ctx.bezierCurveTo(RA - 14, -18, RA - 20, -8, RA - 22, 2);
      ctx.closePath();
    };
    fillBody(ctx, bodyPath, color, opts);
    if (d.med) {
      ctx.fillStyle = shadeColor(color, -18);
      ctx.globalAlpha = 0.32;
      ctx.beginPath();
      ctx.moveTo(58, -36);
      ctx.bezierCurveTo(78, -44, 98, -34, 100, -22);
      ctx.lineTo(100, -10);
      ctx.lineTo(58, -12);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    // rocker strip (curved)
    ctx.fillStyle = shadeColor(color, -38);
    ctx.beginPath();
    ctx.moveTo(RA + 22, 0);
    ctx.lineTo(FA - 22, 0);
    ctx.quadraticCurveTo(FA - 22, 6, FA - 28, 6);
    ctx.lineTo(RA + 28, 6);
    ctx.quadraticCurveTo(RA + 22, 6, RA + 22, 0);
    ctx.closePath();
    ctx.fill();
    // greenhouse glass
    drawGlass(ctx, [-16, -40, -4, -58, 40, -60, 54, -40], opts, 'rgba(25,40,60,0.78)');
    if (d.med) {
      // rear side glass
      ctx.beginPath();
      ctx.moveTo(48, -52);
      ctx.quadraticCurveTo(58, -56, 68, -42);
      ctx.lineTo(54, -40);
      ctx.closePath();
      const gg = ctx.createLinearGradient(48, -56, 68, -40);
      gg.addColorStop(0, 'rgba(20,35,55,0.75)');
      gg.addColorStop(1, 'rgba(140,180,220,0.35)');
      ctx.fillStyle = gg;
      ctx.fill();
      ctx.strokeStyle = 'rgba(10,20,35,0.5)';
      ctx.lineWidth = 1;
      ctx.stroke();
      // B/C pillars
      ctx.fillStyle = 'rgba(8,8,10,0.78)';
      ctx.beginPath();
      ctx.moveTo(18, -58); ctx.quadraticCurveTo(22, -58, 24, -40); ctx.lineTo(18, -40);
      ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(38, -58); ctx.quadraticCurveTo(44, -56, 50, -40); ctx.lineTo(42, -40);
      ctx.closePath(); ctx.fill();
      // A-pillar / hood scoop hint
      ctx.fillStyle = shadeColor(color, -8);
      ctx.beginPath();
      ctx.moveTo(48, -58);
      ctx.quadraticCurveTo(62, -54, 72, -38);
      ctx.lineTo(54, -40);
      ctx.closePath();
      ctx.fill();
    }
    panelLine(ctx, -8, -38, -8, -2, opts);
    panelLine(ctx, 22, -38, 24, -2, opts);
    panelLine(ctx, 50, -38, 52, -2, opts);
    panelLine(ctx, -70, -34, -70, -6, opts);
    doorHandle(ctx, 0, -20, opts);
    doorHandle(ctx, 32, -20, opts);
    sideMirror(ctx, -4, -42, opts, color);
    // crosseyed stacked headlights (signature Charger)
    ctx.fillStyle = '#0a0a0c';
    ctx.beginPath();
    ctx.ellipse(100, -26, 5.5, 4.2, 0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(98.5, -16, 6, 4.5, 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff8e0';
    ctx.beginPath();
    ctx.ellipse(100.5, -26.5, 3.2, 2.4, 0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffe8c0';
    ctx.beginPath();
    ctx.ellipse(99, -16.5, 3.6, 2.6, 0.1, 0, Math.PI * 2);
    ctx.fill();
    if (d.high) {
      ctx.fillStyle = 'rgba(255,240,200,0.4)';
      ctx.beginPath();
      ctx.ellipse(108, -22, 10, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff6d0';
      ctx.beginPath(); ctx.ellipse(100.5, -26.5, 1.8, 1.3, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(99, -16.5, 2, 1.4, 0, 0, Math.PI * 2); ctx.fill();
    }
    // decklid lip spoiler
    if (d.med) {
      ctx.fillStyle = shadeColor(color, -22);
      ctx.beginPath();
      ctx.moveTo(-102, -34);
      ctx.quadraticCurveTo(-94, -38, -82, -36);
      ctx.quadraticCurveTo(-84, -32, -100, -30);
      ctx.closePath();
      ctx.fill();
      if ((car.bodyLevel || 0) > 0) {
        ctx.fillStyle = shadeColor(color, -30);
        ctx.beginPath();
        ctx.moveTo(-104, -40);
        ctx.quadraticCurveTo(-92, -46, -78, -42);
        ctx.lineTo(-80, -36);
        ctx.quadraticCurveTo(-92, -38, -102, -34);
        ctx.closePath();
        ctx.fill();
      }
    }
    // taillights
    ctx.fillStyle = '#1a0508';
    roundRectPath(ctx, -102, -30, 10, 18, 3);
    ctx.fill();
    ctx.fillStyle = '#ff1a2a';
    ctx.beginPath();
    ctx.ellipse(-97, -24, 3.2, 2.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ff3344';
    ctx.beginPath();
    ctx.ellipse(-97, -16, 3.4, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    if (d.med) {
      ctx.fillStyle = 'rgba(255,40,50,0.45)';
      ctx.fillRect(-98, -24, 3, 10);
    }
    exhaustTips(ctx, car.trickyLaunch ? [-94, -84] : [-90], 0, opts);
    if (car.accent) {
      ctx.fillStyle = car.accent;
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.moveTo(-55, -24);
      ctx.quadraticCurveTo(-30, -26, -8, -24);
      ctx.lineTo(-8, -21);
      ctx.quadraticCurveTo(-30, -23, -55, -21);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    if (d.med) {
      ctx.fillStyle = shadeColor(color, -12);
      ctx.beginPath();
      ctx.moveTo(-68, -34);
      ctx.quadraticCurveTo(-40, -40, -20, -36);
      ctx.lineTo(-20, -34);
      ctx.closePath();
      ctx.fill();
    }
    // front splitter
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.moveTo(88, 0);
    ctx.quadraticCurveTo(104, 0, 104, 4);
    ctx.lineTo(86, 4);
    ctx.closePath();
    ctx.fill();
  }

  /** Mustang — fastback coupe, long hood, short deck. */
  function bodyMustang(ctx, car, opts) {
    const color = car.color;
    const d = detail(opts);
    const RA = -52, FA = 56;
    const bodyPath = function () {
      ctx.beginPath();
      ctx.moveTo(-94, 2);
      ctx.bezierCurveTo(-100, 2, -102, -10, -98, -22);
      ctx.bezierCurveTo(-94, -32, -78, -36, -55, -38);
      ctx.bezierCurveTo(-30, -40, -12, -42, -2, -56);
      ctx.bezierCurveTo(6, -66, 28, -68, 48, -62);
      ctx.bezierCurveTo(62, -56, 74, -44, 86, -36);
      ctx.bezierCurveTo(96, -32, 104, -26, 104, -14);
      ctx.bezierCurveTo(104, -4, 100, 2, 96, 2);
      ctx.lineTo(FA + 20, 2);
      ctx.bezierCurveTo(FA + 18, -8, FA + 12, -17, FA, -17);
      ctx.bezierCurveTo(FA - 12, -17, FA - 18, -8, FA - 20, 2);
      ctx.lineTo(RA + 20, 2);
      ctx.bezierCurveTo(RA + 18, -8, RA + 12, -17, RA, -17);
      ctx.bezierCurveTo(RA - 12, -17, RA - 18, -8, RA - 20, 2);
      ctx.closePath();
    };
    fillBody(ctx, bodyPath, color, opts);
    rocker(ctx, color, -88, 176);
    drawGlass(ctx, [-4, -42, 8, -60, 42, -62, 66, -40], opts, 'rgba(30,50,75,0.72)');
    if (d.med) {
      ctx.beginPath();
      ctx.moveTo(44, -58);
      ctx.quadraticCurveTo(60, -52, 72, -40);
      ctx.lineTo(54, -40);
      ctx.closePath();
      ctx.fillStyle = 'rgba(25,40,65,0.65)';
      ctx.fill();
      ctx.fillStyle = 'rgba(8,8,10,0.72)';
      ctx.beginPath();
      ctx.moveTo(26, -62); ctx.quadraticCurveTo(30, -60, 32, -40); ctx.lineTo(24, -40);
      ctx.closePath(); ctx.fill();
    }
    panelLine(ctx, 2, -38, 2, -2, opts);
    panelLine(ctx, -55, -36, -55, -6, opts);
    doorHandle(ctx, 10, -22, opts);
    sideMirror(ctx, 4, -44, opts, color);
    ctx.fillStyle = '#120408';
    roundRectPath(ctx, -100, -28, 10, 16, 3);
    ctx.fill();
    ctx.fillStyle = '#ff2030';
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.ellipse(-95, -24 + i * 5, 3.2, 1.6, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#0a0a0c';
    ctx.beginPath();
    ctx.ellipse(100, -22, 6, 7, 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff6e0';
    ctx.beginPath();
    ctx.ellipse(100.5, -22, 3.5, 5, 0.1, 0, Math.PI * 2);
    ctx.fill();
    if (d.high) {
      ctx.fillStyle = 'rgba(255,240,200,0.3)';
      ctx.beginPath(); ctx.ellipse(110, -22, 10, 6, 0, 0, Math.PI * 2); ctx.fill();
    }
    if (car.accent && d.med) {
      ctx.fillStyle = car.accent;
      ctx.beginPath();
      ctx.moveTo(-48, -36); ctx.quadraticCurveTo(-40, -40, -28, -36);
      ctx.lineTo(-28, -32); ctx.quadraticCurveTo(-40, -34, -48, -32);
      ctx.closePath(); ctx.fill();
    }
    exhaustTips(ctx, [-92, -82], 0, opts);
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.moveTo(88, 1); ctx.quadraticCurveTo(102, 1, 102, 4); ctx.lineTo(88, 4);
    ctx.closePath(); ctx.fill();
  }

  /** Supra — short wheelbase wedge, high wing optional, rounded cabin. */
  function bodySupra(ctx, car, opts) {
    const color = car.color;
    const d = detail(opts);
    const RA = -48, FA = 50;
    const bodyPath = function () {
      ctx.beginPath();
      ctx.moveTo(-88, 2);
      ctx.bezierCurveTo(-96, 2, -98, -10, -94, -22);
      ctx.bezierCurveTo(-88, -32, -70, -36, -48, -36);
      ctx.bezierCurveTo(-28, -38, -14, -40, -4, -54);
      ctx.bezierCurveTo(4, -64, 22, -66, 38, -60);
      ctx.bezierCurveTo(52, -54, 64, -44, 76, -34);
      ctx.bezierCurveTo(88, -30, 96, -24, 96, -12);
      ctx.bezierCurveTo(96, -2, 90, 2, 86, 2);
      ctx.lineTo(FA + 18, 2);
      ctx.bezierCurveTo(FA + 16, -8, FA + 10, -16, FA, -16);
      ctx.bezierCurveTo(FA - 10, -16, FA - 16, -8, FA - 18, 2);
      ctx.lineTo(RA + 18, 2);
      ctx.bezierCurveTo(RA + 16, -8, RA + 10, -16, RA, -16);
      ctx.bezierCurveTo(RA - 10, -16, RA - 16, -8, RA - 18, 2);
      ctx.closePath();
    };
    fillBody(ctx, bodyPath, color, opts);
    rocker(ctx, color, -82, 164);
    drawGlass(ctx, [-8, -38, 4, -56, 32, -58, 50, -40], opts, 'rgba(20,35,55,0.8)');
    if (d.med) {
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath();
      ctx.moveTo(16, -60);
      ctx.quadraticCurveTo(28, -66, 38, -56);
      ctx.stroke();
      ctx.fillStyle = 'rgba(8,8,10,0.65)';
      ctx.fillRect(18, -56, 3, 18);
      // ducktail / wing
      ctx.fillStyle = shadeColor(color, -20);
      ctx.beginPath();
      ctx.moveTo(-90, -28);
      ctx.quadraticCurveTo(-100, -38, -86, -38);
      ctx.quadraticCurveTo(-78, -36, -74, -28);
      ctx.closePath();
      ctx.fill();
    }
    panelLine(ctx, -2, -34, -2, -2, opts);
    panelLine(ctx, -48, -34, -48, -6, opts);
    doorHandle(ctx, 6, -20, opts);
    sideMirror(ctx, 0, -42, opts, color);
    ctx.fillStyle = '#0a0a0c';
    ctx.beginPath();
    ctx.ellipse(92, -22, 5.5, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8f4ff';
    ctx.beginPath();
    ctx.ellipse(92.5, -22, 3.5, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ff1020';
    ctx.beginPath();
    ctx.ellipse(-92, -20, 5, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    if (car.accent) {
      ctx.fillStyle = car.accent;
      ctx.beginPath();
      ctx.moveTo(-40, -22); ctx.quadraticCurveTo(-22, -24, -4, -22);
      ctx.lineTo(-4, -19.5); ctx.quadraticCurveTo(-22, -21.5, -40, -19.5);
      ctx.closePath(); ctx.fill();
    }
    exhaustTips(ctx, [-88], 0, opts);
  }

  /** Camaro — low wide coupe, aggressive nose, short greenhouse. */
  function bodyCamaro(ctx, car, opts) {
    const color = car.color;
    const d = detail(opts);
    const RA = -54, FA = 58;
    const bodyPath = function () {
      ctx.beginPath();
      ctx.moveTo(-92, 2);
      ctx.bezierCurveTo(-100, 2, -102, -12, -98, -24);
      ctx.bezierCurveTo(-92, -34, -70, -38, -40, -38);
      ctx.bezierCurveTo(-18, -40, 0, -42, 12, -58);
      ctx.bezierCurveTo(20, -68, 42, -70, 56, -58);
      ctx.bezierCurveTo(68, -48, 80, -38, 92, -34);
      ctx.bezierCurveTo(102, -30, 108, -22, 106, -10);
      ctx.bezierCurveTo(104, 0, 98, 2, 94, 2);
      ctx.lineTo(FA + 20, 2);
      ctx.bezierCurveTo(FA + 18, -8, FA + 12, -17, FA, -17);
      ctx.bezierCurveTo(FA - 12, -17, FA - 18, -8, FA - 20, 2);
      ctx.lineTo(RA + 20, 2);
      ctx.bezierCurveTo(RA + 18, -8, RA + 12, -17, RA, -17);
      ctx.bezierCurveTo(RA - 12, -17, RA - 18, -8, RA - 20, 2);
      ctx.closePath();
    };
    fillBody(ctx, bodyPath, color, opts);
    rocker(ctx, color, -88, 178);
    drawGlass(ctx, [6, -40, 18, -62, 46, -64, 62, -42], opts, 'rgba(15,25,40,0.84)');
    if (d.med) {
      ctx.fillStyle = shadeColor(color, -5);
      ctx.beginPath();
      ctx.moveTo(48, -62);
      ctx.quadraticCurveTo(66, -52, 82, -36);
      ctx.lineTo(62, -36);
      ctx.closePath();
      ctx.fill();
    }
    panelLine(ctx, 14, -38, 14, -2, opts);
    panelLine(ctx, -40, -36, -40, -6, opts);
    doorHandle(ctx, 22, -22, opts);
    sideMirror(ctx, 16, -44, opts, color);
    ctx.fillStyle = '#0a0a0c';
    ctx.beginPath();
    ctx.moveTo(96, -30); ctx.quadraticCurveTo(108, -28, 108, -16); ctx.quadraticCurveTo(106, -8, 96, -10);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fff4d8';
    ctx.beginPath();
    ctx.ellipse(102, -20, 3.5, 5, 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ff1a28';
    ctx.beginPath();
    ctx.ellipse(-96, -20, 5.5, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    if (car.accent && d.med) {
      ctx.fillStyle = car.accent;
      ctx.fillRect(-30, -24, 40, 3);
    }
    exhaustTips(ctx, [-92, -82], 0, opts);
    ctx.fillStyle = '#0d0d0f';
    ctx.beginPath();
    ctx.moveTo(88, -8); ctx.quadraticCurveTo(106, -6, 106, 4); ctx.lineTo(86, 4);
    ctx.closePath(); ctx.fill();
  }

  /** Challenger — long coupe, round headlights, muscular haunches. */
  function bodyChallenger(ctx, car, opts) {
    const color = car.color;
    const d = detail(opts);
    const RA = -56, FA = 60;
    const bodyPath = function () {
      ctx.beginPath();
      ctx.moveTo(-96, 2);
      ctx.bezierCurveTo(-104, 2, -104, -12, -100, -24);
      ctx.bezierCurveTo(-96, -34, -78, -38, -55, -38);
      ctx.bezierCurveTo(-30, -40, -12, -42, 0, -56);
      ctx.bezierCurveTo(8, -64, 32, -66, 48, -56);
      ctx.bezierCurveTo(58, -48, 72, -40, 86, -36);
      ctx.bezierCurveTo(98, -34, 106, -26, 104, -12);
      ctx.bezierCurveTo(102, 0, 96, 2, 92, 2);
      ctx.lineTo(FA + 20, 2);
      ctx.bezierCurveTo(FA + 18, -8, FA + 12, -17, FA, -17);
      ctx.bezierCurveTo(FA - 12, -17, FA - 18, -8, FA - 20, 2);
      ctx.lineTo(RA + 20, 2);
      ctx.bezierCurveTo(RA + 18, -8, RA + 12, -17, RA, -17);
      ctx.bezierCurveTo(RA - 12, -17, RA - 18, -8, RA - 20, 2);
      ctx.closePath();
    };
    fillBody(ctx, bodyPath, color, opts);
    rocker(ctx, color, -90, 180);
    drawGlass(ctx, [-8, -40, 4, -56, 36, -58, 52, -40], opts, 'rgba(25,40,60,0.74)');
    if (d.med) {
      drawGlass(ctx, [40, -54, 54, -52, 68, -40, 52, -38], opts, 'rgba(20,35,55,0.7)');
      ctx.fillStyle = 'rgba(8,8,10,0.7)';
      ctx.fillRect(22, -54, 4, 18);
    }
    panelLine(ctx, -2, -38, -2, -2, opts);
    panelLine(ctx, -55, -36, -55, -6, opts);
    doorHandle(ctx, 8, -22, opts);
    sideMirror(ctx, 0, -44, opts, color);
    // round headlights
    ctx.fillStyle = '#0a0a0c';
    ctx.beginPath(); ctx.ellipse(98, -22, 7, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff6e8';
    ctx.beginPath(); ctx.ellipse(98.5, -22.5, 4, 5, 0, 0, Math.PI * 2); ctx.fill();
    if (d.high) {
      ctx.fillStyle = 'rgba(255,250,230,0.35)';
      ctx.beginPath(); ctx.ellipse(108, -22, 9, 7, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#ff2028';
    ctx.beginPath(); ctx.ellipse(-96, -22, 6, 7, 0, 0, Math.PI * 2); ctx.fill();
    if (car.accent) {
      ctx.fillStyle = car.accent;
      ctx.beginPath();
      ctx.moveTo(-50, -24); ctx.quadraticCurveTo(-28, -26, -6, -24);
      ctx.lineTo(-6, -21); ctx.quadraticCurveTo(-28, -23, -50, -21);
      ctx.closePath(); ctx.fill();
    }
    exhaustTips(ctx, [-92, -82], 0, opts);
  }

  /** Skyline GT-R — boxy-but-curved cabin, huge rear wing, round lamps. */
  function bodySkyline(ctx, car, opts) {
    const color = car.color;
    const d = detail(opts);
    const RA = -50, FA = 54;
    const bodyPath = function () {
      ctx.beginPath();
      ctx.moveTo(-90, 2);
      ctx.bezierCurveTo(-98, 2, -100, -12, -94, -26);
      ctx.bezierCurveTo(-88, -34, -70, -38, -50, -38);
      ctx.bezierCurveTo(-28, -40, -14, -42, -4, -54);
      ctx.bezierCurveTo(4, -62, 28, -64, 44, -56);
      ctx.bezierCurveTo(56, -50, 68, -40, 80, -34);
      ctx.bezierCurveTo(92, -30, 98, -22, 96, -10);
      ctx.bezierCurveTo(94, 0, 88, 2, 84, 2);
      ctx.lineTo(FA + 18, 2);
      ctx.bezierCurveTo(FA + 16, -8, FA + 10, -16, FA, -16);
      ctx.bezierCurveTo(FA - 10, -16, FA - 16, -8, FA - 18, 2);
      ctx.lineTo(RA + 18, 2);
      ctx.bezierCurveTo(RA + 16, -8, RA + 10, -16, RA, -16);
      ctx.bezierCurveTo(RA - 10, -16, RA - 16, -8, RA - 18, 2);
      ctx.closePath();
    };
    fillBody(ctx, bodyPath, color, opts);
    rocker(ctx, color, -84, 166);
    drawGlass(ctx, [-10, -40, 2, -54, 32, -56, 48, -40], opts, 'rgba(30,50,80,0.72)');
    if (d.med) {
      drawGlass(ctx, [36, -52, 48, -50, 64, -40, 48, -38], opts, 'rgba(25,45,70,0.68)');
      ctx.fillStyle = 'rgba(8,8,10,0.7)';
      ctx.fillRect(16, -52, 4, 16);
    }
    panelLine(ctx, -6, -36, -6, -2, opts);
    panelLine(ctx, -50, -36, -50, -6, opts);
    doorHandle(ctx, 4, -22, opts);
    sideMirror(ctx, -2, -42, opts, color);
    // big GT wing
    ctx.fillStyle = shadeColor(color, -25);
    ctx.beginPath();
    ctx.moveTo(-86, -30);
    ctx.quadraticCurveTo(-110, -52, -68, -52);
    ctx.quadraticCurveTo(-62, -48, -60, -30);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = shadeColor(color, -40);
    ctx.beginPath();
    ctx.moveTo(-108, -50); ctx.quadraticCurveTo(-88, -56, -66, -50);
    ctx.lineTo(-66, -47); ctx.quadraticCurveTo(-88, -52, -108, -47);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(-100, -48); ctx.lineTo(-92, -30);
    ctx.moveTo(-76, -48); ctx.lineTo(-70, -30);
    ctx.stroke();
    ctx.fillStyle = '#0a0a0c';
    ctx.beginPath(); ctx.arc(92, -22, 7.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f0f6ff';
    ctx.beginPath(); ctx.arc(92, -22, 4.8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ff2030';
    ctx.beginPath(); ctx.ellipse(-94, -20, 5, 6, 0, 0, Math.PI * 2); ctx.fill();
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
    const q = quality || 'High';
    const hi = q === 'High' || q === 'Ultra';
    const ultra = q === 'Ultra';
    const L = pxLayout(id);
    pctx.clearRect(0, 0, PIXEL_W, PIXEL_H);
    pctx.imageSmoothingEnabled = true;

    const RA = L.rearA, FA = L.frontA;
    const bot = L.bodyBot;
    const top = L.bodyTop;
    const roof = L.roof;
    const x0 = L.x0, x1 = L.x1;

    // Cabin fractions (distinct silhouettes)
    let cabinStart = 0.40, cabinEnd = 0.76;
    if (L.doors === 4) { cabinStart = 0.34; cabinEnd = 0.86; }
    else if (id === 'challenger') { cabinStart = 0.40; cabinEnd = 0.74; }
    else if (id === 'mustang') { cabinStart = 0.42; cabinEnd = 0.78; }
    else if (id === 'camaro') { cabinStart = 0.40; cabinEnd = 0.76; }
    else if (id === 'skyline') { cabinStart = 0.38; cabinEnd = 0.78; }
    else if (id === 'supra') { cabinStart = 0.40; cabinEnd = 0.76; }
    const cx0 = x0 + L.lenPx * cabinStart;
    const cx1 = x0 + L.lenPx * cabinEnd;

    // soft ground shadow
    pctx.fillStyle = 'rgba(0,0,0,0.45)';
    pctx.beginPath();
    pctx.ellipse(PIXEL_W * 0.5, L.ground + 2, L.lenPx * 0.42, 4.5, 0, 0, Math.PI * 2);
    pctx.fill();

    const glow = car.underglow;
    if (glow && glow !== 'off' && glow !== 'none' && hi) {
      const map = { blue: '#5090ff', purple: '#b450ff', red: '#ff4050', green: '#3cff8c', cyan: '#28e6ff', white: '#dce6ff' };
      pctx.globalAlpha = 0.45;
      pctx.fillStyle = map[glow] || map.blue;
      pctx.beginPath();
      pctx.ellipse(PIXEL_W * 0.5, L.ground, L.lenPx * 0.4, 5, 0, 0, Math.PI * 2);
      pctx.fill();
      pctx.globalAlpha = 1;
    }

    // wheel-well cutouts helper radii
    const wr = hi ? 8.5 : 7.5;

    function bodySilhouette() {
      pctx.beginPath();
      // rear bumper (left = tail)
      pctx.moveTo(x0 + 3, bot);
      pctx.bezierCurveTo(x0 - 1, bot, x0 - 2, top + 4, x0 + 2, top);
      // rear deck to cabin
      pctx.bezierCurveTo(x0 + 8, top - 2, cx0 - 4, top - 1, cx0, top);
      // rise to roof (C-pillar)
      if (id === 'mustang' || id === 'supra' || id === 'camaro') {
        pctx.bezierCurveTo(cx0 + 4, roof + 6, cx0 + 8, roof + 1, cx0 + (cx1 - cx0) * 0.15, roof);
        pctx.bezierCurveTo(cx0 + (cx1 - cx0) * 0.55, roof - 1, cx1 - 6, roof + 2, cx1, top - 2);
      } else if (id === 'charger') {
        // long sedan greenhouse
        pctx.bezierCurveTo(cx0 + 2, roof + 4, cx0 + 6, roof, cx0 + 14, roof);
        pctx.bezierCurveTo(cx0 + (cx1 - cx0) * 0.7, roof - 1, cx1 - 4, roof + 3, cx1, top);
      } else {
        pctx.bezierCurveTo(cx0 + 4, roof + 5, cx0 + 10, roof, cx0 + (cx1 - cx0) * 0.2, roof);
        pctx.bezierCurveTo(cx0 + (cx1 - cx0) * 0.65, roof - 1, cx1 - 4, roof + 4, cx1, top);
      }
      // hood to nose (right)
      const noseDrop = (id === 'supra' || id === 'camaro') ? 3 : 1;
      pctx.bezierCurveTo(cx1 + 8, top - 2, x1 - 10, top + noseDrop, x1 - 2, top + 4);
      pctx.bezierCurveTo(x1 + 2, top + 8, x1 + 1, bot - 2, x1 - 3, bot);
      // front wheel arch
      pctx.lineTo(FA + wr + 1, bot);
      pctx.bezierCurveTo(FA + wr, bot - wr * 0.3, FA + wr * 0.7, bot - wr * 1.15, FA, bot - wr * 1.2);
      pctx.bezierCurveTo(FA - wr * 0.7, bot - wr * 1.15, FA - wr, bot - wr * 0.3, FA - wr - 1, bot);
      // rocker
      pctx.lineTo(RA + wr + 1, bot);
      // rear wheel arch
      pctx.bezierCurveTo(RA + wr, bot - wr * 0.3, RA + wr * 0.7, bot - wr * 1.15, RA, bot - wr * 1.2);
      pctx.bezierCurveTo(RA - wr * 0.7, bot - wr * 1.15, RA - wr, bot - wr * 0.3, RA - wr - 1, bot);
      pctx.closePath();
    }

    // body fill with cartoon gradient
    const g = pctx.createLinearGradient(0, roof, 0, bot + 4);
    g.addColorStop(0, lit);
    g.addColorStop(0.35, c);
    g.addColorStop(0.75, mid);
    g.addColorStop(1, dark);
    bodySilhouette();
    pctx.fillStyle = g;
    pctx.fill();
    // bold cel outline
    pctx.strokeStyle = 'rgba(0,0,0,0.7)';
    pctx.lineWidth = hi ? 1.6 : 1.2;
    pctx.lineJoin = 'round';
    pctx.stroke();

    // specular stripe
    if (hi) {
      pctx.save();
      bodySilhouette();
      pctx.clip();
      const sg = pctx.createLinearGradient(x0, roof, x1, bot);
      sg.addColorStop(0, 'rgba(255,255,255,0)');
      sg.addColorStop(0.45, 'rgba(255,255,255,0)');
      sg.addColorStop(0.52, 'rgba(255,255,255,0.28)');
      sg.addColorStop(0.6, 'rgba(255,255,255,0)');
      sg.addColorStop(1, 'rgba(255,255,255,0)');
      pctx.fillStyle = sg;
      pctx.fillRect(0, 0, PIXEL_W, PIXEL_H);
      pctx.restore();
    }

    // glass panes (curved)
    function glassPane(px0, py0, px1, py1, px2, py2, px3, py3) {
      pctx.beginPath();
      pctx.moveTo(px0, py0);
      pctx.quadraticCurveTo((px0 + px1) * 0.5, Math.min(py0, py1) - 1, px1, py1);
      pctx.lineTo(px2, py2);
      pctx.quadraticCurveTo((px2 + px3) * 0.5, Math.max(py2, py3) + 1, px3, py3);
      pctx.closePath();
      const gg = pctx.createLinearGradient(px0, py0, px2, py3);
      gg.addColorStop(0, 'rgba(25,45,70,0.9)');
      gg.addColorStop(0.45, 'rgba(50,85,120,0.55)');
      gg.addColorStop(1, 'rgba(180,210,240,0.45)');
      pctx.fillStyle = gg;
      pctx.fill();
      pctx.strokeStyle = 'rgba(8,12,20,0.55)';
      pctx.lineWidth = 1;
      pctx.stroke();
    }
    const gy0 = roof + 3, gy1 = top - 1;
    const gw = (cx1 - cx0);
    if (L.doors === 4) {
      glassPane(cx0 + 3, gy1, cx0 + 6, gy0, cx0 + gw * 0.28, gy0, cx0 + gw * 0.32, gy1);
      glassPane(cx0 + gw * 0.34, gy1, cx0 + gw * 0.36, gy0, cx0 + gw * 0.58, gy0, cx0 + gw * 0.62, gy1);
      glassPane(cx0 + gw * 0.64, gy1, cx0 + gw * 0.66, gy0 + 1, cx1 - 6, gy0 + 2, cx1 - 3, gy1);
    } else {
      glassPane(cx0 + 3, gy1, cx0 + 8, gy0, cx0 + gw * 0.55, gy0, cx0 + gw * 0.62, gy1);
      glassPane(cx0 + gw * 0.64, gy1, cx0 + gw * 0.68, gy0 + 1, cx1 - 4, gy0 + 3, cx1 - 2, gy1);
    }
    if (hi) {
      // pillars
      pctx.fillStyle = 'rgba(8,8,10,0.8)';
      pctx.fillRect(cx0 + gw * 0.3, gy0, 2, gy1 - gy0);
      if (L.doors === 4) pctx.fillRect(cx0 + gw * 0.6, gy0, 2, gy1 - gy0);
      // highlight
      pctx.strokeStyle = 'rgba(255,255,255,0.25)';
      pctx.beginPath();
      pctx.moveTo(cx0 + 6, gy0 + 2);
      pctx.lineTo(cx0 + gw * 0.25, gy0 + 1);
      pctx.stroke();
    }

    // rocker
    pctx.fillStyle = dark;
    pctx.beginPath();
    pctx.moveTo(RA + wr + 2, bot - 1);
    pctx.lineTo(FA - wr - 2, bot - 1);
    pctx.quadraticCurveTo(FA - wr - 2, bot + 3, FA - wr - 6, bot + 3);
    pctx.lineTo(RA + wr + 6, bot + 3);
    pctx.quadraticCurveTo(RA + wr + 2, bot + 3, RA + wr + 2, bot - 1);
    pctx.closePath();
    pctx.fill();

    // car-specific nose / tail / wing
    if (id === 'charger') {
      // crosseyed stacked headlights
      pctx.fillStyle = '#12100c';
      pctx.beginPath(); pctx.ellipse(x1 - 4, top + 4, 3.2, 2.4, 0.1, 0, Math.PI * 2); pctx.fill();
      pctx.beginPath(); pctx.ellipse(x1 - 5, top + 10, 3.4, 2.6, 0.05, 0, Math.PI * 2); pctx.fill();
      pctx.fillStyle = '#fff6c8';
      pctx.beginPath(); pctx.ellipse(x1 - 3.5, top + 3.8, 1.8, 1.3, 0, 0, Math.PI * 2); pctx.fill();
      pctx.fillStyle = '#ffe8a0';
      pctx.beginPath(); pctx.ellipse(x1 - 4.5, top + 9.8, 2, 1.5, 0, 0, Math.PI * 2); pctx.fill();
      if (hi) {
        pctx.fillStyle = 'rgba(255,240,180,0.35)';
        pctx.beginPath(); pctx.ellipse(x1 + 2, top + 7, 5, 4, 0, 0, Math.PI * 2); pctx.fill();
      }
      // taillights
      pctx.fillStyle = '#2a0508';
      pctx.beginPath(); pctx.ellipse(x0 + 5, top + 6, 3, 5, 0, 0, Math.PI * 2); pctx.fill();
      pctx.fillStyle = '#ff1a2a';
      pctx.beginPath(); pctx.ellipse(x0 + 5, top + 4, 1.6, 1.4, 0, 0, Math.PI * 2); pctx.fill();
      pctx.fillStyle = '#ff3344';
      pctx.beginPath(); pctx.ellipse(x0 + 5, top + 9, 1.8, 2, 0, 0, Math.PI * 2); pctx.fill();
      // decklid lip
      pctx.fillStyle = dark;
      pctx.beginPath();
      pctx.moveTo(x0 + 2, top);
      pctx.quadraticCurveTo(x0 + 10, top - 4, x0 + 18, top - 1);
      pctx.quadraticCurveTo(x0 + 12, top + 2, x0 + 2, top + 2);
      pctx.closePath(); pctx.fill();
      // dual exhaust
      pctx.fillStyle = '#1a1a1c';
      pctx.beginPath(); pctx.ellipse(x0 + 10, bot + 1, 3, 1.8, 0, 0, Math.PI * 2); pctx.fill();
      pctx.beginPath(); pctx.ellipse(x0 + 18, bot + 1, 3, 1.8, 0, 0, Math.PI * 2); pctx.fill();
      if (a) {
        pctx.globalAlpha = 0.9;
        pctx.fillStyle = a;
        pctx.beginPath();
        pctx.moveTo(cx0 - 8, top + 6);
        pctx.quadraticCurveTo(cx0 + 2, top + 4, cx0 + 12, top + 6);
        pctx.lineTo(cx0 + 12, top + 8);
        pctx.quadraticCurveTo(cx0 + 2, top + 6, cx0 - 8, top + 8);
        pctx.closePath(); pctx.fill();
        pctx.globalAlpha = 1;
      }
    } else if (id === 'challenger') {
      pctx.fillStyle = '#0a0a0c';
      pctx.beginPath(); pctx.ellipse(x1 - 4, top + 7, 4, 4.5, 0, 0, Math.PI * 2); pctx.fill();
      pctx.fillStyle = '#ffe8a0';
      pctx.beginPath(); pctx.ellipse(x1 - 3.5, top + 6.5, 2.4, 2.8, 0, 0, Math.PI * 2); pctx.fill();
      pctx.fillStyle = '#ff2030';
      pctx.beginPath(); pctx.ellipse(x0 + 5, top + 7, 3, 4.5, 0, 0, Math.PI * 2); pctx.fill();
      pctx.fillStyle = dark;
      pctx.beginPath();
      pctx.moveTo(x0 + 3, top); pctx.quadraticCurveTo(x0 + 12, top - 3, x0 + 20, top);
      pctx.closePath(); pctx.fill();
      if (a) { pctx.fillStyle = a; pctx.fillRect(cx0 - 6, top + 6, 22, 2); }
    } else if (id === 'mustang') {
      // fastback cue already in silhouette; tri-bar tails
      pctx.fillStyle = '#2a0508';
      pctx.beginPath(); pctx.ellipse(x0 + 5, top + 7, 3, 5, 0, 0, Math.PI * 2); pctx.fill();
      pctx.fillStyle = '#ff2030';
      for (let i = 0; i < 3; i++) {
        pctx.beginPath(); pctx.ellipse(x0 + 5, top + 3 + i * 3.5, 2, 1.1, 0, 0, Math.PI * 2); pctx.fill();
      }
      pctx.fillStyle = '#0a0a0c';
      pctx.beginPath(); pctx.ellipse(x1 - 4, top + 7, 3.5, 4.5, 0, 0, Math.PI * 2); pctx.fill();
      pctx.fillStyle = '#ffe8a0';
      pctx.beginPath(); pctx.ellipse(x1 - 3.5, top + 6.5, 2.2, 3, 0, 0, Math.PI * 2); pctx.fill();
    } else if (id === 'camaro') {
      pctx.fillStyle = '#0a0a0c';
      pctx.beginPath();
      pctx.moveTo(x1 - 7, top + 3); pctx.quadraticCurveTo(x1 + 1, top + 5, x1, top + 12); pctx.lineTo(x1 - 7, top + 12);
      pctx.closePath(); pctx.fill();
      pctx.fillStyle = '#ffe8a0';
      pctx.fillRect(x1 - 5, top + 5, 3, 5);
      pctx.fillStyle = '#ff2030';
      pctx.beginPath(); pctx.ellipse(x0 + 5, top + 7, 3, 4, 0, 0, Math.PI * 2); pctx.fill();
      if (a) { pctx.fillStyle = a; pctx.fillRect(cx0 + 6, top + 3, 16, 2); }
    } else if (id === 'skyline') {
      // GT wing
      pctx.fillStyle = dark;
      pctx.beginPath();
      pctx.moveTo(x0 + 6, roof + 2);
      pctx.quadraticCurveTo(x0 + 2, roof - 8, x0 + 28, roof - 8);
      pctx.quadraticCurveTo(x0 + 30, roof - 4, x0 + 28, roof + 2);
      pctx.closePath(); pctx.fill();
      pctx.fillStyle = mid;
      pctx.fillRect(x0 + 8, roof - 1, 2, 5);
      pctx.fillRect(x0 + 22, roof - 1, 2, 5);
      if (hi) {
        pctx.fillStyle = lit;
        pctx.beginPath();
        pctx.moveTo(x0 + 4, roof - 7); pctx.quadraticCurveTo(x0 + 16, roof - 10, x0 + 28, roof - 7);
        pctx.lineTo(x0 + 28, roof - 5); pctx.quadraticCurveTo(x0 + 16, roof - 7, x0 + 4, roof - 5);
        pctx.closePath(); pctx.fill();
      }
      pctx.fillStyle = '#0a0a0c';
      pctx.beginPath(); pctx.arc(x1 - 4, top + 7, 4, 0, Math.PI * 2); pctx.fill();
      pctx.fillStyle = '#f0f6ff';
      pctx.beginPath(); pctx.arc(x1 - 4, top + 7, 2.5, 0, Math.PI * 2); pctx.fill();
      pctx.fillStyle = '#ff2030';
      pctx.beginPath(); pctx.ellipse(x0 + 5, top + 7, 2.8, 4, 0, 0, Math.PI * 2); pctx.fill();
      if (a) { pctx.fillStyle = a; pctx.fillRect(cx0 + 8, top + 4, 5, 2); }
    } else if (id === 'supra') {
      pctx.fillStyle = dark;
      pctx.beginPath();
      pctx.moveTo(x0 + 5, roof + 2);
      pctx.quadraticCurveTo(x0 + 4, roof - 5, x0 + 24, roof - 5);
      pctx.quadraticCurveTo(x0 + 26, roof, x0 + 24, roof + 2);
      pctx.closePath(); pctx.fill();
      pctx.fillRect(x0 + 8, roof, 2, 4);
      pctx.fillRect(x0 + 18, roof, 2, 4);
      pctx.fillStyle = '#0a0a0c';
      pctx.beginPath(); pctx.ellipse(x1 - 4, top + 7, 3.5, 3.5, 0, 0, Math.PI * 2); pctx.fill();
      pctx.fillStyle = '#e8f4ff';
      pctx.beginPath(); pctx.ellipse(x1 - 3.5, top + 6.5, 2.2, 2.2, 0, 0, Math.PI * 2); pctx.fill();
      pctx.fillStyle = a || '#ff3030';
      pctx.beginPath(); pctx.ellipse(x0 + 5, top + 7, 2.8, 3.5, 0, 0, Math.PI * 2); pctx.fill();
    }

    // body kit flares
    if ((car.bodyLevel || 0) > 0) {
      pctx.fillStyle = dark;
      pctx.beginPath();
      pctx.ellipse(RA, bot - 2, 7, 5, 0, 0, Math.PI * 2); pctx.fill();
      pctx.beginPath();
      pctx.ellipse(FA, bot - 2, 7, 5, 0, 0, Math.PI * 2); pctx.fill();
    }

    // door handle / mirror
    if (hi) {
      pctx.fillStyle = '#1a1a1c';
      pctx.fillRect(cx0 + 8, top + 5, 4, 2);
      pctx.fillStyle = mid;
      pctx.beginPath();
      pctx.moveTo(cx1 - 8, roof + 6);
      pctx.quadraticCurveTo(cx1 - 2, roof + 4, cx1, roof + 8);
      pctx.quadraticCurveTo(cx1 - 2, roof + 10, cx1 - 8, roof + 9);
      pctx.closePath(); pctx.fill();
      pctx.fillStyle = 'rgba(180,210,240,0.55)';
      pctx.fillRect(cx1 - 6, roof + 7, 3, 1.5);
    }

    // round cartoon wheels (not square)
    function wheel(cx, spinning) {
      const r = hi ? 7 : 6;
      const cy = L.ground - r + 1;
      pctx.fillStyle = '#050506';
      pctx.beginPath(); pctx.arc(cx, cy, r, 0, Math.PI * 2); pctx.fill();
      pctx.fillStyle = '#141416';
      pctx.beginPath(); pctx.arc(cx, cy, r - 1.2, 0, Math.PI * 2); pctx.fill();
      pctx.strokeStyle = '#2a2e34';
      pctx.lineWidth = 1.5;
      pctx.beginPath(); pctx.arc(cx, cy, r - 2.2, 0, Math.PI * 2); pctx.stroke();
      if (hi) {
        pctx.fillStyle = '#a8b0b8';
        pctx.beginPath(); pctx.arc(cx, cy, r - 3.2, 0, Math.PI * 2); pctx.fill();
        pctx.strokeStyle = spinning ? '#9aa0a8' : '#d0d4da';
        pctx.lineWidth = 1.2;
        for (let i = 0; i < 5; i++) {
          const ang = (i / 5) * Math.PI * 2 + (spinning ? 0.4 : 0);
          pctx.beginPath();
          pctx.moveTo(cx + Math.cos(ang) * 1.5, cy + Math.sin(ang) * 1.5);
          pctx.lineTo(cx + Math.cos(ang) * (r - 3.5), cy + Math.sin(ang) * (r - 3.5));
          pctx.stroke();
        }
        pctx.fillStyle = '#eee';
        pctx.beginPath(); pctx.arc(cx, cy, 1.4, 0, Math.PI * 2); pctx.fill();
        if (ultra) {
          pctx.fillStyle = '#c41230';
          pctx.beginPath(); pctx.ellipse(cx - r + 2, cy, 1.5, 2.2, 0.3, 0, Math.PI * 2); pctx.fill();
        }
      } else {
        pctx.fillStyle = '#888';
        pctx.beginPath(); pctx.arc(cx, cy, 2.5, 0, Math.PI * 2); pctx.fill();
      }
    }

    const spinning = (car.wheelspin || 0) > 0.35;
    wheel(RA, spinning);
    wheel(FA, spinning);

    function flame(big) {
      const flick = big ? 1 : 0.7;
      pctx.fillStyle = '#ff6a18';
      pctx.beginPath();
      pctx.moveTo(x0 + 2, bot - 2);
      pctx.quadraticCurveTo(x0 - 6 * flick, bot, x0 - 10 * flick, bot + 2);
      pctx.quadraticCurveTo(x0 - 4 * flick, bot + 4, x0 + 2, bot + 3);
      pctx.closePath(); pctx.fill();
      pctx.fillStyle = '#ffe060';
      pctx.beginPath();
      pctx.moveTo(x0 + 2, bot - 1);
      pctx.quadraticCurveTo(x0 - 3 * flick, bot + 1, x0 - 5 * flick, bot + 2);
      pctx.lineTo(x0 + 2, bot + 2);
      pctx.closePath(); pctx.fill();
    }
    if ((car.nitroActive && car.nitro > 0) || (car.exhaustFlame && car.exhaustFlame > 0.2)) {
      flame(!!(car.nitroActive && car.nitro > 0));
      if (id === 'charger' || id === 'challenger') flame(false);
    }
    if (car.nitroActive && car.nitro > 0) {
      pctx.fillStyle = '#5ad0ff';
      pctx.beginPath();
      pctx.moveTo(x0 + 2, top + 4);
      pctx.quadraticCurveTo(x0 - 8, top + 6, x0 - 4, top + 10);
      pctx.lineTo(x0 + 2, top + 9);
      pctx.closePath(); pctx.fill();
      pctx.fillStyle = '#e0f8ff';
      pctx.beginPath();
      pctx.moveTo(x0 + 2, top + 5);
      pctx.lineTo(x0 - 4, top + 7);
      pctx.lineTo(x0 + 2, top + 8);
      pctx.closePath(); pctx.fill();
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
    ctx.imageSmoothingEnabled = true;
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
