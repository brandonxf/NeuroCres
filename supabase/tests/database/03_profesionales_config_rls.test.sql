-- Pruebas de permisos del Bloque 0.5 (profesionales y configuración).
begin;
create extension if not exists pgtap with schema extensions;
select plan(15);

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@example.com', '{}', now(), now()),
  ('00000000-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'd@example.com', '{}', now(), now()),
  ('00000000-0000-0000-0000-00000000000e', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'e@example.com', '{}', now(), now()),
  ('00000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c@example.com', '{}', now(), now());
insert into public.usuarios_roles (usuario_id, rol) values
  ('00000000-0000-0000-0000-00000000000d', 'profesional'),
  ('00000000-0000-0000-0000-00000000000e', 'profesional'),
  ('00000000-0000-0000-0000-00000000000c', 'administrador');
insert into public.profesionales (id, usuario_id, nombre_publico, enlace_videollamada) values
  ('10000000-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-00000000000d', 'Dra. D', 'https://meet.example/d'),
  ('10000000-0000-0000-0000-00000000000e', '00000000-0000-0000-0000-00000000000e', 'Dra. E', 'https://meet.example/e');

-- Como A (consultante)
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select is((select count(*)::int from public.profesionales), 2, 'A ve a las profesionales activas');
select throws_ok($$select enlace_videollamada from public.profesionales$$, '42501', null, 'A no lee el enlace de la sala por la tabla');
select is(public.obtener_enlace_videollamada('10000000-0000-0000-0000-00000000000d'), null, 'A no obtiene el enlace por la función');
select throws_ok(
  $$insert into public.profesionales (usuario_id, nombre_publico) values ('00000000-0000-0000-0000-00000000000a', 'Falsa')$$,
  '42501', null, 'A no se crea como profesional');
select is((select valor ->> 'horas' from public.configuracion where clave = 'retencion_cupo'), '12', 'A lee la configuración');
update public.configuracion set valor = '{"horas": 1}' where clave = 'retencion_cupo';
select is((select valor ->> 'horas' from public.configuracion where clave = 'retencion_cupo'), '12', 'A no modifica la configuración');

-- Como D (profesional)
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000d","role":"authenticated"}', true);
update public.profesionales set nombre_publico = 'Dra. Diana' where id = '10000000-0000-0000-0000-00000000000d';
select is((select nombre_publico from public.profesionales where id = '10000000-0000-0000-0000-00000000000d'), 'Dra. Diana', 'D edita su perfil');
update public.profesionales set nombre_publico = 'Hackeada' where id = '10000000-0000-0000-0000-00000000000e';
select is((select nombre_publico from public.profesionales where id = '10000000-0000-0000-0000-00000000000e'), 'Dra. E', 'D no edita el perfil de E');
select is(public.obtener_enlace_videollamada('10000000-0000-0000-0000-00000000000d'), 'https://meet.example/d', 'D obtiene su enlace');
select is(public.obtener_enlace_videollamada('10000000-0000-0000-0000-00000000000e'), null, 'D no obtiene el enlace de E');

-- Como C (administrador)
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
update public.configuracion set valor = '{"horas": 6}' where clave = 'retencion_cupo';
select is((select valor ->> 'horas' from public.configuracion where clave = 'retencion_cupo'), '6', 'C modifica la configuración');
select is(public.obtener_enlace_videollamada('10000000-0000-0000-0000-00000000000e'), 'https://meet.example/e', 'C obtiene cualquier enlace');
update public.profesionales set activo = false where id = '10000000-0000-0000-0000-00000000000e';
select is((select activo from public.profesionales where id = '10000000-0000-0000-0000-00000000000e'), false, 'C desactiva a una profesional');

-- Como anónimo
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok($$select count(*) from public.profesionales$$, '42501', null, 'anon no lee profesionales');
select throws_ok($$select count(*) from public.configuracion$$, '42501', null, 'anon no lee la configuración');

select * from finish();
rollback;
