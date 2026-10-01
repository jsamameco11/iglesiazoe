alter table public.profiles drop constraint if exists profiles_role_check;
do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'profiles'
      and con.contype = 'c'
  loop
    execute format('alter table public.profiles drop constraint %I', constraint_name);
  end loop;
end $$;
alter table public.profiles
  add constraint profiles_role_check
  check (role in ('superadmin', 'admin', 'red_leader', 'cell_leader'));

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'superadmin')
  );
$$;

create or replace function public.is_superadmin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'superadmin'
  );
$$;

create or replace function public.admin_create_user(
  p_username text,
  p_password text,
  p_full_name text,
  p_role text,
  p_network_code text,
  p_cell_codes text[]
)
returns uuid
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  uid uuid := gen_random_uuid();
  email text;
  net uuid;
  cell_code text;
  cell_uuid uuid;
  instance uuid;
begin
  if not public.is_admin() then
    raise exception 'No autorizado';
  end if;

  if p_role not in ('admin', 'red_leader', 'cell_leader') then
    raise exception 'Rol inválido';
  end if;

  if p_role = 'admin' and not public.is_superadmin() then
    raise exception 'Solo el superadministrador puede crear administradores';
  end if;

  if p_username is null or length(trim(p_username)) < 3 then
    raise exception 'Usuario demasiado corto';
  end if;

  if p_password is null or length(p_password) < 6 then
    raise exception 'La clave debe tener al menos 6 caracteres';
  end if;

  email := lower(trim(p_username)) || '@lideres.iglesiacristianazoe.pe';
  select id into instance from auth.instances limit 1;

  if exists (select 1 from public.profiles where username = lower(trim(p_username))) then
    raise exception 'Ese usuario ya existe';
  end if;

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, recovery_token,
    email_change_token_new, email_change, email_change_token_current,
    phone_change, phone_change_token, reauthentication_token,
    is_sso_user, is_anonymous
  ) values (
    coalesce(instance, '00000000-0000-0000-0000-000000000000'),
    uid, 'authenticated', 'authenticated', email,
    extensions.crypt(p_password, extensions.gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('username', lower(trim(p_username)), 'full_name', p_full_name),
    now(), now(), '', '', '', '', '', '', '', '',
    false, false
  );

  insert into auth.identities (
    provider_id, user_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
  ) values (
    uid::text, uid,
    jsonb_build_object('sub', uid::text, 'email', email, 'email_verified', true),
    'email', now(), now(), now()
  );

  if p_network_code is not null and length(trim(p_network_code)) > 0 then
    select id into net from public.networks where code = upper(trim(p_network_code));
  end if;

  insert into public.profiles (id, username, full_name, role, network_id)
  values (uid, lower(trim(p_username)), nullif(trim(p_full_name), ''), p_role, net);

  if p_cell_codes is not null then
    foreach cell_code in array p_cell_codes loop
      select id into cell_uuid from public.cells where code = upper(trim(cell_code));
      if cell_uuid is not null then
        insert into public.user_cells (user_id, cell_id) values (uid, cell_uuid)
        on conflict do nothing;
      end if;
    end loop;
  end if;

  return uid;
end;
$$;

create or replace function public.admin_set_password(p_user_id uuid, p_password text)
returns void
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  target_role text;
begin
  if not public.is_admin() then
    raise exception 'No autorizado';
  end if;
  select role into target_role from public.profiles where id = p_user_id;
  if target_role = 'superadmin' and not public.is_superadmin() then
    raise exception 'No autorizado';
  end if;
  if target_role = 'admin' and not public.is_superadmin() then
    raise exception 'Solo el superadministrador puede cambiar la clave de un administrador';
  end if;
  if p_password is null or length(p_password) < 6 then
    raise exception 'La clave debe tener al menos 6 caracteres';
  end if;
  update auth.users
  set encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf')),
      updated_at = now()
  where id = p_user_id;
end;
$$;

insert into public.site_settings (key, value)
values (
  'admin_capabilities',
  jsonb_build_object(
    'manageMembers', false,
    'viewOfferings', false,
    'viewCellActivity', true,
    'manageMedia', true,
    'manageContent', true,
    'manageCells', true,
    'manageUsers', true,
    'manageGenerosity', true
  )
)
on conflict (key) do nothing;

update public.profiles
set role = 'superadmin'
where role = 'admin'
  and username = '72914761';

update public.profiles
set role = 'superadmin'
where role = 'admin'
  and not exists (select 1 from public.profiles where role = 'superadmin')
  and (select count(*) from public.profiles where role = 'admin') = 1;

create or replace function public.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.role = 'superadmin' and not public.is_superadmin() then
    raise exception 'No autorizado';
  end if;
  if new.role is distinct from old.role and not public.is_superadmin() then
    raise exception 'Solo el superadministrador puede cambiar roles';
  end if;
  if new.role = 'superadmin' and old.role is distinct from 'superadmin' then
    raise exception 'El rol de superadministrador no se asigna desde el panel';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_role on public.profiles;
create trigger profiles_protect_role
  before update on public.profiles
  for each row execute function public.protect_profile_role();

drop policy if exists site_settings_admin on public.site_settings;
create policy site_settings_admin on public.site_settings
  for all
  using (
    public.is_superadmin()
    or (public.is_admin() and key <> 'admin_capabilities')
  )
  with check (
    public.is_superadmin()
    or (public.is_admin() and key <> 'admin_capabilities')
  );
