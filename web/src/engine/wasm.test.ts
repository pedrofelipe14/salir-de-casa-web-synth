import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { ParamId } from './params'

// Runs the real compiled engine (public/sdc.wasm, built by scripts/build-wasm.sh)
// the same way the AudioWorklet does.
const wasmUrl = new URL('../../public/sdc.wasm', import.meta.url)

interface Engine {
  memory: WebAssembly.Memory
  _initialize?: () => void
  sdc_init(sampleRate: number): void
  sdc_note_on(note: number, velocity: number): void
  sdc_note_off(note: number): void
  sdc_set_param(id: number, value: number): void
  sdc_process(frames: number): void
  sdc_left(): number
  sdc_right(): number
  sdc_active_voices(): number
}

function load(): Engine {
  const module = new WebAssembly.Module(readFileSync(wasmUrl))
  const imports: Record<string, Record<string, () => number>> = {}
  for (const imp of WebAssembly.Module.imports(module)) {
    imports[imp.module] ??= {}
    if (imp.kind === 'function') imports[imp.module][imp.name] = () => 0
  }
  const engine = new WebAssembly.Instance(module, imports).exports as unknown as Engine
  engine._initialize?.()
  engine.sdc_init(48000)
  return engine
}

function renderRms(engine: Engine, blocks: number): number {
  const memory = new Float32Array(engine.memory.buffer)
  const left = engine.sdc_left() >> 2
  let sum = 0
  for (let b = 0; b < blocks; b++) {
    engine.sdc_process(128)
    for (let i = 0; i < 128; i++) sum += memory[left + i] ** 2
  }
  return Math.sqrt(sum / (blocks * 128))
}

describe.skipIf(!existsSync(wasmUrl))('compiled engine (sdc.wasm)', () => {
  it('only needs imports the worklet can stub', () => {
    const module = new WebAssembly.Module(readFileSync(wasmUrl))
    for (const imp of WebAssembly.Module.imports(module)) expect(imp.module).toBe('wasi_snapshot_preview1')
  })

  it('is silent at rest and sounds when a note plays', () => {
    const engine = load()
    expect(renderRms(engine, 10)).toBe(0)
    engine.sdc_note_on(60, 1)
    expect(renderRms(engine, 40)).toBeGreaterThan(0.01)
    expect(engine.sdc_active_voices()).toBe(1)
  })

  it('releases notes and goes quiet', () => {
    const engine = load()
    engine.sdc_set_param(ParamId.release, 0.02)
    engine.sdc_set_param(ParamId.delayMix, 0)
    engine.sdc_note_on(64, 1)
    renderRms(engine, 20)
    engine.sdc_note_off(64)
    renderRms(engine, 40)
    expect(engine.sdc_active_voices()).toBe(0)
    expect(renderRms(engine, 10)).toBeLessThan(1e-4)
  })
})
