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

export interface ParamSpec {
  id: ParamId
  label: string
  min: number
  max: number
  defaultValue: number
  unit: Unit
  /** < 1 gives the low end of the range more of the knob's travel (frequencies, times). */
  skew?: number
  integer?: boolean
  choices?: string[]
}

export const WAVES = ['Seno', 'Sierra', 'Cuadrada', 'Triangular', 'Propia']
export const LFO_SHAPES = ['Seno', 'Triangular', 'Sierra', 'Cuadrada', 'Azar']
export const LFO_TARGETS = ['Filtro', 'Tono', 'Volumen']
export const WET_MODES = ['Reverb', 'Delay', 'Slip']
export const ROUTE_ORDERS = ['Loop > Wet', 'Wet > Loop']
export const LOOP_INTERVALS = ['-2 oct', '-1 oct', '-5ta', '-4ta', 'Unísono', '+4ta', '+5ta', '+1 oct', '+1 oct +5ta', '+2 oct']

const spec = (id: ParamId, label: string, min: number, max: number, defaultValue: number, unit: Unit,
  extra: Partial<ParamSpec> = {}): ParamSpec => ({ id, label, min, max, defaultValue, unit, ...extra })

const oscSpecs = (wave: ParamId, defaultLevel: number, defaultFine: number): ParamSpec[] => [
  spec(wave, 'Forma', 0, 4, 1, 'choice', { integer: true, choices: WAVES }),
  spec(wave + 1, 'Nivel', 0, 1, defaultLevel, 'percent'),
  spec(wave + 2, 'Octava', -3, 3, 0, 'octaves', { integer: true }),
  spec(wave + 3, 'Semitonos', -12, 12, 0, 'semitones', { integer: true }),
  spec(wave + 4, 'Fino', -50, 50, defaultFine, 'cents'),
]

export const PARAMS: ParamSpec[] = [
  ...oscSpecs(ParamId.osc1Wave, 1, 0),
  ...oscSpecs(ParamId.osc2Wave, 0, 7),
  spec(ParamId.attack, 'Ataque', 0.001, 5, 0.01, 'seconds', { skew: 0.3 }),
  spec(ParamId.decay, 'Decaimiento', 0.001, 5, 0.1, 'seconds', { skew: 0.3 }),
  spec(ParamId.sustain, 'Sustain', 0, 1, 0.8, 'percent'),
  spec(ParamId.release, 'Release', 0.001, 5, 0.2, 'seconds', { skew: 0.3 }),
  spec(ParamId.cutoff, 'Corte', 20, 20000, 4000, 'hertz', { skew: 0.3 }),
  spec(ParamId.resonance, 'Resonancia', 0.1, 10, 0.7, 'q', { skew: 0.4 }),
  spec(ParamId.filterEnv, 'Envolvente', -48, 48, 24, 'semitones'),
  spec(ParamId.lfoShape, 'Forma', 0, 4, 0, 'choice', { integer: true, choices: LFO_SHAPES }),
  spec(ParamId.lfoTarget, 'Destino', 0, 2, 0, 'choice', { integer: true, choices: LFO_TARGETS }),
  spec(ParamId.lfoRate, 'Velocidad', 0.05, 20, 4, 'hertz', { skew: 0.3 }),
  spec(ParamId.lfoDepth, 'Profundidad', 0, 1, 0, 'percent'),
  spec(ParamId.wetMode, 'Modo', 0, 2, 0, 'choice', { integer: true, choices: WET_MODES }),
  spec(ParamId.wetMix, 'Mezcla', 0, 1, 0, 'percent'),
  spec(ParamId.wetTime, 'Tiempo', 0, 1, 0.5, 'percent'),
  spec(ParamId.wetModify, 'Modificar', 0, 1, 0.5, 'percent'),
  spec(ParamId.routeOrder, 'Orden', 0, 1, 0, 'choice', { integer: true, choices: ROUTE_ORDERS }),
  spec(ParamId.glitchMix, 'Mezcla', 0, 1, 0, 'percent'),
  spec(ParamId.glitchGrainSize, 'Largo', 20, 1000, 250, 'milliseconds', { skew: 0.4 }),
  spec(ParamId.loopInterval, 'Intervalo', 0, 9, 4, 'choice', { integer: true, choices: LOOP_INTERVALS }),
  spec(ParamId.loopJumps, 'Saltos', 0, 1, 0, 'percent'),
  spec(ParamId.glitchHold, 'Repetir', 0, 1, 0.3, 'percent'),
  spec(ParamId.glitchDegrade, 'Degradación', 0, 1, 0.2, 'percent'),
  spec(ParamId.glitchChaos, 'Caos', 0, 1, 0.2, 'percent'),
  spec(ParamId.glitchReverse, 'Reversa', 0, 1, 0.1, 'percent'),
  spec(ParamId.glitchTilt, 'Tilt', 0, 1, 0.5, 'percent'),
  spec(ParamId.autoGlitch, 'Auto-Glitch', 0, 1, 0, 'toggle', { integer: true }),
  spec(ParamId.loopKeep, 'Mantener', 0, 1, 0, 'toggle', { integer: true }),
  spec(ParamId.volume, 'Volumen', -24, 12, 0, 'decibels'),
]

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
export function formatValue(p: ParamSpec, v: number): string {
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
    case 'choice': return p.choices?.[Math.round(v)] ?? String(v)
    case 'toggle': return v > 0.5 ? 'Sí' : 'No'
  }
}
