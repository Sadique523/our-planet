"""Builds the Soft Pickup Town asset kit in a fresh Blender scene.

Run headless (does not touch any open Blender session):
  blender-launcher.exe --background --factory-startup --python tools/make_kit.py -- <out_dir>

Writes <out_dir>/kit.glb (one node per asset), kit.blend and kit_preview.png.
Geometry is authored in three.js space (Y up, metres, cars face +X) and converted
to Blender's Z-up on the way in, so the exported glTF lands back in the same space.
Rounded parts get exact custom normals so big flat faces shade cleanly.
"""
import bpy, math, os, sys
from mathutils import Vector, Matrix, Euler

OUT = sys.argv[sys.argv.index('--') + 1] if '--' in sys.argv else os.getcwd()
os.makedirs(OUT, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene


# ---------------------------------------------------------------- materials
def srgb(hexv):
    out = []
    for sh in (16, 8, 0):
        c = ((hexv >> sh) & 255) / 255
        out.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    return out

MATS = {}
def mat(name, hexv, rough=0.6, emit=None):
    if name in MATS:
        return MATS[name]
    m = bpy.data.materials.new(name)
    try:
        m.use_nodes = True
    except Exception:
        pass
    b = m.node_tree.nodes.get('Principled BSDF')
    col = (*srgb(hexv), 1)
    b.inputs['Base Color'].default_value = col
    b.inputs['Roughness'].default_value = rough
    if emit is not None:
        b.inputs['Emission Color'].default_value = (*srgb(emit), 1)
        b.inputs['Emission Strength'].default_value = 0.5
    m.diffuse_color = col
    MATS[name] = m
    return m

M = dict(
    body=mat('Body', 0xEE8E86, 0.45), accent=mat('Accent', 0xFFC98A, 0.45),
    fender=mat('Fender', 0xF4AAA3, 0.45), glass=mat('Glass', 0xD9EEF5, 0.15),
    tire=mat('Tire', 0x57536B, 0.95), hub=mat('Hub', 0xF1EFF6, 0.35), trim=mat('Trim', 0xC9C5D6, 0.5),
    lamp=mat('Headlight', 0xFFF4C2, 0.3, 0xFFE9A0), tail=mat('Taillight', 0xFFA8A8, 0.4, 0xFF8C8C),
    wall=mat('Wall', 0xF6EBDD, 0.85), roof=mat('Roof', 0xD98C7A, 0.8), found=mat('Foundation', 0xD3CABD, 0.9),
    frame=mat('Frame', 0xFBFAF6, 0.6), window=mat('Window', 0xBFE0EC, 0.15), door=mat('Door', 0xB98A6A, 0.7),
    brick=mat('Brick', 0xCC917F, 0.9), wood=mat('Wood', 0xC59B72, 0.8),
    leaf=mat('Leaf', 0x8BC27A, 0.9), trunk=mat('Trunk', 0x9A7859, 0.9),
    pole=mat('Pole', 0x8C92A3, 0.5), lamphead=mat('LampGlow', 0xFFF2C6, 0.3, 0xFFE7A6),
    shopwall=mat('ShopWall', 0xF4E2C8, 0.85), roofflat=mat('RoofFlat', 0xC4C7D0, 0.9),
    parapet=mat('Parapet', 0xB2B5C0, 0.9), ac=mat('Metal', 0xE2E4EA, 0.45),
    awning=mat('Awning', 0x9FD8C4, 0.8), awning2=mat('AwningWhite', 0xFFFDF7, 0.8),
    sign=mat('Sign', 0x7FA7D9, 0.6), hedge=mat('Hedge', 0x84B672, 1.0), red=mat('Mailbox', 0xE88F86, 0.5),
    barn=mat('Barn', 0xD9897C, 0.85), silo=mat('Silo', 0xE6E1D6, 0.6), dark=mat('Dark', 0x5E5A70, 0.8),
    plant=mat('Bloom', 0xFFB3C7, 0.6), soil=mat('Soil', 0xA2826A, 1.0),
)


# ---------------------------------------------------------------- geometry
# A part is (verts, normals, faces); verts/normals are Vectors in three.js space.
FACES6 = [  # normal, u, v  with u x v = normal (CCW from outside)
    ((1, 0, 0), (0, 0, -1), (0, 1, 0)), ((-1, 0, 0), (0, 0, 1), (0, 1, 0)),
    ((0, 1, 0), (1, 0, 0), (0, 0, -1)), ((0, -1, 0), (1, 0, 0), (0, 0, 1)),
    ((0, 0, 1), (1, 0, 0), (0, 1, 0)), ((0, 0, -1), (-1, 0, 0), (0, 1, 0)),
]

def rbox(w, h, d, r=0.0, n=8, corner=None):
    """Box centred on origin with rounded edges of radius r (r=0: sharp)."""
    r = max(0.0, min(r, min(w, h, d) / 2 - 1e-4))
    if r == 0:
        n, corner = 1, 0
    half = n // 2
    corner = corner if corner is not None else max(1, half // 2 + 1)
    corner = min(corner, half)
    inner = half - corner
    H = (w / 2, h / 2, d / 2)

    def remap(u, Hh):
        if r == 0:
            return u * 2 * Hh
        idx = round(abs(u) * n)
        if inner == 0:
            c = (Hh - r) + idx / corner * r if idx > 0 else 0.0
            c = (Hh - r) + (idx / corner) * r if idx else 0.0
        elif idx <= inner:
            c = idx / inner * (Hh - r)
        else:
            c = (Hh - r) + (idx - inner) / corner * r
        return math.copysign(c, u)

    V, N, F = [], [], []
    for nrm, u, v in FACES6:
        nrm, u, v = Vector(nrm), Vector(u), Vector(v)
        base = len(V)
        for j in range(n + 1):
            for i in range(n + 1):
                p = nrm * 0.5 + u * (i / n - 0.5) + v * (j / n - 0.5)
                x, y, z = remap(p.x, H[0]), remap(p.y, H[1]), remap(p.z, H[2])
                if r == 0:
                    V.append(Vector((x, y, z))); N.append(nrm.copy()); continue
                c = Vector((max(-H[0] + r, min(H[0] - r, x)), max(-H[1] + r, min(H[1] - r, y)), max(-H[2] + r, min(H[2] - r, z))))
                q = Vector((x, y, z)) - c
                q = q.normalized() if q.length > 1e-9 else nrm.copy()
                V.append(c + q * r); N.append(q)
        for j in range(n):
            for i in range(n):
                a = base + j * (n + 1) + i
                F.append((a, a + 1, a + n + 2, a + n + 1))
    return V, N, F

def flat(tris):
    """Flat-shaded polygons from a list of vertex tuples (CCW)."""
    V, N, F = [], [], []
    for poly in tris:
        pts = [Vector(p) for p in poly]
        nrm = (pts[1] - pts[0]).cross(pts[2] - pts[0]).normalized()
        F.append(tuple(range(len(V), len(V) + len(pts))))
        V += pts; N += [nrm] * len(pts)
    return V, N, F

def prism(w, d, rh):
    """Gable fill: triangle in the YZ plane extruded along X, base on y=0."""
    x0, x1, z0, z1 = -w / 2, w / 2, -d / 2, d / 2
    return flat([
        [(x0, 0, z1), (x0, rh, 0), (x0, 0, z0)], [(x1, 0, z0), (x1, rh, 0), (x1, 0, z1)],
        [(x0, 0, z1), (x1, 0, z1), (x1, rh, 0), (x0, rh, 0)], [(x1, 0, z0), (x0, 0, z0), (x0, rh, 0), (x1, rh, 0)],
    ])

def cyl(rt, rb, h, seg=16, caps=True):
    """Cylinder/cone along Y, centred on origin. Smooth sides, flat caps."""
    V, N, F = [], [], []
    slope = (rb - rt) / h
    for i in range(seg + 1):
        a = i / seg * 2 * math.pi
        c, s = math.cos(a), math.sin(a)
        nrm = Vector((c, slope, s)).normalized()
        V += [Vector((rb * c, -h / 2, rb * s)), Vector((rt * c, h / 2, rt * s))]
        N += [nrm, nrm]
    for i in range(seg):
        a = 2 * i
        F.append((a, a + 1, a + 3, a + 2))
    if caps:
        for y, rr, sgn in ((h / 2, rt, 1), (-h / 2, rb, -1)):
            if rr <= 0:
                continue
            base = len(V)
            V.append(Vector((0, y, 0))); N.append(Vector((0, sgn, 0)))
            for i in range(seg):
                a = i / seg * 2 * math.pi
                V.append(Vector((rr * math.cos(a), y, rr * math.sin(a)))); N.append(Vector((0, sgn, 0)))
            for i in range(seg):
                b, c2 = base + 1 + i, base + 1 + (i + 1) % seg
                F.append((base, c2, b) if sgn > 0 else (base, b, c2))
    # fix side winding so normals face outward
    return V, N, F

def sphere(rx, ry, rz, seg=16, rings=10):
    V, N, F = [], [], []
    for j in range(rings + 1):
        th = j / rings * math.pi
        for i in range(seg + 1):
            ph = i / seg * 2 * math.pi
            x, y, z = math.sin(th) * math.cos(ph), math.cos(th), math.sin(th) * math.sin(ph)
            V.append(Vector((x * rx, y * ry, z * rz)))
            N.append(Vector((x / rx, y / ry, z / rz)).normalized())
    for j in range(rings):
        for i in range(seg):
            a = j * (seg + 1) + i
            b = a + seg + 1
            F.append((a, a + 1, b + 1, b))
    return V, N, F

def torus_arc(R, r, arc=math.pi, segM=24, segm=10):
    """Arc of a torus in the XY plane from angle 0 to arc (upper half by default)."""
    V, N, F = [], [], []
    for i in range(segM + 1):
        u = i / segM * arc
        cu, su = math.cos(u), math.sin(u)
        for j in range(segm + 1):
            v = j / segm * 2 * math.pi
            cv, sv = math.cos(v), math.sin(v)
            nrm = Vector((cu * cv, su * cv, sv))
            V.append(Vector((cu * R, su * R, 0)) + nrm * r); N.append(nrm)
    for i in range(segM):
        for j in range(segm):
            a = i * (segm + 1) + j
            b = a + segm + 1
            F.append((a, b, b + 1, a + 1))
    return V, N, F


def xf(part, loc=(0, 0, 0), rot=(0, 0, 0), scl=(1, 1, 1)):
    V, N, F = part
    m = Matrix.LocRotScale(Vector(loc), Euler(rot, 'XYZ'), Vector(scl))
    nm = m.to_3x3().inverted().transposed()
    return [m @ v for v in V], [(nm @ n).normalized() for n in N], F

def fix_winding(part):
    """Flip faces whose geometric normal disagrees with the supplied normals."""
    V, N, F = part
    out = []
    for f in F:
        a, b, c = V[f[0]], V[f[1]], V[f[2]]
        g = (b - a).cross(c - a)
        if g.length < 1e-12 and len(f) > 3:
            g = (V[f[2]] - a).cross(V[f[3]] - a)
        avg = sum((N[i] for i in f), Vector())
        out.append(tuple(reversed(f)) if g.dot(avg) < 0 else f)
    return V, N, out


# ---------------------------------------------------------------- assets
ASSETS = []

def to_bl(p):
    return Vector((p.x, -p.z, p.y))

def build(name, parts, scale=1.0, parent=None, loc=(0, 0, 0)):
    verts, faces, loopn, mats, fmat = [], [], [], [], []
    for part, m in parts:
        V, N, F = fix_winding(part)
        off = len(verts)
        verts += [to_bl(v * scale) for v in V]
        ns = [to_bl(n).normalized() for n in N]
        if m not in mats:
            mats.append(m)
        k = mats.index(m)
        for f in F:
            faces.append(tuple(off + i for i in f)); fmat.append(k)
            loopn += [tuple(ns[i]) for i in f]
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    for m in mats:
        me.materials.append(m)
    for i, p in enumerate(me.polygons):
        p.material_index = fmat[i]
        p.use_smooth = True
    me.normals_split_custom_set(loopn)
    ob = bpy.data.objects.new(name, me)
    scene.collection.objects.link(ob)
    if parent:
        ob.parent = parent
        ob.location = to_bl(Vector(loc))
    else:
        ASSETS.append(ob)
    return ob


# ---- cars ------------------------------------------------------------------
CAR_S = 0.8  # source units -> metres (car ends up ~2.9 m long)

def car_body_parts(style='pickup'):
    b, a, g, t = M['body'], M['accent'], M['glass'], M['trim']
    P = [
        (xf(rbox(3.5, 0.75, 1.7, 0.28, 10), (0, 0.95, 0)), b),
        (xf(rbox(1.3, 0.55, 1.62, 0.26, 10), (1.05, 1.45, 0)), b),
        (xf(rbox(0.06, 0.26, 0.7, 0.03, 4), (1.76, 1.05, 0)), t),
        (xf(rbox(0.28, 0.28, 1.84, 0.12, 8), (1.8, 0.72, 0)), t),
        (xf(rbox(0.28, 0.28, 1.84, 0.12, 8), (-1.82, 0.72, 0)), t),
        (xf(rbox(0.04, 0.55, 1.3, 0.018, 4), (0.595, 1.98, 0)), g),
    ]
    for s in (-1, 1):
        P += [
            (xf(sphere(0.09, 0.15, 0.15, 14, 8), (1.68, 1.45, 0.55 * s)), M['lamp']),
            (xf(rbox(0.06, 0.22, 0.2, 0.025, 4), (-1.79, 1.2, 0.62 * s)), M['tail']),
            (xf(rbox(1.0, 0.08, 0.12, 0.035, 4), (0.05, 0.6, 0.86 * s)), t),
            (xf(rbox(0.22, 0.06, 0.04, 0.015, 4), (-0.12, 1.55, 0.86 * s)), t),
            (xf(rbox(0.7, 0.5, 0.04, 0.015, 4), (0.08, 1.98, 0.805 * s)), g),
            (xf(rbox(1.6, 0.45, 0.14, 0.06, 6), (-1.0, 1.52, 0.78 * s)), b),
            (xf(rbox(1.68, 0.1, 0.22, 0.045, 6), (-1.0, 1.78, 0.78 * s)), a),
        ]
        for x in (1.2, -1.2):
            P.append((xf(torus_arc(0.64, 0.12), (x, 0.5, 0.86 * s)), M['fender']))
    P += [
        (xf(rbox(1.15, 1.05, 1.6, 0.22, 10), (0, 1.8, 0)), b),
        (xf(rbox(1.3, 0.2, 1.7, 0.09, 8), (0.02, 2.38, 0)), a),
        (xf(rbox(0.04, 0.42, 1.2, 0.018, 4), (-0.59, 1.98, 0)), g),
        (xf(rbox(0.14, 0.45, 1.7, 0.06, 6), (-1.73, 1.52, 0)), b),
        (xf(rbox(0.22, 0.1, 1.78, 0.045, 6), (-1.73, 1.78, 0)), a),
    ]
    return P

def wheel_parts(side):
    P = [
        (xf(cyl(0.5, 0.5, 0.42, 28), (0, 0, 0), (math.pi / 2, 0, 0)), M['tire']),
        (xf(cyl(0.25, 0.25, 0.44, 20), (0, 0, 0), (math.pi / 2, 0, 0)), M['hub']),
        (xf(cyl(0.08, 0.08, 0.46, 12), (0, 0, 0), (math.pi / 2, 0, 0)), M['trim']),
    ]
    for k in range(5):
        an = k / 5 * 2 * math.pi
        P.append((xf(sphere(0.035, 0.035, 0.035, 8, 5), (math.cos(an) * 0.16, math.sin(an) * 0.16, 0.22 * side)), M['trim']))
    return P

WHEELS = {'FL': (1.2, 1), 'FR': (1.2, -1), 'RL': (-1.2, 1), 'RR': (-1.2, -1)}

car = build('Car_Pickup', car_body_parts(), CAR_S)
for key, (x, s) in WHEELS.items():
    build('Car_Pickup_Wheel' + key, [(p, m) for p, m in wheel_parts(s)], CAR_S, parent=car, loc=(x * CAR_S, 0.5 * CAR_S, 0.8 * s * CAR_S))

# static pickup for parked cars: wheels baked in
static = car_body_parts()
for key, (x, s) in WHEELS.items():
    static += [(xf(p, (x, 0.5, 0.8 * s)), m) for p, m in wheel_parts(s)]
build('Car_Pickup_Static', static, CAR_S)

# bubble hatch: a second parked-car shape
def bubble_parts():
    b, a, g, t = M['body'], M['accent'], M['glass'], M['trim']
    P = [
        (xf(rbox(2.7, 0.8, 1.55, 0.36, 10), (0, 0.78, 0)), b),
        (xf(rbox(1.6, 0.72, 1.4, 0.34, 10), (-0.2, 1.42, 0)), b),
        (xf(rbox(1.5, 0.14, 1.3, 0.07, 6), (-0.2, 1.8, 0)), a),
        (xf(rbox(0.05, 0.42, 1.12, 0.02, 4), (0.58, 1.43, 0)), g),
        (xf(rbox(0.05, 0.38, 1.0, 0.02, 4), (-1.0, 1.43, 0)), g),
        (xf(rbox(0.24, 0.24, 1.6, 0.1, 6), (1.36, 0.58, 0)), t),
        (xf(rbox(0.24, 0.24, 1.6, 0.1, 6), (-1.36, 0.58, 0)), t),
    ]
    for s in (-1, 1):
        P += [
            (xf(rbox(1.15, 0.4, 0.04, 0.02, 4), (-0.2, 1.45, 0.705 * s)), g),
            (xf(sphere(0.08, 0.13, 0.13, 12, 8), (1.32, 0.92, 0.5 * s)), M['lamp']),
            (xf(rbox(0.05, 0.16, 0.16, 0.02, 4), (-1.36, 0.95, 0.55 * s)), M['tail']),
        ]
        for x in (0.85, -0.85):
            P += [(xf(p, (x, 0.42, 0.68 * s), scl=(0.84, 0.84, 0.84)), m) for p, m in wheel_parts(s)]
            P.append((xf(torus_arc(0.52, 0.1), (x, 0.42, 0.76 * s)), M['fender']))
    return P
build('Car_Bubble_Static', bubble_parts(), CAR_S)


# ---- houses ----------------------------------------------------------------
def window_parts(x, y, z, ry, w=1.25, h=1.3):
    P = [
        (xf(rbox(w + 0.2, h + 0.2, 0.12, 0.03, 4), (0, 0, 0)), M['frame']),
        (xf(rbox(w, h, 0.14, 0.02, 4), (0, 0, 0.01)), M['window']),
        (xf(rbox(0.06, h, 0.16, 0.0), (0, 0, 0.02)), M['frame']),
        (xf(rbox(w, 0.06, 0.16, 0.0), (0, 0.1, 0.02)), M['frame']),
        (xf(rbox(w + 0.4, 0.1, 0.26, 0.03, 4), (0, -h / 2 - 0.12, 0.06)), M['frame']),
    ]
    return [(xf(p, (x, y, z), (0, ry, 0)), m) for p, m in P]

def gable_house(w, d, H, rh, porch=True, chimney=True, floors=1, garage=False):
    """House centred on origin, front facing +Z, ground at y=0."""
    P = [(xf(rbox(w + 0.3, 0.35, d + 0.3, 0.05, 4), (0, 0.175, 0)), M['found'])]
    yw = 0.35
    P.append((xf(rbox(w, H, d, 0.06, 4), (0, yw + H / 2, 0)), M['wall']))
    yt = yw + H
    P.append((xf(prism(w - 0.02, d - 0.02, rh), (0, yt, 0)), M['wall']))
    o, th = 0.45, 0.22
    a = math.atan2(rh, d / 2)
    half = d / 2 + o
    L = half / math.cos(a) + 0.05
    for s in (1, -1):
        y = yt + rh - (half / 2) * math.tan(a) + th / 2 * math.cos(a)
        z = s * (half / 2 + th / 2 * math.sin(a))
        P.append((xf(rbox(w + 2 * o, th, L, 0.06, 4), (0, y, z), (s * a, 0, 0)), M['roof']))
    P.append((xf(rbox(w + 2 * o + 0.06, 0.18, 0.44, 0.08, 6), (0, yt + rh + 0.05, 0)), M['roof']))
    if chimney:
        P.append((xf(rbox(0.75, rh + 1.1, 0.75, 0.05, 4), (w * 0.28, yt + (rh + 1.1) / 2 + 0.1, -d * 0.18)), M['brick']))
        P.append((xf(rbox(0.9, 0.14, 0.9, 0.04, 4), (w * 0.28, yt + rh + 1.25, -d * 0.18)), M['brick']))
    zf = d / 2 + 0.04
    for f in range(floors):
        y = yw + 1.55 + f * 2.6
        xs = (-w * 0.3, w * 0.3) if f == 0 else (-w * 0.3, 0, w * 0.3)
        for x in xs:
            P += window_parts(x, y, zf, 0)
        for x in (-w * 0.25, w * 0.25):
            P += window_parts(x, y, -zf, math.pi)
        P += window_parts(w / 2 + 0.04, y, 0, math.pi / 2, 1.0)
        P += window_parts(-w / 2 - 0.04, y, 0, -math.pi / 2, 1.0)
    P.append((xf(rbox(1.35, 2.35, 0.12, 0.03, 4), (0, yw + 1.17, zf - 0.01)), M['frame']))
    P.append((xf(rbox(1.05, 2.15, 0.16, 0.03, 4), (0, yw + 1.08, zf)), M['door']))
    P.append((xf(sphere(0.06, 0.06, 0.06, 8, 6), (0.35, yw + 1.05, zf + 0.1)), M['hub']))
    if porch:
        P.append((xf(rbox(2.4, 0.22, 1.4, 0.05, 4), (0, 0.11, d / 2 + 0.7)), M['found']))
        P.append((xf(rbox(2.5, 0.16, 1.5, 0.05, 4), (0, yw + 2.55, d / 2 + 0.75), (-0.12, 0, 0)), M['roof']))
        for x in (-1.05, 1.05):
            P.append((xf(cyl(0.07, 0.07, 2.4, 10), (x, yw + 1.2, d / 2 + 1.3)), M['frame']))
    for x in (-w * 0.3, w * 0.3):  # flower boxes under front windows
        P.append((xf(rbox(1.5, 0.25, 0.3, 0.04, 4), (x, yw + 0.68, zf + 0.15)), M['wood']))
        for k in range(4):
            P.append((xf(sphere(0.12, 0.12, 0.12, 8, 6), (x - 0.5 + k * 0.33, yw + 0.86, zf + 0.15)), M['plant']))
    if garage:
        gx = w / 2 + 1.7
        P.append((xf(rbox(3.4, 3.0, d * 0.85, 0.06, 4), (gx, 0.35 + 1.5 - 0.35 + 0.35, -d * 0.075)), M['wall']))
        P.append((xf(rbox(3.7, 0.2, d * 0.85 + 0.4, 0.06, 4), (gx, 3.45, -d * 0.075)), M['roof']))
        P.append((xf(rbox(2.6, 2.2, 0.12, 0.03, 4), (gx, 1.25, d * 0.85 / 2 - d * 0.075 + 0.04)), M['frame']))
        for k in range(4):
            P.append((xf(rbox(2.4, 0.04, 0.14, 0.0), (gx, 0.55 + k * 0.5, d * 0.85 / 2 - d * 0.075 + 0.06)), M['trim']))
    return P

build('House_Cottage', gable_house(8.4, 7.2, 3.0, 2.5))
build('House_TwoStory', gable_house(8.8, 7.6, 5.6, 2.3, floors=2))
build('House_Bungalow', gable_house(9.6, 7.0, 3.0, 1.7, porch=False, chimney=True, garage=True))

# ---- barn & silo -------------------------------------------------------------
def barn_parts():
    w, d, H, rh = 9.0, 12.0, 4.2, 3.0
    P = [(xf(rbox(w, H, d, 0.06, 4), (0, H / 2, 0)), M['barn'])]
    P.append((xf(prism(d, w, rh), (0, H, 0), (0, math.pi / 2, 0)), M['barn']))
    a = math.atan2(rh, w / 2); half = w / 2 + 0.5; L = half / math.cos(a) + 0.05
    for s in (1, -1):
        y = H + rh - (half / 2) * math.tan(a) + 0.11 * math.cos(a)
        x = s * (half / 2 + 0.11 * math.sin(a))
        P.append((xf(rbox(L, 0.22, d + 0.8, 0.06, 4), (x, y, 0), (0, 0, -s * a)), M['dark']))
    P.append((xf(rbox(0.46, 0.18, d + 0.86, 0.08, 6), (0, H + rh + 0.05, 0)), M['dark']))
    for z in (d / 2 + 0.05, -d / 2 - 0.05):
        P.append((xf(rbox(3.6, 3.4, 0.1, 0.03, 4), (0, 1.7, z)), M['frame']))
        P.append((xf(rbox(3.2, 3.0, 0.14, 0.02, 4), (0, 1.7, z)), M['barn']))
        for ang in (0.76, -0.76):
            P.append((xf(rbox(4.2, 0.18, 0.16, 0.0), (0, 1.7, z), (0, 0, ang)), M['frame']))
        P.append((xf(rbox(1.3, 1.0, 0.12, 0.03, 4), (0, H + 1.0, z)), M['frame']))
    return P
build('Barn', barn_parts())
build('Silo', [(xf(cyl(1.8, 1.8, 8, 24), (0, 4, 0)), M['silo']), (xf(sphere(1.85, 1.3, 1.85, 24, 10), (0, 8, 0)), M['dark']),
               (xf(cyl(1.83, 1.83, 0.2, 24), (0, 2.5, 0)), M['dark']), (xf(cyl(1.83, 1.83, 0.2, 24), (0, 5.5, 0)), M['dark'])])

# ---- shops ---------------------------------------------------------------------
def shop_parts(w=9.6, d=10, h=4.6):
    P = [(xf(rbox(w, h, d, 0.05, 4), (0, h / 2, 0)), M['shopwall'])]
    P.append((xf(rbox(w - 0.5, 0.06, d - 0.5, 0.0), (0, h + 0.03, 0)), M['roofflat']))
    for (sx, sz, lx, lz) in ((0, d / 2 - 0.12, w, 0.24), (0, -d / 2 + 0.12, w, 0.24), (w / 2 - 0.12, 0, 0.24, d), (-w / 2 + 0.12, 0, 0.24, d)):
        P.append((xf(rbox(lx, 0.45, lz, 0.04, 4), (sx, h + 0.22, sz)), M['parapet']))
    P.append((xf(rbox(1.4, 0.9, 1.1, 0.08, 4), (-w * 0.2, h + 0.45, -d * 0.15)), M['ac']))
    P.append((xf(cyl(0.35, 0.35, 0.12, 16), (-w * 0.2, h + 0.95, -d * 0.15)), M['trim']))
    P.append((xf(rbox(1.0, 0.6, 0.8, 0.06, 4), (w * 0.25, h + 0.3, d * 0.1)), M['ac']))
    P.append((xf(cyl(0.18, 0.18, 0.5, 12), (w * 0.1, h + 0.25, -d * 0.3)), M['trim']))
    zf = d / 2 + 0.04
    P.append((xf(rbox(w * 0.78, 2.5, 0.14, 0.03, 4), (-w * 0.06, 1.55, zf)), M['frame']))
    P.append((xf(rbox(w * 0.74, 2.3, 0.16, 0.02, 4), (-w * 0.06, 1.55, zf)), M['window']))
    P.append((xf(rbox(1.2, 2.4, 0.18, 0.02, 4), (w * 0.38, 1.3, zf)), M['door']))
    n = 8; aw = w * 0.92 / n
    for i in range(n):
        x = -w * 0.46 + aw * (i + 0.5)
        P.append((xf(rbox(aw, 0.07, 1.6, 0.02, 4), (x, 3.25, zf + 0.75), (0.32, 0, 0)), M['awning'] if i % 2 == 0 else M['awning2']))
    P.append((xf(rbox(w * 0.6, 0.7, 0.16, 0.08, 4), (0, h - 0.6, zf + 0.02)), M['sign']))
    return P
build('Shop', shop_parts())

def market_parts(w=34, d=16, h=6.2):
    P = [(xf(rbox(w, h, d, 0.08, 4), (0, h / 2, 0)), M['shopwall'])]
    P.append((xf(rbox(w - 0.6, 0.06, d - 0.6, 0.0), (0, h + 0.03, 0)), M['roofflat']))
    for (sx, sz, lx, lz) in ((0, d / 2 - 0.15, w, 0.3), (0, -d / 2 + 0.15, w, 0.3), (w / 2 - 0.15, 0, 0.3, d), (-w / 2 + 0.15, 0, 0.3, d)):
        P.append((xf(rbox(lx, 0.6, lz, 0.05, 4), (sx, h + 0.3, sz)), M['parapet']))
    for i in range(5):
        for j in range(2):
            P.append((xf(rbox(2.6, 0.35, 2.0, 0.08, 4), (-12 + i * 6, h + 0.2, -3 + j * 6)), M['window']))
    P.append((xf(rbox(2.2, 1.2, 1.6, 0.1, 4), (13, h + 0.6, -5)), M['ac']))
    P.append((xf(rbox(2.2, 1.2, 1.6, 0.1, 4), (13, h + 0.6, -2)), M['ac']))
    zf = d / 2 + 0.04
    P.append((xf(rbox(w * 0.8, 3.0, 0.14, 0.03, 4), (0, 1.75, zf)), M['frame']))
    P.append((xf(rbox(w * 0.78, 2.8, 0.16, 0.02, 4), (0, 1.75, zf)), M['window']))
    for x in (-3.5, 3.5):
        P.append((xf(rbox(2.2, 2.7, 0.2, 0.02, 4), (x, 1.4, zf + 0.02)), M['trim']))
    P.append((xf(rbox(14, 0.25, 3.0, 0.08, 4), (0, 3.6, zf + 1.5)), M['awning']))
    P.append((xf(rbox(12, 1.3, 0.22, 0.12, 6), (0, h - 0.9, zf + 0.04)), M['sign']))
    return P
build('Market', market_parts())

# ---- nature ------------------------------------------------------------------
build('Tree_Round', [
    (xf(cyl(0.16, 0.24, 2.0, 10), (0, 1.0, 0)), M['trunk']),
    (xf(sphere(1.7, 1.5, 1.7, 13, 9), (0, 3.0, 0)), M['leaf']),
    (xf(sphere(1.15, 1.0, 1.15, 11, 8), (0.95, 2.4, 0.45)), M['leaf']),
    (xf(sphere(1.05, 0.95, 1.05, 11, 8), (-0.7, 3.6, -0.5)), M['leaf']),
    (xf(sphere(0.95, 0.85, 0.95, 11, 8), (-0.85, 2.35, 0.7)), M['leaf']),
])
pine = [(xf(cyl(0.14, 0.2, 1.4, 10), (0, 0.7, 0)), M['trunk'])]
for k, (rr, hh, y) in enumerate(((1.7, 2.0, 2.0), (1.35, 1.8, 3.2), (0.95, 1.6, 4.3))):
    pine.append((xf(cyl(0.12, rr, hh, 12), (0, y, 0)), M['leaf']))
build('Tree_Pine', pine)
build('Bush', [(xf(sphere(0.8, 0.6, 0.8, 14, 8), (0, 0.45, 0)), M['leaf']), (xf(sphere(0.55, 0.45, 0.55, 12, 8), (0.55, 0.35, 0.25)), M['leaf']),
               (xf(sphere(0.5, 0.42, 0.5, 12, 8), (-0.5, 0.33, -0.2)), M['leaf'])])
build('Hedge', [(xf(rbox(1.0, 1.1, 0.9, 0.3, 6), (0, 0.55, 0)), M['hedge'])])

# ---- street furniture ------------------------------------------------------------
build('Lamp', [
    (xf(cyl(0.12, 0.16, 0.3, 12), (0, 0.15, 0)), M['pole']),
    (xf(cyl(0.06, 0.08, 4.2, 10), (0, 2.25, 0)), M['pole']),
    (xf(rbox(0.08, 0.08, 1.1, 0.03, 4), (0, 4.3, 0.5)), M['pole']),
    (xf(rbox(0.36, 0.14, 0.6, 0.06, 4), (0, 4.24, 1.0)), M['pole']),
    (xf(rbox(0.28, 0.06, 0.5, 0.02, 4), (0, 4.16, 1.0)), M['lamphead']),
])
build('Bench', [
    (xf(rbox(1.8, 0.08, 0.5, 0.03, 4), (0, 0.45, 0)), M['wood']),
    (xf(rbox(1.8, 0.4, 0.07, 0.03, 4), (0, 0.75, -0.22), (-0.15, 0, 0)), M['wood']),
    (xf(rbox(0.08, 0.45, 0.45, 0.02, 4), (-0.75, 0.22, 0)), M['pole']),
    (xf(rbox(0.08, 0.45, 0.45, 0.02, 4), (0.75, 0.22, 0)), M['pole']),
])
build('Mailbox', [
    (xf(rbox(0.1, 1.0, 0.1, 0.02, 4), (0, 0.5, 0)), M['wood']),
    (xf(rbox(0.5, 0.32, 0.3, 0.12, 6), (0, 1.12, 0)), M['red']),
    (xf(rbox(0.03, 0.22, 0.05, 0.01, 4), (0.1, 1.38, 0.17)), M['body']),
])
build('Hydrant', [
    (xf(cyl(0.16, 0.18, 0.6, 14), (0, 0.3, 0)), M['red']),
    (xf(sphere(0.17, 0.14, 0.17, 12, 8), (0, 0.62, 0)), M['red']),
    (xf(cyl(0.07, 0.07, 0.5, 10), (0, 0.38, 0), (0, 0, math.pi / 2)), M['red']),
])
build('Planter', [(xf(rbox(1.4, 0.5, 1.4, 0.1, 4), (0, 0.25, 0)), M['found']), (xf(rbox(1.2, 0.06, 1.2, 0.0), (0, 0.5, 0)), M['soil'])])


exec(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'kit_world.py'), encoding='utf8').read())

# ---------------------------------------------------------------- export
for ob in bpy.data.objects:
    ob.select_set(True)
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, 'kit.glb'), export_format='GLB', export_apply=True,
                          export_yup=True, export_normals=True)

# ---------------------------------------------------------------- preview layout + render
# lay the assets out in rows for the preview (and for browsing kit.blend)
x = y = 0.0; row_d = 0.0; maxx = 0.0; ROW_W = 120.0
for ob in sorted(ASSETS, key=lambda o: -o.dimensions.z):
    dims = ob.dimensions
    if x > 0 and x + dims.x > ROW_W:
        x = 0.0; y += row_d + 4.0; row_d = 0.0
    ob.location = (x + dims.x / 2, y + dims.y / 2, 0)
    x += dims.x + 3.0; row_d = max(row_d, dims.y); maxx = max(maxx, x)
total_d = y + row_d
x = maxx; cx = x / 2
scene.render.engine = 'BLENDER_WORKBENCH'
sh = scene.display.shading
sh.light = 'STUDIO'; sh.color_type = 'MATERIAL'; sh.show_shadows = True; sh.show_cavity = True
sh.cavity_type = 'BOTH'
scene.display.shadow_shift = 0.1
scene.render.resolution_x, scene.render.resolution_y = 2400, 1500
scene.render.film_transparent = False
scene.world = bpy.data.worlds.new('W'); scene.world.color = srgb(0xCFE6F5)
sh.background_type = 'WORLD'
cam_d = bpy.data.cameras.new('Cam'); cam_d.type = 'ORTHO'; cam_d.ortho_scale = max(x, total_d * 2.2) * 1.05
cam = bpy.data.objects.new('Cam', cam_d); scene.collection.objects.link(cam)
cam.location = (cx, total_d / 2 - 90, 75); cam.rotation_euler = (math.radians(52), 0, 0)
scene.camera = cam
ground = bpy.data.meshes.new('Ground'); ground.from_pydata([(-40, -60, 0), (x + 40, -60, 0), (x + 40, total_d + 60, 0), (-40, total_d + 60, 0)], [], [(0, 1, 2, 3)])
g = bpy.data.objects.new('Ground', ground); scene.collection.objects.link(g); ground.materials.append(mat('PreviewGround', 0xB3D796, 1))
scene.render.filepath = os.path.join(OUT, 'kit_preview.png')
bpy.ops.render.render(write_still=True)

# car close-up
for ob in ASSETS:
    ob.hide_render = ob.name != 'Car_Pickup'
car.location = (0, 0, 0)
cam_d.type = 'PERSP'; cam_d.lens = 50
cam.location = (5.5, -6.5, 3.6); cam.rotation_euler = (math.radians(68), 0, math.radians(40))
g.location = (-x / 2, 0, 0)
scene.render.resolution_x, scene.render.resolution_y = 1200, 800
scene.render.filepath = os.path.join(OUT, 'car_preview.png')
bpy.ops.render.render(write_still=True)
for ob in ASSETS:
    ob.hide_render = False

bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, 'kit.blend'))
print('KIT_DONE', len(ASSETS))
