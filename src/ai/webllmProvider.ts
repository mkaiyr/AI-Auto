// Бесплатный провайдер: языковая модель работает в браузере посетителя через WebGPU (библиотека WebLLM).
//
// Сервер и ключи не нужны. Файлы модели браузер скачивает напрямую с Hugging Face и хранит в своём кеше,
// поэтому повторный запуск ничего не качает. Вопросы и ответы не покидают устройство.
//
// Сама библиотека весит несколько мегабайт и подключается только здесь, динамическим импортом:
// пока посетитель не нажал «Запустить», она не загружается и на остальные страницы не влияет.

import type { MLCEngineInterface } from '@mlc-ai/web-llm'
import { AssistantError, type AssistantProvider, type ChatMessage, type ModelOption, type Support } from './types'

// Qwen2.5 — многоязычные модели с лицензией Apache-2.0, отвечают по-русски.
// Вариант на 3 млрд параметров не предлагается: у него некоммерческая лицензия.
const MODELS: (ModelOption & { base: string })[] = [
  {
    id: 'standard',
    base: 'Qwen2.5-1.5B-Instruct',
    name: 'Основная',
    downloadMb: 840,
    memoryMb: 1630,
    note: 'Отвечает заметно лучше. Нужен компьютер или современный телефон.',
  },
  {
    id: 'light',
    base: 'Qwen2.5-0.5B-Instruct',
    name: 'Лёгкая',
    downloadMb: 280,
    memoryMb: 950,
    note: 'Для слабых устройств и медленного интернета. Качество ответов низкое: часто ошибается и путается.',
    compact: true,
  },
]

interface GpuAdapter {
  features: { has(name: string): boolean }
}
interface Gpu {
  requestAdapter(options?: { powerPreference?: string }): Promise<GpuAdapter | null>
}

let engine: MLCEngineInterface | null = null
let worker: Worker | null = null
let loadedModel: string | null = null
/** поддерживает ли видеокарта вычисления половинной точности: от этого зависит вариант файлов модели */
let halfFloat = true
let lastSpeed: number | null = null
/** номер текущей загрузки: отмена увеличивает его, и прежняя загрузка понимает, что она больше не нужна */
let loadToken = 0
/** Сколько раз загрузка возобновляется сама после обрыва связи: файлов много, и единичный сбой — обычное дело */
const LOAD_ATTEMPTS = 5
const isNetworkError = (error: unknown) => /fetch|network|load failed|ERR_|timeout/i.test(error instanceof Error ? error.message : String(error))
/** Ошибка сохранения в кеш: повторять её много раз бессмысленно, если дело в нехватке места */
const isCacheError = (error: unknown) => /cache/i.test(error instanceof Error ? error.message : String(error))

/** Сколько места, по оценке браузера, осталось в хранилище сайта, МБ; null — браузер не сообщает */
async function freeStorageMb(): Promise<number | null> {
  try {
    const estimate = await navigator.storage?.estimate?.()
    if (!estimate?.quota) return null
    return Math.floor((estimate.quota - (estimate.usage ?? 0)) / 1048576)
  } catch {
    return null
  }
}
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const fullId = (option: ModelOption & { base: string }) => `${option.base}-${halfFloat ? 'q4f16_1' : 'q4f32_1'}-MLC`
const optionOf = (id: string) => MODELS.find((model) => model.id === id) ?? MODELS[0]

/** Понятный текст вместо технической ошибки библиотеки или браузера */
function explain(error: unknown, fallback: string): AssistantError {
  const text = error instanceof Error ? error.message : String(error)
  if (/out of memory|device.{0,8}lost|OOM|allocation|D3D12|Vulkan|context.{0,6}lost/i.test(text)) {
    return new AssistantError('Устройству не хватило памяти для модели. Закройте другие вкладки и попробуйте лёгкую модель.')
  }
  if (/quota|storage/i.test(text)) return new AssistantError('В хранилище браузера не хватает места для файлов модели. Освободите место на диске и попробуйте снова.')
  // Браузер сообщает о нехватке места в своём хранилище той же «сетевой ошибкой», что и об обрыве связи
  if (/cache/i.test(text)) {
    return new AssistantError('Не удалось сохранить файлы модели. Чаще всего причина — мало свободного места на диске или в хранилище браузера, реже — обрыв связи. Освободите место и попробуйте снова — уже скачанное сохранится.')
  }
  if (/fetch|network|load failed|ERR_|timeout/i.test(text)) return new AssistantError('Не удалось скачать файлы модели. Проверьте интернет и попробуйте снова — уже скачанное сохранится.')
  return new AssistantError(`${fallback} (${text.slice(0, 160)})`)
}

async function release() {
  loadToken++
  const current = engine
  engine = null
  loadedModel = null
  try {
    await current?.unload()
  } catch {
    // поток всё равно завершается ниже
  }
  worker?.terminate()
  worker = null
}

export const webllmProvider: AssistantProvider = {
  id: 'webllm',
  local: true,
  models: MODELS,

  async checkSupport(): Promise<Support> {
    if (!window.isSecureContext) return { ok: false, reason: 'insecure', message: 'ИИ в браузере работает только на защищённой странице (https).' }
    const gpu = (navigator as Navigator & { gpu?: Gpu }).gpu
    if (!gpu) return { ok: false, reason: 'no-webgpu', message: 'Этот браузер не поддерживает WebGPU — технологию, на которой работает модель.' }
    try {
      const adapter = await gpu.requestAdapter({ powerPreference: 'high-performance' })
      if (!adapter) return { ok: false, reason: 'no-adapter', message: 'Браузер поддерживает WebGPU, но видеокарта этого устройства для неё недоступна.' }
      halfFloat = adapter.features.has('shader-f16')
    } catch {
      return { ok: false, reason: 'no-adapter', message: 'Не удалось получить доступ к видеокарте устройства.' }
    }
    // deviceMemory есть не во всех браузерах; без него считаем устройство обычным
    const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory
    return { ok: true, weak: memory !== undefined && memory <= 4, storageMb: await freeStorageMb() }
  },

  async load(modelId, onProgress) {
    const model = fullId(optionOf(modelId))
    if (engine && loadedModel === model) return
    await release()
    const token = loadToken
    const cancelled = () => token !== loadToken
    for (let attempt = 1; ; attempt++) {
      let own: Worker | null = null
      try {
        const webllm = await import('@mlc-ai/web-llm')
        if (cancelled()) throw new AssistantError('Загрузка отменена.')
        // Места должно хватить на всю модель. Проверка грубая (часть файлов могла скачаться раньше),
        // поэтому загрузка запрещается только при явной нехватке — меньше половины нужного объёма.
        const option = optionOf(modelId)
        const free = await freeStorageMb()
        if (attempt === 1 && free !== null && free < option.downloadMb / 2 && !(await webllm.hasModelInCache(model).catch(() => false))) {
          throw new AssistantError(`В хранилище браузера не хватает места: модели нужно около ${option.downloadMb} МБ, доступно около ${Math.max(free, 0)} МБ. Освободите место на диске устройства и попробуйте снова.`)
        }
        own = new Worker(new URL('./webllm.worker.ts', import.meta.url), { type: 'module' })
        worker = own
        const created = await webllm.CreateWebWorkerMLCEngine(own, model, {
          initProgressCallback: (report) => !cancelled() && onProgress({ progress: report.progress, detail: report.text }),
        })
        // пока шла загрузка, её могли отменить
        if (cancelled()) {
          await created.unload().catch(() => {})
          own.terminate()
          throw new AssistantError('Загрузка отменена.')
        }
        engine = created
        loadedModel = model
        return
      } catch (error) {
        if (cancelled()) throw new AssistantError('Загрузка отменена.')
        own?.terminate()
        if (worker === own) worker = null
        // Уже скачанные файлы лежат в кеше браузера, поэтому повтор продолжает с того же места
        if (!(error instanceof AssistantError) && !isCacheError(error) && isNetworkError(error) && attempt < LOAD_ATTEMPTS) {
          console.warn(`[AI Auto] загрузка модели прервалась, попытка ${attempt + 1} из ${LOAD_ATTEMPTS}:`, error)
          await pause(1500 * attempt)
          if (cancelled()) throw new AssistantError('Загрузка отменена.')
          continue
        }
        console.warn('[AI Auto] модель не запустилась:', error)
        if (error instanceof AssistantError) throw error
        const left = isCacheError(error) ? await freeStorageMb() : null
        const reason = explain(error, 'Не удалось запустить модель.')
        throw left === null ? reason : new AssistantError(`${reason.message} Сейчас в хранилище браузера доступно около ${Math.max(left, 0)} МБ.`)
      }
    }
  },

  unload: release,

  async generate(messages: ChatMessage[], onText) {
    if (!engine) throw new AssistantError('Модель не загружена.')
    let text = ''
    try {
      // ответ ограничен по длине: на слабых устройствах модель печатает несколько слов в секунду
      const stream = await engine.chat.completions.create({ messages, stream: true, stream_options: { include_usage: true }, temperature: 0.3, top_p: 0.9, max_tokens: 400 })
      for await (const chunk of stream) {
        const piece = chunk.choices[0]?.delta?.content
        if (piece) {
          text += piece
          onText(text)
        }
        const measured = chunk.usage?.extra?.decode_tokens_per_s
        if (typeof measured === 'number' && Number.isFinite(measured)) lastSpeed = measured
      }
      return text
    } catch (error) {
      // остановка пользователем — не ошибка: возвращается то, что успело сгенерироваться
      if (text !== '') return text
      throw explain(error, 'Не удалось получить ответ.')
    }
  },

  stop() {
    engine?.interruptGenerate()
  },

  speed: () => lastSpeed,

  async forget(modelId) {
    const model = fullId(optionOf(modelId))
    if (loadedModel === model) await release()
    const webllm = await import('@mlc-ai/web-llm')
    await webllm.deleteModelAllInfoInCache(model)
  },
}
