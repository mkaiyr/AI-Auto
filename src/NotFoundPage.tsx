import { useEffect } from 'react'
import { AuthLayout } from './auth/AuthPage'
import { Link } from './router'
import { useIsMobile } from './useIsMobile'

/** Адрес внутри сайта, которому не соответствует ни одна страница */
export function NotFoundPage() {
  const mobile = useIsMobile()
  useEffect(() => {
    document.title = 'Страница не найдена — AI Auto'
  }, [])

  return (
    <AuthLayout>
      <p className="page__eyebrow">Ошибка 404</p>
      <h1 className="page__title auth__title">Страница не найдена</h1>
      <p className="page__lead">
        {mobile ? 'Проверьте адрес ссылки.' : 'Такого адреса на сайте нет. Возможно, в ссылке опечатка или страница была перемещена.'}
      </p>
      <div className="actions">
        <Link className="btn btn--primary" to="/">
          На главную
        </Link>
        <Link className="btn" to="/app/car">
          {mobile ? 'Кабинет' : 'Личный кабинет'}
        </Link>
      </div>
    </AuthLayout>
  )
}
