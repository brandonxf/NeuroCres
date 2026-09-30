"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";
import {
  esquemaPersonaEdicion,
  esquemaPersonaNueva,
  type DatosPersonaEdicion,
  type DatosPersonaNueva,
} from "@/lib/validacion/personas";

export type Resultado = { error?: string };

const ERROR_DUPLICADO = "23505";

function mensajeDeError(codigo: string | undefined) {
  if (codigo === ERROR_DUPLICADO) {
    return "Ya hay una persona registrada con ese documento. Si es tu hijo o hija y ya lo registró el otro responsable, pídele a la profesional que te vincule.";
  }
  return "No pudimos guardar los datos. Intenta de nuevo en unos minutos.";
}

export async function crearPersona(
  datos: DatosPersonaNueva,
): Promise<Resultado> {
  const parsed = esquemaPersonaNueva.safeParse(datos);
  if (!parsed.success) return { error: "Revisa los datos ingresados." };
  const v = parsed.data;

  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/ingresar");

  if (v.modo === "propia") {
    const { error } = await supabase.from("personas").insert({
      usuario_id: user.id,
      nombres: v.nombres,
      apellidos: v.apellidos,
      tipo_documento: v.tipoDocumento,
      numero_documento: v.numeroDocumento,
      fecha_nacimiento: v.fechaNacimiento,
      telefono: v.telefono || null,
      correo: v.correo || user.email || null,
    });
    if (error) return { error: mensajeDeError(error.code) };
  } else {
    const { error } = await supabase.rpc("crear_persona_a_cargo", {
      p_nombres: v.nombres,
      p_apellidos: v.apellidos,
      p_tipo_documento: v.tipoDocumento,
      p_numero_documento: v.numeroDocumento,
      p_fecha_nacimiento: v.fechaNacimiento,
      p_parentesco: v.parentesco,
      p_telefono: v.telefono || undefined,
      p_correo: v.correo || undefined,
    });
    if (error) return { error: mensajeDeError(error.code) };
  }

  revalidatePath("/mis-personas");
  redirect("/mis-personas");
}

export async function actualizarPersona(
  id: string,
  datos: DatosPersonaEdicion,
): Promise<Resultado> {
  const parsed = esquemaPersonaEdicion.safeParse(datos);
  if (!parsed.success) return { error: "Revisa los datos ingresados." };
  const v = parsed.data;

  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from("personas")
    .update({
      nombres: v.nombres,
      apellidos: v.apellidos,
      tipo_documento: v.tipoDocumento,
      numero_documento: v.numeroDocumento,
      fecha_nacimiento: v.fechaNacimiento,
      telefono: v.telefono || null,
      correo: v.correo || null,
    })
    .eq("id", id)
    .select("id");

  if (error) return { error: mensajeDeError(error.code) };
  // RLS no da error si la persona no es del usuario: simplemente no actualiza filas.
  if (!data?.length) return { error: "No encontramos esa persona." };

  revalidatePath("/mis-personas");
  redirect("/mis-personas");
}
