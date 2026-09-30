-- Pruebas del Bloque 1.3: citas, estados, anti doble reserva, permisos y vencimiento de cupo.
begin;
create extension if not exists pgtap with schema extensions;
select plan(32);

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@example.com', '{}', now(), now()),
  ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@example.com', '{}', now(), now()),
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
insert into public.personas (id, usuario_id, nombres, apellidos, tipo_documento, numero_documento, fecha_nacimiento) values
  ('20000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', 'A', 'A', 'CC', '8000001', date '1990-01-01'),
  ('20000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000b', 'B', 'B', 'CC', '8000002', date '1991-01-01');

-- Base de tiempo: dentro de 3 días a las 10:00 (UTC). Descanso de 15 minutos.
create temp table t as select date_trunc('day', now()) + interval '3 days 10 hours' as base;
grant select on t to authenticated;

-- c1: D con A, pendiente, 10:00–11:00 (bloquea hasta 11:15)
insert into public.citas (id, persona_id, servicio_id, profesional_id, inicio, fin, bloqueo_hasta, modalidad, precio_cop, anticipo_cop, saldo_cop, expira_cupo_at)
select '30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-00000000000a',
  (select id from public.servicios where slug = 'atencion-psicologica-individual'),
  '10000000-0000-0000-0000-00000000000d', base, base + interval '1 hour', base + interval '75 minutes',
  'presencial', 150000, 75000, 75000, now() + interval '12 hours'
from t;

select is((select estado from public.citas where id = '30000000-0000-0000-0000-000000000001'), 'pendiente_pago', 'una cita nueva nace en pendiente_pago');

-- Anti doble reserva
select throws_ok(
  $$insert into public.citas (persona_id, servicio_id, profesional_id, inicio, fin, bloqueo_hasta, modalidad, precio_cop, anticipo_cop, saldo_cop)
    select '20000000-0000-0000-0000-00000000000b', (select id from public.servicios limit 1), '10000000-0000-0000-0000-00000000000d',
      base, base + interval '1 hour', base + interval '75 minutes', 'virtual', 100, 50, 50 from t$$,
  '23P01', null, 'no se puede reservar el mismo horario dos veces');
select throws_ok(
  $$insert into public.citas (persona_id, servicio_id, profesional_id, inicio, fin, bloqueo_hasta, modalidad, precio_cop, anticipo_cop, saldo_cop)
    select '20000000-0000-0000-0000-00000000000b', (select id from public.servicios limit 1), '10000000-0000-0000-0000-00000000000d',
      base + interval '70 minutes', base + interval '130 minutes', base + interval '145 minutes', 'virtual', 100, 50, 50 from t$$,
  '23P01', null, 'el descanso también bloquea: no se agenda a los 10 min de terminar otra cita');
select lives_ok(
  $$insert into public.citas (id, persona_id, servicio_id, profesional_id, inicio, fin, bloqueo_hasta, modalidad, estado, precio_cop, anticipo_cop, saldo_cop)
    select '30000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-00000000000b', (select id from public.servicios limit 1), '10000000-0000-0000-0000-00000000000d',
      base + interval '75 minutes', base + interval '135 minutes', base + interval '150 minutes', 'virtual', 'confirmada', 100, 50, 50 from t$$,
  'sí se agenda justo cuando termina el descanso');
select lives_ok(
  $$insert into public.citas (persona_id, servicio_id, profesional_id, inicio, fin, bloqueo_hasta, modalidad, precio_cop, anticipo_cop, saldo_cop)
    select '20000000-0000-0000-0000-00000000000b', (select id from public.servicios limit 1), '10000000-0000-0000-0000-00000000000e',
      base, base + interval '1 hour', base + interval '75 minutes', 'virtual', 100, 50, 50 from t$$,
  'otra profesional puede atender a la misma hora');

-- Restricciones de datos
select throws_ok(
  $$insert into public.citas (persona_id, servicio_id, profesional_id, inicio, fin, bloqueo_hasta, modalidad, precio_cop, anticipo_cop, saldo_cop)
    select '20000000-0000-0000-0000-00000000000b', (select id from public.servicios limit 1), '10000000-0000-0000-0000-00000000000e',
      base + interval '5 days', base + interval '5 days 1 hour', base + interval '5 days 1 hour', 'virtual', 100, 50, 40 from t$$,
  '23514', null, 'anticipo + saldo deben sumar el precio');
select throws_ok(
  $$insert into public.citas (persona_id, servicio_id, profesional_id, inicio, fin, bloqueo_hasta, modalidad, precio_cop, anticipo_cop, saldo_cop)
    select '20000000-0000-0000-0000-00000000000b', (select id from public.servicios limit 1), '10000000-0000-0000-0000-00000000000e',
      base + interval '5 days', base + interval '5 days 1 hour', base + interval '5 days 30 minutes', 'virtual', 100, 50, 50 from t$$,
  '23514', null, 'el bloqueo no puede terminar antes que la cita');
select throws_ok(
  $$insert into public.citas (persona_id, servicio_id, profesional_id, inicio, fin, bloqueo_hasta, modalidad, estado, precio_cop, anticipo_cop, saldo_cop, expira_cupo_at)
    select '20000000-0000-0000-0000-00000000000b', (select id from public.servicios limit 1), '10000000-0000-0000-0000-00000000000e',
      base + interval '5 days', base + interval '5 days 1 hour', base + interval '5 days 75 minutes', 'virtual', 'confirmada', 100, 50, 50, now() from t$$,
  '23514', null, 'solo una cita pendiente tiene límite de cupo');

-- Trigger de transiciones y datos congelados
select throws_ok(
  $$update public.citas set precio_cop = 1, anticipo_cop = 1, saldo_cop = 0 where id = '30000000-0000-0000-0000-000000000001'$$,
  '22023', null, 'el precio copiado a la cita no se modifica');
select throws_ok(
  $$update public.citas set estado = 'completada' where id = '30000000-0000-0000-0000-000000000001'$$,
  '22023', null, 'no se salta de pendiente_pago a completada');
select lives_ok(
  $$update public.citas set estado = 'confirmada', expira_cupo_at = null where id = '30000000-0000-0000-0000-000000000001'$$,
  'pendiente_pago → confirmada es válido (lo dispara la verificación del anticipo)');
select throws_ok(
  $$update public.citas set estado = 'pendiente_pago' where id = '30000000-0000-0000-0000-000000000001'$$,
  '22023', null, 'una cita confirmada no vuelve a pendiente');

-- Una cita de la profesional D ya ocurrida (confirmada) y otra pendiente con el cupo vencido
insert into public.citas (id, persona_id, servicio_id, profesional_id, inicio, fin, bloqueo_hasta, modalidad, estado, precio_cop, anticipo_cop, saldo_cop)
values ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-00000000000b', (select id from public.servicios limit 1),
  '10000000-0000-0000-0000-00000000000d', now() - interval '3 hours', now() - interval '2 hours', now() - interval '105 minutes',
  'presencial', 'confirmada', 100, 50, 50);
insert into public.citas (id, persona_id, servicio_id, profesional_id, inicio, fin, bloqueo_hasta, modalidad, precio_cop, anticipo_cop, saldo_cop, expira_cupo_at)
select '30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-00000000000a', (select id from public.servicios limit 1),
  '10000000-0000-0000-0000-00000000000d', base + interval '7 days', base + interval '7 days 1 hour', base + interval '7 days 75 minutes',
  'virtual', 100, 50, 50, now() - interval '1 minute'
from t;

-- Consultante A (dueña de la persona A)
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select is((select count(*)::int from public.citas), 2, 'A ve solo las citas de su persona (c1 y c3), no las de B');
select throws_ok(
  $$update public.citas set motivo_cancelacion = 'x' where id = '30000000-0000-0000-0000-000000000001'$$,
  '42501', null, 'A no modifica citas directamente');
select throws_ok(
  $$insert into public.citas (persona_id, servicio_id, profesional_id, inicio, fin, bloqueo_hasta, modalidad, precio_cop, anticipo_cop, saldo_cop)
    select '20000000-0000-0000-0000-00000000000a', (select id from public.servicios limit 1), '10000000-0000-0000-0000-00000000000e',
      base + interval '9 days', base + interval '9 days 1 hour', base + interval '9 days 75 minutes', 'virtual', 1, 0, 1 from t$$,
  '42501', null, 'A no crea citas directamente (solo por la reserva)');
select throws_ok(
  $$select public.cambiar_estado_cita('30000000-0000-0000-0000-000000000004', 'cancelada')$$,
  '42501', null, 'A no cancela la cita de B');
select throws_ok(
  $$select public.cambiar_estado_cita('30000000-0000-0000-0000-000000000001', 'confirmada')$$,
  '22023', null, 'A no se confirma su propia cita');
select throws_ok(
  $$select public.cambiar_estado_cita('30000000-0000-0000-0000-000000000001', 'completada')$$,
  '42501', null, 'A no cierra su propia cita: solo la profesional');
select lives_ok(
  $$select public.cambiar_estado_cita('30000000-0000-0000-0000-000000000003', 'cancelada', 'Ya no puedo ir')$$,
  'A cancela su cita pendiente');
select is(
  (select cancelada_por from public.citas where id = '30000000-0000-0000-0000-000000000003'),
  '00000000-0000-0000-0000-00000000000a'::uuid, 'queda registrado quién canceló');
select throws_ok(
  $$select public.cambiar_estado_cita('30000000-0000-0000-0000-000000000003', 'cancelada')$$,
  '22023', null, 'una cita cancelada no se cancela otra vez');
select throws_ok(
  $$select public.expirar_cupos_vencidos()$$,
  '42501', null, 'la limpieza de cupos no es invocable desde la API');

-- Profesional E (otra profesional) y D
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000e","role":"authenticated"}', true);
select throws_ok(
  $$select public.cambiar_estado_cita('30000000-0000-0000-0000-000000000002', 'completada')$$,
  '42501', null, 'E no cierra las citas de D');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select throws_ok(
  $$select public.cambiar_estado_cita('30000000-0000-0000-0000-000000000004', 'completada')$$,
  '22023', null, 'D no cierra una cita que aún no ocurrió');
select lives_ok(
  $$select public.cambiar_estado_cita('30000000-0000-0000-0000-000000000002', 'completada')$$,
  'D cierra una cita ya ocurrida como completada');

-- Administrador
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select lives_ok(
  $$select public.cambiar_estado_cita('30000000-0000-0000-0000-000000000004', 'cancelada', 'Ajuste de agenda')$$,
  'el administrador cancela cualquier cita');

-- Un horario cancelado se libera
reset role;
select lives_ok(
  $$insert into public.citas (persona_id, servicio_id, profesional_id, inicio, fin, bloqueo_hasta, modalidad, precio_cop, anticipo_cop, saldo_cop)
    select '20000000-0000-0000-0000-00000000000b', (select id from public.servicios limit 1), '10000000-0000-0000-0000-00000000000d',
      base + interval '75 minutes', base + interval '135 minutes', base + interval '150 minutes', 'virtual', 100, 50, 50 from t$$,
  'al cancelar una cita, su horario queda libre para otra reserva');

-- Vencimiento de cupo
insert into public.citas (id, persona_id, servicio_id, profesional_id, inicio, fin, bloqueo_hasta, modalidad, precio_cop, anticipo_cop, saldo_cop, expira_cupo_at)
select '30000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-00000000000a', (select id from public.servicios limit 1),
  '10000000-0000-0000-0000-00000000000e', base + interval '8 days', base + interval '8 days 1 hour', base + interval '8 days 75 minutes',
  'virtual', 100, 50, 50, now() - interval '1 minute'
from t;
select is(public.expirar_cupos_vencidos(), 1, 'el cron cancela las citas pendientes con el cupo vencido');
select is(
  (select estado || '/' || motivo_cancelacion from public.citas where id = '30000000-0000-0000-0000-000000000005'),
  'cancelada/cupo_vencido', 'con el motivo cupo_vencido');
select is(public.expirar_cupos_vencidos(), 0, 'y no toca las que siguen vigentes');

-- Auditoría de los cambios de estado
select is(
  (select count(*)::int from public.auditoria where entidad = 'citas' and accion = 'cita.cancelada'),
  3, 'las cancelaciones (A, administrador y cron) quedan en auditoría');
select is(
  (select actor_id from public.auditoria where accion = 'cita.completada'),
  '00000000-0000-0000-0000-00000000000d'::uuid, 'y quién completó la cita');

select * from finish();
rollback;
