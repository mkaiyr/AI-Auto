import type { ReactNode } from 'react'

/** Раздел ждёт ответа сервера */
export function PageLoading({ eyebrow }: { eyebrow: ReactNode }) {
  return (
    <div className="page">
      {eyebrow}
      <p className="note" role="status">
        Загрузка…
      </p>
      {/* на телефоне вместо пустого экрана — очертания будущих карточек */}
      <div className="skeleton only-mobile" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
    </div>
  )
}

/**
 * Данные не удалось получить. Показывается вместо пустого состояния, чтобы сбой связи
 * не выглядел как «автомобиль не добавлен» и не подталкивал создавать дубликат.
 */
export function PageError({ eyebrow, message, onRetry }: { eyebrow: ReactNode; message: string; onRetry: () => void }) {
  return (
    <div className="page">
      {eyebrow}
      <h1 className="page__title">Не удалось загрузить данные</h1>
      <p className="alert" role="alert">
        {message}
      </p>
      <div className="actions">
        <button className="btn btn--primary" type="button" onClick={onRetry}>
          Повторить
        </button>
      </div>
    </div>
  )
}
