import Link from "next/link";
import { notFound } from "next/navigation";
import { Aviso } from "@/components/ui/aviso";
import { Boton } from "@/components/ui/boton";
import { Campo } from "@/components/ui/campo";
import { Tarjeta } from "@/components/ui/tarjeta";
import { horariosLibres, obtenerParametrosAgenda } from "@/lib/agenda/servidor";
import {
  formatearFecha,
  formatearFechaHora,
  formatearHora,
  hoyBogota,
  sumarDias,
} from "@/lib/fechas";
import { describirConsecuencia, type Consecuencia } from "@/lib/politica";
import { crearClienteServidor } from "@/lib/supabase/server";
import { reprogramarCita } from "../actions";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PaginaReprogramar({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ fecha?: string; error?: string }>;
}) {
  const { id } = await params;
  const q = await searchParams;
  if (!UUID.test(id)) notFound();

  const supabase = await crearClienteServidor();
  const { data: cita } = await supabase
    .from("citas")
    .select(
      "id, inicio, estado, modalidad, profesional_id, servicios(nombre, duracion_min, modalidades)",
    )
    .eq("id", id)
    .maybeSingle();
  if (!cita || !cita.servicios) notFound();

  const { data } =
    cita.estado === "confirmada"
      ? await supabase.rpc("calcular_consecuencia", {
          p_cita_id: id,
          p_accion: "reprogramar",
        })
      : { data: null };
  const consecuencia = data?.[0] as Consecuencia | undefined;
  const descripcion = consecuencia
    ? describirConsecuencia(consecuencia, "reprogramar")
    : null;

  const parametros = await obtenerParametrosAgenda();
  const hoy = hoyBogota();
  const maxima = sumarDias(hoy, parametros.horizonteDias);
  const fecha = q.fecha && /^\d{4}-\d{2}-\d{2}$/.test(q.fecha) ? q.fecha : hoy;

  const puede = Boolean(descripcion?.permitida) && cita.servicios.duracion_min;
  const horarios =
    puede && fecha >= hoy && fecha <= maxima
      ? await horariosLibres({
          profesionalId: cita.profesional_id,
          duracionMin: cita.servicios.duracion_min!,
          modalidadesServicio: cita.servicios.modalidades,
          fecha,
          modalidad: cita.modalidad as "presencial" | "virtual",
        })
      : [];

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div>
        <Link
          href={`/mis-citas/${id}`}
          className="text-primario text-sm underline"
        >
          ← Volver a la cita
        </Link>
        <h1 className="text-primario mt-2 text-2xl font-bold">
          Reprogramar la cita
        </h1>
        <p className="mt-1 text-sm capitalize">
          {cita.servicios.nombre} · ahora: {formatearFechaHora(cita.inicio)}
        </p>
      </div>

      {q.error && <Aviso error={q.error} />}

      {!descripcion ? (
        <Aviso tipo="info" mensaje="Solo se reprograman citas confirmadas." />
      ) : (
        <>
          <Aviso
            tipo={
              !descripcion.permitida
                ? "error"
                : descripcion.titulo.startsWith("Sin costo")
                  ? "exito"
                  : "atencion"
            }
          >
            <p className="font-medium">{descripcion.titulo}</p>
            <ul className="mt-1 list-disc pl-5">
              {descripcion.lineas.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          </Aviso>

          {puede && (
            <>
              <Tarjeta>
                <form method="get" className="flex flex-col gap-3">
                  <Campo
                    etiqueta="Nuevo día"
                    name="fecha"
                    type="date"
                    min={hoy}
                    max={maxima}
                    defaultValue={fecha}
                  />
                  <div>
                    <Boton type="submit" variante="secundario">
                      Ver horarios
                    </Boton>
                  </div>
                </form>
              </Tarjeta>

              <section aria-labelledby="horas" className="flex flex-col gap-3">
                <h2 id="horas" className="text-primario font-semibold">
                  Horarios libres · {formatearFecha(fecha)}
                </h2>
                {horarios.length === 0 ? (
                  <p className="text-suave text-sm">
                    No hay horarios libres ese día.
                  </p>
                ) : (
                  <ul className="flex flex-wrap gap-2">
                    {horarios.map((h) => (
                      <li key={h.inicio.toISOString()}>
                        <form
                          action={reprogramarCita.bind(
                            null,
                            id,
                            h.inicio.toISOString(),
                          )}
                        >
                          <Boton
                            type="submit"
                            variante="secundario"
                            tamano="sm"
                          >
                            {formatearHora(h.inicio)}
                          </Boton>
                        </form>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="text-suave text-xs">
                  Al elegir una hora, la cita se reprograma de inmediato.
                </p>
              </section>
            </>
          )}
        </>
      )}
    </div>
  );
}
