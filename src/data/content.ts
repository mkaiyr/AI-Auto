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

export const navLinks: NavLink[] = [
  { label: 'Возможности', href: '#features' },
  { label: 'Функции', href: '#functions' },
  { label: 'Кабинет', href: '/app/car' },
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
    title: 'Понятно, что с машиной',
    text: 'Симптомы и возможные причины объясняются простым языком — до поездки в сервис.',
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
    title: 'ИИ-диагностика',
    short: 'Диагностика',
    text: 'Опишите симптомы — получите структурированные рекомендации и предупреждение, если неисправность может быть опасной.',
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
    text: 'Топливо, обслуживание и ремонт — видно, сколько на самом деле стоит владение.',
  },
  {
    id: 'reminders',
    icon: BellRing,
    title: 'Напоминания',
    short: 'Напоминания',
    text: 'Плановое обслуживание, замена расходников и другие важные события — вовремя и без записок.',
  },
]
