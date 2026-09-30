-- Pruebas del Bloque 1.5: plantillas versionadas y consentimientos firmados inmutables.
begin;
create extension if not exists pgtap with schema extensions;
select plan(23);

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@example.com', '{"nombres":"Ana","apellidos":"A"}', now(), now()),
  ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@example.com', '{"nombres":"Beto","apellidos":"B"}', now(), now()),
  ('00000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c@example.com', '{}', now(), now());
insert into public.usuarios_roles (usuario_id, rol) values
  ('00000000-0000-0000-0000-00000000000c', 'administrador');
-- A: adulta con persona propia. B: adulto que tiene a cargo a un menor de 14 años y a otro de 8.
insert into public.personas (id, usuario_id, nombres, apellidos, tipo_documento, numero_documento, fecha_nacimiento) values
  ('20000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', 'Ana', 'A', 'CC', '9000001', date '1990-01-01'),
  ('20000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000b', 'Beto', 'B', 'CC', '9000002', date '1985-01-01'),
  ('20000000-0000-0000-0000-0000000000b1', null, 'Menor', 'Catorce', 'TI', '9000003', (now() - interval '14 years 1 month')::date),
  ('20000000-0000-0000-0000-0000000000b2', null, 'Menor', 'Ocho', 'RC', '9000004', (now() - interval '8 years 1 month')::date);
insert into public.responsables_legales (persona_id, responsable_usuario_id, parentesco) values
  ('20000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-00000000000b', 'padre'),
  ('20000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-00000000000b', 'padre');

-- Semilla: una plantilla activa por tipo
select is((select count(*)::int from public.plantillas_consentimiento where activa), 3, 'hay una plantilla activa por tipo');

-- Visitante: solo lee las plantillas activas
set local role anon;
select is((select count(*)::int from public.plantillas_consentimiento), 3, 'el visitante lee la autorización de datos desde el registro');
select throws_ok($$select * from public.consentimientos_firmados$$, '42501', null, 'el visitante no lee consentimientos firmados');

-- Adulta A
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select is((select count(*)::int from public.consentimientos_pendientes('20000000-0000-0000-0000-00000000000a')), 2, 'una adulta debe firmar 2 textos (informado y datos)');
select throws_ok(
  $$select * from public.consentimientos_pendientes('20000000-0000-0000-0000-0000000000b1')$$,
  '42501', null, 'A no consulta pendientes de personas ajenas');
select throws_ok(
  $$insert into public.consentimientos_firmados (plantilla_id, persona_id, firmante_usuario_id, firmante_nombre, firmante_documento, calidad, hash_contenido)
    values ((select id from public.plantillas_consentimiento where tipo = 'consentimiento_informado'), '20000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', 'Ana A', '9000001', 'titular', repeat('a', 64))$$,
  '42501', null, 'no se firma insertando directo: solo con firmar_consentimiento');

select lives_ok(
  $$select public.firmar_consentimiento(
      (select id from public.plantillas_consentimiento where tipo = 'consentimiento_informado' and activa),
      '20000000-0000-0000-0000-00000000000a', 'Ana A', 'CC 9000001', false, null, '190.10.10.10', 'test')$$,
  'A firma el consentimiento informado');
select is(
  (select hash_contenido from public.consentimientos_firmados where persona_id = '20000000-0000-0000-0000-00000000000a'),
  encode(extensions.digest(convert_to((select contenido from public.plantillas_consentimiento where tipo = 'consentimiento_informado' and activa), 'UTF8'), 'sha256'), 'hex'),
  'el hash guardado es el SHA-256 del texto exacto de la plantilla');
select is(
  (select calidad from public.consentimientos_firmados where persona_id = '20000000-0000-0000-0000-00000000000a'),
  'titular', 'firma como titular');
select throws_ok(
  $$select public.firmar_consentimiento(
      (select id from public.plantillas_consentimiento where tipo = 'consentimiento_informado' and activa),
      '20000000-0000-0000-0000-00000000000a', 'Ana A', 'CC 9000001')$$,
  '23505', null, 'no se firma dos veces la misma versión');
select throws_ok(
  $$select public.firmar_consentimiento(
      (select id from public.plantillas_consentimiento where tipo = 'menores' and activa),
      '20000000-0000-0000-0000-00000000000a', 'Ana A', 'CC 9000001')$$,
  '22023', null, 'el texto de menores no aplica a una adulta');
select is((select count(*)::int from public.consentimientos_pendientes('20000000-0000-0000-0000-00000000000a')), 1, 'le queda un texto por firmar');

-- Inmutabilidad
select throws_ok(
  $$update public.consentimientos_firmados set firmante_nombre = 'Otra' where persona_id = '20000000-0000-0000-0000-00000000000a'$$,
  '42501', null, 'A no modifica lo firmado (sin permiso de UPDATE)');
reset role;
select throws_ok(
  $$update public.consentimientos_firmados set firmante_nombre = 'Otra' where persona_id = '20000000-0000-0000-0000-00000000000a'$$,
  '22023', null, 'ni siquiera el dueño de la base modifica lo firmado');
select throws_ok(
  $$delete from public.consentimientos_firmados where persona_id = '20000000-0000-0000-0000-00000000000a'$$,
  '22023', null, 'ni lo borra');
select lives_ok(
  $$update public.consentimientos_firmados set constancia_path = '20000000-0000-0000-0000-00000000000a/constancia.pdf' where persona_id = '20000000-0000-0000-0000-00000000000a'$$,
  'única excepción: guardar una vez la ruta de la constancia');
select throws_ok(
  $$update public.consentimientos_firmados set constancia_path = 'otra.pdf' where persona_id = '20000000-0000-0000-0000-00000000000a'$$,
  '22023', null, 'la ruta de la constancia no se cambia una vez guardada');

-- Responsable B con un menor de 14 (edad de asentimiento: 12) y uno de 8
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select is((select count(*)::int from public.consentimientos_pendientes('20000000-0000-0000-0000-0000000000b1')), 3, 'un menor exige 3 textos, incluido el de menores');
select throws_ok(
  $$select public.firmar_consentimiento(
      (select id from public.plantillas_consentimiento where tipo = 'menores' and activa),
      '20000000-0000-0000-0000-0000000000b1', 'Beto B', 'CC 9000002', false)$$,
  '22023', null, 'con un menor de 14 falta su asentimiento');
select lives_ok(
  $$select public.firmar_consentimiento(
      (select id from public.plantillas_consentimiento where tipo = 'menores' and activa),
      '20000000-0000-0000-0000-0000000000b1', 'Beto B', 'CC 9000002', true)$$,
  'con el asentimiento, el responsable firma por su hijo');
select is(
  (select calidad from public.consentimientos_firmados where persona_id = '20000000-0000-0000-0000-0000000000b1'),
  'responsable_legal', 'queda como responsable legal');

-- El administrador publica una nueva versión: la anterior deja de ser la vigente
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select lives_ok(
  $$select public.publicar_plantilla('consentimiento_informado', 'Consentimiento informado', 'Texto nuevo v2')$$,
  'el administrador publica la versión 2');
select is(
  (select version from public.plantillas_consentimiento where tipo = 'consentimiento_informado' and activa),
  2, 'la versión 2 queda activa y la 1 inactiva');

select * from finish();
rollback;
