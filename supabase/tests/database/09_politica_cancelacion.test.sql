-- Pruebas del Bloque 1.6: consecuencias de cancelar o reprogramar según la política.
-- Referencia: cita de $150.000 con anticipo verificado de $75.000.
begin;
create extension if not exists pgtap with schema extensions;
select plan(29);

-- Resume la consecuencia como 'tramo|permitida|retener|devolver|trasladar|cobrar'.
create function pg_temp.c(
  horas numeric, precio bigint, pagado bigint, quien text, accion text, gratis integer,
  reglas jsonb default '{}', confirmada boolean default true
) returns text language sql as $$
  select concat_ws('|', tramo, case when permitida then 't' else 'f' end,
    retener_cop, devolver_cop, trasladar_cop, cobrar_cop)
  from public.consecuencia_politica(
    timestamptz '2026-12-01 12:00+00' + make_interval(secs => horas * 3600), precio, pagado,
    timestamptz '2026-12-01 12:00+00', quien, accion, gratis, reglas, confirmada);
$$;

-- Con 24 h o más: sin costo
select is(pg_temp.c(48, 150000, 75000, 'consultante', 'cancelar', 0),    'sin_costo|t|0|75000|0|0',   '48 h antes, cancelar: se devuelve el anticipo');
select is(pg_temp.c(48, 150000, 75000, 'consultante', 'reprogramar', 0), 'sin_costo|t|0|0|75000|0',   '48 h antes, reprogramar: el anticipo pasa a la nueva fecha');
select is(pg_temp.c(24, 150000, 75000, 'consultante', 'cancelar', 0),    'sin_costo|t|0|75000|0|0',   'justo 24 h antes todavía es sin costo');

-- Entre 24 h y 4 h: intermedio
select is(pg_temp.c(23.98, 150000, 75000, 'consultante', 'cancelar', 0), 'intermedio|t|75000|0|0|0',   'apenas menos de 24 h, cancelar: se retiene el 50% de la sesión');
select is(pg_temp.c(12, 150000, 75000, 'consultante', 'reprogramar', 0), 'intermedio|t|0|0|75000|0',   'entre 24 y 4 h, primera reprogramación: gratis');
select is(pg_temp.c(12, 150000, 75000, 'consultante', 'reprogramar', 1), 'intermedio|t|75000|0|0|0',   'entre 24 y 4 h, segunda reprogramación: se cobra el 50%');
select is(pg_temp.c(4, 150000, 75000, 'consultante', 'cancelar', 0),     'intermedio|t|75000|0|0|0',   'justo 4 h antes sigue siendo intermedio');
select is(pg_temp.c(12, 140000, 70000, 'consultante', 'cancelar', 0),    'intermedio|t|70000|0|0|0',   'sesión de $140.000: retiene $70.000');
select is(pg_temp.c(12, 100001, 50001, 'consultante', 'cancelar', 0),    'intermedio|t|50001|0|0|0',   'el cargo se redondea hacia arriba al peso');
select is(pg_temp.c(12, 150000, 30000, 'consultante', 'cancelar', 0),    'intermedio|t|30000|0|0|45000', 'si el anticipo no alcanza, queda por cobrar la diferencia');

-- Menos de 4 h o inasistencia: tardío
select is(pg_temp.c(3.99, 150000, 75000, 'consultante', 'cancelar', 0),  'tardio|t|75000|0|0|75000',  'menos de 4 h, cancelar: se cobra la sesión completa');
select is(pg_temp.c(1, 150000, 75000, 'consultante', 'reprogramar', 0),  'tardio|f|0|0|0|0',          'menos de 4 h no se puede reprogramar');
select is(pg_temp.c(-1, 150000, 75000, 'consultante', 'inasistencia', 0), 'tardio|t|75000|0|0|75000', 'inasistencia: se cobra completa');
select is(pg_temp.c(2, 150000, 75000, 'consultante', 'inasistencia', 0), 'tardio|t|75000|0|0|75000',  'inasistencia registrada antes de la hora también');

-- La profesional cancela o reprograma
select is(pg_temp.c(1, 150000, 75000, 'profesional', 'cancelar', 0),     'profesional|t|0|75000|0|0',  'cancela la profesional: devolución total');
select is(pg_temp.c(1, 150000, 75000, 'profesional', 'reprogramar', 0),  'profesional|t|0|0|75000|0',  'reprograma la profesional: el anticipo se traslada');

-- Cita sin anticipo verificado: no hay nada que retener
select is(pg_temp.c(1, 150000, 0, 'consultante', 'cancelar', 0, '{}', false), 'sin_costo|t|0|0|0|0',   'una cita sin confirmar se cancela sin cargo');

-- Los umbrales son configurables, no están escritos en el código
select is(pg_temp.c(30, 150000, 75000, 'consultante', 'cancelar', 0, '{"horas_sin_costo": 48}'), 'intermedio|t|75000|0|0|0', 'con umbral de 48 h, a 30 h ya se cobra');
select is(pg_temp.c(12, 150000, 75000, 'consultante', 'cancelar', 0, '{"porcentaje_cobro_intermedio": 30}'), 'intermedio|t|45000|30000|0|0', 'con cobro del 30%: retiene $45.000 y devuelve $30.000');

-- Publicación de una versión nueva
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@example.com', '{}', now(), now()),
  ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@example.com', '{}', now(), now()),
  ('00000000-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'd@example.com', '{}', now(), now()),
  ('00000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c@example.com', '{}', now(), now());
insert into public.usuarios_roles (usuario_id, rol) values
  ('00000000-0000-0000-0000-00000000000d', 'profesional'),
  ('00000000-0000-0000-0000-00000000000c', 'administrador');
insert into public.profesionales (id, usuario_id, nombre_publico) values
  ('10000000-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-00000000000d', 'Dra. D');
insert into public.personas (id, usuario_id, nombres, apellidos, tipo_documento, numero_documento, fecha_nacimiento) values
  ('20000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', 'A', 'A', 'CC', '7100001', date '1990-01-01');

select is((select count(*)::int from public.politicas_versionadas where activa), 1, 'hay una política vigente');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select throws_ok(
  $$select public.publicar_politica('Texto', '{"horas_sin_costo": 24, "horas_minimo": 4, "porcentaje_cobro_intermedio": 50, "porcentaje_cobro_tardio": 100}')$$,
  '42501', null, 'una consultante no publica la política');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select throws_ok(
  $$select public.publicar_politica('Texto', '{"horas_sin_costo": 2, "horas_minimo": 4, "porcentaje_cobro_intermedio": 50, "porcentaje_cobro_tardio": 100}')$$,
  '22023', null, 'el administrador no puede publicar umbrales incoherentes');
select lives_ok(
  $$select public.publicar_politica('Política v2', '{"horas_sin_costo": 48, "horas_minimo": 6, "porcentaje_cobro_intermedio": 50, "porcentaje_cobro_tardio": 100, "reprogramaciones_gratis": 1}')$$,
  'el administrador publica una versión nueva');
select is((select version from public.politicas_versionadas where activa), 2, 'la versión 2 queda vigente');

-- Consecuencia para una cita concreta (con la política vigente, v2: 48 h / 6 h)
reset role;
insert into public.citas (id, persona_id, servicio_id, profesional_id, inicio, fin, bloqueo_hasta, modalidad, estado, precio_cop, anticipo_cop, saldo_cop)
values ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-00000000000a', (select id from public.servicios limit 1),
  '10000000-0000-0000-0000-00000000000d', now() + interval '30 hours', now() + interval '31 hours', now() + interval '31 hours 15 minutes',
  'presencial', 'confirmada', 150000, 75000, 75000);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select is(
  (select tramo || '|' || retener_cop from public.calcular_consecuencia('30000000-0000-0000-0000-000000000001', 'cancelar')),
  'intermedio|75000', 'la consultante ve la consecuencia con la política vigente (a 30 h, con umbral de 48 h)');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select is(
  (select tramo from public.calcular_consecuencia('30000000-0000-0000-0000-000000000001', 'cancelar')),
  'profesional', 'si cancela la profesional, la consecuencia es a su favor');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select throws_ok(
  $$select * from public.calcular_consecuencia('30000000-0000-0000-0000-000000000001', 'cancelar')$$,
  '42501', null, 'otra cuenta no consulta la consecuencia de una cita ajena');

-- Cadena de reprogramaciones: la cita nacida de una reprogramación gratuita ya consumió la gratuita
reset role;
insert into public.citas (id, persona_id, servicio_id, profesional_id, inicio, fin, bloqueo_hasta, modalidad, estado, precio_cop, anticipo_cop, saldo_cop, reprogramada_de, reprogramacion_gratuita)
values ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-00000000000a', (select id from public.servicios limit 1),
  '10000000-0000-0000-0000-00000000000d', now() + interval '80 hours', now() + interval '81 hours', now() + interval '81 hours 15 minutes',
  'presencial', 'confirmada', 150000, 75000, 75000, '30000000-0000-0000-0000-000000000001', true);
insert into public.citas (id, persona_id, servicio_id, profesional_id, inicio, fin, bloqueo_hasta, modalidad, estado, precio_cop, anticipo_cop, saldo_cop)
values ('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-00000000000a', (select id from public.servicios limit 1),
  '10000000-0000-0000-0000-00000000000d', now() + interval '90 hours', now() + interval '91 hours', now() + interval '91 hours 15 minutes',
  'presencial', 'confirmada', 150000, 75000, 75000);

update public.politicas_versionadas set activa = false where activa;
update public.politicas_versionadas set activa = true where version = 1;
-- Con la política v1 (24 h), acercar ambas citas (12 h y 20 h) para caer en el tramo intermedio.
alter table public.citas disable trigger citas_validar_cambio;
update public.citas set inicio = now() + interval '12 hours', fin = now() + interval '13 hours', bloqueo_hasta = now() + interval '13 hours 15 minutes'
  where id = '30000000-0000-0000-0000-000000000002';
update public.citas set inicio = now() + interval '20 hours', fin = now() + interval '21 hours', bloqueo_hasta = now() + interval '21 hours 15 minutes'
  where id = '30000000-0000-0000-0000-000000000003';
alter table public.citas enable trigger citas_validar_cambio;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select is(
  (select tramo || '|' || retener_cop || '|' || trasladar_cop from public.calcular_consecuencia('30000000-0000-0000-0000-000000000003', 'reprogramar')),
  'intermedio|0|75000', 'una cita sin reprogramaciones previas tiene la gratuita disponible');
select is(
  (select tramo || '|' || retener_cop || '|' || trasladar_cop from public.calcular_consecuencia('30000000-0000-0000-0000-000000000002', 'reprogramar')),
  'intermedio|75000|0', 'una cita nacida de una reprogramación gratuita ya la consumió');

select * from finish();
rollback;
