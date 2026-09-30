-- Pruebas del Bloque 1.2: disponibilidad semanal, bloqueos y ocupación.
begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@example.com', '{}', now(), now()),
  ('00000000-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'd@example.com', '{}', now(), now()),
  ('00000000-0000-0000-0000-00000000000e', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'e@example.com', '{}', now(), now()),
  ('00000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c@example.com', '{}', now(), now());
insert into public.usuarios_roles (usuario_id, rol) values
  ('00000000-0000-0000-0000-00000000000d', 'profesional'),
  ('00000000-0000-0000-0000-00000000000e', 'profesional'),
  ('00000000-0000-0000-0000-00000000000c', 'administrador');
insert into public.profesionales (id, usuario_id, nombre_publico) values
  ('10000000-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-00000000000d', 'Dra. D'),
  ('10000000-0000-0000-0000-00000000000e', '00000000-0000-0000-0000-00000000000e', 'Dra. E');
insert into public.disponibilidad_semanal (profesional_id, dia_semana, hora_inicio, hora_fin) values
  ('10000000-0000-0000-0000-00000000000d', 1, '08:00', '12:00');
insert into public.bloqueos (profesional_id, inicio, fin, motivo) values
  ('10000000-0000-0000-0000-00000000000e', now() + interval '1 day', now() + interval '2 days', 'Cita médica privada');

-- Visitante sin sesión
set local role anon;
select throws_ok($$select * from public.disponibilidad_semanal$$, '42501', null, 'el visitante no lee la disponibilidad');
select throws_ok(
  $$select * from public.ocupacion_profesional('10000000-0000-0000-0000-00000000000e', now(), now() + interval '7 days')$$,
  '42501', null, 'el visitante no consulta la ocupación');

-- Consultante A
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select is((select count(*)::int from public.disponibilidad_semanal), 1, 'el consultante ve las franjas para poder agendar');
select throws_ok(
  $$insert into public.disponibilidad_semanal (profesional_id, dia_semana, hora_inicio, hora_fin) values ('10000000-0000-0000-0000-00000000000d', 2, '08:00', '09:00')$$,
  '42501', null, 'el consultante no crea franjas');
select is((select count(*)::int from public.bloqueos), 0, 'el consultante no lee los bloqueos (ni su motivo)');
select is(
  (select count(*)::int from public.ocupacion_profesional('10000000-0000-0000-0000-00000000000e', now(), now() + interval '7 days')),
  1, 'pero sí conoce el rango ocupado, sin motivo');
select throws_ok(
  $$select * from public.ocupacion_profesional('10000000-0000-0000-0000-00000000000e', now(), now() + interval '200 days')$$,
  '22023', null, 'no se puede pedir la ocupación de más de 90 días');

-- Profesional D
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select lives_ok(
  $$insert into public.disponibilidad_semanal (profesional_id, dia_semana, hora_inicio, hora_fin) values ('10000000-0000-0000-0000-00000000000d', 1, '12:00', '14:00')$$,
  'D crea una franja contigua a otra');
select throws_ok(
  $$insert into public.disponibilidad_semanal (profesional_id, dia_semana, hora_inicio, hora_fin) values ('10000000-0000-0000-0000-00000000000d', 1, '11:00', '13:00')$$,
  '23P01', null, 'D no crea franjas que se cruzan el mismo día');
select throws_ok(
  $$insert into public.disponibilidad_semanal (profesional_id, dia_semana, hora_inicio, hora_fin) values ('10000000-0000-0000-0000-00000000000e', 2, '08:00', '09:00')$$,
  '42501', null, 'D no crea franjas para E');
select throws_ok(
  $$insert into public.disponibilidad_semanal (profesional_id, dia_semana, hora_inicio, hora_fin) values ('10000000-0000-0000-0000-00000000000d', 3, '10:00', '09:00')$$,
  '23514', null, 'la hora de fin debe ser posterior a la de inicio');
select throws_ok(
  $$insert into public.disponibilidad_semanal (profesional_id, dia_semana, hora_inicio, hora_fin) values ('10000000-0000-0000-0000-00000000000d', 7, '08:00', '09:00')$$,
  '23514', null, 'el día de la semana va de 0 a 6');
select is((select count(*)::int from public.bloqueos), 0, 'D no ve los bloqueos de E');
select lives_ok(
  $$insert into public.bloqueos (profesional_id, inicio, fin, motivo) values ('10000000-0000-0000-0000-00000000000d', now(), now() + interval '1 day', 'Vacaciones')$$,
  'D crea un bloqueo propio');
select throws_ok(
  $$insert into public.bloqueos (profesional_id, inicio, fin) values ('10000000-0000-0000-0000-00000000000d', now() + interval '1 day', now())$$,
  '23514', null, 'un bloqueo no puede terminar antes de empezar');
delete from public.bloqueos where profesional_id = '10000000-0000-0000-0000-00000000000e';
select is((select count(*)::int from public.bloqueos), 1, 'D no borra bloqueos ajenos');

-- Administrador C
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select lives_ok(
  $$insert into public.disponibilidad_semanal (profesional_id, dia_semana, hora_inicio, hora_fin) values ('10000000-0000-0000-0000-00000000000e', 2, '08:00', '09:00')$$,
  'el administrador crea franjas para cualquier profesional');

select * from finish();
rollback;
