import { NavLink, Navigate, Outlet } from 'react-router'
import { useAuth } from '@/auth/auth-provider.tsx'
import { Button } from '@/components/ui/button.tsx'
import { userRoleLabel } from '@/lib/domain.ts'

export function RequireAuth() {
  const { ready, session, profile, profileLoading, profileError } = useAuth()

  if (!ready || profileLoading) {
    return <p className="px-4 py-10 text-sm text-muted-foreground">Загрузка…</p>
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  if (profileError) {
    return <p className="px-4 py-10 text-sm text-destructive">{profileError.message}</p>
  }

  if (!profile) {
    return (
      <p className="px-4 py-10 text-sm text-destructive">
        Для этой учётной записи нет профиля в системе.
      </p>
    )
  }

  return <Outlet />
}

export function AppLayout() {
  const { profile, signOut } = useAuth()
  if (!profile) {
    return null
  }

  return (
    <div className="min-h-svh">
      <header className="border-b">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3">
          <p className="font-medium">Мини-CRM</p>
          <nav className="flex gap-4">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                isActive ? 'text-sm font-medium' : 'text-sm text-muted-foreground'
              }
            >
              Объекты
            </NavLink>
            {profile.role === 'executor' ? (
              <NavLink
                to="/my-tasks"
                className={({ isActive }) =>
                  isActive ? 'text-sm font-medium' : 'text-sm text-muted-foreground'
                }
              >
                Мои задачи
              </NavLink>
            ) : null}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <p className="text-sm text-muted-foreground">
              {profile.full_name} · {userRoleLabel[profile.role]}
            </p>
            <Button type="button" variant="outline" onClick={() => void signOut()}>
              Выйти
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto grid max-w-5xl gap-6 px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
