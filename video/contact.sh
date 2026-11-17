#!/usr/bin/env bash
# contact sheet of the final video: one frame every N seconds
IN="$1"; OUT="$2"; N=${3:-15}
ffmpeg -y -loglevel error -i "$IN" -vf "fps=1/$N,scale=480:-1,tile=5x5:padding=4" -frames:v 1 "$OUT"
