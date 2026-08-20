import { describe, it, expect } from 'vitest'
import { planSeed } from '../../scripts/seed-images'
import { normalizeCar } from '../../src/normalize/car'
import type { Car } from '../../src/types'
import fixtureAds from '../fixtures/willhaben-ads-sample.json'

const cars: Car[] = fixtureAds.map(normalizeCar).filter((car): car is Car => car !== null)

describe('planSeed', () => {
  it('повертає елементи лише для ключів, яких немає в presentKeys', () => {
    const [firstCar] = cars
    if (!firstCar) throw new Error('фікстура порожня')
    const presentKeys = new Set(firstCar.images.slice(0, 1).map((image) => image.key))

    const items = planSeed([firstCar], presentKeys)

    expect(items).toHaveLength(firstCar.images.length - 1)
    expect(items.some((item) => item.key === firstCar.images[0]!.key)).toBe(false)
  })

  it('повертає порожній масив, коли всі ключі вже присутні (усталений стан після сідингу)', () => {
    const allKeys = new Set(cars.flatMap((car) => car.images.map((image) => image.key)))

    const items = planSeed(cars, allKeys)

    expect(items).toEqual([])
  })

  it('sourceUrl кожного елемента — повнорозмірна адреса willhaben без суфікса розміру', () => {
    const [firstCar] = cars
    if (!firstCar) throw new Error('фікстура порожня')

    const items = planSeed([firstCar], new Set())

    expect(items.length).toBeGreaterThan(0)
    for (const item of items) {
      const image = firstCar.images.find((img) => img.key === item.key)
      expect(image).toBeDefined()
      expect(item.sourceUrl).toBe(`https://cache.willhaben.at/mmo/${image!.source}`)
      expect(item.sourceUrl).not.toMatch(/_hoved/)
    }
  })
})
