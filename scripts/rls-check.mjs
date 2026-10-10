// Проверка изоляции данных двух аккаунтов на настоящем сервере Supabase.
//
// Создаёт синтетические данные от имени первого тестового аккаунта и пробует добраться
// до них от имени второго: прочитать, изменить, удалить, привязать запись к чужому автомобилю,
// загрузить файл в чужую папку. В конце удаляет всё, что создал. Чужие данные не трогает.
//
// Запуск:  node scripts/rls-check.mjs
//
// Нужны два ПОДТВЕРЖДЁННЫХ тестовых аккаунта (панель Supabase → Authentication → Users →
// Add user → включить «Auto Confirm User»). Их данные кладутся в файл .env.test.local
// в корне проекта — он скрыт от Git:
//
//   RLS_USER1_EMAIL=...
//   RLS_USER1_PASSWORD=...
//   RLS_USER2_EMAIL=...
//   RLS_USER2_PASSWORD=...
//
// Скрипт не печатает ключи, пароли и токены.

import { readFileSync, existsSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

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

const client = () => createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
const a = client(), b = client()
let failed = 0
const check = (name, ok, detail = '') => {
  if (!ok) failed++
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`)
}
const denied = (r) => !!r.error || (Array.isArray(r.data) && r.data.length === 0) || r.data === null
const code = (r) => r.error?.code || r.error?.statusCode || r.error?.message?.slice(0, 40) || 'нет ошибки'
const jpeg = new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xdb, 0, 0x43, 0, ...new Array(64).fill(1), 0xff, 0xd9])], { type: 'image/jpeg' })

let carId = null, userA = null, userB = null
try {
  const sa = await a.auth.signInWithPassword({ email: env.RLS_USER1_EMAIL, password: env.RLS_USER1_PASSWORD })
  const sb = await b.auth.signInWithPassword({ email: env.RLS_USER2_EMAIL, password: env.RLS_USER2_PASSWORD })
  if (sa.error || sb.error) throw new Error('Не удалось войти тестовыми аккаунтами: ' + (sa.error?.message || sb.error?.message))
  userA = sa.data.user.id; userB = sb.data.user.id
  check('два разных аккаунта', userA !== userB)

  // ---- первый аккаунт создаёт свои данные ----
  const car = await a.from('cars').insert({ make: 'RLS-TEST', model: 'synthetic', year: 2020, mileage: 1000 }).select('id, user_id').single()
  check('владелец создаёт автомобиль', !car.error && car.data.user_id === userA, code(car))
  carId = car.data?.id
  const rec = await a.from('service_records').insert({ car_id: carId, title: 'RLS-TEST', category: 'other', service_date: '2024-01-15', mileage: 900, cost: 10.5 }).select('id').single()
  check('владелец создаёт запись истории', !rec.error, code(rec))
  const recId = rec.data?.id
  const path = `${userA}/${carId}.jpg`
  const up = await a.storage.from('car-photos').upload(path, jpeg, { contentType: 'image/jpeg', upsert: true })
  check('владелец загружает фото своего автомобиля', !up.error, code(up))
  check('владелец получает подписанную ссылку', !(await a.storage.from('car-photos').createSignedUrl(path, 60)).error)
  check('владелец читает свои данные', (await a.from('cars').select('id').eq('id', carId)).data?.length === 1)

  // ---- второй аккаунт пробует добраться до чужого ----
  check('чужой автомобиль не читается', denied(await b.from('cars').select('id').eq('id', carId)))
  check('чужой автомобиль не меняется', denied(await b.from('cars').update({ mileage: 999999 }).eq('id', carId).select('id')))
  check('чужой автомобиль не удаляется', denied(await b.from('cars').delete().eq('id', carId).select('id')))
  check('чужая запись не читается', denied(await b.from('service_records').select('id').eq('id', recId)))
  check('чужая запись не меняется', denied(await b.from('service_records').update({ cost: 1 }).eq('id', recId).select('id')))
  check('чужая запись не удаляется', denied(await b.from('service_records').delete().eq('id', recId).select('id')))
  check('в списке второго нет данных первого', !(await b.from('cars').select('id')).data?.some((r) => r.id === carId))

  const r1 = await b.from('service_records').insert({ car_id: carId, title: 'RLS-ATTACK', category: 'other', service_date: '2024-01-15', mileage: 1, cost: 1 }).select('id')
  check('нельзя привязать запись к чужому автомобилю', !!r1.error, code(r1))
  const r2 = await b.from('service_records').insert({ car_id: carId, user_id: userA, title: 'RLS-ATTACK', category: 'other', service_date: '2024-01-15', mileage: 1, cost: 1 }).select('id')
  check('нельзя создать запись от имени другого пользователя', !!r2.error, code(r2))
  const r3 = await b.from('cars').insert({ user_id: userA, make: 'RLS-ATTACK', model: 'x', year: 2020, mileage: 1 }).select('id')
  check('нельзя создать автомобиль от имени другого пользователя', !!r3.error, code(r3))

  check('нельзя загрузить файл в чужую папку', !!(await b.storage.from('car-photos').upload(path, jpeg, { contentType: 'image/jpeg', upsert: true })).error)
  check('нельзя загрузить файл для несуществующего автомобиля', !!(await b.storage.from('car-photos').upload(`${userB}/00000000-0000-4000-8000-000000000000.jpg`, jpeg, { contentType: 'image/jpeg' })).error)
  check('чужое фото не скачивается', !!(await b.storage.from('car-photos').download(path)).error)
  check('на чужое фото не выдаётся подписанная ссылка', !!(await b.storage.from('car-photos').createSignedUrl(path, 60)).error)
  check('чужая папка выглядит пустой', ((await b.storage.from('car-photos').list(userA)).data || []).length === 0)
  check('чужое фото не удаляется', ((await b.storage.from('car-photos').remove([path])).data || []).length === 0 && !(await a.storage.from('car-photos').createSignedUrl(path, 60)).error)

  // ---- после всех попыток данные первого не изменились ----
  const still = await a.from('cars').select('mileage, user_id').eq('id', carId).single()
  check('данные владельца не изменены', still.data?.mileage === 1000 && still.data?.user_id === userA)
  const steal = await a.from('cars').update({ user_id: userB }).eq('id', carId).select('user_id')
  check('автомобиль нельзя передать другому пользователю', !!steal.error || steal.data?.[0]?.user_id === userA, code(steal))

  // ---- серверные проверки значений ----
  check('сервер отклоняет год 1800', !!(await a.from('cars').update({ year: 1800 }).eq('id', carId).select('id')).error)
  check('сервер отклоняет отрицательную стоимость', !!(await a.from('service_records').update({ cost: -1 }).eq('id', recId).select('id')).error)
  check('сервер отклоняет дату в будущем', !!(await a.from('service_records').update({ service_date: '2999-01-01' }).eq('id', recId).select('id')).error)

  // ---- удаление: история уходит вместе с автомобилем ----
  await a.storage.from('car-photos').remove([path])
  const del = await a.from('cars').delete().eq('id', carId).select('id')
  check('владелец удаляет автомобиль', del.data?.length === 1, code(del))
  check('история удалена вместе с автомобилем', (await a.from('service_records').select('id').eq('id', recId)).data?.length === 0)
  carId = null
} catch (error) {
  failed++
  console.error('Проверка прервана: ' + (error?.message || error))
} finally {
  // уборка: только то, что создал этот скрипт
  if (carId && userA) {
    await a.storage.from('car-photos').remove([`${userA}/${carId}.jpg`]).catch(() => {})
    await a.from('cars').delete().eq('id', carId)
  }
  await b.from('cars').delete().eq('make', 'RLS-ATTACK')
  await a.auth.signOut().catch(() => {})
  await b.auth.signOut().catch(() => {})
}
console.log(failed === 0 ? '\nИТОГ: изоляция подтверждена, все проверки пройдены.' : `\nИТОГ: не пройдено проверок — ${failed}.`)
process.exit(failed === 0 ? 0 : 1)
