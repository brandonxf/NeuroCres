import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";

export type Rol =
  "consultante" | "responsable_legal" | "profesional" | "administrador";

/** Roles del usuario en sesión (vacío si no hay sesión). RLS ya limita la consulta a lo propio. */
export async function obtenerRoles(): Promise<Rol[]> {
  const supabase = await crearClienteServidor();
  const { data } = await supabase.from("usuarios_roles").select("rol");
  return (data ?? []).map((f) => f.rol as Rol);
}

/** Exige sesión y al menos uno de los roles; si no, redirige. Úsalo en layouts de zona. */
export async function requerirRol(...permitidos: Rol[]) {
  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/ingresar");

  const roles = await obtenerRoles();
  if (!roles.some((r) => permitidos.includes(r))) redirect("/perfil");

  return { user, roles };
}
