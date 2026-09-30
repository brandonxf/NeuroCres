-- Bloque 1.8: cada 5 minutos la base de datos invoca a la aplicación para enviar la cola de
-- correos. La URL y el secreto compartido viven en el Vault de Supabase (no en el repositorio):
--   select vault.create_secret('https://<dominio>', 'app_url');
--   select vault.create_secret('<secreto>', 'cron_secret');   -- el mismo valor que CRON_SECRET en Vercel

create extension if not exists pg_net;

create or replace function public.invocar_envio_de_notificaciones()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_secreto text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'app_url';
  select decrypted_secret into v_secreto from vault.decrypted_secrets where name = 'cron_secret';
  if v_url is null or v_secreto is null then
    return;  -- sin configurar: no hace nada
  end if;

  perform net.http_get(
    url := rtrim(v_url, '/') || '/api/cron/notificaciones',
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_secreto),
    timeout_milliseconds := 20000
  );
end;
$$;

revoke execute on function public.invocar_envio_de_notificaciones() from public, anon, authenticated;

select cron.schedule(
  'enviar-notificaciones',
  '*/5 * * * *',
  $$select public.invocar_envio_de_notificaciones()$$
);
