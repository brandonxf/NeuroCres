import { notFound } from "next/navigation";
import { Tarjeta } from "@/components/ui/tarjeta";
import { crearClienteServidor } from "@/lib/supabase/server";
import type { DatosServicio } from "@/lib/validacion/servicios";
import { FormularioServicio } from "../formulario-servicio";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PaginaEditarServicio({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const supabase = await crearClienteServidor();
  const { data: s } = await supabase
    .from("servicios")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!s) notFound();

  const inicial: DatosServicio = {
    nombre: s.nombre,
    slug: s.slug,
    descripcion: s.descripcion ?? "",
    poblacion: s.poblacion ?? "",
    tipo: s.tipo as DatosServicio["tipo"],
    duracionMin: s.duracion_min === null ? "" : String(s.duracion_min),
    precioCop: String(s.precio_cop),
    anticipoPct: String(s.anticipo_pct),
    modalidades: s.modalidades as DatosServicio["modalidades"],
    requierePresencial: s.requiere_presencial,
    requiereConsentimiento: s.requiere_consentimiento,
    requiereFormulario: s.requiere_formulario,
    requiereAnticipo: s.requiere_anticipo,
    agendableEnLinea: s.agendable_en_linea,
    activo: s.activo,
    orden: String(s.orden),
  };

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6">
      <h1 className="text-primario text-2xl font-bold">Editar servicio</h1>
      <Tarjeta className="p-6">
        <FormularioServicio
          tipo="editar"
          id={s.id}
          slug={s.slug}
          inicial={inicial}
        />
      </Tarjeta>
    </div>
  );
}
