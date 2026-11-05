import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.tsx'
import { hasSupabaseConfig } from '@/lib/supabase.ts'

export function ShellPage() {
  const configured = hasSupabaseConfig()

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-lg items-center px-4">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Мини-CRM</CardTitle>
          <CardDescription>Объекты и задачи</CardDescription>
        </CardHeader>
        <CardContent>
          <p>
            {configured
              ? 'Ключи Supabase заданы. Можно подключать экраны.'
              : 'Ключи Supabase ещё не заданы. Их нужно положить в .env.'}
          </p>
        </CardContent>
      </Card>
    </main>
  )
}
