"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { crearClienteServidor } from "@/lib/supabase/server";

const esquema = z.object({
  nombrePublico: z.string().trim().min(3, "Escribe tu nombre público."),
  registro: z.string().trim().max(60),
  // Enlace de la sala virtual (Meet, Zoom…). Debe ser https; nunca se muestra en correos.
  enlace: z
    .string()
    .trim()
    .refine(
      (v) => v === "" || /^https:\/\/[^\s]+$/.test(v),
      "El enlace debe empezar con https://",
    ),
});

// RLS y los permisos de columna limitan la edición a la propia profesional.
export async function guardarPerfil(formData: FormData) {
  const parsed = esquema.safeParse({
    nombrePublico: formData.get("nombrePublico"),
    registro: formData.get("registro") ?? "",
    enlace: formData.get("enlace") ?? "",
  });
  if (!parsed.success) {
    redirect(
      `/profesional/perfil?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Revisa los datos.")}`,
    );
  }
  const v = parsed.data;

  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/ingresar");

  const { data, error } = await supabase
    .from("profesionales")
    .update({
      nombre_publico: v.nombrePublico,
      registro_profesional: v.registro || null,
      enlace_videollamada: v.enlace || null,
    })
    .eq("usuario_id", user.id)
    .select("id");

  if (error || !data?.length) {
    redirect("/profesional/perfil?error=No pudimos guardar. Intenta de nuevo.");
  }
  revalidatePath("/profesional/perfil");
  redirect("/profesional/perfil?ok=1");
}
