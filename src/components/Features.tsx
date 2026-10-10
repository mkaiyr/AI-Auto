import { features } from '../data/content'
import { Reveal } from './Reveal'
import { SectionHeading } from './SectionHeading'
import './Features.css'

export function Features() {
  return (
    <section className="section" id="features">
      <div className="container features">
        <SectionHeading eyebrow="Возможности" title="Спокойствие владельца вместо хаоса из чеков и заметок" />

        <ol className="features__list">
          {features.map(({ icon: Icon, title, text, brief }, i) => (
            <li key={title}>
              <Reveal className="feature" delay={i * 90}>
                <span className="feature__index">0{i + 1}</span>
                <Icon className="feature__icon only-mobile" size={22} strokeWidth={1.75} aria-hidden="true" />
                <h3 className="feature__title">{title}</h3>
                <p className="feature__text only-desktop">{text}</p>
                <p className="feature__text only-mobile">{brief}</p>
              </Reveal>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
