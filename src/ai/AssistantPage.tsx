import { useEffect } from 'react'
import { Link } from '../router'
import { AssistantChat } from './AssistantChat'
import '../app/pages/pages.css'

/** Публичная страница ИИ-помощника: доступна без входа, об автомобиле посетителя ничего не знает */
export function AssistantPage() {
  useEffect(() => {
    document.title = 'ИИ-помощник — AI Auto'
  }, [])

  return (
    <div className="ai-public">
      <header className="ai-public__top">
        <Link className="ai-public__logo" to="/" aria-label="AI Auto — на главную">
          AI Auto
        </Link>
        <nav className="ai-public__links" aria-label="Навигация">
          <Link to="/">На сайт</Link>
          <Link to="/app/car">Личный кабинет</Link>
        </nav>
      </header>
      <main className="ai-public__main">
        <div className="page">
          <p className="page__eyebrow">ИИ-помощник</p>
          <h1 className="page__title">Спросите об автомобиле</h1>
          <p className="page__lead">
            Обслуживание, эксплуатация, типичные неисправности и работа с AI Auto. Бесплатно, без регистрации, прямо в браузере.
          </p>
          <AssistantChat />
        </div>
      </main>
    </div>
  )
}
