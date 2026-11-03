#!/usr/bin/env bash
# Compiles the DSP core to web/public/sdc.wasm. Needs Emscripten's em++ on PATH.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p web/public

"${EMXX:-em++}" -std=c++17 -O3 -flto -fno-exceptions -fno-rtti \
    -Idsp/include dsp/src/wasm_api.cpp \
    -o web/public/sdc.wasm \
    --no-entry -sSTANDALONE_WASM=1 \
    -sINITIAL_MEMORY=8MB -sALLOW_MEMORY_GROWTH=0 -sSTACK_SIZE=256KB

echo "web/public/sdc.wasm: $(wc -c < web/public/sdc.wasm) bytes"
