#!/bin/sh
# 미리보기 렌더: 한 줄 세우기 + 걷기 프레임 격자 + 종별 동작 모음
#   tools/blender/animals/preview_all.sh <출력 폴더> [종...]
cd "$(dirname "$0")/../../.."
BL=/Applications/Blender.app/Contents/MacOS/Blender
P=tools/blender/animals/preview_glb.py
O=${1:-/tmp/animals}
shift
mkdir -p "$O"
$BL -b --factory-startup --python $P -- lineup "$O/lineup.png" > /tmp/pv_lineup.log 2>&1 &
$BL -b --factory-startup --python $P -- pose "$O/walk6.png" Walk 6 > /tmp/pv_walk.log 2>&1 &
for a in ${@:-panda bear deer fox rabbit sheep boar dog cat}; do
  $BL -b --factory-startup --python $P -- clips "$O/clips_$a.png" $a > /tmp/pv_$a.log 2>&1 &
done
wait
grep -h "GRID\|RENDER.*lineup" /tmp/pv_*.log
grep -l "Traceback" /tmp/pv_*.log && echo "SOME FAILED"
true
