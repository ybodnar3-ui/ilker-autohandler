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
  // make/model йдуть окремо від title: cleanTitle() виводить title з
  // вільного тексту оголошення дилера і підставляє make/model лише коли
  // заголовок порожній або дорівнює make. Тож willhaben може виправити
  // невірно категоризовану make/model, а текст заголовка не зміниться —
  // без цих полів така зміна лишилась би непоміченою.
  const significant = [
    car.id,
    car.make,
    car.model,
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
    // Масиви передаємо як є (не через join), щоб JSON.stringify зберігав
    // межі елементів: join(',') змішує ['A,B','C'] і ['A','B,C'] в один
    // рядок, і кома всередині значення (напр. неперекладеного терміну
    // обладнання) ламає розрізнення.
    //
    // equipment сортуємо: willhaben не гарантує стабільний порядок
    // повернення того самого набору обладнання, а сортування не може
    // приховати реальну зміну — інший набір дає інший відсортований список.
    [...car.equipment.map((e) => e.de)].sort(),
    // images НЕ сортуємо: порядок тут — порядок показу в галереї на сайті,
    // тобто сам по собі клієнтоважливий контент.
    car.images.map((i) => i.source),
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
