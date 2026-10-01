-- Iglesia Cristiana Zoe — esquema de producción
-- Redes A–L, células, informes semanales, sitio público y panel.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Contenido público
-- ---------------------------------------------------------------------------

create table if not exists public.site_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.ministries (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  age_range text not null,
  summary text not null,
  body text not null,
  sort_order int not null default 0,
  accent text not null default '#e38b3a',
  active boolean not null default true
);

create table if not exists public.sermons (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  preacher text,
  series text,
  sermon_date date,
  youtube_id text,
  is_live boolean not null default false,
  published boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.baptism_events (
  id uuid primary key default gen_random_uuid(),
  event_date date,
  location text,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.baptism_registrations (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text not null,
  email text,
  event_id uuid references public.baptism_events(id) on delete set null,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.prayer_requests (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text,
  email text,
  request text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.visit_plans (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text not null,
  email text,
  visit_date date,
  service text,
  adults int not null default 1,
  children int not null default 0,
  notes text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Grupos celulares
-- ---------------------------------------------------------------------------

create table if not exists public.networks (
  id uuid primary key default gen_random_uuid(),
  code char(1) unique not null,
  name text not null,
  created_at timestamptz not null default now(),
  constraint networks_code_check check (code ~ '^[A-L]$')
);

create table if not exists public.cells (
  id uuid primary key default gen_random_uuid(),
  network_id uuid not null references public.networks(id) on delete cascade,
  parent_id uuid references public.cells(id) on delete cascade,
  number int not null check (number > 0),
  code text unique not null,
  leader_name text,
  assistant_name text,
  host_name text,
  address text,
  meeting_day text,
  meeting_time time,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists cells_network_idx on public.cells (network_id);
create index if not exists cells_parent_idx on public.cells (parent_id);

create table if not exists public.cell_members (
  id uuid primary key default gen_random_uuid(),
  cell_id uuid not null references public.cells(id) on delete cascade,
  full_name text not null,
  phone text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  full_name text,
  role text not null check (role in ('superadmin', 'admin', 'red_leader', 'cell_leader')),
  network_id uuid references public.networks(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.user_cells (
  user_id uuid not null references public.profiles(id) on delete cascade,
  cell_id uuid not null references public.cells(id) on delete cascade,
  primary key (user_id, cell_id)
);

create table if not exists public.themes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  audience text not null default 'Iglesia',
  theme_date date not null,
  file_path text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists themes_date_idx on public.themes (theme_date desc);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  cell_id uuid not null references public.cells(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  year int not null,
  week int not null,
  met boolean not null,
  reason text,
  meeting_date date,
  start_time time,
  end_time time,
  modality text check (modality in ('presencial', 'virtual')),
  theme_id uuid references public.themes(id) on delete set null,
  theme_title text,
  praise_minutes int not null default 0,
  had_prayer boolean,
  prayer_notes text,
  teaching_minutes int not null default 0,
  salvations int not null default 0,
  spirit_baptisms int not null default 0,
  reconciled int not null default 0,
  offering numeric(12,2) not null default 0,
  offering_minutes int not null default 0,
  families int not null default 0,
  guests int not null default 0,
  testimonies text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cell_id, year, week)
);

create table if not exists public.report_attendance (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports(id) on delete cascade,
  member_id uuid references public.cell_members(id) on delete set null,
  member_name text not null,
  attended boolean not null default false,
  tithe numeric(12,2) not null default 0
);

create table if not exists public.report_photos (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports(id) on delete cascade,
  file_path text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Helpers de autorización
-- ---------------------------------------------------------------------------

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

create or replace function public.my_network()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select network_id from public.profiles where id = auth.uid();
$$;

create or replace function public.my_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.can_read_cell(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin()
    or exists (
      select 1 from public.user_cells
      where user_id = auth.uid() and cell_id = target
    )
    or exists (
      select 1
      from public.cells c
      join public.profiles p on p.id = auth.uid()
      where c.id = target
        and p.network_id is not null
        and p.network_id = c.network_id
    );
$$;

create or replace function public.can_write_cell(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin()
    or exists (
      select 1 from public.user_cells
      where user_id = auth.uid() and cell_id = target
    );
$$;

create or replace function public.can_read_report(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.reports r
    where r.id = target
      and (
        public.is_admin()
        or r.user_id = auth.uid()
        or public.can_read_cell(r.cell_id)
      )
  );
$$;

-- ---------------------------------------------------------------------------
-- Alta de usuarios desde el administrador
-- ---------------------------------------------------------------------------

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
    uid,
    'authenticated',
    'authenticated',
    email,
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
    uid::text,
    uid,
    jsonb_build_object('sub', uid::text, 'email', email, 'email_verified', true),
    'email',
    now(), now(), now()
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
begin
  if not public.is_admin() then
    raise exception 'No autorizado';
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

revoke all on function public.admin_create_user(text, text, text, text, text, text[]) from public;
revoke all on function public.admin_set_password(uuid, text) from public;
grant execute on function public.admin_create_user(text, text, text, text, text, text[]) to authenticated;
grant execute on function public.admin_set_password(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.site_settings enable row level security;
alter table public.ministries enable row level security;
alter table public.sermons enable row level security;
alter table public.baptism_events enable row level security;
alter table public.baptism_registrations enable row level security;
alter table public.prayer_requests enable row level security;
alter table public.visit_plans enable row level security;
alter table public.networks enable row level security;
alter table public.cells enable row level security;
alter table public.cell_members enable row level security;
alter table public.profiles enable row level security;
alter table public.user_cells enable row level security;
alter table public.themes enable row level security;
alter table public.reports enable row level security;
alter table public.report_attendance enable row level security;
alter table public.report_photos enable row level security;

create policy site_settings_read on public.site_settings for select using (true);
create policy site_settings_admin on public.site_settings for all using (public.is_admin()) with check (public.is_admin());

create policy ministries_read on public.ministries for select using (active or public.is_admin());
create policy ministries_admin on public.ministries for all using (public.is_admin()) with check (public.is_admin());

create policy sermons_read on public.sermons for select using (published or public.is_admin());
create policy sermons_admin on public.sermons for all using (public.is_admin()) with check (public.is_admin());

create policy baptism_events_read on public.baptism_events for select using (active or public.is_admin());
create policy baptism_events_admin on public.baptism_events for all using (public.is_admin()) with check (public.is_admin());

create policy baptism_reg_insert on public.baptism_registrations for insert with check (true);
create policy baptism_reg_admin on public.baptism_registrations for select using (public.is_admin());
create policy baptism_reg_admin_write on public.baptism_registrations for update using (public.is_admin()) with check (public.is_admin());
create policy baptism_reg_admin_delete on public.baptism_registrations for delete using (public.is_admin());

create policy prayer_insert on public.prayer_requests for insert with check (true);
create policy prayer_admin on public.prayer_requests for select using (public.is_admin());
create policy prayer_admin_delete on public.prayer_requests for delete using (public.is_admin());

create policy visit_insert on public.visit_plans for insert with check (true);
create policy visit_admin on public.visit_plans for select using (public.is_admin());
create policy visit_admin_delete on public.visit_plans for delete using (public.is_admin());

create policy networks_read on public.networks for select
  using (auth.uid() is not null);
create policy networks_admin on public.networks for all
  using (public.is_admin()) with check (public.is_admin());

create policy cells_read on public.cells for select
  using (public.can_read_cell(id) or public.is_admin());
create policy cells_admin on public.cells for all
  using (public.is_admin()) with check (public.is_admin());

create policy members_read on public.cell_members for select
  using (public.can_read_cell(cell_id));
create policy members_leader_insert on public.cell_members for insert
  with check (public.can_write_cell(cell_id));
create policy members_admin on public.cell_members for all
  using (public.is_admin()) with check (public.is_admin());

create policy profiles_self on public.profiles for select
  using (id = auth.uid() or public.is_admin() or (public.my_role() = 'red_leader' and network_id = public.my_network()));
create policy profiles_admin_write on public.profiles for update
  using (public.is_admin())
  with check (public.is_admin());

create policy user_cells_read on public.user_cells for select
  using (user_id = auth.uid() or public.is_admin());
create policy user_cells_admin on public.user_cells for all
  using (public.is_admin()) with check (public.is_admin());

create policy themes_read on public.themes for select
  using (auth.uid() is not null and (active or public.is_admin()));
create policy themes_admin on public.themes for all
  using (public.is_admin()) with check (public.is_admin());

create policy reports_read on public.reports for select
  using (
    public.is_admin()
    or user_id = auth.uid()
    or public.can_read_cell(cell_id)
  );
create policy reports_write on public.reports for insert
  with check (public.can_write_cell(cell_id));
create policy reports_update on public.reports for update
  using (public.can_write_cell(cell_id))
  with check (public.can_write_cell(cell_id));
create policy reports_delete on public.reports for delete
  using (public.is_admin());

create policy attendance_read on public.report_attendance for select
  using (public.can_read_report(report_id));
create policy attendance_write on public.report_attendance for insert
  with check (public.can_read_report(report_id) and public.can_write_cell((select cell_id from public.reports where id = report_id)));
create policy attendance_update on public.report_attendance for update
  using (public.can_read_report(report_id))
  with check (public.can_read_report(report_id));
create policy attendance_delete on public.report_attendance for delete
  using (public.can_read_report(report_id) and (
    public.is_admin() or public.can_write_cell((select cell_id from public.reports where id = report_id))
  ));

create policy photos_read on public.report_photos for select
  using (public.can_read_report(report_id));
create policy photos_write on public.report_photos for insert
  with check (
    exists (
      select 1 from public.reports r
      where r.id = report_id and public.can_write_cell(r.cell_id)
    )
  );
create policy photos_delete on public.report_photos for delete
  using (
    public.is_admin() or exists (
      select 1 from public.reports r
      where r.id = report_id and public.can_write_cell(r.cell_id)
    )
  );

-- ---------------------------------------------------------------------------
-- Storage
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values
  ('temas', 'temas', false),
  ('informes', 'informes', false),
  ('medios', 'medios', true)
on conflict (id) do nothing;

create policy temas_read on storage.objects for select
  using (bucket_id = 'temas' and auth.uid() is not null);
create policy temas_admin_insert on storage.objects for insert
  with check (bucket_id = 'temas' and public.is_admin());
create policy temas_admin_update on storage.objects for update
  using (bucket_id = 'temas' and public.is_admin());
create policy temas_admin_delete on storage.objects for delete
  using (bucket_id = 'temas' and public.is_admin());

create policy informes_read on storage.objects for select
  using (bucket_id = 'informes' and auth.uid() is not null);
create policy informes_insert on storage.objects for insert
  with check (bucket_id = 'informes' and auth.uid() is not null);
create policy informes_delete on storage.objects for delete
  using (bucket_id = 'informes' and (public.is_admin() or owner = auth.uid()));

create policy medios_read on storage.objects for select
  using (bucket_id = 'medios');
create policy medios_admin_insert on storage.objects for insert
  with check (bucket_id = 'medios' and public.is_admin());
create policy medios_admin_update on storage.objects for update
  using (bucket_id = 'medios' and public.is_admin());
create policy medios_admin_delete on storage.objects for delete
  using (bucket_id = 'medios' and public.is_admin());

grant usage on schema public to anon, authenticated;
grant select on public.site_settings, public.ministries, public.sermons, public.baptism_events to anon, authenticated;
grant insert on public.baptism_registrations, public.prayer_requests, public.visit_plans to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;
