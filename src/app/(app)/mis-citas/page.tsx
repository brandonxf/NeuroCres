import Link from "next/link";
import { EstadoCitaEtiqueta } from "@/components/app/estado-cita";
import { BotonEnlace } from "@/components/ui/boton";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { Tarjeta } from "@/components/ui/tarjeta";
import { ESTADOS_ACTIVOS, type EstadoCita } from "@/lib/citas";
import { formatearFechaHora, instanteActual } from "@/lib/fechas";
import { personasDelUsuario } from "@/lib/personas";
import { formatearCop } from "@/lib/servicios";

export default async function PaginaMisCitas() {
  const { supabase, personas } = await personasDelUsuario();
  const ids = personas.map((p) => p.id);

  const { data: citas } = ids.length
    ? await supabase
        .from("citas")
        .select(
          "id, inicio, estado, modalidad, precio_cop, servicios(nombre), personas(nombres)",
        )
        .in("persona_id", ids)
        .order("inicio", { ascending: false })
    : { data: [] };

  const ahora = instanteActual().getTime();
  const proximas = (citas ?? [])
    .filter(
      (c) =>
        ESTADOS_ACTIVOS.includes(c.estado as EstadoCita) &&
        new Date(c.inicio).getTime() >= ahora,
    )
    .reverse();
  const pasadas = (citas ?? []).filter((c) => !proximas.includes(c));

  const fila = (c: NonNullable<typeof citas>[number]) => (
    <li key={c.id}>
      <Link href={`/mis-citas/${c.id}`}>
        <Tarjeta className="hover:bg-primario/5 flex flex-wrap items-center justify-between gap-3 transition-colors">
          <div>
            <p className="text-primario font-semibold">
              {c.servicios?.nombre ?? "Cita"}
            </p>
            <p className="text-sm capitalize">{formatearFechaHora(c.inicio)}</p>
            <p className="text-suave text-xs">
              {c.personas?.nombres} · {c.modalidad} ·{" "}
              {formatearCop(c.precio_cop)}
            </p>
          </div>
          <EstadoCitaEtiqueta estado={c.estado} />
        </Tarjeta>
      </Link>
    </li>
  );

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <h1 className="text-primario text-2xl font-bold">Mis citas</h1>
        <BotonEnlace href="/agendar">Agendar una cita</BotonEnlace>
      </div>

      {!citas?.length ? (
        <EstadoVacio
          titulo="Aún no tienes citas"
          descripcion="Cuando agendes una, la verás aquí con su estado y su pago."
          accion={<BotonEnlace href="/agendar">Agendar</BotonEnlace>}
        />
      ) : (
        <>
          <section aria-labelledby="proximas" className="flex flex-col gap-3">
            <h2 id="proximas" className="text-primario font-semibold">
              Próximas
            </h2>
            {proximas.length ? (
              <ul className="flex flex-col gap-3">{proximas.map(fila)}</ul>
            ) : (
              <p className="text-suave text-sm">No tienes citas próximas.</p>
            )}
          </section>
          {pasadas.length > 0 && (
            <section aria-labelledby="pasadas" className="flex flex-col gap-3">
              <h2 id="pasadas" className="text-primario font-semibold">
                Anteriores
              </h2>
              <ul className="flex flex-col gap-3">{pasadas.map(fila)}</ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
