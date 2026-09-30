-- Bloque 1.3: citas, matriz de estados, restricción anti doble reserva y auditoría.
-- Las citas nuevas las crea la función de reserva (bloque 1.4); aquí no hay INSERT desde la API.

create table public.citas (
  id uuid primary key default gen_random_uuid(),
  persona_id uuid not null references public.personas (id) on delete restrict,
  servicio_id uuid not null references public.servicios (id) on delete restrict,
  profesional_id uuid not null references public.profesionales (id) on delete restrict,
  proceso_id uuid,                        -- nulo en la Fase 1; se usa desde la Fase 2
  inicio timestamptz not null,
  fin timestamptz not null,
  bloqueo_hasta timestamptz not null,     -- fin de la cita más el descanso
  modalidad text not null check (modalidad in ('presencial', 'virtual')),
  estado text not null default 'pendiente_pago'
    check (estado in ('pendiente_pago', 'confirmada', 'completada', 'cancelada', 'inasistencia', 'reprogramada')),
  -- Copiados del servicio al reservar: un cambio de tarifa posterior no altera reservas hechas.
  precio_cop bigint not null check (precio_cop >= 0),
  anticipo_cop bigint not null check (anticipo_cop >= 0),
  saldo_cop bigint not null check (saldo_cop >= 0),
  expira_cupo_at timestamptz,             -- límite para que llegue y se verifique el anticipo
  reprogramada_de uuid references public.citas (id) on delete restrict,
  cancelada_por uuid references public.usuarios (id) on delete set null,  -- nulo si fue el sistema
  cancelada_at timestamptz,
  motivo_cancelacion text check (motivo_cancelacion is null or length(motivo_cancelacion) <= 300),
  politica_aceptada_id uuid,              -- FK a politicas_versionadas en el bloque 1.6
  politica_aceptada_at timestamptz,
  creada_por uuid references public.usuarios (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint citas_rango_valido check (fin > inicio and bloqueo_hasta >= fin),
  constraint citas_montos_cuadran check (anticipo_cop + saldo_cop = precio_cop),
  constraint citas_cupo_solo_pendiente check (expira_cupo_at is null or estado = 'pendiente_pago'),
  -- Crítico: la base de datos impide la doble reserva aunque dos personas elijan el mismo
  -- horario a la vez. Solo bloquean las citas activas.
  constraint citas_sin_solape exclude using gist (
    profesional_id with =,
    tstzrange(inicio, bloqueo_hasta) with &&
  ) where (estado in ('pendiente_pago', 'confirmada'))
);

create index citas_profesional_inicio_idx on public.citas (profesional_id, inicio);
create index citas_persona_inicio_idx on public.citas (persona_id, inicio desc);
create index citas_cupo_vencido_idx on public.citas (expira_cupo_at) where estado = 'pendiente_pago';

create trigger citas_set_updated_at
  before update on public.citas
  for each row execute function public.set_updated_at();

-- Transiciones permitidas. Los estados finales no tienen salida.
create or replace function public.transicion_cita_valida(p_desde text, p_hacia text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select (p_desde, p_hacia) in (
    ('pendiente_pago', 'confirmada'),
    ('pendiente_pago', 'cancelada'),
    ('confirmada', 'completada'),
    ('confirmada', 'inasistencia'),
    ('confirmada', 'cancelada'),
    ('confirmada', 'reprogramada')
  );
$$;

-- Defensa en capas: valida la transición y congela lo que no puede cambiar, sin importar
-- quién ejecute el UPDATE.
create or replace function public.citas_validar_cambio()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.estado is distinct from old.estado
     and not public.transicion_cita_valida(old.estado, new.estado) then
    raise exception 'Transición de cita no permitida: % → %', old.estado, new.estado
      using errcode = '22023';
  end if;

  if new.persona_id is distinct from old.persona_id
     or new.servicio_id is distinct from old.servicio_id
     or new.profesional_id is distinct from old.profesional_id
     or new.inicio is distinct from old.inicio
     or new.fin is distinct from old.fin
     or new.bloqueo_hasta is distinct from old.bloqueo_hasta
     or new.modalidad is distinct from old.modalidad
     or new.precio_cop is distinct from old.precio_cop
     or new.anticipo_cop is distinct from old.anticipo_cop
     or new.saldo_cop is distinct from old.saldo_cop then
    raise exception 'Estos datos de la cita no se modifican: reprograma o cancela y crea otra'
      using errcode = '22023';
  end if;

  return new;
end;
$$;

create trigger citas_validar_cambio
  before update on public.citas
  for each row execute function public.citas_validar_cambio();

-- Toda creación y cambio de estado queda en auditoría (con quién y desde qué estado).
create or replace function public.citas_auditar()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform public.registrar_evento_interno(
      (select auth.uid()), 'cita.creada', 'citas', new.id, new.persona_id,
      jsonb_build_object('estado', new.estado, 'servicio_id', new.servicio_id, 'inicio', new.inicio)
    );
  elsif new.estado is distinct from old.estado then
    perform public.registrar_evento_interno(
      (select auth.uid()), 'cita.' || new.estado, 'citas', new.id, new.persona_id,
      jsonb_build_object('desde', old.estado, 'hasta', new.estado, 'motivo', new.motivo_cancelacion)
    );
  end if;
  return null;
end;
$$;

revoke execute on function public.citas_auditar() from public, anon, authenticated;

create trigger citas_auditoria
  after insert or update on public.citas
  for each row execute function public.citas_auditar();

alter table public.citas enable row level security;

-- Ven la cita: la familia de la persona (incluye al responsable de un menor), la profesional
-- asignada y el administrador. Solo lectura desde la API.
create policy citas_select on public.citas
  for select to authenticated
  using (
    public.es_dueno_de_persona(persona_id)
    or public.es_profesional(profesional_id)
    or public.tiene_rol('administrador')
  );

revoke all on public.citas from anon, authenticated;
grant select on public.citas to authenticated;

-- Cambio de estado por parte de una persona con sesión (cancelar, completar, inasistencia).
-- Confirmar y reprogramar tienen sus propios caminos (verificar el anticipo, bloque 1.7;
-- reprogramación, bloque 1.6), así que no se aceptan aquí.
create or replace function public.cambiar_estado_cita(
  p_cita_id uuid,
  p_nuevo_estado text,
  p_motivo text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_cita public.citas%rowtype;
  v_es_profesional boolean;
  v_es_admin boolean;
  v_es_familia boolean;
begin
  if v_uid is null then
    raise exception 'Sesión requerida' using errcode = '42501';
  end if;

  select * into v_cita from public.citas where id = p_cita_id for update;
  v_es_profesional := found and public.es_profesional(v_cita.profesional_id);
  v_es_admin := public.tiene_rol('administrador');
  v_es_familia := found and public.es_dueno_de_persona(v_cita.persona_id);

  -- Mismo mensaje si no existe o no es suya: no se revela qué citas hay.
  if not found or not (v_es_profesional or v_es_admin or v_es_familia) then
    raise exception 'Cita no encontrada' using errcode = '42501';
  end if;

  if p_nuevo_estado = 'confirmada' then
    raise exception 'La cita se confirma al verificar el anticipo' using errcode = '22023';
  end if;
  if p_nuevo_estado = 'reprogramada' then
    raise exception 'Para reprogramar usa la reprogramación' using errcode = '22023';
  end if;
  if not public.transicion_cita_valida(v_cita.estado, p_nuevo_estado) then
    raise exception 'Transición de cita no permitida: % → %', v_cita.estado, p_nuevo_estado
      using errcode = '22023';
  end if;

  if p_nuevo_estado in ('completada', 'inasistencia') then
    if not (v_es_profesional or v_es_admin) then
      raise exception 'Solo la profesional cierra la cita' using errcode = '42501';
    end if;
    if v_cita.inicio > now() then
      raise exception 'La cita aún no ha ocurrido' using errcode = '22023';
    end if;
  end if;

  update public.citas
  set estado = p_nuevo_estado,
      expira_cupo_at = null,
      cancelada_por = case when p_nuevo_estado = 'cancelada' then v_uid else cancelada_por end,
      cancelada_at = case when p_nuevo_estado = 'cancelada' then now() else cancelada_at end,
      motivo_cancelacion = case
        when p_nuevo_estado = 'cancelada' then nullif(left(trim(coalesce(p_motivo, '')), 300), '')
        else motivo_cancelacion
      end
  where id = p_cita_id;
end;
$$;

revoke execute on function public.cambiar_estado_cita(uuid, text, text) from public, anon;
grant execute on function public.cambiar_estado_cita(uuid, text, text) to authenticated;

-- Cancela las citas pendiente_pago cuyo cupo venció sin anticipo verificado y libera el
-- horario. La ejecuta el cron cada 10 minutos (ver la migración siguiente).
create or replace function public.expirar_cupos_vencidos()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cantidad integer;
begin
  update public.citas
  set estado = 'cancelada',
      cancelada_at = now(),
      cancelada_por = null,
      motivo_cancelacion = 'cupo_vencido',
      expira_cupo_at = null
  where estado = 'pendiente_pago'
    and expira_cupo_at is not null
    and expira_cupo_at < now();
  get diagnostics v_cantidad = row_count;
  return v_cantidad;
end;
$$;

revoke execute on function public.expirar_cupos_vencidos() from public, anon, authenticated;

-- La ocupación de la agenda ahora incluye las citas activas, con su descanso.
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
    union all
    select c.inicio, c.bloqueo_hasta
    from public.citas c
    where c.profesional_id = p_profesional_id
      and c.estado in ('pendiente_pago', 'confirmada')
      and c.inicio < p_hasta
      and c.bloqueo_hasta > p_desde
    order by 1;
end;
$$;
