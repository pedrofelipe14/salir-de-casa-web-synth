import { useRef } from 'react'
import { isBlackKey, KEY_LABELS, noteName } from '../engine/keyboard'

interface Props {
  lowest: number
  octaves: number
  active: Set<number>
  /** Notes reachable from the computer keyboard start here; their keys show the letter. */
  keyboardBase: number
  showLetters: boolean
  onNoteOn: (note: number) => void
  onNoteOff: (note: number) => void
}

/** On-screen keys. Click or touch to play; slide across for a glissando. */
export function Piano({ lowest, octaves, active, keyboardBase, showLetters, onNoteOn, onNoteOff }: Props) {
  const held = useRef(new Map<number, number>()) // pointerId -> note

  const notes = Array.from({ length: octaves * 12 + 1 }, (_, i) => lowest + i)
  const whites = notes.filter((n) => !isBlackKey(n))
  const whiteWidth = 100 / whites.length

  const noteAt = (x: number, y: number): number | null => {
    const el = document.elementFromPoint(x, y) as HTMLElement | null
    const key = el?.closest<HTMLElement>('[data-note]')
    return key ? Number(key.dataset.note) : null
  }

  const press = (pointer: number, note: number | null) => {
    const previous = held.current.get(pointer)
    if (previous === note) return
    if (previous !== undefined) onNoteOff(previous)
    if (note === null) held.current.delete(pointer)
    else {
      held.current.set(pointer, note)
      onNoteOn(note)
    }
  }

  return (
    <div
      className="piano"
      role="group"
      aria-label="Teclado"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        press(e.pointerId, noteAt(e.clientX, e.clientY))
      }}
      onPointerMove={(e) => {
        if (held.current.has(e.pointerId)) press(e.pointerId, noteAt(e.clientX, e.clientY))
      }}
      onPointerUp={(e) => press(e.pointerId, null)}
      onPointerCancel={(e) => press(e.pointerId, null)}
    >
      {notes.map((note) => {
        const black = isBlackKey(note)
        const whitesBefore = whites.filter((w) => w < note).length
        const style = black
          ? { left: `${whitesBefore * whiteWidth - whiteWidth * 0.32}%`, width: `${whiteWidth * 0.64}%` }
          : { left: `${whitesBefore * whiteWidth}%`, width: `${whiteWidth}%` }
        const letter = note - keyboardBase
        return (
          <div
            key={note}
            data-note={note}
            className={`key ${black ? 'black' : 'white'} ${active.has(note) ? 'on' : ''}`}
            style={style}
          >
            {showLetters && letter >= 0 && letter < KEY_LABELS.length && <span className="key-letter">{KEY_LABELS[letter]}</span>}
            {note % 12 === 0 && <span className="key-name">{noteName(note)}</span>}
          </div>
        )
      })}
    </div>
  )
}
