import { useForm } from 'react-hook-form'
import { Field } from '@/components/field.tsx'
import { Button } from '@/components/ui/button.tsx'
import { Input } from '@/components/ui/input.tsx'
import { objectResolver, type ObjectValues } from '@/lib/schemas.ts'

export function ObjectForm({
  title,
  defaultValues,
  pending,
  error,
  submitLabel,
  onCancel,
  onSubmit,
}: {
  title: string
  defaultValues: ObjectValues
  pending: boolean
  error?: string
  submitLabel: string
  onCancel: () => void
  onSubmit: (values: ObjectValues) => Promise<void>
}) {
  const form = useForm<ObjectValues>({
    resolver: objectResolver,
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
      <Field label="Название" htmlFor="object-title" error={form.formState.errors.title?.message}>
        <Input id="object-title" {...form.register('title')} />
      </Field>
      <Field label="Адрес" htmlFor="object-address" error={form.formState.errors.address?.message}>
        <Input id="object-address" {...form.register('address')} />
      </Field>
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
