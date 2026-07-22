import type { Car } from '../types'

async function sha256(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Хеш рахується ЛИШЕ зі значущих полів.
 *
 * updatedAt і будь-які ознаки «підняття» оголошення свідомо не входять:
 * дилер піднімає оголошення по кілька разів на день, зміст при цьому не
 * змінюється. Якби ми їх враховували, кожне підняття запускало б перебудову
 * сайту й вичерпало б місячний ліміт білдів за кілька днів.
 */
export async function carContentHash(car: Car): Promise<string> {
  const significant = [
    car.id,
    car.title,
    car.price,
    car.mileage,
    car.year,
    car.powerKw,
    car.fuel.de,
    car.transmission.de,
    car.condition.de,
    car.bodyType.de,
    car.warranty,
    car.seats,
    car.owners,
    car.equipment.map((e) => e.de).join(','),
    car.images.map((i) => i.source).join(','),
  ]
  return sha256(JSON.stringify(significant))
}

export async function withContentHash(car: Car): Promise<Car> {
  return { ...car, contentHash: await carContentHash(car) }
}

/** Хеш усього каталогу: сортуємо, щоб порядок оголошень не впливав. */
export async function catalogHash(cars: Car[]): Promise<string> {
  const hashes = await Promise.all(cars.map(carContentHash))
  return sha256(hashes.sort().join(':'))
}
