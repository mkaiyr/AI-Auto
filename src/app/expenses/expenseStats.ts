// Расчёт расходов. Своих данных у раздела нет: всё считается по записям истории обслуживания.

import type { ServiceCategory, ServiceRecord } from '../service/serviceStore'

export type Period = 'month' | '3m' | 'year' | 'all'

export const PERIOD_LABELS: Record<Period, string> = {
  month: 'Месяц',
  '3m': '3 месяца',
  year: 'Год',
  all: 'Всё время',
}

/** Сдвигает день ГГГГ-ММ-ДД на несколько месяцев; 31-е число прижимается к концу короткого месяца */
export function shiftMonths(isoDay: string, months: number): string {
  const [year, month, day] = isoDay.split('-').map(Number)
  const first = new Date(year, month - 1 + months, 1)
  const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${first.getFullYear()}-${pad(first.getMonth() + 1)}-${pad(Math.min(day, daysInMonth))}`
}

/**
 * Первый день периода (включительно) или null для «всё время».
 * Месяц — текущий календарный; 3 месяца и год — отсчитываются назад от сегодняшнего дня.
 */
export function periodStart(period: Period, today: string): string | null {
  if (period === 'month') return `${today.slice(0, 7)}-01`
  if (period === '3m') return shiftMonths(today, -3)
  if (period === 'year') return shiftMonths(today, -12)
  return null
}

export function inPeriod(records: ServiceRecord[], period: Period, today: string): ServiceRecord[] {
  const start = periodStart(period, today)
  return start === null ? records : records.filter((record) => record.date >= start)
}

/** Сумма в тенге; округление убирает погрешность сложения дробных чисел */
export const sumCost = (records: ServiceRecord[]): number =>
  Math.round(records.reduce((total, record) => total + record.cost, 0) * 100) / 100

export interface CategoryTotal {
  category: ServiceCategory
  total: number
  count: number
  /** Доля от суммы периода, от 0 до 1 */
  share: number
}

/** Суммы по категориям, от большей к меньшей. Категории без затрат не показываются */
export function byCategory(records: ServiceRecord[]): CategoryTotal[] {
  const total = sumCost(records)
  const groups = new Map<ServiceCategory, ServiceRecord[]>()
  for (const record of records) groups.set(record.category, [...(groups.get(record.category) ?? []), record])

  return [...groups.entries()]
    .map(([category, items]) => {
      const sum = sumCost(items)
      return { category, total: sum, count: items.length, share: total > 0 ? sum / total : 0 }
    })
    .filter((group) => group.total > 0)
    .sort((a, b) => b.total - a.total)
}
