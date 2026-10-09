import { ENGINES_WITH_FUEL, ENGINE_LABELS, type CarInput, type EngineType } from './carStore'

/** Значения полей формы — всегда строки, как их вводит пользователь */
export interface CarFormValues {
  make: string
  model: string
  year: string
  mileage: string
  engine: string
  fuel: string
}

export type CarFormErrors = Partial<Record<keyof CarFormValues, string>>

export const MIN_YEAR = 1900
export const MAX_MILEAGE = 9_999_999
const MAX_NAME_LENGTH = 40

/** Машины следующего модельного года продаются уже в текущем */
export const maxYear = () => new Date().getFullYear() + 1

function validateName(value: string): string | undefined {
  if (value === '') return 'Заполните это поле'
  if (value.length > MAX_NAME_LENGTH) return `Не длиннее ${MAX_NAME_LENGTH} символов`
  return undefined
}

export function validateCar(values: CarFormValues): { errors: CarFormErrors; car: CarInput | null } {
  const errors: CarFormErrors = {}
  const make = values.make.trim()
  const model = values.model.trim()
  const yearText = values.year.trim()
  const mileageText = values.mileage.replace(/\s/g, '')

  const makeError = validateName(make)
  if (makeError) errors.make = makeError

  const modelError = validateName(model)
  if (modelError) errors.model = modelError

  const year = Number(yearText)
  if (yearText === '') errors.year = 'Укажите год выпуска'
  else if (!/^\d{4}$/.test(yearText)) errors.year = 'Год — четыре цифры, например 2018'
  else if (year < MIN_YEAR || year > maxYear()) errors.year = `Год должен быть от ${MIN_YEAR} до ${maxYear()}`

  const mileage = Number(mileageText)
  if (mileageText === '') errors.mileage = 'Укажите пробег'
  else if (/^-/.test(mileageText)) errors.mileage = 'Пробег не может быть отрицательным'
  else if (!/^\d+$/.test(mileageText)) errors.mileage = 'Пробег — целое число километров'
  else if (mileage > MAX_MILEAGE) errors.mileage = 'Слишком большой пробег — проверьте число'

  const engine = values.engine in ENGINE_LABELS ? (values.engine as EngineType) : null
  const fuel = engine && ENGINES_WITH_FUEL.includes(engine) && values.fuel !== '' ? values.fuel : null

  if (Object.keys(errors).length > 0) return { errors, car: null }
  return { errors, car: { make, model, year, mileage, engine, fuel } }
}
