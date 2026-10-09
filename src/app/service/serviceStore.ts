// Хранилище истории обслуживания — по тому же принципу, что и carStore.ts:
// страницы знают только интерфейс ServiceRepository, поэтому localStorage
// позже заменяется серверной базой без переделки интерфейса.

import { newId } from '../format'

export type ServiceCategory =
  | 'maintenance'
  | 'oil'
  | 'engine'
  | 'transmission'
  | 'brakes'
  | 'suspension'
  | 'electrics'
  | 'tires'
  | 'other'

export const CATEGORY_LABELS: Record<ServiceCategory, string> = {
  maintenance: 'Техническое обслуживание',
  oil: 'Масло и фильтры',
  engine: 'Двигатель',
  transmission: 'Трансмиссия',
  brakes: 'Тормоза',
  suspension: 'Подвеска',
  electrics: 'Электрика',
  tires: 'Шины',
  other: 'Другое',
}

export interface ServiceRecord {
  id: string
  /** Автомобиль, к которому относится запись */
  carId: string
  title: string
  category: ServiceCategory
  /** День обслуживания в формате ГГГГ-ММ-ДД */
  date: string
  /** Пробег на момент обслуживания, км */
  mileage: number
  /** Стоимость в тенге — число, по нему позже считаются расходы */
  cost: number
  comment: string
  createdAt: string
  updatedAt: string
}

export type ServiceInput = Pick<ServiceRecord, 'title' | 'category' | 'date' | 'mileage' | 'cost' | 'comment'>

export interface ServiceRepository {
  list(carId: string): Promise<ServiceRecord[]>
  create(carId: string, input: ServiceInput): Promise<ServiceRecord>
  update(id: string, input: ServiceInput): Promise<ServiceRecord>
  remove(id: string): Promise<void>
  /** Удаляет всю историю автомобиля — вызывается при удалении самого автомобиля */
  removeByCar(carId: string): Promise<void>
}

const STORAGE_KEY = 'ai-auto:service:v1'

function isRecord(value: unknown): value is ServiceRecord {
  if (typeof value !== 'object' || value === null) return false
  const r = value as Record<string, unknown>
  return (
    typeof r.id === 'string' &&
    typeof r.carId === 'string' &&
    typeof r.title === 'string' &&
    typeof r.category === 'string' &&
    r.category in CATEGORY_LABELS &&
    typeof r.date === 'string' &&
    typeof r.mileage === 'number' &&
    typeof r.cost === 'number' &&
    typeof r.comment === 'string'
  )
}

function readAll(): ServiceRecord[] {
  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (raw === null) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter(isRecord) : []
  } catch {
    return []
  }
}

const writeAll = (records: ServiceRecord[]) => window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records))

/** Записи лежат в браузере пользователя: на другом устройстве их не будет */
export const localServiceRepository: ServiceRepository = {
  async list(carId) {
    return readAll().filter((record) => record.carId === carId)
  },

  async create(carId, input) {
    const now = new Date().toISOString()
    const record: ServiceRecord = { ...input, id: newId(), carId, createdAt: now, updatedAt: now }
    writeAll([...readAll(), record])
    return record
  },

  async update(id, input) {
    const records = readAll()
    const current = records.find((record) => record.id === id)
    if (!current) throw new Error('Запись не найдена')
    const updated: ServiceRecord = { ...current, ...input, updatedAt: new Date().toISOString() }
    writeAll(records.map((record) => (record.id === id ? updated : record)))
    return updated
  },

  async remove(id) {
    writeAll(readAll().filter((record) => record.id !== id))
  },

  async removeByCar(carId) {
    writeAll(readAll().filter((record) => record.carId !== carId))
  },
}
