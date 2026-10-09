import { useState } from 'react'
import { ENGINE_LABELS } from '../car/carStore'
import { useCar } from '../car/useCar'
import { plural } from '../format'
import { useServiceRecords } from '../service/useServiceRecords'
import { CarForm } from './CarForm'

type Mode = 'view' | 'form' | 'confirm-delete'

const formatNumber = (value: number) => new Intl.NumberFormat('ru-RU').format(value)
const formatDate = (iso: string) =>
  new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso))

export function CarPage() {
  const { status, car, error, save, remove } = useCar()
  const { records } = useServiceRecords(car?.id ?? null)
  const [mode, setMode] = useState<Mode>('view')
  const [deleteError, setDeleteError] = useState<string | null>(null)

  if (status === 'loading') {
    return (
      <div className="page">
        <p className="page__eyebrow">
          <b>01</b>Мой автомобиль
        </p>
      </div>
    )
  }

  if (mode === 'form') {
    return (
      <div className="page">
        <p className="page__eyebrow">
          <b>01</b>Мой автомобиль
        </p>
        <h1 className="page__title">{car ? 'Изменить данные' : 'Новый автомобиль'}</h1>
        <CarForm
          initial={car}
          onSubmit={async (input) => {
            await save(input)
            setMode('view')
          }}
          onCancel={() => setMode('view')}
        />
      </div>
    )
  }

  if (!car) {
    return (
      <div className="page">
        <p className="page__eyebrow">
          <b>01</b>Мой автомобиль
        </p>
        <h1 className="page__title">Автомобиль ещё не добавлен</h1>
        <p className="page__lead">
          Укажите марку, модель, год и пробег. На этот профиль будут опираться остальные разделы: диагностика,
          история обслуживания, расходы и напоминания.
        </p>
        {error && (
          <p className="alert" role="alert">
            {error}
          </p>
        )}
        <div className="actions">
          <button className="btn btn--primary" type="button" onClick={() => setMode('form')}>
            Добавить автомобиль
          </button>
        </div>
      </div>
    )
  }

  const handleDelete = async () => {
    try {
      await remove()
      setDeleteError(null)
      setMode('view')
    } catch {
      setDeleteError('Не удалось удалить данные: хранилище браузера недоступно.')
    }
  }

  return (
    <div className="page">
      <p className="page__eyebrow">
        <b>01</b>Мой автомобиль
      </p>
      <h1 className="page__title">
        {car.make} {car.model}
      </h1>

      <dl className="specs">
        <div className="spec">
          <dt>Год выпуска</dt>
          <dd>{car.year}</dd>
        </div>
        <div className="spec">
          <dt>Пробег</dt>
          <dd>
            {formatNumber(car.mileage)} <small>км</small>
          </dd>
        </div>
        <div className="spec">
          <dt>Двигатель</dt>
          <dd className={car.engine ? undefined : 'spec__empty'}>{car.engine ? ENGINE_LABELS[car.engine] : 'Не указан'}</dd>
        </div>
        {car.fuel && (
          <div className="spec">
            <dt>Топливо</dt>
            <dd>{car.fuel}</dd>
          </div>
        )}
      </dl>

      <p className="note">Сохранено {formatDate(car.updatedAt)} · только в этом браузере</p>

      {mode === 'confirm-delete' ? (
        <div className="confirm" role="alertdialog" aria-labelledby="confirm-title" aria-describedby="confirm-text">
          <p className="confirm__title" id="confirm-title">
            Удалить автомобиль?
          </p>
          <p className="confirm__text" id="confirm-text">
            Профиль «{car.make} {car.model}» будет стёрт из этого браузера
            {records.length > 0 &&
              ` вместе с историей обслуживания (${records.length} ${plural(records.length, ['запись', 'записи', 'записей'])})`}
            . Восстановить данные не получится.
          </p>
          {deleteError && (
            <p className="alert" role="alert">
              {deleteError}
            </p>
          )}
          <div className="actions">
            <button className="btn btn--danger" type="button" onClick={handleDelete}>
              Да, удалить
            </button>
            <button className="btn" type="button" autoFocus onClick={() => setMode('view')}>
              Отмена
            </button>
          </div>
        </div>
      ) : (
        <div className="actions">
          <button className="btn btn--primary" type="button" onClick={() => setMode('form')}>
            Редактировать
          </button>
          <button className="btn" type="button" onClick={() => setMode('confirm-delete')}>
            Удалить
          </button>
        </div>
      )}
    </div>
  )
}
