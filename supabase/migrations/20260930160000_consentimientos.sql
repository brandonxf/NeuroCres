-- Bloque 1.5: plantillas de consentimiento versionadas y consentimientos firmados (inmutables).

create table public.plantillas_consentimiento (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('consentimiento_informado', 'tratamiento_datos', 'menores')),
  version integer not null check (version > 0),
  titulo text not null check (length(trim(titulo)) > 0),
  contenido text not null check (length(trim(contenido)) > 0),  -- Markdown
  vigente_desde timestamptz not null default now(),
  activa boolean not null default false,
  created_at timestamptz not null default now(),
  unique (tipo, version)
);

-- Solo una plantilla activa por tipo.
create unique index plantillas_una_activa_por_tipo
  on public.plantillas_consentimiento (tipo) where activa;

alter table public.plantillas_consentimiento enable row level security;

-- Cualquiera lee la plantilla activa (la autorización de datos se ve desde el registro).
create policy plantillas_select_publico on public.plantillas_consentimiento
  for select to anon
  using (activa);

-- El texto de una versión nunca se edita: se publica una nueva (publicar_plantilla).
revoke all on public.plantillas_consentimiento from anon, authenticated;
grant select on public.plantillas_consentimiento to anon, authenticated;

create table public.consentimientos_firmados (
  id uuid primary key default gen_random_uuid(),
  plantilla_id uuid not null references public.plantillas_consentimiento (id) on delete restrict,
  persona_id uuid not null references public.personas (id) on delete restrict,
  firmante_usuario_id uuid not null references public.usuarios (id) on delete restrict,
  firmante_nombre text not null check (length(trim(firmante_nombre)) >= 3),
  firmante_documento text not null check (length(trim(firmante_documento)) >= 4),
  calidad text not null check (calidad in ('titular', 'responsable_legal')),
  asentimiento_menor boolean not null default false,
  hash_contenido text not null check (hash_contenido ~ '^[0-9a-f]{64}$'),  -- SHA-256 del texto mostrado
  firma_trazo_path text,
  ip inet,
  user_agent text check (length(user_agent) <= 500),
  firmado_at timestamptz not null default now(),
  constancia_path text,
  -- Una firma por versión y persona.
  unique (plantilla_id, persona_id)
);

create index consentimientos_persona_idx on public.consentimientos_firmados (persona_id, firmado_at desc);

-- ¿La cuenta en sesión firmó (o es responsable de quien firmó) esta versión? Sirve para que
-- la familia siga viendo el texto exacto que firmó aunque ya no sea la versión activa.
-- Solo responde por quien llama: no revela firmas ajenas.
create or replace function public.plantilla_firmada_por_mi(p_plantilla_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.consentimientos_firmados f
    where f.plantilla_id = p_plantilla_id
      and public.es_dueno_de_persona(f.persona_id)
  );
$$;

revoke execute on function public.plantilla_firmada_por_mi(uuid) from public, anon;
grant execute on function public.plantilla_firmada_por_mi(uuid) to authenticated;

-- Con sesión: la activa, todas si es administrador o profesional, y las que la familia firmó.
create policy plantillas_select on public.plantillas_consentimiento
  for select to authenticated
  using (
    activa
    or public.tiene_rol('administrador')
    or public.tiene_rol('profesional')
    or public.plantilla_firmada_por_mi(id)
  );

-- Un consentimiento firmado no se edita ni se borra. Única excepción: guardar una sola vez
-- la ruta del PDF de constancia, que se genera después de firmar.
create or replace function public.consentimientos_inmutables()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Un consentimiento firmado no se borra' using errcode = '22023';
  end if;
  if old.constancia_path is null
     and new.constancia_path is not null
     and (to_jsonb(new) - 'constancia_path') = (to_jsonb(old) - 'constancia_path') then
    return new;
  end if;
  raise exception 'Un consentimiento firmado no se modifica' using errcode = '22023';
end;
$$;

create trigger consentimientos_sin_cambios
  before update or delete on public.consentimientos_firmados
  for each row execute function public.consentimientos_inmutables();

alter table public.consentimientos_firmados enable row level security;

create policy consentimientos_select on public.consentimientos_firmados
  for select to authenticated
  using (
    public.es_dueno_de_persona(persona_id)
    or public.tiene_rol('profesional')   -- refinar: solo personas con cita con ella
    or public.tiene_rol('administrador')
  );

-- Sin insert ni update desde la API: se firma con firmar_consentimiento().
revoke all on public.consentimientos_firmados from anon, authenticated;
grant select on public.consentimientos_firmados to authenticated;

-- Edad (en años) a la fecha de hoy en Colombia.
create or replace function public.edad_en_anios(p_fecha_nacimiento date)
returns integer
language sql
stable
set search_path = ''
as $$
  select date_part('year', age((now() at time zone 'America/Bogota')::date, p_fecha_nacimiento))::integer;
$$;

-- Tipos de plantilla que exige agendar a una persona: el informado y la autorización de
-- datos siempre; el de menores si tiene menos de 18 años.
create or replace function public.tipos_consentimiento_requeridos(p_persona_id uuid)
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p.fecha_nacimiento is not null and public.edad_en_anios(p.fecha_nacimiento) < 18
      then array['consentimiento_informado', 'tratamiento_datos', 'menores']
    else array['consentimiento_informado', 'tratamiento_datos']
  end
  from public.personas p
  where p.id = p_persona_id;
$$;

revoke execute on function public.tipos_consentimiento_requeridos(uuid) from public, anon, authenticated;

-- Plantillas activas que la persona aún no firmó. Vacío = puede agendar.
create or replace function public.consentimientos_pendientes(p_persona_id uuid)
returns table (plantilla_id uuid, tipo text, titulo text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Sesión requerida' using errcode = '42501';
  end if;
  if not (
    public.es_dueno_de_persona(p_persona_id)
    or public.tiene_rol('profesional')
    or public.tiene_rol('administrador')
  ) then
    raise exception 'Sin acceso a esa persona' using errcode = '42501';
  end if;

  return query
    select p.id, p.tipo, p.titulo
    from public.plantillas_consentimiento p
    where p.activa
      and p.tipo = any (public.tipos_consentimiento_requeridos(p_persona_id))
      and not exists (
        select 1 from public.consentimientos_firmados f
        where f.plantilla_id = p.id and f.persona_id = p_persona_id
      )
    order by p.tipo;
end;
$$;

revoke execute on function public.consentimientos_pendientes(uuid) from public, anon;
grant execute on function public.consentimientos_pendientes(uuid) to authenticated;

-- Uso interno (la reserva): ¿la persona tiene firmados todos los consentimientos vigentes?
create or replace function public.consentimientos_completos(p_persona_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (
    select 1
    from public.plantillas_consentimiento p
    where p.activa
      and p.tipo = any (public.tipos_consentimiento_requeridos(p_persona_id))
      and not exists (
        select 1 from public.consentimientos_firmados f
        where f.plantilla_id = p.id and f.persona_id = p_persona_id
      )
  )
  and exists (
    select 1 from public.plantillas_consentimiento p
    where p.activa and p.tipo = 'consentimiento_informado'
  );
$$;

revoke execute on function public.consentimientos_completos(uuid) from public, anon, authenticated;

-- Edad desde la cual el menor da también su asentimiento (editable por el administrador).
insert into public.configuracion (clave, valor, descripcion) values
  ('edad_asentimiento', '12',
   'Edad desde la cual, en menores de 18 años, se pide además el asentimiento del menor.')
on conflict (clave) do nothing;

-- Firma un consentimiento. El texto y su hash los toma la base de datos de la plantilla
-- activa, no del cliente: lo firmado es exactamente lo que estaba publicado.
create or replace function public.firmar_consentimiento(
  p_plantilla_id uuid,
  p_persona_id uuid,
  p_firmante_nombre text,
  p_firmante_documento text,
  p_asentimiento_menor boolean default false,
  p_firma_trazo_path text default null,
  p_ip text default null,
  p_user_agent text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_plantilla public.plantillas_consentimiento%rowtype;
  v_persona public.personas%rowtype;
  v_calidad text;
  v_edad integer;
  v_edad_asentimiento integer;
  v_id uuid;
  v_ip inet;
begin
  if v_uid is null then
    raise exception 'Sesión requerida' using errcode = '42501';
  end if;

  select * into v_persona from public.personas where id = p_persona_id and deleted_at is null;
  if not found or not public.es_dueno_de_persona(p_persona_id) then
    raise exception 'Sin acceso a esa persona' using errcode = '42501';
  end if;

  select * into v_plantilla from public.plantillas_consentimiento where id = p_plantilla_id;
  if not found or not v_plantilla.activa then
    raise exception 'Ese texto ya no está vigente: recarga la página' using errcode = '22023';
  end if;
  if not (v_plantilla.tipo = any (public.tipos_consentimiento_requeridos(p_persona_id))) then
    raise exception 'Ese consentimiento no aplica a esta persona' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.consentimientos_firmados
    where plantilla_id = p_plantilla_id and persona_id = p_persona_id
  ) then
    raise exception 'Ya está firmado' using errcode = '23505';
  end if;

  v_calidad := case when v_persona.usuario_id = v_uid then 'titular' else 'responsable_legal' end;
  v_edad := public.edad_en_anios(v_persona.fecha_nacimiento);

  -- Un menor de 18 lo firma su responsable legal, nunca el propio menor.
  if v_edad < 18 and v_calidad <> 'responsable_legal' then
    raise exception 'Un menor de edad no firma por sí mismo: firma su responsable legal'
      using errcode = '42501';
  end if;

  -- En menores con edad de asentir, se exige además su asentimiento.
  select coalesce((valor #>> '{}')::integer, 12) into v_edad_asentimiento
  from public.configuracion where clave = 'edad_asentimiento';
  v_edad_asentimiento := coalesce(v_edad_asentimiento, 12);
  if v_plantilla.tipo = 'menores' and v_edad < 18 and v_edad >= v_edad_asentimiento
     and not coalesce(p_asentimiento_menor, false) then
    raise exception 'Falta el asentimiento del menor' using errcode = '22023';
  end if;

  begin
    v_ip := nullif(trim(p_ip), '')::inet;
  exception when others then
    v_ip := null;
  end;

  insert into public.consentimientos_firmados (
    plantilla_id, persona_id, firmante_usuario_id, firmante_nombre, firmante_documento,
    calidad, asentimiento_menor, hash_contenido, firma_trazo_path, ip, user_agent
  ) values (
    p_plantilla_id, p_persona_id, v_uid, trim(p_firmante_nombre), trim(p_firmante_documento),
    v_calidad, coalesce(p_asentimiento_menor, false),
    encode(extensions.digest(convert_to(v_plantilla.contenido, 'UTF8'), 'sha256'), 'hex'),
    p_firma_trazo_path, v_ip, left(p_user_agent, 500)
  ) returning id into v_id;

  perform public.registrar_evento_interno(
    v_uid, 'consentimiento.firmado', 'consentimientos_firmados', v_id, p_persona_id,
    jsonb_build_object('tipo', v_plantilla.tipo, 'version', v_plantilla.version, 'calidad', v_calidad),
    p_ip, p_user_agent
  );

  return v_id;
end;
$$;

revoke execute on function public.firmar_consentimiento(uuid, uuid, text, text, boolean, text, text, text) from public, anon;
grant execute on function public.firmar_consentimiento(uuid, uuid, text, text, boolean, text, text, text) to authenticated;

-- Guarda una sola vez la ruta del PDF de constancia (lo genera el servidor tras firmar).
create or replace function public.registrar_constancia(p_consentimiento_id uuid, p_ruta text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_persona uuid;
begin
  select persona_id into v_persona
  from public.consentimientos_firmados
  where id = p_consentimiento_id and firmante_usuario_id = (select auth.uid());
  if not found then
    raise exception 'Consentimiento no encontrado' using errcode = '42501';
  end if;
  if p_ruta is null or split_part(p_ruta, '/', 1) <> v_persona::text then
    raise exception 'Ruta no válida' using errcode = '22023';
  end if;

  update public.consentimientos_firmados
  set constancia_path = p_ruta
  where id = p_consentimiento_id and constancia_path is null;
end;
$$;

revoke execute on function public.registrar_constancia(uuid, text) from public, anon;
grant execute on function public.registrar_constancia(uuid, text) to authenticated;

-- Publica una versión nueva de un tipo de plantilla y desactiva la anterior (administrador).
create or replace function public.publicar_plantilla(p_tipo text, p_titulo text, p_contenido text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_version integer;
begin
  if not public.tiene_rol('administrador') then
    raise exception 'Solo el administrador publica plantillas' using errcode = '42501';
  end if;

  select coalesce(max(version), 0) + 1 into v_version
  from public.plantillas_consentimiento where tipo = p_tipo;

  update public.plantillas_consentimiento set activa = false where tipo = p_tipo and activa;

  insert into public.plantillas_consentimiento (tipo, version, titulo, contenido, activa)
  values (p_tipo, v_version, p_titulo, p_contenido, true)
  returning id into v_id;

  perform public.registrar_evento_interno(
    (select auth.uid()), 'plantilla.publicada', 'plantillas_consentimiento', v_id, null,
    jsonb_build_object('tipo', p_tipo, 'version', v_version)
  );
  return v_id;
end;
$$;

revoke execute on function public.publicar_plantilla(text, text, text) from public, anon;
grant execute on function public.publicar_plantilla(text, text, text) to authenticated;

-- Borradores iniciales. NO son textos legales definitivos: un abogado debe revisarlos y
-- publicar la versión final (publicar_plantilla) antes del piloto con personas reales.
insert into public.plantillas_consentimiento (tipo, version, titulo, contenido, activa) values
  ('consentimiento_informado', 1, 'Consentimiento informado',
$md$> **BORRADOR — pendiente de revisión legal.** Este texto no es definitivo.

## Consentimiento informado para atención psicológica y neuropsicológica

Declaro que he recibido información clara sobre el servicio que voy a recibir: en qué consiste, su duración aproximada, su modalidad (presencial o virtual), su valor y la forma de pago.

Entiendo que:

- La atención psicológica y neuropsicológica es un proceso de colaboración y no garantiza resultados específicos.
- Puedo hacer preguntas en cualquier momento y retirarme del proceso cuando lo decida.
- La información que comparta es confidencial, con las excepciones que establece la ley.
- Las citas se rigen por la política de cancelación y reprogramación vigente, que acepto al agendar.

Al firmar confirmo que leí este documento y que consiento de manera libre e informada.$md$, true),
  ('tratamiento_datos', 1, 'Autorización de tratamiento de datos personales',
$md$> **BORRADOR — pendiente de revisión legal.** Este texto no es definitivo.

## Autorización para el tratamiento de datos personales (Ley 1581 de 2012)

Autorizo de manera previa, expresa e informada el tratamiento de mis datos personales, incluidos los datos sensibles relacionados con mi salud, para las siguientes finalidades:

- Gestionar mi cuenta, mis citas y mis pagos.
- Prestar el servicio de atención psicológica o neuropsicológica y llevar el registro que la actividad exige.
- Enviarme comunicaciones sobre mis citas y pagos, sin información clínica.

Sé que los datos sensibles son de entrega voluntaria, que puedo conocer, actualizar, rectificar y suprimir mis datos, y revocar esta autorización, escribiendo al canal de contacto indicado en la aplicación.$md$, true),
  ('menores', 1, 'Consentimiento y asentimiento para la atención de menores de edad',
$md$> **BORRADOR — pendiente de revisión legal.** Este texto no es definitivo.

## Atención de menores de edad

Como responsable legal, declaro que tengo la facultad de autorizar la atención del menor y que la información registrada sobre mi relación con él o ella es veraz.

Autorizo su atención y el tratamiento de sus datos personales, incluidos datos sensibles, en los términos del consentimiento informado y de la autorización de tratamiento de datos.

**Asentimiento del menor.** Cuando el menor tiene edad para comprender, se le explica el servicio con palabras sencillas y se deja constancia de que está de acuerdo en participar.$md$, true)
on conflict (tipo, version) do nothing;
