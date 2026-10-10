import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { ArrowUp, MoreHorizontal, Square, X } from 'lucide-react'
import { useAuth } from '../auth/AuthProvider'
import { AiMark } from '../components/AiMark'
import { Link } from '../router'
import { rememberedModel, rememberModel, type CarContext } from './AssistantChat'
import { cloudEnabled, cloudGenerate } from './cloud'
import { buildMessages } from './prompt'
import { getAssistantProvider } from './providers'
import { RichText } from './richText'
import { classifyQuestion, describesSymptom, GUARDED_ANSWER, permitsDriving, SAFETY_ANSWER, SAFETY_NOTICE, SYMPTOM_NOTE, type SafetyClass } from './safety'
import { AssistantError, type ChatMessage, type Support } from './types'
import './chat.css'

// Чат ИИ-помощника для телефона. Открывается сразу: поле ввода доступно без скачивания модели.
//
// Откуда берутся ответы:
//  - «облако» — серверная функция (src/ai/cloud.ts). Работает, только если сборка настроена на неё
//    и пользователь вошёл в кабинет. Пока она не настроена, этого режима в интерфейсе нет;
//  - «на устройстве» — модель WebLLM. Скачивается только по нажатию кнопки, никогда сама.
// На вопросы о безопасности отвечает заранее написанная справка (safety.ts), а не модель.

interface AssistantChatMobileProps {
  /** Чьи это данные: при смене аккаунта переписка и данные автомобиля сбрасываются */
  owner: string
  /** Способ получить данные автомобиля из кабинета. Вызывается только по нажатию пользователя */
  loadCarContext?: () => Promise<CarContext | null>
  /** Под чатом есть нижняя панель разделов кабинета */
  tabbar?: boolean
}

type LocalStage = 'checking' | 'unsupported' | 'idle' | 'loading' | 'ready'

interface Turn extends ChatMessage {
  /** ответ написан заранее, а не моделью, и помечен предупреждением */
  safety?: Exclude<SafetyClass, 'none'>
  /** вопрос о неполадке: под ответом модели стоит оговорка */
  symptom?: boolean
}

const EXAMPLES = ['Когда менять масло?', 'Почему вырос расход?', 'Что означает ошибка на панели?']
const STALL_SECONDS = 60
const SLOW_SPEED = 4
const MAX_QUESTION = 1000
const MAX_INPUT_HEIGHT = 132

// Переписка живёт, пока открыта вкладка: при переходе между разделами кабинета она не теряется.
// На сервер и в хранилище браузера не записывается.
const session: { owner: string; turns: Turn[]; car: CarContext | null; loadedModel: string | null } = {
  owner: '',
  turns: [],
  car: null,
  loadedModel: null,
}

/** Готовые ответы на опасные темы и вопросы к ним модели не передаются: она начинает их копировать */
const forModel = (turns: Turn[]): ChatMessage[] =>
  turns
    .filter((turn, index) => !turn.safety && !(turn.role === 'user' && turns[index + 1]?.safety))
    .map(({ role, content }) => ({ role, content }))

export function AssistantChatMobile({ owner, loadCarContext, tabbar = false }: AssistantChatMobileProps) {
  if (session.owner !== owner) {
    session.owner = owner
    session.turns = []
    session.car = null
  }

  const provider = getAssistantProvider()
  const { state: auth } = useAuth()
  const cloud = cloudEnabled && auth.status === 'signedIn'
  const [mode, setMode] = useState<'cloud' | 'local'>(cloud ? 'cloud' : 'local')
  const active = cloud && mode === 'cloud' ? 'cloud' : 'local'

  const [stage, setStage] = useState<LocalStage>(session.loadedModel ? 'ready' : 'checking')
  const [support, setSupport] = useState<Support | null>(null)
  const [modelId, setModelId] = useState(() => session.loadedModel ?? rememberedModel() ?? provider.models[0].id)
  const [cachedModel, setCachedModel] = useState(rememberedModel)
  const [progress, setProgress] = useState({ progress: 0, detail: '' })
  const [stalled, setStalled] = useState(false)
  const [setupOpen, setSetupOpen] = useState(false)
  const [setupError, setSetupError] = useState<string | null>(null)

  const [turns, setTurns] = useState<Turn[]>(session.turns)
  const [draft, setDraft] = useState('')
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [speed, setSpeed] = useState<number | null>(null)

  const [car, setCar] = useState<CarContext | null>(session.car)
  const [carState, setCarState] = useState<'off' | 'consent' | 'loading' | 'empty' | 'failed'>('off')
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  /** высота экранной клавиатуры, если она перекрывает страницу */
  const [keyboard, setKeyboard] = useState(0)

  const lastProgress = useRef(0)
  const attempt = useRef(0)
  const abort = useRef<AbortController | null>(null)
  const stopped = useRef(false)
  const turnsRef = useRef(turns)
  const input = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    turnsRef.current = turns
    session.turns = turns
  }, [turns])

  useEffect(() => {
    session.car = car
  }, [car])

  useEffect(() => {
    let alive = true
    provider.checkSupport().then((result) => {
      if (!alive) return
      setSupport(result)
      setStage((current) => (current === 'checking' ? (result.ok ? 'idle' : 'unsupported') : current))
      // слабому устройству по умолчанию предлагается лёгкая модель, если пользователь ещё ничего не выбирал
      if (result.ok && result.weak && !rememberedModel() && !session.loadedModel) setModelId(provider.models[provider.models.length - 1].id)
    })
    return () => {
      alive = false
      // при уходе из чата ответ дописывать некуда; загруженная модель остаётся в памяти до закрытия вкладки
      provider.stop()
      abort.current?.abort()
    }
  }, [provider])

  // Библиотека при обрыве связи молча повторяет попытки. Чтобы загрузка не выглядела зависшей,
  // после долгой паузы появляется пояснение; саму загрузку никто не прерывает.
  useEffect(() => {
    if (stage !== 'loading') return
    lastProgress.current = Date.now()
    setStalled(false)
    const timer = window.setInterval(() => setStalled(Date.now() - lastProgress.current > STALL_SECONDS * 1000), 5000)
    return () => window.clearInterval(timer)
  }, [stage])

  // Экранная клавиатура на iPhone перекрывает страницу, не меняя её высоту: поле ввода поднимается над ней
  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) return
    const update = () => setKeyboard(Math.max(0, Math.round(window.innerHeight - viewport.height - viewport.offsetTop)))
    viewport.addEventListener('resize', update)
    viewport.addEventListener('scroll', update)
    return () => {
      viewport.removeEventListener('resize', update)
      viewport.removeEventListener('scroll', update)
    }
  }, [])

  const selected = provider.models.find((model) => model.id === modelId) ?? provider.models[0]
  const engineReady = active === 'cloud' || stage === 'ready'
  const last = turns[turns.length - 1]
  const waiting = last?.role === 'user' && !generating && error === null
  const setupVisible = active === 'local' && stage !== 'ready' && (setupOpen || waiting)
  const percent = Math.round(progress.progress * 100)

  // новое сообщение, ошибка или карточка запуска — страница прокручивается к ним
  useEffect(() => {
    if (turns.length === 0 && !setupVisible) return
    const frame = window.requestAnimationFrame(() => window.scrollTo({ top: document.documentElement.scrollHeight }))
    return () => window.cancelAnimationFrame(frame)
  }, [turns, error, setupVisible, stage])

  const answer = async (history: Turn[]) => {
    const question = history[history.length - 1].content
    const symptom = describesSymptom(question)
    setError(null)
    setTurns([...history, { role: 'assistant', content: '', symptom }])
    setGenerating(true)
    stopped.current = false
    // Ответ проверяется по мере появления: разрешение ехать дальше модель давать не вправе
    let guarded = false
    const write = (content: string) => {
      if (guarded) return
      if (permitsDriving(content)) {
        guarded = true
        stop()
        setTurns([...history, { role: 'assistant', content: GUARDED_ANSWER, safety: 'danger' }])
        return
      }
      setTurns([...history, { role: 'assistant', content, symptom }])
    }
    try {
      let text: string
      if (active === 'cloud') {
        abort.current = new AbortController()
        text = await cloudGenerate(forModel(history), car?.text ?? null, write, abort.current.signal)
      } else {
        text = await provider.generate(buildMessages(forModel(history), car?.text ?? null, selected.compact), write)
        setSpeed(provider.speed())
      }
      if (guarded) return
      if (text.trim() === '') {
        setTurns(history)
        setError(stopped.current ? 'Ответ остановлен.' : 'Ответ не получен. Повторите или переформулируйте вопрос.')
      } else write(text)
    } catch (cause) {
      if (guarded) return
      setTurns(history)
      const message = cause instanceof AssistantError ? cause.message : 'Не удалось получить ответ.'
      setError(message)
      // после сбоя устройства модель нужно запускать заново
      if (active === 'local' && /памяти/.test(message)) {
        session.loadedModel = null
        void provider.unload()
        setStage('idle')
      }
    } finally {
      setGenerating(false)
    }
  }

  const stop = () => {
    stopped.current = true
    if (active === 'cloud') abort.current?.abort()
    else provider.stop()
  }

  const send = (text = draft) => {
    const question = text.trim().slice(0, MAX_QUESTION)
    if (question === '' || generating) return
    // вопрос, на который ещё нет ответа, заменяется новым
    const base = last?.role === 'user' ? turns.slice(0, -1) : turns
    const history: Turn[] = [...base, { role: 'user', content: question }]
    setDraft('')
    setError(null)
    setMenuOpen(false)
    if (input.current) input.current.style.height = ''
    // На вопросы о безопасности отвечает заранее написанная справка: догадка модели здесь опасна
    const safety = classifyQuestion(question)
    if (safety !== 'none') {
      setTurns([...history, { role: 'assistant', content: SAFETY_ANSWER[safety], safety }])
      return
    }
    if (engineReady) void answer(history)
    else {
      // модели ещё нет: вопрос остаётся в переписке, ниже появляется карточка запуска
      setTurns(history)
      setSetupOpen(true)
    }
  }

  const startLocal = async () => {
    const current = ++attempt.current
    setSetupError(null)
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
      session.loadedModel = modelId
      setStage('ready')
      setSetupOpen(false)
      // вопрос, заданный до загрузки модели, получает ответ без повторного ввода
      const pending = turnsRef.current
      if (pending[pending.length - 1]?.role === 'user') void answer(pending)
    } catch (cause) {
      if (current !== attempt.current) return
      setSetupError(cause instanceof AssistantError ? cause.message : 'Не удалось запустить модель. Попробуйте ещё раз.')
      setStage('idle')
    }
  }

  const cancelLoading = () => {
    attempt.current++
    void provider.unload()
    setStage('idle')
  }

  const unloadLocal = () => {
    attempt.current++
    provider.stop()
    void provider.unload()
    session.loadedModel = null
    setGenerating(false)
    setSpeed(null)
    setStage('idle')
    setMenuOpen(false)
  }

  const forgetLocal = async () => {
    setSetupError(null)
    try {
      await provider.forget(modelId)
      rememberModel(null)
      setCachedModel(null)
    } catch {
      setSetupError('Не удалось удалить файлы модели. Их можно удалить в настройках браузера: «Данные сайтов».')
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

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      send()
    }
  }

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    send()
  }

  const sizes = provider.models.map((model) => model.downloadMb)
  const statusText = generating
    ? 'Отвечает…'
    : active === 'cloud'
      ? 'Облако'
      : stage === 'ready'
        ? `На устройстве · ${selected.name.toLowerCase()}`
        : stage === 'loading'
          ? `Загрузка модели · ${percent}%`
          : stage === 'unsupported'
            ? 'На этом устройстве недоступен'
            : 'Модель не загружена'

  const carBlock = loadCarContext && (
    <div className="chat__car">
      {car ? (
        <>
          <p>Учитывается: {car.summary}</p>
          <button type="button" onClick={() => setCar(null)}>
            Не учитывать
          </button>
        </>
      ) : carState === 'consent' ? (
        <>
          <p>Марка, год, пробег и последние записи истории будут уходить на сервер ИИ вместе с вопросами.</p>
          <div className="chat__row">
            <button type="button" onClick={attachCar}>
              Разрешить
            </button>
            <button type="button" onClick={() => setCarState('off')}>
              Отмена
            </button>
          </div>
        </>
      ) : (
        <>
          <p>
            {carState === 'empty'
              ? 'В кабинете ещё нет автомобиля.'
              : carState === 'failed'
                ? 'Не удалось получить данные автомобиля.'
                : active === 'cloud'
                  ? 'ИИ не знает ваш автомобиль.'
                  : 'ИИ не знает ваш автомобиль. Данные останутся на устройстве.'}
          </p>
          <button type="button" onClick={() => (active === 'cloud' ? setCarState('consent') : void attachCar())} disabled={carState === 'loading'}>
            {carState === 'loading' ? 'Получение данных…' : 'Учитывать автомобиль'}
          </button>
        </>
      )}
    </div>
  )

  return (
    <section className={tabbar ? 'chat chat--tabbar' : 'chat'} aria-label="ИИ-помощник">
      <header className="chat__head">
        <AiMark className="chat__mark" />
        <div className="chat__heading">
          <h1 className="chat__title">ИИ-помощник</h1>
          <p className="chat__status" role="status">
            {statusText}
          </p>
        </div>
        <button
          className="chat__menu-toggle"
          type="button"
          aria-label={menuOpen ? 'Закрыть меню чата' : 'Меню чата'}
          aria-expanded={menuOpen}
          onClick={() => {
            setMenuOpen((open) => !open)
            setConfirmClear(false)
          }}
        >
          {menuOpen ? <X size={22} strokeWidth={1.75} aria-hidden="true" /> : <MoreHorizontal size={22} strokeWidth={1.75} aria-hidden="true" />}
        </button>

        {menuOpen && (
          <div className="chat__menu">
            {carBlock}
            {confirmClear ? (
              <div className="chat__confirm" role="alertdialog" aria-label="Очистить переписку?">
                <p>Очистить переписку?</p>
                <div className="chat__row">
                  <button
                    className="chat__danger"
                    type="button"
                    onClick={() => {
                      stop()
                      setTurns([])
                      setError(null)
                      setConfirmClear(false)
                      setMenuOpen(false)
                    }}
                  >
                    Очистить
                  </button>
                  <button type="button" autoFocus onClick={() => setConfirmClear(false)}>
                    Отмена
                  </button>
                </div>
              </div>
            ) : (
              <button className="chat__menu-item" type="button" onClick={() => setConfirmClear(true)} disabled={turns.length === 0}>
                Очистить переписку
              </button>
            )}
            {cloud && (
              <button className="chat__menu-item" type="button" onClick={() => setMode(active === 'cloud' ? 'local' : 'cloud')} disabled={generating}>
                {active === 'cloud' ? 'Отвечать на устройстве' : 'Отвечать через облако'}
              </button>
            )}
            {active === 'local' && stage === 'ready' && (
              <button className="chat__menu-item" type="button" onClick={unloadLocal}>
                Выгрузить модель
              </button>
            )}
            {active === 'local' && (stage === 'idle' || stage === 'unsupported') && (
              <button
                className="chat__menu-item"
                type="button"
                onClick={() => {
                  setSetupOpen(true)
                  setMenuOpen(false)
                }}
              >
                Модель на устройстве
              </button>
            )}
            {!loadCarContext && (
              <Link className="chat__menu-item" to="/app/diagnostics">
                Учёт автомобиля — в кабинете
              </Link>
            )}
          </div>
        )}
      </header>

      <p className="chat__limits">ИИ может ошибаться и не заменяет автосервис.</p>

      <div className="chat__log" aria-live="polite">
        {turns.length === 0 && (
          <div className="chat__welcome">
            <p className="chat__hello">Здравствуйте! Спросите об обслуживании, расходах или неисправностях.</p>
            <ul className="chat__examples" aria-label="Примеры вопросов">
              {EXAMPLES.map((example) => (
                <li key={example}>
                  <button type="button" onClick={() => send(example)}>
                    {example}
                  </button>
                </li>
              ))}
            </ul>
            <p className="chat__mode">
              {active === 'cloud'
                ? 'Вопросы отправляются на сервер ИИ. Переписка не сохраняется.'
                : stage === 'ready'
                  ? 'Модель работает на устройстве. Переписка никуда не отправляется.'
                  : stage === 'unsupported'
                    ? 'ИИ работает на устройстве, но здесь он не запустится. Облачный ИИ пока не подключён.'
                    : `ИИ работает на устройстве: перед первым ответом нужно один раз скачать модель, ${Math.min(...sizes)}–${Math.max(...sizes)} МБ.${cloudEnabled ? '' : ' Облачный ИИ без скачивания пока не подключён.'}`}
            </p>
          </div>
        )}

        {turns.map((turn, index) =>
          turn.role === 'user' ? (
            <p key={index} className="chat__turn chat__turn--user">
              {turn.content}
            </p>
          ) : (
            <div key={index} className="chat__turn chat__turn--assistant">
              {turn.safety && <p className="chat__warning">{SAFETY_NOTICE[turn.safety]}</p>}
              {turn.content === '' ? (
                <p className="chat__typing">
                  <span aria-hidden="true" />
                  <span aria-hidden="true" />
                  <span aria-hidden="true" />
                  <b>ИИ отвечает…</b>
                </p>
              ) : (
                <RichText text={turn.content} />
              )}
              {turn.symptom && turn.content !== '' && <p className="chat__note">{SYMPTOM_NOTE}</p>}
            </div>
          ),
        )}

        {error && (
          <div className="chat__error" role="alert">
            <p>{error}</p>
            {last?.role === 'user' && engineReady && (
              <button type="button" onClick={() => void answer(turns)}>
                Повторить
              </button>
            )}
          </div>
        )}

        {setupVisible && (
          <div className="chat__setup" role="region" aria-label="Модель на устройстве">
            {stage === 'checking' && <p className="chat__setup-text">Проверка устройства…</p>}

            {stage === 'unsupported' && support && !support.ok && (
              <>
                <p className="chat__setup-title">Здесь ИИ не запустится</p>
                <p className="chat__setup-text">{support.message}</p>
                <p className="chat__setup-text">Нужен Chrome или Edge, на iPhone — Safari последней версии. Облачный ИИ пока не подключён.</p>
              </>
            )}

            {stage === 'idle' && (
              <>
                <p className="chat__setup-title">{waiting ? 'Чтобы получить ответ, нужна модель' : 'Модель на устройстве'}</p>
                <p className="chat__setup-text">Скачивается один раз и хранится в браузере.</p>
                <fieldset className="chat__models">
                  <legend>Модель</legend>
                  {provider.models.map((model) => (
                    <label key={model.id} className="chat__model">
                      <input type="radio" name="chat-model" value={model.id} checked={model.id === modelId} onChange={() => setModelId(model.id)} />
                      <span>
                        <b>
                          {model.name} · {model.downloadMb} МБ
                        </b>
                        {model.noteBrief} Память: около {(model.memoryMb / 1024).toFixed(1).replace('.', ',')} ГБ.
                        {cachedModel === model.id && ' Уже скачана.'}
                      </span>
                    </label>
                  ))}
                </fieldset>
                {support?.ok && support.weak && <p className="chat__setup-text">Памяти мало — основная модель, скорее всего, не запустится.</p>}
                {support?.ok && support.storageMb !== null && cachedModel !== modelId && support.storageMb < selected.downloadMb && (
                  <p className="chat__setup-text">Свободно около {support.storageMb} МБ — для выбранной модели этого мало.</p>
                )}
                {setupError && (
                  <p className="alert" role="alert">
                    {setupError}
                  </p>
                )}
                <div className="chat__row">
                  <button className="chat__primary" type="button" onClick={startLocal}>
                    {cachedModel === modelId ? 'Запустить' : `Скачать · ${selected.downloadMb} МБ`}
                  </button>
                  {cachedModel === modelId && (
                    <button type="button" onClick={forgetLocal}>
                      Удалить модель
                    </button>
                  )}
                  {!waiting && (
                    <button type="button" onClick={() => setSetupOpen(false)}>
                      Закрыть
                    </button>
                  )}
                </div>
                {cachedModel !== modelId && <p className="chat__setup-hint">Скачивать лучше по Wi-Fi. Запуск зависит от видеокарты и памяти устройства.</p>}
              </>
            )}

            {stage === 'loading' && (
              <div role="status" aria-live="polite">
                <p className="chat__setup-title">Загрузка модели — {percent}%</p>
                <div className="chat__bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-label="Загрузка модели">
                  <span style={{ width: `${percent}%` }} />
                </div>
                <p className="chat__setup-hint">{progress.detail || 'Подготовка…'}</p>
                {stalled && (
                  <p className="alert" role="alert">
                    Загрузка не двигается больше минуты. Возможно, интернет медленный или соединение прервалось. Можно подождать или отменить — уже
                    скачанное сохранится.
                  </p>
                )}
                <div className="chat__row">
                  <button type="button" onClick={cancelLoading}>
                    Отменить
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {active === 'local' && stage === 'ready' && speed !== null && speed < SLOW_SPEED && !generating && (
          <p className="chat__mode">
            Модель работает медленно: ответ занимает минуты{selected.id !== provider.models[provider.models.length - 1].id ? '. Попробуйте лёгкую модель' : ''}.
          </p>
        )}
      </div>

      <form className="chat__composer" style={keyboard > 0 ? { bottom: keyboard } : undefined} onSubmit={onSubmit}>
        <textarea
          ref={input}
          name="question"
          rows={1}
          maxLength={MAX_QUESTION}
          value={draft}
          aria-label="Ваш вопрос"
          placeholder="Вопрос или симптом"
          enterKeyHint="send"
          onChange={(event) => {
            setDraft(event.target.value)
            // поле растёт вместе с текстом, но не выше нескольких строк
            event.target.style.height = 'auto'
            event.target.style.height = `${Math.min(event.target.scrollHeight, MAX_INPUT_HEIGHT)}px`
          }}
          onKeyDown={onKeyDown}
        />
        {generating ? (
          <button className="chat__send chat__send--stop" type="button" aria-label="Остановить ответ" onClick={stop}>
            <Square size={18} strokeWidth={2} aria-hidden="true" />
          </button>
        ) : (
          <button className="chat__send" type="submit" aria-label="Отправить" disabled={draft.trim() === ''}>
            <ArrowUp size={22} strokeWidth={2} aria-hidden="true" />
          </button>
        )}
      </form>
    </section>
  )
}
