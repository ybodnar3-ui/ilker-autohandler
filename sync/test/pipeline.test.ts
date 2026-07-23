import { describe, it, expect, vi } from 'vitest'
import { runSync } from '../src/pipeline'
import { CATALOG_KEY, LIVE_KEY, STATUS_KEY } from '../src/storage/r2'
import fixtureAds from './fixtures/willhaben-ads-sample.json'

class FakeBucket {
  store = new Map<string, string | ArrayBuffer>()
  /** Ключі, на яких get() має кинути виключення (симуляція обриву R2). */
  getShouldThrow = new Set<string>()
  /** Ключі, на яких put() має кинути виключення (симуляція обриву R2). */
  putShouldThrow = new Set<string>()
  async put(key: string, value: string | ArrayBuffer) {
    if (this.putShouldThrow.has(key)) throw new Error(`put failed: ${key}`)
    this.store.set(key, value)
  }
  async get(key: string) {
    if (this.getShouldThrow.has(key)) throw new Error(`get failed: ${key}`)
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

const okPage = async () => new Response(pageWith(fixtureAds), { status: 200 })

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

  it('НЕ чіпає live.json, коли willhaben віддав помилку', async () => {
    const bucket = new FakeBucket()
    await runSync(deps(bucket))
    const good = bucket.store.get(LIVE_KEY)

    const outcome = await runSync(deps(bucket, vi.fn(async () => new Response('', { status: 503 }))))

    expect(outcome.published).toBe(false)
    expect(bucket.store.get(LIVE_KEY)).toBe(good)
  })

  it('повторно сповіщає після відновлення між серіями помилок', async () => {
    const bucket = new FakeBucket()
    const failing = vi.fn(async () => new Response('', { status: 503 }))

    const first = deps(bucket, failing)
    await runSync(first)
    expect(first.notify).toHaveBeenCalledTimes(1)

    const second = deps(bucket)
    await runSync(second)
    expect(second.notify).not.toHaveBeenCalled()

    const third = deps(bucket, vi.fn(async () => new Response('', { status: 503 })))
    await runSync(third)
    expect(third.notify).toHaveBeenCalledTimes(1)
  })

  it('перехоплює збій запису після воріт осудності і не кидає виключення', async () => {
    const bucket = new FakeBucket()
    const d = deps(bucket)
    d.triggerBuild = vi.fn(async () => {
      throw new Error('deploy hook 500')
    })

    await expect(runSync(d)).resolves.toMatchObject({ published: false })
    expect(d.notify).toHaveBeenCalledOnce()

    const status = JSON.parse(String(bucket.store.get(STATUS_KEY)))
    expect(status.lastError).toBe('deploy hook 500')
  })

  it('перехоплює збій початкового читання каталогу і не кидає виключення', async () => {
    const bucket = new FakeBucket()
    bucket.getShouldThrow.add(CATALOG_KEY)
    const d = deps(bucket)

    await expect(runSync(d)).resolves.toMatchObject({ published: false })
    expect(d.notify).toHaveBeenCalledOnce()
  })

  it('перехоплює збій запису status.json усередині recordFailure і не кидає виключення', async () => {
    const bucket = new FakeBucket()
    bucket.putShouldThrow.add(STATUS_KEY)
    const d = deps(bucket, vi.fn(async () => new Response('', { status: 503 })))

    await expect(runSync(d)).resolves.toMatchObject({ published: false })
  })

  it('збій notify не блокує запис status.json і не кидає виключення', async () => {
    const bucket = new FakeBucket()
    const d = deps(bucket, vi.fn(async () => new Response('', { status: 503 })))
    d.notify = vi.fn(async () => {
      throw new Error('webhook timeout')
    })

    await expect(runSync(d)).resolves.toMatchObject({ published: false })
    expect(bucket.store.has(STATUS_KEY)).toBe(true)
  })
})
