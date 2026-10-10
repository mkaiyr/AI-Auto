import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Link } from '../router'
import { buildMessages } from './prompt'
import { classifyQuestion, SAFETY_ANSWER, SAFETY_NOTICE, type SafetyClass } from './safety'
import { getAssistantProvider } from './providers'
import { AssistantError, type ChatMessage, type Support } from './types'
import './assistant.css'

/** Данные автомобиля для модели: текст для неё и короткая сводка для пользователя */
export interface CarContext {
  text: string
  summary: string
}

interface AssistantChatProps {
  /**
   * Способ получить данные автомобиля из кабинета. Вызывается только по нажатию кнопки пользователем.
   * Без него (публичная страница) помощник об автомобиле ничего не знает.
   */
  loadCarContext?: () => Promise<CarContext | null>
}

type Stage = 'checking' | 'unsupported' | 'idle' | 'loading' | 'ready'

interface Turn extends ChatMessage {
  /** вопрос затрагивает безопасность: ответ написан заранее, а не моделью, и помечен предупреждением */
  safety?: Exclude<SafetyClass, 'none'>
}

const MODEL_KEY = 'ai-auto:assistant-model'
/** Через сколько секунд без движения загрузки показывается подсказка, что она идёт медленно или прервалась */
const STALL_SECONDS = 60
/** Ниже этой скорости (токенов в секунду) ответ приходится ждать минутами */
const SLOW_SPEED = 4
const MAX_QUESTION = 1000

/** Какая модель уже запускалась в этом браузере: её файлы, скорее всего, лежат в кеше */
function rememberedModel(): string | null {
  try {
    return window.localStorage.getItem(MODEL_KEY)
  } catch {
    return null
  }
}

function rememberModel(id: string | null) {
  try {
    if (id) window.localStorage.setItem(MODEL_KEY, id)
    else window.localStorage.removeItem(MODEL_KEY)
  } catch {
    // без localStorage просто не будет пометки «уже скачана»
  }
}

/**
 * Модель размечает ответ звёздочками и решётками — в интерфейсе они только мешают.
 * Иероглифы, которые маленькая модель иногда вставляет посреди русского текста, тоже убираются.
 */
const plain = (text: string) =>
  text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/^#{1,4}\s+/gm, '')
    .replace(/[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]+/g, '')

export function AssistantChat({ loadCarContext }: AssistantChatProps) {
  const provider = getAssistantProvider()
  const [stage, setStage] = useState<Stage>('checking')
  const [support, setSupport] = useState<Support | null>(null)
  const [modelId, setModelId] = useState(() => rememberedModel() ?? provider.models[0].id)
  const [cachedModel, setCachedModel] = useState(rememberedModel)
  const [progress, setProgress] = useState({ progress: 0, detail: '' })
  const [error, setError] = useState<string | null>(null)
  const [turns, setTurns] = useState<Turn[]>([])
  const [draft, setDraft] = useState('')
  const [generating, setGenerating] = useState(false)
  const [car, setCar] = useState<CarContext | null>(null)
  const [carState, setCarState] = useState<'off' | 'loading' | 'empty' | 'failed'>('off')
  const [stalled, setStalled] = useState(false)
  const [speed, setSpeed] = useState<number | null>(null)
  /** когда загрузка в последний раз сдвинулась */
  const lastProgress = useRef(0)
  /** номер текущей попытки загрузки: результат отменённой попытки игнорируется */
  const attempt = useRef(0)
  const log = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let alive = true
    provider.checkSupport().then((result) => {
      if (!alive) return
      setSupport(result)
      setStage(result.ok ? 'idle' : 'unsupported')
      // слабому устройству по умолчанию предлагается лёгкая модель, если пользователь ещё ничего не выбирал
      if (result.ok && result.weak && !rememberedModel()) setModelId(provider.models[provider.models.length - 1].id)
    })
    return () => {
      alive = false
      // при уходе со страницы ответ дописывать некуда; сама модель остаётся в памяти до закрытия вкладки
      provider.stop()
    }
  }, [provider])

  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight })
  }, [turns])

  // Библиотека при обрыве связи не сообщает об ошибке, а молча повторяет попытки. Чтобы интерфейс
  // не выглядел зависшим, после долгой паузы появляется пояснение; загрузку при этом никто не прерывает.
  useEffect(() => {
    if (stage !== 'loading') return
    lastProgress.current = Date.now()
    setStalled(false)
    const timer = window.setInterval(() => setStalled(Date.now() - lastProgress.current > STALL_SECONDS * 1000), 5000)
    return () => window.clearInterval(timer)
  }, [stage])

  const selected = provider.models.find((model) => model.id === modelId) ?? provider.models[0]

  const start = async () => {
    const current = ++attempt.current
    setError(null)
    setProgress({ progress: 0, detail: '' })
    setStage('loading')
    try {
      await provider.load(modelId, (report) => {
        if (current !== attempt.current) return
        lastProgress.current = Date.now()
        setProgress(report)
      })
      if (current !== attempt.current) return
      rememberModel(modelId)
      setCachedModel(modelId)
      setStage('ready')
    } catch (cause) {
      if (current !== attempt.current) return
      setError(cause instanceof AssistantError ? cause.message : 'Не удалось запустить модель. Попробуйте ещё раз.')
      setStage('idle')
    }
  }

  const cancelLoading = () => {
    attempt.current++
    void provider.unload()
    setStage('idle')
  }

  const unload = () => {
    attempt.current++
    provider.stop()
    void provider.unload()
    setGenerating(false)
    setStage('idle')
  }

  const forget = async () => {
    setError(null)
    try {
      await provider.forget(modelId)
      rememberModel(null)
      setCachedModel(null)
    } catch {
      setError('Не удалось удалить файлы модели. Их можно удалить в настройках браузера: «Данные сайтов».')
    }
  }

  const send = async (event?: FormEvent) => {
    event?.preventDefault()
    const question = draft.trim()
    if (question === '' || generating || stage !== 'ready') return
    const history: Turn[] = [...turns, { role: 'user', content: question }]
    setDraft('')
    setError(null)
    // На вопросы о безопасности отвечает не модель, а заранее написанный текст: её догадка здесь опасна
    const safety = classifyQuestion(question)
    if (safety !== 'none') {
      setTurns([...history, { role: 'assistant', content: SAFETY_ANSWER[safety], safety }])
      return
    }
    setTurns([...history, { role: 'assistant', content: '' }])
    setGenerating(true)
    const write = (content: string) => setTurns([...history, { role: 'assistant', content }])
    try {
      const answer = await provider.generate(buildMessages(history, car?.text ?? null), write)
      write(answer.trim() === '' ? 'Ответ не получен. Попробуйте переформулировать вопрос.' : answer)
      setSpeed(provider.speed())
    } catch (cause) {
      setTurns(history)
      setDraft(question)
      setError(cause instanceof AssistantError ? cause.message : 'Не удалось получить ответ. Попробуйте ещё раз.')
      // после сбоя устройства модель нужно запускать заново
      if (cause instanceof AssistantError && /памяти/.test(cause.message)) unload()
    } finally {
      setGenerating(false)
    }
  }

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      void send()
    }
  }

  const attachCar = async () => {
    if (!loadCarContext) return
    setCarState('loading')
    try {
      const loaded = await loadCarContext()
      setCar(loaded)
      setCarState(loaded ? 'off' : 'empty')
    } catch {
      setCarState('failed')
    }
  }

  const percent = Math.round(progress.progress * 100)

  return (
    <section className="ai" aria-label="ИИ-помощник">
      <p className="ai__limits">
        Небольшая языковая модель работает прямо в вашем браузере. Она может ошибаться и не заменяет диагностику в автосервисе. Вопросы и ответы
        не отправляются на сервер и не сохраняются.
      </p>

      {stage === 'checking' && <p className="ai__status">Проверка устройства…</p>}

      {stage === 'unsupported' && support && !support.ok && (
        <div className="ai__panel" role="status">
          <p className="ai__panel-title">На этом устройстве ИИ не запустится</p>
          <p className="ai__text">{support.message}</p>
          <ul className="ai__list">
            <li>Откройте сайт в Chrome или Edge на компьютере либо в Chrome на телефоне с Android.</li>
            <li>На iPhone и Mac нужен Safari последней версии.</li>
            <li>Обновите браузер: в старых версиях нужной технологии нет.</li>
            <li>Остальные разделы работают без ИИ: профиль автомобиля, история обслуживания и расходы.</li>
          </ul>
        </div>
      )}

      {stage === 'idle' && (
        <div className="ai__panel">
          <p className="ai__panel-title">Запуск ИИ</p>
          <p className="ai__text">
            Модель скачивается на устройство один раз и сохраняется в браузере — при следующих запусках интернет для неё не нужен. Пока вы не
            нажмёте кнопку, ничего не загружается.
          </p>
          <fieldset className="ai__models">
            <legend>Модель</legend>
            {provider.models.map((model) => (
              <label key={model.id} className="ai__model">
                <input type="radio" name="ai-model" value={model.id} checked={model.id === modelId} onChange={() => setModelId(model.id)} />
                <span>
                  <b>
                    {model.name} · около {model.downloadMb} МБ
                  </b>
                  {model.note} Нужно примерно {(model.memoryMb / 1024).toFixed(1).replace('.', ',')} ГБ свободной памяти.
                  {cachedModel === model.id && ' Уже скачана в этом браузере.'}
                </span>
              </label>
            ))}
          </fieldset>
          <p className="ai__text">
            Запуск на вашем устройстве не гарантирован: это зависит от видеокарты, свободной памяти и места на диске. Если модель не запустится,
            сайт сообщит причину.
            {support?.ok && support.weak && ' У этого устройства немного памяти — основная модель, скорее всего, не запустится.'}
            {support?.ok && support.storageMb !== null && (
              <>
                {' '}В хранилище браузера доступно около {support.storageMb} МБ
                {cachedModel !== modelId && support.storageMb < selected.downloadMb ? ' — для выбранной модели этого мало.' : '.'}
              </>
            )}
          </p>
          {error && (
            <p className="alert" role="alert">
              {error}
            </p>
          )}
          <div className="actions">
            <button className="btn btn--primary" type="button" onClick={start}>
              {cachedModel === modelId ? 'Запустить ИИ' : `Скачать и запустить · ${selected.downloadMb} МБ`}
            </button>
            {cachedModel === modelId && (
              <button className="btn" type="button" onClick={forget}>
                Удалить файлы модели
              </button>
            )}
          </div>
          <p className="ai__hint">При первом запуске лучше использовать Wi-Fi: мобильный интернет может быть платным.</p>
        </div>
      )}

      {stage === 'loading' && (
        <div className="ai__panel" role="status" aria-live="polite">
          <p className="ai__panel-title">
            Загрузка модели — {percent}%
          </p>
          <div className="ai__bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-label="Загрузка модели">
            <span style={{ width: `${percent}%` }} />
          </div>
          <p className="ai__hint">{progress.detail || 'Подготовка…'}</p>
          {stalled && (
            <p className="alert" role="alert">
              Загрузка не двигается больше минуты. Возможно, интернет медленный или соединение прервалось. Можно подождать ещё или отменить и
              попробовать позже — уже скачанное сохранится.
            </p>
          )}
          <p className="ai__text">Вкладку можно не закрывать: скачанное сохраняется, прерванная загрузка продолжится с того же места.</p>
          <div className="actions">
            <button className="btn" type="button" onClick={cancelLoading}>
              Отменить
            </button>
          </div>
        </div>
      )}

      {stage === 'ready' && (
        <>
          {loadCarContext && (
            <div className="ai__context">
              {car ? (
                <>
                  <p className="ai__text">ИИ учитывает данные из кабинета: {car.summary}</p>
                  <button className="ai__link" type="button" onClick={() => setCar(null)}>
                    Не учитывать
                  </button>
                </>
              ) : (
                <>
                  <p className="ai__text">
                    {carState === 'empty'
                      ? 'В кабинете ещё нет автомобиля — добавьте его в разделе «Автомобиль».'
                      : carState === 'failed'
                        ? 'Не удалось получить данные автомобиля. Попробуйте ещё раз.'
                        : 'Сейчас ИИ ничего не знает о вашем автомобиле. Данные из кабинета передаются модели только по вашему нажатию и остаются на устройстве.'}
                  </p>
                  <button className="ai__link" type="button" onClick={attachCar} disabled={carState === 'loading'}>
                    {carState === 'loading' ? 'Получение данных…' : 'Учитывать мой автомобиль и историю обслуживания'}
                  </button>
                </>
              )}
            </div>
          )}

          <div className="ai__log" ref={log} aria-live="polite">
            {turns.length === 0 && (
              <p className="ai__empty">
                Спросите об обслуживании, эксплуатации, типичных неисправностях или о том, как пользоваться AI Auto. Например: «Как часто
                менять масло в двигателе?» или «Где посмотреть расходы за год?»
              </p>
            )}
            {turns.map((turn, index) =>
              turn.role === 'user' ? (
                <p key={index} className="ai__turn ai__turn--user">
                  {turn.content}
                </p>
              ) : (
                <div key={index} className="ai__turn ai__turn--assistant">
                  {turn.safety && <p className="ai__danger">{SAFETY_NOTICE[turn.safety]}</p>}
                  <p>{turn.content === '' ? <span className="ai__typing">ИИ думает…</span> : plain(turn.content)}</p>
                </div>
              ),
            )}
          </div>

          {error && (
            <p className="alert" role="alert">
              {error}
            </p>
          )}
          {speed !== null && speed < SLOW_SPEED && !generating && (
            <p className="ai__text">
              На этом устройстве модель работает медленно: ответ занимает минуты. Быстрее будет на компьютере с отдельной видеокартой или на
              более новом телефоне{selected.id !== provider.models[provider.models.length - 1].id ? '; можно также выбрать лёгкую модель' : ''}.
            </p>
          )}

          <form className="ai__form" onSubmit={send}>
            <label className="ai__label" htmlFor="ai-question">
              Ваш вопрос
            </label>
            <textarea
              id="ai-question"
              name="question"
              rows={2}
              maxLength={MAX_QUESTION}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Опишите вопрос или симптом"
            />
            <div className="ai__form-actions">
              {generating ? (
                <button className="btn" type="button" onClick={() => provider.stop()}>
                  Остановить ответ
                </button>
              ) : (
                <button className="btn btn--primary" type="submit" disabled={draft.trim() === ''}>
                  Спросить
                </button>
              )}
              <span className="ai__hint" aria-live="polite">
                {generating ? 'ИИ печатает ответ… это может занять от нескольких секунд до нескольких минут' : `Модель: ${selected.name.toLowerCase()}${speed ? ` · ${speed.toFixed(1).replace('.', ',')} токена в секунду` : ''}`}
              </span>
              <button className="ai__link" type="button" onClick={() => setTurns([])} disabled={generating || turns.length === 0}>
                Очистить переписку
              </button>
              <button className="ai__link" type="button" onClick={unload}>
                Выгрузить модель
              </button>
            </div>
          </form>
        </>
      )}

      {!loadCarContext && stage !== 'checking' && (
        <p className="ai__hint">
          Чтобы ИИ мог учитывать ваш автомобиль и историю обслуживания, откройте помощника <Link to="/app/diagnostics">в личном кабинете</Link>.
        </p>
      )}
    </section>
  )
}
