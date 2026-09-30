-- Pruebas de permisos del Bloque 0.4 (personas y responsables legales).
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@example.com', '{"nombres":"Ana","apellidos":"A"}', now(), now()),
  ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@example.com', '{"nombres":"Beto","apellidos":"B"}', now(), now()),
  ('00000000-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'd@example.com', '{"nombres":"Dora","apellidos":"D"}', now(), now());
insert into public.usuarios_roles (usuario_id, rol) values ('00000000-0000-0000-0000-00000000000d', 'profesional');

-- Como A
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

insert into public.personas (usuario_id, nombres, apellidos, tipo_documento, numero_documento, fecha_nacimiento)
values ('00000000-0000-0000-0000-00000000000a', 'Ana', 'A', 'CC', '1000001', date '1990-05-10');
select is((select count(*)::int from public.personas), 1, 'A crea su propia persona');

select throws_ok(
  $$insert into public.personas (usuario_id, nombres, apellidos, tipo_documento, numero_documento, fecha_nacimiento)
    values ('00000000-0000-0000-0000-00000000000b', 'Falso', 'B', 'CC', '1000002', date '1990-01-01')$$,
  '42501', null, 'A no crea personas a nombre de otra cuenta');

select throws_ok(
  $$insert into public.personas (usuario_id, nombres, apellidos, tipo_documento, numero_documento, fecha_nacimiento)
    values ('00000000-0000-0000-0000-00000000000a', 'Menor', 'A', 'TI', '1000003', current_date - interval '10 years')$$,
  '42501', null, 'una cuenta propia no puede ser de un menor');

select lives_ok(
  $$select public.crear_persona_a_cargo('Hijo', 'A', 'TI', '2000001', (current_date - interval '9 years')::date, 'madre')$$,
  'A registra a un menor a cargo');
select is((select count(*)::int from public.personas), 2, 'A ve su persona y la de su hijo');
select is((select count(*)::int from public.responsables_legales), 1, 'A queda como responsable del menor');
select is((select correo from public.personas where numero_documento = '2000001'), 'a@example.com', 'el menor hereda el correo del responsable');
select set_config('test.hijo', (select id::text from public.personas where numero_documento = '2000001'), true);

select throws_ok(
  $$select public.crear_persona_a_cargo('Otro', 'A', 'TI', '2000001', (current_date - interval '8 years')::date, 'madre')$$,
  '23505', null, 'no se repite un documento');

select throws_ok(
  $$update public.personas set usuario_id = '00000000-0000-0000-0000-00000000000b' where numero_documento = '1000001'$$,
  '42501', null, 'A no puede reasignar la cuenta de una persona');

-- Como B
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select is((select count(*)::int from public.personas), 0, 'B no ve personas de A');
select is((select count(*)::int from public.responsables_legales), 0, 'B no ve responsables de A');
update public.personas set nombres = 'Hackeado' where numero_documento = '2000001';
select is((select count(*)::int from public.personas where nombres = 'Hackeado'), 0, 'B no modifica personas de A');
select throws_ok(
  $$insert into public.responsables_legales (persona_id, responsable_usuario_id, parentesco)
    values (current_setting('test.hijo')::uuid, '00000000-0000-0000-0000-00000000000b', 'tutor')$$,
  '42501', null, 'B no se agrega como responsable de nadie');

-- Como la profesional (D)
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select is((select count(*)::int from public.personas), 2, 'la profesional ve las personas');

-- Como anónimo
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok($$select count(*) from public.personas$$, '42501', null, 'anon no lee personas');
select throws_ok($$select public.crear_persona_a_cargo('X','Y','TI','999999', date '2015-01-01','madre')$$, '42501', null, 'anon no crea personas a cargo');

select * from finish();
rollback;
