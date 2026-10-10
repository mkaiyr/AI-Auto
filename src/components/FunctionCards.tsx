import { appFunctions } from '../data/content'
import { Link } from '../router'
import { useIsMobile } from '../useIsMobile'
import { Reveal } from './Reveal'
import { SectionHeading } from './SectionHeading'
import './FunctionCards.css'

/** Разделы приложения — строки оглавления, а не карточки */
export function FunctionCards() {
  const mobile = useIsMobile()
  return (
    <section className="section" id="functions">
      <div className="container">
        <SectionHeading
          eyebrow="Функции"
          title={mobile ? 'Пять разделов' : 'Пять разделов на всё владение автомобилем'}
          text="Профиль автомобиля, история обслуживания, расходы и ИИ-помощник уже работают; напоминания в разработке."
        />

        <ol className="functions">
          {appFunctions.map(({ id, icon: Icon, title, text, brief, ready }, i) => (
            <li className="functions__item" id={id} key={id}>
              <Reveal delay={i * 60}>
                <article className="function-row">
                  <span className="function-row__index">0{i + 1}</span>
                  <Icon className="function-row__icon only-mobile" size={22} strokeWidth={1.75} aria-hidden="true" />
                  <h3 className="function-row__title">{title}</h3>
                  <p className="function-row__text only-desktop">{text}</p>
                  <p className="function-row__text only-mobile">{brief}</p>
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
