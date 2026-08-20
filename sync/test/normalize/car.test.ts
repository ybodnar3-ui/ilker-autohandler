import { describe, it, expect } from 'vitest'
import { normalizeCar } from '../../src/normalize/car'
import type { RawAdvert } from '../../src/source/willhaben'
import fixtures from '../fixtures/willhaben-ads-sample.json'

const adverts = fixtures as unknown as RawAdvert[]
const byId = (id: string) => adverts.find((a) => a.id === id)!

describe('normalizeCar', () => {
  it('нормалізує найдорожче авто зі стоку', () => {
    const car = normalizeCar(byId('1619051774'))!
    expect(car.id).toBe('1619051774')
    expect(car.title).toBe('Bentley Azure')
    expect(car.slug).toBe('bentley-azure-1619051774')
    expect(car.make).toBe('Bentley')
    expect(car.price).toBe(330000)
    expect(car.mileage).toBe(6800)
    expect(car.year).toBe(2023)
    expect(car.powerKw).toBe(404)
    expect(car.seats).toBe(4)
    expect(car.owners).toBe(1)
    expect(car.warranty).toBe(false)
    expect(car.fuel.en).toBe('Petrol')
    expect(car.transmission.en).toBe('Automatic')
    expect(car.bodyType.en).toBe('Convertible / Roadster')
    expect(car.images).toHaveLength(35)
  })

  it('будує ключі R2 і зберігає початковий шлях фото', () => {
    const car = normalizeCar(byId('1619051774'))!
    expect(car.images[0]).toEqual({
      key: 'cars/1619051774/0.webp',
      source: '4/161/905/1774_-1239811916_n.jpg',
      order: 0,
    })
  })

  it('розбирає координати й локацію', () => {
    const car = normalizeCar(byId('1619051774'))!
    expect(car.location).toEqual({
      city: 'Wien, 22. Bezirk, Donaustadt',
      postcode: '1220',
      lat: 48.21484,
      lng: 16.5058,
    })
  })

  it('будує посилання на оригінал оголошення', () => {
    const car = normalizeCar(byId('1619051774'))!
    expect(car.willhabenUrl).toBe(
      'https://www.willhaben.at/iad/gebrauchtwagen/d/auto/bentley-azure-sonder-edition-finanzierung-0-moe-1619051774/',
    )
  })

  it('позначає авто після ДТП, а не приховує це', () => {
    const car = normalizeCar(byId('1204956659'))!
    expect(car.condition.de).toBe('Unfallwagen')
    expect(car.condition.en).toBe('Accident vehicle')
  })

  it('віддає null для відсутньої кількості власників', () => {
    // NO_OF_OWNERS відсутній у 80 з 99 оголошень
    expect(normalizeCar(byId('1204956659'))!.owners).toBeNull()
  })

  it('віддає порожню комплектацію, коли поле відсутнє', () => {
    expect(normalizeCar(byId('1204956659'))!.equipment).toEqual([])
  })

  it('перекладає кожен пункт комплектації', () => {
    const car = normalizeCar(byId('1891775219'))!
    expect(car.equipment.length).toBeGreaterThan(0)
    expect(car.equipment[0]).toEqual({ de: 'ABS', en: 'ABS', tr: 'ABS' })
  })

  it('відкидає оголошення без ціни', () => {
    const ad: RawAdvert = { id: '9', attributes: { attribute: [{ name: 'ADID', values: ['9'] }] } }
    expect(normalizeCar(ad)).toBeNull()
  })

  it('відкидає оголошення без фото', () => {
    const ad: RawAdvert = {
      id: '9',
      attributes: {
        attribute: [
          { name: 'ADID', values: ['9'] },
          { name: 'PRICE', values: ['1000'] },
        ],
      },
    }
    expect(normalizeCar(ad)).toBeNull()
  })
})
