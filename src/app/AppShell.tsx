import { useEffect, useRef, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { useAuth } from '../auth/AuthProvider'
import { appFunctions } from '../data/content'
import { Link, navigate } from '../router'
import { CarPage } from './pages/CarPage'
import { ExpensesPage } from './pages/ExpensesPage'
import { HistoryPage } from './pages/HistoryPage'
import { SoonPage } from './pages/SoonPage'
import './AppShell.css'
import './pages/pages.css'

const sectionPath = (id: string) => `/app/${id}`

/** Оболочка личного кабинета: навигация по пяти разделам и область страницы */
export function AppShell({ path }: { path: string }) {
  const index = appFunctions.findIndex((section) => sectionPath(section.id) === path)
  const section = appFunctions[index]
  const activeLink = useRef<HTMLAnchorElement>(null)
  const { state, signOut } = useAuth()
  const [signOutError, setSignOutError] = useState<string | null>(null)
  const email = state.status === 'signedIn' ? (state.user.email ?? '') : ''

  // после успешного выхода сессия исчезает, и приложение само открывает страницу входа
  const handleSignOut = async () => {
    setSignOutError(null)
    const result = await signOut()
    if (!result.ok) setSignOutError(result.message)
  }

  useEffect(() => {
    if (path === '/app') navigate(sectionPath(appFunctions[0].id), { replace: true })
  }, [path])

  useEffect(() => {
    document.title = `${section ? section.title : 'Страница не найдена'} — AI Auto`
    // на телефоне лента разделов прокручивается: активный пункт должен быть виден
    activeLink.current?.scrollIntoView({ block: 'nearest', inline: 'center' })
  }, [section])

  return (
    <div className="app">
      <aside className="app__rail">
        <div className="app__top">
          <Link className="app__logo" to="/" aria-label="AI Auto — на главную">
            AI Auto
          </Link>
          <div className="app__top-links">
            <Link className="app__back" to="/">
              <ArrowLeft size={14} strokeWidth={1.5} aria-hidden="true" />
              На сайт
            </Link>
            {/* на телефоне нижний блок аккаунта скрыт, поэтому выход продублирован в шапке */}
            <button className="app__back app__signout app__signout--top" type="button" onClick={handleSignOut}>
              Выйти
            </button>
          </div>
        </div>

        {signOutError && (
          <p className="app__signout-error" role="alert">
            {signOutError}
          </p>
        )}

        <nav aria-label="Разделы приложения">
          <ol className="app__nav">
            {appFunctions.map(({ id, short }, i) => {
              const active = i === index
              return (
                <li key={id}>
                  <Link
                    to={sectionPath(id)}
                    className="app__nav-link"
                    aria-current={active ? 'page' : undefined}
                    ref={active ? activeLink : undefined}
                  >
                    <b>0{i + 1}</b>
                    <span>{short}</span>
                  </Link>
                </li>
              )
            })}
          </ol>
        </nav>

        <div className="app__account">
          <span className="app__email" title={email}>
            {email}
          </span>
          <button className="app__back app__signout" type="button" onClick={handleSignOut}>
            Выйти
          </button>
        </div>

        <p className="app__storage">Данные хранятся в вашем аккаунте и доступны после входа с любого устройства.</p>
      </aside>

      <main className="app__main">
        {path === '/app' ? null : !section ? (
          <div className="page">
            <p className="page__eyebrow">Ошибка 404</p>
            <h1 className="page__title">Такой страницы нет</h1>
            <div className="actions">
              <Link className="btn btn--primary" to={sectionPath(appFunctions[0].id)}>
                Перейти к автомобилю
              </Link>
            </div>
          </div>
        ) : section.id === 'car' ? (
          <CarPage />
        ) : section.id === 'history' ? (
          <HistoryPage />
        ) : section.id === 'expenses' ? (
          <ExpensesPage />
        ) : (
          <SoonPage key={section.id} section={section} index={index} />
        )}
      </main>
    </div>
  )
}
