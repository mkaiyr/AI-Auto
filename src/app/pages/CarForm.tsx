import { useRef, useState, type FormEvent } from 'react'
import { ENGINES_WITH_FUEL, ENGINE_LABELS, FUEL_OPTIONS, type Car, type CarInput, type EngineType } from '../car/carStore'
import { validateCar, type CarFormErrors, type CarFormValues } from '../car/carValidation'

interface CarFormProps {
  /** Сохранённый автомобиль при редактировании, null — при добавлении */
  initial: Car | null
  onSubmit: (car: CarInput) => Promise<void>
  onCancel: () => void
}

const toValues = (car: Car | null): CarFormValues => ({
  make: car?.make ?? '',
  model: car?.model ?? '',
  year: car ? String(car.year) : '',
  mileage: car ? String(car.mileage) : '',
  engine: car?.engine ?? '',
  fuel: car?.fuel ?? '',
})

export function CarForm({ initial, onSubmit, onCancel }: CarFormProps) {
  const [values, setValues] = useState<CarFormValues>(() => toValues(initial))
  const [errors, setErrors] = useState<CarFormErrors>({})
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const form = useRef<HTMLFormElement>(null)

  const set = (name: keyof CarFormValues, value: string) => {
    setValues((current) => ({ ...current, [name]: value }))
    // ошибка поля снимается, как только пользователь начал его исправлять
    setErrors((current) => ({ ...current, [name]: undefined }))
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    const result = validateCar(values)
    setErrors(result.errors)

    if (!result.car) {
      const first = Object.keys(result.errors)[0]
      form.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus()
      return
    }

    setSaving(true)
    setSaveError(null)
    try {
      await onSubmit(result.car)
    } catch {
      setSaveError('Не удалось сохранить: хранилище браузера недоступно или переполнено.')
      setSaving(false)
    }
  }

  const textField = (
    name: 'make' | 'model' | 'year' | 'mileage',
    label: string,
    extra: { inputMode?: 'numeric'; autoComplete?: string; maxLength?: number } = {},
  ) => (
    <div className="field">
      <label htmlFor={`car-${name}`}>{label}</label>
      <input
        id={`car-${name}`}
        name={name}
        type="text"
        value={values[name]}
        onChange={(event) => set(name, event.target.value)}
        aria-invalid={errors[name] ? true : undefined}
        aria-describedby={errors[name] ? `car-${name}-error` : undefined}
        autoComplete="off"
        {...extra}
      />
      {errors[name] && (
        <p className="field__error" id={`car-${name}-error`}>
          {errors[name]}
        </p>
      )}
    </div>
  )

  const showFuel = ENGINES_WITH_FUEL.includes(values.engine as EngineType)

  return (
    <form className="form" ref={form} onSubmit={handleSubmit} noValidate>
      {textField('make', 'Марка', { maxLength: 60 })}
      {textField('model', 'Модель', { maxLength: 60 })}
      {textField('year', 'Год выпуска', { inputMode: 'numeric', maxLength: 4 })}
      {textField('mileage', 'Пробег, км', { inputMode: 'numeric', maxLength: 12 })}

      <div className="field">
        <label htmlFor="car-engine">
          Тип двигателя <span>необязательно</span>
        </label>
        <select id="car-engine" name="engine" value={values.engine} onChange={(event) => set('engine', event.target.value)}>
          <option value="">Не указан</option>
          {Object.entries(ENGINE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {showFuel && (
        <div className="field">
          <label htmlFor="car-fuel">
            Топливо <span>необязательно</span>
          </label>
          <select id="car-fuel" name="fuel" value={values.fuel} onChange={(event) => set('fuel', event.target.value)}>
            <option value="">Не указано</option>
            {FUEL_OPTIONS.map((fuel) => (
              <option key={fuel} value={fuel}>
                {fuel}
              </option>
            ))}
          </select>
        </div>
      )}

      {saveError && (
        <p className="alert form__wide" role="alert">
          {saveError}
        </p>
      )}

      <div className="actions form__wide">
        <button className="btn btn--primary" type="submit" disabled={saving}>
          Сохранить
        </button>
        <button className="btn" type="button" onClick={onCancel}>
          Отмена
        </button>
      </div>
    </form>
  )
}
