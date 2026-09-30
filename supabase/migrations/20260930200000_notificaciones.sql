-- Bloque 1.8: cola de notificaciones por correo. Ninguna lleva información clínica: solo
-- fecha, hora, modalidad y el nombre genérico del servicio.

create table public.notificaciones (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.usuarios (id) on delete cascade,
  tipo text not null check (tipo in (
    'reserva_recibida', 'comprobante_recibido', 'pago_verificado', 'pago_rechazado',
    'cupo_por_vencer', 'recordatorio_24h', 'recordatorio_2h',
    'cita_cancelada', 'cita_reprogramada', 'constancia_consentimiento'
  )),
  canal text not null default 'correo' check (canal in ('correo')),
  payload jsonb not null default '{}',
  programada_para timestamptz not null default now(),
  enviada_at timestamptz,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'enviada', 'fallida', 'omitida')),
  intentos integer not null default 0,
  error text check (error is null or length(error) <= 500),
  created_at timestamptz not null default now()
);

create index notificaciones_cola_idx on public.notificaciones (programada_para) where estado = 'pendiente';
create index notificaciones_usuario_idx on public.notificaciones (usuario_id, created_at desc);

-- Solo el servidor (con la clave de servicio) lee y escribe esta tabla: nadie más.
alter table public.notificaciones enable row level security;
revoke all on public.notificaciones from anon, authenticated;

create or replace function public.encolar_notificacion(
  p_usuario_id uuid,
  p_tipo text,
  p_payload jsonb,
  p_programada_para timestamptz default now()
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.notificaciones (usuario_id, tipo, payload, programada_para)
  select p_usuario_id, p_tipo, p_payload, p_programada_para
  where p_usuario_id is not null;
$$;

revoke execute on function public.encolar_notificacion(uuid, text, jsonb, timestamptz) from public, anon, authenticated;

-- Citas: reserva recibida, confirmación, cancelación y recordatorios.
create or replace function public.citas_notificar()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_servicio text;
  v_prof_usuario uuid;
  v_payload jsonb;
  v_inicio_anterior timestamptz;
begin
  select nombre into v_servicio from public.servicios where id = new.servicio_id;
  select usuario_id into v_prof_usuario from public.profesionales where id = new.profesional_id;

  v_payload := jsonb_build_object(
    'cita_id', new.id, 'inicio', new.inicio, 'fin', new.fin,
    'modalidad', new.modalidad, 'servicio', v_servicio
  );

  if tg_op = 'INSERT' then
    -- Reprogramación: aviso a la persona y a la profesional, con la fecha anterior.
    if new.reprogramada_de is not null then
      select inicio into v_inicio_anterior from public.citas where id = new.reprogramada_de;
      perform public.encolar_notificacion(new.creada_por, 'cita_reprogramada',
        v_payload || jsonb_build_object('inicio_anterior', v_inicio_anterior));
      if v_prof_usuario is distinct from new.creada_por then
        perform public.encolar_notificacion(v_prof_usuario, 'cita_reprogramada',
          v_payload || jsonb_build_object('inicio_anterior', v_inicio_anterior, 'para_profesional', true));
      end if;
    end if;

    if new.estado = 'pendiente_pago' then
      perform public.encolar_notificacion(new.creada_por, 'reserva_recibida',
        v_payload || jsonb_build_object('expira_cupo_at', new.expira_cupo_at));
      if new.expira_cupo_at is not null and new.expira_cupo_at - interval '1 hour' > now() then
        perform public.encolar_notificacion(new.creada_por, 'cupo_por_vencer',
          v_payload || jsonb_build_object('expira_cupo_at', new.expira_cupo_at),
          new.expira_cupo_at - interval '1 hour');
      end if;
    elsif new.estado = 'confirmada' then
      if new.inicio - interval '24 hours' > now() then
        perform public.encolar_notificacion(new.creada_por, 'recordatorio_24h', v_payload, new.inicio - interval '24 hours');
      end if;
      if new.inicio - interval '2 hours' > now() then
        perform public.encolar_notificacion(new.creada_por, 'recordatorio_2h', v_payload, new.inicio - interval '2 hours');
      end if;
    end if;
    return null;
  end if;

  if new.estado is distinct from old.estado then
    if new.estado = 'confirmada' then
      perform public.encolar_notificacion(new.creada_por, 'pago_verificado', v_payload);
      if new.inicio - interval '24 hours' > now() then
        perform public.encolar_notificacion(new.creada_por, 'recordatorio_24h', v_payload, new.inicio - interval '24 hours');
      end if;
      if new.inicio - interval '2 hours' > now() then
        perform public.encolar_notificacion(new.creada_por, 'recordatorio_2h', v_payload, new.inicio - interval '2 hours');
      end if;
    elsif new.estado = 'cancelada' then
      -- El motivo escrito por la persona no viaja por correo: podría contener datos sensibles.
      v_payload := v_payload || jsonb_build_object('por_cupo_vencido', new.motivo_cancelacion = 'cupo_vencido');
      perform public.encolar_notificacion(new.creada_por, 'cita_cancelada', v_payload);
      if v_prof_usuario is distinct from new.creada_por then
        perform public.encolar_notificacion(v_prof_usuario, 'cita_cancelada', v_payload || jsonb_build_object('para_profesional', true));
      end if;
    end if;
  end if;
  return null;
end;
$$;

revoke execute on function public.citas_notificar() from public, anon, authenticated;

create trigger citas_notificar
  after insert or update of estado on public.citas
  for each row execute function public.citas_notificar();

-- Pagos: comprobante recibido (a la profesional) y rechazo (a la persona).
create or replace function public.pagos_notificar()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cita public.citas%rowtype;
  v_prof_usuario uuid;
  v_servicio text;
  v_payload jsonb;
begin
  if new.concepto <> 'anticipo' or new.estado is not distinct from old.estado then
    return null;
  end if;
  if new.estado not in ('comprobante_recibido', 'rechazado') then
    return null;
  end if;

  select * into v_cita from public.citas where id = new.cita_id;
  select usuario_id into v_prof_usuario from public.profesionales where id = v_cita.profesional_id;
  select nombre into v_servicio from public.servicios where id = v_cita.servicio_id;

  v_payload := jsonb_build_object(
    'cita_id', v_cita.id, 'inicio', v_cita.inicio, 'fin', v_cita.fin,
    'modalidad', v_cita.modalidad, 'servicio', v_servicio
  );

  if new.estado = 'comprobante_recibido' then
    perform public.encolar_notificacion(v_prof_usuario, 'comprobante_recibido', v_payload);
  else
    perform public.encolar_notificacion(v_cita.creada_por, 'pago_rechazado',
      v_payload || jsonb_build_object('motivo', new.motivo_rechazo, 'expira_cupo_at', v_cita.expira_cupo_at));
  end if;
  return null;
end;
$$;

revoke execute on function public.pagos_notificar() from public, anon, authenticated;

create trigger pagos_notificar
  after update of estado on public.pagos
  for each row execute function public.pagos_notificar();

-- Consentimientos: constancia para quien firma.
create or replace function public.consentimientos_notificar()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.encolar_notificacion(new.firmante_usuario_id, 'constancia_consentimiento',
    jsonb_build_object('consentimiento_id', new.id, 'persona_id', new.persona_id));
  return null;
end;
$$;

revoke execute on function public.consentimientos_notificar() from public, anon, authenticated;

create trigger consentimientos_notificar
  after insert on public.consentimientos_firmados
  for each row execute function public.consentimientos_notificar();
