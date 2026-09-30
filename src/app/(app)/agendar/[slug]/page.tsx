import Link from "next/link";
import { notFound } from "next/navigation";
import { Aviso } from "@/components/ui/aviso";
import { Boton } from "@/components/ui/boton";
import { Campo } from "@/components/ui/campo";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { Selector } from "@/components/ui/selector";
import { Tarjeta } from "@/components/ui/tarjeta";
import { horariosLibres, obtenerParametrosAgenda } from "@/lib/agenda/servidor";
import { obtenerConfiguracion } from "@/lib/configuracion";
import {
  formatearFecha,
  formatearHora,
  hoyBogota,
  sumarDias,
} from "@/lib/fechas";
import { MODALIDADES, type Modalidad } from "@/lib/servicios";
import { crearClienteServidor } from "@/lib/supabase/server";

export default async function PaginaElegirHorario({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ modalidad?: string; fecha?: string }>;
}) {
  const { slug } = await params;
  const consulta = await searchParams;
  const supabase = await crearClienteServidor();

  const { data: servicio } = await supabase
    .from("servicios")
    .select("*")
    .eq("slug", slug)
    .eq("activo", true)
    .eq("agendable_en_linea", true)
    .maybeSingle();
  if (!servicio || !servicio.duracion_min) notFound();

  const { data: profesionales } = await supabase
    .from("profesionales")
    .select("id, nombre_publico")
    .eq("activo", true)
    .order("created_at")
    .limit(1);
  const profesional = profesionales?.[0];

  const modalidadesServicio = servicio.modalidades as Modalidad[];
  const modalidad: Modalidad = modalidadesServicio.includes(
    consulta.modalidad as Modalidad,
  )
    ? (consulta.modalidad as Modalidad)
    : modalidadesServicio[0];

  const parametros = await obtenerParametrosAgenda();
  const hoy = hoyBogota();
  const maxima = sumarDias(hoy, parametros.horizonteDias);
  const fecha =
    consulta.fecha && /^\d{4}-\d{2}-\d{2}$/.test(consulta.fecha)
      ? consulta.fecha
      : hoy;

  const horarios =
    profesional && fecha >= hoy && fecha <= maxima
      ? await horariosLibres({
          profesionalId: profesional.id,
          duracionMin: servicio.duracion_min,
          modalidadesServicio,
          fecha,
          modalidad,
        })
      : [];

  const direccion =
    modalidad === "presencial"
      ? await obtenerConfiguracion<string>("direccion_consultorio")
      : null;

  const opcionesModalidad = Object.fromEntries(
    modalidadesServicio.map((m) => [m, MODALIDADES[m]]),
  );

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div>
        <Link href="/agendar" className="text-primario text-sm underline">
          ← Cambiar servicio
        </Link>
        <h1 className="text-primario mt-2 text-2xl font-bold">
          {servicio.nombre}
        </h1>
        <p className="text-suave mt-1 text-sm">
          Paso 2 de 3 · Elige la modalidad, el día y la hora. Las horas son de
          Bogotá.
        </p>
      </div>

      {!profesional ? (
        <EstadoVacio
          titulo="Aún no hay agenda disponible"
          descripcion="Vuelve pronto o escríbenos."
        />
      ) : (
        <>
          <Tarjeta>
            <form method="get" className="flex flex-col gap-3">
              <div className="grid gap-3 sm:grid-cols-2">
                {modalidadesServicio.length > 1 ? (
                  <Selector
                    etiqueta="Modalidad"
                    name="modalidad"
                    opciones={opcionesModalidad}
                    defaultValue={modalidad}
                  />
                ) : (
                  <input type="hidden" name="modalidad" value={modalidad} />
                )}
                <Campo
                  etiqueta="Día"
                  name="fecha"
                  type="date"
                  min={hoy}
                  max={maxima}
                  defaultValue={fecha}
                />
              </div>
              <div>
                <Boton type="submit" variante="secundario">
                  Ver horarios
                </Boton>
              </div>
            </form>
          </Tarjeta>

          {direccion && (
            <Aviso
              tipo="info"
              mensaje={`Dirección del consultorio: ${direccion}`}
            />
          )}

          <section aria-labelledby="horas" className="flex flex-col gap-3">
            <h2 id="horas" className="text-primario font-semibold">
              Horarios libres · {formatearFecha(fecha)}
            </h2>
            {horarios.length === 0 ? (
              <p className="text-suave text-sm">
                No hay horarios libres ese día. Prueba con otro día
                {modalidadesServicio.length > 1 ? " u otra modalidad" : ""}.
              </p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {horarios.map((h) => (
                  <li key={h.inicio.toISOString()}>
                    <Link
                      href={`/agendar/${slug}/reservar?inicio=${encodeURIComponent(h.inicio.toISOString())}&modalidad=${modalidad}&profesional=${profesional.id}`}
                      className="border-primario text-primario hover:bg-primario hover:text-fondo inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-medium transition-colors"
                    >
                      {formatearHora(h.inicio)}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-suave text-xs">
              Puedes reservar con {parametros.antelacionMinHoras} horas de
              antelación y hasta {parametros.horizonteDias} días adelante.
            </p>
          </section>
        </>
      )}
    </div>
  );
}
