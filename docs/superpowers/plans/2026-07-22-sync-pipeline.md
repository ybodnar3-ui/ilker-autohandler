# План реалізації: конвеєр синхронізації

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cloudflare Worker, що раз на 15 хвилин забирає сток дилера з willhaben, нормалізує його в канонічний формат і публікує в R2 як `catalog.json`, `live.json` і `status.json`, ніколи не публікуючи порожній чи зіпсований результат.

**Architecture:** Чисті функції (парсинг, нормалізація, хеш, перевірки осудності) відокремлені від звʼязків із платформою (R2, fetch, deploy hook). Логіка тестується звичайним Vitest без емуляції Workers; Worker лишається тонким шаром, що складає їх докупи.

**Tech Stack:** TypeScript, Cloudflare Workers, R2, Wrangler, Vitest.

Це **план 1 з 2**. План 2 — сайт на Astro, що споживає `catalog.json`.
Специфікація: [2026-07-22-hayat-cars-website-design.md](../specs/2026-07-22-hayat-cars-website-design.md).

## Global Constraints

- Мови: `de` (основна), `en`, `tr`. Тип `Lang = 'de' | 'en' | 'tr'`.
- Джерело: `https://www.willhaben.at/iad/haendler/hayatgruppe/auto/?orgId=1004471&page=1&rows=200`
- `orgId` = `1004471` — у змінних оточення, не в коді.
- Один HTTP-запит на цикл. Обхід антибот-захисту не реалізується.
- User-Agent чесний і незмінний: `HayatGruppeSync/1.0 (+https://hayatgruppe.com)`
- Cron: `*/15 * * * *`.
- **Збій ніколи не публікує порожній каталог.** Не пройшла перевірка осудності — попередній стан лишається недоторканим.
- `contentHash` не враховує `LAST_UPDATED` та `IS_BUMPED`.
- Фото проданих авто зберігаються ще **7 днів**.
- Ключі R2: `catalog.json`, `live.json`, `status.json`, `cars/{adId}/{index}.webp`.
- Повний розмір фото: `https://cache.willhaben.at/mmo/{path}` без суфікса (1178×785).

---

## Структура файлів

```
sync/
  package.json
  tsconfig.json
  wrangler.toml
  vitest.config.ts
  src/
    types.ts              Car, Localized, Catalog, LiveData, SyncStatus
    source/willhaben.ts   HTML → сирі оголошення + атрибути
    normalize/title.ts    чистка заголовка, модель, slug
    normalize/vocabulary.ts  словники DE→EN/TR
    normalize/car.ts      сире оголошення → Car
    normalize/hash.ts     хеш змісту
    sanity.ts             пʼять перевірок осудності
    storage/r2.ts         читання й запис catalog/live/status
    storage/images.ts     дзеркалення фото, прибирання старих
    pipeline.ts           оркестрація (залежності передаються ззовні)
    index.ts              Worker: scheduled()
  test/
    fixtures/             копія docs/research/fixtures
    *.test.ts
```

Розділення за відповідальністю, не за шаром. `normalize/` — чисті функції без
жодного знання про мережу чи R2, тому тестуються миттєво й без моків.

---

### Task 1: Каркас і витяг оголошень із HTML

**Files:**
- Create: `sync/package.json`, `sync/tsconfig.json`, `sync/vitest.config.ts`
- Create: `sync/src/source/willhaben.ts`
- Create: `sync/test/source/willhaben.test.ts`
- Create: `sync/test/fixtures/willhaben-ads-sample.json` (копія з `docs/research/fixtures/`)

**Interfaces:**
- Consumes: нічого
- Produces: `extractAdverts(html: string): RawAdvert[]`, `attributesOf(ad: RawAdvert): Record<string, string>`, типи `RawAdvert`

- [ ] **Step 1: Створити каркас робочої області**

```bash
mkdir -p sync/src/source sync/test/source sync/test/fixtures
cp docs/research/fixtures/*.json sync/test/fixtures/
```

`sync/package.json`:

```json
{
  "name": "hayat-sync",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit",
    "deploy": "wrangler deploy"
  },
  "devDependencies": {
    "@cloudflare/workers-types": "^5.20260722.1",
    "typescript": "^5.9.0",
    "vitest": "^4.1.10",
    "wrangler": "^4.113.0"
  }
}
```

`sync/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "types": ["@cloudflare/workers-types"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noEmit": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*.ts", "test/**/*.ts"]
}
```

`sync/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: { include: ['test/**/*.test.ts'] },
})
```

```bash
cd sync && npm install
```

- [ ] **Step 2: Написати падаючий тест**

`sync/test/source/willhaben.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { extractAdverts, attributesOf } from '../../src/source/willhaben'

const page = (payload: unknown) =>
  `<html><body><script id="__NEXT_DATA__" type="application/json">${JSON.stringify(payload)}</script></body></html>`

const wrap = (adverts: unknown[]) => ({
  props: { pageProps: { searchResult: { advertSummaryList: { advertSummary: adverts } } } },
})

describe('extractAdverts', () => {
  it('дістає оголошення з __NEXT_DATA__', () => {
    const html = page(wrap([{ id: '123', attributes: { attribute: [] } }]))
    expect(extractAdverts(html)).toHaveLength(1)
  })

  it('кидає помилку, якщо блок __NEXT_DATA__ відсутній', () => {
    expect(() => extractAdverts('<html></html>')).toThrow(/__NEXT_DATA__/)
  })

  it('кидає помилку на пошкодженому JSON', () => {
    const html = '<script id="__NEXT_DATA__" type="application/json">{нея</script>'
    expect(() => extractAdverts(html)).toThrow()
  })

  it('повертає порожній масив, коли оголошень немає', () => {
    expect(extractAdverts(page(wrap([])))).toEqual([])
  })
})

describe('attributesOf', () => {
  it('перетворює список атрибутів на словник', () => {
    const ad = {
      id: '1',
      attributes: { attribute: [{ name: 'PRICE', values: ['330000'] }] },
    }
    expect(attributesOf(ad as never)).toEqual({ PRICE: '330000' })
  })

  it('склеює кілька значень через кому', () => {
    const ad = {
      id: '1',
      attributes: { attribute: [{ name: 'X', values: ['a', 'b'] }] },
    }
    expect(attributesOf(ad as never).X).toBe('a|b')
  })
})
```

- [ ] **Step 3: Запустити тест і переконатись, що падає**

Run: `cd sync && npx vitest run test/source/willhaben.test.ts`
Expected: FAIL — `Failed to resolve import "../../src/source/willhaben"`

- [ ] **Step 4: Реалізувати**

`sync/src/source/willhaben.ts`:

```ts
export interface RawAttribute {
  name: string
  values: string[]
}

export interface RawAdvert {
  id: string
  attributes: { attribute: RawAttribute[] }
  advertImageList?: { advertImage?: Array<{ name: string }> }
}

const NEXT_DATA = /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/

/**
 * Дістає оголошення з JSON, який Next.js вбудовує у сторінку.
 * Ми навмисно не парсимо верстку: зміна дизайну willhaben нас не ламає,
 * ламає лише зміна структури даних.
 */
export function extractAdverts(html: string): RawAdvert[] {
  const match = NEXT_DATA.exec(html)
  if (!match?.[1]) {
    throw new Error('Блок __NEXT_DATA__ не знайдено — структура сторінки змінилась')
  }

  const data = JSON.parse(match[1]) as {
    props?: { pageProps?: { searchResult?: { advertSummaryList?: { advertSummary?: RawAdvert[] } } } }
  }

  return data.props?.pageProps?.searchResult?.advertSummaryList?.advertSummary ?? []
}

/** Атрибути приходять списком пар; для роботи зручніший словник. */
export function attributesOf(ad: RawAdvert): Record<string, string> {
  const out: Record<string, string> = {}
  for (const attr of ad.attributes?.attribute ?? []) {
    out[attr.name] = attr.values.join('|')
  }
  return out
}
```

- [ ] **Step 5: Запустити тести**

Run: `cd sync && npx vitest run test/source/willhaben.test.ts`
Expected: PASS — 6 passed

- [ ] **Step 6: Закомітити**

```bash
git add sync/
git commit -m "feat(sync): extract willhaben adverts from embedded JSON"
```

---

### Task 2: Чистка заголовків, модель і slug

**Files:**
- Create: `sync/src/normalize/title.ts`
- Create: `sync/test/normalize/title.test.ts`

**Interfaces:**
- Consumes: нічого
- Produces: `cleanTitle(heading: string, make: string, model: string): string`, `slugify(text: string): string`, `carSlug(title: string, id: string): string`

Правило чистки, виведене з реальних даних (99 оголошень):
1. Якщо є послідовність із двох і більше слешів — відрізати від неї все праворуч.
2. Інакше, якщо рядок закінчується на `...` — willhaben обрізав його всередині
   змістовної частини; прибрати `...` **і останнє слово**, бо воно неповне.
3. Стиснути пробіли, прибрати кінцеву пунктуацію.
4. Якщо лишилась сама марка — підставити модель, коли вона осмислена
   (`Sonstige` не осмислена). Так поводяться 2 оголошення з 99.

- [ ] **Step 1: Написати падаючий тест**

`sync/test/normalize/title.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { cleanTitle, slugify, carSlug } from '../../src/normalize/title'

describe('cleanTitle', () => {
  it('відрізає рекламний хвіст після слешів', () => {
    expect(cleanTitle('Bentley Azure /// SONDER EDITION /// FINANZIERUNG 0€ MÖ...', 'Bentley', 'Azure'))
      .toBe('Bentley Azure')
  })

  it('прибирає хвіст, що закінчується самими слешами', () => {
    expect(cleanTitle('Renault Mégane /// ANGEBOT DER WOCHE NUR ///', 'Renault', 'Mégane'))
      .toBe('Renault Mégane')
  })

  it('зберігає складену назву моделі до слешів', () => {
    expect(cleanTitle('Ford Mustang Cabrio /// USA FAHRZEUG DAHER DER PREIS...', 'Ford', 'Mustang'))
      .toBe('Ford Mustang Cabrio')
  })

  it('прибирає обірване останнє слово, коли обрізали всередині назви', () => {
    expect(cleanTitle('Mercedes-Benz Sprinter 316 CDI Maxi Hochdach Klima Kame...', 'Mercedes-Benz', 'Sprinter'))
      .toBe('Mercedes-Benz Sprinter 316 CDI Maxi Hochdach Klima')
  })

  it('лишає чистий заголовок без змін', () => {
    expect(cleanTitle('Porsche Cayenne', 'Porsche', 'Cayenne')).toBe('Porsche Cayenne')
  })

  it('підставляє модель, коли лишилась сама марка', () => {
    expect(cleanTitle('BMW /// FINANZIERUNG ///', 'BMW', 'X5')).toBe('BMW X5')
  })

  it('лишає саму марку, коли модель — Sonstige', () => {
    expect(cleanTitle('VW /// FINANZIERUNG 0€ MÖGLICH ///', 'VW', 'Sonstige')).toBe('VW')
  })

  it('лишає саму марку, коли модель порожня', () => {
    expect(cleanTitle('VW ///', 'VW', '')).toBe('VW')
  })
})

describe('slugify', () => {
  it('розкладає німецькі умляути за правилами мови', () => {
    expect(slugify('Mägäne Öl Über Straße')).toBe('maegaene-oel-ueber-strasse')
  })

  it('прибирає діакритику з інших мов', () => {
    expect(slugify('Renault Mégane')).toBe('renault-megane')
  })

  it('прибирає пунктуацію й стискає розділювачі', () => {
    expect(slugify('Mercedes-Benz  A/B (C)')).toBe('mercedes-benz-a-b-c')
  })
})

describe('carSlug', () => {
  it('додає id, щоб адреса лишалась унікальною', () => {
    expect(carSlug('Bentley Azure', '1619051774')).toBe('bentley-azure-1619051774')
  })
})
```

- [ ] **Step 2: Запустити тест і переконатись, що падає**

Run: `cd sync && npx vitest run test/normalize/title.test.ts`
Expected: FAIL — модуль не знайдено

- [ ] **Step 3: Реалізувати**

`sync/src/normalize/title.ts`:

```ts
const AD_TAIL = /\s*\/{2,}[\s\S]*$/
const TRAILING_PUNCT = /[\s,\-–—/]+$/

/** Умляути мають усталену транслітерацію; решту діакритики просто знімаємо. */
const UMLAUTS: Array<[RegExp, string]> = [
  [/ä/g, 'ae'], [/ö/g, 'oe'], [/ü/g, 'ue'], [/ß/g, 'ss'],
]

/**
 * Приводить заголовок willhaben до вигляду, придатного для показу.
 * Дилер дописує в заголовки рекламу («/// FINANZIERUNG 0€ MÖGLICH ///») —
 * на willhaben це працює на видачу, на власному сайті виглядає дешево.
 */
export function cleanTitle(heading: string, make: string, model: string): string {
  let text = heading ?? ''
  let truncatedMidWord = false

  if (AD_TAIL.test(text)) {
    text = text.replace(AD_TAIL, '')
  } else if (text.endsWith('...')) {
    // willhaben обрізав рядок усередині змістовної частини
    text = text.slice(0, -3)
    truncatedMidWord = true
  }

  text = text.replace(/\s+/g, ' ').replace(TRAILING_PUNCT, '').trim()

  if (truncatedMidWord) {
    const words = text.split(' ')
    if (words.length > 1) {
      words.pop() // останнє слово неповне
      text = words.join(' ')
    }
  }

  const meaninglessModel = !model || model === 'Sonstige'
  if (!text || text === make) {
    text = meaninglessModel ? make : `${make} ${model}`
  }

  return text.trim()
}

export function slugify(text: string): string {
  let out = text.toLowerCase()
  for (const [pattern, replacement] of UMLAUTS) out = out.replace(pattern, replacement)
  return out
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** Id у кінці гарантує унікальність, навіть якщо дві машини звуться однаково. */
export function carSlug(title: string, id: string): string {
  return `${slugify(title)}-${id}`
}
```

- [ ] **Step 4: Запустити тести**

Run: `cd sync && npx vitest run test/normalize/title.test.ts`
Expected: PASS — 12 passed

- [ ] **Step 5: Закомітити**

```bash
git add sync/src/normalize/title.ts sync/test/normalize/title.test.ts
git commit -m "feat(sync): clean advert headings and build stable slugs"
```

---

### Task 3: Словники перекладу

**Files:**
- Create: `sync/src/types.ts`
- Create: `sync/src/normalize/vocabulary.ts`
- Create: `sync/test/normalize/vocabulary.test.ts`

**Interfaces:**
- Consumes: нічого
- Produces: типи `Lang`, `Localized`; `translate(term: string, table: VocabularyTable): Localized`; таблиці `FUEL`, `TRANSMISSION`, `CONDITION`, `BODY_TYPE`, `WARRANTY`, `EQUIPMENT`; `unknownTerms(terms: string[], table: VocabularyTable): string[]`

Набори значень зібрані з усіх 99 оголошень і закриті:
паливо — 5, коробка — 2, стан — 2, кузов — 7, гарантія — 2, комплектація — 115.

**Це найбільший обсяг ручної роботи в плані.** 115 назв комплектації × 2 мови.
Нижче наведено повну структуру й перші записи кожної таблиці; решту
комплектації заповнити за тим самим зразком, звіряючись зі списком з
`sync/test/fixtures/inventory-snapshot-2026-07-22.json`.

- [ ] **Step 1: Написати падаючий тест**

`sync/test/normalize/vocabulary.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  translate, unknownTerms,
  FUEL, TRANSMISSION, CONDITION, BODY_TYPE, WARRANTY, EQUIPMENT,
} from '../../src/normalize/vocabulary'

describe('translate', () => {
  it('повертає три мови для відомого терміна', () => {
    expect(translate('Schaltgetriebe', TRANSMISSION)).toEqual({
      de: 'Schaltgetriebe', en: 'Manual', tr: 'Manuel',
    })
  })

  it('для невідомого терміна лишає німецьку в усіх мовах', () => {
    expect(translate('Quantenantrieb', FUEL)).toEqual({
      de: 'Quantenantrieb', en: 'Quantenantrieb', tr: 'Quantenantrieb',
    })
  })

  it('не приховує аварійний стан за нейтральним словом', () => {
    expect(translate('Unfallwagen', CONDITION)).toEqual({
      de: 'Unfallwagen', en: 'Accident vehicle', tr: 'Hasarlı araç',
    })
  })
})

describe('повнота таблиць', () => {
  // Значення зібрані з усіх 99 оголошень дилера. Набори закриті:
  // якщо willhaben додасть нове — тест впаде, і ми дізнаємось про це з тесту.
  it('покриває всі значення палива', () => {
    expect(unknownTerms(
      ['Benzin', 'Diesel', 'Elektro', 'Hybrid Elektro/Benzin', 'Hybrid Elektro/Diesel'], FUEL,
    )).toEqual([])
  })

  it('покриває всі значення коробки', () => {
    expect(unknownTerms(['Automatik', 'Schaltgetriebe'], TRANSMISSION)).toEqual([])
  })

  it('покриває всі значення стану', () => {
    expect(unknownTerms(['Gebrauchtwagen', 'Unfallwagen'], CONDITION)).toEqual([])
  })

  it('покриває всі типи кузова', () => {
    expect(unknownTerms([
      'Cabrio / Roadster', 'Klein-/ Kompaktwagen', 'Kleinbus', 'Kombi / Family Van',
      'Limousine', 'SUV / Geländewagen', 'Sportwagen / Coupé',
    ], BODY_TYPE)).toEqual([])
  })

  it('покриває гарантію', () => {
    expect(unknownTerms(['Ja', 'Nein'], WARRANTY)).toEqual([])
  })

  it('містить усі 115 назв комплектації', () => {
    expect(Object.keys(EQUIPMENT)).toHaveLength(115)
  })

  it('жоден запис не лишився без перекладу', () => {
    for (const [term, value] of Object.entries(EQUIPMENT)) {
      expect(value.en, `англійська для «${term}»`).toBeTruthy()
      expect(value.tr, `турецька для «${term}»`).toBeTruthy()
    }
  })
})
```

- [ ] **Step 2: Запустити тест і переконатись, що падає**

Run: `cd sync && npx vitest run test/normalize/vocabulary.test.ts`
Expected: FAIL — модуль не знайдено

- [ ] **Step 3: Створити типи**

`sync/src/types.ts`:

```ts
export type Lang = 'de' | 'en' | 'tr'

export type Localized = Record<Lang, string>

export interface CarImage {
  /** Ключ у R2, напр. cars/1619051774/0.webp */
  key: string
  /** Початковий шлях у willhaben — потрібен, щоб не завантажувати те саме двічі */
  source: string
  order: number
}

export interface Car {
  id: string
  uuid: string
  slug: string
  make: string
  model: string
  title: string
  price: number
  mileage: number
  year: number
  powerKw: number
  fuel: Localized
  transmission: Localized
  condition: Localized
  bodyType: Localized
  warranty: boolean
  seats: number | null
  owners: number | null
  equipment: Localized[]
  images: CarImage[]
  location: { city: string; postcode: string; lat: number; lng: number }
  willhabenUrl: string
  publishedAt: string
  updatedAt: string
  contentHash: string
}

export interface Catalog {
  generatedAt: string
  catalogHash: string
  cars: Car[]
}

export interface LiveData {
  generatedAt: string
  cars: Record<string, { price: number; available: boolean }>
}

export interface SyncStatus {
  lastAttemptAt: string
  lastSuccessAt: string | null
  carCount: number
  lastError: string | null
  consecutiveFailures: number
}
```

- [ ] **Step 4: Реалізувати словники**

`sync/src/normalize/vocabulary.ts`:

```ts
import type { Localized } from '../types'

export type VocabularyTable = Record<string, { en: string; tr: string }>

/**
 * Невідомий термін не ховаємо й не викидаємо — показуємо німецькою.
 * Краще показати клієнту слово чужою мовою, ніж порожнє місце.
 */
export function translate(term: string, table: VocabularyTable): Localized {
  const entry = table[term]
  return entry ? { de: term, en: entry.en, tr: entry.tr } : { de: term, en: term, tr: term }
}

/** Використовується тестами: які терміни таблиця ще не покриває. */
export function unknownTerms(terms: string[], table: VocabularyTable): string[] {
  return terms.filter((term) => !(term in table))
}

export const FUEL: VocabularyTable = {
  'Benzin': { en: 'Petrol', tr: 'Benzin' },
  'Diesel': { en: 'Diesel', tr: 'Dizel' },
  'Elektro': { en: 'Electric', tr: 'Elektrikli' },
  'Hybrid Elektro/Benzin': { en: 'Hybrid petrol/electric', tr: 'Hibrit benzin/elektrik' },
  'Hybrid Elektro/Diesel': { en: 'Hybrid diesel/electric', tr: 'Hibrit dizel/elektrik' },
}

export const TRANSMISSION: VocabularyTable = {
  'Automatik': { en: 'Automatic', tr: 'Otomatik' },
  'Schaltgetriebe': { en: 'Manual', tr: 'Manuel' },
}

export const CONDITION: VocabularyTable = {
  'Gebrauchtwagen': { en: 'Used', tr: 'İkinci el' },
  // Аварійний стан перекладаємо прямо. Пом'якшувати формулювання тут —
  // означає вводити покупця в оману щодо суттєвої вади.
  'Unfallwagen': { en: 'Accident vehicle', tr: 'Hasarlı araç' },
}

export const BODY_TYPE: VocabularyTable = {
  'Cabrio / Roadster': { en: 'Convertible / Roadster', tr: 'Üstü açık / Roadster' },
  'Klein-/ Kompaktwagen': { en: 'Small / Compact', tr: 'Küçük / Kompakt' },
  'Kleinbus': { en: 'Minibus', tr: 'Minibüs' },
  'Kombi / Family Van': { en: 'Estate / Van', tr: 'Station wagon / Van' },
  'Limousine': { en: 'Saloon', tr: 'Sedan' },
  'SUV / Geländewagen': { en: 'SUV / Off-road', tr: 'SUV / Arazi aracı' },
  'Sportwagen / Coupé': { en: 'Sports car / Coupé', tr: 'Spor araba / Coupé' },
}

export const WARRANTY: VocabularyTable = {
  'Ja': { en: 'Yes', tr: 'Evet' },
  'Nein': { en: 'No', tr: 'Hayır' },
}

/**
 * Комплектація винесена в окремий файл: 115 записів зробили б цей модуль
 * нечитабельним, а змінюються вони незалежно від решти словників.
 */
export { EQUIPMENT } from './equipment'
```

> **Таблиця комплектації вже написана** — файл `sync/src/normalize/equipment.ts`
> лежить у репозиторії, всі 115 записів заповнені трьома мовами. Склад звірено
> з живими даними: жодного зайвого чи пропущеного терміна. Створювати її
> не треба, лише переконатись, що тести на повноту проходять.

- [ ] **Step 5: Запустити тести**

Run: `cd sync && npx vitest run test/normalize/vocabulary.test.ts`
Expected: PASS — 10 passed

- [ ] **Step 6: Закомітити**

```bash
git add sync/src/types.ts sync/src/normalize/vocabulary.ts sync/test/normalize/vocabulary.test.ts
git commit -m "feat(sync): add DE/EN/TR vocabulary tables for listing attributes"
```

---

### Task 4: Нормалізація оголошення в Car

**Files:**
- Create: `sync/src/normalize/car.ts`
- Create: `sync/test/normalize/car.test.ts`

**Interfaces:**
- Consumes: `attributesOf` (Task 1), `cleanTitle`/`carSlug` (Task 2), словники (Task 3), типи `Car`/`CarImage`
- Produces: `normalizeCar(ad: RawAdvert): Car | null` — повертає `null`, коли оголошення непридатне (немає id, ціни або фото). `contentHash` на цьому етапі порожній рядок, його заповнює Task 5.

- [ ] **Step 1: Написати падаючий тест**

`sync/test/normalize/car.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { normalizeCar } from '../../src/normalize/car'
import type { RawAdvert } from '../../src/source/willhaben'
import fixtures from '../fixtures/willhaben-ads-sample.json'

const adverts = fixtures as unknown as RawAdvert[]
const byId = (id: string) => adverts.find((a) => a.id === id)!

describe('normalizeCar', () => {
  it('нормалізує найдорожче авто зі стоку', () => {
    const car = normalizeCar(byId('1619051774'))!
    expect(car.id).toBe('1619051774')
    expect(car.title).toBe('Bentley Azure')
    expect(car.slug).toBe('bentley-azure-1619051774')
    expect(car.make).toBe('Bentley')
    expect(car.price).toBe(330000)
    expect(car.mileage).toBe(6800)
    expect(car.year).toBe(2023)
    expect(car.powerKw).toBe(404)
    expect(car.seats).toBe(4)
    expect(car.owners).toBe(1)
    expect(car.warranty).toBe(false)
    expect(car.fuel.en).toBe('Petrol')
    expect(car.transmission.en).toBe('Automatic')
    expect(car.bodyType.en).toBe('Convertible / Roadster')
    expect(car.images).toHaveLength(35)
  })

  it('будує ключі R2 і зберігає початковий шлях фото', () => {
    const car = normalizeCar(byId('1619051774'))!
    expect(car.images[0]).toEqual({
      key: 'cars/1619051774/0.webp',
      source: '4/161/905/1774_-1239811916_n.jpg',
      order: 0,
    })
  })

  it('розбирає координати й локацію', () => {
    const car = normalizeCar(byId('1619051774'))!
    expect(car.location).toEqual({
      city: 'Wien, 22. Bezirk, Donaustadt',
      postcode: '1220',
      lat: 48.21484,
      lng: 16.5058,
    })
  })

  it('будує посилання на оригінал оголошення', () => {
    const car = normalizeCar(byId('1619051774'))!
    expect(car.willhabenUrl).toBe(
      'https://www.willhaben.at/iad/gebrauchtwagen/d/auto/bentley-azure-sonder-edition-finanzierung-0-moe-1619051774/',
    )
  })

  it('позначає авто після ДТП, а не приховує це', () => {
    const car = normalizeCar(byId('1204956659'))!
    expect(car.condition.de).toBe('Unfallwagen')
    expect(car.condition.en).toBe('Accident vehicle')
  })

  it('віддає null для відсутньої кількості власників', () => {
    // NO_OF_OWNERS відсутній у 80 з 99 оголошень
    expect(normalizeCar(byId('1204956659'))!.owners).toBeNull()
  })

  it('віддає порожню комплектацію, коли поле відсутнє', () => {
    expect(normalizeCar(byId('1204956659'))!.equipment).toEqual([])
  })

  it('перекладає кожен пункт комплектації', () => {
    const car = normalizeCar(byId('1891775219'))!
    expect(car.equipment.length).toBeGreaterThan(0)
    expect(car.equipment[0]).toEqual({ de: 'ABS', en: 'ABS', tr: 'ABS' })
  })

  it('відкидає оголошення без ціни', () => {
    const ad: RawAdvert = { id: '9', attributes: { attribute: [{ name: 'ADID', values: ['9'] }] } }
    expect(normalizeCar(ad)).toBeNull()
  })

  it('відкидає оголошення без фото', () => {
    const ad: RawAdvert = {
      id: '9',
      attributes: {
        attribute: [
          { name: 'ADID', values: ['9'] },
          { name: 'PRICE', values: ['1000'] },
        ],
      },
    }
    expect(normalizeCar(ad)).toBeNull()
  })
})
```

- [ ] **Step 2: Запустити тест і переконатись, що падає**

Run: `cd sync && npx vitest run test/normalize/car.test.ts`
Expected: FAIL — модуль не знайдено

- [ ] **Step 3: Реалізувати**

`sync/src/normalize/car.ts`:

```ts
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
```

- [ ] **Step 4: Запустити тести**

Run: `cd sync && npx vitest run test/normalize/car.test.ts`
Expected: PASS — 10 passed

- [ ] **Step 5: Закомітити**

```bash
git add sync/src/normalize/car.ts sync/test/normalize/car.test.ts
git commit -m "feat(sync): normalise raw adverts into canonical Car records"
```

---

### Task 5: Хеш змісту, стійкий до підняття оголошень

**Files:**
- Create: `sync/src/normalize/hash.ts`
- Create: `sync/test/normalize/hash.test.ts`

**Interfaces:**
- Consumes: тип `Car`
- Produces: `carContentHash(car: Car): Promise<string>`, `withContentHash(car: Car): Promise<Car>`, `catalogHash(cars: Car[]): Promise<string>`

Це найважливіша функція для економії білдів. Дилери постійно «піднімають»
оголошення — це змінює `LAST_UPDATED`, але не зміст. Якби хеш це враховував,
сайт перебудовувався б щогодини даремно і вичерпав ліміт 500 білдів на місяць.

- [ ] **Step 1: Написати падаючий тест**

`sync/test/normalize/hash.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { carContentHash, withContentHash, catalogHash } from '../../src/normalize/hash'
import type { Car } from '../../src/types'

const car = (overrides: Partial<Car> = {}): Car => ({
  id: '1', uuid: 'u', slug: 'bentley-azure-1', make: 'Bentley', model: 'Azure',
  title: 'Bentley Azure', price: 330000, mileage: 6800, year: 2023, powerKw: 404,
  fuel: { de: 'Benzin', en: 'Petrol', tr: 'Benzin' },
  transmission: { de: 'Automatik', en: 'Automatic', tr: 'Otomatik' },
  condition: { de: 'Gebrauchtwagen', en: 'Used', tr: 'İkinci el' },
  bodyType: { de: 'Cabrio / Roadster', en: 'Convertible / Roadster', tr: 'Üstü açık / Roadster' },
  warranty: false, seats: 4, owners: 1, equipment: [],
  images: [{ key: 'cars/1/0.webp', source: 'a.jpg', order: 0 }],
  location: { city: 'Wien', postcode: '1220', lat: 48.2, lng: 16.5 },
  willhabenUrl: 'https://example.test/1', publishedAt: '2026-07-01T00:00:00Z',
  updatedAt: '2026-07-01T00:00:00Z', contentHash: '',
  ...overrides,
})

describe('carContentHash', () => {
  it('дає однаковий хеш для однакового змісту', async () => {
    expect(await carContentHash(car())).toBe(await carContentHash(car()))
  })

  it('ІГНОРУЄ підняття оголошення', async () => {
    // Дилер підняв оголошення: змінився лише час. Зміст той самий,
    // тому перебудовувати сайт не потрібно.
    const bumped = car({ updatedAt: '2026-07-22T15:00:00Z' })
    expect(await carContentHash(bumped)).toBe(await carContentHash(car()))
  })

  it('реагує на зміну ціни', async () => {
    expect(await carContentHash(car({ price: 319000 }))).not.toBe(await carContentHash(car()))
  })

  it('реагує на зміну пробігу', async () => {
    expect(await carContentHash(car({ mileage: 7200 }))).not.toBe(await carContentHash(car()))
  })

  it('реагує на зміну заголовка', async () => {
    expect(await carContentHash(car({ title: 'Bentley Azure GT' }))).not.toBe(await carContentHash(car()))
  })

  it('реагує на додавання фото', async () => {
    const extra = car({
      images: [
        { key: 'cars/1/0.webp', source: 'a.jpg', order: 0 },
        { key: 'cars/1/1.webp', source: 'b.jpg', order: 1 },
      ],
    })
    expect(await carContentHash(extra)).not.toBe(await carContentHash(car()))
  })
})

describe('withContentHash', () => {
  it('проставляє хеш у запис', async () => {
    const result = await withContentHash(car())
    expect(result.contentHash).toMatch(/^[0-9a-f]{64}$/)
  })
})

describe('catalogHash', () => {
  it('не залежить від порядку авто', async () => {
    const a = car({ id: '1' })
    const b = car({ id: '2', slug: 'x-2' })
    expect(await catalogHash([a, b])).toBe(await catalogHash([b, a]))
  })

  it('змінюється, коли авто зникає зі стоку', async () => {
    const a = car({ id: '1' })
    const b = car({ id: '2', slug: 'x-2' })
    expect(await catalogHash([a, b])).not.toBe(await catalogHash([a]))
  })
})
```

- [ ] **Step 2: Запустити тест і переконатись, що падає**

Run: `cd sync && npx vitest run test/normalize/hash.test.ts`
Expected: FAIL — модуль не знайдено

- [ ] **Step 3: Реалізувати**

`sync/src/normalize/hash.ts`:

```ts
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
```

- [ ] **Step 4: Запустити тести**

Run: `cd sync && npx vitest run test/normalize/hash.test.ts`
Expected: PASS — 9 passed

- [ ] **Step 5: Закомітити**

```bash
git add sync/src/normalize/hash.ts sync/test/normalize/hash.test.ts
git commit -m "feat(sync): hash listing content, ignoring bump-only changes"
```

---

### Task 6: Перевірки осудності

**Files:**
- Create: `sync/src/sanity.ts`
- Create: `sync/test/sanity.test.ts`

**Interfaces:**
- Consumes: типи `Car`, `Catalog`
- Produces: `checkSanity(input: SanityInput): SanityResult`, типи `SanityInput`, `SanityResult`

Це найважливіші тести проєкту. Кожен рядок таблиці зі специфікації —
окремий тест. Наслідок пропущеної перевірки: сайт тихо стає порожнім,
і власник дізнається про це від дилера, а не з логів.

- [ ] **Step 1: Написати падаючий тест**

`sync/test/sanity.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { checkSanity } from '../src/sanity'
import type { Car, Catalog } from '../src/types'

const car = (id: string, overrides: Partial<Car> = {}): Car => ({
  id, uuid: `u${id}`, slug: `car-${id}`, make: 'BMW', model: 'X5', title: 'BMW X5',
  price: 20000, mileage: 100000, year: 2018, powerKw: 150,
  fuel: { de: 'Diesel', en: 'Diesel', tr: 'Dizel' },
  transmission: { de: 'Automatik', en: 'Automatic', tr: 'Otomatik' },
  condition: { de: 'Gebrauchtwagen', en: 'Used', tr: 'İkinci el' },
  bodyType: { de: 'Limousine', en: 'Saloon', tr: 'Sedan' },
  warranty: false, seats: 5, owners: null, equipment: [],
  images: [{ key: `cars/${id}/0.webp`, source: 'a.jpg', order: 0 }],
  location: { city: 'Wien', postcode: '1220', lat: 48.2, lng: 16.5 },
  willhabenUrl: 'https://example.test', publishedAt: '', updatedAt: '', contentHash: 'h',
  ...overrides,
})

const catalogOf = (cars: Car[]): Catalog => ({ generatedAt: '', catalogHash: 'x', cars })
const many = (count: number) => Array.from({ length: count }, (_, i) => car(String(i)))

describe('checkSanity', () => {
  it('пропускає нормальний результат', () => {
    const result = checkSanity({ httpOk: true, parsed: true, incoming: many(99), previous: catalogOf(many(99)) })
    expect(result.ok).toBe(true)
  })

  it('пропускає перший запуск, коли попереднього стану немає', () => {
    expect(checkSanity({ httpOk: true, parsed: true, incoming: many(99), previous: null }).ok).toBe(true)
  })

  it('відхиляє відповідь не 200', () => {
    const result = checkSanity({ httpOk: false, parsed: true, incoming: many(99), previous: null })
    expect(result).toEqual({ ok: false, reason: 'HTTP-запит до willhaben не вдався' })
  })

  it('відхиляє непрочитаний JSON', () => {
    const result = checkSanity({ httpOk: true, parsed: false, incoming: [], previous: null })
    expect(result).toEqual({ ok: false, reason: 'Не вдалося розібрати __NEXT_DATA__' })
  })

  it('відхиляє порожній результат', () => {
    const result = checkSanity({ httpOk: true, parsed: true, incoming: [], previous: catalogOf(many(99)) })
    expect(result).toEqual({ ok: false, reason: 'Розпізнано 0 авто' })
  })

  it('відхиляє падіння кількості більш ніж удвічі', () => {
    // 99 → 40 за 15 хвилин це не розпродаж, а збій
    const result = checkSanity({ httpOk: true, parsed: true, incoming: many(40), previous: catalogOf(many(99)) })
    expect(result.ok).toBe(false)
  })

  it('пропускає правдоподібне зменшення стоку', () => {
    // 99 → 96: три авто продалися, це нормально
    expect(checkSanity({ httpOk: true, parsed: true, incoming: many(96), previous: catalogOf(many(99)) }).ok).toBe(true)
  })

  it('відхиляє, коли понад 20% записів без обовʼязкових полів', () => {
    const broken = [...many(70), ...Array.from({ length: 30 }, (_, i) => car(`b${i}`, { title: '' }))]
    const result = checkSanity({ httpOk: true, parsed: true, incoming: broken, previous: catalogOf(many(99)) })
    expect(result.ok).toBe(false)
  })

  it('терпить поодинокі биті записи', () => {
    const mostlyFine = [...many(95), ...Array.from({ length: 5 }, (_, i) => car(`b${i}`, { title: '' }))]
    expect(checkSanity({ httpOk: true, parsed: true, incoming: mostlyFine, previous: catalogOf(many(99)) }).ok).toBe(true)
  })
})
```

- [ ] **Step 2: Запустити тест і переконатись, що падає**

Run: `cd sync && npx vitest run test/sanity.test.ts`
Expected: FAIL — модуль не знайдено

- [ ] **Step 3: Реалізувати**

`sync/src/sanity.ts`:

```ts
import type { Car, Catalog } from './types'

export interface SanityInput {
  httpOk: boolean
  parsed: boolean
  incoming: Car[]
  previous: Catalog | null
}

export type SanityResult = { ok: true } | { ok: false; reason: string }

/** Частка битих записів, вище якої дані вважаються ненадійними. */
const BROKEN_TOLERANCE = 0.2

/** У скільки разів максимально може впасти сток за один цикл. */
const MAX_SHRINK_FACTOR = 2

const isUsable = (car: Car): boolean =>
  Boolean(car.id) && Boolean(car.title) && car.price > 0 && car.images.length > 0

/**
 * Вирішує, чи можна публікувати отриманий стан.
 *
 * Головне правило системи: збій ніколи не публікує порожній каталог.
 * Тому за будь-якої підозри ми лишаємо попередній стан недоторканим —
 * застарілі дані завжди краще за порожню вітрину.
 */
export function checkSanity({ httpOk, parsed, incoming, previous }: SanityInput): SanityResult {
  if (!httpOk) return { ok: false, reason: 'HTTP-запит до willhaben не вдався' }
  if (!parsed) return { ok: false, reason: 'Не вдалося розібрати __NEXT_DATA__' }
  if (incoming.length === 0) return { ok: false, reason: 'Розпізнано 0 авто' }

  if (previous && previous.cars.length > 0) {
    const floor = previous.cars.length / MAX_SHRINK_FACTOR
    if (incoming.length < floor) {
      return {
        ok: false,
        reason: `Сток впав з ${previous.cars.length} до ${incoming.length} — схоже на збій, а не на продаж`,
      }
    }
  }

  const broken = incoming.filter((car) => !isUsable(car)).length
  if (broken / incoming.length > BROKEN_TOLERANCE) {
    return {
      ok: false,
      reason: `${broken} з ${incoming.length} записів без обовʼязкових полів — структура даних могла змінитись`,
    }
  }

  return { ok: true }
}
```

- [ ] **Step 4: Запустити тести**

Run: `cd sync && npx vitest run test/sanity.test.ts`
Expected: PASS — 9 passed

- [ ] **Step 5: Закомітити**

```bash
git add sync/src/sanity.ts sync/test/sanity.test.ts
git commit -m "feat(sync): add sanity gate so a failure never publishes an empty catalogue"
```

---

### Task 7: Шар зберігання в R2

**Files:**
- Create: `sync/src/storage/r2.ts`
- Create: `sync/test/storage/r2.test.ts`

**Interfaces:**
- Consumes: типи `Catalog`, `LiveData`, `SyncStatus`, `Car`
- Produces: `readCatalog(bucket)`, `writeCatalog(bucket, catalog)`, `writeLive(bucket, cars, now)`, `readStatus(bucket)`, `writeStatus(bucket, status)`, `buildLive(cars, now)`, константи `CATALOG_KEY`, `LIVE_KEY`, `STATUS_KEY`

- [ ] **Step 1: Написати падаючий тест**

`sync/test/storage/r2.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { readCatalog, writeCatalog, writeLive, buildLive, readStatus, writeStatus, CATALOG_KEY, LIVE_KEY } from '../../src/storage/r2'
import type { Car, Catalog } from '../../src/types'

/** Мінімальний дублер R2: достатньо put/get для наших потреб. */
class FakeBucket {
  store = new Map<string, string>()
  async put(key: string, value: string) { this.store.set(key, value) }
  async get(key: string) {
    const value = this.store.get(key)
    return value === undefined ? null : { text: async () => value }
  }
}

const bucket = () => new FakeBucket() as unknown as R2Bucket & FakeBucket

const car = (id: string, price: number): Car => ({
  id, uuid: '', slug: `c-${id}`, make: 'BMW', model: 'X5', title: 'BMW X5',
  price, mileage: 1, year: 2020, powerKw: 100,
  fuel: { de: 'Diesel', en: 'Diesel', tr: 'Dizel' },
  transmission: { de: 'Automatik', en: 'Automatic', tr: 'Otomatik' },
  condition: { de: 'Gebrauchtwagen', en: 'Used', tr: 'İkinci el' },
  bodyType: { de: 'Limousine', en: 'Saloon', tr: 'Sedan' },
  warranty: false, seats: 5, owners: null, equipment: [],
  images: [{ key: `cars/${id}/0.webp`, source: 'a.jpg', order: 0 }],
  location: { city: '', postcode: '', lat: 0, lng: 0 },
  willhabenUrl: '', publishedAt: '', updatedAt: '', contentHash: 'h',
})

describe('catalog', () => {
  it('повертає null, коли каталогу ще немає', async () => {
    expect(await readCatalog(bucket())).toBeNull()
  })

  it('зберігає й читає каталог без втрат', async () => {
    const b = bucket()
    const catalog: Catalog = { generatedAt: '2026-07-22T00:00:00Z', catalogHash: 'abc', cars: [car('1', 100)] }
    await writeCatalog(b, catalog)
    expect(await readCatalog(b)).toEqual(catalog)
  })

  it('повертає null на пошкодженому JSON замість того, щоб кинути помилку', async () => {
    const b = bucket()
    b.store.set(CATALOG_KEY, '{зіпсовано')
    expect(await readCatalog(b)).toBeNull()
  })
})

describe('buildLive', () => {
  it('лишає лише ціну й доступність', () => {
    const live = buildLive([car('1', 100), car('2', 200)], '2026-07-22T00:00:00Z')
    expect(live).toEqual({
      generatedAt: '2026-07-22T00:00:00Z',
      cars: { '1': { price: 100, available: true }, '2': { price: 200, available: true } },
    })
  })

  it('лишається компактним на повному стоку', () => {
    const cars = Array.from({ length: 99 }, (_, i) => car(String(i), 20000))
    const size = JSON.stringify(buildLive(cars, '2026-07-22T00:00:00Z')).length
    expect(size).toBeLessThan(10_000)
  })
})

describe('live', () => {
  it('пише живий шар у свій ключ', async () => {
    const b = bucket()
    await writeLive(b, [car('1', 100)], '2026-07-22T00:00:00Z')
    expect(JSON.parse(b.store.get(LIVE_KEY)!).cars['1'].price).toBe(100)
  })
})

describe('status', () => {
  it('віддає початковий стан, коли файлу ще немає', async () => {
    const status = await readStatus(bucket())
    expect(status.lastSuccessAt).toBeNull()
    expect(status.consecutiveFailures).toBe(0)
  })

  it('зберігає й читає стан', async () => {
    const b = bucket()
    await writeStatus(b, {
      lastAttemptAt: '2026-07-22T00:00:00Z', lastSuccessAt: '2026-07-22T00:00:00Z',
      carCount: 99, lastError: null, consecutiveFailures: 0,
    })
    expect((await readStatus(b)).carCount).toBe(99)
  })
})
```

- [ ] **Step 2: Запустити тест і переконатись, що падає**

Run: `cd sync && npx vitest run test/storage/r2.test.ts`
Expected: FAIL — модуль не знайдено

- [ ] **Step 3: Реалізувати**

`sync/src/storage/r2.ts`:

```ts
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
```

- [ ] **Step 4: Запустити тести**

Run: `cd sync && npx vitest run test/storage/r2.test.ts`
Expected: PASS — 8 passed

- [ ] **Step 5: Закомітити**

```bash
git add sync/src/storage/r2.ts sync/test/storage/r2.test.ts
git commit -m "feat(sync): add R2 storage layer for catalogue, live data and status"
```

---

### Task 8: Дзеркалення фото

**Files:**
- Create: `sync/src/storage/images.ts`
- Create: `sync/test/storage/images.test.ts`

**Interfaces:**
- Consumes: типи `Car`
- Produces: `sourceUrl(path: string): string`, `mirrorImages(bucket: R2Bucket, cars: Car[], fetchImpl: FetchLike): Promise<number>`, `pruneImages(bucket: R2Bucket, cars: Car[], now: Date): Promise<number>`, тип `FetchLike`, константа `RETENTION_DAYS = 7`

Фото завантажуємо лише ті, яких ще немає — інакше кожні 15 хвилин ми
качали б 185 МБ даремно. Фото проданих авто тримаємо 7 днів, щоб уже
розіслані дилером посилання не ламались того ж дня.

- [ ] **Step 1: Написати падаючий тест**

`sync/test/storage/images.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'
import { sourceUrl, mirrorImages, RETENTION_DAYS } from '../../src/storage/images'
import type { Car } from '../../src/types'

class FakeBucket {
  store = new Map<string, ArrayBuffer>()
  async head(key: string) { return this.store.has(key) ? { key } : null }
  async put(key: string, value: ArrayBuffer) { this.store.set(key, value) }
}

const bucket = () => new FakeBucket() as unknown as R2Bucket & FakeBucket

const carWith = (id: string, sources: string[]): Car => ({
  id, uuid: '', slug: `c-${id}`, make: '', model: '', title: 't',
  price: 1, mileage: 0, year: 2020, powerKw: 0,
  fuel: { de: '', en: '', tr: '' }, transmission: { de: '', en: '', tr: '' },
  condition: { de: '', en: '', tr: '' }, bodyType: { de: '', en: '', tr: '' },
  warranty: false, seats: null, owners: null, equipment: [],
  images: sources.map((source, order) => ({ key: `cars/${id}/${order}.webp`, source, order })),
  location: { city: '', postcode: '', lat: 0, lng: 0 },
  willhabenUrl: '', publishedAt: '', updatedAt: '', contentHash: '',
})

const okFetch = () =>
  vi.fn(async () => new Response(new ArrayBuffer(8), { status: 200 }))

describe('sourceUrl', () => {
  it('будує адресу повнорозмірного фото без суфікса', () => {
    // Без суфікса — 1178×785; _hoved дав би лише 400×267
    expect(sourceUrl('4/161/905/1774_-1239811916_n.jpg'))
      .toBe('https://cache.willhaben.at/mmo/4/161/905/1774_-1239811916_n.jpg')
  })
})

describe('mirrorImages', () => {
  it('завантажує фото, яких ще немає', async () => {
    const b = bucket()
    const fetchImpl = okFetch()
    const copied = await mirrorImages(b, [carWith('1', ['a.jpg', 'b.jpg'])], fetchImpl)
    expect(copied).toBe(2)
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(b.store.has('cars/1/0.webp')).toBe(true)
  })

  it('не перезавантажує вже наявні фото', async () => {
    const b = bucket()
    b.store.set('cars/1/0.webp', new ArrayBuffer(8))
    const fetchImpl = okFetch()
    const copied = await mirrorImages(b, [carWith('1', ['a.jpg'])], fetchImpl)
    expect(copied).toBe(0)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('пропускає фото, яке не вдалося завантажити, і не валить цикл', async () => {
    const b = bucket()
    const fetchImpl = vi.fn(async (url: string) =>
      url.endsWith('bad.jpg') ? new Response(null, { status: 404 }) : new Response(new ArrayBuffer(8), { status: 200 }))
    const copied = await mirrorImages(b, [carWith('1', ['bad.jpg', 'good.jpg'])], fetchImpl)
    expect(copied).toBe(1)
    expect(b.store.has('cars/1/1.webp')).toBe(true)
  })
})

describe('RETENTION_DAYS', () => {
  it('тримає фото проданих авто тиждень', () => {
    expect(RETENTION_DAYS).toBe(7)
  })
})
```

- [ ] **Step 2: Запустити тест і переконатись, що падає**

Run: `cd sync && npx vitest run test/storage/images.test.ts`
Expected: FAIL — модуль не знайдено

- [ ] **Step 3: Реалізувати**

`sync/src/storage/images.ts`:

```ts
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
```

- [ ] **Step 4: Запустити тести**

Run: `cd sync && npx vitest run test/storage/images.test.ts`
Expected: PASS — 5 passed

- [ ] **Step 5: Закомітити**

```bash
git add sync/src/storage/images.ts sync/test/storage/images.test.ts
git commit -m "feat(sync): mirror listing photos into R2 with a 7-day retention grace"
```

---

### Task 9: Оркестрація циклу

**Files:**
- Create: `sync/src/pipeline.ts`
- Create: `sync/test/pipeline.test.ts`

**Interfaces:**
- Consumes: усе з Tasks 1–8
- Produces: `runSync(deps: SyncDeps): Promise<SyncOutcome>`, типи `SyncDeps`, `SyncOutcome`

Залежності передаються ззовні, тому цикл тестується без мережі й без Workers.

- [ ] **Step 1: Написати падаючий тест**

`sync/test/pipeline.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'
import { runSync } from '../src/pipeline'
import { CATALOG_KEY, LIVE_KEY } from '../src/storage/r2'
import fixtureAds from './fixtures/willhaben-ads-sample.json'

class FakeBucket {
  store = new Map<string, string | ArrayBuffer>()
  async put(key: string, value: string | ArrayBuffer) { this.store.set(key, value) }
  async get(key: string) {
    const value = this.store.get(key)
    return value === undefined ? null : { text: async () => String(value) }
  }
  async head(key: string) { return this.store.has(key) ? { key } : null }
  async list() { return { objects: [] } }
  async delete(key: string) { this.store.delete(key) }
}

const pageWith = (ads: unknown[]) =>
  `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
    props: { pageProps: { searchResult: { advertSummaryList: { advertSummary: ads } } } },
  })}</script>`

const okPage = () => new Response(pageWith(fixtureAds), { status: 200 })

/**
 * Бакет передається ззовні, щоб два послідовні цикли могли працювати
 * з одним сховищем — саме так перевіряється, що збій не псує попередній стан.
 */
const deps = (bucket: FakeBucket, fetchPage = vi.fn(okPage)) => ({
  bucket: bucket as unknown as R2Bucket,
  fetchPage,
  fetchImage: vi.fn(async () => new Response(new ArrayBuffer(8), { status: 200 })),
  triggerBuild: vi.fn(async () => {}),
  notify: vi.fn(async () => {}),
  now: new Date('2026-07-22T12:00:00Z'),
})

describe('runSync', () => {
  it('публікує каталог і запускає білд на першому запуску', async () => {
    const bucket = new FakeBucket()
    const d = deps(bucket)
    const outcome = await runSync(d)

    expect(outcome.published).toBe(true)
    expect(outcome.carCount).toBe(3)
    expect(d.triggerBuild).toHaveBeenCalledTimes(1)
    expect(bucket.store.has(CATALOG_KEY)).toBe(true)
    expect(bucket.store.has(LIVE_KEY)).toBe(true)
  })

  it('не запускає білд повторно, коли зміст не змінився', async () => {
    const bucket = new FakeBucket()
    await runSync(deps(bucket))

    const second = deps(bucket)
    const outcome = await runSync(second)

    expect(outcome.published).toBe(true)
    expect(outcome.rebuilt).toBe(false)
    expect(second.triggerBuild).not.toHaveBeenCalled()
  })

  it('оновлює живий шар навіть тоді, коли перебудови не було', async () => {
    const bucket = new FakeBucket()
    await runSync(deps(bucket))
    bucket.store.delete(LIVE_KEY)

    await runSync(deps(bucket))

    expect(bucket.store.has(LIVE_KEY)).toBe(true)
  })

  it('НЕ чіпає каталог, коли willhaben віддав помилку', async () => {
    const bucket = new FakeBucket()
    await runSync(deps(bucket))
    const good = bucket.store.get(CATALOG_KEY)

    const outcome = await runSync(deps(bucket, vi.fn(async () => new Response('', { status: 503 }))))

    expect(outcome.published).toBe(false)
    expect(bucket.store.get(CATALOG_KEY)).toBe(good)
  })

  it('НЕ чіпає каталог, коли структура сторінки змінилась', async () => {
    const bucket = new FakeBucket()
    await runSync(deps(bucket))
    const good = bucket.store.get(CATALOG_KEY)

    const broken = deps(bucket, vi.fn(async () => new Response('<html>нічого</html>', { status: 200 })))

    expect((await runSync(broken)).published).toBe(false)
    expect(bucket.store.get(CATALOG_KEY)).toBe(good)
  })

  it('сповіщає при переході у стан помилки', async () => {
    const bucket = new FakeBucket()
    const d = deps(bucket, vi.fn(async () => new Response('', { status: 503 })))

    await runSync(d)

    expect(d.notify).toHaveBeenCalledOnce()
  })

  it('не шле повторних сповіщень про ту саму тривалу помилку', async () => {
    const bucket = new FakeBucket()
    const failing = () => new Response('', { status: 503 })

    await runSync(deps(bucket, vi.fn(async () => failing())))
    const second = deps(bucket, vi.fn(async () => failing()))
    await runSync(second)

    expect(second.notify).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Запустити тест і переконатись, що падає**

Run: `cd sync && npx vitest run test/pipeline.test.ts`
Expected: FAIL — модуль не знайдено

- [ ] **Step 3: Реалізувати**

`sync/src/pipeline.ts`:

```ts
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
```

- [ ] **Step 4: Запустити тести**

Run: `cd sync && npx vitest run test/pipeline.test.ts`
Expected: PASS — 7 passed

- [ ] **Step 5: Закомітити**

```bash
git add sync/src/pipeline.ts sync/test/pipeline.test.ts
git commit -m "feat(sync): orchestrate one sync cycle behind the sanity gate"
```

---

### Task 10: Worker і розгортання

**Files:**
- Create: `sync/src/index.ts`
- Create: `sync/wrangler.toml`
- Create: `sync/README.md`

**Interfaces:**
- Consumes: `runSync` (Task 9)
- Produces: Worker з обробниками `scheduled` і `fetch` (`/status` для перевірки стану)

- [ ] **Step 1: Створити конфігурацію Wrangler**

`sync/wrangler.toml`:

```toml
name = "hayat-sync"
main = "src/index.ts"
compatibility_date = "2026-07-22"

[triggers]
crons = ["*/15 * * * *"]

[[r2_buckets]]
binding = "ASSETS"
bucket_name = "hayat-cars"

[vars]
WILLHABEN_ORG_ID = "1004471"
USER_AGENT = "HayatGruppeSync/1.0 (+https://hayatgruppe.com)"

# Секрети задаються окремо, у файл не потрапляють:
#   wrangler secret put PAGES_DEPLOY_HOOK
#   wrangler secret put ALERT_WEBHOOK_URL   (необовʼязковий)
```

- [ ] **Step 2: Реалізувати Worker**

`sync/src/index.ts`:

```ts
import { runSync } from './pipeline'
import { readStatus } from './storage/r2'

export interface Env {
  ASSETS: R2Bucket
  WILLHABEN_ORG_ID: string
  USER_AGENT: string
  PAGES_DEPLOY_HOOK?: string
  ALERT_WEBHOOK_URL?: string
}

const dealerUrl = (orgId: string) =>
  `https://www.willhaben.at/iad/haendler/hayatgruppe/auto/?orgId=${orgId}&page=1&rows=200`

export default {
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    const outcome = await runSync({
      bucket: env.ASSETS,
      now: new Date(),

      fetchPage: () =>
        fetch(dealerUrl(env.WILLHABEN_ORG_ID), {
          headers: { 'User-Agent': env.USER_AGENT, 'Accept-Language': 'de-AT,de;q=0.9' },
        }),

      fetchImage: (url) => fetch(url, { headers: { 'User-Agent': env.USER_AGENT } }),

      // Перебудова сайту запускається лише коли зміст справді змінився —
      // рішення про це ухвалює pipeline, не цей обробник.
      triggerBuild: async () => {
        if (!env.PAGES_DEPLOY_HOOK) return
        await fetch(env.PAGES_DEPLOY_HOOK, { method: 'POST' })
      },

      notify: async (message) => {
        if (!env.ALERT_WEBHOOK_URL) return
        await fetch(env.ALERT_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: message }),
        })
      },
    })

    ctx.waitUntil(Promise.resolve())
    console.log('sync', JSON.stringify(outcome))
  },

  /** Ручна перевірка стану: GET /status */
  async fetch(request: Request, env: Env): Promise<Response> {
    if (new URL(request.url).pathname !== '/status') {
      return new Response('Not found', { status: 404 })
    }
    return Response.json(await readStatus(env.ASSETS))
  },
}
```

- [ ] **Step 3: Перевірити типи й прогнати весь набір тестів**

Run: `cd sync && npx tsc --noEmit && npx vitest run`
Expected: типи без помилок, усі тести проходять (близько 60)

- [ ] **Step 4: Створити бакет і розгорнути**

```bash
cd sync
npx wrangler r2 bucket create hayat-cars
npx wrangler secret put PAGES_DEPLOY_HOOK
npx wrangler deploy
```

- [ ] **Step 5: Запустити цикл вручну й перевірити результат**

```bash
npx wrangler dev --test-scheduled
curl "http://localhost:8787/__scheduled?cron=*/15+*+*+*+*"
curl http://localhost:8787/status
```

Expected: `status` містить `carCount` близько 99 і `lastError: null`.

- [ ] **Step 6: Описати роботу в README**

`sync/README.md`:

```markdown
# hayat-sync

Cloudflare Worker: раз на 15 хвилин переносить сток дилера з willhaben у R2.

## Що публікує

| Ключ | Призначення | Частота |
|---|---|---|
| `catalog.json` | Повний каталог для збірки сайту | лише при зміні змісту |
| `live.json` | Ціни й доступність (~5 КБ) | щоцикл |
| `status.json` | Стан синхронізації | щоцикл |

## Головне правило

Збій ніколи не публікує порожній каталог. Перед записом стан проходить
перевірку осудності (`src/sanity.ts`); не пройшов — попередній стан
лишається недоторканим.

## Команди

    npm test              тести
    npm run typecheck     перевірка типів
    npx wrangler deploy   розгортання
    curl .../status       поточний стан

## Секрети

    wrangler secret put PAGES_DEPLOY_HOOK    запуск перебудови сайту
    wrangler secret put ALERT_WEBHOOK_URL    необовʼязково: сповіщення про збої
```

- [ ] **Step 7: Закомітити**

```bash
git add sync/src/index.ts sync/wrangler.toml sync/README.md
git commit -m "feat(sync): add scheduled Worker entry point and deployment config"
```

---

## Перевірка плану проти специфікації

| Вимога специфікації | Завдання |
|---|---|
| Один запит на цикл, чесний User-Agent | 10 |
| Витяг із `__NEXT_DATA__`, без парсингу верстки | 1 |
| Чистка заголовків від рекламного хвоста | 2 |
| Відновлення моделі, коли лишилась сама марка | 2 |
| Стабільний slug | 2 |
| Словник даних DE→EN/TR | 3 |
| Канонічна модель `Car` | 3, 4 |
| Опціональні поля (`owners` у 80 зі 99) | 4 |
| `contentHash` без урахування підняття | 5 |
| Пʼять перевірок осудності | 6 |
| `catalog.json`, `live.json`, `status.json` | 7 |
| Дзеркалення фото, зберігання 7 днів | 8 |
| Запуск білду лише при зміні | 9 |
| Сповіщення лише на переході у збій | 9 |
| Cron `*/15`, змінні оточення, секрети | 10 |

**Поза цим планом (план 2):** сайт на Astro, i18n-інтерфейс, дизайн Nocturne,
OG-картинки, юридичні сторінки, контактні CTA.
