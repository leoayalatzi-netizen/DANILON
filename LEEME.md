# PriomGL Quantum · Calabozos y Dragones

Motor gráfico + IA + mundo, en un solo proyecto Vite + TypeScript. Fusiona tu **PriomGL Polyglot** (IA Trinity, perfilado de hardware,
consejo políglota, tonemap neuronal) con la demo que ya funcionaba en tu teléfono (Babylon.js, terreno por capas con tus texturas ambientCG,
cielos HDRI, clima) y con **assets originales hechos en Blender 5.2**.

```
npm install
npm run dev        # desarrollo
npm run build      # producción (en Render copia dist/ a la raíz por si Publish Directory no es dist)
npm test           # pruebas del núcleo de IA (Node >= 22.13)
npm run assets     # regenera los GLB con Blender (ver blender/build_assets.sh)
```

## Arquitectura

| Capa | Archivos | Qué hace |
|---|---|---|
| **IA** | `src/core/trinity.ts` | 3 redes densas (World/Optimizer/Meta) con aprendizaje en línea + memoria episódica hiperesférica |
| | `src/core/hardware.ts` | "ADN" del dispositivo: GPU, CPU, memoria + micro-benchmark real → score y tier |
| | `src/core/council.ts` | Consejo políglota: JS + tablas de Python (`public/data/hw_luts.json`) + política Kotlin (+ C++ opcional) |
| | `src/core/governor.ts` | Gobernador de calidad (OptimizerAI v4): degrada/mejora por capas, usa la previsión de Trinity |
| **Motor** | `src/engine/PriomEngine.ts` | Orquesta todo: telemetría → Trinity → Consejo → Gobernador → ajustes reales (resolución, sombras, post, partículas, instancias) |
| | `terrain.ts · sky.ts · weather.ts · rain.ts · post.ts · props.ts` | Terreno 3 capas + AO horneado, cielo con 4 HDRI, 4 climas, lluvia/nieve GPU, post-proceso, props GLB |
| **Assets** | `blender/*.py` → `public/models/*.glb` | Pinos nevados, rocas, cristales, círculo rúnico, ruinas de dragón, aldea (kitbash Kenney) y aspas del molino |
| **Legado** | `legacy/` | Tu código original (JS, C++, Kotlin, Python) intacto, como referencia y para regenerar tablas/WASM |

## Qué se rescató de PriomGL
Trinity (redes + memoria LSH), HardwareProfiler (tabla de GPU, scoring y tiers), el Consejo (votos JS/Python/Kotlin), las tablas de Python
(presupuesto por tier, agresividad, árboles, cascadas, **curva de ráfagas de viento**) y el tonemap neuronal (MLP 1→12→12→1 entrenado offline).

## Qué se corrigió
1. **`neuralPressure` no se leía en ningún sitio:** Trinity calculaba una previsión que nadie usaba. Ahora es `headroom` y el Gobernador la usa (degradación preventiva con suelo de calidad y enfriamiento).
2. **Doble multiplicación del tier** en el Consejo (`pyVote` y `entityScale` aplicaban `entities` dos veces): los tiers bajos quedaban castigados de más.
3. **Sin protección NaN/Inf:** una telemetría corrupta envenenaba los pesos para siempre. Ahora se sanea la entrada y, si la pérdida se rompe, la red se reinicia sin afectar al motor.
4. **`_predictLoad` degradaba con FPS buenos** (la base 0.5 + inestabilidad superaba el umbral). Solo cuenta si los FPS ya están bajo el objetivo.
5. **Exposición atada a la calidad** (`1 + quality·0.4`): bajar calidad oscurecía la imagen. No se porta; el look ya no cambia al degradar.
6. El perfil de hardware ahora mide la GPU con un shader real (antes dependía de heurísticas del nombre).

## Controles
- Botones inferiores o teclas **1-4**: Amanecer, Atardecer, Lluvia, Niebla. **Auto**: ciclo guiado por Trinity.
- **Toca el título** para ver el panel de IA (tier, FPS, calidad, pérdidas de Trinity, decisión del Consejo, acción del Gobernador).
- **N** (solo PC con WebGL2 y tier alto): tonemap neuronal en vez de ACES. Experimental.

## Notas honestas
- Verificado aquí: sintaxis de todo el TypeScript, pruebas del núcleo de IA (`npm test`) y renders de los assets/layout en Blender.
  **No se pudo ejecutar el motor en un navegador** (el entorno de desarrollo no tiene WebGL ni red para instalar Babylon).
- Si los GLB no cargan, el motor cae a props procedurales; si el material de terreno no compila, a PBR con colores por vértice.
- Los kernels C++/WASM (`legacy/native`) no se compilaron (no hay `emcc` aquí): el Consejo usa su equivalente en JS.
- Para regenerar la aldea necesitas el pack Kenney Fantasy Town (variable `KENNEY`).
