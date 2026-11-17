#!/usr/bin/env bash
# Turns recorded screencast segments into the final 1080p demo video.
# usage: assemble.sh <segments_dir> <out.mp4>
set -e
SEG="$1"; OUT="$2"; TMP="$SEG/_clips"; mkdir -p "$TMP"
enc () { # name seconds fadein fadeout
  local n=$1 d=$2 fi=$3 fo=$4 vf="fps=30,scale=1920:1080:flags=lanczos,tpad=stop_mode=clone:stop_duration=3"
  vf="$vf,trim=duration=$d,setpts=PTS-STARTPTS"
  [ "$fi" = 1 ] && vf="$vf,fade=t=in:st=0:d=0.4"
  [ "$fo" = 1 ] && vf="$vf,fade=t=out:st=$(awk "BEGIN{print $d-0.45}"):d=0.45"
  ffmpeg -y -loglevel error -f concat -safe 0 -i "$SEG/$n/list.txt" -f lavfi -t "$d" -i anullsrc=r=48000:cl=stereo \
    -vf "$vf,format=yuv420p" -c:v libx264 -preset medium -crf 17 -r 30 -c:a aac -b:a 128k -shortest -t "$d" "$TMP/$n.mp4"
  echo "$n $(ffprobe -v error -show_entries format=duration -of csv=p=0 "$TMP/$n.mp4")"
}
enc intro 40 1 1
enc stack 35 1 1
enc app 203 1 0
enc ledger 7 0 1
enc engines 30 1 1
enc impact 30 1 1
enc close 15 1 1
: > "$TMP/list.txt"
for n in intro stack app ledger engines impact close; do echo "file '$TMP/$n.mp4'" >> "$TMP/list.txt"; done
ffmpeg -y -loglevel error -f concat -safe 0 -i "$TMP/list.txt" -c copy -movflags +faststart "$OUT"
ffprobe -v error -show_entries format=duration:stream=codec_name,width,height -of compact "$OUT"
