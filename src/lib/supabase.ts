// Единственное место, где создаётся клиент Supabase.
//
// Адрес проекта и публичный ключ берутся из переменных окружения (файл .env.local).
// Клиент создаётся при первом обращении, а не при загрузке сайта: пока переменные
// не заданы, лендинг и разделы на localStorage продолжают работать как раньше.

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/** Ошибка настройки с текстом, который можно показать пользователю или разработчику */
export class SupabaseConfigError extends Error {}

const HOW_TO_FIX =
  'Скопируйте .env.example в .env.local, впишите значения из панели Supabase (Project Settings → API) и перезапустите «npm run dev».'

/** Роль из ключа старого формата (JWT) или null, если это не JWT */
function jwtRole(key: string): string | null {
  try {
    const payload = key.split('.')[1]
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
    const role = (JSON.parse(json) as { role?: unknown }).role
    return typeof role === 'string' ? role : null
  } catch {
    return null
  }
}

/** Проверяет переменные окружения. Возвращает список проблем — пустой, если всё в порядке */
function findProblems(url: string, key: string): string[] {
  const problems: string[] = []

  if (url === '') {
    problems.push('не задан VITE_SUPABASE_URL')
  } else {
    try {
      if (new URL(url).protocol !== 'https:') problems.push('VITE_SUPABASE_URL должен начинаться с https://')
    } catch {
      problems.push('VITE_SUPABASE_URL не похож на адрес (ожидается https://…supabase.co)')
    }
  }

  if (key === '') {
    problems.push('не задан VITE_SUPABASE_ANON_KEY')
  } else if (key.startsWith('sb_secret_') || jwtRole(key) === 'service_role') {
    // всё с префиксом VITE_ попадает в код сайта и видно каждому посетителю
    problems.push('в VITE_SUPABASE_ANON_KEY указан секретный ключ — нужен публичный (anon / publishable)')
  }

  return problems
}

const url = (import.meta.env.VITE_SUPABASE_URL ?? '').trim()
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim()
const problems = findProblems(url, anonKey)

/** true, если переменные окружения заданы и выглядят корректно. Соединение с сервером не проверяет */
export const isSupabaseConfigured = problems.length === 0

let client: SupabaseClient | null = null

/**
 * Клиент Supabase для всего приложения.
 * Бросает SupabaseConfigError с понятным текстом, если настройки отсутствуют или неверны.
 */
export function getSupabase(): SupabaseClient {
  if (!isSupabaseConfigured) {
    throw new SupabaseConfigError(`Supabase не настроен: ${problems.join('; ')}. ${HOW_TO_FIX}`)
  }
  client ??= createClient(url, anonKey)
  return client
}
