// Фотография автомобиля: проверка файла, уменьшение и хранение.
// Фото лежит под отдельным ключом — сбой записи не может повредить сам профиль.
// Позже CarPhotoRepository заменяется загрузкой на сервер.

import { userKey } from '../repositories'

export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
export const MAX_FILE_MB = 15
const MIN_SIDE = 320

/** Варианты сжатия от лучшего к самому компактному: [длинная сторона, качество JPEG] */
const ATTEMPTS: [number, number][] = [
  [1280, 0.82],
  [1024, 0.75],
  [800, 0.7],
]
/** Около 500 КБ в хранилище — заметно меньше общего лимита браузера (~5 МБ) */
const TARGET_CHARS = 700_000

/** Ошибка с текстом, который можно показать пользователю */
export class PhotoError extends Error {}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new PhotoError('Не удалось прочитать изображение: файл повреждён или это не картинка.'))
    }
    image.src = url
  })
}

function render(image: HTMLImageElement, maxSide: number, quality: number): string {
  const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(image.naturalWidth * scale)
  canvas.height = Math.round(image.naturalHeight * scale)
  const context = canvas.getContext('2d')
  if (!context) throw new PhotoError('Браузер не смог обработать изображение.')
  // у PNG и WebP бывает прозрачность — в JPEG она стала бы чёрной заливкой
  context.fillStyle = '#0e1013'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', quality)
}

/** Проверяет файл и возвращает уменьшенное фото в виде data URL, готовое к сохранению */
export async function prepareCarPhoto(file: File): Promise<string> {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    throw new PhotoError('Этот формат не подходит. Загрузите фото в формате JPEG, PNG или WebP.')
  }
  if (file.size > MAX_FILE_MB * 1024 * 1024) {
    throw new PhotoError(`Файл слишком большой. Максимальный размер — ${MAX_FILE_MB} МБ.`)
  }

  const image = await loadImage(file)
  if (Math.max(image.naturalWidth, image.naturalHeight) < MIN_SIDE) {
    throw new PhotoError(`Изображение слишком маленькое. Нужна сторона не меньше ${MIN_SIDE} пикселей.`)
  }

  let result = ''
  for (const [maxSide, quality] of ATTEMPTS) {
    result = render(image, maxSide, quality)
    if (result.length <= TARGET_CHARS) break
  }
  if (!result.startsWith('data:image/jpeg')) throw new PhotoError('Браузер не смог обработать изображение.')
  return result
}

export interface CarPhotoRepository {
  get(carId: string): Promise<string | null>
  save(carId: string, dataUrl: string): Promise<void>
  remove(carId: string): Promise<void>
}

/** Основа ключа; полный ключ включает идентификатор пользователя (см. repositories.ts) */
export const CAR_PHOTO_STORAGE_KEY = 'ai-auto:car-photo:v1'

/** Фотография автомобиля одного пользователя в localStorage */
export function createLocalCarPhotoRepository(userId: string): CarPhotoRepository {
  const STORAGE_KEY = userKey(CAR_PHOTO_STORAGE_KEY, userId)

  return {
    async get(carId) {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (raw === null) return null
      try {
        const parsed = JSON.parse(raw) as { carId?: unknown; dataUrl?: unknown }
        // фото другого автомобиля не показываем как своё
        return parsed.carId === carId && typeof parsed.dataUrl === 'string' ? parsed.dataUrl : null
      } catch {
        return null
      }
    },

    async save(carId, dataUrl) {
      // если места не хватит, setItem бросит ошибку, а прежнее фото останется на месте
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ carId, dataUrl }))
    },

    async remove() {
      window.localStorage.removeItem(STORAGE_KEY)
    },
  }
}
