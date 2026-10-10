// Профиль автомобиля в Supabase (таблица cars).
// Доступ ограничен на сервере: политики RLS отдают и принимают только строки текущего пользователя.

import type { SupabaseClient } from '@supabase/supabase-js'
import { unwrap } from '../dataErrors'
import { BODY_LABELS, ENGINE_LABELS, type BodyType, type Car, type CarInput, type CarRepository, type EngineType } from './carStore'

const COLUMNS = 'id, make, model, year, mileage, body, engine, fuel, updated_at'

interface CarRow {
  id: string
  make: string
  model: string
  year: number
  mileage: number
  body: string | null
  engine: string | null
  fuel: string | null
  updated_at: string
}

// Отдельного столбца для поколения в таблице нет, и ради одного необязательного поля
// схема базы не менялась. Поколение дописывается к модели через разделитель:
// «Camry · XV70». Наружу хранилище отдаёт модель и поколение раздельно, поэтому
// при появлении своего столбца изменится только этот файл.
const GENERATION_SEPARATOR = ' · '

function splitModel(stored: string): { model: string; generation: string | null } {
  const index = stored.indexOf(GENERATION_SEPARATOR)
  if (index === -1) return { model: stored, generation: null }
  return { model: stored.slice(0, index), generation: stored.slice(index + GENERATION_SEPARATOR.length) || null }
}

const joinModel = (model: string, generation: string | null) => (generation ? `${model}${GENERATION_SEPARATOR}${generation}` : model)

const toCar = (row: CarRow): Car => ({
  id: row.id,
  make: row.make,
  ...splitModel(row.model),
  year: row.year,
  mileage: row.mileage,
  body: row.body !== null && row.body in BODY_LABELS ? (row.body as BodyType) : null,
  engine: row.engine !== null && row.engine in ENGINE_LABELS ? (row.engine as EngineType) : null,
  fuel: row.fuel,
  updatedAt: row.updated_at,
})

/** Поля автомобиля в том виде, в каком их хранит таблица */
export const toCarFields = (input: CarInput) => ({
  make: input.make,
  model: joinModel(input.model, input.generation),
  year: input.year,
  mileage: input.mileage,
  body: input.body,
  engine: input.engine,
  fuel: input.fuel,
})

export function createRemoteCarRepository(supabase: SupabaseClient): CarRepository {
  const repository: CarRepository = {
    async get() {
      // База допускает несколько автомобилей; интерфейс пока работает с первым добавленным
      const rows = unwrap(
        await supabase.from('cars').select(COLUMNS).order('created_at', { ascending: true }).limit(1),
        'Не удалось загрузить автомобиль.',
      ) as CarRow[]
      return rows.length > 0 ? toCar(rows[0]) : null
    },

    async save(input) {
      const existing = await repository.get()
      const fields = toCarFields(input)
      // владельца (user_id) сервер проставляет сам по сессии — клиент его не передаёт
      const row = unwrap(
        existing
          ? await supabase.from('cars').update(fields).eq('id', existing.id).select(COLUMNS).single()
          : await supabase.from('cars').insert(fields).select(COLUMNS).single(),
        'Не удалось сохранить автомобиль.',
      ) as CarRow
      return toCar(row)
    },

    async remove() {
      const existing = await repository.get()
      if (!existing) return
      // история обслуживания удаляется вместе с автомобилем на сервере (ON DELETE CASCADE)
      unwrap(await supabase.from('cars').delete().eq('id', existing.id), 'Не удалось удалить автомобиль.')
    },
  }

  return repository
}
