import { crearClienteServidor } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/tipos";

/** Lee un parámetro de la tabla `configuracion`. Devuelve null si no existe. */
export async function obtenerConfiguracion<T = Json>(
  clave: string,
): Promise<T | null> {
  const supabase = await crearClienteServidor();
  const { data } = await supabase
    .from("configuracion")
    .select("valor")
    .eq("clave", clave)
    .maybeSingle();
  return (data?.valor as T | undefined) ?? null;
}
