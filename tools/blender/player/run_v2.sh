#!/bin/zsh
# Player v2 pipeline.  usage: run_v2.sh [build|splice|preview <shots...>|inspect|compare] [--nobake]
#   build   : build_player_v2.py -> $TMP/player_mesh.glb (mesh-only, skinned to person.glb bone names)
#   splice  : splice_player.py   -> $OUT (person.glb armature/clips + new mesh)
#   preview : render shots of $OUT into $PREV (default $TMP/prev)
BL=/Applications/Blender.app/Contents/MacOS/Blender
BPY=$(ls -d /Applications/Blender.app/Contents/Resources/*/python/bin/python3* | head -1)
HERE=${0:A:h}
REPO=${HERE:h:h:h}
TMP=${PLAYER_TMP:-/Users/sang/.claude/jobs/02a78233/tmp/player_v2}
OUT=${PLAYER_OUT:-$TMP/player_test.glb}
mkdir -p $TMP
step=$1; shift
case $step in
  build)   $BL -b --factory-startup --python $HERE/build_player_v2.py -- --out $TMP/player_mesh.glb "$@" 2>&1 | grep -E "PARTS|TRIS|FACE|EXPORTED|Error|Traceback|line [0-9]+|pack failed" ;;
  splice)  $BPY $HERE/splice_player.py $REPO/models/person.glb $TMP/player_mesh.glb $OUT ;;
  preview) $BL -b --factory-startup --python $HERE/preview_player.py -- $OUT ${PREV:-$TMP/prev} "$@" 2>&1 | grep -E "BOUNDS|RENDER|Error|Traceback" ;;
  inspect) $BL -b --factory-startup --python $HERE/inspect.py -- $OUT 2>&1 | grep -E "OBJ|tris|bbox|img|nbones|ACT" ;;
  compare) python3 $HERE/gltf_nodes.py $OUT --compare $REPO/models/person.glb ;;
esac
