import { z } from "zod";

export const TIPOS_CONSENTIMIENTO = {
  consentimiento_informado: "Consentimiento informado",
  tratamiento_datos: "Autorización de tratamiento de datos",
  menores: "Atención de menores de edad",
} as const;

export type TipoConsentimiento = keyof typeof TIPOS_CONSENTIMIENTO;

export const CALIDADES_FIRMANTE = {
  titular: "Titular",
  responsable_legal: "Responsable legal",
} as const;

const UUID = z.string().uuid();

export const esquemaFirma = z.object({
  personaId: UUID,
  plantillaId: UUID,
  nombre: z.string().trim().min(3, "Escribe tu nombre completo."),
  documento: z
    .string()
    .trim()
    .min(4, "Escribe tu documento de identidad.")
    .max(30, "El documento es demasiado largo."),
  acepto: z.literal(true, { message: "Marca que leíste y aceptas el texto." }),
  asentimiento: z.boolean(),
  // Imagen del trazo (data URL PNG) o vacío. La firma manuscrita es opcional.
  trazo: z
    .string()
    .refine(
      (v) => v === "" || /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(v),
      "La firma dibujada no es válida.",
    ),
});

export const esquemaPlantilla = z.object({
  tipo: z.enum(["consentimiento_informado", "tratamiento_datos", "menores"], {
    message: "Elige el tipo de texto.",
  }),
  titulo: z.string().trim().min(3, "Escribe el título."),
  contenido: z.string().trim().min(50, "El texto es demasiado corto."),
});
