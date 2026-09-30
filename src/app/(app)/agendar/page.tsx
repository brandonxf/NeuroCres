import { BotonEnlace } from "@/components/ui/boton";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { Tarjeta } from "@/components/ui/tarjeta";
import {
  calcularAnticipo,
  formatearCop,
  textoModalidades,
} from "@/lib/servicios";
import { crearClienteServidor } from "@/lib/supabase/server";

export default async function PaginaAgendar() {
  const supabase = await crearClienteServidor();
  const { data: servicios } = await supabase
    .from("servicios")
    .select("*")
    .eq("activo", true)
    .eq("agendable_en_linea", true)
    .order("orden");

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-primario text-2xl font-bold">Agendar una cita</h1>
        <p className="text-suave mt-1 text-sm">
          Paso 1 de 3 · Elige el servicio. Para confirmar la cita se paga un
          anticipo; el saldo se paga el día de la cita.
        </p>
      </div>

      {!servicios?.length ? (
        <EstadoVacio
          titulo="Aún no hay servicios para agendar en línea"
          descripcion="Vuelve pronto o consulta el catálogo."
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {servicios.map((s) => (
            <li key={s.id}>
              <Tarjeta className="flex flex-wrap items-center justify-between gap-4">
                <div className="max-w-md">
                  <h2 className="text-primario font-semibold">{s.nombre}</h2>
                  {s.descripcion && (
                    <p className="text-suave mt-1 text-sm">{s.descripcion}</p>
                  )}
                  <p className="mt-2 text-sm">
                    <strong>{formatearCop(s.precio_cop)}</strong>
                    {s.duracion_min && ` · ${s.duracion_min} min`} ·{" "}
                    {textoModalidades(s.modalidades)}
                  </p>
                  {s.requiere_anticipo && (
                    <p className="text-suave text-xs">
                      Anticipo{" "}
                      {formatearCop(
                        calcularAnticipo(s.precio_cop, s.anticipo_pct).anticipo,
                      )}
                    </p>
                  )}
                </div>
                <BotonEnlace href={`/agendar/${s.slug}`}>Elegir</BotonEnlace>
              </Tarjeta>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
