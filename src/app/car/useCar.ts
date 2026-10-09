import { useCallback, useEffect, useState } from 'react'
import { localCarRepository, type Car, type CarInput, type CarRepository } from './carStore'

interface CarState {
  status: 'loading' | 'ready'
  car: Car | null
  /** Сообщение, если хранилище недоступно */
  error: string | null
}

/** Профиль автомобиля для страниц приложения. Источник данных подменяется через repository */
export function useCar(repository: CarRepository = localCarRepository) {
  const [state, setState] = useState<CarState>({ status: 'loading', car: null, error: null })

  useEffect(() => {
    let alive = true
    repository
      .get()
      .then((car) => alive && setState({ status: 'ready', car, error: null }))
      .catch(
        () =>
          alive &&
          setState({ status: 'ready', car: null, error: 'Не удалось прочитать данные: хранилище браузера недоступно.' }),
      )
    return () => {
      alive = false
    }
  }, [repository])

  const save = useCallback(
    async (input: CarInput) => {
      const car = await repository.save(input)
      setState({ status: 'ready', car, error: null })
    },
    [repository],
  )

  const remove = useCallback(async () => {
    await repository.remove()
    setState({ status: 'ready', car: null, error: null })
  }, [repository])

  return { ...state, save, remove }
}
