import "server-only";
import { crearClienteServicio } from "@/lib/supabase/admin";
import { enviarCorreo } from "./enviar";
import { esperaMinutos, MAX_INTENTOS } from "./reintentos";
import {
  armarCorreo,
  type PayloadNotificacion,
  type TipoNotificacion,
} from "./plantillas";

export type Resumen = {
  revisadas: number;
  enviadas: number;
  omitidas: number;
  reintentos: number;
  fallidas: number;
};

/**
 * Envía las notificaciones vencidas de la cola. Un recordatorio o un aviso de cupo se omite
 * si la cita ya no está en el estado que lo justifica (la cancelaron, ya pagó…).
 */
export async function procesarNotificaciones(limite = 50): Promise<Resumen> {
  const db = crearClienteServicio();
  const resumen: Resumen = {
    revisadas: 0,
    enviadas: 0,
    omitidas: 0,
    reintentos: 0,
    fallidas: 0,
  };

  const { data: cola } = await db
    .from("notificaciones")
    .select("*")
    .eq("estado", "pendiente")
    .lte("programada_para", new Date().toISOString())
    .order("programada_para")
    .limit(limite);
  if (!cola?.length) return resumen;

  const usuarioIds = [...new Set(cola.map((n) => n.usuario_id))];
  const { data: usuarios } = await db
    .from("usuarios")
    .select("id, correo, nombres")
    .in("id", usuarioIds);
  const porId = new Map((usuarios ?? []).map((u) => [u.id, u]));

  const citaIds = [
    ...new Set(
      cola
        .map((n) => (n.payload as PayloadNotificacion).cita_id)
        .filter((x): x is string => Boolean(x)),
    ),
  ];
  const { data: citas } = citaIds.length
    ? await db.from("citas").select("id, estado, inicio").in("id", citaIds)
    : { data: [] };
  const estadoCita = new Map((citas ?? []).map((c) => [c.id, c]));

  const { data: config } = await db
    .from("configuracion")
    .select("valor")
    .eq("clave", "direccion_consultorio")
    .maybeSingle();
  const direccion = typeof config?.valor === "string" ? config.valor : null;
  const urlBase = (
    process.env.NEXT_PUBLIC_APP_URL || "https://neurocres.vercel.app"
  ).replace(/\/$/, "");

  for (const n of cola) {
    resumen.revisadas += 1;
    const payload = n.payload as PayloadNotificacion;
    const cita = payload.cita_id ? estadoCita.get(payload.cita_id) : undefined;

    const sigueVigente = ["recordatorio_24h", "recordatorio_2h"].includes(
      n.tipo,
    )
      ? cita?.estado === "confirmada"
      : n.tipo === "cupo_por_vencer"
        ? cita?.estado === "pendiente_pago"
        : true;
    if (!sigueVigente) {
      await db
        .from("notificaciones")
        .update({
          estado: "omitida",
          error: "La cita ya no está en el estado que lo justifica",
        })
        .eq("id", n.id);
      resumen.omitidas += 1;
      continue;
    }

    const usuario = porId.get(n.usuario_id);
    if (!usuario?.correo) {
      await db
        .from("notificaciones")
        .update({ estado: "fallida", error: "El destinatario no tiene correo" })
        .eq("id", n.id);
      resumen.fallidas += 1;
      continue;
    }

    const correo = armarCorreo(
      n.tipo as TipoNotificacion,
      payload,
      { urlBase, direccion },
      usuario.nombres,
    );
    const r = await enviarCorreo(usuario.correo, correo);

    if (r.ok) {
      await db
        .from("notificaciones")
        .update({
          estado: "enviada",
          enviada_at: new Date().toISOString(),
          intentos: n.intentos + 1,
          error: null,
        })
        .eq("id", n.id);
      resumen.enviadas += 1;
      continue;
    }

    const intentos = n.intentos + 1;
    if (intentos >= MAX_INTENTOS) {
      await db
        .from("notificaciones")
        .update({ estado: "fallida", intentos, error: r.error })
        .eq("id", n.id);
      resumen.fallidas += 1;
    } else {
      await db
        .from("notificaciones")
        .update({
          intentos,
          error: r.error,
          programada_para: new Date(
            Date.now() + esperaMinutos(intentos) * 60_000,
          ).toISOString(),
        })
        .eq("id", n.id);
      resumen.reintentos += 1;
    }
  }

  return resumen;
}
