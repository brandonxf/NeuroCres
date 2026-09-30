"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { fromZonedTime } from "date-fns-tz";
import { crearClienteServidor } from "@/lib/supabase/server";
import { esquemaBloqueo, esquemaFranja } from "@/lib/validacion/agenda";

export type Resultado = { error?: string; ok?: boolean };

const ERROR_EXCLUSION = "23P01";
const MENSAJE_GENERICO =
  "No pudimos guardar los datos. Intenta de nuevo en unos minutos.";

/** La profesional en sesión. Solo el rol profesional llega aquí (ver layout) y RLS lo refuerza. */
async function profesionalActual() {
  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/ingresar");

  const { data: profesional } = await supabase
    .from("profesionales")
    .select("id, zona_horaria")
    .eq("usuario_id", user.id)
    .maybeSingle();

  return { supabase, profesional };
}

function refrescar() {
  revalidatePath("/profesional/disponibilidad");
}

export async function agregarFranja(
  _previo: Resultado,
  formData: FormData,
): Promise<Resultado> {
  const parsed = esquemaFranja.safeParse({
    diaSemana: formData.get("diaSemana"),
    horaInicio: formData.get("horaInicio"),
    horaFin: formData.get("horaFin"),
    modalidades: formData.getAll("modalidades"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Revisa los datos." };
  }
  const v = parsed.data;

  const { supabase, profesional } = await profesionalActual();
  if (!profesional)
    return { error: "Tu cuenta aún no tiene perfil profesional." };

  const { error } = await supabase.from("disponibilidad_semanal").insert({
    profesional_id: profesional.id,
    dia_semana: Number(v.diaSemana),
    hora_inicio: v.horaInicio,
    hora_fin: v.horaFin,
    modalidades: v.modalidades,
  });
  if (error) {
    return {
      error:
        error.code === ERROR_EXCLUSION
          ? "Esa franja se cruza con otra del mismo día."
          : MENSAJE_GENERICO,
    };
  }

  refrescar();
  return { ok: true };
}

export async function eliminarFranja(id: string) {
  const { supabase } = await profesionalActual();
  await supabase.from("disponibilidad_semanal").delete().eq("id", id);
  refrescar();
}

export async function agregarBloqueo(
  _previo: Resultado,
  formData: FormData,
): Promise<Resultado> {
  const parsed = esquemaBloqueo.safeParse({
    inicio: formData.get("inicio"),
    fin: formData.get("fin"),
    motivo: formData.get("motivo") ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Revisa los datos." };
  }
  const v = parsed.data;

  const { supabase, profesional } = await profesionalActual();
  if (!profesional)
    return { error: "Tu cuenta aún no tiene perfil profesional." };

  // Las fechas del formulario son hora local de la profesional; se guardan en UTC.
  const { error } = await supabase.from("bloqueos").insert({
    profesional_id: profesional.id,
    inicio: fromZonedTime(
      `${v.inicio}:00`,
      profesional.zona_horaria,
    ).toISOString(),
    fin: fromZonedTime(`${v.fin}:00`, profesional.zona_horaria).toISOString(),
    motivo: v.motivo || null,
  });
  if (error) return { error: MENSAJE_GENERICO };

  refrescar();
  return { ok: true };
}

export async function eliminarBloqueo(id: string) {
  const { supabase } = await profesionalActual();
  await supabase.from("bloqueos").delete().eq("id", id);
  refrescar();
}
