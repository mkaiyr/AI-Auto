import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import './Button.css'

interface ButtonProps {
  href: string
  children: ReactNode
  variant?: 'primary' | 'ghost'
  icon?: LucideIcon
}

/** Кнопка-ссылка. Сейчас используется только для перехода к разделам страницы */
export function Button({ href, children, variant = 'primary', icon: Icon }: ButtonProps) {
  return (
    <a className={`button button--${variant}`} href={href}>
      {children}
      {Icon && <Icon className="button__icon" size={18} strokeWidth={2} aria-hidden="true" />}
    </a>
  )
}
