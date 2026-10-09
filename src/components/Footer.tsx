import { Logo } from './Logo'
import './Footer.css'

export function Footer() {
  return (
    <footer className="footer">
      <div className="container footer__inner">
        <div>
          <Logo />
          <p className="footer__text">Приложение для владельцев автомобилей.</p>
        </div>
        <p className="footer__copy">© {new Date().getFullYear()} AI Auto. Проект в разработке.</p>
      </div>
    </footer>
  )
}
