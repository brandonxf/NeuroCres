-- Cierre de la Fase 1: la profesional solo ve a las personas que atiende (las que tienen o
-- tuvieron una cita con ella), y el enlace de la sala virtual solo se entrega en citas
-- virtuales confirmadas.

-- ¿La profesional en sesión atiende (o atendió) a esta persona? Es decir, ¿hay una cita
-- suya con ella? Las citas canceladas también cuentan: el historial le pertenece.
create or replace function public.profesional_atiende_a(p_persona_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.citas c
    join public.profesionales p on p.id = c.profesional_id
    where c.persona_id = p_persona_id
      and p.usuario_id = (select auth.uid())
  );
$$;

revoke execute on function public.profesional_atiende_a(uuid) from public, anon;
grant execute on function public.profesional_atiende_a(uuid) to authenticated;

-- Personas y responsables: la familia y la profesional que las atiende.
drop policy personas_select on public.personas;
create policy personas_select on public.personas
  for select to authenticated
  using (
    public.es_dueno_de_persona(id)
    or public.profesional_atiende_a(id)
  );

drop policy responsables_select on public.responsables_legales;
create policy responsables_select on public.responsables_legales
  for select to authenticated
  using (
    responsable_usuario_id = (select auth.uid())
    or public.es_dueno_de_persona(persona_id)
    or public.profesional_atiende_a(persona_id)
  );

-- Auditoría: el administrador, quien hizo la acción, la familia y la profesional de esa persona.
drop policy auditoria_select on public.auditoria;
create policy auditoria_select on public.auditoria
  for select to authenticated
  using (
    public.tiene_rol('administrador')
    or actor_id = (select auth.uid())
    or (persona_id is not null and public.es_dueno_de_persona(persona_id))
    or (persona_id is not null and public.profesional_atiende_a(persona_id))
  );

-- Consentimientos firmados.
drop policy consentimientos_select on public.consentimientos_firmados;
create policy consentimientos_select on public.consentimientos_firmados
  for select to authenticated
  using (
    public.es_dueno_de_persona(persona_id)
    or public.profesional_atiende_a(persona_id)
    or public.tiene_rol('administrador')
  );

-- Almacenamiento privado: las rutas son {persona_id}/archivo.
drop policy comprobantes_select on storage.objects;
create policy comprobantes_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'comprobantes'
    and (
      public.es_dueno_de_persona(public.persona_de_ruta(name))
      or public.profesional_atiende_a(public.persona_de_ruta(name))
      or public.tiene_rol('administrador')
    )
  );

drop policy consentimientos_select on storage.objects;
create policy consentimientos_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'consentimientos'
    and (
      public.es_dueno_de_persona(public.persona_de_ruta(name))
      or public.profesional_atiende_a(public.persona_de_ruta(name))
    )
  );

drop policy consentimientos_insert on storage.objects;
create policy consentimientos_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'consentimientos'
    and (
      public.es_dueno_de_persona(public.persona_de_ruta(name))
      or public.profesional_atiende_a(public.persona_de_ruta(name))
    )
  );

drop policy documentos_select on storage.objects;
create policy documentos_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'documentos'
    and public.profesional_atiende_a(public.persona_de_ruta(name))
  );

drop policy documentos_insert on storage.objects;
create policy documentos_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'documentos'
    and public.profesional_atiende_a(public.persona_de_ruta(name))
  );

-- Registro de eventos de auditoría desde la aplicación: misma regla de acceso a la persona.
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
    or public.profesional_atiende_a(p_persona_id)
    or public.tiene_rol('administrador')
  ) then
    raise exception 'Sin acceso a esa persona' using errcode = '42501';
  end if;

  perform public.registrar_evento_interno(v_uid, p_accion, p_entidad, p_entidad_id, p_persona_id, p_metadata, p_ip, p_user_agent);
end;
$$;

-- Consentimientos pendientes: solo de personas a las que se tiene acceso.
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
    or public.profesional_atiende_a(p_persona_id)
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

-- Enlace de la sala virtual: solo en citas virtuales confirmadas (y hasta 2 h después de su
-- fin), para la familia de la persona, la profesional de la cita y el administrador.
create or replace function public.enlace_videollamada_de_cita(p_cita_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.enlace_videollamada
  from public.citas c
  join public.profesionales p on p.id = c.profesional_id
  where c.id = p_cita_id
    and c.modalidad = 'virtual'
    and c.estado = 'confirmada'
    and c.fin > now() - interval '2 hours'
    and (
      public.es_dueno_de_persona(c.persona_id)
      or public.es_profesional(c.profesional_id)
      or public.tiene_rol('administrador')
    );
$$;

revoke execute on function public.enlace_videollamada_de_cita(uuid) from public, anon;
grant execute on function public.enlace_videollamada_de_cita(uuid) to authenticated;
