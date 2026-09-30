-- Bloque 1.7: pagos (anticipo y saldo), comprobantes, medios de pago y devoluciones.
-- Regla central: una cita solo pasa a confirmada cuando el anticipo está verificado.

-- Datos de cada medio de pago que ve la persona al pagar (los completa el administrador).
create table public.configuracion_pagos (
  medio text primary key check (medio in ('transferencia', 'llave', 'qr', 'nequi')),
  titular text,
  banco text,
  tipo_cuenta text,
  numero text,
  llave text,
  qr_path text,
  activo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger configuracion_pagos_set_updated_at
  before update on public.configuracion_pagos
  for each row execute function public.set_updated_at();

alter table public.configuracion_pagos enable row level security;

-- Con sesión se ven los medios activos (para pagar); el administrador ve y edita todos.
create policy configuracion_pagos_select on public.configuracion_pagos
  for select to authenticated
  using (activo or public.tiene_rol('administrador'));

create policy configuracion_pagos_insert on public.configuracion_pagos
  for insert to authenticated
  with check (public.tiene_rol('administrador'));

create policy configuracion_pagos_update on public.configuracion_pagos
  for update to authenticated
  using (public.tiene_rol('administrador'))
  with check (public.tiene_rol('administrador'));

revoke all on public.configuracion_pagos from anon, authenticated;
grant select, insert on public.configuracion_pagos to authenticated;
grant update (titular, banco, tipo_cuenta, numero, llave, qr_path, activo) on public.configuracion_pagos to authenticated;

insert into public.configuracion_pagos (medio) values
  ('transferencia'), ('llave'), ('qr'), ('nequi')
on conflict (medio) do nothing;

create table public.pagos (
  id uuid primary key default gen_random_uuid(),
  cita_id uuid not null references public.citas (id) on delete restrict,
  concepto text not null check (concepto in ('anticipo', 'saldo', 'otro')),
  monto_cop bigint not null check (monto_cop > 0),
  -- Nulo mientras no se elige (por ejemplo, el saldo pendiente para el día de la cita).
  medio text check (medio in ('transferencia', 'llave', 'qr', 'nequi', 'efectivo')),
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'comprobante_recibido', 'verificado', 'rechazado', 'pagado_en_consulta', 'reembolsado', 'expirado')),
  referencia text check (referencia is null or length(referencia) <= 100),
  verificado_por uuid references public.usuarios (id) on delete set null,
  verificado_at timestamptz,
  motivo_rechazo text check (motivo_rechazo is null or motivo_rechazo in ('monto_incorrecto', 'comprobante_ilegible', 'no_aparece_pago', 'otro')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Un anticipo y un saldo por cita.
create unique index pagos_unico_por_concepto
  on public.pagos (cita_id, concepto) where concepto in ('anticipo', 'saldo');
create index pagos_cita_idx on public.pagos (cita_id);
create index pagos_cola_idx on public.pagos (estado, created_at) where estado in ('pendiente', 'comprobante_recibido');

create trigger pagos_set_updated_at
  before update on public.pagos
  for each row execute function public.set_updated_at();

-- Efectivo: solo para el saldo de una cita presencial.
create or replace function public.pagos_validar_medio()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_modalidad text;
begin
  if new.medio = 'efectivo' then
    select modalidad into v_modalidad from public.citas where id = new.cita_id;
    if new.concepto <> 'saldo' or v_modalidad is distinct from 'presencial' then
      raise exception 'El efectivo solo sirve para el saldo de una cita presencial'
        using errcode = '22023';
    end if;
  end if;
  return new;
end;
$$;

create trigger pagos_validar_medio
  before insert or update of medio, concepto on public.pagos
  for each row execute function public.pagos_validar_medio();

alter table public.pagos enable row level security;

-- Ve el pago quien puede ver la cita (la familia, la profesional asignada y el administrador).
create policy pagos_select on public.pagos
  for select to authenticated
  using (exists (select 1 from public.citas c where c.id = pagos.cita_id));

revoke all on public.pagos from anon, authenticated;
grant select on public.pagos to authenticated;

create table public.comprobantes_pago (
  id uuid primary key default gen_random_uuid(),
  pago_id uuid not null references public.pagos (id) on delete restrict,
  storage_path text not null,
  mime text not null check (mime in ('image/jpeg', 'image/png', 'application/pdf')),
  tamano integer not null check (tamano > 0 and tamano <= 5242880),
  subido_por uuid references public.usuarios (id) on delete set null,
  subido_at timestamptz not null default now()
);

create index comprobantes_pago_idx on public.comprobantes_pago (pago_id, subido_at desc);

alter table public.comprobantes_pago enable row level security;

create policy comprobantes_select on public.comprobantes_pago
  for select to authenticated
  using (exists (select 1 from public.pagos p where p.id = comprobantes_pago.pago_id));

revoke all on public.comprobantes_pago from anon, authenticated;
grant select on public.comprobantes_pago to authenticated;

-- Devoluciones pendientes de hacer (plazo propuesto: 5 a 10 días hábiles).
create table public.devoluciones (
  id uuid primary key default gen_random_uuid(),
  cita_id uuid not null references public.citas (id) on delete restrict,
  pago_id uuid references public.pagos (id) on delete restrict,
  monto_cop bigint not null check (monto_cop > 0),
  estado text not null default 'pendiente' check (estado in ('pendiente', 'realizada')),
  medio text check (medio in ('transferencia', 'llave', 'qr', 'nequi', 'efectivo')),
  referencia text check (referencia is null or length(referencia) <= 100),
  realizada_por uuid references public.usuarios (id) on delete set null,
  realizada_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index devoluciones_pendientes_idx on public.devoluciones (created_at) where estado = 'pendiente';

create trigger devoluciones_set_updated_at
  before update on public.devoluciones
  for each row execute function public.set_updated_at();

alter table public.devoluciones enable row level security;

create policy devoluciones_select on public.devoluciones
  for select to authenticated
  using (exists (select 1 from public.citas c where c.id = devoluciones.cita_id));

revoke all on public.devoluciones from anon, authenticated;
grant select on public.devoluciones to authenticated;

-- Si una cita pendiente se cancela o su cupo vence, sus pagos sin verificar quedan expirados.
create or replace function public.citas_sincronizar_pagos()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.estado = 'pendiente_pago' and new.estado = 'cancelada' then
    update public.pagos
    set estado = 'expirado'
    where cita_id = new.id and estado in ('pendiente', 'comprobante_recibido', 'rechazado');
  end if;
  return null;
end;
$$;

revoke execute on function public.citas_sincronizar_pagos() from public, anon, authenticated;

create trigger citas_sincronizar_pagos
  after update of estado on public.citas
  for each row execute function public.citas_sincronizar_pagos();

-- La persona (o su responsable) registra el comprobante de su anticipo. El archivo ya está
-- en el bucket privado `comprobantes` bajo {persona_id}/…
create or replace function public.registrar_comprobante(
  p_pago_id uuid,
  p_storage_path text,
  p_mime text,
  p_tamano integer,
  p_referencia text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_pago public.pagos%rowtype;
  v_cita public.citas%rowtype;
begin
  if v_uid is null then
    raise exception 'Sesión requerida' using errcode = '42501';
  end if;

  select * into v_pago from public.pagos where id = p_pago_id for update;
  if found then
    select * into v_cita from public.citas where id = v_pago.cita_id;
  end if;
  if not found or not public.es_dueno_de_persona(v_cita.persona_id) then
    raise exception 'Pago no encontrado' using errcode = '42501';
  end if;

  if v_pago.concepto <> 'anticipo' then
    raise exception 'Solo se sube comprobante del anticipo' using errcode = '22023';
  end if;
  if v_cita.estado <> 'pendiente_pago' or (v_cita.expira_cupo_at is not null and v_cita.expira_cupo_at < now()) then
    raise exception 'El cupo venció: agenda de nuevo' using errcode = '22023';
  end if;
  if v_pago.estado not in ('pendiente', 'rechazado', 'comprobante_recibido') then
    raise exception 'Este pago ya no admite comprobantes' using errcode = '22023';
  end if;
  if split_part(p_storage_path, '/', 1) <> v_cita.persona_id::text then
    raise exception 'Ruta de archivo no válida' using errcode = '22023';
  end if;

  insert into public.comprobantes_pago (pago_id, storage_path, mime, tamano, subido_por)
  values (p_pago_id, p_storage_path, p_mime, p_tamano, v_uid);

  update public.pagos
  set estado = 'comprobante_recibido',
      referencia = coalesce(nullif(left(trim(coalesce(p_referencia, '')), 100), ''), referencia),
      motivo_rechazo = null
  where id = p_pago_id;

  perform public.registrar_evento_interno(
    v_uid, 'comprobante.recibido', 'pagos', p_pago_id, v_cita.persona_id,
    jsonb_build_object('cita_id', v_cita.id, 'mime', p_mime, 'bytes', p_tamano)
  );
end;
$$;

revoke execute on function public.registrar_comprobante(uuid, text, text, integer, text) from public, anon;
grant execute on function public.registrar_comprobante(uuid, text, text, integer, text) to authenticated;

-- La profesional (o el administrador) verifica el anticipo: confirma la cita y crea el saldo.
create or replace function public.verificar_pago(p_pago_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_pago public.pagos%rowtype;
  v_cita public.citas%rowtype;
begin
  if v_uid is null then
    raise exception 'Sesión requerida' using errcode = '42501';
  end if;

  select * into v_pago from public.pagos where id = p_pago_id for update;
  if found then
    select * into v_cita from public.citas where id = v_pago.cita_id for update;
  end if;
  if not found or not (public.es_profesional(v_cita.profesional_id) or public.tiene_rol('administrador')) then
    raise exception 'Pago no encontrado' using errcode = '42501';
  end if;

  if v_pago.concepto <> 'anticipo' or v_pago.estado <> 'comprobante_recibido' then
    raise exception 'Este pago no está esperando verificación' using errcode = '22023';
  end if;
  if v_cita.estado <> 'pendiente_pago' then
    raise exception 'La cita ya no está pendiente: el cupo venció o fue cancelada' using errcode = '22023';
  end if;

  update public.pagos
  set estado = 'verificado', verificado_por = v_uid, verificado_at = now(), motivo_rechazo = null
  where id = p_pago_id;

  update public.citas set estado = 'confirmada', expira_cupo_at = null where id = v_cita.id;

  -- El saldo queda pendiente para el día de la cita.
  if v_cita.saldo_cop > 0 then
    insert into public.pagos (cita_id, concepto, monto_cop, estado)
    values (v_cita.id, 'saldo', v_cita.saldo_cop, 'pendiente')
    on conflict do nothing;
  end if;

  perform public.registrar_evento_interno(
    v_uid, 'pago.verificado', 'pagos', p_pago_id, v_cita.persona_id,
    jsonb_build_object('cita_id', v_cita.id, 'monto_cop', v_pago.monto_cop, 'medio', v_pago.medio)
  );
end;
$$;

revoke execute on function public.verificar_pago(uuid) from public, anon;
grant execute on function public.verificar_pago(uuid) to authenticated;

-- Rechaza el comprobante con un motivo predefinido. La cita sigue pendiente mientras el cupo
-- esté vigente, para que la persona suba otro comprobante.
create or replace function public.rechazar_pago(p_pago_id uuid, p_motivo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_pago public.pagos%rowtype;
  v_cita public.citas%rowtype;
begin
  if v_uid is null then
    raise exception 'Sesión requerida' using errcode = '42501';
  end if;
  if p_motivo not in ('monto_incorrecto', 'comprobante_ilegible', 'no_aparece_pago', 'otro') then
    raise exception 'Motivo de rechazo no válido' using errcode = '22023';
  end if;

  select * into v_pago from public.pagos where id = p_pago_id for update;
  if found then
    select * into v_cita from public.citas where id = v_pago.cita_id;
  end if;
  if not found or not (public.es_profesional(v_cita.profesional_id) or public.tiene_rol('administrador')) then
    raise exception 'Pago no encontrado' using errcode = '42501';
  end if;

  if v_pago.concepto <> 'anticipo' or v_pago.estado <> 'comprobante_recibido' then
    raise exception 'Este pago no está esperando verificación' using errcode = '22023';
  end if;

  update public.pagos
  set estado = 'rechazado', motivo_rechazo = p_motivo, verificado_por = v_uid, verificado_at = now()
  where id = p_pago_id;

  perform public.registrar_evento_interno(
    v_uid, 'pago.rechazado', 'pagos', p_pago_id, v_cita.persona_id,
    jsonb_build_object('cita_id', v_cita.id, 'motivo', p_motivo)
  );
end;
$$;

revoke execute on function public.rechazar_pago(uuid, text) from public, anon;
grant execute on function public.rechazar_pago(uuid, text) to authenticated;

-- Registra el saldo cobrado el día de la cita (efectivo solo si es presencial).
create or replace function public.registrar_pago_saldo(p_cita_id uuid, p_medio text, p_referencia text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_cita public.citas%rowtype;
  v_pago public.pagos%rowtype;
begin
  if v_uid is null then
    raise exception 'Sesión requerida' using errcode = '42501';
  end if;

  select * into v_cita from public.citas where id = p_cita_id;
  if not found or not (public.es_profesional(v_cita.profesional_id) or public.tiene_rol('administrador')) then
    raise exception 'Cita no encontrada' using errcode = '42501';
  end if;
  if v_cita.estado not in ('confirmada', 'completada') then
    raise exception 'El saldo se cobra en citas confirmadas' using errcode = '22023';
  end if;

  select * into v_pago from public.pagos where cita_id = p_cita_id and concepto = 'saldo' for update;
  if not found or v_pago.estado <> 'pendiente' then
    raise exception 'No hay saldo pendiente para esta cita' using errcode = '22023';
  end if;

  -- El trigger de medio valida que efectivo solo sirva en citas presenciales.
  update public.pagos
  set medio = p_medio,
      estado = case when p_medio = 'efectivo' then 'pagado_en_consulta' else 'verificado' end,
      referencia = nullif(left(trim(coalesce(p_referencia, '')), 100), ''),
      verificado_por = v_uid,
      verificado_at = now()
  where id = v_pago.id;

  perform public.registrar_evento_interno(
    v_uid, 'pago.saldo_registrado', 'pagos', v_pago.id, v_cita.persona_id,
    jsonb_build_object('cita_id', p_cita_id, 'monto_cop', v_pago.monto_cop, 'medio', p_medio)
  );
end;
$$;

revoke execute on function public.registrar_pago_saldo(uuid, text, text) from public, anon;
grant execute on function public.registrar_pago_saldo(uuid, text, text) to authenticated;

-- La profesional marca una devolución como realizada, con el medio y la referencia.
create or replace function public.marcar_devolucion_realizada(p_devolucion_id uuid, p_medio text, p_referencia text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_dev public.devoluciones%rowtype;
  v_cita public.citas%rowtype;
begin
  if v_uid is null then
    raise exception 'Sesión requerida' using errcode = '42501';
  end if;

  select * into v_dev from public.devoluciones where id = p_devolucion_id for update;
  if found then
    select * into v_cita from public.citas where id = v_dev.cita_id;
  end if;
  if not found or not (public.es_profesional(v_cita.profesional_id) or public.tiene_rol('administrador')) then
    raise exception 'Devolución no encontrada' using errcode = '42501';
  end if;
  if v_dev.estado <> 'pendiente' then
    raise exception 'La devolución ya se realizó' using errcode = '22023';
  end if;
  if p_medio not in ('transferencia', 'llave', 'qr', 'nequi', 'efectivo') then
    raise exception 'Medio no válido' using errcode = '22023';
  end if;

  update public.devoluciones
  set estado = 'realizada', medio = p_medio, realizada_por = v_uid, realizada_at = now(),
      referencia = nullif(left(trim(coalesce(p_referencia, '')), 100), '')
  where id = p_devolucion_id;

  if v_dev.pago_id is not null then
    update public.pagos set estado = 'reembolsado' where id = v_dev.pago_id and estado = 'verificado'
      and not exists (select 1 from public.devoluciones d where d.pago_id = v_dev.pago_id and d.estado = 'pendiente' and d.id <> p_devolucion_id);
  end if;

  perform public.registrar_evento_interno(
    v_uid, 'devolucion.realizada', 'devoluciones', p_devolucion_id, v_cita.persona_id,
    jsonb_build_object('cita_id', v_cita.id, 'monto_cop', v_dev.monto_cop, 'medio', p_medio)
  );
end;
$$;

revoke execute on function public.marcar_devolucion_realizada(uuid, text, text) from public, anon;
grant execute on function public.marcar_devolucion_realizada(uuid, text, text) to authenticated;

-- Cancelar una cita aplica la política: registra la consecuencia, crea la devolución que
-- corresponda y deja el saldo sin cobrar. Reemplaza a la versión del bloque 1.3.
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
  v_reglas jsonb;
  v_gratis integer;
  v_c record;
  v_pago_anticipo uuid;
  v_accion text;
begin
  if v_uid is null then
    raise exception 'Sesión requerida' using errcode = '42501';
  end if;

  select * into v_cita from public.citas where id = p_cita_id for update;
  v_es_profesional := found and public.es_profesional(v_cita.profesional_id);
  v_es_admin := public.tiene_rol('administrador');
  v_es_familia := found and public.es_dueno_de_persona(v_cita.persona_id);

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

  -- Consecuencia económica según la política vigente (solo citas con anticipo verificado).
  if v_cita.estado = 'confirmada' and p_nuevo_estado in ('cancelada', 'inasistencia') then
    select reglas into v_reglas from public.politicas_versionadas where activa;
    select count(*) filter (where reprogramacion_gratuita) into v_gratis from (
      with recursive cadena as (
        select c.id, c.reprogramada_de, c.reprogramacion_gratuita from public.citas c where c.id = v_cita.id
        union all
        select c.id, c.reprogramada_de, c.reprogramacion_gratuita from public.citas c join cadena on c.id = cadena.reprogramada_de
      ) select * from cadena
    ) t;
    v_accion := case when p_nuevo_estado = 'inasistencia' then 'inasistencia' else 'cancelar' end;

    select * into v_c from public.consecuencia_politica(
      v_cita.inicio, v_cita.precio_cop, v_cita.anticipo_cop, now(),
      case when p_nuevo_estado = 'inasistencia' then 'consultante'
           when (v_es_profesional or v_es_admin) and not v_es_familia then 'profesional'
           else 'consultante' end,
      v_accion, v_gratis, coalesce(v_reglas, '{}'::jsonb), true);

    select id into v_pago_anticipo from public.pagos
    where cita_id = v_cita.id and concepto = 'anticipo' and estado = 'verificado';

    if v_c.devolver_cop > 0 then
      insert into public.devoluciones (cita_id, pago_id, monto_cop) values (v_cita.id, v_pago_anticipo, v_c.devolver_cop);
    end if;

    -- El saldo pendiente deja de cobrarse, salvo que la política lo cobre (queda como pago pendiente).
    if v_c.cobrar_cop <= 0 then
      update public.pagos set estado = 'expirado' where cita_id = v_cita.id and concepto = 'saldo' and estado = 'pendiente';
    else
      update public.pagos set monto_cop = v_c.cobrar_cop where cita_id = v_cita.id and concepto = 'saldo' and estado = 'pendiente';
    end if;

    perform public.registrar_evento_interno(
      v_uid, 'cita.consecuencia', 'citas', v_cita.id, v_cita.persona_id,
      jsonb_build_object(
        'accion', v_accion, 'tramo', v_c.tramo, 'retener_cop', v_c.retener_cop,
        'devolver_cop', v_c.devolver_cop, 'cobrar_cop', v_c.cobrar_cop
      )
    );
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
