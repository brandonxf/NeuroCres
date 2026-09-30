import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { validarArchivo } from "@/lib/archivos";
import { crearClienteServidor } from "@/lib/supabase/server";

export type Bucket = "comprobantes" | "consentimientos" | "documentos";

/** Segundos que vive una URL firmada. Nunca se guarda ni se muestra una URL permanente. */
const VIGENCIA_URL_SEGUNDOS = 60;

/** IP y navegador de quien hace la petición, para la evidencia de firmas y la auditoría. */
export async function origen() {
  const h = await headers();
  return {
    ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined,
    userAgent: h.get("user-agent") ?? undefined,
  };
}

/**
 * Sube un archivo a `{personaId}/{uuid}.{ext}` del bucket. Valida tamaño y tipo real
 * (por contenido) y deja constancia en la auditoría. RLS de Storage decide si puede.
 */
export async function subirArchivo(opciones: {
  bucket: Bucket;
  personaId: string;
  archivo: File;
  accion: "comprobante.subido" | "consentimiento.firmado";
  entidad: string;
  entidadId: string;
}): Promise<{ ruta: string } | { error: string }> {
  const bytes = new Uint8Array(await opciones.archivo.arrayBuffer());
  const validacion = validarArchivo(bytes);
  if (!validacion.ok) return { error: validacion.error };

  const ruta = `${opciones.personaId}/${randomUUID()}.${validacion.extension}`;
  const supabase = await crearClienteServidor();
  const { error } = await supabase.storage
    .from(opciones.bucket)
    .upload(ruta, bytes, { contentType: validacion.tipo, upsert: false });
  if (error)
    return { error: "No pudimos guardar el archivo. Intenta de nuevo." };

  const { ip, userAgent } = await origen();
  await supabase.rpc("registrar_evento", {
    p_accion: opciones.accion,
    p_entidad: opciones.entidad,
    p_entidad_id: opciones.entidadId,
    p_persona_id: opciones.personaId,
    p_metadata: { bucket: opciones.bucket, bytes: bytes.byteLength },
    p_ip: ip,
    p_user_agent: userAgent,
  });

  return { ruta };
}

/** URL firmada de 60 s para ver o descargar un archivo; registra el acceso en la auditoría. */
export async function urlFirmada(opciones: {
  bucket: Bucket;
  ruta: string;
  personaId: string;
  accion: "comprobante.visto" | "documento.descargado" | "consentimiento.visto";
  entidad: string;
  entidadId: string;
}): Promise<string | null> {
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.storage
    .from(opciones.bucket)
    .createSignedUrl(opciones.ruta, VIGENCIA_URL_SEGUNDOS);
  if (error || !data) return null;

  const { ip, userAgent } = await origen();
  await supabase.rpc("registrar_evento", {
    p_accion: opciones.accion,
    p_entidad: opciones.entidad,
    p_entidad_id: opciones.entidadId,
    p_persona_id: opciones.personaId,
    p_metadata: { bucket: opciones.bucket },
    p_ip: ip,
    p_user_agent: userAgent,
  });

  return data.signedUrl;
}
