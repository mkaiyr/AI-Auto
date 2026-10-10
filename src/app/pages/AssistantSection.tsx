import { useCallback } from 'react'
import { AssistantChat, type CarContext } from '../../ai/AssistantChat'
import { AssistantChatMobile } from '../../ai/AssistantChatMobile'
import { describeCar } from '../../ai/prompt'
import type { AppFunction } from '../../data/content'
import { formatNumber } from '../format'
import { useRepositories, useUserId } from '../repositories'
import { useIsMobile } from '../../useIsMobile'

/**
 * ИИ-помощник в кабинете. Сам по себе он об автомобиле не знает: данные профиля и истории
 * запрашиваются из существующих хранилищ только после нажатия кнопки в чате и только на чтение.
 */
export function AssistantSection({ section, index }: { section: AppFunction; index: number }) {
  const repositories = useRepositories()
  const userId = useUserId()
  const mobile = useIsMobile()

  const loadCarContext = useCallback(async (): Promise<CarContext | null> => {
    const car = await repositories.car.get()
    if (!car) return null
    const records = await repositories.service.list(car.id)
    return {
      text: describeCar(car, records),
      summary: `${car.make} ${car.model}, ${car.year} год, пробег ${formatNumber(car.mileage)} км, записей в истории: ${records.length}.`,
    }
  }, [repositories])

  // на телефоне чат открывается сразу и занимает весь экран раздела
  if (mobile) {
    return (
      <div className="page">
        <AssistantChatMobile owner={userId} loadCarContext={loadCarContext} tabbar />
      </div>
    )
  }

  return (
    <div className="page">
      <p className="page__eyebrow">
        <b>0{index + 1}</b>
        {section.title}
      </p>
      <h1 className="page__title">{section.title}</h1>
      <p className="page__lead only-desktop">{section.text}</p>
      <AssistantChat loadCarContext={loadCarContext} />
    </div>
  )
}
