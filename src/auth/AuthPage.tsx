import { useState, type FormEvent, type ReactNode } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Link } from '../router'
import { useIsMobile } from '../useIsMobile'
import { useAuth } from './AuthProvider'
import '../app/pages/pages.css'
import './auth.css'

type Mode = 'signin' | 'signup' | 'forgot'

export const MIN_PASSWORD = 8
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Общий каркас экранов входа: логотип, ссылка на сайт и узкая колонка с содержимым */
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="auth">
      <header className="auth__top">
        <Link className="auth__logo" to="/" aria-label="AI Auto — на главную">
          AI Auto
        </Link>
        <Link className="auth__back" to="/">
          <ArrowLeft size={14} strokeWidth={1.5} aria-hidden="true" />
          На сайт
        </Link>
      </header>
      <main className="auth__body">{children}</main>
    </div>
  )
}

/** Экран на время проверки сессии и переходов */
export function AuthLoading() {
  return (
    <AuthLayout>
      <p className="page__eyebrow" role="status">
        Загрузка…
      </p>
    </AuthLayout>
  )
}

/** Сообщение, если не заданы переменные окружения Supabase */
export function AuthUnavailable({ message }: { message: string }) {
  return (
    <AuthLayout>
      <p className="page__eyebrow">Кабинет</p>
      <h1 className="page__title auth__title">Вход недоступен</h1>
      <p className="alert" role="alert">
        {message}
      </p>
    </AuthLayout>
  )
}

/** Сессия есть, но сервер недоступен: подтвердить её нельзя, поэтому кабинет не открывается */
export function AuthOffline({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <AuthLayout>
      <p className="page__eyebrow">Кабинет</p>
      <h1 className="page__title auth__title">Нет связи</h1>
      <p className="alert" role="alert">
        {message}
      </p>
      <div className="actions">
        <button className="btn btn--primary" type="button" onClick={onRetry}>
          Повторить
        </button>
      </div>
    </AuthLayout>
  )
}

const initialMode = (): Mode => (new URLSearchParams(window.location.search).get('mode') === 'forgot' ? 'forgot' : 'signin')

export function AuthPage() {
  const { signIn, signUp, resendConfirmation, requestPasswordReset, linkError, clearLinkError } = useAuth()
  const [mode, setMode] = useState<Mode>(initialMode)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  /** почта, на которую ушёл запрос письма, и вид письма */
  const [sent, setSent] = useState<{ email: string; kind: 'confirm' | 'reset' } | null>(null)
  /** показать кнопку повторной отправки письма с подтверждением */
  const [canResend, setCanResend] = useState(false)
  const mobile = useIsMobile()

  const switchMode = (next: Mode) => {
    setMode(next)
    setErrors({})
    setFormError(null)
    setInfo(null)
    setCanResend(false)
    clearLinkError()
  }

  const validate = () => {
    const next: typeof errors = {}
    const address = email.trim()
    if (address === '') next.email = 'Укажите почту'
    else if (!EMAIL_PATTERN.test(address)) next.email = 'Проверьте адрес: он должен выглядеть как name@example.com'
    if (mode !== 'forgot') {
      if (password === '') next.password = 'Укажите пароль'
      else if (mode === 'signup' && password.length < MIN_PASSWORD) next.password = `Пароль — не короче ${MIN_PASSWORD} символов`
    }
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (busy) return
    setFormError(null)
    setInfo(null)
    setCanResend(false)
    clearLinkError()
    if (!validate()) return

    const address = email.trim()
    setBusy(true)
    if (mode === 'signin') {
      const result = await signIn(address, password)
      // при успехе экран сменится сам: появится сессия, и откроется кабинет
      if (!result.ok) {
        setFormError(result.message)
        setCanResend(result.code === 'email_not_confirmed')
      }
    } else if (mode === 'signup') {
      const result = await signUp(address, password)
      if (!result.ok) setFormError(result.message)
      else if (result.needsConfirmation) {
        setSent({ email: address, kind: 'confirm' })
        setPassword('')
      }
    } else {
      const result = await requestPasswordReset(address)
      if (result.ok) setSent({ email: address, kind: 'reset' })
      else setFormError(result.message)
    }
    setBusy(false)
  }

  const handleResend = async () => {
    if (busy) return
    setBusy(true)
    setFormError(null)
    const result = await resendConfirmation((sent?.email ?? email).trim())
    if (result.ok) setInfo('Запрос на повторную отправку принят. Проверьте почту, включая папку «Спам».')
    else setFormError(result.message)
    setBusy(false)
  }

  if (sent) {
    const reset = sent.kind === 'reset'
    return (
      <AuthLayout>
        <p className="page__eyebrow">{reset ? 'Восстановление пароля' : 'Регистрация'}</p>
        <h1 className="page__title auth__title">Проверьте почту</h1>
        {/* Текст одинаков для существующих и несуществующих аккаунтов. Доставку письма приложение подтвердить не может */}
        <p className="page__lead">
          {mobile ? (
            reset ? (
              <>
                Если аккаунт <b className="auth__email">{sent.email}</b> существует, мы отправили ссылку для смены пароля.
                Проверьте и «Спам».
              </>
            ) : (
              <>
                Если адрес <b className="auth__email">{sent.email}</b> не был зарегистрирован, мы отправили ссылку для
                подтверждения. До подтверждения войти нельзя. Уже есть аккаунт — войдите или сбросьте пароль.
              </>
            )
          ) : reset ? (
            <>
              Если аккаунт с адресом <b className="auth__email">{sent.email}</b> существует, на него отправлено письмо со
              ссылкой для смены пароля. Письмо может идти несколько минут — проверьте и папку «Спам».
            </>
          ) : (
            <>
              Если адрес <b className="auth__email">{sent.email}</b> ещё не был зарегистрирован, на него отправлено письмо
              со ссылкой для подтверждения. Пока почта не подтверждена, вход не выполнен. Если аккаунт у вас уже есть —
              войдите или восстановите пароль.
            </>
          )}
        </p>
        {info && (
          <p className="auth__info" role="status">
            {info}
          </p>
        )}
        {formError && (
          <p className="alert" role="alert">
            {formError}
          </p>
        )}
        <div className="actions">
          <button
            className="btn btn--primary"
            type="button"
            onClick={() => {
              setSent(null)
              switchMode('signin')
            }}
          >
            {mobile ? 'Войти' : 'Перейти ко входу'}
          </button>
          {!reset && (
            <button className="btn" type="button" onClick={handleResend} disabled={busy}>
              {mobile ? 'Отправить ещё раз' : 'Отправить письмо ещё раз'}
            </button>
          )}
        </div>
      </AuthLayout>
    )
  }

  const titles: Record<Mode, string> = { signin: 'Вход', signup: 'Регистрация', forgot: mobile ? 'Сброс пароля' : 'Восстановление пароля' }
  const submitLabels: Record<Mode, string> = { signin: 'Войти', signup: 'Зарегистрироваться', forgot: 'Отправить ссылку' }

  return (
    <AuthLayout>
      <p className="page__eyebrow">Кабинет</p>
      <h1 className="page__title auth__title">{titles[mode]}</h1>
      {mode === 'forgot' && (
        <p className="page__lead">
          {mobile ? 'Пришлём ссылку для нового пароля.' : 'Укажите почту аккаунта — мы отправим ссылку для установки нового пароля.'}
        </p>
      )}

      <form className="form auth__form" onSubmit={handleSubmit} noValidate>
        <div className="field">
          <label htmlFor="auth-email">Почта</label>
          <input
            id="auth-email"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value)
              setErrors((current) => ({ ...current, email: undefined }))
            }}
            aria-invalid={errors.email ? true : undefined}
            aria-describedby={errors.email ? 'auth-email-error' : undefined}
          />
          {errors.email && (
            <p className="field__error" id="auth-email-error">
              {errors.email}
            </p>
          )}
        </div>

        {mode !== 'forgot' && (
          <div className="field">
            <label htmlFor="auth-password">
              Пароль {mode === 'signup' && <span>не короче {MIN_PASSWORD} символов</span>}
            </label>
            <input
              id="auth-password"
              name="password"
              type="password"
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              value={password}
              onChange={(event) => {
                setPassword(event.target.value)
                setErrors((current) => ({ ...current, password: undefined }))
              }}
              aria-invalid={errors.password ? true : undefined}
              aria-describedby={errors.password ? 'auth-password-error' : undefined}
            />
            {errors.password && (
              <p className="field__error" id="auth-password-error">
                {errors.password}
              </p>
            )}
          </div>
        )}

        {info && (
          <p className="auth__info" role="status">
            {info}
          </p>
        )}
        {(formError ?? linkError) && (
          <p className="alert" role="alert">
            {formError ?? linkError}
          </p>
        )}

        <div className="actions">
          <button className="btn btn--primary" type="submit" disabled={busy}>
            {busy ? 'Подождите…' : submitLabels[mode]}
          </button>
          {canResend && (
            <button className="btn" type="button" onClick={handleResend} disabled={busy}>
              {mobile ? 'Отправить ещё раз' : 'Отправить письмо ещё раз'}
            </button>
          )}
        </div>
      </form>

      {mode === 'signin' && (
        <p className="auth__switch">
          <button type="button" onClick={() => switchMode('forgot')}>
            Забыли пароль?
          </button>
        </p>
      )}
      <p className="auth__switch">
        {mode === 'signin' ? 'Ещё нет аккаунта?' : mode === 'signup' ? 'Уже есть аккаунт?' : 'Вспомнили пароль?'}{' '}
        <button type="button" onClick={() => switchMode(mode === 'signin' ? 'signup' : 'signin')}>
          {mode === 'signin' ? 'Зарегистрироваться' : 'Войти'}
        </button>
      </p>
    </AuthLayout>
  )
}
