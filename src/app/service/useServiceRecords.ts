import { useCallback, useEffect, useState } from 'react'
import { errorText } from '../dataErrors'
import { useRepositories } from '../repositories'
import type { ServiceInput, ServiceRecord } from './serviceStore'

interface ServiceState {
  /** error — записи не удалось получить (это не то же самое, что «записей нет») */
  status: 'loading' | 'ready' | 'error'
  records: ServiceRecord[]
  error: string | null
}

/** История обслуживания одного автомобиля текущего пользователя. Без автомобиля (carId = null) записей нет */
export function useServiceRecords(carId: string | null) {
  const { service: repository } = useRepositories()
  const [state, setState] = useState<ServiceState>({ status: 'loading', records: [], error: null })
  const [version, setVersion] = useState(0)

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
        (error) =>
          alive && setState({ status: 'error', records: [], error: errorText(error, 'Не удалось загрузить историю обслуживания.') }),
      )
    return () => {
      alive = false
    }
  }, [carId, repository, version])

  const reload = useCallback(() => setVersion((current) => current + 1), [])

  // Список на экране меняется только после подтверждения сервера: при ошибке он остаётся прежним
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

  return { ...state, create, update, remove, reload }
}
