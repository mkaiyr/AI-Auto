// Хранилища кабинета для текущего пользователя.
//
// Локальные данные разделены по идентификатору пользователя из сессии Supabase:
// каждый аккаунт читает и пишет только свои ключи localStorage.
// Это разделение внутри одного браузера, а не серверная защита: полноценную
// изоляцию даст перенос данных в Supabase с политиками доступа.

import { useAuth } from '../auth/AuthProvider'
import { createLocalCarPhotoRepository, type CarPhotoRepository } from './car/carPhoto'
import { createLocalCarRepository, type CarRepository } from './car/carStore'
import { createLocalServiceRepository, type ServiceRepository } from './service/serviceStore'

/** Ключ localStorage, принадлежащий одному пользователю: «ai-auto:car:v1:<userId>» */
export const userKey = (baseKey: string, userId: string) => `${baseKey}:${userId}`

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
    repositories = {
      car: createLocalCarRepository(userId),
      service: createLocalServiceRepository(userId),
      photo: createLocalCarPhotoRepository(userId),
    }
    cache.set(userId, repositories)
  }
  return repositories
}

/** Идентификатор вошедшего пользователя. Кабинет отображается только при наличии сессии */
export function useUserId(): string {
  const { state } = useAuth()
  // до определения пользователя данные не читаются вовсе
  if (state.status !== 'signedIn') throw new Error('Раздел кабинета открыт без входа в аккаунт')
  return state.user.id
}

export function useRepositories(): Repositories {
  return repositoriesFor(useUserId())
}
