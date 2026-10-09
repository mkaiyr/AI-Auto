import './Logo.css'

export function Logo() {
  return (
    <a className="logo" href="#top" aria-label="AI Auto — на главную">
      <svg className="logo__mark" viewBox="0 0 32 32" aria-hidden="true">
        <rect width="32" height="32" rx="9" fill="var(--lime)" />
        <path
          d="M8.5 21a9 9 0 1 1 15 0M16 17.5 20.5 11"
          fill="none"
          stroke="var(--lime-ink)"
          strokeWidth="2.6"
          strokeLinecap="round"
        />
        <circle cx="16" cy="17.5" r="2.2" fill="var(--lime-ink)" />
      </svg>
      <span className="logo__text">
        AI <span>Auto</span>
      </span>
    </a>
  )
}
