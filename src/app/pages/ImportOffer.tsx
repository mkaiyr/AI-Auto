import { useRef, useState } from 'react'
import { useAuth } from '../../auth/AuthProvider'
import { getSupabase } from '../../lib/supabase'
import { errorText } from '../dataErrors'
import { plural } from '../format'
import { dismissImport, findLocalData, importLocalData, type ImportResult } from '../localImport'
import { useRepositories, useUserId } from '../repositories'

/**
 * Предложение перенести в аккаунт данные прежней версии, сохранённые в этом браузере.
 * Само ничего не переносит: нужен явный выбор пользователя.
 */
export function ImportOffer({ onImported }: { onImported: () => void }) {
  const userId = useUserId()
  const { state } = useAuth()
  const { photo: photos } = useRepositories()
  const [snapshot] = useState(() => findLocalData(userId))
  const [hidden, setHidden] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)
  const running = useRef(false)

  if (!snapshot || hidden) return null

  const email = state.status === 'signedIn' ? state.user.email : null
  const count = (n: number) => `${n} ${plural(n, ['запись', 'записи', 'записей'])}`
  const parts = ['автомобиль', snapshot.records.length > 0 && `${count(snapshot.records.length)} истории обслуживания`, snapshot.photo && 'фотография'].filter(
    Boolean,
  )

  const handleImport = async () => {
    if (running.current) return
    running.current = true
    setWorking(true)
    setError(null)
    try {
      setResult(await importLocalData(userId, snapshot, getSupabase(), photos))
    } catch (cause) {
      setError(errorText(cause, 'Не удалось перенести данные. Локальная копия не изменена — попробуйте ещё раз.'))
    } finally {
      running.current = false
      setWorking(false)
    }
  }

  if (result) {
    return (
      <div className="status" role="status">
        <p className="status__label">Перенос завершён</p>
        <p className="status__text">
          Автомобиль{result.records > 0 ? ` и ${count(result.records)} истории` : ''} сохранены в аккаунте
          {result.photo === 'ok' ? ', фотография загружена' : ''}.
        </p>
        {result.skipped > 0 && (
          <p className="status__text">
            {count(result.skipped)} не перенесены: в них некорректные данные. Они остались в этом браузере.
          </p>
        )}
        {result.photo === 'failed' && (
          <p className="status__text">Фотографию загрузить не удалось — она осталась в этом браузере. Добавьте её заново в профиле.</p>
        )}
        <p className="status__text">
          {result.localRemoved ? 'Локальная копия удалена после проверки.' : 'Локальная копия сохранена в этом браузере.'}
        </p>
        <div className="actions">
          <button className="btn btn--primary" type="button" onClick={onImported}>
            Открыть профиль
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="status" role="region" aria-label="Данные из прежней версии">
      <p className="status__label">Данные из прежней версии</p>
      <p className="status__text">
        В этом браузере сохранены данные прежней версии сайта: {parts.join(', ')}.{' '}
        {snapshot.source === 'legacy'
          ? 'Они были добавлены до появления входа в аккаунт и никому не принадлежат.'
          : 'Они были добавлены под этим аккаунтом и хранятся только здесь.'}
      </p>
      {snapshot.skipped > 0 && (
        <p className="status__text">{count(snapshot.skipped)} с некорректными данными перенесены не будут и останутся в браузере.</p>
      )}

      {confirming ? (
        <>
          <p className="status__text">
            Данные будут сохранены в аккаунте{email ? ` ${email}` : ''} и станут доступны с любого устройства.
            {snapshot.source === 'legacy' && ' Переносите их, только если они ваши.'} Локальная копия удаляется только после
            успешной проверки переноса.
          </p>
          {error && (
            <p className="alert" role="alert">
              {error}
            </p>
          )}
          <div className="actions">
            <button className="btn btn--primary" type="button" onClick={handleImport} disabled={working}>
              {working ? 'Перенос…' : 'Перенести в аккаунт'}
            </button>
            <button className="btn" type="button" onClick={() => setConfirming(false)} disabled={working}>
              Отмена
            </button>
          </div>
        </>
      ) : (
        <div className="actions">
          <button className="btn" type="button" onClick={() => setConfirming(true)}>
            Перенести в аккаунт
          </button>
          <button
            className="btn"
            type="button"
            onClick={() => {
              dismissImport(userId)
              setHidden(true)
            }}
          >
            Не переносить
          </button>
        </div>
      )}
    </div>
  )
}
