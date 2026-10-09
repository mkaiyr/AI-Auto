import {
  BellRing,
  CarFront,
  ClipboardList,
  Eye,
  Layers,
  ShieldCheck,
  Stethoscope,
  Wallet,
  Wrench,
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
  icon: LucideIcon
  title: string
  text: string
  /** Крупная карточка с лаймовым акцентом */
  featured?: boolean
}

export const appFunctions: AppFunction[] = [
  {
    icon: CarFront,
    title: 'Профиль автомобиля',
    text: 'Марка, модель, год, пробег и ключевые характеристики вашей машины — основа для всех остальных разделов.',
  },
  {
    icon: Stethoscope,
    title: 'Диагностика по симптомам',
    text: 'Опишите, что происходит с автомобилем, и получите список возможных неисправностей и подсказку, что проверить первым.',
    featured: true,
  },
  {
    icon: ClipboardList,
    title: 'История обслуживания',
    text: 'Все ТО и ремонты в хронологии: что делали, когда и на каком пробеге.',
  },
  {
    icon: Wallet,
    title: 'Расходы на автомобиль',
    text: 'Топливо, сервис, страховка и запчасти — видно, сколько на самом деле стоит владение.',
  },
  {
    icon: BellRing,
    title: 'Напоминания',
    text: 'Вовремя подскажем о плановом ТО и замене масла, фильтров и других расходников.',
  },
]

export const heroChips: { icon: LucideIcon; label: string }[] = [
  { icon: Wrench, label: 'История обслуживания' },
  { icon: BellRing, label: 'Напоминание о ТО' },
]
