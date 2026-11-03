import { defaultValues, PARAM_COUNT, ParamId } from './params'
import { defaultPoints, type Point } from './wave'

type Message =
  | { type: 'noteOn'; note: number; velocity: number }
  | { type: 'noteOff'; note: number }
  | { type: 'allNotesOff' }
  | { type: 'param'; id: ParamId; value: number }
  | { type: 'wavePoint'; osc: number; index: number; x: number; y: number }

/** Main-thread handle on the synth running in the AudioWorklet.
    Browsers only allow audio after a user gesture, so start() is called from one;
    anything set before that is remembered and sent once the engine is up. */
export class SynthEngine {
  private node: AudioWorkletNode | null = null
  private starting: Promise<void> | null = null
  private values = defaultValues()
  private points: Point[][] = [defaultPoints(), defaultPoints()]

  analyser: AnalyserNode | null = null

  get running(): boolean {
    return this.node !== null
  }

  start(): Promise<void> {
    this.starting ??= this.boot()
    return this.starting
  }

  private async boot(): Promise<void> {
    const context = new AudioContext({ latencyHint: 'interactive' })
    const base = import.meta.env.BASE_URL
    const [wasmBytes] = await Promise.all([
      fetch(`${base}sdc.wasm`).then((r) => r.arrayBuffer()),
      context.audioWorklet.addModule(`${base}synth-processor.js`),
    ])

    const node = new AudioWorkletNode(context, 'sdc-synth', {
      numberOfInputs: 0,
      numberOfOutputs: 1,
      outputChannelCount: [2],
      processorOptions: { wasmBytes },
    })
    const analyser = context.createAnalyser()
    analyser.fftSize = 2048
    node.connect(analyser)
    analyser.connect(context.destination)

    this.node = node
    this.analyser = analyser

    // Bring the engine up to whatever the UI already shows.
    for (let id = 0; id < PARAM_COUNT; id++) this.post({ type: 'param', id, value: this.values[id] })
    this.points.forEach((pts, osc) => pts.forEach((p, index) => this.post({ type: 'wavePoint', osc, index, ...p })))
    await context.resume()
  }

  noteOn(note: number, velocity = 0.85): void {
    this.post({ type: 'noteOn', note, velocity })
  }

  noteOff(note: number): void {
    this.post({ type: 'noteOff', note })
  }

  allNotesOff(): void {
    this.post({ type: 'allNotesOff' })
  }

  setParam(id: ParamId, value: number): void {
    this.values[id] = value
    this.post({ type: 'param', id, value })
  }

  setWavePoint(osc: number, index: number, point: Point): void {
    this.points[osc][index] = point
    this.post({ type: 'wavePoint', osc, index, x: point.x, y: point.y })
  }

  private post(message: Message): void {
    this.node?.port.postMessage(message)
  }
}
