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
