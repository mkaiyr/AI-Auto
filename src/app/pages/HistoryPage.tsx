import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDownUp } from 'lucide-react'
import { Link } from '../../router'
import { useIsMobile } from '../../useIsMobile'
import { useCar } from '../car/useCar'
import { errorText } from '../dataErrors'
import { formatDay, formatMoney, formatNumber, plural } from '../format'
import { CATEGORY_LABELS, type ServiceRecord } from '../service/serviceStore'
import { useServiceRecords } from '../service/useServiceRecords'
import { PageError, PageLoading } from './PageState'
import { ServiceForm } from './ServiceForm'
import './history.css'

type Mode = { type: 'list' } | { type: 'form'; record: ServiceRecord | null }
type Order = 'desc' | 'asc'

const Eyebrow = () => (
  <p className="page__eyebrow">
    <b>03</b>История обслуживания
  </p>
)

export function HistoryPage() {
  const { status: carStatus, car, error: carError, reload: reloadCar } = useCar()
  const { status, records, error, create, update, remove, reload } = useServiceRecords(car?.id ?? null)
  const [mode, setMode] = useState<Mode>({ type: 'list' })
  const [order, setOrder] = useState<Order>('desc')
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const deleteLock = useRef(false)
  const [targetId, setTargetId] = useState<string | null>(null)
  const mobile = useIsMobile()

  // переход из раздела «Расходы» по адресу /app/history#record-<id>:
  // прокручиваем к записи и отмечаем её. Метка из адреса убирается, чтобы не срабатывать повторно
  useEffect(() => {
    if (status !== 'ready' || !window.location.hash.startsWith('#record-')) return
    const id = window.location.hash.slice('#record-'.length)
    const element = document.getElementById(`record-${id}`)
    if (!element) return
    setTargetId(id)
    element.scrollIntoView({ block: 'start' })
    window.history.replaceState(null, '', window.location.pathname)
  }, [status, records.length])

  // по дате; записи одного дня — по пробегу, затем по времени создания
  const sorted = useMemo(() => {
    const direction = order === 'desc' ? -1 : 1
    return [...records].sort(
      (a, b) =>
        direction * (a.date.localeCompare(b.date) || a.mileage - b.mileage || a.createdAt.localeCompare(b.createdAt)),
    )
  }, [records, order])

  if (carStatus === 'loading' || (car && status === 'loading')) return <PageLoading eyebrow={<Eyebrow />} />
  // сбой связи показывается отдельно от «записей нет», чтобы не выглядеть как потеря данных
  if (carStatus === 'error') return <PageError eyebrow={<Eyebrow />} message={carError ?? 'Не удалось загрузить автомобиль.'} onRetry={reloadCar} />
  if (status === 'error') return <PageError eyebrow={<Eyebrow />} message={error ?? 'Не удалось загрузить историю обслуживания.'} onRetry={reload} />

  if (!car) {
    return (
      <div className="page">
        <Eyebrow />
        <h1 className="page__title">Сначала добавьте автомобиль</h1>
        {mobile ? (
          <p className="page__lead">Записи привязаны к машине.</p>
        ) : (
          <p className="page__lead">
            Записи об обслуживании привязаны к конкретной машине. Создайте профиль автомобиля — и сможете вести его
            историю.
          </p>
        )}
        <div className="actions">
          <Link className="btn btn--primary" to="/app/car">
            Добавить автомобиль
          </Link>
        </div>
      </div>
    )
  }

  if (mode.type === 'form') {
    const { record } = mode
    return (
      <div className="page">
        <Eyebrow />
        <h1 className="page__title">{record ? 'Изменить запись' : 'Новая запись'}</h1>
        <ServiceForm
          initial={record}
          onSubmit={async (input) => {
            if (record) await update(record.id, input)
            else await create(input)
            setMode({ type: 'list' })
          }}
          onCancel={() => setMode({ type: 'list' })}
        />
      </div>
    )
  }

  const handleDelete = async (id: string) => {
    // замок ставится сразу: повторное нажатие может прийти раньше, чем кнопка перерисуется заблокированной
    if (deleteLock.current) return
    deleteLock.current = true
    setDeletingId(id)
    setDeleteError(null)
    try {
      await remove(id)
      setConfirmId(null)
    } catch (cause) {
      setDeleteError(errorText(cause, 'Не удалось удалить запись. Попробуйте ещё раз.'))
    } finally {
      deleteLock.current = false
      setDeletingId(null)
    }
  }

  const carName = `${car.make} ${car.model}, ${car.year}`

  if (records.length === 0) {
    return (
      <div className="page">
        <Eyebrow />
        <h1 className="page__title">Записей пока нет</h1>
        {mobile ? (
          <p className="page__lead">Добавляйте работы с датой, пробегом и стоимостью.</p>
        ) : (
          <p className="page__lead">
            Добавляйте замены масла, ремонты и покупку запчастей — с датой, пробегом и стоимостью. История ведётся
            для автомобиля {carName}.
          </p>
        )}
        <div className="actions">
          <button className="btn btn--primary" type="button" onClick={() => setMode({ type: 'form', record: null })}>
            Добавить запись
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <Eyebrow />
      <h1 className="page__title">{mobile ? 'История' : 'История обслуживания'}</h1>
      <p className="note">
        {carName}
        {!mobile && ' · хранится в вашем аккаунте'}
      </p>

      <div className="history__bar">
        <button className="btn btn--primary" type="button" onClick={() => setMode({ type: 'form', record: null })}>
          Добавить запись
        </button>
        <div className="history__meta">
          <span>
            {records.length} {plural(records.length, ['запись', 'записи', 'записей'])}
          </span>
          <button
            className="history__sort"
            type="button"
            onClick={() => setOrder(order === 'desc' ? 'asc' : 'desc')}
            aria-label={`Сортировка по дате: ${order === 'desc' ? 'сначала новые' : 'сначала старые'}. Изменить порядок`}
          >
            <ArrowDownUp size={14} strokeWidth={1.5} aria-hidden="true" />
            {order === 'desc' ? 'Сначала новые' : 'Сначала старые'}
          </button>
        </div>
      </div>

      <ol className="records">
        {sorted.map((record) => (
          <li
            className={record.id === targetId ? 'record record--target' : 'record'}
            id={`record-${record.id}`}
            key={record.id}
          >
            <div className="record__head">
              <time className="record__date" dateTime={record.date}>
                {formatDay(record.date)}
              </time>
              <span className="record__category">{CATEGORY_LABELS[record.category]}</span>
            </div>

            <div className="record__body">
              <h2 className="record__title">{record.title}</h2>
              {record.comment && <p className="record__comment">{record.comment}</p>}
            </div>

            <dl className="record__figures">
              <div>
                <dt>Стоимость</dt>
                <dd className="record__cost">{formatMoney(record.cost)}</dd>
              </div>
              <div>
                <dt>Пробег</dt>
                <dd>{formatNumber(record.mileage)} км</dd>
              </div>
            </dl>

            {confirmId === record.id ? (
              <div className="confirm record__confirm" role="alertdialog" aria-label="Подтверждение удаления">
                <p className="confirm__text">
                  Удалить запись «{record.title}»? Восстановить её не получится.
                </p>
                {deleteError && (
                  <p className="alert" role="alert">
                    {deleteError}
                  </p>
                )}
                <div className="actions">
                  <button className="btn btn--danger" type="button" onClick={() => handleDelete(record.id)} disabled={deletingId !== null}>
                    {deletingId === record.id ? 'Удаление…' : 'Да, удалить'}
                  </button>
                  <button className="btn" type="button" autoFocus onClick={() => setConfirmId(null)} disabled={deletingId !== null}>
                    Отмена
                  </button>
                </div>
              </div>
            ) : (
              <div className="record__actions">
                <button type="button" onClick={() => setMode({ type: 'form', record })}>
                  Изменить
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDeleteError(null)
                    setConfirmId(record.id)
                  }}
                >
                  Удалить
                </button>
              </div>
            )}
          </li>
        ))}
      </ol>
    </div>
  )
}
