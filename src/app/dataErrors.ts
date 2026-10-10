// Ошибки работы с сервером в виде, пригодном для показа пользователю.
// Хранилища бросают только DataError; страницы показывают её текст как есть.

export class DataError extends Error {}

export const NETWORK_MESSAGE = 'Нет связи с сервером. Проверьте подключение к интернету и попробуйте ещё раз.'

interface ServerLikeError {
  name?: string
  code?: string
  status?: number
  statusCode?: string | number
  message?: string
}

/** Переводит ошибку Supabase (база, хранилище файлов, сеть) в понятное сообщение */
export function toDataError(error: unknown, fallback: string): DataError {
  if (error instanceof DataError) return error
  const e = (error ?? {}) as ServerLikeError
  const message = e.message ?? ''
  const status = Number(e.status ?? e.statusCode ?? 0)

  if (e.name === 'TypeError' || /failed to fetch|networkerror|load failed|fetch failed|network request failed/i.test(message)) {
    return new DataError(NETWORK_MESSAGE)
  }
  // токен не принят: истёк или сессия завершена на сервере
  if (e.code === 'PGRST301' || e.code === 'PGRST303' || status === 401 || /jwt/i.test(message)) {
    return new DataError('Сессия истекла. Обновите страницу и войдите в аккаунт заново.')
  }
  if (e.code === '42501' || status === 403 || /row-level security/i.test(message)) {
    return new DataError('Сервер отклонил операцию: нет доступа к этим данным.')
  }
  if (e.code === '23503') return new DataError('Автомобиль не найден на сервере. Обновите страницу.')
  if (e.code === '23514' || e.code === '23502' || e.code?.startsWith('22')) {
    return new DataError('Сервер не принял данные: проверьте введённые значения.')
  }
  if (status === 413 || /too large|exceeded the maximum/i.test(message)) return new DataError('Фотография слишком большая для загрузки.')
  if (status >= 500) return new DataError('Сервер временно недоступен. Попробуйте позже.')

  return new DataError(fallback)
}

/** Достаёт данные из ответа Supabase или бросает DataError */
export function unwrap<T>(result: { data: T; error: unknown }, fallback: string): T {
  if (result.error) throw toDataError(result.error, fallback)
  return result.data
}

/** Текст для показа: сообщение DataError или запасной вариант для неожиданных ошибок */
export const errorText = (error: unknown, fallback: string) => (error instanceof DataError ? error.message : fallback)
