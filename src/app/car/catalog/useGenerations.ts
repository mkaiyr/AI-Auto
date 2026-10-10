import { useEffect, useState } from 'react'
import { loadGenerations, type MakeGenerations } from './generations'

const NOTHING: MakeGenerations = {}

/**
 * Поколения моделей выбранной марки. null — ещё загружаются.
 * Если справочник не загрузился, возвращается пустой объект: форма предложит ручной ввод,
 * а карточка покажет иллюстрацию кузова.
 */
export function useGenerations(make: string): MakeGenerations | null {
  const [state, setState] = useState<{ make: string; data: MakeGenerations } | null>(null)

  useEffect(() => {
    if (make === '') return
    let alive = true
    loadGenerations(make)
      .then((data) => alive && setState({ make, data }))
      .catch(() => alive && setState({ make, data: NOTHING }))
    return () => {
      alive = false
    }
  }, [make])

  if (make === '') return NOTHING
  return state?.make === make ? state.data : null
}
