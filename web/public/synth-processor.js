// Runs the C++ engine (compiled to sdc.wasm) on the browser's audio thread.
// The main thread sends the .wasm bytes once, then notes and parameter changes as messages.

class SynthProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super()
    const module = new WebAssembly.Module(options.processorOptions.wasmBytes)

    // The engine needs no host functions; whatever libc stubs the toolchain left
    // behind (e.g. WASI's proc_exit) get harmless no-ops.
    const imports = {}
    for (const imp of WebAssembly.Module.imports(module)) {
      imports[imp.module] ??= {}
      if (imp.kind === 'function') imports[imp.module][imp.name] = () => 0
    }

    const { exports } = new WebAssembly.Instance(module, imports)
    exports._initialize?.() // runs C++ static constructors in a reactor-style module
    exports.sdc_init(sampleRate)
    this.engine = exports
    // Memory never grows (ALLOW_MEMORY_GROWTH=0), so these views stay valid.
    const memory = new Float32Array(exports.memory.buffer)
    this.left = memory.subarray(exports.sdc_left() >> 2)
    this.right = memory.subarray(exports.sdc_right() >> 2)

    this.port.onmessage = ({ data }) => this.handle(data)
  }

  handle(msg) {
    const e = this.engine
    switch (msg.type) {
      case 'noteOn': e.sdc_note_on(msg.note, msg.velocity); break
      case 'noteOff': e.sdc_note_off(msg.note); break
      case 'allNotesOff': e.sdc_all_notes_off(); break
      case 'param': e.sdc_set_param(msg.id, msg.value); break
      case 'wavePoint': e.sdc_set_wave_point(msg.osc, msg.index, msg.x, msg.y); break
    }
  }

  process(_inputs, outputs) {
    const [outL, outR] = outputs[0]
    const frames = outL.length
    this.engine.sdc_process(frames)
    outL.set(this.left.subarray(0, frames))
    if (outR) outR.set(this.right.subarray(0, frames))
    return true
  }
}

registerProcessor('sdc-synth', SynthProcessor)
