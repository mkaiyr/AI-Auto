import { heroChips } from '../data/content'
import './HeroGauge.css'

const TICK_COUNT = 54
const START_ANGLE = 135
const SWEEP = 270

/** Декоративный «прибор» на главном экране. Данные внутри — пример, а не реальные */
export function HeroGauge() {
  const ticks = Array.from({ length: TICK_COUNT + 1 }, (_, i) => {
    const angle = ((START_ANGLE + (SWEEP / TICK_COUNT) * i) * Math.PI) / 180
    const major = i % 6 === 0
    const inner = major ? 160 : 166
    return {
      major,
      x1: 200 + Math.cos(angle) * inner,
      y1: 200 + Math.sin(angle) * inner,
      x2: 200 + Math.cos(angle) * 176,
      y2: 200 + Math.sin(angle) * 176,
    }
  })

  return (
    <figure className="gauge">
      <div className="gauge__dial">
        <svg viewBox="0 0 400 400" aria-hidden="true">
          {ticks.map((tick, i) => (
            <line
              key={i}
              className={tick.major ? 'gauge__tick gauge__tick--major' : 'gauge__tick'}
              x1={tick.x1}
              y1={tick.y1}
              x2={tick.x2}
              y2={tick.y2}
            />
          ))}
          <circle className="gauge__track" cx="200" cy="200" r="136" pathLength="100" />
          <circle className="gauge__progress" cx="200" cy="200" r="136" pathLength="100" />
        </svg>

        <div className="gauge__center">
          <span className="gauge__label">До следующего ТО</span>
          <span className="gauge__value">
            2 400 <small>км</small>
          </span>
          <span className="gauge__note">Пример интерфейса</span>
        </div>
      </div>

      {heroChips.map(({ icon: Icon, label }, i) => (
        <div className={`gauge__chip gauge__chip--${i + 1}`} key={label}>
          <Icon size={16} strokeWidth={2} aria-hidden="true" />
          {label}
        </div>
      ))}

      <figcaption className="gauge__caption">Концепт будущего интерфейса AI Auto</figcaption>
    </figure>
  )
}
