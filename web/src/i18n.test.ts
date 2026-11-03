import { describe, expect, it } from 'vitest'
import { choicesOf, formatValue, labelOf, ParamId, PARAMS } from './engine/params'
import { STRINGS } from './i18n'

// The interface ships in Spanish and English; nothing should be left in only one of them.
describe('translations', () => {
  it('names every parameter in both languages', () => {
    for (const p of PARAMS) {
      expect(labelOf(p, 'es')).toBeTruthy()
      expect(labelOf(p, 'en')).toBeTruthy()
      if (p.unit === 'choice') expect(choicesOf(p, 'en')).toHaveLength(choicesOf(p, 'es').length)
    }
  })

  it('has the same interface texts in both languages', () => {
    const shape = (o: object): unknown => Object.fromEntries(
      Object.entries(o).map(([k, v]) => [k, Array.isArray(v) ? v.length : typeof v === 'object' ? shape(v) : typeof v]),
    )
    expect(shape(STRINGS.en)).toEqual(shape(STRINGS.es))
  })

  it('formats values in the chosen language', () => {
    expect(formatValue(PARAMS[ParamId.lfoTarget], 1, 'en')).toBe('Pitch')
    expect(formatValue(PARAMS[ParamId.lfoTarget], 1, 'es')).toBe('Tono')
    expect(formatValue(PARAMS[ParamId.autoGlitch], 1, 'en')).toBe('On')
    expect(formatValue(PARAMS[ParamId.loopInterval], 6, 'en')).toBe('+5th')
  })
})
