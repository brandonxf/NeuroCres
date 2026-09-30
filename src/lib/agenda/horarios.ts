import { addMinutes } from "date-fns";
import { fromZonedTime } from "date-fns-tz";

export type ParametrosAgenda = {
  /** Descanso entre citas, en minutos. */
  descansoMin: number;
  /** Antelación mínima para reservar, en horas. */
  antelacionMinHoras: number;
  /** Horizonte máximo para reservar, en días. */
  horizonteDias: number;
  /** Separación entre horarios ofrecidos, en minutos. */
  granularidadMin: number;
};

export const PARAMETROS_AGENDA_POR_DEFECTO: ParametrosAgenda = {
  descansoMin: 15,
  antelacionMinHoras: 12,
  horizonteDias: 60,
  granularidadMin: 30,
};

export type Franja = {
  /** 0 = domingo … 6 = sábado. */
  diaSemana: number;
  /** Hora local de la profesional, "HH:MM" o "HH:MM:SS". */
  horaInicio: string;
  horaFin: string;
  modalidades: string[];
};

/** Rango ocupado: un bloqueo, o una cita desde su inicio hasta `bloqueo_hasta` (con descanso). */
export type Rango = { inicio: Date; fin: Date };

export type Horario = { inicio: Date; fin: Date };

export type EntradaHorarios = {
  /** Día pedido, AAAA-MM-DD, en la zona horaria de la profesional. */
  fecha: string;
  zonaHoraria: string;
  franjas: Franja[];
  ocupados: Rango[];
  duracionMin: number;
  modalidad: string;
  parametros: ParametrosAgenda;
  ahora: Date;
};

const HHMM = /^(\d{2}):(\d{2})/;

function aHoraLocal(hora: string): string {
  const m = HHMM.exec(hora);
  if (!m) throw new Error(`Hora no válida: ${hora}`);
  return `${m[1]}:${m[2]}:00`;
}

/** Día de la semana (0 = domingo) de una fecha AAAA-MM-DD, sin depender de la zona horaria. */
export function diaDeLaSemana(fecha: string): number {
  const [a, m, d] = fecha.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d)).getUTCDay();
}

const seCruzan = (a: Rango, b: Rango) => a.inicio < b.fin && b.inicio < a.fin;

/**
 * Horarios libres de un día para un servicio de `duracionMin`.
 *
 * - Parte de las franjas del día de la semana que admiten la modalidad pedida.
 * - Ofrece horarios cada `granularidadMin` desde el inicio de la franja, solo si la cita
 *   cabe completa dentro de la franja.
 * - Descarta los que, sumando el descanso, se cruzan con un bloqueo o una cita activa.
 * - Respeta la antelación mínima y el horizonte máximo.
 */
export function calcularHorariosLibres(e: EntradaHorarios): Horario[] {
  const { parametros: p } = e;
  const dia = diaDeLaSemana(e.fecha);
  const desde = addMinutes(e.ahora, p.antelacionMinHoras * 60);
  const hasta = addMinutes(e.ahora, p.horizonteDias * 24 * 60);

  const horarios: Horario[] = [];

  for (const franja of e.franjas) {
    if (franja.diaSemana !== dia) continue;
    if (!franja.modalidades.includes(e.modalidad)) continue;

    const inicioFranja = fromZonedTime(
      `${e.fecha}T${aHoraLocal(franja.horaInicio)}`,
      e.zonaHoraria,
    );
    const finFranja = fromZonedTime(
      `${e.fecha}T${aHoraLocal(franja.horaFin)}`,
      e.zonaHoraria,
    );

    for (
      let inicio = inicioFranja;
      addMinutes(inicio, e.duracionMin) <= finFranja;
      inicio = addMinutes(inicio, p.granularidadMin)
    ) {
      if (inicio < desde || inicio > hasta) continue;

      const fin = addMinutes(inicio, e.duracionMin);
      // Lo que ocuparía en la agenda: la cita más su descanso.
      const bloqueo: Rango = {
        inicio,
        fin: addMinutes(fin, p.descansoMin),
      };
      if (e.ocupados.some((o) => seCruzan(bloqueo, o))) continue;

      horarios.push({ inicio, fin });
    }
  }

  return horarios.sort((a, b) => a.inicio.getTime() - b.inicio.getTime());
}

/** Rangos de la agenda ocupados en el día, para pedirlos a la base con margen. */
export function ventanaDelDia(fecha: string, zonaHoraria: string): Rango {
  return {
    inicio: fromZonedTime(`${fecha}T00:00:00`, zonaHoraria),
    fin: addMinutes(fromZonedTime(`${fecha}T00:00:00`, zonaHoraria), 24 * 60),
  };
}
