/**
 * Node-раннер конвеєра синхронізації для деплою без Cloudflare.
 *
 * Той самий `runSync`, що й у Worker'і, але замість R2 — файлова система, а
 * фото не копіюються нікуди: сайт бере їх напряму з willhaben
 * (`https://cache.willhaben.at/mmo/{source}`). Запускається у GitHub Actions
 * за розкладом; пише catalog.json / live.json / status.json у web/data/.
 */
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { runSync } from '../src/pipeline'
import { sourceUrl } from '../src/storage/images'
import type { Car, Catalog } from '../src/types'

const DATA_DIR = process.env.DATA_DIR ?? 'web/data'
const SITE_DIR = process.env.SITE_DIR ?? dirname(DATA_DIR) // куди класти data.js для сайту
const ORG = process.env.WILLHABEN_ORG_ID ?? '1004471'
const UA = process.env.USER_AGENT ?? 'HayatGruppeSync/1.0 (+https://hayatgruppe.com)'

const isImageKey = (key: string) => key.startsWith('cars/')

/**
 * R2-сумісний бакет поверх файлової системи. Зберігаються лише JSON-ключі;
 * ключі фото (`cars/*.webp`) звітують як уже наявні, тому mirrorImages їх
 * пропускає — фото віддаємо хотлінком із willhaben, нікуди не копіюючи.
 */
function fsBucket(dir: string): R2Bucket {
  const bucket = {
    async get(key: string) {
      const p = join(dir, key)
      if (!existsSync(p)) return null
      const text = await readFile(p, 'utf8')
      return { text: async () => text }
    },
    async put(key: string, body: string | ArrayBuffer | ArrayBufferView) {
      if (isImageKey(key)) return // фото не зберігаємо
      const p = join(dir, key)
      await mkdir(dirname(p), { recursive: true })
      const data = typeof body === 'string' ? body : Buffer.from(body as ArrayBuffer)
      await writeFile(p, data)
    },
    async head(key: string) {
      if (isImageKey(key)) return {} // «фото вже є» → mirrorImages не качає
      return existsSync(join(dir, key)) ? {} : null
    },
    async list() {
      return { objects: [], truncated: false } // прибирати нічого — фото не в нас
    },
    async delete() {},
  }
  return bucket as unknown as R2Bucket
}

const dealerUrl = `https://www.willhaben.at/iad/haendler/hayatgruppe/auto/?orgId=${ORG}&page=1&rows=200`

const outcome = await runSync({
  bucket: fsBucket(DATA_DIR),
  now: new Date(),
  fetchPage: () =>
    fetch(dealerUrl, {
      headers: { 'User-Agent': UA, 'Accept-Language': 'de-AT,de;q=0.9' },
    }),
  // Не викликається: head() для ключів фото повертає «наявне».
  fetchImage: (url) => fetch(url, { headers: { 'User-Agent': UA } }),
  triggerBuild: async () => {},
  notify: async (message) => console.error('[notify]', message),
})

console.log(JSON.stringify(outcome, null, 2))

// --- data.js для сайту ---------------------------------------------------
// Прототип споживає window.DATA у своїй формі (hero/featured/grid/stats).
// Регенеруємо його з catalog.json щоцикл (ідемпотентно), бо Pages
// передеплоюється кожен запуск — окремий live-шар не потрібен.

const IMG = (source: string) => sourceUrl(source)
const price = (n: number) => '€ ' + n.toLocaleString('de-DE')
const ps = (kw: number) => (kw ? Math.round(kw * 1.35962) : 0)

/** Car (catalog) → форма картки, яку очікує застосунок сайту. */
function toCard(car: Car) {
  return {
    id: car.id,
    make: car.make,
    model: car.model,
    title: car.title,
    price: car.price,
    disp: price(car.price),
    km: car.mileage,
    year: String(car.year),
    fuel: car.fuel.de,
    kw: car.powerKw ? String(car.powerKw) : '',
    ps: ps(car.powerKw),
    trans: car.transmission.de,
    body: car.bodyType.de,
    cond: car.condition.de,
    owners: car.owners != null ? String(car.owners) : '',
    eq: car.equipment.map((e) => e.de),
    cover: car.images.length ? IMG(car.images[0].source) : '',
    gallery: car.images.map((i) => IMG(i.source)),
  }
}

async function writeSiteData(): Promise<void> {
  const raw = await readFile(join(DATA_DIR, 'catalog.json'), 'utf8')
  const catalog = JSON.parse(raw) as Catalog
  // Найдорожчі — вперед: hero + вітрина показують флагмани (Bentley/Porsche…).
  const cars = [...catalog.cars].sort((a, b) => b.price - a.price).map(toCard)
  const brands = new Set(cars.map((c) => c.make)).size
  const data = {
    hero: cars[0],
    featured: cars.slice(1, 6),
    grid: cars,
    stats: { total: cars.length, brands },
  }
  await mkdir(SITE_DIR, { recursive: true })
  await writeFile(join(SITE_DIR, 'data.js'), 'window.DATA=' + JSON.stringify(data) + ';\n')
  console.log(`data.js: ${cars.length} авто, ${brands} марок → ${join(SITE_DIR, 'data.js')}`)
}

if (existsSync(join(DATA_DIR, 'catalog.json'))) {
  await writeSiteData()
}

// Ненульовий код лише коли зовсім нема чого показати — щоб CI-крок упав
// помітно, але штатний «контент не змінився» вважався успіхом.
if (outcome.carCount === 0) process.exit(1)
