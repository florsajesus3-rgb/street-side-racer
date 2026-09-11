/** Street Side Racer — original canvas side-view car art (no ripped sprites). */
(function (global) {
  'use strict';

  const RIM_STYLES = ['spoke5', 'mesh', 'star', 'deepdish', 'turbine'];

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

  const BODIES = {
    charger: bodyCharger,
    mustang: bodyMustang,
    supra: bodySupra,
    camaro: bodyCamaro,
    challenger: bodyChallenger,
    skyline: bodySkyline,
  };

  function wheelPositions(carId, bodyLevel) {
    const widen = (bodyLevel || 0) * 2;
    const map = {
      charger: [-54, 60],
      mustang: [-52, 58],
      supra: [-48, 54],
      camaro: [-56, 62],
      challenger: [-54, 60],
      skyline: [-50, 56],
    };
    const p = map[carId] || [-52, 58];
    return [p[0] - widen * 0.3, p[1] + widen * 0.3];
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
      const rimOpts = {
        quality: opts.quality,
        reflectionPass: false,
        rimStyle: car.rimStyle || RIM_STYLES[(car.rimIndex || 0) % RIM_STYLES.length],
        caliperColor: car.accent || '#c41230',
      };
      drawWheel(ctx, wp[0], 4, car.wheelRot || 0, rimOpts);
      drawWheel(ctx, wp[1], 4, car.wheelRot || 0, rimOpts);
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


  /* —— Original pixel-art draw mode (nearest-neighbor scaled silhouettes) —— */
  const PIXEL_W = 96;
  const PIXEL_H = 40;
  const pixelCache = {};

  function pxShade(hex, amt) {
    return shadeColor(hex, amt);
  }

  function paintPixelBody(pctx, car) {
    const id = car.id || 'charger';
    const c = car.color || '#888';
    const a = car.accent || '#ccc';
    const dark = pxShade(c, -40);
    const lit = pxShade(c, 28);
    const glass = 'rgba(40,70,110,0.92)';
    // clear
    pctx.clearRect(0, 0, PIXEL_W, PIXEL_H);
    // shadow
    pctx.fillStyle = 'rgba(0,0,0,0.45)';
    pctx.fillRect(8, 34, 80, 4);

    // Distinct silhouettes per car (original, not traced)
    function bodyRect(x, y, w, h, col) {
      pctx.fillStyle = col;
      pctx.fillRect(x, y, w, h);
    }
    function wheel(x, y) {
      pctx.fillStyle = '#0a0a0a';
      pctx.fillRect(x, y, 10, 10);
      pctx.fillStyle = '#3a3a3a';
      pctx.fillRect(x + 2, y + 2, 6, 6);
      pctx.fillStyle = '#c8c8c8';
      pctx.fillRect(x + 4, y + 4, 2, 2);
    }

    if (id === 'charger') {
      // long hood, crosseyed stacked lights, muscular rear
      bodyRect(10, 18, 72, 12, c);
      bodyRect(28, 10, 36, 10, c);
      bodyRect(10, 16, 22, 4, lit);
      bodyRect(62, 14, 18, 6, dark);
      pctx.fillStyle = glass;
      pctx.fillRect(30, 11, 14, 7);
      pctx.fillRect(46, 11, 12, 7);
      // stacked headlights
      bodyRect(8, 20, 3, 3, '#ffe8a0');
      bodyRect(8, 24, 3, 3, '#ffe8a0');
      bodyRect(80, 20, 3, 4, '#ff3030');
      bodyRect(14, 28, 10, 3, dark);
      bodyRect(64, 28, 12, 3, dark);
    } else if (id === 'mustang') {
      bodyRect(12, 18, 68, 12, c);
      bodyRect(34, 10, 30, 10, c);
      bodyRect(12, 16, 18, 4, lit);
      pctx.fillStyle = glass;
      pctx.fillRect(36, 11, 12, 7);
      pctx.fillRect(50, 11, 10, 7);
      bodyRect(10, 20, 4, 5, '#ffe8a0');
      bodyRect(78, 20, 4, 5, '#ff3030');
      // fastback slope cue
      bodyRect(62, 12, 10, 6, dark);
    } else if (id === 'supra') {
      bodyRect(14, 18, 66, 11, c);
      bodyRect(30, 9, 34, 11, c);
      bodyRect(68, 12, 14, 8, dark); // wing
      pctx.fillStyle = glass;
      pctx.fillRect(32, 10, 14, 8);
      pctx.fillRect(48, 10, 12, 8);
      bodyRect(12, 20, 4, 4, '#ffe8a0');
      bodyRect(78, 20, 4, 4, a);
    } else if (id === 'camaro') {
      bodyRect(12, 19, 70, 11, c);
      bodyRect(32, 11, 34, 10, c);
      bodyRect(18, 16, 20, 4, lit);
      pctx.fillStyle = glass;
      pctx.fillRect(34, 12, 14, 7);
      pctx.fillRect(50, 12, 12, 7);
      bodyRect(10, 21, 4, 4, '#ffe8a0');
      bodyRect(80, 21, 4, 4, '#ff3030');
      bodyRect(40, 17, 16, 2, dark); // SS stripe cue
    } else if (id === 'challenger') {
      bodyRect(10, 18, 74, 12, c);
      bodyRect(30, 11, 34, 9, c);
      bodyRect(10, 16, 24, 4, lit);
      pctx.fillStyle = glass;
      pctx.fillRect(32, 12, 14, 6);
      pctx.fillRect(48, 12, 12, 6);
      bodyRect(8, 21, 4, 5, '#ffe8a0');
      bodyRect(82, 21, 4, 5, '#ff3030');
    } else if (id === 'skyline') {
      bodyRect(14, 18, 64, 11, c);
      bodyRect(28, 9, 36, 11, c);
      bodyRect(66, 8, 16, 5, dark); // GT-R wing
      bodyRect(66, 13, 4, 6, dark);
      pctx.fillStyle = glass;
      pctx.fillRect(30, 10, 14, 8);
      pctx.fillRect(46, 10, 12, 8);
      bodyRect(12, 20, 4, 4, '#ffe8a0');
      bodyRect(76, 20, 4, 4, '#ff3030');
      bodyRect(40, 17, 4, 2, a);
    } else {
      bodyRect(14, 18, 66, 12, c);
      bodyRect(30, 10, 34, 10, c);
      pctx.fillStyle = glass;
      pctx.fillRect(32, 11, 28, 7);
      bodyRect(12, 20, 4, 4, '#ffe8a0');
      bodyRect(78, 20, 4, 4, '#ff3030');
    }

    // body kit widen cue
    if ((car.bodyLevel || 0) > 0) {
      bodyRect(8, 24, 6, 6, dark);
      bodyRect(82, 24, 6, 6, dark);
    }
    wheel(20, 26);
    wheel(66, 26);

    // nitro flame
    if (car.nitroActive && car.nitro > 0) {
      pctx.fillStyle = '#5ad0ff';
      pctx.fillRect(2, 20, 8, 4);
      pctx.fillStyle = '#e0f8ff';
      pctx.fillRect(0, 21, 5, 2);
    }
  }

  function getPixelSprite(car) {
    const key = [
      car.id, car.color, car.accent, car.bodyLevel || 0,
      car.rimStyle || '', car.underglow || '',
      (car.nitroActive && car.nitro > 0) ? 'n' : ''
    ].join('|');
    let entry = pixelCache[key];
    if (entry) return entry;
    const c = document.createElement('canvas');
    c.width = PIXEL_W;
    c.height = PIXEL_H;
    paintPixelBody(c.getContext('2d'), car);
    pixelCache[key] = c;
    // limit cache
    const keys = Object.keys(pixelCache);
    if (keys.length > 80) delete pixelCache[keys[0]];
    return c;
  }

  function drawPixelAt(ctx, car, screenX, y, scale, opts) {
    opts = opts || {};
    const spr = getPixelSprite(car);
    const sx = scale * (car.scaleX || 1);
    const w = PIXEL_W * sx * 2.1;
    const h = PIXEL_H * scale * 2.1;
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
    ctx.drawImage(spr, -w / 2, -h + 8, w, h);
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
    ctx.scale(scale * (car.scaleX || 1), scale);
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
    BODIES: Object.keys(BODIES),
    PIXEL_W: PIXEL_W,
    PIXEL_H: PIXEL_H,
  };
})(window);
