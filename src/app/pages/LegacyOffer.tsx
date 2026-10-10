import { useState } from 'react'
import { useAuth } from '../../auth/AuthProvider'
import { plural } from '../format'
import { claimLegacyData, dismissLegacy, findLegacyData, isLegacyDismissed } from '../legacyData'
import { useUserId } from '../repositories'

/**
 * Предложение забрать данные, сохранённые в этом браузере до появления аккаунтов.
 * Ничего не переносит само: нужен явный выбор и подтверждение.
 */
export function LegacyOffer({ onClaimed }: { onClaimed: () => void }) {
  const userId = useUserId()
  const { state } = useAuth()
  const [legacy] = useState(findLegacyData)
  const [hidden, setHidden] = useState(() => isLegacyDismissed(userId))
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!legacy || hidden) return null

  const email = state.status === 'signedIn' ? state.user.email : null
  const parts = [
    'автомобиль',
    legacy.records > 0 && `${legacy.records} ${plural(legacy.records, ['запись', 'записи', 'записей'])} истории обслуживания`,
    legacy.hasPhoto && 'фотография',
  ].filter(Boolean)

  const handleClaim = () => {
    try {
      claimLegacyData(userId)
      onClaimed()
    } catch {
      setError('Не удалось перенести данные: в хранилище браузера не хватает места. Исходные данные не изменены.')
    }
  }

  return (
    <div className="status" role="region" aria-label="Данные без аккаунта">
      <p className="status__label">Данные без аккаунта</p>
      <p className="status__text">
        В этом браузере есть данные, сохранённые до появления входа в аккаунт: {parts.join(', ')}. Они не привязаны
        ни к одному аккаунту и в кабинете не показываются.
      </p>

      {confirming ? (
        <>
          <p className="status__text">
            Данные будут перенесены в аккаунт{email ? ` ${email}` : ''} и перестанут предлагаться другим аккаунтам в
            этом браузере. Переносите их, только если они ваши.
          </p>
          {error && (
            <p className="alert" role="alert">
              {error}
            </p>
          )}
          <div className="actions">
            <button className="btn btn--primary" type="button" onClick={handleClaim}>
              Перенести в мой аккаунт
            </button>
            <button className="btn" type="button" autoFocus onClick={() => setConfirming(false)}>
              Отмена
            </button>
          </div>
        </>
      ) : (
        <div className="actions">
          <button className="btn" type="button" onClick={() => setConfirming(true)}>
            Это мои данные
          </button>
          <button
            className="btn"
            type="button"
            onClick={() => {
              dismissLegacy(userId)
              setHidden(true)
            }}
          >
            Не мои
          </button>
        </div>
      )}
    </div>
  )
}
