"use server";

import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@/lib/supabase/server";
import { esquemaPlantilla } from "@/lib/validacion/consentimientos";

export type Resultado = { error?: string; ok?: boolean };

// Publica una versión nueva y desactiva la anterior. Solo el administrador (lo verifica la función SQL).
export async function publicarPlantilla(
  _previo: Resultado,
  formData: FormData,
): Promise<Resultado> {
  const parsed = esquemaPlantilla.safeParse({
    tipo: formData.get("tipo"),
    titulo: formData.get("titulo"),
    contenido: formData.get("contenido"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Revisa los datos." };
  }
  const v = parsed.data;

  const supabase = await crearClienteServidor();
  const { error } = await supabase.rpc("publicar_plantilla", {
    p_tipo: v.tipo,
    p_titulo: v.titulo,
    p_contenido: v.contenido,
  });
  if (error) {
    return {
      error:
        error.code === "42501"
          ? "Solo el administrador puede publicar textos."
          : "No pudimos publicar el texto. Intenta de nuevo.",
    };
  }

  revalidatePath("/admin/consentimientos");
  revalidatePath("/privacidad");
  return { ok: true };
}
