# Salir de Casa — web synth

**English** · [Español](README.es.md)

[![CI](https://github.com/pedrofelipe14/salir-de-casa-web-synth/actions/workflows/ci.yml/badge.svg)](https://github.com/pedrofelipe14/salir-de-casa-web-synth/actions/workflows/ci.yml)

A polyphonic synthesizer that runs in the browser. Its audio engine is **C++ compiled to WebAssembly** and runs in real time inside an **AudioWorklet**; the interface is **React + TypeScript**.
It's the web version of the [Salir de Casa VST3 plugin](https://github.com/pedrofelipe14/GlitchSynth).

**▶ Play it:** https://pedrofelipe14.github.io/salir-de-casa-web-synth/

![The web synth playing a chord](docs/screenshot.jpg)

## Features

- **8-voice polyphony** with voice stealing: releasing voices first, then the oldest.
- **Two oscillators** per voice: sine, saw, square, triangle, or a **custom waveform you shape by dragging points**.
- **Resonant low-pass filter** with envelope modulation, plus an amplitude **ADSR**.
- **LFO** routed to filter, pitch or volume (sine, triangle, saw, square or sample & hold).
- **Wet channel** with three modes, as in the plugin:
  - **Reverb**: Freeverb, the same algorithm the plugin gets from JUCE;
  - **Delay**: tape-style, with repeats that darken;
  - **Slip**: repeats played backwards or an octave away.
- **Micro-loop glitch**, a port of the plugin's engine:
  - it records the synth live, freezes grains and loops them, transposed by musical intervals;
  - it flips them backwards and degrades them (bit/rate crush) the longer they repeat;
  - "Caos" adds tape wow and random reverses.
- Configurable routing (Loop → Wet or Wet → Loop), plus a soft output limiter.
- Play it with the **mouse or touch** (slide for glissando), the **computer keyboard** or a **MIDI controller** (Web MIDI).
- The plugin's **factory presets** and a live **oscilloscope**.

## How it works

```
React UI (main thread)                      AudioWorklet (audio thread)
  knobs · wave editor · keyboard · MIDI ──►   synth-processor.js
           postMessage(note / param)           └─ sdc.wasm  (C++ engine, 56 KB)
                                                   8 voices → wet ⇄ micro-loop → limiter → speakers
```

- **`dsp/`**: the engine in portable, header-only C++17 with no dependencies.
  - PolyBLEP anti-aliased oscillators.
  - A Catmull-Rom curve for the custom waveform.
  - A TPT state-variable filter (stable under fast modulation).
  - Linear ADSR, per-voice LFO, DC blocking and de-clicking on voice steals.
  - The wet channel (Freeverb, tape delay, slip) and the granular micro-loop, both ported from the VST3 without JUCE.
- **`dsp/src/wasm_api.cpp`**: a small C API compiled with Emscripten to a **standalone `.wasm` with no JS glue**. The worklet instantiates it directly and reads audio straight from the module's memory, with no allocations on the audio thread.
- **`web/`**: the React app. Parameter changes and notes travel to the worklet as messages. The UI keeps a TypeScript mirror of the engine's parameter table, and a test fails if the two ever drift apart.

## Tests

- **24 native C++ tests** cover the DSP:
  - oscillators stay bounded with no DC offset, and the custom waveform follows its points;
  - envelope timing is right, and the filter passes lows, cuts highs and stays stable at extreme settings;
  - voice stealing works and the output never exceeds full scale;
  - reverb and delay leave tails, and slip stays stable at every speed;
  - the micro-loop only runs with Auto-Glitch on, keeps looping when "Mantener" is on, and otherwise fades out with the input.
- **31 web tests (Vitest)** cover knob mapping, value formatting and the computer-keyboard layout. They also check that the parameter table matches the C++ header, and they **load the real compiled `sdc.wasm`** to check it plays notes, runs the micro-loop and goes quiet when notes are released.
- **GitHub Actions** runs all of it on every push, then deploys the site to GitHub Pages.

## Running locally

Requirements: [Emscripten](https://emscripten.org/docs/getting_started/downloads.html), Node 20+ and CMake (for the native tests).

```sh
./scripts/build-wasm.sh          # C++ → web/public/sdc.wasm

cd web
npm install
npm run dev                      # http://localhost:5173
npm test

# native DSP tests
cmake -S dsp -B dsp/build && cmake --build dsp/build && ctest --test-dir dsp/build
```

## Stack

C++17 · WebAssembly (Emscripten) · Web Audio API (AudioWorklet) · Web MIDI · React · TypeScript · Vite · Vitest · CMake · GitHub Actions · GitHub Pages
