// Автоматическая проверка справочника поколений: public/car-generations/.
//
// Скрипт ничего не исправляет. Он ищет записи, которые выглядят подозрительно, и пишет их списком
// в docs/car-catalog-suspicious.md — для выборочной ручной проверки по источникам.
// Отсутствие записи в списке не доказывает, что она верна: проверяются только формальные признаки.
//
// Запуск:  node scripts/audit-car-generations.mjs            — проверка по локальным файлам
//          node scripts/audit-car-generations.mjs --cars-base — плюс сверка кодов с базой cars-base (нужна сеть)

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'

const DIR = 'public/car-generations/'
const OUTPUT = 'docs/car-catalog-suspicious.md'
const NOW = new Date().getFullYear()
const catalog = JSON.parse(readFileSync('public/car-catalog.json', 'utf8'))
const index = JSON.parse(readFileSync(DIR + 'index.json', 'utf8')).makes

const lists = {
  inverted: [],
  future: [],
  outside: [],
  long: [],
  order: [],
  overlap: [],
  open: [],
  partial: [],
  duplicate: [],
  notCode: [],
  faceliftRange: [],
  photoUnnamed: [],
  photoNotFront: [],
  noAuthor: [],
  carsBase: [],
}
const count = { makes: 0, models: 0, withGenerations: 0, generations: 0, codes: 0, verified: 0, tentative: 0, warned: 0, photos: 0, modelPhotos: 0, generationPhotos: 0, faceliftPhotos: 0, autoYears: 0, listYears: 0, emptyYears: 0 }
const licences = {}

// слова, которые встречаются в заголовках рядом с кодами, но кодами кузова не являются
const NOT_BODY_CODE = /^(GT[ISRX]?|RS\d?|SS|ST|SE|LE|XL[ET]?|EV|PHEV|HEV|AMG|TDI|TSI|TFSI|GDI|CRDI|VTEC|V6|V8|V12|4WD|AWD|2WD|FWD|RWD|CVT|DCT|LWB|SWB|SUV|MPV|USA|JDM|EU|UK)$/
const plain = (text) => decodeURIComponent(text).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')
const latinModel = (model) => model.replace(/-Класс$/, '-Class').replace(/ серии$/, ' Series')
const fileOf = (image) => decodeURIComponent(image[0].split('/')[2])
const photo = (image, kind) => {
  if (!image) return
  count.photos++
  count[kind]++
  licences[image[2]] = (licences[image[2]] ?? 0) + 1
  if (image[1] === 'автор не указан') lists.noAuthor.push(`${fileOf(image)} — ${image[2]}`)
  if (/rear|interior|innenraum|cockpit|dashboard|heck|[–-]\s*h\d?\s+\d{6,8}/i.test(fileOf(image))) lists.photoNotFront.push(fileOf(image))
}

const ours = new Map()
for (const [make, , models] of catalog.makes) {
  if (!index[make]) continue
  count.makes++
  const data = JSON.parse(readFileSync(DIR + index[make], 'utf8'))
  for (const [model, , modelFrom, modelTo] of models) {
    const entry = data[model]
    if (!entry) continue
    count.models++
    photo(entry.i, 'modelPhotos')
    const rows = entry.g
    if (rows.length > 0) count.withGenerations++
    ours.set(`${make}|${model}`, rows)
    const name = `${make} ${model}`
    const label = (row) => `${name} [${row.c.map((code) => code[0]).join('/') || 'пок. ' + row.o}] ${row.f}–${row.t || 'н. в.'}`
    const seen = new Map()
    rows.forEach((row, position) => {
      count.generations++
      count.codes += row.c.length
      photo(row.i, 'generationPhotos')
      const end = row.t || NOW
      if (row.t && row.t < row.f) lists.inverted.push(label(row))
      if (row.f > NOW) lists.future.push(label(row))
      if (end - row.f > 20) lists.long.push(label(row))
      if (modelFrom && (end < modelFrom - 1 || (modelTo && row.f > modelTo + 1))) lists.outside.push(`${label(row)} — модель по каталогу ${modelFrom}–${modelTo || 'н. в.'}`)
      for (const [code] of row.c) {
        if (seen.has(code) && seen.get(code) !== position) lists.duplicate.push(`${name}: код ${code} у поколений ${rows[seen.get(code)].f}–${rows[seen.get(code)].t || 'н. в.'} и ${row.f}–${row.t || 'н. в.'}`)
        seen.set(code, position)
        if (NOT_BODY_CODE.test(code) || plain(latinModel(model)) === plain(code)) lists.notCode.push(`${label(row)}: «${code}»`)
      }
      if (row.r) {
        count[row.r[1] === 1 ? 'verified' : 'tentative']++
        photo(row.r[3], 'faceliftPhotos')
        if (row.r[0] <= row.f || row.r[0] > end) lists.faceliftRange.push(`${label(row)}: рестайлинг ${row.r[0]}`)
      } else if (row.x) count.warned++
      if (row.i) {
        const file = plain(fileOf(row.i))
        const named = file.includes(plain(latinModel(model))) || row.c.some(([code]) => file.includes(plain(code)))
        if (!named) lists.photoUnnamed.push(`${label(row)} ← ${fileOf(row.i)}`)
      }
    })
    // нумерация и годы начала должны идти в одном порядке; соседние поколения не должны выпускаться вместе слишком долго
    const numbered = rows.filter((row) => row.o > 0).sort((a, b) => a.o - b.o)
    numbered.forEach((row, position) => {
      const previous = numbered[position - 1]
      if (!previous) return
      if (row.o !== previous.o && row.f < previous.f) lists.order.push(`${name}: поколение ${row.o} начато в ${row.f}, раньше поколения ${previous.o} (${previous.f})`)
      const shared = Math.min(previous.t || NOW, row.t || NOW) - row.f
      if (row.o === previous.o + 1 && shared > 5) lists.overlap.push(`${name}: поколения ${previous.o} (${previous.f}–${previous.t || 'н. в.'}) и ${row.o} (${row.f}–${row.t || 'н. в.'}) выпускались вместе ${shared} лет`)
    })
    const open = rows.filter((row) => !row.t).length
    if (open > 2) lists.open.push(`${name}: «выпускается» у ${open} поколений`)
    if (entry.p) lists.partial.push(`${name}: номера поколений ${numbered.map((row) => row.o).join(', ')}`)
    // сколько модель-лет дают один вариант (автовыбор), несколько (выбор пользователя) и ни одного
    if (rows.length > 0) {
      for (let year = Math.max(modelFrom || 1990, 1990); year <= Math.min(modelTo || NOW, NOW); year++) {
        const firm = rows.flatMap((row) => (row.r?.[1] === 1 ? [[row.f, row.r[2]], [row.r[0], row.t || NOW]] : [[row.f, row.t || NOW]])).filter(([from, to]) => year >= from && year <= to).length
        count[firm === 1 && !entry.p ? 'autoYears' : firm === 0 ? 'emptyYears' : 'listYears']++
      }
    }
  }
}

// Независимая сверка: в базе cars-base к названию модели бывает приписано одно поколение с кодом в скобках —
// «Camry, VII (XV50) Рестайлинг». Такой код должен встречаться и у нас. База происходит из каталога auto.ru,
// поэтому это сверка с другим источником, а не с Википедией.
if (process.argv.includes('--cars-base')) {
  const marks = await (await fetch('https://raw.githubusercontent.com/blanzh/carsBase/master/cars.json')).json()
  let compared = 0
  for (const mark of marks) {
    for (const model of mark.models ?? []) {
      const [base, rest] = String(model.name).split(/,\s*/)
      const rows = ours.get(`${mark.name}|${base.trim()}`)
      const codes = rest?.match(/\(([^()]+)\)/)?.[1].split(/[/,\s]+/).filter((code) => /^[A-Z0-9-]{2,8}$/.test(code) && /[A-Z]/.test(code))
      if (!rows || rows.length === 0 || !codes || codes.length === 0) continue
      compared++
      const known = new Set(rows.flatMap((row) => row.c.map((code) => code[0])))
      if (known.size > 0 && !codes.some((code) => known.has(code) || [...known].some((own) => own.startsWith(code) || code.startsWith(own)))) {
        lists.carsBase.push(`${mark.name} ${base}: в cars-base «${rest}», у нас коды ${[...known].slice(0, 12).join(', ')}`)
      }
    }
  }
  count.carsBaseCompared = compared
}

const section = (title, note, list, limit = 400) => `## ${title} — ${list.length}\n\n${note}\n\n${list.slice(0, limit).map((line) => `- ${line}`).join('\n') || '—'}${list.length > limit ? `\n- … и ещё ${list.length - limit}` : ''}\n`
mkdirSync('docs', { recursive: true })
writeFileSync(
  OUTPUT,
  [
    '# Подозрительные записи справочника поколений',
    '',
    `Создан автоматически скриптом scripts/audit-car-generations.mjs ${new Date().toISOString().slice(0, 10)}. Вручную не редактируется.`,
    'Списки — формальные признаки возможной ошибки, а не подтверждённые ошибки. Каждую запись нужно сверять с источником.',
    '',
    '## Сводка',
    '',
    `- марок с данными: ${count.makes}; моделей: ${count.models}, из них с поколениями: ${count.withGenerations}`,
    `- поколений: ${count.generations}; кодов кузова: ${count.codes}`,
    `- рестайлингов: подтверждённых производителем ${count.verified}, неподтверждённых (раздел статьи или вторичный источник) ${count.tentative}; поколений с предупреждением «рестайлинг был, год неизвестен» ${count.warned}`,
    `- фотографий: ${count.photos} (моделей ${count.modelPhotos}, поколений ${count.generationPhotos}, рестайлингов ${count.faceliftPhotos})`,
    `- лицензии: ${Object.entries(licences).sort((a, b) => b[1] - a[1]).map(([name, number]) => `${name} — ${number}`).join('; ')}`,
    `- модель-годы с 1990 года: один вариант (возможен автовыбор) ${count.autoYears}, несколько или неполный список (выбирает пользователь) ${count.listYears}, ни одного ${count.emptyYears}`,
    count.carsBaseCompared ? `- сверено с cars-base моделей: ${count.carsBaseCompared}` : '- сверка с cars-base не запускалась',
    '',
    section('Конец выпуска раньше начала', 'Ошибка разбора дат.', lists.inverted),
    section('Начало выпуска в будущем', 'Анонсированное поколение.', lists.future),
    section('Поколение вне лет выпуска модели', 'Годы поколения не пересекаются с годами модели по каталогу.', lists.outside),
    section('Рестайлинг вне лет поколения', 'Год рестайлинга не попадает в годы выпуска поколения.', lists.faceliftRange),
    section('Нумерация не совпадает с порядком лет', 'Более позднее по номеру поколение начато раньше предыдущего — вероятно, годы или номер разобраны неверно.', lists.order),
    section('Соседние поколения выпускались вместе больше 5 лет', 'Обычно это продлённый выпуск на отдельных рынках (мировые годы), иногда — ошибка разбора. В эти годы форма предлагает оба варианта.', lists.overlap),
    section('Выпуск дольше 20 лет', 'Лицензионное производство или ошибка разбора дат.', lists.long),
    section('«Выпускается» больше чем у двух поколений', 'Вероятно, окончание выпуска старых поколений в источнике не указано.', lists.open),
    section('Неполный список поколений', 'В нумерации есть пропуск. Для таких моделей автовыбор отключён.', lists.partial),
    section('Один код у двух поколений', 'Код мог быть общим на самом деле (Audi 8E у B6 и B7) или попал не туда.', lists.duplicate),
    section('Код похож на название модели, комплектации или двигателя', 'Проверить, действительно ли это код кузова.', lists.notCode),
    section('Код из cars-base не найден у нас', 'Расхождение с независимым источником: другой способ записи кода, пропущенное поколение или ошибка.', lists.carsBase),
    section('Фотография: в имени файла нет ни модели, ни кода', 'Имя файла не подтверждает, что на снимке эта модель (часто там просто комплектация: «BMW 318d»).', lists.photoUnnamed),
    section('Фотография: возможно, не вид спереди', 'По имени файла.', lists.photoNotFront),
    section('Фотография без автора', 'Допустимо только для общественного достояния и CC0.', lists.noAuthor),
  ].join('\n'),
  'utf8',
)
console.log(JSON.stringify(count))
console.log(Object.entries(lists).map(([name, list]) => `${name}: ${list.length}`).join(' | '))
