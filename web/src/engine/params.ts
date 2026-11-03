// Mirror of dsp/include/sdc/params.h: same order, ranges and defaults.
// params.test.ts parses the C++ header and fails if the two drift apart.

export enum ParamId {
  osc1Wave, osc1Level, osc1Octave, osc1Semitone, osc1Fine,
  osc2Wave, osc2Level, osc2Octave, osc2Semitone, osc2Fine,
  attack, decay, sustain, release,
  cutoff, resonance, filterEnv,
  lfoShape, lfoTarget, lfoRate, lfoDepth,
  wetMode, wetMix, wetTime, wetModify, routeOrder,
  glitchMix, glitchGrainSize, loopInterval, loopJumps, glitchHold,
  glitchDegrade, glitchChaos, glitchReverse, glitchTilt, autoGlitch, loopKeep,
  volume,
}

export const PARAM_COUNT = ParamId.volume + 1

export type Unit = 'percent' | 'seconds' | 'milliseconds' | 'hertz' | 'semitones' | 'cents' | 'octaves'
  | 'decibels' | 'q' | 'choice' | 'toggle'

export type Lang = 'es' | 'en'

export interface ParamSpec {
  id: ParamId
  label: string
  labelEn: string
  min: number
  max: number
  defaultValue: number
  unit: Unit
  /** < 1 gives the low end of the range more of the knob's travel (frequencies, times). */
  skew?: number
  integer?: boolean
  choices?: string[]
  choicesEn?: string[]
}

type Words = [es: string[], en: string[]]
const WAVES: Words = [['Seno', 'Sierra', 'Cuadrada', 'Triangular', 'Propia'], ['Sine', 'Saw', 'Square', 'Triangle', 'Custom']]
const LFO_SHAPES: Words = [['Seno', 'Triangular', 'Sierra', 'Cuadrada', 'Azar'], ['Sine', 'Triangle', 'Saw', 'Square', 'Random']]
const LFO_TARGETS: Words = [['Filtro', 'Tono', 'Volumen'], ['Filter', 'Pitch', 'Volume']]
const WET_MODES: Words = [['Reverb', 'Delay', 'Slip'], ['Reverb', 'Delay', 'Slip']]
const ROUTE_ORDERS: Words = [['Loop > Wet', 'Wet > Loop'], ['Loop > Wet', 'Wet > Loop']]
const LOOP_INTERVALS: Words = [
  ['-2 oct', '-1 oct', '-5ta', '-4ta', 'Unísono', '+4ta', '+5ta', '+1 oct', '+1 oct +5ta', '+2 oct'],
  ['-2 oct', '-1 oct', '-5th', '-4th', 'Unison', '+4th', '+5th', '+1 oct', '+1 oct +5th', '+2 oct'],
]

const spec = (id: ParamId, [label, labelEn]: [string, string], min: number, max: number, defaultValue: number,
  unit: Unit, extra: Partial<ParamSpec> = {}): ParamSpec => ({ id, label, labelEn, min, max, defaultValue, unit, ...extra })

const choice = ([choices, choicesEn]: Words) => ({ integer: true, choices, choicesEn })

const oscSpecs = (wave: ParamId, defaultLevel: number, defaultFine: number): ParamSpec[] => [
  spec(wave, ['Forma', 'Wave'], 0, 4, 1, 'choice', choice(WAVES)),
  spec(wave + 1, ['Nivel', 'Level'], 0, 1, defaultLevel, 'percent'),
  spec(wave + 2, ['Octava', 'Octave'], -3, 3, 0, 'octaves', { integer: true }),
  spec(wave + 3, ['Semitonos', 'Semitones'], -12, 12, 0, 'semitones', { integer: true }),
  spec(wave + 4, ['Fino', 'Fine'], -50, 50, defaultFine, 'cents'),
]

export const PARAMS: ParamSpec[] = [
  ...oscSpecs(ParamId.osc1Wave, 1, 0),
  ...oscSpecs(ParamId.osc2Wave, 0, 7),
  spec(ParamId.attack, ['Ataque', 'Attack'], 0.001, 5, 0.01, 'seconds', { skew: 0.3 }),
  spec(ParamId.decay, ['Decaimiento', 'Decay'], 0.001, 5, 0.1, 'seconds', { skew: 0.3 }),
  spec(ParamId.sustain, ['Sustain', 'Sustain'], 0, 1, 0.8, 'percent'),
  spec(ParamId.release, ['Release', 'Release'], 0.001, 5, 0.2, 'seconds', { skew: 0.3 }),
  spec(ParamId.cutoff, ['Corte', 'Cutoff'], 20, 20000, 4000, 'hertz', { skew: 0.3 }),
  spec(ParamId.resonance, ['Resonancia', 'Resonance'], 0.1, 10, 0.7, 'q', { skew: 0.4 }),
  spec(ParamId.filterEnv, ['Envolvente', 'Env amount'], -48, 48, 24, 'semitones'),
  spec(ParamId.lfoShape, ['Forma', 'Shape'], 0, 4, 0, 'choice', choice(LFO_SHAPES)),
  spec(ParamId.lfoTarget, ['Destino', 'Target'], 0, 2, 0, 'choice', choice(LFO_TARGETS)),
  spec(ParamId.lfoRate, ['Velocidad', 'Rate'], 0.05, 20, 4, 'hertz', { skew: 0.3 }),
  spec(ParamId.lfoDepth, ['Profundidad', 'Depth'], 0, 1, 0, 'percent'),
  spec(ParamId.wetMode, ['Modo', 'Mode'], 0, 2, 0, 'choice', choice(WET_MODES)),
  spec(ParamId.wetMix, ['Mezcla', 'Mix'], 0, 1, 0, 'percent'),
  spec(ParamId.wetTime, ['Tiempo', 'Time'], 0, 1, 0.5, 'percent'),
  spec(ParamId.wetModify, ['Modificar', 'Modify'], 0, 1, 0.5, 'percent'),
  spec(ParamId.routeOrder, ['Orden', 'Order'], 0, 1, 0, 'choice', choice(ROUTE_ORDERS)),
  spec(ParamId.glitchMix, ['Mezcla', 'Mix'], 0, 1, 0, 'percent'),
  spec(ParamId.glitchGrainSize, ['Largo', 'Length'], 20, 1000, 250, 'milliseconds', { skew: 0.4 }),
  spec(ParamId.loopInterval, ['Intervalo', 'Interval'], 0, 9, 4, 'choice', choice(LOOP_INTERVALS)),
  spec(ParamId.loopJumps, ['Saltos', 'Jumps'], 0, 1, 0, 'percent'),
  spec(ParamId.glitchHold, ['Repetir', 'Repeat'], 0, 1, 0.3, 'percent'),
  spec(ParamId.glitchDegrade, ['Degradación', 'Degrade'], 0, 1, 0.2, 'percent'),
  spec(ParamId.glitchChaos, ['Caos', 'Chaos'], 0, 1, 0.2, 'percent'),
  spec(ParamId.glitchReverse, ['Reversa', 'Reverse'], 0, 1, 0.1, 'percent'),
  spec(ParamId.glitchTilt, ['Tilt', 'Tilt'], 0, 1, 0.5, 'percent'),
  spec(ParamId.autoGlitch, ['Auto-Glitch', 'Auto-Glitch'], 0, 1, 0, 'toggle', { integer: true }),
  spec(ParamId.loopKeep, ['Mantener', 'Hold loop'], 0, 1, 0, 'toggle', { integer: true }),
  spec(ParamId.volume, ['Volumen', 'Volume'], -24, 12, 0, 'decibels'),
]

export const labelOf = (p: ParamSpec, lang: Lang) => (lang === 'en' ? p.labelEn : p.label)
export const choicesOf = (p: ParamSpec, lang: Lang) => (lang === 'en' ? p.choicesEn : p.choices) ?? []

export const defaultValues = (): number[] => PARAMS.map((p) => p.defaultValue)

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/** Knob position (0..1) for a value. */
export function toNormalized(p: ParamSpec, value: number): number {
  const linear = clamp((value - p.min) / (p.max - p.min), 0, 1)
  return p.skew ? Math.pow(linear, p.skew) : linear
}

/** Value for a knob position (0..1), snapped to whole numbers where the param is stepped. */
export function fromNormalized(p: ParamSpec, normalized: number): number {
  const n = clamp(normalized, 0, 1)
  const linear = p.skew ? Math.pow(n, 1 / p.skew) : n
  const value = p.min + linear * (p.max - p.min)
  return p.integer ? Math.round(value) : value
}

const signed = (v: number, digits: number) => (v > 0 ? '+' : '') + v.toFixed(digits)

/** How a value reads under its knob: "4.50 kHz", "300 ms", "+7 ct"... */
export function formatValue(p: ParamSpec, v: number, lang: Lang = 'es'): string {
  switch (p.unit) {
    case 'percent': return `${Math.round(v * 100)} %`
    case 'seconds': return v < 1 ? `${Math.round(v * 1000)} ms` : `${v.toFixed(2)} s`
    case 'milliseconds': return `${Math.round(v)} ms`
    case 'hertz':
      if (v < 10) return `${v.toFixed(2)} Hz`
      return v < 1000 ? `${Math.round(v)} Hz` : `${(v / 1000).toFixed(2)} kHz`
    case 'semitones': return `${signed(Math.round(v), 0)} st`
    case 'cents': return `${signed(v, 1)} ct`
    case 'octaves': return `${signed(Math.round(v), 0)} oct`
    case 'decibels': return `${signed(v, 1)} dB`
    case 'q': return v.toFixed(2)
    case 'choice': return choicesOf(p, lang)[Math.round(v)] ?? String(v)
    case 'toggle': return v > 0.5 ? (lang === 'en' ? 'On' : 'Sí') : (lang === 'en' ? 'Off' : 'No')
  }
}
