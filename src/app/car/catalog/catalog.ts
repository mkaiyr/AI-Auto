// Каталог марок и моделей для формы автомобиля.
// Данные лежат в public/car-catalog.json (собираются скриптом scripts/build-car-catalog.mjs
// из открытой базы cars-base) и подгружаются только при открытии формы.

export interface CatalogModel {
  name: string
  /** русское название — по нему тоже работает поиск */
  cyrillic: string
  /** годы выпуска; 0 — неизвестно */
  from: number
  to: number
}

export interface CatalogMake {
  name: string
  cyrillic: string
  models: CatalogModel[]
}

/** Марки, распространённые в Казахстане: показываются первыми, в этом порядке */
export const POPULAR_MAKES = [
  'Toyota',
  'Hyundai',
  'Kia',
  'Lexus',
  'Chevrolet',
  'Lada (ВАЗ)',
  'Nissan',
  'Volkswagen',
  'Mercedes-Benz',
  'BMW',
  'Audi',
  'Mitsubishi',
  'Mazda',
  'Honda',
  'Subaru',
  'Ford',
  'Renault',
  'Skoda',
  'Daewoo',
  'Ravon',
  'Haval',
  'Geely',
  'Chery',
  'Changan',
  'JAC',
]

type RawModel = [string, string, number, number]
type RawMake = [string, string, RawModel[]]

let cache: Promise<CatalogMake[]> | null = null

/** Загружает каталог один раз за сеанс. При сбое следующая попытка запросит его снова */
export function loadCatalog(): Promise<CatalogMake[]> {
  cache ??= fetch(`${import.meta.env.BASE_URL}car-catalog.json`)
    .then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      return response.json() as Promise<{ makes: RawMake[] }>
    })
    .then((data) =>
      data.makes.map(([name, cyrillic, models]) => ({
        name,
        cyrillic,
        models: models.map(([modelName, modelCyrillic, from, to]) => ({ name: modelName, cyrillic: modelCyrillic, from, to })),
      })),
    )
    .catch((error) => {
      cache = null
      throw error
    })
  return cache
}

export const findMake = (catalog: CatalogMake[] | null, name: string) => catalog?.find((make) => make.name === name) ?? null
export const findModel = (make: CatalogMake | null, name: string) => make?.models.find((model) => model.name === name) ?? null

/** Строка для поиска: без регистра, «ё» = «е» */
export const searchKey = (...parts: string[]) => parts.join(' ').toLowerCase().replace(/ё/g, 'е')
