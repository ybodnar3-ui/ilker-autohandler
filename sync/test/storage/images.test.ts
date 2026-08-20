import { describe, it, expect, vi } from 'vitest'
import { sourceUrl, mirrorImages, pruneImages, RETENTION_DAYS } from '../../src/storage/images'
import type { Car } from '../../src/types'

class FakeBucket {
  store = new Map<string, ArrayBuffer>()
  // Uploaded timestamps, tracked separately so pruneImages tests can control
  // age precisely without disturbing the plain store used by mirrorImages tests.
  uploaded = new Map<string, Date>()
  async head(key: string) { return this.store.has(key) ? { key } : null }
  async put(key: string, value: ArrayBuffer) { this.store.set(key, value); this.uploaded.set(key, new Date()) }
  // Малий page size навмисно — щоб кілька фікстур вже змушували pruneImages
  // пройти через cursor-цикл, як це робить справжній R2 при >1000 обʼєктів.
  // Cursor — це остання видана ключ (не індекс), тому пагінація лишається
  // коректною навіть якщо попередню сторінку вже видалили з бакета.
  static PAGE_SIZE = 2
  async list({ prefix, cursor }: { prefix: string; cursor?: string }) {
    const remaining = [...this.store.keys()]
      .filter((key) => key.startsWith(prefix) && (!cursor || key > cursor))
      .sort()
    const pageKeys = remaining.slice(0, FakeBucket.PAGE_SIZE)
    const objects = pageKeys.map((key) => ({ key, uploaded: this.uploaded.get(key) ?? new Date() }))
    if (remaining.length > FakeBucket.PAGE_SIZE) {
      return { objects, truncated: true as const, cursor: pageKeys[pageKeys.length - 1] }
    }
    return { objects, truncated: false as const }
  }
  async delete(key: string) { this.store.delete(key); this.uploaded.delete(key) }
}

const bucket = () => new FakeBucket() as unknown as R2Bucket & FakeBucket

const carWith = (id: string, sources: string[]): Car => ({
  id, uuid: '', slug: `c-${id}`, make: '', model: '', title: 't',
  price: 1, mileage: 0, year: 2020, powerKw: 0,
  fuel: { de: '', en: '', tr: '' }, transmission: { de: '', en: '', tr: '' },
  condition: { de: '', en: '', tr: '' }, bodyType: { de: '', en: '', tr: '' },
  warranty: false, seats: null, owners: null, equipment: [],
  images: sources.map((source, order) => ({ key: `cars/${id}/${order}.webp`, source, order })),
  location: { city: '', postcode: '', lat: 0, lng: 0 },
  willhabenUrl: '', publishedAt: '', updatedAt: '', contentHash: '',
})

const okFetch = () =>
  vi.fn(async () => new Response(new ArrayBuffer(8), { status: 200 }))

describe('sourceUrl', () => {
  it('будує адресу повнорозмірного фото без суфікса', () => {
    // Без суфікса — 1178×785; _hoved дав би лише 400×267
    expect(sourceUrl('4/161/905/1774_-1239811916_n.jpg'))
      .toBe('https://cache.willhaben.at/mmo/4/161/905/1774_-1239811916_n.jpg')
  })
})

describe('mirrorImages', () => {
  it('завантажує фото, яких ще немає', async () => {
    const b = bucket()
    const fetchImpl = okFetch()
    const copied = await mirrorImages(b, [carWith('1', ['a.jpg', 'b.jpg'])], fetchImpl)
    expect(copied).toBe(2)
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(b.store.has('cars/1/0.webp')).toBe(true)
  })

  it('не перезавантажує вже наявні фото', async () => {
    const b = bucket()
    b.store.set('cars/1/0.webp', new ArrayBuffer(8))
    const fetchImpl = okFetch()
    const copied = await mirrorImages(b, [carWith('1', ['a.jpg'])], fetchImpl)
    expect(copied).toBe(0)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('пропускає фото, яке не вдалося завантажити, і не валить цикл', async () => {
    const b = bucket()
    const fetchImpl = vi.fn(async (url: string) =>
      url.endsWith('bad.jpg') ? new Response(null, { status: 404 }) : new Response(new ArrayBuffer(8), { status: 200 }))
    const copied = await mirrorImages(b, [carWith('1', ['bad.jpg', 'good.jpg'])], fetchImpl)
    expect(copied).toBe(1)
    expect(b.store.has('cars/1/1.webp')).toBe(true)
  })

  it('обмежує кількість спроб fetch бюджетом maxFetches', async () => {
    const b = bucket()
    const fetchImpl = okFetch()
    const car = carWith('1', ['a.jpg', 'b.jpg', 'c.jpg', 'd.jpg', 'e.jpg'])
    const copied = await mirrorImages(b, [car], fetchImpl, 2)
    expect(copied).toBe(2)
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(b.store.size).toBe(2)
  })

  it('рахує бюджет по спробах fetch, а не по успіхах — 404 теж витрачає квоту', async () => {
    const b = bucket()
    const fetchImpl = vi.fn(async (url: string) =>
      url.endsWith('bad.jpg') ? new Response(null, { status: 404 }) : new Response(new ArrayBuffer(8), { status: 200 }))
    const car = carWith('1', ['bad.jpg', 'good.jpg', 'extra.jpg'])
    const copied = await mirrorImages(b, [car], fetchImpl, 2)
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(copied).toBe(1)
    expect(b.store.has('cars/1/1.webp')).toBe(true)
    expect(b.store.has('cars/1/2.webp')).toBe(false)
  })

  it('не витрачає бюджет на фото, які вже є в бакеті (head-хіт)', async () => {
    const b = bucket()
    b.store.set('cars/1/0.webp', new ArrayBuffer(8))
    b.store.set('cars/1/1.webp', new ArrayBuffer(8))
    b.store.set('cars/1/2.webp', new ArrayBuffer(8))
    const fetchImpl = okFetch()
    const car = carWith('1', ['present0.jpg', 'present1.jpg', 'present2.jpg', 'absent0.jpg', 'absent1.jpg'])
    const copied = await mirrorImages(b, [car], fetchImpl, 2)
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(copied).toBe(2)
    expect(b.store.has('cars/1/3.webp')).toBe(true)
    expect(b.store.has('cars/1/4.webp')).toBe(true)
  })
})

describe('RETENTION_DAYS', () => {
  it('тримає фото проданих авто тиждень', () => {
    expect(RETENTION_DAYS).toBe(7)
  })
})

describe('pruneImages', () => {
  const now = new Date('2026-07-24T00:00:00Z')

  it('видаляє фото авто, якого вже немає у стоку і термін сплив', async () => {
    const b = bucket()
    b.store.set('cars/2/0.webp', new ArrayBuffer(8))
    b.uploaded.set('cars/2/0.webp', new Date('2026-07-10T00:00:00Z')) // 14 днів тому

    const removed = await pruneImages(b, [carWith('1', ['a.jpg'])], now)

    expect(removed).toBe(1)
    expect(b.store.has('cars/2/0.webp')).toBe(false)
  })

  it('не чіпає фото авто, яке все ще в стоку, навіть якщо фото старе', async () => {
    const b = bucket()
    b.store.set('cars/1/0.webp', new ArrayBuffer(8))
    b.uploaded.set('cars/1/0.webp', new Date('2026-07-10T00:00:00Z')) // 14 днів тому

    const removed = await pruneImages(b, [carWith('1', ['a.jpg'])], now)

    expect(removed).toBe(0)
    expect(b.store.has('cars/1/0.webp')).toBe(true)
  })

  it('не видаляє фото проданого авто, поки не сплив тиждень', async () => {
    const b = bucket()
    b.store.set('cars/3/0.webp', new ArrayBuffer(8))
    b.uploaded.set('cars/3/0.webp', new Date('2026-07-20T00:00:00Z')) // 4 дні тому

    const removed = await pruneImages(b, [carWith('1', ['a.jpg'])], now)

    expect(removed).toBe(0)
    expect(b.store.has('cars/3/0.webp')).toBe(true)
  })

  it('проходить через усі сторінки list(), а не лише першу', async () => {
    // 5 обʼєктів проданого авто при сторінці на 2 — без пагінації
    // pruneImages побачить лише перший list() і видалить не все.
    const b = bucket()
    const oldDate = new Date('2026-07-10T00:00:00Z') // 14 днів тому
    for (let i = 0; i < 5; i += 1) {
      const key = `cars/9/${i}.webp`
      b.store.set(key, new ArrayBuffer(8))
      b.uploaded.set(key, oldDate)
    }

    const removed = await pruneImages(b, [carWith('1', ['a.jpg'])], now)

    expect(removed).toBe(5)
    for (let i = 0; i < 5; i += 1) {
      expect(b.store.has(`cars/9/${i}.webp`)).toBe(false)
    }
  })
})
