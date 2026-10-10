// Данные, сохранённые до разделения по аккаунтам.
//
// Раньше автомобиль, история и фото лежали в общих ключах localStorage и не были
// привязаны ни к одному пользователю. Такие данные:
//   * не удаляются автоматически;
//   * не показываются в кабинете и не передаются первому вошедшему;
//   * могут быть перенесены в аккаунт только явным действием пользователя с подтверждением.
// Узнать настоящего владельца невозможно — у старых данных нет отметки о пользователе.

import { CAR_PHOTO_STORAGE_KEY } from './car/carPhoto'
import { CAR_STORAGE_KEY } from './car/carStore'
import { userKey } from './storageKeys'
import { SERVICE_STORAGE_KEY } from './service/serviceStore'

const LEGACY_KEYS = [SERVICE_STORAGE_KEY, CAR_PHOTO_STORAGE_KEY, CAR_STORAGE_KEY]
const DISMISSED_KEY = 'ai-auto:legacy-dismissed'

export interface LegacySummary {
  /** число записей истории обслуживания */
  records: number
  hasPhoto: boolean
}

/** Есть ли непривязанные данные. Подробности (марка, модель, фото) намеренно не возвращаются */
export function findLegacyData(): LegacySummary | null {
  try {
    const car: unknown = JSON.parse(window.localStorage.getItem(CAR_STORAGE_KEY) ?? 'null')
    if (typeof car !== 'object' || car === null) return null
    const records: unknown = JSON.parse(window.localStorage.getItem(SERVICE_STORAGE_KEY) ?? '[]')
    return {
      records: Array.isArray(records) ? records.length : 0,
      hasPhoto: window.localStorage.getItem(CAR_PHOTO_STORAGE_KEY) !== null,
    }
  } catch {
    return null
  }
}

export function isLegacyDismissed(userId: string): boolean {
  try {
    return window.localStorage.getItem(userKey(DISMISSED_KEY, userId)) !== null
  } catch {
    return false
  }
}

/** «Это не мои данные»: предложение больше не показывается этому аккаунту, сами данные остаются */
export function dismissLegacy(userId: string) {
  try {
    window.localStorage.setItem(userKey(DISMISSED_KEY, userId), '1')
  } catch {
    // без записи предложение просто появится снова
  }
}

/**
 * Переносит непривязанные данные в аккаунт пользователя.
 * Сначала всё копируется в его ключи; общие ключи убираются только после успешной копии.
 * При ошибке (например, не хватило места) частичная копия откатывается, исходные данные остаются.
 */
export function claimLegacyData(userId: string) {
  const written: string[] = []
  try {
    // автомобиль копируется последним: пока его нет, кабинет считает перенос несостоявшимся
    for (const key of LEGACY_KEYS) {
      const value = window.localStorage.getItem(key)
      if (value === null) continue
      window.localStorage.setItem(userKey(key, userId), value)
      written.push(userKey(key, userId))
    }
  } catch (error) {
    for (const key of written) window.localStorage.removeItem(key)
    throw error
  }
  for (const key of LEGACY_KEYS) window.localStorage.removeItem(key)
}
