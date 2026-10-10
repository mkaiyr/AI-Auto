// Перевод ошибок Supabase Auth в понятные сообщения.
// Сервер сообщает код ошибки (error.code); текст на английском пользователю не показываем.

interface AuthLikeError {
  name?: string
  code?: string
  status?: number
  message?: string
}

const BY_CODE: Record<string, string> = {
  invalid_credentials: 'Неверная почта или пароль.',
  email_not_confirmed: 'Почта ещё не подтверждена. Перейдите по ссылке из письма, которое мы отправили при регистрации.',
  user_already_exists: 'Аккаунт с такой почтой уже существует. Войдите в него.',
  email_exists: 'Аккаунт с такой почтой уже существует. Войдите в него.',
  weak_password: 'Пароль слишком простой. Придумайте пароль длиннее и сложнее.',
  email_address_invalid: 'Такой адрес почты не подходит. Проверьте, нет ли опечатки.',
  validation_failed: 'Проверьте почту и пароль: сервер не принял введённые данные.',
  signup_disabled: 'Регистрация сейчас закрыта.',
  email_provider_disabled: 'Вход по почте сейчас отключён.',
  over_email_send_rate_limit: 'Слишком много писем за короткое время. Подождите несколько минут и попробуйте снова.',
  over_request_rate_limit: 'Слишком много попыток. Подождите минуту и попробуйте снова.',
  user_banned: 'Этот аккаунт заблокирован.',
  session_expired: 'Сессия истекла. Войдите снова.',
}

export const NETWORK_ERROR = 'Не удалось связаться с сервером. Проверьте подключение к интернету и попробуйте снова.'

/** Сообщение для пользователя по ошибке, которую вернул или бросил клиент Supabase */
export function authErrorMessage(error: unknown): string {
  const e = (error ?? {}) as AuthLikeError

  // запрос не дошёл до сервера или сервер не ответил
  if (e.name === 'AuthRetryableFetchError' || e.status === 0 || /failed to fetch|networkerror|load failed/i.test(e.message ?? '')) {
    return NETWORK_ERROR
  }
  if (e.code && BY_CODE[e.code]) return BY_CODE[e.code]
  if (e.status === 429) return BY_CODE.over_request_rate_limit
  if (e.status !== undefined && e.status >= 500) return 'Сервер временно недоступен. Попробуйте позже.'

  return 'Не удалось выполнить действие. Попробуйте ещё раз.'
}
