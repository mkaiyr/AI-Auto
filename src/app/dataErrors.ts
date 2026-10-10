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

/**
 * Код и очищенный текст ответа сервера — чтобы по сообщению на экране можно было понять настоящую причину.
 * Идентификаторы, адреса почты и всё похожее на ключи вырезается; токены и заголовки сюда не попадают вовсе.
 */
function diagnostic(e: ServerLikeError, status: number): string {
  const text = (e.message ?? '')
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '…')
    .replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, '…')
    .replace(/[A-Za-z0-9_\-.]{24,}/g, '…')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 90)
  const parts = [e.code, status > 0 ? `HTTP ${status}` : '', text].filter(Boolean)
  return parts.length > 0 ? ` Код: ${parts.join(' · ')}.` : ''
}

/**
 * Переводит ошибку Supabase (база, хранилище файлов, сеть) в понятное сообщение.
 * httpStatus — код ответа, если он известен отдельно от самой ошибки (ответы базы данных).
 */
export function toDataError(error: unknown, fallback: string, httpStatus?: number): DataError {
  if (error instanceof DataError) return error
  const e = (error ?? {}) as ServerLikeError
  const message = e.message ?? ''
  // у хранилища файлов настоящий код лежит в statusCode, а status всегда 400
  const status = Number(httpStatus || e.statusCode || e.status || 0)
  // Запрос ушёл без токена пользователя: сессии в браузере уже нет, и сервер видит гостя,
  // у которого нет прав на таблицы. Это не запрет доступа к данным, а завершившийся вход.
  const guest = e.code === '42501' && /permission denied/i.test(message) && status !== 403

  if (e.name === 'TypeError' || /failed to fetch|networkerror|load failed|fetch failed|network request failed/i.test(message)) {
    return new DataError(NETWORK_MESSAGE)
  }
  // токен не принят: истёк или сессия завершена на сервере
  if (e.code === 'PGRST301' || e.code === 'PGRST303' || status === 401 || /jwt/i.test(message) || guest) {
    return new DataError('Сессия истекла. Обновите страницу и войдите в аккаунт заново.')
  }
  if (e.code === '42501' || status === 403 || /row-level security/i.test(message)) {
    return new DataError(`Сервер отклонил операцию: нет доступа к этим данным.${diagnostic(e, status)}`)
  }
  if (e.code === '23503') return new DataError('Автомобиль не найден на сервере. Обновите страницу.')
  if (e.code === '23514' || e.code === '23502' || e.code?.startsWith('22')) {
    return new DataError('Сервер не принял данные: проверьте введённые значения.')
  }
  if (status === 413 || /too large|exceeded the maximum/i.test(message)) return new DataError('Фотография слишком большая для загрузки.')
  if (status >= 500) return new DataError('Сервер временно недоступен. Попробуйте позже.')

  return new DataError(`${fallback}${diagnostic(e, status)}`)
}

/** Достаёт данные из ответа Supabase или бросает DataError */
export function unwrap<T>(result: { data: T; error: unknown; status?: number }, fallback: string): T {
  if (result.error) throw toDataError(result.error, fallback, result.status)
  return result.data
}

/** Текст для показа: сообщение DataError или запасной вариант для неожиданных ошибок */
export const errorText = (error: unknown, fallback: string) => (error instanceof DataError ? error.message : fallback)
