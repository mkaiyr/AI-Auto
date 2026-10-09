import { appFunctions } from '../data/content'
import { Reveal } from './Reveal'
import { SectionHeading } from './SectionHeading'
import './FunctionCards.css'

export function FunctionCards() {
  return (
    <section className="section" id="functions">
      <div className="container">
        <SectionHeading
          eyebrow="Функции"
          title="Пять разделов, которые закрывают всё владение автомобилем"
          text="Сейчас приложение в разработке. Вот что появится в первой версии."
        />

        <ul className="function-grid">
          {appFunctions.map(({ icon: Icon, title, text, featured }, i) => (
            <li className="function-grid__item" key={title}>
              <Reveal className="function-grid__reveal" delay={(i % 3) * 90}>
                <article className={`function-card ${featured ? 'function-card--featured' : ''}`}>
                  <div className="function-card__top">
                    <span className="function-card__icon">
                      <Icon size={24} strokeWidth={1.7} aria-hidden="true" />
                    </span>
                    <span className="function-card__tag">Скоро</span>
                  </div>
                  <h3 className="function-card__title">{title}</h3>
                  <p className="function-card__text">{text}</p>
                </article>
              </Reveal>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
