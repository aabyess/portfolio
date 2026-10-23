#!/bin/zsh
# Quick iteration: build (no AO/normal bake unless FULL=1) -> splice -> render shots -> contact sheet.
# usage: iter_v2.sh sheetname shot1 shot2 ...
HERE=${0:A:h}
BL=/Applications/Blender.app/Contents/MacOS/Blender
TMP=${PLAYER_TMP:-/Users/sang/.claude/jobs/02a78233/tmp/player_v2}
P=${PREV:-$TMP/prev}
name=$1; shift
nb="--nobake"; [[ -n $FULL ]] && nb=""
$BL -b --factory-startup --python $HERE/build_player_v2.py -- $nb --out $TMP/player_mesh.glb 2>&1 | grep -E "TRIS|Error|Traceback|line [0-9]+"
zsh $HERE/run_v2.sh splice | tail -1
PREV=$P zsh $HERE/run_v2.sh preview "$@" | grep -v -E "BOUNDS|RENDER"
files=()
for s in "$@"; do files+=($P/$s.png); done
$BL -b --factory-startup --python $HERE/montage.py -- $P/$name.png ${COLS:-4} ${CELL:-450} $files 2>&1 | grep SHEET
