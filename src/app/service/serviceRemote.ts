// История обслуживания в Supabase (таблица service_records).
// Запись привязана к автомобилю; сервер проверяет, что автомобиль принадлежит тому же пользователю.

import type { SupabaseClient } from '@supabase/supabase-js'
import { DataError, unwrap } from '../dataErrors'
import { CATEGORY_LABELS, type ServiceCategory, type ServiceInput, type ServiceRecord, type ServiceRepository } from './serviceStore'

const COLUMNS = 'id, car_id, title, category, service_date, mileage, cost, comment, created_at, updated_at'

interface ServiceRow {
  id: string
  car_id: string
  title: string
  category: string
  service_date: string
  mileage: number
  cost: number | string
  comment: string
  created_at: string
  updated_at: string
}

const toRecord = (row: ServiceRow): ServiceRecord => ({
  id: row.id,
  carId: row.car_id,
  title: row.title,
  category: row.category in CATEGORY_LABELS ? (row.category as ServiceCategory) : 'other',
  date: row.service_date,
  mileage: row.mileage,
  // numeric приходит числом; на случай строки приводим явно, чтобы суммы считались, а не склеивались
  cost: Number(row.cost),
  comment: row.comment,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
})

/** Поля записи в том виде, в каком их хранит таблица (дата — столбец service_date) */
export const toServiceFields = (input: ServiceInput) => ({
  title: input.title,
  category: input.category,
  service_date: input.date,
  mileage: input.mileage,
  cost: input.cost,
  comment: input.comment,
})

export function createRemoteServiceRepository(supabase: SupabaseClient): ServiceRepository {
  return {
    async list(carId) {
      const rows = unwrap(
        await supabase.from('service_records').select(COLUMNS).eq('car_id', carId).order('service_date', { ascending: false }),
        'Не удалось загрузить историю обслуживания.',
      ) as ServiceRow[]
      return rows.map(toRecord)
    },

    async create(carId, input) {
      const row = unwrap(
        await supabase
          .from('service_records')
          .insert({ car_id: carId, ...toServiceFields(input) })
          .select(COLUMNS)
          .single(),
        'Не удалось сохранить запись.',
      ) as ServiceRow
      return toRecord(row)
    },

    async update(id, input) {
      const rows = unwrap(
        await supabase.from('service_records').update(toServiceFields(input)).eq('id', id).select(COLUMNS),
        'Не удалось сохранить запись.',
      ) as ServiceRow[]
      // чужую или уже удалённую запись сервер не изменит и вернёт пустой ответ
      if (rows.length === 0) throw new DataError('Запись не найдена: возможно, она уже удалена. Обновите страницу.')
      return toRecord(rows[0])
    },

    async remove(id) {
      unwrap(await supabase.from('service_records').delete().eq('id', id), 'Не удалось удалить запись.')
    },

    async removeByCar(carId) {
      unwrap(await supabase.from('service_records').delete().eq('car_id', carId), 'Не удалось удалить историю обслуживания.')
    },
  }
}
