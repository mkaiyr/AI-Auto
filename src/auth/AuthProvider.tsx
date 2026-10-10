import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
import { getSupabase, isSupabaseConfigured, SupabaseConfigError } from '../lib/supabase'
import { withBase } from '../router'
import { authErrorMessage, isNetworkAuthError, LINK_INVALID, NETWORK_ERROR } from './authErrors'

// Источник истины о входе — сервер Supabase, а не запись в браузере.
// Сессия, найденная в localStorage после перезагрузки, считается действительной только
// после того, как сервер подтвердил её токен (запрос getUser). Запись, подложенная
// вручную, такую проверку не проходит и удаляется.
//
// Это защищает интерфейс от «входа» по поддельной записи. Сами данные защищены независимо
// от этого: политики RLS на сервере отклоняют любой запрос без действительного токена.

export type AuthState =
  /** сессия ещё проверяется после загрузки страницы */
  | { status: 'loading' }
  /** не заданы переменные окружения Supabase */
  | { status: 'unconfigured'; message: string }
  /** в браузере есть сессия, но проверить её не удалось: нет связи с сервером */
  | { status: 'unreachable'; message: string }
  | { status: 'signedOut' }
  | { status: 'signedIn'; user: User }

/** Результат действия: ok или текст ошибки для пользователя */
export type AuthResult = { ok: true } | { ok: false; message: string; code?: string }

export type SignUpResult =
  /** сервер сразу выдал сессию (подтверждение почты отключено) */
  | { ok: true; needsConfirmation: false }
  /** запрос принят; войти можно только после перехода по ссылке из письма */
  | { ok: true; needsConfirmation: true }
  | { ok: false; message: string }

interface AuthContextValue {
  state: AuthState
  /** пользователь пришёл по ссылке восстановления пароля и должен задать новый */
  passwordRecovery: boolean
  /** сообщение о недействительной ссылке из письма, если страница открыта по такой ссылке */
  linkError: string | null
  clearLinkError: () => void
  signIn: (email: string, password: string) => Promise<AuthResult>
  signUp: (email: string, password: string) => Promise<SignUpResult>
  resendConfirmation: (email: string) => Promise<AuthResult>
  requestPasswordReset: (email: string) => Promise<AuthResult>
  updatePassword: (password: string) => Promise<AuthResult>
  signOut: () => Promise<AuthResult>
  /** повторить проверку сессии после сбоя связи */
  retry: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

/** Адреса, на которые ведут ссылки из писем. Должны быть разрешены в панели Supabase */
const confirmRedirect = () => `${window.location.origin}${withBase('/app')}`
const recoveryRedirect = () => `${window.location.origin}${withBase('/reset-password')}`

// Параметры ссылки из письма читаются до создания клиента: он убирает их из адреса при обработке
const linkParams = new URLSearchParams(window.location.hash.replace(/^#/, ''))
const linkQuery = new URLSearchParams(window.location.search)
const openedByBrokenLink = linkParams.has('error') || linkParams.has('error_code') || linkQuery.has('error_code')
const openedByRecoveryLink = linkParams.get('type') === 'recovery'

function initialState(): AuthState {
  if (isSupabaseConfigured) return { status: 'loading' }
  try {
    getSupabase()
  } catch (error) {
    return { status: 'unconfigured', message: error instanceof SupabaseConfigError ? error.message : 'Supabase не настроен.' }
  }
  return { status: 'loading' }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(initialState)
  const [passwordRecovery, setPasswordRecovery] = useState(openedByRecoveryLink)
  const [linkError, setLinkError] = useState<string | null>(openedByBrokenLink ? LINK_INVALID : null)
  /** идентификатор пользователя, сессию которого подтвердил сервер */
  const verifiedId = useRef<string | null>(null)
  const verifying = useRef<Promise<void> | null>(null)
  const alive = useRef(true)

  /** Спрашивает у сервера, действительна ли сессия из браузера */
  const verify = useCallback(() => {
    verifying.current ??= (async () => {
      const supabase = getSupabase()
      try {
        const { data, error } = await supabase.auth.getUser()
        if (!alive.current) return
        if (data.user) {
          verifiedId.current = data.user.id
          setState({ status: 'signedIn', user: data.user })
        } else if (isNetworkAuthError(error)) {
          // подтвердить нельзя — кабинет не открываем, но и сессию не трогаем
          setState({ status: 'unreachable', message: NETWORK_ERROR })
        } else {
          // сервер не признал токен: истёк, отозван или подделан
          verifiedId.current = null
          await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined)
          if (alive.current) setState({ status: 'signedOut' })
        }
      } catch {
        if (alive.current) setState({ status: 'unreachable', message: NETWORK_ERROR })
      } finally {
        verifying.current = null
      }
    })()
    return verifying.current
  }, [])

  useEffect(() => {
    if (!isSupabaseConfigured) return
    const supabase = getSupabase()
    alive.current = true

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!alive.current) return
        if (data.session) void verify()
        else setState({ status: 'signedOut' })
      })
      .catch(() => alive.current && setState({ status: 'signedOut' }))

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (!alive.current) return
      if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true)
      if (!session) {
        verifiedId.current = null
        setState({ status: 'signedOut' })
        return
      }
      // начальную сессию из хранилища проверяет запрос выше
      if (event === 'INITIAL_SESSION') return
      // Внутри обработчика нельзя ждать другие вызовы клиента, поэтому проверка откладывается.
      // К этому моменту вход по паролю уже успевает отметить пользователя подтверждённым.
      setTimeout(() => {
        if (!alive.current) return
        if (session.user.id === verifiedId.current) setState({ status: 'signedIn', user: session.user })
        else void verify()
      }, 0)
    })

    return () => {
      alive.current = false
      data.subscription.unsubscribe()
    }
  }, [verify])

  const retry = useCallback(() => {
    setState({ status: 'loading' })
    void verify()
  }, [verify])

  const clearLinkError = useCallback(() => setLinkError(null), [])

  const signIn = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    try {
      const { data, error } = await getSupabase().auth.signInWithPassword({ email, password })
      if (error || !data.user) return { ok: false, message: authErrorMessage(error), code: error?.code }
      // сессию только что выдал сервер — отдельная проверка не нужна
      verifiedId.current = data.user.id
      setState({ status: 'signedIn', user: data.user })
      return { ok: true }
    } catch (error) {
      return { ok: false, message: authErrorMessage(error) }
    }
  }, [])

  const signUp = useCallback(async (email: string, password: string): Promise<SignUpResult> => {
    try {
      const { data, error } = await getSupabase().auth.signUp({
        email,
        password,
        options: { emailRedirectTo: confirmRedirect() },
      })
      if (error) return { ok: false, message: authErrorMessage(error) }
      if (data.session && data.user) {
        verifiedId.current = data.user.id
        setState({ status: 'signedIn', user: data.user })
        return { ok: true, needsConfirmation: false }
      }
      // Для уже зарегистрированного адреса сервер отвечает так же, как для нового.
      // Экран один и тот же в обоих случаях, поэтому занятость адреса не раскрывается.
      return { ok: true, needsConfirmation: true }
    } catch (error) {
      return { ok: false, message: authErrorMessage(error) }
    }
  }, [])

  const resendConfirmation = useCallback(async (email: string): Promise<AuthResult> => {
    try {
      const { error } = await getSupabase().auth.resend({
        type: 'signup',
        email,
        options: { emailRedirectTo: confirmRedirect() },
      })
      return error ? { ok: false, message: authErrorMessage(error) } : { ok: true }
    } catch (error) {
      return { ok: false, message: authErrorMessage(error) }
    }
  }, [])

  const requestPasswordReset = useCallback(async (email: string): Promise<AuthResult> => {
    try {
      const { error } = await getSupabase().auth.resetPasswordForEmail(email, { redirectTo: recoveryRedirect() })
      return error ? { ok: false, message: authErrorMessage(error) } : { ok: true }
    } catch (error) {
      return { ok: false, message: authErrorMessage(error) }
    }
  }, [])

  const updatePassword = useCallback(async (password: string): Promise<AuthResult> => {
    try {
      const { error } = await getSupabase().auth.updateUser({ password })
      if (error) return { ok: false, message: authErrorMessage(error), code: error.code }
      setPasswordRecovery(false)
      return { ok: true }
    } catch (error) {
      return { ok: false, message: authErrorMessage(error) }
    }
  }, [])

  const signOut = useCallback(async (): Promise<AuthResult> => {
    try {
      // выход на этом устройстве; данные аккаунта остаются на сервере
      const { error } = await getSupabase().auth.signOut({ scope: 'local' })
      if (error) return { ok: false, message: authErrorMessage(error) }
      verifiedId.current = null
      setPasswordRecovery(false)
      return { ok: true }
    } catch (error) {
      return { ok: false, message: authErrorMessage(error) }
    }
  }, [])

  const value = useMemo(
    () => ({
      state,
      passwordRecovery,
      linkError,
      clearLinkError,
      signIn,
      signUp,
      resendConfirmation,
      requestPasswordReset,
      updatePassword,
      signOut,
      retry,
    }),
    [state, passwordRecovery, linkError, clearLinkError, signIn, signUp, resendConfirmation, requestPasswordReset, updatePassword, signOut, retry],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth используется вне AuthProvider')
  return value
}
