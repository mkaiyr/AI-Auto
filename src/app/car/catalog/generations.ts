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
  /** подтверждённый рестайлинг: год начала и фотография обновлённой версии */
  facelift: { from: number; image: CarImage | null } | null
  /** в источнике у поколения описан рестайлинг, но в справочнике он не выделен: годы и фото не подтверждены */
  faceliftUnlisted: boolean
}

export interface ModelGenerations {
  /** статья-источник */
  source: string
  /** фотография модели в целом, без привязки к поколению */
  image: CarImage | null
  items: Generation[]
  /** в источнике описаны не все поколения: единственный найденный вариант нельзя считать верным */
  partial: boolean
}

/** Вариант в списке «Поколение / код кузова» */
export interface GenerationOption {
  /** значение, которое сохраняется в профиле автомобиля */
  value: string
  label: string
  generation: Generation
  /** тип кузова, если код относится к одному кузову */
  body: BodyType | null
  /** годы выпуска именно этого варианта: у рестайлинга они свои */
  from: number
  to: number | null
  /** true — обновлённая версия того же поколения */
  restyled: boolean
}

export type MakeGenerations = Record<string, ModelGenerations>

type RawImage = [string, string, string]
interface RawGeneration {
  o: number
  c: [string, string][]
  f: number
  t: number
  i?: RawImage
  r?: [number, RawImage?]
  x?: number
}
interface RawModel {
  s: string
  i?: RawImage
  p?: number
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
      .then((files): Promise<Record<string, RawModel>> | Record<string, RawModel> => (files[make] ? getJson<Record<string, RawModel>>(base() + files[make]) : {}))
      .then((data) => {
        const result: MakeGenerations = {}
        for (const [model, raw] of Object.entries(data)) {
          result[model] = {
            source: `https://en.wikipedia.org/wiki/${encodeURIComponent(raw.s)}`,
            image: toImage(raw.i),
            partial: raw.p === 1,
            items: raw.g.map((row) => ({
              ordinal: row.o,
              codes: row.c.map(([code, note]) => ({ code, note })),
              from: row.f,
              to: row.t || null,
              image: toImage(row.i),
              facelift: row.r ? { from: row.r[0], image: toImage(row.r[1]) } : null,
              faceliftUnlisted: row.x === 1,
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

export const generationYears = (item: { from: number; to: number | null }) => `${item.from}–${item.to ?? 'н. в.'}`

/** Пометка обновлённой версии в сохраняемом значении: «DN8 FL» */
const RESTYLED_SUFFIX = ' FL'

/** Как показать сохранённое значение человеку: «DN8 FL» → «DN8 FL (рестайлинг)» */
export const generationTitle = (value: string) => (value.endsWith(RESTYLED_SUFFIX) ? `${value} (рестайлинг)` : value)

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
 *
 * Поколение с подтверждённым рестайлингом делится на два варианта с одним кодом кузова:
 * «DN8 · до рестайлинга · 2019–2023» и «DN8 FL (рестайлинг) · 2023–н. в.». Это не два поколения:
 * у обоих вариантов одно и то же поле generation.
 */
export function generationOptions(model: ModelGenerations | null): GenerationOption[] {
  const options: GenerationOption[] = []
  for (const generation of model?.items ?? []) {
    const number = generation.ordinal > 0 ? `${roman(generation.ordinal)} поколение` : ''
    const { codes, facelift } = generation
    // [сохраняемое значение, название в списке, тип кузова]
    const variants: [string, string, BodyType | null][] = []
    if (codes.length > 1 && codes.some((item) => item.note !== '')) {
      for (const { code, note } of codes) variants.push([code, note ? ` — ${note}` : '', bodyOf(note)])
    } else if (codes.length > 0 && (codes.length <= MAX_JOINED || generation.ordinal === 0)) {
      variants.push([codes.slice(0, MAX_JOINED).map((item) => item.code).join('/'), '', bodyOf(codes[0].note)])
    } else if (generation.ordinal > 0) {
      // кодов нет или их слишком много для одного значения — поколение называется по номеру
      const list = codes.length > 0 ? ` (${codes.slice(0, MAX_JOINED).map((item) => item.code).join(', ')}…)` : ''
      variants.push([roman(generation.ordinal), ` поколение${list}`, null])
    }
    for (const [value, suffix, body] of variants) {
      const named = value === roman(generation.ordinal) && suffix.startsWith(' поколение')
      const add = (option: Omit<GenerationOption, 'generation' | 'body' | 'label'>, name: string, note: string) => {
        if (options.some((other) => other.value === option.value)) return
        const label = [name, note, named ? '' : number, generationYears(option)].filter(Boolean).join(' · ')
        options.push({ ...option, label, generation, body })
      }
      if (!facelift) {
        add({ value, from: generation.from, to: generation.to, restyled: false }, value + suffix, '')
        continue
      }
      // в год рестайлинга выпускались обе версии, поэтому годы вариантов пересекаются на этот год
      add({ value, from: generation.from, to: facelift.from, restyled: false }, value + suffix, 'до рестайлинга')
      add({ value: value + RESTYLED_SUFFIX, from: facelift.from, to: generation.to, restyled: true }, `${generationTitle(value + RESTYLED_SUFFIX)}${suffix}`, '')
    }
  }
  return options
}

export const coversYear = (item: { from: number; to: number | null }, year: number) => year >= item.from && (item.to === null || year <= item.to)

/** Варианты, которые выпускались в указанном году. Несколько — значит, год переходный, был рестайлинг или у кузовов разные коды */
export const optionsForYear = (options: GenerationOption[], year: number) => options.filter((option) => coversYear(option, year))

/** Фотография варианта: у обновлённой версии своя; если её нет, снимок до рестайлинга за неё не выдаётся */
const optionImage = (option: GenerationOption) => (option.restyled ? option.generation.facelift?.image ?? null : option.generation.image)

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
  const options = generationOptions(model)
  const option = generation ? options.find((item) => item.value === generation) : undefined
  if (option) {
    const image = optionImage(option)
    if (image) return { image, exact: true }
    // обновлённая версия без собственного снимка: показываем поколение, но не выдаём за точное фото
    if (option.generation.image) return { image: option.generation.image, exact: false }
  }
  const chosen = option ? option.generation : findGeneration(model, generation)
  if (!option && chosen?.image) return { image: chosen.image, exact: true }
  if (year !== null && !chosen) {
    const byYear = options.filter((item) => coversYear(item, year) && optionImage(item))
    const images = new Set(byYear.map((item) => optionImage(item)?.url))
    // в переходный год ближе всего по времени вариант, который начался позже остальных
    const nearest = byYear.sort((a, b) => b.from - a.from)[0]
    const image = nearest && optionImage(nearest)
    if (image) return { image, exact: images.size === 1 && !model.partial }
  }
  return model.image ? { image: model.image, exact: false } : null
}
