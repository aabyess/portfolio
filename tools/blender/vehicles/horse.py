import sys; sys.path.insert(0, "/Users/sang/.claude/jobs/02a78233/tmp/vehicles")
import bpy
from common import reset, export
from horse_lib import build_horse
reset()
build_horse(dy=0.19, saddle=True, name="horse")
export("horse")
