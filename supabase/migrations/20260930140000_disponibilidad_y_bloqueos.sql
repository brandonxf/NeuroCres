-- Bloque 1.2: disponibilidad semanal, bloqueos y parámetros de la agenda.
-- La restricción anti doble reserva (exclusión sobre citas) llega con la tabla citas, en el bloque 1.3.

create extension if not exists btree_gist with schema extensions;

-- ¿La cuenta en sesión es esta profesional? (SECURITY DEFINER para usarla dentro de políticas RLS).
create or replace function public.es_profesional(p_profesional_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profesionales
    where id = p_profesional_id and usuario_id = (select auth.uid())
  );
$$;

revoke execute on function public.es_profesional(uuid) from public, anon;
grant execute on function public.es_profesional(uuid) to authenticated;

-- Franjas de atención por día de la semana (0 = domingo … 6 = sábado), en la hora local
-- de la profesional (profesionales.zona_horaria).
create table public.disponibilidad_semanal (
  id uuid primary key default gen_random_uuid(),
  profesional_id uuid not null references public.profesionales (id) on delete cascade,
  dia_semana smallint not null check (dia_semana between 0 and 6),
  hora_inicio time not null,
  hora_fin time not null,
  modalidades text[] not null default array['presencial', 'virtual']
    check (
      cardinality(modalidades) > 0
      and modalidades <@ array['presencial', 'virtual']
    ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint disponibilidad_hora_valida check (hora_fin > hora_inicio),
  -- Dos franjas de la misma profesional no se pisan el mismo día.
  constraint disponibilidad_sin_solape exclude using gist (
    profesional_id with =,
    dia_semana with =,
    tsrange(
      timestamp '2000-01-01' + hora_inicio,
      timestamp '2000-01-01' + hora_fin
    ) with &&
  )
);

create index disponibilidad_profesional_idx
  on public.disponibilidad_semanal (profesional_id, dia_semana, hora_inicio);

create trigger disponibilidad_semanal_set_updated_at
  before update on public.disponibilidad_semanal
  for each row execute function public.set_updated_at();

alter table public.disponibilidad_semanal enable row level security;

-- Las franjas no son sensibles: cualquier cuenta las ve para ofrecer horarios.
create policy disponibilidad_select on public.disponibilidad_semanal
  for select to authenticated
  using (true);

create policy disponibilidad_insert on public.disponibilidad_semanal
  for insert to authenticated
  with check (public.es_profesional(profesional_id) or public.tiene_rol('administrador'));

create policy disponibilidad_update on public.disponibilidad_semanal
  for update to authenticated
  using (public.es_profesional(profesional_id) or public.tiene_rol('administrador'))
  with check (public.es_profesional(profesional_id) or public.tiene_rol('administrador'));

create policy disponibilidad_delete on public.disponibilidad_semanal
  for delete to authenticated
  using (public.es_profesional(profesional_id) or public.tiene_rol('administrador'));

revoke all on public.disponibilidad_semanal from anon, authenticated;
grant select, insert, delete on public.disponibilidad_semanal to authenticated;
grant update (dia_semana, hora_inicio, hora_fin, modalidades) on public.disponibilidad_semanal to authenticated;

-- Rangos en los que la profesional no atiende (vacaciones, permisos, imprevistos).
create table public.bloqueos (
  id uuid primary key default gen_random_uuid(),
  profesional_id uuid not null references public.profesionales (id) on delete cascade,
  inicio timestamptz not null,
  fin timestamptz not null,
  motivo text check (motivo is null or length(motivo) <= 300),  -- texto interno
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bloqueos_rango_valido check (fin > inicio)
);

create index bloqueos_profesional_idx on public.bloqueos (profesional_id, inicio);

create trigger bloqueos_set_updated_at
  before update on public.bloqueos
  for each row execute function public.set_updated_at();

alter table public.bloqueos enable row level security;

-- El motivo es interno: solo la profesional dueña y el administrador leen y escriben.
-- Los consultantes solo conocen los rangos ocupados, por ocupacion_profesional().
create policy bloqueos_select on public.bloqueos
  for select to authenticated
  using (public.es_profesional(profesional_id) or public.tiene_rol('administrador'));

create policy bloqueos_insert on public.bloqueos
  for insert to authenticated
  with check (public.es_profesional(profesional_id) or public.tiene_rol('administrador'));

create policy bloqueos_update on public.bloqueos
  for update to authenticated
  using (public.es_profesional(profesional_id) or public.tiene_rol('administrador'))
  with check (public.es_profesional(profesional_id) or public.tiene_rol('administrador'));

create policy bloqueos_delete on public.bloqueos
  for delete to authenticated
  using (public.es_profesional(profesional_id) or public.tiene_rol('administrador'));

revoke all on public.bloqueos from anon, authenticated;
grant select, insert, delete on public.bloqueos to authenticated;
grant update (inicio, fin, motivo) on public.bloqueos to authenticated;

-- Rangos ocupados de una profesional, sin datos personales ni motivos. Hoy solo incluye
-- bloqueos; el bloque 1.3 le suma las citas activas (pendiente_pago y confirmada).
create or replace function public.ocupacion_profesional(
  p_profesional_id uuid,
  p_desde timestamptz,
  p_hasta timestamptz
)
returns table (inicio timestamptz, fin timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Sesión requerida' using errcode = '42501';
  end if;
  if p_hasta <= p_desde or p_hasta - p_desde > interval '90 days' then
    raise exception 'Rango de fechas no válido' using errcode = '22023';
  end if;

  return query
    select b.inicio, b.fin
    from public.bloqueos b
    where b.profesional_id = p_profesional_id
      and b.inicio < p_hasta
      and b.fin > p_desde
    order by 1;
end;
$$;

revoke execute on function public.ocupacion_profesional(uuid, timestamptz, timestamptz) from public, anon;
grant execute on function public.ocupacion_profesional(uuid, timestamptz, timestamptz) to authenticated;

-- Parámetros de la agenda (valores de ejemplo de la guía; el administrador los ajusta).
insert into public.configuracion (clave, valor, descripcion) values
  ('parametros_agenda',
   '{"descanso_min": 15, "antelacion_min_horas": 12, "horizonte_dias": 60, "granularidad_min": 30}',
   'Descanso entre citas, antelación mínima para reservar, horizonte máximo y granularidad de los horarios (15 o 30 min).')
on conflict (clave) do nothing;
