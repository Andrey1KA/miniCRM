import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router'
import { useForm } from 'react-hook-form'
import { useAuth } from '@/auth/auth-provider.tsx'
import { Field } from '@/components/field.tsx'
import { StatusBadge } from '@/components/status-badge.tsx'
import { TaskForm } from '@/components/task-form.tsx'
import { Button } from '@/components/ui/button.tsx'
import { Textarea } from '@/components/ui/textarea.tsx'
import { deleteTask, transitionTask, updateTask } from '@/lib/api.ts'
import { taskStatusLabel, type TaskStatus } from '@/lib/domain.ts'
import { formatDateTime } from '@/lib/format.ts'
import { reworkResolver, type ReworkValues, type TaskValues } from '@/lib/schemas.ts'
import { actionsFor, waitingHint } from '@/lib/task-actions.ts'
import { useHistory, useObjects, usePersonName, useTasks } from '@/lib/use-work.ts'

export function TaskPage() {
  const { taskId = '' } = useParams()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const queryClient = useQueryClient()
  const tasks = useTasks()
  const objects = useObjects()
  const people = usePersonName()
  const history = useHistory(taskId)
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [rework, setRework] = useState(false)
  const reworkForm = useForm<ReworkValues>({
    resolver: reworkResolver,
    defaultValues: { comment: '' },
  })

  const task = tasks.data?.find((item) => item.id === taskId)
  const object = objects.data?.find((item) => item.id === task?.object_id)
  const isAssigner = profile?.role === 'assigner'

  const save = useMutation({
    mutationFn: (values: TaskValues) => updateTask(taskId, values),
    onSuccess: async () => {
      setEditing(false)
      await queryClient.invalidateQueries({ queryKey: ['work'] })
    },
  })
  const remove = useMutation({
    mutationFn: () => deleteTask(taskId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['work'] })
      void navigate(object ? `/objects/${object.id}` : '/')
    },
  })
  const move = useMutation({
    mutationFn: (input: { status: TaskStatus; comment?: string }) =>
      transitionTask(taskId, input.status, input.comment),
    onSuccess: async () => {
      setRework(false)
      reworkForm.reset()
      await queryClient.invalidateQueries({ queryKey: ['work'] })
    },
  })

  if (tasks.isPending || objects.isPending || people.isPending || history.isPending) {
    return <p className="text-sm text-muted-foreground">Загрузка…</p>
  }

  if (tasks.isError || objects.isError || people.isError || history.isError) {
    const error = tasks.error ?? objects.error ?? people.error ?? history.error
    return (
      <p className="text-sm text-destructive">
        {error instanceof Error ? error.message : 'Не удалось загрузить задачу'}
      </p>
    )
  }

  if (!task || !profile) {
    return (
      <div className="grid gap-3">
        <Link className="text-sm text-muted-foreground" to="/">
          ← Объекты
        </Link>
        <p>Задача не найдена или она вам недоступна.</p>
      </div>
    )
  }

  const actions = actionsFor(profile.role, task.status, task.assignee_id === profile.id)

  return (
    <>
      <Link
        className="text-sm text-muted-foreground"
        to={object ? `/objects/${object.id}` : '/'}
      >
        ← {object ? object.title : 'Объекты'}
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-2">
          <h1 className="text-xl font-medium">{task.title}</h1>
          <StatusBadge status={task.status} />
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
        <TaskForm
          title="Задача"
          defaultValues={{
            title: task.title,
            description: task.description,
            assigneeId: task.assignee_id,
            objectId: task.object_id,
          }}
          executors={people.executors.map((person) => ({
            id: person.id,
            label: person.full_name,
          }))}
          objects={objects.data.map((item) => ({ id: item.id, label: item.title }))}
          lockObject={false}
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
      ) : (
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Описание</dt>
            <dd className="whitespace-pre-wrap">{task.description || 'Без описания'}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Объект</dt>
            <dd>{object?.title ?? 'Объект недоступен'}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Исполнитель</dt>
            <dd>{people.name(task.assignee_id)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Автор</dt>
            <dd>{people.name(task.author_id)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Создана</dt>
            <dd>{formatDateTime(task.created_at)}</dd>
          </div>
        </dl>
      )}
      <section className="grid gap-3">
        <h2 className="font-medium">Действия</h2>
        {actions.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {actions.map((action) => (
              <Button
                key={action.status}
                type="button"
                variant={action.needsComment ? 'outline' : 'default'}
                disabled={move.isPending}
                onClick={() => {
                  if (action.needsComment) {
                    setRework(true)
                    return
                  }
                  setRework(false)
                  void move.mutate({ status: action.status })
                }}
              >
                {action.label}
              </Button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{waitingHint(task.status)}</p>
        )}
        {rework ? (
          <form
            className="grid max-w-lg gap-3"
            noValidate
            onSubmit={reworkForm.handleSubmit(async (values) => {
              await move.mutateAsync({ status: 'rework', comment: values.comment })
            })}
          >
            <Field
              label="Комментарий"
              htmlFor="rework-comment"
              error={reworkForm.formState.errors.comment?.message}
            >
              <Textarea id="rework-comment" rows={3} {...reworkForm.register('comment')} />
            </Field>
            <div className="flex gap-2">
              <Button type="submit" disabled={move.isPending}>
                Вернуть на доработку
              </Button>
              <Button type="button" variant="ghost" onClick={() => setRework(false)}>
                Отмена
              </Button>
            </div>
          </form>
        ) : null}
        {move.error instanceof Error ? (
          <p className="text-sm text-destructive">{move.error.message}</p>
        ) : null}
      </section>
      <section className="grid gap-3">
        <h2 className="font-medium">История</h2>
        <ol className="grid gap-3">
          {history.data.map((entry) => (
            <li key={entry.id} className="rounded-xl px-4 py-3 ring-1 ring-foreground/10">
              <p className="text-sm text-muted-foreground">
                {formatDateTime(entry.created_at)} · {people.name(entry.changed_by)}
              </p>
              <p className="mt-1">
                {entry.from_status
                  ? `${taskStatusLabel[entry.from_status]} → ${taskStatusLabel[entry.to_status]}`
                  : `Задача создана со статусом «${taskStatusLabel[entry.to_status]}»`}
              </p>
              {entry.comment ? <p className="mt-1 whitespace-pre-wrap">{entry.comment}</p> : null}
            </li>
          ))}
        </ol>
      </section>
    </>
  )
}
