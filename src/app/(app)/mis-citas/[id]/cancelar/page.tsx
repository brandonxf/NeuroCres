import Link from "next/link";
import { notFound } from "next/navigation";
import { Aviso } from "@/components/ui/aviso";
import { Tarjeta } from "@/components/ui/tarjeta";
import { formatearFechaHora } from "@/lib/fechas";
import { describirConsecuencia, type Consecuencia } from "@/lib/politica";
import { crearClienteServidor } from "@/lib/supabase/server";
import { FormularioCancelar } from "../formularios";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PaginaCancelar({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const supabase = await crearClienteServidor();
  const { data: cita } = await supabase
    .from("citas")
    .select("id, inicio, estado, servicios(nombre)")
    .eq("id", id)
    .maybeSingle();
  if (!cita) notFound();

  const cancelable = ["pendiente_pago", "confirmada"].includes(cita.estado);
  // La consecuencia exacta en pesos, calculada por la base de datos con la política vigente.
  const { data } = cancelable
    ? await supabase.rpc("calcular_consecuencia", {
        p_cita_id: id,
        p_accion: "cancelar",
      })
    : { data: null };
  const consecuencia = data?.[0] as Consecuencia | undefined;
  const descripcion = consecuencia
    ? describirConsecuencia(consecuencia, "cancelar")
    : null;

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6">
      <div>
        <Link
          href={`/mis-citas/${id}`}
          className="text-primario text-sm underline"
        >
          ← Volver a la cita
        </Link>
        <h1 className="text-primario mt-2 text-2xl font-bold">
          Cancelar la cita
        </h1>
        <p className="mt-1 text-sm capitalize">
          {cita.servicios?.nombre} · {formatearFechaHora(cita.inicio)}
        </p>
      </div>

      {!cancelable ? (
        <Aviso tipo="info" mensaje="Esta cita ya no se puede cancelar." />
      ) : (
        <>
          {descripcion && (
            <Aviso
              tipo={
                descripcion.titulo.startsWith("Sin costo")
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
          )}
          <Tarjeta className="p-6">
            <FormularioCancelar citaId={id} />
          </Tarjeta>
        </>
      )}
    </div>
  );
}
