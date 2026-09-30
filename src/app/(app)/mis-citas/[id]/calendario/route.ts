import { NextResponse } from "next/server";
import { obtenerConfiguracion } from "@/lib/configuracion";
import { generarIcs } from "@/lib/ics";
import { crearClienteServidor } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Archivo .ics de una cita confirmada. Sin información clínica: solo servicio, hora y lugar. */
export async function GET(
  _peticion: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!UUID.test(id)) return new NextResponse("No encontrado", { status: 404 });

  const supabase = await crearClienteServidor();
  const { data: cita } = await supabase
    .from("citas")
    .select("id, inicio, fin, modalidad, estado, servicios(nombre)")
    .eq("id", id)
    .maybeSingle();
  if (!cita || cita.estado !== "confirmada") {
    return new NextResponse("No encontrado", { status: 404 });
  }

  const direccion =
    cita.modalidad === "presencial"
      ? await obtenerConfiguracion<string>("direccion_consultorio")
      : null;

  const ics = generarIcs({
    uid: cita.id,
    titulo: `${cita.servicios?.nombre ?? "Cita"} · NeuroCres`,
    inicio: new Date(cita.inicio),
    fin: new Date(cita.fin),
    lugar: direccion || (cita.modalidad === "virtual" ? "Virtual" : undefined),
    descripcion:
      cita.modalidad === "virtual"
        ? "Cita virtual. El enlace está en tu cuenta de NeuroCres."
        : undefined,
  });

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="cita-neurocres.ics"',
    },
  });
}
