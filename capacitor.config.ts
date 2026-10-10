import type { CapacitorConfig } from '@capacitor/cli'

// Настройки мобильной оболочки Capacitor.
// Приложение — это тот же сайт, собранный в папку dist с базовым путём «/»
// (VITE_BASE_PATH=/), а не «/AI-Auto/», как для GitHub Pages.
// Секретов здесь нет и быть не должно: файл попадает в репозиторий и в приложение.
const config: CapacitorConfig = {
  // идентификатор приложения в магазинах: после публикации его изменить нельзя
  appId: 'kz.aiauto.app',
  appName: 'AI Auto',
  webDir: 'dist',
}

export default config
