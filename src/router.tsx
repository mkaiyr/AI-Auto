import { useSyncExternalStore, type AnchorHTMLAttributes, type MouseEvent, type Ref } from 'react'

// Небольшая маршрутизация на History API: маршрутов мало, отдельная библиотека не нужна.
//
// Сайт может лежать не в корне домена (на GitHub Pages — в папке с именем репозитория).
// Маршруты в коде всегда пишутся от корня приложения («/app/car»), а префикс папки
// добавляется и убирается только здесь.

/** Префикс папки сайта без завершающего слэша: «» локально, «/site2» на GitHub Pages */
const BASE = import.meta.env.BASE_URL.replace(/\/+$/, '')

/** Полный адрес внутри сайта для маршрута приложения: «/app/car» → «/site2/app/car» */
export const withBase = (to: string) => `${BASE}${to}`

const listeners = new Set<() => void>()
const notify = () => listeners.forEach((listener) => listener())

window.addEventListener('popstate', notify)

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Текущий маршрут без префикса папки и завершающего слэша: «/app/car/» и «/app/car» — одно и то же */
const getPath = () => {
  const { pathname } = window.location
  const inner = BASE !== '' && (pathname === BASE || pathname.startsWith(`${BASE}/`)) ? pathname.slice(BASE.length) : pathname
  return inner.replace(/\/+$/, '') || '/'
}

export function navigate(to: string, options: { replace?: boolean } = {}) {
  if (to === getPath()) return
  if (options.replace) window.history.replaceState(null, '', withBase(to))
  else window.history.pushState(null, '', withBase(to))
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

  return <a href={withBase(to)} onClick={handleClick} {...rest} />
}
