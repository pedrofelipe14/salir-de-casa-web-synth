import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Choice } from './components/Choice'
import { Dropdown } from './components/Dropdown'
import { Knob } from './components/Knob'
import { Piano } from './components/Piano'
import { Scope } from './components/Scope'
import { Toggle } from './components/Toggle'
import { WaveEditor } from './components/WaveEditor'
import { SynthEngine } from './engine/engine'
import { MIN_BASE_NOTE, noteForKey, noteName, OCTAVE_DOWN, OCTAVE_UP, shiftOctave } from './engine/keyboard'
import { defaultValues, ParamId, PARAMS } from './engine/params'
import { PRESETS, STARTUP_PRESET } from './engine/presets'
import { defaultPoints, type Point, Wave } from './engine/wave'

type MidiState = 'off' | 'on' | 'unsupported' | 'denied'

const REPO_URL = 'https://github.com/pedrofelipe14/salir-de-casa-web-synth'
const PLUGIN_URL = 'https://github.com/pedrofelipe14/GlitchSynth'

/** Parameter values and wave points a preset sets (anything it leaves out goes back to default). */
function presetState(index: number): { values: number[]; points: Point[][] } {
  const p = PRESETS[index]
  const values = defaultValues()
  for (const [id, v] of Object.entries(p.values)) values[Number(id)] = v
  return { values, points: [0, 1].map((osc) => p.points?.[osc] ?? defaultPoints()) }
}

export default function App() {
  const engine = useMemo(() => new SynthEngine(), [])
  const [values, setValues] = useState(() => presetState(STARTUP_PRESET).values)
  const [points, setPoints] = useState(() => presetState(STARTUP_PRESET).points)
  const [active, setActive] = useState<Set<number>>(() => new Set())
  const [baseNote, setBaseNote] = useState(60)
  const [started, setStarted] = useState(false)
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null)
  const [preset, setPreset] = useState(STARTUP_PRESET)
  const [midi, setMidi] = useState<MidiState>('off')

  // Notes currently held by anything (mouse, keys, MIDI): a note started before the audio
  // engine finished booting is only sent if it's still held once the engine is up.
  const held = useRef(new Set<number>())

  const start = useCallback(async () => {
    await engine.start()
    setStarted(true)
    setAnalyser(engine.analyser)
  }, [engine])

  const noteOn = useCallback((note: number, velocity = 0.85) => {
    held.current.add(note)
    setActive((prev) => new Set(prev).add(note))
    start().then(() => {
      if (held.current.has(note)) engine.noteOn(note, velocity)
    })
  }, [engine, start])

  const noteOff = useCallback((note: number) => {
    held.current.delete(note)
    setActive((prev) => {
      const next = new Set(prev)
      next.delete(note)
      return next
    })
    engine.noteOff(note)
  }, [engine])

  const setParam = (id: ParamId, value: number) => {
    setValues((prev) => {
      const next = prev.slice()
      next[id] = value
      return next
    })
    engine.setParam(id, value)
    setPreset(-1)
  }

  const setOscPoints = (osc: number, pts: Point[], moved: number[]) => {
    setPoints((prev) => prev.map((p, i) => (i === osc ? pts : p)))
    moved.forEach((i) => engine.setWavePoint(osc, i, pts[i]))
    setPreset(-1)
  }

  const applyPreset = (index: number) => {
    const { values: next, points: nextPoints } = presetState(index)
    next.forEach((v, id) => engine.setParam(id, v))
    nextPoints.forEach((pts, osc) => pts.forEach((pt, i) => engine.setWavePoint(osc, i, pt)))
    setValues(next)
    setPoints(nextPoints)
    setPreset(index)
  }

  // The engine starts from defaults; bring it to the startup preset the UI is showing.
  useEffect(() => {
    const { values: v, points: p } = presetState(STARTUP_PRESET)
    v.forEach((value, id) => engine.setParam(id, value))
    p.forEach((pts, osc) => pts.forEach((pt, i) => engine.setWavePoint(osc, i, pt)))
  }, [engine])

  // Computer keyboard. Each key remembers the note it started, so changing octave
  // mid-note (Z/X) can't leave a note stuck.
  const baseRef = useRef(baseNote)
  baseRef.current = baseNote
  useEffect(() => {
    const keyNotes = new Map<string, number>()
    const typing = (e: KeyboardEvent) =>
      e.ctrlKey || e.metaKey || e.altKey || (e.target as HTMLElement).closest('input, select, textarea')

    const down = (e: KeyboardEvent) => {
      if (typing(e)) return
      if (e.code === OCTAVE_DOWN || e.code === OCTAVE_UP) {
        e.preventDefault()
        if (!e.repeat) setBaseNote((b) => shiftOctave(b, e.code))
        return
      }
      const note = noteForKey(e.code, baseRef.current)
      if (note === null) return
      e.preventDefault()
      if (e.repeat || keyNotes.has(e.code)) return
      keyNotes.set(e.code, note)
      noteOn(note)
    }
    const up = (e: KeyboardEvent) => {
      const note = keyNotes.get(e.code)
      if (note === undefined) return
      keyNotes.delete(e.code)
      noteOff(note)
    }
    const releaseAll = () => {
      keyNotes.forEach((note) => noteOff(note))
      keyNotes.clear()
    }

    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', releaseAll)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', releaseAll)
    }
  }, [noteOn, noteOff])

  const connectMidi = async () => {
    if (!navigator.requestMIDIAccess) {
      setMidi('unsupported')
      return
    }
    try {
      const access = await navigator.requestMIDIAccess()
      const listen = () => access.inputs.forEach((input) => {
        input.onmidimessage = (msg) => {
          const [status, note, velocity] = msg.data ?? []
          const kind = status & 0xf0
          if (kind === 0x90 && velocity > 0) noteOn(note, velocity / 127)
          else if (kind === 0x80 || kind === 0x90) noteOff(note)
        }
      })
      listen()
      access.onstatechange = listen // controllers plugged in later
      setMidi('on')
      start()
    } catch {
      setMidi('denied')
    }
  }

  const knob = (id: ParamId) => <Knob key={id} spec={PARAMS[id]} value={values[id]} onChange={(v) => setParam(id, v)} />
  const choice = (id: ParamId) => <Choice key={id} spec={PARAMS[id]} value={values[id]} onChange={(v) => setParam(id, v)} />
  const toggle = (id: ParamId) => <Toggle key={id} spec={PARAMS[id]} value={values[id]} onChange={(v) => setParam(id, v)} />
  const dropdown = (id: ParamId) => <Dropdown key={id} spec={PARAMS[id]} value={values[id]} onChange={(v) => setParam(id, v)} />

  // What Time and Modify do depends on the wet mode (same as the VST3).
  const wetHint = [
    'Tiempo = tamaño de la sala · Modificar = brillo',
    'Tiempo = tiempo del eco · Modificar = repeticiones',
    'Tiempo = largo del corte · Modificar = velocidad (reversa · ½ · reversa ×2 · ×2)',
  ][Math.round(values[ParamId.wetMode])]
  const glitchOn = values[ParamId.autoGlitch] > 0.5

  const oscPanel = (osc: 0 | 1) => {
    const first = osc === 0 ? ParamId.osc1Wave : ParamId.osc2Wave
    return (
      <section className="panel osc" aria-label={`Oscilador ${osc + 1}`}>
        <h2>Osc {osc + 1}</h2>
        <WaveEditor
          title={`OSC ${osc + 1}`}
          wave={values[first] as Wave}
          points={points[osc]}
          onPointsChange={(pts, moved) => setOscPoints(osc, pts, moved)}
          onWaveChange={(w) => setParam(first, w)}
        />
        {choice(first)}
        <div className="knobs">{[first + 1, first + 2, first + 3, first + 4].map(knob)}</div>
      </section>
    )
  }

  const midiLabel = { off: 'Conectar MIDI', on: 'MIDI conectado', unsupported: 'MIDI no disponible', denied: 'MIDI bloqueado' }[midi]

  return (
    <div className="app">
      <header className="top">
        <div className="brand">
          <h1>salir de casa</h1>
          <span className="tagline">web synth · C++ → WebAssembly</span>
        </div>
        <div className="top-controls">
          <label className="preset">
            <span>Preset</span>
            <select value={preset} onChange={(e) => applyPreset(Number(e.target.value))}>
              {preset === -1 && <option value={-1}>(editado)</option>}
              {PRESETS.map((p, i) => <option key={p.name} value={i}>{p.name}</option>)}
            </select>
          </label>
          <button type="button" className={`midi ${midi}`} onClick={connectMidi} disabled={midi === 'on'}>
            {midiLabel}
          </button>
        </div>
      </header>

      {!started && (
        <button type="button" className="power" onClick={start}>
          ▶ Encender el sonido
          <small>o tocá cualquier tecla del piano</small>
        </button>
      )}

      <main className="rack">
        {oscPanel(0)}
        {oscPanel(1)}
        <section className="panel env" aria-label="Envolvente">
          <h2>Envolvente</h2>
          <div className="knobs">{[ParamId.attack, ParamId.decay, ParamId.sustain, ParamId.release].map(knob)}</div>
        </section>
        <section className="panel filter" aria-label="Filtro">
          <h2>Filtro</h2>
          <div className="knobs">{[ParamId.cutoff, ParamId.resonance, ParamId.filterEnv].map(knob)}</div>
        </section>
        <section className="panel out" aria-label="Salida">
          <h2>Salida</h2>
          <div className="out-row">
            {knob(ParamId.volume)}
            <Scope analyser={analyser} />
          </div>
        </section>

        <section className="panel lfo" aria-label="LFO">
          <h2>LFO</h2>
          {choice(ParamId.lfoShape)}
          {choice(ParamId.lfoTarget)}
          <div className="knobs">{[ParamId.lfoRate, ParamId.lfoDepth].map(knob)}</div>
        </section>
        <section className="panel wet" aria-label="Wet">
          <h2>Wet</h2>
          {choice(ParamId.wetMode)}
          <div className="knobs">{[ParamId.wetMix, ParamId.wetTime, ParamId.wetModify].map(knob)}</div>
          <p className="panel-hint">{wetHint}</p>
          {choice(ParamId.routeOrder)}
        </section>
        <section className={`panel loop ${glitchOn ? '' : 'dimmed'}`} aria-label="Micro-loop">
          <h2>Micro-loop</h2>
          <div className="knobs">
            {knob(ParamId.glitchMix)}
            {knob(ParamId.glitchGrainSize)}
            {dropdown(ParamId.loopInterval)}
            {knob(ParamId.loopJumps)}
            {knob(ParamId.glitchHold)}
          </div>
          <div className="knobs">
            {[ParamId.glitchDegrade, ParamId.glitchChaos, ParamId.glitchReverse, ParamId.glitchTilt].map(knob)}
            {toggle(ParamId.autoGlitch)}
            {toggle(ParamId.loopKeep)}
          </div>
          {!glitchOn && <p className="panel-hint">Prendé Auto-Glitch para que el micro-loop procese el sinte.</p>}
        </section>
      </main>

      <footer className="keys">
        <div className="keys-info">
          <span>
            Octava <strong>{noteName(baseNote)}</strong>
            <button type="button" aria-label="Bajar octava" disabled={baseNote <= MIN_BASE_NOTE} onClick={() => setBaseNote((b) => shiftOctave(b, OCTAVE_DOWN))}>−</button>
            <button type="button" aria-label="Subir octava" onClick={() => setBaseNote((b) => shiftOctave(b, OCTAVE_UP))}>+</button>
          </span>
          <span className="hint">Teclado: A W S E D F T G Y H U J K O L P Ñ · Z/X cambia de octava</span>
        </div>
        <Piano
          lowest={baseNote}
          octaves={2}
          active={active}
          keyboardBase={baseNote}
          showLetters
          onNoteOn={(n) => noteOn(n)}
          onNoteOff={noteOff}
        />
        <p className="credits">
          El motor de audio es C++ compilado a WebAssembly y corre en un AudioWorklet ·{' '}
          <a href={REPO_URL}>código</a> · <a href={PLUGIN_URL}>plugin VST3</a>
        </p>
      </footer>
    </div>
  )
}
