import { z } from "zod";

export const DIAS_SEMANA = {
  "1": "Lunes",
  "2": "Martes",
  "3": "Miércoles",
  "4": "Jueves",
  "5": "Viernes",
  "6": "Sábado",
  "0": "Domingo",
} as const;

const modalidades = z
  .array(z.enum(["presencial", "virtual"]))
  .min(1, "Elige al menos una modalidad.");

const hora = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Escribe la hora como HH:MM.");

export const esquemaFranja = z
  .object({
    diaSemana: z.enum(["0", "1", "2", "3", "4", "5", "6"], {
      message: "Elige el día.",
    }),
    horaInicio: hora,
    horaFin: hora,
    modalidades,
  })
  .refine((v) => v.horaFin > v.horaInicio, {
    path: ["horaFin"],
    message: "La hora de fin debe ser posterior a la de inicio.",
  });

const fechaHora = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Elige fecha y hora.");

export const esquemaBloqueo = z
  .object({
    inicio: fechaHora,
    fin: fechaHora,
    motivo: z.string().trim().max(300, "Máximo 300 caracteres."),
  })
  .refine((v) => v.fin > v.inicio, {
    path: ["fin"],
    message: "El fin debe ser posterior al inicio.",
  });

const entero = (min: number, max: number, mensaje: string) =>
  z
    .string()
    .trim()
    .regex(/^\d+$/, mensaje)
    .refine((v) => Number(v) >= min && Number(v) <= max, mensaje);

export const esquemaParametrosAgenda = z.object({
  descansoMin: entero(0, 120, "El descanso va de 0 a 120 minutos."),
  antelacionMinHoras: entero(0, 720, "La antelación va de 0 a 720 horas."),
  horizonteDias: entero(1, 365, "El horizonte va de 1 a 365 días."),
  granularidadMin: z.enum(["15", "30"], {
    message: "Elige 15 o 30 minutos.",
  }),
});

export type DatosParametrosAgenda = z.infer<typeof esquemaParametrosAgenda>;
