/** Intentos antes de dar un correo por fallido. */
export const MAX_INTENTOS = 5;

/** Espera antes de reintentar tras el intento número `intentos`: 10, 20, 40… minutos. */
export const esperaMinutos = (intentos: number) =>
  10 * 2 ** Math.max(0, intentos - 1);
