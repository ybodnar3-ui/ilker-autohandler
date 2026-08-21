/**
 * Описи авто й підсумок опцій трьома мовами.
 *
 * Генеруємо з РЕАЛЬНИХ атрибутів willhaben, без мовної моделі. Це свідомий
 * вибір, а не компроміс: сайт представляє справжнього дилера, а в Австрії
 * реклама авто регулюється — вигадана характеристика чи обіцянка коштує
 * дорого. Шаблон фізично не може написати того, чого немає в даних.
 *
 * Варіант формулювання обирається за id авто, тож текст стабільний між
 * запусками (не «стрибає» у кожному деплої), але різний у різних авто.
 */
import type { Car, Lang } from '../src/types'

/** Опції за спаданням цінності для покупця; збіг за підрядком німецької назви. */
const PRIORITY = [
  'Head-Up', 'Luftfederung', 'Massage', 'Panorama', 'Standheizung', '360',
  'Rückfahrkamera', 'Matrix', 'Laserlicht', 'LED-Scheinwerfer', 'Keyless',
  'Apple CarPlay', 'Android Auto', 'Navigationssystem', 'Lederausstattung',
  'Abstandstempomat', 'Anhängerkupplung', 'Sportfahrwerk', 'Sportsitze',
  'Klimaautomatik', 'Sitzheizung', 'Spurhalte', 'Totwinkel', 'Notbremsassistent',
  'Parksensor', 'Tempomat', 'Bluetooth', 'DAB', 'Alufelgen',
]

const rank = (nameDe: string): number => {
  const i = PRIORITY.findIndex((p) => nameDe.toLowerCase().includes(p.toLowerCase()))
  return i === -1 ? PRIORITY.length : i
}

/** Індекси найцінніших опцій — щоб з 44 тегів показати головне. */
export function highlightIdx(car: Car, take = 3): number[] {
  return car.equipment
    .map((e, i) => ({ i, r: rank(e.de) }))
    .filter((x) => x.r < PRIORITY.length)
    .sort((a, b) => a.r - b.r)
    .slice(0, take)
    .map((x) => x.i)
}

const LOCALE: Record<Lang, string> = { de: 'de-DE', en: 'en-GB', tr: 'tr-TR' }
const num = (n: number, lang: Lang) => n.toLocaleString(LOCALE[lang])
const ps = (kw: number) => Math.round(kw * 1.35962)

/** Перелік через кому з природним останнім сполучником. */
function list(items: string[], lang: Lang): string {
  if (items.length <= 1) return items[0] ?? ''
  const and = { de: ' und ', en: ' and ', tr: ' ve ' }[lang]
  return items.slice(0, -1).join(', ') + and + items[items.length - 1]
}

/** Детермінований вибір варіанта за id — стабільно між запусками. */
const pick = <T,>(variants: T[], car: Car): T => {
  let h = 0
  for (const ch of car.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return variants[h % variants.length]
}

export function describe(car: Car, lang: Lang): string {
  const power = car.powerKw ? ps(car.powerKw) : 0
  const km = num(car.mileage, lang)
  const hl = highlightIdx(car).map((i) => car.equipment[i][lang])
  const parts: string[] = []

  if (lang === 'de') {
    const fuel = car.fuel.de
    const trans = car.transmission.de.toLowerCase().includes('automat') ? 'Automatikgetriebe' : 'Schaltgetriebe'
    parts.push(pick([
      `Der ${car.make} ${car.model} wurde ${car.year} erstmals zugelassen${power ? ` und leistet ${power} PS` : ''}.`,
      `Erstzulassung ${car.year}: dieser ${car.make} ${car.model}${power ? ` mit ${power} PS` : ''}.`,
      `${car.make} ${car.model}, Baujahr ${car.year}${power ? `, mit ${power} PS` : ''}.`,
    ], car))
    parts.push(`Angetrieben wird er von einem ${fuel}-Motor in Kombination mit ${trans}.`)
    parts.push(`Der Kilometerstand beträgt ${km} km.`)
    if (hl.length) parts.push(`Zur Ausstattung zählen unter anderem ${list(hl, 'de')}.`)
    if (car.owners === 1) parts.push('Das Fahrzeug stammt aus erster Hand.')
    if (car.warranty) parts.push('Die Übergabe erfolgt mit Garantie.')
    return parts.join(' ')
  }

  if (lang === 'en') {
    const fuel = car.fuel.en
    const trans = car.transmission.en.toLowerCase().includes('automatic') ? 'an automatic gearbox' : 'a manual gearbox'
    parts.push(pick([
      `This ${car.make} ${car.model} was first registered in ${car.year}${power ? ` and produces ${power} hp` : ''}.`,
      `First registered in ${car.year}, this ${car.make} ${car.model}${power ? ` delivers ${power} hp` : ''}.`,
      `A ${car.year} ${car.make} ${car.model}${power ? ` with ${power} hp` : ''}.`,
    ], car))
    parts.push(`It pairs a ${fuel.toLowerCase()} engine with ${trans}.`)
    parts.push(`The odometer reads ${km} km.`)
    if (hl.length) parts.push(`Equipment includes ${list(hl, 'en')}.`)
    if (car.owners === 1) parts.push('One owner from new.')
    if (car.warranty) parts.push('Supplied with warranty.')
    return parts.join(' ')
  }

  const fuelTr = car.fuel.tr
  const transTr = car.transmission.tr.toLowerCase().includes('otomatik') ? 'otomatik şanzıman' : 'manuel şanzıman'
  parts.push(pick([
    `Bu ${car.make} ${car.model} ilk olarak ${car.year} yılında tescil edildi${power ? ` ve ${power} HP güç üretiyor` : ''}.`,
    `${car.year} model bu ${car.make} ${car.model}${power ? `, ${power} HP güce sahip` : ''}.`,
    `İlk tescili ${car.year} olan ${car.make} ${car.model}${power ? `, ${power} HP` : ''}.`,
  ], car))
  parts.push(`${fuelTr} motoru ${transTr} ile birlikte sunuluyor.`)
  parts.push(`Kilometre göstergesi ${km} km.`)
  if (hl.length) parts.push(`Donanımlar arasında ${list(hl, 'tr')} yer alıyor.`)
  if (car.owners === 1) parts.push('Araç ilk sahibinden.')
  if (car.warranty) parts.push('Teslimat garanti ile yapılır.')
  return parts.join(' ')
}
