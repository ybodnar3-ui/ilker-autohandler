import type { Car, Catalog, LiveData, SyncStatus } from '../types'

export const CATALOG_KEY = 'catalog.json'
export const LIVE_KEY = 'live.json'
export const STATUS_KEY = 'status.json'

const JSON_HEADERS = { httpMetadata: { contentType: 'application/json; charset=utf-8' } }

async function readJson<T>(bucket: R2Bucket, key: string): Promise<T | null> {
  const object = await bucket.get(key)
  if (!object) return null
  try {
    return JSON.parse(await object.text()) as T
  } catch {
    // Пошкоджений файл рівносильний його відсутності: викликач вирішить,
    // що робити, і в найгіршому разі перезапише його справним.
    return null
  }
}

export const readCatalog = (bucket: R2Bucket): Promise<Catalog | null> =>
  readJson<Catalog>(bucket, CATALOG_KEY)

export const writeCatalog = (bucket: R2Bucket, catalog: Catalog): Promise<unknown> =>
  bucket.put(CATALOG_KEY, JSON.stringify(catalog), JSON_HEADERS)

/**
 * Живий шар навмисно крихітний: його тягне кожна сторінка при відкритті,
 * тому в ньому лише те, що змінюється між перебудовами сайту.
 */
export function buildLive(cars: Car[], now: string): LiveData {
  const entries: LiveData['cars'] = {}
  for (const car of cars) entries[car.id] = { price: car.price, available: true }
  return { generatedAt: now, cars: entries }
}

export const writeLive = (bucket: R2Bucket, cars: Car[], now: string): Promise<unknown> =>
  bucket.put(LIVE_KEY, JSON.stringify(buildLive(cars, now)), JSON_HEADERS)

const INITIAL_STATUS: SyncStatus = {
  lastAttemptAt: '', lastSuccessAt: null, carCount: 0, lastError: null, consecutiveFailures: 0,
}

export async function readStatus(bucket: R2Bucket): Promise<SyncStatus> {
  return (await readJson<SyncStatus>(bucket, STATUS_KEY)) ?? { ...INITIAL_STATUS }
}

export const writeStatus = (bucket: R2Bucket, status: SyncStatus): Promise<unknown> =>
  bucket.put(STATUS_KEY, JSON.stringify(status), JSON_HEADERS)
