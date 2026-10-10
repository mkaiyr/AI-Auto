import {
  BellRing,
  CarFront,
  ClipboardList,
  Eye,
  Layers,
  ShieldCheck,
  Stethoscope,
  Wallet,
  type LucideIcon,
} from 'lucide-react'

// Все тексты главной страницы собраны здесь, чтобы их было легко менять.

export interface NavLink {
  label: string
  href: string
}

// href с «#» — якорь на главной странице, с «/» — отдельная страница сайта
export const navLinks: NavLink[] = [
  { label: 'Возможности', href: '#features' },
  { label: 'Функции', href: '#functions' },
  { label: 'ИИ-помощник', href: '/assistant' },
]

export interface Feature {
  icon: LucideIcon
  title: string
  text: string
}

export const features: Feature[] = [
  {
    icon: Layers,
    title: 'Всё в одном месте',
    text: 'Данные об автомобиле, ремонты и расходы собраны в одном приложении, а не в заметках и чеках.',
  },
  {
    icon: Eye,
    title: 'Понятнее, что с машиной',
    text: 'ИИ-помощник простым языком объясняет обслуживание и подсказывает, о чём спросить мастера. Это ориентир перед визитом в сервис, а не диагноз.',
  },
  {
    icon: ShieldCheck,
    title: 'Ничего не забыто',
    text: 'Плановое ТО и замена расходников не теряются из виду, даже если вы не следите за пробегом.',
  },
]

export interface AppFunction {
  /** Якорь строки в разделе «Функции»: на него ведут ссылки с главного экрана */
  id: string
  icon: LucideIcon
  title: string
  /** Короткое название для оглавления на главном экране */
  short: string
  text: string
  /** Раздел уже работает в приложении */
  ready?: boolean
}

export const appFunctions: AppFunction[] = [
  {
    id: 'car',
    icon: CarFront,
    title: 'Мой автомобиль',
    short: 'Автомобиль',
    ready: true,
    text: 'Марка, модель, год выпуска, пробег и другие характеристики вашей машины — основа для всех остальных разделов.',
  },
  {
    id: 'diagnostics',
    icon: Stethoscope,
    title: 'ИИ-помощник',
    short: 'Помощник',
    ready: true,
    text: 'Вопросы об обслуживании и типичных неисправностях — небольшой языковой модели прямо в браузере. Это не диагностика: при опасных признаках помощник отправит в сервис.',
  },
  {
    id: 'history',
    icon: ClipboardList,
    title: 'История обслуживания',
    short: 'История',
    ready: true,
    text: 'Замена масла, ремонты и запчасти в хронологии: что делали, когда и на каком пробеге.',
  },
  {
    id: 'expenses',
    icon: Wallet,
    title: 'Расходы',
    short: 'Расходы',
    ready: true,
    text: 'Суммы по периодам и категориям считаются по записям истории обслуживания — видно, сколько стоит владение.',
  },
  {
    id: 'reminders',
    icon: BellRing,
    title: 'Напоминания',
    short: 'Напоминания',
    text: 'Плановое обслуживание, замена расходников и другие важные события — вовремя и без записок.',
  },
]
