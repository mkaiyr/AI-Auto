// Собирает справочник поколений, кодов кузова и иллюстраций: public/car-generations/.
//
// Источники:
//   * английская Википедия — карточки {{Infobox automobile}} в статьях о моделях и поколениях:
//     заводской код (model_code), годы производства (production), типы кузова, файл фотографии.
//     Тексты Википедии распространяются по лицензии CC BY-SA 4.0; из них берутся только факты
//     (коды и годы), ссылка на статью-источник сохраняется для каждой модели;
//   * Wikimedia Commons — фотографии поколений. Для каждого файла запрашиваются автор и лицензия;
//     в справочник попадают только свободные лицензии (CC BY, CC BY-SA, CC0, общественное достояние).
//
// Модели берутся из public/car-catalog.json. Статья принимается, только если её название
// совпадает с «Марка Модель» (или указано в ALIASES ниже) — чтобы не приписать модели чужие поколения.
// Ничего не домысливается: нет карточки с годами — нет поколения; нет кода в карточке — код не указан.
//
// Запуск:  node scripts/build-car-generations.mjs
// Запускается вручную, когда нужно обновить справочник. В сборку сайта не входит.
// Ответы Википедии кешируются во временной папке; --fresh запрашивает всё заново.

import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const CATALOG = 'public/car-catalog.json'
const OUTPUT_DIR = 'public/car-generations'
const CACHE_DIR = join(tmpdir(), 'ai-auto-wiki-cache')
const USER_AGENT = 'AIAutoCatalogBuilder/1.0 (https://github.com/mkaiyr/AI-Auto)'
const THIS_YEAR = new Date().getFullYear()
const FRESH = process.argv.includes('--fresh')
const REVIEW = process.argv.find((arg) => arg.startsWith('--review='))?.slice(9)
// журнал сборки для ручной проверки: что определено автоматически и что отброшено
const LOG = 'docs/car-catalog-build-log.md'
const log = { facelifts: [], verified: [], skippedFacelifts: 0, rejectedPhotos: [], otherModelPhotos: [], movedPhotos: [], corrections: [] }

// Название марки в Википедии, если оно отличается от каталога
const MAKE_NAMES = {
  'Lada (ВАЗ)': ['Lada', 'VAZ-'],
  ГАЗ: ['GAZ-', 'GAZ'],
  УАЗ: ['UAZ', 'UAZ-'],
  ЗАЗ: ['ZAZ', 'ZAZ-'],
  Москвич: ['Moskvitch', 'Moskvich'],
  Иж: ['IZh', 'IZh-'],
  ТагАЗ: ['TagAZ'],
  'Li Auto (Lixiang)': ['Li Auto', 'Li'],
  'IM Motors (Zhiji)': ['IM'],
  'Mercedes-Benz': ['Mercedes-Benz'],
  SsangYong: ['SsangYong', 'KGM'],
  'Land Rover': ['Land Rover', 'Range Rover'],
}

// Русские названия моделей каталога → названия в Википедии
const MODEL_NAMES = [
  [/^(.+)-Класс$/, '$1-Class'],
  [/^(\d) серии$/, '$1 Series'],
  [/^Патриот$/, 'Patriot'],
  [/^Хантер$/, 'Hunter'],
  [/^Пикап$/, 'Pickup'],
]

// Модели, статья о которых называется иначе: тот же автомобиль под другим именем или маркой.
// Список составлен вручную. only — коды поколений, которые продавались именно под этим именем
// (остальные поколения статьи к модели не относятся). Без only поколения отбираются по годам модели из каталога.
const ALIASES = {
  'Chery|Tiggo 4': { title: 'Chery Tiggo 5x' },
  'Chery|Tiggo 4 Pro': { title: 'Chery Tiggo 5x' },
  'Chery|Tiggo 7 Pro': { title: 'Chery Tiggo 7' },
  'Chery|Tiggo 8 Pro': { title: 'Chery Tiggo 8' },
  'Chevrolet|Lacetti': { title: 'Daewoo Lacetti' },
  'Chevrolet|Niva': { title: 'Lada Niva Travel' },
  'Daewoo|Matiz': { title: 'Chevrolet Spark', only: ['M100', 'M150'] },
  'Geely|Atlas': { title: 'Geely Boyue' },
  'Geely|Coolray': { title: 'Geely Binyue' },
  'Geely|Monjaro': { title: 'Geely Xingyue L' },
  'Geely|Okavango': { title: 'Geely Haoyue' },
  'Geely|Tugella': { title: 'Geely Xingyue' },
  'Honda|Jazz': { title: 'Honda Fit' },
  'Honda|Odyssey': { title: 'Honda Odyssey (international)' },
  'Honda|Vezel': { title: 'Honda HR-V' },
  'Hyundai|Avante': { title: 'Hyundai Elantra' },
  'Hyundai|Grand Starex': { title: 'Hyundai Starex', only: ['TQ'] },
  'Hyundai|H-1': { title: 'Hyundai Starex' },
  'Hyundai|ix35': { title: 'Hyundai Tucson', only: ['LM'] },
  'Hyundai|Solaris': { title: 'Hyundai Accent', only: ['RB', 'HC'] },
  'Infiniti|EX': { title: 'Infiniti QX50', only: ['J50'] },
  'Infiniti|FX': { title: 'Infiniti QX70' },
  'Kia|Magentis': { title: 'Kia K5', only: ['MS', 'MG'] },
  'Kia|Morning': { title: 'Kia Picanto' },
  'Kia|Optima': { title: 'Kia K5', only: ['MS', 'MG', 'TF', 'JF'] },
  'Kia|Quoris': { title: 'Kia K9', only: ['KH'] },
  'Kia|Sedona': { title: 'Kia Carnival' },
  'Lada (ВАЗ)|2121 (4x4)': { title: 'Lada Niva' },
  'Lada (ВАЗ)|Niva Legend': { title: 'Lada Niva' },
  'Lada (ВАЗ)|Niva Travel': { title: 'Lada Niva Travel' },
  'Land Rover|Range Rover': { title: 'Range Rover' },
  'Land Rover|Range Rover Evoque': { title: 'Range Rover Evoque' },
  'Land Rover|Range Rover Sport': { title: 'Range Rover Sport' },
  'Land Rover|Range Rover Velar': { title: 'Range Rover Velar' },
  'Mercedes-Benz|GL-Класс': { title: 'Mercedes-Benz GLS' },
  'Mercedes-Benz|M-Класс': { title: 'Mercedes-Benz GLE' },
  'Mitsubishi|Airtrek': { title: 'Mitsubishi Outlander', only: ['CU'] },
  'Mitsubishi|L200': { title: 'Mitsubishi Triton' },
  'Mitsubishi|Montero': { title: 'Mitsubishi Pajero' },
  'Mitsubishi|Montero Sport': { title: 'Mitsubishi Pajero Sport' },
  'Nissan|Bluebird Sylphy': { title: 'Nissan Sylphy' },
  'Nissan|Dualis': { title: 'Nissan Qashqai', only: ['J10'] },
  'Nissan|March': { title: 'Nissan Micra' },
  'Nissan|Safari': { title: 'Nissan Patrol' },
  'Ravon|Matiz': { title: 'Chevrolet Spark', only: ['M100', 'M150'] },
  'Ravon|Nexia R3': { title: 'Chevrolet Aveo', only: ['T250'] },
  'Ravon|R2': { title: 'Chevrolet Spark', only: ['M300'] },
  'Ravon|R4': { title: 'Chevrolet Cobalt' },
  'Renault|Duster': { title: 'Dacia Duster' },
  'Renault|Logan': { title: 'Dacia Logan' },
  'Renault|Sandero': { title: 'Dacia Sandero' },
  'Toyota|Altezza': { title: 'Lexus IS', only: ['XE10'] },
  'Toyota|Celsior': { title: 'Lexus LS' },
  'Toyota|Estima': { title: 'Toyota Previa' },
  'Toyota|Hilux Surf': { title: 'Toyota 4Runner' },
  'Toyota|Kluger': { title: 'Toyota Highlander' },
  'Toyota|Vellfire': { title: 'Toyota Alphard' },
  'Toyota|Windom': { title: 'Lexus ES' },
  'Volkswagen|Bora': { title: 'Volkswagen Jetta', only: ['1J'] },
  'Volkswagen|Teramont': { title: 'Volkswagen Atlas' },
  'УАЗ|Патриот': { title: 'UAZ Patriot' },
  'УАЗ|Хантер': { title: 'UAZ Hunter' },
}

// Исправления, проверенные вручную, для случаев, когда карточка статьи объединяет разные автомобили.
// split — код выделяется из общего поколения в отдельное со своими годами.
const CORRECTIONS = {
  // Almera G15 выпускалась только в России (АвтоВАЗ, 2012–2018). В статье она описана в одной
  // карточке с японской Bluebird Sylphy G11 (2005–2012), из-за чего годы получались общими: 2005–2019.
  'Nissan|Almera': { split: [{ code: 'G15', from: 2012, to: 2018 }] },
}

// Рестайлинги, проверенные вручную. Рестайлинг — не новое поколение: код кузова тот же, меняются
// внешность и годы. В справочник попадают только подтверждённые случаи; остальные поколения с разделом
// «Facelift» в статье лишь помечаются (см. FACELIFT_HEADING), даты для них не выдумываются.
//   code  — код поколения, к которому относится рестайлинг;
//   from  — первый год, когда обновлённая версия выпускалась или продавалась;
//   image — фотография именно обновлённой версии (файл Wikimedia Commons из раздела «Facelift» статьи).
const FACELIFTS = {
  'Hyundai|Sonata': [
    {
      // Обновлённая Sonata DN8 («Sonata The Edge») показана 26 марта 2023 года на Seoul Mobility Show,
      // в Северной Америке представлена 30 августа 2023 года (en.wikipedia.org/wiki/Hyundai_Sonata, раздел
      // «Eighth generation → Facelift»); официальные продажи в Казахстане — с октября 2023 года.
      code: 'DN8',
      from: 2023,
      image: '2024 Hyundai Sonata (facelift), front.jpg',
    },
  ],
}

/** Имя файла говорит, что это не вид спереди: «rear», «interior», немецкое «– h» (hinten) */
const NOT_FRONT = /rear|interior|innenraum|cockpit|dashboard|heck|engine|[–-]\s*h\d?\s+\d{6,8}/i
/** Упоминание рестайлинга в тексте раздела — без даты это только повод для предупреждения */
const FACELIFT_MENTION = /\bfacelift(ed)?\b|\brefresh(ed)?\b|mid-cycle|\bLCI\b|restyl/i

/** Подзаголовок, говорящий о рестайлинге поколения */
const FACELIFT_HEADING = /facelift|refresh|restyl|mid-cycle|\bLCI\b|life cycle impulse/i

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// ---------- запросы к API с кешем ----------

async function api(host, params) {
  const query = new URLSearchParams({ format: 'json', formatversion: '2', ...params }).toString()
  const file = join(CACHE_DIR, createHash('sha1').update(host + query).digest('hex') + '.json')
  if (!FRESH && existsSync(file)) return JSON.parse(readFileSync(file, 'utf8'))
  for (let attempt = 1; ; attempt++) {
    try {
      const response = await fetch(`https://${host}/w/api.php?${query}`, { headers: { 'User-Agent': USER_AGENT } })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const data = await response.json()
      if (data.error) throw new Error(data.error.info)
      writeFileSync(file, JSON.stringify(data), 'utf8')
      await sleep(120)
      return data
    } catch (error) {
      if (attempt >= 4) throw error
      await sleep(2000 * attempt)
    }
  }
}

/** Тексты статей по названиям. Возвращает Map: запрошенное название → { title, text } */
async function fetchArticles(titles) {
  const result = new Map()
  const unique = [...new Set(titles)]
  for (let offset = 0; offset < unique.length; offset += 50) {
    const batch = unique.slice(offset, offset + 50)
    const forward = new Map(batch.map((title) => [title, { title, fragment: false }]))
    const texts = new Map()
    let next = {}
    do {
      const data = await api('en.wikipedia.org', { action: 'query', prop: 'revisions', rvprop: 'content', rvslots: 'main', redirects: '1', titles: batch.join('|'), ...next })
      const step = (list) => {
        for (const item of list ?? []) {
          for (const entry of forward.values()) if (entry.title === item.from) Object.assign(entry, { title: item.to, fragment: entry.fragment || Boolean(item.tofragment) })
        }
      }
      step(data.query?.normalized)
      step(data.query?.redirects)
      for (const page of data.query?.pages ?? []) {
        const text = page.revisions?.[0]?.slots?.main?.content
        if (text) texts.set(page.title, text)
      }
      next = data.continue ?? null
    } while (next)
    for (const [asked, entry] of forward) {
      // перенаправление на раздел другой статьи — это не статья о самой модели
      if (!entry.fragment && texts.has(entry.title)) result.set(asked, { title: entry.title, text: texts.get(entry.title) })
    }
    process.stdout.write(`\r  статьи: ${Math.min(offset + 50, unique.length)}/${unique.length}`)
  }
  process.stdout.write('\n')
  return result
}

// ---------- разбор вики-разметки ----------

function findTemplates(text, name) {
  const found = []
  const pattern = new RegExp('\\{\\{\\s*' + name + '\\b', 'gi')
  let match
  while ((match = pattern.exec(text))) {
    let depth = 0
    let index = match.index
    for (; index < text.length; index++) {
      if (text.startsWith('{{', index)) {
        depth++
        index++
      } else if (text.startsWith('}}', index)) {
        depth--
        index++
        if (depth === 0) break
      }
    }
    found.push({ start: match.index, body: text.slice(match.index, index + 1) })
    pattern.lastIndex = index
  }
  return found
}

function templateParams(body) {
  const inner = body.slice(2, -2)
  const parts = []
  let depth = 0
  let last = 0
  for (let index = 0; index < inner.length; index++) {
    const pair = inner.substr(index, 2)
    if (pair === '{{' || pair === '[[') {
      depth++
      index++
    } else if (pair === '}}' || pair === ']]') {
      depth--
      index++
    } else if (inner[index] === '|' && depth === 0) {
      parts.push(inner.slice(last, index))
      last = index + 1
    }
  }
  parts.push(inner.slice(last))
  const params = {}
  for (const part of parts.slice(1)) {
    const equals = part.indexOf('=')
    if (equals > 0) params[part.slice(0, equals).trim().toLowerCase()] = part.slice(equals + 1).trim()
  }
  return params
}

/** Убирает сноски, комментарии и оформление; списки и переносы превращает в строки */
function plainLines(value) {
  let text = String(value ?? '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<ref[^>]*\/>/gi, '')
    .replace(/<ref[\s\S]*?<\/ref>/gi, '')
    .replace(/<ref[\s\S]*$/i, '')
    .replace(/\{\{\s*(?:efn|sfn|refn|citation needed|cn|pad|nbsp|snd)[^{}]*\}\}/gi, ' ')
    .replace(/&ndash;|&mdash;|—|−/g, '–')
    .replace(/&nbsp;/g, ' ')
  // списки {{ubl|a|b}}, {{plainlist|* a * b}} → строки
  for (let pass = 0; pass < 4; pass++) {
    text = text.replace(/\{\{\s*(?:ubl|ublist|hlist|[a-z ]*list)\s*\|([^{}]*)\}\}/gi, (_, items) => '\n' + items.replace(/\|/g, '\n') + '\n')
    text = text.replace(/\{\{[^{}]*\}\}/g, ' ')
  }
  return text
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1')
    .replace(/'{2,}/g, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .split(/\n|\*/)
    .map((line) => line.replace(/^\s*(?:title|titlestyle|list_style|expand)\s*=.*$/i, '').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
}

const YEAR = /\b(19[0-9]{2}|20[0-4][0-9])\b/g
const OPEN_END = /present|to commence|ongoing|current/i

/**
 * Годы производства по всем рынкам сразу: от самого раннего года до самого позднего.
 * Широкий диапазон выбран намеренно: автомобиль мог быть выпущен на любом из заводов,
 * и узкие «основные» годы исключили бы настоящие варианты.
 */
function parseYears(value) {
  let from = null
  let to
  let min = null
  let max = null
  let open = false
  for (const line of plainLines(value)) {
    const years = [...line.matchAll(YEAR)].map((match) => Number(match[1])).filter((year) => year >= 1930 && year <= THIS_YEAR + 2)
    if (years.length === 0) continue
    const lineOpen = OPEN_END.test(line)
    if (from === null) {
      from = years[0]
      // один год в строке — известно только начало выпуска, окончание определяется позже
      to = lineOpen ? null : years.length > 1 ? Math.max(...years) : undefined
    }
    open ||= lineOpen
    min = min === null ? Math.min(...years) : Math.min(min, ...years)
    max = max === null ? Math.max(...years) : Math.max(max, ...years)
  }
  if (from === null) return null
  // to: null — выпускается, undefined — год окончания в карточке не указан
  // Начало — первый год основной строки: более ранние годы в следующих строках обычно относятся
  // к предшественнику или к другой модели. Окончание — самый поздний год по всем рынкам.
  return { from, to: open ? null : to === undefined && max === from ? undefined : Math.max(max, from) }
}

const NOT_CODES = new Set(
  'GMT GMC VAZ GAZ UAZ SUV LWB SWB JDM USA UK EU GT GTI GTS RS AMG MPV EV PHEV HEV BEV FWD AWD RWD CKD SKD II III IV VI VII VIII IX XL US UAE CIS LHD RHD TBA TBD CUV LCV SAV GM VW BMW KDM ASEAN FCEV CNG LPG MHEV DOHC SOHC CVT SE LE XLE LX EX GL GLS GLX SR SRT ST XR SV SL7 MK MKI MKII'.split(' '),
)

function isCode(token) {
  if (NOT_CODES.has(token) || /^(19|20)\d\d$/.test(token) || token.length > 8) return false
  return /^(?=.*\d)[A-Z][A-Z0-9-]{1,7}$/.test(token) || /^(?=.*[A-Z])[0-9][A-Z0-9]{1,3}$/.test(token) || /^[A-Z]{2,3}$/.test(token)
}

const BODY_NOTES = [
  [/long[- ]wheelbase|\blwb\b|extended/i, 'удлинённый'],
  [/sedan|saloon|limousine/i, 'седан'],
  [/wagon|estate|touring|avant|variant|shooting brake|kombi/i, 'универсал'],
  [/hatchback|compact/i, 'хэтчбек'],
  [/liftback|fastback|gran turismo|sportback|gran coup/i, 'лифтбек'],
  [/coup[eé]/i, 'купе'],
  [/convertible|cabrio|roadster|spider|spyder/i, 'кабриолет'],
  [/pickup|pick-up/i, 'пикап'],
  [/\bvan\b|minivan|mpv/i, 'минивэн'],
  [/suv|crossover/i, 'внедорожник'],
]

function bodyNote(text) {
  const notes = BODY_NOTES.filter(([pattern]) => pattern.test(text)).map(([, note]) => note)
  // «удлинённый седан», но не «седан купе»
  if (notes[0] === 'удлинённый') return notes.length > 1 ? `${notes[1]}, удлинённый` : 'удлинённый'
  return notes.length === 1 ? notes[0] : notes.length > 1 && /gran coup/i.test(text) ? 'лифтбек' : notes.length > 1 ? notes[0] : ''
}

// «W 210», «S 210» — тот же код, записанный через пробел
const joinSpaced = (text) => text.replace(/\b([A-Z]{1,2}) (\d{2,3})\b/g, '$1$2')
const words = (text) => joinSpaced(text).split(/[\s,;/()]+| and | or /).filter(Boolean)

/** Коды из поля model_code: «F30 (sedan)», «A40<br>A50», «E120 / E130» */
function codesFromField(value) {
  const codes = []
  for (const line of plainLines(value)) {
    // примечание в скобках относится к кодам перед ним
    for (const piece of line.match(/[^()]+(?:\([^()]*\))?/g) ?? []) {
      const note = piece.match(/\(([^()]*)\)/)?.[1] ?? ''
      const head = piece.replace(/\([^()]*\)/, '')
      const inNote = words(note).filter(isCode)
      for (const token of words(head)) if (isCode(token)) codes.push([token, bodyNote(note)])
      // «Saloon (W213)» — код в скобках, кузов перед ними
      if (codes.length === 0 || !words(head).some(isCode)) for (const token of inNote) codes.push([token, bodyNote(head)])
    }
  }
  return codes
}

const stripHeading = (heading) => plainLines(heading).join(' ')

/** Коды из заголовка раздела или названия: «XV70 (2017–2024)», «Second generation (V20, V30; 1991)» */
function codesFromTitle(value) {
  const text = stripHeading(value)
  const codes = []
  const inside = text.match(/\(([^()]*)\)\s*$/)?.[1] ?? ''
  const before = text.replace(/\([^()]*\)\s*$/, '')
  for (const token of [...words(before), ...words(inside)]) if (isCode(token) && !codes.includes(token)) codes.push(token)
  return codes.map((code) => [code, ''])
}

const ORDINALS = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth', 'eleventh', 'twelfth', 'thirteenth', 'fourteenth', 'fifteenth', 'sixteenth']

function ordinalOf(...texts) {
  for (const text of texts) {
    const plain = stripHeading(text ?? '')
    const match = plain.match(/\b(\w+)[- ]generation\b/i)
    const index = match ? ORDINALS.indexOf(match[1].toLowerCase()) : -1
    if (index !== -1) return index + 1
    const mark = plain.match(/\bMk\s?(\d{1,2})\b/)
    if (mark) return Number(mark[1])
  }
  return 0
}

function imageName(value) {
  const name = String(value ?? '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/^\s*\[\[/, '')
    .split('|')[0]
    .replace(/\]\]\s*$/, '')
    .replace(/^\s*(?:File|Image)\s*:/i, '')
    .replace(/_/g, ' ')
    .trim()
  return /\.(jpe?g|png)$/i.test(name) ? name[0].toUpperCase() + name.slice(1) : null
}

const SKIP_SECTION = /concept|motorsport|racing|rally|prototype|safety|sales|award|engine|powertrain|reception|marketing|recall|show car|in popular/i

/** Разбирает статью: общая карточка и карточки разделов-поколений */
function parseArticle(text) {
  const headings = [...text.matchAll(/^(={2,5})\s*(.+?)\s*\1[ \t]*(?:<!--.*?-->)?[ \t]*$/gm)].map((match) => ({ at: match.index, level: match[1].length, title: match[2] }))
  const sectionOf = (position) => {
    let current = null
    for (const heading of headings) if (heading.at < position) current = heading
    return current
  }
  const boxes = findTemplates(text, 'Infobox (?:automobile|electric vehicle)').map((box) => ({ heading: sectionOf(box.start), params: templateParams(box.body) }))
  const top = boxes.find((box) => box.heading === null)?.params ?? null

  const generations = []
  /** разделы, у которых есть своя карточка с годами выпуска */
  const described = new Set()
  for (const box of boxes) {
    if (!box.heading || SKIP_SECTION.test(stripHeading(box.heading.title))) continue
    const years = parseYears(box.params.production) ?? parseYears(box.params.model_years)
    if (!years) continue
    // есть ли внутри раздела поколения подраздел о рестайлинге
    const startIndex = headings.indexOf(box.heading)
    const faceliftSections = []
    for (let index = startIndex + 1; index < headings.length && headings[index].level > box.heading.level; index++) {
      if (FACELIFT_HEADING.test(stripHeading(headings[index].title))) faceliftSections.push({ title: headings[index].title, body: text.slice(headings[index].at, headings[index + 1]?.at ?? text.length) })
    }
    let sectionEnd = text.length
    for (let index = startIndex + 1; index < headings.length; index++) {
      if (headings[index].level <= box.heading.level) {
        sectionEnd = headings[index].at
        break
      }
    }
    generations.push({ heading: box.heading.title, params: box.params, years, faceliftSections, faceliftMentioned: FACELIFT_MENTION.test(text.slice(box.heading.at, sectionEnd)) })
    described.add(box.heading.at)
  }

  // разделы без собственной карточки, которые ссылаются на отдельную статью о поколении
  const links = []
  headings.forEach((heading, index) => {
    if (heading.level > 3 || SKIP_SECTION.test(stripHeading(heading.title))) return
    const end = headings[index + 1]?.at ?? text.length
    const body = text.slice(heading.at, end)
    if (described.has(heading.at)) return
    for (const template of body.matchAll(/\{\{\s*(?:main|main article|further)\s*\|([^{}]+)\}\}/gi)) {
      for (const part of template[1].split('|')) {
        const target = part.replace(/_/g, ' ').replace(/#.*$/, '').trim()
        if (target && !target.includes('=')) links.push({ heading: heading.title, target })
      }
    }
  })
  // для отдельной статьи о поколении: раздел о рестайлинге где угодно в статье
  const faceliftSections = headings
    .map((heading, index) => ({ title: heading.title, body: text.slice(heading.at, headings[index + 1]?.at ?? text.length) }))
    .filter((section) => FACELIFT_HEADING.test(stripHeading(section.title)))
  return { top, generations, links, faceliftSections, faceliftMentioned: FACELIFT_MENTION.test(text) }
}

/**
 * Рестайлинг по разделу статьи. Принимается только однозначный случай: раздел о рестайлинге один,
 * и год назван либо в его заголовке, либо в первых фразах — причём ровно один. Два рестайлинга,
 * несколько разных лет или год вне выпуска поколения — рестайлинг остаётся неподтверждённым.
 */
function extractFacelift(sections, years) {
  if (!sections || sections.length !== 1) return null
  const [{ title, body }] = sections
  let found = [...stripHeading(title).matchAll(YEAR)].map((match) => Number(match[1]))
  if (found.length === 0) {
    const prose = body
      .replace(/^=+.*=+[ \t]*$/m, '')
      .replace(/<gallery[\s\S]*?<\/gallery>/gi, '')
      .split('\n')
      .filter((line) => !/^\s*(\[\[(File|Image):|\{\{|\||\}\})/i.test(line))
      .join('\n')
    found = [...plainLines(prose).join(' ').slice(0, 320).matchAll(YEAR)].map((match) => Number(match[1]))
  }
  const distinct = [...new Set(found)]
  if (distinct.length !== 1) return null
  const [year] = distinct
  // рестайлинг не совпадает ни с первым, ни с последним годом поколения и не случается через 12+ лет после запуска:
  // такие значения — признак того, что год в тексте относится к чему-то другому
  if (year <= years.from || year - years.from > 12 || (years.to != null && year >= years.to)) return null
  // фотография обновлённой версии — только файл из этого же раздела, в имени которого прямо сказано «facelift»,
  // и только вид спереди: снимки сзади и салона для карточки автомобиля не годятся
  const image = [...body.matchAll(/(?:File|Image):([^|\]\n]+\.(?:jpe?g|png))/gi)].map((match) => imageName(match[1])).find((name) => name && /facelift/i.test(name) && !NOT_FRONT.test(name))
  return { from: year, image: image ?? null, verified: false }
}

/** Первый источник, в котором нашлись коды: от самого точного к самому общему */
function firstCodes(...sources) {
  for (const source of sources) {
    const codes = codesFromTitle(source ?? '')
    if (codes.length > 0) return codes
  }
  return []
}

function buildGeneration(source) {
  const { params, years } = source
  let codes = codesFromField(params.model_code)
  if (codes.length === 0) codes = firstCodes(params.name, source.title, source.heading)
  if (codes.length > 0) {
    // «2-door coupé (C238)» в списке кузовов — отдельный код для этого кузова
    for (const line of plainLines(params.body_style)) {
      const note = line.match(/\(([^()]*)\)/)?.[1] ?? ''
      for (const token of words(note)) {
        if (!isCode(token) || !/\d/.test(token)) continue
        const existing = codes.find((item) => item[0] === token)
        const body = bodyNote(line.replace(/\([^()]*\)/, ''))
        if (existing) existing[1] ||= body
        else if (body) codes.push([token, body])
      }
    }
  }
  codes = codes.filter(([code], index) => codes.findIndex((item) => item[0] === code) === index)
  return {
    ordinal: ordinalOf(params.name, source.heading, source.title),
    codes: codes.slice(0, 8),
    from: years.from,
    to: years.to,
    image: imageName(params.image),
    facelifted: (source.faceliftSections ?? []).length > 0 || Boolean(source.faceliftMentioned),
    facelift: extractFacelift(source.faceliftSections, years),
  }
}

// ---------- сопоставление моделей каталога со статьями ----------

// сравнение названий: без регистра, знаков и диакритики («Škoda» = «Skoda»)
const normal = (text) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\([^()]*\)/g, '').replace(/[^a-z0-9]/g, '')

function titlesFor(make, model) {
  const alias = ALIASES[`${make}|${model}`]
  if (alias) return [alias.title]
  let name = model
  for (const [pattern, replacement] of MODEL_NAMES) name = name.replace(pattern, replacement)
  // «Cruze (HR)», «Passat (North America and China)» — отдельные автомобили, а не общая статья о модели
  if (/[а-яё]/i.test(name) || /[()]/.test(name)) return []
  const makes = MAKE_NAMES[make] ?? [make.replace(/\s*\([^()]*\)\s*$/, '')]
  if (/[а-яё]/i.test(makes[0])) return []
  return makes.map((prefix) => (prefix.endsWith('-') ? prefix + name : `${prefix} ${name}`))
}

// ---------- сборка ----------

const catalog = JSON.parse(readFileSync(CATALOG, 'utf8'))
mkdirSync(CACHE_DIR, { recursive: true })

console.log('1. Статьи о моделях')
const wanted = []
for (const [make, , models] of catalog.makes) for (const [model, , from, to] of models) for (const title of titlesFor(make, model)) wanted.push({ make, model, from, to, title })
const articles = await fetchArticles(wanted.map((item) => item.title))

const models = new Map()
for (const item of wanted) {
  const key = `${item.make}|${item.model}`
  if (models.has(key)) continue
  const article = articles.get(item.title)
  if (!article) continue
  const exact = normal(article.title) === normal(item.title)
  // статья с другим названием принимается только из проверенного списка ALIASES
  if (!exact && !ALIASES[key]) continue
  const parsed = parseArticle(article.text)
  if (!parsed.top && parsed.generations.length === 0) continue
  // модель без разделов-поколений: единственное поколение описано общей карточкой
  models.set(key, { ...item, article: article.title, exact: exact && !ALIASES[key], parsed })
}

console.log('2. Отдельные статьи о поколениях')
const subTitles = new Set()
for (const model of models.values()) {
  for (const link of model.parsed.links) {
    const heading = stripHeading(link.heading)
    const sameFamily = link.target.startsWith(model.article + ' (') || (link.target.startsWith(model.article.split(' ')[0]) && (/generation/i.test(heading) || YEAR.test(heading) || codesFromTitle(heading).length > 0))
    YEAR.lastIndex = 0
    if (sameFamily && link.target !== model.article) {
      link.accepted = true
      subTitles.add(link.target)
    }
  }
}
// Статья, на которую ссылаются сразу несколько разделов одной модели, описывает не одно поколение,
// а всю линейку — её общие годы и фото нельзя приписывать каждому поколению.
for (const model of models.values()) {
  const accepted = model.parsed.links.filter((link) => link.accepted)
  for (const link of accepted) {
    const same = accepted.filter((other) => other.accepted && other.target === link.target)
    if (!link.accepted || same.length < 2) continue
    // Исключение: статья об одном поколении, упомянутая дважды («Mercedes-Benz W124» — и в истории модели,
    // и в разделе «First generation»). Код стоит в её названии; она учитывается один раз, по разделу с номером поколения.
    const tail = link.target.split(' ').pop()
    const ownCode = codesFromTitle(link.target).length > 0 || (isCode(tail) && /\d/.test(tail))
    if (ownCode) {
      const best = same.find((other) => ordinalOf(other.heading) > 0) ?? same[0]
      for (const other of same) if (other !== best) other.accepted = false
    } else {
      for (const other of same) other.shared = true
    }
  }
}
const subArticles = await fetchArticles([...subTitles])

console.log('3. Поколения')
const review = []
let generationCount = 0
for (const [key, model] of models) {
  const list = model.parsed.generations.map((source) => buildGeneration(source))
  for (const link of model.parsed.links) {
    if (!link.accepted) continue
    const article = subArticles.get(link.target)
    if (!article) continue
    const sub = parseArticle(article.text)
    if (link.shared) {
      // общая статья о родственной модели («Kia K3» для Cerato): берётся только тот её раздел,
      // код которого назван в заголовке раздела исходной статьи
      const wanted = codesFromTitle(link.heading).map((code) => code[0])
      const match = sub.generations.find((inner) => buildGeneration(inner).codes.some((code) => wanted.includes(code[0])))
      if (match) list.push({ ...buildGeneration(match), ordinal: ordinalOf(link.heading) })
      continue
    }
    const top = sub.top
    const years = top && (parseYears(top.production) ?? parseYears(top.model_years))
    if (!years) continue
    // «Mercedes-Benz W124» — код стоит прямо в названии статьи
    const tail = article.title.split(' ').pop()
    const title = isCode(tail) && /\d/.test(tail) ? `(${tail})` : article.title
    list.push(buildGeneration({ params: top, years, heading: link.heading, title, faceliftSections: sub.faceliftSections, faceliftMentioned: sub.faceliftMentioned }))
    // в статье о поколении описано и следующее: «Volkswagen Passat (B7)» внутри статьи о B6
    for (const inner of sub.generations) {
      if (stripHeading(inner.params.name ?? '').startsWith(model.article + ' (')) list.push(buildGeneration({ ...inner, heading: '' }))
    }
  }

  // модель без разделов-поколений: единственное поколение описано общей карточкой статьи
  if (list.length === 0 && model.parsed.top && codesFromField(model.parsed.top.model_code).length > 0) {
    const years = parseYears(model.parsed.top.production) ?? parseYears(model.parsed.top.model_years)
    if (years) list.push(buildGeneration({ params: model.parsed.top, years, heading: '' }))
  }

  // «M3» в статье о BMW M3, «CLS» в статье о CLS: название модели, попавшее в заголовки разделов,
  // — не код кузова. Признак: «код» совпадает со словом из названия и повторяется в нескольких поколениях.
  const titleWords = new Set(`${model.article} ${model.model}`.toUpperCase().split(/[\s()-]+/))
  const squeezed = (text) => text.toUpperCase().replace(/[^A-Z0-9]/g, '')
  const modelNames = new Set([squeezed(model.model), squeezed(model.article.split(' ').slice(1).join(' '))])
  for (const generation of list) {
    generation.codes = generation.codes.filter(
      ([code]) =>
        // слово из названия, повторяющееся в нескольких поколениях
        !(titleWords.has(code) && list.filter((other) => other.codes.some((item) => item[0] === code)).length > 1) &&
        // само название модели («CS75», «S60», «M3») и обозначения двигателя или версии
        !modelNames.has(squeezed(code)) &&
        !/^(V6|V8|V10|V12|SS)$/.test(code),
    )
  }

  for (const fix of CORRECTIONS[key]?.split ?? []) {
    const owner = list.find((generation) => generation.codes.length > 1 && generation.codes.some((item) => item[0] === fix.code))
    if (!owner) continue
    owner.codes = owner.codes.filter((item) => item[0] !== fix.code)
    owner.to = Math.min(owner.to ?? fix.from, fix.from)
    list.push({ ordinal: 0, codes: [[fix.code, '']], from: fix.from, to: fix.to, image: null })
    log.corrections.push(`${model.make} ${model.model}: код ${fix.code} выделен в отдельный вариант ${fix.from}–${fix.to}`)
  }

  // одно и то же поколение не повторяется: совпадают коды или (без кодов) номер и год начала
  const unique = []
  for (const generation of list) {
    const id = generation.codes.length > 0 ? generation.codes.map((code) => code[0]).sort().join('/') : `${generation.ordinal}:${generation.from}`
    if (generation.codes.length === 0 && generation.ordinal === 0) continue
    // анонсированные, но ещё не выпускаемые поколения
    if (generation.from > THIS_YEAR) continue
    if (unique.some((other) => other.id === id || (generation.ordinal > 0 && other.ordinal === generation.ordinal && other.codes.length >= generation.codes.length))) continue
    unique.push({ ...generation, id })
  }
  unique.sort((a, b) => a.from - b.from || a.ordinal - b.ordinal)

  // «S6», «RS6» в статье об A6: спортивная версия, выпускавшаяся на протяжении нескольких поколений,
  // сама поколением не является
  const numbered = unique.some((generation) => generation.ordinal > 0)
  for (let index = unique.length - 1; index >= 0; index--) {
    const item = unique[index]
    const end = item.to ?? THIS_YEAR
    const spansOthers = unique.some((other) => other !== item && other.from > item.from && (other.to ?? THIS_YEAR) < end)
    if (numbered && item.ordinal === 0 && spansOthers && end - item.from >= 20) unique.splice(index, 1)
  }

  // год окончания, которого нет в карточке, — год начала следующего поколения или конец выпуска модели по каталогу
  unique.forEach((generation, index) => {
    if (generation.to !== undefined) return
    const next = unique.slice(index + 1).find((other) => other.from > generation.from)
    // плюс один год: старое поколение обычно ещё выпускается в год запуска следующего и сразу после него
    generation.to = next ? Math.min(next.from + 1, THIS_YEAR) : model.to && model.to < THIS_YEAR ? Math.max(model.to, generation.from) : null
    generation.guessedEnd = true
  })

  // статья бывает шире модели каталога (предшественники, общая статья для нескольких названий) —
  // остаются поколения, которые пересекаются с годами выпуска самой модели
  const only = ALIASES[key]?.only
  const kept = unique.filter((generation) => !only || generation.codes.some((code) => only.includes(code[0]))).filter((generation) => (!model.to || generation.from <= model.to + 1) && (!model.from || (generation.to ?? THIS_YEAR) >= model.from - 1))
  model.generations = kept
  for (const fix of FACELIFTS[key] ?? []) {
    const target = kept.find((generation) => generation.codes.some((item) => item[0] === fix.code))
    if (!target) throw new Error(`Рестайлинг ${key} ${fix.code}: поколение не найдено в данных`)
    target.facelift = { from: fix.from, image: fix.image, verified: true }
  }

  model.image = imageName(model.parsed.top?.image)

  // ---- фотографии: год в имени файла должен попадать в годы поколения ----
  // Имена файлов на Commons обычно начинаются с модельного года: «2019 Hyundai Accent …».
  // Снимок с годом вне выпуска поколения — другое поколение или другая модель; он отбрасывается.
  // Снимок с годом после рестайлинга (или со словом «facelift» в имени) показывает обновлённую версию.
  // Имя файла называет другую модель той же марки («Audi A7 …» в карточке A6) и не называет нашу —
  // снимок чужой модели не показывается, даже если машины похожи.
  const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/[ _-]+/g, '[ _-]*')
  const makeName = (MAKE_NAMES[model.make]?.[0] ?? model.make).replace(/-$/, '')
  const ownNames = [model.model, model.article.replace(new RegExp(`^${escape(makeName)}\\s*`, 'i'), '')].map((name) => {
    let latin = name
    for (const [pattern, replacement] of MODEL_NAMES) latin = latin.replace(pattern, replacement)
    return latin
  })
  const siblings = (catalog.makes.find((item) => item[0] === model.make)?.[2] ?? []).map((item) => item[0]).filter((name) => /^[A-Za-z0-9][A-Za-z0-9 -]{1,}$/.test(name) && (name.length >= 3 || /\d/.test(name)))
  const namesOther = (file) => {
    const text = file.replace(/_/g, ' ')
    if (ownNames.some((own) => own.length >= 2 && new RegExp(`(^|[^A-Za-z0-9])${escape(own)}`, 'i').test(text))) return null
    // тот же автомобиль под другим именем (Jazz = Fit, ix35 = Tucson) из проверенного списка ALIASES — не чужая модель
    const sameCar = (other) => ALIASES[`${model.make}|${other}`]?.title === model.article
    return siblings.find((other) => !sameCar(other) && !ownNames.some((own) => own.toLowerCase().includes(other.toLowerCase())) && new RegExp(`${escape(makeName)}[ -]+${escape(other)}([^A-Za-z0-9]|$)`, 'i').test(text)) ?? null
  }
  if (model.image && namesOther(model.image)) {
    log.otherModelPhotos.push(`${model.make} ${model.model} (общее фото модели) ← ${model.image}`)
    model.image = null
  }
  for (const generation of kept) {
    const other = generation.image && namesOther(generation.image)
    if (other) {
      log.otherModelPhotos.push(`${model.make} ${model.model} [${generation.codes.map((item) => item[0]).join('/') || 'пок. ' + generation.ordinal}] ← ${generation.image} (названа модель ${other})`)
      generation.image = null
    }
    if (generation.facelift?.image && namesOther(generation.facelift.image)) generation.facelift.image = null
    const name = `${model.make} ${model.model} [${generation.codes.map((item) => item[0]).join('/') || 'пок. ' + generation.ordinal}] ${generation.from}–${generation.to ?? 'н.в.'}`
    const lead = generation.image?.match(/^(\d{4})(?:[-–](\d{4}))?[ _,]/)
    const first = lead ? Number(lead[1]) : null
    const last = lead ? Number(lead[2] ?? lead[1]) : null
    if (first !== null && first >= 1930 && first <= THIS_YEAR + 1 && (first > (generation.to ?? THIS_YEAR) + 1 || last < generation.from - 1)) {
      log.rejectedPhotos.push(`${name} ← ${generation.image}`)
      generation.image = null
    }
    const facelift = generation.facelift
    if (facelift) {
      // перенос снимка — только для рестайлинга, проверенного вручную: при неточном годе он навредил бы
      const showsFacelift = facelift.verified && generation.image && (/facelift/i.test(generation.image) || (first !== null && first > facelift.from + 1))
      if (showsFacelift) {
        log.movedPhotos.push(`${name}: «${generation.image}» отнесён к рестайлингу ${facelift.from}`)
        facelift.image ??= generation.image
        generation.image = null
      }
      ;(facelift.verified ? log.verified : log.facelifts).push(`${name}: рестайлинг с ${facelift.from}${facelift.image ? `, фото «${facelift.image}»` : ', фото обновлённой версии нет'}`)
    } else if (generation.facelifted) {
      log.skippedFacelifts++
    }
  }

  // Пропуск в нумерации (I, II, VIII…) означает, что часть поколений в статье не описана карточкой.
  // Для такой модели единственный найденный вариант не обязательно верный — форма не подставляет его сама.
  const numberedKept = kept.filter((generation) => generation.ordinal > 0).sort((a, b) => a.ordinal - b.ordinal)
  model.partial = numberedKept.some((generation, index) => {
    const previous = numberedKept[index - 1]
    if (!previous || generation.ordinal - previous.ordinal <= 1) return false
    const between = kept.filter((other) => other.ordinal === 0 && other.from >= previous.from && other.from <= generation.from).length
    return between < generation.ordinal - previous.ordinal - 1
  })
  // Более позднее по номеру поколение «начато» раньше предыдущего — годы разобраны неверно,
  // и на автоматический выбор по году для этой модели полагаться нельзя.
  if (numberedKept.some((generation, index) => index > 0 && generation.ordinal > numberedKept[index - 1].ordinal && generation.from < numberedKept[index - 1].from)) model.partial = true
  // без поколений модель остаётся в справочнике только ради фотографии
  if (kept.length === 0 && !((model.exact || (ALIASES[key] && !only)) && model.image)) {
    models.delete(key)
    continue
  }
  generationCount += kept.length
  review.push(
    `${model.make} | ${model.model}  ←  ${model.article}\n` +
      kept.map((g) => `    ${g.ordinal || '-'}  ${g.codes.map(([code, note]) => (note ? `${code}(${note})` : code)).join(' ') || '—'}  ${g.from}–${g.to ?? 'н.в.'}${g.guessedEnd ? ' ~' : ''}  ${g.image ?? ''}`).join('\n'),
  )
}

console.log('4. Лицензии фотографий (Wikimedia Commons)')
const files = new Set()
for (const model of models.values()) {
  if (model.image) files.add(model.image)
  for (const generation of model.generations) {
    if (generation.image) files.add(generation.image)
    if (generation.facelift?.image) files.add(generation.facelift.image)
  }
}
const FREE_LICENCE = /^(CC BY(-SA)? \d(\.\d)?( [a-z-]+)?|CC0|Public domain|PDM)/i
const images = new Map()
const fileList = [...files]
for (let offset = 0; offset < fileList.length; offset += 50) {
  const batch = fileList.slice(offset, offset + 50)
  const data = await api('commons.wikimedia.org', {
    action: 'query',
    prop: 'imageinfo',
    iiprop: 'url|size|mime|extmetadata',
    iiurlwidth: '960',
    iiextmetadatafilter: 'LicenseShortName|Artist|AttributionRequired',
    titles: batch.map((name) => `File:${name}`).join('|'),
  })
  const renamed = new Map((data.query?.normalized ?? []).map((item) => [item.to, item.from]))
  for (const page of data.query?.pages ?? []) {
    const info = page.imageinfo?.[0]
    if (!info || !/^image\/(jpeg|png)$/.test(info.mime) || info.width < 800 || info.height < 400) continue
    const licence = String(info.extmetadata?.LicenseShortName?.value ?? '').trim()
    if (!FREE_LICENCE.test(licence)) continue
    // адрес уменьшенной копии: .../commons/thumb/<путь>/960px-<файл>; сохраняется только путь
    const thumb = String(info.thumburl ?? '').split('?')[0].match(/\/wikipedia\/commons\/thumb\/(.+\/960px-[^/]+)$/)?.[1]
    if (!thumb) continue
    const author = String(info.extmetadata?.Artist?.value ?? '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&[a-z#0-9]+;/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    // лицензии с указанием авторства без имени автора использовать нельзя: подпись была бы неполной
    if (!author && !/^(CC0|Public domain|PDM)/i.test(licence)) continue
    const asked = (renamed.get(page.title) ?? page.title).replace(/^File:/, '')
    const entry = [thumb, author.length > 80 ? author.slice(0, 79).trimEnd() + '…' : author || 'автор не указан', licence.replace(/^PDM.*/i, 'Public domain')]
    images.set(asked, entry)
    images.set(page.title.replace(/^File:/, ''), entry)
  }
  process.stdout.write(`\r  фотографии: ${Math.min(offset + 50, fileList.length)}/${fileList.length}`)
}
process.stdout.write('\n')

console.log('5. Запись')
rmSync(OUTPUT_DIR, { recursive: true, force: true })
mkdirSync(OUTPUT_DIR, { recursive: true })
const byMake = new Map()
for (const model of models.values()) {
  const entry = {
    // статья-источник
    s: model.article.replace(/ /g, '_'),
    // поколение: o — номер (0 — не указан), c — коды [код, примечание о кузове], r и x — рестайлинг (см. ниже),
    // f/t — годы выпуска по всем рынкам (t: 0 — выпускается), i — фотография [путь, автор, лицензия]
    g: model.generations.map((generation) => {
      // годы поколения не выходят за годы выпуска самой модели по каталогу (с запасом в один год):
      // так отсекаются годы предшественников и ошибочно разобранные даты
      const from = model.from ? Math.max(generation.from, model.from - 1) : generation.from
      const to = model.to && model.to < THIS_YEAR ? Math.min(generation.to ?? model.to + 1, model.to + 1) : (generation.to ?? 0)
      const row = { o: generation.ordinal, c: generation.codes, f: from, t: to }
      const image = generation.image && images.get(generation.image)
      if (image) row.i = image
      // рестайлинг должен попадать внутрь лет поколения и после их уточнения по каталогу
      const faceliftFits = generation.facelift && generation.facelift.from > from && (to === 0 || generation.facelift.from <= to)
      if (generation.facelift && !faceliftFits && generation.facelift.verified) throw new Error(`Рестайлинг ${model.make} ${model.model} ${generation.facelift.from} вне лет поколения ${from}–${to}`)
      if (faceliftFits) {
        // r — рестайлинг:
        // [год, 1 — проверен вручную / 0 — определён по разделу статьи, фотография обновлённой версии]
        const restyled = generation.facelift.image && images.get(generation.facelift.image)
        row.r = [generation.facelift.from, generation.facelift.verified ? 1 : 0]
        if (restyled) row.r.push(restyled)
      } else if (generation.facelifted) {
        // x — в источнике у поколения есть раздел о рестайлинге, но в справочнике он не выделен
        row.x = 1
      }
      return row
    }),
  }
  const image = model.image && images.get(model.image)
  if (image) entry.i = image
  // p — список поколений заведомо неполный
  if (model.partial) entry.p = 1
  if (!byMake.has(model.make)) byMake.set(model.make, {})
  byMake.get(model.make)[model.model] = entry
}

const index = {}
let fileNumber = 0
let withImages = 0
let withCodes = 0
let withGenerations = 0
for (const [make, data] of [...byMake].sort((a, b) => a[0].localeCompare(b[0]))) {
  const file = `${String(++fileNumber).padStart(3, '0')}.json`
  index[make] = file
  writeFileSync(join(OUTPUT_DIR, file), JSON.stringify(data), 'utf8')
  for (const entry of Object.values(data)) {
    if (entry.i || entry.g.some((row) => row.i)) withImages++
    if (entry.g.some((row) => row.c.length > 0)) withCodes++
    if (entry.g.length > 0) withGenerations++
  }
}
writeFileSync(
  join(OUTPUT_DIR, 'index.json'),
  JSON.stringify({
    source: 'English Wikipedia (CC BY-SA 4.0), Wikimedia Commons — https://en.wikipedia.org/wiki/',
    built: new Date().toISOString().slice(0, 10),
    // марка → файл с её моделями
    makes: index,
  }),
  'utf8',
)
if (REVIEW) writeFileSync(REVIEW, review.join('\n\n'), 'utf8')
const section = (title, note, list) => `## ${title} — ${list.length}\n\n${note}\n\n${list.map((line) => `- ${line}`).join('\n') || '—'}\n`
mkdirSync('docs', { recursive: true })
writeFileSync(
  LOG,
  [
    '# Журнал сборки справочника поколений',
    '',
    `Создан автоматически скриптом scripts/build-car-generations.mjs ${new Date().toISOString().slice(0, 10)}. Вручную не редактируется.`,
    'Здесь перечислено всё, что скрипт решил сам, — это список для выборочной ручной проверки, а не подтверждение достоверности.',
    '',
    section('Рестайлинги, проверенные вручную', 'Заданы в таблице FACELIFTS с указанием источника.', log.verified),
    section('Рестайлинги, определённые по разделу статьи Википедии', `Год взят из заголовка или первых фраз единственного раздела о рестайлинге и вручную не проверялся. В форме такой рестайлинг — необязательное уточнение «примерно с … года»: сам он никогда не подставляется, автоматически выбирается только поколение. Ещё у ${log.skippedFacelifts} поколений рестайлинг в статье упомянут, но год однозначно не определяется — для них показывается предупреждение.`, log.facelifts),
    section('Фотографии, отнесённые к рестайлингу', 'В имени файла слово «facelift» или год позже рестайлинга.', log.movedPhotos),
    section('Отброшенные фотографии: год не совпадает', 'Год в имени файла не попадает в годы выпуска поколения — вероятно, на снимке другое поколение.', log.rejectedPhotos),
    section('Отброшенные фотографии: названа другая модель', 'Имя файла называет другую модель той же марки и не называет эту. Вместо снимка показывается общее фото модели или силуэт.', log.otherModelPhotos),
    section('Ручные исправления данных', 'Таблица CORRECTIONS.', log.corrections),
  ].join('\n'),
  'utf8',
)
console.log(`Готово: марок ${byMake.size}, моделей ${models.size}: с поколениями — ${withGenerations}, с кодами кузова — ${withCodes}, с фотографиями — ${withImages};, поколений ${generationCount}, фотографий ${new Set([...images.values()]).size}`)
