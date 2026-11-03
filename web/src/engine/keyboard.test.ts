import { describe, expect, it } from 'vitest'
import { isBlackKey, MAX_BASE_NOTE, MIN_BASE_NOTE, noteForKey, noteName, shiftOctave } from './keyboard'

describe('computer keyboard', () => {
  it('lays the home row out like a piano', () => {
    expect(noteForKey('KeyA', 60)).toBe(60) // C
    expect(noteForKey('KeyW', 60)).toBe(61) // C#
    expect(noteForKey('KeyK', 60)).toBe(72) // C an octave up
    expect(noteForKey('Semicolon', 60)).toBe(76) // Ñ on a Spanish layout
  })

  it('ignores keys that are not notes', () => {
    expect(noteForKey('KeyQ', 60)).toBeNull()
    expect(noteForKey('Space', 60)).toBeNull()
  })

  it('shifts octaves with Z and X, within range', () => {
    expect(shiftOctave(60, 'KeyZ')).toBe(48)
    expect(shiftOctave(60, 'KeyX')).toBe(72)
    expect(shiftOctave(MIN_BASE_NOTE, 'KeyZ')).toBe(MIN_BASE_NOTE)
    expect(shiftOctave(MAX_BASE_NOTE, 'KeyX')).toBe(MAX_BASE_NOTE)
  })

  it('names notes and finds the black keys', () => {
    expect(noteName(60)).toBe('C4')
    expect(noteName(69)).toBe('A4')
    expect([60, 61, 62, 63, 64, 65, 66].map(isBlackKey)).toEqual([false, true, false, true, false, false, true])
  })
})
