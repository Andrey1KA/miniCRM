-- Демо-данные для мини-CRM.
-- Запускать после миграции 20261105120000_init.sql, целиком, в SQL-редакторе Supabase.
-- Повторный запуск перезаписывает объекты и задачи, пользователей оставляет.
--
-- Вход (пароль у всех один):
--   petr.smirnov@minicrm.test   постановщик   Пётр Смирнов
--   anna.volkova@minicrm.test   исполнитель   Анна Волкова
--   oleg.nikitin@minicrm.test   исполнитель   Олег Никитин
--   пароль: Demo-12345
--
-- Перед проверкой выключить регистрацию:
-- Authentication → Sign In / Providers → Email → Allow new users to sign up = off.

create extension if not exists pgcrypto with schema extensions;

do $$
declare
  v_password text := extensions.crypt('Demo-12345', extensions.gen_salt('bf'));
  v_person record;
  v_id uuid;
  v_petr uuid;
  v_anna uuid;
  v_oleg uuid;
  v_north uuid := 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1';
  v_school uuid := 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2';
  v_warehouse uuid := 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3';
  v_foundation uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
  v_windows uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2';
  v_power uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3';
  v_roof uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4';
  v_fence uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5';
  v_rebar uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa6';
  v_step record;
  v_actor uuid;
  v_task uuid;
begin
  -- Чужой jwt в этой сессии не должен мешать записать роли.
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claim.role', '', true);
  perform set_config('request.jwt.claims', '{}', true);

  for v_person in
    select *
    from (
      values
        ('11111111-1111-4111-8111-111111111111'::uuid, 'petr.smirnov@minicrm.test', 'Пётр Смирнов', 'assigner'),
        ('22222222-2222-4222-8222-222222222222'::uuid, 'anna.volkova@minicrm.test', 'Анна Волкова', 'executor'),
        ('33333333-3333-4333-8333-333333333333'::uuid, 'oleg.nikitin@minicrm.test', 'Олег Никитин', 'executor')
    ) as person(id, email, full_name, role)
  loop
    select users.id
    into v_id
    from auth.users as users
    where users.email = v_person.email;

    if v_id is null then
      v_id := v_person.id;
      if exists (select 1 from auth.users where id = v_id) then
        v_id := gen_random_uuid();
      end if;

      insert into auth.users (
        instance_id,
        id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        raw_app_meta_data,
        raw_user_meta_data,
        created_at,
        updated_at,
        confirmation_token,
        recovery_token,
        email_change,
        email_change_token_new,
        email_change_token_current,
        reauthentication_token
      )
      values (
        '00000000-0000-0000-0000-000000000000',
        v_id,
        'authenticated',
        'authenticated',
        v_person.email,
        v_password,
        now(),
        jsonb_build_object(
          'provider', 'email',
          'providers', jsonb_build_array('email'),
          'role', v_person.role,
          'full_name', v_person.full_name
        ),
        '{}'::jsonb,
        now(),
        now(),
        '',
        '',
        '',
        '',
        '',
        ''
      );
    else
      update auth.users
      set
        encrypted_password = v_password,
        email_confirmed_at = coalesce(email_confirmed_at, now()),
        raw_app_meta_data = jsonb_build_object(
          'provider', 'email',
          'providers', jsonb_build_array('email'),
          'role', v_person.role,
          'full_name', v_person.full_name
        ),
        updated_at = now()
      where id = v_id;
    end if;

    delete from auth.identities
    where user_id = v_id
      and provider = 'email';

    insert into auth.identities (
      id,
      user_id,
      identity_data,
      provider,
      provider_id,
      last_sign_in_at,
      created_at,
      updated_at
    )
    values (
      gen_random_uuid(),
      v_id,
      jsonb_build_object('sub', v_id::text, 'email', v_person.email, 'email_verified', true),
      'email',
      v_id::text,
      now(),
      now(),
      now()
    );

    insert into public.profiles (id, full_name, role)
    values (v_id, v_person.full_name, v_person.role::public.user_role)
    on conflict (id) do update
    set
      full_name = excluded.full_name,
      role = excluded.role;
  end loop;

  select id into v_petr from auth.users where email = 'petr.smirnov@minicrm.test';
  select id into v_anna from auth.users where email = 'anna.volkova@minicrm.test';
  select id into v_oleg from auth.users where email = 'oleg.nikitin@minicrm.test';

  truncate table public.objects restart identity cascade;

  insert into public.objects (id, title, address, created_by)
  values
    (v_north, 'ЖК «Северный»', 'ул. Ленина, 10', v_petr),
    (v_school, 'Школа №4', 'ул. Строителей, 3', v_petr),
    (v_warehouse, 'Склад на Объездной', 'Объездная улица, 15', v_petr);

  insert into public.tasks (id, object_id, title, description, assignee_id, author_id, status)
  values
    (
      v_foundation,
      v_north,
      'Залить фундамент секции А',
      'Секция А, оси 1–4. Бетон привезут утром.',
      v_anna,
      v_petr,
      'new'
    ),
    (
      v_windows,
      v_north,
      'Согласовать окна',
      'Сверить спецификацию окон с проектом и отметить расхождения.',
      v_anna,
      v_petr,
      'new'
    ),
    (
      v_power,
      v_north,
      'Подключить временное электричество',
      'Щит на въезде, нужен допуск энергетика.',
      v_oleg,
      v_petr,
      'new'
    ),
    (
      v_roof,
      v_school,
      'Проверить кровлю',
      'Осмотреть примыкания после дождя и сфотографировать узлы.',
      v_anna,
      v_petr,
      'new'
    ),
    (
      v_fence,
      v_school,
      'Смонтировать ограждение',
      'Временное ограждение по периметру школьного двора.',
      v_anna,
      v_petr,
      'new'
    ),
    (
      v_rebar,
      v_warehouse,
      'Принять арматуру',
      'Сверить поставку с накладной и разложить по маркам.',
      v_oleg,
      v_petr,
      'new'
    );

  -- Цепочки такие, как их прошёл бы человек в интерфейсе.
  -- Фундамент: Анна взяла в работу.
  -- Окна: Анна отправила на проверку.
  -- Электричество: новая, Олег ещё не брал.
  -- Кровля: Пётр вернул на доработку с комментарием.
  -- Ограждение: Пётр принял.
  -- Арматура: Олег отправил на проверку.
  for v_step in
    select *
    from jsonb_to_recordset(
      '[
        {"task":"foundation","status":"in_progress","actor":"anna"},
        {"task":"windows","status":"in_progress","actor":"anna"},
        {"task":"windows","status":"in_review","actor":"anna"},
        {"task":"roof","status":"in_progress","actor":"anna"},
        {"task":"roof","status":"in_review","actor":"anna"},
        {"task":"roof","status":"rework","actor":"petr","comment":"Нет фотофиксации узлов. Переснимите примыкания и приложите снимки."},
        {"task":"fence","status":"in_progress","actor":"anna"},
        {"task":"fence","status":"in_review","actor":"anna"},
        {"task":"fence","status":"accepted","actor":"petr"},
        {"task":"rebar","status":"in_progress","actor":"oleg"},
        {"task":"rebar","status":"in_review","actor":"oleg"}
      ]'::jsonb
    ) as step(task text, status text, actor text, comment text)
  loop
    v_actor := case v_step.actor
      when 'anna' then v_anna
      when 'oleg' then v_oleg
      else v_petr
    end;

    v_task := case v_step.task
      when 'foundation' then v_foundation
      when 'windows' then v_windows
      when 'roof' then v_roof
      when 'fence' then v_fence
      when 'rebar' then v_rebar
      else null
    end;

    if v_task is null then
      raise exception 'В сиде неизвестная задача: %', v_step.task;
    end if;

    perform set_config('app.allow_admin_transition', 'on', true);
    perform set_config('app.changed_by', v_actor::text, true);
    perform set_config('app.transition_comment', coalesce(v_step.comment, ''), true);

    update public.tasks
    set status = v_step.status::public.task_status
    where id = v_task;

    if not found then
      raise exception 'Не удалось сменить статус задачи %', v_step.task;
    end if;
  end loop;

  perform set_config('app.allow_admin_transition', 'off', true);
  perform set_config('app.changed_by', '', true);
  perform set_config('app.transition_comment', '', true);

  if (select count(*) from public.objects) <> 3 then
    raise exception 'В сиде должно быть 3 объекта';
  end if;

  if (select count(*) from public.tasks) <> 6 then
    raise exception 'В сиде должно быть 6 задач';
  end if;

  if (select count(*) from public.task_status_history) <> 17 then
    raise exception 'В сиде должно быть 17 записей истории, сейчас %',
      (select count(*) from public.task_status_history);
  end if;

  if not exists (
    select 1
    from public.task_status_history
    where task_id = v_roof
      and to_status = 'rework'
      and comment = 'Нет фотофиксации узлов. Переснимите примыкания и приложите снимки.'
  ) then
    raise exception 'У кровли нет комментария о доработке';
  end if;
end $$;
