import { formatearCop } from "@/lib/servicios";

export type AccionPolitica = "cancelar" | "reprogramar" | "inasistencia";
export type TramoPolitica =
  "sin_costo" | "intermedio" | "tardio" | "profesional";

/** Resultado de `calcular_consecuencia()` en la base de datos. */
export type Consecuencia = {
  tramo: string;
  permitida: boolean;
  retener_cop: number;
  devolver_cop: number;
  trasladar_cop: number;
  cobrar_cop: number;
};

export type ReglasPolitica = {
  horas_sin_costo: number;
  horas_minimo: number;
  porcentaje_cobro_intermedio: number;
  porcentaje_cobro_tardio: number;
  reprogramaciones_gratis: number;
};

export const REGLAS_POR_DEFECTO: ReglasPolitica = {
  horas_sin_costo: 24,
  horas_minimo: 4,
  porcentaje_cobro_intermedio: 50,
  porcentaje_cobro_tardio: 100,
  reprogramaciones_gratis: 1,
};

/**
 * Explica en palabras y en pesos qué pasará con el anticipo. Se muestra ANTES de que la
 * persona confirme. Los montos los calcula la base de datos; aquí solo se redactan.
 */
export function describirConsecuencia(
  c: Consecuencia,
  accion: AccionPolitica,
): { permitida: boolean; titulo: string; lineas: string[] } {
  const lineas: string[] = [];

  if (!c.permitida) {
    return {
      permitida: false,
      titulo: "Ya no se puede reprogramar",
      lineas: [
        "Falta muy poco para la cita. Si no puedes asistir, puedes cancelarla, pero se cobra la sesión.",
      ],
    };
  }

  if (c.tramo === "profesional") {
    lineas.push(
      accion === "reprogramar"
        ? `Tu anticipo de ${formatearCop(c.trasladar_cop)} pasa a la nueva fecha.`
        : `Se te devuelve el anticipo completo: ${formatearCop(c.devolver_cop)}.`,
    );
    return { permitida: true, titulo: "Sin costo para ti", lineas };
  }

  if (c.retener_cop > 0) {
    lineas.push(`Se retienen ${formatearCop(c.retener_cop)} de tu anticipo.`);
  }
  if (c.devolver_cop > 0) {
    lineas.push(`Se te devuelven ${formatearCop(c.devolver_cop)}.`);
  }
  if (c.trasladar_cop > 0) {
    lineas.push(
      `${formatearCop(c.trasladar_cop)} de tu anticipo pasan a la nueva fecha.`,
    );
  }
  if (c.cobrar_cop > 0) {
    lineas.push(`Quedan por pagar ${formatearCop(c.cobrar_cop)}.`);
  }
  if (lineas.length === 0) lineas.push("No hay ningún cargo.");

  const titulo =
    c.tramo === "sin_costo"
      ? "Sin costo"
      : c.retener_cop === 0 && c.cobrar_cop === 0
        ? "Sin costo (reprogramación gratuita)"
        : c.tramo === "tardio"
          ? "Se cobra la sesión completa"
          : "Hay un cargo parcial";

  return { permitida: true, titulo, lineas };
}
