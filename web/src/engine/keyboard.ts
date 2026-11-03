// Computer keyboard → notes, laid out like a piano (same as the VST3):
// A S D F G H J K L Ñ are white keys, W E T Y U O P the black keys above them.

export const KEY_CODES = [
  'KeyA', 'KeyW', 'KeyS', 'KeyE', 'KeyD', 'KeyF', 'KeyT', 'KeyG', 'KeyY', 'KeyH',
  'KeyU', 'KeyJ', 'KeyK', 'KeyO', 'KeyL', 'KeyP', 'Semicolon',
]
export const KEY_LABELS = ['a', 'w', 's', 'e', 'd', 'f', 't', 'g', 'y', 'h', 'u', 'j', 'k', 'o', 'l', 'p', 'ñ']

export const OCTAVE_DOWN = 'KeyZ'
export const OCTAVE_UP = 'KeyX'
export const MIN_BASE_NOTE = 24
export const MAX_BASE_NOTE = 84

/** The note a key plays with the keyboard starting at baseNote, or null if it isn't a note key. */
export function noteForKey(code: string, baseNote: number): number | null {
  const index = KEY_CODES.indexOf(code)
  return index < 0 ? null : baseNote + index
}

/** baseNote moved an octave down (Z) or up (X), within range. */
export function shiftOctave(baseNote: number, code: string): number {
  const step = code === OCTAVE_DOWN ? -12 : code === OCTAVE_UP ? 12 : 0
  return Math.min(MAX_BASE_NOTE, Math.max(MIN_BASE_NOTE, baseNote + step))
}

export const isBlackKey = (note: number) => [1, 3, 6, 8, 10].includes(note % 12)

const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
/** Scientific pitch name: 60 → "C4". */
export const noteName = (note: number) => `${NAMES[note % 12]}${Math.floor(note / 12) - 1}`
