import { crearClienteServidor } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/tipos";
import {
  calcularHorariosLibres,
  PARAMETROS_AGENDA_POR_DEFECTO,
  ventanaDelDia,
  type Horario,
  type ParametrosAgenda,
} from "./horarios";

/** Une lo guardado en `configuracion` con los valores por defecto, ignorando lo inválido. */
export function normalizarParametros(valor: Json | null): ParametrosAgenda {
  const d = PARAMETROS_AGENDA_POR_DEFECTO;
  const v = (
    valor && typeof valor === "object" && !Array.isArray(valor) ? valor : {}
  ) as Record<string, Json | undefined>;
  const numero = (x: Json | undefined, por: number, min: number) =>
    typeof x === "number" && Number.isFinite(x) && x >= min ? x : por;

  return {
    descansoMin: numero(v.descanso_min, d.descansoMin, 0),
    antelacionMinHoras: numero(v.antelacion_min_horas, d.antelacionMinHoras, 0),
    horizonteDias: numero(v.horizonte_dias, d.horizonteDias, 1),
    granularidadMin: numero(v.granularidad_min, d.granularidadMin, 1),
  };
}

export async function obtenerParametrosAgenda(): Promise<ParametrosAgenda> {
  const supabase = await crearClienteServidor();
  const { data } = await supabase
    .from("configuracion")
    .select("valor")
    .eq("clave", "parametros_agenda")
    .maybeSingle();
  return normalizarParametros(data?.valor ?? null);
}

type Consulta = {
  profesionalId: string;
  /** Duración de la cita en minutos (la del servicio). */
  duracionMin: number;
  /** Modalidades que admite el servicio. */
  modalidadesServicio: string[];
  /** AAAA-MM-DD en la zona horaria de la profesional. */
  fecha: string;
  modalidad: "presencial" | "virtual";
};

/** Horarios libres de una profesional en un día. Requiere sesión (RLS + ocupacion_profesional). */
export async function horariosLibres(c: Consulta): Promise<Horario[]> {
  // Si el servicio no admite la modalidad pedida, no se ofrece nada.
  if (!c.modalidadesServicio.includes(c.modalidad)) return [];

  const supabase = await crearClienteServidor();

  const { data: profesional } = await supabase
    .from("profesionales")
    .select("zona_horaria, activo")
    .eq("id", c.profesionalId)
    .maybeSingle();
  if (!profesional?.activo) return [];

  const ventana = ventanaDelDia(c.fecha, profesional.zona_horaria);

  const [parametros, { data: franjas }, { data: ocupados }] = await Promise.all(
    [
      obtenerParametrosAgenda(),
      supabase
        .from("disponibilidad_semanal")
        .select("dia_semana, hora_inicio, hora_fin, modalidades")
        .eq("profesional_id", c.profesionalId),
      // Con margen de un día a cada lado: una cita cercana al cambio de día también estorba.
      supabase.rpc("ocupacion_profesional", {
        p_profesional_id: c.profesionalId,
        p_desde: new Date(ventana.inicio.getTime() - 864e5).toISOString(),
        p_hasta: new Date(ventana.fin.getTime() + 864e5).toISOString(),
      }),
    ],
  );

  return calcularHorariosLibres({
    fecha: c.fecha,
    zonaHoraria: profesional.zona_horaria,
    franjas: (franjas ?? []).map((f) => ({
      diaSemana: f.dia_semana,
      horaInicio: f.hora_inicio,
      horaFin: f.hora_fin,
      modalidades: f.modalidades,
    })),
    ocupados: (ocupados ?? []).map((o) => ({
      inicio: new Date(o.inicio),
      fin: new Date(o.fin),
    })),
    duracionMin: c.duracionMin,
    modalidad: c.modalidad,
    parametros,
    ahora: new Date(),
  });
}
