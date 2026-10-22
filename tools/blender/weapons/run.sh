#!/bin/zsh
# usage: run.sh name [verify-mode]   builds name.py then verifies
D=/Users/sang/.claude/jobs/02a78233/tmp/weapons
B=/Applications/Blender.app/Contents/MacOS/Blender
N=$1
MODE=${2:-close}
$B -b --factory-startup --python $D/$N.py > $D/log_$N.txt 2>&1
grep -E "Error|TRIS|EXPORTED|Traceback|line [0-9]+" $D/log_$N.txt | head -20
$B -b --factory-startup --python $D/verify.py -- $MODE $N > $D/vlog_$N.txt 2>&1
grep -vE "^(Fra:|Info|Read|Saved|Blender|$)" $D/vlog_$N.txt | grep -E "ITEM|BBOX|EMPTY|ARMAT|BONES|ANIMS|mat |Error|Traceback|cameras" | head -40
