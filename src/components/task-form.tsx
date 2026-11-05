import { useForm } from 'react-hook-form'
import { Field, SelectInput } from '@/components/field.tsx'
import { Button } from '@/components/ui/button.tsx'
import { Input } from '@/components/ui/input.tsx'
import { Textarea } from '@/components/ui/textarea.tsx'
import { taskResolver, type TaskValues } from '@/lib/schemas.ts'

type Option = { id: string; label: string }

export function TaskForm({
  title,
  defaultValues,
  executors,
  objects,
  lockObject,
  pending,
  error,
  submitLabel,
  onCancel,
  onSubmit,
}: {
  title: string
  defaultValues: TaskValues
  executors: Option[]
  objects: Option[]
  lockObject: boolean
  pending: boolean
  error?: string
  submitLabel: string
  onCancel: () => void
  onSubmit: (values: TaskValues) => Promise<void>
}) {
  const form = useForm<TaskValues>({
    resolver: taskResolver,
    defaultValues,
  })

  return (
    <form
      className="grid gap-4 rounded-xl bg-card p-4 ring-1 ring-foreground/10"
      onSubmit={form.handleSubmit(async (values) => {
        await onSubmit(values)
      })}
      noValidate
    >
      <h2 className="font-medium">{title}</h2>
      <Field label="Название" htmlFor="task-title" error={form.formState.errors.title?.message}>
        <Input id="task-title" {...form.register('title')} />
      </Field>
      <Field
        label="Описание"
        htmlFor="task-description"
        error={form.formState.errors.description?.message}
      >
        <Textarea id="task-description" rows={4} {...form.register('description')} />
      </Field>
      <Field
        label="Исполнитель"
        htmlFor="task-assignee"
        error={form.formState.errors.assigneeId?.message}
      >
        <SelectInput id="task-assignee" {...form.register('assigneeId')}>
          <option value="">Выберите исполнителя</option>
          {executors.map((person) => (
            <option key={person.id} value={person.id}>
              {person.label}
            </option>
          ))}
        </SelectInput>
      </Field>
      {lockObject ? (
        <input type="hidden" {...form.register('objectId')} />
      ) : (
        <Field label="Объект" htmlFor="task-object" error={form.formState.errors.objectId?.message}>
          <SelectInput id="task-object" {...form.register('objectId')}>
            {objects.map((object) => (
              <option key={object.id} value={object.id}>
                {object.label}
              </option>
            ))}
          </SelectInput>
        </Field>
      )}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {submitLabel}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Отмена
        </Button>
      </div>
    </form>
  )
}
