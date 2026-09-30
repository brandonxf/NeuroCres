-- Pruebas del Bloque 1.1: catálogo de servicios (permisos, restricciones y auditoría).
begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@example.com', '{}', now(), now()),
  ('00000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c@example.com', '{}', now(), now());
insert into public.usuarios_roles (usuario_id, rol) values
  ('00000000-0000-0000-0000-00000000000c', 'administrador');

-- Semilla del plan
select is((select count(*)::int from public.servicios), 9, 'la semilla trae los 9 servicios de la tabla de tarifas');
select is((select precio_cop from public.servicios where slug = 'atencion-psicologica-individual'), 150000::bigint, 'Atención Psicológica cuesta $150.000');
select is((select precio_cop from public.servicios where slug = 'rehabilitacion-cognitiva-plan-8'), 1000000::bigint, 'Plan 8 cuesta $1.000.000');
select is((select count(*)::int from public.servicios where agendable_en_linea), 4, 'solo 4 servicios se agendan en línea en la Fase 1');

-- Visitante sin sesión
set local role anon;
select is((select count(*)::int from public.servicios), 9, 'el visitante ve el catálogo activo');
select throws_ok(
  $$insert into public.servicios (slug, nombre, tipo, precio_cop) values ('x', 'X', 'individual', 1)$$,
  '42501', null, 'el visitante no crea servicios');

-- Consultante
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select throws_ok(
  $$insert into public.servicios (slug, nombre, tipo, precio_cop) values ('x', 'X', 'individual', 1)$$,
  '42501', null, 'el consultante no crea servicios');
update public.servicios set precio_cop = 1 where slug = 'atencion-psicologica-individual';
select is((select precio_cop from public.servicios where slug = 'atencion-psicologica-individual'), 150000::bigint, 'el consultante no cambia precios');

-- Administrador
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select lives_ok(
  $$insert into public.servicios (slug, nombre, tipo, precio_cop) values ('nuevo', 'Nuevo', 'individual', 100000)$$,
  'el administrador crea un servicio');
update public.servicios set precio_cop = 160000 where slug = 'atencion-psicologica-individual';
select is((select precio_cop from public.servicios where slug = 'atencion-psicologica-individual'), 160000::bigint, 'el administrador cambia un precio');
update public.servicios set activo = false where slug = 'terapia-contemplativa-individual';
select throws_ok(
  $$update public.servicios set slug = 'otro' where slug = 'nuevo'$$,
  '42501', null, 'el slug no se edita');
select throws_ok(
  $$delete from public.servicios where slug = 'nuevo'$$,
  '42501', null, 'los servicios no se borran: se desactivan');

-- Restricciones
select throws_ok(
  $$insert into public.servicios (slug, nombre, tipo, precio_cop, requiere_presencial) values ('p', 'P', 'proceso', 1, true)$$,
  '23514', null, 'si requiere presencialidad, no admite modalidad virtual');
select throws_ok(
  $$insert into public.servicios (slug, nombre, tipo, precio_cop, modalidades) values ('m', 'M', 'individual', 1, array['domicilio'])$$,
  '23514', null, 'solo existen las modalidades presencial y virtual');
select throws_ok(
  $$insert into public.servicios (slug, nombre, tipo, precio_cop, anticipo_pct) values ('a', 'A', 'individual', 1, 101)$$,
  '23514', null, 'el anticipo no pasa de 100%');

-- Auditoría de los cambios anteriores
select is(
  (select metadata ->> 'precio_despues' from public.auditoria where accion = 'servicio.precio_cambiado'),
  '160000',
  'el cambio de precio queda en auditoría con el valor nuevo');
select is(
  (select metadata ->> 'precio_antes' from public.auditoria where accion = 'servicio.precio_cambiado'),
  '150000',
  'y con el valor anterior');
select is(
  (select actor_id from public.auditoria where accion = 'servicio.precio_cambiado'),
  '00000000-0000-0000-0000-00000000000c'::uuid,
  'y con quién lo hizo');
select is(
  (select count(*)::int from public.auditoria where accion in ('servicio.creado', 'servicio.desactivado')),
  2,
  'la creación y la desactivación también se registran');

-- Un servicio inactivo deja de verse en el catálogo público
reset role;
set local role anon;
select is((select count(*)::int from public.servicios where slug = 'terapia-contemplativa-individual'), 0, 'el visitante no ve servicios desactivados');

select * from finish();
rollback;
