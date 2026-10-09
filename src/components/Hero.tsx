import { ArrowRight } from 'lucide-react'
import { Button } from './Button'
import { HeroGauge } from './HeroGauge'
import './Hero.css'

export function Hero() {
  return (
    <section className="hero">
      <div className="container hero__inner">
        <div className="hero__content">
          <p className="hero__eyebrow">Для владельцев автомобилей</p>
          <h1 className="hero__title">
            Ваш автомобиль <span>под полным</span> контролем
          </h1>
          <p className="hero__text">
            AI Auto собирает всё о вашей машине в одном месте: состояние, обслуживание, расходы и
            напоминания. Меньше догадок — больше уверенности за рулём.
          </p>
          <div className="hero__actions">
            <Button href="#functions" icon={ArrowRight}>
              Смотреть функции
            </Button>
            <Button href="#features" variant="ghost">
              Возможности
            </Button>
          </div>
        </div>

        <div className="hero__visual">
          <HeroGauge />
        </div>
      </div>
    </section>
  )
}
