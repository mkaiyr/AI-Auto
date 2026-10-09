import { features } from '../data/content'
import { Reveal } from './Reveal'
import { SectionHeading } from './SectionHeading'
import './Features.css'

export function Features() {
  return (
    <section className="section" id="features">
      <div className="container">
        <SectionHeading
          eyebrow="Возможности"
          title="Спокойствие владельца вместо хаоса из чеков и заметок"
        />

        <ul className="features">
          {features.map(({ icon: Icon, title, text }, i) => (
            <li key={title}>
              <Reveal className="feature" delay={i * 90}>
                <div className="feature__top">
                  <Icon className="feature__icon" size={26} strokeWidth={1.6} aria-hidden="true" />
                  <span className="feature__index">0{i + 1}</span>
                </div>
                <h3 className="feature__title">{title}</h3>
                <p className="feature__text">{text}</p>
              </Reveal>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
