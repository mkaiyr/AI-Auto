import type { AppFunction } from '../../data/content'
import { Link } from '../../router'
import { useCar } from '../car/useCar'

/** Экран раздела, который ещё не реализован: честно говорит об этом и ничего не имитирует */
export function SoonPage({ section, index }: { section: AppFunction; index: number }) {
  const { status, car } = useCar()

  return (
    <div className="page">
      <p className="page__eyebrow">
        <b>0{index + 1}</b>
        {section.title}
      </p>
      <h1 className="page__title">{section.title}</h1>
      <p className="page__lead">{section.text}</p>

      <div className="status">
        <p className="status__label">В разработке</p>
        <p className="status__text">
          Раздел пока не работает: здесь нельзя ввести или сохранить данные.
          {section.id === 'diagnostics' && ' ИИ к приложению ещё не подключён.'}
        </p>
        {status === 'ready' && (
          <p className="status__text">
            {car
              ? `Когда раздел появится, он будет опираться на ваш профиль: ${car.make} ${car.model}, ${car.year}.`
              : 'Раздел будет опираться на профиль автомобиля — его можно добавить уже сейчас.'}
          </p>
        )}
      </div>

      <div className="actions">
        <Link className="btn" to="/app/car">
          {car ? 'Открыть профиль автомобиля' : 'Добавить автомобиль'}
        </Link>
      </div>
    </div>
  )
}
