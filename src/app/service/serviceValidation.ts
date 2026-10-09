import { todayISO } from '../format'
import { CATEGORY_LABELS, type ServiceCategory, type ServiceInput } from './serviceStore'

/** Значения полей формы — строки, как их вводит пользователь */
export interface ServiceFormValues {
  title: string
  category: string
  date: string
  mileage: string
  cost: string
  comment: string
}

export type ServiceFormErrors = Partial<Record<keyof ServiceFormValues, string>>

const MAX_TITLE_LENGTH = 80
const MAX_COMMENT_LENGTH = 500
const MAX_MILEAGE = 9_999_999
const MAX_COST = 999_999_999
const MIN_YEAR = 1900

/** Проверяет, что строка — существующий календарный день (31 февраля не пройдёт) */
function isRealDay(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return false
  const [year, month, day] = match.slice(1).map(Number)
  const date = new Date(year, month - 1, day)
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
}

export function validateService(values: ServiceFormValues): { errors: ServiceFormErrors; record: ServiceInput | null } {
  const errors: ServiceFormErrors = {}
  const title = values.title.trim()
  const comment = values.comment.trim()
  const date = values.date.trim()
  const mileageText = values.mileage.replace(/\s/g, '')
  // «15 000,50» и «15000.50» — одно и то же
  const costText = values.cost.replace(/\s/g, '').replace(',', '.')

  if (title === '') errors.title = 'Укажите, что было сделано'
  else if (title.length > MAX_TITLE_LENGTH) errors.title = `Не длиннее ${MAX_TITLE_LENGTH} символов`

  const category = values.category in CATEGORY_LABELS ? (values.category as ServiceCategory) : null
  if (!category) errors.category = 'Выберите категорию'

  if (date === '') errors.date = 'Укажите дату'
  else if (!isRealDay(date)) errors.date = 'Такой даты не существует'
  else if (Number(date.slice(0, 4)) < MIN_YEAR) errors.date = `Год должен быть не раньше ${MIN_YEAR}`
  else if (date > todayISO()) errors.date = 'Дата не может быть в будущем'

  const mileage = Number(mileageText)
  if (mileageText === '') errors.mileage = 'Укажите пробег'
  else if (/^-/.test(mileageText)) errors.mileage = 'Пробег не может быть отрицательным'
  else if (!/^\d+$/.test(mileageText)) errors.mileage = 'Пробег — целое число километров'
  else if (mileage > MAX_MILEAGE) errors.mileage = 'Слишком большой пробег — проверьте число'

  const cost = Number(costText)
  if (costText === '') errors.cost = 'Укажите стоимость (0, если бесплатно)'
  else if (/^-/.test(costText)) errors.cost = 'Стоимость не может быть отрицательной'
  else if (!/^\d+(\.\d{1,2})?$/.test(costText)) errors.cost = 'Стоимость — число, например 15000'
  else if (cost > MAX_COST) errors.cost = 'Слишком большая сумма — проверьте число'

  if (comment.length > MAX_COMMENT_LENGTH) errors.comment = `Не длиннее ${MAX_COMMENT_LENGTH} символов`

  if (Object.keys(errors).length > 0 || !category) return { errors, record: null }
  return { errors, record: { title, category, date, mileage, cost, comment } }
}
