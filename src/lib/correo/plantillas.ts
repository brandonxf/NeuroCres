import { formatearFechaHora } from "@/lib/fechas";
import { MOTIVOS_RECHAZO } from "@/lib/pagos";

export type TipoNotificacion =
  | "reserva_recibida"
  | "comprobante_recibido"
  | "pago_verificado"
  | "pago_rechazado"
  | "cupo_por_vencer"
  | "recordatorio_24h"
  | "recordatorio_2h"
  | "cita_cancelada"
  | "cita_reprogramada"
  | "constancia_consentimiento";

/** Lo que guarda la cola. Nunca incluye información clínica ni texto libre de la persona. */
export type PayloadNotificacion = {
  cita_id?: string;
  inicio?: string;
  fin?: string;
  modalidad?: string;
  servicio?: string;
  expira_cupo_at?: string | null;
  inicio_anterior?: string;
  motivo?: string | null;
  por_cupo_vencido?: boolean;
  para_profesional?: boolean;
  consentimiento_id?: string;
  persona_id?: string;
};

export type ContextoCorreo = {
  /** URL pública de la app, sin barra final. */
  urlBase: string;
  direccion?: string | null;
};

export type Correo = { asunto: string; texto: string; html: string };

const esc = (t: string) =>
  t
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const fecha = (iso?: string | null) => (iso ? formatearFechaHora(iso) : "");

function detalles(
  p: PayloadNotificacion,
  ctx: ContextoCorreo,
  conLugar: boolean,
) {
  const filas: [string, string][] = [];
  if (p.servicio) filas.push(["Servicio", p.servicio]);
  if (p.inicio)
    filas.push(["Fecha y hora", `${fecha(p.inicio)} (hora de Bogotá)`]);
  if (p.modalidad) {
    filas.push([
      "Modalidad",
      p.modalidad === "virtual" ? "Virtual" : "Presencial",
    ]);
    if (conLugar && p.modalidad === "presencial" && ctx.direccion) {
      filas.push(["Dirección", ctx.direccion]);
    }
    if (conLugar && p.modalidad === "virtual") {
      filas.push([
        "Enlace",
        "Lo encuentras en tu cuenta, en el detalle de la cita.",
      ]);
    }
  }
  return filas;
}

type Contenido = {
  asunto: string;
  titulo: string;
  parrafos: string[];
  detalle?: [string, string][];
  boton?: { texto: string; ruta: string };
};

function contenido(
  tipo: TipoNotificacion,
  p: PayloadNotificacion,
  ctx: ContextoCorreo,
): Contenido {
  const ver = p.cita_id
    ? { texto: "Ver mi cita", ruta: `/mis-citas/${p.cita_id}` }
    : undefined;
  const expira = p.expira_cupo_at ? fecha(p.expira_cupo_at) : "";
  const agendaProfesional = {
    texto: "Ir a mi agenda",
    ruta: "/profesional/agenda",
  };

  switch (tipo) {
    case "reserva_recibida":
      return {
        asunto: "Recibimos tu reserva",
        titulo: "Recibimos tu reserva",
        parrafos: [
          "Tu cita está pendiente de verificación del pago.",
          expira
            ? `Sube tu comprobante antes de ${expira} para conservar el horario.`
            : "Sube tu comprobante pronto para conservar el horario.",
        ],
        detalle: detalles(p, ctx, false),
        boton: ver,
      };
    case "comprobante_recibido":
      return {
        asunto: "Comprobante recibido para verificar",
        titulo: "Hay un comprobante por verificar",
        parrafos: ["Una persona subió el comprobante de su anticipo."],
        detalle: detalles(p, ctx, false),
        boton: {
          texto: "Ir a pagos por verificar",
          ruta: "/profesional/pagos",
        },
      };
    case "pago_verificado":
      return {
        asunto: "Tu cita está confirmada",
        titulo: "Tu cita está confirmada",
        parrafos: ["Verificamos tu anticipo. Te esperamos."],
        detalle: detalles(p, ctx, true),
        boton: ver,
      };
    case "pago_rechazado":
      return {
        asunto: "No pudimos verificar tu comprobante",
        titulo: "No pudimos verificar tu comprobante",
        parrafos: [
          `Motivo: ${MOTIVOS_RECHAZO[p.motivo as keyof typeof MOTIVOS_RECHAZO] ?? "revisa el comprobante"}.`,
          expira
            ? `Puedes subir otro antes de ${expira}.`
            : "Puedes subir otro mientras tu cupo siga vigente.",
        ],
        detalle: detalles(p, ctx, false),
        boton: ver,
      };
    case "cupo_por_vencer":
      return {
        asunto: "Tu cupo vence en 1 hora",
        titulo: "Tu cupo vence pronto",
        parrafos: [
          expira
            ? `Sube tu comprobante antes de ${expira}; si no, el horario se libera.`
            : "Sube tu comprobante pronto; si no, el horario se libera.",
        ],
        detalle: detalles(p, ctx, false),
        boton: ver,
      };
    case "recordatorio_24h":
      return {
        asunto: "Recordatorio: tu cita es mañana",
        titulo: "Tu cita es en 24 horas",
        parrafos: ["Te recordamos tu cita."],
        detalle: detalles(p, ctx, true),
        boton: ver,
      };
    case "recordatorio_2h":
      return {
        asunto: "Recordatorio: tu cita es en 2 horas",
        titulo: "Tu cita es en 2 horas",
        parrafos: ["Te recordamos tu cita de hoy."],
        detalle: detalles(p, ctx, true),
        boton: ver,
      };
    case "cita_cancelada":
      return {
        asunto: "Se canceló una cita",
        titulo: "Se canceló una cita",
        parrafos: [
          p.por_cupo_vencido
            ? "La reserva se canceló porque venció el tiempo para enviar el comprobante del anticipo. El horario quedó libre."
            : p.para_profesional
              ? "Se canceló una cita de tu agenda."
              : "Tu cita fue cancelada. Si hay una devolución, la verás en el detalle de la cita.",
        ],
        detalle: detalles(p, ctx, false),
        boton: p.para_profesional ? agendaProfesional : ver,
      };
    case "cita_reprogramada":
      return {
        asunto: "Se reprogramó una cita",
        titulo: "Se reprogramó una cita",
        parrafos: [
          p.inicio_anterior
            ? `Antes: ${fecha(p.inicio_anterior)}. Ahora: ${fecha(p.inicio)}.`
            : `Nueva fecha: ${fecha(p.inicio)}.`,
        ],
        detalle: detalles(p, ctx, true),
        boton: p.para_profesional ? agendaProfesional : ver,
      };
    case "constancia_consentimiento":
      return {
        asunto: "Constancia de tu consentimiento",
        titulo: "Firmaste un consentimiento",
        parrafos: [
          "Guardamos tu firma con la fecha, la hora y la versión del texto. Puedes descargar la constancia en PDF desde tu cuenta.",
        ],
        boton: p.persona_id
          ? {
              texto: "Ver mis consentimientos",
              ruta: `/mis-personas/${p.persona_id}/consentimientos`,
            }
          : undefined,
      };
  }
}

/** Arma el correo (asunto, texto plano y HTML con la marca). Sin información clínica. */
export function armarCorreo(
  tipo: TipoNotificacion,
  payload: PayloadNotificacion,
  ctx: ContextoCorreo,
  nombre?: string | null,
): Correo {
  const c = contenido(tipo, payload, ctx);
  const saludo = nombre ? `Hola, ${nombre}.` : "Hola.";
  const enlace = c.boton ? `${ctx.urlBase}${c.boton.ruta}` : null;
  const pie = `Este mensaje no incluye información clínica. Política de privacidad: ${ctx.urlBase}/privacidad`;

  const texto = [
    saludo,
    "",
    ...c.parrafos,
    ...(c.detalle?.length
      ? ["", ...c.detalle.map(([k, v]) => `${k}: ${v}`)]
      : []),
    ...(enlace ? ["", `${c.boton!.texto}: ${enlace}`] : []),
    "",
    pie,
  ].join("\n");

  const filasHtml = c.detalle?.length
    ? `<table role="presentation" cellpadding="4" cellspacing="0" style="margin:8px 0 16px;font-size:14px">${c.detalle
        .map(
          ([k, v]) =>
            `<tr><td style="color:#6b6b6b;padding-right:12px">${esc(k)}</td><td>${esc(v)}</td></tr>`,
        )
        .join("")}</table>`
    : "";
  const botonHtml = enlace
    ? `<p style="margin:16px 0"><a href="${esc(enlace)}" style="background:#214B45;color:#E8E4D8;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block">${esc(c.boton!.texto)}</a></p>`
    : "";

  const html = `<!doctype html>
<html lang="es"><body style="margin:0;background:#E8E4D8;font-family:Arial,Helvetica,sans-serif;color:#383838">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" style="max-width:520px;background:#ffffff;border-radius:12px;overflow:hidden" cellpadding="0" cellspacing="0">
<tr><td style="background:#214B45;color:#E8E4D8;padding:16px 24px;font-size:18px;font-weight:bold">NeuroCres</td></tr>
<tr><td style="padding:24px">
<h1 style="margin:0 0 12px;font-size:20px;color:#214B45">${esc(c.titulo)}</h1>
<p style="margin:0 0 12px">${esc(saludo)}</p>
${c.parrafos.map((p) => `<p style="margin:0 0 12px">${esc(p)}</p>`).join("\n")}
${filasHtml}
${botonHtml}
</td></tr>
<tr><td style="padding:16px 24px;font-size:12px;color:#6b6b6b;border-top:1px solid #E8E4D8">
Este mensaje no incluye información clínica.
<a href="${esc(ctx.urlBase)}/privacidad" style="color:#214B45">Política de privacidad</a>
</td></tr>
</table></td></tr></table></body></html>`;

  return { asunto: c.asunto, texto, html };
}
