import { useState } from 'react'
import { Menu, X } from 'lucide-react'
import { navLinks } from '../data/content'
import { Logo } from './Logo'
import './Header.css'

export function Header() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <header className="header" id="top">
      <div className="header__inner">
        <nav className={`header__nav ${menuOpen ? 'is-open' : ''}`} id="main-nav" aria-label="Основная навигация">
          <ul className="header__links">
            {navLinks.map((link) => (
              <li key={link.href}>
                <a className="header__link" href={link.href} onClick={() => setMenuOpen(false)}>
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <Logo />

        <span className="header__status">
          <span className="header__status-dot" aria-hidden="true" />
          В разработке
        </span>

        <button
          className="header__toggle"
          type="button"
          aria-label={menuOpen ? 'Закрыть меню' : 'Открыть меню'}
          aria-expanded={menuOpen}
          aria-controls="main-nav"
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? <X size={24} strokeWidth={1.25} aria-hidden="true" /> : <Menu size={24} strokeWidth={1.25} aria-hidden="true" />}
        </button>
      </div>
    </header>
  )
}
