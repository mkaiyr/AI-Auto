import { useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { MAX_FILE_MB, PhotoError, prepareCarPhoto } from '../car/carPhoto'
import {
  BODY_LABELS,
  ENGINES_WITH_FUEL,
  ENGINE_LABELS,
  FUEL_OPTIONS,
  type BodyType,
  type Car,
  type CarInput,
  type EngineType,
} from '../car/carStore'
import { validateCar, type CarFormErrors, type CarFormValues } from '../car/carValidation'
import { CarVisual } from '../car/CarVisual'
import { errorText } from '../dataErrors'

/** Что сделать с фотографией при сохранении формы */
export type PhotoChange = { type: 'keep' } | { type: 'set'; dataUrl: string } | { type: 'remove' }

interface CarFormProps {
  /** Сохранённый автомобиль при редактировании, null — при добавлении */
  initial: Car | null
  /** Сохранённое фото (data URL) или null */
  initialPhoto: string | null
  onSubmit: (car: CarInput, photo: PhotoChange) => Promise<void>
  onCancel: () => void
}

const toValues = (car: Car | null): CarFormValues => ({
  make: car?.make ?? '',
  model: car?.model ?? '',
  year: car ? String(car.year) : '',
  mileage: car ? String(car.mileage) : '',
  body: car?.body ?? '',
  engine: car?.engine ?? '',
  fuel: car?.fuel ?? '',
})

export function CarForm({ initial, initialPhoto, onSubmit, onCancel }: CarFormProps) {
  const [values, setValues] = useState<CarFormValues>(() => toValues(initial))
  const [errors, setErrors] = useState<CarFormErrors>({})
  const [photo, setPhoto] = useState<string | null>(initialPhoto)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [photoBusy, setPhotoBusy] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const form = useRef<HTMLFormElement>(null)
  /** true, пока идёт сохранение: вторая отправка формы игнорируется */
  const submitting = useRef(false)

  const set = (name: keyof CarFormValues, value: string) => {
    setValues((current) => ({ ...current, [name]: value }))
    // ошибка поля снимается, как только пользователь начал его исправлять
    setErrors((current) => ({ ...current, [name]: undefined }))
  }

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    // сброс позволяет выбрать тот же файл повторно
    event.target.value = ''
    if (!file) return

    setPhotoBusy(true)
    setPhotoError(null)
    try {
      setPhoto(await prepareCarPhoto(file))
    } catch (error) {
      // прежнее фото в предпросмотре остаётся
      setPhotoError(error instanceof PhotoError ? error.message : 'Не удалось обработать изображение.')
    } finally {
      setPhotoBusy(false)
    }
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (submitting.current) return
    const result = validateCar(values)
    setErrors(result.errors)

    if (!result.car) {
      const first = Object.keys(result.errors)[0]
      form.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus()
      return
    }

    const change: PhotoChange =
      photo === initialPhoto ? { type: 'keep' } : photo === null ? { type: 'remove' } : { type: 'set', dataUrl: photo }

    // Замок ставится сразу, а не через состояние: повторное нажатие может прийти
    // раньше, чем кнопка успеет перерисоваться заблокированной.
    submitting.current = true
    setSaving(true)
    setSaveError(null)
    try {
      await onSubmit(result.car, change)
    } catch (cause) {
      // данные остаются в форме: после восстановления связи можно нажать «Сохранить» ещё раз
      setSaveError(errorText(cause, 'Не удалось сохранить. Попробуйте ещё раз.'))
    } finally {
      // и после успеха, и после ошибки форма снова доступна
      submitting.current = false
      setSaving(false)
    }
  }

  const textField = (
    name: 'make' | 'model' | 'year' | 'mileage',
    label: string,
    extra: { inputMode?: 'numeric'; maxLength?: number } = {},
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

  const selectField = (name: 'body' | 'engine' | 'fuel', label: string, empty: string, options: [string, string][]) => (
    <div className="field">
      <label htmlFor={`car-${name}`}>
        {label} <span>необязательно</span>
      </label>
      <select id={`car-${name}`} name={name} value={values[name]} onChange={(event) => set(name, event.target.value)}>
        <option value="">{empty}</option>
        {options.map(([value, text]) => (
          <option key={value} value={value}>
            {text}
          </option>
        ))}
      </select>
    </div>
  )

  const body = values.body in BODY_LABELS ? (values.body as BodyType) : null
  const showFuel = ENGINES_WITH_FUEL.includes(values.engine as EngineType)

  return (
    <form className="form" ref={form} onSubmit={handleSubmit} noValidate>
      <div className="photo form__wide">
        <CarVisual photo={photo} body={body} alt="Предпросмотр фотографии автомобиля" />
        <div className="photo__controls">
          <label className="btn photo__upload">
            {photoBusy ? 'Обработка…' : photo ? 'Заменить фото' : 'Загрузить фото'}
            <input
              className="photo__input"
              type="file"
              name="photo"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFile}
              disabled={photoBusy}
            />
          </label>
          {photo && (
            <button className="btn" type="button" onClick={() => setPhoto(null)}>
              Удалить фото
            </button>
          )}
        </div>
        {photoError ? (
          <p className="field__error" role="alert">
            {photoError}
          </p>
        ) : (
          <p className="photo__hint">
            JPEG, PNG или WebP до {MAX_FILE_MB} МБ. Фото уменьшается перед загрузкой и хранится в закрытом хранилище вашего аккаунта.
          </p>
        )}
      </div>

      {textField('make', 'Марка', { maxLength: 60 })}
      {textField('model', 'Модель', { maxLength: 60 })}
      {textField('year', 'Год выпуска', { inputMode: 'numeric', maxLength: 4 })}
      {textField('mileage', 'Пробег, км', { inputMode: 'numeric', maxLength: 12 })}
      {selectField('body', 'Тип кузова', 'Не указан', Object.entries(BODY_LABELS))}
      {selectField('engine', 'Тип двигателя', 'Не указан', Object.entries(ENGINE_LABELS))}
      {showFuel &&
        selectField(
          'fuel',
          'Топливо',
          'Не указано',
          FUEL_OPTIONS.map((fuel) => [fuel, fuel]),
        )}

      {saveError && (
        <p className="alert form__wide" role="alert">
          {saveError}
        </p>
      )}

      <div className="actions form__wide">
        <button className="btn btn--primary" type="submit" disabled={saving || photoBusy}>
          {saving ? 'Сохранение…' : 'Сохранить'}
        </button>
        <button className="btn" type="button" onClick={onCancel}>
          Отмена
        </button>
      </div>
    </form>
  )
}
