import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";

/** Usuario en sesión con sus datos de cuenta; redirige a /ingresar si no hay sesión. */
export async function usuarioActual() {
  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/ingresar");

  const { data: cuenta } = await supabase
    .from("usuarios")
    .select("nombres, apellidos, telefono, correo")
    .eq("id", user.id)
    .single();

  return {
    supabase,
    user,
    responsable: {
      nombre: [cuenta?.nombres, cuenta?.apellidos].filter(Boolean).join(" "),
      correo: cuenta?.correo ?? user.email ?? "",
      telefono: cuenta?.telefono ?? "",
    },
  };
}

/** Personas que gestiona el usuario: la propia y las que tiene a cargo. */
export async function personasDelUsuario() {
  const { supabase, user, responsable } = await usuarioActual();
  const { data } = await supabase
    .from("personas")
    .select("*, responsables_legales(responsable_usuario_id, parentesco)")
    .is("deleted_at", null)
    .order("created_at");

  // La profesional ve más personas por RLS; aquí solo mostramos las que gestiona.
  const personas = (data ?? []).filter(
    (p) =>
      p.usuario_id === user.id ||
      p.responsables_legales.some((r) => r.responsable_usuario_id === user.id),
  );
  return { supabase, user, responsable, personas };
}
