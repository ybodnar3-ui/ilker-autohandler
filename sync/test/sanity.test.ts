import { describe, it, expect } from 'vitest'
import { checkSanity } from '../src/sanity'
import type { Car, Catalog } from '../src/types'

const car = (id: string, overrides: Partial<Car> = {}): Car => ({
  id, uuid: `u${id}`, slug: `car-${id}`, make: 'BMW', model: 'X5', title: 'BMW X5',
  price: 20000, mileage: 100000, year: 2018, powerKw: 150,
  fuel: { de: 'Diesel', en: 'Diesel', tr: 'Dizel' },
  transmission: { de: 'Automatik', en: 'Automatic', tr: 'Otomatik' },
  condition: { de: 'Gebrauchtwagen', en: 'Used', tr: 'İkinci el' },
  bodyType: { de: 'Limousine', en: 'Saloon', tr: 'Sedan' },
  warranty: false, seats: 5, owners: null, equipment: [],
  images: [{ key: `cars/${id}/0.webp`, source: 'a.jpg', order: 0 }],
  location: { city: 'Wien', postcode: '1220', lat: 48.2, lng: 16.5 },
  willhabenUrl: 'https://example.test', publishedAt: '', updatedAt: '', contentHash: 'h',
  ...overrides,
})

const catalogOf = (cars: Car[]): Catalog => ({ generatedAt: '', catalogHash: 'x', cars })
const many = (count: number) => Array.from({ length: count }, (_, i) => car(String(i)))

describe('checkSanity', () => {
  it('пропускає нормальний результат', () => {
    const result = checkSanity({ httpOk: true, parsed: true, incoming: many(99), previous: catalogOf(many(99)) })
    expect(result.ok).toBe(true)
  })

  it('пропускає перший запуск, коли попереднього стану немає', () => {
    expect(checkSanity({ httpOk: true, parsed: true, incoming: many(99), previous: null }).ok).toBe(true)
  })

  it('відхиляє відповідь не 200', () => {
    const result = checkSanity({ httpOk: false, parsed: true, incoming: many(99), previous: null })
    expect(result).toEqual({ ok: false, reason: 'HTTP-запит до willhaben не вдався' })
  })

  it('відхиляє непрочитаний JSON', () => {
    const result = checkSanity({ httpOk: true, parsed: false, incoming: [], previous: null })
    expect(result).toEqual({ ok: false, reason: 'Не вдалося розібрати __NEXT_DATA__' })
  })

  it('відхиляє порожній результат', () => {
    const result = checkSanity({ httpOk: true, parsed: true, incoming: [], previous: catalogOf(many(99)) })
    expect(result).toEqual({ ok: false, reason: 'Розпізнано 0 авто' })
  })

  it('відхиляє падіння кількості більш ніж удвічі', () => {
    // 99 → 40 за 15 хвилин це не розпродаж, а збій
    const result = checkSanity({ httpOk: true, parsed: true, incoming: many(40), previous: catalogOf(many(99)) })
    expect(result.ok).toBe(false)
  })

  it('пропускає правдоподібне зменшення стоку', () => {
    // 99 → 96: три авто продалися, це нормально
    expect(checkSanity({ httpOk: true, parsed: true, incoming: many(96), previous: catalogOf(many(99)) }).ok).toBe(true)
  })

  it('відхиляє, коли понад 20% записів без обовʼязкових полів', () => {
    const broken = [...many(70), ...Array.from({ length: 30 }, (_, i) => car(`b${i}`, { title: '' }))]
    const result = checkSanity({ httpOk: true, parsed: true, incoming: broken, previous: catalogOf(many(99)) })
    expect(result.ok).toBe(false)
  })

  it('терпить поодинокі биті записи', () => {
    const mostlyFine = [...many(95), ...Array.from({ length: 5 }, (_, i) => car(`b${i}`, { title: '' }))]
    expect(checkSanity({ httpOk: true, parsed: true, incoming: mostlyFine, previous: catalogOf(many(99)) }).ok).toBe(true)
  })
})
