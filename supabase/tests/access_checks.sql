-- Проверки прав в обход интерфейса.
-- Запускать целиком после seed.sql. В конце транзакция откатывается, данные сида остаются.
-- Если скрипт остановился ошибкой, выполните отдельно: rollback;

begin;

do $checks$
declare
  v_petr uuid;
  v_anna uuid;
  v_oleg uuid;
  v_north uuid;
  v_school uuid;
  v_warehouse uuid;
  v_foundation uuid;
  v_windows uuid;
  v_power uuid;
  v_roof uuid;
  v_count integer;
  v_title text;
  v_status public.task_status;
  v_comment text;
begin
  select id into v_petr from auth.users where email = 'petr.smirnov@minicrm.test';
  select id into v_anna from auth.users where email = 'anna.volkova@minicrm.test';
  select id into v_oleg from auth.users where email = 'oleg.nikitin@minicrm.test';

  if v_petr is null or v_anna is null or v_oleg is null then
    raise exception 'Сначала выполните seed.sql';
  end if;

  select id into v_north from public.objects where title = 'ЖК «Северный»';
  select id into v_school from public.objects where title = 'Школа №4';
  select id into v_warehouse from public.objects where title = 'Склад на Объездной';
  select id into v_foundation from public.tasks where title = 'Залить фундамент секции А';
  select id into v_windows from public.tasks where title = 'Согласовать окна';
  select id into v_power from public.tasks where title = 'Подключить временное электричество';
  select id into v_roof from public.tasks where title = 'Проверить кровлю';

  -- Даже владелец базы не пишет историю руками и не правит её.
  begin
    insert into public.task_status_history (task_id, changed_by, from_status, to_status)
    values (v_power, v_petr, 'new', 'in_progress');
    raise exception 'CHECK FAILED: историю удалось вставить напрямую';
  exception
    when others then
      if sqlerrm like '%CHECK FAILED%' then
        raise;
      end if;
      if sqlerrm not like '%нельзя добавить%' then
        raise exception 'Прямая вставка истории вернула неожиданную ошибку: %', sqlerrm;
      end if;
  end;

  begin
    update public.task_status_history
    set comment = 'подмена'
    where task_id = v_roof;
    raise exception 'CHECK FAILED: историю удалось изменить';
  exception
    when others then
      if sqlerrm like '%CHECK FAILED%' then
        raise;
      end if;
      if sqlerrm not like '%нельзя изменить%' then
        raise exception 'Правка истории вернула неожиданную ошибку: %', sqlerrm;
      end if;
  end;

  begin
    delete from public.task_status_history
    where task_id = v_power;
    raise exception 'CHECK FAILED: историю удалось удалить';
  exception
    when others then
      if sqlerrm like '%CHECK FAILED%' then
        raise;
      end if;
      if sqlerrm not like '%нельзя удалить%' then
        raise exception 'Удаление истории вернуло неожиданную ошибку: %', sqlerrm;
      end if;
  end;

  perform set_config('request.jwt.claim.sub', v_anna::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', v_anna::text, 'role', 'authenticated')::text,
    true
  );
  execute 'set local role authenticated';

  if auth.uid() is distinct from v_anna then
    raise exception 'Не удалось войти в проверку как Анна. auth.uid() = %', auth.uid();
  end if;

  select count(*) into v_count from public.tasks;
  if v_count <> 4 then
    raise exception 'Анна видит % задач, а должна видеть 4 своих', v_count;
  end if;

  select count(*) into v_count from public.tasks where id = v_power;
  if v_count <> 0 then
    raise exception 'Анна видит чужую задачу про электричество';
  end if;

  select count(*) into v_count from public.objects;
  if v_count <> 2 then
    raise exception 'Анна видит % объектов, а должна видеть 2', v_count;
  end if;

  select count(*) into v_count from public.objects where id = v_warehouse;
  if v_count <> 0 then
    raise exception 'Анна видит склад, хотя задач там у неё нет';
  end if;

  select count(*) into v_count from public.tasks where object_id = v_north;
  if v_count <> 2 then
    raise exception 'На Северном Анна видит % задач, а должна видеть только 2 свои', v_count;
  end if;

  select count(*) into v_count from public.task_status_history;
  if v_count <> 13 then
    raise exception 'Анна видит % записей истории, а должна видеть 13', v_count;
  end if;

  select count(*) into v_count
  from public.task_status_history
  where task_id = v_power;
  if v_count <> 0 then
    raise exception 'Анна видит историю чужой задачи';
  end if;

  select count(*) into v_count from public.profiles where id = v_oleg;
  if v_count <> 0 then
    raise exception 'Анна видит профиль Олега';
  end if;

  select count(*) into v_count from public.profiles where id = v_petr;
  if v_count <> 1 then
    raise exception 'Анна не видит постановщика, который поставил ей задачи';
  end if;

  update public.tasks
  set title = 'Чужая правка'
  where id = v_foundation;

  execute 'set local role postgres';
  select title into v_title from public.tasks where id = v_foundation;
  if v_title is distinct from 'Залить фундамент секции А' then
    raise exception 'Исполнитель изменил название задачи';
  end if;

  execute 'set local role authenticated';

  begin
    perform public.transition_task(v_power, 'in_progress', null);
    raise exception 'CHECK FAILED: Анна взяла чужую задачу';
  exception
    when others then
      if sqlerrm like '%CHECK FAILED%' then
        raise;
      end if;
      if sqlerrm not like '%только назначенный исполнитель%' then
        raise exception 'Чужой переход Анны вернул: %', sqlerrm;
      end if;
  end;

  begin
    perform public.transition_task(v_foundation, 'accepted', null);
    raise exception 'CHECK FAILED: Анна приняла свою задачу, минуя цепочку';
  exception
    when others then
      if sqlerrm like '%CHECK FAILED%' then
        raise;
      end if;
      if sqlerrm not like '%запрещён%' then
        raise exception 'Запрещённый переход Анны вернул: %', sqlerrm;
      end if;
  end;

  begin
    insert into public.tasks (object_id, title, description, assignee_id, author_id)
    values (v_north, 'Лишняя задача', '', v_anna, v_anna);
    raise exception 'CHECK FAILED: исполнитель создал задачу';
  exception
    when others then
      if sqlerrm like '%CHECK FAILED%' then
        raise;
      end if;
  end;

  select count(*) into v_count from public.tasks where title = 'Лишняя задача';
  if v_count <> 0 then
    raise exception 'Задача исполнителя сохранилась';
  end if;

  -- Законный шаг Анны: фундамент уже в работе, она отправляет его на проверку.
  perform public.transition_task(v_foundation, 'in_review', null);
  select status into v_status from public.tasks where id = v_foundation;
  if v_status is distinct from 'in_review' then
    raise exception 'Анна не смогла отправить свою задачу на проверку';
  end if;

  -- Постановщик.
  perform set_config('request.jwt.claim.sub', v_petr::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', v_petr::text, 'role', 'authenticated')::text,
    true
  );

  if auth.uid() is distinct from v_petr then
    raise exception 'Не удалось войти в проверку как Пётр. auth.uid() = %', auth.uid();
  end if;

  select count(*) into v_count from public.tasks;
  if v_count <> 6 then
    raise exception 'Постановщик видит % задач, а должен видеть все 6', v_count;
  end if;

  select count(*) into v_count from public.objects;
  if v_count <> 3 then
    raise exception 'Постановщик видит % объектов, а должен видеть 3', v_count;
  end if;

  begin
    perform public.transition_task(v_windows, 'rework', '   ');
    raise exception 'CHECK FAILED: доработка без комментария прошла';
  exception
    when others then
      if sqlerrm like '%CHECK FAILED%' then
        raise;
      end if;
      if sqlerrm not like '%Комментарий обязателен%' then
        raise exception 'Пустой комментарий вернул: %', sqlerrm;
      end if;
  end;

  begin
    perform public.transition_task(v_power, 'in_progress', null);
    raise exception 'CHECK FAILED: постановщик взял задачу в работу за исполнителя';
  exception
    when others then
      if sqlerrm like '%CHECK FAILED%' then
        raise;
      end if;
      if sqlerrm not like '%только назначенный исполнитель%' then
        raise exception 'Переход постановщика за исполнителя вернул: %', sqlerrm;
      end if;
  end;

  perform public.transition_task(v_windows, 'rework', 'Нужен другой профиль стеклопакета.');
  select comment into v_comment
  from public.task_status_history
  where task_id = v_windows
  order by seq desc
  limit 1;
  if v_comment is distinct from 'Нужен другой профиль стеклопакета.' then
    raise exception 'Комментарий постановщика не попал в историю';
  end if;

  begin
    insert into public.tasks (object_id, title, assignee_id, author_id, status)
    values (v_school, 'Сразу принятая', v_anna, v_petr, 'accepted');
    raise exception 'CHECK FAILED: задачу создали сразу в статусе «Принята»';
  exception
    when others then
      if sqlerrm like '%CHECK FAILED%' then
        raise;
      end if;
      if sqlerrm not like '%только в статусе%' then
        raise exception 'Создание с чужим статусом вернуло: %', sqlerrm;
      end if;
  end;

  -- Второй исполнитель не видит школу и задачи Анны.
  perform set_config('request.jwt.claim.sub', v_oleg::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', v_oleg::text, 'role', 'authenticated')::text,
    true
  );

  if auth.uid() is distinct from v_oleg then
    raise exception 'Не удалось войти в проверку как Олег. auth.uid() = %', auth.uid();
  end if;

  select count(*) into v_count from public.tasks;
  if v_count <> 2 then
    raise exception 'Олег видит % задач, а должен видеть 2', v_count;
  end if;

  select count(*) into v_count from public.objects where id = v_school;
  if v_count <> 0 then
    raise exception 'Олег видит школу, хотя задач там у него нет';
  end if;

  select count(*) into v_count from public.tasks where id = v_roof;
  if v_count <> 0 then
    raise exception 'Олег видит задачу Анны по кровле';
  end if;

  select count(*) into v_count from public.profiles where id = v_anna;
  if v_count <> 0 then
    raise exception 'Олег видит профиль Анны';
  end if;

  execute 'set local role postgres';
  raise notice 'Все проверки доступа прошли';
end
$checks$;

rollback;
