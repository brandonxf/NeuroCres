export const ESTADOS_CITA = {
  pendiente_pago: "Pendiente de pago",
  confirmada: "Confirmada",
  completada: "Completada",
  cancelada: "Cancelada",
  inasistencia: "Inasistencia",
  reprogramada: "Reprogramada",
} as const;

export type EstadoCita = keyof typeof ESTADOS_CITA;

/** Estados que ocupan la agenda (los que bloquea la restricción anti doble reserva). */
export const ESTADOS_ACTIVOS: readonly EstadoCita[] = [
  "pendiente_pago",
  "confirmada",
];

/**
 * Transiciones permitidas. Es un espejo de `transicion_cita_valida()` en la base de datos,
 * que es la que manda: esto solo sirve para decidir qué botones mostrar.
 */
export const TRANSICIONES: Record<EstadoCita, readonly EstadoCita[]> = {
  pendiente_pago: ["confirmada", "cancelada"],
  confirmada: ["completada", "inasistencia", "cancelada", "reprogramada"],
  completada: [],
  cancelada: [],
  inasistencia: [],
  reprogramada: [],
};

export const puedeTransicionar = (desde: EstadoCita, hacia: EstadoCita) =>
  TRANSICIONES[desde].includes(hacia);

export const esEstadoFinal = (estado: EstadoCita) =>
  TRANSICIONES[estado].length === 0;

/** Motivo que el sistema escribe cuando el cupo vence sin anticipo verificado. */
export const MOTIVO_CUPO_VENCIDO = "cupo_vencido";
