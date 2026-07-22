import { describe, it, expect } from 'vitest'
import {
  translate, unknownTerms,
  FUEL, TRANSMISSION, CONDITION, BODY_TYPE, WARRANTY, EQUIPMENT,
} from '../../src/normalize/vocabulary'

describe('translate', () => {
  it('повертає три мови для відомого терміна', () => {
    expect(translate('Schaltgetriebe', TRANSMISSION)).toEqual({
      de: 'Schaltgetriebe', en: 'Manual', tr: 'Manuel',
    })
  })

  it('для невідомого терміна лишає німецьку в усіх мовах', () => {
    expect(translate('Quantenantrieb', FUEL)).toEqual({
      de: 'Quantenantrieb', en: 'Quantenantrieb', tr: 'Quantenantrieb',
    })
  })

  it('не приховує аварійний стан за нейтральним словом', () => {
    expect(translate('Unfallwagen', CONDITION)).toEqual({
      de: 'Unfallwagen', en: 'Accident vehicle', tr: 'Hasarlı araç',
    })
  })
})

describe('повнота таблиць', () => {
  // Значення зібрані з усіх 99 оголошень дилера. Набори закриті:
  // якщо willhaben додасть нове — тест впаде, і ми дізнаємось про це з тесту.
  it('покриває всі значення палива', () => {
    expect(unknownTerms(
      ['Benzin', 'Diesel', 'Elektro', 'Hybrid Elektro/Benzin', 'Hybrid Elektro/Diesel'], FUEL,
    )).toEqual([])
  })

  it('покриває всі значення коробки', () => {
    expect(unknownTerms(['Automatik', 'Schaltgetriebe'], TRANSMISSION)).toEqual([])
  })

  it('покриває всі значення стану', () => {
    expect(unknownTerms(['Gebrauchtwagen', 'Unfallwagen'], CONDITION)).toEqual([])
  })

  it('покриває всі типи кузова', () => {
    expect(unknownTerms([
      'Cabrio / Roadster', 'Klein-/ Kompaktwagen', 'Kleinbus', 'Kombi / Family Van',
      'Limousine', 'SUV / Geländewagen', 'Sportwagen / Coupé',
    ], BODY_TYPE)).toEqual([])
  })

  it('покриває гарантію', () => {
    expect(unknownTerms(['Ja', 'Nein'], WARRANTY)).toEqual([])
  })

  it('містить усі 115 назв комплектації', () => {
    expect(Object.keys(EQUIPMENT)).toHaveLength(115)
  })

  it('жоден запис не лишився без перекладу', () => {
    for (const [term, value] of Object.entries(EQUIPMENT)) {
      expect(value.en, `англійська для «${term}»`).toBeTruthy()
      expect(value.tr, `турецька для «${term}»`).toBeTruthy()
    }
  })
})
