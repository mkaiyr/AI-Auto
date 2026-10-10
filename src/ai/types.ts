// Общие типы ИИ-помощника.
//
// Интерфейс не знает, откуда берутся ответы: он работает с AssistantProvider. Сейчас провайдер один —
// бесплатная модель в браузере посетителя (webllmProvider.ts). Платный провайдер с генерацией на сервере
// можно будет добавить позже как ещё одну реализацию этого интерфейса, не трогая чат.

export type ChatRole = 'system' | 'user' | 'assistant'

export interface ChatMessage {
  role: ChatRole
  content: string
}

export interface ModelOption {
  id: string
  name: string
  /** сколько примерно скачивается при первом запуске, МБ */
  downloadMb: number
  /** сколько видеопамяти нужно модели по данным библиотеки, МБ */
  memoryMb: number
  note: string
  /** модель слишком мала для полных инструкций — ей передаётся сокращённый вариант */
  compact?: boolean
}

/** Можно ли запустить провайдера на этом устройстве */
export type Support =
  | {
      ok: true
      /** устройству лучше подойдёт лёгкая модель */
      weak: boolean
      /** сколько места осталось в хранилище браузера по его оценке, МБ; null — браузер не сообщает */
      storageMb: number | null
    }
  | { ok: false; reason: 'insecure' | 'no-webgpu' | 'no-adapter'; message: string }

export interface LoadProgress {
  /** доля от 0 до 1 */
  progress: number
  /** служебное сообщение библиотеки, показывается мелким текстом */
  detail: string
}

export interface AssistantProvider {
  id: string
  /** true — модель работает на устройстве посетителя, переписка никуда не отправляется */
  local: boolean
  models: ModelOption[]
  checkSupport(): Promise<Support>
  /** Загружает модель; повторный вызов с той же моделью ничего не скачивает заново */
  load(modelId: string, onProgress: (progress: LoadProgress) => void): Promise<void>
  /** Отменяет идущую загрузку или выгружает модель из памяти */
  unload(): Promise<void>
  /** Генерирует ответ по частям: onText получает весь накопленный текст. Возвращает итоговый текст */
  generate(messages: ChatMessage[], onText: (text: string) => void): Promise<string>
  /** Останавливает генерацию; generate завершается тем, что успело сгенерироваться */
  stop(): void
  /** Скорость последнего ответа в токенах в секунду (токен — примерно полслова); null — ещё не измерена */
  speed(): number | null
  /** Удаляет скачанные файлы модели из хранилища браузера */
  forget(modelId: string): Promise<void>
}

/** Ошибка с текстом, который можно показать пользователю */
export class AssistantError extends Error {}
