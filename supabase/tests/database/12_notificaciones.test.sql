-- Pruebas del Bloque 1.8: los eventos encolan los avisos correctos, sin información clínica.
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@example.com', '{}', now(), now()),
  ('00000000-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'd@example.com', '{}', now(), now());
insert into public.usuarios_roles (usuario_id, rol) values ('00000000-0000-0000-0000-00000000000d', 'profesional');
insert into public.profesionales (id, usuario_id, nombre_publico) values
  ('10000000-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-00000000000d', 'Dra. D');
insert into public.personas (id, usuario_id, nombres, apellidos, tipo_documento, numero_documento, fecha_nacimiento) values
  ('20000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', 'A', 'A', 'CC', '4100001', date '1990-01-01');

create function pg_temp.n(p_tipo text) returns integer language sql as $$
  select count(*)::int from public.notificaciones where tipo = p_tipo
$$;

-- Reserva pendiente (creada por A): aviso inmediato y aviso de cupo por vencer
insert into public.citas (id, persona_id, servicio_id, profesional_id, inicio, fin, bloqueo_hasta, modalidad, estado, precio_cop, anticipo_cop, saldo_cop, expira_cupo_at, creada_por)
values ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-00000000000a', (select id from public.servicios limit 1),
  '10000000-0000-0000-0000-00000000000d', now() + interval '5 days', now() + interval '5 days 1 hour', now() + interval '5 days 75 minutes',
  'presencial', 'pendiente_pago', 150000, 75000, 75000, now() + interval '12 hours', '00000000-0000-0000-0000-00000000000a');
select is(pg_temp.n('reserva_recibida'), 1, 'al reservar se encola el aviso de reserva recibida');
select is((select programada_para - now() from public.notificaciones where tipo = 'cupo_por_vencer') between interval '10 hours 59 minutes' and interval '11 hours 1 minute', true, 'el aviso de cupo por vencer se programa 1 hora antes del vencimiento');
select is((select usuario_id from public.notificaciones where tipo = 'reserva_recibida'), '00000000-0000-0000-0000-00000000000a'::uuid, 'el aviso va a quien reservó');

-- Comprobante recibido → aviso a la profesional; rechazo → aviso a la persona con el motivo predefinido
insert into public.pagos (id, cita_id, concepto, monto_cop, medio) values
  ('40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'anticipo', 75000, 'nequi');
update public.pagos set estado = 'comprobante_recibido' where id = '40000000-0000-0000-0000-000000000001';
select is((select usuario_id from public.notificaciones where tipo = 'comprobante_recibido'), '00000000-0000-0000-0000-00000000000d'::uuid, 'el comprobante recibido se avisa a la profesional');
update public.pagos set estado = 'rechazado', motivo_rechazo = 'monto_incorrecto' where id = '40000000-0000-0000-0000-000000000001';
select is((select payload ->> 'motivo' from public.notificaciones where tipo = 'pago_rechazado'), 'monto_incorrecto', 'el rechazo se avisa con el motivo predefinido');
update public.pagos set estado = 'comprobante_recibido' where id = '40000000-0000-0000-0000-000000000001';

-- Verificación: la cita se confirma → aviso y recordatorios de 24 h y 2 h
update public.pagos set estado = 'verificado' where id = '40000000-0000-0000-0000-000000000001';
update public.citas set estado = 'confirmada', expira_cupo_at = null where id = '30000000-0000-0000-0000-000000000001';
select is(pg_temp.n('pago_verificado'), 1, 'al confirmarse se avisa que el pago fue verificado');
select is(pg_temp.n('recordatorio_24h') + pg_temp.n('recordatorio_2h'), 2, 'se programan los recordatorios de 24 h y de 2 h');
select is(
  (select programada_para from public.notificaciones where tipo = 'recordatorio_24h'),
  (select inicio - interval '24 hours' from public.citas where id = '30000000-0000-0000-0000-000000000001'),
  'el recordatorio de 24 h sale exactamente 24 h antes de la cita');

-- Cancelación con un motivo escrito: se avisa a ambas partes sin copiar el motivo
update public.citas set estado = 'cancelada', motivo_cancelacion = 'Dato sensible escrito por la persona', cancelada_por = '00000000-0000-0000-0000-00000000000a'
  where id = '30000000-0000-0000-0000-000000000001';
select is(pg_temp.n('cita_cancelada'), 2, 'una cancelación se avisa a la persona y a la profesional');
select is(
  (select count(*)::int from public.notificaciones where payload::text ilike '%sensible%'),
  0, 'el motivo escrito por la persona no viaja en ningún aviso');

-- Cupo vencido: avisa que fue por vencimiento
insert into public.citas (id, persona_id, servicio_id, profesional_id, inicio, fin, bloqueo_hasta, modalidad, estado, precio_cop, anticipo_cop, saldo_cop, expira_cupo_at, creada_por)
values ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-00000000000a', (select id from public.servicios limit 1),
  '10000000-0000-0000-0000-00000000000d', now() + interval '6 days', now() + interval '6 days 1 hour', now() + interval '6 days 75 minutes',
  'virtual', 'pendiente_pago', 150000, 75000, 75000, now() - interval '1 minute', '00000000-0000-0000-0000-00000000000a');
select public.expirar_cupos_vencidos();
select is((select count(*)::int from public.notificaciones where tipo = 'cita_cancelada' and (payload ->> 'por_cupo_vencido')::boolean), 2, 'el vencimiento de cupo se avisa como tal');

-- Nadie lee la cola desde la API
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select throws_ok($$select * from public.notificaciones$$, '42501', null, 'una cuenta no lee la cola de notificaciones');
select throws_ok($$select public.encolar_notificacion('00000000-0000-0000-0000-00000000000a', 'pago_verificado', '{}')$$, '42501', null, 'ni encola avisos por su cuenta');
reset role;

select * from finish();
rollback;
