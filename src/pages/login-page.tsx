import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Navigate } from 'react-router'
import { useAuth } from '@/auth/auth-provider.tsx'
import { Field } from '@/components/field.tsx'
import { Button } from '@/components/ui/button.tsx'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.tsx'
import { Input } from '@/components/ui/input.tsx'
import { loginResolver, type LoginValues } from '@/lib/schemas.ts'

const demoAccounts = [
  ['Постановщик', 'petr.smirnov@minicrm.test'],
  ['Исполнитель', 'anna.volkova@minicrm.test'],
  ['Исполнитель', 'oleg.nikitin@minicrm.test'],
] as const

export function LoginPage() {
  const { ready, session, signIn } = useAuth()
  const [error, setError] = useState<string>()
  const form = useForm<LoginValues>({
    resolver: loginResolver,
    defaultValues: { email: '', password: '' },
  })

  if (!ready) {
    return <p className="px-4 py-10 text-sm text-muted-foreground">Загрузка…</p>
  }

  if (session) {
    return <Navigate to="/" replace />
  }

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md items-center px-4">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Мини-CRM</CardTitle>
          <CardDescription>Вход для сотрудников строительной компании</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <form
            className="grid gap-4"
            noValidate
            onSubmit={form.handleSubmit(async (values) => {
              setError(undefined)
              try {
                await signIn(values.email, values.password)
              } catch (caught) {
                setError(caught instanceof Error ? caught.message : 'Не удалось войти')
              }
            })}
          >
            <Field label="Почта" htmlFor="email" error={form.formState.errors.email?.message}>
              <Input id="email" type="email" autoComplete="username" {...form.register('email')} />
            </Field>
            <Field
              label="Пароль"
              htmlFor="password"
              error={form.formState.errors.password?.message}
            >
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                {...form.register('password')}
              />
            </Field>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <Button type="submit" disabled={form.formState.isSubmitting}>
              Войти
            </Button>
          </form>
          <div className="grid gap-1 text-sm text-muted-foreground">
            <p>Демо-вход, пароль Demo-12345</p>
            {demoAccounts.map(([role, email]) => (
              <p key={email}>
                {role}: {email}
              </p>
            ))}
          </div>
        </CardContent>
      </Card>
    </main>
  )
}
