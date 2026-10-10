import { useEffect, useState } from 'react'
import { BODY_LABELS, type BodyType } from './carStore'
import { licenceUrl, type Illustration } from './catalog/generations'

/** Через сколько повторить загрузку снимка после сбоя: сервер Wikimedia при перегрузке отвечает 429 */
const RETRY_DELAY = 5000
import './car.css'

// Стилизованные силуэты кузовов: вид сбоку, задняя часть слева.
// Каждый кузов описан точками верхнего контура (от заднего бампера к переднему),
// высотой порога, положением и радиусом колёс.

interface Shape {
  top: [number, number][]
  /** Линия под стёклами: x1, y1, x2, y2 */
  belt: [number, number, number, number]
  bottom: number
  wheels: [number, number]
  r: number
}

const GROUND = 134

const SHAPES: Record<BodyType, Shape> = {
  sedan: { top: [[30, 100], [36, 76], [96, 71], [136, 42], [218, 38], [272, 68], [352, 78], [374, 92]], belt: [96, 71, 272, 68], bottom: 112, wheels: [100, 300], r: 22 },
  hatchback: { top: [[62, 100], [64, 70], [92, 40], [218, 38], [272, 68], [350, 78], [372, 92]], belt: [70, 69, 272, 68], bottom: 112, wheels: [118, 300], r: 22 },
  wagon: { top: [[30, 100], [32, 66], [50, 40], [218, 38], [272, 68], [352, 78], [374, 92]], belt: [37, 68, 272, 68], bottom: 112, wheels: [100, 300], r: 22 },
  coupe: { top: [[32, 100], [40, 78], [86, 72], [156, 46], [212, 43], [266, 71], [354, 81], [374, 94]], belt: [86, 72, 266, 71], bottom: 112, wheels: [100, 300], r: 22 },
  liftback: { top: [[30, 100], [36, 74], [66, 69], [146, 42], [218, 38], [272, 68], [352, 78], [374, 92]], belt: [66, 69, 272, 68], bottom: 112, wheels: [100, 300], r: 22 },
  crossover: { top: [[38, 96], [40, 58], [66, 31], [218, 29], [270, 60], [352, 70], [374, 86]], belt: [44, 60, 270, 60], bottom: 106, wheels: [104, 298], r: 25 },
  suv: { top: [[30, 94], [31, 52], [42, 26], [226, 26], [262, 56], [358, 60], [376, 78]], belt: [35, 56, 262, 56], bottom: 102, wheels: [102, 298], r: 27 },
  minivan: { top: [[30, 98], [31, 54], [46, 29], [232, 29], [320, 66], [360, 76], [374, 92]], belt: [35, 62, 312, 62], bottom: 110, wheels: [98, 304], r: 22 },
  pickup: { top: [[24, 96], [25, 66], [152, 66], [156, 33], [234, 33], [272, 62], [356, 66], [376, 82]], belt: [156, 64, 272, 62], bottom: 104, wheels: [96, 300], r: 26 },
}

const round = (n: number) => Math.round(n * 10) / 10

/** Контур кузова: скруглённые углы сверху, арки над колёсами снизу */
function bodyPath({ top, bottom, wheels, r }: Shape): string {
  const corner = 9
  let d = `M${top[0][0]} ${top[0][1]}`

  for (let i = 1; i < top.length - 1; i++) {
    const [px, py] = top[i - 1]
    const [x, y] = top[i]
    const [nx, ny] = top[i + 1]
    const before = Math.hypot(x - px, y - py)
    const after = Math.hypot(nx - x, ny - y)
    const cut = Math.min(corner, before / 2, after / 2)
    d += ` L${round(x - ((x - px) / before) * cut)} ${round(y - ((y - py) / before) * cut)}`
    d += ` Q${x} ${y} ${round(x + ((nx - x) / after) * cut)} ${round(y + ((ny - y) / after) * cut)}`
  }

  const [rearX, frontX] = wheels
  const [lastX, lastY] = top[top.length - 1]
  const archR = r + 5
  const centerY = GROUND - r
  const dx = round(Math.sqrt(Math.max(archR ** 2 - (bottom - centerY) ** 2, 0)))
  const large = bottom > centerY ? 1 : 0
  const arch = (x: number) => ` L${x + dx} ${bottom} A${archR} ${archR} 0 ${large} 0 ${x - dx} ${bottom}`

  return `${d} L${lastX} ${lastY} L${lastX - 2} ${bottom}${arch(frontX)}${arch(rearX)} L${top[0][0] + 2} ${bottom} Z`
}

function BodySilhouette({ type }: { type: BodyType }) {
  const shape = SHAPES[type]
  const [bx1, by1, bx2, by2] = shape.belt
  const [rearX, rearY] = shape.top[0]
  const [frontX, frontY] = shape.top[shape.top.length - 1]
  const centerY = GROUND - shape.r

  return (
    <svg className="silhouette" viewBox="0 0 400 150" aria-hidden="true">
      <line className="silhouette__ground" x1="6" y1={GROUND} x2="394" y2={GROUND} />
      <path className="silhouette__body" d={bodyPath(shape)} />
      <line className="silhouette__line" x1={bx1} y1={by1} x2={bx2} y2={by2} />
      {/* задний фонарь — бордовый, фара — лаймовая */}
      <line className="silhouette__tail" x1={rearX + 3} y1={rearY - 14} x2={rearX + 3} y2={rearY - 6} />
      <line className="silhouette__lamp" x1={frontX - 12} y1={frontY - 3} x2={frontX - 4} y2={frontY + 1} />
      {shape.wheels.map((x) => (
        <g key={x}>
          <circle className="silhouette__wheel" cx={x} cy={centerY} r={shape.r} />
          <circle className="silhouette__hub" cx={x} cy={centerY} r={shape.r * 0.42} />
        </g>
      ))}
    </svg>
  )
}

interface CarVisualProps {
  /** Фото пользователя (data URL) или null */
  photo: string | null
  body: BodyType | null
  alt: string
  /** Фотография такой же модели из каталога. Показывается, только если своего фото нет */
  illustration?: Illustration | null
  /** Что изображено на иллюстрации, например «Toyota Camry XV70» */
  title?: string
}

/**
 * Главный визуальный блок профиля. По убыванию приоритета: фото пользователя, фотография такой же
 * модели из каталога, силуэт выбранного кузова. Силуэт виден сразу, а фотография из каталога
 * проявляется поверх него, когда загрузится; если она не загрузилась, остаётся силуэт.
 */
export function CarVisual({ photo, body, alt, illustration = null, title = '' }: CarVisualProps) {
  // адрес фото, которое не удалось загрузить (например, временная ссылка устарела в давно открытой вкладке)
  const [failedPhoto, setFailedPhoto] = useState<string | null>(null)
  const [loadedImage, setLoadedImage] = useState<string | null>(null)
  const [failedImage, setFailedImage] = useState<string | null>(null)
  /** снимок, загрузка которого сорвалась один раз и будет повторена */
  const [retrying, setRetrying] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  // одна повторная попытка с задержкой; после второго сбоя остаётся силуэт
  useEffect(() => {
    if (retrying === null) return
    const timer = window.setTimeout(() => setAttempt((current) => current + 1), RETRY_DELAY)
    return () => window.clearTimeout(timer)
  }, [retrying])

  if (photo && photo !== failedPhoto) {
    return (
      <figure className="car-visual car-visual--photo">
        <img src={photo} alt={alt} onError={() => setFailedPhoto(photo)} />
      </figure>
    )
  }

  const image = illustration && illustration.image.url !== failedImage ? illustration.image : null
  const waiting = image !== null && retrying === image.url && attempt === 0
  const licenceLink = image ? licenceUrl(image.licence) : null
  const shown = image !== null && image.url === loadedImage

  return (
    <figure className={shown ? 'car-visual car-visual--catalog' : 'car-visual'}>
      {body && <BodySilhouette type={body} />}
      {image && !waiting && (
        <img
          className="car-visual__catalog"
          key={`${image.url}#${attempt}`}
          src={image.url}
          srcSet={image.srcSet}
          sizes="(max-width: 600px) 100vw, 960px"
          alt={`Иллюстрация: ${title}`}
          decoding="async"
          referrerPolicy="no-referrer"
          onLoad={() => setLoadedImage(image.url)}
          onError={() => {
            if (retrying === image.url) setFailedImage(image.url)
            else {
              setAttempt(0)
              setRetrying(image.url)
            }
          }}
        />
      )}
      <figcaption>
        {shown && image && illustration ? (
          <>
            {illustration.exact ? `Иллюстрация: ${title} · это не фото вашего автомобиля` : `Иллюстрация модели ${title} · поколение, рестайлинг и кузов могут отличаться`}
            {/* атрибуция по условиям лицензии: автор, источник, лицензия и пометка об изменениях */}
            <span className="car-visual__credit">
              <a href={image.page} target="_blank" rel="noopener noreferrer">
                Фото: {image.author} · Wikimedia Commons
              </a>
              {' · '}
              {licenceLink ? (
                <a href={licenceLink} target="_blank" rel="noopener noreferrer license">
                  {image.licence}
                </a>
              ) : (
                image.licence
              )}
              {' · обрезано, цвет приглушён'}
            </span>
          </>
        ) : photo ? (
          'Фото не удалось загрузить · обновите страницу'
        ) : body ? (
          `Иллюстрация кузова: ${BODY_LABELS[body].toLowerCase()} · это не фото вашего автомобиля`
        ) : (
          'Фото не добавлено · тип кузова не выбран'
        )}
      </figcaption>
    </figure>
  )
}
