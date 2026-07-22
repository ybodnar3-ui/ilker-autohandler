import { describe, it, expect } from 'vitest'
import { carContentHash, withContentHash, catalogHash } from '../../src/normalize/hash'
import type { Car } from '../../src/types'

const car = (overrides: Partial<Car> = {}): Car => ({
  id: '1', uuid: 'u', slug: 'bentley-azure-1', make: 'Bentley', model: 'Azure',
  title: 'Bentley Azure', price: 330000, mileage: 6800, year: 2023, powerKw: 404,
  fuel: { de: 'Benzin', en: 'Petrol', tr: 'Benzin' },
  transmission: { de: 'Automatik', en: 'Automatic', tr: 'Otomatik' },
  condition: { de: 'Gebrauchtwagen', en: 'Used', tr: 'İkinci el' },
  bodyType: { de: 'Cabrio / Roadster', en: 'Convertible / Roadster', tr: 'Üstü açık / Roadster' },
  warranty: false, seats: 4, owners: 1, equipment: [],
  images: [{ key: 'cars/1/0.webp', source: 'a.jpg', order: 0 }],
  location: { city: 'Wien', postcode: '1220', lat: 48.2, lng: 16.5 },
  willhabenUrl: 'https://example.test/1', publishedAt: '2026-07-01T00:00:00Z',
  updatedAt: '2026-07-01T00:00:00Z', contentHash: '',
  ...overrides,
})

describe('carContentHash', () => {
  it('дає однаковий хеш для однакового змісту', async () => {
    expect(await carContentHash(car())).toBe(await carContentHash(car()))
  })

  it('ІГНОРУЄ підняття оголошення', async () => {
    // Дилер підняв оголошення: змінився лише час. Зміст той самий,
    // тому перебудовувати сайт не потрібно.
    const bumped = car({ updatedAt: '2026-07-22T15:00:00Z' })
    expect(await carContentHash(bumped)).toBe(await carContentHash(car()))
  })

  it('реагує на зміну ціни', async () => {
    expect(await carContentHash(car({ price: 319000 }))).not.toBe(await carContentHash(car()))
  })

  it('реагує на зміну пробігу', async () => {
    expect(await carContentHash(car({ mileage: 7200 }))).not.toBe(await carContentHash(car()))
  })

  it('реагує на зміну заголовка', async () => {
    expect(await carContentHash(car({ title: 'Bentley Azure GT' }))).not.toBe(await carContentHash(car()))
  })

  it('реагує на додавання фото', async () => {
    const extra = car({
      images: [
        { key: 'cars/1/0.webp', source: 'a.jpg', order: 0 },
        { key: 'cars/1/1.webp', source: 'b.jpg', order: 1 },
      ],
    })
    expect(await carContentHash(extra)).not.toBe(await carContentHash(car()))
  })
})

describe('withContentHash', () => {
  it('проставляє хеш у запис', async () => {
    const result = await withContentHash(car())
    expect(result.contentHash).toMatch(/^[0-9a-f]{64}$/)
  })
})

describe('catalogHash', () => {
  it('не залежить від порядку авто', async () => {
    const a = car({ id: '1' })
    const b = car({ id: '2', slug: 'x-2' })
    expect(await catalogHash([a, b])).toBe(await catalogHash([b, a]))
  })

  it('змінюється, коли авто зникає зі стоку', async () => {
    const a = car({ id: '1' })
    const b = car({ id: '2', slug: 'x-2' })
    expect(await catalogHash([a, b])).not.toBe(await catalogHash([a]))
  })
})
