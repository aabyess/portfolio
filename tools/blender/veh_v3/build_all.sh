#!/bin/zsh
# usage: build_all.sh [names...]   (horse carriage motorcycle bicycle tank)
D=/Users/sang/.claude/jobs/02a78233/tmp/veh_v3
B=/Applications/Blender.app/Contents/MacOS/Blender
cd $D
names=("$@")
[ ${#names} -eq 0 ] && names=(horse carriage motorcycle bicycle)
for n in $names; do
  case $n in
    horse) $B -b --factory-startup --python horse_main.py > log_build_$n.txt 2>&1 ;;
    carriage) $B -b --factory-startup --python carriage3.py > log_build_$n.txt 2>&1 ;;
    motorcycle|bicycle) $B -b --factory-startup --python bikes3.py -- $n > log_build_$n.txt 2>&1 ;;
    tank) $B -b --factory-startup --python tank3.py > log_build_$n.txt 2>&1 ;;
  esac
  grep -E "EXPORTED|Traceback|Error" log_build_$n.txt
  $B -b --factory-startup --python verify3.py -- $n render close > log_verify_$n.txt 2>&1
  grep -E "REST_SIZE|FILE|Traceback" log_verify_$n.txt
done
python3 -I glbsize.py $names | grep total
