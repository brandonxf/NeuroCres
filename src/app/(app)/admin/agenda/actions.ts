"use server";

import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@/lib/supabase/server";
import { esquemaParametrosAgenda } from "@/lib/validacion/agenda";

export type Resultado = { error?: string; ok?: boolean };

// Solo el administrador puede escribir en `configuracion`: lo garantiza RLS.
export async function guardarParametrosAgenda(
  _previo: Resultado,
  formData: FormData,
): Promise<Resultado> {
  const parsed = esquemaParametrosAgenda.safeParse({
    descansoMin: formData.get("descansoMin"),
    antelacionMinHoras: formData.get("antelacionMinHoras"),
    horizonteDias: formData.get("horizonteDias"),
    granularidadMin: formData.get("granularidadMin"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Revisa los datos." };
  }
  const v = parsed.data;

  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from("configuracion")
    .update({
      valor: {
        descanso_min: Number(v.descansoMin),
        antelacion_min_horas: Number(v.antelacionMinHoras),
        horizonte_dias: Number(v.horizonteDias),
        granularidad_min: Number(v.granularidadMin),
      },
    })
    .eq("clave", "parametros_agenda")
    .select("clave");

  if (error)
    return { error: "No pudimos guardar los datos. Intenta de nuevo." };
  if (!data?.length)
    return { error: "No tienes permiso para cambiar estos valores." };

  revalidatePath("/admin/agenda");
  revalidatePath("/profesional/disponibilidad");
  return { ok: true };
}
