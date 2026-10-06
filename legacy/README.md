# Legado de PriomGL Polyglot
- `js_original/`: motor y módulos JS originales (IIFE globales). Referencia; el código vivo está en `src/`.
- `native/` (C++20/WASM), `kotlin/` (QualityPolicy), `python/` (generador de LUTs, entrenamiento del tonemap neuronal, `neural_tonemap.glsl.txt` que el motor importa).
Regenerar tablas: `python3 legacy/python/generate_hw_luts.py` y copiar el JSON a `public/data/hw_luts.json`.
