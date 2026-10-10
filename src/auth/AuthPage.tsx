import { useState, type FormEvent, type ReactNode } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Link } from '../router'
import { useAuth } from './AuthProvider'
import '../app/pages/pages.css'
import './auth.css'

type Mode = 'signin' | 'signup'

const MIN_PASSWORD = 8
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

/** Экран на время восстановления сессии и переходов */
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

export function AuthPage() {
  const { signIn, signUp, resendConfirmation } = useAuth()
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  /** почта, на которую отправлено письмо с подтверждением */
  const [confirmEmail, setConfirmEmail] = useState<string | null>(null)
  /** показать кнопку повторной отправки письма */
  const [canResend, setCanResend] = useState(false)

  const switchMode = (next: Mode) => {
    setMode(next)
    setErrors({})
    setFormError(null)
    setInfo(null)
    setCanResend(false)
  }

  const validate = () => {
    const next: typeof errors = {}
    const address = email.trim()
    if (address === '') next.email = 'Укажите почту'
    else if (!EMAIL_PATTERN.test(address)) next.email = 'Проверьте адрес: он должен выглядеть как name@example.com'
    if (password === '') next.password = 'Укажите пароль'
    else if (mode === 'signup' && password.length < MIN_PASSWORD) next.password = `Пароль — не короче ${MIN_PASSWORD} символов`
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setFormError(null)
    setInfo(null)
    setCanResend(false)
    if (!validate()) return

    const address = email.trim()
    setBusy(true)
    if (mode === 'signin') {
      const result = await signIn(address, password)
      // при успехе экран сменится сам: появится сессия, и откроется кабинет
      if (!result.ok) {
        setFormError(result.message)
        setCanResend(result.message.startsWith('Почта ещё не подтверждена'))
      }
    } else {
      const result = await signUp(address, password)
      if (!result.ok) setFormError(result.message)
      else if (result.needsConfirmation) {
        setConfirmEmail(address)
        setPassword('')
      }
    }
    setBusy(false)
  }

  const handleResend = async () => {
    setBusy(true)
    setFormError(null)
    const result = await resendConfirmation((confirmEmail ?? email).trim())
    if (result.ok) setInfo('Письмо отправлено ещё раз. Проверьте почту, включая папку «Спам».')
    else setFormError(result.message)
    setBusy(false)
  }

  if (confirmEmail) {
    return (
      <AuthLayout>
        <p className="page__eyebrow">Регистрация</p>
        <h1 className="page__title auth__title">Подтвердите почту</h1>
        <p className="page__lead">
          Мы отправили письмо на <b className="auth__email">{confirmEmail}</b>. Перейдите по ссылке из письма — после
          этого можно будет войти. Пока почта не подтверждена, вход не выполнен.
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
              setConfirmEmail(null)
              switchMode('signin')
            }}
          >
            Перейти ко входу
          </button>
          <button className="btn" type="button" onClick={handleResend} disabled={busy}>
            Отправить письмо ещё раз
          </button>
        </div>
      </AuthLayout>
    )
  }

  const signup = mode === 'signup'

  return (
    <AuthLayout>
      <p className="page__eyebrow">Кабинет</p>
      <h1 className="page__title auth__title">{signup ? 'Регистрация' : 'Вход'}</h1>

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

        <div className="field">
          <label htmlFor="auth-password">
            Пароль {signup && <span>не короче {MIN_PASSWORD} символов</span>}
          </label>
          <input
            id="auth-password"
            name="password"
            type="password"
            autoComplete={signup ? 'new-password' : 'current-password'}
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
          <button className="btn btn--primary" type="submit" disabled={busy}>
            {signup ? 'Зарегистрироваться' : 'Войти'}
          </button>
          {canResend && (
            <button className="btn" type="button" onClick={handleResend} disabled={busy}>
              Отправить письмо ещё раз
            </button>
          )}
        </div>
      </form>

      <p className="auth__switch">
        {signup ? 'Уже есть аккаунт?' : 'Ещё нет аккаунта?'}{' '}
        <button type="button" onClick={() => switchMode(signup ? 'signin' : 'signup')}>
          {signup ? 'Войти' : 'Зарегистрироваться'}
        </button>
      </p>
    </AuthLayout>
  )
}
