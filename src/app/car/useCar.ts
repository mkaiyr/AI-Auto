import { useCallback, useEffect, useState } from 'react'
import { useRepositories } from '../repositories'
import type { Car, CarInput } from './carStore'

interface CarState {
  status: 'loading' | 'ready'
  car: Car | null
  /** Сообщение, если хранилище недоступно */
  error: string | null
}

/** Профиль автомобиля текущего пользователя */
export function useCar() {
  const { car: repository, service, photo } = useRepositories()
  const [state, setState] = useState<CarState>({ status: 'loading', car: null, error: null })
  const [version, setVersion] = useState(0)

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
  }, [repository, version])

  /** Перечитать профиль из хранилища (после переноса старых данных в аккаунт) */
  const reload = useCallback(() => setVersion((current) => current + 1), [])

  const save = useCallback(
    async (input: CarInput) => {
      const car = await repository.save(input)
      setState({ status: 'ready', car, error: null })
      return car
    },
    [repository],
  )

  const remove = useCallback(async () => {
    // история обслуживания и фотография принадлежат автомобилю и удаляются вместе с ним
    // (на сервере это будет каскадное удаление в базе данных)
    const current = await repository.get()
    if (current) {
      await service.removeByCar(current.id)
      await photo.remove(current.id)
    }
    await repository.remove()
    setState({ status: 'ready', car: null, error: null })
  }, [repository, service, photo])

  return { ...state, save, remove, reload }
}
