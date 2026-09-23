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

const PAGE_ROWS = 100 // willhaben віддає щонайбільше 200 за раз, беремо із запасом
const MAX_PAGES = 20  // страховка від нескінченного циклу, якщо willhaben зациклить видачу
const dealerUrl = (page: number) =>
  `https://www.willhaben.at/iad/haendler/hayatgruppe/auto/?orgId=${ORG}&page=${page}&rows=${PAGE_ROWS}`

const NEXT_DATA = /<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/s

const getPage = (page: number) =>
  fetch(dealerUrl(page), { headers: { 'User-Agent': UA, 'Accept-Language': 'de-AT,de;q=0.9' } })

/**
 * Збирає ВЕСЬ сток дилера і віддає його як одну відповідь.
 *
 * willhaben обмежує видачу 200 оголошеннями за запит (більший `rows` він просто
 * ігнорує), тому єдиний спосіб не загубити авто при зростанні стоку — пагінація.
 * Сторінки зшиваємо в один __NEXT_DATA__, щоб конвеєр і його тести лишились
 * недоторканими: вони й далі бачать рівно одну сторінку.
 *
 * Якщо зібрати вдалося менше, ніж willhaben декларує в `rowsFound`, віддаємо
 * помилку. Часткова видача пройшла б перевірку осудності й СТЕРЛА б із сайту
 * авто, які насправді в наявності — краще пропустити цикл і повторити за 30 хв.
 */
async function fetchAllPages(): Promise<Response> {
  const first = await getPage(1)
  if (!first.ok) return first

  const html = await first.text()
  const match = NEXT_DATA.exec(html)
  if (!match) return new Response(html, { status: 200 }) // хай конвеєр сам відхилить

  const root = JSON.parse(match[1])
  const result = root?.props?.pageProps?.searchResult
  const list = result?.advertSummaryList
  if (!list?.advertSummary) return new Response(html, { status: 200 })

  const expected: number = Number(result.rowsFound ?? list.advertSummary.length)
  const all = [...list.advertSummary]
  const seen = new Set(all.map((a: { id?: string }) => a?.id))

  for (let page = 2; all.length < expected && page <= MAX_PAGES; page++) {
    const res = await getPage(page)
    if (!res.ok) break
    const m = NEXT_DATA.exec(await res.text())
    if (!m) break
    const ads = JSON.parse(m[1])?.props?.pageProps?.searchResult?.advertSummaryList?.advertSummary
    if (!Array.isArray(ads) || ads.length === 0) break
    let fresh = 0
    for (const ad of ads) {
      if (seen.has(ad?.id)) continue // та сама сторінка вдруге — далі йти нема сенсу
      seen.add(ad?.id)
      all.push(ad)
      fresh++
    }
    if (fresh === 0) break
  }

  if (all.length < expected) {
    console.error(`Зібрано ${all.length} з ${expected} оголошень — цикл пропущено, щоб не стерти наявні авто`)
    return new Response('', { status: 502 })
  }

  list.advertSummary = all
  console.log(`willhaben: зібрано ${all.length} оголошень (сторінок: ${Math.ceil(all.length / PAGE_ROWS)})`)
  return new Response(
    `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify(root)}</script>`,
    { status: 200 },
  )
}

const outcome = await runSync({
  bucket: fsBucket(DATA_DIR),
  now: new Date(),
  fetchPage: fetchAllPages,
  // Не викликається: head() для ключів фото повертає «наявне».
  fetchImage: (url) => fetch(url, { headers: { 'User-Agent': UA } }),
  triggerBuild: async () => {},
  notify: async (message) => console.error('[notify]', message),
})

console.log(JSON.stringify(outcome, null, 2))

// Будь-який заблокований цикл має падати ГУЧНО.
//
// Раніше тут стояло `carCount === 0`, але при збої конвеєр повертає кількість
// авто зі СТАРОГО каталогу — тобто 119, а не 0. Запуск виходив зеленим, хоча
// нічого не опубліковано. Якби willhaben змінив верстку, сайт тихо застиг би
// назавжди під зеленими галочками, і ніхто б не дізнався.
//
// `published: false` буває лише при справжньому збої: штатне «контент не
// змінився» — це published: true з rebuilt: false.
if (!outcome.published) {
  console.error(`Цикл заблоковано: ${outcome.reason ?? 'причина невідома'}`)
  console.error(`На сайті лишився попередній сток (${outcome.carCount} авто) — дані цілі, але застигли.`)
  process.exit(1)
}

// data.js для сайту будує окремий крок (build-data.ts) — уже з чистими
// обкладинками, які обрав pick-covers.py.
