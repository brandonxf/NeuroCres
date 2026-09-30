-- Bloque 0.2: tabla usuarios (perfil de cuenta) y trigger que la llena al registrarse.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.usuarios (
  id uuid primary key references auth.users (id) on delete cascade,
  correo text not null,
  nombres text,
  apellidos text,
  telefono text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create trigger usuarios_set_updated_at
  before update on public.usuarios
  for each row execute function public.set_updated_at();

alter table public.usuarios enable row level security;

-- Cada usuario lee y modifica solo su propia fila. No hay insert/delete desde el cliente:
-- la fila la crea el trigger de registro.
create policy usuarios_select_propio on public.usuarios
  for select to authenticated
  using (id = (select auth.uid()));

create policy usuarios_update_propio on public.usuarios
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

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
  return new;
end;
$$;

revoke execute on function public.crear_usuario_al_registrarse() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.crear_usuario_al_registrarse();
