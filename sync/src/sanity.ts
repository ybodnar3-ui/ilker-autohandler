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
  Boolean(car.id) &&
  Boolean(car.title) &&
  car.price > 0 &&
  car.images.length > 0 &&
  car.year > 0 &&
  car.mileage > 0 &&
  Boolean(car.fuel.de)

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
