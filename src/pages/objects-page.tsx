import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router'
import { useAuth } from '@/auth/auth-provider.tsx'
import { ObjectForm } from '@/components/object-form.tsx'
import { Button } from '@/components/ui/button.tsx'
import { createObject } from '@/lib/api.ts'
import { taskStatusLabel, taskStatuses, type TaskStatus } from '@/lib/domain.ts'
import type { ObjectValues } from '@/lib/schemas.ts'
import { useObjects, useTasks } from '@/lib/use-work.ts'

function taskCountLabel(count: number): string {
  const mod10 = count % 10
  const mod100 = count % 100
  let word = 'задач'
  if (mod10 === 1 && mod100 !== 11) {
    word = 'задача'
  } else if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    word = 'задачи'
  }
  return `${count} ${word}`
}

function summary(tasks: { status: TaskStatus }[]): string {
  if (tasks.length === 0) {
    return 'Задач нет'
  }
  const counts = new Map<TaskStatus, number>()
  for (const task of tasks) {
    counts.set(task.status, (counts.get(task.status) ?? 0) + 1)
  }
  return taskStatuses
    .filter((status) => counts.has(status))
    .map((status) => `${taskStatusLabel[status]} ${counts.get(status)}`)
    .join(' · ')
}

export function ObjectsPage() {
  const { profile } = useAuth()
  const queryClient = useQueryClient()
  const objects = useObjects()
  const tasks = useTasks()
  const [creating, setCreating] = useState(false)
  const create = useMutation({
    mutationFn: (values: ObjectValues) => createObject(values),
    onSuccess: async () => {
      setCreating(false)
      await queryClient.invalidateQueries({ queryKey: ['work'] })
    },
  })

  if (objects.isPending || tasks.isPending) {
    return <p className="text-sm text-muted-foreground">Загрузка…</p>
  }

  if (objects.isError || tasks.isError) {
    const error = objects.error ?? tasks.error
    return (
      <p className="text-sm text-destructive">
        {error instanceof Error ? error.message : 'Не удалось загрузить объекты'}
      </p>
    )
  }

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-medium">Объекты</h1>
        {profile?.role === 'assigner' && !creating ? (
          <Button type="button" onClick={() => setCreating(true)}>
            Новая стройка
          </Button>
        ) : null}
      </div>
      {creating ? (
        <ObjectForm
          title="Новая стройка"
          defaultValues={{ title: '', address: '' }}
          pending={create.isPending}
          error={create.error instanceof Error ? create.error.message : undefined}
          submitLabel="Создать"
          onCancel={() => {
            create.reset()
            setCreating(false)
          }}
          onSubmit={async (values) => {
            await create.mutateAsync(values)
          }}
        />
      ) : null}
      {objects.data.length === 0 ? (
        <p className="text-sm text-muted-foreground">Строек пока нет.</p>
      ) : (
        <ul className="grid gap-3">
          {objects.data.map((object) => {
            const objectTasks = tasks.data.filter((task) => task.object_id === object.id)
            return (
              <li key={object.id} className="rounded-xl ring-1 ring-foreground/10">
                <Link className="block px-4 py-3" to={`/objects/${object.id}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="font-medium">{object.title}</h2>
                      <p className="text-sm text-muted-foreground">{object.address}</p>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {objectTasks.length === 0 ? 'нет задач' : taskCountLabel(objectTasks.length)}
                    </p>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{summary(objectTasks)}</p>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}
