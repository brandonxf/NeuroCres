import { Aviso } from "@/components/ui/aviso";
import { Tabla } from "@/components/ui/tabla";
import { Tarjeta } from "@/components/ui/tarjeta";
import { formatearFecha } from "@/lib/fechas";
import { REGLAS_POR_DEFECTO, type ReglasPolitica } from "@/lib/politica";
import { crearClienteServidor } from "@/lib/supabase/server";
import { FormularioPolitica } from "./formulario-politica";

export default async function PaginaPolitica() {
  const supabase = await crearClienteServidor();
  const { data: versiones } = await supabase
    .from("politicas_versionadas")
    .select("id, version, activa, vigente_desde, reglas, contenido")
    .order("version", { ascending: false });

  const vigente = versiones?.find((v) => v.activa);
  const reglas = {
    ...REGLAS_POR_DEFECTO,
    ...((vigente?.reglas ?? {}) as Partial<ReglasPolitica>),
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-primario text-2xl font-bold">
          Política de cancelación
        </h1>
        <p className="text-suave mt-1 max-w-xl text-sm">
          Cada cambio crea una versión nueva. Cada cita guarda la versión que la
          persona aceptó al reservar.
        </p>
      </div>

      {vigente?.contenido.includes("BORRADOR") && (
        <Aviso
          tipo="atencion"
          mensaje="La política vigente es un BORRADOR. Confírmala con la profesional y un abogado antes de atender a personas reales."
        />
      )}

      <Tabla
        filas={versiones ?? []}
        idFila={(v) => v.id}
        columnas={[
          {
            clave: "version",
            titulo: "Versión",
            render: (v) => `v${v.version}`,
          },
          {
            clave: "desde",
            titulo: "Publicada",
            render: (v) => formatearFecha(v.vigente_desde.slice(0, 10)),
          },
          {
            clave: "estado",
            titulo: "Estado",
            render: (v) => (v.activa ? "Vigente" : "Anterior"),
          },
        ]}
      />

      <Tarjeta className="max-w-2xl p-6">
        <h2 className="text-primario mb-4 text-lg font-semibold">
          Publicar una versión nueva
        </h2>
        <FormularioPolitica
          reglas={reglas}
          contenido={vigente?.contenido ?? ""}
        />
      </Tarjeta>
    </div>
  );
}
