import { appFunctions } from '../data/content'
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
          text="Сейчас приложение в разработке. Вот что появится в первой версии."
        />

        <ol className="functions">
          {appFunctions.map(({ id, title, text }, i) => (
            <li className="functions__item" id={id} key={id}>
              <Reveal delay={i * 60}>
                <article className="function-row">
                  <span className="function-row__index">0{i + 1}</span>
                  <h3 className="function-row__title">{title}</h3>
                  <p className="function-row__text">{text}</p>
                  <span className="function-row__tag">Скоро</span>
                </article>
              </Reveal>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
