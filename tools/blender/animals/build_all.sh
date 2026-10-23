#!/bin/sh
# 동물 GLB 전부 다시 만들기 (종마다 Blender 하나씩 나란히)
cd "$(dirname "$0")/../../.."
BL=/Applications/Blender.app/Contents/MacOS/Blender
for a in ${@:-panda bear deer fox rabbit sheep boar dog cat}; do
  $BL -b --factory-startup --python tools/blender/animals/build.py -- $a > /tmp/animal_build_$a.log 2>&1 &
done
wait
grep -h "^BUILT\|^INFO {" /tmp/animal_build_*.log
grep -l "Traceback" /tmp/animal_build_*.log && echo "SOME FAILED"
true
