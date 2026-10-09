// Хранилище профиля автомобиля.
// Компоненты работают только с интерфейсом CarRepository, поэтому localStorage
// позже можно заменить серверным хранилищем, не трогая страницы и формы.

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
  make: string
  model: string
  year: number
  mileage: number
  engine: EngineType | null
  fuel: string | null
  /** Дата последнего сохранения в формате ISO */
  updatedAt: string
}

export type CarInput = Omit<Car, 'updatedAt'>

export interface CarRepository {
  get(): Promise<Car | null>
  save(input: CarInput): Promise<Car>
  remove(): Promise<void>
}

const STORAGE_KEY = 'ai-auto:car:v1'

function isCar(value: unknown): value is Car {
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
      return isCar(parsed) ? parsed : null
    } catch {
      return null
    }
  },

  async save(input) {
    const car: Car = { ...input, updatedAt: new Date().toISOString() }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(car))
    return car
  },

  async remove() {
    window.localStorage.removeItem(STORAGE_KEY)
  },
}
