import type { Metadata } from "next";
import { EncabezadoPublico } from "@/components/app/encabezado-publico";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { Tarjeta } from "@/components/ui/tarjeta";
import {
  calcularAnticipo,
  formatearCop,
  textoModalidades,
  TIPOS_SERVICIO,
  type TipoServicio,
} from "@/lib/servicios";
import { crearClienteServidor } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Servicios · NeuroCres",
  description:
    "Atención psicológica, neuropsicología, rehabilitación cognitiva y más: servicios, precios y modalidades.",
};

export default async function PaginaServicios() {
  const supabase = await crearClienteServidor();
  // Sin sesión, RLS solo entrega los servicios activos.
  const { data: servicios } = await supabase
    .from("servicios")
    .select("*")
    .eq("activo", true)
    .order("orden")
    .order("nombre");

  return (
    <>
      <EncabezadoPublico />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 pt-6 pb-16">
        <div className="max-w-2xl">
          <h1 className="text-primario text-3xl font-bold">Servicios</h1>
          <p className="text-suave mt-2">
            Precios en pesos colombianos. Para agendar una cita individual se
            paga un anticipo; el saldo se paga el día de la cita.
          </p>
        </div>

        {!servicios?.length ? (
          <EstadoVacio
            titulo="Pronto publicaremos los servicios"
            descripcion="Vuelve en unos días."
          />
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {servicios.map((s) => {
              const { anticipo } = calcularAnticipo(
                s.precio_cop,
                s.anticipo_pct,
              );
              return (
                <li key={s.id}>
                  <Tarjeta className="flex h-full flex-col gap-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <h2 className="text-primario text-lg font-semibold">
                        {s.nombre}
                      </h2>
                      <span className="bg-secundario/40 text-primario rounded-full px-2.5 py-0.5 text-xs">
                        {TIPOS_SERVICIO[s.tipo as TipoServicio] ?? s.tipo}
                      </span>
                    </div>
                    {s.descripcion && (
                      <p className="text-sm">{s.descripcion}</p>
                    )}
                    {s.poblacion && (
                      <p className="text-suave text-sm">
                        Dirigido a: {s.poblacion}
                      </p>
                    )}
                    <dl className="mt-auto grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                      <dt className="text-suave">Precio</dt>
                      <dd className="font-semibold">
                        {s.tipo === "grupal" && "Desde "}
                        {formatearCop(s.precio_cop)}
                        {s.tipo === "grupal" && " por persona"}
                      </dd>
                      {s.duracion_min && (
                        <>
                          <dt className="text-suave">Duración</dt>
                          <dd>{s.duracion_min} min aprox.</dd>
                        </>
                      )}
                      <dt className="text-suave">Modalidad</dt>
                      <dd>{textoModalidades(s.modalidades)}</dd>
                      {s.agendable_en_linea && s.requiere_anticipo && (
                        <>
                          <dt className="text-suave">Anticipo</dt>
                          <dd>
                            {s.anticipo_pct}% · {formatearCop(anticipo)}
                          </dd>
                        </>
                      )}
                    </dl>
                    <p className="text-primario text-sm font-medium">
                      {s.agendable_en_linea
                        ? "Se agenda en línea"
                        : "Consultar disponibilidad"}
                    </p>
                  </Tarjeta>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </>
  );
}
