import { es } from "date-fns/locale";
import { formatInTimeZone } from "date-fns-tz";

const ZONA = "America/Bogota";

/** Fecha de hoy en Colombia, formato AAAA-MM-DD. */
export function hoyBogota(): string {
  return formatInTimeZone(new Date(), ZONA, "yyyy-MM-dd");
}

/** Edad cumplida en años. Ambas fechas en AAAA-MM-DD. */
export function calcularEdad(
  fechaNacimiento: string,
  hoy: string = hoyBogota(),
): number {
  const [an, mn, dn] = fechaNacimiento.split("-").map(Number);
  const [ah, mh, dh] = hoy.split("-").map(Number);
  let edad = ah - an;
  if (mh < mn || (mh === mn && dh < dn)) edad -= 1;
  return edad;
}

export const esMenor = (fechaNacimiento: string, hoy?: string) =>
  calcularEdad(fechaNacimiento, hoy) < 18;

/** Formato legible: 5 de mayo de 2018. */
export function formatearFecha(fecha: string): string {
  return formatInTimeZone(
    new Date(`${fecha}T12:00:00-05:00`),
    ZONA,
    "d 'de' MMMM 'de' yyyy",
    { locale: es },
  );
}
