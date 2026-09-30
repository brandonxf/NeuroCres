import Link from "next/link";
import { Aviso } from "@/components/ui/aviso";
import { Boton, BotonEnlace } from "@/components/ui/boton";
import { CLASES_CONTROL } from "@/components/ui/campo";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { Tarjeta } from "@/components/ui/tarjeta";
import { cn } from "@/lib/cn";
import { formatearFechaHora } from "@/lib/fechas";
import { MEDIOS_PAGO, MOTIVOS_RECHAZO, type MedioPago } from "@/lib/pagos";
import { formatearCop } from "@/lib/servicios";
import { crearClienteServidor } from "@/lib/supabase/server";
import {
  marcarDevolucionRealizada,
  rechazarPago,
  verificarPago,
} from "../acciones";

export default async function PaginaPagos({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const q = await searchParams;
  const supabase = await crearClienteServidor();

  const [
    { data: porVerificar },
    { data: sinComprobante },
    { data: devoluciones },
  ] = await Promise.all([
    supabase
      .from("pagos")
      .select(
        "id, monto_cop, medio, referencia, cita_id, comprobantes_pago(id, subido_at), citas(inicio, expira_cupo_at, estado, personas(nombres, apellidos), servicios(nombre))",
      )
      .eq("estado", "comprobante_recibido")
      .eq("concepto", "anticipo"),
    supabase
      .from("pagos")
      .select("id", { count: "exact", head: false })
      .eq("estado", "pendiente")
      .eq("concepto", "anticipo"),
    supabase
      .from("devoluciones")
      .select(
        "id, monto_cop, created_at, cita_id, citas(personas(nombres, apellidos))",
      )
      .eq("estado", "pendiente")
      .order("created_at"),
  ]);

  // Los cupos que vencen primero, arriba.
  const cola = [...(porVerificar ?? [])].sort((a, b) =>
    (a.citas?.expira_cupo_at ?? "9").localeCompare(
      b.citas?.expira_cupo_at ?? "9",
    ),
  );

  return (
    <div className="flex max-w-3xl flex-col gap-8">
      <div>
        <h1 className="text-primario text-2xl font-bold">
          Pagos por verificar
        </h1>
        <p className="text-suave mt-1 text-sm">
          Primero los cupos que vencen antes.{" "}
          {sinComprobante?.length
            ? `${sinComprobante.length} reservas más esperan que la persona suba su comprobante.`
            : ""}
        </p>
      </div>

      {q.error && <Aviso error={q.error} />}

      {cola.length === 0 ? (
        <EstadoVacio
          titulo="No hay comprobantes por verificar"
          descripcion="Cuando alguien suba uno, aparecerá aquí."
        />
      ) : (
        <ul className="flex flex-col gap-4">
          {cola.map((p) => {
            const ultimo = [...(p.comprobantes_pago ?? [])].sort((a, b) =>
              b.subido_at.localeCompare(a.subido_at),
            )[0];
            return (
              <li key={p.id}>
                <Tarjeta className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-primario font-semibold">
                        {p.citas?.personas?.nombres}{" "}
                        {p.citas?.personas?.apellidos}
                      </p>
                      <p className="text-sm">
                        {p.citas?.servicios?.nombre} ·{" "}
                        <span className="capitalize">
                          {p.citas ? formatearFechaHora(p.citas.inicio) : ""}
                        </span>
                      </p>
                      <p className="text-sm">
                        Monto esperado:{" "}
                        <strong>{formatearCop(p.monto_cop)}</strong> ·{" "}
                        {MEDIOS_PAGO[p.medio as MedioPago] ?? p.medio}
                        {p.referencia && ` · ref. ${p.referencia}`}
                      </p>
                      {p.citas?.expira_cupo_at && (
                        <p className="text-suave text-xs">
                          Cupo hasta{" "}
                          {formatearFechaHora(p.citas.expira_cupo_at)}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {ultimo && (
                        <BotonEnlace
                          href={`/comprobantes/${ultimo.id}`}
                          target="_blank"
                          variante="secundario"
                          tamano="sm"
                        >
                          Ver comprobante
                        </BotonEnlace>
                      )}
                      <Link
                        href={`/profesional/citas/${p.cita_id}`}
                        className="text-primario inline-flex min-h-9 items-center text-sm underline"
                      >
                        Ver cita
                      </Link>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-end gap-3">
                    <form action={verificarPago}>
                      <input type="hidden" name="pagoId" value={p.id} />
                      <input
                        type="hidden"
                        name="volver"
                        value="/profesional/pagos"
                      />
                      <Boton type="submit">Verificar</Boton>
                    </form>
                    <form
                      action={rechazarPago}
                      className="flex items-end gap-2"
                    >
                      <input type="hidden" name="pagoId" value={p.id} />
                      <input
                        type="hidden"
                        name="volver"
                        value="/profesional/pagos"
                      />
                      <select
                        name="motivo"
                        aria-label="Motivo del rechazo"
                        className={cn(CLASES_CONTROL, "border-borde")}
                      >
                        {Object.entries(MOTIVOS_RECHAZO).map(([v, t]) => (
                          <option key={v} value={v}>
                            {t}
                          </option>
                        ))}
                      </select>
                      <Boton type="submit" variante="peligro">
                        Rechazar
                      </Boton>
                    </form>
                  </div>
                </Tarjeta>
              </li>
            );
          })}
        </ul>
      )}

      <section aria-labelledby="devoluciones" className="flex flex-col gap-3">
        <h2 id="devoluciones" className="text-primario text-lg font-semibold">
          Devoluciones pendientes
        </h2>
        {!devoluciones?.length ? (
          <p className="text-suave text-sm">No hay devoluciones pendientes.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {devoluciones.map((d) => (
              <li key={d.id}>
                <Tarjeta className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <p className="font-medium">
                      {formatearCop(d.monto_cop)} · {d.citas?.personas?.nombres}{" "}
                      {d.citas?.personas?.apellidos}
                    </p>
                    <p className="text-suave text-xs">
                      Desde {formatearFechaHora(d.created_at)} · plazo de 5 a 10
                      días hábiles
                    </p>
                  </div>
                  <form
                    action={marcarDevolucionRealizada}
                    className="flex flex-wrap items-end gap-2"
                  >
                    <input type="hidden" name="devolucionId" value={d.id} />
                    <input
                      type="hidden"
                      name="volver"
                      value="/profesional/pagos"
                    />
                    <select
                      name="medio"
                      aria-label="Medio de la devolución"
                      className={cn(CLASES_CONTROL, "border-borde")}
                    >
                      {Object.entries(MEDIOS_PAGO).map(([v, t]) => (
                        <option key={v} value={v}>
                          {t}
                        </option>
                      ))}
                    </select>
                    <input
                      name="referencia"
                      placeholder="Referencia"
                      maxLength={100}
                      aria-label="Referencia de la devolución"
                      className={cn(CLASES_CONTROL, "border-borde")}
                    />
                    <Boton type="submit" variante="secundario">
                      Marcar realizada
                    </Boton>
                  </form>
                </Tarjeta>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
