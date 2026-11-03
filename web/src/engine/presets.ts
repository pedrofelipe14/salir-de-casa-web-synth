import { ParamId } from './params'
import type { Point } from './wave'

export interface Preset {
  name: string
  /** Anything left out is reset to its default. */
  values: Partial<Record<ParamId, number>>
  /** Custom-wave points per oscillator, when the preset uses them. */
  points?: [Point[]?, Point[]?]
}

// A breathy, uneven shape with a bump in the second half.
const vidrio: Point[] = [
  { x: 0, y: 0 }, { x: 0.08, y: 0.95 }, { x: 0.22, y: 0.3 }, { x: 0.36, y: 0.75 },
  { x: 0.5, y: -0.1 }, { x: 0.63, y: -0.9 }, { x: 0.78, y: -0.2 }, { x: 0.9, y: -0.65 },
]

export const PRESETS: Preset[] = [
  { name: 'Init', values: {} },
  {
    name: 'Respiro',
    values: {
      [ParamId.osc1Wave]: 1, [ParamId.osc2Wave]: 1, [ParamId.osc2Level]: 0.8, [ParamId.osc2Octave]: -1, [ParamId.osc2Fine]: 9,
      [ParamId.attack]: 0.4, [ParamId.decay]: 0.6, [ParamId.sustain]: 0.85, [ParamId.release]: 1.5,
      [ParamId.cutoff]: 900, [ParamId.resonance]: 2.2, [ParamId.filterEnv]: 10,
      [ParamId.lfoShape]: 0, [ParamId.lfoTarget]: 0, [ParamId.lfoRate]: 0.35, [ParamId.lfoDepth]: 0.45,
      [ParamId.delayMix]: 0.3, [ParamId.delayTime]: 0.45, [ParamId.delayFeedback]: 0.5,
    },
  },
  {
    name: 'Vidrio',
    values: {
      [ParamId.osc1Wave]: 4, [ParamId.osc2Wave]: 0, [ParamId.osc2Level]: 0.35, [ParamId.osc2Octave]: 1,
      [ParamId.attack]: 0.005, [ParamId.decay]: 0.9, [ParamId.sustain]: 0.2, [ParamId.release]: 1.2,
      [ParamId.cutoff]: 6500, [ParamId.resonance]: 0.9, [ParamId.filterEnv]: 6,
      [ParamId.delayMix]: 0.35, [ParamId.delayTime]: 0.28, [ParamId.delayFeedback]: 0.55,
    },
    points: [vidrio],
  },
  {
    name: 'Bajo Gomoso',
    values: {
      [ParamId.osc1Wave]: 2, [ParamId.osc2Wave]: 1, [ParamId.osc2Level]: 0.6, [ParamId.osc2Octave]: -1,
      [ParamId.attack]: 0.003, [ParamId.decay]: 0.25, [ParamId.sustain]: 0.4, [ParamId.release]: 0.12,
      [ParamId.cutoff]: 260, [ParamId.resonance]: 4, [ParamId.filterEnv]: 30,
      [ParamId.delayMix]: 0, [ParamId.volume]: -4,
    },
  },
  {
    name: 'Cinta Trabada',
    values: {
      [ParamId.osc1Wave]: 3, [ParamId.osc2Wave]: 1, [ParamId.osc2Level]: 0.4, [ParamId.osc2Semitone]: 7,
      [ParamId.attack]: 0.02, [ParamId.decay]: 0.4, [ParamId.sustain]: 0.6, [ParamId.release]: 0.7,
      [ParamId.cutoff]: 2600, [ParamId.resonance]: 1.4, [ParamId.filterEnv]: 14,
      [ParamId.lfoShape]: 4, [ParamId.lfoTarget]: 1, [ParamId.lfoRate]: 7, [ParamId.lfoDepth]: 0.18,
      [ParamId.delayMix]: 0.45, [ParamId.delayTime]: 0.19, [ParamId.delayFeedback]: 0.7,
    },
  },
]
