-- Pruebas del Bloque 0.6: auditoría de solo inserción y almacenamiento privado.
begin;
create extension if not exists pgtap with schema extensions;
select plan(21);

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@example.com', '{}', now(), now()),
  ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@example.com', '{}', now(), now()),
  ('00000000-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'd@example.com', '{}', now(), now()),
  ('00000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c@example.com', '{}', now(), now());
insert into public.usuarios_roles (usuario_id, rol) values
  ('00000000-0000-0000-0000-00000000000d', 'profesional'),
  ('00000000-0000-0000-0000-00000000000c', 'administrador');
insert into public.personas (id, usuario_id, nombres, apellidos, tipo_documento, numero_documento, fecha_nacimiento) values
  ('20000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', 'A', 'A', 'CC', '7000001', date '1990-01-01'),
  ('20000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000b', 'B', 'B', 'CC', '7000002', date '1991-01-01');

-- Configuración de los buckets
select is((select count(*)::int from storage.buckets where id in ('comprobantes','consentimientos','documentos') and public = false), 3, 'los 3 buckets son privados');
select is((select min(file_size_limit)::int from storage.buckets where id in ('comprobantes','consentimientos','documentos')), 5242880, 'límite de 5 MB');
select is((select allowed_mime_types from storage.buckets where id = 'comprobantes'), array['image/jpeg','image/png','application/pdf'], 'solo JPG, PNG y PDF');

-- Como A
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

select lives_ok(
  $$select public.registrar_evento('comprobante.subido', 'comprobante', null, '20000000-0000-0000-0000-00000000000a', '{"bytes": 1000}', '190.1.2.3', 'test')$$,
  'A registra un evento sobre su persona');
select throws_ok(
  $$select public.registrar_evento('comprobante.subido', 'comprobante', null, '20000000-0000-0000-0000-00000000000b')$$,
  '42501', null, 'A no registra eventos sobre la persona de B');
select throws_ok(
  $$select public.registrar_evento('pago.verificado', 'pago', null, '20000000-0000-0000-0000-00000000000a')$$,
  '22023', null, 'A no puede inventar acciones (pago.verificado es solo del sistema)');
select throws_ok(
  $$select public.registrar_evento_interno(null, 'pago.verificado', 'pago')$$,
  '42501', null, 'la función interna no es invocable desde la API');
select throws_ok($$insert into public.auditoria (accion, entidad) values ('x.y', 'z')$$, '42501', null, 'A no inserta directo en auditoría');
select throws_ok($$update public.auditoria set accion = 'otra.cosa'$$, '42501', null, 'A no modifica auditoría');
select throws_ok($$delete from public.auditoria$$, '42501', null, 'A no borra auditoría');
select is((select actor_id from public.auditoria limit 1), '00000000-0000-0000-0000-00000000000a'::uuid, 'el actor es quien llama');
select is((select ip::text from public.auditoria limit 1), '190.1.2.3/32', 'se guarda la IP');

-- Almacenamiento como A
select lives_ok(
  $$insert into storage.objects (bucket_id, name, owner_id) values ('comprobantes', '20000000-0000-0000-0000-00000000000a/pago.png', '00000000-0000-0000-0000-00000000000a')$$,
  'A sube un comprobante a la carpeta de su persona');
select throws_ok(
  $$insert into storage.objects (bucket_id, name, owner_id) values ('comprobantes', '20000000-0000-0000-0000-00000000000b/pago.png', '00000000-0000-0000-0000-00000000000a')$$,
  '42501', null, 'A no sube a la carpeta de otra persona');
select throws_ok(
  $$insert into storage.objects (bucket_id, name, owner_id) values ('documentos', '20000000-0000-0000-0000-00000000000a/informe.pdf', '00000000-0000-0000-0000-00000000000a')$$,
  '42501', null, 'A no sube informes');

-- Como B
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select is((select count(*)::int from public.auditoria), 0, 'B no ve la auditoría de A');
select is((select count(*)::int from storage.objects where bucket_id = 'comprobantes'), 0, 'B no ve los comprobantes de A');

-- Como la profesional
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select is((select count(*)::int from storage.objects where bucket_id = 'comprobantes'), 1, 'la profesional ve el comprobante');
select lives_ok(
  $$insert into storage.objects (bucket_id, name, owner_id) values ('documentos', '20000000-0000-0000-0000-00000000000a/informe.pdf', '00000000-0000-0000-0000-00000000000d')$$,
  'la profesional sube un informe');

-- Como administrador
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select is((select count(*)::int from public.auditoria), 1, 'el administrador ve la auditoría');

-- Como anónimo
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select count(*)::int from storage.objects), 0, 'anon no ve archivos');

select * from finish();
rollback;
