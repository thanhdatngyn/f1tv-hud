"""Restyle existing Project Halo ERP archives with the polished F1TV dark-glass visuals & motorsport fonts.

No external SWOFTY_TOOLS needed: reads existing ERP archives, re-renders every sprite from tools/halo.js and
tools/tower/tower.js using headless Edge/Chrome, matches each texture's exact (W, H), encodes to BC7 via bc7.py,
and writes updated ERP archives cleanly.

Usage:
  python tools/restyle_erps.py --preview <out_dir>
  python tools/restyle_erps.py --apply <erp_dir> [--work <work_dir>]
"""
import argparse
import base64
import concurrent.futures
import functools
import hashlib
import http.server
import json
import os
import re
import shutil
import socketserver
import struct
import subprocess
import sys
import threading
import uuid

import numpy as np
from PIL import Image

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NATIVE = os.path.join(REPO, "tools", "native")
TOWER_NATIVE = os.path.join(REPO, "tools", "tower_native")
sys.path.insert(0, NATIVE)
sys.path.insert(0, TOWER_NATIVE)

import bc7  # noqa: E402
import emb  # noqa: E402
import erpbuild  # noqa: E402
import erpmeta  # noqa: E402
import tower_resources as TR  # noqa: E402

FMT_BC7_SRGB = 70
K_SCENE = 0.018  # scene units per HUD unit (matches tools/native/halo_native.py)
VM_PREFIX = "#view_model_data.hud_halo_"
RPM_BEZEL_KEYS = [(f"rb{i:02d}", f"rb_{i:02d}", 25) for i in range(1, 13)] + [("rbmax", "rb_max", 26)]


def find_browser():
    for p in [
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    ]:
        if os.path.exists(p):
            return p
    raise FileNotFoundError("Neither msedge.exe nor chrome.exe found")


def start_server(root_dir):
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=root_dir)

    class QuietHandler(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *a, **kw):
            super().__init__(*a, directory=root_dir, **kw)

        def log_message(self, *a):
            pass

    httpd = socketserver.TCPServer(("127.0.0.1", 0), QuietHandler)
    port = httpd.server_address[1]
    t = threading.Thread(target=httpd.serve_forever, daemon=True)
    t.start()
    return httpd, port


def dump_json(browser, url, timeout=45):
    cmd = [
        browser,
        "--headless=new",
        "--disable-gpu",
        "--no-sandbox",
        "--run-all-compositor-stages-before-draw",
        "--virtual-time-budget=8000",
        "--dump-dom",
        url,
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout, encoding="utf-8", errors="replace")
    m = re.search(r"<pre[^>]*id=\"out\"[^>]*>(.*?)</pre>", proc.stdout, re.S)
    if not m:
        raise RuntimeError(f"No #out in DOM for {url}: rc={proc.returncode} stdout={proc.stdout[:400]} stderr={proc.stderr[:400]}")
    txt = m.group(1)
    if txt.startswith("ERROR "):
        raise RuntimeError(f"JS error for {url}: {txt}")
    return json.loads(txt)


def decode_sprite(sp):
    raw = base64.b64decode(sp["rgba"])
    return np.frombuffer(raw, dtype=np.uint8).reshape(sp["h"], sp["w"], 4).copy()


def place_in_hud_rect(sp, qx0, qy0, qx1, qy1, target_w, target_h):
    """Composite sprite `sp` (with HUD bounds x0,y0,x1,y1) at its EXACT HUD coordinates inside target quad rect."""
    img = sp["img"]
    sx0, sy0, sx1, sy1 = sp["x0"], sp["y0"], sp["x1"], sp["y1"]
    px_per_u_x = target_w / (qx1 - qx0)
    px_per_u_y = target_h / (qy1 - qy0)
    dst_w = max(1, int(round((sx1 - sx0) * px_per_u_x)))
    dst_h = max(1, int(round((sy1 - sy0) * px_per_u_y)))
    dx = int(round((sx0 - qx0) * px_per_u_x))
    dy = int(round((sy0 - qy0) * px_per_u_y))
    pil = Image.fromarray(img, "RGBA")
    if pil.size != (dst_w, dst_h):
        pil = pil.resize((dst_w, dst_h), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (target_w, target_h), (0, 0, 0, 0))
    canvas.paste(pil, (dx, dy))
    return np.array(canvas, dtype=np.uint8)


def fit_to_size(img, target_w, target_h, mode="center"):
    """Fit RGBA numpy array cleanly into exact (target_h, target_w, 4) without distorting aspect ratio."""
    h, w = img.shape[:2]
    if w == target_w and h == target_h:
        return img
    pil = Image.fromarray(img, "RGBA")
    if mode == "stretch":
        return np.array(pil.resize((target_w, target_h), Image.Resampling.LANCZOS), dtype=np.uint8)
    # Center-fit: scale down only if larger than target, otherwise place centered on transparent canvas
    if w > target_w or h > target_h:
        scale = min(target_w / w, target_h / h)
        nw = max(1, int(round(w * scale)))
        nh = max(1, int(round(h * scale)))
        pil = pil.resize((nw, nh), Image.Resampling.LANCZOS)
        w, h = nw, nh
    canvas = Image.new("RGBA", (target_w, target_h), (0, 0, 0, 0))
    canvas.paste(pil, ((target_w - w) // 2, (target_h - h) // 2))
    return np.array(canvas, dtype=np.uint8)


def encode_surface(img, cache_dir):
    h, w = img.shape[:2]
    assert h % 4 == 0 and w % 4 == 0, (w, h)
    os.makedirs(cache_dir, exist_ok=True)
    import hashlib

    key = hashlib.sha1(img.tobytes() + struct.pack("<2I", w, h)).hexdigest()[:20]
    cached = os.path.join(cache_dir, key + ".bc7")
    if os.path.exists(cached):
        pix = open(cached, "rb").read()
    else:
        pix = bc7.encode(img)
        with open(cached, "wb") as f:
            f.write(pix)
    assert len(pix) == w * h
    hdr = struct.pack("<10I", 2, 0x108, FMT_BC7_SRGB, w, h, 1, 1, 1, 0, 0)
    return [hdr, pix]


def render_preview(browser, port, out_dir):
    """Render composite previews of the polished Halo and Timing Tower for visual QA."""
    os.makedirs(out_dir, exist_ok=True)
    # Create a temporary preview HTML in tools/ so relative font/script paths resolve cleanly
    preview_html = os.path.join(REPO, "tools", "_preview_restyle.html")
    html = """<!doctype html>
<html><head><meta charset="utf-8"><style>
@font-face { font-family: HaloSaira; src: url(fonts/Oxanium.ttf) format('truetype'); font-weight: 200 800; }
@font-face { font-family: TowerSaira; src: url(fonts/Exo2.ttf) format('truetype'); font-weight: 100 900; font-style: normal; }
@font-face { font-family: TowerSaira; src: url(fonts/Exo2-Italic.ttf) format('truetype'); font-weight: 100 900; font-style: italic; }
@font-face { font-family: TowerFlag; src: url(fonts/Exo2-Italic.ttf) format('truetype'); font-weight: 100 900; font-style: italic; }
</style></head><body><pre id="out">running</pre>
<script>window.HALO_LAYOUT = 'cam';</script>
<script src="halo.js"></script>
<script src="tower/tower.js"></script>
<script>
(async () => {
  const out = document.getElementById('out');
  try {
    await Promise.all([
      document.fonts.load('700 32px HaloSaira', 'BOOSTOVERTAKEGEARS0123456789N'),
      document.fonts.load('800 32px HaloSaira', 'BOOSTOVERTAKEGEARS0123456789N'),
      document.fonts.load('700 32px TowerSaira', 'NORVERHAMLECSMHWI'),
      document.fonts.load('italic 700 32px TowerSaira', 'SMHIWP'),
      document.fonts.load('italic 800 32px TowerFlag', 'YELLOWSAFETYCARVIRTUALREDFLAG'),
    ]);
    // 1. Halo preview (1400x760: two states on sunlit tarmac/kerb backdrop to inspect smoked-glass transparency + RPM bezel)
    const ch = document.createElement('canvas'); ch.width = 1400; ch.height = 760;
    const gh = ch.getContext('2d');
    const bg = gh.createLinearGradient(0, 0, 0, 760);
    bg.addColorStop(0, '#7e8f9e'); bg.addColorStop(0.45, '#59636e'); bg.addColorStop(1, '#394049');
    gh.fillStyle = bg; gh.fillRect(0, 0, 1400, 760);
    // Painted red/white kerb + track stripes to clearly show glass translucency
    for (let i = 0; i < 14; i++) {
      gh.fillStyle = i % 2 === 0 ? 'rgba(220,25,25,0.65)' : 'rgba(240,242,245,0.65)';
      gh.fillRect(i * 110 - 20, 120, 95, 22);
      gh.fillRect(i * 110 - 20, 500, 95, 22);
    }
    gh.fillStyle = 'rgba(255,255,255,0.28)';
    gh.fillRect(0, 210, 1400, 8);
    gh.fillRect(0, 590, 1400, 8);
    // Top: ~85% limiter RPM (high revs still filling cleanly in luminous ice-blue — NOT red yet!)
    gh.save(); gh.translate(700, 165); gh.scale(2.75, 2.75);
    HALO.draw(gh, {
      kmh: 248, gear: 6, rpm: 0.85, throttle: 0.92, brake: 0.0,
      soc: 0.74, recharge: 0.0, deploy: 0.85, boost: true, ot: true, aero: true,
      pos: 1, driver: 'NORRIS', rivalPos: 2, rival: 'VERSTAPPEN', team: '#FF8000',
      turn: 14, turnDir: 'R', theme: 'authentic'
    });
    gh.restore();
    // Bottom: 94% limiter RPM (ready to gear up -> full solid glowing F1 crimson-red bezel)
    gh.save(); gh.translate(700, 545); gh.scale(2.75, 2.75);
    HALO.draw(gh, {
      kmh: 312, gear: 7, rpm: 0.94, throttle: 1.0, brake: 0.0,
      soc: 0.42, recharge: 0.0, deploy: 1.0, boost: true, ot: false, aero: true,
      pos: 1, driver: 'NORRIS', rivalPos: 2, rival: 'VERSTAPPEN', team: '#FF8000',
      turn: 14, turnDir: 'R', theme: 'authentic'
    });
    gh.restore();
    // 2. Tower preview (3 towers side by side on sunlit track backdrop)
    const ct = document.createElement('canvas'); ct.width = 1150; ct.height = 720;
    const gt = ct.getContext('2d');
    const tbg = gt.createLinearGradient(0, 0, 0, 720);
    tbg.addColorStop(0, '#90a4b8'); tbg.addColorStop(0.5, '#606b75'); tbg.addColorStop(1, '#444b52');
    gt.fillStyle = tbg; gt.fillRect(0, 0, 1150, 720);
    for (let y = 60; y < 700; y += 90) {
      gt.fillStyle = 'rgba(255,255,255,0.22)'; gt.fillRect(0, y, 1150, 18);
    }
    const rows = [
      { pos: 1, code: 'NOR', team: 'MCL', col: '#FF8000', gap: 'Interval', tyre: 'S', me: true },
      { pos: 2, code: 'VER', team: 'RBR', col: '#3671C6', gap: '+0.412', tyre: 'M', arrow: 'up' },
      { pos: 3, code: 'LEC', team: 'FER', col: '#E80020', gap: '+1.108', tyre: 'S', arrow: 'down' },
      { pos: 4, code: 'RUS', team: 'MER', col: '#27F4D2', gap: '+2.345', tyre: 'H' },
      { pos: 5, code: 'PIA', team: 'MCL', col: '#FF8000', gap: '+3.012', tyre: 'M', pit: true },
      { pos: 6, code: 'HAM', team: 'FER', col: '#E80020', gap: '+4.551', tyre: 'I', pen: 'pen' },
      { pos: 7, code: 'ANT', team: 'MER', col: '#27F4D2', gap: '+5.820', tyre: 'W' },
      { pos: 8, code: 'ALO', team: 'AST', col: '#229971', gap: '+6.190', tyre: 'H' },
    ];
    const states = [
      { session: 'race', header: { lap: 14, laps: 58 }, status: null, rows, window: { mode: 'top', n: 8, player: 1 } },
      { session: 'race', header: { lap: 14, laps: 58 }, status: 'yellow', statusText: 'SECTOR 2', rows, window: { mode: 'top', n: 8, player: 1 } },
      { session: 'race', header: { lap: 14, laps: 58 }, status: 'sc', rows, window: { mode: 'top', n: 8, player: 1 } },
    ];
    states.forEach((st, idx) => {
      gt.save(); gt.translate(30 + idx * 370, 20); gt.scale(3.6, 3.6);
      TOWER.draw(gt, st, { bar: true, slots: true, highlight: true });
      gt.restore();
    });
    out.textContent = JSON.stringify({
      halo: ch.toDataURL('image/png').split(',')[1],
      tower: ct.toDataURL('image/png').split(',')[1],
    });
    document.title = 'done';
  } catch (e) { out.textContent = 'ERROR ' + e.stack; document.title = 'error'; }
})();
</script></body></html>
"""
    with open(preview_html, "w", encoding="utf-8") as f:
        f.write(html)
    try:
        res = dump_json(browser, f"http://127.0.0.1:{port}/_preview_restyle.html")
        hp = os.path.join(out_dir, "preview_halo.png")
        tp = os.path.join(out_dir, "preview_tower.png")
        with open(hp, "wb") as f:
            f.write(base64.b64decode(res["halo"]))
        with open(tp, "wb") as f:
            f.write(base64.b64decode(res["tower"]))
        # Also render contact sheet of actual exported tower sprites (hdr, yel, sc, vsc, red, chq, pit, pen, fl, tyres)
        G, P, tsprites = render_tower_sprites(browser, port)
        sheet = Image.new("RGBA", (820, 620), (22, 28, 38, 255))
        def paste_sp(name, x, y, img=None):
            arr = img if img is not None else tsprites[name]
            sheet.alpha_composite(Image.fromarray(arr, "RGBA"), (x, y))
        paste_sp("hdr", 20, 20)
        paste_sp("yel", 20, 215)
        paste_sp("red", 20, 335)
        paste_sp("chq", 20, 455)
        paste_sp("sc", 390, 20)
        paste_sp("vsc", 390, 140)
        # Badges row
        paste_sp("pit", 390, 295)
        paste_sp("pen", 435, 295)
        paste_sp("fl", 480, 295, make_fastest_lap_polished(28, 36))
        for idx, ty in enumerate(["ty_S", "ty_M", "ty_H", "ty_I", "ty_W"]):
            paste_sp(ty, 530 + idx * 42, 300)
        paste_sp("up", 390, 355)
        paste_sp("dn", 435, 355)
        paste_sp("bn_l", 390, 405)
        paste_sp("bn_m", 558, 405)
        paste_sp("bn_r", 562, 405)
        sp_path = os.path.join(out_dir, "preview_tower_sprites.png")
        sheet.save(sp_path)
        print("Wrote previews:", hp, tp, sp_path)
    finally:
        if os.path.exists(preview_html):
            os.remove(preview_html)


def render_halo_sprites(browser, port, layout, wanted_names):
    """Render requested halo sprites via export_native.html, returning {name: {img, x0, y0, x1, y1, w, h}}."""
    layout_q = "&layout=cam" if layout == "cam" else ""
    out = {}
    # Batch 8 sprites per browser run (fast, well below any memory ceiling)
    chunks = [wanted_names[i : i + 8] for i in range(0, len(wanted_names), 8)]

    def run_chunk(chunk):
        url = f"http://127.0.0.1:{port}/export_native.html?r=6{layout_q}&only={','.join(chunk)}"
        data = dump_json(browser, url, timeout=60)
        res = {}
        for sp in data["sprites"]:
            res[sp["name"]] = {
                "img": decode_sprite(sp),
                "x0": sp["x0"],
                "y0": sp["y0"],
                "x1": sp["x1"],
                "y1": sp["y1"],
                "w": sp["w"],
                "h": sp["h"],
            }
        return res

    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as ex:
        for res in ex.map(run_chunk, chunks):
            out.update(res)
    return out


def render_tower_sprites(browser, port):
    """Render all tower sprites via export_tower.html."""
    meta = dump_json(browser, f"http://127.0.0.1:{port}/tower_native/export_tower.html?r=4&list=1")
    names = meta["names"]
    out = {}

    def run_one(name):
        url = f"http://127.0.0.1:{port}/tower_native/export_tower.html?r=4&only={name}"
        data = dump_json(browser, url, timeout=45)
        return name, decode_sprite(data["sprites"][0])

    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as ex:
        for name, img in ex.map(run_one, names):
            out[name] = img
    return meta["G"], meta["P"], out


def make_fastest_lap_polished(w, h):
    """Rounded vibrant F1TV broadcast purple fastest-lap badge with crisp white stopwatch."""
    import math

    k = 4
    u = h / 36.0
    X, Y = np.meshgrid((np.arange(w * k) + 0.5) / k / u, (np.arange(h * k) + 0.5) / k / u)
    # Rounded rect alpha mask
    rx, ry = w / u, h / u
    rad = 3.2
    dx = np.maximum(0.0, np.abs(X - rx / 2.0) - (rx / 2.0 - rad - 0.6))
    dy = np.maximum(0.0, np.abs(Y - ry / 2.0) - (ry / 2.0 - rad - 0.6))
    inside = (np.hypot(dx, dy) <= rad).astype(np.float64)
    alpha = inside.reshape(h, k, w, k).mean(axis=(1, 3))
    # Stopwatch icon
    cx, cy, ro, ri = rx / 2.0, 20.5, 8.4, 6.4
    d = np.hypot(X - cx, Y - cy)
    m = (d <= ro) & (d >= ri)
    m |= (np.abs(X - cx) <= 2.2) & (Y >= 7.2) & (Y <= 9.5)
    m |= (np.abs(X - cx) <= 0.9) & (Y >= 9.5) & (Y <= cy - ro + 0.6)
    a = math.radians(45.0)
    bx, by = cx + (ro + 1.1) * math.sin(a), cy - (ro + 1.1) * math.cos(a)
    m |= np.hypot(X - bx, Y - by) <= 1.25
    a = math.radians(35.0)
    ux, uy = math.sin(a), -math.cos(a)
    t = (X - cx) * ux + (Y - cy) * uy
    m |= (t >= -0.5) & (t <= 4.9) & (np.abs((X - cx) * uy - (Y - cy) * ux) <= 0.95)
    m |= d <= 1.4
    cov = m.astype(np.float64).reshape(h, k, w, k).mean(axis=(1, 3))
    # Vertical vibrant purple gradient (#C432FF -> #8614CC)
    yv = np.linspace(0.0, 1.0, h)[:, None, None]
    top_c = np.array([196.0, 50.0, 255.0])
    bot_c = np.array([134.0, 20.0, 204.0])
    bg = top_c * (1.0 - yv) + bot_c * yv
    rgb = bg + cov[:, :, None] * (255.0 - bg)
    img = np.empty((h, w, 4), np.uint8)
    img[..., :3] = np.clip(np.round(rgb), 0, 255).astype(np.uint8)
    img[..., 3] = np.clip(np.round(alpha * 255.0), 0, 255).astype(np.uint8)
    return img


def make_p1_gradient(w=16, h=16):
    """Sleek F1 crimson-red gradient tile for the P1 position box."""
    yv = np.linspace(0.0, 1.0, h)[:, None, None]
    top_c = np.array([238.0, 20.0, 14.0])
    bot_c = np.array([178.0, 10.0, 6.0])
    rgb = top_c * (1.0 - yv) + bot_c * yv
    img = np.empty((h, w, 4), np.uint8)
    img[..., :3] = np.clip(np.round(rgb), 0, 255).astype(np.uint8)
    img[..., 3] = 255
    return img


def _load_swofty(swofty_dir):
    if swofty_dir and os.path.isdir(swofty_dir) and swofty_dir not in sys.path:
        sys.path.insert(0, swofty_dir)
    from pkg import Pkg, Obj, Arr, Val
    import gfx_material as GM
    import idf as I
    import uinode as N
    import uiops as U

    return Pkg, Obj, Arr, Val, GM, I, N, U


def _find_scene(node, target_name, I):
    if I._val(node.get("name")) == target_name:
        return node
    kids = node.get("children")
    if kids is not None:
        for c in kids.items:
            r = _find_scene(c, target_name, I)
            if r is not None:
                return r
    return None


def _set_scene_param(o, name, value, vtype, I, Val):
    for it in o["params"].items:
        if I._val(it.get("name")) == name:
            it.set("value", Val(it["value"].type, value))
            return
    I.set_param(o, name, value, vtype)


def make_rb_resources(rb_sprites, stock_mat_bytes, cache_dir, GM):
    """Build (surface, SRV, material, fill-EMB, edge-EMB) resources for all 13 RPM bezel sprites."""
    TEX = "eaid://ui_package/art/osd/textures/halo/halo_{}.tif"
    MAT = "eaid://ui_package/art/osd/materials/halo/halo_{}.material"
    EMB_FILL = "eaid://ui_package/art/osd/components/halo/halo_{}.emb?context=default"
    EMB_EDGE = "eaid://ui_package/art/osd/components/halo/edge/halo_{}.emb?context=default"

    extra = {}
    embs_fill, embs_edge = {}, {}
    for _, sname, _ in RPM_BEZEL_KEYS:
        sp = rb_sprites[sname]
        tex = TEX.format(sname)
        mat = MAT.format(sname)
        eb_f = EMB_FILL.format(sname)
        eb_e = EMB_EDGE.format(sname)
        # 1. Surface
        extra[tex + ".image"] = ("GfxSurfaceRes", encode_surface(sp["img"], cache_dir))
        # 2. SRV
        srv_bytes = struct.pack("<6I", 5, FMT_BC7_SRGB, 0, 1, 0, 0) + (tex + ".image").encode() + b"\0"
        extra[tex] = ("GfxSRVResource", [srv_bytes])
        # 3. Material (cloned from existing halo material, neutral white tint)
        m = GM.parse25(stock_mat_bytes)
        for p in m.params:
            if p.name in ("me_colour", "me_finalColourTint"):
                p.value = struct.pack("<4f", 1, 1, 1, 1)
            elif p.name == "me_diffuseTexHeapIndex":
                p.link = tex
            elif p.name == "me_diffuseTex":
                p.value = tex
        mat_bytes = GM.write25(m)
        back = GM.parse25(mat_bytes)
        assert back.get("me_diffuseTex").value == tex and back.get("me_diffuseTexHeapIndex").link == tex
        extra[mat] = ("GfxMaterialRes", [mat_bytes])
        # 4. EMB bindings for both central_bg_fill (F1 2026/2025) and central_bg_edge (F2)
        extra[eb_f] = ("GfxMatBindRes", [emb.write([("central_bg_fill", mat)])])
        extra[eb_e] = ("GfxMatBindRes", [emb.write([("central_bg_edge", mat)])])
        embs_fill[sname] = eb_f
        embs_edge[sname] = eb_e
    return extra, embs_fill, embs_edge


def inject_rpm_bezel_scene(scene_bytes, pfx, parent_name, quad_tmpl_name, embs, rb_sprites, I, Arr, Val):
    """Idempotently inject the 13 progressive RPM bezel quads into a dial .idf scene."""
    idf_obj = I.Idf(scene_bytes)
    entry = idf_obj.scenes[0].entry
    root = entry["scene"]
    before_ids = {
        e.path: e.element_id
        for e, _ in idf_obj.scenes[0].root.walk()
        if not e.path.rsplit(".", 1)[-1].startswith(pfx + "rb")
    }
    parent = _find_scene(root, parent_name, I)
    t_quad = _find_scene(root, quad_tmpl_name, I)
    assert parent is not None and t_quad is not None, (parent_name, quad_tmpl_name)
    lo, hi = I.get_param(t_quad, "minExtents"), I.get_param(t_quad, "maxExtents")
    if quad_tmpl_name == "central_bg_fill":
        mesh_w, mesh_h = 4.48, 1.92
    else:
        mesh_w, mesh_h = hi[0] - lo[0], hi[2] - lo[2]

    # Remove any previous rb* quads under parent for idempotency
    parent["children"].items[:] = [
        c for c in parent["children"].items if not I._val(c.get("name")).startswith(pfx + "rb")
    ]

    for key, sname, layer in RPM_BEZEL_KEYS:
        sp = rb_sprites[sname]
        x0, y0, x1, y1 = sp["x0"], sp["y0"], sp["x1"], sp["y1"]
        cx = K_SCENE * (x0 + x1) / 2.0
        cy = -K_SCENE * (y0 + y1) / 2.0
        w = K_SCENE * (x1 - x0)
        h = K_SCENE * (y1 - y0)
        qname = pfx + key
        o = I.clone_node(t_quad)
        o.set("name", Val("stri", qname))
        _set_scene_param(o, "guid", str(uuid.uuid5(uuid.NAMESPACE_URL, "nick.f1-2026-halo/" + qname)), "stri", I, Val)
        o.set("position", Val("vec3", [float(cx), float(cy), 0.0, 0.0]))
        o.set("scale", Val("vec3", [float(w / mesh_w), 1.0, float(h / mesh_h), 0.0]))
        o.set("rotation", Val("quat", [-0.707107, -0.0, 0.0, -0.707107]))
        o.set("children", Arr([], o["children"].tag))
        o.set("anims", Arr([], o["anims"].tag))
        o["geoms"].items[0].set("materialid", Val("stri", embs[sname]))
        _set_scene_param(o, "eLayer.layer", int(layer), "si32", I, Val)
        parent["children"].items.append(o)

    ids = []
    for kid in root["children"].items:
        I.recompute_ids(kid, I._val(kid.get("name")), ids)
    I.relookup(entry)
    out_bytes = idf_obj.to_bytes()
    after_ids = {e.path: e.element_id for e, _ in I.Idf(out_bytes).scenes[0].root.walk()}
    changed = [k for k, v in before_ids.items() if after_ids.get(k) != v]
    assert not changed, ("existing element IDs changed", changed[:5])
    assert len(set(ids)) == len(ids), "elementId collision in scene"
    return out_bytes


def _ui_node_at(root, dotted_path, N):
    parts = dotted_path.split(".")
    cur = None
    # Locate top-level root node matching parts[0]
    def find_top(x):
        if N.is_node(x):
            if N.name(x) == parts[0]:
                return x
            for c in N.children(x):
                r = find_top(c)
                if r is not None:
                    return r
        elif hasattr(x, "items"):
            for it in x.items:
                r = find_top(it[1] if isinstance(it, tuple) else it)
                if r is not None:
                    return r
        return None

    cur = find_top(root)
    assert cur is not None, f"UI node not found: {parts[0]}"
    for seg in parts[1:]:
        cur = N.child(cur, seg)
    return cur


def inject_rpm_bezel_ui(ui_bytes, dials, Pkg, N, U, Val):
    """Idempotently inject 13 bool UIGP visibility bindings (v_rb01..v_rb12, v_rbmax) under each dial's halo_ctl."""
    p = Pkg(ui_bytes)
    added = 0
    for ctl_path, pfx in dials:
        ctl = _ui_node_at(p.root, ctl_path, N)
        kids = ctl.items[N.CHILDREN].items
        kids[:] = [c for c in kids if not N.name(c).startswith("v_rb")]
        for key, _, _ in RPM_BEZEL_KEYS:
            vis_prop = U.obj(("value", Val("bool", False)), ("dbentry", U.S(VM_PREFIX + key)))
            nd = U.node("v_" + key, "UIGP", [("visible", vis_prop)], layout=[pfx + key], behav=U.GROUP_BEHAVIOURS)
            N.fix_ids(nd, ctl_path)
            kids.append(nd)
            added += 1
    out = p.to_bytes()
    # Verify roundtrip parse
    Pkg(out)
    return out, added


def patch_erp(erp_path, surface_replacements, cache_dir, raw_overrides=None):
    """Rewrite an ERP archive, replacing surfaces and/or adding/replacing raw resources cleanly."""
    raw_overrides = raw_overrides or {}
    all_r = erpbuild.read_all(erp_path)
    arc = erpbuild.Archive(erp_path)
    replaced = 0
    raw_count = 0
    seen = set()
    for name, (rtype, frags) in all_r.items():
        seen.add(name)
        if name in raw_overrides:
            rt, new_frags = raw_overrides[name]
            arc.add(name, rt, new_frags)
            raw_count += 1
        elif rtype == "GfxSurfaceRes" and name in surface_replacements:
            old_w, old_h = struct.unpack_from("<II", frags[0], 0x0C)
            entry = surface_replacements[name]
            if len(entry) == 3 and entry[1] == "hud_rect":
                sp_dict, _, qrect = entry
                fitted = place_in_hud_rect(sp_dict, *qrect, old_w, old_h)
            else:
                img, mode = entry
                fitted = fit_to_size(img, old_w, old_h, mode=mode)
            new_frags = encode_surface(fitted, cache_dir)
            arc.add(name, rtype, new_frags)
            replaced += 1
        else:
            arc.add(name, rtype, frags)
    for name, (rt, new_frags) in raw_overrides.items():
        if name not in seen:
            arc.add(name, rt, new_frags)
            raw_count += 1
    tmp = erp_path + ".tmp"
    size = arc.write(tmp)
    os.replace(tmp, erp_path)
    print(f"Patched {os.path.basename(erp_path)}: {replaced} surfaces, {raw_count} injected/updated resources ({size:,} bytes)")


def tinted_preview(img, hexcol):
    col = np.array([int(hexcol[i : i + 2], 16) for i in (1, 3, 5)], np.uint32)
    out = img.copy()
    out[..., :3] = (img[..., :3].astype(np.uint32) * col // 255).astype(np.uint8)
    return out


def apply_all(browser, port, erp_dir, work_dir, swofty_dir="", halo_only=False):
    cache_dir = os.path.join(work_dir, "bc7_cache")
    backup_dir = os.path.join(work_dir, "erp_backup")
    os.makedirs(backup_dir, exist_ok=True)
    targets = [
        "halo_scene_cam.erp",
        "halo_scene.erp",
        "tower_scene.erp",
        "cards_lap.erp",
        "cards_pit.erp",
        "hud_templates.erp",
        "hud_templates_bn.erp",
        "tower_spectator.erp",
        "tower_spectator_cam.erp",
    ]
    for fn in targets:
        src = os.path.join(erp_dir, fn)
        bak = os.path.join(backup_dir, fn)
        if os.path.exists(src) and not os.path.exists(bak):
            shutil.copy2(src, bak)

    swofty = None
    if swofty_dir:
        swofty = _load_swofty(swofty_dir)
        print(f"Loaded Swofty UI/IDF tools from {swofty_dir} (dynamic RPM bezel injection enabled)")
    else:
        print("NOTE: --swofty-tools / SWOFTY_TOOLS not set; skipping dynamic RPM bezel scene/UI injection")

    # 1. Restyle Halo ERPs (cam and tv layouts) + inject dynamic RPM bezel quads/resources
    for layout, erp_name in [("cam", "halo_scene_cam.erp"), ("tv", "halo_scene.erp")]:
        erp_path = os.path.join(erp_dir, erp_name)
        if not os.path.exists(erp_path):
            continue
        all_r = erpbuild.read_all(erp_path)
        prefix = "eaid://ui_package/art/osd/textures/halo/halo_"
        suffix = ".tif.image"
        meta = dump_json(browser, f"http://127.0.0.1:{port}/export_native.html?r=6{'&layout=cam' if layout == 'cam' else ''}&only=")
        available = set(meta["names"])
        wanted = []
        for k, (rt, _) in all_r.items():
            if rt == "GfxSurfaceRes" and k.startswith(prefix) and k.endswith(suffix):
                sname = k[len(prefix) : -len(suffix)]
                if sname in available:
                    wanted.append(sname)
        if swofty is not None:
            for _, sname, _ in RPM_BEZEL_KEYS:
                if sname in available and sname not in wanted:
                    wanted.append(sname)
        print(f"Rendering {len(wanted)} halo sprites ({layout})...")
        rendered = render_halo_sprites(browser, port, layout, wanted)
        # Read exact base quad HUD rect from dial_om_xm.idf so base/base_g/base_f2 NEVER shift by even 1 px
        base_qrect = None
        if swofty is not None:
            Pkg, Obj, Arr, Val, GM, I, N, U = swofty
            skey0 = "eaid://ui_package/art/osd/components/dial/dial_om_xm.idf"
            if skey0 in all_r:
                idf0 = I.Idf(all_r[skey0][1][0])
                bnode = _find_scene(idf0.scenes[0].entry["scene"], "halo_base", I)
                if bnode is not None:
                    bpos = bnode["position"].value
                    bsc = bnode["scale"].value
                    bw, bh = bsc[0] * 4.48 / K_SCENE, bsc[2] * 1.92 / K_SCENE
                    bcx, bcy = bpos[0] / K_SCENE, -bpos[1] / K_SCENE
                    base_qrect = (bcx - bw / 2.0, bcy - bh / 2.0, bcx + bw / 2.0, bcy + bh / 2.0)
        repl = {}
        for sname, sp in rendered.items():
            full = prefix + sname + suffix
            if sname in ("base", "base_g", "base_f2") and base_qrect is not None:
                repl[full] = (sp, "hud_rect", base_qrect)
            else:
                mode = "stretch" if sname in ("base", "base_g", "base_f2") else "center"
                repl[full] = (sp["img"], mode)
        if "rails" in rendered:
            pv_key = prefix + "rails_pv" + suffix
            if pv_key in all_r:
                repl[pv_key] = (tinted_preview(rendered["rails"]["img"], "#FF8000"), "center")

        raw_overrides = {}
        if swofty is not None:
            Pkg, Obj, Arr, Val, GM, I, N, U = swofty
            mat_key = "eaid://ui_package/art/osd/materials/halo/halo_base.material"
            stock_mat_bytes = all_r[mat_key][1][0]
            rb_extra, embs_fill, embs_edge = make_rb_resources(rendered, stock_mat_bytes, cache_dir, GM)
            raw_overrides.update(rb_extra)
            scene_specs = [
                ("eaid://ui_package/art/osd/components/dial/dial_om_xm.idf", "halo_", "halo_std", "central_bg_fill", embs_fill),
                ("eaid://ui_package/art/osd/components/dial/dial_complete.idf", "h25_", "h25_std", "central_bg_fill", embs_fill),
                ("eaid://ui_package/art/osd/components/dial/dial_f2_complete.idf", "hf2_", "hf2_std", "central_bg_edge", embs_edge),
            ]
            for skey, pfx, parent_name, quad_tmpl, embs in scene_specs:
                if skey in all_r:
                    rt, frags = all_r[skey]
                    new_scene = inject_rpm_bezel_scene(frags[0], pfx, parent_name, quad_tmpl, embs, rendered, I, Arr, Val)
                    raw_overrides[skey] = (rt, [new_scene])
        patch_erp(erp_path, repl, cache_dir, raw_overrides=raw_overrides)

    # 1b. Inject dynamic RPM bezel UI visibility bindings into race & spectator UI templates
    if swofty is not None:
        Pkg, Obj, Arr, Val, GM, I, N, U = swofty
        ui_specs = [
            (
                ["hud_templates.erp", "hud_templates_bn.erp"],
                "eaid://ui_package/templates/hud_dynamic_templates.ui",
                [
                    ("hud_f1_dial_om_xm.osd_visibility_option.f1_om_xm_dial_child.halo_ctl", "halo_"),
                    ("hud_f1_dial.osd_visibility_option.f1_dial_child.halo_ctl", "h25_"),
                    ("hud_f2_dial.osd_visibility_option.f2_dial_child.halo_ctl", "hf2_"),
                ],
            ),
            (
                ["tower_spectator.erp", "tower_spectator_cam.erp"],
                "eaid://ui_package/screens/hud_spectator_2.ui",
                [
                    ("hud_spectator_2.content.bottom_right.f1_26_dial.halo_ctl", "halo_"),
                    ("hud_spectator_2.content.bottom_right.modern_dial.halo_ctl", "h25_"),
                    ("hud_spectator_2.content.bottom_right.f2_dial.halo_ctl", "hf2_"),
                ],
            ),
        ]
        for erp_names, uikey, dials in ui_specs:
            for fn in erp_names:
                upath = os.path.join(erp_dir, fn)
                if not os.path.exists(upath):
                    continue
                all_r = erpbuild.read_all(upath)
                if uikey not in all_r:
                    continue
                rt, frags = all_r[uikey]
                new_ui, added = inject_rpm_bezel_ui(frags[0], dials, Pkg, N, U, Val)
                patch_erp(upath, {}, cache_dir, raw_overrides={uikey: (rt, [new_ui])})
                print(f"  -> {fn}: {added} RPM bezel visibility bindings active")

    if halo_only:
        return

    # 2. Restyle Timing Tower ERP
    tower_path = os.path.join(erp_dir, "tower_scene.erp")
    if os.path.exists(tower_path):
        print("Rendering timing tower sprites...")
        G, P, tsprites = render_tower_sprites(browser, port)
        prefix = "eaid://ui_package/art/osd/textures/tower/tt_"
        suffix = ".tif.image"
        repl = {}
        exact_names = {"hdr", "sc", "vsc", "chq", "yel", "red", "pit", "pen", "pcu", "pcd", "bn_l", "bn_m", "bn_r"}
        for sname, img in tsprites.items():
            repl[prefix + sname + suffix] = (img, "stretch" if sname in exact_names else "center")
        for sname, d in TR.solid_images(P).items():
            img = make_p1_gradient() if sname == "p1" else d["img"]
            repl[prefix + sname + suffix] = (img, "stretch")
        # Knockout hatch + polished fastest lap stopwatch
        TR.HATCH["light"] = (0x62, 0x16, 0x1E)
        TR.HATCH["dark"] = (0x18, 0x02, 0x04)
        repl[prefix + "ko" + suffix] = (TR.hatch_image(G), "stretch")
        repl[prefix + "fl" + suffix] = (make_fastest_lap_polished(28, 36), "stretch")
        patch_erp(tower_path, repl, cache_dir)

    # 3. Restyle Broadcast Lap Time Card & Pit Lane Timer Card ERPs (premium smoked-glass translucency)
    card_cols = {
        "cd_head": (12, 14, 20, 196),    # smoked obsidian glass header (~77%)
        "cd_cell": (6, 7, 11, 204),      # smoked obsidian position cell (~80%)
        "cd_body": (8, 10, 15, 176),     # smoked glass card body (~69%)
        "cd_foot": (6, 8, 12, 190),      # smoked glass footer (~75%)
        "cd_white": (246, 248, 252, 255),
        "cd_track": (36, 42, 56, 168),   # recessed translucent sector bar track
        "cd_grey": (138, 146, 164, 255),
        "cd_red": (225, 6, 0, 255),      # iconic F1 crimson red
    }
    for card_erp in ("cards_lap.erp", "cards_pit.erp"):
        cpath = os.path.join(erp_dir, card_erp)
        if not os.path.exists(cpath):
            continue
        all_r = erpbuild.read_all(cpath)
        repl = {}
        for k, (rt, _) in all_r.items():
            if rt != "GfxSurfaceRes":
                continue
            short = k.split("/")[-1].replace(".tif.image", "")
            if short in card_cols:
                img = np.tile(np.array(card_cols[short], np.uint8), (16, 16, 1))
                repl[k] = (img, "stretch")
        if repl:
            patch_erp(cpath, repl, cache_dir)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--preview", help="Output directory for composite preview PNGs")
    ap.add_argument("--apply", help="Directory containing the addon .erp files to patch in-place")
    ap.add_argument("--work", default=os.path.join(REPO, "build_restyle"), help="Working/cache/backup directory")
    ap.add_argument("--swofty-tools", default=os.environ.get("SWOFTY_TOOLS", ""), help="Directory containing Swofty UI/IDF tools (pkg.py, idf.py, uiops.py, uinode.py, gfx_material.py)")
    ap.add_argument("--halo-only", action="store_true", help="Only patch Halo scene & UI ERPs (skip unchanged tower/cards)")
    args = ap.parse_args()
    browser = find_browser()
    httpd, port = start_server(os.path.join(REPO, "tools"))
    try:
        if args.preview:
            render_preview(browser, port, args.preview)
        if args.apply:
            apply_all(browser, port, args.apply, args.work, swofty_dir=args.swofty_tools, halo_only=args.halo_only)
    finally:
        httpd.shutdown()


if __name__ == "__main__":
    main()
