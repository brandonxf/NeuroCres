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

/** Fecha y hora legibles en hora de Bogotá: "martes 6 de octubre de 2026, 10:00 a. m." */
export function formatearFechaHora(instante: string | Date): string {
  return formatInTimeZone(
    typeof instante === "string" ? new Date(instante) : instante,
    ZONA,
    "EEEE d 'de' MMMM 'de' yyyy, h:mm a",
    { locale: es },
  );
}

/** Solo la hora en Bogotá: "10:00". */
export function formatearHora(instante: string | Date): string {
  return formatInTimeZone(
    typeof instante === "string" ? new Date(instante) : instante,
    ZONA,
    "HH:mm",
  );
}

/** Día AAAA-MM-DD en Bogotá de un instante. */
export function diaBogota(instante: string | Date): string {
  return formatInTimeZone(
    typeof instante === "string" ? new Date(instante) : instante,
    ZONA,
    "yyyy-MM-dd",
  );
}

/** Suma `dias` a una fecha AAAA-MM-DD. */
export function sumarDias(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** Instante actual. Es una función aparte para no llamar a `Date.now()` dentro de un componente. */
export function instanteActual(): Date {
  return new Date();
}
