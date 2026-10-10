import type { AppFunction } from '../../data/content'
import { Link } from '../../router'
import { useIsMobile } from '../../useIsMobile'
import { useCar } from '../car/useCar'

/** Экран раздела, который ещё не реализован: честно говорит об этом и ничего не имитирует */
export function SoonPage({ section, index }: { section: AppFunction; index: number }) {
  const { status, car } = useCar()
  const mobile = useIsMobile()

  return (
    <div className="page">
      <p className="page__eyebrow">
        <b>0{index + 1}</b>
        {section.title}
      </p>
      <h1 className="page__title">{section.title}</h1>
      <p className="page__lead only-desktop">{section.text}</p>
      <p className="page__lead only-mobile">{section.brief}</p>

      <div className="status">
        <p className="status__label">В разработке</p>
        <p className="status__text">
          {mobile ? 'Раздел пока не работает.' : 'Раздел пока не работает: здесь нельзя ввести или сохранить данные.'}
          {section.id === 'diagnostics' && ' ИИ к приложению ещё не подключён.'}
        </p>
        {/* на телефоне пояснение о будущей работе раздела не показывается */}
        {status === 'ready' && !mobile && (
          <p className="status__text">
            {car
              ? `Когда раздел появится, он будет опираться на ваш профиль: ${car.make} ${car.model}, ${car.year}.`
              : 'Раздел будет опираться на профиль автомобиля — его можно добавить уже сейчас.'}
          </p>
        )}
      </div>

      <div className="actions">
        <Link className="btn" to="/app/car">
          {car ? (mobile ? 'Мой автомобиль' : 'Открыть профиль автомобиля') : 'Добавить автомобиль'}
        </Link>
      </div>
    </div>
  )
}
