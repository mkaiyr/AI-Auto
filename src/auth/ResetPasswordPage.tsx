import { useRef, useState, type FormEvent } from 'react'
import { Link, navigate } from '../router'
import { useIsMobile } from '../useIsMobile'
import { AuthLayout, MIN_PASSWORD } from './AuthPage'
import { useAuth } from './AuthProvider'
import { LINK_INVALID } from './authErrors'

/**
 * Страница, на которую ведёт ссылка из письма о восстановлении пароля.
 * Клиент Supabase сам обменивает ссылку на сессию; здесь пользователь задаёт новый пароль.
 * Без действительной сессии форма не показывается — только сообщение о негодной ссылке.
 */
export function ResetPasswordPage() {
  const { state, updatePassword, linkError } = useAuth()
  const [password, setPassword] = useState('')
  const [repeat, setRepeat] = useState('')
  const [errors, setErrors] = useState<{ password?: string; repeat?: string }>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const submitting = useRef(false)
  const mobile = useIsMobile()

  if (done) {
    return (
      <AuthLayout>
        <p className="page__eyebrow">Восстановление пароля</p>
        <h1 className="page__title auth__title">Пароль изменён</h1>
        <p className="page__lead">{mobile ? 'Используйте его при следующем входе.' : 'Новый пароль сохранён. Используйте его при следующем входе.'}</p>
        <div className="actions">
          <button className="btn btn--primary" type="button" onClick={() => navigate('/app/car')}>
            Открыть кабинет
          </button>
        </div>
      </AuthLayout>
    )
  }

  if (state.status !== 'signedIn') {
    return (
      <AuthLayout>
        <p className="page__eyebrow">Восстановление пароля</p>
        <h1 className="page__title auth__title">Ссылка не подошла</h1>
        <p className="alert" role="alert">
          {linkError ?? LINK_INVALID}
        </p>
        <p className="page__lead">
          {mobile ? 'Ссылка действует недолго и только один раз.' : 'Ссылка из письма действует ограниченное время и срабатывает один раз.'}
        </p>
        <div className="actions">
          <Link className="btn btn--primary" to="/login?mode=forgot">
            {mobile ? 'Новая ссылка' : 'Запросить новую ссылку'}
          </Link>
        </div>
      </AuthLayout>
    )
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (submitting.current) return

    const next: typeof errors = {}
    if (password.length < MIN_PASSWORD) next.password = `Пароль — не короче ${MIN_PASSWORD} символов`
    if (repeat !== password) next.repeat = 'Пароли не совпадают'
    setErrors(next)
    setFormError(null)
    if (Object.keys(next).length > 0) return

    submitting.current = true
    setBusy(true)
    const result = await updatePassword(password)
    submitting.current = false
    setBusy(false)
    if (result.ok) setDone(true)
    else setFormError(result.message)
  }

  return (
    <AuthLayout>
      <p className="page__eyebrow">Восстановление пароля</p>
      <h1 className="page__title auth__title">Новый пароль</h1>
      <p className="page__lead">
        Аккаунт <b className="auth__email">{state.user.email}</b>.{!mobile && ' Придумайте новый пароль.'}
      </p>

      <form className="form auth__form" onSubmit={handleSubmit} noValidate>
        <div className="field">
          <label htmlFor="reset-password">
            Новый пароль <span>не короче {MIN_PASSWORD} символов</span>
          </label>
          <input
            id="reset-password"
            name="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value)
              setErrors((current) => ({ ...current, password: undefined }))
            }}
            aria-invalid={errors.password ? true : undefined}
            aria-describedby={errors.password ? 'reset-password-error' : undefined}
          />
          {errors.password && (
            <p className="field__error" id="reset-password-error">
              {errors.password}
            </p>
          )}
        </div>

        <div className="field">
          <label htmlFor="reset-repeat">Повторите пароль</label>
          <input
            id="reset-repeat"
            name="repeat"
            type="password"
            autoComplete="new-password"
            value={repeat}
            onChange={(event) => {
              setRepeat(event.target.value)
              setErrors((current) => ({ ...current, repeat: undefined }))
            }}
            aria-invalid={errors.repeat ? true : undefined}
            aria-describedby={errors.repeat ? 'reset-repeat-error' : undefined}
          />
          {errors.repeat && (
            <p className="field__error" id="reset-repeat-error">
              {errors.repeat}
            </p>
          )}
        </div>

        {formError && (
          <p className="alert" role="alert">
            {formError}
          </p>
        )}

        <div className="actions">
          <button className="btn btn--primary" type="submit" disabled={busy}>
            {busy ? 'Сохранение…' : mobile ? 'Сохранить' : 'Сохранить пароль'}
          </button>
        </div>
      </form>
    </AuthLayout>
  )
}
