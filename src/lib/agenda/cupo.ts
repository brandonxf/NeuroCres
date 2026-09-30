export type ConfigRetencionCupo = {
  horas: number;
  horas_si_cita_cercana: number;
  umbral_cita_cercana_horas: number;
};

export const RETENCION_POR_DEFECTO: ConfigRetencionCupo = {
  horas: 12,
  horas_si_cita_cercana: 2,
  umbral_cita_cercana_horas: 24,
};

/**
 * Horas que se retiene el cupo mientras llega el comprobante. Espeja `expiracion_de_cupo()`
 * de la base de datos, que es la que manda; esto solo sirve para avisar a la persona.
 * Nunca supera lo que falta para la cita.
 */
export function horasDeRetencion(
  inicio: Date,
  ahora: Date,
  config: Partial<ConfigRetencionCupo> = {},
): number {
  const c = { ...RETENCION_POR_DEFECTO, ...config };
  const faltan = (inicio.getTime() - ahora.getTime()) / 36e5;
  const horas =
    faltan < c.umbral_cita_cercana_horas ? c.horas_si_cita_cercana : c.horas;
  return Math.max(0, Math.min(horas, faltan));
}
