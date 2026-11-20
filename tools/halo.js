// 2026 halo onboard HUD — reference renderer (v3).
// Units: broadcast pixels of a 640x360 frame (x3 = 1080p), origin = dial centre, y down.
// The C++ overlay addon is generated from this file: its textures are rendered from these
// functions and its dynamic parts use the same numbers in G (geometry) and P (palette).
//
// The wings are drawn the way the broadcast maps them onto the curved halo: text runs along
// the band, but letter verticals lean toward the centre ("lean", degrees from screen-vertical,
// positive = top to the right) instead of staying perpendicular to the baseline.
const HALO_MAKE = (LAYOUT) => {
  const D = Math.PI / 180;
  const FONT = (typeof window !== 'undefined' && window.HALO_FONT) || 'HaloSaira';
  const CAP = 0.688; // Saira cap height / em

  const G = {
    // Centre cluster (dial, capsules, slat columns, labels): measured on the Interlagos reference in the rectified
    // design plane D (dial bright-ring radius 35.0, text horizontal, mirror-symmetric; docs/visual/reference-analysis.md).
    // The game HUD draws D as-is (theme 'authentic'). perspShot is the Interlagos camera's view of that plane
    // (canvas transform a,b,c,d = M_DS), used only by theme 'screenshot' to overlay the reference frame.
    centreScale: 1.0,
    perspShot: [0.999042, -0.032283, -0.043768, 0.853476],
    // look (docs/qa/discrepancies.md V17-V22, measured on the Interlagos reference in this plane): the collar is a
    // ring from just inside the face out to r, see-through above collarFade[0] and full from collarFade[1] down (the
    // broadcast shows the scene round the dial's upper half); the face is translucent (P.face) with a square mesh of
    // lines `w` wide and `pitch` apart (P.mesh, P.mesh2: every second line a little stronger), its ink set so the mesh's
    // contrast stays about even down the face as on the reference (lighter ink on the light top, stronger below)
    disc: { r: 39.37, inner: 34.4, rim: 35.0, ring: 1.2, light: 36.47, lightW: 0.55, collarFade: [-7.5, -3.5], collarLow: [16, 29], mesh: { pitch: 1.0, w: 0.28 } },
    kmh: { y: -23.934, fs: 4.974, tr: 0.02 },
    // speed and mph are live texts (the game's font in game): Saira at its own width here (no x1.068 /
    // x1.013 stretches fitted to the broadcast face)
    speed: { y: -14.874, fs: 13.529, tr: 0.35 },
    boost: { y: -2.617, w: 27.8, h: 5.423, r: 3.0, fs: 3.938, tr: 0.5, hatchR: [15.6, 18.5, 20.8, 22.5, 24.0, 25.6, 26.9], hy0: -6.5, hy1: 0.5 },
    ot: { y: 4.718, w: 46.629, h: 5.05, fs: 3.924, tr: 0.243 },
    mph: { y: 13.459, fs: 11.012, tr: 0.5 },
    mphLbl: { y: 21.88, fs: 4.388, tr: 0.595 },
    batt: { x: 0.0, y: 32.41, w: 24.9, h: 7.45, r: 1.9, nubW: 0.75, nubH: 3.0, bolt: 0.86, bx: -0.19, by: 32.19 },
    // capsules: annulus rIn..rOut between yTop and yBot; letters upright, evenly spaced in angle on radius txtR
    caps: { rIn: 39.311, rOut: 50.854, yTop: -18.105, yBot: 22.059, rcOut: 3.0, rcIn: 2.0, fs: 3.602, txtR: 45.142, txtA0: -15.518, txtA1: 24.508 },
    // slats: n parallelograms with vertical ends on circles (rIn, centre y cyIn) and (rOut, cyOut); slat 0 = bottom,
    // centre y at x = xRef is y0 - i * pitch; every slat slopes k (down toward the outside)
    // th: 2.40 (was the NCC fit's 2.16): the separators' FWHM then matches the reference's 0.75-0.84 (V8)
    // litGap: the gap between two lit slats in their colour at this brightness (V20)
    stripes: { rIn: 53.058, cyIn: 2.805, rOut: 66.528, cyOut: 1.075, n: 10, y0: 22.781, pitch: 3.54, xRef: 59, k: 0.233, th: 2.40, pad: 0.9, litGap: 0.5 },
    // BRAKE / THROTTLE: `lean` is the stems' angle from the screen's vertical (frame()). On the Interlagos reference both
    // labels stand upright on screen on their tilted baselines (label-box NCC against our label at known
    // BRAKE / THROTTLE: tucked cleanly INSIDE the dark glass band beneath the slats, parallel to slat slope (13.1 deg)
    brakeLbl: { x: -56.8, y: 28.6, rot: -13.1, lean: -2.0 },
    throttleLbl: { x: 56.8, y: 28.6, rot: 13.1, lean: 2.0 },
    lblFs: 3.70,
    // values below were fitted against two Melbourne frames, t=205 s and t=262 s (fit.html, normalised cross-correlation)
    // TURN and its number turned -20.6 degrees with no shear (lean = rot, was -1.6): the number is a live game
    // text, which the game turns but cannot shear, and TURN (a sprite, shown only with a number) takes the
    // number's transform, so the two match in the game
    turn: {
      arrow: { x: -87.419, y: 12.119, s: 1, rot: -53.081, lean: -28.65 },
      lbl: { x: -82.816, y: 23.817, fs: 4.497, rot: -20.6, lean: -20.6, tr: 0.3 },
      num: { x: -83.922, y: 31.143, fs: 7.934, rot: -20.6, lean: -20.6, tr: 0.3 },
    },
    // "<position> <SURNAME>": the number ends at numEnd (lane u), the surname starts numGap after it. leanRel 0 =
    // upright on the lane, as the game draws these live texts (docs/qa/discrepancies.md V11), without the
    // broadcast's 22-degree lean (a shear beyond Saira's own axes)
    names: { x: -106.759, y: 37.261, rot: -26.18, bend: 0.002305, lean: -11, leanRel: 0, drvV: 0.73, laneGap: 13.784, drvFs: 8.508, rivFs: 6.963, rivShift: 3.703, tr: 1.26,
             lineA: -7.495, lineB: 7.858, lineW: 0.8, railA0: 3.01, railB0: -3.02, cardEnd: -84.44, numEnd: -67.686, numGap: 6.86, numBox: 14.0, nameBox: 62.0 },
    aero: { x1: 89.654, y1: 4.458, x2: 88.54, y2: 8.787, rot: 16.347, lean: 13.047, fs: 4.371, tr: 0.587,
            barX: 85.19, barY: 19.65, barDx: 3.85, barDy: -3.76, barLen: 12.24, barAng: 15.5, slHx: 2.78, slHy: 0.76, slLen: 8.84, slAng: -52.1, slTh: 1.25, barTh: 1.1 },
    gears: { p0: [107.887, 19.578], p1: [149.139, 34.689], p2: [188.881, 63.902], fs: 6.916, fsOn: 6.557, lean: 13.377, track: 7.107, trackW: 1.9,
             mx: 97.901, my: 26.019, mr: 0,
             gx: 154.802, gy: 30.048, grot: 28.62, rx: 142.439, ry: 49.863, rrot: 28.804, lfs: 4.251, llean: 15.7,
             r0t: -0.046, r15t: 1.108, rEndOff: 4.642, rEndFs: 5.023 },
    band: { dx: 0.65, dy: 5.0 },
    // wings: clean clearance around ACTIVE AERO, GEARS, TURN & driver names (matches real 2026 F1TV Halo)
    wings: { L: { xi: -71.8, tilt: 4.0, top: 2.6, bot: 3.0, r: 4.2, xFar: -215 },
             R: { xi: 71.8, tilt: 9.6, top: 1.8, bot: 3.2, r: 4.2, xFar: 220 } },
    // G-force variant (optional, off by default; docs/gmeter/design.md). Measured on the Spa clip (Belgian GP Q2,
    // 18 Jul 2026, 640x360) in this plane D, with the outer ring = the rim (35.0). Angles: 0 = right, 90 = down.
    // rings: the three inner rings; val: the speed digits' size (cap 9.3 measured) with tighter tracking (Saira is
    // wider than the broadcast face: '4.5' ink 23 units); arc: cyan, built from whole segments of `seg` degrees
    // (edges at 22.5 + 45k): the two segments nearest the felt-force direction, three centred on it when wide;
    // white / red: bars of half-height halfH on the nearest axis (right, down, left, up), between the rings;
    // thresholds in g: indicator from `on`, wide arc from `wide`, red bar from `redOn`, red digits `digitsRed`.
    gm: { rings: [28.41, 23.41, 17.27], ringW: 0.5,
          val: { y: 0.0, fs: 13.529, tr: -0.45, sx: 1.0 }, lbl: { y: 7.0, fs: 3.6, tr: 0.25 },
          arc: { r0: 12.0, r1: 17.0, seg: 45 }, white: { r0: 17.8, r1: 22.9, halfH: 7.3 }, red: { r0: 23.9, r1: 27.9, halfH: 7.3 },
          on: 0.3, wide: 2.0, redOn: 2.3, digitsRed: 4.3 },
  };

  const P = {
    // Authentic 2026 F1TV FOM broadcast smoked-obsidian glass palette (restrained, neutral deep glass, zero cartoonish neon clutter)
    bandTop: 'rgba(10,20,34,0.52)', band: 'rgba(6,13,22,0.48)', bandBot: 'rgba(4,9,16,0.36)',
    bandEdge: 'rgba(218,240,255,0.86)', bandGlow: 'rgba(110,196,255,0.22)',
    bandBotEdge: 'rgba(162,212,248,0.46)', bandBotGlow: 'rgba(72,160,232,0.14)',
    wingFill: 'rgba(5,11,20,0.16)', wingFillTop: 'rgba(14,26,42,0.20)', wingLine: 'rgba(188,224,250,0.36)',
    discOuterTop: 'rgba(6,14,24,0)', discOuter: 'rgba(6,13,22,0.16)', discOuterBot: 'rgba(4,9,16,0.24)',
    face: [[0, 'rgba(14,28,44,0.48)'], [0.25, 'rgba(9,19,32,0.54)'], [0.60, 'rgba(6,13,23,0.60)'], [1, 'rgba(4,9,16,0.66)']],
    // Ultra-subtle micro-carbon dial grid
    mesh: [[0, 'rgba(110,188,240,0.028)'], [0.5, 'rgba(110,188,240,0.018)'], [1, 'rgba(110,188,240,0.010)']],
    mesh2: [[0, 'rgba(110,188,240,0.012)'], [1, 'rgba(110,188,240,0.006)']],
    // Metallic outer rim + recessed groove (lit dynamically by smooth neon RPM bezel rb_01..12 + rb_max)
    ring: [[0, 'rgba(64,88,112,0.72)'], [0.45, 'rgba(44,64,86,0.64)'], [0.85, 'rgba(28,42,58,0.48)'], [1, 'rgba(18,28,40,0.32)']],
    ringGlow: [[0, 'rgba(60,148,216,0.16)'], [0.5, 'rgba(38,108,168,0.10)'], [1, 'rgba(20,60,100,0.03)']],
    ringLight: [[0, 'rgba(148,224,255,0.88)'], [0.45, 'rgba(76,178,248,0.66)'], [0.85, 'rgba(40,124,204,0.24)'], [1, 'rgba(24,84,156,0.04)']],
    white: '#F8FBFF', label: '#DDEBF6', dim: '#8AA4BA',
    boostFill: 'rgba(8,18,30,0.54)', boostLine: 'rgba(146,196,234,0.40)', boostText: '#9BB6CC', hatch: 'rgba(112,174,220,0.34)',
    boostOn: '#18D2FF', boostOnLine: '#D6F8FF', boostOnText: '#041826', hatchOn: 'rgba(142,232,255,0.88)',
    otOnTop: '#0F7E40', otOnBot: '#074D26', otOnLine: '#28E884', otOnText: '#82FFB8', otOnGlow: 'rgba(32,232,128,0.28)',
    otOff: 'rgba(8,16,28,0.52)', otOffLine: 'rgba(104,142,172,0.36)', otOffText: '#6F889C',
    capOff: 'rgba(7,16,28,0.42)', capOffLine: 'rgba(156,214,250,0.38)', capOffText: '#A8DCFA',
    capOnTop: '#36ECFF', capOnBot: '#0692DF', capOnLine: '#D0F7FF', capOnText: '#F8FDFF',
    stripePanel: 'rgba(5,12,22,0.30)', stripeOff: 'rgba(44,72,96,0.42)',
    throttle: '#14DE78', throttleTop: '#42FFA2', brake: '#FF2A3C', brakeTop: '#FF5666',
    battLine: '#6AECC0', battFillTop: '#24F292', battFillBot: '#00BC68', battIn: 'rgba(6,16,28,0.72)', battCharge: 'rgba(8,34,54,0.76)', bolt: '#FFFFFF',
    aeroOn: '#38F0D8', aeroBar: '#EAF4FC', gearDim: 'rgba(212,226,238,0.80)', track: 'rgba(128,186,228,0.36)', gearLbl: '#D4E4F2',
    gearOnBg: '#EAF4FF', gearOnGlow: 'rgba(210,238,255,0.42)', gearOnText: '#071422',
    gRing: 'rgba(120,192,238,0.44)', gCyan: '#38E0FF', gWhite: '#F4FAFF', gRed: '#FF3648',
  };

  // ---------- car classes (docs/halo-car-classes.md). st.carClass picks which car's halo is drawn:
  //   '2026' (default, also when unset): today's halo, unchanged;
  //   '2025': F1 25's own 2025 cars: a DRS pill in place of the active-aero symbol, the ERS deploy mode in the
  //           Boost / Overtake area, capsules on the 2025 MGU-K scale (capsKW);
  //   'f2':   the same halo without battery, capsules and pills, plus the DRS pill.
  // capsKW is the power a full capsule stands for: the DLL's scale for st.recharge / st.deploy (level = kW / capsKW).
  // The variant parts' geometry and colours live in GV / PV, not in G / P, so the 2026 export header is unchanged.
  const CLASSES = {
    '2026': { aero: true, drs: false, battery: true, capsules: true, capsKW: 350, pills: 'boost_ot' },
    '2025': { aero: false, drs: true, battery: true, capsules: true, capsKW: 120, pills: 'ers_mode' },
    f2: { aero: false, drs: true, battery: false, capsules: false, capsKW: null, pills: null },
  };
  const carClass = st => CLASSES[st && st.carClass] || CLASSES['2026'];
  // st.drs: the pill's look ('off' | 'avail' | 'open') or the game's drs_pit_state (docs/halo-car-classes.md 2.3).
  // drs_distance and drs_active show the outline (a proposal, doc 6.1); the pit limiter states show grey.
  const DRS_LOOK = { off: 'off', avail: 'avail', open: 'open', invalid: 'off', drs_unavailable: 'off', drs_distance: 'avail',
                     drs_active: 'avail', drs_live: 'open', pit_distance: 'off', pit_active: 'off', pit_live: 'off' };
  const drsLook = st => DRS_LOOK[st && st.drs] || 'off';
  // st.ersMode: the game's ers_mode (ui32, view-model order 0 None, 1 Medium, 2 Hotlap, 3 Overtake) or the name
  const ERS_MODES = ['NONE', 'MEDIUM', 'HOTLAP', 'OVERTAKE'];
  const ersModeIndex = st => {
    const m = st && st.ersMode, i = typeof m === 'string' ? ERS_MODES.indexOf(m.toUpperCase()) : m;
    return Number.isInteger(i) && i >= 0 && i < ERS_MODES.length ? i : null;
  };
  const GV = {
    // DRS pill: in the active-aero spot on the right wing, sheared with the wing like the ACTIVE AERO label
    drs: { x: 86.9, y: 11.9, w: 17.6, h: 7.2, r: 1.5, fs: 5.1, tr: 0.62, rot: 16.347, lean: 13.047, line: 0.8 },
    // ERS deploy mode (2025): the caption takes the Boost slot, the mode pill the Overtake slot (the OVERTAKE pill's size)
    ersCap: { y: -2.617, fs: 3.938, tr: 0.5 },
    ersPill: { y: 4.718, w: 46.629, h: 5.05, r: 1, fs: 3.924, tr: 0.243 },
  };
  const PV = {
    // DRS: grey = the OVERTAKE pill's off look; available = a white outline; open = the game's own DRS green
    // (rgba(34,188,52): the stock DRS bar's drs_rad_green key, dial_pit_lane_slider.idf drs_rad_bg frame 40)
    drsOff: 'rgba(92,101,108,0.92)', drsOffLine: 'rgba(130,140,148,0.8)', drsOffText: '#283035',
    drsAvailFill: 'rgba(8,20,30,0.45)', drsAvailLine: '#F4F7F8', drsAvailText: '#F4F7F8',
    drsOpen: '#22BC34', drsOpenLine: '#8CF09A', drsOpenText: '#04240B', drsOpenGlow: 'rgba(60,220,90,0.32)',
  };

  // ---------- layout variant 'cam' ("Default camera"): a symmetric halo for the game's centred T-cam. Both wings
  // have one shape, their top edge follows the car's own halo bar as the default camera shows it (
  // measured on one capture; the numbers below come from that measure and from today's set by one rule: every part
  // keeps its x and its share of the band's height and turns with the band). The layout draws 4/3 as large in game.
  // Today's set ('tv', the broadcast's off-centre camera) is every number above and the two band tables below.
  const CAM = {
    // Smooth continuous parabolic Halo arch (zero pinch/kink around x = +-70, wrapped cleanly around physical halo)
    bandTop: [[-218.0, 54.55], [-190, 33.15], [-168, 20.43], [-146, 10.2], [-122, 1.2], [-98, -6.2], [-77.0, -12.6], [-58, -18.6], [-36, -24.2], [0, -26.8], [36, -24.2], [58, -18.6], [77.0, -12.6], [98, -6.2], [122, 1.2], [146, 10.2], [168, 20.43], [190, 33.15], [218.0, 54.55]],
    bandBot: [[218.0, 98.13], [188, 77.27], [166, 66.05], [144, 57.12], [122, 49.0], [100, 41.2], [80, 34.4], [64, 30.2], [36, 28.8], [0, 29.0], [-36, 28.8], [-64, 30.2], [-80, 34.4], [-100, 41.2], [-122, 49.0], [-144, 57.12], [-166, 66.05], [-188, 77.27], [-218.0, 98.13]],
    brakeLbl: { x: -56.8, y: 28.6, rot: -13.1, lean: -2.0 },
    throttleLbl: { x: 56.8, y: 28.6, rot: 13.1, lean: 2.0 },
    turn: { arrow: { x: -87.419, y: 10.516, s: 1, rot: -49.669, lean: -25.238 }, lbl: { x: -82.816, y: 22.476, fs: 4.497, rot: -17.188, lean: -17.188, tr: 0.3 }, num: { x: -83.922, y: 29.682, fs: 7.934, rot: -17.188, lean: -17.188, tr: 0.3 } },
    names: { x: -106.759, y: 28.697, rot: -17.18, bend: 0.001167, lean: -11, leanRel: 0, drvV: 0.73, laneGap: 13.784, drvFs: 8.508, rivFs: 6.963, rivShift: 3.703, tr: 1.26, lineA: -7.495, lineB: 7.858, lineW: 0.8, railA0: 3.01, railB0: -3.02, cardEnd: -84.44, numEnd: -67.686, numGap: 6.86, numBox: 14.0, nameBox: 62.0 },
    aero: { x1: 90.0, y1: 5.5, x2: 88.8, y2: 9.9, rot: 15.6, lean: 11.5, fs: 4.25, tr: 0.55, barX: 85.19, barY: 20.457, barDx: 3.85, barDy: -3.76, barLen: 12.24, barAng: 13.342, slHx: 2.78, slHy: 0.76, slLen: 8.84, slAng: -54.258, slTh: 1.25, barTh: 1.1 },
    // gear digits & aligned GEARS / RPM x1000 labels (parallel to wing top border & RPM curve)
    gears: { p0: [107.887, 19.155], p1: [149.139, 30.672], p2: [188.881, 52.287], fs: 7.7, fsOn: 7.7, w: 800, wOn: 880, lean: 5.762, track: 7.107, trackW: 1.9, mx: 97.901, my: 26.182, mr: 0, gx: 153.5, gy: 25.6, grot: 24.0, rx: 146.5, ry: 46.8, rrot: 22.8, lfs: 4.15, llean: 8.5, r0t: -0.046, r15t: 1.108, rEndOff: 4.642, rEndFs: 5.023 },
    band: { dx: 0.0, dy: 5.0 },
    wings: { L: { xi: -71.8, tilt: 6.85, top: 2.2, bot: 3.2, r: 4.2, xFar: -218.0 }, R: { xi: 71.8, tilt: 6.85, top: 2.2, bot: 3.2, r: 4.2, xFar: 218.0 } },
    drs: { y: 12.527, rot: 14.189, lean: 10.889 },
  };
  const cam = LAYOUT === 'cam';
  if (cam) { for (const k of Object.keys(G)) if (CAM[k] && !Array.isArray(CAM[k]) && k !== 'drs') G[k] = CAM[k]; Object.assign(GV.drs, CAM.drs); }

  // ---------- text
  let WEIGHT = 700;
  function font(g, px) { g.font = `${Math.min(800, WEIGHT)} ${px}px ${FONT}`; }
  function adv(g, s, px) { font(g, px); return [...s].map(ch => g.measureText(ch).width); }
  const sum = a => a.reduce((p, q) => p + q, 0);
  // Glyph frame: baseline along `rot`, verticals along `lean` (both degrees, screen space).
  function frame(g, rot, lean) {
    const r = rot * D, l = (lean === undefined ? rot : lean) * D;
    g.transform(Math.cos(r), Math.sin(r), -Math.sin(l), Math.cos(l), 0, 0);
  }
  // Text with its cap height centred on y. o: align, tr (tracking), sx, rot, lean, w (weight)
  function text(g, s, x, y, px, color, o = {}) {
    const { align = 'center', tr = 0, sx = 1, rot = 0, lean, w: wt = 700 } = o; const prevW = WEIGHT; WEIGHT = wt;
    g.save(); g.translate(x, y); frame(g, rot, lean); g.scale(sx, 1);
    const a = adv(g, s, px); const w = sum(a) + tr * (a.length - 1);
    let cx = align === 'center' ? -w / 2 : align === 'right' ? -w : 0;
    g.fillStyle = color; g.textBaseline = 'alphabetic';
    [...s].forEach((ch, i) => { g.fillText(ch, cx, CAP * px / 2); cx += a[i] + tr; });
    g.restore(); WEIGHT = prevW; return w * sx;
  }

  // ---------- geometry helpers
  const lerp = (a, b, t) => a + (b - a) * t;
  function rr(g, x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r); }
  function poly(g, pts, close = true) { g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); if (close) g.closePath(); }
  function smoothPts(pts, closed, per = 8) { // Catmull-Rom sampled to points
    const n = pts.length, out = [];
    for (let i = 0; i < (closed ? n : n - 1); i++) {
      const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
      const q0 = closed || i > 0 ? p0 : p1, q3 = closed || i < n - 2 ? p3 : p2;
      for (let k = 0; k < per; k++) {
        const t = k / per, t2 = t * t, t3 = t2 * t;
        out.push([0, 1].map(j => 0.5 * ((2 * p1[j]) + (-q0[j] + p2[j]) * t + (2 * q0[j] - 5 * p1[j] + 4 * p2[j] - q3[j]) * t2 + (-q0[j] + 3 * p1[j] - 3 * p2[j] + q3[j]) * t3)));
      }
    }
    if (!closed) out.push(pts[n - 1]);
    return out;
  }
  function bez(p0, p1, p2, t) { const u = 1 - t; return [u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0], u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1]]; }
  function bezTan(p0, p1, p2, t) { const u = 1 - t; const dx = 2 * u * (p1[0] - p0[0]) + 2 * t * (p2[0] - p1[0]), dy = 2 * u * (p1[1] - p0[1]) + 2 * t * (p2[1] - p1[1]); const l = Math.hypot(dx, dy); return [dx / l, dy / l]; }

  // Round selected vertices of a closed polyline: corners = [[index, radius], ...].
  function roundCorners(raw, corners) {
    const n = raw.length, out = [];
    const walk = (i, dir, dist) => {
      let a = raw[i], k = i;
      for (let guard = 0; guard < n; guard++) {
        const k2 = (k + dir + n) % n, b = raw[k2], d = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (d >= dist) { const t = dist / d; return { p: [lerp(a[0], b[0], t), lerp(a[1], b[1], t)], k: k2 }; }
        dist -= d; a = b; k = k2;
      }
      return { p: a, k };
    };
    const cs = corners.slice().sort((a, b) => a[0] - b[0]);
    cs.forEach(([i, r], c) => {
      const A = walk(i, -1, r), B = walk(i, 1, r), C = raw[i];
      for (let s = 0; s <= 6; s++) { const t = s / 6, u = 1 - t; out.push([u * u * A.p[0] + 2 * u * t * C[0] + t * t * B.p[0], u * u * A.p[1] + 2 * u * t * C[1] + t * t * B.p[1]]); }
      const [ni, nr] = cs[(c + 1) % cs.length], Bn = walk(ni, -1, nr);
      let k = B.k; for (let guard = 0; k !== Bn.k && guard < n; guard++) { out.push(raw[k]); k = (k + 1) % n; }
    });
    return out;
  }
  // Exact, self-intersection-free rounded curved quad from 4 clockwise edge functions (t in 0..1):
  // e0: TL->TR, e1: TR->BR, e2: BR->BL, e3: BL->TL; radii = [rTL, rTR, rBR, rBL] in HUD units.
  function smoothCurvedQuad(edges, radii, steps = 20) {
    const lens = edges.map(fn => {
      let l = 0, p = fn(0);
      for (let i = 1; i <= 16; i++) { const q = fn(i / 16); l += Math.hypot(q[0] - p[0], q[1] - p[1]); p = q; }
      return Math.max(l, 1e-4);
    });
    const out = [];
    for (let e = 0; e < 4; e++) {
      const fn = edges[e], prev = edges[(e + 3) % 4];
      const dIn = Math.min(0.42, radii[e] / lens[(e + 3) % 4]);
      const dOut = Math.min(0.42, radii[e] / lens[e]);
      const dNext = Math.min(0.42, radii[(e + 1) % 4] / lens[e]);
      const A = prev(1 - dIn), C = fn(0), B = fn(dOut);
      for (let s = 0; s <= 7; s++) {
        const t = s / 7, u = 1 - t;
        out.push([u * u * A[0] + 2 * u * t * C[0] + t * t * B[0], u * u * A[1] + 2 * u * t * C[1] + t * t * B[1]]);
      }
      const t0 = dOut, t1 = 1 - dNext;
      if (t1 > t0 + 1e-4) {
        const n = Math.max(2, Math.round(steps * (t1 - t0)));
        for (let i = 1; i < n; i++) out.push(fn(lerp(t0, t1, i / n)));
      }
    }
    return out;
  }
  // Curved capsule (RECHARGE / DEPLOY): fills the full crescent height down to yBot=22.0 (zero wasted bottom gap!)
  // and slopes smoothly along the Halo arch at top & bottom with clean quadratic-Bezier corners.
  const CAPS_INSET_R = 0.70;
  const capsRIn = () => G.caps.rIn + CAPS_INSET_R;
  const capsROut = () => (G.caps.rOut || G.caps.xOut) - CAPS_INSET_R;
  const capsXin = y => Math.sqrt(Math.max(1, capsRIn() ** 2 - y * y));
  const capsXout = y => {
    const c = G.caps;
    if (c.rOut) return Math.sqrt(Math.max(1, capsROut() ** 2 - y * y));
    const ym = (c.yTop + c.yBot) / 2;
    return (c.xOut - CAPS_INSET_R) - c.kOut * (y - ym) ** 2;
  };
  // Full-height sloped crescent matching real 2026 F1TV Recharge / Deploy capsules (fits 100% inside orig cap quad)
  const CAP_YT_IN = -17.3, CAP_YT_OUT = -14.8, CAP_YB_IN = 22.0, CAP_YB_OUT = 21.6;
  const capsulePts = left => {
    const pTL = [capsXin(CAP_YT_IN), CAP_YT_IN], pTR = [capsXout(CAP_YT_OUT), CAP_YT_OUT];
    const pBR = [capsXout(CAP_YB_OUT), CAP_YB_OUT], pBL = [capsXin(CAP_YB_IN), CAP_YB_IN];
    const edges = [
      t => [lerp(pTL[0], pTR[0], t), lerp(pTL[1], pTR[1], t)],
      t => { const y = lerp(CAP_YT_OUT, CAP_YB_OUT, t); return [capsXout(y), y]; },
      t => [lerp(pBR[0], pBL[0], t), lerp(pBR[1], pBL[1], t)],
      t => { const y = lerp(CAP_YB_IN, CAP_YT_IN, t); return [capsXin(y), y]; },
    ];
    const out = smoothCurvedQuad(edges, [2.2, 2.6, 2.6, 2.2], 24);
    return left ? out.map(([x, y]) => [-x, y]) : out;
  };
  // Original un-modified capsule bounding silhouette for export_native.js frame cropping (zero alignment shift)
  const origCapsuleMask = left => {
    const c = G.caps, rIn = c.rIn, rOut = c.rOut || c.xOut;
    const xi = y => Math.sqrt(Math.max(1, rIn * rIn - y * y));
    const xo = y => c.rOut ? Math.sqrt(Math.max(1, rOut * rOut - y * y)) : (c.xOut - c.kOut * (y - (c.yTop + c.yBot) / 2) ** 2);
    const edges = [
      t => [lerp(xi(c.yTop), xo(c.yTop), t), c.yTop],
      t => { const y = lerp(c.yTop, c.yBot, t); return [xo(y), y]; },
      t => [lerp(xo(c.yBot), xi(c.yBot), t), c.yBot],
      t => { const y = lerp(c.yBot, c.yTop, t); return [xi(y), y]; },
    ];
    const out = smoothCurvedQuad(edges, [c.rcIn, c.rcOut, c.rcOut, c.rcIn], 20);
    return left ? out.map(([x, y]) => [-x, y]) : out;
  };
  // slat geometry (right side; the left side mirrors x): centre line y = stripeY(i) + k * (x - xRef)
  const STRIPE_INSET_R = 0.75;
  const stripeLine = (i, x) => stripeY(i) + G.stripes.k * (x - G.stripes.xRef);
  const circleX = (r, cy, i, off) => { let x = r; for (let n = 0; n < 6; n++) x = Math.sqrt(Math.max(0, r * r - (stripeLine(i, x) + off - cy) ** 2)); return x; };
  const stripeXin = (i, off = 0) => circleX(G.stripes.rIn + STRIPE_INSET_R, G.stripes.cyIn, i, off);
  const stripeXout = (i, off = 0) => circleX(G.stripes.rOut - STRIPE_INSET_R, G.stripes.cyOut, i, off);
  const slatPts = (i, left, grow = 0) => {
    const s = G.stripes, h = (s.th - 0.32) / 2 + grow, xa = stripeXin(i) - grow, xb = stripeXout(i) + grow;
    const pts = [[xa, stripeLine(i, xa) - h], [xb, stripeLine(i, xb) - h], [xb, stripeLine(i, xb) + h], [xa, stripeLine(i, xa) + h]];
    return left ? pts.map(([x, y]) => [-x, y]) : pts;
  };
  const stripePanelPts = left => {
    const s = G.stripes, pad = 0.80, top = s.n - 1, h = (s.th - 0.32) / 2;
    const rIn = s.rIn + STRIPE_INSET_R - pad, rOut = s.rOut - STRIPE_INSET_R + pad;
    const xi0 = stripeXin(top, -h - pad) - pad, xo0 = stripeXout(top, -h - pad) + pad;
    const xi1 = stripeXin(0, h + pad) - pad, xo1 = stripeXout(0, h + pad) + pad;
    const yT0 = stripeLine(top, xi0) - h - pad, yT1 = stripeLine(top, xo0) - h - pad;
    const yB0 = stripeLine(0, xi1) + h + pad, yB1 = stripeLine(0, xo1) + h + pad;
    const arcPt = (r, cy, y) => [Math.sqrt(Math.max(1, r * r - (y - cy) ** 2)), y];
    const edges = [
      t => [lerp(arcPt(rIn, s.cyIn, yT0)[0], arcPt(rOut, s.cyOut, yT1)[0], t), lerp(yT0, yT1, t)],
      t => arcPt(rOut, s.cyOut, lerp(yT1, yB1, t)),
      t => [lerp(arcPt(rOut, s.cyOut, yB1)[0], arcPt(rIn, s.cyIn, yB0)[0], t), lerp(yB1, yB0, t)],
      t => arcPt(rIn, s.cyIn, lerp(yB0, yT0, t)),
    ];
    const rounded = smoothCurvedQuad(edges, [2.2, 2.2, 2.2, 2.2], 20);
    return left ? rounded.map(([x, y]) => [-x, y]) : rounded;
  };

  // ---------- backdrop band and wing frames
  const BAND_TOP = cam ? CAM.bandTop : [[-215, 65], [-182, 44], [-160, 29], [-138, 15], [-117, 4], [-97, -4], [-77, -11.5], [-58, -18.8], [-36, -24.8], [0, -27], [36, -24.8], [58, -18.8], [76, -11.8], [98, -6], [122, 3], [146, 15], [168, 29], [190, 45], [220, 68]];
  const BAND_BOT = cam ? CAM.bandBot : [[220, 112], [188, 90], [166, 75], [144, 62], [122, 51], [100, 41.0], [80, 34.0], [64, 29.4], [36, 28.4], [0, 28.8], [-36, 28.4], [-64, 29.4], [-80, 34.4], [-100, 42.5], [-122, 54], [-144, 66], [-166, 79], [-186, 91], [-215, 108]];
  const bandTopPts = smoothPts(BAND_TOP, false), bandBotPts = smoothPts(BAND_BOT, false);
  const yAt = (pts, x) => { for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i]; if ((x - a[0]) * (x - b[0]) <= 0 && a[0] !== b[0]) return lerp(a[1], b[1], (x - a[0]) / (b[0] - a[0])); } return pts[x < 0 ? 0 : pts.length - 1][1]; };
  const bandX0 = bandTopPts[0][0], bandX1 = bandTopPts[bandTopPts.length - 1][0];
  function hFadeGrad(g, x0, x1, rgb, maxA, midA) {
    const gr = g.createLinearGradient(x0, 0, x1, 0);
    const m = midA ?? maxA;
    gr.addColorStop(0.00, `rgba(${rgb},0)`);
    gr.addColorStop(0.08, `rgba(${rgb},${(maxA * 0.24).toFixed(3)})`);
    gr.addColorStop(0.18, `rgba(${rgb},${(maxA * 0.78).toFixed(3)})`);
    gr.addColorStop(0.32, `rgba(${rgb},${maxA.toFixed(3)})`);
    gr.addColorStop(0.50, `rgba(${rgb},${m.toFixed(3)})`);
    gr.addColorStop(0.68, `rgba(${rgb},${maxA.toFixed(3)})`);
    gr.addColorStop(0.82, `rgba(${rgb},${(maxA * 0.78).toFixed(3)})`);
    gr.addColorStop(0.92, `rgba(${rgb},${(maxA * 0.24).toFixed(3)})`);
    gr.addColorStop(1.00, `rgba(${rgb},0)`);
    return gr;
  }
  function drawBandMask(g) {
    g.save(); g.translate(G.band.dx, G.band.dy);
    poly(g, [...bandTopPts, ...bandBotPts]);
    g.fillStyle = '#000'; g.fill();
    g.strokeStyle = '#000'; g.lineWidth = 3.2; g.stroke();
    g.restore();
  }
  // Sweeping upper aerodynamic Halo canopy crest (merges tangentially into bandTop+dy at x=+-168, fades to 0% alpha)
  const CANOPY_PTS = smoothPts(
    cam
      ? [[-168, 25.4], [-132, 9.8], [-94, -7.2], [-56, -22.5], [-26, -33.4], [0, -37.0], [26, -33.4], [56, -22.5], [94, -7.2], [132, 9.8], [168, 25.4]]
      : [[-165, 34.0], [-130, 15.5], [-92, -3.5], [-56, -21.2], [-26, -33.2], [0, -37.0], [26, -33.2], [56, -21.2], [92, -3.5], [130, 15.5], [165, 34.0]],
    false, 10
  );
  function wingsOnlyFadeGrad(g, x0, x1, rgb, peakA) {
    // Transparent at outer tips (0.00/1.00) AND completely faded out across the middle (|x| < 72, around 0.34..0.66)
    // so there is NO hard bottom line cutting across the centre under BRAKE / Battery / THROTTLE!
    const gr = g.createLinearGradient(x0, 0, x1, 0);
    gr.addColorStop(0.00, `rgba(${rgb},0)`);
    gr.addColorStop(0.08, `rgba(${rgb},${(peakA * 0.22).toFixed(3)})`);
    gr.addColorStop(0.18, `rgba(${rgb},${peakA.toFixed(3)})`);
    gr.addColorStop(0.30, `rgba(${rgb},${(peakA * 0.72).toFixed(3)})`);
    gr.addColorStop(0.37, `rgba(${rgb},0)`);
    gr.addColorStop(0.63, `rgba(${rgb},0)`);
    gr.addColorStop(0.70, `rgba(${rgb},${(peakA * 0.72).toFixed(3)})`);
    gr.addColorStop(0.82, `rgba(${rgb},${peakA.toFixed(3)})`);
    gr.addColorStop(0.92, `rgba(${rgb},${(peakA * 0.22).toFixed(3)})`);
    gr.addColorStop(1.00, `rgba(${rgb},0)`);
    return gr;
  }
  function drawBand(g) {
    // 1. Real 2026 F1TV upper sweeping glass canopy & crisp silver-white outer Halo crest over the dial & upper wings
    g.save();
    const canTop = CANOPY_PTS;
    const crestFade = (rgb, a) => {
      const gr = g.createLinearGradient(canTop[0][0], 0, canTop[canTop.length - 1][0], 0);
      gr.addColorStop(0.00, `rgba(${rgb},0)`);
      gr.addColorStop(0.16, `rgba(${rgb},${(a * 0.38).toFixed(3)})`);
      gr.addColorStop(0.36, `rgba(${rgb},${(a * 0.88).toFixed(3)})`);
      gr.addColorStop(0.50, `rgba(${rgb},${a.toFixed(3)})`);
      gr.addColorStop(0.64, `rgba(${rgb},${(a * 0.88).toFixed(3)})`);
      gr.addColorStop(0.84, `rgba(${rgb},${(a * 0.38).toFixed(3)})`);
      gr.addColorStop(1.00, `rgba(${rgb},0)`);
      return gr;
    };
    const canBot = bandTopPts.filter(([x]) => x >= canTop[0][0] - 1 && x <= canTop[canTop.length - 1][0] + 1)
                             .map(([x, y]) => [x + G.band.dx, y + G.band.dy]).reverse();
    if (canBot.length > 2) {
      poly(g, [...canTop, ...canBot], true);
      g.fillStyle = crestFade('8,18,30', 0.24);
      g.fill();
    }
    poly(g, canTop, false);
    g.strokeStyle = crestFade('150,214,255', 0.16); g.lineWidth = 2.2; g.stroke();
    g.strokeStyle = crestFade('234,244,255', 0.72); g.lineWidth = 0.65; g.stroke();
    g.restore();

    // 2. Main smoked-obsidian glass arch band (dissolves cleanly to 0% at both outer tips)
    g.save(); g.translate(G.band.dx, G.band.dy);
    poly(g, [...bandTopPts, ...bandBotPts]);
    g.fillStyle = hFadeGrad(g, bandX0, bandX1, '6,13,22', 0.46, 0.54);
    g.fill();
    // Clip delicate glass sheen & subtle wing-only bottom edge to the band silhouette
    g.save(); poly(g, [...bandTopPts, ...bandBotPts]); g.clip();
    // Soft vertical glass-depth shading (lighter specular top, soft feathered bottom)
    const sheen = g.createLinearGradient(0, -28, 0, 34);
    sheen.addColorStop(0.00, 'rgba(186,228,255,0.11)');
    sheen.addColorStop(0.28, 'rgba(130,196,244,0.03)');
    sheen.addColorStop(0.82, 'rgba(0,0,0,0)');
    sheen.addColorStop(1.00, 'rgba(0,0,0,0.08)');
    g.fillStyle = sheen; g.fillRect(bandX0 - 4, -36, bandX1 - bandX0 + 8, 90);
    // Subtle bottom edge ONLY on the wings — completely faded out in the middle (under BRAKE / Battery / THROTTLE)
    poly(g, bandBotPts, false);
    g.strokeStyle = wingsOnlyFadeGrad(g, bandX0, bandX1, '96,176,238', 0.14); g.lineWidth = 2.6; g.stroke();
    g.strokeStyle = wingsOnlyFadeGrad(g, bandX0, bandX1, '178,220,250', 0.42); g.lineWidth = 0.55; g.stroke();
    g.restore();
    // Refined silver-ice top arch hairline (fades smoothly to 0% at both wing tips)
    poly(g, bandTopPts, false);
    g.strokeStyle = hFadeGrad(g, bandX0, bandX1, '96,188,248', 0.20, 0.24); g.lineWidth = 2.4; g.stroke();
    g.strokeStyle = hFadeGrad(g, bandX0, bandX1, '216,240,255', 0.74, 0.84); g.lineWidth = 0.58; g.stroke();
    g.restore();
  }
  // Wing frame: open-ended U-curve following the band edges (inset) with clean quadratic-Bezier rounded inner corners
  // (zero gaps, zero vertical closing line at the outer ends).
  function wingPts(W, side) {
    const N = 60, yT = x => yAt(bandTopPts, x) + W.top, yB = x => yAt(bandBotPts, x) - W.bot;
    const h = yB(W.xi) - yT(W.xi), k = Math.tan(W.tilt * D) * h / 2;
    const xTop = W.xi + side * k, xBot = W.xi - side * k;
    const pT = [xTop, yT(xTop)], pB = [xBot, yB(xBot)];
    const r = W.r;
    const dxI = pB[0] - pT[0], dyI = pB[1] - pT[1], lI = Math.hypot(dxI, dyI);
    const tR = Math.min(0.4, r / lI);
    const pTi = [pT[0] + dxI * tR, pT[1] + dyI * tR];
    const pBi = [pB[0] - dxI * tR, pB[1] - dyI * tR];
    // Step along top rail stopping r units short of xTop
    const xTopStop = xTop + side * r;
    const xBotStop = xBot + side * r;
    const out = [];
    for (let i = 0; i <= N; i++) { const x = lerp(W.xFar, xTopStop, i / N); out.push([x, yT(x)]); }
    const A1 = out[out.length - 1];
    for (let s = 1; s <= 7; s++) { const t = s / 7, u = 1 - t; out.push([u * u * A1[0] + 2 * u * t * pT[0] + t * t * pTi[0], u * u * A1[1] + 2 * u * t * pT[1] + t * t * pTi[1]]); }
    out.push(pBi);
    const B2 = [xBotStop, yB(xBotStop)];
    for (let s = 1; s <= 7; s++) { const t = s / 7, u = 1 - t; out.push([u * u * pBi[0] + 2 * u * t * pB[0] + t * t * B2[0], u * u * pBi[1] + 2 * u * t * pB[1] + t * t * B2[1]]); }
    for (let i = 1; i <= N; i++) { const x = lerp(xBotStop, W.xFar, i / N); out.push([x, yB(x)]); }
    return out;
  }
  function wingFadeGrad(g, W, side, rgb, aIn) {
    const gr = g.createLinearGradient(W.xi, 0, W.xFar, 0);
    gr.addColorStop(0.00, `rgba(${rgb},${aIn.toFixed(3)})`);
    gr.addColorStop(0.55, `rgba(${rgb},${(aIn * 0.82).toFixed(3)})`);
    gr.addColorStop(0.80, `rgba(${rgb},${(aIn * 0.28).toFixed(3)})`);
    gr.addColorStop(1.00, `rgba(${rgb},0)`);
    return gr;
  }
  function drawWing(g, W, side) {
    const pts = wingPts(W, side);
    g.save(); g.translate(G.band.dx, G.band.dy);
    // Ultra-delicate smoked acrylic interior fading smoothly to 0% at outer wing tip
    poly(g, pts, true);
    g.fillStyle = wingFadeGrad(g, W, side, '8,18,32', 0.16);
    g.fill();
    // Gossamer-thin refined silver-ice inner bevel (no heavy glowing wireframe box!)
    poly(g, pts, false);
    g.strokeStyle = wingFadeGrad(g, W, side, '188,224,250', 0.36); g.lineWidth = 0.48; g.stroke();
    g.restore();
  }

  // ---------- centre cluster
  function drawStripes(g, left, value, on, onTop) {
    const s = G.stripes, pts = stripePanelPts(left);
    // Clean recessed dark-glass slat channel with ultra-subtle bevel (zero heavy wireframe box)
    poly(g, pts); g.fillStyle = P.stripePanel; g.fill();
    g.strokeStyle = 'rgba(170,214,244,0.16)'; g.lineWidth = 0.38; g.stroke();
    const lit = Math.round(value * s.n);
    for (let i = 0; i < s.n; i++) {
      const isOn = i < lit;
      drawSlat(g, left, i, isOn ? slatColour(i, on, onTop) : P.stripeOff, isOn);
    }
  }
  // slat i (0 = bottom): centre y at x = xRef
  const stripePitch = () => G.stripes.pitch;
  const stripeY = i => G.stripes.y0 - i * G.stripes.pitch;
  const slatColour = (i, on, onTop) => (i >= G.stripes.n * 0.62 ? onTop : on);
  // '#RRGGBB' at k of its brightness
  const scaleHex = (hex, k) => `rgb(${[1, 3, 5].map(j => Math.round(parseInt(hex.slice(j, j + 2), 16) * k)).join(',')})`;
  function drawSlat(g, left, i, col, lit) {
    if (lit && i > 0) {
      const a = slatPts(i - 1, left, 0.12), b = slatPts(i, left, 0.12);
      poly(g, [a[0], a[1], b[2], b[3]]); g.fillStyle = scaleHex(col, G.stripes.litGap * 0.72); g.fill();
    }
    poly(g, slatPts(i, left)); g.fillStyle = col; g.fill();
    g.strokeStyle = lit ? col : 'rgba(110,176,220,0.14)'; g.lineWidth = 0.25; g.stroke();
  }

  function drawCapsule(g, left, level, word) {
    const c = G.caps, pts = capsulePts(left), y0 = CAP_YT_IN, y1 = CAP_YB_IN;
    poly(g, pts); g.fillStyle = P.capOff; g.fill();
    const lv = Math.min(1, Math.max(0, level)), topY = lerp(y1, y0, lv);
    if (lv > 0.02) {
      g.save(); poly(g, pts); g.clip();
      const gr = g.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, P.capOnTop); gr.addColorStop(1, P.capOnBot);
      g.fillStyle = gr; g.fillRect(-80, topY, 160, y1 - topY + 1); g.restore();
    }
    const lit = lv > 0.5;
    poly(g, pts);
    if (lit) { g.strokeStyle = 'rgba(72,212,255,0.34)'; g.lineWidth = 1.9; g.stroke(); }
    g.strokeStyle = lit ? P.capOnLine : P.capOffLine; g.lineWidth = 0.52; g.stroke();
    const n = word.length, yTopMid = (CAP_YT_IN + CAP_YT_OUT) / 2 + 2.8, yBotMid = (CAP_YB_IN + CAP_YB_OUT) / 2 - 2.8;
    [...word].forEach((ch, i) => {
      const t = n === 1 ? 0.5 : i / (n - 1);
      const y = lerp(yTopMid, yBotMid, t);
      let x = (capsXin(y) + capsXout(y)) / 2;
      if (left) x = -x;
      text(g, ch, x, y, c.fs * 0.90, lv > 0.02 && y >= topY ? P.capOnText : P.capOffText, { w: 740 });
    });
  }

  // Battery parts (split so the addon can export the frame, the fill and the bolt as separate layers;
  // the fill sits 0.1 inside the glow, so drawing the frame before the fill looks the same).
  function battInterior(g, charging) { const b = G.batt; rr(g, b.x - b.w / 2, b.y - b.h / 2, b.w, b.h, b.r); g.fillStyle = charging ? P.battCharge : P.battIn; g.fill(); }
  function battFill(g, soc) {
    const b = G.batt, x = b.x - b.w / 2, y = b.y - b.h / 2;
    const gr = g.createLinearGradient(0, y, 0, y + b.h); gr.addColorStop(0, P.battFillTop); gr.addColorStop(1, P.battFillBot);
    rr(g, x + 0.9, y + 0.9, (b.w - 1.8) * Math.min(1, soc), b.h - 1.8, 0.9); g.fillStyle = gr; g.fill();
  }
  function battOutline(g) {
    const b = G.batt, x = b.x - b.w / 2, y = b.y - b.h / 2;
    rr(g, x, y, b.w, b.h, b.r); g.strokeStyle = 'rgba(98,194,242,0.22)'; g.lineWidth = 1.6; g.stroke();
    g.strokeStyle = P.battLine; g.lineWidth = 0.55; g.stroke();
    const nw = b.nubW || 1.5, nh = b.nubH || 3.4; rr(g, x + b.w + 0.3, b.y - nh / 2, nw, nh, nw / 2); g.fillStyle = P.battLine; g.fill();
  }
  function battBolt(g) {
    const b = G.batt, cx = b.bx ?? b.x, cy = b.by ?? b.y, k = b.bolt || 1;
    poly(g, [[1.1, -2.9], [-1.4, 0.4], [-0.1, 0.4], [-0.9, 2.9], [1.5, -0.4], [0.2, -0.4]].map(([x, y]) => [cx + k * x, cy + k * y]));
    g.fillStyle = P.bolt; g.fill();
  }
  function drawBattery(g, soc, charging) {
    battInterior(g, charging);
    if (soc > 0) battFill(g, soc);
    battOutline(g);
    battBolt(g); // always shown (docs/research 3.4)
  }

  // a vertical gradient over y0..y1 from a [[stop, colour], ...] list
  function vGrad(g, y0, y1, stops) { const gr = g.createLinearGradient(0, y0, 0, y1); stops.forEach(([t, c]) => gr.addColorStop(t, c)); return gr; }
  // the collar (V17): a ring from just inside the face out to G.disc.r, see-through round the dial's upper half
  // (P.discOuterTop above collarFade[0]) and dark from collarFade[1] down, a little darker below the dial's middle
  // (P.discOuter to P.discOuterBot over collarLow); nothing under the face, so its translucency shows the scene
  function drawCollar(g) {
    const d = G.disc, [ya, yb] = d.collarFade, [yc, yd] = d.collarLow, T = y => (y - ya) / (d.r - ya);
    g.beginPath(); g.arc(0, 0, d.r, 0, 2 * Math.PI); g.moveTo(d.inner - 0.2, 0); g.arc(0, 0, d.inner - 0.2, 0, 2 * Math.PI);
    g.fillStyle = vGrad(g, ya, d.r, [[0, P.discOuterTop], [T(yb), P.discOuter], [T(yc), P.discOuter], [T(yd), P.discOuterBot], [1, P.discOuterBot]]);
    g.fill('evenodd');
  }
  function drawDisc(g) {
    const d = G.disc, m = d.mesh;
    // translucent face (V18): tint stops P.face, alpha in the colours
    g.beginPath(); g.arc(0, 0, d.inner, 0, 2 * Math.PI); g.fillStyle = vGrad(g, -d.inner, d.inner, P.face); g.fill();
    // square mesh over the face (V19; was dots on a 2.2 lattice): lines m.w wide, m.pitch apart, on both axes,
    // the ink set per height (P.mesh: light on the light top, stronger lower down, so the contrast stays about even as on
    // the reference); every second line once more (P.mesh2, the reference's 2.0 harmonic). One stroke per path, so
    // crossings are not darker than the lines.
    g.save(); g.beginPath(); g.arc(0, 0, d.inner - 0.2, 0, 2 * Math.PI); g.clip();
    const n = Math.ceil(d.inner / m.pitch) + 1;
    const lines = keep => {
      g.beginPath();
      for (let k = -n; k < n; k++) {
        if (!keep(k)) continue;
        const p = (k + 0.5) * m.pitch;
        g.moveTo(p, -d.inner); g.lineTo(p, d.inner); g.moveTo(-d.inner, p); g.lineTo(d.inner, p);
      }
    };
    g.lineWidth = m.w; g.lineCap = 'butt';
    lines(() => true); g.strokeStyle = vGrad(g, -d.inner, d.inner, P.mesh); g.stroke();
    lines(k => (k & 1) === 0); g.strokeStyle = vGrad(g, -d.inner, d.inner, P.mesh2); g.stroke();
    g.restore();
    // Premium outer luminous metallic-blue halo rim + clean dark-glass recessed bezel channel (no blocky dividers)
    if (d.light) {
      g.save();
      g.beginPath(); g.arc(0, 0, d.light, 0, 2 * Math.PI);
      g.strokeStyle = vGrad(g, -d.light, d.light, [[0, 'rgba(52,168,255,0.42)'], [0.5, 'rgba(32,128,232,0.22)'], [1, 'rgba(18,74,158,0.06)']]);
      g.lineWidth = 3.2; g.stroke();
      g.strokeStyle = vGrad(g, -d.light, d.light, [[0, 'rgba(148,224,255,0.95)'], [0.45, 'rgba(72,178,255,0.78)'], [0.85, 'rgba(42,130,220,0.34)'], [1, 'rgba(28,96,178,0.12)']]);
      g.lineWidth = Math.max(d.lightW, 1.05); g.stroke();
      g.restore();
    }
    // Recessed smoked-glass track along the 260-deg RPM sweep
    g.save(); g.lineCap = 'round';
    const a0 = RB_A0 * D, a1 = (RB_A0 + RB_SPAN) * D;
    g.beginPath(); g.arc(0, 0, d.rim, a0, a1);
    g.strokeStyle = 'rgba(4,12,24,0.62)'; g.lineWidth = 3.4; g.stroke();
    g.strokeStyle = 'rgba(72,158,230,0.30)'; g.lineWidth = 1.3; g.stroke();
    g.restore();
  }
  const RB_N = 12, RB_A0 = 140, RB_SPAN = 260;
  function _strokeNeonArc(g, r, a0, a1, outerGlow, midGlow, body, core, wScale) {
    const s = wScale || 1.0;
    g.save(); g.lineCap = 'round';
    g.beginPath(); g.arc(0, 0, r, a0, a1);
    g.strokeStyle = outerGlow; g.lineWidth = 6.8 * s; g.stroke();
    g.strokeStyle = midGlow; g.lineWidth = 4.0 * s; g.stroke();
    g.strokeStyle = body; g.lineWidth = 2.45 * s; g.stroke();
    g.strokeStyle = core; g.lineWidth = 0.95 * s; g.stroke();
    g.restore();
  }
  // Mutually exclusive smooth continuous arc for level (i+1)/12:
  // Stays pure sleek luminous ice-blue while filling through the gear — ONLY turns crimson-red at ready-to-shift (rb_max)!
  function drawRpmBezelSeg(g, i) {
    const r = G.disc.rim;
    const f = (i + 1) / (RB_N + 0.5);
    const a0 = RB_A0 * D, a1 = (RB_A0 + RB_SPAN * f) * D;
    _strokeNeonArc(g, r, a0, a1, 'rgba(0,156,255,0.24)', 'rgba(42,192,255,0.44)', '#28BAFF', '#C8F2FF', 0.96);
  }
  // Full 260-deg solid glowing F1 crimson-red bezel — ONLY shown when ready to gear up (>= 92.5% limiter, no flashing)
  function drawRpmBezelMax(g) {
    const r = G.disc.rim, a0 = RB_A0 * D, a1 = (RB_A0 + RB_SPAN) * D;
    _strokeNeonArc(g, r, a0, a1, 'rgba(255,22,42,0.34)', 'rgba(255,34,54,0.60)', '#FF2236', '#FFC4CA', 1.06);
  }
  function drawBoost(g, on) {
    const B = G.boost;
    const radii = B.hatchR || [...Array(B.hatchN).keys()].map(i => B.hatch0 + i * B.hatchStep);
    for (let i = 0; i < radii.length; i++) {
      const r = radii[i], y0 = B.hy0 ?? B.y - B.hatchHalf, y1 = B.hy1 ?? B.y + B.hatchHalf;
      const aTop = Math.asin(y0 / r), aBot = Math.asin(y1 / r);
      g.strokeStyle = on ? P.hatchOn : P.hatch; g.lineWidth = 0.45;
      g.globalAlpha = on ? 1 - i * 0.1 : 0.95 - i * 0.08;
      g.beginPath(); g.arc(0, 0, r, aTop, aBot); g.stroke();
      g.beginPath(); g.arc(0, 0, r, Math.PI - aBot, Math.PI - aTop); g.stroke();
    }
    g.globalAlpha = 1;
    rr(g, -B.w / 2, B.y - B.h / 2, B.w, B.h, B.r ?? 0.5); g.fillStyle = on ? P.boostOn : P.boostFill; g.fill();
    g.strokeStyle = on ? P.boostOnLine : P.boostLine; g.lineWidth = 0.3; g.stroke();
    text(g, 'BOOST', 0, B.y, B.fs, on ? P.boostOnText : (P.boostText || P.dim), { tr: B.tr });
  }
  function drawOT(g, on) {
    const O = G.ot, ox = -O.w / 2, oy = O.y - O.h / 2;
    if (on) {
      rr(g, ox, oy, O.w, O.h, 1); g.strokeStyle = P.otOnGlow; g.lineWidth = 2.4; g.stroke();
      const og = g.createLinearGradient(0, oy, 0, oy + O.h); og.addColorStop(0, P.otOnTop); og.addColorStop(1, P.otOnBot);
      rr(g, ox, oy, O.w, O.h, 1); g.fillStyle = og; g.fill(); g.strokeStyle = P.otOnLine; g.lineWidth = 1.1; g.stroke();
      // letters glow a little, as on the broadcast
      g.save(); g.shadowColor = P.otOnGlow; g.shadowBlur = 1.6;
      text(g, 'OVERTAKE', 0, O.y, O.fs, P.otOnText, { tr: O.tr, w: 760 });
      g.restore();
    } else {
      rr(g, ox, oy, O.w, O.h, 1); g.fillStyle = P.otOff; g.fill(); g.strokeStyle = P.otOffLine; g.lineWidth = 0.5; g.stroke();
      text(g, 'OVERTAKE', 0, O.y, O.fs, P.otOffText, { tr: O.tr });
    }
  }
  // ERS deploy mode (2025 cars): caption in the Boost slot, the mode in a pill in the Overtake slot. NONE uses the
  // OVERTAKE pill's off look, MEDIUM the unlit Boost look, HOTLAP the lit Boost look, OVERTAKE the lit OVERTAKE pill.
  function drawErsCaption(g) { const c = GV.ersCap; text(g, 'ERS MODE', 0, c.y, c.fs, P.dim, { tr: c.tr }); }
  function drawErsMode(g, mode) {
    if (mode === 3) return drawOT(g, true);
    const E = GV.ersPill, ox = -E.w / 2, oy = E.y - E.h / 2;
    const look = [[P.otOff, P.otOffLine, P.otOffText, 0.5], [P.boostFill, P.boostLine, P.boostText, 0.4],
                  [P.boostOn, P.boostOnLine, P.boostOnText, 0.4]][mode];
    if (!look) return;
    rr(g, ox, oy, E.w, E.h, E.r); g.fillStyle = look[0]; g.fill(); g.strokeStyle = look[1]; g.lineWidth = look[3]; g.stroke();
    text(g, ERS_MODES[mode], 0, E.y, E.fs, look[2], { tr: E.tr, w: mode === 2 ? 760 : 700 });
  }
  const speedText = (g, kmh) => text(g, String(Math.round(kmh)), 0, G.speed.y, G.speed.fs, P.white, { tr: G.speed.tr, w: 780 });
  const mphText = (g, kmh) => text(g, String(Math.round(kmh * 0.621371)), 0, G.mph.y, G.mph.fs, P.white, { tr: G.mph.tr, w: 780 });
  function drawDial(g, st) {
    const C = carClass(st);
    drawDisc(g);
    if (gOn(st)) return drawGDial(g, st);
    // Dynamic RPM bezel ring (smooth ice-blue fill 60%..92.5%, turns solid red ONLY when ready to gear up >= 92.5%)
    if (Number.isFinite(st.rpm)) {
      if (st.rpm >= 0.925) {
        drawRpmBezelMax(g);
      } else {
        const lv = Math.round(Math.max(0, Math.min(1, (st.rpm - 0.60) / 0.325)) * RB_N);
        if (lv >= 1) drawRpmBezelSeg(g, lv - 1);
      }
    }
    text(g, 'KM/H', 0, G.kmh.y, G.kmh.fs, P.label, { tr: G.kmh.tr });
    speedText(g, st.kmh);
    if (C.pills === 'boost_ot') { drawBoost(g, st.boost); drawOT(g, st.ot); }
    else if (C.pills === 'ers_mode') { drawErsCaption(g); drawErsMode(g, ersModeIndex(st)); }
    mphText(g, st.kmh);
    text(g, 'MPH', 0, G.mphLbl.y, G.mphLbl.fs, P.label, { tr: G.mphLbl.tr });
    if (C.battery) drawBattery(g, st.soc, st.recharge > 0.3);
  }

  // ---------- G-force variant (optional, off by default): st.gmeter === true (st.mode === 'spa' is the old name).
  // The Spa 2026 world feed's centre: no speed, BOOST / OVERTAKE, battery or RECHARGE / DEPLOY; three rings, the value
  // and an indicator drawn toward the force the driver feels (a left-hand corner pushes it right, braking pushes it up).
  // State: st.gLat / st.gLong in the game's convention (g; lat + = toward the car's left, long + = speeding up), or
  // st.g (magnitude) with st.gDir (felt-force direction, degrees: 0 right, 90 down = speeding up, -90 up = braking).
  // st.gOk === false, or no g at all, = unavailable: no value and no indicator, label dimmed. st.gWide and
  // st.gRedDigits override the model's hysteresis / flash (the renderer is stateless); see docs/gmeter/design.md.
  const gOn = st => !!st && (st.gmeter === true || st.mode === 'spa');
  const gFormat = m => Math.min(9.9, Math.max(0, Math.round(m * 10) / 10)).toFixed(1);
  function gView(st) {
    const M = G.gm;
    let m = st.g, dir = st.gDir;
    if (Number.isFinite(st.gLat) && Number.isFinite(st.gLong)) { m = Math.hypot(st.gLat, st.gLong); dir = Math.atan2(st.gLong, st.gLat) / D; }
    if (st.gOk === false || !Number.isFinite(m)) return { ok: false };
    if (!Number.isFinite(dir)) dir = 0;
    const axis = ((Math.round(dir / 90) * 90) % 360 + 360) % 360;   // nearest of right / down / left / up
    const wide = st.gWide ?? m >= M.wide, S = M.arc.seg, n = Math.round(360 / S);
    // cyan arc = whole segments (segment k is centred on k * seg degrees): the two nearest dir, or three centred on it
    const k = wide ? Math.round(dir / S) - 1 : Math.floor(dir / S), count = wide ? 3 : 2;
    const segs = Array.from({ length: count }, (_, i) => (((k + i) % n) + n) % n);
    return { ok: true, g: m, dir, axis, segs, arcFrom: (k - 0.5) * S, arcTo: (k + count - 0.5) * S,
             arc: m >= M.on, wide, red: m >= M.redOn, digitsRed: st.gRedDigits ?? m >= M.digitsRed };
  }
  function drawGRings(g) { G.gm.rings.forEach(r => { g.beginPath(); g.arc(0, 0, r, 0, 7); g.strokeStyle = P.gRing; g.lineWidth = G.gm.ringW; g.stroke(); }); }
  function drawGLabel(g, dim) { const L = G.gm.lbl; text(g, 'G-FORCE', 0, L.y, L.fs, dim ? P.dim : P.label, { tr: L.tr }); }
  function drawGStatic(g) { drawGRings(g); drawGLabel(g, false); }   // the variant's fixed layer (with drawDisc)
  // the value "d.d" in fixed slots: each digit centred in the widest digit's advance, so the value does not shift
  // sideways as it changes (Saira's figures are proportional: "1" is 6.2 units wide, "8" 10.9). The game draws it
  // from one sprite per digit and place (tools/export_native.js), which needs exactly this layout.
  function gSlots(g) {
    const V = G.gm.val, prevW = WEIGHT; WEIGHT = 780; g.save();
    const a = Object.fromEntries([...'0123456789.'].map(ch => [ch, adv(g, ch, V.fs)[0]]));
    g.restore(); WEIGHT = prevW;
    const A = Math.max(...[...'0123456789'].map(ch => a[ch])), w = 2 * A + a['.'] + 2 * V.tr, x0 = -w / 2;
    return { adv: a, A, w, units: x0, dot: x0 + A + V.tr, tenths: x0 + A + V.tr + a['.'] + V.tr };
  }
  function gChar(g, ch, x, red) {
    const V = G.gm.val; text(g, ch, x * V.sx, V.y, V.fs, red ? P.gRed : P.white, { align: 'left', sx: V.sx, w: 780 });
  }
  function gText(g, m, red) {
    const L = gSlots(g), s = gFormat(m);
    gChar(g, s[0], L.units + (L.A - L.adv[s[0]]) / 2, red);
    gChar(g, '.', L.dot, red);
    gChar(g, s[2], L.tenths + (L.A - L.adv[s[2]]) / 2, red);
    return L.w * G.gm.val.sx;
  }
  function gSector(g, r0, r1, dirDeg, halfDeg, col) {
    const a0 = (dirDeg - halfDeg) * D, a1 = (dirDeg + halfDeg) * D;
    g.beginPath(); g.arc(0, 0, r1, a0, a1); g.arc(0, 0, r0, a1, a0, true); g.closePath(); g.fillStyle = col; g.fill();
  }
  // the lit segments as one sector (no seams); drawGSeg draws one segment, for a later sprite export
  function drawGArc(g, v) { const a = G.gm.arc; gSector(g, a.r0, a.r1, (v.arcFrom + v.arcTo) / 2, (v.arcTo - v.arcFrom) / 2, P.gCyan); }
  function drawGSeg(g, k) { const a = G.gm.arc; gSector(g, a.r0, a.r1, k * a.seg, a.seg / 2, P.gCyan); }
  // a bar between two rings: curved ends on the rings, straight sides parallel to the axis (Spa: the white and red
  // bars have the same height, about 15 units, although they sit at different radii)
  function drawGBlock(g, axisDeg, layer) {
    const b = G.gm[layer], a0 = Math.asin(b.halfH / b.r0), a1 = Math.asin(b.halfH / b.r1), t = axisDeg * D;
    g.beginPath(); g.arc(0, 0, b.r1, t - a1, t + a1); g.arc(0, 0, b.r0, t + a0, t - a0, true); g.closePath();
    g.fillStyle = layer === 'red' ? P.gRed : P.gWhite; g.fill();
  }
  function drawGDial(g, st) {
    drawGRings(g);
    const v = gView(st);
    if (!v.ok) return drawGLabel(g, true);
    if (v.arc) {
      drawGArc(g, v);
      drawGBlock(g, v.axis, 'white');
      if (v.red) drawGBlock(g, v.axis, 'red');
    }
    gText(g, v.g, v.digitsRed);
    drawGLabel(g, false);
  }

  // ---------- left wing: turn + name lanes
  function turnArrow(g, right) {
    // compact road-sign arrow (origin = centre of the bend): short stem rising on the right,
    // a thick 90-degree bend, and a large head pointing into the corner
    g.save(); if (right) g.scale(-1, 1);
    // road-sign arrow; its pose (G.turn.arrow) is an NCC fit to the Interlagos arrow. The reference's traced 50 % contour
    // is not used as a shape: it is invalid (it leaks into the light car body behind the panel and loses the fading stem).
    g.beginPath();
    g.moveTo(5.0, 5.0); g.lineTo(5.0, 0); g.arc(0, 0, 5.0, 0, -Math.PI / 2, true);
    g.lineTo(-1.5, -5.0); g.lineTo(-1.5, -7.6); g.lineTo(-6.1, -3.3); g.lineTo(-1.5, 1.0); g.lineTo(-1.5, -1.6);
    g.lineTo(0, -1.6); g.arc(0, 0, 1.6, -Math.PI / 2, 0, false); g.lineTo(1.6, 5.0); g.closePath();
    const sh = g.createLinearGradient(-6, -7, 5, 5); sh.addColorStop(0, '#F4F8FA'); sh.addColorStop(1, '#AFC0CA');
    g.fillStyle = sh; g.fill(); g.restore();
  }
  // right turns: the left arrow reflected across the band's normal at the arrow (band direction = TURN label angle),
  // so both arrows sit the same way in the band
  function drawTurnArrow(g, right) {
    const a = G.turn.arrow; g.save(); g.translate(a.x, a.y);
    if (right) { const p = 2 * (G.turn.lbl.rot + 90) * D; g.transform(Math.cos(p), Math.sin(p), Math.sin(p), -Math.cos(p), 0, 0); }
    frame(g, a.rot, a.lean); g.scale(a.s, a.s); turnArrow(g, false); g.restore();
  }
  function drawTurnNumber(g, s) { const n = G.turn.num; text(g, String(s), n.x, n.y, n.fs, P.white, { tr: n.tr, rot: n.rot, lean: n.lean, w: 760 }); }
  function drawTurnLabel(g) { const l = G.turn.lbl; text(g, 'TURN', l.x, l.y, l.fs, P.label, { tr: l.tr, rot: l.rot, lean: l.lean }); }
  function drawTurn(g, st) {
    if (st.turn) { drawTurnArrow(g, st.turnDir === 'R'); drawTurnNumber(g, st.turn); drawTurnLabel(g); }
  }

  function lanePoint(n, u, v) {
    const a = n.rot * D, ux = Math.cos(a), uy = Math.sin(a), vx = -uy, vy = ux;
    const vv = v + (u < 0 ? n.bend * u * u : 0);
    return [n.x + ux * u + vx * vv, n.y + uy * u + vy * vv];
  }
  function laneAngle(n, u, v = 0) { const p = lanePoint(n, u - 0.5, v), q = lanePoint(n, u + 0.5, v); return Math.atan2(q[1] - p[1], q[0] - p[0]); }
  // text along the bent lane: right-aligned to end at uEnd, or (startAt) left-aligned from it
  function laneText(g, n, s, uEnd, v, px, color, wt, startAt = false) {
    const prev = WEIGHT; WEIGHT = wt; const a = adv(g, s, px); let u = startAt ? uEnd : uEnd - (sum(a) + n.tr * (a.length - 1));
    [...s].forEach((ch, i) => {
      const uc = u + a[i] / 2, [x, y] = lanePoint(n, uc, v), ang = laneAngle(n, uc, v);
      const l = n.leanRel !== undefined ? ang + n.leanRel * D : n.lean * D;   // italic: a fixed lean from the lane normal
      g.save(); g.translate(x, y); g.transform(Math.cos(ang), Math.sin(ang), -Math.sin(l), Math.cos(l), 0, 0);
      font(g, px); g.fillStyle = color; g.textBaseline = 'alphabetic'; g.fillText(ch, -a[i] / 2, CAP * px / 2); g.restore();
      u += a[i] + n.tr;
    });
    WEIGHT = prev;
  }
  function laneLine(g, n, v, u0, u1, color, w) {
    g.beginPath(); for (let i = 0; i <= 24; i++) { const p = lanePoint(n, lerp(u0, u1, i / 24), v); i ? g.lineTo(...p) : g.moveTo(...p); }
    g.strokeStyle = color; g.lineWidth = w; g.lineCap = 'round'; g.stroke();
  }
  function drawRails(g, colour) {
    // Sleek refined driver card rail (slim stroke + subtle glow; tinted by team colour in game)
    const n = G.names;
    g.beginPath();
    for (let i = 0; i <= 30; i++) { const p = lanePoint(n, lerp(n.railA0 ?? 0, n.cardEnd, i / 30), n.lineA); i ? g.lineTo(...p) : g.moveTo(...p); }
    for (let i = 0; i <= 30; i++) g.lineTo(...lanePoint(n, lerp(n.cardEnd, n.railB0 ?? 4, i / 30), n.lineB));
    g.save(); g.globalAlpha = 0.25; g.strokeStyle = colour; g.lineWidth = n.lineW * 1.4; g.lineCap = 'round'; g.lineJoin = 'round'; g.stroke(); g.restore();
    g.strokeStyle = colour; g.lineWidth = n.lineW * 0.65; g.lineCap = 'round'; g.lineJoin = 'round'; g.stroke();
  }
  function drawNames(g, st) {
    const n = G.names, team = st.team || '#27F4D2';
    drawRails(g, team);
    // car one place ahead above, this car below: "<position> <SURNAME>" (session classification)
    const line = (pos, name, shift, v, fs, col, wt) => {
      if (pos) laneText(g, n, String(pos), n.numEnd + shift, v, fs, col, wt);
      laneText(g, n, name, n.numEnd + shift + n.numGap, v, fs, col, wt, true);
    };
    if (st.rival) line(st.rivalPos, st.rival, n.rivShift, -n.laneGap, n.rivFs, '#E3EAEE', 740);
    line(st.pos ?? st.number, st.driver, 0, n.drvV || 0, n.drvFs, P.white, 760);
  }

  // ---------- right wing: active aero + gears
  function drawAeroLabel(g, col) {
    const a = G.aero;
    text(g, 'ACTIVE', a.x1, a.y1, a.fs, col, { tr: a.tr, rot: a.rot, lean: a.lean, w: 760 });
    text(g, 'AERO', a.x2, a.y2, a.fs, col, { tr: a.tr, rot: a.rot, lean: a.lean, w: 760 });
  }
  // one bar of the active-aero symbol: s = +1 / -1 picks the bar; straight: its "=" pose, else its "//" pose. The +1
  // slash and the +1 flat bar are the same bar in the two modes (the game turns one into the other)
  function drawAeroBar(g, straight, s, col) {
    const a = G.aero;
    g.fillStyle = col;
    const bar = (cx, cy, len, ang, th = a.barTh) => { g.save(); g.translate(cx, cy); g.rotate(ang * D); rr(g, -len / 2, -th / 2, len, th, th / 2); g.fill(); g.restore(); };
    if (straight) bar(a.barX + s * a.barDx / 2, a.barY + s * a.barDy / 2, a.barLen, a.barAng);   // "=" (sheared with the wing): two flat bars, the lower one set back toward the centre
    else bar(a.barX + s * a.slHx, a.barY + s * a.slHy, a.slLen, a.slAng, a.slTh);                 // "//": two steep slashes
  }
  function drawAeroBars(g, straight, col) {
    if (straight) { drawAeroBar(g, true, 1, col); drawAeroBar(g, true, -1, col); }
    else { drawAeroBar(g, false, -1, col); drawAeroBar(g, false, 1, col); }
  }
  function drawAero(g, st) {
    // white in both modes on the broadcast (docs/research 3.9); aeroTint only reproduces the fan-made screenshot
    const straight = st.aero, tint = straight && st.aeroTint && st.theme === 'screenshot';
    drawAeroLabel(g, tint ? P.aeroOn : P.white);
    drawAeroBars(g, straight, tint ? P.aeroOn : P.aeroBar);
  }
  // DRS pill (2025 and F2 cars), in the active-aero spot. look: 'off' (grey: unavailable), 'avail' (white outline:
  // available), 'open' (green: open); see drsLook for the game's states.
  function drawDRS(g, look) {
    const d = GV.drs;
    g.save(); g.translate(d.x, d.y); frame(g, d.rot, d.lean);
    const path = () => rr(g, -d.w / 2, -d.h / 2, d.w, d.h, d.r);
    let txt;
    if (look === 'open') {
      path(); g.strokeStyle = PV.drsOpenGlow; g.lineWidth = 2.4; g.stroke();
      path(); g.fillStyle = PV.drsOpen; g.fill(); g.strokeStyle = PV.drsOpenLine; g.lineWidth = d.line; g.stroke();
      txt = PV.drsOpenText;
    } else if (look === 'avail') {
      path(); g.fillStyle = PV.drsAvailFill; g.fill(); g.strokeStyle = PV.drsAvailLine; g.lineWidth = d.line; g.stroke();
      txt = PV.drsAvailText;
    } else {
      path(); g.fillStyle = PV.drsOff; g.fill(); g.strokeStyle = PV.drsOffLine; g.lineWidth = 0.5; g.stroke();
      txt = PV.drsOffText;
    }
    text(g, 'DRS', 0, 0, d.fs, txt, { tr: d.tr, w: 760 });
    g.restore();
  }

  // Gear strip: a quadratic bezier (digits on it) and the RPM track offset from it by `track`
  const RPM_T0 = -0.035, RPM_T1 = 1.03;
  function gearPt(t, off) { const q = G.gears, p = bez(q.p0, q.p1, q.p2, t), [tx, ty] = bezTan(q.p0, q.p1, q.p2, t); return [p[0] - ty * off, p[1] + tx * off]; }
  function rpmPath(g, a, b) { g.beginPath(); for (let i = 0; i <= 40; i++) { const p = gearPt(lerp(a, b, i / 40), G.gears.track); i ? g.lineTo(...p) : g.moveTo(...p); } }
  function drawGearTrack(g) { rpmPath(g, RPM_T0, RPM_T1); g.strokeStyle = P.track; g.lineWidth = 0.5; g.lineCap = 'round'; g.stroke(); }
  function drawRpmBar(g, rpm, team) {
    const q = G.gears, tf = lerp(RPM_T0, RPM_T1, Math.max(0, Math.min(1, rpm)));
    rpmPath(g, RPM_T0, tf); g.lineCap = 'round';
    g.strokeStyle = team; g.globalAlpha = 0.22; g.lineWidth = q.trackW * 2.3; g.stroke(); g.globalAlpha = 1; g.lineWidth = q.trackW; g.stroke();
    g.strokeStyle = 'rgba(225,255,250,0.55)'; g.lineWidth = q.trackW * 0.35; g.stroke();
  }
  function drawGearMarker(g) { const q = G.gears; if (!(q.mr > 0)) return; g.beginPath(); g.arc(q.mx, q.my, q.mr, 0, 7); g.strokeStyle = 'rgba(140,160,172,0.75)'; g.lineWidth = 0.4; g.stroke(); }
  function drawGearDigit(g, i, on) {
    const q = G.gears, t = i / 8, [x, y] = gearPt(t, 0), [tx, ty] = bezTan(q.p0, q.p1, q.p2, t);
    const rotDeg = Math.atan2(ty, tx) / D;
    if (on) {
      // Sleek luminous frosted-white broadcast active gear highlight (harmonizes with every F1 team color)
      const pw = q.fsOn * 0.88, ph = q.fsOn * 0.94;
      g.save(); g.translate(x, y); frame(g, rotDeg, q.lean);
      rr(g, -pw / 2 - 0.35, -ph / 2 - 0.35, pw + 0.7, ph + 0.7, 1.25);
      g.fillStyle = P.gearOnGlow; g.fill();
      const gg = g.createLinearGradient(0, -ph / 2, 0, ph / 2);
      gg.addColorStop(0, '#FFFFFF'); gg.addColorStop(1, '#CFE6FA');
      rr(g, -pw / 2 + 0.2, -ph / 2 + 0.2, pw - 0.4, ph - 0.4, 0.85);
      g.fillStyle = gg; g.fill();
      g.restore();
      text(g, 'N12345678'[i], x, y, q.fsOn * 0.92, P.gearOnText, { rot: rotDeg, lean: q.lean, w: 800 });
    } else {
      text(g, 'N12345678'[i], x, y, q.fs, P.gearDim, { rot: rotDeg, lean: q.lean, w: q.w ?? 700 });
    }
  }
  // Suggested gear (0.2.3): the game's gear suggestion on the strip. The suggested digit i in the hint colour at the
  // lit digit's size and weight with a soft glow, and a small triangle on the side away from the RPM line, its tip
  // toward the digit. Green when the suggestion is above the current gear (up), amber when below.
  const SG_UP = '#4BE37A', SG_DOWN = '#FFB42E', SG_GLOW = 10 / 6, SG_OFF = -5.3;
  function drawGearSuggest(g, i, up) {
    const q = G.gears, t = i / 8, col = up ? SG_UP : SG_DOWN, [x, y] = gearPt(t, 0), [tx, ty] = bezTan(q.p0, q.p1, q.p2, t), a = Math.atan2(ty, tx);
    const m = g.getTransform(), k = Math.hypot(m.a, m.b);   // a canvas shadow's blur is in device pixels: SG_GLOW HUD units at any scale
    g.save(); g.shadowColor = col; g.shadowBlur = SG_GLOW * k;
    text(g, 'N12345678'[i], x, y, q.fsOn, col, { rot: a / D, lean: q.lean, w: q.wOn ?? 780 });
    g.restore();
    const [mx, my] = gearPt(t, SG_OFF);
    g.save(); g.translate(mx, my); g.rotate(a);
    g.beginPath(); g.moveTo(-1.4, -1.0); g.lineTo(1.4, -1.0); g.lineTo(0, 1.0); g.closePath(); g.fillStyle = col; g.fill();
    g.restore();
  }
  function drawGearLabels(g) {
    const q = G.gears;
    text(g, 'GEARS', q.gx, q.gy, q.lfs, P.gearLbl, { rot: q.grot, lean: q.llean, tr: 0.3 });
    text(g, 'RPM x1000', q.rx, q.ry, q.lfs, P.gearLbl, { rot: q.rrot, lean: q.llean, tr: 0.25 });
    // scale ends: "0" before the bar's start, "15" past its end (x1000 rpm)
    [[q.r0t, '0'], [q.r15t, '15']].forEach(([t, s]) => {
      const [x, y] = gearPt(t, q.track + q.rEndOff), [tx, ty] = bezTan(q.p0, q.p1, q.p2, Math.min(1, Math.max(0, t)));
      text(g, s, x, y, q.rEndFs, P.gearLbl, { rot: Math.atan2(ty, tx) / D, lean: q.lean, tr: 0.2 });
    });
  }
  function drawGears(g, st) {
    drawGearTrack(g);
    drawRpmBar(g, st.rpm, st.team || '#27F4D2');
    drawGearMarker(g);
    for (let i = 0; i < 9; i++) drawGearDigit(g, i, String(st.gear) === 'N12345678'[i] || (i === 0 && st.gear === 0));
    // st.sug: the suggested gear's place on the strip (0 = N, 1..8), when it differs from the current gear
    const cur = st.gear === 0 ? 0 : 'N12345678'.indexOf(String(st.gear));
    if (cur >= 0 && st.sug != null && st.sug >= 0 && st.sug <= 8 && st.sug !== cur) drawGearSuggest(g, st.sug, st.sug > cur);
    drawGearLabels(g);
  }

  // ---------- centre cluster (capsules, stripes, labels, dial), scaled about the dial centre
  function drawCentreLabels(g) {
    const B = G.brakeLbl, T = G.throttleLbl;
    const m = g.getTransform(), k = Math.hypot(m.a, m.b);
    g.save();
    g.shadowColor = 'rgba(2,8,16,0.95)'; g.shadowBlur = 2.4 * k; g.shadowOffsetY = 0.35 * k;
    text(g, 'BRAKE', B.x, B.y, G.lblFs, '#F4F8FC', { rot: B.rot, lean: B.lean, tr: B.tr ?? 0.35, w: 760 });
    text(g, 'THROTTLE', T.x, T.y, G.lblFs, '#F4F8FC', { rot: T.rot, lean: T.lean, tr: T.tr ?? 0.35, w: 760 });
    g.restore();
  }
  // design plane -> HUD units: centreScale, and for theme 'screenshot' the Interlagos camera's affine view
  function centreFrame(g, st) {
    const M = (st && st.theme === 'screenshot' && G.perspShot) || [1, 0, 0, 1], k = G.centreScale;
    g.transform(M[0] * k, M[1] * k, M[2] * k, M[3] * k, 0, 0);
  }
  function drawCentre(g, st) {
    g.save(); centreFrame(g, st);
    drawCollar(g);   // the collar around the dial (see-through above its waist)
    if (!gOn(st) && carClass(st).capsules) { drawCapsule(g, true, st.recharge, 'RECHARGE'); drawCapsule(g, false, st.deploy, 'DEPLOY'); }   // G variant, F2: no capsules
    drawStripes(g, true, st.brake, P.brake, P.brakeTop);
    drawStripes(g, false, st.throttle, P.throttle, P.throttleTop);
    drawCentreLabels(g);
    drawDial(g, st);
    g.restore();
  }

  // ---------- full HUD
  function draw(g, st) {
    g.save(); g.lineJoin = 'round';
    drawBand(g);
    drawWing(g, G.wings.L, -1); drawWing(g, G.wings.R, 1);
    drawNames(g, st);
    drawTurn(g, st);
    drawCentre(g, st);
    if (carClass(st).drs) drawDRS(g, drsLook(st)); else drawAero(g, st);
    drawGears(g, st);
    g.restore();
  }

  // Static / moving pieces for the addon's texture export (export.html).
  const internals = {
    D, FONT, CAP, text, frame, rr, poly, lerp, bez, bezTan, lanePoint, laneAngle, laneText, capsulePts, origCapsuleMask, stripePanelPts,
    capsXin, capsXout, stripeXin, stripeXout, stripeLine, slatPts, slatColour, stripeY, stripePitch, drawSlat, centreFrame, drawCentreLabels, drawBand, drawBandMask, drawWing, drawStripes, drawCapsule, drawCollar, drawDisc, drawRpmBezelSeg, drawRpmBezelMax, drawBoost, drawOT, speedText,
    mphText, battInterior, battFill, battOutline, battBolt, drawGStatic, gText, gSlots, gChar, gOn, gView, gFormat, drawGRings, drawGLabel,
    drawGArc, drawGSeg, drawGBlock, gSector, turnArrow, drawTurnArrow, drawTurnNumber,
    drawTurnLabel, drawRails, drawAeroLabel, drawAeroBars, drawAeroBar, bandTopPts, gearPt, drawGearTrack, drawRpmBar, drawGearMarker,
    drawGearDigit, drawGearSuggest, drawGearLabels, RPM_T0, RPM_T1,
    // car classes (the 2025 and F2 variants)
    CLASSES, carClass, drsLook, ersModeIndex, ERS_MODES, drawDRS, drawErsCaption, drawErsMode,
  };
  return { LAYOUT: cam ? 'cam' : 'tv', draw, G, P, GV, PV, CLASSES, internals, parts: { drawCentre, drawNames, drawTurn, drawAero, drawDRS, drawGears, drawDial, drawBand, drawWing } };
};
// window.HALO_LAYOUT = 'cam' before this file loads picks the symmetric layout; HALO_MAKE('cam') makes a second one
const HALO = HALO_MAKE(typeof window !== 'undefined' && window.HALO_LAYOUT);
