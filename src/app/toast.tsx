import { useEffect, useState } from 'react'
import { useIsMobile } from '../useIsMobile'

// Короткое подтверждение после действия: «Запись добавлена», «Автомобиль удалён».
// Показывается только на телефоне, где после сохранения экран просто менялся без какого-либо отклика.

const EVENT = 'ai-auto:toast'
const VISIBLE_MS = 2600

/** Показать подтверждение. Можно вызывать из любого места кабинета */
export function toast(text: string) {
  window.dispatchEvent(new CustomEvent<string>(EVENT, { detail: text }))
}

export function Toaster() {
  const mobile = useIsMobile()
  const [message, setMessage] = useState<{ text: string; id: number } | null>(null)

  useEffect(() => {
    const show = (event: Event) => setMessage({ text: (event as CustomEvent<string>).detail, id: Date.now() })
    window.addEventListener(EVENT, show)
    return () => window.removeEventListener(EVENT, show)
  }, [])

  useEffect(() => {
    if (!message) return
    const timer = window.setTimeout(() => setMessage(null), VISIBLE_MS)
    return () => window.clearTimeout(timer)
  }, [message])

  if (!mobile || !message) return null
  return (
    <p className="toast" role="status" key={message.id}>
      {message.text}
    </p>
  )
}
