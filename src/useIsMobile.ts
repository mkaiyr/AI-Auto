import { useSyncExternalStore } from 'react'

/** Та же граница, что у мобильного слоя оформления в src/styles/mobile.css */
const QUERY = '(max-width: 640px)'

const subscribe = (onChange: () => void) => {
  const media = window.matchMedia(QUERY)
  media.addEventListener('change', onChange)
  return () => media.removeEventListener('change', onChange)
}

/**
 * true на телефоне. Нужен, чтобы показать короткий вариант текста: на широких экранах
 * разметка и тексты остаются прежними.
 */
export function useIsMobile(): boolean {
  return useSyncExternalStore(subscribe, () => window.matchMedia(QUERY).matches)
}
