import { useCallback, useEffect, useState } from 'react'
import { localServiceRepository, type ServiceInput, type ServiceRecord, type ServiceRepository } from './serviceStore'

interface ServiceState {
  status: 'loading' | 'ready'
  records: ServiceRecord[]
  /** Сообщение, если хранилище недоступно */
  error: string | null
}

/** История обслуживания одного автомобиля. Без автомобиля (carId = null) записей нет */
export function useServiceRecords(carId: string | null, repository: ServiceRepository = localServiceRepository) {
  const [state, setState] = useState<ServiceState>({ status: 'loading', records: [], error: null })

  useEffect(() => {
    if (carId === null) {
      setState({ status: 'ready', records: [], error: null })
      return
    }
    let alive = true
    setState({ status: 'loading', records: [], error: null })
    repository
      .list(carId)
      .then((records) => alive && setState({ status: 'ready', records, error: null }))
      .catch(
        () =>
          alive &&
          setState({ status: 'ready', records: [], error: 'Не удалось прочитать записи: хранилище браузера недоступно.' }),
      )
    return () => {
      alive = false
    }
  }, [carId, repository])

  const create = useCallback(
    async (input: ServiceInput) => {
      if (carId === null) throw new Error('Автомобиль не добавлен')
      const record = await repository.create(carId, input)
      setState((current) => ({ ...current, records: [...current.records, record] }))
    },
    [carId, repository],
  )

  const update = useCallback(
    async (id: string, input: ServiceInput) => {
      const record = await repository.update(id, input)
      setState((current) => ({ ...current, records: current.records.map((item) => (item.id === id ? record : item)) }))
    },
    [repository],
  )

  const remove = useCallback(
    async (id: string) => {
      await repository.remove(id)
      setState((current) => ({ ...current, records: current.records.filter((item) => item.id !== id) }))
    },
    [repository],
  )

  return { ...state, create, update, remove }
}
