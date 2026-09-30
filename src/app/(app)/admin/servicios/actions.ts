"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { slugDeNombre } from "@/lib/servicios";
import { crearClienteServidor } from "@/lib/supabase/server";
import {
  aFilaServicio,
  esquemaServicio,
  type DatosServicio,
} from "@/lib/validacion/servicios";

export type Resultado = { error?: string };

const ERROR_DUPLICADO = "23505";

function mensajeDeError(codigo: string | undefined) {
  if (codigo === ERROR_DUPLICADO) {
    return "Ya existe un servicio con ese nombre corto (slug). Usa otro.";
  }
  return "No pudimos guardar el servicio. Intenta de nuevo en unos minutos.";
}

function refrescar() {
  revalidatePath("/admin/servicios");
  revalidatePath("/servicios");
}

// Solo el administrador puede escribir: lo garantiza RLS en la base de datos.
export async function crearServicio(datos: DatosServicio): Promise<Resultado> {
  const parsed = esquemaServicio.safeParse(datos);
  if (!parsed.success) return { error: "Revisa los datos ingresados." };
  const v = parsed.data;

  const slug = v.slug || slugDeNombre(v.nombre);
  if (!slug) return { error: "No pudimos generar el nombre corto (slug)." };

  const supabase = await crearClienteServidor();
  const { error } = await supabase
    .from("servicios")
    .insert({ slug, ...aFilaServicio(v) });
  if (error) return { error: mensajeDeError(error.code) };

  refrescar();
  redirect("/admin/servicios");
}

export async function actualizarServicio(
  id: string,
  datos: DatosServicio,
): Promise<Resultado> {
  const parsed = esquemaServicio.safeParse(datos);
  if (!parsed.success) return { error: "Revisa los datos ingresados." };

  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from("servicios")
    .update(aFilaServicio(parsed.data))
    .eq("id", id)
    .select("id");

  if (error) return { error: mensajeDeError(error.code) };
  // RLS no da error si no eres administrador: simplemente no actualiza filas.
  if (!data?.length) return { error: "No encontramos ese servicio." };

  refrescar();
  redirect("/admin/servicios");
}

export async function alternarActivo(id: string, activo: boolean) {
  const supabase = await crearClienteServidor();
  await supabase.from("servicios").update({ activo }).eq("id", id);
  refrescar();
}
