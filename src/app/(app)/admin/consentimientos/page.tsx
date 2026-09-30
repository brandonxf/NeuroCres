import { Aviso } from "@/components/ui/aviso";
import { Tabla } from "@/components/ui/tabla";
import { Tarjeta } from "@/components/ui/tarjeta";
import { formatearFecha } from "@/lib/fechas";
import { crearClienteServidor } from "@/lib/supabase/server";
import {
  TIPOS_CONSENTIMIENTO,
  type TipoConsentimiento,
} from "@/lib/validacion/consentimientos";
import { FormularioPlantilla } from "./formulario-plantilla";

export default async function PaginaPlantillas() {
  const supabase = await crearClienteServidor();
  const { data: plantillas } = await supabase
    .from("plantillas_consentimiento")
    .select("id, tipo, version, titulo, activa, vigente_desde, contenido")
    .order("tipo")
    .order("version", { ascending: false });

  const hayBorradores = (plantillas ?? []).some(
    (p) => p.activa && p.contenido.includes("BORRADOR"),
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-primario text-2xl font-bold">
          Consentimientos y autorizaciones
        </h1>
        <p className="text-suave mt-1 max-w-xl text-sm">
          Cada cambio de texto crea una versión nueva. Lo ya firmado no se
          modifica.
        </p>
      </div>

      {hayBorradores && (
        <Aviso
          tipo="atencion"
          mensaje="Hay textos vigentes marcados como BORRADOR. Un abogado debe revisarlos y publicarse la versión final antes de atender a personas reales."
        />
      )}

      <Tabla
        filas={plantillas ?? []}
        idFila={(p) => p.id}
        columnas={[
          {
            clave: "tipo",
            titulo: "Tipo",
            render: (p) => TIPOS_CONSENTIMIENTO[p.tipo as TipoConsentimiento],
          },
          { clave: "titulo", titulo: "Título", render: (p) => p.titulo },
          {
            clave: "version",
            titulo: "Versión",
            render: (p) => `v${p.version}`,
          },
          {
            clave: "desde",
            titulo: "Publicada",
            render: (p) => formatearFecha(p.vigente_desde.slice(0, 10)),
          },
          {
            clave: "estado",
            titulo: "Estado",
            render: (p) => (p.activa ? "Vigente" : "Anterior"),
          },
        ]}
      />

      <Tarjeta className="max-w-2xl p-6">
        <h2 className="text-primario mb-4 text-lg font-semibold">
          Publicar una versión nueva
        </h2>
        <FormularioPlantilla />
      </Tarjeta>
    </div>
  );
}
