-- Bloque 1.1: catálogo de servicios, sembrado con la tabla de tarifas del plan.

create table public.servicios (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  nombre text not null check (length(trim(nombre)) > 0),
  descripcion text,
  poblacion text,
  tipo text not null check (tipo in ('individual', 'proceso', 'paquete', 'grupal')),
  duracion_min integer check (duracion_min is null or duracion_min > 0),
  precio_cop bigint not null check (precio_cop >= 0),
  anticipo_pct integer not null default 50 check (anticipo_pct between 0 and 100),
  modalidades text[] not null default array['presencial', 'virtual']
    check (
      cardinality(modalidades) > 0
      and modalidades <@ array['presencial', 'virtual']
    ),
  requiere_presencial boolean not null default false,
  requiere_consentimiento boolean not null default true,
  requiere_formulario boolean not null default false,
  requiere_anticipo boolean not null default true,
  agendable_en_linea boolean not null default false,
  activo boolean not null default true,
  orden integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Si el servicio exige presencialidad, esa es la única modalidad posible.
  constraint servicios_presencial_forzado
    check (not requiere_presencial or modalidades = array['presencial'])
);

create index servicios_orden_idx on public.servicios (orden, nombre);

create trigger servicios_set_updated_at
  before update on public.servicios
  for each row execute function public.set_updated_at();

alter table public.servicios enable row level security;

-- El catálogo es público: cualquiera ve los servicios activos. El administrador ve todos.
create policy servicios_select_publico on public.servicios
  for select to anon
  using (activo);

create policy servicios_select on public.servicios
  for select to authenticated
  using (activo or public.tiene_rol('administrador'));

create policy servicios_insert_admin on public.servicios
  for insert to authenticated
  with check (public.tiene_rol('administrador'));

create policy servicios_update_admin on public.servicios
  for update to authenticated
  using (public.tiene_rol('administrador'))
  with check (public.tiene_rol('administrador'));

-- Sin delete: un servicio se desactiva, porque las citas futuras lo referenciarán.
-- El slug no se edita después de crear el servicio (rompería los enlaces).
revoke all on public.servicios from anon, authenticated;
grant select on public.servicios to anon, authenticated;
grant insert on public.servicios to authenticated;
grant update (
  nombre, descripcion, poblacion, tipo, duracion_min, precio_cop, anticipo_pct,
  modalidades, requiere_presencial, requiere_consentimiento, requiere_formulario,
  requiere_anticipo, agendable_en_linea, activo, orden
) on public.servicios to authenticated;

-- Semilla: servicios y precios de la tabla de tarifas del plan (COP).
-- Se inserta antes de crear el trigger de auditoría para no llenar el historial de ruido.
insert into public.servicios
  (slug, nombre, descripcion, tipo, duracion_min, precio_cop, modalidades, agendable_en_linea, orden)
values
  ('atencion-psicologica-individual', 'Atención Psicológica Individual',
   'Sesión individual de acompañamiento. 50–60 min aprox.',
   'individual', 60, 150000, array['presencial', 'virtual'], true, 10),
  ('entrevista-inicial-neuropsicologica', 'Entrevista Inicial Neuropsicológica',
   'Entrevista clínica, motivo de consulta, antecedentes y definición de necesidades de valoración.',
   'individual', 60, 150000, array['presencial', 'virtual'], true, 20),
  ('valoracion-neuropsicologica-integral', 'Valoración Neuropsicológica Integral',
   'Entrevista inicial, pruebas según motivo de consulta, análisis e integración, devolución e informe. Se inicia agendando la entrevista inicial.',
   'proceso', null, 550000, array['presencial', 'virtual'], false, 30),
  ('rehabilitacion-cognitiva-sesion', 'Rehabilitación Cognitiva · Sesión',
   'Sesión individual de intervención cognitiva.',
   'individual', 60, 140000, array['presencial', 'virtual'], true, 40),
  ('rehabilitacion-cognitiva-plan-4', 'Rehabilitación Cognitiva · Plan 4',
   '4 sesiones individuales ($130.000 por sesión).',
   'paquete', null, 520000, array['presencial', 'virtual'], false, 50),
  ('rehabilitacion-cognitiva-plan-8', 'Rehabilitación Cognitiva · Plan 8',
   '8 sesiones individuales ($125.000 por sesión).',
   'paquete', null, 1000000, array['presencial', 'virtual'], false, 60),
  ('terapia-contemplativa-individual', 'Terapia Contemplativa Individual',
   'Sesión individual con prácticas contemplativas. 50–60 min aprox.',
   'individual', 60, 140000, array['presencial', 'virtual'], true, 70),
  ('orientacion-vocacional-integral', 'Orientación Vocacional Integral',
   'Entrevista, instrumentos, análisis y sesión de devolución y orientación.',
   'proceso', null, 440000, array['presencial', 'virtual'], false, 80),
  ('sesiones-grupales', 'Sesiones Grupales',
   'Encuentros, talleres o experiencias grupales. Contenido y duración según la temática. Desde $60.000 por persona.',
   'grupal', null, 60000, array['presencial', 'virtual'], false, 90)
on conflict (slug) do nothing;

-- Auditoría: creación, cambios de precio o anticipo, y activación/desactivación.
create or replace function public.servicios_auditar()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
begin
  if tg_op = 'INSERT' then
    perform public.registrar_evento_interno(
      v_actor, 'servicio.creado', 'servicios', new.id, null,
      jsonb_build_object('slug', new.slug, 'precio_cop', new.precio_cop, 'anticipo_pct', new.anticipo_pct)
    );
    return null;
  end if;

  if new.precio_cop is distinct from old.precio_cop
     or new.anticipo_pct is distinct from old.anticipo_pct then
    perform public.registrar_evento_interno(
      v_actor, 'servicio.precio_cambiado', 'servicios', new.id, null,
      jsonb_build_object(
        'slug', new.slug,
        'precio_antes', old.precio_cop, 'precio_despues', new.precio_cop,
        'anticipo_pct_antes', old.anticipo_pct, 'anticipo_pct_despues', new.anticipo_pct
      )
    );
  end if;

  if new.activo is distinct from old.activo then
    perform public.registrar_evento_interno(
      v_actor,
      case when new.activo then 'servicio.activado' else 'servicio.desactivado' end,
      'servicios', new.id, null,
      jsonb_build_object('slug', new.slug)
    );
  end if;

  return null;
end;
$$;

revoke execute on function public.servicios_auditar() from public, anon, authenticated;

create trigger servicios_auditoria
  after insert or update on public.servicios
  for each row execute function public.servicios_auditar();
