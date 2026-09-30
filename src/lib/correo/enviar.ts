import type { Correo } from "./plantillas";

export type ResultadoEnvio = { ok: true } | { ok: false; error: string };

/**
 * Envía un correo con Resend. Mientras no haya un dominio verificado en Resend, el remitente
 * de prueba (onboarding@resend.dev) solo entrega al correo dueño de la cuenta de Resend.
 */
export async function enviarCorreo(
  para: string,
  correo: Correo,
): Promise<ResultadoEnvio> {
  const clave = process.env.RESEND_API_KEY;
  if (!clave) return { ok: false, error: "Falta RESEND_API_KEY" };

  const de = process.env.EMAIL_FROM || "NeuroCres <onboarding@resend.dev>";
  try {
    const respuesta = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${clave}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: de,
        to: [para],
        subject: correo.asunto,
        text: correo.texto,
        html: correo.html,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!respuesta.ok) {
      const cuerpo = await respuesta.text().catch(() => "");
      return {
        ok: false,
        error: `Resend ${respuesta.status}: ${cuerpo}`.slice(0, 400),
      };
    }
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: (e instanceof Error ? e.message : "Error de red").slice(0, 400),
    };
  }
}
