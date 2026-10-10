/**
 * Знак раздела «ИИ-помощник»: буквы AI на скруглённой подложке.
 * Принимает те же свойства, что и значки lucide, чтобы стоять в общем списке разделов.
 * Размер и цвета задаются в мобильном слое стилей (src/styles/mobile.css).
 */
export function AiMark({ className = '' }: { className?: string; size?: number | string; strokeWidth?: number | string }) {
  return (
    <span className={`ai-mark ${className}`} aria-hidden="true">
      AI
    </span>
  )
}
