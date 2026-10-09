-- AI Auto · миграция 1: автомобили и история обслуживания
--
-- Таблицы повторяют данные, которые приложение сейчас хранит в localStorage
-- (src/app/car/carStore.ts и src/app/service/serviceStore.ts), и те же ограничения ввода.
--
-- Принципы:
--   * у пользователя может быть несколько автомобилей;
--   * каждая строка принадлежит одному пользователю (user_id), доступ — только к своим строкам (RLS);
--   * запись истории нельзя привязать к чужому автомобилю: составной внешний ключ (car_id, user_id);
--   * идентификаторы — UUID; клиент может передать свой id (нужно для импорта из localStorage без дублей).

-- ---------------------------------------------------------------------------
-- Автомобили
-- ---------------------------------------------------------------------------

create table public.cars (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,

  make        text not null,
  model       text not null,
  year        smallint not null,
  mileage     integer not null,
  body        text,
  engine      text,
  fuel        text,
  -- путь к фото в бакете car-photos; null — фото нет
  photo_path  text,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  -- нужен как цель составного внешнего ключа из service_records
  constraint cars_id_user_id_key unique (id, user_id),

  constraint cars_make_check    check (char_length(btrim(make)) between 1 and 40),
  constraint cars_model_check   check (char_length(btrim(model)) between 1 and 40),
  -- верхняя граница «текущий год + 1» зависит от даты и проверяется в триггере ниже
  constraint cars_year_check    check (year >= 1900),
  constraint cars_mileage_check check (mileage between 0 and 9999999),
  constraint cars_body_check    check (
    body in ('sedan', 'hatchback', 'wagon', 'coupe', 'liftback', 'crossover', 'suv', 'minivan', 'pickup')
  ),
  constraint cars_engine_check  check (engine in ('petrol', 'diesel', 'hybrid', 'electric', 'lpg')),
  -- марка бензина имеет смысл только для бензинового двигателя и гибрида
  constraint cars_fuel_check    check (
    fuel is null
    or (fuel in ('АИ-92', 'АИ-95', 'АИ-98', 'АИ-100') and engine in ('petrol', 'hybrid'))
  ),
  -- фото лежит строго по адресу <user_id>/<car_id>.jpg
  constraint cars_photo_path_check check (
    photo_path is null or photo_path = user_id::text || '/' || id::text || '.jpg'
  )
);

comment on table public.cars is 'Автомобили пользователей AI Auto';
comment on column public.cars.photo_path is 'Путь к фото в приватном бакете car-photos: <user_id>/<car_id>.jpg';

create index cars_user_id_idx on public.cars (user_id);

-- ---------------------------------------------------------------------------
-- История обслуживания
-- ---------------------------------------------------------------------------

create table public.service_records (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  car_id        uuid not null,

  title         text not null,
  category      text not null,
  -- день обслуживания (в приложении — поле date в формате ГГГГ-ММ-ДД)
  service_date  date not null,
  mileage       integer not null,
  -- стоимость в тенге; по этому полю считаются расходы
  cost          numeric(11, 2) not null,
  comment       text not null default '',

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  -- Автомобиль должен принадлежать тому же пользователю, что и запись.
  -- При удалении автомобиля его история удаляется вместе с ним.
  constraint service_records_car_owner_fkey
    foreign key (car_id, user_id) references public.cars (id, user_id) on delete cascade,

  constraint service_records_title_check    check (char_length(btrim(title)) between 1 and 80),
  constraint service_records_category_check check (
    category in ('maintenance', 'oil', 'engine', 'transmission', 'brakes', 'suspension', 'electrics', 'tires', 'other')
  ),
  -- запрет дат в будущем зависит от текущего дня и проверяется в триггере ниже
  constraint service_records_date_check     check (service_date >= date '1900-01-01'),
  constraint service_records_mileage_check  check (mileage between 0 and 9999999),
  constraint service_records_cost_check     check (cost between 0 and 999999999),
  constraint service_records_comment_check  check (char_length(comment) <= 500)
);

comment on table public.service_records is 'Записи истории обслуживания; каждая относится к одному автомобилю';
comment on column public.service_records.cost is 'Стоимость в тенге';

-- список записей автомобиля по дате и выборки по периоду для расходов
create index service_records_car_date_idx on public.service_records (car_id, service_date desc);
create index service_records_user_id_idx on public.service_records (user_id);

-- ---------------------------------------------------------------------------
-- Триггеры: неизменяемые поля, updated_at, проверки, зависящие от текущей даты
-- ---------------------------------------------------------------------------

create function public.cars_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  max_year integer := extract(year from now())::integer + 1;
begin
  if tg_op = 'UPDATE' then
    -- владельца, идентификатор и дату создания менять нельзя
    new.id := old.id;
    new.user_id := old.user_id;
    new.created_at := old.created_at;
    new.updated_at := now();
  end if;

  if new.year > max_year then
    raise exception 'Год выпуска не может быть позже %', max_year
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger cars_before_write
  before insert or update on public.cars
  for each row execute function public.cars_before_write();

create function public.service_records_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    -- car_id менять можно (перенос записи на другой свой автомобиль): владение проверит внешний ключ
    new.id := old.id;
    new.user_id := old.user_id;
    new.created_at := old.created_at;
    new.updated_at := now();
  end if;

  -- сервер живёт по UTC; «+1 день» допускает пользователей, у которых уже наступило завтра
  if new.service_date > (now() at time zone 'utc')::date + 1 then
    raise exception 'Дата обслуживания не может быть в будущем'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger service_records_before_write
  before insert or update on public.service_records
  for each row execute function public.service_records_before_write();

-- ---------------------------------------------------------------------------
-- Доступ: только вошедшие пользователи и только к своим строкам
-- ---------------------------------------------------------------------------

alter table public.cars enable row level security;
alter table public.service_records enable row level security;

revoke all on table public.cars from anon;
revoke all on table public.service_records from anon;
grant select, insert, update, delete on table public.cars to authenticated;
grant select, insert, update, delete on table public.service_records to authenticated;

create policy cars_select_own on public.cars
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy cars_insert_own on public.cars
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy cars_update_own on public.cars
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy cars_delete_own on public.cars
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Для записей истории политика проверяет владельца строки, а составной внешний ключ —
-- что автомобиль принадлежит тому же пользователю.
create policy service_records_select_own on public.service_records
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy service_records_insert_own on public.service_records
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy service_records_update_own on public.service_records
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy service_records_delete_own on public.service_records
  for delete to authenticated
  using ((select auth.uid()) = user_id);
