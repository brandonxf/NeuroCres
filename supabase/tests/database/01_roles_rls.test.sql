-- Pruebas de permisos (Bloques 0.2 y 0.3). Se ejecutan con: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

-- Tres cuentas: A y B consultantes, C administrador.
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@example.com', '{"nombres":" Ana ","apellidos":"A"}', now(), now()),
  ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@example.com', '{"nombres":"Beto","apellidos":"B"}', now(), now()),
  ('00000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c@example.com', '{"nombres":"Cira","apellidos":"C"}', now(), now());
insert into public.usuarios_roles (usuario_id, rol) values ('00000000-0000-0000-0000-00000000000c', 'administrador');

-- Trigger de registro
select is((select nombres from public.usuarios where id = '00000000-0000-0000-0000-00000000000a'), 'Ana', 'el trigger crea el usuario y recorta espacios');
select is((select count(*)::int from public.usuarios_roles where usuario_id = '00000000-0000-0000-0000-00000000000a'), 1, 'todo registro nace con un rol');
select is((select rol from public.usuarios_roles where usuario_id = '00000000-0000-0000-0000-00000000000a'), 'consultante', 'el rol inicial es consultante');

-- Como A
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

select is((select count(*)::int from public.usuarios), 1, 'A solo ve su propio usuario');
select is((select count(*)::int from public.usuarios where id = '00000000-0000-0000-0000-00000000000b'), 0, 'A no ve a B');
select is((select count(*)::int from public.usuarios_roles), 1, 'A solo ve sus propios roles');
select ok(public.tiene_rol('consultante'), 'tiene_rol: A es consultante');
select ok(not public.tiene_rol('administrador'), 'tiene_rol: A no es administrador');

select throws_ok(
  $$insert into public.usuarios_roles (usuario_id, rol) values ('00000000-0000-0000-0000-00000000000a', 'administrador')$$,
  '42501', null, 'A no puede darse el rol de administrador');

select throws_ok(
  $$update public.usuarios set correo = 'otro@example.com' where id = '00000000-0000-0000-0000-00000000000a'$$,
  '42501', null, 'A no puede cambiar su correo');

update public.usuarios set nombres = 'Modificado' where id = '00000000-0000-0000-0000-00000000000b';
select is((select nombres from public.usuarios where id = '00000000-0000-0000-0000-00000000000a'), 'Ana', 'A no altera datos de B (sin error, 0 filas)');

update public.usuarios set telefono = '3000000000' where id = '00000000-0000-0000-0000-00000000000a';
select is((select telefono from public.usuarios where id = '00000000-0000-0000-0000-00000000000a'), '3000000000', 'A sí edita su teléfono');

-- Como C (administrador)
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select is((select count(*)::int from public.usuarios), 3, 'el administrador ve las cuentas de todos');
select is((select nombres from public.usuarios where id = '00000000-0000-0000-0000-00000000000b'), 'Beto', 'B no fue alterado por A');

-- Como anónimo
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok($$select count(*) from public.usuarios$$, '42501', null, 'anon no puede leer usuarios');
select throws_ok($$select public.tiene_rol('administrador')$$, '42501', null, 'anon no puede ejecutar tiene_rol');

select * from finish();
rollback;
