-- Storage buckets for profile photos/banners and donation-alert media.
-- Public read (these are shown on public donate pages and OBS overlays),
-- writes restricted to the owner's own folder (path prefix = their user id).

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true), ('banners', 'banners', true), ('alerts', 'alerts', true)
on conflict (id) do nothing;

create policy "public read avatars" on storage.objects for select
  using (bucket_id = 'avatars');
create policy "public read banners" on storage.objects for select
  using (bucket_id = 'banners');
create policy "public read alerts" on storage.objects for select
  using (bucket_id = 'alerts');

create policy "owner can write own avatar" on storage.objects for insert
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "owner can update own avatar" on storage.objects for update
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "owner can delete own avatar" on storage.objects for delete
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "owner can write own banner" on storage.objects for insert
  with check (bucket_id = 'banners' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "owner can update own banner" on storage.objects for update
  using (bucket_id = 'banners' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "owner can delete own banner" on storage.objects for delete
  using (bucket_id = 'banners' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "owner can write own alert media" on storage.objects for insert
  with check (bucket_id = 'alerts' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "owner can update own alert media" on storage.objects for update
  using (bucket_id = 'alerts' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "owner can delete own alert media" on storage.objects for delete
  using (bucket_id = 'alerts' and (storage.foldername(name))[1] = auth.uid()::text);
