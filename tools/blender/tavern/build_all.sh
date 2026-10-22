#!/bin/bash
# Builds booths. Usage: bash build_all.sh [style ...]
B=/Applications/Blender.app/Contents/MacOS/Blender
D=/Users/sang/.claude/jobs/02a78233/tmp/tavern
STYLES="${@:-tudor bavarian norse osteria venta flemish tent}"
for k in $STYLES; do
  echo "== $k"
  $B -b --factory-startup --python $D/booths.py -- $k 2>&1 | grep -E "BOOTH|EXPORTED|LANTERN|Error|line [0-9]+"
done
