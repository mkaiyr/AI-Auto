import { useMemo, useState } from 'react'
import { ArrowUpRight } from 'lucide-react'
import { Link } from '../../router'
import { useCar } from '../car/useCar'
import { byCategory, inPeriod, PERIOD_LABELS, periodStart, sumCost, type Period } from '../expenses/expenseStats'
import { formatDay, formatMoney, plural, todayISO } from '../format'
import { CATEGORY_LABELS } from '../service/serviceStore'
import { useServiceRecords } from '../service/useServiceRecords'
import { PageError, PageLoading } from './PageState'
import './expenses.css'

const Eyebrow = () => (
  <p className="page__eyebrow">
    <b>04</b>Расходы
  </p>
)

const monthName = (isoDay: string) => {
  const [year, month] = isoDay.split('-').map(Number)
  return new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric' }).format(new Date(year, month - 1, 1))
}

export function ExpensesPage() {
  const { status: carStatus, car, error: carError, reload: reloadCar } = useCar()
  const { status, records, error, reload } = useServiceRecords(car?.id ?? null)
  const [period, setPeriod] = useState<Period>('all')
  const today = todayISO()

  const selected = useMemo(
    () => [...inPeriod(records, period, today)].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)),
    [records, period, today],
  )
  const categories = useMemo(() => byCategory(selected), [selected])

  if (carStatus === 'loading' || (car && status === 'loading')) return <PageLoading eyebrow={<Eyebrow />} />
  // сбой связи показывается отдельно от «записей нет», чтобы не выглядеть как потеря данных
  if (carStatus === 'error') return <PageError eyebrow={<Eyebrow />} message={carError ?? 'Не удалось загрузить автомобиль.'} onRetry={reloadCar} />
  if (status === 'error') return <PageError eyebrow={<Eyebrow />} message={error ?? 'Не удалось загрузить историю обслуживания.'} onRetry={reload} />

  if (!car) {
    return (
      <div className="page">
        <Eyebrow />
        <h1 className="page__title">Сначала добавьте автомобиль</h1>
        <p className="page__lead">
          Расходы считаются по записям истории обслуживания, а история ведётся для конкретной машины.
        </p>
        <div className="actions">
          <Link className="btn btn--primary" to="/app/car">
            Добавить автомобиль
          </Link>
        </div>
      </div>
    )
  }

  if (records.length === 0) {
    return (
      <div className="page">
        <Eyebrow />
        <h1 className="page__title">Расходов пока нет</h1>
        <p className="page__lead">
          Суммы считаются автоматически по записям истории обслуживания. Добавьте первую запись со стоимостью — и
          она появится здесь.
        </p>
        <div className="actions">
          <Link className="btn btn--primary" to="/app/history">
            Перейти к истории обслуживания
          </Link>
        </div>
      </div>
    )
  }

  const start = periodStart(period, today)
  const periodTotal = sumCost(selected)

  return (
    <div className="page">
      <Eyebrow />
      <h1 className="page__title">Расходы</h1>
      <p className="note">
        {car.make} {car.model}, {car.year} · считается по истории обслуживания
      </p>

      <dl className="totals">
        <div className="total">
          <dt>За всё время</dt>
          <dd>{formatMoney(sumCost(records))}</dd>
        </div>
        <div className="total">
          <dt>За {monthName(today)}</dt>
          <dd>{formatMoney(sumCost(inPeriod(records, 'month', today)))}</dd>
        </div>
      </dl>

      <div className="periods" role="group" aria-label="Период">
        {(Object.keys(PERIOD_LABELS) as Period[]).map((key) => (
          <button key={key} type="button" aria-pressed={period === key} onClick={() => setPeriod(key)}>
            {PERIOD_LABELS[key]}
          </button>
        ))}
      </div>

      <p className="period-summary">
        <span>{start ? `С ${formatDay(start)} по сегодня` : 'За всё время'}</span>
        <span>
          {selected.length} {plural(selected.length, ['запись', 'записи', 'записей'])} · <b>{formatMoney(periodTotal)}</b>
        </span>
      </p>

      {selected.length === 0 ? (
        <p className="page__lead">За этот период расходов нет. Выберите другой период.</p>
      ) : (
        <>
          {categories.length > 0 && (
            <section aria-labelledby="expenses-categories">
              <h2 className="subhead" id="expenses-categories">
                По категориям
              </h2>
              <ul className="cats">
                {categories.map(({ category, total, count, share }) => (
                  <li className="cat" key={category}>
                    <span className="cat__name">{CATEGORY_LABELS[category]}</span>
                    <span className="cat__count">
                      {count} {plural(count, ['запись', 'записи', 'записей'])}
                    </span>
                    <span className="cat__total">{formatMoney(total)}</span>
                    <span className="cat__share">{Math.round(share * 100)}%</span>
                    <span className="cat__bar" aria-hidden="true">
                      <i style={{ width: `${Math.max(share * 100, 1)}%` }} />
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section aria-labelledby="expenses-records">
            <h2 className="subhead" id="expenses-records">
              Записи
            </h2>
            <ol className="expense-list">
              {selected.map((record) => (
                <li key={record.id}>
                  <Link
                    className="expense"
                    to={`/app/history#record-${record.id}`}
                    aria-label={`${record.title}, ${formatMoney(record.cost)} — открыть в истории обслуживания`}
                  >
                    <time className="expense__date" dateTime={record.date}>
                      {formatDay(record.date)}
                    </time>
                    <span className="expense__title">{record.title}</span>
                    <span className="expense__category">{CATEGORY_LABELS[record.category]}</span>
                    <span className="expense__cost">{formatMoney(record.cost)}</span>
                    <ArrowUpRight className="expense__arrow" size={16} strokeWidth={1.5} aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ol>
          </section>
        </>
      )}
    </div>
  )
}
