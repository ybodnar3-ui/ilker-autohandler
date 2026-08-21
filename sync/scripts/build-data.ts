/**
 * Будує web/data.js — форму window.DATA (hero/featured/grid/stats), яку споживає
 * сайт — з catalog.json та covers.json (чисті обкладинки від pick-covers.py).
 *
 * Кожне текстове поле віддається трьома мовами (de/en/tr), бо перемикач мов на
 * сайті працює без перезавантаження: локалізовані значення вже є в каталозі,
 * описи й підсумок опцій рахує describe.ts.
 */
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { sourceUrl } from '../src/storage/images'
import type { Car, Catalog, Lang, Localized } from '../src/types'
import { describe, highlightIdx } from './describe'

const DATA_DIR = process.env.DATA_DIR ?? 'web/data'
const SITE_DIR = process.env.SITE_DIR ?? dirname(DATA_DIR)
const LANGS: Lang[] = ['de', 'en', 'tr']
const LOCALE: Record<Lang, string> = { de: 'de-DE', en: 'en-GB', tr: 'tr-TR' }

type CoverPick = { cover: number; gallery: number[] }
type Covers = Record<string, CoverPick>

const IMG = (source: string) => sourceUrl(source)
const ps = (kw: number) => (kw ? Math.round(kw * 1.35962) : 0)

/** Значення по всіх мовах: { de: …, en: …, tr: … }. */
const each = (fn: (lang: Lang) => string): Localized =>
  Object.fromEntries(LANGS.map((l) => [l, fn(l)])) as Localized

/** Індекси фото авто: з covers.json, або дефолт (обкладинка = 0, галерея = всі). */
function pickFor(car: Car, covers: Covers): CoverPick {
  const c = covers[car.id]
  if (c && car.images[c.cover]) return c
  return { cover: 0, gallery: car.images.map((_, i) => i) }
}

/** Car (catalog) + вибір обкладинки → форма картки, яку очікує сайт. */
function toCard(car: Car, covers: Covers) {
  const pick = pickFor(car, covers)
  const url = (i: number) => (car.images[i] ? IMG(car.images[i].source) : '')
  const hl = highlightIdx(car)
  return {
    id: car.id,
    make: car.make,
    model: car.model,
    title: car.title,
    price: car.price,
    disp: each((l) => '€ ' + car.price.toLocaleString(LOCALE[l])),
    km: car.mileage,
    year: String(car.year),
    kw: car.powerKw ? String(car.powerKw) : '',
    ps: ps(car.powerKw),
    fuel: car.fuel,
    trans: car.transmission,
    body: car.bodyType,
    cond: car.condition,
    owners: car.owners != null ? String(car.owners) : '',
    warranty: car.warranty,
    eq: Object.fromEntries(LANGS.map((l) => [l, car.equipment.map((e) => e[l])])),
    hl: Object.fromEntries(LANGS.map((l) => [l, hl.map((i) => car.equipment[i][l])])),
    desc: each((l) => describe(car, l)),
    cover: url(pick.cover),
    gallery: pick.gallery.map(url).filter(Boolean),
  }
}

const catalog = JSON.parse(await readFile(join(DATA_DIR, 'catalog.json'), 'utf8')) as Catalog

const coversPath = join(DATA_DIR, 'covers.json')
const covers: Covers = existsSync(coversPath)
  ? (JSON.parse(await readFile(coversPath, 'utf8')) as Covers)
  : {}

// Найдорожчі — вперед: hero + вітрина показують флагмани (Bentley/Porsche…).
const cars = [...catalog.cars].sort((a, b) => b.price - a.price).map((c) => toCard(c, covers))
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
