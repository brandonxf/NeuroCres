import { z } from "zod";

const entero = (mensaje: string) => z.string().trim().regex(/^\d+$/, mensaje);

export const esquemaServicio = z
  .object({
    nombre: z.string().trim().min(3, "Escribe el nombre del servicio."),
    // Vacío al crear: se genera a partir del nombre. No se edita después.
    slug: z
      .string()
      .trim()
      .regex(
        /^([a-z0-9]+(-[a-z0-9]+)*)?$/,
        "Solo minúsculas, números y guiones.",
      ),
    descripcion: z.string().trim(),
    poblacion: z.string().trim(),
    tipo: z.enum(["individual", "proceso", "paquete", "grupal"], {
      message: "Elige el tipo de servicio.",
    }),
    duracionMin: z.union([
      z.literal(""),
      entero("Escribe los minutos, solo números.").refine(
        (v) => Number(v) >= 1 && Number(v) <= 600,
        "La duración debe estar entre 1 y 600 minutos.",
      ),
    ]),
    precioCop: entero("Escribe el precio en pesos, solo números.").refine(
      (v) => v.length <= 10,
      "El precio es demasiado alto.",
    ),
    anticipoPct: entero("Escribe un porcentaje entre 0 y 100.").refine(
      (v) => Number(v) <= 100,
      "El anticipo va de 0 a 100.",
    ),
    modalidades: z
      .array(z.enum(["presencial", "virtual"]))
      .min(1, "Elige al menos una modalidad."),
    requierePresencial: z.boolean(),
    requiereConsentimiento: z.boolean(),
    requiereFormulario: z.boolean(),
    requiereAnticipo: z.boolean(),
    agendableEnLinea: z.boolean(),
    activo: z.boolean(),
    orden: entero("El orden es un número entero."),
  })
  .superRefine((v, ctx) => {
    if (
      v.requierePresencial &&
      !(v.modalidades.length === 1 && v.modalidades[0] === "presencial")
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["modalidades"],
        message:
          "Si el servicio requiere presencialidad, la única modalidad es presencial.",
      });
    }
  });

export type DatosServicio = z.infer<typeof esquemaServicio>;

/** Convierte los datos del formulario (texto) a columnas de la tabla `servicios`. */
export function aFilaServicio(v: DatosServicio) {
  return {
    nombre: v.nombre,
    descripcion: v.descripcion || null,
    poblacion: v.poblacion || null,
    tipo: v.tipo,
    duracion_min: v.duracionMin === "" ? null : Number(v.duracionMin),
    precio_cop: Number(v.precioCop),
    anticipo_pct: Number(v.anticipoPct),
    modalidades: v.modalidades,
    requiere_presencial: v.requierePresencial,
    requiere_consentimiento: v.requiereConsentimiento,
    requiere_formulario: v.requiereFormulario,
    requiere_anticipo: v.requiereAnticipo,
    agendable_en_linea: v.agendableEnLinea,
    activo: v.activo,
    orden: Number(v.orden),
  };
}
