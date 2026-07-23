import { describe, it, expect } from 'vitest'
import { readCatalog, writeCatalog, writeLive, buildLive, readStatus, writeStatus, CATALOG_KEY, LIVE_KEY } from '../../src/storage/r2'
import type { Car, Catalog } from '../../src/types'

/** Мінімальний дублер R2: достатньо put/get для наших потреб. */
class FakeBucket {
  store = new Map<string, string>()
  async put(key: string, value: string) { this.store.set(key, value) }
  async get(key: string) {
    const value = this.store.get(key)
    return value === undefined ? null : { text: async () => value }
  }
}

const bucket = () => new FakeBucket() as unknown as R2Bucket & FakeBucket

const car = (id: string, price: number): Car => ({
  id, uuid: '', slug: `c-${id}`, make: 'BMW', model: 'X5', title: 'BMW X5',
  price, mileage: 1, year: 2020, powerKw: 100,
  fuel: { de: 'Diesel', en: 'Diesel', tr: 'Dizel' },
  transmission: { de: 'Automatik', en: 'Automatic', tr: 'Otomatik' },
  condition: { de: 'Gebrauchtwagen', en: 'Used', tr: 'İkinci el' },
  bodyType: { de: 'Limousine', en: 'Saloon', tr: 'Sedan' },
  warranty: false, seats: 5, owners: null, equipment: [],
  images: [{ key: `cars/${id}/0.webp`, source: 'a.jpg', order: 0 }],
  location: { city: '', postcode: '', lat: 0, lng: 0 },
  willhabenUrl: '', publishedAt: '', updatedAt: '', contentHash: 'h',
})

describe('catalog', () => {
  it('повертає null, коли каталогу ще немає', async () => {
    expect(await readCatalog(bucket())).toBeNull()
  })

  it('зберігає й читає каталог без втрат', async () => {
    const b = bucket()
    const catalog: Catalog = { generatedAt: '2026-07-22T00:00:00Z', catalogHash: 'abc', cars: [car('1', 100)] }
    await writeCatalog(b, catalog)
    expect(await readCatalog(b)).toEqual(catalog)
  })

  it('повертає null на пошкодженому JSON замість того, щоб кинути помилку', async () => {
    const b = bucket()
    b.store.set(CATALOG_KEY, '{зіпсовано')
    expect(await readCatalog(b)).toBeNull()
  })
})

describe('buildLive', () => {
  it('лишає лише ціну й доступність', () => {
    const live = buildLive([car('1', 100), car('2', 200)], '2026-07-22T00:00:00Z')
    expect(live).toEqual({
      generatedAt: '2026-07-22T00:00:00Z',
      cars: { '1': { price: 100, available: true }, '2': { price: 200, available: true } },
    })
  })

  it('лишається компактним на повному стоку', () => {
    const cars = Array.from({ length: 99 }, (_, i) => car(String(i), 20000))
    const size = JSON.stringify(buildLive(cars, '2026-07-22T00:00:00Z')).length
    expect(size).toBeLessThan(10_000)
  })
})

describe('live', () => {
  it('пише живий шар у свій ключ', async () => {
    const b = bucket()
    await writeLive(b, [car('1', 100)], '2026-07-22T00:00:00Z')
    expect(JSON.parse(b.store.get(LIVE_KEY)!).cars['1'].price).toBe(100)
  })
})

describe('status', () => {
  it('віддає початковий стан, коли файлу ще немає', async () => {
    const status = await readStatus(bucket())
    expect(status.lastSuccessAt).toBeNull()
    expect(status.consecutiveFailures).toBe(0)
  })

  it('зберігає й читає стан', async () => {
    const b = bucket()
    await writeStatus(b, {
      lastAttemptAt: '2026-07-22T00:00:00Z', lastSuccessAt: '2026-07-22T00:00:00Z',
      carCount: 99, lastError: null, consecutiveFailures: 0,
    })
    expect((await readStatus(b)).carCount).toBe(99)
  })
})
