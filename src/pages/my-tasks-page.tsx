import { Link, Navigate } from 'react-router'
import { useAuth } from '@/auth/auth-provider.tsx'
import { StatusBadge } from '@/components/status-badge.tsx'
import { taskStatusLabel, type TaskStatus } from '@/lib/domain.ts'
import { useObjects, useTasks } from '@/lib/use-work.ts'

const sectionOrder: TaskStatus[] = ['new', 'rework', 'in_progress', 'in_review', 'accepted']

export function MyTasksPage() {
  const { profile } = useAuth()
  const tasks = useTasks()
  const objects = useObjects()

  if (profile?.role === 'assigner') {
    return <Navigate to="/" replace />
  }

  if (tasks.isPending || objects.isPending) {
    return <p className="text-sm text-muted-foreground">Загрузка…</p>
  }

  if (tasks.isError || objects.isError) {
    const error = tasks.error ?? objects.error
    return (
      <p className="text-sm text-destructive">
        {error instanceof Error ? error.message : 'Не удалось загрузить задачи'}
      </p>
    )
  }

  const objectTitle = new Map(objects.data.map((object) => [object.id, object.title]))

  return (
    <>
      <h1 className="text-xl font-medium">Мои задачи</h1>
      {tasks.data.length === 0 ? (
        <p className="text-sm text-muted-foreground">Вам ещё не назначили задачи.</p>
      ) : (
        sectionOrder.map((status) => {
          const group = tasks.data.filter((task) => task.status === status)
          if (group.length === 0) {
            return null
          }
          return (
            <section key={status} className="grid gap-3">
              <h2 className="font-medium">{taskStatusLabel[status]}</h2>
              <ul className="grid gap-3">
                {group.map((task) => (
                  <li key={task.id} className="rounded-xl ring-1 ring-foreground/10">
                    <Link className="block px-4 py-3" to={`/tasks/${task.id}`}>
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="font-medium">{task.title}</h3>
                        <StatusBadge status={task.status} />
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {objectTitle.get(task.object_id) ?? 'Объект'}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )
        })
      )}
    </>
  )
}
