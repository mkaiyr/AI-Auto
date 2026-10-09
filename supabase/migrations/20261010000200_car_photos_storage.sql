-- AI Auto · миграция 2: приватное хранилище фотографий автомобилей
--
-- Фото лежит по адресу <user_id>/<car_id>.jpg в бакете car-photos.
-- Бакет закрытый: файл можно получить только будучи вошедшим владельцем
-- (или по подписанной ссылке, которую владелец запросил сам).
--
-- Приложение уже сжимает фото в JPEG до ~0,5 МБ (src/app/car/carPhoto.ts),
-- поэтому бакет принимает только JPEG и не больше 1 МБ.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('car-photos', 'car-photos', false, 1048576, array['image/jpeg'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- В политиках ниже «name» — это путь файла (storage.objects.name).
-- Первая папка пути обязана совпадать с идентификатором вошедшего пользователя.

create policy car_photos_select_own on storage.objects
  for select to authenticated
  using (
    bucket_id = 'car-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Загрузить можно только фото собственного, уже существующего автомобиля
-- и только под именем <user_id>/<car_id>.jpg — посторонние файлы в бакет не попадут.
create policy car_photos_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'car-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (
      select 1
      from public.cars c
      where c.user_id = (select auth.uid())
        and name = c.user_id::text || '/' || c.id::text || '.jpg'
    )
  );

-- Замена фото (загрузка с перезаписью)
create policy car_photos_update_own on storage.objects
  for update to authenticated
  using (
    bucket_id = 'car-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'car-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (
      select 1
      from public.cars c
      where c.user_id = (select auth.uid())
        and name = c.user_id::text || '/' || c.id::text || '.jpg'
    )
  );

create policy car_photos_delete_own on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'car-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
