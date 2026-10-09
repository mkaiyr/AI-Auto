/// <reference types="vite/client" />

// Переменные окружения проекта (см. .env.example). Могут отсутствовать, пока Supabase не настроен.
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
