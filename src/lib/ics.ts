/** Datos mínimos para un evento de calendario. Sin información clínica ni el motivo de consulta. */
export type EventoCalendario = {
  uid: string;
  titulo: string;
  inicio: Date;
  fin: Date;
  lugar?: string;
  descripcion?: string;
};

/** AAAAMMDDTHHMMSSZ en UTC. */
const fechaIcs = (d: Date) =>
  d
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");

const escapar = (t: string) =>
  t
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\;");

/** Archivo .ics (iCalendar) de un evento, listo para "agregar al calendario". */
export function generarIcs(e: EventoCalendario, ahora = new Date()): string {
  const lineas = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//NeuroCres//Citas//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${e.uid}@neurocres`,
    `DTSTAMP:${fechaIcs(ahora)}`,
    `DTSTART:${fechaIcs(e.inicio)}`,
    `DTEND:${fechaIcs(e.fin)}`,
    `SUMMARY:${escapar(e.titulo)}`,
  ];
  if (e.lugar) lineas.push(`LOCATION:${escapar(e.lugar)}`);
  if (e.descripcion) lineas.push(`DESCRIPTION:${escapar(e.descripcion)}`);
  lineas.push("END:VEVENT", "END:VCALENDAR");
  return lineas.join("\r\n") + "\r\n";
}
