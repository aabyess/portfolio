#!/bin/zsh
# Build the 4 village children into models/npc/npc-kid-*.glb (+ models/src/*.blend), in parallel.
#   NPC_OUT=/some/dir build_all.sh   -> write GLBs there instead (no .blend save)
# Then: Blender -b --factory-startup --python ../npc_polish/verify_polish.py -- <dir> kid-tom kid-finn kid-ella kid-mina
#       Blender -b --factory-startup --python preview_kids.py -- lineup faces run wave
HERE=${0:A:h}
B=/Applications/Blender.app/Contents/MacOS/Blender
LOG=${KID_LOG:-/tmp}
for n in tom finn ella mina; do
  ($B -b --factory-startup --python $HERE/build_kids.py -- $n > $LOG/kidlog_$n.txt 2>&1; grep -hE "KIDBUILT|Error|Traceback" $LOG/kidlog_$n.txt) &
done
wait
