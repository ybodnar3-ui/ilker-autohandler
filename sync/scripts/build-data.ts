/**
 * Будує web/data.js — форму window.DATA (hero/featured/grid/stats), яку споживає
 * сайт — з catalog.json та covers.json (чисті обкладинки від pick-covers.py).
 *
 * Окремий крок після pick-covers.py, щоб data.js уже мав обрані обкладинки, а не
 * перше-ліпше фото willhaben (часто рекламний банер дилера).
 */
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { sourceUrl } from '../src/storage/images'
import type { Car, Catalog } from '../src/types'

const DATA_DIR = process.env.DATA_DIR ?? 'web/data'
const SITE_DIR = process.env.SITE_DIR ?? dirname(DATA_DIR)

type CoverPick = { cover: number; gallery: number[] }
type Covers = Record<string, CoverPick>

const IMG = (source: string) => sourceUrl(source)
const price = (n: number) => '€ ' + n.toLocaleString('de-DE')
const ps = (kw: number) => (kw ? Math.round(kw * 1.35962) : 0)

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
