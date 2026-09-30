"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { crearClienteServidor } from "@/lib/supabase/server";

const id = z.string().uuid();

/** Vuelve a la pantalla de origen, con el error (si lo hubo) en la URL. */
function volver(destino: string, error?: string): never {
  const url = destino.startsWith("/profesional") ? destino : "/profesional";
  const separador = url.includes("?") ? "&" : "?";
  redirect(
    error ? `${url}${separador}error=${encodeURIComponent(error)}` : url,
  );
}

function mensaje(error: { code?: string; message: string }) {
  return error.code === "22023"
    ? error.message
    : error.code === "42501"
      ? "No tienes permiso para hacer esto."
      : "No pudimos completar la acción. Intenta de nuevo.";
}

export async function verificarPago(formData: FormData) {
  const pagoId = id.safeParse(formData.get("pagoId"));
  const destino = String(formData.get("volver") ?? "/profesional/pagos");
  if (!pagoId.success) volver(destino, "Pago no válido.");

  const supabase = await crearClienteServidor();
  const { error } = await supabase.rpc("verificar_pago", {
    p_pago_id: pagoId.data,
  });
  revalidatePath("/profesional", "layout");
  volver(destino, error ? mensaje(error) : undefined);
}

export async function rechazarPago(formData: FormData) {
  const pagoId = id.safeParse(formData.get("pagoId"));
  const motivo = String(formData.get("motivo") ?? "");
  const destino = String(formData.get("volver") ?? "/profesional/pagos");
  if (!pagoId.success) volver(destino, "Pago no válido.");

  const supabase = await crearClienteServidor();
  const { error } = await supabase.rpc("rechazar_pago", {
    p_pago_id: pagoId.data,
    p_motivo: motivo,
  });
  revalidatePath("/profesional", "layout");
  volver(destino, error ? mensaje(error) : undefined);
}

export async function cambiarEstadoCita(formData: FormData) {
  const citaId = id.safeParse(formData.get("citaId"));
  const estado = String(formData.get("estado") ?? "");
  const motivo = String(formData.get("motivo") ?? "").slice(0, 300);
  const destino = String(formData.get("volver") ?? "/profesional/agenda");
  if (!citaId.success) volver(destino, "Cita no válida.");

  const supabase = await crearClienteServidor();
  const { error } = await supabase.rpc("cambiar_estado_cita", {
    p_cita_id: citaId.data,
    p_nuevo_estado: estado,
    p_motivo: motivo || undefined,
  });
  revalidatePath("/profesional", "layout");
  volver(destino, error ? mensaje(error) : undefined);
}

export async function cobrarSaldo(formData: FormData) {
  const citaId = id.safeParse(formData.get("citaId"));
  const medio = String(formData.get("medio") ?? "");
  const referencia = String(formData.get("referencia") ?? "").slice(0, 100);
  const destino = String(formData.get("volver") ?? "/profesional/agenda");
  if (!citaId.success) volver(destino, "Cita no válida.");

  const supabase = await crearClienteServidor();
  const { error } = await supabase.rpc("registrar_pago_saldo", {
    p_cita_id: citaId.data,
    p_medio: medio,
    p_referencia: referencia || undefined,
  });
  revalidatePath("/profesional", "layout");
  volver(destino, error ? mensaje(error) : undefined);
}

export async function marcarDevolucionRealizada(formData: FormData) {
  const devolucionId = id.safeParse(formData.get("devolucionId"));
  const medio = String(formData.get("medio") ?? "");
  const referencia = String(formData.get("referencia") ?? "").slice(0, 100);
  const destino = String(formData.get("volver") ?? "/profesional/pagos");
  if (!devolucionId.success) volver(destino, "Devolución no válida.");

  const supabase = await crearClienteServidor();
  const { error } = await supabase.rpc("marcar_devolucion_realizada", {
    p_devolucion_id: devolucionId.data,
    p_medio: medio,
    p_referencia: referencia || undefined,
  });
  revalidatePath("/profesional", "layout");
  volver(destino, error ? mensaje(error) : undefined);
}
