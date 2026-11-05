import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router'
import { useAuth } from '@/auth/auth-provider.tsx'
import { ObjectForm } from '@/components/object-form.tsx'
import { StatusBadge } from '@/components/status-badge.tsx'
import { TaskForm } from '@/components/task-form.tsx'
import { Button } from '@/components/ui/button.tsx'
import { createTask, deleteObject, updateObject } from '@/lib/api.ts'
import type { ObjectValues, TaskValues } from '@/lib/schemas.ts'
import { useObjects, usePersonName, useTasks } from '@/lib/use-work.ts'

export function ObjectPage() {
  const { objectId = '' } = useParams()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const queryClient = useQueryClient()
  const objects = useObjects()
  const tasks = useTasks()
  const people = usePersonName()
  const [editing, setEditing] = useState(false)
  const [creating, setCreating] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const isAssigner = profile?.role === 'assigner'

  const save = useMutation({
    mutationFn: (values: ObjectValues) => updateObject(objectId, values),
    onSuccess: async () => {
      setEditing(false)
      await queryClient.invalidateQueries({ queryKey: ['work'] })
    },
  })
  const remove = useMutation({
    mutationFn: () => deleteObject(objectId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['work'] })
      void navigate('/')
    },
  })
  const addTask = useMutation({
    mutationFn: (values: TaskValues) => createTask(values),
    onSuccess: async (created) => {
      await queryClient.invalidateQueries({ queryKey: ['work'] })
      void navigate(`/tasks/${created.id}`)
    },
  })

  if (objects.isPending || tasks.isPending || people.isPending) {
    return <p className="text-sm text-muted-foreground">Загрузка…</p>
  }

  if (objects.isError || tasks.isError || people.isError) {
    const error = objects.error ?? tasks.error ?? people.error
    return (
      <p className="text-sm text-destructive">
        {error instanceof Error ? error.message : 'Не удалось загрузить объект'}
      </p>
    )
  }

  const object = objects.data.find((item) => item.id === objectId)
  if (!object) {
    return (
      <div className="grid gap-3">
        <Link className="text-sm text-muted-foreground" to="/">
          ← Объекты
        </Link>
        <p>Объект не найден или он вам недоступен.</p>
      </div>
    )
  }

  const objectTasks = tasks.data.filter((task) => task.object_id === object.id)

  return (
    <>
      <Link className="text-sm text-muted-foreground" to="/">
        ← Объекты
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-medium">{object.title}</h1>
          <p className="text-sm text-muted-foreground">{object.address}</p>
        </div>
        {isAssigner && !editing ? (
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => setEditing(true)}>
              Изменить
            </Button>
            {confirmDelete ? (
              <>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={remove.isPending}
                  onClick={() => void remove.mutate()}
                >
                  Удалить
                </Button>
                <Button type="button" variant="ghost" onClick={() => setConfirmDelete(false)}>
                  Отмена
                </Button>
              </>
            ) : (
              <Button type="button" variant="outline" onClick={() => setConfirmDelete(true)}>
                Удалить
              </Button>
            )}
          </div>
        ) : null}
      </div>
      {remove.error instanceof Error ? (
        <p className="text-sm text-destructive">{remove.error.message}</p>
      ) : null}
      {editing ? (
        <ObjectForm
          title="Стройка"
          defaultValues={{ title: object.title, address: object.address }}
          pending={save.isPending}
          error={save.error instanceof Error ? save.error.message : undefined}
          submitLabel="Сохранить"
          onCancel={() => {
            save.reset()
            setEditing(false)
          }}
          onSubmit={async (values) => {
            await save.mutateAsync(values)
          }}
        />
      ) : null}
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-medium">Задачи</h2>
        {isAssigner && !creating ? (
          <Button type="button" onClick={() => setCreating(true)}>
            Новая задача
          </Button>
        ) : null}
      </div>
      {creating ? (
        <TaskForm
          title="Новая задача"
          defaultValues={{ title: '', description: '', assigneeId: '', objectId: object.id }}
          executors={people.executors.map((person) => ({
            id: person.id,
            label: person.full_name,
          }))}
          objects={[]}
          lockObject
          pending={addTask.isPending}
          error={addTask.error instanceof Error ? addTask.error.message : undefined}
          submitLabel="Создать"
          onCancel={() => {
            addTask.reset()
            setCreating(false)
          }}
          onSubmit={async (values) => {
            await addTask.mutateAsync(values)
          }}
        />
      ) : null}
      {objectTasks.length === 0 ? (
        <p className="text-sm text-muted-foreground">На этом объекте задач нет.</p>
      ) : (
        <ul className="grid gap-3">
          {objectTasks.map((task) => (
            <li key={task.id} className="rounded-xl ring-1 ring-foreground/10">
              <Link className="block px-4 py-3" to={`/tasks/${task.id}`}>
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-medium">{task.title}</h3>
                  <StatusBadge status={task.status} />
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {people.name(task.assignee_id)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
