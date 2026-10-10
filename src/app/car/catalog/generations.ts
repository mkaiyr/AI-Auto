// Справочник поколений, кодов кузова и иллюстраций.
//
// Данные лежат в public/car-generations/ и собираются скриптом scripts/build-car-generations.mjs
// из карточек английской Википедии (коды и годы) и Wikimedia Commons (фотографии со свободной лицензией).
// На каждую марку — свой файл: он подгружается, когда марка выбрана в форме или открыт автомобиль этой марки.
//
// Годы — производство на всех рынках сразу, поэтому поколения перекрываются: в переходный год
// форма предлагает несколько вариантов на выбор, а не угадывает один.
// Ключи — названия марки и модели в том виде, в каком они записаны в public/car-catalog.json.

import type { BodyType } from '../carStore'

export interface CarImage {
  /** уменьшенная копия шириной 960 px */
  url: string
  srcSet: string
  /** страница файла на Wikimedia Commons: автор, лицензия, оригинал */
  page: string
  author: string
  licence: string
}

export interface GenerationCode {
  code: string
  /** к какому кузову относится код, например «универсал»; пусто — ко всем */
  note: string
}

export interface Generation {
  /** порядковый номер поколения; 0 — в источнике не указан */
  ordinal: number
  codes: GenerationCode[]
  from: number
  /** null — выпускается */
  to: number | null
  image: CarImage | null
}

export interface ModelGenerations {
  /** статья-источник */
  source: string
  /** фотография модели в целом, без привязки к поколению */
  image: CarImage | null
  items: Generation[]
}

/** Вариант в списке «Поколение / код кузова» */
export interface GenerationOption {
  /** значение, которое сохраняется в профиле автомобиля */
  value: string
  label: string
  generation: Generation
  /** тип кузова, если код относится к одному кузову */
  body: BodyType | null
}

export type MakeGenerations = Record<string, ModelGenerations>

type RawImage = [string, string, string]
interface RawGeneration {
  o: number
  c: [string, string][]
  f: number
  t: number
  i?: RawImage
}
interface RawModel {
  s: string
  i?: RawImage
  g: RawGeneration[]
}

const THUMBS = 'https://upload.wikimedia.org/wikipedia/commons/thumb/'

function toImage(raw: RawImage | undefined): CarImage | null {
  if (!raw) return null
  const [path, author, licence] = raw
  // путь уже закодирован для адреса — так его отдаёт Wikimedia
  const url = THUMBS + path
  return {
    url,
    srcSet: `${url.replace('/960px-', '/500px-')} 500w, ${url} 960w`,
    page: `https://commons.wikimedia.org/wiki/File:${path.split('/')[2] ?? ''}`,
    author,
    licence,
  }
}

const base = () => `${import.meta.env.BASE_URL}car-generations/`

let index: Promise<Record<string, string>> | null = null
const makes = new Map<string, Promise<MakeGenerations>>()

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return (await response.json()) as T
}

/**
 * Поколения всех моделей марки. Для марки, которой нет в справочнике, — пустой объект.
 * Загружается один раз за сеанс; при сбое следующая попытка запросит данные снова.
 */
export function loadGenerations(make: string): Promise<MakeGenerations> {
  if (make === '') return Promise.resolve({})
  let loading = makes.get(make)
  if (!loading) {
    index ??= getJson<{ makes: Record<string, string> }>(`${base()}index.json`).then((data) => data.makes)
    loading = index
      .then((files) => (files[make] ? getJson<Record<string, RawModel>>(base() + files[make]) : {}))
      .then((data) => {
        const result: MakeGenerations = {}
        for (const [model, raw] of Object.entries(data)) {
          result[model] = {
            source: `https://en.wikipedia.org/wiki/${encodeURIComponent(raw.s)}`,
            image: toImage(raw.i),
            items: raw.g.map((row) => ({
              ordinal: row.o,
              codes: row.c.map(([code, note]) => ({ code, note })),
              from: row.f,
              to: row.t || null,
              image: toImage(row.i),
            })),
          }
        }
        return result
      })
      .catch((error) => {
        index = null
        makes.delete(make)
        throw error
      })
    makes.set(make, loading)
  }
  return loading
}

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI']
const roman = (ordinal: number) => ROMAN[ordinal] ?? String(ordinal)

export const generationYears = (item: Generation) => `${item.from}–${item.to ?? 'н. в.'}`

const NOTE_BODIES: [string, BodyType][] = [
  ['седан', 'sedan'],
  ['универсал', 'wagon'],
  ['хэтчбек', 'hatchback'],
  ['лифтбек', 'liftback'],
  ['купе', 'coupe'],
  ['пикап', 'pickup'],
  ['минивэн', 'minivan'],
  ['внедорожник', 'suv'],
]
const bodyOf = (note: string) => NOTE_BODIES.find(([word]) => note.startsWith(word))?.[1] ?? null

/** Сколько кодов помещается в одно сохраняемое значение («E120/E130») */
const MAX_JOINED = 3

/**
 * Варианты для списка. У поколения их несколько, если разным кузовам присвоены разные коды
 * (F30 — седан, F31 — универсал); иначе вариант один и коды записаны вместе.
 */
export function generationOptions(model: ModelGenerations | null): GenerationOption[] {
  const options: GenerationOption[] = []
  const add = (option: GenerationOption) => {
    if (!options.some((other) => other.value === option.value)) options.push(option)
  }
  for (const generation of model?.items ?? []) {
    const years = generationYears(generation)
    const number = generation.ordinal > 0 ? `${roman(generation.ordinal)} поколение` : ''
    const { codes } = generation
    if (codes.length > 1 && codes.some((item) => item.note !== '')) {
      for (const { code, note } of codes) {
        add({ value: code, label: [note ? `${code} — ${note}` : code, number, years].filter(Boolean).join(' · '), generation, body: bodyOf(note) })
      }
    } else if (codes.length > 0 && (codes.length <= MAX_JOINED || generation.ordinal === 0)) {
      const value = codes.slice(0, MAX_JOINED).map((item) => item.code).join('/')
      add({ value, label: [value, number, years].filter(Boolean).join(' · '), generation, body: bodyOf(codes[0].note) })
    } else if (generation.ordinal > 0) {
      // кодов нет или их слишком много для одного значения — поколение называется по номеру
      const list = codes.length > 0 ? ` (${codes.slice(0, MAX_JOINED).map((item) => item.code).join(', ')}…)` : ''
      add({ value: roman(generation.ordinal), label: `${number}${list} · ${years}`, generation, body: null })
    }
  }
  return options
}

export const coversYear = (generation: Generation, year: number) => year >= generation.from && (generation.to === null || year <= generation.to)

/** Варианты, которые выпускались в указанном году. Несколько — значит, год переходный или у кузовов разные коды */
export const optionsForYear = (options: GenerationOption[], year: number) => options.filter((option) => coversYear(option.generation, year))

/** Поколение по сохранённому значению: точное совпадение с вариантом списка или с одним из кодов */
export function findGeneration(model: ModelGenerations | null, stored: string | null): Generation | null {
  if (!model || !stored) return null
  const exact = generationOptions(model).find((option) => option.value === stored)
  if (exact) return exact.generation
  const tokens = stored.split(/[\s/,]+/).filter(Boolean)
  return model.items.find((generation) => generation.codes.some((item) => tokens.includes(item.code))) ?? null
}

export interface Illustration {
  image: CarImage
  /** true — фотография именно этого поколения; false — модели в целом или соседнего поколения */
  exact: boolean
}

/**
 * Иллюстрация для автомобиля из справочника. Сначала — фото сохранённого поколения, затем поколения,
 * подходящего по году, затем общее фото модели. Чужая модель не подставляется никогда.
 */
export function pickIllustration(model: ModelGenerations | null, generation: string | null, year: number | null): Illustration | null {
  if (!model) return null
  const chosen = findGeneration(model, generation)
  if (chosen?.image) return { image: chosen.image, exact: true }
  if (year !== null && !chosen) {
    const byYear = model.items.filter((item) => item.image && coversYear(item, year))
    // в переходный год ближе всего по времени поколение, которое началось позже остальных
    const nearest = byYear.sort((a, b) => b.from - a.from)[0]
    if (nearest?.image) return { image: nearest.image, exact: byYear.length === 1 }
  }
  return model.image ? { image: model.image, exact: false } : null
}
