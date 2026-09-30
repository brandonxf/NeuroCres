-- Pruebas del Bloque 1.4: reservar y reprogramar citas, con todas las validaciones en la base.
begin;
create extension if not exists pgtap with schema extensions;
select plan(30);

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@example.com', '{}', now(), now()),
  ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@example.com', '{}', now(), now()),
  ('00000000-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'd@example.com', '{}', now(), now());
insert into public.usuarios_roles (usuario_id, rol) values ('00000000-0000-0000-0000-00000000000d', 'profesional');
insert into public.profesionales (id, usuario_id, nombre_publico) values
  ('10000000-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-00000000000d', 'Dra. D');
insert into public.personas (id, usuario_id, nombres, apellidos, tipo_documento, numero_documento, fecha_nacimiento) values
  ('20000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', 'A', 'A', 'CC', '5100001', date '1990-01-01'),
  ('20000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000b', 'B', 'B', 'CC', '5100002', date '1991-01-01'),
  ('20000000-0000-0000-0000-0000000000f1', null, 'Menor', 'Diez', 'RC', '5100003', (now() - interval '10 years 1 month')::date);
insert into public.responsables_legales (persona_id, responsable_usuario_id, parentesco) values
  ('20000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-00000000000a', 'madre');

-- Horarios de prueba: dentro de 8 días (mismo día de la semana), franja 08:00–12:00 hora de Bogotá.
create temp table t as
  select ((now() at time zone 'America/Bogota')::date + 8) as d,
         (select id from public.servicios where slug = 'atencion-psicologica-individual') as srv,
         (select id from public.servicios where slug = 'valoracion-neuropsicologica-integral') as srv_no,
         (select id from public.politicas_versionadas where activa) as pol;
create temp table r (n integer, id uuid);
grant select on t to authenticated;
grant all on r to authenticated;
create function pg_temp.slot(dias integer, hora time) returns timestamptz language sql as $$
  select ((select d from t) + dias + hora) at time zone 'America/Bogota'
$$;
grant execute on function pg_temp.slot(integer, time) to authenticated;

insert into public.disponibilidad_semanal (profesional_id, dia_semana, hora_inicio, hora_fin)
select '10000000-0000-0000-0000-00000000000d', extract(dow from d)::integer, '08:00', '12:00' from t;

-- Sin consentimientos firmados no se puede agendar
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select throws_ok(
  $$select public.reservar_cita((select srv from t), '20000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-00000000000d', pg_temp.slot(0, '10:00'), 'presencial', (select pol from t), 'nequi')$$,
  '22023', null, 'sin consentimiento vigente no se puede agendar');

-- Se firman los consentimientos de A y B
reset role;
insert into public.consentimientos_firmados (plantilla_id, persona_id, firmante_usuario_id, firmante_nombre, firmante_documento, calidad, hash_contenido)
select p.id, x.persona, x.usuario, 'Firmante', 'CC 5100000', 'titular', repeat('a', 64)
from public.plantillas_consentimiento p
cross join (values
  ('20000000-0000-0000-0000-00000000000a'::uuid, '00000000-0000-0000-0000-00000000000a'::uuid),
  ('20000000-0000-0000-0000-00000000000b'::uuid, '00000000-0000-0000-0000-00000000000b'::uuid)) as x(persona, usuario)
where p.activa and p.tipo in ('consentimiento_informado', 'tratamiento_datos');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select throws_ok(
  $$select public.reservar_cita((select srv from t), '20000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-00000000000d', pg_temp.slot(0, '10:00'), 'presencial', gen_random_uuid(), 'nequi')$$,
  '22023', null, 'la política aceptada debe ser la vigente');
select throws_ok(
  $$select public.reservar_cita((select srv from t), '20000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-00000000000d', pg_temp.slot(0, '10:00'), 'presencial', (select pol from t), 'efectivo')$$,
  '22023', null, 'el anticipo no se paga en efectivo');
select throws_ok(
  $$select public.reservar_cita((select srv from t), '20000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-00000000000d', pg_temp.slot(0, '10:00'), 'presencial', (select pol from t), 'nequi')$$,
  '22023', null, 'un medio de pago apagado no se puede elegir');

reset role;
update public.configuracion_pagos set activo = true where medio = 'nequi';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

select throws_ok(
  $$select public.reservar_cita((select srv from t), '20000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-00000000000d', pg_temp.slot(0, '15:00'), 'presencial', (select pol from t), 'nequi')$$,
  '23P01', null, 'no se agenda fuera de las franjas de atención');
select throws_ok(
  $$select public.reservar_cita((select srv from t), '20000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-00000000000d', pg_temp.slot(0, '10:10'), 'presencial', (select pol from t), 'nequi')$$,
  '23P01', null, 'el horario debe estar alineado a la granularidad');
select throws_ok(
  $$select public.reservar_cita((select srv from t), '20000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-00000000000d', now() + interval '1 hour', 'presencial', (select pol from t), 'nequi')$$,
  '23P01', null, 'no se agenda dentro de la antelación mínima');
select throws_ok(
  $$select public.reservar_cita((select srv_no from t), '20000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-00000000000d', pg_temp.slot(0, '10:00'), 'presencial', (select pol from t), 'nequi')$$,
  '22023', null, 'un servicio que no es agendable en línea no se reserva');
select throws_ok(
  $$select public.reservar_cita((select srv from t), '20000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-00000000000d', pg_temp.slot(0, '10:00'), 'domicilio', (select pol from t), 'nequi')$$,
  '22023', null, 'la modalidad debe ser una que admita el servicio');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select throws_ok(
  $$select public.reservar_cita((select srv from t), '20000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-00000000000d', pg_temp.slot(0, '10:00'), 'presencial', (select pol from t), 'nequi')$$,
  '42501', null, 'B no reserva por una persona que no es suya');

-- Reserva de A
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select lives_ok(
  $$insert into r select 1, public.reservar_cita((select srv from t), '20000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-00000000000d', pg_temp.slot(0, '10:00'), 'presencial', (select pol from t), 'nequi')$$,
  'A reserva una cita');
select is(
  (select estado || '|' || precio_cop || '|' || anticipo_cop || '|' || saldo_cop from public.citas where id = (select id from r where n = 1)),
  'pendiente_pago|150000|75000|75000', 'la cita nace pendiente de pago, con el precio y el anticipo copiados');
select is(
  (select monto_cop || '|' || medio || '|' || estado from public.pagos where cita_id = (select id from r where n = 1) and concepto = 'anticipo'),
  '75000|nequi|pendiente', 'se crea el pago del anticipo pendiente');
select ok(
  (select expira_cupo_at between now() + interval '11 hours 59 minutes' and now() + interval '12 hours 1 minute' from public.citas where id = (select id from r where n = 1)),
  'el cupo se retiene 12 horas');
select is(
  (select politica_aceptada_id from public.citas where id = (select id from r where n = 1)),
  (select pol from t), 'queda guardada la versión de la política aceptada');

-- El mismo horario ya no se puede reservar
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select throws_ok(
  $$select public.reservar_cita((select srv from t), '20000000-0000-0000-0000-00000000000b', '10000000-0000-0000-0000-00000000000d', pg_temp.slot(0, '10:00'), 'presencial', (select pol from t), 'nequi')$$,
  '23P01', null, 'un horario ya reservado no se puede reservar de nuevo');

-- Menores: solo su responsable, y con sus 3 textos firmados
select throws_ok(
  $$select public.reservar_cita((select srv from t), '20000000-0000-0000-0000-0000000000f1', '10000000-0000-0000-0000-00000000000d', pg_temp.slot(0, '09:00'), 'presencial', (select pol from t), 'nequi')$$,
  '42501', null, 'quien no es responsable del menor no reserva por él');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select throws_ok(
  $$select public.reservar_cita((select srv from t), '20000000-0000-0000-0000-0000000000f1', '10000000-0000-0000-0000-00000000000d', pg_temp.slot(0, '09:00'), 'presencial', (select pol from t), 'nequi')$$,
  '22023', null, 'el responsable no reserva por un menor sin los consentimientos firmados');

-- Confirmar el anticipo (comprobante + verificación) para poder reprogramar
select lives_ok(
  $$select public.registrar_comprobante((select id from public.pagos where cita_id = (select id from r where n = 1) and concepto = 'anticipo'), '20000000-0000-0000-0000-00000000000a/c.png', 'image/png', 1000)$$,
  'A sube el comprobante');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select lives_ok(
  $$select public.verificar_pago((select id from public.pagos where cita_id = (select id from r where n = 1) and concepto = 'anticipo'))$$,
  'D verifica el anticipo');

-- Reprogramar con más de 24 horas: sin costo, el anticipo pasa a la nueva cita
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select lives_ok(
  $$insert into r select 2, public.reprogramar_cita((select id from r where n = 1), pg_temp.slot(7, '10:30'))$$,
  'A reprograma con antelación');
select is((select estado from public.citas where id = (select id from r where n = 1)), 'reprogramada', 'la cita anterior queda reprogramada');
select is(
  (select estado || '|' || (reprogramada_de = (select id from r where n = 1))::text from public.citas where id = (select id from r where n = 2)),
  'confirmada|true', 'la cita nueva queda confirmada y enlazada a la anterior');
select is(
  (select string_agg(concepto || ':' || estado || ':' || monto_cop, ',' order by concepto) from public.pagos where cita_id = (select id from r where n = 2)),
  'anticipo:verificado:75000,saldo:pendiente:75000', 'el anticipo verificado se traslada y queda el saldo pendiente');
select throws_ok(
  $$select public.reprogramar_cita((select id from r where n = 2), pg_temp.slot(7, '15:00'))$$,
  '23P01', null, 'no se reprograma a un horario que no está disponible');
select is((select estado from public.citas where id = (select id from r where n = 2)), 'confirmada', 'y la cita sigue confirmada tras el intento fallido');

-- Con menos de 4 horas ya no se reprograma
reset role;
insert into public.citas (id, persona_id, servicio_id, profesional_id, inicio, fin, bloqueo_hasta, modalidad, estado, precio_cop, anticipo_cop, saldo_cop)
select '30000000-0000-0000-0000-0000000000a1', '20000000-0000-0000-0000-00000000000a', srv, '10000000-0000-0000-0000-00000000000d',
  now() + interval '2 hours', now() + interval '3 hours', now() + interval '3 hours 15 minutes', 'presencial', 'confirmada', 150000, 75000, 75000
from t;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select throws_ok(
  $$select public.reprogramar_cita('30000000-0000-0000-0000-0000000000a1', pg_temp.slot(14, '10:00'))$$,
  '22023', null, 'con menos de 4 horas no se puede reprogramar');

-- Entre 24 y 4 horas: la primera reprogramación es gratuita
reset role;
insert into public.citas (id, persona_id, servicio_id, profesional_id, inicio, fin, bloqueo_hasta, modalidad, estado, precio_cop, anticipo_cop, saldo_cop)
select '30000000-0000-0000-0000-0000000000a2', '20000000-0000-0000-0000-00000000000a', srv, '10000000-0000-0000-0000-00000000000d',
  now() + interval '12 hours', now() + interval '13 hours', now() + interval '13 hours 15 minutes', 'presencial', 'confirmada', 150000, 75000, 75000
from t;
insert into public.pagos (cita_id, concepto, monto_cop, medio, estado)
values ('30000000-0000-0000-0000-0000000000a2', 'anticipo', 75000, 'nequi', 'verificado');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select lives_ok(
  $$insert into r select 3, public.reprogramar_cita('30000000-0000-0000-0000-0000000000a2', pg_temp.slot(14, '10:00'))$$,
  'A usa su reprogramación gratuita a menos de 24 horas');
select ok((select reprogramacion_gratuita from public.citas where id = (select id from r where n = 3)), 'la cita nueva queda marcada como reprogramación gratuita');

-- Auditoría
reset role;
select is((select count(*)::int from public.auditoria where accion = 'cita.reprogramada' and metadata ? 'nueva_cita_id'), 2, 'las reprogramaciones quedan en auditoría, con el enlace a la cita nueva');

select * from finish();
rollback;
