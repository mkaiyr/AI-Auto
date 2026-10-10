// Хранилища кабинета для текущего пользователя.
//
// Данные лежат в Supabase. Изоляция обеспечивается на сервере: политики RLS таблиц
// и хранилища файлов отдают и принимают только данные владельца сессии. Клиентская
// проверка входа нужна лишь для интерфейса — сама по себе она ничего не защищает.

import { useAuth } from '../auth/AuthProvider'
import { getSupabase } from '../lib/supabase'
import type { CarPhotoRepository } from './car/carPhoto'
import { createRemoteCarRepository } from './car/carRemote'
import type { CarRepository } from './car/carStore'
import { createRemoteCarPhotoRepository } from './car/photoRemote'
import { createRemoteServiceRepository } from './service/serviceRemote'
import type { ServiceRepository } from './service/serviceStore'

export interface Repositories {
  car: CarRepository
  service: ServiceRepository
  photo: CarPhotoRepository
}

// один набор хранилищ на пользователя: хуки сравнивают их по ссылке
const cache = new Map<string, Repositories>()

export function repositoriesFor(userId: string): Repositories {
  let repositories = cache.get(userId)
  if (!repositories) {
    const supabase = getSupabase()
    repositories = {
      car: createRemoteCarRepository(supabase),
      service: createRemoteServiceRepository(supabase),
      photo: createRemoteCarPhotoRepository(supabase, userId),
    }
    cache.set(userId, repositories)
  }
  return repositories
}

/** Идентификатор вошедшего пользователя. Кабинет отображается только при подтверждённой сервером сессии */
export function useUserId(): string {
  const { state } = useAuth()
  // до определения пользователя данные не запрашиваются вовсе
  if (state.status !== 'signedIn') throw new Error('Раздел кабинета открыт без входа в аккаунт')
  return state.user.id
}

export function useRepositories(): Repositories {
  return repositoriesFor(useUserId())
}
