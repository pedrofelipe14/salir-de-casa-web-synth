// Measures how much of the real-time budget the compiled engine (public/sdc.wasm) uses.
// Usage: npm run bench   (after ./scripts/build-wasm.sh)

import { readFileSync } from 'node:fs'
import os from 'node:os'

const SAMPLE_RATE = 48000
const BLOCK = 128 // frames per AudioWorklet render quantum
const BUDGET_US = (BLOCK / SAMPLE_RATE) * 1e6 // time available per block in real time

// Parameter ids (see dsp/include/sdc/params.h)
const P = { osc1Wave: 0, osc2Level: 6, wetMode: 21, wetMix: 22, wetTime: 23, glitchMix: 26, autoGlitch: 35 }

const module = new WebAssembly.Module(readFileSync(new URL('./public/sdc.wasm', import.meta.url)))
const imports = {}
for (const imp of WebAssembly.Module.imports(module)) {
  imports[imp.module] ??= {}
  if (imp.kind === 'function') imports[imp.module][imp.name] = () => 0
}

function measure(label, settings) {
  const e = new WebAssembly.Instance(module, imports).exports
  e._initialize?.()
  e.sdc_init(SAMPLE_RATE)
  for (const [id, value] of settings) e.sdc_set_param(id, value)
  for (let n = 0; n < 8; n++) e.sdc_note_on(48 + n * 4, 1) // all 8 voices busy

  for (let b = 0; b < 2000; b++) e.sdc_process(BLOCK) // warm up the JIT, let grains start
  const blocks = 20000
  const start = process.hrtime.bigint()
  for (let b = 0; b < blocks; b++) e.sdc_process(BLOCK)
  const us = Number(process.hrtime.bigint() - start) / 1e3 / blocks
  return { label, us, percent: (100 * us) / BUDGET_US }
}

const everything = [[P.osc2Level, 1], [P.wetMix, 0.5], [P.wetTime, 0.9], [P.autoGlitch, 1], [P.glitchMix, 1]]
const results = [
  measure('8 voices, 1 oscillator', []),
  measure('8 voices, 2 oscillators + reverb', [[P.osc2Level, 1], [P.wetMix, 0.5], [P.wetTime, 0.9]]),
  measure('8 voices, 2 oscillators + reverb + micro-loop', everything),
  measure('8 voices, custom wave + slip + micro-loop', [[P.osc1Wave, 4], [P.wetMode, 2], ...everything]),
]

console.log(`${os.cpus()[0].model.trim()} · Node ${process.version} · ${SAMPLE_RATE} Hz · ${BLOCK}-frame blocks (budget ${BUDGET_US.toFixed(0)} µs)\n`)
for (const r of results)
  console.log(`${r.label.padEnd(48)} ${r.us.toFixed(1).padStart(6)} µs/block  ${r.percent.toFixed(1).padStart(4)} % of real time`)
