import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

/** Путь сайта на GitHub Pages, если он не задан иначе: https://<пользователь>.github.io/site2/ */
const DEFAULT_PAGES_BASE = '/site2/'

/**
 * GitHub Pages не умеет отдавать index.html на вложенные адреса (/app/car и т. п.):
 * на прямое открытие или обновление такой страницы он отвечает файлом 404.html.
 * Поэтому кладём копию index.html под этим именем — приложение загрузится,
 * а роутер сам покажет нужную страницу по адресу.
 */
function spaFallback(): Plugin {
  return {
    name: 'ai-auto:spa-fallback',
    apply: 'build',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const index = bundle['index.html']
      if (index && index.type === 'asset') {
        this.emitFile({ type: 'asset', fileName: '404.html', source: index.source })
      }
    },
  }
}

export default defineConfig(({ command, mode }) => {
  // Имя репозитория определяет адрес сайта, поэтому путь можно переопределить
  // переменной VITE_BASE_PATH (её задаёт сборка на GitHub).
  const custom = loadEnv(mode, '.', 'VITE_').VITE_BASE_PATH
  const pagesBase = `/${(custom ?? DEFAULT_PAGES_BASE).replace(/^\/+|\/+$/g, '')}/`.replace('//', '/')

  return {
    // при локальной разработке сайт по-прежнему открывается с корня: http://localhost:5173/
    base: command === 'build' ? pagesBase : '/',
    plugins: [react(), spaFallback()],
  }
})
