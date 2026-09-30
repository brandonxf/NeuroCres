-- Bloque 1.6: política de cancelación y reprogramación, versionada, y cálculo de consecuencias.
-- La ejecución de cancelaciones y reprogramaciones con devoluciones llega con los pagos (1.7).

create table public.politicas_versionadas (
  id uuid primary key default gen_random_uuid(),
  version integer not null unique check (version > 0),
  contenido text not null check (length(trim(contenido)) > 0),  -- Markdown que se muestra y se acepta
  reglas jsonb not null,                                        -- umbrales: horas, porcentajes
  vigente_desde timestamptz not null default now(),
  activa boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index politicas_una_activa on public.politicas_versionadas ((true)) where activa;

-- Una cita conserva la versión de la política que se aceptó al reservar.
alter table public.citas
  add constraint citas_politica_fkey
  foreign key (politica_aceptada_id) references public.politicas_versionadas (id) on delete restrict;

-- Marca la cita que nació de una reprogramación gratuita dentro de la ventana intermedia
-- (una por proceso). Se fija al crearla; no cambia después.
alter table public.citas
  add column reprogramacion_gratuita boolean not null default false;

alter table public.politicas_versionadas enable row level security;

-- La política vigente es pública (se lee antes de reservar).
create policy politicas_select_publico on public.politicas_versionadas
  for select to anon
  using (activa);

-- ¿La cuenta en sesión aceptó (o es responsable de quien aceptó) esta versión?
create or replace function public.politica_aceptada_por_mi(p_politica_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.citas c
    where c.politica_aceptada_id = p_politica_id
      and public.es_dueno_de_persona(c.persona_id)
  );
$$;

revoke execute on function public.politica_aceptada_por_mi(uuid) from public, anon;
grant execute on function public.politica_aceptada_por_mi(uuid) to authenticated;

create policy politicas_select on public.politicas_versionadas
  for select to authenticated
  using (
    activa
    or public.tiene_rol('administrador')
    or public.tiene_rol('profesional')
    or public.politica_aceptada_por_mi(id)
  );

revoke all on public.politicas_versionadas from anon, authenticated;
grant select on public.politicas_versionadas to anon, authenticated;

-- Consecuencia económica de cancelar, reprogramar o no asistir. Es una función pura: solo
-- depende de sus argumentos, así que se prueba tramo por tramo.
--   tramo:     sin_costo | intermedio | tardio | profesional
--   permitida: falso si la acción no se puede hacer (reprogramar con muy poco tiempo)
--   retener:   parte del anticipo pagado que se queda como cargo
--   devolver:  parte del anticipo que se devuelve (cancelar)
--   trasladar: parte del anticipo que pasa a la nueva cita (reprogramar)
--   cobrar:    lo que aún falta cobrar de la sesión
create or replace function public.consecuencia_politica(
  p_inicio timestamptz,
  p_precio_cop bigint,
  p_anticipo_pagado_cop bigint,
  p_ahora timestamptz,
  p_quien text,             -- consultante | profesional
  p_accion text,            -- cancelar | reprogramar | inasistencia
  p_gratis_usadas integer,
  p_reglas jsonb,
  p_confirmada boolean default true
)
returns table (
  tramo text,
  permitida boolean,
  retener_cop bigint,
  devolver_cop bigint,
  trasladar_cop bigint,
  cobrar_cop bigint
)
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_horas numeric := extract(epoch from (p_inicio - p_ahora)) / 3600.0;
  v_h_libre numeric := coalesce((p_reglas ->> 'horas_sin_costo')::numeric, 24);
  v_h_min numeric := coalesce((p_reglas ->> 'horas_minimo')::numeric, 4);
  v_pct_int numeric := coalesce((p_reglas ->> 'porcentaje_cobro_intermedio')::numeric, 50);
  v_pct_tar numeric := coalesce((p_reglas ->> 'porcentaje_cobro_tardio')::numeric, 100);
  v_gratis integer := coalesce((p_reglas ->> 'reprogramaciones_gratis')::integer, 1);
  v_pagado bigint := greatest(coalesce(p_anticipo_pagado_cop, 0), 0);
  v_cargo bigint;
  v_retener bigint;
begin
  -- Cita sin anticipo verificado: no hay nada retenido ni cobrable.
  if not p_confirmada then
    return query select 'sin_costo'::text, true, 0::bigint, 0::bigint, 0::bigint, 0::bigint;
    return;
  end if;

  -- La profesional cancela o reprograma: sin costo para la persona.
  if p_quien = 'profesional' then
    return query select 'profesional'::text, true, 0::bigint,
      case when p_accion = 'reprogramar' then 0 else v_pagado end,
      case when p_accion = 'reprogramar' then v_pagado else 0 end,
      0::bigint;
    return;
  end if;

  -- Inasistencia o menos de v_h_min horas: se cobra la sesión completa (según la regla).
  if p_accion = 'inasistencia' or v_horas < v_h_min then
    if p_accion = 'reprogramar' then
      return query select 'tardio'::text, false, 0::bigint, 0::bigint, 0::bigint, 0::bigint;
      return;
    end if;
    v_cargo := ceil(p_precio_cop * v_pct_tar / 100.0)::bigint;
    v_retener := least(v_pagado, v_cargo);
    return query select 'tardio'::text, true, v_retener, v_pagado - v_retener, 0::bigint, v_cargo - v_retener;
    return;
  end if;

  -- Con tiempo suficiente: sin costo.
  if v_horas >= v_h_libre then
    return query select 'sin_costo'::text, true, 0::bigint,
      case when p_accion = 'reprogramar' then 0 else v_pagado end,
      case when p_accion = 'reprogramar' then v_pagado else 0 end,
      0::bigint;
    return;
  end if;

  -- Tramo intermedio: una reprogramación gratuita; lo demás, cobro parcial.
  if p_accion = 'reprogramar' and coalesce(p_gratis_usadas, 0) < v_gratis then
    return query select 'intermedio'::text, true, 0::bigint, 0::bigint, v_pagado, 0::bigint;
    return;
  end if;

  v_cargo := ceil(p_precio_cop * v_pct_int / 100.0)::bigint;
  v_retener := least(v_pagado, v_cargo);
  return query select 'intermedio'::text, true, v_retener,
    case when p_accion = 'cancelar' then v_pagado - v_retener else 0 end,
    case when p_accion = 'reprogramar' then v_pagado - v_retener else 0 end,
    v_cargo - v_retener;
end;
$$;

revoke execute on function public.consecuencia_politica(timestamptz, bigint, bigint, timestamptz, text, text, integer, jsonb, boolean)
  from public, anon;
grant execute on function public.consecuencia_politica(timestamptz, bigint, bigint, timestamptz, text, text, integer, jsonb, boolean)
  to authenticated;

-- Consecuencia para una cita concreta, con la política vigente. Sirve para mostrar en pesos
-- lo que ocurrirá antes de confirmar. Solo la ve quien puede ver la cita (RLS).
create or replace function public.calcular_consecuencia(p_cita_id uuid, p_accion text)
returns table (
  tramo text,
  permitida boolean,
  retener_cop bigint,
  devolver_cop bigint,
  trasladar_cop bigint,
  cobrar_cop bigint
)
language plpgsql
stable
set search_path = ''
as $$
declare
  v_cita public.citas%rowtype;
  v_reglas jsonb;
  v_quien text;
  v_gratis integer;
begin
  select * into v_cita from public.citas where id = p_cita_id;  -- RLS: solo si puede verla
  if not found then
    raise exception 'Cita no encontrada' using errcode = '42501';
  end if;
  if p_accion not in ('cancelar', 'reprogramar', 'inasistencia') then
    raise exception 'Acción no válida' using errcode = '22023';
  end if;

  select reglas into v_reglas from public.politicas_versionadas where activa;
  v_reglas := coalesce(v_reglas, '{}'::jsonb);

  v_quien := case
    when public.es_profesional(v_cita.profesional_id) or public.tiene_rol('administrador')
      then 'profesional'
    else 'consultante'
  end;

  -- Reprogramaciones gratuitas ya usadas en la cadena de esta cita.
  with recursive cadena as (
    select c.id, c.reprogramada_de, c.reprogramacion_gratuita
    from public.citas c where c.id = v_cita.id
    union all
    select c.id, c.reprogramada_de, c.reprogramacion_gratuita
    from public.citas c join cadena on c.id = cadena.reprogramada_de
  )
  select count(*) filter (where reprogramacion_gratuita) into v_gratis from cadena;

  return query
    select * from public.consecuencia_politica(
      v_cita.inicio, v_cita.precio_cop,
      case when v_cita.estado = 'confirmada' then v_cita.anticipo_cop else 0 end,
      now(), v_quien, p_accion, v_gratis, v_reglas,
      v_cita.estado = 'confirmada'
    );
end;
$$;

revoke execute on function public.calcular_consecuencia(uuid, text) from public, anon;
grant execute on function public.calcular_consecuencia(uuid, text) to authenticated;

-- Publica una versión nueva de la política y desactiva la anterior (administrador).
create or replace function public.publicar_politica(p_contenido text, p_reglas jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_version integer;
  v_h_libre numeric;
  v_h_min numeric;
begin
  if not public.tiene_rol('administrador') then
    raise exception 'Solo el administrador publica la política' using errcode = '42501';
  end if;

  v_h_libre := (p_reglas ->> 'horas_sin_costo')::numeric;
  v_h_min := (p_reglas ->> 'horas_minimo')::numeric;
  if v_h_libre is null or v_h_min is null or v_h_min < 0 or v_h_libre <= v_h_min
     or (p_reglas ->> 'porcentaje_cobro_intermedio') is null
     or (p_reglas ->> 'porcentaje_cobro_tardio') is null
     or (p_reglas ->> 'porcentaje_cobro_intermedio')::numeric not between 0 and 100
     or (p_reglas ->> 'porcentaje_cobro_tardio')::numeric not between 0 and 100
     or coalesce((p_reglas ->> 'reprogramaciones_gratis')::integer, 0) < 0 then
    raise exception 'Reglas de la política no válidas' using errcode = '22023';
  end if;

  select coalesce(max(version), 0) + 1 into v_version from public.politicas_versionadas;
  update public.politicas_versionadas set activa = false where activa;
  insert into public.politicas_versionadas (version, contenido, reglas, activa)
  values (v_version, p_contenido, p_reglas, true)
  returning id into v_id;

  perform public.registrar_evento_interno(
    (select auth.uid()), 'politica.publicada', 'politicas_versionadas', v_id, null,
    jsonb_build_object('version', v_version, 'reglas', p_reglas)
  );
  return v_id;
end;
$$;

revoke execute on function public.publicar_politica(text, jsonb) from public, anon;
grant execute on function public.publicar_politica(text, jsonb) to authenticated;

-- Versión inicial con los valores propuestos en el plan. NO es un texto legal definitivo:
-- debe revisarse con la profesional y un abogado antes del piloto.
insert into public.politicas_versionadas (version, contenido, reglas, activa) values
  (1,
$md$> **BORRADOR — pendiente de revisión legal y de confirmar con la profesional.**

## Política de cancelación y reprogramación

Estas reglas aplican a las citas individuales con anticipo verificado.

- **Con 24 horas o más de antelación:** puedes cancelar o reprogramar sin costo. Tu anticipo se devuelve o pasa a la nueva fecha.
- **Entre 24 y 4 horas antes:** tienes una reprogramación gratuita por proceso. Después, o si cancelas, se cobra el 50% de la sesión y se retiene de tu anticipo.
- **Con menos de 4 horas de antelación o si no asistes:** se cobra la sesión completa. Se retiene el anticipo y se cobra el saldo.
- **Si cancela la profesional:** puedes reprogramar sin costo o recibir la devolución total.
- **Si llegas tarde:** la sesión termina a la hora prevista, sin cambio en el valor.

Las devoluciones se hacen por el mismo medio de pago, en un plazo de 5 a 10 días hábiles.$md$,
   '{"horas_sin_costo": 24, "horas_minimo": 4, "porcentaje_cobro_intermedio": 50, "porcentaje_cobro_tardio": 100, "reprogramaciones_gratis": 1}',
   true)
on conflict (version) do nothing;
