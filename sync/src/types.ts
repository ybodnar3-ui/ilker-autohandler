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
