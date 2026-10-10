import type { ReactNode } from 'react'

// Простое оформление ответа ИИ: абзацы, списки, выделение и технические обозначения.
// Полный Markdown здесь не нужен: модель пишет короткие ответы.

const INLINE = /(\*\*[^*\n]+\*\*|`[^`\n]+`)/g

/** Жирный текст и обозначения в обратных кавычках (коды ошибок, названия деталей) */
function inline(text: string): ReactNode[] {
  return text.split(INLINE).map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) return <b key={index}>{part.slice(2, -2)}</b>
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) return <code key={index}>{part.slice(1, -1)}</code>
    return part
  })
}

const BULLET = /^\s*[-*•]\s+/
const NUMBERED = /^\s*\d{1,2}[.)]\s+/

/** Убирает решётки заголовков и иероглифы, которые маленькая модель иногда вставляет в русский текст */
const clean = (text: string) => text.replace(/^#{1,4}\s+/gm, '').replace(/[぀-ヿ㐀-鿿가-힯]+/g, '')

export function RichText({ text }: { text: string }) {
  const blocks: ReactNode[] = []
  let list: { ordered: boolean; items: string[] } | null = null
  let paragraph: string[] = []

  const flush = () => {
    if (paragraph.length > 0) {
      blocks.push(<p key={blocks.length}>{inline(paragraph.join(' '))}</p>)
      paragraph = []
    }
    if (list) {
      const items = list.items.map((item, index) => <li key={index}>{inline(item)}</li>)
      blocks.push(list.ordered ? <ol key={blocks.length}>{items}</ol> : <ul key={blocks.length}>{items}</ul>)
      list = null
    }
  }

  for (const line of clean(text).split('\n')) {
    const ordered = NUMBERED.test(line)
    if (ordered || BULLET.test(line)) {
      if (paragraph.length > 0 || (list && list.ordered !== ordered)) flush()
      list ??= { ordered, items: [] }
      list.items.push(line.replace(ordered ? NUMBERED : BULLET, ''))
    } else if (line.trim() === '') {
      flush()
    } else {
      if (list) flush()
      paragraph.push(line.trim())
    }
  }
  flush()

  return <div className="chat__rich">{blocks}</div>
}
