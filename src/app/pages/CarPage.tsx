import { useState } from 'react'
import { BODY_LABELS, ENGINE_LABELS } from '../car/carStore'
import { CarVisual } from '../car/CarVisual'
import { useCar } from '../car/useCar'
import { useCarPhoto } from '../car/useCarPhoto'
import { formatNumber, plural } from '../format'
import { useServiceRecords } from '../service/useServiceRecords'
import { CarForm } from './CarForm'

type Mode = 'view' | 'form' | 'confirm-delete'

const formatDate = (iso: string) =>
  new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso))

const Eyebrow = () => (
  <p className="page__eyebrow">
    <b>01</b>Мой автомобиль
  </p>
)

export function CarPage() {
  const { status, car, error, save, remove } = useCar()
  const { photo, save: savePhoto, remove: removePhoto } = useCarPhoto(car?.id ?? null)
  const { records } = useServiceRecords(car?.id ?? null)
  const [mode, setMode] = useState<Mode>('view')
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  if (status === 'loading') {
    return (
      <div className="page">
        <Eyebrow />
      </div>
    )
  }

  if (mode === 'form') {
    return (
      <div className="page">
        <Eyebrow />
        <h1 className="page__title">{car ? 'Изменить данные' : 'Новый автомобиль'}</h1>
        <CarForm
          initial={car}
          initialPhoto={photo}
          onSubmit={async (input, change) => {
            // сначала профиль: он маленький и сохраняется надёжно. Фото — отдельным шагом,
            // его сбой не затрагивает ни профиль, ни прежнюю фотографию
            const saved = await save(input)
            setPhotoError(null)
            try {
              if (change.type === 'set') await savePhoto(saved.id, change.dataUrl)
              else if (change.type === 'remove') await removePhoto(saved.id)
            } catch {
              setPhotoError(
                'Данные автомобиля сохранены, но фотографию сохранить не удалось: в хранилище браузера не хватает места. Попробуйте другое изображение.',
              )
            }
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
        <Eyebrow />
        <h1 className="page__title">Автомобиль ещё не добавлен</h1>
        <p className="page__lead">
          Укажите марку, модель, год и пробег, добавьте фото или выберите тип кузова. На этот профиль опираются
          остальные разделы: история обслуживания, расходы, а позже — диагностика и напоминания.
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
      setPhotoError(null)
      setMode('view')
    } catch {
      setDeleteError('Не удалось удалить данные: хранилище браузера недоступно.')
    }
  }

  return (
    <div className="page">
      <Eyebrow />
      <CarVisual photo={photo} body={car.body} alt={`${car.make} ${car.model}`} />

      {photoError && (
        <p className="alert" role="alert">
          {photoError}
        </p>
      )}

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
          <dt>Кузов</dt>
          <dd className={car.body ? undefined : 'spec__empty'}>{car.body ? BODY_LABELS[car.body] : 'Не указан'}</dd>
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
            Профиль «{car.make} {car.model}»{photo && ', его фотография'} будет стёрт из этого браузера
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
