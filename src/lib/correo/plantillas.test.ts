import { describe, expect, it } from "vitest";
import {
  armarCorreo,
  type PayloadNotificacion,
  type TipoNotificacion,
} from "./plantillas";

const ctx = {
  urlBase: "https://neurocres.vercel.app",
  direccion: "Calle 1 # 2-3",
};
const base: PayloadNotificacion = {
  cita_id: "c1",
  inicio: "2026-10-06T15:00:00Z",
  fin: "2026-10-06T16:00:00Z",
  modalidad: "presencial",
  servicio: "Atención Psicológica Individual",
  expira_cupo_at: "2026-10-01T22:00:00Z",
  persona_id: "p1",
};

const TIPOS: TipoNotificacion[] = [
  "reserva_recibida",
  "comprobante_recibido",
  "pago_verificado",
  "pago_rechazado",
  "cupo_por_vencer",
  "recordatorio_24h",
  "recordatorio_2h",
  "cita_cancelada",
  "cita_reprogramada",
  "constancia_consentimiento",
];

describe("armarCorreo", () => {
  it.each(TIPOS)("arma un correo completo para %s", (tipo) => {
    const c = armarCorreo(tipo, base, ctx, "Ana");
    expect(c.asunto.length).toBeGreaterThan(5);
    expect(c.texto).toContain("Hola, Ana.");
    expect(c.texto).toContain("no incluye información clínica");
    expect(c.html).toContain("NeuroCres");
    expect(c.html).toContain("/privacidad");
  });

  it("muestra la hora de Bogotá, no la de UTC", () => {
    const c = armarCorreo("reserva_recibida", base, ctx);
    expect(c.texto).toContain("10:00");
    expect(c.texto).not.toContain("15:00");
    expect(c.texto).not.toContain("3:00");
  });

  it("la confirmación de una cita presencial incluye la dirección", () => {
    const c = armarCorreo("pago_verificado", base, ctx);
    expect(c.texto).toContain("Dirección: Calle 1 # 2-3");
  });

  it("la reserva pendiente aún no revela la dirección", () => {
    const c = armarCorreo("reserva_recibida", base, ctx);
    expect(c.texto).not.toContain("Calle 1");
  });

  it("una cita virtual confirmada remite a la cuenta, sin exponer un enlace", () => {
    const c = armarCorreo(
      "recordatorio_2h",
      { ...base, modalidad: "virtual" },
      ctx,
    );
    expect(c.texto).toContain("Lo encuentras en tu cuenta");
    expect(c.texto).not.toMatch(/https?:\/\/(meet|zoom)/);
  });

  it("el rechazo explica el motivo predefinido", () => {
    const c = armarCorreo(
      "pago_rechazado",
      { ...base, motivo: "monto_incorrecto" },
      ctx,
    );
    expect(c.texto).toContain("El monto no es el correcto");
  });

  it("una cancelación por cupo vencido lo explica", () => {
    const c = armarCorreo(
      "cita_cancelada",
      { ...base, por_cupo_vencido: true },
      ctx,
    );
    expect(c.texto).toContain("venció el tiempo");
  });

  it("la reprogramación muestra la fecha anterior y la nueva", () => {
    const c = armarCorreo(
      "cita_reprogramada",
      { ...base, inicio_anterior: "2026-10-05T15:00:00Z" },
      ctx,
    );
    expect(c.texto).toContain("Antes:");
    expect(c.texto).toContain("Ahora:");
  });

  it("los avisos de la profesional enlazan a su agenda y pagos", () => {
    expect(
      armarCorreo("cita_cancelada", { ...base, para_profesional: true }, ctx)
        .texto,
    ).toContain("/profesional/agenda");
    expect(armarCorreo("comprobante_recibido", base, ctx).texto).toContain(
      "/profesional/pagos",
    );
  });

  it("escapa el HTML de los datos que vienen de fuera", () => {
    const c = armarCorreo(
      "reserva_recibida",
      { ...base, servicio: '<script>alert("x")</script>' },
      ctx,
      "<b>Ana</b>",
    );
    expect(c.html).not.toContain("<script>");
    expect(c.html).not.toContain("<b>Ana</b>");
    expect(c.html).toContain("&lt;script&gt;");
  });
});
