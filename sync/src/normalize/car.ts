import type { RawAdvert } from '../source/willhaben'
import { attributesOf } from '../source/willhaben'
import { cleanTitle, carSlug } from './title'
import { translate, FUEL, TRANSMISSION, CONDITION, BODY_TYPE, EQUIPMENT } from './vocabulary'
import type { Car, CarImage } from '../types'

const WILLHABEN_BASE = 'https://www.willhaben.at/iad/'

const num = (value: string | undefined): number | null => {
  if (value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function parseImages(adId: string, raw: string | undefined): CarImage[] {
  if (!raw) return []
  return raw
    .split(';')
    .map((path) => path.trim())
    .filter(Boolean)
    .map((source, order) => ({ key: `cars/${adId}/${order}.webp`, source, order }))
}

function parseCoordinates(raw: string | undefined): { lat: number; lng: number } {
  const [lat, lng] = (raw ?? '').split(',').map(Number)
  return { lat: Number.isFinite(lat) ? lat! : 0, lng: Number.isFinite(lng) ? lng! : 0 }
}

/**
 * Перетворює сире оголошення willhaben на канонічний Car.
 * Повертає null, якщо оголошення непридатне для показу — без ціни або
 * без жодного фото сторінка авто не має сенсу.
 *
 * contentHash лишається порожнім; його рахує addContentHash з normalize/hash.ts.
 */
export function normalizeCar(ad: RawAdvert): Car | null {
  const a = attributesOf(ad)

  const id = a['ADID'] ?? ad.id
  const price = num(a['PRICE'])
  const images = parseImages(id, a['ALL_IMAGE_URLS'])

  if (!id || price === null || images.length === 0) return null

  const make = a['CAR_MODEL/MAKE'] ?? ''
  const model = a['CAR_MODEL/MODEL'] ?? ''
  const title = cleanTitle(a['HEADING'] ?? '', make, model)

  const equipment = (a['EQUIPMENT_RESOLVED'] ?? '')
    .split('|')
    .map((term) => term.trim())
    .filter(Boolean)
    .map((term) => translate(term, EQUIPMENT))

  return {
    id,
    uuid: a['AD_UUID'] ?? '',
    slug: carSlug(title, id),
    make,
    model,
    title,
    price,
    mileage: num(a['MILEAGE']) ?? 0,
    year: num(a['YEAR_MODEL']) ?? 0,
    powerKw: num(a['ENGINE/EFFECT']) ?? 0,
    fuel: translate(a['ENGINE/FUEL_RESOLVED'] ?? '', FUEL),
    transmission: translate(a['TRANSMISSION_RESOLVED'] ?? '', TRANSMISSION),
    condition: translate(a['CONDITION_RESOLVED'] ?? '', CONDITION),
    bodyType: translate(a['CAR_TYPE'] ?? '', BODY_TYPE),
    warranty: a['WARRANTY_RESOLVED'] === 'Ja',
    seats: num(a['NOOFSEATS']),
    owners: num(a['NO_OF_OWNERS']),
    equipment,
    images,
    location: {
      city: a['LOCATION'] ?? '',
      postcode: a['POSTCODE'] ?? '',
      ...parseCoordinates(a['COORDINATES']),
    },
    willhabenUrl: WILLHABEN_BASE + (a['SEO_URL'] ?? ''),
    publishedAt: a['PUBLISHED_String'] ?? '',
    updatedAt: new Date(num(a['LAST_UPDATED']) ?? 0).toISOString(),
    contentHash: '',
  }
}
