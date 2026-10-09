import { useMemo, useState } from 'react'
import { ArrowDownUp } from 'lucide-react'
import { Link } from '../../router'
import { useCar } from '../car/useCar'
import { formatDay, formatNumber, plural } from '../format'
import { CATEGORY_LABELS, type ServiceRecord } from '../service/serviceStore'
import { useServiceRecords } from '../service/useServiceRecords'
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
  const { status: carStatus, car } = useCar()
  const { status, records, error, create, update, remove } = useServiceRecords(car?.id ?? null)
  const [mode, setMode] = useState<Mode>({ type: 'list' })
  const [order, setOrder] = useState<Order>('desc')
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  // по дате; записи одного дня — по пробегу, затем по времени создания
  const sorted = useMemo(() => {
    const direction = order === 'desc' ? -1 : 1
    return [...records].sort(
      (a, b) =>
        direction * (a.date.localeCompare(b.date) || a.mileage - b.mileage || a.createdAt.localeCompare(b.createdAt)),
    )
  }, [records, order])

  if (carStatus === 'loading' || (car && status === 'loading')) {
    return (
      <div className="page">
        <Eyebrow />
      </div>
    )
  }

  if (!car) {
    return (
      <div className="page">
        <Eyebrow />
        <h1 className="page__title">Сначала добавьте автомобиль</h1>
        <p className="page__lead">
          Записи об обслуживании привязаны к конкретной машине. Создайте профиль автомобиля — и сможете вести его
          историю.
        </p>
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
    try {
      await remove(id)
      setConfirmId(null)
      setDeleteError(null)
    } catch {
      setDeleteError('Не удалось удалить запись: хранилище браузера недоступно.')
    }
  }

  const carName = `${car.make} ${car.model}, ${car.year}`

  if (records.length === 0) {
    return (
      <div className="page">
        <Eyebrow />
        <h1 className="page__title">Записей пока нет</h1>
        <p className="page__lead">
          Добавляйте замены масла, ремонты и покупку запчастей — с датой, пробегом и стоимостью. История ведётся
          для автомобиля {carName}.
        </p>
        {error && (
          <p className="alert" role="alert">
            {error}
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
      <h1 className="page__title">История обслуживания</h1>
      <p className="note">{carName} · хранится только в этом браузере</p>

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
          <li className="record" key={record.id}>
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
                <dd className="record__cost">{formatNumber(record.cost)} ₸</dd>
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
                  <button className="btn btn--danger" type="button" onClick={() => handleDelete(record.id)}>
                    Да, удалить
                  </button>
                  <button className="btn" type="button" autoFocus onClick={() => setConfirmId(null)}>
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
