import { describe, it, expect } from 'vitest'
import { cleanTitle, slugify, carSlug } from '../../src/normalize/title'

describe('cleanTitle', () => {
  it('відрізає рекламний хвіст після слешів', () => {
    expect(cleanTitle('Bentley Azure /// SONDER EDITION /// FINANZIERUNG 0€ MÖ...', 'Bentley', 'Azure'))
      .toBe('Bentley Azure')
  })

  it('прибирає хвіст, що закінчується самими слешами', () => {
    expect(cleanTitle('Renault Mégane /// ANGEBOT DER WOCHE NUR ///', 'Renault', 'Mégane'))
      .toBe('Renault Mégane')
  })

  it('зберігає складену назву моделі до слешів', () => {
    expect(cleanTitle('Ford Mustang Cabrio /// USA FAHRZEUG DAHER DER PREIS...', 'Ford', 'Mustang'))
      .toBe('Ford Mustang Cabrio')
  })

  it('прибирає обірване останнє слово, коли обрізали всередині назви', () => {
    expect(cleanTitle('Mercedes-Benz Sprinter 316 CDI Maxi Hochdach Klima Kame...', 'Mercedes-Benz', 'Sprinter'))
      .toBe('Mercedes-Benz Sprinter 316 CDI Maxi Hochdach Klima')
  })

  it('лишає чистий заголовок без змін', () => {
    expect(cleanTitle('Porsche Cayenne', 'Porsche', 'Cayenne')).toBe('Porsche Cayenne')
  })

  it('підставляє модель, коли лишилась сама марка', () => {
    expect(cleanTitle('BMW /// FINANZIERUNG ///', 'BMW', 'X5')).toBe('BMW X5')
  })

  it('лишає саму марку, коли модель — Sonstige', () => {
    expect(cleanTitle('VW /// FINANZIERUNG 0€ MÖGLICH ///', 'VW', 'Sonstige')).toBe('VW')
  })

  it('лишає саму марку, коли модель порожня', () => {
    expect(cleanTitle('VW ///', 'VW', '')).toBe('VW')
  })
})

describe('slugify', () => {
  it('розкладає німецькі умляути за правилами мови', () => {
    expect(slugify('Mägäne Öl Über Straße')).toBe('maegaene-oel-ueber-strasse')
  })

  it('прибирає діакритику з інших мов', () => {
    expect(slugify('Renault Mégane')).toBe('renault-megane')
  })

  it('прибирає пунктуацію й стискає розділювачі', () => {
    expect(slugify('Mercedes-Benz  A/B (C)')).toBe('mercedes-benz-a-b-c')
  })
})

describe('carSlug', () => {
  it('додає id, щоб адреса лишалась унікальною', () => {
    expect(carSlug('Bentley Azure', '1619051774')).toBe('bentley-azure-1619051774')
  })
})
