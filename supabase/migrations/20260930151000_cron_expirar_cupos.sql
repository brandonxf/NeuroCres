-- Bloque 1.3: cada 10 minutos se cancelan las citas pendiente_pago cuyo cupo venció
-- sin anticipo verificado, y el horario queda libre.

create extension if not exists pg_cron;

select cron.schedule(
  'expirar-cupos-vencidos',
  '*/10 * * * *',
  $$select public.expirar_cupos_vencidos()$$
);
