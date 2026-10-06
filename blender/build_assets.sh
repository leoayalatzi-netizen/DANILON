#!/usr/bin/env bash
# Regenera los GLB de public/models con Blender 5.x (modo headless). Uso:
#   BLENDER=/ruta/a/blender KENNEY=/ruta/a/PriomGL/models/kenney/fantasy-town bash blender/build_assets.sh
set -e
cd "$(dirname "$0")/.."
BLENDER="${BLENDER:-blender}"; export PRIOM_OUT="$PWD/public/models"
"$BLENDER" -b --factory-startup -P blender/nature.py
KENNEY="${KENNEY:?define KENNEY=carpeta con los .glb de Kenney Fantasy Town}/" "$BLENDER" -b --factory-startup -P blender/village.py
"$BLENDER" -b --factory-startup -P blender/preview_world.py -- docs/previews/mundo_layout_blender.png
