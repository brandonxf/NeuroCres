import Link from "next/link";
import { notFound } from "next/navigation";
import { Aviso } from "@/components/ui/aviso";
import { BotonEnlace } from "@/components/ui/boton";
import { Markdown } from "@/components/ui/markdown";
import { Tarjeta } from "@/components/ui/tarjeta";
import { calcularEdad, formatearFecha } from "@/lib/fechas";
import { obtenerConfiguracion } from "@/lib/configuracion";
import { personasDelUsuario } from "@/lib/personas";
import { crearClienteServidor } from "@/lib/supabase/server";
import {
  CALIDADES_FIRMANTE,
  TIPOS_CONSENTIMIENTO,
  type TipoConsentimiento,
} from "@/lib/validacion/consentimientos";
import { FirmaConsentimiento } from "./firma-consentimiento";

export default async function PaginaConsentimientos({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { user, personas, responsable } = await personasDelUsuario();
  const persona = personas.find((p) => p.id === id);
  if (!persona) notFound();

  const supabase = await crearClienteServidor();
  const [{ data: pendientes }, { data: firmados }, edadAsentimiento] =
    await Promise.all([
      supabase.rpc("consentimientos_pendientes", { p_persona_id: persona.id }),
      supabase
        .from("consentimientos_firmados")
        .select(
          "id, firmado_at, calidad, constancia_path, plantillas_consentimiento(titulo, version, tipo)",
        )
        .eq("persona_id", persona.id)
        .order("firmado_at", { ascending: false }),
      obtenerConfiguracion<number>("edad_asentimiento"),
    ]);

  const ids = (pendientes ?? []).map((p) => p.plantilla_id);
  const { data: plantillas } = ids.length
    ? await supabase
        .from("plantillas_consentimiento")
        .select("id, titulo, contenido, tipo")
        .in("id", ids)
    : { data: [] };

  const edad = calcularEdad(persona.fecha_nacimiento);
  const esMenor = edad < 18;
  const esPropia = persona.usuario_id === user.id;
  const conAsentimiento =
    esMenor &&
    edad >= (typeof edadAsentimiento === "number" ? edadAsentimiento : 12);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div>
        <Link href="/mis-personas" className="text-primario text-sm underline">
          ← Mis personas
        </Link>
        <h1 className="text-primario mt-2 text-2xl font-bold">
          Consentimientos de {persona.nombres}
        </h1>
        <p className="text-suave mt-1 text-sm">
          {esMenor
            ? "Como responsable legal, firmas en nombre del menor."
            : "Estos textos son requisito para agendar una cita."}
        </p>
      </div>

      {pendientes?.length === 0 ? (
        <Aviso tipo="exito" mensaje="Todo firmado: ya puedes agendar citas." />
      ) : (
        <Aviso
          tipo="atencion"
          mensaje={`Faltan ${pendientes?.length ?? 0} por firmar antes de agendar.`}
        />
      )}

      {(plantillas ?? []).map((pl) => (
        <FirmaConsentimiento
          key={pl.id}
          personaId={persona.id}
          plantillaId={pl.id}
          titulo={pl.titulo}
          nombreSugerido={esPropia ? responsable.nombre : ""}
          documentoSugerido={
            esPropia
              ? `${persona.tipo_documento} ${persona.numero_documento}`
              : ""
          }
          requiereAsentimiento={pl.tipo === "menores" && conAsentimiento}
        >
          <Markdown>{pl.contenido}</Markdown>
        </FirmaConsentimiento>
      ))}

      {firmados && firmados.length > 0 && (
        <section aria-labelledby="firmados" className="flex flex-col gap-3">
          <h2 id="firmados" className="text-primario text-lg font-semibold">
            Firmados
          </h2>
          <ul className="flex flex-col gap-2">
            {firmados.map((f) => (
              <li key={f.id}>
                <Tarjeta className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">
                      {f.plantillas_consentimiento?.titulo ??
                        TIPOS_CONSENTIMIENTO[
                          f.plantillas_consentimiento
                            ?.tipo as TipoConsentimiento
                        ]}
                    </p>
                    <p className="text-suave text-sm">
                      Versión {f.plantillas_consentimiento?.version} · firmado
                      el {formatearFecha(f.firmado_at.slice(0, 10))} ·{" "}
                      {
                        CALIDADES_FIRMANTE[
                          f.calidad as keyof typeof CALIDADES_FIRMANTE
                        ]
                      }
                    </p>
                  </div>
                  {f.constancia_path && (
                    <BotonEnlace
                      href={`/consentimientos/${f.id}/constancia`}
                      variante="secundario"
                      tamano="sm"
                      target="_blank"
                    >
                      Ver constancia (PDF)
                    </BotonEnlace>
                  )}
                </Tarjeta>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
