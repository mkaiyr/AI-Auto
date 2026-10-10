// Проверка изоляции данных двух аккаунтов на настоящем сервере Supabase.
//
// Создаёт синтетические данные от имени первого тестового аккаунта и пробует добраться
// до них от имени второго и без входа: прочитать, изменить, удалить, привязать запись
// к чужому автомобилю, загрузить файл в чужую папку.
//
// БЕЗОПАСНОСТЬ
//   * Работает только под двумя тестовыми аккаунтами и публичным ключом. Секретный ключ
//     не используется, поэтому скрипту доступно ровно то, что разрешают политики RLS.
//   * Перед началом проверяет, что оба аккаунта пустые. Если в любом из них есть настоящий
//     автомобиль, скрипт останавливается и ничего не меняет.
//   * Все свои строки помечает маркой «RLS-TEST» / «RLS-ATTACK». Удаляет только строки
//     с этими марками и файлы по путям, которые сам создал.
//   * Не печатает ключи, пароли и токены.
//
// ЗАПУСК:  node scripts/rls-check.mjs
//
// Нужны два ПОДТВЕРЖДЁННЫХ тестовых аккаунта (панель Supabase → Authentication → Users →
// Add user → включить «Auto Confirm User»). Их данные кладутся в файл .env.test.local
// в корне проекта — он скрыт от Git:
//
//   RLS_USER1_EMAIL=...
//   RLS_USER1_PASSWORD=...
//   RLS_USER2_EMAIL=...
//   RLS_USER2_PASSWORD=...

import { readFileSync, existsSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const TEST_MAKE = 'RLS-TEST'
const ATTACK_MAKE = 'RLS-ATTACK'
const MARKERS = [TEST_MAKE, ATTACK_MAKE]
const BUCKET = 'car-photos'

const readEnv = (file) =>
  existsSync(file)
    ? Object.fromEntries(readFileSync(file, 'utf8').split(/\r?\n/).map((l) => l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/)).filter(Boolean).map((m) => [m[1], m[2].trim()]))
    : {}
const env = { ...readEnv('.env.local'), ...readEnv('.env.test.local'), ...process.env }
const need = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'RLS_USER1_EMAIL', 'RLS_USER1_PASSWORD', 'RLS_USER2_EMAIL', 'RLS_USER2_PASSWORD']
const missing = need.filter((k) => !env[k])
if (missing.length) {
  console.error('Не заданы: ' + missing.join(', ') + '. См. комментарий в начале файла.')
  process.exit(2)
}
if (/^sb_secret_/.test(env.VITE_SUPABASE_ANON_KEY)) {
  console.error('В VITE_SUPABASE_ANON_KEY указан секретный ключ. Проверка идёт только с публичным ключом.')
  process.exit(2)
}
if (env.RLS_USER1_EMAIL.toLowerCase() === env.RLS_USER2_EMAIL.toLowerCase()) {
  console.error('Нужны два разных тестовых аккаунта.')
  process.exit(2)
}

const client = () => createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
const a = client(), b = client(), anon = client()
let failed = 0
const check = (name, ok, detail = '') => {
  if (!ok) failed++
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${detail && !ok ? ' — ' + detail : ''}`)
}
/** Операция отклонена: ошибка либо пустой результат (чужие строки для RLS «не существуют») */
const denied = (r) => !!r.error || (Array.isArray(r.data) && r.data.length === 0) || r.data === null
const code = (r) => String(r.error?.code || r.error?.statusCode || r.error?.message || 'ошибки нет').slice(0, 60)
// минимальный файл с заголовком JPEG: содержимое для проверки прав не важно
const jpeg = new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xdb, 0, 0x43, 0, ...new Array(64).fill(1), 0xff, 0xd9])], { type: 'image/jpeg' })

/** Файлы, которые скрипт пытался создать: [клиент-владелец, путь] */
const createdFiles = []
let userA = null, userB = null, started = false

/** Удаляет только синтетические строки (по марке) и файлы, созданные этим запуском */
async function cleanup() {
  for (const [owner, path] of createdFiles) await owner.storage.from(BUCKET).remove([path]).catch(() => {})
  // история удаляется вместе с автомобилем (ON DELETE CASCADE)
  for (const c of [a, b]) await c.from('cars').delete().in('make', MARKERS)
}

/** Сколько у аккаунта автомобилей, записей и файлов. Сбой запроса — null, а не «ноль» */
async function inventory(c, userId) {
  const cars = await c.from('cars').select('id, make')
  const records = await c.from('service_records').select('id')
  const files = await c.storage.from(BUCKET).list(userId)
  if (cars.error || records.error || files.error) return null
  return { cars: cars.data, records: records.data.length, files: files.data.length }
}

try {
  const sa = await a.auth.signInWithPassword({ email: env.RLS_USER1_EMAIL, password: env.RLS_USER1_PASSWORD })
  const sb = await b.auth.signInWithPassword({ email: env.RLS_USER2_EMAIL, password: env.RLS_USER2_PASSWORD })
  if (sa.error || sb.error) throw new Error('Не удалось войти тестовыми аккаунтами: ' + (sa.error?.message || sb.error?.message))
  userA = sa.data.user.id
  userB = sb.data.user.id
  if (userA === userB) throw new Error('Оба входа ведут в один аккаунт.')

  // ---- предохранитель: аккаунты должны быть пустыми ----
  for (const [label, c, id] of [['первом', a, userA], ['втором', b, userB]]) {
    const before = await inventory(c, id)
    if (!before) throw new Error(`Не удалось прочитать данные в ${label} аккаунте. Ничего не изменено.`)
    const real = before.cars.filter((car) => !MARKERS.includes(car.make))
    if (real.length > 0) {
      throw new Error(`В ${label} тестовом аккаунте есть настоящий автомобиль. Скрипт работает только с пустыми тестовыми аккаунтами и ничего не изменил.`)
    }
  }
  started = true
  // остатки прерванного прошлого запуска (только строки с тестовой маркой)
  await cleanup()

  // ---- первый аккаунт создаёт свои данные ----
  const car = await a.from('cars').insert({ make: TEST_MAKE, model: 'synthetic', year: 2020, mileage: 1000 }).select('id, user_id').single()
  check('владелец создаёт автомобиль', !car.error && car.data.user_id === userA, code(car))
  if (car.error) throw new Error('Дальнейшая проверка невозможна: автомобиль не создан.')
  const carId = car.data.id
  const rec = await a.from('service_records').insert({ car_id: carId, title: TEST_MAKE, category: 'other', service_date: '2024-01-15', mileage: 900, cost: 10.5 }).select('id').single()
  check('владелец создаёт запись истории', !rec.error, code(rec))
  const recId = rec.data?.id ?? '00000000-0000-4000-8000-000000000000'
  const path = `${userA}/${carId}.jpg`
  createdFiles.push([a, path])
  const up = await a.storage.from(BUCKET).upload(path, jpeg, { contentType: 'image/jpeg', upsert: true })
  check('владелец загружает фото своего автомобиля', !up.error, code(up))
  check('владелец получает временную ссылку на своё фото', !(await a.storage.from(BUCKET).createSignedUrl(path, 60)).error)
  check('владелец читает свой автомобиль', (await a.from('cars').select('id').eq('id', carId)).data?.length === 1)
  check('владелец читает свою запись', (await a.from('service_records').select('id').eq('id', recId)).data?.length === 1)

  // ---- второй аккаунт пробует добраться до чужого ----
  check('чужой автомобиль не читается', denied(await b.from('cars').select('id').eq('id', carId)))
  check('чужой автомобиль не меняется', denied(await b.from('cars').update({ mileage: 999999 }).eq('id', carId).select('id')))
  check('чужой автомобиль не удаляется', denied(await b.from('cars').delete().eq('id', carId).select('id')))
  check('чужая запись не читается', denied(await b.from('service_records').select('id').eq('id', recId)))
  check('чужая запись не меняется', denied(await b.from('service_records').update({ cost: 1 }).eq('id', recId).select('id')))
  check('чужая запись не удаляется', denied(await b.from('service_records').delete().eq('id', recId).select('id')))
  check('в списке второго нет автомобилей первого', ((await b.from('cars').select('id')).data ?? []).length === 0)
  check('в списке второго нет записей первого', ((await b.from('service_records').select('id')).data ?? []).length === 0)

  const attack = { title: ATTACK_MAKE, category: 'other', service_date: '2024-01-15', mileage: 1, cost: 1 }
  const r1 = await b.from('service_records').insert({ car_id: carId, ...attack }).select('id')
  check('нельзя привязать запись к чужому автомобилю', !!r1.error, code(r1))
  const r2 = await b.from('service_records').insert({ car_id: carId, user_id: userA, ...attack }).select('id')
  check('нельзя создать запись от имени другого пользователя', !!r2.error, code(r2))
  const r3 = await b.from('cars').insert({ user_id: userA, make: ATTACK_MAKE, model: 'x', year: 2020, mileage: 1 }).select('id')
  check('нельзя создать автомобиль от имени другого пользователя', !!r3.error, code(r3))

  const foreign = `${userB}/00000000-0000-4000-8000-000000000000.jpg`
  createdFiles.push([b, foreign])
  check('нельзя загрузить файл в чужую папку', !!(await b.storage.from(BUCKET).upload(path, jpeg, { contentType: 'image/jpeg', upsert: true })).error)
  check('нельзя загрузить файл для несуществующего автомобиля', !!(await b.storage.from(BUCKET).upload(foreign, jpeg, { contentType: 'image/jpeg' })).error)
  check('чужое фото не скачивается', !!(await b.storage.from(BUCKET).download(path)).error)
  check('на чужое фото не выдаётся временная ссылка', !!(await b.storage.from(BUCKET).createSignedUrl(path, 60)).error)
  check('чужая папка выглядит пустой', ((await b.storage.from(BUCKET).list(userA)).data ?? []).length === 0)
  await b.storage.from(BUCKET).remove([path])
  check('чужое фото не удаляется', !(await a.storage.from(BUCKET).createSignedUrl(path, 60)).error)

  // ---- без входа ----
  check('без входа автомобили не читаются', denied(await anon.from('cars').select('id').eq('id', carId)))
  check('без входа записи не читаются', denied(await anon.from('service_records').select('id').eq('id', recId)))
  check('без входа автомобиль не создаётся', !!(await anon.from('cars').insert({ make: ATTACK_MAKE, model: 'x', year: 2020, mileage: 1 }).select('id')).error)
  check('без входа автомобиль не меняется', denied(await anon.from('cars').update({ mileage: 5 }).eq('id', carId).select('id')))
  check('без входа автомобиль не удаляется', denied(await anon.from('cars').delete().eq('id', carId).select('id')))
  check('без входа запись не удаляется', denied(await anon.from('service_records').delete().eq('id', recId).select('id')))
  check('без входа файл не загружается', !!(await anon.storage.from(BUCKET).upload(`${userA}/anon.jpg`, jpeg, { contentType: 'image/jpeg' })).error)
  check('без входа фото не скачивается', !!(await anon.storage.from(BUCKET).download(path)).error)
  check('без входа временная ссылка не выдаётся', !!(await anon.storage.from(BUCKET).createSignedUrl(path, 60)).error)
  const pub = await fetch(`${env.VITE_SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`)
  check('фото недоступно по публичной ссылке', !pub.ok, 'HTTP ' + pub.status)

  // ---- после всех попыток данные владельца не изменились ----
  const still = await a.from('cars').select('mileage, user_id').eq('id', carId).single()
  check('автомобиль владельца не изменён', still.data?.mileage === 1000 && still.data?.user_id === userA)
  const stillRec = await a.from('service_records').select('cost').eq('id', recId).single()
  check('запись владельца не изменена', Number(stillRec.data?.cost) === 10.5)
  const steal = await a.from('cars').update({ user_id: userB }).eq('id', carId).select('user_id')
  check('автомобиль нельзя передать другому пользователю', !!steal.error || steal.data?.[0]?.user_id === userA, code(steal))

  // ---- серверные проверки значений ----
  check('сервер отклоняет год 1800', !!(await a.from('cars').update({ year: 1800 }).eq('id', carId).select('id')).error)
  check('сервер отклоняет отрицательную стоимость', !!(await a.from('service_records').update({ cost: -1 }).eq('id', recId).select('id')).error)
  check('сервер отклоняет дату в будущем', !!(await a.from('service_records').update({ service_date: '2999-01-01' }).eq('id', recId).select('id')).error)

  // ---- удаление: история уходит вместе с автомобилем ----
  await a.storage.from(BUCKET).remove([path])
  const del = await a.from('cars').delete().eq('id', carId).select('id')
  check('владелец удаляет свой автомобиль', del.data?.length === 1, code(del))
  check('история удалена вместе с автомобилем', (await a.from('service_records').select('id').eq('id', recId)).data?.length === 0)
} catch (error) {
  failed++
  console.error('Проверка прервана: ' + (error?.message || error))
} finally {
  if (started) {
    await cleanup()
    // ---- после уборки в тестовых аккаунтах ничего не осталось ----
    for (const [label, c, id] of [['первом', a, userA], ['втором', b, userB]]) {
      const after = await inventory(c, id)
      check(`после проверки в ${label} аккаунте не осталось данных`, !!after && after.cars.length === 0 && after.records === 0 && after.files === 0, after ? `автомобилей ${after.cars.length}, записей ${after.records}, файлов ${after.files}` : 'не удалось прочитать')
    }
  }
  await a.auth.signOut().catch(() => {})
  await b.auth.signOut().catch(() => {})
}
console.log(failed === 0 ? '\nИТОГ: изоляция подтверждена, все проверки пройдены.' : `\nИТОГ: не пройдено проверок — ${failed}.`)
process.exit(failed === 0 ? 0 : 1)
