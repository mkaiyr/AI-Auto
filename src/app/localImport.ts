// Перенос данных прежней версии из localStorage в аккаунт на сервере.
//
// Раньше автомобиль, фото и история хранились в браузере. Источников два:
//   * «account» — ключи с идентификатором пользователя (версия с разделением по аккаунтам);
//   * «legacy»  — общие ключи без владельца (самая ранняя версия).
//
// Правила:
//   * ничего не переносится без явного подтверждения пользователя;
//   * перенос идемпотентен: идентификаторы строк закрепляются до первой отправки,
//     поэтому повтор после сбоя или обновления страницы не создаёт дублей;
//   * локальные данные удаляются только после проверки, что всё дошло до сервера;
//   * при любой ошибке исходные данные остаются на месте.

import type { SupabaseClient } from '@supabase/supabase-js'
import { CAR_PHOTO_STORAGE_KEY, type CarPhotoRepository } from './car/carPhoto'
import { toCarFields } from './car/carRemote'
import { CAR_STORAGE_KEY, type CarInput } from './car/carStore'
import { validateCar } from './car/carValidation'
import { DataError, unwrap } from './dataErrors'
import { newId } from './format'
import { toServiceFields } from './service/serviceRemote'
import { SERVICE_STORAGE_KEY, type ServiceInput } from './service/serviceStore'
import { validateService } from './service/serviceValidation'
import { userKey } from './storageKeys'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const STATE_KEY = 'ai-auto:import:v1'

interface LocalRecord {
  localId: string
  input: ServiceInput
  createdAt: string | null
}

export interface LocalSnapshot {
  /** чьи это данные: текущего аккаунта в этом браузере или без владельца */
  source: 'account' | 'legacy'
  localCarId: string
  car: CarInput
  records: LocalRecord[]
  /** записи с некорректными данными — на сервер не отправляются */
  skipped: number
  /** сжатое фото (data URL) или null */
  photo: string | null
}

/** Что запомнено о переносе: закреплённые идентификаторы и чем он закончился */
interface ImportState {
  status: 'started' | 'done' | 'partial' | 'dismissed'
  carId: string
  recordIds: Record<string, string>
}

export interface ImportResult {
  records: number
  skipped: number
  photo: 'none' | 'ok' | 'failed'
  /** true — локальная копия удалена, потому что всё перенесено и проверено */
  localRemoved: boolean
}

const parse = (key: string): unknown => {
  try {
    return JSON.parse(window.localStorage.getItem(key) ?? 'null')
  } catch {
    return null
  }
}

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null
const text = (value: unknown) => (typeof value === 'string' ? value : value === null || value === undefined ? '' : String(value))

function readState(userId: string): ImportState | null {
  const state = parse(userKey(STATE_KEY, userId))
  return isObject(state) && typeof state.carId === 'string' && isObject(state.recordIds) ? (state as unknown as ImportState) : null
}

function writeState(userId: string, state: ImportState) {
  window.localStorage.setItem(userKey(STATE_KEY, userId), JSON.stringify(state))
}

/** Читает и проверяет данные по одному набору ключей */
function readSource(source: 'account' | 'legacy', key: (base: string) => string): LocalSnapshot | null {
  const rawCar = parse(key(CAR_STORAGE_KEY))
  if (!isObject(rawCar)) return null

  // те же правила, что в форме автомобиля: год, пробег, длина названий, допустимые значения
  const checkedCar = validateCar({
    make: text(rawCar.make),
    model: text(rawCar.model),
    year: text(rawCar.year),
    mileage: text(rawCar.mileage),
    body: text(rawCar.body),
    engine: text(rawCar.engine),
    fuel: text(rawCar.fuel),
  })
  if (!checkedCar.car) return null

  const localCarId = text(rawCar.id)
  const rawRecords = parse(key(SERVICE_STORAGE_KEY))
  const records: LocalRecord[] = []
  let skipped = 0

  for (const raw of Array.isArray(rawRecords) ? rawRecords : []) {
    // запись другого автомобиля к этому не относится
    if (!isObject(raw) || text(raw.carId) !== localCarId) continue
    const cost = typeof raw.cost === 'number' && Number.isFinite(raw.cost) ? String(Math.round(raw.cost * 100) / 100) : ''
    const checked = validateService({
      title: text(raw.title),
      category: text(raw.category),
      date: text(raw.date),
      mileage: text(raw.mileage),
      cost,
      comment: text(raw.comment),
    })
    if (!checked.record || text(raw.id) === '') {
      skipped++
      continue
    }
    const created = text(raw.createdAt)
    records.push({ localId: text(raw.id), input: checked.record, createdAt: Number.isNaN(Date.parse(created)) ? null : created })
  }

  const rawPhoto = parse(key(CAR_PHOTO_STORAGE_KEY))
  const photo =
    isObject(rawPhoto) && rawPhoto.carId === rawCar.id && typeof rawPhoto.dataUrl === 'string' && rawPhoto.dataUrl.startsWith('data:image/jpeg;base64,')
      ? rawPhoto.dataUrl
      : null

  return { source, localCarId, car: checkedCar.car, records, skipped, photo }
}

/**
 * Локальные данные, которые можно предложить к переносу, или null.
 * Данные своего аккаунта имеют приоритет над данными без владельца.
 */
export function findLocalData(userId: string): LocalSnapshot | null {
  const state = readState(userId)
  if (state && state.status !== 'started') return null
  return readSource('account', (base) => userKey(base, userId)) ?? readSource('legacy', (base) => base)
}

/** «Не переносить»: предложение больше не показывается этому аккаунту, сами данные остаются в браузере */
export function dismissImport(userId: string) {
  try {
    writeState(userId, { status: 'dismissed', carId: '', recordIds: {} })
  } catch {
    // без записи предложение просто появится снова
  }
}

function removeSource(snapshot: LocalSnapshot, userId: string) {
  const key = snapshot.source === 'account' ? (base: string) => userKey(base, userId) : (base: string) => base
  for (const base of [SERVICE_STORAGE_KEY, CAR_PHOTO_STORAGE_KEY, CAR_STORAGE_KEY]) window.localStorage.removeItem(key(base))
}

/**
 * Переносит локальные данные в аккаунт. Бросает DataError; при ошибке локальные данные не меняются.
 * Повторный вызов продолжает с теми же идентификаторами и не создаёт дублей.
 */
export async function importLocalData(
  userId: string,
  snapshot: LocalSnapshot,
  supabase: SupabaseClient,
  photos: CarPhotoRepository,
): Promise<ImportResult> {
  const failed = 'Не удалось перенести данные. Локальная копия не изменена — попробуйте ещё раз.'

  // Идентификаторы закрепляются до отправки. Локальные UUID сохраняются, остальные заменяются новыми.
  const previous = readState(userId)
  const state: ImportState =
    previous && previous.status === 'started'
      ? previous
      : { status: 'started', carId: UUID.test(snapshot.localCarId) ? snapshot.localCarId : newId(), recordIds: {} }
  for (const record of snapshot.records) state.recordIds[record.localId] ??= UUID.test(record.localId) ? record.localId : newId()
  writeState(userId, state)

  // 1. В аккаунте не должно быть другого автомобиля: интерфейс работает с одним
  const existing = unwrap(await supabase.from('cars').select('id').limit(2), failed) as { id: string }[]
  if (existing.some((car) => car.id !== state.carId)) {
    throw new DataError('В аккаунте уже есть автомобиль. Локальные данные не перенесены и остались в браузере.')
  }

  // 2. Автомобиль. «Вставить, если такой строки ещё нет» — повтор не создаёт второй автомобиль
  const insertCar = async () => {
    unwrap(await supabase.from('cars').upsert({ id: state.carId, ...toCarFields(snapshot.car) }, { onConflict: 'id', ignoreDuplicates: true }), failed)
    return unwrap(await supabase.from('cars').select('id').eq('id', state.carId).maybeSingle(), failed) as { id: string } | null
  }
  if (!(await insertCar())) {
    // идентификатор занят строкой другого аккаунта: сервер её не показывает и не меняет. Берём новый
    state.carId = newId()
    writeState(userId, state)
    if (!(await insertCar())) throw new DataError(failed)
  }

  // 3. История обслуживания с проверкой, что дошла каждая запись
  const rowFor = (record: LocalRecord) => ({
    id: state.recordIds[record.localId],
    car_id: state.carId,
    ...toServiceFields(record.input),
    ...(record.createdAt ? { created_at: record.createdAt } : {}),
  })
  const missing = async () => {
    const rows = unwrap(await supabase.from('service_records').select('id').eq('car_id', state.carId), failed) as { id: string }[]
    const present = new Set(rows.map((row) => row.id))
    return snapshot.records.filter((record) => !present.has(state.recordIds[record.localId]))
  }
  let left = await missing()
  for (let attempt = 0; attempt < 2 && left.length > 0; attempt++) {
    if (attempt === 1) {
      // идентификаторы заняты чужими строками — выдаём новые только для недошедших записей
      for (const record of left) state.recordIds[record.localId] = newId()
      writeState(userId, state)
    }
    unwrap(await supabase.from('service_records').upsert(left.map(rowFor), { onConflict: 'id', ignoreDuplicates: true }), failed)
    left = await missing()
  }
  if (left.length > 0) throw new DataError('Перенесены не все записи истории. Локальная копия сохранена — попробуйте ещё раз.')

  // 4. Фотография. Её сбой не отменяет перенос автомобиля и истории
  let photo: ImportResult['photo'] = 'none'
  if (snapshot.photo) {
    try {
      await photos.save(state.carId, snapshot.photo)
      photo = 'ok'
    } catch {
      photo = 'failed'
    }
  }

  // 5. Локальная копия удаляется, только если перенесено всё без исключений
  const complete = snapshot.skipped === 0 && photo !== 'failed'
  if (complete) removeSource(snapshot, userId)
  writeState(userId, { ...state, status: complete ? 'done' : 'partial' })

  return { records: snapshot.records.length, skipped: snapshot.skipped, photo, localRemoved: complete }
}
