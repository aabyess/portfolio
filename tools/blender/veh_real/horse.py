import sys; sys.path.insert(0, "/Users/sang/.claude/jobs/02a78233/tmp/veh_real")
import bpy
from mathutils import Vector as V
from common2 import reset, export, empty
from horse_real import Horse, build_actions

reset()
NOEXPORT = '--noexport' in sys.argv
h = Horse(dy=0.19, name="horse")
arm = h.build_armature()
h.build_body()
h.build_details()
parts = h.build_saddle()
br = h.build_bridle()
P = h.P
reins = h.build_reins([P(0.07, -0.33, 1.66), P(-0.07, -0.33, 1.66)], sag=0.10)
extra = parts + [('head', br), ('reins', reins)]
ob = h.finish(extra)
print("SEAT", h.seat_pt)
empty("seat", V((0, h.seat_pt.y, h.seat_pt.z)), parent=arm, parent_bone='body')
build_actions(arm)
ob.data.calc_loop_triangles()
print("TRIS", len(ob.data.loop_triangles))
if NOEXPORT:
    bpy.ops.wm.save_as_mainfile(filepath="/Users/sang/.claude/jobs/02a78233/tmp/veh_real/horse_test.blend")
else:
    export("horse")
