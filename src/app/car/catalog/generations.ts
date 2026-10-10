// Справочник поколений и кодов кузова для самых распространённых моделей.
//
// Бесплатного полного источника таких данных нет: в открытой базе cars-base есть только
// марки, модели и годы. Поэтому справочник небольшой и ведётся вручную, а для всех
// остальных моделей поколение или код кузова пользователь вводит сам.
//
// Источник каждой записи — страница модели в английской Википедии (поле source).
// Годы — мировое производство, включая продлённый выпуск на отдельных рынках, поэтому
// поколения перекрываются: в переходный год форма предлагает несколько вариантов на выбор,
// а не угадывает один. Порядковые номера поколений не указаны намеренно: на разных рынках
// их считают по-разному, а код кузова однозначен.
//
// Ключи — названия марки и модели в том виде, в каком они записаны в public/car-catalog.json.

export interface Generation {
  /** код кузова, например «XV70» */
  code: string
  /** год начала производства */
  from: number
  /** год окончания производства; null — выпускается */
  to: number | null
}

interface ModelGenerations {
  source: string
  items: Generation[]
}

const g = (code: string, from: number, to: number | null): Generation => ({ code, from, to })

const GENERATIONS: Record<string, Record<string, ModelGenerations>> = {
  Toyota: {
    Camry: {
      source: 'https://en.wikipedia.org/wiki/Toyota_Camry',
      items: [g('XV10', 1991, 1996), g('XV20', 1996, 2002), g('XV30', 2001, 2006), g('XV40', 2006, 2012), g('XV50', 2011, 2019), g('XV70', 2017, 2024), g('XV80', 2023, null)],
    },
    Corolla: {
      source: 'https://en.wikipedia.org/wiki/Toyota_Corolla',
      items: [
        // окончание выпуска E10 и E30–E60 на странице не указано: взят год начала следующего поколения
        g('E10', 1966, 1970),
        g('E20', 1970, 1978),
        g('E30–E60', 1974, 1979),
        g('E70', 1979, 1987),
        g('E80', 1983, 1990),
        g('E90', 1987, 2006),
        g('E100', 1991, 2002),
        g('E110', 1995, 2002),
        g('E120/E130', 2000, 2017),
        g('E140/E150', 2006, 2020),
        g('E160/E170/E180', 2012, 2025),
        g('E210', 2018, null),
      ],
    },
    RAV4: {
      source: 'https://en.wikipedia.org/wiki/Toyota_RAV4',
      items: [g('XA10', 1994, 2000), g('XA20', 2000, 2005), g('XA30', 2005, 2016), g('XA40', 2012, 2018), g('XA50', 2018, 2025), g('XA60', 2025, null)],
    },
    'Land Cruiser Prado': {
      source: 'https://en.wikipedia.org/wiki/Toyota_Land_Cruiser_Prado',
      items: [g('J70', 1990, 1996), g('J90', 1996, 2002), g('J120', 2002, 2009), g('J150', 2009, 2023), g('J250', 2023, null)],
    },
  },
  Hyundai: {
    Sonata: {
      source: 'https://en.wikipedia.org/wiki/Hyundai_Sonata',
      items: [
        g('Y1', 1985, 1988),
        g('Y2', 1988, 1993),
        g('Y3', 1993, 1998),
        g('EF', 1998, 2004),
        g('NF', 2004, 2009),
        g('YF', 2009, 2014),
        // окончание выпуска LF на странице не указано: взят год начала следующего поколения
        g('LF', 2014, 2019),
        g('DN8', 2019, null),
      ],
    },
    Elantra: {
      source: 'https://en.wikipedia.org/wiki/Hyundai_Elantra',
      items: [g('J1', 1990, 1995), g('J2/J3', 1995, 2000), g('XD', 2000, 2006), g('HD', 2006, 2010), g('MD/UD', 2010, 2015), g('AD', 2015, 2020), g('CN7', 2020, null), g('CN8', 2026, null)],
    },
    Tucson: {
      source: 'https://en.wikipedia.org/wiki/Hyundai_Tucson',
      items: [g('JM', 2004, 2009), g('LM', 2009, 2015), g('TL', 2015, 2021), g('NX4', 2020, null)],
    },
    'Santa Fe': {
      source: 'https://en.wikipedia.org/wiki/Hyundai_Santa_Fe',
      items: [g('SM', 2000, 2006), g('CM', 2005, 2012), g('DM/NC', 2012, 2018), g('TM', 2018, null), g('MX5', 2023, null)],
    },
  },
  Kia: {
    Rio: {
      source: 'https://en.wikipedia.org/wiki/Kia_Rio',
      items: [g('DC', 1999, 2005), g('JB', 2005, 2011), g('UB/QB', 2011, 2017), g('YB/SC/FB', 2016, 2023)],
    },
    Sportage: {
      source: 'https://en.wikipedia.org/wiki/Kia_Sportage',
      items: [g('NB', 1993, 2005), g('JE/KM', 2004, 2010), g('SL', 2010, 2015), g('QL', 2015, 2021), g('NQ5', 2021, null)],
    },
  },
  Lexus: {
    RX: {
      source: 'https://en.wikipedia.org/wiki/Lexus_RX',
      items: [g('XU10', 1997, 2003), g('XU30', 2003, 2008), g('AL10', 2008, 2015), g('AL20', 2015, 2022), g('ALA10/ALH10', 2022, null)],
    },
  },
  Nissan: {
    'X-Trail': {
      source: 'https://en.wikipedia.org/wiki/Nissan_X-Trail',
      items: [g('T30', 2000, 2014), g('T31', 2007, 2019), g('T32', 2013, null), g('T33', 2021, null)],
    },
  },
}

/** Все поколения модели из справочника или null, если модели в нём нет */
export function generationsOf(make: string, model: string): Generation[] | null {
  return GENERATIONS[make]?.[model]?.items ?? null
}

/** Поколения, которые выпускались в указанном году. Несколько — значит, год переходный */
export function generationsForYear(make: string, model: string, year: number): Generation[] {
  const all = generationsOf(make, model) ?? []
  return all.filter((item) => year >= item.from && (item.to === null || year <= item.to))
}

export const generationYears = (item: Generation) => `${item.from}–${item.to ?? 'н. в.'}`
