-- Bloque 1.4: reserva y reprogramación como funciones SQL transaccionales.
-- Todas las reglas se validan aquí, no en la pantalla: la API de la base de datos es pública
-- para cualquier cuenta con sesión, así que nada se puede dar por hecho desde el cliente.

-- Parámetros de la agenda con valores por defecto si faltan.
create or replace function public.parametros_agenda()
returns table (descanso_min integer, antelacion_horas numeric, horizonte_dias integer, granularidad_min integer)
language sql
stable
set search_path = ''
as $$
  select
    coalesce((v ->> 'descanso_min')::integer, 15),
    coalesce((v ->> 'antelacion_min_horas')::numeric, 12),
    coalesce((v ->> 'horizonte_dias')::integer, 60),
    coalesce((v ->> 'granularidad_min')::integer, 30)
  from (select coalesce((select valor from public.configuracion where clave = 'parametros_agenda'), '{}'::jsonb) as v) x;
$$;

revoke execute on function public.parametros_agenda() from public, anon, authenticated;

-- ¿Se puede ofrecer este horario? Espejo, en SQL, del cálculo de horarios libres de la
-- aplicación: cabe en una franja, está alineado a la granularidad, respeta antelación y
-- horizonte, y no cae en un bloqueo. (Las citas activas las impide la restricción de exclusión.)
create or replace function public.horario_disponible(
  p_profesional_id uuid,
  p_inicio timestamptz,
  p_duracion_min integer,
  p_modalidad text
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_zona text;
  v_p record;
  v_ini timestamp;
  v_fin timestamp;
begin
  select zona_horaria into v_zona from public.profesionales where id = p_profesional_id and activo;
  if not found then
    return false;
  end if;

  select * into v_p from public.parametros_agenda();

  if p_inicio < now() + make_interval(mins => (v_p.antelacion_horas * 60)::integer) then
    return false;
  end if;
  if p_inicio > now() + make_interval(days => v_p.horizonte_dias) then
    return false;
  end if;

  v_ini := p_inicio at time zone v_zona;
  v_fin := v_ini + make_interval(mins => p_duracion_min);
  if v_fin::date <> v_ini::date then
    return false;
  end if;

  if not exists (
    select 1
    from public.disponibilidad_semanal d
    where d.profesional_id = p_profesional_id
      and d.dia_semana = extract(dow from v_ini)::integer
      and p_modalidad = any (d.modalidades)
      and d.hora_inicio <= v_ini::time
      and d.hora_fin >= v_fin::time
      and mod(extract(epoch from (v_ini::time - d.hora_inicio))::integer, v_p.granularidad_min * 60) = 0
  ) then
    return false;
  end if;

  if exists (
    select 1
    from public.bloqueos b
    where b.profesional_id = p_profesional_id
      and b.inicio < p_inicio + make_interval(mins => p_duracion_min + v_p.descanso_min)
      and b.fin > p_inicio
  ) then
    return false;
  end if;

  return true;
end;
$$;

revoke execute on function public.horario_disponible(uuid, timestamptz, integer, text) from public, anon, authenticated;

-- Instante hasta el cual se retiene el cupo mientras llega el comprobante.
create or replace function public.expiracion_de_cupo(p_inicio timestamptz)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select least(
    p_inicio,
    now() + make_interval(mins => (
      case
        when p_inicio - now() < make_interval(hours => coalesce((c ->> 'umbral_cita_cercana_horas')::integer, 24))
          then coalesce((c ->> 'horas_si_cita_cercana')::numeric, 2)
        else coalesce((c ->> 'horas')::numeric, 12)
      end * 60)::integer)
  )
  from (select coalesce((select valor from public.configuracion where clave = 'retencion_cupo'), '{}'::jsonb) as c) x;
$$;

revoke execute on function public.expiracion_de_cupo(timestamptz) from public, anon, authenticated;

-- Reserva una cita individual y crea el pago del anticipo pendiente, todo o nada.
create or replace function public.reservar_cita(
  p_servicio_id uuid,
  p_persona_id uuid,
  p_profesional_id uuid,
  p_inicio timestamptz,
  p_modalidad text,
  p_politica_id uuid,
  p_medio_pago text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_servicio public.servicios%rowtype;
  v_persona public.personas%rowtype;
  v_politica_activa uuid;
  v_p record;
  v_fin timestamptz;
  v_anticipo bigint;
  v_id uuid;
  v_confirmada boolean;
begin
  if v_uid is null then
    raise exception 'Sesión requerida' using errcode = '42501';
  end if;

  -- Persona válida y a cargo de quien reserva (un menor solo lo reserva su responsable).
  select * into v_persona from public.personas where id = p_persona_id and deleted_at is null;
  if not found or not public.es_dueno_de_persona(p_persona_id) then
    raise exception 'Sin acceso a esa persona' using errcode = '42501';
  end if;

  select * into v_servicio from public.servicios where id = p_servicio_id and activo and agendable_en_linea;
  if not found or v_servicio.duracion_min is null then
    raise exception 'Ese servicio no se agenda en línea' using errcode = '22023';
  end if;
  if not (p_modalidad = any (v_servicio.modalidades)) then
    raise exception 'Ese servicio no admite la modalidad elegida' using errcode = '22023';
  end if;

  if not public.consentimientos_completos(p_persona_id) then
    raise exception 'Falta firmar los consentimientos antes de agendar' using errcode = '22023';
  end if;

  select id into v_politica_activa from public.politicas_versionadas where activa;
  if v_politica_activa is null or p_politica_id is distinct from v_politica_activa then
    raise exception 'La política de cancelación cambió: vuelve a leerla y aceptarla' using errcode = '22023';
  end if;

  if v_servicio.requiere_anticipo then
    if p_medio_pago is null or p_medio_pago not in ('transferencia', 'llave', 'qr', 'nequi') then
      raise exception 'El anticipo se paga por transferencia, Llave, QR o Nequi' using errcode = '22023';
    end if;
    if not exists (select 1 from public.configuracion_pagos where medio = p_medio_pago and activo) then
      raise exception 'Ese medio de pago no está disponible' using errcode = '22023';
    end if;
  end if;

  if not public.horario_disponible(p_profesional_id, p_inicio, v_servicio.duracion_min, p_modalidad) then
    raise exception 'Ese horario no está disponible: elige otro' using errcode = '23P01';
  end if;

  select * into v_p from public.parametros_agenda();
  v_fin := p_inicio + make_interval(mins => v_servicio.duracion_min);
  v_anticipo := case when v_servicio.requiere_anticipo
    then ceil(v_servicio.precio_cop * v_servicio.anticipo_pct / 100.0)::bigint else 0 end;
  v_confirmada := not v_servicio.requiere_anticipo;

  begin
    insert into public.citas (
      persona_id, servicio_id, profesional_id, inicio, fin, bloqueo_hasta, modalidad, estado,
      precio_cop, anticipo_cop, saldo_cop, expira_cupo_at,
      politica_aceptada_id, politica_aceptada_at, creada_por
    ) values (
      p_persona_id, p_servicio_id, p_profesional_id, p_inicio, v_fin,
      v_fin + make_interval(mins => v_p.descanso_min), p_modalidad,
      case when v_confirmada then 'confirmada' else 'pendiente_pago' end,
      v_servicio.precio_cop, v_anticipo, v_servicio.precio_cop - v_anticipo,
      case when v_confirmada then null else public.expiracion_de_cupo(p_inicio) end,
      v_politica_activa, now(), v_uid
    ) returning id into v_id;
  exception when exclusion_violation then
    -- Otra persona reservó ese horario un instante antes.
    raise exception 'Ese horario acaba de ocuparse: elige otro' using errcode = '23P01';
  end;

  if v_servicio.requiere_anticipo and v_anticipo > 0 then
    insert into public.pagos (cita_id, concepto, monto_cop, medio, estado)
    values (v_id, 'anticipo', v_anticipo, p_medio_pago, 'pendiente');
  elsif v_servicio.precio_cop - v_anticipo > 0 then
    insert into public.pagos (cita_id, concepto, monto_cop, estado)
    values (v_id, 'saldo', v_servicio.precio_cop - v_anticipo, 'pendiente');
  end if;

  perform public.registrar_evento_interno(
    v_uid, 'politica.aceptada', 'citas', v_id, p_persona_id,
    jsonb_build_object('politica_id', v_politica_activa)
  );

  return v_id;
end;
$$;

revoke execute on function public.reservar_cita(uuid, uuid, uuid, timestamptz, text, uuid, text) from public, anon;
grant execute on function public.reservar_cita(uuid, uuid, uuid, timestamptz, text, uuid, text) to authenticated;

-- Reprograma una cita confirmada: crea otra enlazada y traslada el anticipo según la política.
create or replace function public.reprogramar_cita(
  p_cita_id uuid,
  p_nuevo_inicio timestamptz,
  p_modalidad text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_old public.citas%rowtype;
  v_servicio public.servicios%rowtype;
  v_es_profesional boolean;
  v_es_admin boolean;
  v_es_familia boolean;
  v_reglas jsonb;
  v_gratis integer;
  v_c record;
  v_modalidad text;
  v_p record;
  v_fin timestamptz;
  v_id uuid;
  v_cubierto boolean;
  v_medio_anticipo text;
begin
  if v_uid is null then
    raise exception 'Sesión requerida' using errcode = '42501';
  end if;

  select * into v_old from public.citas where id = p_cita_id for update;
  v_es_profesional := found and public.es_profesional(v_old.profesional_id);
  v_es_admin := public.tiene_rol('administrador');
  v_es_familia := found and public.es_dueno_de_persona(v_old.persona_id);
  if not found or not (v_es_profesional or v_es_admin or v_es_familia) then
    raise exception 'Cita no encontrada' using errcode = '42501';
  end if;
  if v_old.estado <> 'confirmada' then
    raise exception 'Solo se reprograman citas confirmadas' using errcode = '22023';
  end if;

  select * into v_servicio from public.servicios where id = v_old.servicio_id;
  v_modalidad := coalesce(p_modalidad, v_old.modalidad);
  if not (v_modalidad = any (v_servicio.modalidades)) then
    raise exception 'Ese servicio no admite la modalidad elegida' using errcode = '22023';
  end if;
  if v_old.modalidad = 'presencial' and v_modalidad = 'virtual' and v_servicio.requiere_presencial then
    raise exception 'Este servicio requiere atención presencial' using errcode = '22023';
  end if;

  select reglas into v_reglas from public.politicas_versionadas where activa;
  select count(*) filter (where reprogramacion_gratuita) into v_gratis from (
    with recursive cadena as (
      select c.id, c.reprogramada_de, c.reprogramacion_gratuita from public.citas c where c.id = v_old.id
      union all
      select c.id, c.reprogramada_de, c.reprogramacion_gratuita from public.citas c join cadena on c.id = cadena.reprogramada_de
    ) select * from cadena
  ) t;

  select * into v_c from public.consecuencia_politica(
    v_old.inicio, v_old.precio_cop, v_old.anticipo_cop, now(),
    case when (v_es_profesional or v_es_admin) and not v_es_familia then 'profesional' else 'consultante' end,
    'reprogramar', v_gratis, coalesce(v_reglas, '{}'::jsonb), true);

  if not v_c.permitida then
    raise exception 'Falta muy poco para la cita: ya no se puede reprogramar' using errcode = '22023';
  end if;

  if not public.horario_disponible(v_old.profesional_id, p_nuevo_inicio, v_servicio.duracion_min, v_modalidad) then
    raise exception 'Ese horario no está disponible: elige otro' using errcode = '23P01';
  end if;

  select * into v_p from public.parametros_agenda();
  v_fin := p_nuevo_inicio + make_interval(mins => v_servicio.duracion_min);
  -- ¿El anticipo trasladado cubre el anticipo de la cita nueva?
  v_cubierto := v_c.trasladar_cop >= v_old.anticipo_cop;
  select medio into v_medio_anticipo from public.pagos where cita_id = v_old.id and concepto = 'anticipo' limit 1;

  -- Primero se libera la cita anterior para que su horario no choque con el nuevo.
  update public.citas set estado = 'reprogramada', expira_cupo_at = null where id = v_old.id;

  begin
    insert into public.citas (
      persona_id, servicio_id, profesional_id, inicio, fin, bloqueo_hasta, modalidad, estado,
      precio_cop, anticipo_cop, saldo_cop, expira_cupo_at, reprogramada_de, reprogramacion_gratuita,
      politica_aceptada_id, politica_aceptada_at, creada_por
    ) values (
      v_old.persona_id, v_old.servicio_id, v_old.profesional_id, p_nuevo_inicio, v_fin,
      v_fin + make_interval(mins => v_p.descanso_min), v_modalidad,
      case when v_cubierto then 'confirmada' else 'pendiente_pago' end,
      v_old.precio_cop, v_old.anticipo_cop, v_old.saldo_cop,
      case when v_cubierto then null else public.expiracion_de_cupo(p_nuevo_inicio) end,
      v_old.id, (v_c.tramo = 'intermedio' and v_c.retener_cop = 0 and v_c.trasladar_cop > 0),
      v_old.politica_aceptada_id, v_old.politica_aceptada_at, v_uid
    ) returning id into v_id;
  exception when exclusion_violation then
    raise exception 'Ese horario acaba de ocuparse: elige otro' using errcode = '23P01';
  end;

  -- Pagos: el saldo de la cita anterior se cancela; el anticipo pasa a la nueva.
  update public.pagos set estado = 'expirado' where cita_id = v_old.id and concepto = 'saldo' and estado = 'pendiente';

  if v_cubierto then
    insert into public.pagos (cita_id, concepto, monto_cop, medio, estado, verificado_por, verificado_at, referencia)
    values (v_id, 'anticipo', v_old.anticipo_cop, v_medio_anticipo, 'verificado', v_uid, now(),
            'Trasladado de la cita anterior');
    if v_old.saldo_cop > 0 then
      insert into public.pagos (cita_id, concepto, monto_cop, estado) values (v_id, 'saldo', v_old.saldo_cop, 'pendiente');
    end if;
  else
    -- Se retuvo parte del anticipo como cargo: falta completar la diferencia.
    insert into public.pagos (cita_id, concepto, monto_cop, medio, estado)
    values (v_id, 'anticipo', v_old.anticipo_cop - v_c.trasladar_cop, coalesce(v_medio_anticipo, 'transferencia'), 'pendiente');
  end if;

  perform public.registrar_evento_interno(
    v_uid, 'cita.reprogramada', 'citas', v_old.id, v_old.persona_id,
    jsonb_build_object(
      'nueva_cita_id', v_id, 'tramo', v_c.tramo, 'retener_cop', v_c.retener_cop,
      'trasladar_cop', v_c.trasladar_cop, 'cobrar_cop', v_c.cobrar_cop
    )
  );

  return v_id;
end;
$$;

revoke execute on function public.reprogramar_cita(uuid, timestamptz, text) from public, anon;
grant execute on function public.reprogramar_cita(uuid, timestamptz, text) to authenticated;
