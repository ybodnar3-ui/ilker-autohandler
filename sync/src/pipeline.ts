import { extractAdverts } from './source/willhaben'
import { normalizeCar } from './normalize/car'
import { withContentHash, catalogHash } from './normalize/hash'
import { checkSanity } from './sanity'
import { readCatalog, writeCatalog, writeLive, readStatus, writeStatus } from './storage/r2'
import { mirrorImages, pruneImages, type FetchLike } from './storage/images'
import type { Car, Catalog, SyncStatus } from './types'

// Ліміт зовнішніх запитів Worker'а на безкоштовному тарифі — 50 на виклик.
// Лишаємо запас на fetch сторінки, deploy-hook і notify.
const IMAGES_PER_CYCLE = 40

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

  // Безпечні значення за замовчуванням: readCatalog/readStatus — це теж
  // реальний I/O (bucket.get) і можуть кинути виключення до того, як їхні
  // результати присвояться нижче. Якщо це станеться, recordFailure все одно
  // повинен мати з чим працювати — зокрема status.consecutiveFailures для
  // логіки сповіщення на межі переходу в стан помилки.
  let previous: Catalog | null = null
  let status: SyncStatus = {
    lastAttemptAt: '',
    lastSuccessAt: null,
    carCount: 0,
    lastError: null,
    consecutiveFailures: 0,
  }

  // Спільний шлях для будь-якого збою цього циклу — і відхилення на воротах
  // осудності, і виключення, кинутого вже після них (обрив R2, HTTP-помилка
  // деплой-хука, або збій самих початкових читань). Контракт модуля: runSync
  // ніколи не кидає виключення сам — будь-яка відмова фіксується в
  // status.json і на межі переходу в стан помилки сповіщає оператора.
  //
  // recordFailure сама мусить бути непробивною: writeStatus і notify — це
  // I/O, яке падає саме в тих сценаріях (простій R2, таймаут вебхука), заради
  // яких і робився цей фікс. Кожен виклик обгорнутий окремо, щоб збій одного
  // не заважав іншому.
  const recordFailure = async (reason: string): Promise<SyncOutcome> => {
    const firstFailure = status.consecutiveFailures === 0
    try {
      await writeStatus(bucket, {
        ...status,
        lastAttemptAt: timestamp,
        lastError: reason,
        consecutiveFailures: status.consecutiveFailures + 1,
      })
    } catch (error) {
      console.error('runSync: не вдалося записати status.json під час фіксації збою', error)
    }
    // Сповіщаємо лише на переході у стан помилки, щоб не слати
    // однакове повідомлення кожні 15 хвилин.
    if (firstFailure) {
      try {
        await notify(`Синхронізація не вдалась: ${reason}`)
      } catch (error) {
        console.error('runSync: не вдалося надіслати сповіщення про збій', error)
      }
    }
    return { published: false, rebuilt: false, carCount: previous?.cars.length ?? 0, reason }
  }

  try {
    // status читаємо першим: якщо readCatalog кине виключення (обрив R2 —
    // саме тоді, коли сповіщення й потрібне), status.consecutiveFailures усе
    // одно встигне зчитатись, і recordFailure правильно визначить межу
    // переходу в стан помилки — одне сповіщення, а не щоцикл.
    status = await readStatus(bucket)
    previous = await readCatalog(bucket)

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
      return await recordFailure(verdict.reason)
    }

    // Живий шар оновлюється щоцикл — саме він дає свіжість без перебудови сайту.
    await writeLive(bucket, cars, timestamp)

    const hash = await catalogHash(cars)
    const changed = hash !== previous?.catalogHash

    if (changed) {
      await mirrorImages(bucket, cars, fetchImage, IMAGES_PER_CYCLE)
      await pruneImages(bucket, cars, now)
      const catalog: Catalog = { generatedAt: timestamp, catalogHash: hash, cars }
      await writeCatalog(bucket, catalog)
      // ВІДОМЕ ОБМЕЖЕННЯ (не вирішуємо тут): якщо writeCatalog встигне
      // записатись, а цей виклик кине виключення — новий каталог уже в R2,
      // але білд не запущено. Наступного циклу хеш збіжиться і triggerBuild
      // більше не спрацює, доки контент знову не зміниться, тобто деплой
      // "загубиться" до наступної зміни. Окремий механізм відстеження
      // незавершених білдів навмисно не будуємо в межах цієї задачі.
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
  } catch (error) {
    // Лишаємо слід у логах Worker'а: це може бути справжній дефект коду,
    // а не просто зміна схеми willhaben, і його треба вміти відрізнити.
    console.error('runSync: post-gate failure', error)
    const reason = error instanceof Error ? error.message : String(error)
    return await recordFailure(reason)
  }
}
