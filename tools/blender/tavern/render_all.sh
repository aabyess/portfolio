#!/bin/bash
# Renders previews for every booth + lineup. Usage: bash render_all.sh [style ...]
B=/Applications/Blender.app/Contents/MacOS/Blender
D=/Users/sang/.claude/jobs/02a78233/tmp/tavern
STYLES="${@:-tudor bavarian norse osteria venta flemish tent}"
for k in $STYLES; do
  $B -b --factory-startup --python $D/pview.py -- booth tavern-$k 2>&1 | grep -E "FILE|real m|Error"
done
if [ $# -eq 0 ]; then
  $B -b --factory-startup --python $D/pview.py -- lineup tavern-tudor tavern-norse tavern-bavarian tavern-venta tavern-tent tavern-flemish tavern-osteria 2>&1 | grep -E "Error|RENDER"
fi
