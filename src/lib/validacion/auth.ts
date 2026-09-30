import { z } from "zod";

const correo = z
  .string()
  .trim()
  .toLowerCase()
  .email("Escribe un correo válido.");

const contrasena = z
  .string()
  .min(8, "Usa al menos 8 caracteres.")
  .regex(/[A-Za-z]/, "Incluye al menos una letra.")
  .regex(/\d/, "Incluye al menos un número.");

export const esquemaIngreso = z.object({
  correo,
  contrasena: z.string().min(1, "Escribe tu contraseña."),
});

export const esquemaRegistro = z
  .object({
    nombres: z.string().trim().min(2, "Escribe tus nombres."),
    apellidos: z.string().trim().min(2, "Escribe tus apellidos."),
    telefono: z
      .string()
      .trim()
      .regex(/^\+?\d{7,15}$/, "Escribe un teléfono válido, solo números."),
    correo,
    contrasena,
    confirmacion: z.string(),
  })
  .refine((v) => v.contrasena === v.confirmacion, {
    path: ["confirmacion"],
    message: "Las contraseñas no coinciden.",
  });

export const esquemaRecuperar = z.object({ correo });

export const esquemaRestablecer = z
  .object({ contrasena, confirmacion: z.string() })
  .refine((v) => v.contrasena === v.confirmacion, {
    path: ["confirmacion"],
    message: "Las contraseñas no coinciden.",
  });

export type DatosIngreso = z.infer<typeof esquemaIngreso>;
export type DatosRegistro = z.infer<typeof esquemaRegistro>;
export type DatosRecuperar = z.infer<typeof esquemaRecuperar>;
export type DatosRestablecer = z.infer<typeof esquemaRestablecer>;
