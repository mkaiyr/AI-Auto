// Перевод ошибок Supabase Auth в понятные сообщения.
// Сервер сообщает код ошибки (error.code); текст на английском пользователю не показываем.
// Сообщения не раскрывают, зарегистрирован ли конкретный адрес почты.

interface AuthLikeError {
  name?: string
  code?: string
  status?: number
  message?: string
}

export const LINK_INVALID = 'Ссылка недействительна или устарела. Запросите новую.'

const BY_CODE: Record<string, string> = {
  invalid_credentials: 'Неверная почта или пароль.',
  email_not_confirmed: 'Почта ещё не подтверждена. Перейдите по ссылке из письма, которое мы отправили при регистрации.',
  // одинаковый нейтральный текст: по нему нельзя понять, занят ли адрес
  user_already_exists: 'Не удалось зарегистрироваться с этими данными. Если у вас уже есть аккаунт, войдите или восстановите пароль.',
  email_exists: 'Не удалось зарегистрироваться с этими данными. Если у вас уже есть аккаунт, войдите или восстановите пароль.',
  weak_password: 'Пароль слишком простой. Придумайте пароль длиннее и сложнее.',
  same_password: 'Новый пароль должен отличаться от прежнего.',
  email_address_invalid: 'Такой адрес почты не подходит. Проверьте, нет ли опечатки.',
  validation_failed: 'Проверьте введённые данные: сервер их не принял.',
  signup_disabled: 'Регистрация сейчас закрыта.',
  email_provider_disabled: 'Вход по почте сейчас отключён.',
  over_email_send_rate_limit: 'Слишком много писем за короткое время. Подождите несколько минут и попробуйте снова.',
  over_request_rate_limit: 'Слишком много попыток. Подождите минуту и попробуйте снова.',
  user_banned: 'Этот аккаунт заблокирован.',
  session_expired: 'Сессия истекла. Войдите снова.',
  session_not_found: LINK_INVALID,
  otp_expired: LINK_INVALID,
  flow_state_expired: LINK_INVALID,
  flow_state_not_found: LINK_INVALID,
  reauthentication_needed: 'Для смены пароля войдите в аккаунт заново.',
}

export const NETWORK_ERROR = 'Не удалось связаться с сервером. Проверьте подключение к интернету и попробуйте снова.'

/** true, если запрос не дошёл до сервера или сервер не ответил (а не отклонил запрос) */
export function isNetworkAuthError(error: unknown): boolean {
  const e = (error ?? {}) as AuthLikeError
  return e.name === 'AuthRetryableFetchError' || e.status === 0 || /failed to fetch|networkerror|load failed/i.test(e.message ?? '')
}

/** Сообщение для пользователя по ошибке, которую вернул или бросил клиент Supabase */
export function authErrorMessage(error: unknown): string {
  const e = (error ?? {}) as AuthLikeError

  if (isNetworkAuthError(error)) return NETWORK_ERROR
  if (e.code && BY_CODE[e.code]) return BY_CODE[e.code]
  if (e.name === 'AuthSessionMissingError') return LINK_INVALID
  if (e.status === 429) return BY_CODE.over_request_rate_limit
  if (e.status !== undefined && e.status >= 500) return 'Сервер временно недоступен. Попробуйте позже.'

  return 'Не удалось выполнить действие. Попробуйте ещё раз.'
}
