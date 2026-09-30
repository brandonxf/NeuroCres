"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { subirArchivo } from "@/lib/almacenamiento";
import { TIPOS_PERMITIDOS } from "@/lib/archivos";
import { crearClienteServidor } from "@/lib/supabase/server";

export type Resultado = { error?: string; ok?: boolean };

const MIME_POR_EXTENSION = Object.fromEntries(
  Object.entries(TIPOS_PERMITIDOS).map(([mime, ext]) => [ext, mime]),
);

/** Sube el comprobante del anticipo y lo registra; la cita sigue pendiente hasta verificarlo. */
export async function subirComprobante(
  _previo: Resultado,
  formData: FormData,
): Promise<Resultado> {
  const parsed = z
    .object({
      pagoId: z.string().uuid(),
      referencia: z.string().trim().max(100, "La referencia es muy larga."),
    })
    .safeParse({
      pagoId: formData.get("pagoId"),
      referencia: formData.get("referencia") ?? "",
    });
  const archivo = formData.get("archivo");
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Revisa los datos." };
  }
  if (!(archivo instanceof File) || archivo.size === 0) {
    return { error: "Elige el comprobante (foto o PDF)." };
  }

  const supabase = await crearClienteServidor();
  const { data: pago } = await supabase
    .from("pagos")
    .select("id, cita_id, citas(persona_id)")
    .eq("id", parsed.data.pagoId)
    .maybeSingle();
  if (!pago?.citas) return { error: "No encontramos ese pago." };

  const subida = await subirArchivo({
    bucket: "comprobantes",
    personaId: pago.citas.persona_id,
    archivo,
    accion: "comprobante.subido",
    entidad: "pagos",
    entidadId: pago.id,
  });
  if ("error" in subida) return { error: subida.error };

  const extension = subida.ruta.split(".").pop() ?? "";
  const { error } = await supabase.rpc("registrar_comprobante", {
    p_pago_id: pago.id,
    p_storage_path: subida.ruta,
    p_mime: MIME_POR_EXTENSION[extension] ?? "application/pdf",
    p_tamano: archivo.size,
    p_referencia: parsed.data.referencia || undefined,
  });
  if (error) {
    return {
      error:
        error.code === "22023"
          ? error.message
          : "No pudimos registrar el comprobante. Intenta de nuevo.",
    };
  }

  revalidatePath(`/mis-citas/${pago.cita_id}`);
  return { ok: true };
}

/** Cancela la cita; la base de datos aplica la política y crea la devolución si corresponde. */
export async function cancelarCita(
  _previo: Resultado,
  formData: FormData,
): Promise<Resultado> {
  const parsed = z
    .object({
      citaId: z.string().uuid(),
      motivo: z.string().trim().max(300, "El motivo es muy largo."),
      entiendo: z.literal(true, {
        message: "Marca que entiendes la consecuencia.",
      }),
    })
    .safeParse({
      citaId: formData.get("citaId"),
      motivo: formData.get("motivo") ?? "",
      entiendo: formData.get("entiendo") === "on",
    });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Revisa los datos." };
  }

  const supabase = await crearClienteServidor();
  const { error } = await supabase.rpc("cambiar_estado_cita", {
    p_cita_id: parsed.data.citaId,
    p_nuevo_estado: "cancelada",
    p_motivo: parsed.data.motivo || undefined,
  });
  if (error) {
    return {
      error:
        error.code === "22023"
          ? error.message
          : "No pudimos cancelar la cita. Intenta de nuevo.",
    };
  }

  revalidatePath("/mis-citas");
  redirect(`/mis-citas/${parsed.data.citaId}`);
}

/** Reprograma la cita a otro horario; la política decide qué pasa con el anticipo. */
export async function reprogramarCita(citaId: string, inicio: string) {
  const supabase = await crearClienteServidor();
  const { data: nueva, error } = await supabase.rpc("reprogramar_cita", {
    p_cita_id: citaId,
    p_nuevo_inicio: inicio,
  });
  if (error || !nueva) {
    redirect(
      `/mis-citas/${citaId}/reprogramar?error=${encodeURIComponent(
        error?.code === "23P01"
          ? "Ese horario acaba de ocuparse. Elige otro."
          : error?.code === "22023"
            ? error.message
            : "No pudimos reprogramar la cita.",
      )}`,
    );
  }
  revalidatePath("/mis-citas");
  redirect(`/mis-citas/${nueva}`);
}
