import { useCallback, useEffect, useState } from 'react'
import { errorText } from '../dataErrors'
import { useRepositories } from '../repositories'
import type { Car, CarInput } from './carStore'

interface CarState {
  /** error — данные не удалось получить (это не то же самое, что «автомобиля нет») */
  status: 'loading' | 'ready' | 'error'
  car: Car | null
  error: string | null
}

/** Профиль автомобиля текущего пользователя */
export function useCar() {
  const { car: repository, photo } = useRepositories()
  const [state, setState] = useState<CarState>({ status: 'loading', car: null, error: null })
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let alive = true
    repository
      .get()
      .then((car) => alive && setState({ status: 'ready', car, error: null }))
      .catch(
        (error) => alive && setState({ status: 'error', car: null, error: errorText(error, 'Не удалось загрузить автомобиль.') }),
      )
    return () => {
      alive = false
    }
  }, [repository, version])

  /** Запросить профиль заново (кнопка «Повторить», завершение переноса старых данных) */
  const reload = useCallback(() => {
    setState({ status: 'loading', car: null, error: null })
    setVersion((current) => current + 1)
  }, [])

  const save = useCallback(
    async (input: CarInput) => {
      const car = await repository.save(input)
      setState({ status: 'ready', car, error: null })
      return car
    },
    [repository],
  )

  const remove = useCallback(async () => {
    const current = await repository.get()
    if (current) {
      // файл фотографии не удаляется вместе со строкой — убираем его явно, до автомобиля
      await photo.remove(current.id)
    }
    // историю обслуживания сервер удаляет вместе с автомобилем (ON DELETE CASCADE)
    await repository.remove()
    setState({ status: 'ready', car: null, error: null })
  }, [repository, photo])

  return { ...state, save, remove, reload }
}
