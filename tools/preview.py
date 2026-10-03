"""Close-up previews of named kit assets: blender -b assets/kit.blend -P tools/preview.py -- out.png Name1 Name2 ..."""
import bpy, sys, math
from mathutils import Vector
args = sys.argv[sys.argv.index('--') + 1:]
out, names = args[0], args[1:]
sc = bpy.context.scene
for ob in sc.objects:
    if ob.parent is None and ob.type == 'MESH' and ob.name not in ('Ground',):
        ob.hide_render = ob.name not in names
cols = math.ceil(math.sqrt(len(names))); cell = 0
offs = {'Ferris_Wheel': (0, 0, 9.4), 'Windmill_Blades': (0, -1.9, 8.6)}
for i, n in enumerate(names):
    ob = sc.objects[n]
    cell = max(cell, max(ob.dimensions.x, ob.dimensions.y) + 6)
for i, n in enumerate(names):
    ob = sc.objects[n]
    base = n.split('_')[0] + '_Base' if n == 'Ferris_Wheel' else ('Windmill_Body' if n == 'Windmill_Blades' else None)
    if base and base in names:
        b = sc.objects[base]; o = offs[n]
        ob.location = (b.location.x + o[0], b.location.y + o[1], o[2])
        continue
    ob.location = ((i % cols) * cell, (i // cols) * cell, 0)
g = sc.objects.get('Ground'); g.location = (-200, -200, 0); g.scale = (6, 6, 1)
cam = sc.camera; cam.data.type = 'PERSP'; cam.data.lens = 35
span = cols * cell
cam.location = (span * 0.5 - cell * 0.5 + span * 0.55, -span * 0.75, span * 0.55)
target = Vector((span * 0.5 - cell * 0.5, span * 0.35, 3))
d = target - cam.location
cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
sc.render.resolution_x, sc.render.resolution_y = 1800, 1200
sc.render.filepath = out
bpy.ops.render.render(write_still=True)
