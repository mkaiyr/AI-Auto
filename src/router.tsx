import { useSyncExternalStore, type AnchorHTMLAttributes, type MouseEvent, type Ref } from 'react'

// Небольшая маршрутизация на History API: маршрутов мало, отдельная библиотека не нужна.

const listeners = new Set<() => void>()
const notify = () => listeners.forEach((listener) => listener())

window.addEventListener('popstate', notify)

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Текущий путь без завершающего слэша: «/app/car/» и «/app/car» — одно и то же */
const getPath = () => window.location.pathname.replace(/\/+$/, '') || '/'

export function navigate(to: string, options: { replace?: boolean } = {}) {
  if (to === getPath()) return
  if (options.replace) window.history.replaceState(null, '', to)
  else window.history.pushState(null, '', to)
  window.scrollTo({ top: 0, behavior: 'instant' })
  notify()
}

export function usePath() {
  return useSyncExternalStore(subscribe, getPath)
}

interface LinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  to: string
  ref?: Ref<HTMLAnchorElement>
}

/** Ссылка внутри сайта: переход без перезагрузки страницы */
export function Link({ to, onClick, ...rest }: LinkProps) {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event)
    // новая вкладка, средняя кнопка и т. п. — оставляем браузеру
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    navigate(to)
  }

  return <a href={to} onClick={handleClick} {...rest} />
}
