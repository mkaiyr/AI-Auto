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
          {features.map(({ title, text }, i) => (
            <li key={title}>
              <Reveal className="feature" delay={i * 90}>
                <span className="feature__index">0{i + 1}</span>
                <h3 className="feature__title">{title}</h3>
                <p className="feature__text">{text}</p>
              </Reveal>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
