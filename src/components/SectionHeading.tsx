import { Reveal } from './Reveal'
import './SectionHeading.css'

interface SectionHeadingProps {
  eyebrow: string
  title: string
  text?: string
}

/** Единый заголовок раздела: маленькая надпись, крупный заголовок и пояснение */
export function SectionHeading({ eyebrow, title, text }: SectionHeadingProps) {
  return (
    <Reveal className="section-heading">
      <p className="section-heading__eyebrow">{eyebrow}</p>
      <h2 className="section-heading__title">{title}</h2>
      {text && <p className="section-heading__text">{text}</p>}
    </Reveal>
  )
}
