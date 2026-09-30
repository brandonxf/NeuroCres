import { z } from "zod";
import { calcularEdad, hoyBogota } from "@/lib/fechas";

export const TIPOS_DOCUMENTO = {
  CC: "Cédula de ciudadanía",
  TI: "Tarjeta de identidad",
  RC: "Registro civil",
  CE: "Cédula de extranjería",
  PA: "Pasaporte",
} as const;

export const PARENTESCOS = {
  padre: "Padre",
  madre: "Madre",
  tutor: "Tutor/a",
  otro: "Otro",
} as const;

const nombre = (mensaje: string) => z.string().trim().min(2, mensaje);

const camposBase = z.object({
  nombres: nombre("Escribe los nombres."),
  apellidos: nombre("Escribe los apellidos."),
  tipoDocumento: z.enum(["CC", "TI", "RC", "CE", "PA"], {
    message: "Elige el tipo de documento.",
  }),
  numeroDocumento: z
    .string()
    .trim()
    .regex(
      /^[A-Za-z0-9]{4,20}$/,
      "Solo letras y números, sin puntos ni espacios.",
    ),
  fechaNacimiento: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Elige la fecha de nacimiento."),
  telefono: z
    .string()
    .trim()
    .regex(/^(\+?\d{7,15})?$/, "Escribe un teléfono válido, solo números."),
  correo: z.union([
    z.literal(""),
    z.string().trim().toLowerCase().email("Escribe un correo válido."),
  ]),
});

type Base = z.infer<typeof camposBase>;

/** Reglas que dependen de varios campos (documento y edad). */
function validarDocumentoYEdad(v: Base, ctx: z.RefinementCtx) {
  const hoy = hoyBogota();
  if (v.fechaNacimiento > hoy || v.fechaNacimiento < "1900-01-01") {
    ctx.addIssue({
      code: "custom",
      path: ["fechaNacimiento"],
      message: "La fecha de nacimiento no es válida.",
    });
    return;
  }
  if (v.tipoDocumento === "CC" && calcularEdad(v.fechaNacimiento, hoy) < 18) {
    ctx.addIssue({
      code: "custom",
      path: ["tipoDocumento"],
      message:
        "La cédula de ciudadanía es para mayores de 18 años. Usa tarjeta de identidad o registro civil.",
    });
  }
  if (
    ["CC", "TI", "RC"].includes(v.tipoDocumento) &&
    !/^\d+$/.test(v.numeroDocumento)
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["numeroDocumento"],
      message: "Este documento solo lleva números.",
    });
  }
}

export const esquemaPersonaNueva = camposBase
  .extend({
    modo: z.enum(["propia", "a_cargo"]),
    parentesco: z.enum(["padre", "madre", "tutor", "otro", ""]),
  })
  .superRefine((v, ctx) => {
    validarDocumentoYEdad(v, ctx);
    if (v.modo === "propia" && calcularEdad(v.fechaNacimiento) < 18) {
      ctx.addIssue({
        code: "custom",
        path: ["fechaNacimiento"],
        message: "Para tu propia cuenta debes ser mayor de 18 años.",
      });
    }
    if (v.modo === "a_cargo" && !v.parentesco) {
      ctx.addIssue({
        code: "custom",
        path: ["parentesco"],
        message: "Indica tu parentesco con la persona.",
      });
    }
  });

export const esquemaPersonaEdicion = camposBase.superRefine(
  validarDocumentoYEdad,
);

export type DatosPersonaNueva = z.infer<typeof esquemaPersonaNueva>;
export type DatosPersonaEdicion = z.infer<typeof esquemaPersonaEdicion>;
