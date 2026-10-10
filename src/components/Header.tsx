import { useState } from 'react'
import { ArrowUpRight, Menu, X } from 'lucide-react'
import { navLinks } from '../data/content'
import { Link } from '../router'
import { Logo } from './Logo'
import './Header.css'

/** Маршрут кабинета; без входа приложение само откроет страницу входа */
const CABINET_PATH = '/app/car'

export function Header() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <header className="header" id="top">
      <div className="header__inner">
        <nav className={`header__nav ${menuOpen ? 'is-open' : ''}`} id="main-nav" aria-label="Основная навигация">
          <ul className="header__links">
            {navLinks.map((link) => (
              <li key={link.href}>
                {link.href.startsWith('/') ? (
                  <Link className="header__link" to={link.href} onClick={() => setMenuOpen(false)}>
                    {link.label}
                  </Link>
                ) : (
                  <a className="header__link" href={link.href} onClick={() => setMenuOpen(false)}>
                    {link.label}
                  </a>
                )}
              </li>
            ))}
          </ul>
          {/* на телефоне кнопка кабинета живёт внутри меню, чтобы не переполнять шапку */}
          <Link className="header__cabinet header__cabinet--menu" to={CABINET_PATH} onClick={() => setMenuOpen(false)}>
            Личный кабинет
            <ArrowUpRight size={16} strokeWidth={1.75} aria-hidden="true" />
          </Link>
        </nav>

        <Logo />

        <div className="header__side">
          <span className="header__status">
            <span className="header__status-dot" aria-hidden="true" />
            В разработке
          </span>
          <Link className="header__cabinet" to={CABINET_PATH}>
            Личный кабинет
            <ArrowUpRight size={16} strokeWidth={1.75} aria-hidden="true" />
          </Link>
        </div>

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
