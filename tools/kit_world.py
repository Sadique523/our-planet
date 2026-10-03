# World assets for Soft Pickup Planet. Executed from make_kit.py (shares its helpers:
# mat, M, rbox, flat, prism, cyl, sphere, torus_arc, xf, build).
# Conventions: three.js space, metres, Y up, front faces +Z, origin on the ground.

M.update(
    stone=mat('Stone', 0xD2CBC0, 0.9), stonedark=mat('StoneDark', 0xB9B1A6, 0.9),
    plaster=mat('Plaster', 0xF8F3EA, 0.85), cwood=mat('ChaletWood', 0xB98157, 0.75),
    cwooddark=mat('ChaletWoodDark', 0x8E6146, 0.8), shutter=mat('Shutter', 0x8FBFA8, 0.7),
    geranium=mat('Geranium', 0xF2808A, 0.6), towerglass=mat('TowerGlass', 0xA9D4E6, 0.08),
    band=mat('Band', 0xFBFAF6, 0.5), railing=mat('Railing', 0x5E5A70, 0.5), water=mat('Water', 0x9ED8EA, 0.05),
    sail=mat('Sail', 0xFFFDF7, 0.7), hull=mat('Hull', 0xFBFAF6, 0.4), shirt=mat('Shirt', 0x9FD8C4, 0.8),
    pants=mat('Pants', 0x6F7BA3, 0.8), skin=mat('Skin', 0xF6D2B8, 0.7), hair=mat('Hair', 0x7A5A48, 0.8),
    balloon=mat('Balloon', 0xF4A99B, 0.7), balloon2=mat('BalloonStripe', 0xFFF4D6, 0.7),
    rope=mat('Rope', 0xA88A6A, 0.9), cab=mat('Cab', 0xA2CBEF, 0.5), steel=mat('Steel', 0xF2F0F6, 0.35),
    lighthouse_red=mat('LighthouseRed', 0xEE8E86, 0.6), umbrella=mat('Umbrella', 0xFFD88F, 0.7),
    tank=mat('Tank', 0xC9A27E, 0.8), plantbox=mat('Planting', 0x86BD80, 1.0), beak=mat('Beak', 0xF6B26B, 0.6),
    duck=mat('Duck', 0xFFF6E0, 0.6), eye=mat('Eye', 0x3A3550, 0.4),
)

def ring_wall(r_out, r_in, h, seg=32):
    """Hollow cylinder wall (outer side, inner side, top) centred on origin, base y=0."""
    V, N, F = [], [], []
    for i in range(seg + 1):
        a = i / seg * 2 * math.pi
        c, s = math.cos(a), math.sin(a)
        V += [Vector((r_out * c, 0, r_out * s)), Vector((r_out * c, h, r_out * s))]; N += [Vector((c, 0, s))] * 2
    for i in range(seg):
        a = 2 * i; F.append((a, a + 1, a + 3, a + 2))
    b = len(V)
    for i in range(seg + 1):
        a = i / seg * 2 * math.pi
        c, s = math.cos(a), math.sin(a)
        V += [Vector((r_in * c, 0, r_in * s)), Vector((r_in * c, h, r_in * s))]; N += [Vector((-c, 0, -s))] * 2
    for i in range(seg):
        a = b + 2 * i; F.append((a, a + 2, a + 3, a + 1))
    b = len(V)
    for i in range(seg + 1):
        a = i / seg * 2 * math.pi
        c, s = math.cos(a), math.sin(a)
        V += [Vector((r_out * c, h, r_out * s)), Vector((r_in * c, h, r_in * s))]; N += [Vector((0, 1, 0))] * 2
    for i in range(seg):
        a = b + 2 * i; F.append((a, a + 1, a + 3, a + 2))
    return V, N, F

def gore(rx, ry, rz, ph0, ph1, seg=4, rings=12, th0=0.0, th1=math.pi):
    """Slice of an ellipsoid between longitudes ph0..ph1 and latitudes th0..th1."""
    V, N, F = [], [], []
    for j in range(rings + 1):
        th = th0 + (th1 - th0) * j / rings
        for i in range(seg + 1):
            ph = ph0 + (ph1 - ph0) * i / seg
            x, y, z = math.sin(th) * math.cos(ph), math.cos(th), math.sin(th) * math.sin(ph)
            V.append(Vector((x * rx, y * ry, z * rz))); N.append(Vector((x / rx, y / ry, z / rz)).normalized())
    for j in range(rings):
        for i in range(seg):
            a = j * (seg + 1) + i; b = a + seg + 1
            F.append((a, a + 1, b + 1, b))
    return V, N, F

def thin_tri(a, b, c):
    """Double-sided flat triangle (sails)."""
    return flat([[a, b, c], [a, c, b]])

def win(x, y, z, ry, w=1.1, h=1.4, frame=None, glass=None, sill=True):
    frame = frame or M['frame']; glass = glass or M['window']
    P = [(xf(rbox(w + 0.18, h + 0.18, 0.1, 0.03, 4)), frame), (xf(rbox(w, h, 0.12, 0.02, 4), (0, 0, 0.01)), glass),
         (xf(rbox(0.05, h, 0.14, 0.0), (0, 0, 0.02)), frame)]
    if sill:
        P.append((xf(rbox(w + 0.3, 0.08, 0.22, 0.03, 4), (0, -h / 2 - 0.1, 0.06)), frame))
    return [(xf(p, (x, y, z), (0, ry, 0)), m) for p, m in P]

def faces(w, d):
    """(offset fn, rotation) for the four facades: front +Z, back, right +X, left."""
    return [(lambda u, w=w, d=d: (u, d / 2 + 0.04), 0.0, w), (lambda u, w=w, d=d: (-u, -d / 2 - 0.04), math.pi, w),
            (lambda u, w=w, d=d: (w / 2 + 0.04, -u), math.pi / 2, d), (lambda u, w=w, d=d: (-w / 2 - 0.04, u), -math.pi / 2, d)]

def flat_roof(w, d, y, par=0.45, extras=True):
    P = [(xf(rbox(w - 0.3, 0.08, d - 0.3, 0.0), (0, y + 0.04, 0)), M['roofflat'])]
    for (sx, sz, lx, lz) in ((0, d / 2 - 0.13, w, 0.26), (0, -d / 2 + 0.13, w, 0.26), (w / 2 - 0.13, 0, 0.26, d), (-w / 2 + 0.13, 0, 0.26, d)):
        P.append((xf(rbox(lx, par, lz, 0.05, 4), (sx, y + par / 2, sz)), M['parapet']))
    if extras:
        P += [(xf(rbox(1.5, 0.9, 1.1, 0.1, 4), (-w * 0.22, y + 0.45, -d * 0.18)), M['ac']),
              (xf(cyl(0.35, 0.35, 0.12, 14), (-w * 0.22, y + 0.95, -d * 0.18)), M['trim']),
              (xf(rbox(2.2, 0.4, 0.8, 0.12, 4), (w * 0.2, y + 0.2, d * 0.25)), M['wood']),
              (xf(rbox(2.0, 0.25, 0.6, 0.1, 4), (w * 0.2, y + 0.5, d * 0.25)), M['plantbox'])]
    return P


# ---------------------------------------------------------------- city buildings
def apt_a(w=11.0, d=11.0, floors=4):
    fh = 3.1; g = 3.6; H = g + floors * fh
    P = [(xf(rbox(w, H, d, 0.12, 6), (0, H / 2, 0)), M['wall']),
         (xf(rbox(w + 0.1, g, d + 0.1, 0.12, 6), (0, g / 2, 0)), M['band'])]
    for f in range(floors):
        y = g + f * fh + 1.6
        P.append((xf(rbox(w + 0.12, 0.16, d + 0.12, 0.08, 4), (0, g + f * fh + 0.02, 0)), M['band']))
        for off, ry, span in faces(w, d):
            for k in (-1, 0, 1):
                x, z = off(k * span * 0.3)
                P += win(x, y, z, ry, 1.2, 1.5)
        if f < floors:  # front balconies
            for k in (-1, 1):
                x = k * w * 0.3
                P.append((xf(rbox(2.2, 0.14, 1.0, 0.05, 4), (x, g + f * fh + 0.1, d / 2 + 0.5)), M['band']))
                P.append((xf(rbox(2.2, 0.75, 0.05, 0.02, 4), (x, g + f * fh + 0.55, d / 2 + 0.98)), M['railing']))
                for s in (-1, 1):
                    P.append((xf(rbox(0.05, 0.75, 1.0, 0.02, 4), (x + s * 1.08, g + f * fh + 0.55, d / 2 + 0.5)), M['railing']))
    zf = d / 2 + 0.06
    P += [(xf(rbox(w * 0.62, 2.4, 0.12, 0.04, 4), (-w * 0.12, 1.5, zf)), M['frame']),
          (xf(rbox(w * 0.6, 2.2, 0.14, 0.03, 4), (-w * 0.12, 1.5, zf)), M['window']),
          (xf(rbox(1.3, 2.5, 0.16, 0.03, 4), (w * 0.34, 1.25, zf)), M['door'])]
    n = 9; aw = w * 0.7 / n
    for i in range(n):
        P.append((xf(rbox(aw, 0.07, 1.5, 0.02, 4), (-w * 0.47 + aw * (i + 0.5), 3.0, zf + 0.7), (0.3, 0, 0)), M['awning'] if i % 2 == 0 else M['awning2']))
    P += flat_roof(w, d, H)
    P += [(xf(cyl(0.9, 0.9, 1.6, 16), (w * 0.25, H + 1.9, -d * 0.2)), M['tank']), (xf(cyl(0.95, 0.2, 0.6, 16), (w * 0.25, H + 3.0, -d * 0.2)), M['tank'])]
    for sx in (-0.6, 0.6):
        for sz in (-0.6, 0.6):
            P.append((xf(rbox(0.1, 1.1, 0.1, 0.0), (w * 0.25 + sx, H + 0.55, -d * 0.2 + sz)), M['pole']))
    return P

def apt_b(w=10.6, d=10.6, floors=4):
    """Paris-style: cream stone, tall windows, little iron balconies, mansard roof with dormers."""
    fh = 3.2; g = 4.0; H = g + floors * fh
    P = [(xf(rbox(w, H, d, 0.08, 4), (0, H / 2, 0)), M['wall']),
         (xf(rbox(w + 0.14, 0.35, d + 0.14, 0.06, 4), (0, g, 0)), M['band']),
         (xf(rbox(w + 0.3, 0.3, d + 0.3, 0.08, 4), (0, H - 0.1, 0)), M['band'])]
    for f in range(floors):
        y = g + f * fh + 1.7
        for off, ry, span in faces(w, d):
            for k in (-1.5, -0.5, 0.5, 1.5):
                x, z = off(k * span * 0.22)
                P += win(x, y, z, ry, 0.95, 1.9)
                if f in (0, 2):
                    bx, bz = off(k * span * 0.22)
                    rr = (0, ry, 0)
                    P.append((xf(xf(rbox(1.3, 0.1, 0.5, 0.03, 4), (0, -0.95, 0.25)), (bx, y, bz), rr), M['band']))
                    P.append((xf(xf(rbox(1.3, 0.6, 0.04, 0.02, 4), (0, -0.62, 0.48)), (bx, y, bz), rr), M['railing']))
    zf = d / 2 + 0.06
    for k in (-1.5, -0.5, 0.5, 1.5):
        x = k * w * 0.22
        P += [(xf(rbox(1.7, 3.0, 0.12, 0.6, 6), (x, 1.75, zf)), M['frame']), (xf(rbox(1.5, 2.8, 0.14, 0.55, 6), (x, 1.7, zf + 0.01)), M['window'])]
    # mansard: steep slate slopes + dormers
    mh = 2.6; beta = 0.35; inset = mh * math.tan(beta)
    yb = H + 0.05; ln = mh / math.cos(beta)
    for s in (1, -1):
        P.append((xf(rbox(w + 0.1, ln, 0.18, 0.06, 4), (0, yb + mh / 2, s * (d / 2 - inset / 2)), (-s * beta, 0, 0)), M['roof']))
        P.append((xf(rbox(0.18, ln, d + 0.1, 0.06, 4), (s * (w / 2 - inset / 2), yb + mh / 2, 0), (0, 0, s * beta)), M['roof']))
    P.append((xf(rbox(w - 2 * inset - 0.1, mh, d - 2 * inset - 0.1, 0.1, 4), (0, yb + mh / 2, 0)), M['wall']))
    P.append((xf(rbox(w - 2 * inset + 0.3, 0.2, d - 2 * inset + 0.3, 0.08, 4), (0, yb + mh + 0.1, 0)), M['roof']))
    for k in (-1, 0, 1):
        for s in (1, -1):
            z = s * (d / 2 - inset * 0.55)
            P += [(xf(rbox(1.2, 1.4, 0.9, 0.08, 4), (k * w * 0.3, yb + 1.1, z)), M['band']),
                  (xf(rbox(0.75, 0.9, 0.12, 0.03, 4), (k * w * 0.3, yb + 1.05, z + s * 0.45)), M['window']),
                  (xf(rbox(1.4, 0.12, 1.1, 0.05, 4), (k * w * 0.3, yb + 1.85, z)), M['roof'])]
    for x in (-w * 0.3, w * 0.3):
        P.append((xf(rbox(0.8, 1.4, 0.6, 0.05, 4), (x, yb + mh + 0.7, -d * 0.1)), M['brick']))
    return P

def glass_tower(w=11.0, d=11.0, floors=8):
    fh = 3.3; g = 4.2; H = g + floors * fh
    r = 1.6
    P = [(xf(rbox(w, g, d, r, 8), (0, g / 2, 0)), M['band']),
         (xf(rbox(w - 0.5, H - g, d - 0.5, r - 0.2, 8), (0, g + (H - g) / 2, 0)), M['towerglass'])]
    for f in range(floors + 1):
        P.append((xf(rbox(w - 0.2, 0.3, d - 0.2, r - 0.1, 8), (0, g + f * fh, 0)), M['band']))
    for k in range(-2, 3):  # slim vertical fins on the flat parts of each face
        x = k * (w - 2 * r) / 4.5
        for (px, pz, ry) in ((x, d / 2 - 0.2, 0), (x, -d / 2 + 0.2, 0), (w / 2 - 0.2, x, math.pi / 2), (-w / 2 + 0.2, x, math.pi / 2)):
            P.append((xf(rbox(0.12, H - g, 0.12, 0.0), (px, g + (H - g) / 2, pz), (0, ry, 0)), M['band']))
    zf = d / 2 + 0.05
    P += [(xf(rbox(4.0, 3.2, 0.14, 0.05, 4), (0, 1.7, zf)), M['towerglass']), (xf(rbox(4.6, 0.25, 1.8, 0.1, 4), (0, 3.5, zf + 0.8)), M['band'])]
    top = H
    P += [(xf(rbox(w - 3, 2.4, d - 3, r - 0.6, 8), (0, top + 1.2, 0)), M['towerglass']),
          (xf(rbox(w - 2.7, 0.3, d - 2.7, r - 0.5, 8), (0, top + 2.5, 0)), M['band']),
          (xf(rbox(w - 0.3, 0.25, d - 0.3, r - 0.1, 8), (0, top + 0.1, 0)), M['band']),
          (xf(cyl(0.12, 0.2, 5.0, 10), (1.2, top + 5.0, -1.0)), M['steel']),
          (xf(sphere(0.25, 0.25, 0.25, 10, 8), (1.2, top + 7.6, -1.0)), M['tail'])]
    for (sx, sz) in ((-1, -1), (1, 1), (-1, 1)):
        P.append((xf(sphere(0.8, 0.6, 0.8, 10, 7), (sx * (w / 2 - 1.3), top + 0.6, sz * (d / 2 - 1.3))), M['leaf']))
    return P

def office_step():
    P = []
    tiers = ((11.0, 11.0, 4, 0.9), (9.0, 9.0, 3, 0.9), (6.6, 6.6, 2, 0.8))
    y = 0.0; fh = 3.2
    for i, (w, d, floors, r) in enumerate(tiers):
        h = floors * fh + (1.0 if i == 0 else 0)
        P.append((xf(rbox(w, h, d, r, 6), (0, y + h / 2, 0)), M['wall']))
        for f in range(floors):
            yy = y + (1.0 if i == 0 else 0) + f * fh + 1.6
            P.append((xf(rbox(w + 0.12, 1.3, d + 0.12, r, 6), (0, yy, 0)), M['towerglass']))
        y += h
        P.append((xf(rbox(w + 0.3, 0.3, d + 0.3, r + 0.1, 6), (0, y + 0.15, 0)), M['band']))
        y += 0.3
    P += [(xf(cyl(1.2, 1.2, 0.8, 18), (0, y + 0.4, 0)), M['ac']), (xf(cyl(0.08, 0.08, 4.0, 8), (2.0, y + 2.0, 1.5)), M['steel']),
          (xf(rbox(3.6, 3.0, 0.14, 0.05, 4), (0, 1.6, 5.56)), M['towerglass']), (xf(rbox(4.4, 0.3, 1.6, 0.1, 4), (0, 3.3, 6.2)), M['awning'])]
    return P

def cafe():
    w, d, H = 10.0, 8.0, 6.6
    P = [(xf(rbox(w, H, d, 0.1, 4), (0, H / 2, -1.5)), M['wall']), (xf(rbox(w + 0.2, 0.25, d + 0.2, 0.08, 4), (0, 3.3, -1.5)), M['band'])]
    zf = d / 2 - 1.5 + 0.06
    P += [(xf(rbox(w * 0.8, 2.6, 0.12, 0.05, 4), (0, 1.6, zf)), M['frame']), (xf(rbox(w * 0.78, 2.4, 0.14, 0.04, 4), (0, 1.6, zf)), M['window'])]
    for k in (-1, 0, 1):
        P += win(k * 3.0, 4.9, zf, 0, 1.1, 1.3)
    n = 10; aw = w * 0.9 / n
    for i in range(n):
        P.append((xf(rbox(aw, 0.07, 1.8, 0.02, 4), (-w * 0.45 + aw * (i + 0.5), 3.05, zf + 0.85), (0.32, 0, 0)), M['awning'] if i % 2 == 0 else M['awning2']))
    P += flat_roof(w, d, H, 0.4, False)
    for x in (-3.2, 0.2, 3.6):  # terrace tables with umbrellas
        z = zf + 2.6
        P += [(xf(cyl(0.05, 0.05, 2.3, 8), (x, 1.15, z)), M['pole']), (xf(cyl(0.05, 1.3, 0.5, 16), (x, 2.4, z)), M['umbrella']),
              (xf(cyl(0.45, 0.45, 0.06, 16), (x, 0.75, z)), M['band']), (xf(cyl(0.06, 0.12, 0.75, 8), (x, 0.37, z)), M['pole'])]
        for s in (-1, 1):
            P += [(xf(rbox(0.4, 0.06, 0.4, 0.02, 4), (x + s * 0.75, 0.45, z)), M['wood']), (xf(rbox(0.06, 0.45, 0.4, 0.02, 4), (x + s * 0.95, 0.7, z)), M['wood'])]
    return P

build('City_Apartment', apt_a())
build('City_Parisian', apt_b())
build('City_Tower', glass_tower())
build('City_Office', office_step())
build('City_Cafe', cafe())


# ---------------------------------------------------------------- swiss chalet
def chalet(w=9.0, d=8.0):
    P = [(xf(rbox(w + 0.3, 0.8, d + 0.3, 0.08, 4), (0, 0.4, 0)), M['stone'])]
    P.append((xf(rbox(w, 2.6, d, 0.06, 4), (0, 0.8 + 1.3, 0)), M['plaster']))
    P.append((xf(rbox(w + 0.06, 2.6, d + 0.06, 0.05, 4), (0, 3.4 + 1.3, 0)), M['cwood']))
    for k in range(9):  # log lines on the upper floor
        P.append((xf(rbox(w + 0.12, 0.05, d + 0.12, 0.02, 4), (0, 3.5 + k * 0.29, 0)), M['cwooddark']))
    yt = 6.0; rh = 2.2
    P.append((xf(prism(d, w, rh), (0, yt, 0), (0, math.pi / 2, 0)), M['cwood']))
    o_side, o_end, th = 1.1, 1.4, 0.26
    a = math.atan2(rh, w / 2); half = w / 2 + o_side; L = half / math.cos(a) + 0.05
    for s in (1, -1):
        y = yt + rh - (half / 2) * math.tan(a) + th / 2 * math.cos(a)
        x = s * (half / 2 + th / 2 * math.sin(a))
        P.append((xf(rbox(L, th, d + 2 * o_end, 0.06, 4), (x, y, 0), (0, 0, -s * a)), M['roof']))
        P.append((xf(rbox(L, 0.1, 0.18, 0.02, 4), (x, y - 0.17, d / 2 + o_end - 0.08), (0, 0, -s * a)), M['cwooddark']))
    P.append((xf(rbox(0.5, 0.2, d + 2 * o_end + 0.1, 0.08, 4), (0, yt + rh + 0.06, 0)), M['roof']))
    zf = d / 2 + 0.05
    # ground floor windows with shutters + door
    for x in (-w * 0.3, w * 0.3):
        P += win(x, 2.2, zf, 0, 0.9, 1.1)
        for s in (-1, 1):
            P.append((xf(rbox(0.45, 1.2, 0.08, 0.03, 4), (x + s * 0.72, 2.2, zf + 0.04)), M['shutter']))
    P += [(xf(rbox(1.1, 2.0, 0.14, 0.04, 4), (0, 1.8, zf)), M['cwooddark'])]
    # balcony across the upper front with flower boxes
    P.append((xf(rbox(w + 0.6, 0.16, 1.3, 0.04, 4), (0, 3.5, zf + 0.6)), M['cwooddark']))
    P.append((xf(rbox(w + 0.6, 0.1, 0.1, 0.03, 4), (0, 4.45, zf + 1.2)), M['cwooddark']))
    for k in range(int((w + 0.4) / 0.32)):
        P.append((xf(rbox(0.16, 0.9, 0.05, 0.02, 4), (-w / 2 - 0.2 + k * 0.32 + 0.16, 4.0, zf + 1.22)), M['cwood']))
    for x in (-w * 0.32, 0, w * 0.32):
        P.append((xf(rbox(1.6, 0.25, 0.3, 0.05, 4), (x, 4.6, zf + 1.25)), M['cwooddark']))
        for k in range(5):
            P.append((xf(sphere(0.14, 0.13, 0.14, 8, 6), (x - 0.6 + k * 0.3, 4.8, zf + 1.25)), M['geranium']))
        P.append((xf(sphere(0.6, 0.12, 0.12, 8, 5), (x, 4.75, zf + 1.4)), M['leaf']))
    for x in (-w * 0.32, 0, w * 0.32):
        P += win(x, 5.0, zf + 0.05, 0, 0.8, 1.0, sill=False)
        for s in (-1, 1):
            P.append((xf(rbox(0.4, 1.1, 0.08, 0.03, 4), (x + s * 0.62, 5.0, zf + 0.1)), M['shutter']))
    P += win(0, yt + 0.9, zf + 0.05, 0, 0.7, 0.8, sill=False)
    for x in (-w * 0.25, w * 0.25):
        P += win(x, 2.2, -zf, math.pi, 0.9, 1.1)
    for off, ry, span in faces(w, d)[2:]:
        x, z = off(0)
        P += win(x, 2.2, z, ry, 0.9, 1.1)
        P += win(x, 5.0, z, ry, 0.8, 1.0)
    for k in range(4):  # firewood stack on the side
        for j in range(6):
            P.append((xf(cyl(0.12, 0.12, 0.9, 8), (w / 2 + 0.55, 0.95 + k * 0.24, -1.5 + j * 0.25 + (k % 2) * 0.12), (math.pi / 2, 0, math.pi / 2)), M['cwood']))
    P.append((xf(rbox(0.8, 1.5, 0.8, 0.05, 4), (-w * 0.25, yt + 1.4, -1.5)), M['stone']))
    return P
build('Chalet', chalet())


# ---------------------------------------------------------------- stone arch bridge
def bridge(W=12.4, L=17.0, span=8.0, rise=1.3, apex=-0.55, foot=-3.6):
    """Road runs along local Z. Deck top at y=0 (road strip sits just above)."""
    r = (span * span / 4 + rise * rise) / (2 * rise)
    def yb(z):
        if abs(z) < span / 2:
            return apex - r + math.sqrt(r * r - z * z)
        return foot
    P = []
    n = 40
    zs = sorted(set([-L / 2 + L * i / n for i in range(n + 1)] + [-span / 2, span / 2]))
    tris = []
    for side in (1, -1):
        x = side * W / 2
        for i in range(len(zs) - 1):
            z0, z1 = zs[i], zs[i + 1]
            b0, b1 = yb(z0 + 1e-6 if z0 == -span / 2 else z0), yb(z1 - 1e-6 if z1 == span / 2 else z1)
            q = [(x, b0, z0), (x, b1, z1), (x, 0, z1), (x, 0, z0)]
            tris.append(q if side < 0 else list(reversed(q)))
    for i in range(len(zs) - 1):  # underside
        z0, z1 = zs[i], zs[i + 1]
        b0, b1 = yb(z0 + 1e-6 if z0 == -span / 2 else z0), yb(z1 - 1e-6 if z1 == span / 2 else z1)
        tris.append([(W / 2, b0, z0), (W / 2, b1, z1), (-W / 2, b1, z1), (-W / 2, b0, z0)])
    for z in (-span / 2, span / 2):  # pier faces under the arch springs
        sg = 1 if z < 0 else -1
        q = [(W / 2, yb(z + sg * 1e-6), z), (-W / 2, yb(z + sg * 1e-6), z), (-W / 2, foot, z), (W / 2, foot, z)]
        tris.append(q if sg > 0 else list(reversed(q)))
    P.append((flat(tris), M['stone']))
    P.append((xf(rbox(W - 0.1, 0.12, L, 0.0), (0, -0.06, 0)), M['stonedark']))
    # voussoir ring: lighter stones around the arch on both faces
    for side in (1, -1):
        for k in range(13):
            t = -1 + 2 * k / 12
            z = t * span / 2 * 0.98
            y = yb(z)
            ang = math.atan2(z, (y - (apex - r)))
            P.append((xf(rbox(0.2, 0.55, 0.55, 0.06, 4), (side * (W / 2 + 0.06), y + 0.22, z), (ang, 0, 0)), M['stonedark']))
    for side in (1, -1):  # parapets with caps
        x = side * (W / 2 - 0.25)
        P.append((xf(rbox(0.5, 0.95, L + 0.4, 0.06, 4), (x, 0.47, 0)), M['stone']))
        P.append((xf(rbox(0.66, 0.16, L + 0.6, 0.06, 4), (x, 1.0, 0)), M['stonedark']))
        for z in (-L / 2 - 0.2, L / 2 + 0.2):
            P.append((xf(rbox(0.9, 1.4, 0.9, 0.1, 4), (x, 0.7, z)), M['stonedark']))
            P.append((xf(sphere(0.32, 0.32, 0.32, 10, 8), (x, 1.62, z)), M['stone']))
    for z in (-span / 2 - 0.9, span / 2 + 0.9):  # cutwater piers into the river
        for side in (1, -1):
            P.append((xf(rbox(1.2, 3.6, 1.6, 0.25, 4), (side * (W / 2 - 0.1), foot + 1.6, z)), M['stonedark']))
    return P
build('Bridge', bridge())


# ---------------------------------------------------------------- landmarks
def fountain():
    P = [(xf(ring_wall(3.4, 3.0, 0.6, 40)), M['stone']), (xf(cyl(3.05, 3.05, 0.1, 40), (0, 0.42, 0)), M['water']),
         (xf(cyl(0.45, 0.6, 1.4, 18), (0, 0.7, 0)), M['stone']), (xf(cyl(1.5, 0.5, 0.35, 24), (0, 1.5, 0)), M['stone']),
         (xf(cyl(1.35, 1.35, 0.06, 24), (0, 1.66, 0)), M['water']), (xf(cyl(0.2, 0.3, 0.9, 12), (0, 2.1, 0)), M['stone']),
         (xf(cyl(0.7, 0.25, 0.25, 18), (0, 2.6, 0)), M['stone']), (xf(sphere(0.35, 0.55, 0.35, 12, 10), (0, 3.0, 0)), M['water'])]
    for k in range(8):
        a = k / 8 * 2 * math.pi
        P.append((xf(sphere(0.12, 0.35, 0.12, 8, 6), (math.cos(a) * 1.55, 1.25, math.sin(a) * 1.55)), M['water']))
    return P
build('Fountain', fountain())

def ferris_base():
    H = 9.4; P = []
    for z in (-1.3, 1.3):
        for s in (-1, 1):
            dx, dy = s * 4.6, -H
            L = math.hypot(dx, dy); ang = math.atan2(dx, -dy)
            P.append((xf(cyl(0.16, 0.22, L, 10), (s * 2.3, H / 2, z), (0, 0, ang)), M['steel']))
        P.append((xf(rbox(5.4, 0.18, 0.18, 0.06, 4), (0, 3.2, z)), M['steel']))
    P += [(xf(cyl(0.35, 0.35, 3.2, 16), (0, H, 0), (math.pi / 2, 0, 0)), M['trim']),
          (xf(rbox(11.0, 0.3, 4.4, 0.12, 4), (0, 0.15, 0)), M['stone']),
          (xf(rbox(2.4, 2.4, 2.0, 0.15, 4), (4.4, 1.5, 2.6)), M['wall']), (xf(rbox(2.8, 0.2, 2.4, 0.08, 4), (4.4, 2.8, 2.6)), M['awning'])]
    return P
def ferris_wheel(R0=7.2, cabs=10):
    P = []
    for z in (-0.95, 0.95):
        P.append((xf(torus_arc(R0, 0.11, 2 * math.pi, 64, 8), (0, 0, z)), M['steel']))
        P.append((xf(torus_arc(R0 * 0.55, 0.07, 2 * math.pi, 48, 6), (0, 0, z)), M['steel']))
        for k in range(cabs):
            a = k / cabs * 2 * math.pi
            P.append((xf(rbox(0.1, R0, 0.1, 0.0), (math.cos(a) * R0 / 2, math.sin(a) * R0 / 2, z), (0, 0, a - math.pi / 2)), M['steel']))
    for k in range(cabs):
        a = k / cabs * 2 * math.pi
        P.append((xf(cyl(0.06, 0.06, 2.1, 8), (math.cos(a) * R0, math.sin(a) * R0, 0), (math.pi / 2, 0, 0)), M['steel']))
        P.append((xf(sphere(0.14, 0.14, 0.14, 8, 6), (math.cos(a) * R0, math.sin(a) * R0, 1.05)), M['tail']))
    P.append((xf(cyl(0.55, 0.55, 2.3, 18), (0, 0, 0), (math.pi / 2, 0, 0)), M['band']))
    return P
def ferris_cab():
    return [(xf(cyl(0.04, 0.04, 0.7, 6), (0, -0.35, 0)), M['steel']),
            (xf(rbox(1.3, 1.15, 1.2, 0.3, 6), (0, -1.3, 0)), M['cab']),
            (xf(rbox(1.36, 0.5, 1.26, 0.2, 6), (0, -1.15, 0)), M['window']),
            (xf(sphere(0.75, 0.3, 0.7, 14, 6), (0, -0.7, 0)), M['band'])]
build('Ferris_Base', ferris_base())
build('Ferris_Wheel', ferris_wheel())
build('Ferris_Cab', ferris_cab())

def windmill_body():
    P = [(xf(cyl(2.0, 2.0, 0.6, 8), (0, 0.3, 0)), M['stone']),
         (xf(cyl(1.45, 2.1, 7.6, 8), (0, 4.4, 0)), M['plaster']),
         (xf(cyl(1.55, 1.55, 0.25, 8), (0, 8.2, 0)), M['cwooddark']),
         (xf(sphere(1.7, 1.6, 1.9, 16, 10), (0, 8.35, 0)), M['roof']),
         (xf(rbox(1.0, 1.8, 0.14, 0.4, 6), (0, 1.5, 2.0)), M['cwooddark']),
         (xf(cyl(0.3, 0.38, 0.9, 12), (0, 8.6, 1.6), (math.pi / 2, 0, 0)), M['cwooddark'])]
    for y, ry in ((4.0, 0.0), (6.0, math.pi * 0.25), (5.0, math.pi)):
        z = 1.8 - (y - 0.6) * 0.085
        P += win(math.sin(ry) * z, y, math.cos(ry) * z, ry, 0.6, 0.8, sill=False)
    P.append((xf(cyl(2.6, 2.6, 0.12, 16), (0, 3.0, 0)), M['cwood']))
    for k in range(16):
        a = k / 16 * 2 * math.pi
        P.append((xf(rbox(0.05, 0.8, 0.05, 0.0), (math.cos(a) * 2.55, 3.45, math.sin(a) * 2.55)), M['cwooddark']))
    P.append((xf(torus_arc(2.55, 0.04, 2 * math.pi, 32, 4), (0, 3.85, 0), (math.pi / 2, 0, 0)), M['cwooddark']))
    return P
def windmill_blades(L=5.6):
    P = [(xf(cyl(0.35, 0.35, 0.5, 14), (0, 0, 0.1), (math.pi / 2, 0, 0)), M['cwooddark'])]
    for k in range(4):
        a = k * math.pi / 2
        c, s = math.cos(a), math.sin(a)
        P.append((xf(rbox(0.18, L, 0.18, 0.04, 4), (-s * L / 2, c * L / 2, 0.3), (0, 0, a)), M['cwooddark']))
        P.append((xf(rbox(1.25, L * 0.78, 0.05, 0.03, 4), (-s * L * 0.58 + c * 0.75, c * L * 0.58 + s * 0.75, 0.38), (0, 0, a)), M['sail']))
        for j in range(5):
            t = 0.25 + j * 0.17
            P.append((xf(rbox(1.35, 0.06, 0.07, 0.0), (-s * L * t + c * 0.72, c * L * t + s * 0.72, 0.42), (0, 0, a)), M['cwooddark']))
    return P
build('Windmill_Body', windmill_body())
build('Windmill_Blades', windmill_blades())

def lighthouse():
    P = [(xf(cyl(2.6, 2.9, 1.0, 24), (0, 0.5, 0)), M['stone'])]
    H = 11.0; n = 7
    for k in range(n):
        y0, y1 = 1.0 + k * (H - 1) / n, 1.0 + (k + 1) * (H - 1) / n
        r0 = 1.55 - 0.45 * (y0 - 1) / (H - 1); r1 = 1.55 - 0.45 * (y1 - 1) / (H - 1)
        P.append((xf(cyl(r1, r0, y1 - y0, 24), (0, (y0 + y1) / 2, 0)), M['lighthouse_red'] if k % 2 == 0 else M['band']))
    P += [(xf(cyl(1.7, 1.5, 0.3, 24), (0, H + 0.15, 0)), M['railing']),
          (xf(torus_arc(1.62, 0.04, 2 * math.pi, 32, 4), (0, H + 0.9, 0), (math.pi / 2, 0, 0)), M['railing']),
          (xf(cyl(0.85, 0.85, 1.3, 16), (0, H + 1.0, 0)), M['lamphead']),
          (xf(cyl(0.2, 1.05, 0.9, 16), (0, H + 2.1, 0)), M['lighthouse_red']),
          (xf(sphere(0.22, 0.22, 0.22, 10, 8), (0, H + 2.65, 0)), M['railing']),
          (xf(rbox(0.9, 1.8, 0.12, 0.35, 6), (0, 1.9, 1.52)), M['cwooddark'])]
    for k in range(12):
        a = k / 12 * 2 * math.pi
        P.append((xf(rbox(0.04, 0.75, 0.04, 0.0), (math.cos(a) * 1.62, H + 0.55, math.sin(a) * 1.62)), M['railing']))
    for y in (4.0, 7.0):
        P += win(0, y, 1.5 - 0.45 * (y - 1) / (H - 1) + 0.02, 0, 0.45, 0.7, sill=False)
    # keeper's cottage
    P += [(xf(rbox(3.6, 2.6, 3.0, 0.06, 4), (3.6, 1.3, -0.6)), M['plaster'])]
    P.append((xf(prism(3.6, 3.0, 1.4), (3.6, 2.6, -0.6)), M['plaster']))
    for s in (1, -1):
        a = math.atan2(1.4, 1.5)
        P.append((xf(rbox(4.0, 0.16, 2.2, 0.05, 4), (3.6, 3.35, -0.6 + s * 0.85), (s * a, 0, 0)), M['lighthouse_red']))
    P += win(3.6, 1.5, 0.94, 0, 0.8, 0.9)
    return P
build('Lighthouse', lighthouse())

def sailboat():
    P = [(xf(sphere(2.3, 0.55, 0.9, 18, 8, ), (0, 0.0, 0)), M['hull']),
         (xf(rbox(3.4, 0.14, 1.3, 0.3, 6), (-0.2, 0.42, 0)), M['wood']),
         (xf(rbox(1.2, 0.5, 0.9, 0.2, 6), (-0.6, 0.7, 0)), M['band']),
         (xf(torus_arc(2.28, 0.05, 2 * math.pi, 40, 4), (0, 0.32, 0), (math.pi / 2, 0, 0), (1, 0.39, 1)), M['accent']),
         (xf(cyl(0.06, 0.07, 5.2, 8), (0.3, 3.0, 0)), M['wood']),
         (xf(cyl(0.04, 0.04, 2.4, 6), (-0.85, 1.1, 0), (0, 0, math.pi / 2)), M['wood'])]
    P.append((thin_tri((0.36, 5.4, 0), (0.36, 1.15, 0), (-2.0, 1.15, 0)), M['sail']))
    P.append((thin_tri((0.25, 5.0, 0), (2.1, 0.75, 0), (0.25, 0.9, 0)), M['sail']))
    P.append((xf(rbox(0.5, 0.35, 0.05, 0.05, 4), (0.3, 5.75, 0)), M['accent']))
    return P
build('Sailboat', sailboat())

def balloon():
    P = []
    g = 14
    for k in range(g):
        P.append((gore(4.0, 4.4, 4.0, k / g * 2 * math.pi, (k + 1) / g * 2 * math.pi, 4, 14, 0, math.pi * 0.72), M['balloon'] if k % 2 == 0 else M['balloon2']))
    P = [(xf(p, (0, 8.0, 0)), m) for p, m in P]
    P.append((xf(cyl(2.55, 0.9, 2.0, 24, False), (0, 4.0 + 0.04, 0)), M['balloon2']))
    P.append((xf(rbox(1.4, 1.0, 1.4, 0.2, 6), (0, 0.5, 0)), M['wood']))
    P.append((xf(rbox(1.5, 0.15, 1.5, 0.07, 4), (0, 1.02, 0)), M['cwooddark']))
    for sx in (-0.6, 0.6):
        for sz in (-0.6, 0.6):
            top = Vector((sx * 1.4, 3.05, sz * 1.4)); bot = Vector((sx, 1.05, sz))
            mid = (top + bot) / 2; dv = top - bot
            ang_z = -math.atan2(dv.x, dv.y); ang_x = math.atan2(dv.z, dv.y)
            P.append((xf(cyl(0.025, 0.025, dv.length, 5), tuple(mid), (ang_x, 0, ang_z)), M['rope']))
    P.append((xf(cyl(0.3, 0.3, 0.4, 10), (0, 1.9, 0)), M['steel']))
    return P
build('Balloon', balloon())

def person():
    P = []
    for s in (-1, 1):
        P += [(xf(rbox(0.16, 0.5, 0.18, 0.07, 4), (s * 0.11, 0.3, 0)), M['pants']),
              (xf(rbox(0.18, 0.1, 0.26, 0.05, 4), (s * 0.11, 0.05, 0.03)), M['dark']),
              (xf(rbox(0.12, 0.42, 0.13, 0.06, 4), (s * 0.3, 0.78, 0), (0, 0, s * 0.12)), M['shirt']),
              (xf(sphere(0.065, 0.065, 0.065, 8, 6), (s * 0.33, 0.55, 0)), M['skin'])]
    P += [(xf(rbox(0.46, 0.5, 0.3, 0.13, 6), (0, 0.78, 0)), M['shirt']),
          (xf(sphere(0.27, 0.26, 0.26, 16, 12), (0, 1.3, 0)), M['skin']),
          (xf(gore(0.29, 0.28, 0.29, 0, 2 * math.pi, 16, 8, 0, math.pi * 0.52), (0, 1.33, -0.02)), M['hair']),
          (xf(sphere(0.035, 0.045, 0.02, 6, 5), (-0.09, 1.3, 0.25)), M['eye']),
          (xf(sphere(0.035, 0.045, 0.02, 6, 5), (0.09, 1.3, 0.25)), M['eye']),
          (xf(sphere(0.05, 0.03, 0.02, 6, 4), (-0.16, 1.22, 0.22)), M['plant']),
          (xf(sphere(0.05, 0.03, 0.02, 6, 4), (0.16, 1.22, 0.22)), M['plant'])]
    return P
build('Person', person())

def duck():
    return [(xf(sphere(0.32, 0.22, 0.22, 12, 8), (0, 0.12, 0)), M['duck']), (xf(sphere(0.15, 0.15, 0.15, 10, 8), (0.25, 0.36, 0)), M['duck']),
            (xf(sphere(0.09, 0.04, 0.06, 8, 5), (0.4, 0.34, 0)), M['beak']), (xf(sphere(0.18, 0.08, 0.1, 8, 5), (-0.3, 0.2, 0), (0, 0, 0.5)), M['duck']),
            (xf(sphere(0.025, 0.025, 0.025, 5, 4), (0.32, 0.4, 0.09)), M['eye']), (xf(sphere(0.025, 0.025, 0.025, 5, 4), (0.32, 0.4, -0.09)), M['eye'])]
build('Duck', duck())

tall = [(xf(cyl(0.12, 0.18, 1.6, 8), (0, 0.8, 0)), M['trunk'])]
for (rr, hh, y) in ((1.35, 2.2, 2.2), (1.1, 2.0, 3.5), (0.85, 1.8, 4.7), (0.55, 1.5, 5.8)):
    tall.append((xf(cyl(0.08, rr, hh, 10), (0, y, 0)), M['leaf']))
build('Tree_PineTall', tall)
build('Tree_Birch', [(xf(cyl(0.1, 0.14, 3.2, 8), (0, 1.6, 0)), M['band']),
                     (xf(sphere(1.0, 1.6, 1.0, 11, 9), (0, 4.0, 0)), M['leaf']),
                     (xf(sphere(0.7, 1.1, 0.7, 10, 8), (0.5, 3.2, 0.3)), M['leaf'])])
build('Boulder', [(xf(sphere(1.2, 0.8, 1.0, 9, 6), (0, 0.35, 0)), M['stonedark']), (xf(sphere(0.7, 0.5, 0.65, 8, 6), (0.9, 0.2, 0.4)), M['stone'])])


# ---------------------------------------------------------------- snow-capped trees
M.update(snowcap=mat('SnowCap', 0xFBFDFF, 0.85), reed=mat('Reed', 0x8DBE72, 0.9), cattail=mat('Cattail', 0x9A6B4F, 0.9),
         lily=mat('Lily', 0x7DBE6E, 0.6), lilyflower=mat('LilyFlower', 0xFFC2D6, 0.6), plank=mat('Plank', 0xC9A07A, 0.85),
         plankdark=mat('PlankDark', 0x9C7556, 0.9), boatwood=mat('BoatWood', 0xD9A37A, 0.7), boatpaint=mat('BoatPaint', 0xA2CBEF, 0.6))

def snowy_tiers(tiers, trunk):
    """Pine tiers (radius, height, y) with a snow cap on the upper part of each tier and drips around the cap rim."""
    P = [trunk]
    for k, (rr, hh, y) in enumerate(tiers):
        P.append((xf(cyl(0.1, rr, hh, 12), (0, y, 0)), M['leaf']))
        top = y + hh / 2
        ch = hh * 0.74                               # cap reaches below the next tier's skirt
        cr = 0.1 + (rr - 0.1) * 0.74                 # cone radius at the cap's lower edge
        P.append((xf(cyl(0.16, cr * 1.1 + 0.05, ch + 0.08, 12), (0, top - ch / 2 + 0.06, 0)), M['snowcap']))
        n = 7
        for i in range(n):                          # soft snow drips on the rim
            a = (i + 0.5 * (k % 2)) / n * 2 * math.pi
            r0 = cr * 1.1 + 0.02
            P.append((xf(sphere(0.16 + 0.04 * (i % 3), 0.11, 0.16, 7, 5), (math.cos(a) * r0, top - ch + 0.04, math.sin(a) * r0)), M['snowcap']))
    return P

build('Tree_PineSnow', snowy_tiers(((1.7, 2.0, 2.0), (1.35, 1.8, 3.2), (0.95, 1.6, 4.3)), (xf(cyl(0.14, 0.2, 1.4, 10), (0, 0.7, 0)), M['trunk'])) +
      [(xf(sphere(0.22, 0.2, 0.22, 8, 6), (0, 5.12, 0)), M['snowcap'])])
build('Tree_PineTallSnow', snowy_tiers(((1.35, 2.2, 2.2), (1.1, 2.0, 3.5), (0.85, 1.8, 4.7), (0.55, 1.5, 5.8)), (xf(cyl(0.12, 0.18, 1.6, 8), (0, 0.8, 0)), M['trunk'])) +
      [(xf(sphere(0.16, 0.16, 0.16, 8, 6), (0, 6.55, 0)), M['snowcap'])])
build('SnowMound', [(xf(sphere(1.1, 0.45, 0.9, 12, 7), (0, 0.05, 0)), M['snowcap']), (xf(sphere(0.6, 0.3, 0.55, 10, 6), (0.8, 0.02, 0.4)), M['snowcap'])])


# ---------------------------------------------------------------- lake dressing
def reeds():
    P = []
    spots = [(0, 0, 1.5), (0.3, 0.15, 1.2), (-0.25, 0.2, 1.35), (0.15, -0.3, 1.0), (-0.35, -0.2, 1.1), (0.45, -0.1, 0.9), (-0.1, 0.4, 1.25), (0.25, 0.4, 0.85), (-0.45, 0.05, 0.95)]
    for i, (x, z, h) in enumerate(spots):
        lean = ((i * 37) % 11 - 5) * 0.02
        P.append((xf(cyl(0.012, 0.03, h, 5), (x, h / 2 - 0.3, z), (lean, 0, -lean)), M['reed']))
        if i % 2 == 0:
            P.append((xf(cyl(0.045, 0.045, 0.22, 8), (x + lean * h * 0.5, h - 0.38, z - lean * h * 0.5)), M['cattail']))
    for i in range(6):  # a few flat leaf blades
        a = i / 6 * 2 * math.pi
        tip = (math.cos(a) * 0.55, 0.9, math.sin(a) * 0.55)
        P.append((thin_tri((math.cos(a + 0.12) * 0.05, -0.3, math.sin(a + 0.12) * 0.05), (math.cos(a - 0.12) * 0.05, -0.3, math.sin(a - 0.12) * 0.05), tip), M['reed']))
    return P
build('Reeds', reeds())

def lily(flower):
    P = [(xf(cyl(0.42, 0.42, 0.03, 18), (0, 0.015, 0)), M['lily']), (xf(rbox(0.36, 0.04, 0.05, 0.0), (0.2, 0.02, 0), (0, 0.35, 0)), M['plankdark'])]
    if flower:
        for k in range(6):
            a = k / 6 * 2 * math.pi
            P.append((xf(sphere(0.07, 0.05, 0.13, 8, 5), (math.cos(a) * 0.08 - 0.05, 0.1, math.sin(a) * 0.08), (0, -a, 0.6)), M['lilyflower']))
        P.append((xf(sphere(0.05, 0.05, 0.05, 6, 5), (-0.05, 0.14, 0)), M['plant']))
    return P
build('LilyPad', lily(False))
build('LilyFlower', lily(True))

def pier(L=9.0, W=2.2, top=0.6):
    """Origin at the shore; the deck runs out over the water along +Z."""
    P = []
    n = int(L / 0.46)
    for i in range(n):
        z = 0.25 + i * 0.46
        P.append((xf(rbox(W + (0.08 if i % 3 == 0 else 0), 0.09, 0.4, 0.03, 4), (0, top - 0.045, z), (0, 0.01 * ((i * 7) % 5 - 2), 0)), M['plank'] if i % 4 else M['plankdark']))
    for z in [0.4 + k * 2.8 for k in range(int(L / 2.8) + 1)]:
        for s in (-1, 1):
            P.append((xf(cyl(0.11, 0.12, 2.6, 8), (s * (W / 2 - 0.05), top - 1.3, min(z, L - 0.1))), M['plankdark']))
    for s in (-1, 1):
        P.append((xf(rbox(0.14, 0.14, L, 0.04, 4), (s * (W / 2 + 0.02), top - 0.16, L / 2)), M['plankdark']))
    for s in (-1, 1):  # bollards + a little lantern at the end
        P.append((xf(cyl(0.12, 0.12, 0.5, 10), (s * (W / 2 - 0.15), top + 0.2, L - 0.3)), M['plankdark']))
    P += [(xf(cyl(0.05, 0.05, 1.6, 8), (W / 2 - 0.15, top + 0.8, L - 0.3)), M['railing']),
          (xf(rbox(0.26, 0.32, 0.26, 0.06, 4), (W / 2 - 0.15, top + 1.7, L - 0.3)), M['lamphead']),
          (xf(rbox(0.32, 0.08, 0.32, 0.03, 4), (W / 2 - 0.15, top + 1.9, L - 0.3)), M['railing'])]
    P += [(xf(rbox(1.5, 0.08, 0.45, 0.03, 4), (-0.2, top + 0.42, L - 1.2)), M['plank']), (xf(rbox(1.5, 0.35, 0.07, 0.03, 4), (-0.2, top + 0.65, L - 0.98)), M['plank']),
          (xf(rbox(0.08, 0.42, 0.4, 0.02, 4), (-0.85, top + 0.2, L - 1.2)), M['plankdark']), (xf(rbox(0.08, 0.42, 0.4, 0.02, 4), (0.45, top + 0.2, L - 1.2)), M['plankdark'])]
    return P
build('Pier', pier())

def inward(part):
    V, N, F = part
    return V, [-n for n in N], F

def rowboat():
    """Origin at the waterline, bow toward +X."""
    P = [(xf(gore(1.7, 0.55, 0.72, 0, 2 * math.pi, 22, 8, math.pi * 0.5, math.pi), (0, 0.18, 0)), M['boatpaint']),
         (xf(torus_arc(1.7, 0.06, 2 * math.pi, 40, 5), (0, 0.19, 0), (math.pi / 2, 0, 0), (1, 0.42, 1)), M['boatwood']),
         (xf(inward(gore(1.6, 0.48, 0.64, 0, 2 * math.pi, 22, 6, math.pi * 0.5, math.pi)), (0, 0.2, 0)), M['boatwood'])]
    for x in (-0.7, 0.15, 0.85):
        P.append((xf(rbox(0.3, 0.06, 1.2 - abs(x) * 0.4, 0.02, 4), (x, 0.1, 0)), M['plank']))
    for s in (-1, 1):
        P.append((xf(cyl(0.025, 0.025, 1.9, 6), (0.1, 0.28, s * 0.62), (0, 0.3 * s, math.pi / 2 - 0.1)), M['plankdark']))
        P.append((xf(rbox(0.32, 0.03, 0.12, 0.02, 4), (-0.8, 0.24, s * 0.9), (0, 0.3 * s, 0)), M['plankdark']))
    return P
build('Rowboat', rowboat())


# ---------------------------------------------------------------- little propeller plane (nose toward +X)
M.update(planebody=mat('PlaneBody', 0xF4A99B, 0.45), planewing=mat('PlaneWing', 0xFFF4D6, 0.5))
def plane():
    P = [(xf(sphere(2.3, 0.78, 0.78, 22, 14), (0, 0, 0)), M['planebody']),
         (xf(cyl(0.62, 0.7, 0.5, 20), (2.0, 0, 0), (0, 0, math.pi / 2)), M['trim']),
         (xf(sphere(0.7, 0.5, 0.55, 16, 10), (0.55, 0.55, 0)), M['window']),
         (xf(rbox(1.5, 0.16, 7.2, 0.08, 6), (0.35, -0.12, 0)), M['planewing']),
         (xf(rbox(1.5, 0.17, 0.6, 0.06, 4), (0.35, -0.11, 3.1)), M['planebody']),
         (xf(rbox(1.5, 0.17, 0.6, 0.06, 4), (0.35, -0.11, -3.1)), M['planebody']),
         (xf(rbox(0.9, 0.12, 2.6, 0.05, 4), (-2.05, 0.1, 0)), M['planewing']),
         (xf(rbox(1.0, 1.1, 0.12, 0.05, 4), (-2.05, 0.6, 0), (0, 0, -0.15)), M['planewing']),
         (xf(sphere(0.12, 0.12, 0.12, 8, 6), (0.35, -0.12, 3.6)), M['tail']),
         (xf(sphere(0.12, 0.12, 0.12, 8, 6), (0.35, -0.12, -3.6)), M['lamp'])]
    for s in (-1, 1):
        P += [(xf(cyl(0.04, 0.04, 0.7, 6), (0.7, -0.75, s * 0.6), (s * 0.3, 0, 0)), M['steel']),
              (xf(cyl(0.18, 0.18, 0.12, 14), (0.7, -1.1, s * 0.72), (math.pi / 2, 0, 0)), M['tire'])]
    return P
def plane_prop():
    P = [(xf(sphere(0.26, 0.26, 0.26, 12, 8), (0, 0, 0), (0, 0, 0), (1.4, 1, 1)), M['planewing'])]
    for k in (0, 1):
        P.append((xf(rbox(0.07, 1.7, 0.2, 0.03, 4), (0.05, 0, 0), (0.25 if k else -0.25, 0, 0)) if False else xf(rbox(0.07, 1.7, 0.2, 0.03, 4), (0.05, 0, 0), (k * math.pi / 2, 0, 0)), M['trim']))
    return P
build('Plane', plane())
build('Plane_Prop', plane_prop())
