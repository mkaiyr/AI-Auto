// Серверная функция облачного ИИ-помощника AI Auto (Supabase Edge Function, среда Deno).
//
// СТАТУС: подготовлена, но НЕ развёрнута и НЕ проверена на настоящем сервере.
// Пока она не развёрнута, сайт и приложение к ней не обращаются (см. VITE_AI_CLOUD в src/ai/cloud.ts).
//
// Что делает: принимает переписку от вошедшего пользователя, добавляет инструкции и передаёт её
// модели Claude через API Anthropic. Ответ возвращается потоком обычного текста.
// Ключ API хранится только в секретах функции и в браузер не попадает.
//
// Что нужно настроить для настоящих ответов (сервис платный, оплата по объёму текста):
//   1. Получить ключ API в консоли Anthropic.
//   2. Сохранить его в секретах проекта:  supabase secrets set ANTHROPIC_API_KEY=...
//      (при желании AI_MODEL=... — модель; по умолчанию claude-haiku-5-5).
//   3. Развернуть функцию:  supabase functions deploy assistant
//   4. Добавить в окружение сборки сайта и приложений переменную VITE_AI_CLOUD=on.
//
// Ограничения этой версии: нет лимита запросов на пользователя и учёта расходов —
// их нужно добавить до открытия функции большому числу людей.

import { createClient } from 'jsr:@supabase/supabase-js@2'

const MODEL = Deno.env.get('AI_MODEL') ?? 'claude-haiku-5-5'
const MAX_MESSAGES = 10
const MAX_MESSAGE_LENGTH = 1500
const MAX_CAR_LENGTH = 3000
const MAX_ANSWER_TOKENS = 700

const SYSTEM_PROMPT = `Ты — ИИ-помощник приложения AI Auto для владельцев автомобилей. Отвечай только по-русски, простыми словами и коротко: не больше шести предложений или короткого списка.

Правила:
1. Ты языковая модель, а не автомеханик и не диагностический прибор. Ты не видишь и не слышишь автомобиль. Не ставь точный диагноз: называй возможные причины, начиная с самых частых, и говори, что стоит проверить.
2. Ничего не выдумывай: показания приборов, записи об обслуживании, характеристики автомобиля, цены, интервалы замены для конкретной модели. Значение кода ошибки называй, только если уверен; иначе советуй считать его сканером в сервисе. Если данных не хватает — задай уточняющий вопрос.
3. Тормоза, рулевое управление, подушки безопасности, шины и подвеска, запах топлива, дым, перегрев двигателя, красные лампы на панели — это опасно. Посоветуй не продолжать поездку и обратиться в автосервис. Никогда не говори, что с неисправностью можно ездить дальше.
4. Интервалы обслуживания называй как общие ориентиры и советуй сверяться с руководством по эксплуатации.
5. Данные об автомобиле пользователя бери только из блока «Данные пользователя», если он есть. Если блока нет, ты ничего не знаешь о его автомобиле.
6. Отвечай на вопросы об автомобилях и о приложении AI Auto. На посторонние темы вежливо откажись.

О приложении: «Автомобиль» — профиль машины; «История» — записи об обслуживании; «Расходы» — суммы по записям истории; «Напоминания» — раздел в разработке. Ты не можешь сам добавлять или менять записи.`

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const fail = (status: number, error: string) =>
  new Response(JSON.stringify({ error }), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

interface IncomingMessage {
  role: 'user' | 'assistant'
  content: string
}

/** Проверяет и обрезает переписку: только реплики пользователя и помощника, последняя — пользователя */
function readMessages(value: unknown): IncomingMessage[] | null {
  if (!Array.isArray(value)) return null
  const messages: IncomingMessage[] = []
  for (const item of value.slice(-MAX_MESSAGES)) {
    if (!item || typeof item !== 'object') return null
    const { role, content } = item as Record<string, unknown>
    if ((role !== 'user' && role !== 'assistant') || typeof content !== 'string' || content.trim() === '') return null
    messages.push({ role, content: content.slice(0, MAX_MESSAGE_LENGTH) })
  }
  // API требует, чтобы переписка начиналась с реплики пользователя
  while (messages.length > 0 && messages[0].role !== 'user') messages.shift()
  if (messages.length === 0 || messages[messages.length - 1].role !== 'user') return null
  return messages
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (request.method !== 'POST') return fail(405, 'method_not_allowed')

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) return fail(503, 'not_configured')

  // Отвечаем только вошедшим пользователям: без этого функцией мог бы пользоваться кто угодно
  const authorization = request.headers.get('Authorization') ?? ''
  const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
    global: { headers: { Authorization: authorization } },
  })
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData.user) return fail(401, 'unauthorized')

  let body: { messages?: unknown; car?: unknown }
  try {
    body = await request.json()
  } catch {
    return fail(400, 'bad_json')
  }
  const messages = readMessages(body.messages)
  if (!messages) return fail(400, 'bad_messages')
  const car = typeof body.car === 'string' && body.car.trim() !== '' ? body.car.slice(0, MAX_CAR_LENGTH) : null
  const system = car ? `${SYSTEM_PROMPT}\n\nДанные пользователя (получены из его личного кабинета):\n${car}` : SYSTEM_PROMPT

  const upstream = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: MODEL, max_tokens: MAX_ANSWER_TOKENS, system, messages, stream: true }),
    signal: request.signal,
  })
  if (!upstream.ok || !upstream.body) {
    console.error('Сервис ИИ ответил ошибкой', upstream.status, await upstream.text().catch(() => ''))
    return fail(upstream.status === 429 ? 429 : 502, 'upstream_error')
  }

  // Сервис отвечает событиями SSE; клиенту уходит только текст ответа
  const reader = upstream.body.getReader()
  const decoder = new TextDecoder()
  const encoder = new TextEncoder()
  let buffer = ''
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { done, value } = await reader.read()
      if (done) {
        controller.close()
        return
      }
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        if (!line.startsWith('data:')) continue
        try {
          const event = JSON.parse(line.slice(5))
          if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
            controller.enqueue(encoder.encode(event.delta.text))
          }
        } catch {
          // служебные строки потока пропускаются
        }
      }
    },
    cancel() {
      void reader.cancel()
    },
  })

  return new Response(stream, { headers: { ...cors, 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } })
})
