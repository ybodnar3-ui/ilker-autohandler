import type { Car } from '../types'

const IMAGE_BASE = 'https://cache.willhaben.at/mmo/'

/** Скільки днів зберігаємо фото авто, якого вже немає у стоку. */
export const RETENTION_DAYS = 7

export type FetchLike = (url: string) => Promise<Response>

/**
 * Повнорозмірний варіант — це шлях без суфікса (1178×785).
 * Суфікс _hoved дає лише 400×267 і для сторінки авто непридатний.
 */
export const sourceUrl = (path: string): string => IMAGE_BASE + path

/**
 * Копіює до R2 ті фото, яких там ще немає.
 *
 * Перевірка наявності обовʼязкова: без неї кожен цикл качав би весь сток
 * заново — близько 185 МБ кожні 15 хвилин.
 *
 * Помилка одного фото не зупиняє решту: краще авто з неповною галереєю,
 * ніж провалений цикл синхронізації.
 */
export async function mirrorImages(bucket: R2Bucket, cars: Car[], fetchImpl: FetchLike): Promise<number> {
  let copied = 0

  for (const car of cars) {
    for (const image of car.images) {
      if (await bucket.head(image.key)) continue

      try {
        const response = await fetchImpl(sourceUrl(image.source))
        if (!response.ok) continue
        await bucket.put(image.key, await response.arrayBuffer(), {
          httpMetadata: { contentType: 'image/webp', cacheControl: 'public, max-age=31536000, immutable' },
        })
        copied += 1
      } catch {
        // Мережевий збій на одному фото — не привід зривати весь цикл
        continue
      }
    }
  }

  return copied
}

/**
 * Прибирає фото авто, яких немає у стоку довше за RETENTION_DAYS.
 * Дилер уже міг розіслати посилання, тому одразу після продажу не видаляємо.
 */
export async function pruneImages(bucket: R2Bucket, cars: Car[], now: Date): Promise<number> {
  const alive = new Set(cars.map((car) => car.id))
  const cutoff = now.getTime() - RETENTION_DAYS * 24 * 60 * 60 * 1000
  let removed = 0

  const listed = await bucket.list({ prefix: 'cars/' })
  for (const object of listed.objects) {
    const carId = object.key.split('/')[1]
    if (!carId || alive.has(carId)) continue
    if (object.uploaded.getTime() > cutoff) continue
    await bucket.delete(object.key)
    removed += 1
  }

  return removed
}
