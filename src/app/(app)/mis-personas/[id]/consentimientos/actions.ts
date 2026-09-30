"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { validarArchivo } from "@/lib/archivos";
import { origen } from "@/lib/almacenamiento";
import { generarConstancia } from "@/lib/consentimientos/constancia";
import { crearClienteServidor } from "@/lib/supabase/server";
import { esquemaFirma } from "@/lib/validacion/consentimientos";

export type Resultado = { error?: string; ok?: boolean };

const ERRORES: Record<string, string> = {
  "23505": "Ese texto ya está firmado.",
  "42501": "No tienes permiso para firmar por esta persona.",
};

/**
 * Firma un consentimiento: guarda el trazo (si hay), firma con la función SQL (que toma el
 * texto y su hash de la plantilla activa) y genera el PDF de constancia.
 */
export async function firmarConsentimiento(
  _previo: Resultado,
  formData: FormData,
): Promise<Resultado> {
  const parsed = esquemaFirma.safeParse({
    personaId: formData.get("personaId"),
    plantillaId: formData.get("plantillaId"),
    nombre: formData.get("nombre"),
    documento: formData.get("documento"),
    acepto: formData.get("acepto") === "on",
    asentimiento: formData.get("asentimiento") === "on",
    trazo: formData.get("trazo") ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Revisa los datos." };
  }
  const v = parsed.data;
  const supabase = await crearClienteServidor();

  // Trazo opcional de la firma, al almacenamiento privado.
  let firmaBytes: Uint8Array | undefined;
  let firmaRuta: string | undefined;
  if (v.trazo) {
    firmaBytes = Uint8Array.from(
      Buffer.from(v.trazo.split(",")[1] ?? "", "base64"),
    );
    const validacion = validarArchivo(firmaBytes);
    if (!validacion.ok || validacion.tipo !== "image/png") {
      return { error: "La firma dibujada no es válida." };
    }
    firmaRuta = `${v.personaId}/firma-${randomUUID()}.png`;
    const { error } = await supabase.storage
      .from("consentimientos")
      .upload(firmaRuta, firmaBytes, { contentType: "image/png" });
    if (error)
      return { error: "No pudimos guardar la firma. Intenta de nuevo." };
  }

  const { ip, userAgent } = await origen();
  const { data: id, error } = await supabase.rpc("firmar_consentimiento", {
    p_plantilla_id: v.plantillaId,
    p_persona_id: v.personaId,
    p_firmante_nombre: v.nombre,
    p_firmante_documento: v.documento,
    p_asentimiento_menor: v.asentimiento,
    p_firma_trazo_path: firmaRuta,
    p_ip: ip,
    p_user_agent: userAgent,
  });
  if (error || !id) {
    // Los mensajes de la función SQL ya son claros para la persona (22023).
    return {
      error:
        (error?.code === "22023"
          ? error.message
          : ERRORES[error?.code ?? ""]) ??
        "No pudimos registrar la firma. Intenta de nuevo en unos minutos.",
    };
  }

  // La constancia se genera después: si fallara, la firma ya es válida y queda registrada.
  try {
    const [{ data: firmado }, { data: persona }] = await Promise.all([
      supabase
        .from("consentimientos_firmados")
        .select(
          "hash_contenido, firmado_at, calidad, asentimiento_menor, plantillas_consentimiento(titulo, version, contenido)",
        )
        .eq("id", id)
        .single(),
      supabase
        .from("personas")
        .select("nombres, apellidos, tipo_documento, numero_documento")
        .eq("id", v.personaId)
        .single(),
    ]);
    const plantilla = firmado?.plantillas_consentimiento;
    if (firmado && persona && plantilla) {
      const pdf = await generarConstancia({
        titulo: plantilla.titulo,
        version: plantilla.version,
        contenido: plantilla.contenido,
        persona: {
          nombre: `${persona.nombres} ${persona.apellidos}`,
          documento: `${persona.tipo_documento} ${persona.numero_documento}`,
        },
        firmante: {
          nombre: v.nombre,
          documento: v.documento,
          calidad: firmado.calidad,
        },
        asentimientoMenor: firmado.asentimiento_menor,
        hashContenido: firmado.hash_contenido,
        consentimientoId: id,
        firmadoAt: new Date(firmado.firmado_at),
        firmaPng: firmaBytes,
      });
      const ruta = `${v.personaId}/constancia-${id}.pdf`;
      const { error: errorSubida } = await supabase.storage
        .from("consentimientos")
        .upload(ruta, pdf, { contentType: "application/pdf" });
      if (!errorSubida) {
        await supabase.rpc("registrar_constancia", {
          p_consentimiento_id: id,
          p_ruta: ruta,
        });
      }
    }
  } catch {
    // Sin constancia por ahora; la firma quedó registrada.
  }

  revalidatePath(`/mis-personas/${v.personaId}/consentimientos`);
  return { ok: true };
}
