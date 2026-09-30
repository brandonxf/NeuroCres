"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { crearClienteServidor } from "@/lib/supabase/server";

export type Resultado = { error?: string; horarioOcupado?: boolean };

const esquema = z.object({
  slug: z.string().min(1),
  servicioId: z.string().uuid(),
  personaId: z.string().uuid("Elige para quién es la cita."),
  profesionalId: z.string().uuid(),
  inicio: z.string().datetime({ offset: true }),
  modalidad: z.enum(["presencial", "virtual"]),
  politicaId: z.string().uuid(),
  medio: z.enum(["transferencia", "llave", "qr", "nequi"], {
    message: "Elige el medio de pago.",
  }),
  acepto: z.literal(true, {
    message: "Marca que leíste y aceptas la política de cancelación.",
  }),
});

/** Reserva la cita con la función SQL transaccional y lleva a la pantalla del pago. */
export async function reservarCita(
  _previo: Resultado,
  formData: FormData,
): Promise<Resultado> {
  const parsed = esquema.safeParse({
    slug: formData.get("slug"),
    servicioId: formData.get("servicioId"),
    personaId: formData.get("personaId"),
    profesionalId: formData.get("profesionalId"),
    inicio: formData.get("inicio"),
    modalidad: formData.get("modalidad"),
    politicaId: formData.get("politicaId"),
    medio: formData.get("medio"),
    acepto: formData.get("acepto") === "on",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Revisa los datos." };
  }
  const v = parsed.data;

  const supabase = await crearClienteServidor();
  const { data: id, error } = await supabase.rpc("reservar_cita", {
    p_servicio_id: v.servicioId,
    p_persona_id: v.personaId,
    p_profesional_id: v.profesionalId,
    p_inicio: v.inicio,
    p_modalidad: v.modalidad,
    p_politica_id: v.politicaId,
    p_medio_pago: v.medio,
  });

  if (error || !id) {
    if (error?.code === "23P01") {
      return {
        error: "Ese horario acaba de ocuparse. Elige otro.",
        horarioOcupado: true,
      };
    }
    // Los mensajes de la función SQL (22023) ya están redactados para la persona.
    return {
      error:
        error?.code === "22023"
          ? error.message
          : error?.code === "42501"
            ? "No tienes permiso para agendar por esa persona."
            : "No pudimos reservar la cita. Intenta de nuevo en unos minutos.",
    };
  }

  redirect(`/mis-citas/${id}`);
}
