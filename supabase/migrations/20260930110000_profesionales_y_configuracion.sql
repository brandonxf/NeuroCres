-- Bloque 0.5: profesionales y configuración general.
-- Hoy trabaja una sola profesional, pero toda la agenda referenciará profesional_id.

create table public.profesionales (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null unique references public.usuarios (id) on delete restrict,
  nombre_publico text not null,
  registro_profesional text,
  zona_horaria text not null default 'America/Bogota',
  enlace_videollamada text,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profesionales_set_updated_at
  before update on public.profesionales
  for each row execute function public.set_updated_at();

alter table public.profesionales enable row level security;

-- Cualquier cuenta ve a las profesionales activas (para agendar); la propia y el
-- administrador ven también las inactivas.
create policy profesionales_select on public.profesionales
  for select to authenticated
  using (
    activo
    or usuario_id = (select auth.uid())
    or public.tiene_rol('administrador')
  );

create policy profesionales_insert_admin on public.profesionales
  for insert to authenticated
  with check (public.tiene_rol('administrador'));

create policy profesionales_update on public.profesionales
  for update to authenticated
  using (usuario_id = (select auth.uid()) or public.tiene_rol('administrador'))
  with check (usuario_id = (select auth.uid()) or public.tiene_rol('administrador'));

-- El enlace de la sala virtual no se lee por la API de tablas: solo por la función de abajo.
revoke select on public.profesionales from authenticated;
grant select (id, usuario_id, nombre_publico, registro_profesional, zona_horaria, activo, created_at, updated_at)
  on public.profesionales to authenticated;
revoke update on public.profesionales from authenticated;
grant update (nombre_publico, registro_profesional, zona_horaria, enlace_videollamada, activo)
  on public.profesionales to authenticated;
revoke all on public.profesionales from anon;

-- Devuelve el enlace solo a la propia profesional o al administrador.
-- En la Fase 1 se ampliará a consultantes con una cita virtual confirmada.
create or replace function public.obtener_enlace_videollamada(p_profesional_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.enlace_videollamada
  from public.profesionales p
  where p.id = p_profesional_id
    and (p.usuario_id = (select auth.uid()) or public.tiene_rol('administrador'));
$$;

revoke execute on function public.obtener_enlace_videollamada(uuid) from public, anon;
grant execute on function public.obtener_enlace_videollamada(uuid) to authenticated;

-- Parámetros editables por el administrador (valores por defecto = propuesta de la guía).
create table public.configuracion (
  clave text primary key,
  valor jsonb not null,
  descripcion text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger configuracion_set_updated_at
  before update on public.configuracion
  for each row execute function public.set_updated_at();

alter table public.configuracion enable row level security;

create policy configuracion_select on public.configuracion
  for select to authenticated
  using (true);

create policy configuracion_insert_admin on public.configuracion
  for insert to authenticated
  with check (public.tiene_rol('administrador'));

create policy configuracion_update_admin on public.configuracion
  for update to authenticated
  using (public.tiene_rol('administrador'))
  with check (public.tiene_rol('administrador'));

revoke all on public.configuracion from anon;

insert into public.configuracion (clave, valor, descripcion) values
  ('retencion_cupo',
   '{"horas": 12, "horas_si_cita_cercana": 2, "umbral_cita_cercana_horas": 24}',
   'Tiempo que se retiene el cupo mientras llega el comprobante (decisión 1).'),
  ('politica_cancelacion',
   '{"horas_reprogramar": 24, "horas_cancelar": 4, "porcentaje_devolucion": 50}',
   'Valores por defecto de la propuesta del plan (decisión 11). Confirmar con la profesional.'),
  ('plazo_devoluciones',
   '{"dias_habiles_min": 5, "dias_habiles_max": 10, "medio": "mismo_medio_de_pago"}',
   'Plazo y medio de devoluciones (decisión 12).'),
  ('direccion_consultorio',
   '""',
   'Dirección que ven los consultantes en citas presenciales. Completar.'),
  ('medios_de_pago',
   '[]',
   'Datos de cuenta de cada medio de pago (banco, Llave, QR, Nequi) (decisión 2). Completar.')
on conflict (clave) do nothing;
