-- Pruebas del Bloque 1.7: pagos, comprobantes, verificación, efectivo y devoluciones.
begin;
create extension if not exists pgtap with schema extensions;
select plan(38);

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
  ('20000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', 'A', 'A', 'CC', '6100001', date '1990-01-01'),
  ('20000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000b', 'B', 'B', 'CC', '6100002', date '1991-01-01');

-- Crea una cita de $150.000 (anticipo $75.000) con la profesional D, a `h` horas de ahora.
create function pg_temp.mk(p_id text, h numeric, p_estado text default 'confirmada', p_mod text default 'presencial')
returns void language sql as $$
  insert into public.citas (id, persona_id, servicio_id, profesional_id, inicio, fin, bloqueo_hasta, modalidad, estado, precio_cop, anticipo_cop, saldo_cop, expira_cupo_at)
  values (('30000000-0000-0000-0000-0000000000' || p_id)::uuid, '20000000-0000-0000-0000-00000000000a', (select id from public.servicios limit 1),
    '10000000-0000-0000-0000-00000000000d',
    now() + make_interval(secs => h * 3600), now() + make_interval(secs => h * 3600 + 3600), now() + make_interval(secs => h * 3600 + 4500),
    p_mod, p_estado, 150000, 75000, 75000,
    case when p_estado = 'pendiente_pago' then now() + interval '12 hours' end);
$$;

-- c01: pendiente presencial con su anticipo; c02: confirmada virtual con saldo pendiente
select pg_temp.mk('01', 100, 'pendiente_pago');
insert into public.pagos (id, cita_id, concepto, monto_cop, medio) values
  ('40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'anticipo', 75000, 'transferencia');
select pg_temp.mk('02', 110, 'confirmada', 'virtual');
insert into public.pagos (id, cita_id, concepto, monto_cop, estado) values
  ('40000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000002', 'saldo', 75000, 'pendiente');

-- Reglas del efectivo
select throws_ok(
  $$insert into public.pagos (cita_id, concepto, monto_cop, medio) values ('30000000-0000-0000-0000-000000000001', 'otro', 1000, 'efectivo')$$,
  '22023', null, 'el efectivo no sirve para el anticipo ni para otros conceptos');
select throws_ok(
  $$update public.pagos set medio = 'efectivo' where id = '40000000-0000-0000-0000-000000000002'$$,
  '22023', null, 'el efectivo no sirve en una cita virtual, ni siquiera para el saldo');

-- Consultante A sube el comprobante
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select throws_ok(
  $$select public.registrar_comprobante('40000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-00000000000b/x.png', 'image/png', 1000)$$,
  '22023', null, 'no se acepta un archivo de la carpeta de otra persona');
select lives_ok(
  $$select public.registrar_comprobante('40000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-00000000000a/c1.png', 'image/png', 12345, 'REF-123')$$,
  'A sube el comprobante de su anticipo');
select is((select estado from public.pagos where id = '40000000-0000-0000-0000-000000000001'), 'comprobante_recibido', 'el pago pasa a comprobante_recibido');
select is((select estado from public.citas where id = '30000000-0000-0000-0000-000000000001'), 'pendiente_pago', 'la cita sigue pendiente hasta que se verifique');
select throws_ok(
  $$select public.verificar_pago('40000000-0000-0000-0000-000000000001')$$,
  '42501', null, 'la consultante no verifica su propio pago');
select is((select count(*)::int from public.pagos), 2, 'A ve los pagos de sus citas');
select is((select count(*)::int from public.comprobantes_pago), 1, 'y sus comprobantes');
select throws_ok(
  $$insert into public.pagos (cita_id, concepto, monto_cop) values ('30000000-0000-0000-0000-000000000001', 'otro', 1)$$,
  '42501', null, 'nadie crea pagos directamente desde la API');

-- Consultante B no ve nada ni puede subir comprobantes ajenos
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select is((select count(*)::int from public.pagos), 0, 'B no ve pagos de A');
select throws_ok(
  $$select public.registrar_comprobante('40000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-00000000000a/x.png', 'image/png', 1000)$$,
  '42501', null, 'B no sube comprobantes a pagos de A');

-- Otra profesional no verifica pagos de D
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000e","role":"authenticated"}', true);
select throws_ok(
  $$select public.verificar_pago('40000000-0000-0000-0000-000000000001')$$,
  '42501', null, 'E no verifica pagos de las citas de D');

-- D rechaza y A sube otro comprobante
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select throws_ok(
  $$select public.rechazar_pago('40000000-0000-0000-0000-000000000001', 'porque si')$$,
  '22023', null, 'el rechazo exige un motivo predefinido');
select lives_ok(
  $$select public.rechazar_pago('40000000-0000-0000-0000-000000000001', 'comprobante_ilegible')$$,
  'D rechaza el comprobante ilegible');
select is((select estado from public.pagos where id = '40000000-0000-0000-0000-000000000001'), 'rechazado', 'el pago queda rechazado');
select is((select estado from public.citas where id = '30000000-0000-0000-0000-000000000001'), 'pendiente_pago', 'y la cita sigue pendiente mientras el cupo esté vigente');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select lives_ok(
  $$select public.registrar_comprobante('40000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-00000000000a/c2.png', 'image/png', 20000)$$,
  'A sube otro comprobante tras el rechazo');
select is((select count(*)::int from public.comprobantes_pago), 2, 'quedan los dos intentos');

-- D verifica: la cita se confirma y aparece el saldo
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select lives_ok(
  $$select public.verificar_pago('40000000-0000-0000-0000-000000000001')$$,
  'D verifica el anticipo');
select is((select estado from public.citas where id = '30000000-0000-0000-0000-000000000001'), 'confirmada', 'la cita queda confirmada solo al verificar el anticipo');
select is((select monto_cop || '/' || estado from public.pagos where cita_id = '30000000-0000-0000-0000-000000000001' and concepto = 'saldo'), '75000/pendiente', 'se crea el saldo pendiente para el día de la cita');
select throws_ok(
  $$select public.verificar_pago('40000000-0000-0000-0000-000000000001')$$,
  '22023', null, 'un pago no se verifica dos veces');

-- Saldo el día de la cita
select lives_ok(
  $$select public.registrar_pago_saldo('30000000-0000-0000-0000-000000000001', 'efectivo')$$,
  'el saldo de una cita presencial se puede cobrar en efectivo');
select is((select estado from public.pagos where cita_id = '30000000-0000-0000-0000-000000000001' and concepto = 'saldo'), 'pagado_en_consulta', 'queda como pagado_en_consulta');
select throws_ok(
  $$select public.registrar_pago_saldo('30000000-0000-0000-0000-000000000002', 'efectivo')$$,
  '22023', null, 'en una cita virtual el saldo no se cobra en efectivo');

-- Cupo vencido: no se aceptan comprobantes y el cron expira el pago
reset role;
select pg_temp.mk('03', 120, 'pendiente_pago');
insert into public.pagos (id, cita_id, concepto, monto_cop, medio) values
  ('40000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000003', 'anticipo', 75000, 'nequi');
update public.citas set expira_cupo_at = now() - interval '1 minute' where id = '30000000-0000-0000-0000-000000000003';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select throws_ok(
  $$select public.registrar_comprobante('40000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-00000000000a/c3.png', 'image/png', 1000)$$,
  '22023', null, 'con el cupo vencido ya no se sube comprobante');
reset role;
select is(public.expirar_cupos_vencidos(), 1, 'el cron cancela la cita con cupo vencido');
select is((select estado from public.pagos where id = '40000000-0000-0000-0000-000000000003'), 'expirado', 'y su pago queda expirado');

-- Cancelar una cita confirmada aplica la política
select pg_temp.mk('04', 30);    -- 30 h: sin costo
select pg_temp.mk('05', 12);    -- 12 h: intermedio
select pg_temp.mk('06', 2);     -- 2 h: tardío
select pg_temp.mk('07', 6);     -- la cancela la profesional
select pg_temp.mk('08', -5);    -- inasistencia
insert into public.pagos (cita_id, concepto, monto_cop, medio, estado)
select id, 'anticipo', 75000, 'transferencia', 'verificado' from public.citas where id::text like '30000000-0000-0000-0000-0000000000%' and id in (
  '30000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000005', '30000000-0000-0000-0000-000000000006',
  '30000000-0000-0000-0000-000000000007', '30000000-0000-0000-0000-000000000008');
insert into public.pagos (cita_id, concepto, monto_cop, estado)
select id, 'saldo', 75000, 'pendiente' from public.citas where id in (
  '30000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000005', '30000000-0000-0000-0000-000000000006',
  '30000000-0000-0000-0000-000000000007', '30000000-0000-0000-0000-000000000008');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select public.cambiar_estado_cita('30000000-0000-0000-0000-000000000004', 'cancelada');
select public.cambiar_estado_cita('30000000-0000-0000-0000-000000000005', 'cancelada');
select public.cambiar_estado_cita('30000000-0000-0000-0000-000000000006', 'cancelada');
select is((select monto_cop::text from public.devoluciones where cita_id = '30000000-0000-0000-0000-000000000004'), '75000', 'con 30 h de antelación se devuelve el anticipo completo');
select is((select count(*)::int from public.devoluciones where cita_id in ('30000000-0000-0000-0000-000000000005', '30000000-0000-0000-0000-000000000006')), 0, 'entre 24 y 4 h, o con menos de 4 h, no hay devolución');
select is((select estado from public.pagos where cita_id = '30000000-0000-0000-0000-000000000005' and concepto = 'saldo'), 'expirado', 'en el tramo intermedio el saldo ya no se cobra');
select is((select estado || '/' || monto_cop from public.pagos where cita_id = '30000000-0000-0000-0000-000000000006' and concepto = 'saldo'), 'pendiente/75000', 'con menos de 4 h se retiene el anticipo y se cobra el saldo');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select public.cambiar_estado_cita('30000000-0000-0000-0000-000000000007', 'cancelada', 'Imprevisto');
select public.cambiar_estado_cita('30000000-0000-0000-0000-000000000008', 'inasistencia');
select is((select monto_cop::text from public.devoluciones where cita_id = '30000000-0000-0000-0000-000000000007'), '75000', 'si cancela la profesional, se devuelve el anticipo completo');
select is((select count(*)::int from public.devoluciones where cita_id = '30000000-0000-0000-0000-000000000008'), 0, 'en una inasistencia no se devuelve nada');

-- Devoluciones
select lives_ok(
  $$select public.marcar_devolucion_realizada((select id from public.devoluciones where cita_id = '30000000-0000-0000-0000-000000000007'), 'transferencia', 'DEV-1')$$,
  'D marca la devolución como realizada');
select is((select estado from public.pagos where cita_id = '30000000-0000-0000-0000-000000000007' and concepto = 'anticipo'), 'reembolsado', 'y el anticipo queda reembolsado');

-- Auditoría
reset role;
select is((select count(*)::int from public.auditoria where accion in ('pago.verificado', 'pago.rechazado', 'comprobante.recibido', 'devolucion.realizada')), 5, 'verificaciones, rechazos, comprobantes y devoluciones quedan en auditoría');

select * from finish();
rollback;
