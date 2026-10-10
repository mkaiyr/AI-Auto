import { useEffect } from 'react'
import { AppShell } from './app/AppShell'
import { AuthLoading, AuthPage, AuthUnavailable } from './auth/AuthPage'
import { useAuth } from './auth/AuthProvider'
import { Header } from './components/Header'
import { Hero } from './components/Hero'
import { Features } from './components/Features'
import { FunctionCards } from './components/FunctionCards'
import { Footer } from './components/Footer'
import { navigate, usePath } from './router'

const LANDING_TITLE = 'AI Auto — всё о вашем автомобиле'
const LOGIN_PATH = '/login'
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
  const { state } = useAuth()
  const isApp = path === '/app' || path.startsWith('/app/')
  const isLogin = path === LOGIN_PATH

  useEffect(() => {
    if (!isApp && !isLogin) document.title = LANDING_TITLE
    if (isLogin) document.title = 'Вход — AI Auto'
  }, [isApp, isLogin])

  // Защита кабинета: без сессии — на страницу входа; со входа после авторизации — обратно в кабинет
  useEffect(() => {
    if (state.status === 'signedOut' && isApp) {
      rememberReturnPath(path)
      navigate(LOGIN_PATH, { replace: true })
    } else if (state.status === 'signedIn' && isLogin) {
      navigate(takeReturnPath(), { replace: true })
    }
  }, [state.status, isApp, isLogin, path])

  if (isApp || isLogin) {
    if (state.status === 'loading') return <AuthLoading />
    if (state.status === 'unconfigured') return <AuthUnavailable message={state.message} />
    // приватные страницы рендерятся только при подтверждённой сессии;
    // в остальных случаях показывается экран загрузки на время перехода
    if (isApp) return state.status === 'signedIn' ? <AppShell path={path} /> : <AuthLoading />
    return state.status === 'signedOut' ? <AuthPage /> : <AuthLoading />
  }

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
