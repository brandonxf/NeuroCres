import { NextResponse } from "next/server";
import { urlFirmada } from "@/lib/almacenamiento";
import { crearClienteServidor } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Abre un comprobante de pago con una URL firmada de 60 segundos. RLS decide quién puede leer
 * el registro (la familia, la profesional de la cita y el administrador); cada apertura queda
 * en la auditoría.
 */
export async function GET(
  _peticion: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!UUID.test(id)) return new NextResponse("No encontrado", { status: 404 });

  const supabase = await crearClienteServidor();
  const { data: comprobante } = await supabase
    .from("comprobantes_pago")
    .select("id, storage_path, pagos(id, citas(persona_id))")
    .eq("id", id)
    .maybeSingle();
  const personaId = comprobante?.pagos?.citas?.persona_id;
  if (!comprobante || !personaId) {
    return new NextResponse("No encontrado", { status: 404 });
  }

  const url = await urlFirmada({
    bucket: "comprobantes",
    ruta: comprobante.storage_path,
    personaId,
    accion: "comprobante.visto",
    entidad: "comprobantes_pago",
    entidadId: comprobante.id,
  });
  if (!url) return new NextResponse("No encontrado", { status: 404 });

  return NextResponse.redirect(url);
}
