import type { Lang } from './engine/params'

export type { Lang }

/** Every piece of interface text, in Spanish and English. Parameter names live in engine/params.ts. */
export const STRINGS = {
  es: {
    tagline: 'web synth · C++ → WebAssembly',
    preset: 'Preset',
    edited: '(editado)',
    midi: { off: 'Conectar MIDI', on: 'MIDI conectado', unsupported: 'MIDI no disponible', denied: 'MIDI bloqueado' },
    power: '▶ Encender el sonido',
    powerHint: 'o tocá cualquier tecla del piano',
    osc: 'Osc',
    oscillator: 'Oscilador',
    envelope: 'Envolvente',
    filter: 'Filtro',
    output: 'Salida',
    waveCustom: 'onda propia',
    waveHint: 'arrastrá un punto para editar',
    waveAria: 'forma de onda',
    wetHints: [
      'Tiempo = tamaño de la sala · Modificar = brillo',
      'Tiempo = tiempo del eco · Modificar = repeticiones',
      'Tiempo = largo del corte · Modificar = velocidad (reversa · ½ · reversa ×2 · ×2)',
    ],
    glitchOffHint: 'Prendé Auto-Glitch para que el micro-loop procese el sinte.',
    octave: 'Octava',
    octaveDown: 'Bajar octava',
    octaveUp: 'Subir octava',
    keyboardHint: 'Teclado: A W S E D F T G Y H U J K O L P Ñ · Z/X cambia de octava',
    keyboard: 'Teclado',
    scope: 'Osciloscopio',
    credits: 'El motor de audio es C++ compilado a WebAssembly y corre en un AudioWorklet',
    code: 'código',
    plugin: 'plugin VST3',
    language: 'Idioma',
  },
  en: {
    tagline: 'web synth · C++ → WebAssembly',
    preset: 'Preset',
    edited: '(edited)',
    midi: { off: 'Connect MIDI', on: 'MIDI connected', unsupported: 'MIDI unavailable', denied: 'MIDI blocked' },
    power: '▶ Turn on the sound',
    powerHint: 'or play any key on the piano',
    osc: 'Osc',
    oscillator: 'Oscillator',
    envelope: 'Envelope',
    filter: 'Filter',
    output: 'Output',
    waveCustom: 'custom wave',
    waveHint: 'drag a point to edit',
    waveAria: 'waveform',
    wetHints: [
      'Time = room size · Modify = brightness',
      'Time = echo time · Modify = feedback',
      'Time = slice length · Modify = speed (reverse · ½ · reverse ×2 · ×2)',
    ],
    glitchOffHint: 'Turn on Auto-Glitch to run the micro-loop on the synth.',
    octave: 'Octave',
    octaveDown: 'Octave down',
    octaveUp: 'Octave up',
    keyboardHint: 'Keyboard: A W S E D F T G Y H U J K O L P ; · Z/X change octave',
    keyboard: 'Keyboard',
    scope: 'Oscilloscope',
    credits: 'The audio engine is C++ compiled to WebAssembly, running in an AudioWorklet',
    code: 'source',
    plugin: 'VST3 plugin',
    language: 'Language',
  },
} satisfies Record<Lang, unknown>

export type Strings = (typeof STRINGS)['es']

const STORAGE_KEY = 'sdc-lang'

/** Saved choice if there is one, otherwise the browser's language. */
export function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'es' || saved === 'en') return saved
  } catch {
    // storage blocked (private mode): fall back to the browser language
  }
  return navigator.language.toLowerCase().startsWith('es') ? 'es' : 'en'
}

export function saveLang(lang: Lang): void {
  try {
    localStorage.setItem(STORAGE_KEY, lang)
  } catch {
    // not being able to remember the choice is fine
  }
}
