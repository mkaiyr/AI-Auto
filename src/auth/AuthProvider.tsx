import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
import { getSupabase, isSupabaseConfigured, SupabaseConfigError } from '../lib/supabase'
import { authErrorMessage } from './authErrors'

export type AuthState =
  /** сессия ещё восстанавливается после загрузки страницы */
  | { status: 'loading' }
  /** не заданы переменные окружения Supabase */
  | { status: 'unconfigured'; message: string }
  | { status: 'signedOut' }
  | { status: 'signedIn'; user: User }

/** Результат действия: ok или текст ошибки для пользователя */
export type AuthResult = { ok: true } | { ok: false; message: string; code?: string }

export type SignUpResult =
  /** сервер сразу выдал сессию (подтверждение почты отключено) */
  | { ok: true; needsConfirmation: false }
  /** аккаунт создан, но войти можно только после перехода по ссылке из письма */
  | { ok: true; needsConfirmation: true }
  | { ok: false; message: string }

interface AuthContextValue {
  state: AuthState
  signIn: (email: string, password: string) => Promise<AuthResult>
  signUp: (email: string, password: string) => Promise<SignUpResult>
  resendConfirmation: (email: string) => Promise<AuthResult>
  signOut: () => Promise<AuthResult>
}

const AuthContext = createContext<AuthContextValue | null>(null)

/** Куда ведёт ссылка из письма с подтверждением */
const confirmRedirect = () => `${window.location.origin}/app`

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

  useEffect(() => {
    if (!isSupabaseConfigured) return
    const supabase = getSupabase()
    let alive = true

    // Пользователь считается вошедшим только при наличии сессии, которую выдал Supabase.
    // Клиент сам хранит её между перезагрузками и обновляет токен.
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (alive) setState(data.session ? { status: 'signedIn', user: data.session.user } : { status: 'signedOut' })
      })
      .catch(() => alive && setState({ status: 'signedOut' }))

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (alive) setState(session ? { status: 'signedIn', user: session.user } : { status: 'signedOut' })
    })

    return () => {
      alive = false
      data.subscription.unsubscribe()
    }
  }, [])

  const signIn = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    try {
      const { error } = await getSupabase().auth.signInWithPassword({ email, password })
      return error ? { ok: false, message: authErrorMessage(error), code: error.code } : { ok: true }
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

      // Если почта уже зарегистрирована и подтверждена, сервер не сообщает об ошибке
      // (чтобы нельзя было перебирать адреса), а возвращает пользователя без identities.
      if (data.user && data.user.identities?.length === 0) {
        return { ok: false, message: authErrorMessage({ code: 'user_already_exists' }) }
      }
      return { ok: true, needsConfirmation: data.session === null }
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

  const signOut = useCallback(async (): Promise<AuthResult> => {
    try {
      // выход только на этом устройстве; локальные данные кабинета не затрагиваются
      const { error } = await getSupabase().auth.signOut({ scope: 'local' })
      return error ? { ok: false, message: authErrorMessage(error) } : { ok: true }
    } catch (error) {
      return { ok: false, message: authErrorMessage(error) }
    }
  }, [])

  const value = useMemo(
    () => ({ state, signIn, signUp, resendConfirmation, signOut }),
    [state, signIn, signUp, resendConfirmation, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth используется вне AuthProvider')
  return value
}
