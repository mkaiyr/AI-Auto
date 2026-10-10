import { useRef, useState, type FormEvent } from 'react'
import { errorText } from '../dataErrors'
import { todayISO } from '../format'
import { CATEGORY_LABELS, type ServiceInput, type ServiceRecord } from '../service/serviceStore'
import { validateService, type ServiceFormErrors, type ServiceFormValues } from '../service/serviceValidation'

interface ServiceFormProps {
  /** Запись при редактировании, null — при добавлении */
  initial: ServiceRecord | null
  onSubmit: (record: ServiceInput) => Promise<void>
  onCancel: () => void
}

const toValues = (record: ServiceRecord | null): ServiceFormValues => ({
  title: record?.title ?? '',
  category: record?.category ?? '',
  // новая запись чаще всего про сегодняшний визит в сервис
  date: record?.date ?? todayISO(),
  mileage: record ? String(record.mileage) : '',
  cost: record ? String(record.cost) : '',
  comment: record?.comment ?? '',
})

export function ServiceForm({ initial, onSubmit, onCancel }: ServiceFormProps) {
  const [values, setValues] = useState<ServiceFormValues>(() => toValues(initial))
  const [errors, setErrors] = useState<ServiceFormErrors>({})
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const form = useRef<HTMLFormElement>(null)
  /** true, пока идёт сохранение: вторая отправка формы игнорируется */
  const submitting = useRef(false)

  const set = (name: keyof ServiceFormValues, value: string) => {
    setValues((current) => ({ ...current, [name]: value }))
    setErrors((current) => ({ ...current, [name]: undefined }))
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (submitting.current) return
    const result = validateService(values)
    setErrors(result.errors)

    if (!result.record) {
      const first = Object.keys(result.errors)[0]
      form.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus()
      return
    }

    // Замок ставится сразу, а не через состояние: повторное нажатие может прийти
    // раньше, чем кнопка успеет перерисоваться заблокированной.
    submitting.current = true
    setSaving(true)
    setSaveError(null)
    try {
      await onSubmit(result.record)
    } catch (cause) {
      // данные остаются в форме: после восстановления связи можно нажать «Сохранить» ещё раз
      setSaveError(errorText(cause, 'Не удалось сохранить. Попробуйте ещё раз.'))
    } finally {
      // и после успеха, и после ошибки форма снова доступна
      submitting.current = false
      setSaving(false)
    }
  }

  /** Общие атрибуты поля: значение, обработчик и связь с текстом ошибки */
  const bind = (name: keyof ServiceFormValues) => ({
    id: `service-${name}`,
    name,
    value: values[name],
    onChange: (event: { target: { value: string } }) => set(name, event.target.value),
    'aria-invalid': errors[name] ? (true as const) : undefined,
    'aria-describedby': errors[name] ? `service-${name}-error` : undefined,
  })

  const error = (name: keyof ServiceFormValues) =>
    errors[name] && (
      <p className="field__error" id={`service-${name}-error`}>
        {errors[name]}
      </p>
    )

  return (
    <form className="form" ref={form} onSubmit={handleSubmit} noValidate>
      <div className="field form__wide">
        <label htmlFor="service-title">Название работы</label>
        <input type="text" autoComplete="off" maxLength={120} {...bind('title')} />
        {error('title')}
      </div>

      <div className="field">
        <label htmlFor="service-category">Категория</label>
        <select {...bind('category')}>
          <option value="">Выберите</option>
          {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        {error('category')}
      </div>

      <div className="field">
        <label htmlFor="service-date">Дата</label>
        <input type="date" max={todayISO()} {...bind('date')} />
        {error('date')}
      </div>

      <div className="field">
        <label htmlFor="service-mileage">Пробег, км</label>
        <input type="text" inputMode="numeric" autoComplete="off" maxLength={12} {...bind('mileage')} />
        {error('mileage')}
      </div>

      <div className="field">
        <label htmlFor="service-cost">Стоимость, ₸</label>
        <input type="text" inputMode="decimal" autoComplete="off" maxLength={16} {...bind('cost')} />
        {error('cost')}
      </div>

      <div className="field form__wide">
        <label htmlFor="service-comment">
          Комментарий <span>необязательно</span>
        </label>
        <textarea rows={3} maxLength={600} {...bind('comment')} />
        {error('comment')}
      </div>

      {saveError && (
        <p className="alert form__wide" role="alert">
          {saveError}
        </p>
      )}

      <div className="actions form__wide">
        <button className="btn btn--primary" type="submit" disabled={saving}>
          {saving ? 'Сохранение…' : 'Сохранить'}
        </button>
        <button className="btn" type="button" onClick={onCancel}>
          Отмена
        </button>
      </div>
    </form>
  )
}
