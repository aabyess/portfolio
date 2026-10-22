#!/bin/zsh
# usage: sheet.sh dir tag out.png name1 name2 ... (up to 8, 4 per row) — contact sheet of <name>_<tag>.png
D=$1; T=$2; O=$3; shift 3
args=(); n=0
for x in "$@"; do args+=(-i "$D/${x}_$T.png"); n=$((n+1)); done
if [ $n -le 4 ]; then
  f="hstack=inputs=$n,scale=1800:-1"
else
  r=$((n-4)); ins=""; for i in $(seq 4 $((n-1))); do ins="$ins[$i]"; done
  f="[0][1][2][3]hstack=4[a];${ins}hstack=inputs=$r,pad=iw*4/$r:ih[b];[a][b]vstack,scale=1800:-1"
fi
ffmpeg -loglevel error -y "${args[@]}" -filter_complex "$f" "$D/$O"
