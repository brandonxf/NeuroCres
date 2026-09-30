import { BotonEnlace } from "@/components/ui/boton";
import { Tabla } from "@/components/ui/tabla";
import { formatearFecha } from "@/lib/fechas";
import { crearClienteServidor } from "@/lib/supabase/server";
import { CALIDADES_FIRMANTE } from "@/lib/validacion/consentimientos";

export default async function PaginaConsentimientosProfesional() {
  const supabase = await crearClienteServidor();
  const { data: firmados } = await supabase
    .from("consentimientos_firmados")
    .select(
      "id, firmado_at, calidad, firmante_nombre, constancia_path, personas(nombres, apellidos), plantillas_consentimiento(titulo, version)",
    )
    .order("firmado_at", { ascending: false })
    .limit(100);

  return (
    <>
      <div>
        <h1 className="text-primario text-2xl font-bold">
          Consentimientos firmados
        </h1>
        <p className="text-suave mt-1 max-w-xl text-sm">
          Constancias de los últimos 100 consentimientos. Cada vez que abres una
          constancia queda registrado en la auditoría.
        </p>
      </div>
      <Tabla
        filas={firmados ?? []}
        idFila={(f) => f.id}
        vacio={{ titulo: "Aún no hay consentimientos firmados" }}
        columnas={[
          {
            clave: "persona",
            titulo: "Persona",
            render: (f) =>
              f.personas
                ? `${f.personas.nombres} ${f.personas.apellidos}`
                : "—",
          },
          {
            clave: "texto",
            titulo: "Texto",
            render: (f) =>
              `${f.plantillas_consentimiento?.titulo ?? "—"} (v${f.plantillas_consentimiento?.version ?? "?"})`,
          },
          {
            clave: "firmante",
            titulo: "Firmó",
            render: (f) =>
              `${f.firmante_nombre} · ${CALIDADES_FIRMANTE[f.calidad as keyof typeof CALIDADES_FIRMANTE]}`,
          },
          {
            clave: "fecha",
            titulo: "Fecha",
            render: (f) => formatearFecha(f.firmado_at.slice(0, 10)),
          },
          {
            clave: "constancia",
            titulo: "Constancia",
            render: (f) =>
              f.constancia_path ? (
                <BotonEnlace
                  href={`/consentimientos/${f.id}/constancia`}
                  variante="secundario"
                  tamano="sm"
                  target="_blank"
                >
                  Abrir PDF
                </BotonEnlace>
              ) : (
                <span className="text-suave">Sin PDF</span>
              ),
          },
        ]}
      />
    </>
  );
}
