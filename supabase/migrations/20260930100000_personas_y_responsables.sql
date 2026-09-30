-- Bloque 0.4: personas atendidas (adultos y menores) y sus responsables legales.

create table public.personas (
  id uuid primary key default gen_random_uuid(),
  -- Cuenta que gestiona a la persona. Nulo si es un menor sin cuenta propia.
  usuario_id uuid references public.usuarios (id) on delete restrict,
  nombres text not null,
  apellidos text not null,
  tipo_documento text not null check (tipo_documento in ('CC', 'TI', 'RC', 'CE', 'PA')),
  numero_documento text not null check (numero_documento ~ '^[A-Za-z0-9]{4,20}$'),
  fecha_nacimiento date not null check (fecha_nacimiento <= current_date and fecha_nacimiento > date '1900-01-01'),
  telefono text,
  correo text,
  datos_escolares jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Un documento identifica a una sola persona activa; una cuenta tiene una sola persona propia.
create unique index personas_documento_unico
  on public.personas (tipo_documento, upper(numero_documento)) where deleted_at is null;
create unique index personas_usuario_unico
  on public.personas (usuario_id) where usuario_id is not null and deleted_at is null;

create trigger personas_set_updated_at
  before update on public.personas
  for each row execute function public.set_updated_at();

create table public.responsables_legales (
  persona_id uuid not null references public.personas (id) on delete cascade,
  responsable_usuario_id uuid not null references public.usuarios (id) on delete restrict,
  parentesco text not null check (parentesco in ('padre', 'madre', 'tutor', 'otro')),
  es_principal boolean not null default true,
  -- Documento que acredita la representación (almacenamiento privado, Bloque 0.6).
  soporte_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (persona_id, responsable_usuario_id)
);

create trigger responsables_legales_set_updated_at
  before update on public.responsables_legales
  for each row execute function public.set_updated_at();

alter table public.personas enable row level security;
alter table public.responsables_legales enable row level security;

-- ¿El usuario en sesión es la cuenta de la persona o uno de sus responsables legales?
create or replace function public.es_dueno_de_persona(p_persona_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.personas p
    where p.id = p_persona_id and p.usuario_id = (select auth.uid())
  ) or exists (
    select 1 from public.responsables_legales r
    where r.persona_id = p_persona_id and r.responsable_usuario_id = (select auth.uid())
  );
$$;

revoke execute on function public.es_dueno_de_persona(uuid) from public, anon;
grant execute on function public.es_dueno_de_persona(uuid) to authenticated;

-- personas
create policy personas_select on public.personas
  for select to authenticated
  using (
    public.es_dueno_de_persona(id)
    or public.tiene_rol('profesional')  -- refinar en Fase 1: solo consultantes con cita
  );

-- Alta directa solo para la persona propia y mayor de edad. Las personas a cargo
-- se crean con crear_persona_a_cargo(), que también registra al responsable.
create policy personas_insert_propia on public.personas
  for insert to authenticated
  with check (
    usuario_id = (select auth.uid())
    and fecha_nacimiento <= current_date - interval '18 years'
  );

create policy personas_update on public.personas
  for update to authenticated
  using (public.es_dueno_de_persona(id))
  with check (public.es_dueno_de_persona(id));

revoke update on public.personas from authenticated;
grant update (
  nombres, apellidos, tipo_documento, numero_documento, fecha_nacimiento,
  telefono, correo, datos_escolares, deleted_at
) on public.personas to authenticated;

-- responsables_legales
create policy responsables_select on public.responsables_legales
  for select to authenticated
  using (
    responsable_usuario_id = (select auth.uid())
    or public.es_dueno_de_persona(persona_id)
    or public.tiene_rol('profesional')
  );

create policy responsables_update_propio on public.responsables_legales
  for update to authenticated
  using (responsable_usuario_id = (select auth.uid()))
  with check (responsable_usuario_id = (select auth.uid()));

create policy responsables_insert_admin on public.responsables_legales
  for insert to authenticated
  with check (public.tiene_rol('administrador'));

revoke update on public.responsables_legales from authenticated;
grant update (parentesco, es_principal, soporte_path) on public.responsables_legales to authenticated;

-- Crea una persona a cargo y deja a quien la registra como su responsable legal, en una sola transacción.
create or replace function public.crear_persona_a_cargo(
  p_nombres text,
  p_apellidos text,
  p_tipo_documento text,
  p_numero_documento text,
  p_fecha_nacimiento date,
  p_parentesco text,
  p_telefono text default null,
  p_correo text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'Sesión requerida' using errcode = '42501';
  end if;

  insert into public.personas (nombres, apellidos, tipo_documento, numero_documento, fecha_nacimiento, telefono, correo)
  values (
    trim(p_nombres), trim(p_apellidos), p_tipo_documento, trim(p_numero_documento), p_fecha_nacimiento,
    nullif(trim(p_telefono), ''),
    -- En menores, el contacto es el del responsable.
    coalesce(nullif(trim(p_correo), ''), (select u.correo from public.usuarios u where u.id = v_uid))
  )
  returning id into v_id;

  insert into public.responsables_legales (persona_id, responsable_usuario_id, parentesco)
  values (v_id, v_uid, p_parentesco);

  return v_id;
end;
$$;

revoke execute on function public.crear_persona_a_cargo(text, text, text, text, date, text, text, text) from public, anon;
grant execute on function public.crear_persona_a_cargo(text, text, text, text, date, text, text, text) to authenticated;

revoke all on public.personas from anon;
revoke all on public.responsables_legales from anon;
