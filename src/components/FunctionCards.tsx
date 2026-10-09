import { appFunctions } from '../data/content'
import { Link } from '../router'
import { Reveal } from './Reveal'
import { SectionHeading } from './SectionHeading'
import './FunctionCards.css'

/** Разделы приложения — строки оглавления, а не карточки */
export function FunctionCards() {
  return (
    <section className="section" id="functions">
      <div className="container">
        <SectionHeading
          eyebrow="Функции"
          title="Пять разделов на всё владение автомобилем"
          text="Профиль автомобиля, история обслуживания и расходы уже работают; диагностика и напоминания в разработке."
        />

        <ol className="functions">
          {appFunctions.map(({ id, title, text, ready }, i) => (
            <li className="functions__item" id={id} key={id}>
              <Reveal delay={i * 60}>
                <article className="function-row">
                  <span className="function-row__index">0{i + 1}</span>
                  <h3 className="function-row__title">{title}</h3>
                  <p className="function-row__text">{text}</p>
                  {ready ? (
                    <Link className="function-row__tag function-row__tag--ready" to={`/app/${id}`}>
                      Открыть
                    </Link>
                  ) : (
                    <span className="function-row__tag">Скоро</span>
                  )}
                </article>
              </Reveal>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
