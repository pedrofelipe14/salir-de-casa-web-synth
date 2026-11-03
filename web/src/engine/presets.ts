import { ParamId as P } from './params'
import type { Point } from './wave'

export interface Preset {
  name: string
  /** Anything left out is reset to its default. */
  values: Partial<Record<P, number>>
  /** Custom-wave points per oscillator, when the preset uses them. */
  points?: [Point[]?, Point[]?]
}

// The VST3's factory presets, value for value, plus "Vidrio" to show off the drawn waveform.
// Choice values are indices: wetMode 0=Reverb 1=Delay 2=Slip · routeOrder 0=Loop>Wet 1=Wet>Loop ·
// loopInterval 0=-2oct 1=-1oct 2=-5ta 3=-4ta 4=Unísono 5=+4ta 6=+5ta 7=+1oct 8=+1oct+5ta 9=+2oct.

const vidrio: Point[] = [
  { x: 0, y: 0 }, { x: 0.08, y: 0.95 }, { x: 0.22, y: 0.3 }, { x: 0.36, y: 0.75 },
  { x: 0.5, y: -0.1 }, { x: 0.63, y: -0.9 }, { x: 0.78, y: -0.2 }, { x: 0.9, y: -0.65 },
]

export const PRESETS: Preset[] = [
  { name: 'Init', values: {} },
  {
    name: 'Glitch Suave',
    values: {
      [P.osc1Wave]: 1, [P.attack]: 0.02, [P.decay]: 0.15, [P.sustain]: 0.7, [P.release]: 0.25,
      [P.cutoff]: 5500, [P.resonance]: 0.6, [P.filterEnv]: 18,
      [P.wetMode]: 0, [P.wetMix]: 0.25, [P.wetTime]: 0.5, [P.wetModify]: 0.5,
      [P.glitchMix]: 0.25, [P.glitchGrainSize]: 300, [P.loopInterval]: 4, [P.loopJumps]: 0.15,
      [P.glitchHold]: 0.2, [P.glitchDegrade]: 0.15, [P.glitchChaos]: 0.1, [P.glitchReverse]: 0.05, [P.glitchTilt]: 0.55,
      [P.autoGlitch]: 1,
    },
  },
  {
    name: 'Cinta Vieja',
    values: {
      [P.osc1Wave]: 1, [P.attack]: 0.05, [P.decay]: 0.3, [P.sustain]: 0.6, [P.release]: 0.6,
      [P.cutoff]: 2500, [P.resonance]: 0.5, [P.filterEnv]: 12, [P.volume]: -3,
      [P.wetMode]: 1, [P.wetMix]: 0.25, [P.wetTime]: 0.55, [P.wetModify]: 0.35,
      [P.glitchMix]: 0.6, [P.glitchGrainSize]: 400, [P.loopInterval]: 4,
      [P.glitchHold]: 0.6, [P.glitchDegrade]: 0.5, [P.glitchChaos]: 0.3, [P.glitchReverse]: 0.05, [P.glitchTilt]: 0.2,
      [P.autoGlitch]: 1,
    },
  },
  {
    name: 'Loop Congelado',
    values: {
      [P.osc1Wave]: 0, [P.attack]: 1.2, [P.decay]: 1, [P.sustain]: 1, [P.release]: 2,
      [P.cutoff]: 6000, [P.resonance]: 0.3, [P.filterEnv]: 6, [P.volume]: -2,
      [P.wetMode]: 0, [P.wetMix]: 0.45, [P.wetTime]: 0.8, [P.wetModify]: 0.6,
      [P.glitchMix]: 0.8, [P.glitchGrainSize]: 600, [P.loopInterval]: 4,
      [P.glitchHold]: 0.9, [P.glitchDegrade]: 0.15, [P.glitchChaos]: 0.4, [P.glitchReverse]: 0.2, [P.glitchTilt]: 0.6,
      [P.autoGlitch]: 1, [P.loopKeep]: 1,
    },
  },
  {
    name: 'Caos Total',
    values: {
      [P.osc1Wave]: 1, [P.attack]: 0.01, [P.decay]: 0.2, [P.sustain]: 0.5, [P.release]: 0.3,
      [P.cutoff]: 5000, [P.resonance]: 2, [P.filterEnv]: 36, [P.volume]: -4,
      [P.wetMode]: 2, [P.wetMix]: 0.35, [P.wetTime]: 0.4, [P.wetModify]: 0.1,
      [P.glitchMix]: 1, [P.glitchGrainSize]: 150, [P.loopInterval]: 4, [P.loopJumps]: 0.6,
      [P.glitchHold]: 0.4, [P.glitchDegrade]: 0.8, [P.glitchChaos]: 0.9, [P.glitchReverse]: 0.5, [P.glitchTilt]: 0.5,
      [P.autoGlitch]: 1,
    },
  },
  {
    name: 'Lead Roto',
    values: {
      [P.osc1Wave]: 2, [P.attack]: 0.005, [P.decay]: 0.08, [P.sustain]: 0.9, [P.release]: 0.1,
      [P.cutoff]: 3000, [P.resonance]: 3, [P.filterEnv]: 30, [P.volume]: -1,
      [P.wetMode]: 1, [P.wetMix]: 0.2, [P.wetTime]: 0.45, [P.wetModify]: 0.3,
      [P.glitchMix]: 0.35, [P.glitchGrainSize]: 120, [P.loopInterval]: 6, [P.loopJumps]: 0.25,
      [P.glitchHold]: 0.15, [P.glitchDegrade]: 0.3, [P.glitchChaos]: 0.35, [P.glitchReverse]: 0.1, [P.glitchTilt]: 0.6,
      [P.autoGlitch]: 1,
    },
  },
  {
    name: 'Pad Fantasma',
    values: {
      [P.osc1Wave]: 0, [P.attack]: 2, [P.decay]: 1.5, [P.sustain]: 1, [P.release]: 3,
      [P.cutoff]: 8000, [P.resonance]: 0.2, [P.filterEnv]: 4, [P.volume]: -3,
      [P.wetMode]: 0, [P.wetMix]: 0.6, [P.wetTime]: 0.95, [P.wetModify]: 0.7, [P.routeOrder]: 1,
      [P.glitchMix]: 0.5, [P.glitchGrainSize]: 800, [P.loopInterval]: 1,
      [P.glitchHold]: 0.95, [P.glitchDegrade]: 0.1, [P.glitchChaos]: 0.5, [P.glitchReverse]: 0.6, [P.glitchTilt]: 0.7,
      [P.autoGlitch]: 1,
    },
  },
  {
    name: 'Percusión Glitch',
    values: {
      [P.osc1Wave]: 3, [P.attack]: 0.001, [P.decay]: 0.05, [P.sustain]: 0, [P.release]: 0.05,
      [P.cutoff]: 7000, [P.resonance]: 1, [P.filterEnv]: 24,
      [P.wetMode]: 1, [P.wetMix]: 0.2, [P.wetTime]: 0.3, [P.wetModify]: 0.45,
      [P.glitchMix]: 0.7, [P.glitchGrainSize]: 60, [P.loopInterval]: 7, [P.loopJumps]: 0.3,
      [P.glitchHold]: 0.1, [P.glitchDegrade]: 0.6, [P.glitchChaos]: 0.4, [P.glitchReverse]: 0.3, [P.glitchTilt]: 0.5,
      [P.autoGlitch]: 1,
    },
  },
  {
    name: 'Reversa Eterna',
    values: {
      [P.osc1Wave]: 3, [P.attack]: 0.3, [P.decay]: 0.8, [P.sustain]: 0.8, [P.release]: 1.2,
      [P.cutoff]: 4500, [P.resonance]: 0.4, [P.filterEnv]: 8, [P.volume]: -2,
      [P.wetMode]: 2, [P.wetMix]: 0.55, [P.wetTime]: 0.7, [P.wetModify]: 0.1, [P.routeOrder]: 1,
      [P.glitchMix]: 0.3, [P.glitchGrainSize]: 500, [P.loopInterval]: 7,
      [P.glitchHold]: 0.7, [P.glitchDegrade]: 0.05, [P.glitchChaos]: 0.2, [P.glitchReverse]: 0.8, [P.glitchTilt]: 0.6,
      [P.autoGlitch]: 1,
    },
  },
  {
    name: 'Eco Polar',
    values: {
      [P.osc1Wave]: 1, [P.attack]: 0.01, [P.decay]: 0.4, [P.sustain]: 0.3, [P.release]: 0.4,
      [P.cutoff]: 1800, [P.resonance]: 1.2, [P.filterEnv]: 30, [P.volume]: -2,
      [P.wetMode]: 1, [P.wetMix]: 0.5, [P.wetTime]: 0.62, [P.wetModify]: 0.7,
      [P.glitchMix]: 0.2, [P.glitchGrainSize]: 200, [P.loopInterval]: 7, [P.loopJumps]: 0.4,
      [P.glitchHold]: 0.3, [P.glitchDegrade]: 0.2, [P.glitchChaos]: 0.25, [P.glitchReverse]: 0.2, [P.glitchTilt]: 0.7,
      [P.autoGlitch]: 1,
    },
  },
  {
    name: 'Respiro',
    values: {
      [P.osc1Wave]: 1, [P.osc2Wave]: 1, [P.osc2Level]: 0.8, [P.osc2Octave]: -1, [P.osc2Fine]: 9,
      [P.attack]: 0.4, [P.decay]: 0.6, [P.sustain]: 0.85, [P.release]: 1.5,
      [P.cutoff]: 900, [P.resonance]: 2.2, [P.filterEnv]: 10,
      [P.lfoShape]: 0, [P.lfoTarget]: 0, [P.lfoRate]: 0.35, [P.lfoDepth]: 0.45, [P.volume]: -3,
      [P.wetMode]: 0, [P.wetMix]: 0.35, [P.wetTime]: 0.7, [P.wetModify]: 0.5,
    },
  },
  {
    name: 'Vidrio',
    values: {
      [P.osc1Wave]: 4, [P.osc2Wave]: 0, [P.osc2Level]: 0.35, [P.osc2Octave]: 1,
      [P.attack]: 0.005, [P.decay]: 0.9, [P.sustain]: 0.2, [P.release]: 1.2,
      [P.cutoff]: 6500, [P.resonance]: 0.9, [P.filterEnv]: 6,
      [P.wetMode]: 1, [P.wetMix]: 0.35, [P.wetTime]: 0.45, [P.wetModify]: 0.55,
      [P.glitchMix]: 0.3, [P.glitchGrainSize]: 220, [P.loopInterval]: 7, [P.glitchHold]: 0.5,
      [P.glitchChaos]: 0.3, [P.glitchReverse]: 0.3, [P.autoGlitch]: 1,
    },
    points: [vidrio],
  },
]

/** The preset the app opens with: glitch on, so the first note already sounds like the plugin. */
export const STARTUP_PRESET = PRESETS.findIndex((p) => p.name === 'Glitch Suave')
