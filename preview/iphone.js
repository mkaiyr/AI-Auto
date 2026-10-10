// Предпросмотр AI Auto в рамке iPhone: размеры, масштаб, цвет рамки и навигация по приложению.
// Работает только с локальным сервером разработки; само приложение не изменяет.

/** Размеры экрана в CSS-пикселях и скругление углов */
const DEVICES = {
  '15': { width: 393, height: 852, radius: 55 },
  '15-pro-max': { width: 430, height: 932, radius: 60 },
}
const BEZEL = 12
const SETTINGS_KEY = 'ai-auto:iphone-preview'

// Страница обычно открывается с того же сервера, что и приложение. Если её открыли как файл с диска,
// приложение берётся с адреса Vite по умолчанию.
const ORIGIN = location.protocol === 'file:' ? 'http://localhost:5173' : location.origin

const $ = (id) => document.getElementById(id)
const phone = $('phone')
const app = $('app')
const stage = $('stage')
const root = document.documentElement

function loadSettings() {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') ?? {}
  } catch {
    return {}
  }
}

const settings = { device: '15', scale: 'fit', frame: 'black', ...loadSettings() }

function saveSettings() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  } catch {
    // без localStorage настройки просто не запомнятся
  }
}

// ---------- размеры и масштаб ----------

function applyLayout() {
  const device = DEVICES[settings.device] ?? DEVICES['15']
  root.style.setProperty('--screen-w', `${device.width}px`)
  root.style.setProperty('--screen-h', `${device.height}px`)
  root.style.setProperty('--radius', `${device.radius}px`)

  let scale = Number(settings.scale)
  if (settings.scale === 'fit' || !Number.isFinite(scale)) {
    // макет целиком помещается в окно, но не увеличивается больше настоящего размера
    const style = getComputedStyle(stage)
    const freeWidth = stage.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
    const freeHeight = stage.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom)
    scale = Math.min(1, freeWidth / (device.width + BEZEL * 2), freeHeight / (device.height + BEZEL * 2))
    scale = Math.max(0.25, Math.floor(scale * 100) / 100)
  }
  root.style.setProperty('--scale', String(scale))
  phone.dataset.frame = settings.frame
}

for (const name of ['device', 'scale', 'frame']) {
  const control = $(name)
  control.value = settings[name]
  // сохранённое значение могло устареть — тогда остаётся первое из списка
  if (control.value !== settings[name]) settings[name] = control.value
  control.addEventListener('change', () => {
    settings[name] = control.value
    saveSettings()
    applyLayout()
  })
}
window.addEventListener('resize', applyLayout)

// ---------- строка состояния ----------

function tick() {
  const now = new Date()
  $('clock').textContent = `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`
}
tick()
setInterval(tick, 10000)

/** Яркость цвета от 0 до 1 по строке вида «rgb(14, 16, 19)» */
function luminance(color) {
  const parts = color.match(/[\d.]+/g)?.map(Number) ?? []
  if (parts.length < 3 || (parts.length > 3 && parts[3] === 0)) return null
  return (0.2126 * parts[0] + 0.7152 * parts[1] + 0.0722 * parts[2]) / 255
}

/**
 * Строка состояния и полоса внизу закрашиваются фоном приложения, а значки становятся светлыми
 * или тёмными по его яркости — как на настоящем iPhone. Цвет читается из приложения, а не задаётся здесь.
 */
function syncColors() {
  try {
    const doc = app.contentDocument
    if (!doc?.body) return
    const view = doc.defaultView
    let color = view.getComputedStyle(doc.body).backgroundColor
    if (luminance(color) === null) color = view.getComputedStyle(doc.documentElement).backgroundColor
    const light = luminance(color)
    if (light === null) return
    root.style.setProperty('--app-bg', color)
    root.style.setProperty('--app-ink', light > 0.6 ? '#000000' : '#ffffff')
  } catch {
    // приложение с другого адреса (страница открыта как файл): его цвета прочитать нельзя
  }
}

function showPath() {
  let path = ''
  try {
    path = app.contentWindow.location.pathname + app.contentWindow.location.search
  } catch {
    path = ''
  }
  $('path').textContent = path
  for (const button of document.querySelectorAll('[data-route]')) {
    button.toggleAttribute('aria-current', button.dataset.route === path)
  }
}

// ---------- приложение в рамке ----------

/** Отвечает ли локальный сервер. Без него вместо пустой рамки показывается подсказка с командой запуска */
async function serverResponds() {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 4000)
    await fetch(`${ORIGIN}/`, { mode: 'no-cors', cache: 'no-store', signal: controller.signal })
    clearTimeout(timer)
    return true
  } catch {
    return false
  }
}

async function open(route) {
  const alive = await serverResponds()
  $('notice').hidden = alive
  $('notice-url').textContent = `${ORIGIN}/preview/iphone.html`
  if (alive) app.src = ORIGIN + route
}

app.addEventListener('load', () => {
  syncColors()
  showPath()
})
// приложение меняет адрес и оформление без перезагрузки страницы — поэтому периодическая сверка
setInterval(() => {
  syncColors()
  showPath()
}, 700)

for (const button of document.querySelectorAll('[data-route]')) {
  button.addEventListener('click', () => open(button.dataset.route))
}
$('reload').addEventListener('click', () => {
  let current = '/'
  try {
    current = app.contentWindow.location.pathname || '/'
  } catch {
    current = '/'
  }
  open(current)
})
$('retry').addEventListener('click', () => open('/'))

applyLayout()
open('/')
