import { NextResponse } from "next/server";
import { urlFirmada } from "@/lib/almacenamiento";
import { crearClienteServidor } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Abre la constancia PDF de un consentimiento con una URL firmada de 60 segundos.
 * RLS decide quién puede leer el registro y Storage quién puede leer el archivo.
 */
export async function GET(
  _peticion: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!UUID.test(id)) return new NextResponse("No encontrado", { status: 404 });

  const supabase = await crearClienteServidor();
  const { data: consentimiento } = await supabase
    .from("consentimientos_firmados")
    .select("id, persona_id, constancia_path")
    .eq("id", id)
    .maybeSingle();
  if (!consentimiento?.constancia_path) {
    return new NextResponse("No encontrado", { status: 404 });
  }

  const url = await urlFirmada({
    bucket: "consentimientos",
    ruta: consentimiento.constancia_path,
    personaId: consentimiento.persona_id,
    accion: "consentimiento.visto",
    entidad: "consentimientos_firmados",
    entidadId: consentimiento.id,
  });
  if (!url) return new NextResponse("No encontrado", { status: 404 });

  return NextResponse.redirect(url);
}
