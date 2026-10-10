import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react'
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
import { findMake, findModel, loadCatalog, POPULAR_MAKES, searchKey, type CatalogMake } from '../car/catalog/catalog'
import { generationsForYear, generationsOf, generationYears } from '../car/catalog/generations'
import { errorText } from '../dataErrors'
import { Combobox, type ComboOption } from './Combobox'

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
  generation: car?.generation ?? '',
  body: car?.body ?? '',
  engine: car?.engine ?? '',
  fuel: car?.fuel ?? '',
})

/** Год из поля, если он введён полностью */
const parseYear = (value: string) => (/^\d{4}$/.test(value.trim()) ? Number(value.trim()) : null)

/**
 * Поколение по году выпуска: единственный подходящий вариант подставляется сам,
 * при нескольких (переходный год) выбор остаётся за пользователем.
 */
function suggestGeneration(make: string, model: string, year: string, current: string): string {
  const parsed = parseYear(year)
  if (parsed === null) return ''
  const candidates = generationsForYear(make, model, parsed)
  if (candidates.some((item) => item.code === current)) return current
  return candidates.length === 1 ? candidates[0].code : ''
}

export function CarForm({ initial, initialPhoto, onSubmit, onCancel }: CarFormProps) {
  const [values, setValues] = useState<CarFormValues>(() => toValues(initial))
  const [errors, setErrors] = useState<CarFormErrors>({})
  const [photo, setPhoto] = useState<string | null>(initialPhoto)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [photoBusy, setPhotoBusy] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  /** null — каталог ещё загружается */
  const [catalog, setCatalog] = useState<CatalogMake[] | null>(null)
  const [catalogFailed, setCatalogFailed] = useState(false)
  /** какие поля заполняются вручную, а не выбором из каталога */
  const [manual, setManual] = useState({ make: false, model: false, generation: false })
  /** поколение выбрал сам пользователь (или оно сохранено ранее), а не подставила форма */
  const [generationPicked, setGenerationPicked] = useState(Boolean(initial?.generation))
  const form = useRef<HTMLFormElement>(null)
  /** true, пока идёт сохранение: вторая отправка формы игнорируется */
  const submitting = useRef(false)

  useEffect(() => {
    let alive = true
    loadCatalog()
      .then((loaded) => {
        if (!alive) return
        setCatalog(loaded)
        // Ранее сохранённый автомобиль, которого нет в каталоге, остаётся как есть:
        // его поля открываются в ручном режиме с прежними значениями.
        const start = toValues(initial)
        const make = findMake(loaded, start.make)
        const makeManual = start.make !== '' && !make
        const modelManual = makeManual || (start.model !== '' && !findModel(make, start.model))
        const year = parseYear(start.year)
        const known = year === null ? [] : generationsForYear(start.make, start.model, year)
        setManual({
          make: makeManual,
          model: modelManual,
          generation: start.generation !== '' && !known.some((item) => item.code === start.generation),
        })
      })
      .catch(() => alive && setCatalogFailed(true))
    return () => {
      alive = false
    }
  }, [initial])

  const patch = (changes: Partial<CarFormValues>) => {
    setValues((current) => ({ ...current, ...changes }))
    // ошибка поля снимается, как только пользователь начал его исправлять
    setErrors((current) => {
      const next = { ...current }
      for (const key of Object.keys(changes) as (keyof CarFormValues)[]) delete next[key]
      return next
    })
  }
  const set = (name: keyof CarFormValues, value: string) => patch({ [name]: value })

  // ---- марка, модель, год: зависимые поля ----

  const selectMake = (make: string) => {
    if (make === values.make) return
    // модель, поколение и тип кузова относились к прежней марке
    patch({ make, model: '', generation: '', body: '' })
    setManual({ make: false, model: false, generation: false })
    setGenerationPicked(false)
  }

  const selectModel = (model: string) => {
    if (model === values.model) return
    patch({ model, generation: suggestGeneration(values.make, model, values.year, '') })
    setManual((current) => ({ ...current, model: false, generation: false }))
    setGenerationPicked(false)
  }

  const changeYear = (year: string) => {
    // Собственный выбор пользователя сохраняется, пока подходит к году. Подставленное формой
    // значение пересчитывается: в переходный год оно сбрасывается, чтобы выбор сделал человек.
    const keep = generationPicked ? values.generation : ''
    patch(manual.generation ? { year } : { year, generation: suggestGeneration(values.make, values.model, year, keep) })
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

  // ---- отрисовка полей ----

  const fieldError = (name: keyof CarFormValues) =>
    errors[name] && (
      <p className="field__error" id={`car-${name}-error`}>
        {errors[name]}
      </p>
    )

  const textField = (
    name: 'make' | 'model' | 'year' | 'mileage' | 'generation',
    label: ReactNode,
    extra: { inputMode?: 'numeric'; maxLength?: number; onChange?: (value: string) => void; after?: ReactNode } = {},
  ) => (
    <div className="field">
      <label htmlFor={`car-${name}`}>{label}</label>
      <input
        id={`car-${name}`}
        name={name}
        type="text"
        value={values[name]}
        onChange={(event) => (extra.onChange ?? ((value: string) => set(name, value)))(event.target.value)}
        aria-invalid={errors[name] ? true : undefined}
        aria-describedby={errors[name] ? `car-${name}-error` : undefined}
        autoComplete="off"
        inputMode={extra.inputMode}
        maxLength={extra.maxLength}
      />
      {fieldError(name)}
      {extra.after}
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

  /** Маленькая ссылка-переключатель под полем: каталог ↔ ручной ввод */
  const switchLink = (text: string, onClick: () => void) => (
    <button className="field__switch" type="button" onClick={onClick}>
      {text}
    </button>
  )

  const make = findMake(catalog, values.make)
  const model = findModel(make, values.model)
  const year = parseYear(values.year)

  const makeOptions = useMemo<ComboOption[]>(() => {
    if (!catalog) return []
    const popular = POPULAR_MAKES.map((name) => findMake(catalog, name)).filter((item): item is CatalogMake => item !== null)
    const toOption = (item: CatalogMake, group: string): ComboOption => ({ value: item.name, search: searchKey(item.name, item.cyrillic), group })
    return [
      ...popular.map((item) => toOption(item, 'Популярные')),
      ...catalog.filter((item) => !POPULAR_MAKES.includes(item.name)).map((item) => toOption(item, 'Все марки')),
    ]
  }, [catalog])

  const modelOptions = useMemo<ComboOption[]>(
    () =>
      (make?.models ?? []).map((item) => ({
        value: item.name,
        search: searchKey(item.name, item.cyrillic),
        hint: item.from ? `${item.from}–${item.to || 'н. в.'}` : undefined,
      })),
    [make],
  )

  const loadingCatalog = catalog === null && !catalogFailed
  const makeField =
    loadingCatalog ? (
      <div className="field">
        <label htmlFor="car-make">Марка</label>
        <input id="car-make" name="make" type="text" value={values.make} placeholder="Загрузка каталога…" disabled readOnly />
      </div>
    ) : manual.make || catalogFailed ? (
      textField('make', 'Марка', {
        maxLength: 60,
        after: catalog ? (
          switchLink('Выбрать из каталога', () => {
            patch({ make: '', model: '', generation: '', body: '' })
            setManual({ make: false, model: false, generation: false })
          })
        ) : (
          <p className="field__hint">Каталог не загрузился — введите марку вручную.</p>
        ),
      })
    ) : (
      <Combobox
        id="car-make"
        name="make"
        label="Марка"
        value={values.make}
        options={makeOptions}
        placeholder="Начните вводить: Toyota, тойота…"
        customLabel="Марки нет в списке — ввести вручную"
        error={errors.make}
        onSelect={selectMake}
        onCustom={() => {
          patch({ make: '', model: '', generation: '', body: '' })
          setManual({ make: true, model: true, generation: true })
        }}
      />
    )

  const modelField =
    loadingCatalog ? (
      <div className="field">
        <label htmlFor="car-model">Модель</label>
        <input id="car-model" name="model" type="text" value={values.model} disabled readOnly />
      </div>
    ) : manual.model || manual.make || catalogFailed ? (
      textField('model', 'Модель', {
        maxLength: 60,
        after: make
          ? switchLink('Выбрать из каталога', () => {
              patch({ model: '', generation: '' })
              setManual((current) => ({ ...current, model: false, generation: false }))
            })
          : null,
      })
    ) : (
      <Combobox
        id="car-model"
        name="model"
        label="Модель"
        value={values.model}
        options={modelOptions}
        disabled={!make}
        placeholder={make ? 'Начните вводить название' : 'Сначала выберите марку'}
        customLabel="Модели нет в списке — ввести вручную"
        error={errors.model}
        onSelect={selectModel}
        onCustom={() => {
          patch({ model: '', generation: '' })
          setManual((current) => ({ ...current, model: true, generation: true }))
        }}
      />
    )

  // Поколение подбирается только по марке, модели и году вместе. Одного названия модели недостаточно.
  const knownGenerations = manual.make || manual.model ? null : generationsOf(values.make, values.model)
  const candidates = knownGenerations && year !== null ? generationsForYear(values.make, values.model, year) : []
  const generationLabel = (
    <>
      Поколение / код кузова <span>необязательно</span>
    </>
  )
  const generationField =
    manual.generation || !knownGenerations ? (
      textField('generation', generationLabel, {
        maxLength: 30,
        after: knownGenerations
          ? switchLink('Подобрать по году выпуска', () => {
              setManual((current) => ({ ...current, generation: false }))
              patch({ generation: suggestGeneration(values.make, values.model, values.year, '') })
              setGenerationPicked(false)
            })
          : values.model !== '' && <p className="field__hint">Для этой модели в справочнике нет поколений — укажите код кузова вручную, если знаете.</p>,
      })
    ) : (
      <div className="field">
        <label htmlFor="car-generation">{generationLabel}</label>
        <select
          id="car-generation"
          name="generation"
          value={values.generation}
          disabled={year === null}
          onChange={(event) => {
            set('generation', event.target.value)
            setGenerationPicked(event.target.value !== '')
          }}
          aria-invalid={errors.generation ? true : undefined}
        >
          <option value="">{year === null ? 'Сначала укажите год выпуска' : candidates.length > 1 ? 'Выберите поколение' : 'Не указано'}</option>
          {candidates.map((item) => (
            <option key={item.code} value={item.code}>
              {item.code} · {generationYears(item)}
            </option>
          ))}
        </select>
        {fieldError('generation')}
        {year !== null && (
          <p className="field__hint">
            {candidates.length === 0
              ? `Для ${year} года в справочнике нет поколения этой модели.`
              : candidates.length === 1
                ? 'Определено по году выпуска. Проверьте: в переходные годы возможны оба поколения.'
                : `В ${year} году выпускалось несколько поколений — выберите своё.`}
          </p>
        )}
        {switchLink('Ввести вручную', () => setManual((current) => ({ ...current, generation: true })))}
      </div>
    )

  const yearOutOfRange = model && year !== null && model.from > 0 && (year < model.from || (model.to > 0 && year > model.to))
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

      {makeField}
      {modelField}
      {textField('year', 'Год выпуска', {
        inputMode: 'numeric',
        maxLength: 4,
        onChange: changeYear,
        after: yearOutOfRange && model && (
          <p className="field__hint">
            По каталогу {model.name} выпускалась в {model.from}–{model.to || 'н. в.'} годах. Проверьте год.
          </p>
        ),
      })}
      {textField('mileage', 'Пробег, км', { inputMode: 'numeric', maxLength: 12 })}
      {generationField}
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
