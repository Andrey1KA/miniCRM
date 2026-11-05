import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { Session } from '@supabase/supabase-js'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { fetchProfile } from '@/lib/api.ts'
import { hasSupabaseConfig, getSupabase } from '@/lib/supabase.ts'

type Profile = NonNullable<Awaited<ReturnType<typeof fetchProfile>>>

type AuthContextValue = {
  ready: boolean
  session: Session | null
  profile: Profile | null
  profileLoading: boolean
  profileError: Error | null
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

function mapAuthError(text: string): string {
  const normalized = text.toLowerCase()
  if (normalized.includes('invalid login')) {
    return 'Неверная почта или пароль'
  }
  if (normalized.includes('email not confirmed')) {
    return 'Почта не подтверждена'
  }
  return text
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(!hasSupabaseConfig())

  useEffect(() => {
    if (!hasSupabaseConfig()) {
      return
    }

    const supabase = getSupabase()
    let active = true

    void supabase.auth.getSession().then(({ data }) => {
      if (!active) {
        return
      }
      setSession(data.session)
      setReady(true)
    })

    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      setReady(true)
    })

    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [])

  const profileQuery = useQuery({
    queryKey: ['profile', session?.user.id],
    enabled: Boolean(session?.user.id),
    queryFn: () => fetchProfile(session!.user.id),
  })

  async function signIn(email: string, password: string) {
    if (!hasSupabaseConfig()) {
      throw new Error('Заполните VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY в файле .env')
    }
    const { error } = await getSupabase().auth.signInWithPassword({ email, password })
    if (error) {
      throw new Error(mapAuthError(error.message))
    }
  }

  async function signOut() {
    if (hasSupabaseConfig()) {
      await getSupabase().auth.signOut()
    }
    queryClient.clear()
    setSession(null)
  }

  const value: AuthContextValue = {
    ready,
    session,
    profile: profileQuery.data ?? null,
    profileLoading: Boolean(session) && profileQuery.isPending,
    profileError: profileQuery.error instanceof Error ? profileQuery.error : null,
    signIn,
    signOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext)
  if (!value) {
    throw new Error('useAuth используется вне AuthProvider')
  }
  return value
}
