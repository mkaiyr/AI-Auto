import { useEffect } from 'react'
import { AppShell } from './app/AppShell'
import { AuthLoading, AuthOffline, AuthPage, AuthUnavailable } from './auth/AuthPage'
import { useAuth } from './auth/AuthProvider'
import { ResetPasswordPage } from './auth/ResetPasswordPage'
import { Header } from './components/Header'
import { Hero } from './components/Hero'
import { Features } from './components/Features'
import { FunctionCards } from './components/FunctionCards'
import { Footer } from './components/Footer'
import { NotFoundPage } from './NotFoundPage'
import { navigate, usePath } from './router'

const LANDING_TITLE = 'AI Auto — всё о вашем автомобиле'
const LOGIN_PATH = '/login'
const RESET_PATH = '/reset-password'
const DEFAULT_APP_PATH = '/app/car'
const RETURN_KEY = 'ai-auto:return-to'

/** Страница кабинета, на которую пользователь шёл до входа */
function takeReturnPath(): string {
  try {
    const saved = window.sessionStorage.getItem(RETURN_KEY)
    window.sessionStorage.removeItem(RETURN_KEY)
    return saved && saved.startsWith('/app/') ? saved : DEFAULT_APP_PATH
  } catch {
    return DEFAULT_APP_PATH
  }
}

function rememberReturnPath(path: string) {
  try {
    window.sessionStorage.setItem(RETURN_KEY, path)
  } catch {
    // без sessionStorage после входа откроется раздел по умолчанию
  }
}

export default function App() {
  const path = usePath()
  const { state, passwordRecovery, retry } = useAuth()
  const isApp = path === '/app' || path.startsWith('/app/')
  const isLogin = path === LOGIN_PATH
  const isReset = path === RESET_PATH
  const isLanding = path === '/'

  useEffect(() => {
    if (isLanding) document.title = LANDING_TITLE
    if (isLogin) document.title = 'Вход — AI Auto'
    if (isReset) document.title = 'Новый пароль — AI Auto'
  }, [isLanding, isLogin, isReset])

  // Переходы между входом и кабинетом. Кабинет открывается только при сессии, подтверждённой сервером
  useEffect(() => {
    if (state.status === 'signedIn' && passwordRecovery && !isReset && (isApp || isLogin)) {
      // по ссылке восстановления сначала нужно задать новый пароль, куда бы она ни привела
      navigate(RESET_PATH, { replace: true })
    } else if (state.status === 'signedOut' && isApp) {
      rememberReturnPath(path)
      navigate(LOGIN_PATH, { replace: true })
    } else if (state.status === 'signedIn' && isLogin && !passwordRecovery) {
      navigate(takeReturnPath(), { replace: true })
    }
  }, [state.status, passwordRecovery, isApp, isLogin, isReset, path])

  if (isApp || isLogin || isReset) {
    if (state.status === 'loading') return <AuthLoading />
    if (state.status === 'unconfigured') return <AuthUnavailable message={state.message} />
    if (state.status === 'unreachable') return <AuthOffline message={state.message} onRetry={retry} />
    if (isReset) return <ResetPasswordPage />
    // Приватные страницы отрисовываются только при подтверждённой сессии; в остальных случаях — экран загрузки
    // на время перехода. key пересоздаёт кабинет при смене аккаунта: данные прежнего пользователя не остаются на экране.
    if (isApp) return state.status === 'signedIn' && !passwordRecovery ? <AppShell key={state.user.id} path={path} /> : <AuthLoading />
    return state.status === 'signedOut' ? <AuthPage /> : <AuthLoading />
  }

  if (!isLanding) return <NotFoundPage />

  return (
    <>
      <Header />
      <main>
        <Hero />
        <Features />
        <FunctionCards />
      </main>
      <Footer />
    </>
  )
}
