-- Bloque 0.3: roles (muchos a muchos), función auxiliar y políticas RLS.

create table public.usuarios_roles (
  usuario_id uuid not null references public.usuarios (id) on delete cascade,
  rol text not null check (rol in ('consultante', 'responsable_legal', 'profesional', 'administrador')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (usuario_id, rol)
);

create trigger usuarios_roles_set_updated_at
  before update on public.usuarios_roles
  for each row execute function public.set_updated_at();

alter table public.usuarios_roles enable row level security;

-- ¿El usuario autenticado tiene este rol? SECURITY DEFINER para poder usarse dentro
-- de políticas RLS de otras tablas sin recursión.
create or replace function public.tiene_rol(p_rol text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.usuarios_roles
    where usuario_id = (select auth.uid()) and rol = p_rol
  );
$$;

revoke execute on function public.tiene_rol(text) from public, anon;
grant execute on function public.tiene_rol(text) to authenticated;

-- usuarios_roles: cada quien ve sus roles; solo el administrador los asigna o quita.
create policy usuarios_roles_select on public.usuarios_roles
  for select to authenticated
  using (usuario_id = (select auth.uid()) or public.tiene_rol('administrador'));

create policy usuarios_roles_insert_admin on public.usuarios_roles
  for insert to authenticated
  with check (public.tiene_rol('administrador'));

create policy usuarios_roles_update_admin on public.usuarios_roles
  for update to authenticated
  using (public.tiene_rol('administrador'))
  with check (public.tiene_rol('administrador'));

create policy usuarios_roles_delete_admin on public.usuarios_roles
  for delete to authenticated
  using (public.tiene_rol('administrador'));

-- usuarios: el administrador ve datos de cuenta (no clínicos).
create policy usuarios_select_admin on public.usuarios
  for select to authenticated
  using (public.tiene_rol('administrador'));

-- El usuario solo edita sus datos de contacto; no correo, id ni deleted_at.
revoke update on public.usuarios from authenticated;
grant update (nombres, apellidos, telefono) on public.usuarios to authenticated;

-- Todo registro nuevo nace como consultante.
create or replace function public.crear_usuario_al_registrarse()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.usuarios (id, correo, nombres, apellidos, telefono)
  values (
    new.id,
    new.email,
    nullif(trim(new.raw_user_meta_data ->> 'nombres'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'apellidos'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'telefono'), '')
  );

  insert into public.usuarios_roles (usuario_id, rol)
  values (new.id, 'consultante');

  return new;
end;
$$;

-- Defensa en capas: el rol anónimo no toca estas tablas (además de RLS).
revoke all on public.usuarios from anon;
revoke all on public.usuarios_roles from anon;
