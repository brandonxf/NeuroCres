import Link from "next/link";
import { fromZonedTime } from "date-fns-tz";
import { EstadoCitaEtiqueta } from "@/components/app/estado-cita";
import { Aviso } from "@/components/ui/aviso";
import { BotonEnlace } from "@/components/ui/boton";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { Tarjeta } from "@/components/ui/tarjeta";
import { diaDeLaSemana } from "@/lib/agenda/horarios";
import {
  diaBogota,
  formatearFecha,
  formatearHora,
  hoyBogota,
  sumarDias,
} from "@/lib/fechas";
import { ESTADOS_PAGO } from "@/lib/pagos";
import { crearClienteServidor } from "@/lib/supabase/server";

const ZONA = "America/Bogota";

export default async function PaginaAgenda({
  searchParams,
}: {
  searchParams: Promise<{ vista?: string; fecha?: string; error?: string }>;
}) {
  const q = await searchParams;
  const vista = q.vista === "semana" ? "semana" : "dia";
  const fecha =
    q.fecha && /^\d{4}-\d{2}-\d{2}$/.test(q.fecha) ? q.fecha : hoyBogota();

  // Lunes de la semana de `fecha`.
  const desdeDia =
    vista === "semana"
      ? sumarDias(fecha, -((diaDeLaSemana(fecha) + 6) % 7))
      : fecha;
  const hastaDia = sumarDias(desdeDia, vista === "semana" ? 7 : 1);
  const desde = fromZonedTime(`${desdeDia}T00:00:00`, ZONA).toISOString();
  const hasta = fromZonedTime(`${hastaDia}T00:00:00`, ZONA).toISOString();

  const supabase = await crearClienteServidor();
  // RLS: la profesional ve solo sus citas; el administrador, todas.
  const { data: citas } = await supabase
    .from("citas")
    .select(
      "id, inicio, estado, modalidad, personas(nombres, apellidos), servicios(nombre), pagos(concepto, estado)",
    )
    .gte("inicio", desde)
    .lt("inicio", hasta)
    .order("inicio");

  const anterior = sumarDias(fecha, vista === "semana" ? -7 : -1);
  const siguiente = sumarDias(fecha, vista === "semana" ? 7 : 1);
  const enlace = (f: string, v = vista) =>
    `/profesional/agenda?vista=${v}&fecha=${f}`;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-primario text-2xl font-bold">Agenda</h1>
          <p className="text-suave mt-1 text-sm">
            {vista === "dia"
              ? formatearFecha(desdeDia)
              : `Semana del ${formatearFecha(desdeDia)}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <BotonEnlace
            href={enlace(anterior)}
            variante="secundario"
            tamano="sm"
          >
            ← Anterior
          </BotonEnlace>
          <BotonEnlace
            href={enlace(hoyBogota())}
            variante="secundario"
            tamano="sm"
          >
            Hoy
          </BotonEnlace>
          <BotonEnlace
            href={enlace(siguiente)}
            variante="secundario"
            tamano="sm"
          >
            Siguiente →
          </BotonEnlace>
          <BotonEnlace
            href={enlace(fecha, vista === "dia" ? "semana" : "dia")}
            variante="fantasma"
            tamano="sm"
          >
            Ver {vista === "dia" ? "semana" : "día"}
          </BotonEnlace>
        </div>
      </div>

      {q.error && <Aviso error={q.error} />}

      {!citas?.length ? (
        <EstadoVacio
          titulo="No hay citas en este período"
          descripcion="Las reservas nuevas aparecerán aquí."
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {citas.map((c) => {
            const anticipo = c.pagos?.find((p) => p.concepto === "anticipo");
            return (
              <li key={c.id}>
                <Link href={`/profesional/citas/${c.id}`}>
                  <Tarjeta className="hover:bg-primario/5 flex flex-wrap items-center justify-between gap-3 transition-colors">
                    <div>
                      <p className="text-primario font-semibold">
                        {vista === "semana" && (
                          <span className="text-suave mr-2 text-sm font-normal capitalize">
                            {formatearFecha(diaBogota(c.inicio))}
                          </span>
                        )}
                        {formatearHora(c.inicio)} · {c.personas?.nombres}{" "}
                        {c.personas?.apellidos}
                      </p>
                      <p className="text-sm">
                        {c.servicios?.nombre} · {c.modalidad}
                        {anticipo &&
                          ` · anticipo: ${ESTADOS_PAGO[anticipo.estado as keyof typeof ESTADOS_PAGO]}`}
                      </p>
                    </div>
                    <EstadoCitaEtiqueta estado={c.estado} />
                  </Tarjeta>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
