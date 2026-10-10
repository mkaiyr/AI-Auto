import { useIsMobile } from '../useIsMobile'
import { Logo } from './Logo'
import './Footer.css'

export function Footer() {
  const mobile = useIsMobile()
  return (
    <footer className="footer">
      <div className="container footer__inner">
        <div>
          <Logo />
          {/* на телефоне эта фраза уже стоит над заголовком главного экрана */}
          {!mobile && <p className="footer__text">Приложение для владельцев автомобилей.</p>}
        </div>
        <p className="footer__copy">© {new Date().getFullYear()} AI Auto. Проект в разработке.</p>
      </div>
    </footer>
  )
}
