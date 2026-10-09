import { ArrowRight } from 'lucide-react'
import heroCar from '../assets/hero-car.jpg'
import { appFunctions } from '../data/content'
import { Button } from './Button'
import './Hero.css'

export function Hero() {
  return (
    <section className="hero">
      <img className="hero__photo" src={heroCar} alt="Чёрный седан в профиль, свет очерчивает линию крыши" />
      <div className="hero__shade" />
      <div className="hero__grain" />

      <div className="hero__copy">
        <p className="hero__eyebrow">Приложение для владельцев автомобилей</p>
        <h1 className="hero__title">
          <span className="hero__line">
            <span className="hero__word">Знайте свой</span> <span className="hero__word">автомобиль</span>
          </span>
          <span className="hero__line hero__line--accent">
            <em className="hero__accent">наизусть</em>
          </span>
        </h1>
      </div>

      <p className="hero__lead">
        Профиль машины, диагностика по симптомам, история обслуживания, расходы и напоминания о ТО — в
        одном месте.
      </p>

      <div className="hero__action">
        <Button href="#functions" icon={ArrowRight}>
          Смотреть функции
        </Button>
      </div>

      <footer className="hero__foot">
        <ol className="hero__index">
          {appFunctions.map(({ short }, i) => (
            <li key={short}>
              <a href="#functions">
                <b>0{i + 1}</b>
                {short}
              </a>
            </li>
          ))}
        </ol>
        <p className="hero__credit">Фото: Samuele Errico Piccarini / Unsplash</p>
      </footer>
    </section>
  )
}
