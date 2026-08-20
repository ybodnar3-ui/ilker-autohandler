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

const DATA_DIR = process.env.DATA_DIR ?? 'web/data'
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

// Ненульовий код лише коли зовсім нема чого показати — щоб CI-крок упав
// помітно, але штатний «контент не змінився» вважався успіхом.
// data.js для сайту будує окремий крок (build-data.ts) — уже з чистими
// обкладинками, які обрав pick-covers.py.
if (outcome.carCount === 0) process.exit(1)
