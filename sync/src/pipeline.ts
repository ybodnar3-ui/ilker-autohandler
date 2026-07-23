import { extractAdverts } from './source/willhaben'
import { normalizeCar } from './normalize/car'
import { withContentHash, catalogHash } from './normalize/hash'
import { checkSanity } from './sanity'
import { readCatalog, writeCatalog, writeLive, readStatus, writeStatus } from './storage/r2'
import { mirrorImages, pruneImages, type FetchLike } from './storage/images'
import type { Car, Catalog } from './types'

export interface SyncDeps {
  bucket: R2Bucket
  fetchPage: () => Promise<Response>
  fetchImage: FetchLike
  triggerBuild: () => Promise<void>
  notify: (message: string) => Promise<void>
  now: Date
}

export interface SyncOutcome {
  published: boolean
  rebuilt: boolean
  carCount: number
  reason: string | null
}

/**
 * Один цикл синхронізації.
 *
 * Порядок кроків важливий: спершу перевірка осудності, і лише потім будь-який
 * запис у каталог. Публікація неперевіреного стану — єдина помилка в цій
 * системі, яку користувач помітить раніше за нас.
 */
export async function runSync(deps: SyncDeps): Promise<SyncOutcome> {
  const { bucket, fetchPage, fetchImage, triggerBuild, notify, now } = deps
  const timestamp = now.toISOString()

  const previous = await readCatalog(bucket)
  const status = await readStatus(bucket)

  let httpOk = false
  let parsed = false
  let cars: Car[] = []

  try {
    const response = await fetchPage()
    httpOk = response.ok
    if (httpOk) {
      const adverts = extractAdverts(await response.text())
      parsed = true
      cars = await Promise.all(
        adverts.map(normalizeCar).filter((car): car is Car => car !== null).map(withContentHash),
      )
    }
  } catch {
    // parsed лишається false — перевірка осудності це відхилить
  }

  const verdict = checkSanity({ httpOk, parsed, incoming: cars, previous })

  if (!verdict.ok) {
    const firstFailure = status.consecutiveFailures === 0
    await writeStatus(bucket, {
      ...status,
      lastAttemptAt: timestamp,
      lastError: verdict.reason,
      consecutiveFailures: status.consecutiveFailures + 1,
    })
    // Сповіщаємо лише на переході у стан помилки, щоб не слати
    // однакове повідомлення кожні 15 хвилин.
    if (firstFailure) await notify(`Синхронізація не вдалась: ${verdict.reason}`)
    return { published: false, rebuilt: false, carCount: previous?.cars.length ?? 0, reason: verdict.reason }
  }

  // Живий шар оновлюється щоцикл — саме він дає свіжість без перебудови сайту.
  await writeLive(bucket, cars, timestamp)

  const hash = await catalogHash(cars)
  const changed = hash !== previous?.catalogHash

  if (changed) {
    await mirrorImages(bucket, cars, fetchImage)
    await pruneImages(bucket, cars, now)
    const catalog: Catalog = { generatedAt: timestamp, catalogHash: hash, cars }
    await writeCatalog(bucket, catalog)
    await triggerBuild()
  }

  await writeStatus(bucket, {
    lastAttemptAt: timestamp,
    lastSuccessAt: timestamp,
    carCount: cars.length,
    lastError: null,
    consecutiveFailures: 0,
  })

  return { published: true, rebuilt: changed, carCount: cars.length, reason: null }
}
