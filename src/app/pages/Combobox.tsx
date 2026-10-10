import { useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { searchKey } from '../car/catalog/catalog'

export interface ComboOption {
  value: string
  /** строка, по которой идёт поиск (название, русское название) */
  search: string
  /** пояснение справа, например годы выпуска */
  hint?: string
  /** заголовок группы; показывается перед первой опцией группы, пока поиск пуст */
  group?: string
}

interface ComboboxProps {
  id: string
  name: string
  label: ReactNode
  value: string
  options: ComboOption[]
  onSelect: (value: string) => void
  /** выбран пункт «нет в списке» */
  onCustom: () => void
  customLabel: string
  placeholder?: string
  disabled?: boolean
  error?: string
}

/** Выпадающий список с поиском: выбор значения из каталога без ручного набора названия целиком */
export function Combobox({ id, name, label, value, options, onSelect, onCustom, customLabel, placeholder, disabled, error }: ComboboxProps) {
  const listId = useId()
  const input = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  /** текст поиска; null — в поле показано выбранное значение */
  const [query, setQuery] = useState<string | null>(null)
  const [active, setActive] = useState(0)

  const filtered = useMemo(() => {
    const key = searchKey(query ?? '').trim()
    return key === '' ? options : options.filter((option) => option.search.includes(key))
  }, [options, query])
  // последний пункт списка — запасной вариант для автомобилей, которых нет в каталоге
  const customIndex = filtered.length

  const close = () => {
    setOpen(false)
    setQuery(null)
  }

  const choose = (index: number) => {
    if (index === customIndex) onCustom()
    else if (filtered[index]) onSelect(filtered[index].value)
    close()
  }

  const handleKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (!open) return setOpen(true)
      const step = event.key === 'ArrowDown' ? 1 : -1
      const next = (active + step + customIndex + 1) % (customIndex + 1)
      setActive(next)
      document.getElementById(`${listId}-${next}`)?.scrollIntoView({ block: 'nearest' })
    } else if (event.key === 'Enter' && open) {
      // Enter выбирает пункт списка, а не отправляет форму
      event.preventDefault()
      choose(active)
    } else if (event.key === 'Escape' && open) {
      event.preventDefault()
      close()
    }
  }

  const handleBlur = () => {
    // набранное точное название считается выбором; иначе поле возвращается к прежнему значению
    const typed = searchKey(query ?? '').trim()
    const exact = typed === '' ? null : options.find((option) => searchKey(option.value) === typed)
    if (exact && exact.value !== value) onSelect(exact.value)
    close()
  }

  return (
    <div className="field combo">
      <label htmlFor={id}>{label}</label>
      <input
        ref={input}
        id={id}
        name={name}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open ? `${listId}-${active}` : undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        autoComplete="off"
        placeholder={placeholder}
        disabled={disabled}
        value={query ?? value}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onChange={(event) => {
          setQuery(event.target.value)
          setActive(0)
          setOpen(true)
        }}
        onKeyDown={handleKey}
        onBlur={handleBlur}
      />

      {open && !disabled && (
        <ul className="combo__list" id={listId} role="listbox" aria-label={typeof label === 'string' ? label : undefined}>
          {filtered.map((option, index) => (
            <li key={option.value} role="presentation">
              {query === null && option.group && option.group !== filtered[index - 1]?.group && (
                <span className="combo__group">{option.group}</span>
              )}
              <div
                className="combo__option"
                id={`${listId}-${index}`}
                role="option"
                aria-selected={index === active}
                data-current={option.value === value || undefined}
                // pointerdown без потери фокуса: иначе поле закроет список раньше, чем сработает выбор
                onPointerDown={(event) => event.preventDefault()}
                onClick={() => choose(index)}
                onMouseEnter={() => setActive(index)}
              >
                <span>{option.value}</span>
                {option.hint && <small>{option.hint}</small>}
              </div>
            </li>
          ))}
          {filtered.length === 0 && <li className="combo__empty">Ничего не найдено</li>}
          <li role="presentation">
            <div
              className="combo__option combo__option--custom"
              id={`${listId}-${customIndex}`}
              role="option"
              aria-selected={active === customIndex}
              onPointerDown={(event) => event.preventDefault()}
              onClick={() => choose(customIndex)}
              onMouseEnter={() => setActive(customIndex)}
            >
              <span>{customLabel}</span>
            </div>
          </li>
        </ul>
      )}

      {error && (
        <p className="field__error" id={`${id}-error`}>
          {error}
        </p>
      )}
    </div>
  )
}
