/// <reference types="vite/client" />

// Переменные окружения проекта (см. .env.example). Могут отсутствовать, пока Supabase не настроен.
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  /** «on» — ответы ИИ с сервера (см. src/ai/cloud.ts). Включается только после развёртывания серверной функции */
  readonly VITE_AI_CLOUD?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
