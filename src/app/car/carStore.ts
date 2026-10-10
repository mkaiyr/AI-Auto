// Хранилище профиля автомобиля.
// Компоненты работают только с интерфейсом CarRepository, поэтому localStorage
// позже можно заменить серверным хранилищем, не трогая страницы и формы.

import { newId } from '../format'
import { userKey } from '../storageKeys'

export type EngineType = 'petrol' | 'diesel' | 'hybrid' | 'electric' | 'lpg'

export const ENGINE_LABELS: Record<EngineType, string> = {
  petrol: 'Бензиновый',
  diesel: 'Дизельный',
  hybrid: 'Гибрид',
  electric: 'Электрический',
  lpg: 'Газовый (ГБО)',
}

/** Марки бензина; поле «Топливо» имеет смысл только для этих типов двигателя */
export const FUEL_OPTIONS = ['АИ-92', 'АИ-95', 'АИ-98', 'АИ-100'] as const
export const ENGINES_WITH_FUEL: EngineType[] = ['petrol', 'hybrid']

export type BodyType =
  | 'sedan'
  | 'hatchback'
  | 'wagon'
  | 'coupe'
  | 'liftback'
  | 'crossover'
  | 'suv'
  | 'minivan'
  | 'pickup'

export const BODY_LABELS: Record<BodyType, string> = {
  sedan: 'Седан',
  hatchback: 'Хэтчбек',
  wagon: 'Универсал',
  coupe: 'Купе',
  liftback: 'Лифтбек',
  crossover: 'Кроссовер',
  suv: 'Внедорожник',
  minivan: 'Минивэн',
  pickup: 'Пикап',
}

export interface Car {
  /** Постоянный идентификатор: к нему привязаны записи истории обслуживания */
  id: string
  make: string
  model: string
  year: number
  mileage: number
  /** Тип кузова; у профилей, сохранённых до появления поля, — null */
  body: BodyType | null
  engine: EngineType | null
  fuel: string | null
  /** Дата последнего сохранения в формате ISO */
  updatedAt: string
}

export type CarInput = Omit<Car, 'id' | 'updatedAt'>

export interface CarRepository {
  get(): Promise<Car | null>
  save(input: CarInput): Promise<Car>
  remove(): Promise<void>
}

/** Основа ключа; полный ключ включает идентификатор пользователя (см. repositories.ts) */
export const CAR_STORAGE_KEY = 'ai-auto:car:v1'

/** Проверяет сохранённые данные. Идентификатора и кузова может не быть: они появились позже остальных полей */
function isStoredCar(value: unknown): value is Omit<Car, 'id' | 'body'> & { id?: unknown; body?: unknown } {
  if (typeof value !== 'object' || value === null) return false
  const car = value as Record<string, unknown>
  return (
    typeof car.make === 'string' &&
    typeof car.model === 'string' &&
    typeof car.year === 'number' &&
    typeof car.mileage === 'number' &&
    (car.engine === null || (typeof car.engine === 'string' && car.engine in ENGINE_LABELS)) &&
    (car.fuel === null || typeof car.fuel === 'string') &&
    typeof car.updatedAt === 'string'
  )
}

/**
 * Профиль автомобиля одного пользователя в localStorage.
 * Данные лежат в браузере: на другом устройстве их не будет.
 */
export function createLocalCarRepository(userId: string): CarRepository {
  const STORAGE_KEY = userKey(CAR_STORAGE_KEY, userId)

  const repository: CarRepository = {
    async get() {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (raw === null) return null
      try {
        const parsed: unknown = JSON.parse(raw)
        if (!isStoredCar(parsed)) return null
        const body = typeof parsed.body === 'string' && parsed.body in BODY_LABELS ? (parsed.body as BodyType) : null
        if (typeof parsed.id === 'string') return { ...parsed, id: parsed.id, body }
        // профиль сохранён до появления идентификатора — выдаём его один раз и запоминаем
        const car: Car = { ...parsed, id: newId(), body }
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(car))
        return car
      } catch {
        return null
      }
    },

    async save(input) {
      // при редактировании идентификатор сохраняется, у нового автомобиля — новый
      const existing = await repository.get()
      const car: Car = { ...input, id: existing?.id ?? newId(), updatedAt: new Date().toISOString() }
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(car))
      return car
    },

    async remove() {
      window.localStorage.removeItem(STORAGE_KEY)
    },
  }

  return repository
}
