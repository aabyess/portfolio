#!/bin/zsh
# Build all 10 villagers (v5) + king/barmaid into models/npc/*.glb (+ models/src/*.blend), in parallel.
#   NPC_OUT=/some/dir build_all.sh   -> write GLBs there instead (no .blend save)
# Then: Blender -b --factory-startup --python verify_polish.py -- <dir> [<ref_dir>]
#       Blender -b --factory-startup --python preview2.py -- lineup faces walk sit fall
HERE=${0:A:h}
REPO=${HERE:h:h:h}
B=/Applications/Blender.app/Contents/MacOS/Blender
cd $REPO
for n in innkeeper traveler guard blacksmith bard monk maid baker noble herbalist; do
  ($B -b --factory-startup --python $HERE/build_polish.py -- $n 2>&1 | grep -E "BUILT|Error|Traceback") &
done
for n in king barmaid; do   # special NPCs (build_special.py): King 최상호, tavern barmaid
  ($B -b --factory-startup --python $HERE/build_special.py -- $n 2>&1 | grep -E "BUILT|Error|Traceback") &
done
wait
