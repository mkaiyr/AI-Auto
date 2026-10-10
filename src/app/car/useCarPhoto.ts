import { useCallback, useEffect, useState } from 'react'
import { useRepositories } from '../repositories'

/** Сохранённая фотография автомобиля. Без автомобиля (carId = null) фото нет */
export function useCarPhoto(carId: string | null) {
  const { photo: repository } = useRepositories()
  const [photo, setPhoto] = useState<string | null>(null)

  useEffect(() => {
    if (carId === null) {
      setPhoto(null)
      return
    }
    let alive = true
    repository
      .get(carId)
      .then((dataUrl) => alive && setPhoto(dataUrl))
      .catch(() => alive && setPhoto(null))
    return () => {
      alive = false
    }
  }, [carId, repository])

  const save = useCallback(
    async (id: string, dataUrl: string) => {
      await repository.save(id, dataUrl)
      setPhoto(dataUrl)
    },
    [repository],
  )

  const remove = useCallback(
    async (id: string) => {
      await repository.remove(id)
      setPhoto(null)
    },
    [repository],
  )

  return { photo, save, remove }
}
