import { useRef, useState } from 'react'
import { useIsMobile } from '../../useIsMobile'
import { BODY_LABELS, ENGINE_LABELS } from '../car/carStore'
import { CarVisual } from '../car/CarVisual'
import { generationTitle, pickIllustration } from '../car/catalog/generations'
import { useGenerations } from '../car/catalog/useGenerations'
import { useCar } from '../car/useCar'
import { useCarPhoto } from '../car/useCarPhoto'
import { errorText } from '../dataErrors'
import { formatNumber, plural } from '../format'
import { useServiceRecords } from '../service/useServiceRecords'
import { CarForm } from './CarForm'
import { ImportOffer } from './ImportOffer'
import { PageError, PageLoading } from './PageState'

type Mode = 'view' | 'form' | 'confirm-delete'

const formatDate = (iso: string) =>
  new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso))

const Eyebrow = () => (
  <p className="page__eyebrow">
    <b>01</b>Мой автомобиль
  </p>
)

export function CarPage() {
  const { status, car, error, save, remove, reload } = useCar()
  const { photo, checked: photoChecked, save: savePhoto, remove: removePhoto } = useCarPhoto(car?.id ?? null)
  // Справочник нужен только для иллюстрации, поэтому запрашивается, когда уже известно, что своего фото нет
  const generations = useGenerations(car && photoChecked && !photo ? car.make : '')
  const { records } = useServiceRecords(car?.id ?? null)
  const [mode, setMode] = useState<Mode>('view')
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const deleteLock = useRef(false)
  const mobile = useIsMobile()

  const illustration = car ? pickIllustration(generations?.[car.model] ?? null, car.generation, car.year) : null

  if (status === 'loading') return <PageLoading eyebrow={<Eyebrow />} />
  if (status === 'error') return <PageError eyebrow={<Eyebrow />} message={error ?? 'Не удалось загрузить автомобиль.'} onRetry={reload} />

  if (mode === 'form') {
    return (
      <div className="page">
        <Eyebrow />
        <h1 className="page__title">{car ? 'Изменить данные' : 'Новый автомобиль'}</h1>
        <CarForm
          initial={car}
          initialPhoto={photo}
          onSubmit={async (input, change) => {
            // сначала профиль, затем фото отдельным шагом: сбой загрузки фото
            // не отменяет сохранённые данные автомобиля и не трогает прежнюю фотографию
            const saved = await save(input)
            setPhotoError(null)
            try {
              if (change.type === 'set') await savePhoto(saved.id, change.dataUrl)
              else if (change.type === 'remove') await removePhoto(saved.id)
            } catch (cause) {
              setPhotoError(`Данные автомобиля сохранены, но с фотографией возникла ошибка. ${errorText(cause, 'Попробуйте ещё раз.')}`)
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
        <h1 className="page__title">{mobile ? 'Автомобиля пока нет' : 'Автомобиль ещё не добавлен'}</h1>
        {mobile ? (
          <p className="page__lead">На его данных работают остальные разделы.</p>
        ) : (
          <p className="page__lead">
            Укажите марку, модель, год и пробег, добавьте фото или выберите тип кузова. На этот профиль опираются
            остальные разделы: история обслуживания, расходы, ИИ-помощник, а позже — напоминания.
          </p>
        )}
        <div className="actions">
          <button className="btn btn--primary" type="button" onClick={() => setMode('form')}>
            {mobile ? 'Добавить' : 'Добавить автомобиль'}
          </button>
        </div>
        <ImportOffer onImported={reload} />
      </div>
    )
  }

  const handleDelete = async () => {
    // замок ставится сразу: повторное нажатие может прийти раньше, чем кнопка перерисуется заблокированной
    if (deleteLock.current) return
    deleteLock.current = true
    setDeleting(true)
    setDeleteError(null)
    try {
      await remove()
      setPhotoError(null)
      setMode('view')
    } catch (cause) {
      setDeleteError(errorText(cause, 'Не удалось удалить автомобиль. Попробуйте ещё раз.'))
    } finally {
      deleteLock.current = false
      setDeleting(false)
    }
  }

  // что ещё будет удалено вместе с профилем
  const attached = [
    photo && 'фотографией',
    records.length > 0 &&
      `историей обслуживания (${records.length} ${plural(records.length, ['запись', 'записи', 'записей'])})`,
  ].filter(Boolean)

  return (
    <div className="page">
      <Eyebrow />
      <CarVisual
        photo={photo}
        body={car.body}
        alt={`${car.make} ${car.model}`}
        illustration={illustration}
        title={[car.make, car.model, illustration?.exact && car.generation && generationTitle(car.generation)].filter(Boolean).join(' ')}
      />

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
        {car.generation && (
          <div className="spec">
            <dt>Поколение</dt>
            <dd>{generationTitle(car.generation)}</dd>
          </div>
        )}
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

      <p className="note">
        Сохранено {formatDate(car.updatedAt)}
        {!mobile && ' · в вашем аккаунте'}
      </p>

      {mode === 'confirm-delete' ? (
        <div className="confirm" role="alertdialog" aria-labelledby="confirm-title" aria-describedby="confirm-text">
          <p className="confirm__title" id="confirm-title">
            Удалить автомобиль?
          </p>
          <p className="confirm__text" id="confirm-text">
            Профиль «{car.make} {car.model}» будет удалён из вашего аккаунта
            {attached.length > 0 && ` вместе с ${attached.join(' и ')}`}. Восстановить данные не получится.
          </p>
          {deleteError && (
            <p className="alert" role="alert">
              {deleteError}
            </p>
          )}
          <div className="actions">
            <button className="btn btn--danger" type="button" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Удаление…' : 'Да, удалить'}
            </button>
            <button className="btn" type="button" autoFocus onClick={() => setMode('view')} disabled={deleting}>
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
