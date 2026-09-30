"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { crearClienteServidor } from "@/lib/supabase/server";

export type Resultado = { error?: string; ok?: boolean };

const entero = (min: number, max: number, mensaje: string) =>
  z
    .string()
    .trim()
    .regex(/^\d+$/, mensaje)
    .refine((v) => Number(v) >= min && Number(v) <= max, mensaje);

const esquema = z
  .object({
    contenido: z.string().trim().min(50, "El texto es demasiado corto."),
    horasSinCosto: entero(1, 720, "Las horas sin costo van de 1 a 720."),
    horasMinimo: entero(0, 720, "El mínimo de horas va de 0 a 720."),
    cobroIntermedio: entero(0, 100, "El cobro intermedio va de 0 a 100%."),
    cobroTardio: entero(0, 100, "El cobro tardío va de 0 a 100%."),
    reprogramacionesGratis: entero(
      0,
      10,
      "Las reprogramaciones gratis van de 0 a 10.",
    ),
  })
  .refine((v) => Number(v.horasSinCosto) > Number(v.horasMinimo), {
    path: ["horasSinCosto"],
    message: "Las horas sin costo deben ser más que el mínimo de horas.",
  });

// Publica una versión nueva y desactiva la anterior. Solo el administrador (lo verifica la función SQL).
export async function publicarPolitica(
  _previo: Resultado,
  formData: FormData,
): Promise<Resultado> {
  const parsed = esquema.safeParse({
    contenido: formData.get("contenido"),
    horasSinCosto: formData.get("horasSinCosto"),
    horasMinimo: formData.get("horasMinimo"),
    cobroIntermedio: formData.get("cobroIntermedio"),
    cobroTardio: formData.get("cobroTardio"),
    reprogramacionesGratis: formData.get("reprogramacionesGratis"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Revisa los datos." };
  }
  const v = parsed.data;

  const supabase = await crearClienteServidor();
  const { error } = await supabase.rpc("publicar_politica", {
    p_contenido: v.contenido,
    p_reglas: {
      horas_sin_costo: Number(v.horasSinCosto),
      horas_minimo: Number(v.horasMinimo),
      porcentaje_cobro_intermedio: Number(v.cobroIntermedio),
      porcentaje_cobro_tardio: Number(v.cobroTardio),
      reprogramaciones_gratis: Number(v.reprogramacionesGratis),
    },
  });
  if (error) {
    return {
      error:
        error.code === "42501"
          ? "Solo el administrador puede publicar la política."
          : "No pudimos publicar la política. Revisa los valores e intenta de nuevo.",
    };
  }

  revalidatePath("/admin/politica");
  revalidatePath("/politica-cancelacion");
  return { ok: true };
}
