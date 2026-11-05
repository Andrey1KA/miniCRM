# Мини-CRM «Объекты и задачи»

Небольшая CRM для строительной компании: постановщик ведёт стройки и задачи, исполнитель двигает свои задачи по статусам и сдаёт их на проверку. Права проверяет база Supabase, интерфейс показывает только то, что база и так отдаёт.

## Запуск

Нужны Node.js и проект на [supabase.com](https://supabase.com) (бесплатного тарифа достаточно).

1. В Supabase откройте Authentication → Sign In / Providers → Email и выключите **Allow new users to sign up**.
2. В SQL Editor выполните целиком `supabase/migrations/20261105120000_init.sql`, затем `supabase/seed.sql`.
3. Скопируйте `.env.example` в `.env`. Подставьте Project URL и anon (publishable) key из Project Settings → API. Ключ `service_role` в `.env` и в репозиторий не кладётся.
4. Установите зависимости и запустите интерфейс:

```bash
npm install
npm run dev
```

Приложение откроется на http://localhost:5173/. Сборка для выкладки: `npm run build`, локальный просмотр сборки: `npm run preview`.

Vite читает `.env` только при старте. Если файл появился после запуска, остановите процесс и выполните `npm run dev` ещё раз.

## Демо-вход

Пароль у всех троих: `Demo-12345`.

| Кто | Почта | Роль |
| --- | --- | --- |
| Пётр Смирнов | petr.smirnov@minicrm.test | постановщик |
| Анна Волкова | anna.volkova@minicrm.test | исполнитель |
| Олег Никитин | oleg.nikitin@minicrm.test | исполнитель |

В базе три стройки и шесть задач во всех статусах цикла. Повторный запуск `seed.sql` пересоздаёт стройки и задачи, пользователей не дублирует.

Проверки прав лежат в `supabase/tests/access_checks.sql`. Скрипт работает внутри транзакции и в конце откатывает изменения. Его нужно выполнить в SQL Editor целиком.

Как устроена система простыми словами: [docs/manager-guide.md](docs/manager-guide.md). Что решено сверх формулировок задания: [docs/decisions.md](docs/decisions.md).
