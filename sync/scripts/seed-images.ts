/// <reference types="node" />
import { S3Client, ListObjectsV2Command, PutObjectCommand } from '@aws-sdk/client-s3'
import { extractAdverts } from '../src/source/willhaben'
import { normalizeCar } from '../src/normalize/car'
import { sourceUrl } from '../src/storage/images'
import type { Car } from '../src/types'

export interface SeedItem {
  key: string
  sourceUrl: string
}

/**
 * Які фото ще треба залити: для кожного авто — ті ключі, яких немає в R2.
 * Чиста функція, щоб її можна було перевірити без мережі й без R2.
 */
export function planSeed(cars: Car[], presentKeys: Set<string>): SeedItem[] {
  const items: SeedItem[] = []
  for (const car of cars) {
    for (const image of car.images) {
      if (!presentKeys.has(image.key)) {
        items.push({ key: image.key, sourceUrl: sourceUrl(image.source) })
      }
    }
  }
  return items
}

interface SeedConfig {
  orgId: string
  userAgent: string
  accountId: string
  accessKeyId: string
  secretAccessKey: string
  bucket: string
}

function readConfig(): SeedConfig {
  const orgId = process.env['WILLHABEN_ORG_ID']
  const userAgent = process.env['USER_AGENT']
  const accountId = process.env['R2_ACCOUNT_ID']
  const accessKeyId = process.env['R2_ACCESS_KEY_ID']
  const secretAccessKey = process.env['R2_SECRET_ACCESS_KEY']
  const bucket = process.env['R2_BUCKET']

  const missing = Object.entries({
    WILLHABEN_ORG_ID: orgId,
    USER_AGENT: userAgent,
    R2_ACCOUNT_ID: accountId,
    R2_ACCESS_KEY_ID: accessKeyId,
    R2_SECRET_ACCESS_KEY: secretAccessKey,
    R2_BUCKET: bucket,
  })
    .filter(([, value]) => !value)
    .map(([name]) => name)

  if (missing.length > 0) {
    throw new Error(`Відсутні змінні середовища: ${missing.join(', ')}`)
  }

  return {
    orgId: orgId!,
    userAgent: userAgent!,
    accountId: accountId!,
    accessKeyId: accessKeyId!,
    secretAccessKey: secretAccessKey!,
    bucket: bucket!,
  }
}

async function fetchCars(orgId: string, userAgent: string): Promise<Car[]> {
  const url = `https://www.willhaben.at/iad/haendler/hayatgruppe/auto/?orgId=${orgId}&page=1&rows=200`
  const response = await fetch(url, { headers: { 'User-Agent': userAgent } })
  if (!response.ok) {
    throw new Error(`Сторінка дилера відповіла ${response.status}`)
  }
  const adverts = extractAdverts(await response.text())
  return adverts.map(normalizeCar).filter((car): car is Car => car !== null)
}

/** Усі ключі, які вже лежать у R2 під префіксом cars/ — щоб не заливати повторно. */
async function listPresentKeys(client: S3Client, bucket: string): Promise<Set<string>> {
  const keys = new Set<string>()
  let continuationToken: string | undefined

  do {
    const page = await client.send(
      new ListObjectsV2Command({ Bucket: bucket, Prefix: 'cars/', ContinuationToken: continuationToken }),
    )
    for (const object of page.Contents ?? []) {
      if (object.Key) keys.add(object.Key)
    }
    continuationToken = page.IsTruncated ? page.NextContinuationToken : undefined
  } while (continuationToken)

  return keys
}

async function uploadItem(client: S3Client, bucket: string, item: SeedItem, userAgent: string): Promise<void> {
  const response = await fetch(item.sourceUrl, { headers: { 'User-Agent': userAgent } })
  if (!response.ok) {
    throw new Error(`${item.sourceUrl} відповів ${response.status}`)
  }
  const body = new Uint8Array(await response.arrayBuffer())
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: item.key,
      Body: body,
      ContentType: 'image/webp',
      CacheControl: 'public, max-age=31536000, immutable',
    }),
  )
}

export async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run')
  const config = readConfig()

  console.log('Отримуємо оголошення дилера...')
  const cars = await fetchCars(config.orgId, config.userAgent)
  console.log(`Знайдено ${cars.length} авто`)

  const client = new S3Client({
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    region: 'auto',
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
  })

  console.log('Читаємо, що вже є в R2...')
  const presentKeys = await listPresentKeys(client, config.bucket)
  console.log(`У R2 вже є ${presentKeys.size} фото`)

  const plan = planSeed(cars, presentKeys)
  console.log(`До заливки: ${plan.length} фото`)

  if (dryRun) {
    console.log('--dry-run: нічого не заливаємо. Перші ключі з плану:')
    for (const item of plan.slice(0, 10)) {
      console.log(`  ${item.key}`)
    }
    return
  }

  let uploaded = 0
  for (const item of plan) {
    try {
      await uploadItem(client, config.bucket, item, config.userAgent)
      uploaded += 1
    } catch (error) {
      console.error(`Не вдалося залити ${item.key}:`, error instanceof Error ? error.message : error)
    }
    console.log(`${uploaded} / ${plan.length} uploaded`)
  }

  console.log('Готово.')
}

// Гвардія: main() виконується лише при прямому запуску скрипта, а не при
// імпорті planSeed у тестах — інакше тест непомітно ходив би в мережу.
const isDirectRun =
  process.argv[1] !== undefined && (import.meta as { url: string }).url === `file://${process.argv[1]}`
if (isDirectRun) {
  main().catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
}
