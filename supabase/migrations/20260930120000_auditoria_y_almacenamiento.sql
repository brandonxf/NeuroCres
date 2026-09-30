-- Bloque 0.6: auditoría (solo inserción) y almacenamiento privado.

create table public.auditoria (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,                      -- nulo si lo hizo el sistema
  accion text not null,               -- ej.: pago.verificado, comprobante.visto
  entidad text not null,
  entidad_id uuid,
  persona_id uuid,                    -- persona a la que pertenece el dato tocado
  metadata jsonb not null default '{}' check (pg_column_size(metadata) < 4096),
  ip inet,
  user_agent text check (length(user_agent) <= 500),
  created_at timestamptz not null default now()
);

create index auditoria_persona_idx on public.auditoria (persona_id, created_at desc);
create index auditoria_actor_idx on public.auditoria (actor_id, created_at desc);

alter table public.auditoria enable row level security;

-- Solo lectura desde la API; nadie inserta directo (ver registrar_evento) ni modifica.
revoke all on public.auditoria from anon, authenticated;
grant select on public.auditoria to authenticated;

create policy auditoria_select on public.auditoria
  for select to authenticated
  using (
    public.tiene_rol('administrador')
    or actor_id = (select auth.uid())
    or (persona_id is not null and public.es_dueno_de_persona(persona_id))
    or public.tiene_rol('profesional')  -- refinar en Fase 1: solo sus consultantes
  );

-- Ni siquiera el dueño de la base puede alterar el historial por accidente.
create or replace function public.auditoria_inmutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'La auditoría no se modifica ni se borra';
end;
$$;

create trigger auditoria_sin_update_delete
  before update or delete on public.auditoria
  for each row execute function public.auditoria_inmutable();

-- Uso interno: triggers y funciones del sistema. No es invocable desde la API.
create or replace function public.registrar_evento_interno(
  p_actor_id uuid,
  p_accion text,
  p_entidad text,
  p_entidad_id uuid default null,
  p_persona_id uuid default null,
  p_metadata jsonb default '{}',
  p_ip text default null,
  p_user_agent text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ip inet;
begin
  begin
    v_ip := nullif(trim(p_ip), '')::inet;
  exception when others then
    v_ip := null;
  end;

  insert into public.auditoria (actor_id, accion, entidad, entidad_id, persona_id, metadata, ip, user_agent)
  values (p_actor_id, p_accion, p_entidad, p_entidad_id, p_persona_id, coalesce(p_metadata, '{}'), v_ip, left(p_user_agent, 500));
end;
$$;

revoke execute on function public.registrar_evento_interno(uuid, text, text, uuid, uuid, jsonb, text, text)
  from public, anon, authenticated;

-- Uso desde la app (Server Actions con la sesión del usuario). El actor siempre es quien
-- llama, solo se aceptan acciones conocidas y solo sobre personas que puede ver.
create or replace function public.registrar_evento(
  p_accion text,
  p_entidad text,
  p_entidad_id uuid,
  p_persona_id uuid,
  p_metadata jsonb default '{}',
  p_ip text default null,
  p_user_agent text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_permitidas constant text[] := array[
    'comprobante.subido', 'comprobante.visto',
    'documento.visto', 'documento.descargado',
    'consentimiento.firmado', 'consentimiento.visto'
  ];
begin
  if v_uid is null then
    raise exception 'Sesión requerida' using errcode = '42501';
  end if;
  if not (p_accion = any (v_permitidas)) then
    raise exception 'Acción de auditoría no permitida' using errcode = '22023';
  end if;
  if p_persona_id is null or not (
    public.es_dueno_de_persona(p_persona_id)
    or public.tiene_rol('profesional')
    or public.tiene_rol('administrador')
  ) then
    raise exception 'Sin acceso a esa persona' using errcode = '42501';
  end if;

  perform public.registrar_evento_interno(v_uid, p_accion, p_entidad, p_entidad_id, p_persona_id, p_metadata, p_ip, p_user_agent);
end;
$$;

revoke execute on function public.registrar_evento(text, text, uuid, uuid, jsonb, text, text) from public, anon;
grant execute on function public.registrar_evento(text, text, uuid, uuid, jsonb, text, text) to authenticated;

-- Almacenamiento privado: ningún bucket es público; JPG, PNG y PDF de hasta 5 MB.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('comprobantes', 'comprobantes', false, 5242880, array['image/jpeg', 'image/png', 'application/pdf']),
  ('consentimientos', 'consentimientos', false, 5242880, array['image/jpeg', 'image/png', 'application/pdf']),
  ('documentos', 'documentos', false, 5242880, array['image/jpeg', 'image/png', 'application/pdf'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Las rutas son {persona_id}/archivo. Devuelve el uuid de la primera carpeta, o nulo si no lo es.
create or replace function public.persona_de_ruta(p_ruta text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case
    when split_part(p_ruta, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then split_part(p_ruta, '/', 1)::uuid
  end;
$$;

-- comprobantes: sube la familia de la persona; ven ella, la profesional y el administrador.
create policy comprobantes_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'comprobantes'
    and (
      public.es_dueno_de_persona(public.persona_de_ruta(name))
      or public.tiene_rol('profesional')
      or public.tiene_rol('administrador')
    )
  );

create policy comprobantes_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'comprobantes'
    and public.es_dueno_de_persona(public.persona_de_ruta(name))
  );

-- consentimientos (y soportes de representación): ven y suben la familia y la profesional.
create policy consentimientos_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'consentimientos'
    and (
      public.es_dueno_de_persona(public.persona_de_ruta(name))
      or public.tiene_rol('profesional')
    )
  );

create policy consentimientos_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'consentimientos'
    and (
      public.es_dueno_de_persona(public.persona_de_ruta(name))
      or public.tiene_rol('profesional')
    )
  );

-- documentos (resultados e informes): solo la profesional. El acceso de la familia a lo
-- liberado se agrega en la Fase 2, junto con la tabla de informes.
create policy documentos_select on storage.objects
  for select to authenticated
  using (bucket_id = 'documentos' and public.tiene_rol('profesional'));

create policy documentos_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'documentos' and public.tiene_rol('profesional'));
