// Хранилище профиля автомобиля.
// Компоненты работают только с интерфейсом CarRepository, поэтому localStorage
// позже можно заменить серверным хранилищем, не трогая страницы и формы.

import { newId } from '../format'

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

export interface Car {
  /** Постоянный идентификатор: к нему привязаны записи истории обслуживания */
  id: string
  make: string
  model: string
  year: number
  mileage: number
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

const STORAGE_KEY = 'ai-auto:car:v1'

/** Проверяет сохранённые данные. Идентификатора может не быть: он появился позже остальных полей */
function isStoredCar(value: unknown): value is Omit<Car, 'id'> & { id?: unknown } {
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

/** Данные лежат в браузере пользователя: на другом устройстве их не будет */
export const localCarRepository: CarRepository = {
  async get() {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw === null) return null
    try {
      const parsed: unknown = JSON.parse(raw)
      if (!isStoredCar(parsed)) return null
      if (typeof parsed.id === 'string') return { ...parsed, id: parsed.id }
      // профиль сохранён до появления идентификатора — выдаём его один раз и запоминаем
      const car: Car = { ...parsed, id: newId() }
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(car))
      return car
    } catch {
      return null
    }
  },

  async save(input) {
    // при редактировании идентификатор сохраняется, у нового автомобиля — новый
    const existing = await localCarRepository.get()
    const car: Car = { ...input, id: existing?.id ?? newId(), updatedAt: new Date().toISOString() }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(car))
    return car
  },

  async remove() {
    window.localStorage.removeItem(STORAGE_KEY)
  },
}
