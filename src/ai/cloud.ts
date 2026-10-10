// Облачный режим ИИ-помощника: ответы генерирует серверная функция Supabase (supabase/functions/assistant).
//
// Ключ сервиса ИИ хранится только в секретах функции — в коде сайта и в приложении его нет.
// Режим выключен, пока в окружении сборки не задано VITE_AI_CLOUD=on. Эту переменную включают
// только после того, как функция развёрнута и для неё задан ключ: иначе чат честно сообщает,
// что облачный ИИ не подключён, и работает с моделью на устройстве.

import { getSupabase, isSupabaseConfigured } from '../lib/supabase'
import { AssistantError, type ChatMessage } from './types'

/** true — сборка настроена на облачный ИИ. Работоспособность сервера этим не проверяется */
export const cloudEnabled = import.meta.env.VITE_AI_CLOUD === 'on' && isSupabaseConfigured

const endpoint = () => `${(import.meta.env.VITE_SUPABASE_URL ?? '').trim().replace(/\/+$/, '')}/functions/v1/assistant`

const STATUS_MESSAGES: Record<number, string> = {
  401: 'Сессия истекла. Войдите в кабинет заново.',
  404: 'Облачный ИИ не развёрнут на сервере.',
  413: 'Слишком длинный вопрос. Сократите его.',
  429: 'Слишком много вопросов подряд. Подождите минуту.',
  503: 'Облачный ИИ не настроен на сервере.',
}

/**
 * Отправляет переписку на сервер и получает ответ по частям: onText получает весь накопленный текст.
 * Данные автомобиля (car) уходят на сервер, только если пользователь сам включил их учёт.
 */
export async function cloudGenerate(
  messages: ChatMessage[],
  car: string | null,
  onText: (text: string) => void,
  signal: AbortSignal,
): Promise<string> {
  const { data } = await getSupabase().auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new AssistantError('Облачный ИИ доступен после входа в кабинет.')

  let response: Response
  try {
    response = await fetch(endpoint(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        apikey: (import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim(),
      },
      body: JSON.stringify({ messages: messages.filter((message) => message.role !== 'system'), car }),
      signal,
    })
  } catch (cause) {
    if (signal.aborted) return ''
    // так же выглядит и неразвёрнутая функция: браузер не получает от неё разрешения на запрос
    throw new AssistantError('Сервер ИИ не отвечает. Проверьте интернет и повторите.', { cause })
  }

  if (!response.ok || !response.body) {
    throw new AssistantError(STATUS_MESSAGES[response.status] ?? 'Сервер ИИ не ответил. Повторите позже.')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let text = ''
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      text += decoder.decode(value, { stream: true })
      onText(text)
    }
  } catch (cause) {
    // остановка пользователем: остаётся то, что успело прийти
    if (signal.aborted) return text
    throw new AssistantError('Связь прервалась во время ответа. Повторите вопрос.', { cause })
  }
  return text
}
