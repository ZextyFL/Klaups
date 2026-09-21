-- Better profile defaults for OAuth users (Google, etc.)
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_base text;
  v_username text;
  v_display_name text;
begin
  v_base := coalesce(
    nullif(new.raw_user_meta_data ->> 'username', ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'creator-' || substr(new.id::text, 1, 8)
  );

  v_base := lower(regexp_replace(v_base, '[^a-zA-Z0-9]+', '-', 'g'));
  v_base := regexp_replace(v_base, '(^-+|-+$)', '', 'g');
  v_base := substr(v_base, 1, 32);

  if v_base = '' then
    v_base := 'creator-' || substr(new.id::text, 1, 8);
  end if;

  v_username := v_base;
  if exists (select 1 from profiles where username = v_username) then
    v_username := substr(v_base, 1, 27) || '-' || substr(new.id::text, 1, 4);
  end if;

  v_display_name := coalesce(
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'name', ''),
    v_username
  );

  insert into profiles (id, username, display_name)
  values (new.id, v_username, v_display_name)
  on conflict (id) do nothing;

  insert into creator_settings (profile_id, donation_slug)
  values (new.id, v_username)
  on conflict (profile_id) do nothing;

  insert into balances (profile_id)
  values (new.id)
  on conflict (profile_id) do nothing;

  return new;
end;
$$;
