// Собирает каталог марок и моделей для формы автомобиля: public/car-catalog.json.
//
// Источник — открытая база cars-base (https://github.com/blanzh/carsBase, файл cars.json):
// марки, модели, годы выпуска, русские названия. Поколений и кодов кузова в ней нет —
// они ведутся отдельно, в src/app/car/catalog/generations.ts.
//
// Запуск:  node scripts/build-car-catalog.mjs
// Запускается вручную, когда нужно обновить каталог. В сборку сайта не входит.

import { writeFileSync } from 'node:fs'

const SOURCE_URL = 'https://raw.githubusercontent.com/blanzh/carsBase/master/cars.json'
const OUTPUT = 'public/car-catalog.json'
const THIS_YEAR = new Date().getFullYear()

const response = await fetch(SOURCE_URL)
if (!response.ok) throw new Error(`Не удалось скачать базу: HTTP ${response.status}`)
const marks = await response.json()

// В исходных данных к названию модели бывает приписано одно из поколений:
// «Camry, VII (XV50) Рестайлинг». Модель — это часть до запятой.
const baseName = (name) => String(name).split(',')[0].replace(/\s+/g, ' ').trim()
const year = (value, fallback) => (Number.isInteger(value) && value >= 1900 && value <= THIS_YEAR + 1 ? value : fallback)

const makes = []
let modelCount = 0
for (const mark of marks) {
  const name = String(mark.name ?? '').trim()
  if (!name || !Array.isArray(mark.models)) continue

  // модели с одинаковым названием объединяются, годы берутся по самому широкому диапазону
  const models = new Map()
  for (const model of mark.models) {
    const title = baseName(model.name)
    if (!title || title.length > 40) continue
    const from = year(model.year_from, 0)
    const to = year(model.year_to, 0)
    const existing = models.get(title)
    if (existing) {
      existing[2] = existing[2] && from ? Math.min(existing[2], from) : existing[2] || from
      existing[3] = existing[3] && to ? Math.max(existing[3], to) : 0
    } else {
      models.set(title, [title, String(model.cyrillic_name ?? '').trim(), from, to])
    }
  }
  if (models.size === 0 || name.length > 40) continue
  const list = [...models.values()].sort((a, b) => a[0].localeCompare(b[0], 'en', { numeric: true }))
  modelCount += list.length
  makes.push([name, String(mark.cyrillic_name ?? '').trim(), list])
}
makes.sort((a, b) => a[0].localeCompare(b[0], 'en'))

const catalog = {
  source: 'cars-base.ru — https://github.com/blanzh/carsBase',
  // строка модели: [название, русское название, год начала выпуска, год окончания (0 — неизвестен)]
  makes,
}
writeFileSync(OUTPUT, JSON.stringify(catalog), 'utf8')
console.log(`Каталог записан в ${OUTPUT}: марок ${makes.length}, моделей ${modelCount}`)
