// export_tower.js - renders the timing tower's baked textures from tools/tower/tower.js (the approved drawing).
// Output: JSON in #out: { G, P, R, BANNER, names, sprites: [{name, w, h, x0, y0, x1, y1, exact?, rgba(base64)}] }.
// URL: ?r=<px per HUD unit> (default 4), ?only=<sprite name> (draw just that one), ?list=1 (names only, no drawing).
// Since 2026-11-09 headless Chrome on this PC hangs on pages that draw more than a couple of canvases, so
// export_sprites.py renders one sprite per Chrome run (?only=) and merges the results.
//
// Only static art is baked: backgrounds, the header band, status blocks, arrows, tyre letters, side boxes and the
// banner background. Live text (positions, codes, gaps, the session line, banner texts) is drawn by the game's own
// text styles; the F1 logo and the FIA badge are the game's own textures (never drawn or shipped here). Baked letters
// use Saira (SIL OFL), never the F1 font.
//
// FRAMES (bounds are HUD units, 1 unit = 3 px at 1080p, y down):
//   tower  origin = top-left of the panel: hdr
//   row    origin = top-left of a row cell: up, dn, ty_*
//   box    origin = top-left of a side box: pen, pit
//   block  origin = top-left of a status block: sc, vsc, chq, yel, red
//   banner origin = top-left of the banner: bn_l, bn_m, bn_r
// "exact" sprites fill their box edge to edge (no padding): they set the bounds the game's stackers lay out with.
(async () => {
  const out = document.getElementById('out');
  try {
    const T = TOWER, G = T.G, P = T.P, p = G.p;
    // Fix round 1 (2026-11-09, docs/timing-tower/ui-build.md "Fix round 1"): the game's own number font is about 40 %
    // wider than the drawing's, so a two-digit gap ("+33.7") filled its whole box and sat 0.08 p from the widest code
    // (HAM). The build's panel is 0.2 p wider than the drawing's (81.96 -> 84.56 HUD); the gap and tyre columns move
    // right with the panel's right edge, the gap column 1.0 HUD more (closer to the tyre letter, as F1 TV); the F1
    // logo and the FIA badge stay centred. Everything left of the gap column (strip, badge slot, code) is unchanged.
    // Applied here so the baked sprites (header, SC / VSC / chequered blocks, tyre letters) and sprites.json's G (read
    // by tower_native.py) carry the same geometry. tools/tower/tower.js (the approved drawing) is not changed.
    const FIX1 = { dW: 0.2 * p, dGap: 1.0 };
    G.w += FIX1.dW; G.tyreX += FIX1.dW;
    G.num.race.r += FIX1.dW + FIX1.dGap; G.num.timed.r += FIX1.dW + FIX1.dGap;
    G.logo.x += FIX1.dW / 2; G.fia.x += FIX1.dW / 2;
    G.fix1 = FIX1;
    const q = new URLSearchParams(location.search);
    const R = +(q.get('r') || 4);                       // texture px per HUD unit (4 = 1:1 at 1440p)
    const only = q.get('only'), listOnly = q.get('list') === '1';
    if (!listOnly)
      await Promise.all([
        ...[600, 700, 800, 900].map(w => document.fonts.load(`${w} 32px TowerSaira`, 'SAFETYCARVIRTULHQEDFLGP!MWONS0123456789')),
        document.fonts.load(`italic 700 32px TowerSaira`, 'SMHIWP!'),
        document.fonts.load(`italic 800 32px TowerFlag`, 'YELLOWSAFETYCARVIRTUALREDCHEQUEREDFLAGSESSIONSTOPPED'),
      ]);

    function b64(u8) {
      let s = '';
      for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
      return btoa(s);
    }
    // exact: the canvas is the box (sizes rounded up to whole 4x4 blocks; the drawing is stretched onto it, < 0.5 %)
    function exact(name, box, draw) {
      const [x0, y0, x1, y1] = box;
      const W = Math.ceil((x1 - x0) * R / 4) * 4, H = Math.ceil((y1 - y0) * R / 4) * 4;
      const c = document.createElement('canvas'); c.width = W; c.height = H;
      const g = c.getContext('2d', { willReadFrequently: true });
      g.setTransform(W / (x1 - x0), 0, 0, H / (y1 - y0), -x0 * W / (x1 - x0), -y0 * H / (y1 - y0));
      draw(g);
      const img = g.getImageData(0, 0, W, H).data;
      return { name, w: W, h: H, x0, y0, x1, y1, exact: true, rgba: b64(new Uint8Array(img.buffer)) };
    }
    // padded: drawn in a generous box, cropped to the ink plus 2 px, rounded up to whole 4x4 blocks
    function padded(name, box, draw) {
      const [x0, y0, x1, y1] = box, W = Math.round((x1 - x0) * R), H = Math.round((y1 - y0) * R);
      const c = document.createElement('canvas'); c.width = W; c.height = H;
      const g = c.getContext('2d', { willReadFrequently: true });
      g.setTransform(R, 0, 0, R, -x0 * R, -y0 * R);
      draw(g);
      const d = g.getImageData(0, 0, W, H).data;
      let mx0 = W, my0 = H, mx1 = -1, my1 = -1;
      for (let y = 0; y < H; y++) { const row = y * W * 4; for (let x = 0; x < W; x++) if (d[row + x * 4 + 3]) { if (x < mx0) mx0 = x; if (x > mx1) mx1 = x; if (y < my0) my0 = y; my1 = y; } }
      if (mx1 < 0) throw new Error('empty sprite ' + name);
      const pad = 2;
      if (mx0 - pad < 0 || my0 - pad < 0 || mx1 + 1 + pad > W || my1 + 1 + pad > H) throw new Error('sprite touches its render box: ' + name);
      let cx0 = mx0 - pad, cy0 = my0 - pad, cw = mx1 + 1 + pad - cx0, ch = my1 + 1 + pad - cy0;
      cw = (cw + 3) & ~3; ch = (ch + 3) & ~3;
      const img = g.getImageData(cx0, cy0, cw, ch).data;
      return { name, w: cw, h: ch, x0: x0 + cx0 / R, y0: y0 + cy0 / R, x1: x0 + (cx0 + cw) / R, y1: y0 + (cy0 + ch) / R,
               rgba: b64(new Uint8Array(img.buffer)) };
    }
    const rect = (g, x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
    // tower.js triangle(): the arrow glyph
    function triangle(g, cx, cy, w, h, up, color) {
      g.save(); g.beginPath();
      if (up) { g.moveTo(cx, cy - h / 2); g.lineTo(cx + w / 2, cy + h / 2); g.lineTo(cx - w / 2, cy + h / 2); }
      else { g.moveTo(cx, cy + h / 2); g.lineTo(cx + w / 2, cy - h / 2); g.lineTo(cx - w / 2, cy - h / 2); }
      g.closePath(); g.fillStyle = color; g.fill();
      g.strokeStyle = color; g.lineJoin = 'round'; g.lineWidth = 0.05 * w; g.stroke(); g.restore();
    }

    const W = G.w, S = G.status, B = G.banner, side = G.side, SC = S.sc;
    const jobs = [];                                     // [name, () => sprite]
    const job = (name, make) => jobs.push([name, make]);

    const hazardBar = (g, y, h, c1, c2) => {
      g.save();
      g.beginPath(); g.rect(0, y, W, h); g.clip();
      rect(g, 0, y, W, h, c1);
      g.fillStyle = c2;
      const step = 3.2;
      for (let x = -h * 2; x < W + h * 2; x += step) {
        g.beginPath();
        g.moveTo(x, y + h); g.lineTo(x + step * 0.48, y + h);
        g.lineTo(x + step * 0.48 + h, y); g.lineTo(x + h, y);
        g.closePath(); g.fill();
      }
      g.restore();
    };

    // ---- header band (tower frame): sleek obsidian F1TV header with glossy sheen & F1 red divider
    job('hdr', () => exact('hdr', [0, 0, W, G.sep + G.band], g => {
      const gr = g.createLinearGradient(0, 0, 0, G.sep);
      gr.addColorStop(0, P.hdrTop); gr.addColorStop(0.45, P.hdrMid); gr.addColorStop(1, P.hdrSep);
      rect(g, 0, 0, W, G.sep, gr);
      // Subtle top gloss bevel
      const gloss = g.createLinearGradient(0, 0, 0, G.sep * 0.35);
      gloss.addColorStop(0, 'rgba(255,255,255,0.08)'); gloss.addColorStop(1, 'rgba(255,255,255,0)');
      rect(g, 0, 0, W, G.sep * 0.35, gloss);
      rect(g, 0, 0, W, 0.45, 'rgba(255,255,255,0.16)');
      // Session band (smoked glass translucency matching real F1TV broadcast)
      const sb = g.createLinearGradient(0, G.sep, 0, G.sep + G.band);
      sb.addColorStop(0, 'rgba(13,14,20,0.76)'); sb.addColorStop(1, 'rgba(8,9,13,0.80)');
      rect(g, 0, G.sep, W, G.band, sb);
      // Iconic F1 crimson accent divider
      rect(g, 0, G.sep - 0.55, W, 1.1, P.separator);
      rect(g, 0, G.sep + G.band - 0.35, W, 0.35, 'rgba(255,255,255,0.12)');
    }));

    // ---- row parts (row frame)
    const row = [-0.5, -0.5, W + 0.5, p + 0.5];
    job('up', () => padded('up', row, g => triangle(g, G.arrow.x, G.mid + G.arrow.dyUp, G.arrow.w, G.arrow.h, true, P.up)));
    job('dn', () => padded('dn', row, g => triangle(g, G.arrow.x, G.mid + G.arrow.dyDown, G.arrow.w, G.arrow.h, false, P.down)));
    const pcw = 0.14 * p, pch = 0.105 * p;
    job('pcu', () => exact('pcu', [0, 0, pcw, pch], g => triangle(g, pcw / 2, pch / 2, pcw * 0.95, pch * 0.95, true, P.up)));
    job('pcd', () => exact('pcd', [0, 0, pcw, pch], g => triangle(g, pcw / 2, pch / 2, pcw * 0.95, pch * 0.95, false, P.down)));
    for (const L of ['S', 'M', 'H', 'I', 'W'])
      job('ty_' + L, () => padded('ty_' + L, row, g => {
        g.save();
        g.shadowColor = 'rgba(0,0,0,0.85)'; g.shadowBlur = 1.4; g.shadowOffsetY = 0.4;
        T.text(g, L, G.tyreX, G.mid + G.tyreCap / 2, G.tyreCap * 1.04, { wt: 700, italic: true, align: 'center', color: P.tyre[L] });
        g.restore();
      }));

    // ---- side boxes (box frame): rounded sleek '!' penalty (red) and 'P' pit lane (white)
    const sideBox = (name, fill, glyph, ch) => exact(name, [0, 0, side.w, side.h], g => {
      g.beginPath(); g.roundRect(0.25, 0.25, side.w - 0.5, side.h - 0.5, 0.95);
      g.fillStyle = fill; g.fill();
      T.text(g, ch, side.w / 2, side.h / 2 + side.cap / 2, side.cap * 1.02, { wt: 800, italic: ch === 'P', align: 'center', color: glyph });
    });
    job('pen', () => sideBox('pen', P.pen[0], P.pen[1], '!'));
    job('pit', () => sideBox('pit', P.pit[0], P.pit[1], 'P'));

    // ---- status blocks (block frame): F1TV broadcast gradient + diagonal hazard trim + bold italic display font
    job('sc', () => exact('sc', [0, 0, W, 2 * p], g => {
      const gr = g.createLinearGradient(0, 0, 0, 2 * p);
      gr.addColorStop(0, P.sc); gr.addColorStop(1, P.scBot || P.sc);
      rect(g, 0, 0, W, 2 * p, gr);
      hazardBar(g, 0, 1.5, '#0A0B0E', P.sc);
      hazardBar(g, 2 * p - 1.5, 1.5, '#0A0B0E', P.sc);
      const cap = (SC.l1[1] - SC.l1[0]) * p * 0.96;
      T.text(g, 'SAFETY', SC.tx * p, SC.l1[1] * p, cap, { wt: 800, italic: true, font: 'TowerFlag', color: '#08090C' });
      T.text(g, 'CAR', SC.tx * p, SC.l2[1] * p, cap, { wt: 800, italic: true, font: 'TowerFlag', color: '#08090C' });
    }));
    job('vsc', () => exact('vsc', [0, 0, W, SC.vscH * p], g => {
      const H = SC.vscH * p;
      const gr = g.createLinearGradient(0, 0, 0, H);
      gr.addColorStop(0, P.sc); gr.addColorStop(1, P.scBot || P.sc);
      rect(g, 0, 0, W, H, gr);
      hazardBar(g, 0, 1.5, '#0A0B0E', P.sc);
      hazardBar(g, H - 1.5, 1.5, '#0A0B0E', P.sc);
      const cap = (SC.l1[1] - SC.l1[0]) * p * 0.94, x = SC.tx * p;
      ['VIRTUAL', 'SAFETY', 'CAR'].forEach((w, i) => T.text(g, w, x, SC.vscB[i] * p, cap, { wt: 800, italic: true, font: 'TowerFlag', color: '#08090C' }));
    }));
    job('chq', () => exact('chq', [0, 0, W, p], g => {
      const sq = 0.25 * p, n = Math.round(W / sq), sx = W / n;
      for (let i = 0; i < n; i++) for (let j = 0; j < 4; j++) rect(g, i * sx, j * sq, sx, sq, (i + j) % 2 ? '#0D0E12' : '#F2F4F8');
      g.save(); g.font = `italic 800 ${(0.40 * p / 0.69 * 10).toFixed(2)}px TowerFlag`;
      const m = g.measureText('CHEQUERED FLAG'); g.restore();
      const tw = (m.actualBoundingBoxLeft + m.actualBoundingBoxRight) / 10 + 0.6 * p;
      g.beginPath(); g.roundRect(W / 2 - tw / 2, 0.11 * p, tw, 0.78 * p, 0.8);
      g.fillStyle = P.darkBand; g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.45)'; g.lineWidth = 0.35; g.stroke();
      T.text(g, 'CHEQUERED FLAG', W / 2, G.mid + 0.19 * p, 0.38 * p, { wt: 800, italic: true, font: 'TowerFlag', align: 'center', color: P.sess });
    }));

    // ---- flag blocks (block frame): yellow & red with hazard stripe header + crisp dark sub-band
    job('yel', () => exact('yel', [0, 0, W, 2 * p], g => {
      const gr = g.createLinearGradient(0, 0, 0, 1.02 * p);
      gr.addColorStop(0, P.yellow); gr.addColorStop(1, P.yellowBot || P.yellow);
      rect(g, 0, 0, W, 1.02 * p, gr);
      hazardBar(g, 0, 1.4, '#0A0B0E', P.yellow);
      T.text(g, 'YELLOW FLAG', W / 2, G.mid + S.barCap * p * 0.46 + 0.5, S.barCap * p * 0.94, { wt: 800, italic: true, font: 'TowerFlag', align: 'center', color: P.yellowText });
      rect(g, 0, p, W, p, P.darkBand);
      rect(g, 0, 2 * p - 0.55, W, 0.55, P.yellow);
    }));
    job('red', () => exact('red', [0, 0, W, 2 * p], g => {
      const gr = g.createLinearGradient(0, 0, 0, 1.04 * p);
      gr.addColorStop(0, P.red); gr.addColorStop(1, P.redFlagBot || P.red);
      rect(g, 0, 0, W, 1.04 * p, gr);
      hazardBar(g, 0, 1.4, '#0A0B0E', P.red);
      T.text(g, 'RED FLAG', W / 2, G.mid + S.redCap * p * 0.46 + 0.5, S.redCap * p * 0.94, { wt: 800, italic: true, font: 'TowerFlag', align: 'center', color: P.redFlagText });
      rect(g, 0, p, W, p, P.darkBand);
      rect(g, 0, 2 * p - 0.55, W, 0.55, P.red);
      T.text(g, 'SESSION STOPPED', W / 2, p + G.mid + S.stopCap * p * 0.46, S.stopCap * p * 0.90, { wt: 700, italic: true, font: 'TowerFlag', align: 'center', color: P.stopped });
    }));

    // ---- Race Control banner background (banner frame)
    const BH = 22.0, k = BH / B.hPx, leftW = B.t1x * k - 2.0, rightW = B.padR * k;
    const bnGrad = (g, x0, x1) => {
      const gr = g.createLinearGradient(0, 0, 0, BH);
      gr.addColorStop(0, P.banner[0]); gr.addColorStop(1, P.banner[1]);
      rect(g, x0, 0, x1 - x0, BH, gr);
      rect(g, x0, 0, x1 - x0, 0.5, 'rgba(255,255,255,0.16)');
      rect(g, x0, BH - 0.7, x1 - x0, 0.7, P.red);
    };
    job('bn_l', () => exact('bn_l', [0, 0, leftW, BH], g => {
      bnGrad(g, 0, leftW);
      const gl = g.createLinearGradient(0, 0, leftW, 0);
      gl.addColorStop(0, 'rgba(34,48,76,0.55)'); gl.addColorStop(1, 'rgba(34,48,76,0)');
      rect(g, 0, 0.5, leftW, BH - 1.2, gl);
    }));
    job('bn_m', () => exact('bn_m', [0, 0, 1, BH], g => bnGrad(g, 0, 1)));
    job('bn_r', () => exact('bn_r', [0, 0, rightW, BH], g => bnGrad(g, 0, rightW)));

    const names = jobs.map(j => j[0]);
    const sprites = listOnly ? [] : jobs.filter(j => !only || j[0] === only).map(j => j[1]());
    if (only && !sprites.length) throw new Error('no sprite ' + only);
    out.textContent = JSON.stringify({ G, P, R, BANNER: { H: BH, k, leftW, rightW }, names, sprites });
    document.title = 'done';
  } catch (e) { out.textContent = 'ERROR ' + e.stack; document.title = 'error'; }
})();
