// Фотография автомобиля в приватном хранилище Supabase (бакет car-photos).
// Файл лежит по адресу <user_id>/<car_id>.jpg. Политики хранилища пускают пользователя
// только в его папку и только к фото его собственного автомобиля.
// Для показа выдаётся временная подписанная ссылка: бакет остаётся закрытым.

import type { SupabaseClient } from '@supabase/supabase-js'
import { DataError, toDataError, unwrap } from '../dataErrors'
import type { CarPhotoRepository } from './carPhoto'

const BUCKET = 'car-photos'
/** Срок действия ссылки на фото, секунды. По истечении страница получит новую при следующей загрузке */
const LINK_TTL = 60 * 60

/** Сжатое фото из формы (data URL) → файл для загрузки */
function dataUrlToBlob(dataUrl: string): Blob {
  const match = /^data:(image\/jpeg);base64,(.+)$/.exec(dataUrl)
  if (!match) throw new DataError('Не удалось подготовить фотографию к загрузке.')
  const bytes = atob(match[2])
  const buffer = new Uint8Array(bytes.length)
  for (let i = 0; i < bytes.length; i++) buffer[i] = bytes.charCodeAt(i)
  return new Blob([buffer], { type: match[1] })
}

export function createRemoteCarPhotoRepository(supabase: SupabaseClient, userId: string): CarPhotoRepository {
  const pathFor = (carId: string) => `${userId}/${carId}.jpg`

  return {
    async get(carId) {
      const row = unwrap(
        await supabase.from('cars').select('photo_path').eq('id', carId).maybeSingle(),
        'Не удалось загрузить фотографию.',
      ) as { photo_path: string | null } | null
      if (!row?.photo_path) return null

      const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(row.photo_path, LINK_TTL)
      if (error) throw toDataError(error, 'Не удалось загрузить фотографию.')
      return data.signedUrl
    },

    async save(carId, dataUrl) {
      const path = pathFor(carId)
      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(path, dataUrlToBlob(dataUrl), { contentType: 'image/jpeg', upsert: true })
      if (error) throw toDataError(error, 'Не удалось сохранить фотографию.')
      // путь записывается в профиль только после успешной загрузки файла
      unwrap(await supabase.from('cars').update({ photo_path: path }).eq('id', carId), 'Не удалось сохранить фотографию.')
    },

    async remove(carId) {
      const { error } = await supabase.storage.from(BUCKET).remove([pathFor(carId)])
      if (error) throw toDataError(error, 'Не удалось удалить фотографию.')
      unwrap(await supabase.from('cars').update({ photo_path: null }).eq('id', carId), 'Не удалось удалить фотографию.')
    },
  }
}
