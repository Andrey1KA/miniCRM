-- Мини-CRM «Объекты и задачи».
-- Права закрыты в базе: интерфейс потом только показывает то, что PostgreSQL и так отдаст.
--
-- Роли: assigner = постановщик, executor = исполнитель.
-- Статусы: new = Новая, in_progress = В работе, in_review = На проверке,
--          accepted = Принята, rework = На доработке.
--
-- Открытую регистрацию нужно выключить в Supabase:
-- Authentication → Sign In / Providers → Email → выключить Allow new users to sign up.
-- Пользователей создаёт seed. Роль берётся из app_metadata, её нельзя поменять запросом клиента.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Типы
-- ---------------------------------------------------------------------------

create type public.user_role as enum ('assigner', 'executor');

create type public.task_status as enum (
  'new',
  'in_progress',
  'in_review',
  'accepted',
  'rework'
);

comment on type public.user_role is
  'assigner = постановщик, executor = исполнитель';

comment on type public.task_status is
  'new = Новая, in_progress = В работе, in_review = На проверке, accepted = Принята, rework = На доработке';

-- Какие рёбра графа статусов вообще существуют. Кто имеет право идти по ребру — в триггере задачи.
create or replace function public.status_transition_shape(
  p_from public.task_status,
  p_to public.task_status
)
returns boolean
language sql
immutable
as $$
  select (p_from is null and p_to = 'new')
    or (p_from = 'new' and p_to = 'in_progress')
    or (p_from = 'in_progress' and p_to = 'in_review')
    or (p_from = 'in_review' and p_to = 'accepted')
    or (p_from = 'in_review' and p_to = 'rework')
    or (p_from = 'rework' and p_to = 'in_progress');
$$;

-- ---------------------------------------------------------------------------
-- Таблицы
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  role public.user_role not null,
  created_at timestamptz not null default now(),
  constraint profiles_full_name_not_blank check (char_length(btrim(full_name)) > 0)
);

comment on table public.profiles is
  'Профиль сотрудника. Строку создаёт триггер при появлении пользователя в auth.users.';

create table public.objects (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  address text not null,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  constraint objects_title_not_blank check (char_length(btrim(title)) > 0),
  constraint objects_address_not_blank check (char_length(btrim(address)) > 0)
);

comment on table public.objects is
  'Стройка: название и адрес.';

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  object_id uuid not null references public.objects (id),
  title text not null,
  description text not null default '',
  assignee_id uuid not null references public.profiles (id),
  author_id uuid not null references public.profiles (id),
  status public.task_status not null default 'new',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tasks_title_not_blank check (char_length(btrim(title)) > 0)
);

comment on table public.tasks is
  'Задача на объекте. Статус меняется только разрешённым переходом, автор и дата создания фиксируются базой.';

create index tasks_object_id_idx on public.tasks (object_id);
create index tasks_assignee_id_idx on public.tasks (assignee_id);
create index tasks_author_id_idx on public.tasks (author_id);

create table public.task_status_history (
  id uuid primary key default gen_random_uuid(),
  seq bigint generated always as identity,
  task_id uuid not null references public.tasks (id),
  changed_by uuid not null references public.profiles (id),
  from_status public.task_status,
  to_status public.task_status not null,
  comment text,
  created_at timestamptz not null default clock_timestamp(),
  constraint task_status_history_shape check (
    public.status_transition_shape(from_status, to_status)
  ),
  constraint task_status_history_rework_comment check (
    to_status <> 'rework'
    or (comment is not null and char_length(btrim(comment)) > 0)
  )
);

comment on table public.task_status_history is
  'Журнал смен статуса. Клиент его не пишет: строку добавляет триггер, изменить и удалить её запросом нельзя.';

create index task_status_history_task_seq_idx
  on public.task_status_history (task_id, seq);

-- ---------------------------------------------------------------------------
-- Чтение роли в обход RLS, чтобы политики не зацикливались друг на друге
-- ---------------------------------------------------------------------------

create or replace function public.profile_role(p_user_id uuid)
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.profiles
  where id = p_user_id
$$;

create or replace function public.is_assigner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.profile_role(auth.uid()) = 'assigner'
$$;

-- ---------------------------------------------------------------------------
-- Профиль: роль назначается при создании пользователя и дальше клиентом не меняется
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role_text text;
  v_full_name text;
begin
  v_role_text := new.raw_app_meta_data ->> 'role';
  if v_role_text is null or v_role_text not in ('assigner', 'executor') then
    raise exception 'Пользователя нужно создать с ролью assigner или executor в app_metadata';
  end if;

  v_full_name := nullif(btrim(coalesce(new.raw_app_meta_data ->> 'full_name', '')), '');
  if v_full_name is null then
    v_full_name := split_part(new.email, '@', 1);
  end if;

  insert into public.profiles (id, full_name, role)
  values (new.id, v_full_name, v_role_text::public.user_role);

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

create or replace function public.lock_profile_role()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.role is distinct from old.role then
    -- В SQL-редакторе от имени postgres роль поправить можно. Запрос вошедшего пользователя — нет.
    if auth.uid() is not null
      or current_user not in ('postgres', 'supabase_admin', 'supabase_auth_admin')
    then
      raise exception 'Роль нельзя изменить';
    end if;
  end if;

  if new.id is distinct from old.id then
    raise exception 'Идентификатор профиля нельзя изменить';
  end if;

  return new;
end;
$$;

create trigger profiles_lock_role
  before update on public.profiles
  for each row
  execute function public.lock_profile_role();

-- ---------------------------------------------------------------------------
-- Объекты
-- ---------------------------------------------------------------------------

create or replace function public.enforce_object_invariants()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.title := btrim(new.title);
  new.address := btrim(new.address);

  if tg_op = 'INSERT' then
    if auth.uid() is not null then
      if new.created_by is not null and new.created_by is distinct from auth.uid() then
        raise exception 'Объект создаёт текущий пользователь';
      end if;
      new.created_by := auth.uid();
    elsif public.profile_role(new.created_by) is distinct from 'assigner' then
      raise exception 'Создать объект может только постановщик';
    end if;

    new.created_at := now();
    return new;
  end if;

  new.id := old.id;
  new.created_by := old.created_by;
  new.created_at := old.created_at;
  return new;
end;
$$;

create trigger objects_enforce_invariants
  before insert or update on public.objects
  for each row
  execute function public.enforce_object_invariants();

-- Удаление объекта забирает его задачи. История снимается триггером задачи.
create or replace function public.delete_object_tasks()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.tasks
  where object_id = old.id;
  return old;
end;
$$;

create trigger objects_delete_tasks
  before delete on public.objects
  for each row
  execute function public.delete_object_tasks();

-- ---------------------------------------------------------------------------
-- Задачи: автор, дата и переходы статусов
-- ---------------------------------------------------------------------------

create or replace function public.enforce_task_invariants()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid;
  v_comment text;
begin
  new.title := btrim(new.title);
  new.description := btrim(coalesce(new.description, ''));

  if public.profile_role(new.assignee_id) is distinct from 'executor' then
    raise exception 'Исполнителем можно назначить только исполнителя';
  end if;

  if tg_op = 'INSERT' then
    if new.status is distinct from 'new' then
      raise exception 'Новая задача может быть создана только в статусе «Новая»';
    end if;

    if auth.uid() is not null then
      if new.author_id is not null and new.author_id is distinct from auth.uid() then
        raise exception 'Автором задачи становится тот, кто её создал';
      end if;
      new.author_id := auth.uid();
    elsif public.profile_role(new.author_id) is distinct from 'assigner' then
      raise exception 'Создать задачу может только постановщик';
    end if;

    new.created_at := now();
    new.updated_at := now();
    perform set_config('app.history_actor', new.author_id::text, true);
    perform set_config('app.history_comment', '', true);
    return new;
  end if;

  new.id := old.id;
  new.author_id := old.author_id;
  new.created_at := old.created_at;
  new.updated_at := now();

  if new.status is not distinct from old.status then
    return new;
  end if;

  -- В приложении актёр — это auth.uid(). Функция security definer, поэтому current_user
  -- здесь всегда владелец и по нему нельзя понять, кто прислал запрос.
  -- session_user для SQL-редактора — postgres, для API — authenticator.
  -- Сид передаёт актёра через app.changed_by и только при app.allow_admin_transition.
  -- Клиент по REST этот флаг в том же запросе выставить не может.
  v_actor := auth.uid();
  if v_actor is null
    and session_user in ('postgres', 'supabase_admin')
    and current_setting('app.allow_admin_transition', true) = 'on'
  then
    v_actor := nullif(current_setting('app.changed_by', true), '')::uuid;
  end if;

  if v_actor is null then
    raise exception 'Нужно войти в систему';
  end if;

  if not public.status_transition_shape(old.status, new.status) then
    raise exception 'Такой переход статуса запрещён';
  end if;

  v_comment := nullif(btrim(coalesce(current_setting('app.transition_comment', true), '')), '');

  if old.status = 'new' and new.status = 'in_progress' then
    if v_actor is distinct from old.assignee_id then
      raise exception 'Взять задачу в работу может только назначенный исполнитель';
    end if;
  elsif old.status = 'in_progress' and new.status = 'in_review' then
    if v_actor is distinct from old.assignee_id then
      raise exception 'Отправить задачу на проверку может только назначенный исполнитель';
    end if;
  elsif old.status = 'rework' and new.status = 'in_progress' then
    if v_actor is distinct from old.assignee_id then
      raise exception 'Вернуть задачу в работу может только назначенный исполнитель';
    end if;
  elsif old.status = 'in_review' and new.status = 'accepted' then
    if public.profile_role(v_actor) is distinct from 'assigner' then
      raise exception 'Принять задачу может только постановщик';
    end if;
  elsif old.status = 'in_review' and new.status = 'rework' then
    if public.profile_role(v_actor) is distinct from 'assigner' then
      raise exception 'Вернуть задачу на доработку может только постановщик';
    end if;
    if v_comment is null then
      raise exception 'Комментарий обязателен, чтобы вернуть задачу на доработку';
    end if;
  end if;

  perform set_config('app.history_actor', v_actor::text, true);
  perform set_config('app.history_comment', coalesce(v_comment, ''), true);
  return new;
end;
$$;

create trigger tasks_enforce_invariants
  before insert or update on public.tasks
  for each row
  execute function public.enforce_task_invariants();

create or replace function public.record_task_status_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid;
  v_comment text;
  v_from public.task_status;
begin
  if tg_op = 'UPDATE' and old.status is not distinct from new.status then
    return new;
  end if;

  v_actor := nullif(current_setting('app.history_actor', true), '')::uuid;
  if v_actor is null then
    raise exception 'Не удалось записать историю: не определён автор изменения';
  end if;

  v_comment := nullif(btrim(coalesce(current_setting('app.history_comment', true), '')), '');
  v_from := case when tg_op = 'INSERT' then null else old.status end;

  perform set_config('app.writing_history', 'on', true);

  insert into public.task_status_history (task_id, changed_by, from_status, to_status, comment)
  values (new.id, v_actor, v_from, new.status, v_comment);

  perform set_config('app.writing_history', 'off', true);
  return new;
end;
$$;

create trigger tasks_record_status_history
  after insert or update of status on public.tasks
  for each row
  execute function public.record_task_status_history();

create or replace function public.delete_task_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('app.deleting_task', 'on', true);
  delete from public.task_status_history
  where task_id = old.id;
  perform set_config('app.deleting_task', 'off', true);
  return old;
end;
$$;

create trigger tasks_delete_history
  before delete on public.tasks
  for each row
  execute function public.delete_task_history();

-- Единственная точка смены статуса для приложения.
-- Прямой update тоже упирается в тот же триггер, эта функция дополнительно передаёт комментарий.
create or replace function public.transition_task(
  p_task_id uuid,
  p_to_status public.task_status,
  p_comment text default null
)
returns public.tasks
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task public.tasks;
begin
  if auth.uid() is null then
    raise exception 'Нужно войти в систему';
  end if;

  select *
  into v_task
  from public.tasks
  where id = p_task_id
  for update;

  if not found then
    raise exception 'Задача не найдена';
  end if;

  perform set_config('app.transition_comment', coalesce(p_comment, ''), true);

  update public.tasks
  set status = p_to_status
  where id = p_task_id
  returning * into v_task;

  return v_task;
end;
$$;

comment on function public.transition_task(uuid, public.task_status, text) is
  'Смена статуса задачи. Запрещённый переход и возврат на доработку без комментария база отклоняет.';

-- ---------------------------------------------------------------------------
-- История неизменяема для клиента
-- ---------------------------------------------------------------------------

create or replace function public.protect_task_history()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' and current_setting('app.writing_history', true) = 'on' then
    return new;
  end if;

  if tg_op = 'DELETE' and current_setting('app.deleting_task', true) = 'on' then
    return old;
  end if;

  if tg_op = 'INSERT' then
    raise exception 'Историю статусов нельзя добавить напрямую';
  elsif tg_op = 'DELETE' then
    raise exception 'Историю статусов нельзя удалить';
  else
    raise exception 'Историю статусов нельзя изменить';
  end if;
end;
$$;

create trigger task_status_history_protect
  before insert or update or delete on public.task_status_history
  for each row
  execute function public.protect_task_history();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.objects enable row level security;
alter table public.tasks enable row level security;
alter table public.task_status_history enable row level security;

create policy profiles_select
  on public.profiles
  for select
  to authenticated
  using (
    id = auth.uid()
    or public.is_assigner()
    or exists (
      select 1
      from public.tasks as task
      where task.author_id = profiles.id
        and task.assignee_id = auth.uid()
    )
  );

create policy objects_select
  on public.objects
  for select
  to authenticated
  using (
    public.is_assigner()
    or exists (
      select 1
      from public.tasks as task
      where task.object_id = objects.id
        and task.assignee_id = auth.uid()
    )
  );

create policy objects_insert
  on public.objects
  for insert
  to authenticated
  with check (public.is_assigner() and created_by = auth.uid());

create policy objects_update
  on public.objects
  for update
  to authenticated
  using (public.is_assigner())
  with check (public.is_assigner());

create policy objects_delete
  on public.objects
  for delete
  to authenticated
  using (public.is_assigner());

create policy tasks_select
  on public.tasks
  for select
  to authenticated
  using (public.is_assigner() or assignee_id = auth.uid());

create policy tasks_insert
  on public.tasks
  for insert
  to authenticated
  with check (
    public.is_assigner()
    and author_id = auth.uid()
    and status = 'new'
  );

create policy tasks_update
  on public.tasks
  for update
  to authenticated
  using (public.is_assigner())
  with check (public.is_assigner());

create policy tasks_delete
  on public.tasks
  for delete
  to authenticated
  using (public.is_assigner());

create policy history_select
  on public.task_status_history
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.tasks as task
      where task.id = task_status_history.task_id
    )
  );

create policy history_insert_denied
  on public.task_status_history
  for insert
  to authenticated
  with check (false);

create policy history_update_denied
  on public.task_status_history
  for update
  to authenticated
  using (false);

create policy history_delete_denied
  on public.task_status_history
  for delete
  to authenticated
  using (false);

-- ---------------------------------------------------------------------------
-- Права ролей API. service_role сюда не кладётся и во фронтенд не попадает.
-- ---------------------------------------------------------------------------

revoke all on table public.profiles from public, anon, authenticated;
revoke all on table public.objects from public, anon, authenticated;
revoke all on table public.tasks from public, anon, authenticated;
revoke all on table public.task_status_history from public, anon, authenticated;

grant select on public.profiles to authenticated;
grant select, insert, update, delete on public.objects to authenticated;
grant select, insert, update, delete on public.tasks to authenticated;
grant select on public.task_status_history to authenticated;

revoke all on all sequences in schema public from public, anon, authenticated;

revoke all on function public.profile_role(uuid) from public, anon, authenticated;
revoke all on function public.is_assigner() from public, anon, authenticated;
revoke all on function public.status_transition_shape(public.task_status, public.task_status) from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.lock_profile_role() from public, anon, authenticated;
revoke all on function public.enforce_object_invariants() from public, anon, authenticated;
revoke all on function public.delete_object_tasks() from public, anon, authenticated;
revoke all on function public.enforce_task_invariants() from public, anon, authenticated;
revoke all on function public.record_task_status_history() from public, anon, authenticated;
revoke all on function public.delete_task_history() from public, anon, authenticated;
revoke all on function public.transition_task(uuid, public.task_status, text) from public, anon, authenticated;
revoke all on function public.protect_task_history() from public, anon, authenticated;

grant execute on function public.is_assigner() to authenticated;
grant execute on function public.status_transition_shape(public.task_status, public.task_status) to authenticated;
grant execute on function public.transition_task(uuid, public.task_status, text) to authenticated;

grant usage on type public.user_role to authenticated;
grant usage on type public.task_status to authenticated;
