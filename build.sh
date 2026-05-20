#!/bin/bash
set -e
npm install

echo "[build] downloading ffmpeg with drawtext support..."
curl -fL "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-linux64-gpl.tar.xz" -o /tmp/ff.tar.xz

if [ -s /tmp/ff.tar.xz ]; then
  tar -xJf /tmp/ff.tar.xz -C /tmp/
  cp /tmp/ffmpeg-master-latest-linux64-gpl/bin/ffmpeg ./ffmpeg-draw
  chmod +x ./ffmpeg-draw
  echo "[build] ffmpeg-draw installed ✓"
else
  echo "[build] WARNING: download failed, film will fallback to concat"
fi
